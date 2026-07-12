<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../assets/opencode-voice-dark.svg">
    <img alt="opencode voice groq" src="../assets/opencode-voice-light.svg">
  </picture>
</p>

[English](../README.md) | [Русский](README.ru.md) | [简体中文](README.zh.md) | [Español](README.es.md)

# opencode-voice-groq

用于 [OpenCode](https://github.com/opencode-ai/opencode) 的超快云端语音输入插件，使用 Groq 的 Whisper API（`whisper-large-v3` 和 `whisper-large-v3-turbo`）。

这是原版 `opencode-voice` 的高度优化分支。此插件无需在本地下载庞大的模型或消耗 CPU/GPU，而是使用 **Groq 的 LPU 推理引擎**。音频将即时记录、压缩为 `m4a` 格式、自动去除静音，并在毫秒级内完成转录。

## 特点

- **超快转录**：由 Groq API 提供支持。
- **高级音频压缩**：直接录制为 `.m4a` 以消除网络延迟。
- **自动去除静音**：自动剪裁语音开头和结尾的静音部分。
- **快速失败配额保护**：在本地跟踪 Groq 的每分钟请求数 (RPM)。如果您超出了免费额度限制，该插件会在您开始录音 *之前* 阻止您，以节省时间。
- **自动重试**：如果遇到短暂的网络断开，将自动重试转录一次。
- **模型微调**：可以在 UI 中配置温度、语言和上下文词汇（例如 `TypeScript, React`）。
- **取消快捷键**：可立即中止录音，且不向服务器发送任何数据。

## 安装

在 OpenCode 中使用一条命令：

```bash
opencode plugin @loyslow/opencode-voice-groq
```

或使用可选的 CLI 安装程序：

```bash
npx @loyslow/opencode-voice-groq install
```

## 设置

首次启动时将打开设置提示。
1. 在 [Groq Console](https://console.groq.com/keys) 获取免费 API 密钥。
2. 输入 API 密钥。
3. 通过交互式菜单配置您的快捷键、模型和上下文词汇。

提示：
使用 `/voice-settings` 访问模型微调菜单或配置麦克风。

## 致谢

非常感谢原始项目的作者：
- 原始仓库：[ihxnnxs/opencode-voice](https://github.com/ihxnnxs/opencode-voice)
