(async () => {
  const D = CubeLabDetector,
    $ = (id) => document.getElementById(id);
  let settings = {
    ...D.DEFAULTS,
    ...(await chrome.storage.local.get("settings")).settings,
  };
  function show() {
    for (const key of ["minMoves", "movesTemplate", "algTemplate", "scheme"])
      $(key).value = settings[key];
  }
  show();
  $("save").onclick = async () => {
    try {
      const next = {
        scheme: $("scheme").value,
        minMoves: Number($("minMoves").value),
        movesTemplate: $("movesTemplate").value.trim(),
        algTemplate: $("algTemplate").value.trim(),
      };
      for (const key of ["movesTemplate", "algTemplate"]) {
        if (!next[key].includes("{notation}"))
          throw Error("Each template needs {notation}.");
        D.makeURL(
          {
            kind: key === "movesTemplate" ? "moves" : "state",
            notation: "R U",
            size: 3,
          },
          next,
        );
      }
      const patch = Object.fromEntries(
        Object.entries(next).filter(([key, value]) => value !== settings[key]),
      );
      settings = await CubeLabSettings.update({ type: "global", patch });
      show();
      $("status").textContent = "Settings saved.";
    } catch (e) {
      $("status").textContent = e.message;
    }
  };
  $("reset").onclick = async () => {
    try {
      settings = await CubeLabSettings.update({ type: "reset" });
      show();
      $("status").textContent = "Defaults restored.";
    } catch (error) {
      $("status").textContent = error.message;
    }
  };
  $("test").onclick = () => {
    const results = D.detect($("notation").value, {
      minMoves: 1,
      cubeContext: true,
      size: Number($("testSize").value) || undefined,
    });
    $("results").replaceChildren();
    if (!results.length) {
      $("results").textContent =
        "No supported notation detected. You can still select the text on its page and use the context menu.";
      return;
    }
    for (const r of results) {
      const p = document.createElement("p"),
        a = document.createElement("a");
      a.href = D.makeURL(r, settings);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = `Open ${r.size}×${r.size}${r.format === "SSE" ? " SSE" : ""} ${r.kind} in CubeLab`;
      p.append(`${r.notation}\n`, a);
      $("results").append(p);
    }
  };
})();
