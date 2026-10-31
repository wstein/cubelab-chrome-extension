# Development and validation

Setup, checks and test suites for contributors. Back to the [README](../README.md).

Use Node 22.22.2+, 24.15.0+, or 26+ (matching the development dependencies):

```sh
npm ci
npm run format
npm run lint
npm test
npm run test:coverage
```

Pure detector tests can also run without installing dependencies:

```sh
npm run test:detector
```

Run the browser suite after installing Playwright's matching Chromium build:

```sh
npx playwright install chromium
npm run test:browser
```

On Linux CI hosts, `npx playwright install --with-deps chromium` also installs
the required system libraries. Browser tests use a temporary profile and a local
HTTP fixture server. They do not use your personal browser profile or depend on
live cubing websites. Failed tests retain screenshots and traces in the ignored
`test-results/` directory.

All npm dependencies are **development-only**. Do not bundle `node_modules`,
browser caches, or test artifacts into the extension. No scripts or libraries
are loaded remotely at runtime.

Prettier and ESLint are also development-only. Run formatting, linting, and tests
before committing; `npm run format:check` checks formatting without changing files.
See [PROJECT_NOTES.md](PROJECT_NOTES.md) for the quality baseline and implementation notes.

The unit/DOM suite has 122 tests covering detection, URL construction, concurrent
settings updates, worker messages, selection handling, and incremental DOM
updates. The detector coverage gate requires 100% of lines and functions and at
least 93% of branches; the measured branch coverage is 98.57%. A second,
separate gate requires 100% of lines, functions and branches for the Orbit64 V2
registry in `orbit64v2.js`. The gates cover those two files, not code evaluated in simulated browser contexts.

Twenty-seven Chromium tests (eleven of them for the CubeAssembler fingerprint) cover CubeLab self-exclusion, original notation delegation on the reported Revenge URL, numbered SSE Setup links, SiGN/SSE size selection, installation, real inline visibility, responsive CSS,
manual rescans, stable DOM nodes, dynamic content, toolbar permission granting,
popup/options persistence, site disabling, widget sizes/setup, context-menu
registration, and badge navigation. The destination is intercepted to verify
the URL without relying on the live CubeLab deployment.

Native right-click menu interaction and live CubeLab rendering remain release
smoke checks. The selection callback is covered by worker tests. Historical site
observations and their limits are recorded in [COMPATIBILITY.md](COMPATIBILITY.md);
local fixtures do not establish compatibility with every live site.
