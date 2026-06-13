#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const [command, ...args] = process.argv.slice(2);

function hasFlag(flag) {
  return args.includes(flag);
}

function help() {
  console.log(`opencode-voice

Usage:
  opencode-voice install [--global] [--no-engine]
  opencode-voice doctor [--json]
  opencode-voice engine status whisper.cpp [--json]
  opencode-voice engine install whisper.cpp
  opencode-voice engine import whisper.cpp [path-to-whisper-cli]
  opencode-voice engine remove whisper.cpp

Development install from this checkout:
  opencode plugin <path-to-this-checkout>
`);
}

function packageName() {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  return process.env.OPENCODE_VOICE_PACKAGE || manifest.name || "opencode-voice";
}

async function runtime() {
  const [engine, models, engines] = await Promise.all([import("../lib/engine.js"), import("../lib/models.js"), import("../lib/engines.js")]);
  return { ...engine, ...models, ...engines };
}

async function doctor() {
  const {
    commandExists,
    getAudioDir,
    getCacheDir,
    getEngineStatus,
    getModelsDir,
    listMicrophones,
    probeEngine,
  } = await runtime();

  const engine = getEngineStatus("whisper.cpp");
  const probe = engine.resolvedBinary ? await probeEngine("whisper.cpp", engine.resolvedBinary) : { ok: false, message: "missing binary" };
  const payload = {
    platform: `${process.platform}-${process.arch}`,
    cacheDir: getCacheDir(),
    modelsDir: getModelsDir(),
    recordingsDir: getAudioDir(),
    engine,
    probe,
    recorders: {
      ffmpeg: commandExists("ffmpeg"),
      arecord: commandExists("arecord"),
      sox: commandExists("sox"),
    },
    microphones: listMicrophones(),
  };

  if (hasFlag("--json")) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(
      [
        "opencode-voice doctor",
        "",
        `Platform: ${payload.platform}`,
        `Cache dir: ${payload.cacheDir}`,
        `Models dir: ${payload.modelsDir}`,
        `Recordings dir: ${payload.recordingsDir}`,
        `Engine source: ${engine.source}`,
        `Managed engine dir: ${engine.managedDir}`,
        `whisper-cli: ${engine.resolvedBinary || "missing"}`,
        `Probe: ${probe.ok ? "ok" : probe.message}`,
        `Recorders: ffmpeg=${payload.recorders.ffmpeg ? "yes" : "no"}, arecord=${payload.recorders.arecord ? "yes" : "no"}, sox=${payload.recorders.sox ? "yes" : "no"}`,
        `Microphones: ${payload.microphones.join(", ")}`,
      ].join("\n"),
    );
  }

  if (!engine.resolvedBinary || !probe.ok) process.exitCode = 1;
}

async function engineCommand() {
  const [action, engineId = "whisper.cpp", maybePath] = args;
  const { getEngineStatus, importManagedEngine, installManagedEngine, removeManagedEngine } = await runtime();

  if (engineId !== "whisper.cpp") {
    console.error(`Unsupported engine: ${engineId}`);
    process.exit(1);
  }

  if (action === "status") {
    const status = getEngineStatus(engineId);
    if (hasFlag("--json")) console.log(JSON.stringify(status, null, 2));
    else {
      console.log(
        [
          `Engine: ${status.id}`,
          `Platform: ${status.platform}`,
          `Source: ${status.source}`,
          `Resolved binary: ${status.resolvedBinary || "missing"}`,
          `Managed binary: ${status.managedBinary}`,
          `Managed installed: ${status.managedInstalled ? "yes" : "no"}`,
          `Managed version: ${status.manifest?.version || "missing"}`,
        ].join("\n"),
      );
    }
    if (!status.resolvedBinary) process.exitCode = 1;
    return;
  }

  if (action === "import") {
    const status = getEngineStatus(engineId);
    const source = maybePath || (status.source !== "managed" ? status.resolvedBinary : "");
    const result = await importManagedEngine(engineId, source);
    console.log(`Imported ${engineId}: ${result.managedBinary}`);
    return;
  }

  if (action === "install") {
    const result = await installManagedEngine(engineId, {}, {}, { onProgress: printEngineProgress, onRetry: printEngineRetry });
    console.log(`Installed ${engineId}: ${result.managedBinary}`);
    return;
  }

  if (action === "remove") {
    const dir = await removeManagedEngine(engineId);
    console.log(`Removed managed ${engineId}: ${dir}`);
    return;
  }

  help();
  process.exitCode = 1;
}

function printEngineProgress(progress) {
  const label = {
    registry: "registry",
    downloading: "download",
    verifying: "verify archive",
    decompressing: "unpack",
    "verifying-binary": "verify binary",
    probing: "probe",
    done: "done",
  }[progress.state] || progress.state || "engine";
  const percent = Number.isFinite(progress.percent) ? `${Math.round(progress.percent)}%` : "";
  if (progress.state === "downloading" || progress.state === "done") console.log(`engine ${label} ${percent}`.trim());
}

function printEngineRetry({ error, nextAttempt, attempts }) {
  console.warn(`engine retry ${nextAttempt}/${attempts}: ${error instanceof Error ? error.message : String(error)}`);
}

async function installCommand() {
  const pluginArgs = args.filter((arg) => arg !== "--no-engine");
  const result = spawnSync("opencode", ["plugin", packageName(), ...pluginArgs], { stdio: "inherit" });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);

  if (!hasFlag("--no-engine")) {
    const { installManagedEngine } = await runtime();
    console.log("Installing managed voice engine...");
    const engine = await installManagedEngine("whisper.cpp", {}, {}, { onProgress: printEngineProgress, onRetry: printEngineRetry });
    console.log(`Managed voice engine ready: ${engine.managedBinary}`);
  }
}

if (command === "install") await installCommand();
else if (command === "doctor") await doctor();
else if (command === "engine") await engineCommand();
else help();
