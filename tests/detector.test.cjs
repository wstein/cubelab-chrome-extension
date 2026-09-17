const { test } = require("node:test");
const assert = require("node:assert/strict");
const D = require("../detector.js");
const detect = (s) => D.detect(s, { cubeContext: true });
const alg = "R U' F2";
test("outgoing whitespace cleanup preserves every notation character", () => {
  const source = " \t(ML2\r\n D′\u00a0\u2003MR2   D)2  [R,U]\tF₂' ++r7 ↗ \n";
  const expected = "(ML2 D′ MR2 D)2 [R,U] F₂' ++r7 ↗";
  assert.equal(D.cleanWhitespace(source), expected);
  assert.equal(D.cleanWhitespace(expected), expected);
  assert.equal(D.cleanWhitespace(" \n\t"), "");
  const params = new URLSearchParams(
    new URL(
      D.makeURL({
        kind: "moves",
        source,
        notation: "must not be used",
        setup: "\n (TR  U)2\t",
        size: 4,
        dialect: "Sse",
      }),
    ).hash.slice(1),
  );
  assert.equal(params.get("moves"), expected);
  assert.equal(params.get("alg"), "(TR U)2");
  assert.equal(params.get("dialect"), "Sse");
});
test("all destination templates receive original notation rather than parsed equivalents", () => {
  const net = "UU\nUU\nLL FF RR BB\nLL FF RR BB\nDD\nDD";
  for (const source of [
    "(R U′)3",
    "[R,U]",
    "3r  U 2-3r′",
    "F₂′ U F₂",
    "R-U-Ri-Ui",
    "(ML2 D' MR2 D)2",
    "(ur,rf,fu)",
    net,
  ]) {
    const options = source === net ? { size: 2 } : { size: 5 };
    if (source === "(ur,rf,fu)") options.size = 3;
    for (const result of [
      D.classify(source, options),
      ...D.detect(source, { ...options, cubeContext: true }),
    ]) {
      assert.ok(result, source);
      const url = new URL(D.makeURL(result));
      const params = new URLSearchParams(url.hash.slice(1));
      assert.equal(
        params.get(result.kind === "moves" ? "moves" : "alg"),
        source.replace(/\s+/g, " ").trim(),
      );
      const custom = new URL(
        D.makeURL(result, {
          movesTemplate: "https://example.com/?input={notation}",
          algTemplate: "https://example.com/?input={notation}",
        }),
      );
      assert.equal(
        custom.searchParams.get("input"),
        source.replace(/\s+/g, " ").trim(),
      );
    }
  }
});
test("provided moves URL round trips", () => {
  const [r] = detect(alg);
  assert.equal(r.notation, alg);
  const url = D.makeURL(r);
  assert.equal(
    url,
    "https://wstein.github.io/cubelab/workbench#moves=R+U%27+F2",
  );
  assert.equal(
    new URLSearchParams(new URL(url).hash.slice(1)).get("moves"),
    alg,
  );
});
test("provided state URL round trips", () => {
  const s = "FFFUUUBDDLFDLRRBRRDFFDFFLLLUUUDDBDDBUBRLLRLLFRRRUBBUBB";
  const [r] = detect(s);
  assert.equal(r.kind, "state");
  assert.equal(r.size, 3);
  assert.equal(
    new URLSearchParams(new URL(D.makeURL(r)).hash.slice(1)).get("alg"),
    s,
  );
});
test("all four cube sizes, including spaced facelets", () => {
  for (const size of [2, 3, 4, 5]) {
    const s = [..."URFDLB"].map((f) => f.repeat(size * size)).join("\n");
    const [r] = detect(s);
    assert.equal(r.size, size);
    assert.equal(r.kind, "state");
  }
});
test("bad facelet counts rejected", () =>
  assert.equal(D.classify("U".repeat(54)), null));
test("permutation cycles and oriented centers stay together", () => {
  const s =
    "(dlf,urf) (ufl,dfr) (dbl,ubr) (ulb,drb)\n(ur,dr) (rf,rb) (bu,fd) (bd,fu) (ul,dl) (lb,lf)\n(++r) (++u) (++f) (++l) (++d) (++b)";
  const result = detect(s);
  assert.equal(result.length, 1);
  assert.equal(result[0].notation, s);
  assert.equal(result[0].kind, "permutation");
  assert.equal(
    new URLSearchParams(new URL(D.makeURL(result[0])).hash.slice(1)).get("alg"),
    s.replace(/\s+/g, " "),
  );
});
test("reject impossible cubie labels and prose parentheses", () => {
  for (const s of ["(foo,bar)", "(ud,rl)", "(rr,ff)", "(Rubik cube)"])
    assert.equal(D.permutation(s), null);
});
test("Randelshofer grouping dots and metrics", () => {
  const [r] = detect(
    "U2 · F2 B2 · U2 F2 · R2 L2 · F2 (8 ltm, 8* ftm, 16* qtm)",
  );
  assert.equal(r.notation, "U2 F2 B2 U2 F2 R2 L2 F2");
  assert.equal(r.source, "U2 · F2 B2 · U2 F2 · R2 L2 · F2");
  const [r2] = detect("U2 · F2 B2 · U2 F2 · R2 L2 · F2 (12)");
  assert.equal(r2.notation, "U2 F2 B2 U2 F2 R2 L2 F2");
  assert.equal(r2.source, "U2 · F2 B2 · U2 F2 · R2 L2 · F2");
});
test("SSE move syntax is preserved for the native destination dialect", () => {
  const [r] = detect("CD2 · MF2 U2 F2 MR2 B2 U2");
  assert.equal(r.kind, "moves");
  assert.equal(r.format, "SSE");
  assert.equal(r.notation, "CD2 · MF2 U2 F2 MR2 B2 U2");
  assert.ok(D.makeURL(r).includes("/workbench#moves="));
  assert.ok(D.makeURL(r).includes("dialect=Sse"));
});
test("wide, slice, rotation, inner-layer and 5x5 notation", () => {
  for (const s of [
    "Rw U2 Rw'",
    "r U r'",
    "M2 U M2",
    "x R U",
    "3Rw U 3Rw'",
    "2R U 2R'",
  ])
    assert.equal(detect(s)[0].kind, "moves");
  assert.equal(D.classify("3Rw U 3Rw'").minSize, 4);
  assert.equal(D.detect("3Rw U 3Rw'", { size: 3 })[0].notation, "x U x'");
  assert.equal(D.classify("6Rw U R"), null);
});
test("unicode and compact algorithms", () => {
  assert.equal(detect("R U′ R’ U²")[0].notation, "R U' R' U2");
  assert.equal(detect("RUR'U'")[0].notation, "R U R' U'");
});
test("commutators, conjugates and inverse repeat expansion", () => {
  assert.equal(D.classify("[R,U]").notation, "R U R' U'");
  assert.equal(D.classify("[R: U F]").notation, "R U F R'");
  assert.equal(D.classify("(R U)2'").notation, "U' R' U' R'");
  assert.equal(D.classify("[R: [U,F]]").notation, "R U F U' F' R'");
});
test("bounded parser rejects broken or excessive syntax", () => {
  for (const s of [
    "(R U",
    "[R U]",
    "[R,]",
    "R Q U",
    "(R U)0",
    "(R U)999",
    "(".repeat(14) + "R" + ")".repeat(14),
    "((R U)100)100",
  ])
    assert.equal(D.parseMoves(s), null, s);
});
test("prose and short acronyms are not linked", () => {
  for (const s of [
    "This is a RUB report.",
    "FRIEND",
    "The URL is here.",
    "R",
    "F2",
    "fur",
    "This is ordinary prose.",
  ])
    assert.equal(D.detect(s).length, 0, s);
});
test("multiple algorithms and exact offsets", () => {
  const s = "First: R U R' U' / second: F R F'";
  const results = detect(s);
  assert.equal(results.length, 2);
  for (const r of results) assert.equal(s.slice(r.start, r.end), r.source);
});
test("size hints use the verified CubeLab parameter", () => {
  assert.equal(D.inferSize("4 × 4 × 4 parity"), 4);
  assert.equal(D.inferSize("2x2 and 3x3"), null);
  assert.equal(D.inferSize("Order 2"), null);
  const r = D.classify("Rw U Rw'", { size: 4 });
  assert.equal(r.size, 4);
  assert.ok(D.makeURL(r).includes("size=4"));
});
test("URL safety and escaping", () => {
  assert.throws(() =>
    D.makeURL(
      { kind: "moves", notation: alg },
      { movesTemplate: "javascript:{notation}" },
    ),
  );
  const result = { kind: "unknown", notation: "R &x=evil#<img>" };
  const u = new URL(D.makeURL(result));
  assert.equal(
    new URLSearchParams(u.hash.slice(1)).get("alg"),
    result.notation,
  );
});
test("inverse i and dash-separated moves used in tutorials", () => {
  assert.equal(detect("R U Ri Ui")[0].notation, "R U R' U'");
  assert.equal(detect("R-U-R'-U'")[0].notation, "R U R' U'");
});
test("2x2 rotations do not require a third layer", () => {
  assert.equal(D.detect("x R U", { size: 2 })[0].size, 2);
});
test("layer ranges and Unicode subscripts become valid target moves", () => {
  assert.equal(detect("2-3Rw U 2-3Rw'")[0].notation, "2-3Rw U 2-3Rw'");
  assert.equal(detect("F₂' U F₂")[0].notation, "2Fw' U 2Fw");
  assert.equal(D.parseMoves("3-2Rw U R"), null);
});
test("uppercase Singmaster and whitespace ACube cycles", () => {
  for (const s of ["(URF,UBR) (UFL,ULB)", "(URF+) (UFL-)", "(UL UR) (UFR URB)"])
    assert.equal(detect(s)[0].kind, "permutation");
});
test("ACube positional state is not mistaken for an algorithm", () => {
  const s =
    "UF UL UB UR DF DR DB DL FR FL BR BL URB UFR UBL ULF DRF DFL DLB DBR";
  const [r] = detect(s);
  assert.equal(r.kind, "state");
  assert.equal(r.dialect, "Acube");
  assert.equal(r.notation, s);
});
test("colour facelets use scheme and known cube size", () => {
  const [r] = detect([..."WOGRBY"].map((c) => c.repeat(16)).join(""));
  const url = D.makeURL(r, { ...D.DEFAULTS, scheme: "Japanese" });
  assert.equal(r.size, 4);
  assert.ok(url.includes("scheme=Japanese"));
  assert.ok(url.includes("size=4"));
});
test("net reordering preserves spatial semantics", () => {
  for (const n of [2, 3, 4, 5]) {
    const net = [
      ...Array(n).fill("U".repeat(n)),
      ...Array(n).fill(["L", "F", "R", "B"].map((c) => c.repeat(n)).join(" ")),
      ...Array(n).fill("D".repeat(n)),
    ].join("\n");
    const [r] = detect(net);
    assert.equal(
      r.notation,
      [..."URFDLB"].map((c) => c.repeat(n * n)).join(""),
    );
    assert.equal(r.format, "facelets net");
  }
});
test("legacy lowercase remains an explicit per-site choice", () => {
  const modern = D.classify("r U r'", { size: 4 });
  const legacy = D.classify("r U r'", { size: 4, lowercaseMode: "InnerSlice" });
  assert.ok(!D.makeURL(modern).includes("lowercase="));
  assert.ok(D.makeURL(legacy).includes("lowercase=InnerSlice"));
});
test("slice turns rejected on even cubes", () => {
  assert.equal(D.detect("M U M'", { size: 4 }).length, 0);
  assert.equal(D.detect("M U M'", { size: 5 }).length, 1);
});
test("coordinate state lengths and ranges", () => {
  const two = "cp: 0 1 2 3 4 5 6 7; co: 0 0 0 0 0 0 0 0";
  assert.equal(detect(two)[0].size, 2);
  assert.equal(
    detect(
      two + "; ep: 0 1 2 3 4 5 6 7 8 9 10 11; eo: 0 0 0 0 0 0 0 0 0 0 0 0",
    )[0].size,
    3,
  );
  assert.equal(D.coordinates(two.replace("0 1", "0 0")), null);
});
test("Orbit64 requires an explicit label for automatic detection", () => {
  assert.equal(detect("Orbit64: AAAAA")[0].size, 2);
  assert.equal(detect("AAAAA").length, 0);
});

test("compact repeated groups retain their full expression and offsets", () => {
  for (const expression of [
    "(RU RF)2",
    "(RU RF)2'",
    "[R: (RU RF)2]",
    "((RU RF)2)2",
  ]) {
    for (const text of [expression, `Algorithm: ${expression}.`]) {
      const results = detect(text);
      assert.equal(results.length, 1, text);
      const [result] = results;
      assert.equal(result.kind, "moves", text);
      assert.equal(result.notation, D.parseMoves(expression).moves.join(" "));
      assert.equal(result.source, expression);
      assert.equal(text.slice(result.start, result.end), expression);
      assert.equal(
        new URLSearchParams(new URL(D.makeURL(result)).hash.slice(1)).get(
          "moves",
        ),
        expression,
      );
    }
  }
});

test("invalid repeated groups are not truncated to permutation cycles", () => {
  for (const expression of [
    "(RU RF)0",
    "(RU RF)999",
    "((RU RF)100)100",
    "((RU RF))0",
  ]) {
    assert.deepEqual(detect(expression), [], expression);
    assert.deepEqual(detect(`Algorithm: ${expression}.`), [], expression);
  }
});

test("unsuffixed cycles retain precedence and orientation metadata in prose", () => {
  for (const expression of [
    "(RU RF)",
    "(URF,UBR) (UFL,ULB)",
    "(ur,dr) (rf,rb) (++r) (++u)",
  ]) {
    const results = detect(`Permutation: ${expression}.`);
    assert.equal(results.length, 1);
    assert.equal(results[0].kind, "permutation");
    assert.equal(results[0].source, expression);
  }
});

test("input and expansion limits reject excess without rejecting the boundary", () => {
  assert.equal(D.parseMoves("R ".repeat(2000)).moves.length, 2000);
  assert.equal(D.parseMoves("R ".repeat(2001)), null);
  assert.equal(D.parseMoves(" ".repeat(8001)), null);
  assert.equal(D.parseMoves(""), null);
  assert.equal(D.classify(" ".repeat(8001)), null);
  assert.deepEqual(D.detect(" ".repeat(32001)), []);
  assert.deepEqual(D.detect(null), []);
  assert.deepEqual(D.detect("R U F", { size: 6 }), []);
  assert.deepEqual(D.detect("(ur,dr)", { size: 4 }), []);
  assert.equal(D.classify("CD2 U F", { size: 6 }), null);
  assert.equal(D.inferSize("ordinary page"), null);
});

test("custom HTTPS destinations escape notation and receive no CubeLab parameters", () => {
  const settings = {
    ...D.DEFAULTS,
    scheme: "Japanese",
    movesTemplate: "https://example.com/view?moves={notation}&size={size}",
  };
  const url = new URL(
    D.makeURL(
      {
        kind: "moves",
        notation: "R &x=1#",
        size: 4,
        setup: "F U",
        dialect: "Sse",
        lowercaseMode: "InnerSlice",
      },
      settings,
    ),
  );
  assert.equal(url.searchParams.get("moves"), "R &x=1#");
  assert.equal(url.searchParams.get("size"), "4");
  assert.equal(url.hash, "");
  assert.equal(
    D.makeURL(
      { kind: "moves", notation: "R U F", size: 4 },
      {
        ...D.DEFAULTS,
        movesTemplate: "https://wstein.github.io/other/#moves={notation}",
      },
    ),
    "https://wstein.github.io/other/#moves=R+U+F",
  );
});
test("WCA face, outer-block and rotation notation works across 2x2 through 5x5", () => {
  for (const size of [2, 3, 4, 5]) {
    const tokens = [];
    for (const suffix of ["", "'", "2"]) {
      for (const face of "URFDLB") {
        tokens.push(face + suffix);
        for (let width = 2; width < size; width++) {
          tokens.push(`${width}${face}w${suffix}`);
          if (width === 2) tokens.push(`${face}w${suffix}`);
        }
      }
      for (const axis of "xyz") tokens.push(axis + suffix);
    }
    const notation = tokens.join(" ");
    const results = D.detect(notation, { size, cubeContext: true });
    assert.equal(results.length, 1);
    assert.equal(results[0].notation, notation);
    assert.equal(results[0].size, size);
    assert.notEqual(results[0].format, "SSE");
    const params = new URLSearchParams(
      new URL(D.makeURL(results[0])).hash.slice(1),
    );
    assert.equal(params.get("moves"), notation);
    assert.equal(Number(params.get("size") || 3), size);
  }
});
test("SiGN numbered layers and blocks translate across all supported sizes", () => {
  for (const size of [2, 3, 4, 5]) {
    for (const [face, opposite, axis, inverse] of [
      ["R", "L", "x", false],
      ["L", "R", "x", true],
      ["U", "D", "y", false],
      ["D", "U", "y", true],
      ["F", "B", "z", false],
      ["B", "F", "z", true],
    ]) {
      for (const suffix of ["", "'", "2", "2'"]) {
        const end = suffix.includes("2") ? "2" : suffix;
        const reversed = end === "2" ? "2" : end ? "" : "'";
        for (const [input, expected] of [
          [`${size}${face}${suffix}`, opposite + reversed],
          [
            `${size}${face.toLowerCase()}${suffix}`,
            axis + (inverse ? reversed : end),
          ],
          [`${size}${face}w${suffix}`, axis + (inverse ? reversed : end)],
          ...(size > 2
            ? [
                [
                  `2-${size}${face.toLowerCase()}${suffix}`,
                  `${size - 1}${opposite}w${reversed}`,
                ],
              ]
            : [
                [
                  `${face.toLowerCase()}${suffix}`,
                  axis + (inverse ? reversed : end),
                ],
              ]),
        ]) {
          const result = D.classify(input, { size, minMoves: 1 });
          assert.equal(result?.notation, expected, input);
        }
      }
    }
  }
  assert.equal(D.classify("3r U 2-3r'", { size: 5 }).notation, "3Rw U 2-3Rw'");
  assert.equal(
    D.detect("Algorithm: 3r U 2-3r'.", { size: 5 })[0].notation,
    "3Rw U 2-3Rw'",
  );
  assert.equal(D.classify("[3r,2R]", { size: 4 }).notation, "3Rw 2R 3Rw' 2R'");
  for (const source of ["4-2r U F", "5r U F", "5R U F"])
    assert.equal(D.classify(source, { size: 4 }), null);
  assert.ok(D.parseMoves(Array(2000).fill("2R").join(" "), 2));
  assert.equal(D.parseMoves(Array(2001).fill("2R").join(" "), 2), null);
});
