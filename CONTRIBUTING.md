# Contributing

Thanks for helping improve CubeLab Linker. Bug reports for pages where notation is missed or wrongly linked are especially useful.

## Reporting a problem

Use the issue templates. Include the page URL, the exact notation text, the cube size you expected, and the extension version (see `chrome://extensions`).

## Development

Use Node 22.22.2+, 24.15.0+ or 26+.

```sh
npm ci
npm run format
npm run lint
npm test
npm run test:coverage
npx playwright install chromium
npm run test:browser
```

See [docs/development.md](docs/development.md) for details.

- The extension has no build step and no runtime dependencies. npm packages are development-only.
- Add a regression test alongside every behaviour change. The detector coverage gate (100% lines and functions, at least 93% branches) must keep passing.
- Original notation is delegated to CubeLab unchanged apart from whitespace cleanup. Please do not add rewriting or normalisation; see [docs/notation.md](docs/notation.md) and [docs/PROJECT_NOTES.md](docs/PROJECT_NOTES.md).
- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## Pull requests

Keep changes focused, run format, lint and tests before opening the PR, and describe what changed and why. By contributing you agree that your contribution is licensed under the [EUPL-1.2](LICENSE).
