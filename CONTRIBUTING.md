# Contributing

Thanks for helping improve `opencode-voice`.

## Development

- Use Node.js 20 or newer.
- Run `npm run check` before opening a change.
- Run `npm pack --dry-run` before release-oriented changes.
- Keep generated audio, downloaded models, and local logs out of git.

This package has no build step. Runtime code is shipped directly from `index.js`, `lib/`, and `bin/`.

## Release Checklist

- Update `CHANGELOG.md` for user-visible changes.
- Confirm `package.json` version and npm package contents.
- Run `npm run check`.
- Run `npm pack --dry-run` and inspect the file list.
- Create the GitHub release from the matching tag.

Do not publish prerelease artifacts as `latest` unless that is intentional.
