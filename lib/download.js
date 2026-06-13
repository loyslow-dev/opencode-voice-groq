import fs from "node:fs";
import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getModelPath, getModelsDir, getModelVerificationPath } from "./models.js";

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
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Download timed out after ${Math.round(timeoutMs / 1000)}s`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadModelOnce(model, options = {}, settings = {}, hooks = {}, attempt = 1, attempts = 1) {
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
  const response = await fetchWithTimeout(model.url, { headers }, Number(options.downloadTimeoutMs || hooks.timeoutMs || 60000));

  if (response.status === 416 && partialSize > 0) {
    await fs.promises.unlink(partial).catch(() => {});
    return downloadModelOnce(model, options, settings, hooks, attempt, attempts);
  }

  if (!response.ok && response.status !== 206) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const append = response.status === 206 && partialSize > 0;
  const contentLength = Number(response.headers.get("content-length") || 0);
  const total = contentLength > 0 ? contentLength + (append ? partialSize : 0) : model.sizeMB ? model.sizeMB * 1024 * 1024 : 0;
  let downloaded = append ? partialSize : 0;

  hooks.onProgress?.({ state: "downloading", downloaded, total, percent: total ? (downloaded / total) * 100 : 0, attempt, attempts });

  const body = response.body?.getReader ? Readable.fromWeb(response.body) : response.body;
  if (!body) throw new Error("Download failed: empty response body");

  const progress = new Transform({
    transform(chunk, _encoding, callback) {
      downloaded += chunk.length ?? chunk.byteLength ?? 0;
      hooks.onProgress?.({ state: "downloading", downloaded, total, percent: total ? (downloaded / total) * 100 : 0, attempt, attempts });
      callback(null, chunk);
    },
  });

  await pipeline(body, progress, fs.createWriteStream(partial, { flags: append ? "a" : "w" }));

  hooks.onProgress?.({ state: "verifying", downloaded, total: total || downloaded, percent: 100, attempt, attempts });

  if (!(await verifyModel(model, partial))) {
    await fs.promises.unlink(partial).catch(() => {});
    throw new Error(`SHA256 mismatch for ${model.name}`);
  }

  await fs.promises.rename(partial, file);
  await writeModelVerificationMarker(model, file, options, settings);
  hooks.onProgress?.({ state: "done", downloaded, total: total || downloaded, percent: 100, attempt, attempts });
  return file;
}

export async function downloadModel(model, options = {}, settings = {}, hooks = {}) {
  const attempts = Number(options.downloadRetries || hooks.retries || 3);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await downloadModelOnce(model, options, settings, hooks, attempt, attempts);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      hooks.onRetry?.({ error, attempt, attempts, nextAttempt: attempt + 1 });
      await sleep(Math.min(1000 * attempt, 3000));
    }
  }

  throw lastError;
}
