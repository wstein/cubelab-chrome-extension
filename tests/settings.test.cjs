const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const D = require("../detector");
const { createStore } = require("../settings");

function storageHarness() {
  let saved = structuredClone(D.DEFAULTS),
    fail = false;
  const storage = {
    get: async () => ({ settings: structuredClone(saved) }),
    set: async ({ settings }) => {
      if (fail) {
        fail = false;
        throw Error("Storage unavailable");
      }
      saved = structuredClone(settings);
    },
  };
  return {
    storage,
    store: createStore(storage),
    failNext: () => {
      fail = true;
    },
  };
}

test("concurrent settings patches preserve global, host and same-host fields", async () => {
  const { storage, store } = storageHarness();
  await Promise.all([
    store.update({ type: "global", patch: { enabled: false } }),
    store.update({ type: "site", host: "example.com", patch: { size: 4 } }),
    store.update({
      type: "site",
      host: "example.com",
      patch: { lowercaseMode: "InnerSlice", enabled: false },
    }),
    store.update({ type: "site", host: "other.example", patch: { size: 5 } }),
    store.update({ type: "global", patch: { scheme: "Japanese" } }),
  ]);
  const { settings } = await storage.get();
  assert.equal(settings.enabled, false);
  assert.equal(settings.scheme, "Japanese");
  assert.deepEqual(settings.disabledHosts, ["example.com"]);
  assert.deepEqual(settings.sitePreferences["example.com"], {
    size: 4,
    lowercaseMode: "InnerSlice",
  });
  assert.equal(settings.sitePreferences["other.example"].size, 5);
});

test("failed writes do not poison the queue; reset is ordered with updates", async () => {
  const { store, storage, failNext } = storageHarness();
  failNext();
  await assert.rejects(
    store.update({ type: "global", patch: { enabled: false } }),
    /Storage unavailable/,
  );
  await store.update({
    type: "site",
    host: "example.com",
    patch: { size: 4, enabled: false },
  });
  await store.update({ type: "reset" });
  assert.deepEqual((await storage.get()).settings, D.DEFAULTS);
  await store.update({
    type: "site",
    host: "example.com",
    patch: { size: null, enabled: true },
  });
  assert.deepEqual(D.DEFAULTS.disabledHosts, []);
  assert.deepEqual(D.DEFAULTS.sitePreferences, {});
});

test("invalid patches never change stored settings", async () => {
  const { store, storage } = storageHarness();
  for (const change of [
    { type: "global", patch: { minMoves: 0 } },
    { type: "global", patch: { movesTemplate: "javascript:{notation}" } },
    { type: "global", patch: { algTemplate: "https://example.com/" } },
    { type: "site", host: "", patch: { size: 3 } },
    { type: "site", host: "example.com/path", patch: { size: 3 } },
    { type: "site", host: "example.com", patch: { size: 6 } },
    { type: "global", patch: { disabledHosts: [] } },
    { type: "unknown" },
  ])
    await assert.rejects(store.update(change));
  assert.deepEqual((await storage.get()).settings, D.DEFAULTS);
});

async function openUI(file, harness, tabURL = "https://example.com/") {
  const dom = new JSDOM(
    fs.readFileSync(path.join(__dirname, "..", `${file}.html`), "utf8"),
    {
      url: `https://extension.example/${file}.html`,
      runScripts: "outside-only",
    },
  );
  const w = dom.window;
  w.chrome = {
    storage: { local: harness.storage },
    tabs: {
      query: async () => [{ id: 1, url: tabURL }],
      sendMessage: async () => ({ count: 0, hostname: "example.com" }),
    },
    runtime: {
      sendMessage: async ({ change }) => {
        try {
          return { settings: await harness.store.update(change) };
        } catch (error) {
          return { error: error.message };
        }
      },
    },
  };
  for (const script of ["detector", "settings", file])
    await w.eval(
      fs.readFileSync(path.join(__dirname, "..", `${script}.js`), "utf8"),
    );
  return { dom, element: (id) => w.document.getElementById(id) };
}

test("stale options save preserves newer popup changes and untouched fields", async (t) => {
  const harness = storageHarness();
  const options = await openUI("options", harness),
    popup = await openUI("popup", harness);
  t.after(() => {
    options.dom.window.close();
    popup.dom.window.close();
  });
  popup.element("enabled").checked = false;
  await popup.element("enabled").onchange();
  popup.element("site").checked = false;
  await popup.element("site").onchange();
  await harness.store.update({ type: "global", patch: { scheme: "Japanese" } });
  options.element("minMoves").value = "4";
  await options.element("save").onclick();
  const { settings } = await harness.storage.get();
  assert.equal(settings.enabled, false);
  assert.deepEqual(settings.disabledHosts, ["example.com"]);
  assert.equal(settings.scheme, "Japanese");
  assert.equal(settings.minMoves, 4);
  popup.element("size").value = "5";
  await popup.element("size").onchange();
  assert.equal((await harness.storage.get()).settings.minMoves, 4);
});

test("UI reports failed saves and reset failures; hostless pages disable site controls", async (t) => {
  const harness = storageHarness();
  const options = await openUI("options", harness),
    popup = await openUI("popup", harness, "about:blank");
  t.after(() => {
    options.dom.window.close();
    popup.dom.window.close();
  });
  for (const id of ["site", "size", "lowercaseMode"])
    assert.equal(popup.element(id).disabled, true);
  for (const id of ["save", "reset"]) {
    harness.failNext();
    await options.element(id).onclick();
    assert.match(options.element("status").textContent, /Storage unavailable/);
  }
  harness.failNext();
  popup.element("enabled").checked = false;
  await popup.element("enabled").onchange();
  assert.match(popup.element("status").textContent, /Storage unavailable/);
  assert.equal(popup.element("enabled").checked, true);
});
