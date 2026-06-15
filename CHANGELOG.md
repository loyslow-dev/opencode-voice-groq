# Changelog

All notable changes to this project are documented here.

## 0.1.2 - 2026-06-15

### Fixed

- Pinned npm package README metadata to the primary English `README.md`.
- Moved localized READMEs under `docs/` so npm does not select them as the package README.

## 0.1.1 - 2026-06-15

### Fixed

- Fixed Windows managed engine install/import probing by keeping temporary `whisper-cli` binaries executable as `.exe` files.

### Changed

- Ignored local CodeGraph index files.

## 0.1.0 - 2026-06-12

### Added

- Initial OpenCode TUI voice input plugin.
- Local `whisper.cpp` transcription flow with model selection and verified downloads.
- Helper CLI for install guidance and local diagnostics.
- Managed engine status/import/remove commands for local `whisper-cli`.
- Managed engine auto-install from the opencode-voice GitHub Release registry.
- GitHub Actions workflow for building and publishing `whisper-cli` engine assets.
- Model verification markers so existing model files must pass SHA256 before activation.
- GitHub Actions release check workflow.
- npm packaging metadata and release checks.
