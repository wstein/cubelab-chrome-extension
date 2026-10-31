# CubeLab Linker

[![CI](https://github.com/wstein/cubelab-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/wstein/cubelab-chrome-extension/actions/workflows/ci.yml)
[![License: EUPL-1.2](https://img.shields.io/badge/license-EUPL--1.2-blue.svg)](LICENSE)
![Version 0.2.2](https://img.shields.io/badge/version-0.2.2-green.svg)
![Manifest V3](https://img.shields.io/badge/manifest-V3-4285F4?logo=googlechrome&logoColor=white)
![Chrome 109+](https://img.shields.io/badge/chrome-109%2B-4285F4?logo=googlechrome&logoColor=white)
![Cubes 2x2 to 7x7](https://img.shields.io/badge/cubes-2%C3%972%20to%207%C3%977-orange.svg)
![No telemetry](https://img.shields.io/badge/telemetry-none-brightgreen.svg)

A Chrome extension that finds Rubik's Cube notation on web pages and adds a small link that opens it in [CubeLab](https://wstein.github.io/cubelab/).

- Works on 2×2 to 7×7 cubes (moves); states and SSE notation on 2×2 to 5×5
- Runs locally. No telemetry, no accounts, no runtime dependencies

## Quick start

1. Download or clone this repository into a folder you will keep.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the folder that contains `manifest.json`.
4. Reload any cube pages that are already open.

This is an unpacked extension, not a Chrome Web Store listing, so Chrome shows its normal developer notice.

## How to use it

- **Click a badge** next to an algorithm to open it in CubeLab in a new tab. The page text stays unchanged.
- **Click the toolbar icon** to turn detection on or off for all sites or just this one, rescan, and set the cube size.
- **Select unusual notation** and right-click, then choose **Open selection in CubeLab**.

Example: on a page that shows `R U R' U'`, you get a small green link icon next to it. Clicking it opens that exact sequence in CubeLab.

## Good to know

- **Cube size** is guessed from the page (headings, URL, widget attributes). If a page mixes sizes or does not say, set the size in the popup. Without a hint, 3×3 is assumed.
- **Lowercase moves** such as `r` are modern wide turns. Some older sites use `r` for an inner slice; pick **Legacy inner slices** in the popup for those.
- **No badge?** The notation may sit in an editor, an image, a PDF or a video. These are not scanned. Use the right-click option instead.

## What gets linked

Standard moves (`R U' F2`, `Rw`, `3Uw`, `M E S`, groups and commutators), SiGN, SSE, Jaap notation, permutation cycles, facelet strings and colour nets. The original text is sent to CubeLab unchanged; only whitespace is cleaned up.

## Learn more

| I want to...                             | Read                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| See every supported notation             | [docs/notation.md](docs/notation.md)                                           |
| Know how links and custom templates work | [docs/integration.md](docs/integration.md)                                     |
| Understand limits and exclusions         | [docs/limits.md](docs/limits.md)                                               |
| Check which sites were tested            | [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md)                                 |
| Build, test or contribute                | [docs/development.md](docs/development.md), [CONTRIBUTING.md](CONTRIBUTING.md) |
| All documents                            | [docs/](docs/README.md)                                                        |

## Privacy

Scanning runs entirely in your browser and nothing is uploaded. A link carries the notation in the URL fragment, which the destination page's scripts can read. See [PRIVACY.md](PRIVACY.md).

## License

[European Union Public Licence v. 1.2](LICENSE) (EUPL-1.2).
