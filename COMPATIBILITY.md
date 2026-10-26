# Site compatibility checklist

The site observations below were recorded during the original review on
2026-09-15. They have not been rerun as part of the subsequent fixes. “Generic”
means supported notation in visible document text is eligible; it is **not** a
claim that the site's live application was tested. No login, posting, or account
access is required.

## Automated browser validation

The extension is now tested in Playwright's Chromium with its actual manifest,
service worker, storage, content scripts, popup, and options page. Twelve tests use
local fixtures for CSS visibility, responsive layout, DOM updates, stable badge
nodes, toolbar permission granting, concurrent settings, 4×4/5×5 widgets,
context-menu registration, destination URLs, and CubeLab self-exclusion by
metadata and converter structure. Worker tests cover selection
handling; the native right-click menu itself is not automated. Destination
navigation is intercepted, so live CubeLab parsing/rendering is not asserted.

Run `npx playwright install chromium` followed by `npm run test:browser`.
These tests replace the original lack of browser validation for core extension
behavior, but do not upgrade any live-site claim in the table below.

Numbered 4×4/5×5 SSE wing and centre cycles now route to Setup. CubeLab
`07911e6` accepts their grammar but has a known cycle-application bug; see
[SSE_NOTATION.md](SSE_NOTATION.md). The observations below predate this support.

Outgoing notation receives whitespace-only cleanup (collapse runs to one space
and trim), with no other rewriting. Internal detection may
validate equivalents but never emits them instead of the original source.
Destination parser differences are not worked around by rewriting notation.

## Machine-readable fingerprints

[CubeAssembler](https://github.com/wstein/cube-assembler) publishes a meta marker
and a JSON moves block for this extension. When both are valid, the extension
links the block's moves and size and does not scan the Moves line next to it;
otherwise it scans the page as for any site. 6×6/7×7 stay unsupported. See
[FINGERPRINT.md](FINGERPRINT.md). The Chromium tests use a local fixture page
shaped like the app, not the live deployment.

## Historical site observations

| Site                                                                                 | Implementation / evidence                                                                                                                               | Remaining limitation                                                                                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Randelshofer example](https://www.randelshofer.ch/rubik/patterns/C250.01.html)      | Downloaded HTML tested in DOM harness: 5 links, including one complete multiline permutation and SSE algorithm; size-aware SSE move tests cover 2×2–5×5 | SSE moves use explicit modern layer translations; see [SSE_NOTATION.md](SSE_NOTATION.md). Bigger-cube cycles, 6×6/7×7 and non-cube puzzles remain out of scope |
| [Ruwix patterns](https://ruwix.com/the-rubiks-cube/rubiks-cube-patterns-algorithms/) | Downloaded HTML tested: 64 links including explicit gallery `data-alg` attributes                                                                       | Live modal behavior/CSS not browser-tested; choose legacy inner-slice mode on applicable 4×4 pages                                                             |
| [Cube-Solver.app](https://www.cube-solver.app/en/rubiks-cube-patterns)               | Public HTML inspected; generic dynamic scanning available                                                                                               | Initial HTML yielded no links; hydrated algorithms remain unverified; select 2×2–5×5 only                                                                      |
| [Cubzor](https://www.cubzor.com/learn/patterns)                                      | Public HTML inspected; generic dynamic scanning available                                                                                               | Initial HTML yielded no links; client-rendered algorithms remain unverified                                                                                    |
| [J Perm](https://jperm.net/algs/pll)                                                 | Public HTML obtained; dynamic insertion supported by DOM tests                                                                                          | Initial HTML had no rendered algorithms. User-supplied `jperm.com` currently redirected elsewhere; use the established `jperm.net` address                     |
| [SpeedSolving](https://www.speedsolving.com/)                                        | Public site checked; generic detection in forum posts and wiki text                                                                                     | Individual forum/wiki pages not live-tested; text in editors is excluded                                                                                       |
| [CubeSkills](https://www.cubeskills.com/)                                            | Public site checked; generic HTML coverage                                                                                                              | PDFs/videos and protected lesson content are not extracted                                                                                                     |
| [csTimer](https://www.cstimer.net/)                                                  | Public initial HTML inspected; dynamic text changes covered by regression tests                                                                         | Runtime scramble UI not live-tested. Set correct size per hostname in popup; automatic reading of the timer's selected event is not implemented                |
| [World Cube Association](https://www.worldcubeassociation.org/)                      | Public site checked; generic HTML coverage                                                                                                              | Results pages may contain no algorithms. This is not a WCA integration or certification                                                                        |
| [LIVECUBING](https://livecubing.com/)                                                | Generic coverage only                                                                                                                                   | Public fetch unavailable during this task; stream video is not parsed                                                                                          |
| [Reddit r/rubikscube](https://www.reddit.com/r/rubikscube/)                          | Generic text/mutation support                                                                                                                           | Reddit live/shadow-DOM behavior unverified; expand posts to expose text                                                                                        |
| [Reddit r/magic](https://www.reddit.com/r/magic)                                     | No cubing-specific adapter                                                                                                                              | Generic notation detection only; this is not treated as a verified cube reference                                                                              |
| [Cubinator](https://cubinator.com/)                                                  | Domain checked                                                                                                                                          | Supplied domain currently resolves to a domain-sale page, not a tested cube tool                                                                               |
| [SpeedCubeGuides](https://www.speedcubeguides.com/)                                  | Generic coverage only                                                                                                                                   | Fetch unavailable; no compatibility claim                                                                                                                      |
| [Peter Nordin](https://www.peter-nordin.com/)                                        | Generic coverage only                                                                                                                                   | Fetch unavailable; no compatibility claim                                                                                                                      |
| SpeedCubeDB / CubeDB / alg.cubing.net / Twizzle                                      | Generic text and public widget-attribute adapters                                                                                                       | Editors require selection context menu; old lowercase dialect requires explicit setting; no live site validation                                               |

The implementation has no domain allowlist: it works wherever it encounters supported notation, while allowing opt-out per hostname. All automatic size/puzzle inference is heuristic. An explicit per-site choice in the popup takes precedence. All pages are capped at 500 badges.
