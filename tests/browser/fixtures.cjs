const { test: base, expect, chromium } = require("@playwright/test");
const http = require("node:http");
const path = require("node:path");

const html = `<!doctype html><html><head><title>Cube algorithms</title>
<style>.hidden { display:none } .invisible { visibility:hidden }</style></head>
<body><h1>3x3 algorithms</h1>
<p id="ordinary">R U R′ U′</p>
<p id="group">Algorithm: (RU RF)2.</p>
<p id="inline"><b>R</b> U <i>F</i></p>
<p id="hidden"><span class="hidden">R U F</span></p>
<p id="boundary">R <span class="invisible">U</span> F</p>
<p id="contents"><span style="display:contents">R U F</span></p>
<p contenteditable>R U F</p>
<button id="button">R U F</button>
<a data-move="F">R U F</a>
<div id="dynamic"></div>
</body></html>`;

const test = base.extend({
  context: async ({}, use) => {
    const extension = path.resolve(__dirname, "../..");
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: true,
      args: [
        "--enable-unsafe-extension-debugging",
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });
    try {
      await use(context);
    } finally {
      await context.close();
    }
  },
  worker: async ({ context }, use) => {
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker"));
    await use(worker);
  },
  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).hostname);
  },
  site: async ({}, use) => {
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    try {
      await use(`http://127.0.0.1:${server.address().port}`);
    } finally {
      // Chromium keeps connections alive; close() alone waits for them.
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  },
});

module.exports = { test, expect };
