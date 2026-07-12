<p align="center">
  <a href="https://github.com/loyslow-dev/opencode-voice-groq">
    <picture>
      <source srcset="../assets/opencode-voice-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="../assets/opencode-voice-light.svg" media="(prefers-color-scheme: light)">
      <img src="../assets/opencode-voice-light.svg" alt="opencode voice groq logo">
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
  <a href="../README.md">English</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.es.md">Español</a>
</p>

---

Este es un fork de `opencode-voice`. En lugar de descargar modelos pesados y procesar audio localmente, este complemento usa los **LPU de Groq**. El audio se graba, se comprime agresivamente a `.m4a` sobre la marcha, se le elimina el silencio y se transcribe en milisegundos.

### Instalación

Un comando a través de OpenCode:

```bash
opencode plugin @loyslow/opencode-voice-groq
```

Reinicia OpenCode después de instalar. El primer inicio te pedirá una clave API de Groq para usar su motor de inferencia LPU. El plugin usa `ffmpeg` de manera automática.

Instalador CLI opcional:

```bash
npx @loyslow/opencode-voice-groq install
```

### Créditos

- El logotipo de OpenCode SVG fue adaptado del [repositorio público de OpenCode](https://github.com/anomalyco/opencode). La marca `voice` se añadió para este plugin.
- Este es un fork del proyecto original [opencode-voice](https://github.com/ihxnnxs/opencode-voice) creado por `@ihxnnxs`.

---

**OpenCode** [Website](https://opencode.ai) | [Docs](https://opencode.ai/docs) | [Discord](https://opencode.ai/discord)
