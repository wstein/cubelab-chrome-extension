# Notation coverage

What the extension recognizes and how it handles each input. Back to the [README](../README.md).

All links delegate the original detected notation to CubeLab. The extension
does not rewrite moves, expand groups, normalize primes, or reorder nets in
the URL. The only cleanup is whitespace: line breaks, tabs and other whitespace
become one space, repeated spaces collapse, and leading/trailing spaces are
trimmed. This applies to links, setup parameters and tester output, not page
text or the tester input. Parsing below is only for detection and metadata.

| Input                                                           | Handling                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `R U' F2`, `RUR'U'`, Unicode primes, `Ri`, dash-separated moves | Recognize syntax; preserve spelling with whitespace-only cleanup            |
| `Rw`, `3Uw`, lowercase `r`, `2R`, `2-3Rw`, `M E S`, `x y z`     | Parse with size constraints; slice moves allowed on 3×3, 5×5 and 7×7        |
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
