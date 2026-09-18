/* Serialized settings writes in the worker; field-level requests from the UI. */
(function (root) {
  "use strict";
  const D = root.CubeLabDetector || require("./detector.js");

  function applyChange(settings, change) {
    if (change.type === "reset") return structuredClone(D.DEFAULTS);
    const next = structuredClone(settings);
    if (change.type === "site") {
      const { host, patch } = change;
      if (
        typeof host !== "string" ||
        !host ||
        new URL(`https://${host}`).hostname !== host
      )
        throw Error("A valid website hostname is required.");
      const prefs = { ...next.sitePreferences[host] };
      for (const [key, value] of Object.entries(patch)) {
        if (key === "enabled" && typeof value === "boolean") {
          next.disabledHosts = next.disabledHosts.filter((h) => h !== host);
          if (!value) next.disabledHosts.push(host);
        } else if (key === "size" && [null, 2, 3, 4, 5].includes(value)) {
          prefs.size = value;
        } else if (
          key === "lowercaseMode" &&
          ["Wide", "InnerSlice"].includes(value)
        ) {
          prefs.lowercaseMode = value;
        } else throw Error("Invalid website preference.");
      }
      next.sitePreferences = { ...next.sitePreferences, [host]: prefs };
    } else if (change.type === "global") {
      for (const [key, value] of Object.entries(change.patch)) {
        if (
          (key === "enabled" && typeof value === "boolean") ||
          (key === "minMoves" && [2, 3, 4].includes(value)) ||
          (key === "badgeStyle" &&
            ["compact", "classic", "floating"].includes(value)) ||
          (key === "scheme" && ["Western", "Japanese"].includes(value))
        )
          next[key] = value;
        else if (
          ["movesTemplate", "algTemplate"].includes(key) &&
          typeof value === "string" &&
          value.includes("{notation}")
        ) {
          D.makeURL(
            {
              kind: key === "movesTemplate" ? "moves" : "state",
              notation: "R U",
              size: 3,
            },
            { ...next, [key]: value },
          );
          next[key] = value;
        } else throw Error("Invalid setting or destination template.");
      }
    } else throw Error("Unknown settings operation.");
    return next;
  }

  function createStore(storage) {
    let pending = Promise.resolve();
    return {
      update(change) {
        const operation = pending.then(async () => {
          const { settings: stored } = await storage.get("settings");
          const settings = applyChange({ ...D.DEFAULTS, ...stored }, change);
          await storage.set({ settings });
          return settings;
        });
        // A failed write must not prevent subsequent requests from being saved.
        pending = operation.catch(() => {});
        return operation;
      },
    };
  }

  async function update(change) {
    const response = await chrome.runtime.sendMessage({
      type: "settings:update",
      change,
    });
    if (!response?.settings)
      throw Error(response?.error || "Settings could not be saved.");
    return response.settings;
  }

  const api = { createStore, update };
  root.CubeLabSettings = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
