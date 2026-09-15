(() => {
  "use strict";
  if (globalThis.__cubeLabLinker) return;
  globalThis.__cubeLabLinker = true;
  const D = CubeLabDetector;
  const BLOCK =
    "p,li,td,th,pre,div,section,article,h1,h2,h3,h4,h5,h6,dd,dt,figcaption,body";
  const SKIP =
    'script,style,noscript,textarea,input,select,button,a,svg,canvas,math,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[hidden],[aria-hidden="true"],.cubelab-link';
  const WIDGET =
    "[data-alg],[data-algorithm],[data-roofpig],twisty-player[alg]";
  const CONTEXT = "head,h1,h2,h3,h4,style,link[rel=stylesheet]";
  const blockRecords = new Map(),
    widgetRecords = new Map(),
    ownedLinks = new Set();
  const dirtyRoots = new Set();
  let settings = { ...D.DEFAULTS },
    timer,
    count = 0,
    running = false,
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
  function active() {
    return (
      settings.enabled && !settings.disabledHosts.includes(location.hostname)
    );
  }
  function clearRecord(record) {
    // Undo only extension-created splits, preserving page-owned text nodes.
    for (const { link, left, right } of [...record.links].reverse()) {
      link.remove();
      ownedLinks.delete(link);
      if (right && left.parentNode && left.nextSibling === right) {
        left.appendData(right.data);
        right.remove();
      }
    }
  }
  function makeLink(match) {
    const link = document.createElement("a");
    link.className = "cubelab-link";
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
          : "cycles";
    link.textContent = `↗ CubeLab · ${label}`;
    link.title = `Open ${(match.source || match.notation).slice(0, 300)} in CubeLab`;
    link.setAttribute("aria-label", link.title);
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
      previousBlock = null;
    function append(node, value) {
      const block = elementOf(node)?.closest(BLOCK);
      if (!block) return;
      if (!blocks.has(block)) blocks.set(block, { text: "", parts: [] });
      const item = blocks.get(block);
      if (previousBlock !== block && item.parts.length) item.text += "\0";
      previousBlock = block;
      if (item.text.length > 32000) return;
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
    ]);
  }
  function recordValid(record, key, owner) {
    return (
      record?.key === key &&
      record.complete &&
      record.links.every(({ link }) => owner.contains(link))
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
      const left = part.node,
        offset = match.end - part.start;
      // Inserting at a text boundary needs no split and creates no empty nodes.
      const right = offset < left.length ? left.splitText(offset) : null;
      left.after(link);
      record.links.push({ link, left, right });
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
        match.setup = parsed.moves.join(" ");
      } else {
        const parsed = D.classify(setup, {
          size: match.size,
          minMoves: 1,
          lowercaseMode: match.lowercaseMode,
        });
        if (parsed?.kind !== "moves") return null;
        match.setup = parsed.notation;
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
          if (widget.tagName === "TWISTY-PLAYER") widget.after(link);
          else widget.append(link);
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
