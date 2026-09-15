const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function workerHarness(settings = {}) {
  const handlers = {},
    tabs = [],
    menus = [],
    warnings = [];
  let stored = settings;
  const context = vm.createContext({
    URL,
    URLSearchParams,
    structuredClone,
    console: { warn: (...args) => warnings.push(args) },
    chrome: {
      runtime: {
        id: "test-extension",
        getURL: (file) => `chrome-extension://test-extension/${file}`,
        onMessage: {
          addListener: (fn) => {
            handlers.message = fn;
          },
        },
        onInstalled: {
          addListener: (fn) => {
            handlers.install = fn;
          },
        },
      },
      storage: {
        local: {
          get: async () => ({ settings: structuredClone(stored) }),
          set: async ({ settings }) => {
            stored = structuredClone(settings);
          },
        },
      },
      tabs: {
        create: async ({ url }) => {
          tabs.push(url);
        },
      },
      contextMenus: {
        removeAll: (callback) => {
          menus.length = 0;
          callback();
        },
        create: (menu) => {
          menus.push(menu);
        },
        onClicked: {
          addListener: (fn) => {
            handlers.select = fn;
          },
        },
      },
    },
    importScripts: (...files) =>
      files.forEach((file) =>
        vm.runInContext(
          fs.readFileSync(path.join(__dirname, "..", file), "utf8"),
          context,
        ),
      ),
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8"),
    context,
  );
  return { handlers, tabs, menus, warnings };
}

test("worker settings messages require an extension-page sender and reply asynchronously", async () => {
  const { handlers } = workerHarness();
  const request = {
    type: "settings:update",
    change: { type: "global", patch: { enabled: false } },
  };
  for (const sender of [
    { id: "other", url: "chrome-extension://test-extension/popup.html" },
    { id: "test-extension", url: "https://example.com" },
    { id: "test-extension" },
  ]) {
    let response;
    handlers.message(request, sender, (value) => {
      response = value;
    });
    assert.match(response.error, /extension pages/);
  }
  const sender = {
    id: "test-extension",
    url: "chrome-extension://test-extension/options.html",
  };
  const response = await new Promise((resolve) => {
    assert.equal(handlers.message(request, sender, resolve), true);
  });
  assert.equal(response.settings.enabled, false);
  const invalid = await new Promise((resolve) =>
    handlers.message(
      { ...request, change: { type: "global", patch: { enabled: "invalid" } } },
      sender,
      resolve,
    ),
  );
  assert.match(invalid.error, /Invalid setting/);
  assert.equal(
    handlers.message({ type: "unrelated" }, sender, () =>
      assert.fail("Unexpected reply"),
    ),
    undefined,
  );
});

test("selection menu registration is idempotent and respects site dialect preferences", async () => {
  const { handlers, menus, tabs } = workerHarness({
    sitePreferences: {
      "example.com": { size: 4, lowercaseMode: "InnerSlice" },
    },
  });
  handlers.install();
  handlers.install();
  assert.equal(menus.length, 1);
  assert.equal(menus[0].id, "cubelab-selection");
  assert.equal(menus[0].contexts[0], "selection");
  await handlers.select(
    { menuItemId: "cubelab-selection", selectionText: "r U r′" },
    { url: "https://example.com/", title: "Cube" },
  );
  const params = new URLSearchParams(new URL(tabs[0]).hash.slice(1));
  assert.equal(params.get("moves"), "r U r'");
  assert.equal(params.get("size"), "4");
  assert.equal(params.get("lowercase"), "InnerSlice");
});

test("selection fallback preserves unknown input and ignores unrelated or oversized requests", async () => {
  const { handlers, tabs } = workerHarness();
  await handlers.select({ menuItemId: "other", selectionText: "R U F" });
  await handlers.select({ menuItemId: "cubelab-selection" });
  await handlers.select({
    menuItemId: "cubelab-selection",
    selectionText: "x".repeat(8001),
  });
  assert.equal(tabs.length, 0);
  const selectionText = "unknown &x=1#input";
  await handlers.select({ menuItemId: "cubelab-selection", selectionText });
  assert.equal(
    new URLSearchParams(new URL(tabs[0]).hash.slice(1)).get("alg"),
    selectionText,
  );
});

test("invalid selection destinations are reported without opening a tab", async () => {
  const { handlers, tabs, warnings } = workerHarness({
    movesTemplate: "javascript:{notation}",
  });
  await handlers.select({
    menuItemId: "cubelab-selection",
    selectionText: "R U F",
  });
  assert.equal(tabs.length, 0);
  assert.match(warnings[0][0], /could not be opened/);
});
