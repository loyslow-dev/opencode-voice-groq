<p align="center">
  <a href="https://github.com/loyslow-dev/opencode-voice-groq">
    <picture>
      <source srcset="assets/opencode-voice-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="assets/opencode-voice-light.svg" media="(prefers-color-scheme: light)">
      <img src="assets/opencode-voice-light.svg" alt="opencode voice groq logo">
    </picture>
  </a>
</p>
<p align="center">Cloud-based, ultra-fast speech-to-text for the OpenCode TUI.</p>
<p align="center">
  <img alt="status" src="https://img.shields.io/badge/status-mvp-orange?style=flat-square" />
  <a href="https://www.npmjs.com/package/@loyslow/opencode-voice-groq"><img alt="npm version" src="https://img.shields.io/npm/v/@loyslow/opencode-voice-groq?style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/@loyslow/opencode-voice-groq"><img alt="npm downloads" src="https://img.shields.io/npm/dm/@loyslow/opencode-voice-groq?style=flat-square" /></a>
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" />
  <img alt="opencode" src="https://img.shields.io/badge/opencode-%3E%3D1.17.4-black?style=flat-square" />
  <img alt="stt" src="https://img.shields.io/badge/STT-cloud_groq_api-purple?style=flat-square" />
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="docs/README.ru.md">Русский</a> |
  <a href="docs/README.zh.md">简体中文</a> |
  <a href="docs/README.es.md">Español</a>
</p>

---

### Installation

One command through OpenCode:

```bash
opencode plugin @loyslow/opencode-voice-groq
```

Restart OpenCode after installing. First launch will ask for a Groq API key to use their ultra-fast LPU inference engine. The plugin uses `ffmpeg` automatically.

Optional CLI installer. It runs the same OpenCode plugin install command:

```bash
npx @loyslow/opencode-voice-groq install
```

Do not clone the repo unless you want to develop the plugin.

> [!TIP]
> First launch opens a setup prompt. Enter your free Groq API key, choose your preferred Whisper model, then use `ctrl+r` to dictate into the prompt.

### Requirements

The plugin relies on Groq's API and requires a recording engine:

- uses `ffmpeg` from your system, or downloads a managed `ffmpeg-static` fallback
- saves compressed `m4a` recordings to `~/.cache/opencode-voice-groq/recordings/` temporarily
- uses your provided `groqApiKey` for transcription

Get your free API key at [Groq Console](https://console.groq.com/keys).

### Usage

Commands:

- `/voice` - toggle recording and append transcription
- `/voice-submit` - toggle recording, append transcription, and submit
- `/voice-stop` - cancel active recording or transcription
- `/voice-settings` - open model, hotkeys, microphone, and Groq quotas settings

Default hotkey:

```txt
ctrl+r -> start recording
ctrl+r -> stop, transcribe, and append
escape -> cancel recording without sending
```

Hold-to-talk is disabled by default because terminal release events vary by terminal. You can still configure a hold hotkey in `/voice-settings`.

### Models

Available now through Groq API:

| Model                | Inference Speed | Notes                         |
| -------------------- | --------------- | ----------------------------- |
| Whisper Large v3     | Ultra-fast      | highly accurate, multilingual |
| Whisper Large v3 Turbo| Insanely fast  | slightly faster, great accuracy|

The plugin enforces local RPM tracking (Fail-Fast Quota Protection) to prevent you from recording if you've hit your free API limits, saving you time. Audio is compressed to `m4a` with silence removal to optimize bandwidth.

### Platform Status

| Platform | Status |
| -------- | ------ |
| Linux    | one-command install; recording uses `arecord`, `ffmpeg`, or `sox` |
| macOS    | one-command install; recording uses `ffmpeg` AVFoundation |
| Windows  | one-command install; recording uses DirectShow through a managed cached `ffmpeg.exe`, with system/bundled ffmpeg fallback |

### Architecture

The package follows the public OpenCode TUI plugin shape used by community plugins.

- npm package exports `./tui`
- local development can point `tui.json` at an absolute path
- published install uses `opencode plugin @loyslow/opencode-voice-groq`
- runtime settings live in OpenCode TUI plugin storage

Files:

- `index.js` - TUI plugin entrypoint, commands, dialogs, keymap layer, auto-updater
- `lib/download.js` - utility for fetching the fallback recorder
- `lib/engine.js` - recorder selection, managed Windows recorder install, and Groq API `fetch` implementation
- `bin/cli.js` - install wrapper CLI

Voice input needs native audio recording. The JS plugin manages OpenCode UI, settings, engine downloads, and fast API integration. 

### Roadmap

- Faster streaming-style transcription via WebSockets
- Further audio compression tuning

### Development

Run checks:

```bash
npm run prepack
npm pack --dry-run
```

This MVP has no build step.

Development install from a checkout:

```bash
git clone https://github.com/loyslow-dev/opencode-voice-groq.git opencode-voice-groq
cd opencode-voice-groq
opencode plugin "$(pwd)"
```

### Project Status

This is an independent OpenCode plugin. It is not built by the OpenCode team and is not affiliated with OpenCode.

### Credits

- OpenCode wordmark SVG adapted from the public [OpenCode repository](https://github.com/anomalyco/opencode). The `voice` mark was added for this plugin.
- This is a highly optimized fork of the original [opencode-voice](https://github.com/ihxnnxs/opencode-voice) project created by `@ihxnnxs`.

---

**OpenCode** [Website](https://opencode.ai) | [Docs](https://opencode.ai/docs) | [Discord](https://opencode.ai/discord)
