# CubeAssembler fingerprint

CubeLab Linker reads a machine-readable hint that the web app
[CubeAssembler](https://github.com/wstein/cube-assembler) publishes, instead of
scraping the visible "Moves: ..." line of its 3D view. The producer side is
described in that repository's `docs/cubelab-fingerprint.md` and its JSON
Schema `public/schemas/cubelab-fingerprint-v1.schema.json`. This page is the
consumer side: exactly what the extension accepts and what it does with it.

## What the extension looks for

1. The marker, a `<meta name="cubelab-fingerprint" content="...">` element
   (name matched case-insensitively), for example
   `spec=1;app=cube-assembler@0.1.0`.
2. The moves block, the element `script#cubelab-moves` with
   `type="application/json"`, for example
   `{"size":3,"moves":"2L' 2R U2","format":"layer-prefix/v1"}`.

Without a valid marker the block is ignored. These two elements are the only
page content read for this feature, and they are read with `getAttribute` and
`textContent`: the JSON is parsed with `JSON.parse`, never evaluated, and no
value is written back into the page as markup.

## What a valid fingerprint does

- It is **authoritative** for the Moves line. The extension creates one badge
  from the block's `moves` and `size` and places it directly before the block
  (the app renders the Moves line right before it, so the badge sits next to
  the line). In floating badge style it is the usual floating action for that
  line.
- The element rendered immediately before the block, with all its content, is
  not scanned as text. The same moves therefore never produce a second badge.
  Everything else on the page is scanned as usual.
- The size comes from the block and beats page inference, headings and the
  per-site size preference. The link carries it like any other badge: nothing
  for 3×3, `size=N` in the fragment for the others.
- One move is enough. The "minimum moves" setting exists to avoid false
  positives in prose; explicit data has none. An empty `moves` creates no
  badge.
- Respecting the user's settings is unchanged: a disabled extension or host
  creates no badge, the badge style and destination templates apply, and the
  500-badge page cap applies.

## What is ignored (fallback to normal scanning)

The fingerprint is ignored, and the page is scanned exactly as if it were
absent (the visible Moves line included), when any of the following holds. No
error is shown.

| Condition                                                                                                       | Why                                          |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| No marker, or no `spec` pair, or `spec` is not exactly `1`, or `spec` occurs more than once, or `content` > 512 | Unknown or ambiguous contract                |
| No block, wrong element type, or `type` is not `application/json`                                               | Nothing to read                              |
| Block text longer than **16384 characters**                                                                     | Bounded input; checked before parsing        |
| Not valid JSON, or not a JSON object                                                                            | Strict parse                                 |
| `format` is missing or not exactly `layer-prefix/v1`                                                            | Only formats this extension can translate    |
| `size` is not an integer from 2 to 7                                                                            | Out of the documented range                  |
| `moves` is not a string, has more than **2000** turns, or does not match the grammar below                      | Same bound as the extension's move expansion |
| `moves` fails the extension's own move parser for `size` (for example a layer that the size does not have)      | Cannot be linked faithfully                  |

### Versions

`spec` rises only for a breaking change, so a higher `spec` is ignored until
this extension learns it. Same `spec` with extra block fields or extra
`key=value` pairs in the marker is fine: unknown fields and pairs are ignored.

### Format `layer-prefix/v1`

The accepted `moves` grammar is the producer's: turns separated by exactly one
space, each `[layers]FACE[w][amount]` or a whole-cube `x`, `y`, `z`, where
layers is `N` or `A-B` with digits 2 to 7, FACE is `URFDLB`, amount is
nothing, `'` or `2`. An empty string is valid.

This notation is the same one the extension already supports as modern/SiGN
notation. A numeric prefix such as `2L'` is one layer counted from the named
face; `Rw`, `3Rw` and `2-3Rw` are blocks; `x y z` are rotations. The link
carries the producer's string unchanged, with the usual whitespace-only
cleanup, and CubeLab interprets it; see
[SIGN_NOTATION.md](SIGN_NOTATION.md). Nothing is rewritten. The extension's
parser is used only to check that the string is faithful for the stated size
(every layer exists, every turn is one move).

Sizes 2 to 7 are all linked: layers 6 and 7 exist on 6×6 and 7×7 and are
checked like any other layer. Known gaps between the producer and this extension:

- **Half turns of rotations.** The producer's prose allows `x2`, `y2`, `z2`,
  but its JSON Schema pattern only allows `[xyz]'?`. The extension follows
  the prose and accepts `x2`; the schema should be corrected on the producer
  side.
- **`M`, `E`, `S` and lowercase moves.** The grammar has none, so they are
  rejected.

## Updates

The block changes while the user turns the cube. The extension follows it with
its existing scanner: a mutation of the block or the marker queues a rescan
(250 ms debounce), the block is read again, and the badge is updated **in
place**. Its node stays the same, only the link and label change. An empty or
unsupported block removes the badge; an invalid one removes it and the Moves
line is scanned again; a valid one brings the badge back. Removing the block
or the 3D view (the app removes it in the 2D view) removes the badge.

## Privacy

For this feature the extension reads only the two elements above, locally,
and sends nothing anywhere. The only data that leaves the page is what the
user opens by clicking the badge: the moves, in the destination URL fragment,
as for every other badge ([PRIVACY.md](../PRIVACY.md)). No permission is added.
