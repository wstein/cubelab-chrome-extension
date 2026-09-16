const { test } = require("node:test");
const assert = require("node:assert/strict");
const D = require("../detector");
const numbered = require("./fixtures/numbered-sse.cjs");

test("Revenge SSE repetitions and original spelling survive URL construction", () => {
  for (const source of [
    "(ML2 D' MR2 D)2",
    "(ML2  D′\n MR2 D)2",
    "[ML2:MR2]",
    "(ML2 D- MR2 D)2",
  ]) {
    const [result] = D.detect(`Algorithm: ${source}`, { size: 4 });
    assert.equal(result.notation, source);
    const params = new URLSearchParams(
      new URL(D.makeURL(result)).hash.slice(1),
    );
    assert.equal(params.get("moves"), source.replace(/\s+/g, " "));
    assert.equal(params.get("dialect"), "Sse");
    assert.equal(params.get("size"), "4");
  }
});

test("numbered SSE wings and centres remain one complete size-aware state", () => {
  for (const options of [{}, { size: 5 }]) {
    for (const text of [numbered, `Permutation: ${numbered}. Done.`]) {
      const found = D.detect(text, options);
      assert.equal(found.length, 1);
      assert.equal(found[0].kind, "permutation");
      assert.equal(found[0].size, 5);
      assert.equal(found[0].notation, numbered);
      assert.equal(text.slice(found[0].start, found[0].end), numbered);
      const url = new URL(D.makeURL(found[0]));
      const params = new URLSearchParams(url.hash.slice(1));
      assert.equal(url.pathname, "/cubelab/");
      assert.equal(params.get("alg"), numbered.replace("\n", " "));
      assert.equal(params.get("size"), "5");
      assert.equal(params.has("moves"), false);
    }
  }
  assert.equal(D.permutation("(r1,++f4)").size, 4);
  assert.equal(D.permutation("(ur3,rf3)").size, 5);
  assert.equal(D.permutation("(+r1)", 4).size, 4);
  assert.equal(D.permutation("(ur1,rf1)", 5).size, 5);
});

test("invalid numbered SSE cycles are rejected without cropped cycle links", () => {
  for (const source of [
    "r1",
    "(r1,)",
    "(r0,f1)",
    "(r9,f1)",
    "(ur4,rf4)",
    "(ur1,r1)",
    "(uu1,rf1)",
    "(ud1,rf1)",
    "(ur1,+rf1)",
    "(r1,r1)",
    "(ur1,ru2)",
    "(r1,f1) (r1,b1)",
    "(urf1,ubr1)",
    "(r1,+++f1)",
    "(R1,F1)",
  ]) {
    assert.equal(D.permutation(source, 4), null, source);
  }
  for (const size of [2, 3, 4, 6])
    assert.equal(D.classify(numbered, { size }), null);
  assert.equal(D.permutation("(ur,uf)", 4), null);
  for (const source of ["(r1,r9)", "(r1,++f1)2", "(r1,++f1)'"])
    assert.deepEqual(D.detect(`State: ${source}.`, { size: 4 }), []);
});
const parse = (text, size) => D.parseSse(text, size)?.moves.join(" ");
const sample =
  "D2 F2 L' SF2 L D' WR' D' F2 D↗ WR D' T3B TU T3B TL2 TF' TD' TL MD2 TB TU2 TL2 TF MR2 TU TF'";

// Expected equivalents derive from the layer diagrams in Randelshofer's SSE
// 2x2, 3x3, 4x4 and 5x5 references, not from the translation implementation.
const examples = {
  2: { R: "R", T1R: "R", N1R: "R", N2R: "L'", "N1-2R": "x", CR: "x" },
  3: {
    TR: "2Rw",
    T2R: "2Rw",
    MR: "2R",
    N2R: "2R",
    "N2-3R": "2Lw'",
    SR: "R L'",
    S1R: "R L'",
    CR: "x",
  },
  4: {
    T3R: "3Rw",
    MR: "2R",
    M2R: "2-3Rw",
    WR: "2-3Rw",
    "S2-2R": "R 2Lw'",
    "S3-3R": "2Rw L'",
    CR: "x",
  },
  5: {
    T4R: "4Rw",
    NR: "2R",
    N4R: "4R",
    N5R: "L'",
    "N2-3R": "2-3Rw",
    "N4-5R": "2Lw'",
    VR: "2-3Rw",
    V1R: "2R",
    V3R: "2-4Rw",
    MR: "3R",
    M2R: "2-3Rw",
    M3R: "2-4Rw",
    WR: "2-4Rw",
    SR: "R L'",
    S2R: "2Rw 2Lw'",
    "S2-3R": "R 2Lw'",
    "S2-2R": "R 3Lw'",
    "S3-4R": "2Rw L'",
    "S4-4R": "3Rw L'",
    CR: "x",
  },
};
for (const [size, cases] of Object.entries(examples)) {
  test(`SSE ${size}x${size} translates the documented layer diagrams`, () => {
    for (const [source, expected] of Object.entries(cases)) {
      assert.equal(parse(source, Number(size)), expected, source);
      const modern = D.classify(expected, { size: Number(size), minMoves: 1 });
      assert.equal(modern.kind, "moves", source);
      assert.equal(modern.size, Number(size));
    }
  });
}

test("SSE face-relative directions and suffixes hold on all six faces", () => {
  const opposite = { R: "L", U: "D", F: "B", L: "R", D: "U", B: "F" };
  const rotations = { R: "x", U: "y", F: "z", L: "x'", D: "y'", B: "z'" };
  const invert = (move) =>
    move.endsWith("2")
      ? move
      : move.endsWith("'")
        ? move.slice(0, -1)
        : move + "'";
  for (const face of Object.keys(opposite)) {
    for (const size of [2, 3, 4, 5]) {
      assert.equal(parse(`C${face}`, size), rotations[face]);
      assert.equal(parse(`C${face}'`, size), invert(rotations[face]));
      assert.equal(parse(`C${face}2`, size), rotations[face][0] + "2");
    }
    for (const suffix of [
      "",
      "'",
      "-",
      "3",
      "2",
      "2'",
      "2-",
      "'2",
      "-2",
      "′",
    ]) {
      const turns = suffix.includes("2") ? "2" : suffix ? "'" : "";
      assert.equal(parse(`M${face}${suffix}`, 4), `2${face}${turns}`);
      assert.equal(parse(`M${face}${suffix}`, 5), `3${face}${turns}`);
      assert.equal(
        parse(`S${face}${suffix}`, 5),
        `${face}${turns} ${invert(opposite[face] + turns)}`,
      );
    }
  }
});

test("SSE groups, inverse repeats, commutators and conjugates expand together", () => {
  assert.equal(parse("(TR MR)2-", 5), "3R' 2Rw' 3R' 2Rw'");
  assert.equal(parse("[TR,MR]", 5), "2Rw 3R 2Rw' 3R'");
  assert.equal(parse("[TR:MR2]", 4), "2Rw 2R2 2Rw'");
  assert.equal(parse("((WR . T3B)2)'", 5), "3Bw' 2-4Rw' 3Bw' 2-4Rw'");
  assert.equal(parse("CR2·R-U-F-", 2), "x2 R' U' F'");
});

test("reported 5x5 sequence remains one unchanged SSE link", () => {
  for (const text of [
    sample,
    `Algorithm: ${sample}`,
    sample.replace("↗", ""),
  ]) {
    const results = D.detect(text, { size: 5 });
    assert.equal(results.length, 1);
    const [result] = results;
    assert.equal(
      result.notation,
      text.startsWith("Algorithm:") ? sample : text,
    );
    assert.equal(result.source, text.startsWith("Algorithm:") ? sample : text);
    assert.equal(text.slice(result.start, result.end), result.source);
    const params = new URLSearchParams(
      new URL(D.makeURL(result)).hash.slice(1),
    );
    assert.equal(params.get("dialect"), "Sse");
    assert.equal(params.get("size"), "5");
    assert.equal(params.get("moves"), result.notation);
  }
});

test("SSE size defaults and explicit sizes are respected", () => {
  assert.equal(D.classify("CR R U").size, 3);
  assert.equal(D.classify("T3R R U").size, 4);
  assert.equal(D.classify("T4R R U").size, 5);
  assert.equal(D.classify("CR R U", { size: 2 }).size, 2);
  assert.equal(
    D.classify("R- U F", { size: 2, dialect: "Sse" }).notation,
    "R- U F",
  );
  assert.equal(D.classify("TR", { minMoves: 3 }), null);
});

test("out-of-range or malformed SSE is rejected without partial links", () => {
  for (const [size, source] of [
    [2, "MR"],
    [2, "WR"],
    [2, "TR"],
    [2, "SR"],
    [3, "T3R"],
    [3, "M2R"],
    [4, "T4R"],
    [4, "M3R"],
    [4, "V3R"],
    [5, "T5R"],
    [5, "T6R"],
    [5, "N4-3R"],
    [5, "N2-6R"],
    [5, "T2-3R"],
    [5, "C2R"],
    [5, "W2R"],
    [5, "S3R"],
    [5, "S1-5R"],
    [5, "S4-2R"],
    [5, "TR4"],
  ]) {
    assert.equal(parse(source, size), undefined, source);
    assert.deepEqual(D.detect(`R U ${source} F D`, { size }), [], source);
  }
  assert.equal(parse("CR", 6), undefined);
  assert.equal(parse(null, 5), undefined);
  assert.equal(parse("(WR)999", 5), undefined);
  assert.equal(parse("(WR", 5), undefined);
  assert.equal(parse("WR ".repeat(2001), 5), undefined);
});

test("SSE complements may end at either face and inverse layer aliases agree", () => {
  assert.equal(parse("S1-2R", 5), "3Lw'");
  assert.equal(parse("S4-5R", 5), "3Rw");
  assert.equal(parse("N3-5R'", 5), "3Lw");
  assert.equal(parse("N1-5R", 5), "x");
});

test("SSE visual separators stay inside a complete prose-bounded candidate", () => {
  const text = "Algorithm: TR . MR2 · WR. More text.";
  const [result] = D.detect(text, { size: 5 });
  assert.equal(result.source, "TR . MR2 · WR");
  assert.equal(result.notation, "TR . MR2 · WR");
  assert.equal(D.detect("Algorithm: R U F.")[0].source, "R U F");
});

test("unsupported SSE operators do not produce misleading partial links", () => {
  for (const text of [
    "R U WR*",
    "<CR>(RU RF)",
    "(WR R U)*",
    "R U W6R (UR,UF)",
  ]) {
    assert.deepEqual(D.detect(text, { size: 5 }), [], text);
  }
});
test("named cubes and Randelshofer paths supply size without overriding numeric hints", () => {
  for (const [name, directory, size] of [
    ["Pocket Cube", "pocket", 2],
    ["Cube", "patterns", 3],
    ["Revenge Cube", "revenge", 4],
    ["Professor Cube", "professor", 5],
  ]) {
    assert.equal(
      D.inferSize(`https://www.randelshofer.ch/rubik/${directory}/doc/`),
      size,
    );
    if (size !== 3) assert.equal(D.inferSize(name), size);
  }
  assert.equal(D.inferSize("Professor Cube 4x4"), 4);
  assert.equal(D.inferSize("Pocket Cube and Professor Cube"), null);
  assert.equal(D.inferSize("4x4 and 5x5 Professor Cube"), null);
});
