# Integration contract

How links are built for CubeLab and how the extension avoids acting on CubeLab itself. Back to the [README](../README.md).

See [SSE_NOTATION.md](SSE_NOTATION.md) for the Randelshofer move-family mappings,
size rules, supported operators, and validation against CubeLab's SSE updates.

See [SIGN_NOTATION.md](SIGN_NOTATION.md) for SiGN numbered layers, lowercase
blocks, ranges, and opposite-face/full-cube translations.

See [FINGERPRINT.md](FINGERPRINT.md) for the machine-readable hint that
CubeAssembler publishes: its moves and size are linked directly instead of
scraping the visible Moves line.

Reviewed CubeLab source at commit `e8b8ef45b348a91104b7402238556296eeac03ff` on 2026-09-15:

- [URL state reader/writer](https://github.com/wstein/cubelab/blob/e8b8ef45b348a91104b7402238556296eeac03ff/src/client/store.ts): `moves`, `alg`, `size`, `dialect`, `lowercase`, `scheme`.
- [Notation compatibility](https://github.com/wstein/cubelab/blob/e8b8ef45b348a91104b7402238556296eeac03ff/docs/move-notation-compatibility.md).
- [ACube state format](https://github.com/wstein/cubelab/blob/e8b8ef45b348a91104b7402238556296eeac03ff/docs/acube-notation.md).
- [Orbit64](https://github.com/wstein/cubelab/blob/e8b8ef45b348a91104b7402238556296eeac03ff/docs/orbit64.md).

Moves go to `/cubelab/workbench#moves=…`; states/cycles go to `/cubelab/#alg=…`. Nondefault sizes and known dialects are carried in the fragment. Twizzle widget setup algorithms are carried in `alg` alongside `moves`. CubeLab-specific parameters are added only for the default CubeLab host/path, not arbitrary custom destinations. `{notation}` and optional `{size}` placeholders support custom URL templates.

## CubeLab self-exclusion

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
