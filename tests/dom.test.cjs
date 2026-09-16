const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const D = require("../detector");
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
test("never decorate editable regions, existing links or hidden content", async () => {
  const x = await setup(
    '<p>R U R′ U′</p><a href="/">R U R′ U′</a><textarea>R U R′ U′</textarea><div contenteditable>R U R′ U′</div><p hidden>R U R′ U′</p><button>R U R′ U′</button>',
  );
  try {
    assert.equal(links(x).length, 1);
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
