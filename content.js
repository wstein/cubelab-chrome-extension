(() => {
  "use strict";
  if (globalThis.__cubeLabLinker) return;
  globalThis.__cubeLabLinker = true;
  const D = CubeLabDetector;
  const BLOCK =
    "p,li,td,th,pre,div,section,article,h1,h2,h3,h4,h5,h6,dd,dt,figcaption,body";
  const SKIP =
    'script,style,noscript,textarea,input,select,button,a:not([href]),svg,canvas,math,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[hidden],[aria-hidden="true"],.cubelab-link';
  const WIDGET =
    "[data-alg],[data-algorithm],[data-roofpig],twisty-player[alg]";
  const CONTEXT = "head,h1,h2,h3,h4,style,link[rel=stylesheet]";
  const blockRecords = new Map(),
    widgetRecords = new Map(),
    ownedLinks = new Set(),
    floatingRanges = new Map();
  const dirtyRoots = new Set();
  let settings = { ...D.DEFAULTS },
    timer,
    count = 0,
    running = false,
    activeFloating,
    floatingTimer,
    fullScan = true;

  function elementOf(node) {
    return node.nodeType === 1 ? node : node.parentElement;
  }
  function affectsContext(node) {
    const element = elementOf(node);
    return (
      element && (element.closest(CONTEXT) || element.querySelector(CONTEXT))
    );
  }
  const observer = new MutationObserver((changes) => {
    for (const change of changes) {
      const element = elementOf(change.target);
      // Attributes can affect CSS selectors on ancestors and siblings.
      const global =
        change.type === "attributes" ||
        affectsContext(change.target) ||
        [...change.addedNodes, ...change.removedNodes].some(affectsContext);
      schedule(global ? null : element?.closest(BLOCK));
    }
  });
  function schedule(root = null) {
    if (root) dirtyRoots.add(root);
    else fullScan = true;
    if (!timer)
      timer = setTimeout(() => {
        timer = null;
        scan(false);
      }, 250);
  }
  function cubeLabPage() {
    let pathname = location.pathname;
    try {
      pathname = decodeURI(pathname);
    } catch {
      /* Page URLs can contain malformed escapes. */
    }
    if (
      location.hostname === "wstein.github.io" &&
      (pathname === "/cubelab" || pathname.startsWith("/cubelab/"))
    )
      return true;
    const applicationName = document.querySelector(
      'meta[name="application-name" i]',
    );
    if (applicationName?.content.trim().toLowerCase() === "cubelab")
      return true;
    // Current CubeLab builds do not yet expose application-name metadata.
    // Require its complete converter shell to avoid excluding unrelated pages
    // that happen to use one generic data attribute.
    const converter = document.querySelector("main[data-converter]");
    return Boolean(
      converter?.querySelector("[data-size-control]") &&
      converter.querySelector("textarea[data-input]") &&
      converter.querySelector("[data-workspace-tab]"),
    );
  }
  function active() {
    return (
      settings.enabled &&
      !settings.disabledHosts.includes(location.hostname) &&
      !cubeLabPage()
    );
  }
  function clearRecord(record) {
    // Undo only extension-created splits, preserving page-owned text nodes.
    for (const { link, left, right } of [...record.links].reverse()) {
      link.remove();
      ownedLinks.delete(link);
      floatingRanges.delete(link);
      if (right && left.parentNode && left.nextSibling === right) {
        left.appendData(right.data);
        right.remove();
      }
    }
  }
  function hideFloating() {
    if (!activeFloating) return;
    activeFloating.classList.remove("cubelab-link--visible");
    activeFloating = null;
  }
  function positionFloating(link, rect) {
    link.style.left = `${Math.min(rect.right + 6, innerWidth - link.offsetWidth - 4)}px`;
    link.style.top = `${Math.max(4, rect.top - 4)}px`;
  }
  function showFloating(link, rect) {
    clearTimeout(floatingTimer);
    if (activeFloating && activeFloating !== link) hideFloating();
    positionFloating(link, rect);
    link.classList.add("cubelab-link--visible");
    activeFloating = link;
  }
  function rectAt(range, x, y) {
    try {
      return [...range.getClientRects()].find(
        (rect) =>
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom,
      );
    } catch {
      return null;
    }
  }
  document.addEventListener("pointermove", (event) => {
    if (event.target.closest(".cubelab-link--floating")) {
      clearTimeout(floatingTimer);
      return;
    }
    for (const [link, range] of floatingRanges) {
      const rect = rectAt(range, event.clientX, event.clientY);
      if (rect) return showFloating(link, rect);
    }
    clearTimeout(floatingTimer);
    floatingTimer = setTimeout(hideFloating, 120);
  });
  addEventListener(
    "scroll",
    () => {
      const range = activeFloating && floatingRanges.get(activeFloating);
      if (range) {
        const [rect] = range.getClientRects();
        if (rect) positionFloating(activeFloating, rect);
      }
    },
    true,
  );
  addEventListener("resize", hideFloating);
  function makeLink(match) {
    const link = document.createElement("a");
    link.className = `cubelab-link cubelab-link--${settings.badgeStyle}`;
    try {
      link.href = D.makeURL(match, settings);
    } catch {
      return null;
    }
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const label =
      match.kind === "moves"
        ? `${match.size}×${match.size}${match.format === "SSE" ? " SSE" : ""} moves`
        : match.kind === "state"
          ? `${match.size}×${match.size} state`
          : match.format === "SSE"
            ? `${match.size}×${match.size} SSE cycles`
            : "cycles";
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.classList.add("cubelab-link-icon");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z",
    );
    icon.append(path);
    link.append(icon);
    if (["classic", "floating"].includes(settings.badgeStyle))
      link.append(`CubeLab · ${label}`);
    link.title = `Open ${(match.source || match.notation).slice(0, 300)} in CubeLab`;
    link.setAttribute("aria-label", `Open ${label} in CubeLab`);
    link.addEventListener("click", (event) => event.stopPropagation());
    ownedLinks.add(link);
    return link;
  }
  function sourceText(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node,
      text = "";
    while ((node = walker.nextNode()))
      if (!node.parentElement.closest(".cubelab-link")) text += node.data;
    return text;
  }
  function pageContext() {
    let pathname = location.pathname;
    try {
      pathname = decodeURI(pathname);
    } catch {
      /* Page URLs can contain malformed escapes. */
    }
    return {
      size: D.inferSize(
        document.title +
          " " +
          pathname +
          " " +
          [...document.querySelectorAll("h1")].map(sourceText).join(" "),
      ),
      headings: [...document.querySelectorAll("h1,h2,h3,h4")],
      nonCube: nonCube(document.title + " " + pathname),
      cubeContext: /rubik|cubing|cube|würfel/i.test(
        document.title + " " + location.hostname,
      ),
    };
  }
  function nonCube(text) {
    return /pyraminx|megaminx|skewb|square[ -]?1|rubik.?s? clock/i.test(text);
  }
  function precedingHeading(element, headings) {
    let low = 0,
      high = headings.length;
    while (low < high) {
      const mid = (low + high) >>> 1,
        heading = headings[mid];
      if (
        heading === element ||
        heading.compareDocumentPosition(element) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
        low = mid + 1;
      else high = mid;
    }
    return headings[low - 1] ? sourceText(headings[low - 1]) : "";
  }
  function visibility() {
    const styles = new WeakMap();
    function style(element) {
      if (!styles.has(element)) styles.set(element, getComputedStyle(element));
      return styles.get(element);
    }
    function visible(element) {
      if (element.closest(SKIP)) return false;
      if (["hidden", "collapse"].includes(style(element).visibility))
        return false;
      for (
        let ancestor = element;
        ancestor;
        ancestor = ancestor.parentElement
      ) {
        if (style(ancestor).display === "none") return false;
      }
      return (
        element.getClientRects().length > 0 ||
        style(element).display === "contents"
      );
    }
    return { visible, style };
  }
  function collect(roots, view) {
    const blocks = new Map(),
      widgets = new Set();
    let visited = 0,
      previousBlock = null,
      previousElement = null,
      previousLink = null;
    function append(node, value) {
      const block = elementOf(node)?.closest(BLOCK);
      if (!block) return;
      if (!blocks.has(block)) blocks.set(block, { text: "", parts: [] });
      const item = blocks.get(block);
      if (previousBlock !== block) {
        if (item.parts.length) item.text += "\0";
        previousElement = null;
        previousLink = null;
      }
      previousBlock = block;
      if (item.text.length > 32000) return;
      const parent = elementOf(node);
      const link = parent?.closest("a[href]");
      if (previousLink !== link) {
        if (item.text.length) item.text += "\0";
        previousElement = null;
      }
      previousLink = link;
      if (
        previousElement &&
        parent &&
        previousElement !== parent &&
        !previousElement.contains(parent) &&
        !parent.contains(previousElement) &&
        !parent.closest("sub, sup") &&
        !previousElement.closest("sub, sup") &&
        item.text.length &&
        !/\s$/.test(item.text) &&
        !/^\s/.test(value) &&
        item.text.length < 32000
      ) {
        item.text += " ";
      }
      previousElement = parent;
      value = value.slice(0, 32001 - item.text.length);
      item.parts.push({
        node,
        start: item.text.length,
        end: item.text.length + value.length,
      });
      item.text += value;
    }
    for (const root of roots) {
      let node = root;
      previousBlock = null;
      previousElement = null;
      previousLink = null;
      while (node && visited++ < 100000) {
        let descend = true;
        if (ownedLinks.has(node)) descend = false;
        else if (node.nodeType === 1) {
          if (node.matches(SKIP) || view.style(node).display === "none") {
            append(node, "\0");
            descend = false;
          } else {
            if (node.matches(WIDGET)) widgets.add(node);
            if (node.tagName === "BR") append(node, "\n");
          }
        } else if (node.nodeType === 3) {
          const parent = node.parentElement;
          const value = !view.visible(parent)
            ? "\0"
            : parent.closest("sub")
              ? node.data.replace(/[2-5]/g, (n) => "₂₃₄₅"[Number(n) - 2])
              : node.data;
          append(node, value);
        }
        if (descend && node.firstChild) node = node.firstChild;
        else {
          while (node !== root && !node.nextSibling) node = node.parentNode;
          node = node === root ? null : node.nextSibling;
        }
      }
    }
    return { blocks, widgets };
  }
  function blockOptions(block, text, page) {
    const prefs = settings.sitePreferences[location.hostname] || {};
    const heading = precedingHeading(block, page.headings);
    const localSize = D.inferSize(text) || D.inferSize(heading);
    if (!prefs.size && (nonCube(heading) || (page.nonCube && !localSize)))
      return null;
    return {
      size: Number(prefs.size) || localSize || page.size,
      cubeContext: page.cubeContext,
      minMoves: settings.minMoves,
      lowercaseMode: prefs.lowercaseMode || settings.lowercaseMode,
    };
  }
  function signature(text, options) {
    return JSON.stringify([
      text,
      options,
      settings.movesTemplate,
      settings.algTemplate,
      settings.scheme,
      settings.badgeStyle,
    ]);
  }
  function recordValid(record, key, owner) {
    return (
      record?.key === key &&
      record.complete &&
      record.links.every(
        ({ link }) => owner.contains(link) || floatingRanges.has(link),
      )
    );
  }
  function decorateBlock(block, item, options, key) {
    const record = { key, links: [], complete: true };
    blockRecords.set(block, record);
    if (!options) return;
    for (const match of D.detect(item.text, options).reverse()) {
      if (ownedLinks.size >= 500) {
        record.complete = false;
        break;
      }
      const part = item.parts.find(
        (p) =>
          p.node.nodeType === 3 && p.start < match.end && p.end >= match.end,
      );
      if (!part) continue;
      const link = makeLink(match);
      if (!link) continue;
      if (settings.badgeStyle === "floating") {
        const start = item.parts.find(
          (p) =>
            p.node.nodeType === 3 &&
            p.start <= match.start &&
            p.end >= match.start,
        );
        if (!start) continue;
        const range = document.createRange();
        range.setStart(start.node, match.start - start.start);
        range.setEnd(part.node, match.end - part.start);
        document.body.append(link);
        floatingRanges.set(link, range);
        record.links.push({ link, left: null, right: null });
        continue;
      }
      // Ruwix renders each move as a fixed-size child of `.rots`. Keep the
      // decoration beside that row: inserting it into the final move changes
      // the inline-block baseline and lifts its sprite. Interactive hosts take
      // precedence so we never create a link inside another link or button.
      const parent = part.node.parentElement;
      const host =
        parent?.closest('a,button,[role="button"]') || parent?.closest(".rots");
      if (host && block.contains(host)) {
        host.after(link);
        record.links.push({ link, left: part.node, right: null });
      } else {
        const left = part.node,
          offset = match.end - part.start;
        // Inserting at a text boundary needs no split and creates no empty nodes.
        const right = offset < left.length ? left.splitText(offset) : null;
        left.after(link);
        record.links.push({ link, left, right });
      }
    }
  }
  function widgetMatch(widget, page, view) {
    const previous = widgetRecords.get(widget);
    if (
      !view.visible(widget) ||
      [...widget.querySelectorAll(".cubelab-link")].some(
        (link) => !previous?.links.some((entry) => entry.link === link),
      )
    )
      return null;
    const raw =
      widget.getAttribute("data-alg") ||
      widget.getAttribute("data-algorithm") ||
      widget.getAttribute("alg") ||
      widget.getAttribute("data-roofpig")?.match(/(?:^|\|)\s*alg=([^|]+)/)?.[1];
    if (!raw) return null;
    const prefs = settings.sitePreferences[location.hostname] || {};
    const puzzle =
      widget.getAttribute("puzzle") || widget.getAttribute("data-puzzle") || "";
    const heading = precedingHeading(widget, page.headings);
    const size =
      Number(prefs.size) ||
      D.inferSize(puzzle) ||
      D.inferSize(heading) ||
      page.size;
    if (
      (!prefs.size && (nonCube(puzzle + " " + heading) || page.nonCube)) ||
      (size && ![2, 3, 4, 5].includes(size))
    )
      return null;
    const match = D.classify(raw, {
      size,
      minMoves: settings.minMoves,
      lowercaseMode: prefs.lowercaseMode || settings.lowercaseMode,
    });
    if (!match) return null;
    const setup = widget.getAttribute("experimental-setup-alg");
    if (setup) {
      if (setup.length > 8000) return null;
      if (match.format === "SSE") {
        const parsed = D.parseSse(setup, match.size);
        if (!parsed) return null;
        match.setup = setup;
      } else {
        const parsed = D.classify(setup, {
          size: match.size,
          minMoves: 1,
          lowercaseMode: match.lowercaseMode,
        });
        if (parsed?.kind !== "moves") return null;
        match.setup = setup;
      }
    }
    return match;
  }
  function scan(force = true) {
    if (running) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    running = true;
    observer.disconnect();
    try {
      if (!document.body) return;
      const all = force || fullScan || count >= 500;
      let roots = all
        ? [document.body]
        : [...dirtyRoots].filter((root) => root.isConnected);
      roots = roots.filter(
        (root) =>
          !roots.some((other) => other !== root && other.contains(root)),
      );
      dirtyRoots.clear();
      fullScan = false;
      for (const records of [blockRecords, widgetRecords]) {
        for (const [owner, record] of records) {
          if (!active() || !owner.isConnected) {
            clearRecord(record);
            records.delete(owner);
          }
        }
      }
      if (!active()) return;
      const page = pageContext(),
        view = visibility();
      let { blocks, widgets } = collect(roots, view);
      const affected = (owner) =>
        all || roots.some((root) => root.contains(owner));
      const changed = new Set();
      let restoredSplits = false;
      for (const [block, item] of blocks) {
        const key = signature(item.text, blockOptions(block, item.text, page));
        if (!recordValid(blockRecords.get(block), key, block))
          changed.add(block);
      }
      for (const [block, record] of blockRecords) {
        if (affected(block) && (!blocks.has(block) || changed.has(block))) {
          restoredSplits ||= record.links.some(({ right }) => right);
          clearRecord(record);
          blockRecords.delete(block);
        }
      }
      for (const [widget, record] of widgetRecords) {
        if (affected(widget) && !widgets.has(widget)) {
          clearRecord(record);
          widgetRecords.delete(widget);
        }
      }
      // Clearing a changed record may have rejoined an extension-created split.
      if (restoredSplits) ({ blocks, widgets } = collect(roots, view));
      for (const [block, item] of blocks) {
        if (!changed.has(block)) continue;
        const options = blockOptions(block, item.text, page);
        decorateBlock(block, item, options, signature(item.text, options));
      }
      for (const widget of widgets) {
        const match = widgetMatch(widget, page, view);
        const key = signature("", match),
          old = widgetRecords.get(widget);
        if (match && old?.key === key && old.links[0].link.isConnected)
          continue;
        if (old) {
          clearRecord(old);
          widgetRecords.delete(widget);
        }
        if (match && ownedLinks.size < 500) {
          const link = makeLink(match);
          if (!link) continue;
          widget.after(link);
          widgetRecords.set(widget, { key, links: [{ link }] });
        }
      }
    } finally {
      count = [...ownedLinks].filter((link) => link.isConnected).length;
      running = false;
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
    }
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === "status")
      respond({ count, hostname: location.hostname, enabled: active() });
    if (message.type === "scan") {
      scan();
      respond({ count });
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      settings = { ...D.DEFAULTS, ...changes.settings.newValue };
      schedule();
    }
  });
  window.addEventListener("resize", () => schedule());
  document.addEventListener(
    "load",
    (event) => {
      if (event.target.matches?.("link[rel=stylesheet]")) schedule();
    },
    true,
  );
  chrome.storage.local.get("settings").then((data) => {
    settings = { ...D.DEFAULTS, ...data.settings };
    scan();
  });
})();
