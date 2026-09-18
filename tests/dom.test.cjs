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
  assert.equal(badge.textContent, "CubeLab · 3×3 moves");
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
test("mixed galleries respect local sizes and skip out-of-scope puzzles", async () => {
  const x = await setup(
    "<title>Cube patterns</title><h2>2x2</h2><p>R U R′ U′</p><h2>6x6</h2><p>R U R′ U′</p><h2>Pyraminx</h2><p>R U R′ U′</p><h2>5x5</h2><p>R U R′ U′</p>",
  );
  try {
    assert.equal(links(x).length, 2);
    assert.ok(links(x)[0].href.includes("size=2"));
    assert.ok(links(x)[1].href.includes("size=5"));
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
