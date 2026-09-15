(async () => {
  const $ = (id) => document.getElementById(id),
    D = CubeLabDetector;
  let settings = {
    ...D.DEFAULTS,
    ...(await chrome.storage.local.get("settings")).settings,
  };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const host = tab?.url ? new URL(tab.url).hostname : "";
  function show() {
    $("enabled").checked = settings.enabled;
    $("site").checked = !settings.disabledHosts.includes(host);
    const prefs = settings.sitePreferences[host] || {};
    $("size").value = prefs.size || "";
    $("lowercaseMode").value = prefs.lowercaseMode || settings.lowercaseMode;
    for (const id of ["site", "size", "lowercaseMode"]) $(id).disabled = !host;
  }
  show();
  async function save(change) {
    try {
      settings = await CubeLabSettings.update(change);
    } catch (error) {
      $("status").textContent = error.message;
    }
    show();
  }
  for (const id of ["size", "lowercaseMode"])
    $(id).onchange = async () => {
      await save({
        type: "site",
        host,
        patch: {
          [id]: id === "size" ? Number($(id).value) || null : $(id).value,
        },
      });
    };
  async function status() {
    try {
      const s = await chrome.tabs.sendMessage(tab.id, { type: "status" });
      $("status").textContent = `${s.count} links on ${s.hostname}`;
    } catch {
      $("status").textContent =
        "Reload the page after installing. Chrome internal pages and CubeLab itself are excluded.";
    }
  }
  $("enabled").onchange = async () => {
    await save({ type: "global", patch: { enabled: $("enabled").checked } });
  };
  $("site").onchange = async () => {
    await save({ type: "site", host, patch: { enabled: $("site").checked } });
  };
  $("scan").onclick = async () => {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "scan" });
    } catch {}
    await status();
  };
  $("options").onclick = () => chrome.runtime.openOptionsPage();
  await status();
})();
