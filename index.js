import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { VoiceRuntime, ensureManagedRecorder, getRecorderStatus, listMicrophones, probeRecorder, getCacheDir } from "./lib/engine.js";

const PLUGIN_ID = "opencode-voice-groq";

const KV = {
  hotkey: "voice.hotkey",
  toggleHotkey: "voice.toggleHotkey",
  submitHotkey: "voice.submitHotkey",
  cancelHotkey: "voice.cancelHotkey",
  model: "voice.model",
  mic: "voice.mic",
  autoSubmit: "voice.autoSubmit",
  groqApiKey: "voice.groqApiKey",
  language: "voice.language",
  temperature: "voice.temperature",
  prompt: "voice.prompt",
};

const MODELS = [
  { id: "whisper-large-v3", name: "Whisper Large v3" },
  { id: "whisper-large-v3-turbo", name: "Whisper Large v3 Turbo" }
];

const DEFAULT_SETTINGS = {
  model: "whisper-large-v3",
  hotkey: "",
  toggleHotkey: "ctrl+r",
  submitHotkey: "",
  cancelHotkey: "",
  mic: "",
  autoSubmit: false,
  groqApiKey: "",
  language: "auto",
  temperature: 0.0,
  prompt: "JavaScript, TypeScript, React, OpenCode, API, JSON, bash, python",
};

function readSettings(kv) {
  const settings = { ...DEFAULT_SETTINGS };
  for (const [name, key] of Object.entries(KV)) settings[name] = kv.get(key, settings[name]);

  if (!MODELS.find(m => m.id === settings.model)) settings.model = DEFAULT_SETTINGS.model;
  settings.hotkey = String(settings.hotkey || "").trim();
  settings.toggleHotkey = String(settings.toggleHotkey || "").trim();
  settings.submitHotkey = String(settings.submitHotkey || "").trim();
  settings.cancelHotkey = String(settings.cancelHotkey || "").trim();
  if (settings.cancelHotkey === "escape") {
    settings.cancelHotkey = "";
    kv.set(KV.cancelHotkey, "");
  }
  settings.mic = String(settings.mic || "").trim();
  settings.groqApiKey = String(settings.groqApiKey || "").trim();
  settings.language = String(settings.language || "auto").trim();
  settings.prompt = String(settings.prompt || "").trim();
  settings.temperature = Number(settings.temperature) || 0.0;
  settings.autoSubmit = Boolean(settings.autoSubmit);
  return settings;
}

function writeSetting(kv, name, value) {
  kv.set(KV[name], value);
}

function toast(api, message, variant = "info") {
  api.ui.toast({ title: "Voice", message, variant });
}

function setDialog(ctx, size, render) {
  ctx.api.ui.dialog.setSize(size);
  ctx.api.ui.dialog.replace(render);
}

function renderProgressBars(currentRequests, maxLimit) {
  const totalBlocks = 15;
  const percent = maxLimit > 0 ? (currentRequests / maxLimit) * 100 : 0;
  const filledBlocks = Math.round((percent / 100) * totalBlocks);
  const emptyBlocks = Math.max(0, totalBlocks - filledBlocks);
  const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  return `${currentRequests} / ${maxLimit} [${bar}]`;
}

function getLocalRPM(kv, modelId) {
  const key = modelId === 'whisper-large-v3-turbo' ? 'voice.rpm_turbo' : 'voice.rpm_v3';
  const historyStr = kv.get(key, "");
  let history = historyStr ? historyStr.split(",").map(Number) : [];
  const now = Date.now();
  history = history.filter(t => now - t < 60000);
  
  if (history.length !== (historyStr ? historyStr.split(",").length : 0)) {
     kv.set(key, history.join(","));
  }
  return 20 - history.length;
}

export function recordRequest(kv, modelId) {
  const key = modelId === 'whisper-large-v3-turbo' ? 'voice.rpm_turbo' : 'voice.rpm_v3';
  const historyStr = kv.get(key, "");
  let history = historyStr ? historyStr.split(",").map(Number) : [];
  const now = Date.now();
  history = history.filter(t => now - t < 60000);
  history.push(now);
  kv.set(key, history.join(","));
}

async function fetchQuotaForModel(apiKey, modelId, kv) {
  const dummyWav = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 
    0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 
    0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00, 0x02, 0x00, 0x10, 0x00, 
    0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00
  ]);
  
  const blob = new Blob([dummyWav], { type: 'audio/wav' });
  const formData = new FormData();
  formData.append('file', blob, 'test.wav');
  formData.append('model', modelId);
  
  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData
  });

  if (response.status === 401) {
    throw new Error("Unauthorized: Invalid API Key");
  }
  
  const rpmRem = Math.max(0, getLocalRPM(kv, modelId));

  return {
    rpdRem: Number(response.headers.get('x-ratelimit-remaining-requests')) || 0,
    rpdLim: Number(response.headers.get('x-ratelimit-limit-requests')) || 0,
    rpmRem: rpmRem,
    rpmLim: 20
  };
}

async function checkGroqQuota(ctx, apiKey) {
  if (!apiKey) {
    toast(ctx.api, "Please set your API Key first", "error");
    return;
  }
  
  toast(ctx.api, "Checking Quota limits...", "info");
  
  try {
    const v3 = await fetchQuotaForModel(apiKey, 'whisper-large-v3', ctx.api.kv);
    const v3turbo = await fetchQuotaForModel(apiKey, 'whisper-large-v3-turbo', ctx.api.kv);
    
    const formatLimit = (rem, lim) => {
      if (lim === 0) return "N/A (not provided by API)";
      return renderProgressBars(rem, lim);
    };
    
    setDialog(ctx, "large", () =>
      ctx.api.ui.DialogAlert({
        title: "Quota limits",
        message: [
          "whisper-large-v3",
          `Available Requests: ${formatLimit(v3.rpdRem, v3.rpdLim)}`,
          `Local RPM Tracker:  ${formatLimit(v3.rpmRem, v3.rpmLim)}`,
          "",
          "whisper-large-v3-turbo",
          `Available Requests: ${formatLimit(v3turbo.rpdRem, v3turbo.rpdLim)}`,
          `Local RPM Tracker:  ${formatLimit(v3turbo.rpmRem, v3turbo.rpmLim)}`,
          "",
          "* Note: Groq requests replenish continuously every few seconds."
        ].join("\n"),
        onConfirm: () => showSettings(ctx)
      })
    );
  } catch (err) {
    toast(ctx.api, "Failed to check quotas: " + err.message, "error");
    showSettings(ctx);
  }
}

function showModelTuning(ctx) {
  const settings = readSettings(ctx.api.kv);

  setDialog(ctx, "large", () =>
    ctx.api.ui.DialogSelect({
      title: "Model Tuning",
      options: [
        {
          title: "Language",
          value: "language",
          description: settings.language,
        },
        {
          title: "Temperature",
          value: "temperature",
          description: String(settings.temperature),
        },
        {
          title: "Context-Aware Vocabulary",
          value: "prompt",
          description: settings.prompt || "empty",
        },
        {
          title: "⬅ Back",
          value: "back",
          description: "Return to settings",
        }
      ],
      onSelect: (option) => {
        if (option.value === "back") {
          showSettings(ctx);
          return;
        }
        if (option.value === "language") {
          setDialog(ctx, "large", () =>
            ctx.api.ui.DialogSelect({
              title: "Select Language",
              options: [
                { title: "Auto", value: "auto" },
                { title: "English", value: "en" },
                { title: "Russian", value: "ru" },
                { title: "German", value: "de" },
                { title: "Spanish", value: "es" },
                { title: "French", value: "fr" },
                { title: "Custom code", value: "__custom" },
                { title: "⬅ Back", value: "back" }
              ],
              onSelect: (sel) => {
                if (sel.value === "back") {
                  showModelTuning(ctx);
                  return;
                }
                if (sel.value === "__custom") {
                  showPrompt(ctx, {
                    title: "Language code",
                    placeholder: "e.g. en, ru",
                    value: "",
                    onConfirm: (val) => {
                      writeSetting(ctx.api.kv, "language", val.trim() || "auto");
                      showModelTuning(ctx);
                    }
                  });
                  return;
                }
                writeSetting(ctx.api.kv, "language", sel.value);
                showModelTuning(ctx);
              }
            })
          );
        }
        if (option.value === "temperature") {
          showPrompt(ctx, {
            title: "Temperature (0.0 to 1.0)",
            placeholder: "0.0 for strict, 0.8 for creative",
            value: String(settings.temperature),
            onConfirm: (val) => {
              const num = Number(val);
              writeSetting(ctx.api.kv, "temperature", isNaN(num) ? 0.0 : num);
              showModelTuning(ctx);
            }
          });
        }
        if (option.value === "prompt") {
          showPrompt(ctx, {
            title: "Context-Aware Vocabulary",
            placeholder: "Comma-separated terms",
            value: settings.prompt,
            onConfirm: (val) => {
              writeSetting(ctx.api.kv, "prompt", val);
              showModelTuning(ctx);
            }
          });
        }
      }
    })
  );
}

function showPrompt(ctx, options) {
  setDialog(ctx, "large", () => ctx.api.ui.DialogPrompt(options));
}

function showSettings(ctx) {
  const settings = readSettings(ctx.api.kv);
  const activeModel = MODELS.find(m => m.id === settings.model);

  setDialog(ctx, "large", () =>
    ctx.api.ui.DialogSelect({
      title: "Voice Settings",
      options: [
        {
          title: "API Key",
          value: "apikey",
          description: settings.groqApiKey ? "********" : "Not set",
        },
        {
          title: "Model",
          value: "model",
          description: activeModel.name,
        },
          {
            title: "Quota limits",
            value: "quotas",
            description: "Fetch live quota limits...",
          },
          {
            title: "Model tuning",
            value: "tuning",
            description: `Lang: ${settings.language}, Temp: ${settings.temperature}`,
          },
          {
            title: "Hold hotkey",
            value: "hotkey",
            description: settings.hotkey ? `hold ${settings.hotkey}` : "disabled",
          },
          {
            title: "Toggle hotkey",
            value: "toggleHotkey",
            description: settings.toggleHotkey || "disabled",
          },
          {
            title: "Submit hotkey",
            value: "submitHotkey",
            description: settings.submitHotkey || "disabled",
          },
          {
            title: "Cancel hotkey",
            value: "cancelHotkey",
            description: settings.cancelHotkey || "disabled",
          },
        {
          title: "Microphone",
          value: "mic",
          description: settings.mic || "system default",
        },
        {
          title: "Auto-submit after /voice",
          value: "autoSubmit",
          description: settings.autoSubmit ? "enabled" : "disabled",
        },
        {
          title: "Diagnostics",
          value: "diagnostics",
          description: "Check recorder status",
        }
      ],
      onSelect: (option) => {
        if (option.value === "apikey") {
          showPrompt(ctx, {
            title: "API Key",
            placeholder: "gsk_...",
            value: settings.groqApiKey,
            onConfirm: (value) => {
              writeSetting(ctx.api.kv, "groqApiKey", value.trim());
              showSettings(ctx);
            },
            onCancel: () => showSettings(ctx),
          });
        }
        if (option.value === "model") {
          const modelOpts = MODELS.map(m => ({ title: m.name, value: m.id, description: m.id }));
          modelOpts.push({ title: "⬅ Back", value: "back", description: "Return to settings" });

          setDialog(ctx, "large", () =>
            ctx.api.ui.DialogSelect({
              title: "Select Model",
              options: modelOpts,
              onSelect: (sel) => {
                if (sel.value === "back") {
                  showSettings(ctx);
                  return;
                }
                writeSetting(ctx.api.kv, "model", sel.value);
                showSettings(ctx);
              }
            })
          );
        }
        if (option.value === "quotas") {
          checkGroqQuota(ctx, settings.groqApiKey);
        }
        if (option.value === "hotkey") {
          showPrompt(ctx, {
            title: "Hold hotkey",
            placeholder: "empty to disable",
            value: settings.hotkey,
            onConfirm: (value) => {
              writeSetting(ctx.api.kv, "hotkey", value.trim());
              ctx.registerCommands();
              showSettings(ctx);
            },
            onCancel: () => showSettings(ctx),
          });
        }
        if (option.value === "toggleHotkey") {
          showPrompt(ctx, {
            title: "Toggle hotkey",
            placeholder: "ctrl+r",
            value: settings.toggleHotkey,
            onConfirm: (value) => {
              writeSetting(ctx.api.kv, "toggleHotkey", value.trim());
              ctx.registerCommands();
              showSettings(ctx);
            },
            onCancel: () => showSettings(ctx),
          });
        }
        if (option.value === "submitHotkey") {
          showPrompt(ctx, {
            title: "Submit hotkey",
            placeholder: "empty to disable",
            value: settings.submitHotkey,
            onConfirm: (value) => {
              writeSetting(ctx.api.kv, "submitHotkey", value.trim());
              ctx.registerCommands();
              showSettings(ctx);
            }
          });
        }
        if (option.value === "cancelHotkey") {
          showPrompt(ctx, {
            title: "Cancel hotkey",
            placeholder: "ctrl+q, empty to disable",
            value: settings.cancelHotkey,
            onConfirm: (value) => {
              writeSetting(ctx.api.kv, "cancelHotkey", value.trim());
              ctx.registerCommands();
              showSettings(ctx);
            }
          });
        }
        if (option.value === "tuning") showModelTuning(ctx);
        if (option.value === "mic") {
          showMicPicker(ctx, true);
        }
        if (option.value === "autoSubmit") {
          writeSetting(ctx.api.kv, "autoSubmit", !settings.autoSubmit);
          showSettings(ctx);
        }
        if (option.value === "diagnostics") {
          showDiagnostics(ctx);
        }
      },
    }),
  );
}

async function showMicPicker(ctx, returnToSettings = false) {
  const settings = readSettings(ctx.api.kv);
  let mics = [];
  try {
    mics = await listMicrophones(settings);
  } catch (error) {
    toast(ctx.api, `Microphone error: ${error.message}`, "error");
    if (returnToSettings) showSettings(ctx);
    else ctx.api.ui.dialog.clear();
    return;
  }

  const options = [{ title: "System Default", value: "", description: "Let the OS choose" }];
  for (const mic of mics) {
    if (mic === "default") continue;
    options.push({ title: String(mic), value: String(mic), description: `Use ${mic}` });
  }

  if (returnToSettings) {
    options.push({ title: "⬅ Back", value: "back", description: "Return to settings" });
  }

  setDialog(ctx, "large", () =>
    ctx.api.ui.DialogSelect({
      title: "Select Microphone",
      options,
      onSelect: (option) => {
        if (option.value === "back") {
          showSettings(ctx);
          return;
        }
        writeSetting(ctx.api.kv, "mic", option.value);
        if (returnToSettings) showSettings(ctx);
        else ctx.api.ui.dialog.clear();
      }
    }),
  );
}

async function showDiagnostics(ctx) {
  const settings = readSettings(ctx.api.kv);
  const recorder = getRecorderStatus(ctx.options, settings);
  const probe = recorder.resolvedBinary ? await probeRecorder(recorder.resolvedBinary) : null;

  setDialog(ctx, "xlarge", () =>
    ctx.api.ui.DialogAlert({
      title: "Diagnostics",
      message: [
        "Recorder",
        `Binary: ${recorder.resolvedBinary || "not found"}`,
        `Version: ${probe?.ok ? probe.version : probe ? probe.message : "N/A"}`,
      ].join("\n"),
      onConfirm: () => showSettings(ctx)
    }),
  );
}

async function startVoice(ctx, fromSlashCommand, submit = false) {
  const settings = readSettings(ctx.api.kv);
  if (!settings.groqApiKey) {
    toast(ctx.api, "Please configure API Key first", "warning");
    showSettings(ctx);
    return;
  }
  
  if (ctx.runtime.isTranscribing()) {
    toast(ctx.api, "Already transcribing", "warning");
    return;
  }
  if (ctx.runtime.isRecording()) {
    toast(ctx.api, "Already recording", "warning");
    return;
  }

  const activeModel = MODELS.find(m => m.id === settings.model) || MODELS[1];
  const rpmRem = getLocalRPM(ctx.api.kv, activeModel.id);
  if (rpmRem <= 0) {
    toast(ctx.api, "RPM limit reached for this model. Wait a few seconds.", "error");
    return;
  }

  ctx.runtime.pendingSubmit = submit;
  ctx.runtime.isCancelled = false;
  toast(ctx.api, "Recording started...", "info");

  try {
    await ctx.runtime.start(settings);
  } catch (error) {
    toast(ctx.api, String(error), "error");
  }
}

async function finishVoice(ctx, fromSlashCommand) {
  const settings = readSettings(ctx.api.kv);
  const activeModel = MODELS.find(m => m.id === settings.model);
  const file = await ctx.runtime.stop().catch((error) => {
    toast(ctx.api, String(error), "error");
    return null;
  });

  if (!file) {
    return;
  }

  toast(ctx.api, `Transcribing (${activeModel.id})...`, "info");
  
    try {
      recordRequest(ctx.api.kv, activeModel.id);
      
      settings.onRetry = (msg) => toast(ctx.api, `Network issue, retrying...`, "warning");

      const text = await ctx.runtime.transcribe(file, activeModel, settings);
    if (!text) {
      toast(ctx.api, "No speech detected", "warning");
    } else {
      const next = text.endsWith(" ") ? text : `${text} `;
      await ctx.api.client.tui.appendPrompt({ text: next });
      if (ctx.runtime.pendingSubmit || (fromSlashCommand && settings.autoSubmit)) {
        await ctx.api.client.tui.submitPrompt();
      }
    }
    } catch (error) {
      if (!ctx.runtime.isCancelled && !error.message.includes("cancelled")) {
        toast(ctx.api, String(error), "error");
      }
    } finally {
      ctx.runtime.pendingSubmit = false;
      ctx.runtime.isCancelled = false;
    }
}

async function stopVoice(ctx) {
  if (!ctx.runtime.isRecording() && !ctx.runtime.isTranscribing()) return;
  await ctx.runtime.cancel();
  toast(ctx.api, "Voice cancelled", "info");
}

async function toggleVoice(ctx, submit = false) {
  if (ctx.runtime.isTranscribing()) return;
  if (ctx.runtime.isRecording()) await finishVoice(ctx, true);
  else await startVoice(ctx, true, submit);
}

function buildBindings(settings) {
  const bindings = [];
  if (settings.hotkey) {
    bindings.push({ key: settings.hotkey, event: "press", preventDefault: true, cmd: "voice.hold.start", desc: "Start recording (hold)" });
    bindings.push({ key: settings.hotkey, event: "release", preventDefault: true, cmd: "voice.hold.finish", desc: "Finish recording (release)" });
  }
  if (settings.toggleHotkey) {
    bindings.push({ key: settings.toggleHotkey, event: "press", preventDefault: true, cmd: "voice.record", desc: "Voice toggle recording" });
  }
  if (settings.submitHotkey) {
    bindings.push({ key: settings.submitHotkey, event: "press", preventDefault: true, cmd: "voice.submit", desc: "Voice input and submit" });
  }
  if (settings.cancelHotkey) {
    bindings.push({ key: settings.cancelHotkey, event: "press", preventDefault: true, cmd: "voice.stop", desc: "Cancel voice recording" });
  }
  return bindings;
}

function buildCommands(ctx) {
  return [
    {
      name: "voice.hold.start",
      title: "Voice: hold start",
      desc: "Start hold-to-talk recording.",
      category: "Voice",
      namespace: "palette",
      hidden: true,
      run: () => startVoice(ctx, false, true),
    },
    {
      name: "voice.hold.finish",
      title: "Voice: hold finish",
      desc: "Stop hold-to-record and transcribe.",
      category: "Voice",
      namespace: "palette",
      hidden: true,
      run: () => finishVoice(ctx, false),
    },
    {
      name: "voice.record",
      title: "Voice: record",
      desc: "Toggle local voice recording and append transcription to the prompt.",
      category: "Voice",
      namespace: "palette",
      slashName: "voice",
      slashAliases: ["voice-record"],
      run: () => toggleVoice(ctx, false),
    },
    {
      name: "voice.submit",
      title: "Voice: submit",
      desc: "Toggle local voice recording and submit after transcription.",
      category: "Voice",
      namespace: "palette",
      slashName: "voice-submit",
      run: () => toggleVoice(ctx, true),
    },
    {
      name: "voice.stop",
      title: "Voice: stop",
      desc: "Cancel active voice recording or transcription.",
      category: "Voice",
      namespace: "palette",
      slashName: "voice-stop",
      run: () => stopVoice(ctx),
    },
    {
      name: "voice.settings",
      title: "Voice: settings",
      desc: "Open voice input settings.",
      category: "Voice",
      namespace: "palette",
      slashName: "voice-settings",
      run: () => showSettings(ctx),
    },
  ];
}

async function checkUpdate(api) {
  try {
    const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const res = await fetch(`https://registry.npmjs.org/${pkg.name}/latest`);
    const data = await res.json();
    if (data.version && data.version !== pkg.version) {
      toast(api, `Updating ${pkg.name} to ${data.version}...`, "info");
      const proc = spawn("opencode", ["plugin", pkg.name], { detached: true, stdio: "ignore" });
      proc.unref();
    }
  } catch (e) {}
}

const plugin = {
  id: PLUGIN_ID,
  tui: async (api, options = {}) => {
    setTimeout(() => checkUpdate(api), 3000);
    const runtime = new VoiceRuntime(options || {});
    const ctx = {
      api,
      options: options || {},
      runtime,
      disposeCommands: undefined,
      registerCommands() {
        if (ctx.disposeCommands) ctx.disposeCommands();
        const settings = readSettings(api.kv);
        ctx.disposeCommands = api.keymap.registerLayer({
          priority: 100,
          commands: buildCommands(ctx),
          bindings: buildBindings(settings),
        });
      },
    };

    ctx.registerCommands();
    api.lifecycle.onDispose(() => {
      if (ctx.disposeCommands) ctx.disposeCommands();
      runtime.cancel();
    });

    setTimeout(() => {
      const settings = readSettings(api.kv);
      if (!settings.groqApiKey) {
        showPrompt(ctx, {
          title: "Enter Groq API key to use Voice input",
          placeholder: "gsk_...",
          value: "",
          onConfirm: (value) => {
            writeSetting(api.kv, "groqApiKey", value.trim());
            toast(api, "API Key saved. Press Ctrl+R to start recording!", "info");
            ctx.api.ui.dialog.clear();
          },
        });
      }
    }, 250);
  },
};

export default plugin;