<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/opencode-voice-dark.svg">
    <img alt="opencode voice groq" src="../assets/opencode-voice-light.svg">
  </picture>
</p>

[English](../README.md) | [Русский](README.ru.md) | [简体中文](README.zh.md) | [Español](README.es.md)

# opencode-voice-groq

Plugin de entrada de voz ultrarrápido y basado en la nube para [OpenCode](https://github.com/opencode-ai/opencode) que utiliza la API Whisper de Groq (`whisper-large-v3` y `whisper-large-v3-turbo`).

Este es un fork altamente optimizado de `opencode-voice`. En lugar de descargar modelos pesados y procesar audio localmente, este complemento usa los **LPU de Groq**. El audio se graba, se comprime agresivamente a `.m4a` sobre la marcha, se le elimina el silencio y se transcribe en milisegundos.

## Características

- **Transcripción ultrarrápida**: Impulsada por la API de Groq.
- **Compresión de audio avanzada**: Graba directamente a `.m4a` para eliminar la latencia de red.
- **Eliminación de silencios**: Recorta automáticamente el silencio al inicio y al final de tu voz.
- **Protección de cuota Fail-Fast**: Rastrea tu límite de solicitudes (RPM). Si superas el límite gratuito, te detiene *antes* de grabar.
- **Auto-Retry**: Maneja cortes momentáneos de internet reintentando automáticamente la transcripción.
- **Ajuste del modelo (Model Tuning)**: Configura temperatura, idioma y vocabulario contextual (ej. `TypeScript, React`) en la interfaz.
- **Tecla de cancelación**: Cancela la grabación al instante sin enviar datos a Groq.

## Instalación

Un comando en OpenCode:

```bash
opencode plugin @loyslow/opencode-voice-groq
```

Instalador CLI opcional:

```bash
npx @loyslow/opencode-voice-groq install
```

## Configuración

En el primer inicio, aparecerá un menú de configuración.
1. Consigue tu clave de API gratis en [Groq Console](https://console.groq.com/keys).
2. Ingresa la clave API.
3. Configura tus teclas, el modelo y el vocabulario a través del menú interactivo.

Usa `/voice-settings` para acceder al menú de Model Tuning o configurar el micrófono.

## Créditos

Un agradecimiento masivo al autor original:
- Repositorio Original: [ihxnnxs/opencode-voice](https://github.com/ihxnnxs/opencode-voice)
