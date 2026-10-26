const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const D = require("../detector");
const websiteStyles = require("./fixtures/website-styles.cjs");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function setup(
  html,
  settings = {},
  url = "https://example.com/3x3/algorithms",
) {
  const dom = new JSDOM(html, {
    url,
    runScripts: "outside-only",
  });
  const w = dom.window;
  let message, changed;
  // jsdom supplies computed styles but no layout. Browser tests verify real rects.
  w.Element.prototype.getClientRects = function () {
    return [{ width: 100, height: 20 }];
  };
  w.chrome = {
    runtime: {
      onMessage: {
        addListener: (f) => {
          message = f;
        },
      },
    },
    storage: {
      local: {
        get: async () => ({ settings: { ...D.DEFAULTS, ...settings } }),
      },
      onChanged: {
        addListener: (f) => {
          changed = f;
        },
      },
    },
  };
  for (const file of ["detector.js", "content.js"])
    w.eval(fs.readFileSync(path.join(__dirname, "..", file), "utf8"));
  await delay(10);
  return {
    dom,
    w,
    doc: w.document,
    scan: () => message({ type: "scan" }, null, () => {}),
    status: () => {
      let result;
      message({ type: "status" }, null, (value) => {
        result = value;
      });
      return result;
    },
    change: async (value) => {
      changed({ settings: { newValue: { ...D.DEFAULTS, ...value } } }, "local");
      await delay(300);
    },
  };
}
const links = (x) => [...x.doc.querySelectorAll(".cubelab-link")];

test("CubeLab destinations and application markers are excluded without broad title matching", async (t) => {
  const cases = [
    [
      "<p>R U F</p>",
      "https://wstein.github.io/cubelab/workbench#moves=R+U+F",
      0,
    ],
    [
      '<meta name="application-name" content=" CubeLab "><p>R U F</p>',
      "https://mirror.example/workbench",
      0,
    ],
    [
      "<main data-converter><div data-size-control></div><textarea data-input></textarea><button data-workspace-tab></button><p>R U F</p></main>",
      "https://localhost.example/workbench",
      0,
    ],
    [
      "<title>CubeLab algorithms</title><main data-converter><p>R U F</p></main>",
      "https://example.com/cubes",
      1,
    ],
  ];
  const pages = [];
  t.after(() => pages.forEach((page) => page.dom.window.close()));
  for (const [html, url, expected] of cases) {
    const page = await setup(html, {}, url);
    pages.push(page);
    assert.equal(links(page).length, expected, url);
    assert.equal(page.status().enabled, Boolean(expected), url);
  }
});

test("a dynamically mounted CubeLab shell removes existing decorations", async (t) => {
  const x = await setup(
    '<main data-converter><p id="algorithm">R U F</p></main>',
  );
  t.after(() => x.dom.window.close());
  assert.equal(links(x).length, 1);
  const main = x.doc.querySelector("main");
  main.insertAdjacentHTML(
    "afterbegin",
    "<div data-size-control></div><textarea data-input></textarea><button data-workspace-tab></button>",
  );
  await delay(350);
  assert.equal(links(x).length, 0);
  assert.equal(x.doc.getElementById("algorithm").textContent, "R U F");
  assert.equal(x.status().enabled, false);
});

test("SSE widgets preserve setup in the same size and dialect as their moves", async (t) => {
  const x = await setup(
    '<twisty-player puzzle="5x5x5" alg="WR U F" experimental-setup-alg="MR2"></twisty-player><twisty-player puzzle="5x5x5" alg="WR U F" experimental-setup-alg="W6R"></twisty-player>',
  );
  t.after(() => x.dom.window.close());
  assert.equal(links(x).length, 1);
  const params = new URLSearchParams(new URL(links(x)[0].href).hash.slice(1));
  assert.equal(params.get("alg"), "MR2");
  assert.equal(params.get("dialect"), "Sse");
});

test("rescans reuse badges and text nodes; disabling restores extension splits", async (t) => {
  const source = "First: R U F / second: F R U. Done.";
  const x = await setup(`<p>${source}</p><p>R U F</p>`);
  t.after(() => x.dom.window.close());
  const paragraphs = [...x.doc.querySelectorAll("p")];
  const originalNodes = paragraphs.map((p) => p.firstChild);
  const initial = paragraphs.map((p) => [...p.childNodes]);
  const badges = links(x);
  for (let i = 0; i < 20; i++) x.scan();
  assert.deepEqual(links(x), badges);
  paragraphs.forEach((p, i) => assert.deepEqual([...p.childNodes], initial[i]));
  await x.change({ enabled: false });
  assert.equal(paragraphs[0].textContent, source);
  paragraphs.forEach((p, i) => {
    assert.equal(p.childNodes.length, 1);
    assert.equal(p.firstChild, originalNodes[i]);
  });
  await x.change({});
  assert.equal(links(x).length, 3);
});

test("text mutations only inspect the affected block and keep unrelated badges", async (t) => {
  const x = await setup('<p id="changed">R U F</p><p id="stable">F R U</p>');
  t.after(() => x.dom.window.close());
  const stable = x.doc.getElementById("stable"),
    badge = stable.querySelector("a");
  let reads = 0;
  stable.getClientRects = () => {
    reads++;
    return [{ width: 100, height: 20 }];
  };
  const inputs = [],
    detect = x.w.CubeLabDetector.detect;
  x.w.CubeLabDetector.detect = (text, options) => {
    inputs.push(text);
    return detect(text, options);
  };
  x.doc.getElementById("changed").firstChild.data = "R U R′ U′";
  await delay(350);
  assert.equal(reads, 0);
  assert.deepEqual(inputs, ["R U R′ U′"]);
  assert.equal(stable.querySelector("a"), badge);
  assert.equal(x.status().count, 2);
});

test("CSS-hidden inline content is a boundary and can become visible", async (t) => {
  const x = await setup(
    '<style>.concealed { display: none }</style><p id="hidden"><span class="concealed">R U F</span></p><p>R <span style="visibility:hidden">U</span> F</p><p>R <span hidden></span> U F</p><p style="visibility:hidden"><span style="visibility:visible">R U F</span></p><p><span style="display:contents">R U F</span></p>',
  );
  t.after(() => x.dom.window.close());
  assert.equal(links(x).length, 2);
  assert.equal(x.doc.getElementById("hidden").querySelector("a"), null);
  x.doc.querySelector(".concealed").className = "";
  await delay(350);
  assert.equal(links(x).length, 3);
  x.doc.getElementById("hidden").style.display = "none";
  await delay(350);
  assert.equal(links(x).length, 2);
});

test("editing permissions and stylesheet changes invalidate existing badges", async (t) => {
  const x = await setup('<style></style><p id="alg">R U F</p>');
  t.after(() => x.dom.window.close());
  const p = x.doc.getElementById("alg");
  p.setAttribute("contenteditable", "true");
  await delay(350);
  assert.equal(links(x).length, 0);
  p.setAttribute("contenteditable", "false");
  await delay(350);
  assert.equal(links(x).length, 1);
  x.doc.querySelector("style").textContent = "#alg { visibility: hidden }";
  await delay(350);
  assert.equal(links(x).length, 0);
});

test("heading changes refresh downstream size without using badge labels as context", async (t) => {
  const x = await setup("<h2>2x2</h2><p>R U F</p><h2>4x4</h2><p>Rw U Rw′</p>");
  t.after(() => x.dom.window.close());
  const unchanged = links(x)[1];
  x.doc.querySelector("h2").textContent = "5x5";
  await delay(350);
  assert.ok(links(x)[0].href.includes("size=5"));
  assert.equal(links(x)[1], unchanged);
});

test("widget badges are stable, updated, and removed with their owners", async (t) => {
  const x = await setup(
    '<div data-alg="R U F">Card</div><twisty-player alg="R U F"></twisty-player>',
  );
  t.after(() => x.dom.window.close());
  const initial = links(x);
  for (let i = 0; i < 10; i++) x.scan();
  assert.deepEqual(links(x), initial);
  x.doc.querySelector("twisty-player").remove();
  await delay(350);
  assert.equal(links(x).length, 1);
  x.doc.querySelector("[data-alg]").removeAttribute("data-alg");
  await delay(350);
  assert.equal(links(x).length, 0);
  assert.equal(x.status().count, 0);
});

test("attribute-backed gallery badges are outside clipped cards", async (t) => {
  const x = await setup(
    '<style>.card { overflow: hidden; height: 1px }</style><div class="card" data-alg="R U F">Pattern</div>',
  );
  t.after(() => x.dom.window.close());
  const card = x.doc.querySelector(".card");
  const [badge] = links(x);
  assert.equal(card.nextElementSibling, badge);
  assert.equal(card.contains(badge), false);
});

test("badges use a decorative external-link SVG instead of a text glyph", async (t) => {
  const x = await setup("<p>R U F</p>");
  t.after(() => x.dom.window.close());
  const [badge] = links(x);
  const icon = badge.querySelector("svg.cubelab-link-icon");
  assert.ok(icon);
  assert.equal(icon.getAttribute("aria-hidden"), "true");
  assert.equal(icon.getAttribute("focusable"), "false");
  assert.equal(icon.getAttribute("viewBox"), "0 0 24 24");
  assert.equal(badge.textContent, "");
  assert.equal(badge.getAttribute("aria-label"), "Open 3×3 moves in CubeLab");
  assert.ok(badge.classList.contains("cubelab-link--compact"));
});

test("classic badge style retains its visible label", async (t) => {
  const x = await setup("<p>R U F</p>", { badgeStyle: "classic" });
  t.after(() => x.dom.window.close());
  const [badge] = links(x);
  assert.equal(badge.textContent, "CubeLab · 3×3 moves");
  assert.ok(badge.classList.contains("cubelab-link--classic"));
});

test("compact badges are siblings of Ruwix rendered move rows", async (t) => {
  const source = "L F' L' D' L' D F";
  const x = await setup(
    `<div class="imageWithAlairas"><span class="rots" id="rots"><span>${source.split(" ").join("</span> <span>")}</span></span></div>`,
    {},
    "https://ruwix.com/the-rubiks-cube/rubiks-cube-patterns-algorithms/",
  );
  t.after(() => x.dom.window.close());
  const [badge] = links(x);
  const row = x.doc.getElementById("rots");
  assert.equal(row.textContent, source);
  assert.equal(row.querySelector(".cubelab-link"), null);
  assert.equal(row.nextElementSibling, badge);
});

test("floating actions stay outside visual move rows", async (t) => {
  const source = "L F' L' D' L' D F";
  const x = await setup(
    `<div class="imageWithAlairas"><span class="rots" id="rots"><span>${source.split(" ").join("</span> <span>")}</span></span></div>`,
    { badgeStyle: "floating" },
    "https://ruwix.com/the-rubiks-cube/rubiks-cube-patterns-algorithms/",
  );
  t.after(() => x.dom.window.close());
  const [badge] = links(x);
  const row = x.doc.getElementById("rots");
  assert.equal(row.textContent, source);
  assert.equal(row.querySelector(".cubelab-link"), null);
  assert.equal(badge.parentElement, x.doc.body);
  assert.ok(badge.classList.contains("cubelab-link--floating"));
  assert.equal(badge.textContent, "CubeLab · 3×3 moves");
});

test("Jaap links preserve anchor notation and exclude move-count annotations", async (t) => {
  const source = "F2 R2 Ua' (R2 F2)2 Ua F2 R2";
  const x = await setup(
    `<ol><li><a id="jaap" href="javascript:showpat()">${source}</a> (12f*)</li></ol>`,
  );
  t.after(() => x.dom.window.close());
  const anchor = x.doc.getElementById("jaap");
  const badge = anchor.nextElementSibling;
  assert.ok(badge.classList.contains("cubelab-link"));
  assert.equal(anchor.querySelector(".cubelab-link"), null);
  assert.equal(
    new URLSearchParams(new URL(badge.href).hash.slice(1)).get("moves"),
    source,
  );
});

test("Jaap anchors remain detectable after citation text", async (t) => {
  const sources = [
    "Rm2 Fm2 Um2",
    "(Rs Fs)3",
    "Ra D2 B' L2 F2 R2 Us' R' D2 Fa' D' F2 D' R2 U' F2 D'",
    "R' U2 B L' F U' B D F Us L D2 F' R B' D F' U' B' Us",
    "((Rm U)4 Rc Uc')3",
  ];
  const x = await setup(`
    <ol><li>The 6X pattern (a.k.a. Pons Asinorum) [p10, RCC 3.9.37]<br>
      <a href="javascript:showpat()">${sources[0]}</a> (6f*, 12q*)<br>
      <a href="javascript:showpat()">(Rs Fs)<sup>3</sup></a>
    </li><li>The superflip [p3,p179,p194,p195,p205]<br>
      <a href="javascript:showpat()">${sources[2]}</a> (20f*)<br>
      <a href="javascript:showpat()">${sources[3]}</a> (24q*)<br>
      <a href="javascript:showpat()">((Rm U)<sup>4</sup> Rc Uc')<sup>3</sup></a>
    </li></ol>`);
  t.after(() => x.dom.window.close());
  const badges = links(x);
  assert.equal(badges.length, sources.length);
  for (let i = 0; i < sources.length; i++) {
    const params = new URLSearchParams(new URL(badges[i].href).hash.slice(1));
    assert.equal(params.get("moves"), sources[i]);
  }
});

test("removed badges are repaired and the page cap refills after removals", async (t) => {
  const x = await setup("<p>R U F</p>".repeat(502));
  t.after(() => x.dom.window.close());
  assert.equal(links(x).length, 500);
  links(x)[0].remove();
  await delay(350);
  assert.equal(links(x).length, 500);
  x.doc.querySelector("p").remove();
  await delay(350);
  assert.equal(links(x).length, 500);
  assert.equal(x.status().count, 500);
});

test("malformed URL escapes do not stop initial or subsequent scans", async (t) => {
  const x = await setup("<p>R U F</p>", {}, "https://example.com/%E0%A4%A");
  t.after(() => x.dom.window.close());
  assert.equal(links(x).length, 1);
  x.doc.querySelector("p").textContent = "F R U";
  await delay(350);
  assert.ok(links(x)[0].href.includes("F+R+U"));
});
test("inline markup, subscript layers, separate algorithms and no duplication", async () => {
  const x = await setup(
    '<title>4x4 cube</title><p id="alg"><b>R</b> U <i>R′</i> U′</p><p>F<sub>2</sub>′ U F<sub>2</sub></p>',
    { sitePreferences: { "example.com": { size: 4 } } },
  );
  try {
    assert.equal(links(x).length, 2);
    assert.ok(decodeURIComponent(links(x)[1].href).includes("F₂"));
    const before = x.doc.querySelector("b");
    x.scan();
    x.scan();
    assert.equal(links(x).length, 2);
    assert.equal(x.doc.querySelector("b"), before);
    assert.equal(x.doc.querySelector("i").firstChild.textContent, "R′");
  } finally {
    x.dom.window.close();
  }
});
test("never decorate editable regions, textareas, buttons, non-link anchors or hidden content", async () => {
  const x = await setup(
    '<p>R U R′ U′</p><a data-move="F">R U R′ U′</a><textarea>R U R′ U′</textarea><div contenteditable>R U R′ U′</div><p hidden>R U R′ U′</p><button>R U R′ U′</button>',
  );
  try {
    assert.equal(links(x).length, 1);
  } finally {
    x.dom.window.close();
  }
});
test("decorate existing hyperlinks by placing badge after the host anchor", async () => {
  const x = await setup(
    '<a id="src" href="https://alg.cubing.net"><span>R U R′ U′</span></a>',
  );
  try {
    assert.equal(links(x).length, 1);
    const link = links(x)[0];
    const anchor = x.doc.getElementById("src");
    assert.equal(anchor.querySelector(".cubelab-link"), null);
    assert.equal(anchor.nextElementSibling, link);
  } finally {
    x.dom.window.close();
  }
});
test("dynamic insertion, text changes and site disabling", async () => {
  const x = await setup('<p id="alg">R U R′ U′</p>');
  try {
    x.doc.body.insertAdjacentHTML("beforeend", "<p>F R F′</p>");
    await delay(350);
    assert.equal(links(x).length, 2);
    x.doc.getElementById("alg").textContent = "No algorithm here";
    await delay(350);
    assert.equal(links(x).length, 1);
    await x.change({ disabledHosts: ["example.com"] });
    assert.equal(links(x).length, 0);
    await x.change({});
    assert.equal(links(x).length, 1);
  } finally {
    x.dom.window.close();
  }
});
test("cycles separated by br become one link", async () => {
  const x = await setup(
    "<p><strong>Permutation</strong><br>(dlf,urf) (ufl,dfr)<br>(ur,dr) (rf,rb)<br>(++r) (++u)</p>",
  );
  try {
    assert.equal(links(x).length, 1);
    const p = new URLSearchParams(new URL(links(x)[0].href).hash.slice(1));
    assert.ok(p.get("alg").includes("(ur,dr)"));
    assert.ok(p.get("alg").includes("(++r)"));
  } finally {
    x.dom.window.close();
  }
});
test("skipped content is a boundary, not silently joined into another algorithm", async () => {
  const x = await setup('<p>R <a href="/">unknown</a> U F</p>');
  try {
    assert.equal(links(x).length, 0);
  } finally {
    x.dom.window.close();
  }
});
test("mixed galleries respect local sizes, including 6x6 and 7x7, and skip out-of-scope puzzles", async () => {
  const x = await setup(
    "<title>Cube patterns</title><h2>2x2</h2><p>R U R′ U′</p><h2>6x6</h2><p>R U R′ U′</p><h2>Pyraminx</h2><p>R U R′ U′</p><h2>5x5</h2><p>R U R′ U′</p><h2>7x7</h2><p>3Rw U 4F′</p>",
  );
  try {
    assert.equal(links(x).length, 4);
    assert.ok(links(x)[0].href.includes("size=2"));
    assert.ok(links(x)[1].href.includes("size=6"));
    assert.ok(links(x)[2].href.includes("size=5"));
    assert.ok(links(x)[3].href.includes("size=7"));
  } finally {
    x.dom.window.close();
  }
});
test("Ruwix data-alg cards and Twizzle setup get useful links", async () => {
  const x = await setup(
    '<div data-alg="M2 E2 S2">Checkerboard</div><twisty-player puzzle="4x4x4" alg="Rw U Rw′" experimental-setup-alg="R U"></twisty-player>',
  );
  try {
    assert.equal(links(x).length, 2);
    const p = new URLSearchParams(new URL(links(x)[1].href).hash.slice(1));
    assert.equal(p.get("size"), "4");
    assert.equal(p.get("alg"), "R U");
    assert.equal(p.get("moves"), "Rw U Rw′");
    x.doc.querySelector("[data-alg]").setAttribute("data-alg", "R U R′ U′");
    await delay(350);
    assert.equal(links(x).length, 2);
    assert.equal(
      new URLSearchParams(new URL(links(x)[0].href).hash.slice(1)).get("moves"),
      "R U R′ U′",
    );
  } finally {
    x.dom.window.close();
  }
});

for (const [key, style] of Object.entries(websiteStyles)) {
  test(`supported website style: ${style.name} (${key})`, async () => {
    const x = await setup(style.html, {}, style.url);
    try {
      const found = links(x);
      assert.equal(
        found.length,
        style.expectedLinks,
        `Expected ${style.expectedLinks} links for ${style.name}, got ${found.length}`,
      );
      if (style.expectedSize) {
        for (const link of found) {
          const p = new URLSearchParams(new URL(link.href).hash.slice(1));
          const expectedParam =
            style.expectedSize === 3 ? null : String(style.expectedSize);
          assert.equal(
            p.get("size"),
            expectedParam,
            `Expected size param ${expectedParam} for ${style.name}`,
          );
        }
      }
      if (style.expectedMoves) {
        for (let i = 0; i < style.expectedMoves.length; i++) {
          const p = new URLSearchParams(new URL(found[i].href).hash.slice(1));
          assert.equal(p.get("moves"), style.expectedMoves[i]);
        }
      }
      if (style.expectedPlacement === "after-anchor") {
        for (const link of found) {
          assert.ok(
            link.previousElementSibling &&
              link.previousElementSibling.tagName.toLowerCase() === "a",
            "Badge should be placed after host anchor",
          );
        }
      }
    } finally {
      x.dom.window.close();
    }
  });
}

const marker =
  '<meta name="cubelab-fingerprint" content="spec=1;app=cube-assembler@0.1.0">';
const movesBlock = (value) =>
  `<script type="application/json" id="cubelab-moves">${JSON.stringify({ format: "layer-prefix/v1", ...value }).replaceAll("<", "\\u003c")}</script>`;
const app = (value, { head = marker, line = "Moves: 2L' 2R U2" } = {}) =>
  `<head>${head}</head><body><div id="view"><div class="cube-3d-move-history" role="status">${line}</div>${movesBlock(value)}</div></body>`;
const movesOf = (link) =>
  new URLSearchParams(new URL(link.href).hash.slice(1)).get("moves");
const sizeOf = (link) =>
  new URLSearchParams(new URL(link.href).hash.slice(1)).get("size");

test("a valid fingerprint makes exactly one badge from the data, even next to the same visible moves", async (t) => {
  const x = await setup(app({ size: 4, moves: "2L' 2R U2" }));
  t.after(() => x.dom.window.close());
  const [link, ...rest] = links(x);
  assert.equal(rest.length, 0);
  assert.equal(link.nextElementSibling.id, "cubelab-moves");
  assert.equal(movesOf(link), "2L' 2R U2");
  assert.equal(sizeOf(link), "4");
  assert.equal(link.getAttribute("aria-label"), "Open 4×4 moves in CubeLab");
  assert.equal(
    x.doc.querySelector(".cube-3d-move-history").textContent,
    "Moves: 2L' 2R U2",
  );
  assert.equal(x.status().count, 1);
  // The block is read, never executed or rendered.
  assert.equal(
    x.doc.getElementById("cubelab-moves").textContent.includes("<"),
    false,
  );
});

test("the fingerprint size beats page inference, site preferences and the 3x3 default", async (t) => {
  const x = await setup(
    "<title>5x5 algorithms</title>" + app({ size: 2, moves: "R U F" }),
    { sitePreferences: { "example.com": { size: 5 } } },
  );
  t.after(() => x.dom.window.close());
  assert.equal(sizeOf(links(x)[0]), "2");
  assert.match(links(x)[0].getAttribute("aria-label"), /2×2/);
});

test("without a valid marker, spec or format the visible Moves line is scanned as before", async (t) => {
  const cases = {
    "no marker": [app({ size: 3, moves: "U R F" }, { head: "" })],
    "future spec": [
      app(
        { size: 3, moves: "U R F" },
        { head: '<meta name="cubelab-fingerprint" content="spec=2;app=x">' },
      ),
    ],
    "unknown format": [app({ size: 3, moves: "U R F", format: "x/v2" })],
    "invalid json": [
      app({ size: 3, moves: "U R F" }).replace('{"format"', "{"),
    ],
    "bad size": [app({ size: 9, moves: "U R F" })],
    "bad moves": [app({ size: 3, moves: "U R Q" })],
  };
  for (const [name, [html]] of Object.entries(cases)) {
    const x = await setup(html);
    t.after(() => x.dom.window.close());
    const found = links(x);
    assert.equal(found.length, 1, name);
    assert.equal(movesOf(found[0]), "2L' 2R U2", name);
    assert.equal(
      found[0].parentElement.className,
      "cube-3d-move-history",
      name,
    );
  }
});

test("6x6 and 7x7 fingerprints link their inner layers with the stated size and no duplicate from the line", async (t) => {
  for (const size of [6, 7]) {
    const x = await setup(app({ size, moves: "2L' 3Rw U2 2-4Fw" }));
    t.after(() => x.dom.window.close());
    assert.equal(links(x).length, 1, String(size));
    assert.equal(movesOf(links(x)[0]), "2L' 3Rw U2 2-4Fw");
    assert.equal(sizeOf(links(x)[0]), String(size));
  }
});

test("an empty history creates no badge and no duplicate from the line", async (t) => {
  const x = await setup(app({ size: 3, moves: "" }));
  t.after(() => x.dom.window.close());
  assert.equal(links(x).length, 0);
});

test("a single move is linked because the data is explicit", async (t) => {
  const x = await setup(app({ size: 3, moves: "R" }, { line: "Moves: R" }));
  t.after(() => x.dom.window.close());
  assert.equal(movesOf(links(x)[0]), "R");
});

test("fingerprint updates keep the badge node and follow empty, invalid and valid blocks", async (t) => {
  const x = await setup(app({ size: 3, moves: "R U F" }));
  t.after(() => x.dom.window.close());
  const script = () => x.doc.getElementById("cubelab-moves");
  const write = async (value) => {
    script().textContent =
      typeof value === "string"
        ? value
        : JSON.stringify({ format: "layer-prefix/v1", ...value });
    await delay(350);
  };
  const first = links(x)[0];
  await write({ size: 3, moves: "R U F D" });
  assert.equal(links(x).length, 1);
  assert.equal(links(x)[0], first);
  assert.equal(movesOf(first), "R U F D");
  await write({ size: 5, moves: "R U F D" });
  assert.equal(links(x)[0], first);
  assert.equal(sizeOf(first), "5");
  await write({ size: 3, moves: "" });
  assert.equal(links(x).length, 0);
  await write({ size: 3, moves: "L" });
  assert.equal(links(x).length, 1);
  assert.equal(movesOf(links(x)[0]), "L");
  // An invalid update returns the page region to ordinary scanning.
  await write("{");
  assert.equal(links(x).length, 1);
  assert.equal(links(x)[0].parentElement.className, "cube-3d-move-history");
  assert.equal(movesOf(links(x)[0]), "2L' 2R U2");
  await write({ size: 3, moves: "B" });
  assert.equal(links(x).length, 1);
  assert.equal(links(x)[0].nextElementSibling, script());
  assert.equal(x.doc.querySelectorAll(".cube-3d-move-history a").length, 0);
});

test("removing the block or the marker removes the badge and restores scanning", async (t) => {
  const x = await setup(app({ size: 3, moves: "R U F" }));
  t.after(() => x.dom.window.close());
  x.doc.querySelector('meta[name="cubelab-fingerprint"]').remove();
  await delay(350);
  assert.equal(links(x).length, 1);
  assert.equal(links(x)[0].parentElement.className, "cube-3d-move-history");
  x.doc.head.insertAdjacentHTML("beforeend", marker);
  await delay(350);
  assert.equal(links(x).length, 1);
  assert.equal(links(x)[0].nextElementSibling.id, "cubelab-moves");
  x.doc.getElementById("cubelab-moves").remove();
  await delay(350);
  assert.equal(links(x).length, 1);
  assert.equal(links(x)[0].parentElement.className, "cube-3d-move-history");
  x.doc.getElementById("view").remove();
  await delay(350);
  assert.equal(links(x).length, 0);
  assert.equal(x.status().count, 0);
});

test("fingerprint badges respect disabling, hosts, badge styles and the badge cap", async (t) => {
  for (const settings of [
    { enabled: false },
    { disabledHosts: ["example.com"] },
  ]) {
    const x = await setup(app({ size: 3, moves: "R U F" }), settings);
    t.after(() => x.dom.window.close());
    assert.equal(links(x).length, 0);
  }
  const floating = await setup(app({ size: 3, moves: "R U F" }), {
    badgeStyle: "floating",
  });
  t.after(() => floating.dom.window.close());
  assert.equal(links(floating).length, 1);
  assert.equal(links(floating)[0].parentElement, floating.doc.body);
  assert.match(links(floating)[0].textContent, /3×3 moves/);
  const classic = await setup(app({ size: 3, moves: "R U F" }), {
    badgeStyle: "classic",
  });
  t.after(() => classic.dom.window.close());
  assert.match(links(classic)[0].textContent, /3×3 moves/);
  await classic.change({ badgeStyle: "compact" });
  assert.equal(links(classic).length, 1);
  assert.equal(links(classic)[0].textContent, "");
  await classic.change({ enabled: false });
  assert.equal(links(classic).length, 0);
  const capped = await setup(
    app({ size: 3, moves: "R U F" }) +
      Array.from({ length: 500 }, () => "<p>R U F</p>").join(""),
  );
  t.after(() => capped.dom.window.close());
  assert.equal(links(capped).length, 500);
});

test("a block without a preceding Moves element still gets one badge before it", async (t) => {
  const x = await setup(
    `<head>${marker}</head><body>${movesBlock({ size: 3, moves: "R U F" })}<p>R U F</p></body>`,
  );
  t.after(() => x.dom.window.close());
  assert.equal(links(x).length, 2);
  const floating = await setup(
    `<head>${marker}</head><body>${movesBlock({ size: 3, moves: "R U F" })}</body>`,
    { badgeStyle: "floating" },
  );
  t.after(() => floating.dom.window.close());
  assert.equal(links(floating).length, 1);
});

test("fingerprint badges follow style changes, skip unusable destinations and stay put", async (t) => {
  const x = await setup(app({ size: 3, moves: "R U F" }));
  t.after(() => x.dom.window.close());
  const badge = links(x)[0];
  await x.change({ badgeStyle: "floating" });
  assert.equal(links(x).length, 1);
  assert.equal(links(x)[0].parentElement, x.doc.body);
  await x.change({ badgeStyle: "classic" });
  assert.equal(links(x).length, 1);
  assert.equal(links(x)[0].nextElementSibling.id, "cubelab-moves");
  await x.change({ badgeStyle: "compact" });
  const settled = links(x)[0];
  const icon = settled.firstChild;
  x.scan();
  assert.equal(links(x)[0], settled);
  assert.equal(settled.firstChild, icon);
  assert.notEqual(settled, badge);
  const http = await setup(app({ size: 3, moves: "R U F" }), {
    movesTemplate: "http://example.com/#{notation}",
  });
  t.after(() => http.dom.window.close());
  assert.equal(links(http).length, 0);
});
