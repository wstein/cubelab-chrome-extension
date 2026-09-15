# CubeLab Linker — Chrome extension

Adds small **↗ CubeLab** links next to cube notation on ordinary web pages. Supports 2×2–5×5 cubes. Manifest V3, no build step, no runtime dependencies, no telemetry.

## Install

1. Extract this ZIP to a permanent folder.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `cubelab-linker` folder containing `manifest.json`.
5. Reload any cube pages that were already open. Pin the extension if desired.

This is an unpacked extension, not a Chrome Web Store listing. Chrome may show its normal developer-extension notice. Keep the extracted directory; Chrome loads the extension from it.

## Use

Click a CubeLab badge to open the notation in a new tab. The original notation and existing links remain in place. The popup shows the link count and lets you disable automatic detection globally or per hostname, rescan, set a site's cube size, and choose modern wide or legacy inner-slice lowercase moves. Settings include a notation tester and configurable HTTPS destination templates.

For unusual notation, select it and choose **Open selection in CubeLab** from the right-click menu. Unrecognized selections are passed unchanged to CubeLab's `alg` input; this does not promise that CubeLab can parse them.

Size is inferred from explicit widget puzzle attributes, nearby headings, page title/URL, facelet count, or minimum layer requirements. Ordinary algorithms without a size hint default to 3×3. **Set the size in the popup on mixed-size pages or timers when their selected puzzle is not exposed in text.** Recognizable 6×6/7×7 and non-cube headings are excluded. This is a heuristic, not a general puzzle classifier.

Settings changes preserve unrelated preferences made in other open extension
pages. Save errors appear in the page where the change was made. **Restore
defaults** resets all preferences, including disabled websites and site-specific
cube sizes.

## Notation coverage

| Input                                                           | Handling                                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `R U' F2`, `RUR'U'`, Unicode primes, `Ri`, dash-separated moves | Normalize to spaced modern moves                                                                  |
| `Rw`, `3Uw`, lowercase `r`, `2R`, `2-3Rw`, `M E S`, `x y z`     | Parse with size constraints; slice moves allowed on 3×3 and 5×5                                   |
| `(R U)3`, `[R,U]`, `[R: U2]`, nested groups and inverse repeats | Expand with a 2,000-move limit                                                                    |
| Ruwix `F₂'` or actual HTML `<sub>2</sub>`                       | Convert to explicit `2Fw'`                                                                        |
| SSE `CD2 · MF2 U2 F2 MR2 B2 U2`                                 | Preserve SSE tokens; send `dialect=Sse`                                                           |
| SSE / Singmaster / basic ACube cycles                           | Preserve cycles and orientation signs; use state input                                            |
| URFDLB strings, 24/54/96/150 facelets                           | Check counts, infer size, preserve face order                                                     |
| WOGRBY colour strings and canonical cube nets                   | Check counts; reorder U / L F R B / D nets to URFDLB fields; configurable Western/Japanese scheme |
| Complete ACube positional states                                | Recognize 12 distinct edges + 8 distinct corners                                                  |
| `cp: …; co: …` with optional `ep: …; eo: …`                     | Check coordinate lengths, ranges and permutation uniqueness                                       |
| Explicitly labelled `Orbit64: …`                                | Identify token-width candidates and send to CubeLab for actual validation                         |

State detection does **not** prove physical solvability. Permutation-cycle support in CubeLab is principally for 2×2/3×3; bigger-cube cycles are not generally interchangeable. Marked-centre SSE metadata is preserved, but CubeLab's current compatibility report says it is not rendered as centre orientation.

Lowercase moves are modern wide turns by default. Some Ruwix 4×4 and old CubeDB pages use `r = 2R`; select **Legacy inner slices** explicitly for those sites. Plaintext `F2'` is a half turn, not a guessed lost subscript. Actual HTML/Unicode subscripts avoid that ambiguity.

Repeated compact groups such as `(RU RF)2` are expanded as moves. Without a
repeat or inverse suffix, an ambiguous group such as `(RU RF)` is interpreted as
a permutation cycle. Invalid repeat counts are rejected, not silently removed.

## Integration contract

Reviewed CubeLab source at commit `e8b8ef45b348a91104b7402238556296eeac03ff` on 2026-09-15:

- [URL state reader/writer](https://github.com/wstein/cubelab/blob/e8b8ef45b348a91104b7402238556296eeac03ff/src/client/store.ts): `moves`, `alg`, `size`, `dialect`, `lowercase`, `scheme`.
- [Notation compatibility](https://github.com/wstein/cubelab/blob/e8b8ef45b348a91104b7402238556296eeac03ff/docs/move-notation-compatibility.md).
- [ACube state format](https://github.com/wstein/cubelab/blob/e8b8ef45b348a91104b7402238556296eeac03ff/docs/acube-notation.md).
- [Orbit64](https://github.com/wstein/cubelab/blob/e8b8ef45b348a91104b7402238556296eeac03ff/docs/orbit64.md).

Moves go to `/cubelab/workbench#moves=…`; states/cycles go to `/cubelab/#alg=…`. Nondefault sizes and known dialects are carried in the fragment. Twizzle widget setup algorithms are carried in `alg` alongside `moves`. CubeLab-specific parameters are added only for the default CubeLab host/path, not arbitrary custom destinations. `{notation}` and optional `{size}` placeholders support custom URL templates.

## Page coverage and limits

See [COMPATIBILITY.md](COMPATIBILITY.md) for the supplied site checklist and actual validation evidence.

The generic detector scans visible top-level document text, including inline markup and newly inserted content. Adapters handle `data-alg`, `data-algorithm`, Roofpig `data-roofpig`, and `<twisty-player alg>` attributes. Editable fields, existing links, buttons, hidden regions, scripts, SVG and canvas are excluded. Badge clicks do not bubble into gallery tile handlers.

Limitations: no OCR, PDF viewer, canvas extraction, closed shadow DOM, cross-origin frames, video-only tutorials, or automatic reading of user input fields. Recognition is deliberately incomplete: NISS, arbitrary solver constraints, camera/parallel Roofpig syntax, named macros, custom colour alphabets, and some notation dialects need the selection fallback. A page need not contain detectable algorithms just because it is a cubing site. Long blocks (over 32,000 characters), scans beyond 100,000 nodes, and links beyond 500 per page are capped. Group expansion is bounded to avoid pathological input.

## Development and validation

Text and child-node updates rescan the affected block or subtree. Unchanged
blocks and widgets keep their existing badges. Heading, attribute, stylesheet,
viewport, and settings changes trigger a broader check because they can change
visibility or cube-size inference. Disabling detection removes owned badges and
rejoins only text nodes split by the extension. CSS-hidden inline content is
excluded and separates surrounding notation.

Use **Scan again** after changes made only through stylesheet CSSOM methods or
CSS animations; these changes do not necessarily produce observable DOM events.

Use Node 22.22.2+, 24.15.0+, or 26+ (matching the development dependencies):

```sh
npm ci
npm run format
npm run lint
npm test
```

Pure detector tests can also run without installing dependencies:

```sh
npm run test:detector
```

`jsdom` is a **development-only** dependency. Do not bundle `node_modules` into the extension. No scripts or libraries are loaded remotely at runtime.

Prettier and ESLint are also development-only. Run formatting, linting, and tests
before committing; `npm run format:check` checks formatting without changing files.
See [PROJECT_NOTES.md](PROJECT_NOTES.md) for the quality baseline and implementation notes.

The automated suite covers detector/URL behavior, concurrent settings updates,
and DOM integration for inline text, updates, duplicate prevention, exclusions,
mixed-size galleries and widget attributes. The original downloaded Randelshofer
example HTML produced 5 links and the Ruwix patterns HTML produced 64 links.
These are DOM checks with simulated visibility, not browser screenshots or proof
that every resulting state was accepted by the live CubeLab deployment.

A Chrome binary was unavailable and its download timed out. Therefore installation, actual Chrome extension APIs, live hydration, site CSS interactions, and end-to-end CubeLab rendering still need a real-browser smoke check. Open the popup and settings after loading, then check both example sites, a 4×4/5×5 algorithm, a dynamic page, site disabling and the selection context menu.

## Privacy

All scanning and detection runs locally. The extension does not upload pages or contact a server in the background. Clicking a badge or context-menu action opens the destination with the notation in its URL fragment. The destination's JavaScript can read that fragment; its own privacy policy applies. See [PRIVACY.md](PRIVACY.md).
