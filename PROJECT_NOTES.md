# Project notes

## SSE 2×2–5×5 implementation

The detector recognizes all seven SSE prefix families (`C T N V M W S`) and
their numbered forms. It validates their selected layers, expands supported
groups with the existing bounds, and emits explicit modern moves. Candidate
scanning retains `W`, numbered prefixes, dots, and copied badge arrows in the
same algorithm span. Invalid SSE and unsupported operators cannot fall back to
a misleading partial permutation link.

The size-specific mappings and upstream contract are documented in
[SSE_NOTATION.md](SSE_NOTATION.md). This includes the remaining semantic
differences found in CubeLab `08c972f`, despite its expanded native SSE support.

Parser phase verification: formatter, lint, 68 unit/DOM tests, five Chromium
tests, and detector coverage (100% lines/functions, 97.10% branches) passed.

Integration phase adds named-cube/path size inference, tester size controls,
and consistent SSE widget setup translation. Verification: formatter, lint,
70 unit/DOM tests, six Chromium tests, and coverage of 100% lines/functions and
97.13% branches. The browser regression preserves the complete reported source
and checks the translated destination across all four supported sizes.

## Quality checks

Run `npm run format`, `npm run lint`, and `npm test` before each commit.
Run `npm run test:coverage` for detector changes and `npm run test:browser` for
browser behavior. Run all of these checks before release.
Use `npm run format:check` to verify formatting without modifying files.
Development tools are local dependencies and are not loaded by the extension.

The starting test baseline is 34 passing tests: 27 detector tests and seven DOM
integration tests. There was no configured coverage threshold. Keep these cases
and add regression tests alongside behavior changes.

## Review implementation

Changes are grouped into separately verified, conventional commits:

1. Quality tooling and consistent formatting.
2. Settings updates that preserve concurrent changes.
3. Repeated move groups and permutation disambiguation.
4. Incremental scanning, stable DOM nodes, and inline visibility.
5. Browser smoke tests and updated validation documentation.

### Quality tooling

Prettier formats source, tests, configuration, and documentation. ESLint checks
JavaScript with its recommended rules. Formatting is kept separate from behavior
changes so later commits can be reviewed on their own.

The Node engine range matches jsdom's supported versions: 22.22.2+, 24.15.0+,
or 26+. This corrects the previous overly broad `>=22` requirement.

### Settings ownership

The service worker is the sole settings writer. Popup and options pages send
validated, field-level operations through `settings.js`; the worker serializes
read/modify/write operations and reports failures to the initiating page.
Host preferences merge independently, and options save only edited fields.
Restore defaults intentionally resets all settings, in the same queue.
Messages that modify settings are accepted only from this extension's pages.

Regression tests cover concurrent updates, stale UI snapshots, validation,
failed-write recovery, reset ordering, and visible save errors.

### Detection precedence

Complete expressions and prose-bounded candidate runs are classified before
extracting standalone permutation cycles. A repeat suffix disambiguates compact
groups: `(RU RF)2` expands to moves, while unsuffixed `(RU RF)` retains the
existing cycle interpretation. Invalid repeats are rejected without dropping
their suffix. Regression tests cover prose, offsets, nested groups, inverse
repeats, URL payloads, and preserved cycle orientation metadata.

### Scanner ownership and invalidation

The content script tracks block and widget records plus the badge nodes it owns.
Ordinary text/child-list mutations queue the nearest block; redundant subtree
roots are coalesced. Context, attribute, stylesheet-load, viewport, and settings
changes recheck the document. Unchanged text and detection settings reuse badges.
Heading lookup uses document order, excluding badge labels from source text.

Badge insertion at the end of a text node creates no empty sibling. Insertions
within text record their split, and cleanup rejoins only adjacent nodes from
those splits, in reverse insertion order. Page-owned markup is preserved.
Detached owners are removed from the records, including sibling widget badges.

Visibility uses computed styles and layout rectangles at the inline element.
Hidden content contributes a boundary, and `display: contents` is supported.
Attribute changes include editing permissions and CSS selectors. CSSOM-only
changes and animations require the documented manual rescan when no observed
DOM, load, or resize event occurs.

The existing 32,000-character, 100,000-node, and 500-badge bounds remain.
At the badge cap, mutations recheck the document so freed slots can be filled.
Malformed URI escapes do not abort scanning. Scanner regression tests verify
these behaviors, including incremental traversal and stable node identity.

### Browser validation and coverage

The final suite contains 56 unit/DOM tests and five browser tests. All original
34 tests remain. On Node 26.8.1, detector coverage is 100% of lines and functions
and 95.62% of branches, compared with 100%/100%/92.27% before the changes.
`npm run test:coverage` enforces 100% lines, 100% functions, and 93% branches
for `detector.js`. The gate does not claim coverage of scripts evaluated by jsdom.

Browser tests follow the [Playwright extension-testing workflow](https://playwright.dev/docs/chrome-extensions)
with the pinned Chromium build and an isolated temporary profile. Only that test
browser enables extension debugging. The DevTools `Extensions.triggerAction`
command targets the fixture tab to grant `activeTab` as a toolbar invocation
would; merely opening `popup.html` does not grant that permission. The popup
document is then tested against the real worker and storage APIs.

Tests use local HTTP fixtures and intercept destination navigation. Native menu
interaction and live CubeLab rendering are manual release checks, not claims
made by the automated suite. No personal browser data or live-site access is
needed. Screenshots and traces are retained only on failure under `test-results/`.

| Phase              | Verified outcome                                                                        |
| ------------------ | --------------------------------------------------------------------------------------- |
| Quality tooling    | Formatter, lint, and 34 tests passed                                                    |
| Settings           | Formatter, lint, and 39 tests passed                                                    |
| Parser             | Formatter, lint, and 42 tests passed                                                    |
| Scanner            | Formatter, lint, and 50 tests passed                                                    |
| Browser validation | Formatter, lint, 56 unit/DOM tests, five Chromium tests, and the detector coverage gate |
