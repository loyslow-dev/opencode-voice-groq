import fs from "node:fs";
import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getModelPath, getModelsDir, getModelVerificationPath } from "./models.js";

const DEFAULT_DOWNLOAD_RETRIES = 5;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 120000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

export async function sha256(file) {
  const hash = createHash("sha256");
  const input = fs.createReadStream(file);
  for await (const chunk of input) hash.update(chunk);
  return hash.digest("hex");
}

export async function verifyModel(model, file) {
  if (!model.sha256) return true;
  const actual = await sha256(file);
  return actual === model.sha256;
}

export async function writeModelVerificationMarker(model, file, options = {}, settings = {}) {
  if (!model.sha256) return;
  const marker = getModelVerificationPath(model, options, settings);
  await fs.promises.writeFile(marker, `${model.sha256}\n`);
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  let timer;
  const reset = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), timeoutMs);
  };
  const clear = () => clearTimeout(timer);
  reset();

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { response, signal: controller.signal, reset, clear };
  } catch (error) {
    clear();
    if (error?.name === "AbortError") throw new Error(`Download timed out after ${Math.round(timeoutMs / 1000)}s`);
    throw error;
  }
}

function downloadError(error, url, timeoutMs) {
  if (error?.name === "AbortError" || error?.code === "ABORT_ERR") {
    return new Error(`Download timed out or stalled from ${url} after ${Math.round(timeoutMs / 1000)}s`);
  }
  return error;
}

function modelUrls(model) {
  return [...new Set([...(Array.isArray(model.urls) ? model.urls : []), model.url].filter(Boolean))];
}

function contentRangeStart(value) {
  const match = /^bytes\s+(\d+)-/i.exec(value || "");
  return match ? Number(match[1]) : null;
}

async function replaceFile(source, destination) {
  await fs.promises.unlink(destination).catch(() => {});

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await fs.promises.rename(source, destination);
      return;
    } catch (error) {
      if (attempt >= 5 || !["EBUSY", "EPERM", "EACCES"].includes(error?.code)) throw error;
      await sleep(100 * attempt);
    }
  }
}

async function downloadModelOnce(model, sourceUrl, options = {}, settings = {}, hooks = {}, attempt = 1, attempts = 1) {
  if (!model?.implemented || !model.url || !model.filename) {
    throw new Error(`${model?.name || "Model"} is not supported by the current local engine yet`);
  }

  const dir = getModelsDir(options, settings);
  const file = getModelPath(model, options, settings);
  const partial = `${file}.partial`;
  await ensureDir(dir);

  if (fs.existsSync(file)) {
    hooks.onProgress?.({ state: "verifying", downloaded: fs.statSync(file).size, total: fs.statSync(file).size, percent: 100, attempt, attempts });
    if (await verifyModel(model, file)) {
      await writeModelVerificationMarker(model, file, options, settings);
      return file;
    }
    await fs.promises.unlink(file);
    await fs.promises.unlink(getModelVerificationPath(model, options, settings)).catch(() => {});
  }

  const partialSize = fs.existsSync(partial) ? fs.statSync(partial).size : 0;
  const headers = partialSize > 0 ? { Range: `bytes=${partialSize}-` } : undefined;
  const timeoutMs = Number(options.downloadTimeoutMs || hooks.timeoutMs || DEFAULT_DOWNLOAD_TIMEOUT_MS);
  const request = await fetchWithTimeout(sourceUrl, { headers }, timeoutMs);
  const response = request.response;

  try {
    if (response.status === 416 && partialSize > 0) {
      await fs.promises.unlink(partial).catch(() => {});
      return downloadModelOnce(model, sourceUrl, options, settings, hooks, attempt, attempts);
    }

    if (!response.ok && response.status !== 206) {
      throw new Error(`Download failed from ${sourceUrl}: HTTP ${response.status}`);
    }

    const append = response.status === 206 && partialSize > 0;
    const rangeStart = append ? contentRangeStart(response.headers.get("content-range")) : null;
    if (append && rangeStart !== null && rangeStart !== partialSize) {
      await fs.promises.unlink(partial).catch(() => {});
      throw new Error(`Download resume mismatch from ${sourceUrl}: expected byte ${partialSize}, got ${rangeStart}`);
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    const total = contentLength > 0 ? contentLength + (append ? partialSize : 0) : model.sizeMB ? model.sizeMB * 1024 * 1024 : 0;
    let downloaded = append ? partialSize : 0;

    hooks.onProgress?.({ state: "downloading", downloaded, total, percent: total ? (downloaded / total) * 100 : 0, attempt, attempts });

    const body = response.body?.getReader ? Readable.fromWeb(response.body) : response.body;
    if (!body) throw new Error("Download failed: empty response body");

    const progress = new Transform({
      transform(chunk, _encoding, callback) {
        request.reset();
        downloaded += chunk.length ?? chunk.byteLength ?? 0;
        hooks.onProgress?.({ state: "downloading", downloaded, total, percent: total ? (downloaded / total) * 100 : 0, attempt, attempts });
        callback(null, chunk);
      },
    });

    try {
      await pipeline(body, progress, fs.createWriteStream(partial, { flags: append ? "a" : "w" }), { signal: request.signal });
    } catch (error) {
      throw downloadError(error, sourceUrl, timeoutMs);
    }
    request.clear();

    const actualSize = fs.statSync(partial).size;
    downloaded = actualSize;
    if (contentLength > 0 && actualSize < total) {
      throw new Error(`Download incomplete from ${sourceUrl}: got ${actualSize} of ${total} bytes`);
    }

    hooks.onProgress?.({ state: "verifying", downloaded, total: total || downloaded, percent: 100, attempt, attempts });

    if (!(await verifyModel(model, partial))) {
      await fs.promises.unlink(partial).catch(() => {});
      throw new Error(`SHA256 mismatch for ${model.name}`);
    }

    await replaceFile(partial, file);
    await writeModelVerificationMarker(model, file, options, settings);
    hooks.onProgress?.({ state: "done", downloaded, total: total || downloaded, percent: 100, attempt, attempts });
    return file;
  } finally {
    request.clear();
  }
}

export async function downloadModel(model, options = {}, settings = {}, hooks = {}) {
  const urls = modelUrls(model);
  const attempts = Math.max(Number(options.downloadRetries || hooks.retries || DEFAULT_DOWNLOAD_RETRIES), urls.length || 1);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const sourceUrl = urls[(attempt - 1) % urls.length];
    try {
      return await downloadModelOnce(model, sourceUrl, options, settings, hooks, attempt, attempts);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      hooks.onRetry?.({ error, attempt, attempts, nextAttempt: attempt + 1 });
      await sleep(Math.min(1000 * attempt, 3000));
    }
  }

  throw lastError;
}
