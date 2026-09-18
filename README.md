# CubeLab Linker — Chrome extension

Adds small CubeLab links, marked with a consistent external-link icon, next to cube notation on ordinary web pages. Supports 2×2–5×5 cubes. Manifest V3, no build step, no runtime dependencies, no telemetry.

## Install

1. Keep the repository checkout, or extract the extension archive, in a permanent folder.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the folder containing `manifest.json`.
5. Reload any cube pages that were already open. Pin the extension if desired.

This is an unpacked extension, not a Chrome Web Store listing. Chrome may show its normal developer-extension notice. Keep the directory; Chrome loads the extension from it.

## Use

Click a CubeLab badge to open the notation in a new tab. The original notation and existing links remain in place. The popup shows the link count and lets you disable automatic detection globally or per hostname, rescan, set a site's cube size, and choose modern wide or legacy inner-slice lowercase moves. Settings include a notation tester and configurable HTTPS destination templates.

For unusual notation, select it and choose **Open selection in CubeLab** from the right-click menu. Unrecognized selections are passed unchanged to CubeLab's `alg` input; this does not promise that CubeLab can parse them.

Size is inferred from explicit widget puzzle attributes, nearby headings, page title/URL, facelet count, or minimum layer requirements. Ordinary algorithms without a size hint default to 3×3. **Set the size in the popup on mixed-size pages or timers when their selected puzzle is not exposed in text.** Recognizable 6×6/7×7 and non-cube headings are excluded. This is a heuristic, not a general puzzle classifier.

Settings changes preserve unrelated preferences made in other open extension
pages. Save errors appear in the page where the change was made. **Restore
defaults** resets all preferences, including disabled websites and site-specific
cube sizes.

## Notation coverage

All links delegate the original detected notation to CubeLab. The extension
does not rewrite moves, expand groups, normalize primes, or reorder nets in
the URL. The only cleanup is whitespace: line breaks, tabs and other whitespace
become one space, repeated spaces collapse, and leading/trailing spaces are
trimmed. This applies to links, setup parameters and tester output, not page
text or the tester input. Parsing below is only for detection and metadata.

| Input                                                           | Handling                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `R U' F2`, `RUR'U'`, Unicode primes, `Ri`, dash-separated moves | Recognize syntax; preserve spelling with whitespace-only cleanup            |
| `Rw`, `3Uw`, lowercase `r`, `2R`, `2-3Rw`, `M E S`, `x y z`     | Parse with size constraints; slice moves allowed on 3×3 and 5×5             |
| `(R U)3`, `[R,U]`, `[R: U2]`, nested groups and inverse repeats | Validate with a 2,000-move expansion limit; send original groups            |
| Ruwix `F₂'` or actual HTML `<sub>2</sub>`                       | Preserve subscript notation (`<sub>` is extracted as Unicode)               |
| Jaap `Rs`, `Ra`, `Rm`, `Rc`, and `(sequence)2`                  | Validate Jaap's slice/anti-slice notation; delegate the original expression |
| SSE 2×2–5×5, including `WR`, `T3B`, `N2-3R`, and `S2-3R`        | Preserve the original expression, grouping and spelling; send `dialect=Sse` |
| SSE / Singmaster / basic ACube cycles                           | Preserve cycles and orientation signs; use state input                      |
| URFDLB strings, 24/54/96/150 facelets                           | Check counts, infer size, preserve face order                               |
| WOGRBY colour strings and canonical cube nets                   | Check counts; preserve source order; configurable Western/Japanese scheme   |
| Complete ACube positional states                                | Recognize 12 distinct edges + 8 distinct corners                            |
| `cp: …; co: …` with optional `ep: …; eo: …`                     | Check coordinate lengths, ranges and permutation uniqueness                 |
| Explicitly labelled `Orbit64: …`                                | Identify token-width candidates and send to CubeLab for actual validation   |

State detection does **not** prove physical solvability. Numbered SSE wing/centre cycles are detected on 4×4/5×5 and sent unchanged to Setup. See [SSE_NOTATION.md](SSE_NOTATION.md) for supported indices and a known upstream cycle-application bug in CubeLab `07911e6`. Marked-centre orientations are preserved as metadata, not rendered as logo rotations.

Lowercase moves are modern wide turns by default. Some Ruwix 4×4 and old CubeDB pages use `r = 2R`; select **Legacy inner slices** explicitly for those sites. Plaintext `F2'` is a half turn, not a guessed lost subscript. Actual HTML/Unicode subscripts avoid that ambiguity.

Repeated compact groups such as `(RU RF)2` are recognized as moves and sent unchanged. Without a
repeat or inverse suffix, an ambiguous group such as `(RU RF)` is interpreted as
a permutation cycle. Invalid repeat counts are rejected, not silently removed.

## Integration contract

See [SSE_NOTATION.md](SSE_NOTATION.md) for the Randelshofer move-family mappings,
size rules, supported operators, and validation against CubeLab's SSE updates.

See [SIGN_NOTATION.md](SIGN_NOTATION.md) for SiGN numbered layers, lowercase
blocks, ranges, and opposite-face/full-cube translations.

Reviewed CubeLab source at commit `e8b8ef45b348a91104b7402238556296eeac03ff` on 2026-09-15:

- [URL state reader/writer](https://github.com/wstein/cubelab/blob/e8b8ef45b348a91104b7402238556296eeac03ff/src/client/store.ts): `moves`, `alg`, `size`, `dialect`, `lowercase`, `scheme`.
- [Notation compatibility](https://github.com/wstein/cubelab/blob/e8b8ef45b348a91104b7402238556296eeac03ff/docs/move-notation-compatibility.md).
- [ACube state format](https://github.com/wstein/cubelab/blob/e8b8ef45b348a91104b7402238556296eeac03ff/docs/acube-notation.md).
- [Orbit64](https://github.com/wstein/cubelab/blob/e8b8ef45b348a91104b7402238556296eeac03ff/docs/orbit64.md).

Moves go to `/cubelab/workbench#moves=…`; states/cycles go to `/cubelab/#alg=…`. Nondefault sizes and known dialects are carried in the fragment. Twizzle widget setup algorithms are carried in `alg` alongside `moves`. CubeLab-specific parameters are added only for the default CubeLab host/path, not arbitrary custom destinations. `{notation}` and optional `{size}` placeholders support custom URL templates.

### CubeLab self-exclusion

The official `wstein.github.io/cubelab/` path is excluded in the manifest. A
runtime guard also recognizes mirrors, development servers and SPA navigation.
The preferred portable signal is this standard head element:

```html
<meta name="application-name" content="CubeLab" />
```

Until CubeLab publishes that metadata, the extension recognizes the complete
current converter shell: `main[data-converter]` containing `data-size-control`,
`textarea[data-input]` and `data-workspace-tab`. A title, favicon, stylesheet
path or lone generic data attribute is intentionally insufficient, because it
could suppress unrelated pages. If either runtime marker appears after load,
existing extension badges are removed and the original text nodes restored.

## Page coverage and limits

See [COMPATIBILITY.md](COMPATIBILITY.md) for the supplied site checklist and actual validation evidence.

The generic detector scans visible top-level document text, including inline markup and newly inserted content. Adapters handle `data-alg`, `data-algorithm`, Roofpig `data-roofpig`, and `<twisty-player alg>` attributes. Attribute-backed widget badges are placed beside their widgets, so fixed-size or clipped gallery cards keep the link visible. Editable fields, existing links, buttons, hidden regions, scripts, SVG and canvas are excluded. Badge clicks do not bubble into gallery tile handlers.

Automatic links use a compact external-link icon by default, with an accessible label and tooltip. Select **Floating action on hover** when a page's algorithm layout must remain completely untouched: the action is positioned outside the page flow and follows the hovered notation. Select **Full label** when explicit inline text is preferable.

Linked notation is scanned as its own candidate, preventing nearby citations or prose from invalidating an algorithm inside the link.

Jaap notation uses face-relative `s` (slice), `a` (anti-slice), `m` (middle), and `c` (whole-cube) suffixes. It is validated internally using the definitions on [Jaap's notation page](https://www.jaapsch.net/puzzles/symmetr1.htm#notation), but its original spelling is delegated unchanged. The adjacent `(12f*)` and `(18q*)` move-count annotations used on the symmetry pages are excluded from the destination.

Limitations: no OCR, PDF viewer, canvas extraction, closed shadow DOM, cross-origin frames, video-only tutorials, or automatic reading of user input fields. Recognition is deliberately incomplete: NISS, arbitrary solver constraints, camera/parallel Roofpig syntax, named macros, custom colour alphabets, and some notation dialects need the selection fallback. A page need not contain detectable algorithms just because it is a cubing site. Long blocks (over 32,000 characters), scans beyond 100,000 nodes, and links beyond 500 per page are capped. Group expansion is bounded to avoid pathological input.

Text and child-node updates rescan the affected block or subtree. Unchanged
blocks and widgets keep their existing badges. Heading, attribute, stylesheet,
viewport, and settings changes trigger a broader check because they can change
visibility or cube-size inference. Disabling detection removes owned badges and
rejoins only text nodes split by the extension. CSS-hidden inline content is
excluded and separates surrounding notation.

Use **Scan again** after changes made only through stylesheet CSSOM methods or
CSS animations; these changes do not necessarily produce observable DOM events.

## Development and validation

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

The unit/DOM suite has 98 tests covering detection, URL construction, concurrent
settings updates, worker messages, selection handling, and incremental DOM
updates. The detector coverage gate requires 100% of lines and functions and at
least 93% of branches; the measured branch coverage is 98.33%. This gate covers
`detector.js`, not code evaluated in simulated browser contexts.

Fifteen Chromium tests cover CubeLab self-exclusion, original notation delegation on the reported Revenge URL, numbered SSE Setup links, SiGN/SSE size selection, installation, real inline visibility, responsive CSS,
manual rescans, stable DOM nodes, dynamic content, toolbar permission granting,
popup/options persistence, site disabling, widget sizes/setup, context-menu
registration, and badge navigation. The destination is intercepted to verify
the URL without relying on the live CubeLab deployment.

Native right-click menu interaction and live CubeLab rendering remain release
smoke checks. The selection callback is covered by worker tests. Historical site
observations and their limits are recorded in [COMPATIBILITY.md](COMPATIBILITY.md);
local fixtures do not establish compatibility with every live site.

## Privacy

All scanning and detection runs locally. The extension does not upload pages or
contact a server in the background. Default links carry notation in the URL
fragment; the destination's JavaScript can read it. Custom templates may put
notation in a query or path, which is sent to the destination server. The
destination's privacy policy applies. See [PRIVACY.md](PRIVACY.md).
