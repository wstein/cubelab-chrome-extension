const { test, expect } = require("./fixtures.cjs");
const numberedSse = require("../fixtures/numbered-sse.cjs");
const websiteStyles = require("../fixtures/website-styles.cjs");

test("attribute-backed gallery badges are siblings of clipped cards", async ({
  page,
  site,
}) => {
  await page.goto(site);
  await page.evaluate(() => {
    document.body.innerHTML =
      '<h1>3x3 patterns</h1><div class="card" data-alg="R U F">Pattern</div>';
    document.head.insertAdjacentHTML(
      "beforeend",
      "<style>.card { height: 1px; overflow: hidden }</style>",
    );
  });
  const card = page.locator(".card");
  const badge = page.locator(".cubelab-link");
  await expect(badge).toHaveCount(1);
  await expect(card.locator(".cubelab-link")).toHaveCount(0);
  expect(
    await card.evaluate((element) => element.nextElementSibling?.className),
  ).toContain("cubelab-link");
});

test("Jaap anchors keep their complete source without move-count metadata", async ({
  page,
  site,
}) => {
  const source = "F2 R2 Ua' (R2 F2)2 Ua F2 R2";
  await page.goto(site);
  await page.evaluate((notation) => {
    document.body.innerHTML = `<h1>Rubik's Cube patterns</h1><ol><li><a id="jaap" href="javascript:showpat()">${notation}</a> (12f*)</li></ol>`;
  }, source);
  const anchor = page.locator("#jaap");
  const badge = page.locator(".cubelab-link");
  await expect(badge).toHaveCount(1);
  await expect(anchor.locator(".cubelab-link")).toHaveCount(0);
  expect(
    new URLSearchParams(
      new URL(await badge.getAttribute("href")).hash.slice(1),
    ).get("moves"),
  ).toBe(source);
});

test("CubeLab metadata and converter shell suppress self-linking", async ({
  page,
  context,
  worker,
}) => {
  const url = "https://cubelab-mirror.example/workbench";
  await context.route(url, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta name="application-name" content="CubeLab"><title>CubeLab mirror</title></head><body><main data-converter><div data-size-control></div><textarea data-input></textarea><button data-workspace-tab></button><p id="algorithm">R U F</p></main></body></html>`,
    }),
  );
  await page.goto(url);
  await expect(page.locator(".cubelab-link")).toHaveCount(0);
  const id = await tabId(worker, page);
  await expect
    .poll(() =>
      worker.evaluate(
        (tab) => chrome.tabs.sendMessage(tab, { type: "status" }),
        id,
      ),
    )
    .toMatchObject({ count: 0, enabled: false });
  // Either signal independently keeps CubeLab excluded.
  await page
    .locator('meta[name="application-name"]')
    .evaluate((meta) => meta.remove());
  await expect(page.locator(".cubelab-link")).toHaveCount(0);
  await page.locator("[data-workspace-tab]").evaluate((tab) => tab.remove());
  await expect(page.locator("#algorithm .cubelab-link")).toHaveCount(1);
  await expect
    .poll(() =>
      worker.evaluate(
        (tab) => chrome.tabs.sendMessage(tab, { type: "status" }),
        id,
      ),
    )
    .toMatchObject({ count: 1, enabled: true });
});

test("Revenge page delegates grouped SSE unchanged through navigation and tester", async ({
  page,
  context,
  extensionId,
}) => {
  const source = "(ML2  D'\n MR2\tD)2";
  const cleaned = "(ML2 D' MR2 D)2";
  const url = "https://www.randelshofer.ch/rubik/revenge/A200.01.html";
  // Local fixture at the reported URL: deterministic, with real path-size inference.
  await context.route(url, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>Pretty Patterns Revenge Cube</title><h1>Algorithm</h1><p id="algorithm">${source}</p>`,
    }),
  );
  await page.goto(url);
  const badge = page.locator("#algorithm .cubelab-link");
  await expect(badge).toHaveCount(1);
  await expect(badge).toContainText("4×4 SSE moves");
  expect(
    await page
      .locator("#algorithm")
      .evaluate((element) => element.firstChild.textContent),
  ).toBe(source);
  await context.route("https://wstein.github.io/cubelab/**", (route) =>
    route.fulfill({ body: "Destination intercepted." }),
  );
  const opened = context.waitForEvent("page");
  await badge.click();
  const destination = await opened;
  await destination.waitForURL("https://wstein.github.io/cubelab/workbench#**");
  const params = new URLSearchParams(new URL(destination.url()).hash.slice(1));
  expect(params.get("moves")).toBe(cleaned);
  expect(params.get("dialect")).toBe("Sse");
  expect(params.get("size")).toBe("4");
  const options = await openUI(context, extensionId, "options");
  await options.locator("#testSize").selectOption("4");
  await options.locator("#notation").fill(source);
  await options.locator("#test").click();
  await expect(options.locator("#results")).toContainText(cleaned);
  await expect(options.locator("#notation")).toHaveValue(source);
  await expect(options.locator("#results")).not.toContainText("2L2");
});

test("numbered SSE cycles navigate intact to size-aware Setup", async ({
  page,
  site,
  context,
  extensionId,
}) => {
  await page.goto(site);
  await page.evaluate((source) => {
    document.body.innerHTML = '<h1>Professor Cube</h1><pre id="cycles"></pre>';
    document.querySelector("#cycles").textContent = source;
  }, numberedSse);
  const badge = page.locator("#cycles .cubelab-link");
  await expect(badge).toHaveCount(1);
  await expect(badge).toHaveText("CubeLab · 5×5 SSE cycles");
  await expect(badge.locator("svg.cubelab-link-icon")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect(
    await page.locator("#cycles").evaluate((element) =>
      [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(""),
    ),
  ).toBe(numberedSse);
  await context.route("https://wstein.github.io/cubelab/**", (route) =>
    route.fulfill({ body: "Setup destination intercepted." }),
  );
  const opened = context.waitForEvent("page");
  await badge.click();
  const destination = await opened;
  await destination.waitForURL("https://wstein.github.io/cubelab/#**");
  const params = new URLSearchParams(new URL(destination.url()).hash.slice(1));
  expect(params.get("alg")).toBe(numberedSse.replace("\n", " "));
  expect(params.get("size")).toBe("5");
  expect(params.has("moves")).toBe(false);
  const options = await openUI(context, extensionId, "options");
  await options.locator("#notation").fill(numberedSse);
  await options.locator("#test").click();
  await expect(options.locator("#results a")).toHaveText(
    "Open 5×5 SSE permutation in CubeLab",
  );
  expect(
    new URLSearchParams(
      new URL(
        await options.locator("#results a").getAttribute("href"),
      ).hash.slice(1),
    ).get("alg"),
  ).toBe(numberedSse.replace("\n", " "));
});

test("SiGN widgets and tester preserve blocks, setup and boundary layers", async ({
  page,
  site,
  context,
  extensionId,
}) => {
  await page.goto(site);
  const options = await openUI(context, extensionId, "options");
  for (const size of [2, 3, 4, 5]) {
    const source = `${size}r U ${size}R'`;
    await page.evaluate(
      ({ size, source }) => {
        document.body.innerHTML = `<twisty-player puzzle="${size}x${size}x${size}" alg="${source}" experimental-setup-alg="${size}u"></twisty-player>`;
      },
      { size, source },
    );
    const badge = page.locator(".cubelab-link");
    await expect(badge).toHaveCount(1);
    const params = new URLSearchParams(
      new URL(await badge.getAttribute("href")).hash.slice(1),
    );
    expect(params.get("moves")).toBe(source);
    expect(params.get("alg")).toBe(`${size}u`);
    expect(Number(params.get("size") || 3)).toBe(size);
    await options.locator("#testSize").selectOption(String(size));
    await options.locator("#notation").fill(source);
    await options.locator("#test").click();
    await expect(options.locator("#results")).toContainText(source);
  }
  await page.evaluate(() => {
    document.body.innerHTML =
      '<h1>5x5</h1><p>3r U 2-3r′</p><twisty-player puzzle="4x4" alg="3r U F" experimental-setup-alg="5r"></twisty-player>';
  });
  await expect(page.locator(".cubelab-link")).toHaveCount(1);
  const params = new URLSearchParams(
    new URL(
      await page.locator(".cubelab-link").getAttribute("href"),
    ).hash.slice(1),
  );
  expect(params.get("moves")).toBe("3r U 2-3r′");
});

test("SSE page links and tester preserve the intended cube size", async ({
  page,
  site,
  context,
  extensionId,
}) => {
  const sample =
    "D2 F2 L' SF2 L D' WR' D' F2 D↗ WR D' T3B TU T3B TL2 TF' TD' TL MD2 TB TU2 TL2 TF MR2 TU TF'";
  await page.goto(site);
  await page.evaluate((sample) => {
    document.body.innerHTML = "<h1>Professor Cube</h1><p id='sse'></p>";
    document.querySelector("#sse").textContent = sample;
  }, sample);
  const badge = page.locator("#sse .cubelab-link");
  await expect(badge).toHaveCount(1);
  await expect(badge).toContainText("5×5 SSE moves");
  const params = new URLSearchParams(
    new URL(await badge.getAttribute("href")).hash.slice(1),
  );
  expect(params.get("size")).toBe("5");
  expect(params.get("dialect")).toBe("Sse");
  expect(params.get("moves")).toBe(sample);
  expect(
    await page.locator("#sse").evaluate((p) =>
      [...p.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join(""),
    ),
  ).toBe(sample);
  const options = await openUI(context, extensionId, "options");
  for (const [size, input, moves] of [
    [2, "CR U F", "CR U F"],
    [3, "MR U F", "MR U F"],
    [4, "MR U F", "MR U F"],
    [5, sample, params.get("moves")],
  ]) {
    await options.locator("#testSize").selectOption(String(size));
    await options.locator("#notation").fill(input);
    await options.locator("#test").click();
    const link = options.locator("#results a");
    await expect(link).toHaveText(`Open ${size}×${size} SSE moves in CubeLab`);
    const result = new URLSearchParams(
      new URL(await link.getAttribute("href")).hash.slice(1),
    );
    expect(result.get("size") || "3").toBe(String(size));
    expect(result.get("moves")).toBe(moves);
  }
});

async function tabId(worker, page) {
  await page.bringToFront();
  return worker.evaluate(
    async () =>
      (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id,
  );
}
async function openUI(context, extensionId, name, activePage) {
  if (activePage) {
    await activePage.bringToFront();
    const session = await context.browser().newBrowserCDPSession();
    const { targetInfos } = await session.send("Target.getTargets", {
      filter: [{ type: "tab" }, { exclude: true }],
    });
    const targetInfo = targetInfos.find(
      (target) => target.url === activePage.url(),
    );
    if (!targetInfo) throw Error("The active fixture tab was not found.");
    // Exercise the toolbar action so Chrome grants activeTab just as it does
    // for a user click. Opening popup.html alone does not grant that permission.
    await session.send("Extensions.triggerAction", {
      id: extensionId,
      targetId: targetInfo.targetId,
    });
    await session.detach();
  }
  const page = await context.newPage();
  if (activePage) await activePage.bringToFront();
  await page.goto(`chrome-extension://${extensionId}/${name}.html`);
  const control = name === "popup" ? "enabled" : "save";
  await page.waitForFunction(
    (id) =>
      typeof (
        document.getElementById(id).onchange ||
        document.getElementById(id).onclick
      ) === "function",
    control,
  );
  return page;
}

test("installed extension respects real inline visibility and dynamic content", async ({
  page,
  site,
  worker,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(site);
  await expect(page.locator(".cubelab-link")).toHaveCount(4);
  await expect(
    page.locator(
      "#hidden a, #boundary a, [contenteditable] a, #button a, a[data-move] a",
    ),
  ).toHaveCount(0);
  await page.locator("#hidden span").evaluate((element) => {
    element.className = "";
  });
  await expect(page.locator("#hidden a")).toBeVisible();
  await page.locator("#dynamic").evaluate((element) => {
    element.innerHTML = "<p>F R U</p>";
  });
  await expect(page.locator("#dynamic a")).toBeVisible();
  await page.locator("#inline").evaluate((element) => {
    element.setAttribute("contenteditable", "true");
  });
  await expect(page.locator("#inline a")).toHaveCount(0);
  const id = await tabId(worker, page);
  const status = await worker.evaluate(
    (id) => chrome.tabs.sendMessage(id, { type: "status" }),
    id,
  );
  expect(status.count).toBe(5);
  expect(errors).toEqual([]);
});

test("rescanning preserves actual DOM nodes and badge clicks carry complete moves", async ({
  page,
  site,
  worker,
  context,
}) => {
  await page.goto(site);
  await expect(page.locator(".cubelab-link")).toHaveCount(4);
  await page.evaluate(() => {
    window.originalNodes = [...document.querySelector("#ordinary").childNodes];
    window.groupBadge = document.querySelector("#group a");
  });
  const id = await tabId(worker, page);
  await worker.evaluate(async (id) => {
    for (let i = 0; i < 20; i++)
      await chrome.tabs.sendMessage(id, { type: "scan" });
  }, id);
  expect(
    await page.evaluate(
      () =>
        [...document.querySelector("#ordinary").childNodes].every(
          (node, i) => node === window.originalNodes[i],
        ) &&
        document.querySelector("#ordinary").childNodes.length ===
          window.originalNodes.length &&
        document.querySelector("#group a") === window.groupBadge,
    ),
  ).toBe(true);
  // Verify navigation without depending on the live CubeLab deployment.
  await context.route("https://wstein.github.io/cubelab/**", (route) =>
    route.fulfill({ body: "Destination intercepted by the extension test." }),
  );
  const opened = context.waitForEvent("page");
  await page.locator("#group a").click();
  const destination = await opened;
  await destination.waitForURL("https://wstein.github.io/cubelab/workbench#**");
  expect(
    new URLSearchParams(new URL(destination.url()).hash.slice(1)).get("moves"),
  ).toBe("(RU RF)2");
  expect(await destination.evaluate(() => window.opener)).toBeNull();
});

test("popup and stale options preserve settings through the real worker", async ({
  page,
  site,
  context,
  extensionId,
  worker,
}) => {
  await page.goto(site);
  await expect(page.locator(".cubelab-link")).toHaveCount(4);
  const options = await openUI(context, extensionId, "options");
  const popup = await openUI(context, extensionId, "popup", page);
  await expect(popup.locator("#status")).toContainText("127.0.0.1");
  await popup.locator("#site").uncheck();
  await expect(page.locator(".cubelab-link")).toHaveCount(0);
  await options.locator("#minMoves").selectOption("4");
  await options.locator("#save").click();
  await expect(options.locator("#status")).toHaveText("Settings saved.");
  let settings = await worker.evaluate(
    async () => (await chrome.storage.local.get("settings")).settings,
  );
  expect(settings.disabledHosts).toEqual(["127.0.0.1"]);
  expect(settings.minMoves).toBe(4);
  await popup.locator("#size").selectOption("5");
  await expect
    .poll(
      async () =>
        (
          await worker.evaluate(
            async () => (await chrome.storage.local.get("settings")).settings,
          )
        ).sitePreferences["127.0.0.1"].size,
    )
    .toBe(5);
  settings = await worker.evaluate(
    async () => (await chrome.storage.local.get("settings")).settings,
  );
  expect(settings.minMoves).toBe(4);
  await popup.locator("#site").check();
  await expect(page.locator(".cubelab-link")).toHaveCount(2);
  await expect(page.locator("#ordinary a")).toHaveAttribute("href", /size=5/);
  await options.locator("#reset").click();
  await expect(options.locator("#status")).toHaveText("Defaults restored.");
  await expect(page.locator(".cubelab-link")).toHaveCount(4);
});

test("widgets preserve setup and sizes; the selection menu is registered", async ({
  page,
  site,
  worker,
}) => {
  await page.goto(site);
  await page.locator("#dynamic").evaluate((element) => {
    element.innerHTML =
      '<twisty-player puzzle="4x4x4" alg="Rw U Rw′" experimental-setup-alg="R U"></twisty-player><div data-puzzle="5x5" data-alg="3Rw U 3Rw′">5x5 card</div>';
  });
  await expect(page.locator("#dynamic .cubelab-link")).toHaveCount(2);
  const urls = await page
    .locator("#dynamic .cubelab-link")
    .evaluateAll((links) => links.map((link) => link.href));
  const params = urls.map(
    (url) => new URLSearchParams(new URL(url).hash.slice(1)),
  );
  expect(params[0].get("size")).toBe("4");
  expect(params[0].get("alg")).toBe("R U");
  expect(params[1].get("size")).toBe("5");
  expect(
    await worker.evaluate(
      () =>
        new Promise((resolve) => {
          chrome.contextMenus.update(
            "cubelab-selection",
            { enabled: true },
            () => resolve(chrome.runtime.lastError?.message || "registered"),
          );
        }),
    ),
  ).toBe("registered");
});

test("viewport changes and manual rescans refresh CSS visibility", async ({
  page,
  site,
  worker,
}) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto(site);
  await expect(page.locator(".cubelab-link")).toHaveCount(4);
  await page.evaluate(() => {
    document
      .querySelector("style")
      .append("@media(max-width:600px) { #ordinary { display:none } }");
  });
  await page.setViewportSize({ width: 500, height: 800 });
  await expect(page.locator("#ordinary a")).toHaveCount(0);
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(page.locator("#ordinary a")).toBeVisible();
  await page.evaluate(() => {
    document.styleSheets[0].insertRule("#inline { visibility:hidden }");
  });
  const id = await tabId(worker, page);
  await worker.evaluate(
    (id) => chrome.tabs.sendMessage(id, { type: "scan" }),
    id,
  );
  await expect(page.locator("#inline a")).toHaveCount(0);
});

test("supported website style: CubingCheatSheet detects moves in anchors without nesting", async ({
  page,
  context,
}) => {
  const style = websiteStyles.cubingCheatSheet;
  await context.route(style.url, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: style.html,
    }),
  );
  await page.goto(style.url);
  await expect(page.locator(".cubelab-link")).toHaveCount(style.expectedLinks);
  await expect(page.locator("a a.cubelab-link")).toHaveCount(0);
  const links = page.locator(".cubelab-link");
  const firstHref = await links.first().getAttribute("href");
  const params = new URLSearchParams(new URL(firstHref).hash.slice(1));
  expect(params.get("size")).toBe(String(style.expectedSize));
  expect(params.get("moves")).toContain("2-4Fw'");
});

test("supported website style: OnlineCube detects spaceless moves and handles button host", async ({
  page,
  context,
}) => {
  const style = websiteStyles.onlineCube;
  await context.route(style.url, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: style.html,
    }),
  );
  await page.goto(style.url);
  await expect(page.locator(".cubelab-link")).toHaveCount(style.expectedLinks);
  await expect(page.locator("a[data-move] a.cubelab-link")).toHaveCount(0);
  const urls = await page
    .locator(".cubelab-link")
    .evaluateAll((links) => links.map((link) => link.href));
  const moves = urls.map((url) =>
    new URLSearchParams(new URL(url).hash.slice(1)).get("moves"),
  );
  expect(moves).toEqual(style.expectedMoves);
});
