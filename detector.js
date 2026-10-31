/* Pure detection and URL construction, shared by content script, worker and tests. */
(function (root) {
  "use strict";
  const DEFAULTS = Object.freeze({
    enabled: true,
    disabledHosts: [],
    minMoves: 3,
    badgeStyle: "compact",
    sitePreferences: {},
    lowercaseMode: "Wide",
    scheme: "Western",
    movesTemplate:
      "https://wstein.github.io/cubelab/workbench#moves={notation}",
    algTemplate: "https://wstein.github.io/cubelab/#alg={notation}",
  });
  const orbit64v2 = root.CubeLabOrbit64V2 || require("./orbit64v2.js");
  const MAX = 2000;
  const cleanWhitespace = (source) => source.replace(/\s+/gu, " ").trim();
  const normalize = (s) =>
    s
      .replace(/[’‘′´`]/g, "'")
      .replace(/²/g, "2")
      .replace(/[·•]/g, " ")
      .replace(/\u00a0/g, " ");
  const moveRE =
    /^(?:[2-7]-[2-7][urfdlb]|[2-7][urfdlb]|[2-7]-[2-7][URFDLB]w|[2-7]?[URFDLB]w|[2-7][URFDLB]|[URFDLBMESxyzurfdlb])(?:2'?|'2|3|'|i)?/;
  const sseMoveRE =
    /^(?:[CTNVMWS](?:[1-5](?:-[1-5])?)?)?[URFDLB](?:2['-]?|['-]2|3|['-])?/;
  const sseMarker = /[CTNVMWS](?:\d+(?:-\d+)?)?[URFDLB]/;
  const opposite = { R: "L", L: "R", U: "D", D: "U", F: "B", B: "F" };
  const jaapMarker = /[URFDLB][samc](?:2|['’‘′´`]|3)?/;
  const jaapParts = {
    R: {
      s: [
        ["R", 1],
        ["L", -1],
      ],
      a: [
        ["R", 1],
        ["L", 1],
      ],
      m: [["M", -1]],
      c: [["x", 1]],
    },
    L: {
      s: [
        ["L", 1],
        ["R", -1],
      ],
      a: [
        ["L", 1],
        ["R", 1],
      ],
      m: [["M", 1]],
      c: [["x", -1]],
    },
    U: {
      s: [
        ["U", 1],
        ["D", -1],
      ],
      a: [
        ["U", 1],
        ["D", 1],
      ],
      m: [["E", -1]],
      c: [["y", 1]],
    },
    D: {
      s: [
        ["D", 1],
        ["U", -1],
      ],
      a: [
        ["D", 1],
        ["U", 1],
      ],
      m: [["E", 1]],
      c: [["y", -1]],
    },
    F: {
      s: [
        ["F", 1],
        ["B", -1],
      ],
      a: [
        ["F", 1],
        ["B", 1],
      ],
      m: [["S", 1]],
      c: [["z", 1]],
    },
    B: {
      s: [
        ["B", 1],
        ["F", -1],
      ],
      a: [
        ["B", 1],
        ["F", 1],
      ],
      m: [["S", -1]],
      c: [["z", -1]],
    },
  };

  function sseMove(token, size) {
    const [, family = "", first, last, face, suffix = ""] = token.match(
      /^(?:([CTNVMWS])([1-7])?(?:-([1-7]))?)?([URFDLB])(.*)$/,
    );
    const turns = suffix.includes("2") ? 2 : /['-]|3/.test(suffix) ? -1 : 1;
    const ending = (turns) =>
      turns === 2 || turns === -2 ? "2" : turns === -1 ? "'" : "";
    function range(from, to, direction = turns, side = face) {
      if (from < 1 || to > size || from > to) throw Error("SSE layer range");
      if (from === 1 && to === size) {
        const axis = { R: "x", L: "x", U: "y", D: "y", F: "z", B: "z" }[side];
        return axis + ending(/[LDB]/.test(side) ? -direction : direction);
      }
      if (to === size)
        return range(1, size - from + 1, -direction, opposite[side]);
      const base =
        from === 1
          ? to === 1
            ? side
            : `${to}${side}w`
          : from === to
            ? `${from}${side}`
            : `${from}-${to}${side}w`;
      return base + ending(direction);
    }
    const depth = Number(
      first || (family === "T" || family === "N" || family === "V" ? 2 : 1),
    );
    if (last && family !== "N" && family !== "S")
      throw Error("SSE range prefix");
    if (family === "C" || family === "W") {
      if (first) throw Error("SSE unnumbered prefix");
      return [family === "C" ? range(1, size) : range(2, size - 1)];
    }
    if (family === "T") {
      if (depth >= size) throw Error("SSE tier depth");
      return [range(1, depth)];
    }
    if (family === "N") return [range(depth, Number(last || depth))];
    if (family === "V" || family === "M") {
      if (depth > size - 2) throw Error("SSE inner depth");
      // If centering is ambiguous, SSE chooses the block nearer the named face.
      const from = family === "V" ? 2 : Math.floor((size - depth) / 2) + 1;
      return [range(from, from + depth - 1)];
    }
    if (family === "S") {
      const from = last ? depth : depth + 1,
        to = last ? Number(last) : size - depth;
      if (from < 1 || from > to || to > size || (from === 1 && to === size))
        throw Error("SSE slice range");
      // S ranges rotate the complement, not the layers named by the range.
      return [
        ...(from > 1 ? [range(1, from - 1)] : []),
        ...(to < size ? [range(to + 1, size)] : []),
      ];
    }
    return [range(1, 1)];
  }
  function parseExpression(
    source,
    sseSize = null,
    modernSize = null,
    jaap = false,
  ) {
    if (typeof source !== "string" || !source || source.length > 8000)
      return null;
    const s = sseSize
      ? normalize(source).replace(/[.↗]/g, " ")
      : normalize(source)
          .replace(
            /([URFDLB])([₂₃₄₅₆₇])/g,
            (_, f, n) => "₂₃₄₅₆₇".indexOf(n) + 2 + f + "w",
          )
          .replace(
            /(?<=[URFDLBMESxyzurfdlbw'i])-(?=[2-7URFDLBMESxyzurfdlb([])/g,
            " ",
          );
    let pos = 0,
      depth = 0,
      minSize = 2;
    const skip = () => {
      while (/\s/.test(s[pos] || "") && pos < s.length) pos++;
    };
    const inv = (a) =>
      a
        .slice()
        .reverse()
        .map((m) =>
          m.endsWith("2") ? m : m.endsWith("'") ? m.slice(0, -1) : m + "'",
        );
    function seq(stops = "") {
      if (++depth > 12) throw Error("depth");
      let out = [];
      while (true) {
        skip();
        if (pos >= s.length || stops.includes(s[pos])) break;
        let part;
        if (s[pos] === "(" || s[pos] === "[") {
          const open = s[pos++];
          part = seq(open === "(" ? ")" : ",:]");
          skip();
          if (open === "[") {
            const op = s[pos++];
            if (op !== "," && op !== ":") throw Error("operator");
            const b = seq("]");
            if (!part.length || !b.length) throw Error("empty");
            part =
              op === ","
                ? [...part, ...b, ...inv(part), ...inv(b)]
                : [...part, ...b, ...inv(part)];
          }
          if (s[pos++] !== (open === "(" ? ")" : "]") || !part.length)
            throw Error("close");
          const suffix = s
            .slice(pos)
            .match(sseSize ? /^(\d{1,3})?(['-])?/ : /^(\d{1,3})?(')?/)[0];
          pos += suffix.length;
          const count = Number(suffix.replace(/['-]/, "") || 1);
          if (count < 1 || count > 100) throw Error("repeat");
          if (/['-]$/.test(suffix)) part = inv(part);
          if (part.length * count > MAX) throw Error("size");
          part = Array.from({ length: count }, () => part).flat();
        } else {
          const m = s
            .slice(pos)
            .match(
              sseSize
                ? sseMoveRE
                : jaap
                  ? /^[URFDLB](?:[samc])?(?:2|'|3)?/
                  : moveRE,
            );
          if (!m) throw Error("token");
          pos += m[0].length;
          if (sseSize) {
            part = sseMove(m[0], sseSize);
          } else if (jaap) {
            const [, face, family = "", suffix = ""] = m[0].match(
              /^([URFDLB])([samc])?(.*)$/,
            );
            const turns =
              suffix === "2" ? 2 : suffix === "'" || suffix === "3" ? -1 : 1;
            part = (family ? jaapParts[face][family] : [[face, 1]]).map(
              ([base, direction]) => {
                const amount = turns * direction;
                return (
                  base + (Math.abs(amount) === 2 ? "2" : amount < 0 ? "'" : "")
                );
              },
            );
            if (family === "m") minSize = Math.max(minSize, 3);
          } else {
            let move = m[0]
              .replace(
                /^([2-7](?:-[2-7])?)([urfdlb])/,
                (_, n, f) => n + f.toUpperCase() + "w",
              )
              .replace(/i$/, "'")
              .replace(/(?:2'|'2)$/, "2")
              .replace(/3$/, "'");
            let base = move.replace(/[2']$/, "");
            const layer = (
              /^[urfdlb]$/.test(base) ? base.toUpperCase() + "w" : base
            ).match(/^(?:([2-7])(?:-([2-7]))?)?([URFDLB])(w)?$/);
            if (modernSize && layer) {
              const from = layer[2]
                ? Number(layer[1])
                : layer[4]
                  ? 1
                  : Number(layer[1] || 1);
              const to = Number(layer[2] || layer[1] || (layer[4] ? 2 : 1));
              if (from > to || to > modernSize) throw Error("layer range");
              if (to === modernSize) {
                move = sseMove(
                  `N${from}-${to}${layer[3]}${move.slice(base.length)}`,
                  modernSize,
                )[0];
                base = move.replace(/[2']$/, "");
              }
            }
            if (/[MES]/.test(base)) minSize = Math.max(minSize, 3);
            if (/^[2-7]-[2-7]/.test(base)) {
              if (Number(base[0]) > Number(base[2])) throw Error("layer range");
              minSize = Math.max(minSize, Number(base[2]) + 1);
            } else if (/^[urfdlb]$/.test(base) || /w$/.test(base)) {
              minSize = Math.max(
                minSize,
                Number(base.match(/^[2-7]/)?.[0] || 2) + 1,
              );
            } else if (/^[2-7]/.test(base))
              minSize = Math.max(minSize, Number(base[0]) + 1);
            part = [move];
          }
        }
        out.push(...part);
        if (out.length > MAX) throw Error("size");
      }
      depth--;
      return out;
    }
    try {
      const moves = seq();
      skip();
      return pos === s.length && moves.length && minSize <= 7
        ? { moves, minSize }
        : null;
    } catch {
      return null;
    }
  }
  function parseMoves(source, size) {
    return parseExpression(source, null, size);
  }
  function parseSse(source, size) {
    const parsed = [2, 3, 4, 5].includes(size)
      ? parseExpression(source, size)
      : null;
    return parsed ? { moves: parsed.moves, size } : null;
  }
  function parseJaap(source) {
    return parseExpression(source, null, null, true);
  }
  function facelets(source) {
    const compact = source.replace(/\s/g, "");
    const size = Math.sqrt(compact.length / 6);
    if (![2, 3, 4, 5].includes(size)) return null;
    const alphabet = /^[URFDLB]+$/.test(compact)
      ? "URFDLB"
      : /^[WOGRBY]+$/.test(compact)
        ? "WOGRBY"
        : null;
    if (
      !alphabet ||
      ![...alphabet].every((f) => compact.split(f).length - 1 === size * size)
    )
      return null;
    let notation = compact,
      format = alphabet === "URFDLB" ? "facelets" : "colours";
    const rows = source
      .trim()
      .split(/\r?\n/)
      .map((r) => r.replace(/\s/g, ""));
    // A canonical U / L F R B / D net must be reordered, not merely flattened.
    if (
      rows.length === size * 3 &&
      rows.every(
        (r, i) => r.length === (i >= size && i < size * 2 ? size * 4 : size),
      )
    ) {
      const bands = [0, 1, 2, 3].map((b) =>
        rows
          .slice(size, size * 2)
          .map((r) => r.slice(b * size, (b + 1) * size))
          .join(""),
      );
      notation =
        rows.slice(0, size).join("") +
        bands[2] +
        bands[1] +
        rows.slice(size * 2).join("") +
        bands[0] +
        bands[3];
      format += " net";
    }
    return { kind: "state", format, notation, size, confidence: "high" };
  }
  function cubieState(source) {
    const terms = source.trim().split(/\s+/);
    const canon = (t) => [...t.toUpperCase()].sort().join("");
    const distinct = (list, width) =>
      list.every(
        (t) =>
          new RegExp("^[URFDLB]{" + width + "}$", "i").test(t) &&
          new Set(t.toUpperCase()).size === width &&
          !["UD", "RL", "FB"].some((p) =>
            [...p].every((c) => t.toUpperCase().includes(c)),
          ),
      ) && new Set(list.map(canon)).size === list.length;
    if (
      terms.length === 20 &&
      distinct(terms.slice(0, 12), 2) &&
      distinct(terms.slice(12), 3)
    )
      return {
        kind: "state",
        format: "ACube positional",
        notation: source.trim(),
        size: 3,
        dialect: "Acube",
        confidence: "high",
      };
    return null;
  }
  function coordinates(source) {
    const match = source
      .trim()
      .match(
        /^cp:\s*([0-9\s]+);\s*co:\s*([0-9\s]+)(?:;\s*ep:\s*([0-9\s]+);\s*eo:\s*([0-9\s]+))?$/i,
      );
    if (!match) return null;
    const values = match
      .slice(1)
      .map((s) => s?.trim().split(/\s+/).map(Number));
    const perm = (a, n) =>
      a.length === n &&
      new Set(a).size === n &&
      a.every((v) => v >= 0 && v < n);
    const ori = (a, n, max) =>
      a.length === n && a.every((v) => v >= 0 && v < max);
    if (
      !perm(values[0], 8) ||
      !ori(values[1], 8, 3) ||
      (values[2] && (!perm(values[2], 12) || !ori(values[3], 12, 2)))
    )
      return null;
    return {
      kind: "state",
      format: "cubie coordinates",
      notation: source.trim(),
      size: values[2] ? 3 : 2,
      confidence: "high",
    };
  }
  function numberedPermutation(source, requestedSize) {
    const cycles = [...source.matchAll(/\(([^()]*)\)/g)];
    if (!cycles.length || source.replace(/\([^()]*\)/g, "").trim()) return null;
    const groups = cycles.map((cycle) =>
      cycle[1]
        .split(",")
        .map((token) =>
          token.trim().match(/^(\+\+|\+|-)?([urfdlb]{1,2})([1-8])$/),
        ),
    );
    if (groups.some((group) => group.some((part) => !part))) return null;
    const parts = groups.flat();
    const minimum = parts.some(
      (part) => Number(part[3]) > (part[2].length === 1 ? 4 : 2),
    )
      ? 5
      : 4;
    const size = requestedSize || minimum;
    if (![4, 5].includes(size) || size < minimum) return null;
    const used = new Set();
    for (const group of groups) {
      const width = group[0][2].length;
      for (const [i, part] of group.entries()) {
        const [, prefix, faces, number] = part;
        const index = Number(number);
        if (
          faces.length !== width ||
          new Set(faces).size !== width ||
          ["ud", "rl", "fb"].some((pair) =>
            [...pair].every((face) => faces.includes(face)),
          ) ||
          index > (width === 1 ? (size === 5 ? 8 : 4) : size - 2) ||
          (width === 2 && i > 0 && prefix)
        )
          return null;
        const sorted = [...faces].sort().join("");
        const key =
          sorted + (width === 2 && sorted !== faces ? size - 1 - index : index);
        if (used.has(key)) return null;
        used.add(key);
      }
    }
    return {
      kind: "permutation",
      format: "SSE",
      notation: source,
      size,
      confidence: "high",
    };
  }
  function permutation(source, size) {
    const s = normalize(source).trim();
    if (/[urfdlb]\d/i.test(s)) return numberedPermutation(s, size);
    if (size > 3) return null;
    const cycles = s.match(/\([^()]+\)/g);
    if (!cycles || cycles.join("").replace(/\s/g, "") !== s.replace(/\s/g, ""))
      return null;
    const faces = (t) => {
      const f = t.replace(/[+\-0-9]/g, "").toLowerCase();
      return (
        /^[urfdlb]{1,3}$/.test(f) &&
        new Set(f).size === f.length &&
        !["ud", "rl", "fb"].some((pair) =>
          [...pair].every((c) => f.includes(c)),
        )
      );
    };
    let pieces = 0;
    for (const cycle of cycles) {
      const tokens = cycle
        .slice(1, -1)
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (
        tokens.some(
          (t) => !/^[-+]*[urfdlb]{1,3}[0-9]*[-+]*$/i.test(t) || !faces(t),
        )
      )
        return null;
      if (tokens.length === 1 && !/[+-]/.test(tokens[0])) return null;
      if (
        tokens.some((t) => t.replace(/[+\-0-9]/g, "").length === 1) &&
        tokens.length > 1
      )
        return null;
      pieces += tokens.length;
    }
    return pieces >= 2
      ? { kind: "permutation", notation: s, size: null, confidence: "high" }
      : null;
  }
  function classifyParsed(source, options = {}) {
    const s = normalize(source).trim();
    if (!s || s.length > 8000) return null;
    const state = facelets(s) || cubieState(s) || coordinates(s);
    if (state) return state;
    // Never reinterpret a malformed facelet-shaped string as a move sequence.
    if (
      /^[URFDLB\s]+$/.test(s) &&
      [24, 54, 96, 150].includes(s.replace(/\s/g, "").length)
    )
      return null;
    const perm = permutation(s, options.size);
    if (perm) return { ...perm, size: perm.size || options.size || 3 };
    if (sseMarker.test(s) || options.dialect === "Sse") {
      for (const size of options.size ? [options.size] : [3, 4, 5]) {
        const parsed = parseSse(s, size);
        if (parsed && parsed.moves.length >= (options.minMoves ?? 3))
          return {
            kind: "moves",
            format: "SSE",
            notation: source.trim(),
            size,
            dialect: "Sse",
            lowercaseMode: "Wide",
            confidence: "high",
          };
      }
      return null;
    }
    if (jaapMarker.test(s) || options.dialect === "Jaap") {
      const parsed = parseJaap(s);
      if (!parsed || parsed.moves.length < (options.minMoves ?? 3)) return null;
      return {
        kind: "moves",
        format: "Jaap",
        notation: parsed.moves.join(" "),
        size: 3,
        minSize: parsed.minSize,
        confidence: "high",
      };
    }
    const parsed = parseMoves(s, options.size);
    if (
      parsed &&
      options.size &&
      ((options.size !== 3 &&
        options.size !== 5 &&
        options.size !== 7 &&
        parsed.moves.some((m) => /^[MES]/.test(m))) ||
        parsed.minSize > options.size)
    )
      return null;
    if (!parsed || parsed.moves.length < (options.minMoves ?? 3)) return null;
    return {
      kind: "moves",
      notation: parsed.moves.join(" "),
      size: options.size || Math.max(3, parsed.minSize),
      lowercaseMode: options.lowercaseMode || "Wide",
      minSize: parsed.minSize,
      confidence: "medium",
    };
  }
  function classify(source, options = {}) {
    const result = classifyParsed(source, options);
    return result ? { ...result, source: source.trim() } : null;
  }
  function inferSize(text) {
    const found = [
      ...text.matchAll(/\b([2-9])\s*[x×]\s*\1(?:\s*[x×]\s*\1)?\b/gi),
    ].map((m) => Number(m[1]));
    if (found.length) return new Set(found).size === 1 ? found[0] : null;
    const named = [
      [/\bpocket\s+cube\b|\/rubik\/pocket\//i, 2],
      [/\/rubik\/patterns\//i, 3],
      [/\brevenge\s+cube\b|\/rubik\/revenge\//i, 4],
      [/\bprofessor\s+cube\b|\/rubik\/professor\//i, 5],
    ].filter(([pattern]) => pattern.test(text));
    return named.length === 1 ? named[0][1] : null;
  }
  function detect(text, options = {}) {
    if (
      typeof text !== "string" ||
      text.length > 32000 ||
      (options.size && ![2, 3, 4, 5, 6, 7].includes(options.size))
    )
      return [];
    const found = [];
    const rejectedSse = [];
    // Structured states take precedence over move-like cubie labels.
    const structured = facelets(text) || cubieState(text) || coordinates(text);
    if (structured)
      return [
        {
          ...structured,
          start: 0,
          end: text.trimEnd().length,
          source: text.trimEnd(),
        },
      ];
    function add(start, end, result) {
      if (
        result?.kind === "moves" &&
        /^[A-Za-z]+$/.test(text.slice(start, end)) &&
        (!options.cubeContext || text.slice(start, end).length < 6)
      )
        return;
      if (
        !result ||
        [...found, ...rejectedSse].some((x) => start < x.end && end > x.start)
      )
        return;
      if (options.size && result.minSize > options.size) return;
      found.push({ ...result, start, end, source: text.slice(start, end) });
    }
    // Orbit64 is only autodetected with an explicit label, never arbitrary short IDs.
    for (const m of text.matchAll(
      /\bOrbit64\s*[:=]\s*([A-P][A-Za-z0-9_-]*)(?![A-Za-z0-9_-])/gi,
    )) {
      const token = m[1],
        size = { 5: 2, 12: 3, 27: 4, 43: 5 }[token.length];
      if (size && /^[A-P]/.test(token))
        add(m.index + m[0].lastIndexOf(token), m.index + m[0].length, {
          kind: "state",
          format: "Orbit64 candidate",
          notation: token,
          size,
          confidence: "medium",
        });
    }
    // Orbit64 V2 tokens look like arbitrary text and V1 decoders misread them, so
    // only the label `orbit64v2:` selects them, the token must end at whitespace
    // or sentence punctuation (no longer string with a valid prefix), and only inside a registry range.
    // The label stays in the span, so CubeLab receives it with the token.
    for (const m of text.matchAll(
      /\borbit64v2\s*[:=]\s*([A-Za-z0-9_-]+)(?=[.,;:!?)\]}"'’”]*(?:\s|$))/gi,
    )) {
      const entry = orbit64v2.lookup(m[1]);
      if (entry)
        add(m.index, m.index + m[0].length, {
          kind: "state",
          format: "Orbit64 V2 candidate",
          notation: m[1],
          size: entry.n,
          confidence: "medium",
          orbit64v2: { id: entry.id, model: entry.model, pose: entry.pose },
        });
    }
    // Long facelet runs before algorithms. Spaces/newlines between faces are allowed.
    for (const m of text.matchAll(
      /(?<![A-Za-z0-9])[URFDLBWOGY](?:[URFDLBWOGY\s]*[URFDLBWOGY])?(?![A-Za-z0-9])/g,
    )) {
      const r = facelets(m[0]);
      if (r) add(m.index, m.index + m[0].length, r);
    }
    // Try complete standalone expressions, including nested groups/commutators.
    const trim = text.trim();
    const whole = classify(trim, options);
    if (whole) add(text.indexOf(trim), text.indexOf(trim) + trim.length, whole);
    // Candidate runs bounded by prose; unmatched syntax is rejected, not repaired.
    const run =
      /(?<![A-Za-z0-9])(?:[2-7](?:-[2-7])?[urfdlb]|[2-7]-[2-7][URFDLB]w|[2-7]?[URFDLB]w|[2-7][URFDLB]|[CTNVMWS](?:[0-9]+(?:-[0-9]+)?)?[URFDLB]|[URFDLBMESxyzurfdlb]|[([]|<)(?:[URFDLBMESxyzurfdlbsamcqCTNVMWSwi₂₃₄₅₆₇2-7\-'’‘′´`²\s.·•↗*<>()[\],:0-9]*)(?![A-Za-z0-9])/g;
    for (const m of text.matchAll(run)) {
      let raw = m[0].trimEnd();
      // A numbered prose list can begin with an SSE family letter ("1. Write"),
      // which otherwise gets absorbed after an algorithm on the preceding line.
      raw = raw.replace(/\s+\d+\.\s*[CTNVMWS]?$/, "").trimEnd();
      // Jaap's parenthesized f*/q* move-count annotations are prose metadata.
      raw = raw
        .replace(/\s+\(\d+(?:[fq]\*)?(?:\s*,\s*\d+(?:[fq]\*)?)*\)\s*$/i, "")
        .trimEnd();
      // Metric suffixes in Pretty Patterns are deliberately outside the notation.
      raw = raw.replace(/\s+\(\d+\*?\)?\s*$/, "").trimEnd();
      raw = raw.replace(/[,;:!?.…]+$/, "").trimEnd();
      if (!raw || /[A-Za-z]/.test(text[m.index + raw.length] || "")) continue;
      const r = classify(raw, options);
      if (!r && sseMarker.test(raw))
        rejectedSse.push({ start: m.index, end: m.index + raw.length });
      if (r && (options.cubeContext || /[URFDLBMES]/.test(raw)))
        add(m.index, m.index + raw.length, r);
    }
    // Complete expressions own their spans before cycle extraction: (RU RF)2
    // is a repeated move group, not the cycle (RU RF).
    for (const m of text.matchAll(/(?:\([^()]+\)\s*)+/g)) {
      const raw = m[0].trimEnd();
      // Never salvage a cycle by discarding an invalid repeat or inverse.
      if (/^[0-9'’‘′´`)\]]/.test(text.slice(m.index + raw.length))) continue;
      const p = permutation(raw, options.size);
      add(
        m.index,
        m.index + raw.length,
        p ? { ...p, size: p.size || options.size || 3 } : null,
      );
    }
    return found.sort((a, b) => a.start - b.start);
  }
  // CubeAssembler fingerprint (see docs/FINGERPRINT.md): strict, bounded, read-only.
  const FINGERPRINT_SPEC = 1;
  const FINGERPRINT_MAX_CHARS = 16384;
  const FINGERPRINT_FORMAT = "layer-prefix/v1";
  const fingerprintTurn =
    "(?:(?:[2-7]-[2-7]|[2-7])?[URFDLB]w?['2]?|[xyz]['2]?)";
  const fingerprintMoves = new RegExp(
    `^(?:${fingerprintTurn}(?: ${fingerprintTurn})*)?$`,
  );
  function parseFingerprintMarker(content) {
    if (typeof content !== "string" || content.length > 512) return null;
    const pairs = new Map();
    for (const part of content.split(";")) {
      const at = part.indexOf("=");
      if (at < 0) continue;
      const key = part.slice(0, at).trim();
      pairs.set(key, pairs.has(key) ? null : part.slice(at + 1).trim());
    }
    return pairs.get("spec") === String(FINGERPRINT_SPEC)
      ? { spec: FINGERPRINT_SPEC, app: pairs.get("app") || "" }
      : null;
  }
  function parseFingerprintMoves(text) {
    if (typeof text !== "string" || text.length > FINGERPRINT_MAX_CHARS)
      return null;
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const { size, moves, format } = data;
    if (
      format !== FINGERPRINT_FORMAT ||
      !Number.isInteger(size) ||
      size < 2 ||
      size > 7 ||
      typeof moves !== "string" ||
      !fingerprintMoves.test(moves)
    )
      return null;
    const count = moves ? moves.split(" ").length : 0;
    if (count > MAX) return null;
    // An empty history has nothing to link.
    if (!count) return { size, moves, match: null };
    const parsed = parseMoves(moves, size);
    if (!parsed || parsed.moves.length !== count) return null;
    return {
      size,
      moves,
      match: {
        kind: "moves",
        notation: parsed.moves.join(" "),
        size,
        lowercaseMode: "Wide",
        minSize: parsed.minSize,
        confidence: "high",
        source: moves,
      },
    };
  }
  function makeURL(result, settings = DEFAULTS) {
    const template =
      result.kind === "moves" ? settings.movesTemplate : settings.algTemplate;
    const encoded = new URLSearchParams({
      n: cleanWhitespace(result.source ?? result.notation),
    })
      .toString()
      .slice(2);
    const value = template
      .replaceAll("{notation}", encoded)
      .replaceAll("{size}", String(result.size || 3));
    const url = new URL(value);
    if (url.protocol !== "https:")
      throw Error("Only HTTPS destinations are allowed");
    if (
      url.hostname === "wstein.github.io" &&
      url.pathname.startsWith("/cubelab/")
    ) {
      const params = new URLSearchParams(url.hash.slice(1));
      if (result.size && result.size !== 3)
        params.set("size", String(result.size));
      if (result.setup) params.set("alg", cleanWhitespace(result.setup));
      if (result.dialect) params.set("dialect", result.dialect);
      if (
        (result.lowercaseMode || settings.lowercaseMode) === "InnerSlice" &&
        result.size >= 4
      )
        params.set("lowercase", "InnerSlice");
      if (settings.scheme === "Japanese") params.set("scheme", "Japanese");
      url.hash = params.toString();
    }
    return url.href;
  }
  const api = {
    DEFAULTS,
    cleanWhitespace,
    normalize,
    parseMoves,
    parseSse,
    parseJaap,
    facelets,
    cubieState,
    coordinates,
    permutation,
    classify,
    detect,
    inferSize,
    makeURL,
    FINGERPRINT_MAX_CHARS,
    parseFingerprintMarker,
    parseFingerprintMoves,
  };
  root.CubeLabDetector = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
