<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/opencode-voice-dark.svg">
    <img alt="opencode voice groq" src="assets/opencode-voice-light.svg">
  </picture>
</p>

[English](README.md) | [Русский](docs/README.ru.md) | [简体中文](docs/README.zh.md) | [Español](docs/README.es.md)

# opencode-voice-groq

Cloud-based, ultra-fast voice input plugin for [OpenCode](https://github.com/opencode-ai/opencode) using Groq's Whisper API (`whisper-large-v3` & `whisper-large-v3-turbo`).

This is a heavily optimized fork of the original `opencode-voice`. Instead of downloading heavy models and processing audio locally (which consumes CPU/GPU and takes time), this plugin uses **Groq's LPU inference engine**. Audio is recorded, aggressively compressed to `m4a` (AAC) on-the-fly, stripped of silence, and transcribed in milliseconds.

## Features

- **Ultra-fast Transcription**: Powered by Groq API.
- **Advanced Audio Compression**: Records straight to `.m4a` to eliminate network latency.
- **Silence Removal**: Automatically strips silence at the start and end of your voice input.
- **Fail-Fast Quota Protection**: Tracks your Groq RPM (Requests Per Minute) locally. If you exceed the free tier limit, the plugin stops you *before* you even start speaking to save time.
- **Auto-Retry**: Seamlessly handles momentary network drops by automatically retrying the transcription once.
- **Model Tuning**: Configure temperature, language, and context-aware vocabulary (e.g., prompt Whisper to recognize `TypeScript, React, OpenCode`) directly in the UI.
- **Cancel Hotkey**: Instantly abort an ongoing recording without sending data to Groq.

## Installation

One command through OpenCode:

```bash
opencode plugin @loyslow/opencode-voice-groq
```

Optional CLI installer:

```bash
npx @loyslow/opencode-voice-groq install
```

## Setup

First launch opens a setup prompt. 
1. Get your free API key at [Groq Console](https://console.groq.com/keys).
2. Enter the API key.
3. Configure your hotkeys, model, and context vocabulary via the interactive menu.

Tip:
Use `/voice-settings` to access the Model Tuning menu (language, temperature, context prompt) or configure your microphone.

## Credits

This plugin is a hard fork of the incredible original project. Massive thanks to the original author:
- Original Repository: [ihxnnxs/opencode-voice](https://github.com/ihxnnxs/opencode-voice)
