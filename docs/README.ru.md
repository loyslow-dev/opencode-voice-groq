<p align="center">
  <a href="https://github.com/loyslow-dev/opencode-voice-groq">
    <picture>
      <source srcset="../assets/opencode-voice-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="../assets/opencode-voice-light.svg" media="(prefers-color-scheme: light)">
      <img src="../assets/opencode-voice-light.svg" alt="opencode voice groq logo">
    </picture>
  </a>
</p>
<p align="center">Облачный сверхбыстрый плагин голосового ввода для OpenCode TUI.</p>
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

Это форк оригинального плагина `opencode-voice`. Вместо скачивания тяжелых моделей и обработки аудио на вашем компьютере (что требует мощного CPU/GPU и времени), этот плагин использует **LPU-процессоры Groq**. Аудио записывается, "на лету" сжимается в `m4a` (AAC), очищается от тишины и расшифровывается за миллисекунды.

### Установка

Установка в одну команду через OpenCode:

```bash
opencode plugin @loyslow/opencode-voice-groq
```

Перезапустите OpenCode после установки. При первом запуске плагин запросит ваш Groq API ключ. Плагин автоматически скачает и настроит `ffmpeg`.

Альтернативный установщик через CLI:

```bash
npx @loyslow/opencode-voice-groq install
```

Не клонируйте репозиторий, если не планируете вносить изменения в код плагина.

> [!TIP]
> При первом запуске появится окно настройки. Введите бесплатный API ключ Groq, выберите модель Whisper, и нажимайте `ctrl+r`, чтобы начать диктовку.

### Требования

Плагин работает на базе Groq API и использует локальный движок для записи звука:

- использует системный `ffmpeg` или автоматически скачивает портативную версию `ffmpeg-static`
- временно сохраняет сжатые аудио `m4a` в папке `~/.cache/opencode-voice-groq/recordings/`
- использует ваш `groqApiKey` для расшифровки

Получите бесплатный API ключ на [Groq Console](https://console.groq.com/keys).

### Использование

Команды:

- `/voice` - включить/выключить запись и вставить текст
- `/voice-submit` - записать, вставить текст и отправить сообщение
- `/voice-stop` - прервать активную запись или транскрибацию
- `/voice-settings` - открыть настройки модели, микрофона, горячих клавиш и квот Groq

Горячие клавиши по умолчанию:

```txt
ctrl+r -> начать запись
ctrl+r -> остановить запись, расшифровать и вставить
```

Вы можете настроить горячую клавишу для отмены записи в меню `/voice-settings`.

### Модели

Доступно через Groq API:

| Модель                 | Скорость работы | Описание                         |
| ---------------------- | --------------- | -------------------------------- |
| Whisper Large v3       | Сверхбыстрая    | высокая точность, все языки      |
| Whisper Large v3 Turbo | Невероятная     | чуть быстрее, отличная точность  |

Плагин использует локальное отслеживание квот (Fail-Fast Quota Protection), чтобы не давать вам начать запись, если вы превысили лимит RPM. Звук сжимается в `m4a` с автоматическим удалением тишины для мгновенной отправки.

### Статус платформ

| Платформа | Статус |
| --------- | ------ |
| Linux     | установка в 1 команду; запись через `arecord`, `ffmpeg` или `sox` |
| macOS     | установка в 1 команду; запись через `ffmpeg` AVFoundation |
| Windows   | установка в 1 команду; запись через DirectShow и портативный `ffmpeg.exe` с откатом к системному |

### Архитектура

Структура плагина соответствует стандартам комьюнити-плагинов OpenCode TUI.

- npm-пакет экспортирует `./tui`
- для локальной разработки `tui.json` должен указывать абсолютный путь
- публикация и скачивание идет через `opencode plugin @loyslow/opencode-voice-groq`
- настройки хранятся во внутреннем хранилище OpenCode TUI

Файлы:

- `index.js` - точка входа, команды, диалоговые окна, горячие клавиши, автоапдейтер
- `lib/download.js` - утилиты для скачивания ffmpeg
- `lib/engine.js` - выбор рекордера и API `fetch` реализация для Groq
- `bin/cli.js` - обертка для установки через CLI

Плагину нужна лишь локальная запись звука. Логика плагина отвечает за UI, настройки и мгновенную связь с API.

### Разработка

Запуск проверок:

```bash
npm run prepack
npm pack --dry-run
```

Для сборки плагина не нужны дополнительные шаги (no build step).

Установка для локальной разработки:

```bash
git clone https://github.com/loyslow-dev/opencode-voice-groq.git opencode-voice-groq
cd opencode-voice-groq
opencode plugin "$(pwd)"
```

### Статус проекта

Это независимый плагин. Он не создавался командой разработчиков OpenCode и не аффилирован с ними.

### Благодарности

- Векторный логотип OpenCode взят из публичного [репозитория OpenCode](https://github.com/anomalyco/opencode). Приписка `voice` была добавлена для этого плагина.
- Это форк оригинального проекта [opencode-voice](https://github.com/ihxnnxs/opencode-voice), созданного `@ihxnnxs`.

---

**OpenCode** [Website](https://opencode.ai) | [Docs](https://opencode.ai/docs) | [Discord](https://opencode.ai/discord)
