import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ensureDir } from "./download.js";
import { getAudioDir, getEnginesDir, getModelPath } from "./models.js";

const require = createRequire(import.meta.url);
const FFMPEG_STATIC_PACKAGE = "ffmpeg-static@^5.2.0";
const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let ffmpegStaticPathCache;
let ffmpegStaticInstallAttempted = false;

const RECORDING_MIN_BYTES = 44;

function isExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function executableNames(command) {
  const names = [command];
  if (path.extname(command)) return names;

  if (process.platform === "win32") {
    const extensions = (process.env.PATHEXT || ".EXE;.CMD;.BAT")
      .split(";")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    for (const extension of extensions) names.push(`${command}${extension}`);
  }

  return [...new Set(names)];
}

function bundledFfmpegPath() {
  if (process.platform !== "win32") return "";
  if (ffmpegStaticPathCache !== undefined) return ffmpegStaticPathCache;

  const resolveFromDependency = () => {
    try {
      const candidate = require("ffmpeg-static");
      return typeof candidate === "string" ? path.resolve(candidate) : "";
    } catch {
      return "";
    }
  };

  const installDependency = () => {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    try {
      const result = spawnSync(npm, ["install", "--no-save", "--no-audit", "--no-fund", FFMPEG_STATIC_PACKAGE], {
        cwd: PLUGIN_ROOT,
        stdio: "ignore",
      });
      return result.status === 0;
    } catch {
      return false;
    }
  };

  let candidate = resolveFromDependency();
  if (!candidate && !ffmpegStaticInstallAttempted) {
    ffmpegStaticInstallAttempted = true;
    if (installDependency()) {
      candidate = resolveFromDependency();
    }
  }

  ffmpegStaticPathCache = candidate || "";
  return ffmpegStaticPathCache;
}

function platformKey(options = {}) {
  return `${options.platform || process.platform}-${options.arch || process.arch}`;
}

export function getBundledEngineDir(command, options = {}) {
  if (command !== "whisper-cli") return "";
  return path.join(getEnginesDir(options, options), "whisper.cpp", platformKey(options));
}

function looksLikePath(value) {
  return path.isAbsolute(value) || value.includes("/") || value.includes("\\");
}

function candidateCommands(command, options = {}) {
  const candidates = [];

  if (command === "whisper-cli") {
    if (options.whisperCli) candidates.push(options.whisperCli);
    if (process.env.OPENCODE_VOICE_WHISPER_CLI) candidates.push(process.env.OPENCODE_VOICE_WHISPER_CLI);
  }

  if (command === "ffmpeg") {
    const bundled = bundledFfmpegPath();
    if (bundled) candidates.push(bundled);
  }

  const bundledDir = getBundledEngineDir(command, options);
  if (bundledDir) {
    for (const name of executableNames(command)) candidates.push(path.join(bundledDir, name));
  }

  candidates.push(...executableNames(command));

  const fallbackDirs = [
    path.join(os.homedir(), ".local", "bin"),
    path.join(os.homedir(), ".opencode-voice", "bin"),
    "/usr/local/bin",
    "/opt/homebrew/bin",
    "/usr/bin",
    "/bin",
  ];

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    fallbackDirs.unshift(path.join(localAppData, "opencode-voice", "bin"));
  }

  for (const dir of fallbackDirs) {
    for (const name of executableNames(command)) candidates.push(path.join(dir, name));
  }

  return [...new Set(candidates.filter(Boolean))];
}

export function resolveCommand(command, options = {}) {
  for (const candidate of candidateCommands(command, options)) {
    if (looksLikePath(candidate)) {
      if (isExecutable(candidate)) return candidate;
      continue;
    }

    for (const dir of (process.env.PATH || "").split(path.delimiter).filter(Boolean)) {
      const file = path.join(dir, candidate);
      if (isExecutable(file)) return file;
    }
  }

  return null;
}

export function commandExists(command, options = {}) {
  return Boolean(resolveCommand(command, options));
}

function childEnv(options = {}) {
  const localLib = path.join(os.homedir(), ".local", "lib");
  const localBin = path.join(os.homedir(), ".local", "bin");
  const bundledDir = getBundledEngineDir("whisper-cli", options);
  const pathEntries = [bundledDir, localBin, localLib, process.env.PATH].filter(Boolean);
  return {
    ...process.env,
    PATH: pathEntries.join(path.delimiter),
    LD_LIBRARY_PATH: [localLib, process.env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter),
    DYLD_LIBRARY_PATH: [localLib, process.env.DYLD_LIBRARY_PATH].filter(Boolean).join(path.delimiter),
  };
}

function normalizeWindowsAudioInput(device = "") {
  const value = String(device).trim();
  if (!value || value === "default") return "audio=default";
  if (value.startsWith("audio=") || value.startsWith("video=")) return value;
  return `audio=${value}`;
}

function parseWindowsMicrophones(stderr) {
  const devices = new Set();
  for (const line of stderr.split(/\r?\n/)) {
    const match = line.match(/"([^"]+)"\s+\(audio\)/);
    if (match?.[1]) devices.add(match[1]);
  }

  return [...devices].filter(Boolean);
}

export function listMicrophones() {
  const arecordCommand = resolveCommand("arecord");
  const ffmpegCommand = resolveCommand("ffmpeg");

  if (process.platform === "linux" && arecordCommand) {
    const result = spawnSync(arecordCommand, ["-L"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const devices = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && !line.includes(" ") && line !== "null");
    return ["default", ...devices.filter((item) => item !== "default")];
  }

  if (process.platform === "darwin" && ffmpegCommand) {
    const result = spawnSync(ffmpegCommand, ["-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""], {
      encoding: "utf8",
      stdio: ["ignore", "ignore", "pipe"],
    });
    return result.stderr
      .split(/\r?\n/)
      .map((line) => line.match(/\[(\d+)\]\s+(.+)$/)?.[1])
      .filter(Boolean)
      .map((id) => `:${id}`);
  }

  if (process.platform === "win32" && ffmpegCommand) {
    const result = spawnSync(ffmpegCommand, ["-hide_banner", "-f", "dshow", "-list_devices", "true", "-i", "dummy"], {
      encoding: "utf8",
      stdio: ["ignore", "ignore", "pipe"],
    });
    const devices = parseWindowsMicrophones(result.stderr || "");
    return ["default", ...devices.filter((device) => device !== "default")];
  }

  return ["default"];
}

function buildRecorders(file, settings = {}) {
  const mic = settings.mic || "";
  const recorders = [];
  const arecordCommand = resolveCommand("arecord", settings);
  const ffmpegCommand = resolveCommand("ffmpeg", settings);
  const soxCommand = resolveCommand("sox", settings);

  if (process.platform === "linux" && arecordCommand) {
    recorders.push({
      label: mic ? `arecord (${mic})` : "arecord (default)",
      command: arecordCommand,
      args: ["-q", "-f", "S16_LE", "-r", "16000", "-c", "1", "-t", "wav", ...(mic ? ["-D", mic] : []), file],
    });
  }

  if (process.platform === "linux" && ffmpegCommand) {
    if (!mic) {
      recorders.push({
        label: "ffmpeg pulse (default)",
        command: ffmpegCommand,
        args: ["-hide_banner", "-loglevel", "error", "-y", "-f", "pulse", "-i", "default", "-ac", "1", "-ar", "16000", file],
      });
    }

    recorders.push({
      label: `ffmpeg alsa (${mic || "default"})`,
      command: ffmpegCommand,
      args: ["-hide_banner", "-loglevel", "error", "-y", "-f", "alsa", "-i", mic || "default", "-ac", "1", "-ar", "16000", file],
    });
  }

  if (process.platform === "darwin" && ffmpegCommand) {
    recorders.push({
      label: `ffmpeg avfoundation (${mic || ":0"})`,
      command: ffmpegCommand,
      args: ["-hide_banner", "-loglevel", "error", "-y", "-f", "avfoundation", "-i", mic || ":0", "-ac", "1", "-ar", "16000", file],
    });
  }

  if (process.platform === "win32" && ffmpegCommand) {
    const ffmpegCmd = ffmpegCommand;
    if (ffmpegCmd) {
      const inputs = [...new Set([normalizeWindowsAudioInput(mic), "audio=default"])];
      for (const input of inputs) {
        recorders.push({
          label: `ffmpeg dshow (${input.replace(/^audio=/, "")})`,
          command: ffmpegCmd,
          args: ["-hide_banner", "-loglevel", "error", "-y", "-f", "dshow", "-i", input, "-ac", "1", "-ar", "16000", file],
        });
      }
    }
  }

  if (soxCommand) {
    recorders.push({
      label: "sox default",
      command: soxCommand,
      args: ["-d", "-r", "16000", "-c", "1", "-b", "16", file],
    });
  }

  if (!recorders.length) throw new Error("No recorder found. Install ffmpeg, arecord, or sox.");
  return recorders;
}

function waitForExit(proc, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {}
      finish();
    }, timeoutMs);

    proc.once("exit", () => {
      clearTimeout(timer);
      finish();
    });
    proc.once("error", () => {
      clearTimeout(timer);
      finish();
    });
  });
}

function cleanTranscription(text) {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lastLine(value) {
  return value.trim().split("\n").filter(Boolean).pop() || "";
}

function startRecorder(recorder, file) {
  return new Promise((resolve, reject) => {
    let stderr = "";
    let exited = false;
    let exitCode = null;

    const proc = spawn(recorder.command, recorder.args, { stdio: ["ignore", "ignore", "pipe"] });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.once("error", (error) => {
      exited = true;
      reject(new Error(`${recorder.label}: ${error.message}`));
    });
    proc.once("exit", (code) => {
      exited = true;
      exitCode = code;
    });

    setTimeout(() => {
      if (exited) {
        reject(new Error(`${recorder.label}: ${lastLine(stderr) || `exited with code ${exitCode}`}`));
        return;
      }

      if (!fs.existsSync(file)) {
        try {
          proc.kill("SIGKILL");
        } catch {}
        reject(new Error(`${recorder.label}: did not create an audio file`));
        return;
      }

      resolve({ proc, file, recorder, stderr: () => stderr });
    }, 650);
  });
}

export class VoiceRuntime {
  constructor(options = {}) {
    this.options = options;
    this.recording = null;
    this.recordingError = "";
    this.transcription = null;
    this.pendingSubmit = false;
  }

  isRecording() {
    return Boolean(this.recording);
  }

  isTranscribing() {
    return Boolean(this.transcription);
  }

  async start(settings = {}) {
    if (this.recording) return this.recording.file;

    const dir = getAudioDir(this.options, settings);
    await ensureDir(dir);

    const file = path.join(dir, `voice-${Date.now()}.wav`);
    const recorders = buildRecorders(file, settings);
    const errors = [];
    this.recordingError = "";

    for (const recorder of recorders) {
      await fs.promises.unlink(file).catch(() => {});
      try {
        const active = await startRecorder(recorder, file);
        active.proc.on("exit", () => {
          if (this.recording?.proc === active.proc) this.recording = null;
        });
        this.recording = active;
        return file;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    throw new Error(`Could not start recorder. Tried: ${errors.join("; ")}`);
  }

  async stop() {
    const active = this.recording;
    if (!active) return null;

    try {
      active.proc.kill("SIGINT");
    } catch {}

    await waitForExit(active.proc);
    this.recording = null;

    if (!fs.existsSync(active.file)) {
      const lastError = lastLine(active.stderr?.() || this.recordingError);
      throw new Error(lastError || `${active.recorder?.label || "Recorder"} did not create an audio file`);
    }

    if (fs.statSync(active.file).size <= RECORDING_MIN_BYTES) {
      throw new Error("Recording is empty. Check your microphone input.");
    }

    return active.file;
  }

  async cancel() {
    if (this.recording) {
      try {
        this.recording.proc.kill("SIGKILL");
      } catch {}
      this.recording = null;
    }

    if (this.transcription) {
      try {
        this.transcription.kill("SIGKILL");
      } catch {}
      this.transcription = null;
    }
  }

  async transcribe(audioFile, model, settings = {}) {
    const commandOptions = { ...this.options, downloadDir: settings.downloadDir };
    const whisperCli = resolveCommand("whisper-cli", commandOptions);
    if (!whisperCli) {
      throw new Error("whisper-cli not found. Install whisper.cpp or set OPENCODE_VOICE_WHISPER_CLI to the binary path.");
    }

    const modelFile = getModelPath(model, this.options, settings);
    if (!fs.existsSync(modelFile)) {
      throw new Error(`Model is not downloaded: ${model.name}`);
    }

    const args = ["-m", modelFile, "-f", audioFile, "-np", "-nt"];
    if (settings.language && settings.language !== "auto") args.push("-l", settings.language);

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      const proc = spawn(whisperCli, args, { env: childEnv(commandOptions), stdio: ["ignore", "pipe", "pipe"] });
      this.transcription = proc;

      const timer = setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {}
        this.transcription = null;
        reject(new Error("Transcription timed out"));
      }, this.options.transcriptionTimeoutMs || 120000);

      proc.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      proc.on("error", (error) => {
        clearTimeout(timer);
        this.transcription = null;
        reject(error);
      });
      proc.on("exit", (code) => {
        clearTimeout(timer);
        this.transcription = null;
        if (code !== 0) {
          reject(new Error(stderr.trim().split("\n").pop() || `whisper-cli exited with code ${code}`));
          return;
        }

        const text = cleanTranscription(stdout);
        if (!text) {
          reject(new Error("Transcription returned empty text"));
          return;
        }
        resolve(text);
      });
    });
  }
}
