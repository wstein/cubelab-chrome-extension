# Project notes

## CubeLab self-exclusion

Manifest exclusion remains the cheapest guard for the official deployment.
Runtime detection covers the official URL, standard `application-name=CubeLab`
metadata, and the complete current converter shell. The structural fallback
requires three CubeLab-specific descendants and does not rely on title text.
Mutation handling removes stale badges if an SPA mounts the marker later.
Verification: formatter, lint, 90 unit/DOM tests and twelve Chromium tests pass.
The deployed page inspected on 2026-09-17 did not yet include application-name
metadata; adding the documented meta tag upstream is the preferred long-term
contract.

## Whitespace-only cleanup

Outgoing original notation, widget setup parameters and tester output now
collapse whitespace runs (including newlines, tabs and nonbreaking spaces)
to one space and trim the ends. No move, group, repeat, prime, subscript,
orientation marker or separator is rewritten. Raw source spans, page text and
tester input remain intact. This refines the source-preservation policy below.
Regression tests cover Unicode whitespace, idempotence, custom destinations,
setup parameters, multiline states and the grouped Revenge-page example.
Verification: formatter, lint, 77 unit/DOM tests and nine Chromium tests pass.
Detector coverage is 100% lines/functions and 98.33% branches.

## Original notation delegation (supersedes earlier translation policies)

Every destination URL now uses the original detected source rather than an
internal parsed equivalent. This includes WCA/modern and SiGN expressions,
Unicode primes/subscripts, cycle states and multiline nets. The tester and
widget setups preserve source text too. CubeLab owns interpretation; detection
still uses bounded parsing and records routing metadata. Unit/DOM tests: 76;
coverage: 100% lines/functions and 98.09% branches. Earlier translation notes
below are historical and no longer describe emitted notation.

Browser verification includes a local fixture at the reported Revenge URL,
checking path-based 4×4 inference, unchanged page text, original grouped SSE in
the navigation URL and tester output. Nine Chromium tests pass; live CubeLab
execution remains the destination's responsibility. Formatter and lint pass.

SSE move links now carry the original expression with `dialect=Sse` rather
than expanded modern moves. Grouping, repetitions, spacing, separators and
prime spelling remain intact. SSE widget setup text is also preserved.
Internal expansion is used only for bounded syntax/layer validation. Native
CubeLab SSE limitations are not worked around by rewriting source notation.
Regression: `(ML2 D' MR2 D)2` remains unchanged on 4×4.

## Numbered SSE permutation detection

The full reported multiline wing/centre state now retains one span and routes
to Setup as `alg` with size 5. Numbered cycles have size-aware bounds and
duplicate-location checks. Detection preserves orientation metadata and does
not apply or validate physical state permutations. Parser phase: formatter,
lint, 74 unit/DOM tests and 100% line/function, 97.56% branch coverage passed.
The upstream `07911e6` importer still corrupts colours when applying cycles
in place; the minimal reproduction is recorded in [SSE_NOTATION.md](SSE_NOTATION.md).

Browser phase adds size-labelled SSE cycle badges and verifies that the entire
multiline example remains unchanged in the page, badge navigation and tester
output. Eight Chromium tests pass. Destination navigation is intercepted;
this verifies the extension URL contract, not upstream rendering correctness.

## SiGN core parser

Numbered lowercase blocks and ranges normalize to modern wide moves. Known
sizes allow far-side layers and full-width turns to normalize to opposite-face
turns and rotations. WCA and SSE regressions still pass. Parser verification:
formatter, lint, 72 unit/DOM tests, and coverage of 100% lines/functions and
97.29% branches. See [SIGN_NOTATION.md](SIGN_NOTATION.md) for scope.

SiGN integration verifies widget setups, plain-page links and tester inputs
on all four sizes in Chromium. Setups normalize with their main algorithm's
size; invalid setups suppress the widget link. Formatter, lint, all 72
unit/DOM tests, seven browser tests and the unchanged coverage gate passed.

## WCA notation verification

WCA Article 12a face moves, rotations, and outer-block moves already use the
modern parser. A full face/axis/suffix matrix now verifies all four sizes and
every WCA-valid block width (2 through N−1), including implicit two-layer `Rw`
aliases and destination URL round trips. This is notation support, not a
competition-legality validator; existing modern extensions remain available.
Reference: https://www.worldcubeassociation.org/regulations/#12a.
The suite now contains 71 unit/DOM tests and six Chromium tests.

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

At the initial quality review, the suite contained 56 unit/DOM tests and five
browser tests. All original
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
