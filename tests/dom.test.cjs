const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const D = require("../detector");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function setup(html, settings = {}) {
  const dom = new JSDOM(html, {
    url: "https://example.com/3x3/algorithms",
    runScripts: "outside-only",
  });
  const w = dom.window;
  let message, changed;
  // jsdom has no layout engine. Supply visible rects; hidden attributes are tested separately.
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
    change: async (value) => {
      changed({ settings: { newValue: { ...D.DEFAULTS, ...value } } }, "local");
      await delay(300);
    },
  };
}
const links = (x) => [...x.doc.querySelectorAll(".cubelab-link")];
test("inline markup, subscript layers, separate algorithms and no duplication", async () => {
  const x = await setup(
    '<title>4x4 cube</title><p id="alg"><b>R</b> U <i>R′</i> U′</p><p>F<sub>2</sub>′ U F<sub>2</sub></p>',
    { sitePreferences: { "example.com": { size: 4 } } },
  );
  try {
    assert.equal(links(x).length, 2);
    assert.ok(links(x)[1].href.includes("2Fw"));
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
    assert.equal(p.get("moves"), "Rw U Rw'");
    x.doc.querySelector("[data-alg]").setAttribute("data-alg", "R U R′ U′");
    await delay(350);
    assert.equal(links(x).length, 2);
    assert.ok(links(x)[0].href.includes("R+U+R%27+U%27"));
  } finally {
    x.dom.window.close();
  }
});
