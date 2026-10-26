const { test, expect } = require("./fixtures.cjs");

// A page shaped like CubeAssembler's 3D view: marker in <head>, the visible
// Moves line, then the moves block directly after it.
const marker =
  '<meta name="cubelab-fingerprint" content="spec=1;app=cube-assembler@0.1.0">';
const block = (value) =>
  `<script type="application/json" id="cubelab-moves">${
    typeof value === "string"
      ? value
      : JSON.stringify({ format: "layer-prefix/v1", ...value }).replaceAll(
          "<",
          "\\u003c",
        )
  }</script>`;
const page = ({
  head = marker,
  json = { size: 4, moves: "2L' 2R U2" },
  line = "Moves: 2L' 2R U2",
} = {}) =>
  `<!doctype html><html><head><title>Cube</title>${head}</head><body><h1>Cube</h1><div class="cube-3d-move-history" role="status">${line}</div>${json === null ? "" : block(json)}</body></html>`;

async function open(context, tab, name, html) {
  const url = `https://cube-assembler.example/${name}`;
  await context.route(url, (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await tab.goto(url);
}
const moves = (tab) =>
  tab
    .locator(".cubelab-link")
    .evaluateAll((links) =>
      links.map((link) =>
        new URLSearchParams(new URL(link.href).hash.slice(1)).get("moves"),
      ),
    );

test("a valid fingerprint gives one badge, with the block's size, next to the same visible moves", async ({
  context,
  page: tab,
}) => {
  await open(context, tab, "valid", page());
  await expect(tab.locator(".cubelab-link")).toHaveCount(1);
  expect(await moves(tab)).toEqual(["2L' 2R U2"]);
  await expect(tab.locator(".cube-3d-move-history a")).toHaveCount(0);
  await expect(
    tab.locator("#cubelab-moves + a, a + #cubelab-moves"),
  ).toHaveCount(1);
  await expect(tab.locator(".cubelab-link")).toHaveAttribute("href", /size=4/);
  await expect(tab.locator(".cubelab-link")).toHaveAttribute(
    "aria-label",
    "Open 4×4 moves in CubeLab",
  );
  // Still one badge after more scans.
  await tab.waitForTimeout(600);
  await expect(tab.locator(".cubelab-link")).toHaveCount(1);
});

for (const [name, options] of [
  ["invalid JSON", { json: "{not json" }],
  [
    "unknown spec",
    {
      head: '<meta name="cubelab-fingerprint" content="spec=2;app=cube-assembler@9.0.0">',
    },
  ],
  ["no marker", { head: "" }],
  [
    "unsupported format",
    { json: { size: 4, moves: "R U F", format: "layer-prefix/v2" } },
  ],
  ["size out of range", { json: { size: 9, moves: "R U F" } }],
  ["moves outside the grammar", { json: { size: 4, moves: "R U Q" } }],
]) {
  test(`${name}: falls back to scanning the visible Moves line`, async ({
    context,
    page: tab,
  }) => {
    await open(context, tab, name.replaceAll(" ", "-"), page(options));
    await expect(tab.locator(".cubelab-link")).toHaveCount(1);
    await expect(tab.locator(".cube-3d-move-history a")).toHaveCount(1);
    expect(await moves(tab)).toEqual(["2L' 2R U2"]);
  });
}

for (const size of [6, 7]) {
  test(`${size}x${size} gives one badge with inner layers and the stated size`, async ({
    context,
    page: tab,
  }) => {
    await open(
      context,
      tab,
      `size-${size}`,
      page({
        json: { size, moves: "2L' 3Rw U2" },
        line: "Moves: 2L' 3Rw U2",
      }),
    );
    await expect(tab.locator(".cubelab-link")).toHaveCount(1);
    expect(await moves(tab)).toEqual(["2L' 3Rw U2"]);
    expect(
      await tab
        .locator(".cubelab-link")
        .evaluate((link) =>
          new URLSearchParams(new URL(link.href).hash.slice(1)).get("size"),
        ),
    ).toBe(String(size));
  });
}

test("empty histories create no badge and do not scrape the line", async ({
  context,
  page: tab,
}) => {
  await open(
    context,
    tab,
    "empty",
    page({ json: { size: 3, moves: "" }, line: "Moves: None" }),
  );
  await tab.waitForTimeout(600);
  await expect(tab.locator(".cubelab-link")).toHaveCount(0);
});

test("a block updated after load keeps its badge node and follows the data", async ({
  context,
  page: tab,
}) => {
  await open(context, tab, "update", page());
  await expect(tab.locator(".cubelab-link")).toHaveCount(1);
  await tab.evaluate(() => {
    window.badge = document.querySelector(".cubelab-link");
  });
  const write = (value) =>
    tab.evaluate(
      (text) => {
        document.getElementById("cubelab-moves").textContent = text;
        document.querySelector(".cube-3d-move-history").textContent =
          "Moves: changed";
      },
      JSON.stringify({ format: "layer-prefix/v1", ...value }),
    );
  await write({ size: 3, moves: "R U F D" });
  await expect.poll(() => moves(tab)).toEqual(["R U F D"]);
  expect(
    await tab.evaluate(
      () => window.badge === document.querySelector(".cubelab-link"),
    ),
  ).toBe(true);
  await write({ size: 3, moves: "" });
  await expect(tab.locator(".cubelab-link")).toHaveCount(0);
  await write({ size: 5, moves: "3Rw' 2-3Uw2" });
  await expect.poll(() => moves(tab)).toEqual(["3Rw' 2-3Uw2"]);
  await expect(tab.locator(".cubelab-link")).toHaveAttribute("href", /size=5/);
  await tab.evaluate(() => {
    document.querySelector(".cube-3d-move-history").textContent =
      "Moves: U R F";
    document.getElementById("cubelab-moves").textContent = "{";
  });
  // The block is now invalid, so the visible line is scanned again.
  await expect(tab.locator(".cube-3d-move-history a")).toHaveCount(1);
  await expect.poll(() => moves(tab)).toEqual(["U R F"]);
});
