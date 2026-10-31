const { test } = require("node:test");
const assert = require("node:assert/strict");
const V2 = require("../orbit64v2.js");
const vectors = require("./fixtures/orbit64v2-vectors.cjs");
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
const fact = (k) => (k <= 1n ? 1n : k * fact(k - 1n));
// State count as the product of the radixes in the FORMAT-V2.md "Digit layout".
const radixProduct = ({ n, model, pose }) => {
  const odd = n % 2 === 1;
  const picture = model === "picture";
  const framed = pose === "framed";
  const evenCanonical = !odd && !framed;
  const centers = BigInt(Math.floor(((n - 2) * (n - 2)) / 4));
  const wings = BigInt(Math.floor((n - 2) / 2));
  let count =
    (evenCanonical ? fact(7n) : fact(8n)) *
    (evenCanonical ? 3n ** 6n : 3n ** 7n);
  if (odd) count *= (fact(12n) / 2n) * 2n ** 11n;
  count *= fact(24n) ** wings;
  count *= (picture ? fact(24n) / 2n : fact(24n) / fact(4n) ** 6n) ** centers;
  if (picture && odd) count *= 2n ** 11n;
  if (framed && odd) count *= 24n;
  return count;
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
test("state counts equal the radix product of the digit layout", () => {
  for (const e of REGISTRY)
    assert.equal(e.count, radixProduct(e), `entry ${e.id}`);
  assert.equal(REGISTRY[2].count, 43252003274489856000n);
  assert.equal(REGISTRY[4].count, 88580102706155225088000n);
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
test("tokens just outside a range are rejected or belong to the neighbor", () => {
  const lengths = new Set(REGISTRY.map((e) => e.length));
  const holder = (value, length) =>
    REGISTRY.filter(
      (e) =>
        e.length === length && e.offset <= value && value < e.offset + e.count,
    )[0]?.id ?? null;
  for (const e of REGISTRY) {
    for (const [value, length] of [
      [e.offset - 1n, e.length],
      [e.offset + e.count, e.length],
      [e.offset, e.length - 1],
      [e.offset, e.length + 1],
    ]) {
      if (value < 0n || length < 1) continue;
      const found = lookup(tokenOf(value, length));
      assert.equal(
        found?.id ?? null,
        holder(value, length),
        `entry ${e.id} ${value}`,
      );
    }
  }
  // Directly past the end of the last range of a length nothing is allocated.
  for (const length of lengths) {
    const end = REGISTRY.filter((e) => e.length === length).reduce(
      (m, e) => (e.offset + e.count > m ? e.offset + e.count : m),
      0n,
    );
    assert.equal(
      lookup(tokenOf(end, length)),
      null,
      `past end of length ${length}`,
    );
    assert.equal(lookup(tokenOf(end - 1n, length)) !== null, true);
  }
  assert.equal(lookup(tokenOf(3674160n, 4)), null);
  assert.equal(lookup(tokenOf(3674159n, 4)).id, 0);
  for (let length = 1; length <= 700; length++)
    if (!lengths.has(length))
      assert.equal(lookup("A".repeat(length)), null, `length ${length}`);
  // V1 5x5x5 tokens have 43 characters, where the initial registry has none.
  assert.equal(lookup("A".repeat(43)), null);
  assert.equal(lookup("A".repeat(42)).id, 10);
});
test("lookup rejects a very long token by length before any numeric work", () => {
  const started = process.hrtime.bigint();
  assert.equal(lookup("A".repeat(31989)), null);
  assert.equal(lookup("A".repeat(32000)), null);
  assert.equal(Number(process.hrtime.bigint() - started) / 1e6 < 100, true);
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
