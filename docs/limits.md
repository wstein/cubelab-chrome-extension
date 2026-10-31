# Page coverage and limits

Where the scanner looks, what it skips, and its known limits. Back to the [README](../README.md).

See [COMPATIBILITY.md](COMPATIBILITY.md) for the supplied site checklist and actual validation evidence.

The generic detector scans visible top-level document text, including inline markup and newly inserted content. Adapters handle `data-alg`, `data-algorithm`, Roofpig `data-roofpig`, and `<twisty-player alg>` attributes. Attribute-backed widget badges are placed beside their widgets, so fixed-size or clipped gallery cards keep the link visible. Editable fields, existing links, buttons, hidden regions, scripts, SVG and canvas are excluded. Badge clicks do not bubble into gallery tile handlers.

Automatic links use a compact, high-contrast green external-link icon by default, with an accessible label and tooltip. Rendered move rows such as Ruwix's are linked beside the entire row, never inside the final move icon. Select **Floating action on hover** when a page's algorithm layout must remain completely untouched: the action is positioned outside the page flow and follows the hovered notation. Select **Full label** when explicit inline text is preferable.

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
