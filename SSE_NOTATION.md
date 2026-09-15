# Randelshofer SSE moves

CubeLab Linker detects Superset ENG (SSE) move sequences for 2×2 through 5×5
cubes and converts them to explicit modern layer moves before opening CubeLab.
The page text remains unchanged. Badges identify the source as SSE and show the
cube size; the URL carries `dialect=Modern` and the converted moves.

## Layer semantics

Layer numbers count from the named face toward its opposite. All selected
layers turn in the direction seen from that named face. Opposite-face moves
therefore use the inverse direction.

| Family            | Meaning                                                                 | Examples                                                   |
| ----------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `R U F L D B`     | Outer face                                                              | `R2` remains `R2`                                          |
| `C`               | Whole-cube rotation                                                     | `CR` → `x`; `CD` → `y'`                                    |
| `T`, `Tn`         | First n layers, default 2                                               | `T3B` → `3Bw`                                              |
| `N`, `Nn`, `Na-b` | One layer or an inclusive range, default layer 2                        | On 5×5, `NR` → `2R`, `N4-5R` → `2Lw'`                      |
| `V`, `Vn`         | n layers starting at layer 2, default 2                                 | `VR` → `2-3Rw`                                             |
| `M`, `Mn`         | n middle layers, default 1; ties choose the block nearer the named face | `MR` → `2R` on 4×4 and `3R` on 5×5; `M2R` → `2-3Rw` on 5×5 |
| `W`               | All inner layers                                                        | `WR` → `2-3Rw` on 4×4 and `2-4Rw` on 5×5                   |
| `S`, `Sn`         | Equal-depth blocks at opposite faces, default depth 1                   | `SF2` → `F2 B2`                                            |
| `Sa-b`            | Everything outside the inclusive range a through b                      | On 5×5, `S2-3R` → `R 2Lw'`                                 |

Explicit layer aliases from the complete CubeTwister tables are accepted when
their layers exist, including `T1R` and `N2R` on 2×2. Inner-layer families require
at least one inner layer. Empty, reversed, overlapping opposite blocks and
out-of-bounds ranges are rejected. Use `C` for a whole-cube rotation.

Groups, bounded repeats, inverses, commutators, and colon conjugates use the
extension's existing parser. Prime variants and the SSE `-` inverse suffix are
accepted. Dots and a copied `↗` badge marker separate moves. A maximum of 2,000
expanded modern moves, 100 repetitions per group, and 12 nesting levels applies.
SSE reflection (`*`) and angle-bracket operators are not converted; such
expressions do not produce partial algorithm links. Permutation-cycle support
is unchanged and remains limited to 2×2/3×3 state input.

Without a size hint, detection starts at 3×3 and increases only when required by
the layers. Notation alone cannot distinguish every 4×4 algorithm from a 5×5
algorithm. Select the intended size in the site's popup when needed.

## Source references

- [Pocket Cube SSE 2×2](https://www.randelshofer.ch/rubik/pocket/doc/supersetENG_2x2.html)
- [Rubik's Cube SSE 3×3](https://www.randelshofer.ch/rubik/patterns/doc/supersetENG_3x3.html)
- [Revenge Cube SSE 4×4](https://www.randelshofer.ch/rubik/revenge/doc/supersetENG_4x4.html)
- [Professor Cube SSE 5×5](https://www.randelshofer.ch/rubik/professor/doc/supersetENG_5x5.html)
- [Complete CubeTwister 2×2 aliases](https://www.randelshofer.ch/cubetwister/doc/notations/superset_eng_2x2.html)
- [Complete CubeTwister 5×5 aliases](https://www.randelshofer.ch/cubetwister/doc/notations/superset_eng_5x5.html)

The layer diagrams and descriptive rules govern the mapping. The complete
tables contain isolated spelling inconsistencies; they are not copied as a
token dictionary.

## CubeLab integration

CubeLab commits `dbef035`, `0113a46`, and `08c972f` add native SSE 2×2–5×5
support and accept the reported Professor Cube sequence. At `08c972f`, however,
native SSE still rejects 4×4 `MR`, 5×5 `M2R`, and 2×2 `N2R`, and applies one extra
far-side layer for `S2-3R`. These differ from the references above.

The extension consistently emits explicit modern moves for SSE input. This
keeps layer semantics independent of those native SSE differences. Validation
against CubeLab `08c972f` matched 288 individual move states and the complete
reported sequence where native SSE agrees with the documentation. Remaining
documented cases have direct layer-diagram regression tests.

## Size selection

The scanner recognizes Pocket Cube, Revenge Cube and Professor Cube headings
and their Randelshofer directory names. Explicit numeric size hints take
precedence; conflicting hints remain unresolved. The notation tester offers an
independent 2×2–5×5 size selector. Use the popup's per-site size override when a
page does not identify its puzzle.

SSE widgets translate their setup algorithm using the same size and dialect as
their moves. Invalid SSE setups suppress the link rather than opening a
different starting state.
