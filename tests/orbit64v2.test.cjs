const { test } = require("node:test");
const assert = require("node:assert/strict");
const V2 = require("../orbit64v2.js");
const vectors = require("./fixtures/orbit64v2-vectors.cjs");
// State counts as printed in the FORMAT-V2.md "Initial registry" table.
const specStates = [
  "3.674e+06",
  "8.818e+07",
  "4.325e+19",
  "1.038e+21",
  "8.858e+22",
  "2.126e+24",
  "7.401e+45",
  "1.776e+47",
  "7.072e+53",
  "1.697e+55",
  "2.829e+74",
  "6.789e+75",
  "5.289e+93",
  "1.269e+95",
  "1.572e+116",
  "3.772e+117",
  "1.310e+148",
  "3.144e+149",
  "1.950e+160",
  "4.680e+161",
  "3.039e+211",
  "7.295e+212",
  "3.517e+217",
  "8.442e+218",
  "2.335e+289",
  "5.605e+290",
  "1.417e+277",
  "3.401e+278",
  "1.681e+376",
  "4.034e+377",
  "8.298e+349",
  "1.992e+351",
  "4.007e+477",
  "9.616e+478",
  "1.085e+425",
  "2.605e+426",
  "8.947e+587",
  "2.147e+589",
  "2.064e+513",
  "4.953e+514",
  "6.616e+712",
  "1.588e+714",
  "8.764e+603",
  "2.103e+605",
  "4.583e+846",
  "1.100e+848",
  "5.410e+707",
  "1.298e+709",
  "1.051e+995",
  "2.523e+996",
  "7.458e+813",
  "1.790e+815",
  "2.259e+1152",
  "5.422e+1153",
];
const { ALPHABET, REGISTRY, lookup } = V2;
const tokenOf = (value, length) => {
  let text = "";
  for (let v = value; text.length < length; v /= 64n)
    text = ALPHABET[Number(v % 64n)] + text;
  return text;
};
// Entry layout of the initial registry: 2x2x2 has color only, every larger
// cube has color then picture, each canonical then framed.
const expected = (id) => {
  if (id < 2)
    return { n: 2, model: "color", pose: id ? "framed" : "canonical" };
  const k = id < 6 ? id - 2 : (id - 6) % 4;
  return {
    n: id < 6 ? 3 : 4 + Math.floor((id - 6) / 4),
    model: k & 2 ? "picture" : "color",
    pose: k & 1 ? "framed" : "canonical",
  };
};
const sci = (n) => {
  const s = n.toString();
  const digits = BigInt(s.length - 1);
  const mantissa = Number(n / 10n ** (digits - 5n)) / 1e5;
  const rounded = Number(mantissa.toPrecision(4));
  return `${rounded.toFixed(3)}e+${String(digits).padStart(2, "0")}`;
};
test("registry has the 54 entries n = 2..15 in registry order", () => {
  assert.equal(REGISTRY.length, 54);
  REGISTRY.forEach((e, i) => {
    assert.equal(e.id, i);
    assert.deepEqual({ n: e.n, model: e.model, pose: e.pose }, expected(i));
  });
  assert.equal(Object.isFrozen(REGISTRY), true);
  assert.equal(Object.isFrozen(REGISTRY[0]), true);
});
test("state counts match the specification table and the known group orders", () => {
  REGISTRY.forEach((e, i) =>
    assert.equal(sci(e.count), specStates[i], `entry ${i}`),
  );
  assert.equal(REGISTRY[2].count, 43252003274489856000n);
  assert.equal(REGISTRY[4].count, 88580102706155225088000n);
  for (const e of REGISTRY)
    if (e.pose === "framed") {
      const canonical = REGISTRY[e.id - 1];
      assert.equal(e.count, canonical.count * 24n);
    }
});
test("lengths and offsets follow the allocation rule", () => {
  const used = new Map();
  for (const e of REGISTRY) {
    let length = 1;
    while ((used.get(length) ?? 0n) + e.count > 64n ** BigInt(length)) length++;
    assert.equal(e.length, length, `entry ${e.id} length`);
    assert.equal(e.offset, used.get(length) ?? 0n, `entry ${e.id} offset`);
    used.set(length, e.offset + e.count);
  }
  // Spec: the ranges that share a length are entries 10/11, 16/17, 20/21,
  // 24/25, 38/39 and 52/53; the second starts at the first one's count.
  const shared = [
    [10, 11],
    [16, 17],
    [20, 21],
    [24, 25],
    [38, 39],
    [52, 53],
  ];
  for (const [a, b] of shared) {
    assert.equal(REGISTRY[b].offset, REGISTRY[a].count);
    assert.equal(REGISTRY[b].length, REGISTRY[a].length);
  }
  assert.equal(
    REGISTRY.filter((e) => e.offset === 0n).length,
    54 - shared.length,
  );
});
test("every reference vector token selects its entry", () => {
  assert.equal(vectors.length, 195);
  for (const [id, token] of vectors) {
    const e = lookup(token);
    assert.ok(e, `entry ${id} ${token}`);
    assert.equal(e.id, id);
    assert.equal(e.n, expected(id).n);
    assert.equal(e.model, expected(id).model);
    assert.equal(e.pose, expected(id).pose);
    assert.equal(e.length, token.length);
  }
});
test("the zero state of every entry selects it", () => {
  for (const e of REGISTRY) {
    const solved = tokenOf(e.offset, e.length);
    if (e.offset === 0n) assert.equal(solved, "A".repeat(e.length));
    assert.equal(lookup(solved)?.id, e.id);
    assert.equal(lookup(tokenOf(e.offset + e.count - 1n, e.length))?.id, e.id);
  }
});
test("tokens just outside a range or of an unused length are rejected", () => {
  const lengths = new Set(REGISTRY.map((e) => e.length));
  for (const length of lengths) {
    const entries = REGISTRY.filter((e) => e.length === length);
    const end = entries.reduce(
      (m, e) => (e.offset + e.count > m ? e.offset + e.count : m),
      0n,
    );
    assert.equal(end < 64n ** BigInt(length), true);
    assert.equal(
      lookup(tokenOf(end, length)),
      null,
      `past end of length ${length}`,
    );
    assert.equal(lookup(tokenOf(64n ** BigInt(length) - 1n, length)), null);
    // Tokens one character longer or shorter never fall in this length's ranges.
    assert.equal(lookup("A".repeat(length + 1))?.length === length, false);
  }
  for (let length = 1; length <= 700; length++)
    if (!lengths.has(length))
      assert.equal(lookup("A".repeat(length)), null, `length ${length}`);
  // V1 5x5x5 tokens have 43 characters, where the initial registry has none.
  assert.equal(lookup("A".repeat(43)), null);
  assert.equal(lookup("A".repeat(42)).id, 10);
});
test("lookup rejects non-tokens", () => {
  for (const bad of [
    "",
    "AAAA=",
    "AAA+",
    "AA AA",
    "AAAA\n",
    "ÄAAA",
    null,
    undefined,
    4,
    {},
  ])
    assert.equal(lookup(bad), null);
});
