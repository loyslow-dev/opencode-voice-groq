import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PLUGIN_ID = "opencode-voice";
export const DEFAULT_MODEL_ID = "whisper-small";

export const MODELS = [
  {
    id: "whisper-small",
    name: "Whisper Small",
    engine: "whisper.cpp",
    implemented: true,
    recommended: true,
    filename: "ggml-small.bin",
    url: "https://blob.handy.computer/ggml-small.bin",
    sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
    sizeMB: 465,
    languages: "multilingual",
    description: "Good first local model. Multilingual, including Russian, but not tiny.",
  },
  {
    id: "whisper-medium-q4_1",
    name: "Whisper Medium Q4_1",
    engine: "whisper.cpp",
    implemented: true,
    filename: "whisper-medium-q4_1.bin",
    url: "https://blob.handy.computer/whisper-medium-q4_1.bin",
    sha256: "79283fc1f9fe12ca3248543fbd54b73292164d8df5a16e095e2bceeaaabddf57",
    sizeMB: 469,
    languages: "multilingual",
    description: "Better accuracy than Small with a quantized model size.",
  },
  {
    id: "whisper-turbo",
    name: "Whisper Turbo",
    engine: "whisper.cpp",
    implemented: true,
    filename: "ggml-large-v3-turbo.bin",
    url: "https://blob.handy.computer/ggml-large-v3-turbo.bin",
    sha256: "1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69",
    sizeMB: 1549,
    languages: "multilingual",
    description: "Large and accurate. Download only if you want the bigger model.",
  },
  {
    id: "whisper-large-q5_0",
    name: "Whisper Large Q5_0",
    engine: "whisper.cpp",
    implemented: true,
    filename: "ggml-large-v3-q5_0.bin",
    url: "https://blob.handy.computer/ggml-large-v3-q5_0.bin",
    sha256: "d75795ecff3f83b5faa89d1900604ad8c780abd5739fae406de19f23ecd98ad1",
    sizeMB: 1031,
    languages: "multilingual",
    description: "Accurate but slower. Good machines only.",
  },
  {
    id: "parakeet-v3",
    name: "Parakeet V3",
    engine: "sidecar",
    implemented: false,
    sizeMB: 456,
    languages: "25 European languages plus Russian/Ukrainian",
    description: "Planned Handy-style sidecar model. Not enabled in this JS MVP yet.",
  },
  {
    id: "gigaam-v3",
    name: "GigaAM v3",
    engine: "sidecar",
    implemented: false,
    sizeMB: 151,
    languages: "Russian",
    description: "Planned Russian-focused sidecar model. Not enabled in this JS MVP yet.",
  },
  {
    id: "moonshine-small-streaming-en",
    name: "Moonshine V2 Small",
    engine: "sidecar",
    implemented: false,
    sizeMB: 99,
    languages: "English",
    description: "Planned fast English sidecar model. Not enabled in this JS MVP yet.",
  },
];

export const DEFAULT_SETTINGS = {
  hotkey: "",
  toggleHotkey: "ctrl+r",
  submitHotkey: "",
  model: DEFAULT_MODEL_ID,
  language: "auto",
  mic: "",
  autoSubmit: false,
  downloadDir: "",
  onboardingDone: false,
  setupSkipped: false,
};

export function expandHome(value) {
  if (!value) return value;
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

export function getCacheDir(options = {}, settings = {}) {
  const configured = settings.downloadDir || options.downloadDir || process.env.OPENCODE_VOICE_DIR;
  if (configured) return path.resolve(expandHome(configured));

  const xdg = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(xdg, PLUGIN_ID);
}

export function getModelsDir(options = {}, settings = {}) {
  return path.join(getCacheDir(options, settings), "models");
}

export function getAudioDir(options = {}, settings = {}) {
  return path.join(getCacheDir(options, settings), "recordings");
}

export function getEnginesDir(options = {}, settings = {}) {
  return path.join(getCacheDir(options, settings), "engines");
}

export function getModel(id) {
  return MODELS.find((model) => model.id === id) || MODELS.find((model) => model.id === DEFAULT_MODEL_ID);
}

export function getModelPath(model, options = {}, settings = {}) {
  if (!model?.filename) return "";
  return path.join(getModelsDir(options, settings), model.filename);
}

export function getModelVerificationPath(model, options = {}, settings = {}) {
  const file = getModelPath(model, options, settings);
  return file ? `${file}.sha256` : "";
}

export function isModelFilePresent(model, options = {}, settings = {}) {
  const file = getModelPath(model, options, settings);
  return Boolean(file && fs.existsSync(file) && fs.statSync(file).size > 0);
}

export function isModelDownloaded(model, options = {}, settings = {}) {
  if (!isModelFilePresent(model, options, settings)) return false;
  if (!model?.sha256) return true;

  const marker = getModelVerificationPath(model, options, settings);
  if (!marker || !fs.existsSync(marker)) return false;

  const value = fs.readFileSync(marker, "utf8").trim().toLowerCase();
  return value === model.sha256.toLowerCase();
}

export function formatSize(model) {
  if (!model?.sizeMB) return "unknown size";
  if (model.sizeMB >= 1000) return `${(model.sizeMB / 1000).toFixed(1)} GB`;
  return `${model.sizeMB} MB`;
}
