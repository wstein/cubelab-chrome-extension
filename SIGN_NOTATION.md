# SiGN notation

The extension supports core [Simple General Notation (SiGN)](https://www.mzrg.com/rubik/nota.shtml)
on 2×2×2 through 5×5×5 alongside WCA and SSE.

| Input           | Meaning                                        | CubeLab representation                       |
| --------------- | ---------------------------------------------- | -------------------------------------------- |
| `R`, `U'`, `F2` | Outer face turns                               | Unchanged                                    |
| `2R`, `3U`      | One numbered layer counted from the named face | Explicit numbered layer                      |
| `r`, `3u`       | First two or three layers                      | Wide moves; numbered lowercase becomes `3Uw` |
| `2-3r`          | Inclusive layers 2 through 3                   | `2-3Rw`                                      |
| `4U` on 4×4     | Opposite layer viewed from U                   | `D'`                                         |
| `2-5r` on 5×5   | Layers 2 through 5 viewed from R               | `4Lw'`                                       |
| `5r` on 5×5     | Entire cube viewed from R                      | `x`                                          |

Prime and half-turn suffixes, rotations, repeated/inverted groups,
commutators and conjugates work with these moves. Keep spaces between moves
with numeric prefixes to avoid ambiguity with a preceding move's suffix.

Select the intended size in the tester or popup when the page has no size hint.
Without a size, existing inference assumes numbered layers are internal and
wide moves leave at least one stationary layer. Full-width moves are recognized
as rotations only with a known size. WCA `w` aliases receive the same geometric
treatment; this is not a WCA legality checker.

Use the default **Wide** lowercase setting for SiGN. The legacy **InnerSlice**
site setting is a different convention. Numbered lowercase blocks always
translate to unambiguous uppercase `w` moves.

Optional big-cube `M/E/S` and `m/e/s` extensions in the reference are not core
SiGN support. Existing `M/E/S` behavior remains limited to odd cubes; use
numbered layers or ranges for portable big-cube algorithms. Non-cube and
less-common extension operators are outside this scope.
