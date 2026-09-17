"use strict";

const styles = {
  cubingCheatSheet: {
    name: "CubingCheatSheet",
    url: "https://cubingcheatsheet.com/algs5x_patterns.html",
    html: `<!doctype html><html><head><title>5x5 Pretty Patterns Algorithms - Dan's Cubing Cheat [Sheet] App</title></head>
<body>
<h1>Patterns <span>5x5</span></h1>
<div class="alg-sequence">
  <a href="https://alg.cubing.net">
    <span>2-4Fw'</span> <span>2-4Rw2</span> <span>2F2</span> <span>2-4Rw2</span> <span>2-4Dw2</span> <span>2-3Fw2</span> <span>2-4Dw</span> <span>S2</span> <span>2-4Dw</span> <span>2-3Fw</span> <span>L</span> <span>2B'</span> <span>2R2</span> <span>2B</span> <span>L'</span> <span>2B'</span> <span>Rw2</span> <span>S'</span> <span>2L2</span> <span>S</span> <span>R2</span> <span>S'</span> <span>2L2</span> <span>S</span>
  </a>
</div>
<div class="alg-sequence">
  <a href="https://alg.cubing.net">
    <span>F</span> <span>U'</span> <span>B</span> <span>L</span> <span>U'</span> <span>F2</span> <span>U2</span> <span>F</span> <span>U</span> <span>F'</span> <span>U2</span> <span>D'</span> <span>B</span> <span>D</span> <span>L2</span> <span>B2</span> <span>U</span> <span>Fw</span> <span>Uw'</span> <span>Bw</span> <span>Lw</span> <span>Uw'</span> <span>Fw2</span> <span>Uw2</span> <span>Fw</span> <span>Uw</span> <span>Fw'</span> <span>Uw2</span> <span>Dw'</span> <span>Bw</span> <span>Dw</span> <span>Lw2</span> <span>Bw2</span> <span>Uw</span>
  </a>
</div>
</body></html>`,
    expectedLinks: 2,
    expectedSize: 5,
    expectedPlacement: "after-anchor",
  },

  onlineCube: {
    name: "OnlineCube",
    url: "https://onlinecube.com/5x5/",
    html: `<!doctype html><html><head><title>Online 5x5 Cube Puzzle - Simulator, Solver, Timer and Tutorial</title></head>
<body>
<h2>How to Solve the 5x5 Cube?</h2>
<h3>Solve the Centers</h3>
<p class="centeralign">
  <span class="algo copyable" title="Copy" role="button" tabindex="0">
    <span class="rw">Rw</span><span class="u2">U2</span><span class="rwi">Rw'</span>
  </span>
</p>
<h3>Pair the Edges</h3>
<p class="centeralign">
  <span class="algo copyable" title="Copy" role="button" tabindex="0">
    <span class="uwi">Uw'</span><span class="u">U</span><span class="r">R</span><span class="u">U</span><span class="ri">R'</span><span class="uw">Uw</span><span class="ui">U'</span>
  </span>
</p>
<h3>Edge Parity: Two Flipped Wings</h3>
<p>Older guides write the same algorithm as <em>r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2,</em> using a convention where a lowercase letter means the inner slice on its own.</p>
<div id="solutionMoves" class="algo">
  <span class="r" data-i="0">R</span><span class="u" data-i="1">U</span><span class="ri" data-i="2">R'</span>
</div>
<div id="cubeCommands">
  <div id="cubeRotations">
    <div class="row">
      <a data-move="F" title="Front clockwise">F</a>
      <a data-move="R" title="Right clockwise">R</a>
      <a data-move="U" title="Up clockwise">U</a>
      <a data-move="B" title="Back clockwise">B</a>
      <a data-move="L" title="Left clockwise">L</a>
      <a data-move="D" title="Down clockwise">D</a>
    </div>
  </div>
</div>
</body></html>`,
    expectedLinks: 4,
    expectedSize: 5,
    expectedMoves: [
      "Rw U2 Rw'",
      "Uw' U R U R' Uw U'",
      "r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2",
      "R U R'",
    ],
  },

  randelshofer: {
    name: "Randelshofer",
    url: "https://www.randelshofer.ch/rubik/revenge/A200.01.html",
    html: `<!doctype html><html><head><title>Pretty Patterns Revenge Cube</title></head>
<body>
<h1>Algorithm</h1>
<p id="algorithm">(ML2  D'\n MR2\tD)2</p>
<pre id="dots">U2 · F2 B2 · U2 F2 · R2 L2 · F2 (12)</pre>
</body></html>`,
    expectedLinks: 2,
    expectedSize: 4,
  },

  ruwix: {
    name: "Ruwix",
    url: "https://ruwix.com/the-rubiks-cube/rubiks-cube-patterns-algorithms/",
    html: `<!doctype html><html><head><title>Rubik's Cube Patterns and Algorithms</title></head>
<body>
<h1>3x3 Patterns</h1>
<div class="card" data-alg="M2 E2 S2">Checkerboard</div>
<div class="card" data-alg="R U R' U'">Sexy Move</div>
</body></html>`,
    expectedLinks: 2,
    expectedSize: 3,
  },

  twizzle: {
    name: "Twizzle",
    url: "https://alpha.twizzle.net/explore/",
    html: `<!doctype html><html><head><title>Twizzle Explorer</title></head>
<body>
<h1>Puzzle Viewers</h1>
<twisty-player puzzle="4x4x4" alg="Rw U Rw′" experimental-setup-alg="R U"></twisty-player>
<twisty-player puzzle="5x5x5" alg="WR U F" experimental-setup-alg="MR2"></twisty-player>
</body></html>`,
    expectedLinks: 2,
  },

  roofpig: {
    name: "Roofpig",
    url: "https://example.com/roofpig-patterns",
    html: `<!doctype html><html><head><title>Roofpig Algorithms 3x3</title></head>
<body>
<h1>Roofpig Gallery</h1>
<div data-roofpig="alg=R U R' U'|colored=u">Trigger</div>
<div data-roofpig="alg=M2 E2 S2">Checkerboard</div>
</body></html>`,
    expectedLinks: 2,
    expectedSize: 3,
  },

  subscript: {
    name: "Subscript",
    url: "https://example.com/subscript-notation",
    html: `<!doctype html><html><head><title>4x4 Cube Guide</title></head>
<body>
<h1>4x4 Algorithms</h1>
<p>Turn wide: F<sub>2</sub>′ U F<sub>2</sub></p>
<p>Turn double: R<sub>2</sub> U R<sub>2</sub>′</p>
</body></html>`,
    expectedLinks: 2,
    expectedSize: 4,
  },

  dashTutorial: {
    name: "DashTutorial",
    url: "https://example.com/tutorial-dash",
    html: `<!doctype html><html><head><title>Beginner Cube Tutorial 3x3</title></head>
<body>
<h1>First Steps</h1>
<p>Perform the trigger: R-U-Ri-Ui</p>
<p>Then reverse: U-R-Ui-Ri</p>
</body></html>`,
    expectedLinks: 2,
    expectedSize: 3,
  },

  cycles: {
    name: "PermutationCycles",
    url: "https://example.com/cycles",
    html: `<!doctype html><html><head><title>Cube Permutation Cycles 3x3</title></head>
<body>
<h1>Cycle Notation</h1>
<p>(dlf,urf) (ufl,dfr)<br>(ur,dr) (rf,rb)<br>(++r) (++u)</p>
</body></html>`,
    expectedLinks: 1,
    expectedSize: 3,
  },

  commutatorConjugate: {
    name: "CommutatorsAndConjugates",
    url: "https://example.com/commutators",
    html: `<!doctype html><html><head><title>Advanced 3x3 Commutators</title></head>
<body>
<h1>Commutators &amp; Conjugates</h1>
<p>Commutator: [R, U]</p>
<p>Conjugate: [R: U]</p>
<p>Repeated: (R U)3</p>
</body></html>`,
    expectedLinks: 3,
    expectedSize: 3,
  },
};

module.exports = styles;
