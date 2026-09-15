importScripts("detector.js", "settings.js");
const settingsStore = CubeLabSettings.createStore(chrome.storage.local);
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== "settings:update") return;
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith(chrome.runtime.getURL(""))
  ) {
    respond({ error: "Settings can only be changed from extension pages." });
    return;
  }
  settingsStore.update(message.change).then(
    (settings) => respond({ settings }),
    (error) => respond({ error: error.message }),
  );
  return true;
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "cubelab-selection",
      title: "Open selection in CubeLab",
      contexts: ["selection"],
    });
  });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "cubelab-selection" || !info.selectionText) return;
  const text = info.selectionText.trim();
  if (text.length > 8000) return;
  const { settings: stored } = await chrome.storage.local.get("settings");
  const settings = { ...CubeLabDetector.DEFAULTS, ...stored };
  const host = tab?.url ? new URL(tab.url).hostname : "";
  const prefs = settings.sitePreferences[host] || {};
  const size =
    Number(prefs.size) ||
    CubeLabDetector.inferSize((tab?.title || "") + " " + (tab?.url || ""));
  const result = CubeLabDetector.classify(text, {
    minMoves: 1,
    size,
    lowercaseMode: prefs.lowercaseMode || settings.lowercaseMode,
  }) || { kind: "unknown", notation: text, size };
  try {
    await chrome.tabs.create({
      url: CubeLabDetector.makeURL(result, settings),
    });
  } catch (error) {
    console.warn("CubeLab URL could not be opened", error);
  }
});
