(function initLocalPocketNotesEditorFrame() {
  if (typeof window === "undefined") return;

  const titleInput = document.querySelector('[data-role="title-input"]');
  const contentInput = document.querySelector('[data-role="content-input"]');
  const editorRoot = document.querySelector(".editor");
  if (!titleInput || !contentInput) return;

  const state = {
    token: "",
    noteId: "",
    themePreset: "classic",
    suppressEmit: false
  };

  function normalizeThemePreset(value) {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    return raw || "classic";
  }

  function applyTheme(themePreset, customColors) {
    state.themePreset = normalizeThemePreset(themePreset);
    document.documentElement.dataset.theme = state.themePreset;
    if (state.themePreset === "custom" && customColors && typeof customColors === "object") {
      const root = document.documentElement;
      function hx(val, fb) {
        return typeof val === "string" && /^#[0-9a-f]{6}$/i.test(val) ? val : fb;
      }
      root.style.setProperty("--bg", hx(customColors.bg, "#1a1a2e"));
      root.style.setProperty("--bg-alt", hx(customColors.bgAlt, "#16213e"));
      root.style.setProperty("--panel", hx(customColors.panel, "#0f3460"));
      root.style.setProperty("--panel-alt", hx(customColors.panelAlt, "#1a1a4e"));
      root.style.setProperty("--ink", hx(customColors.ink, "#e0e0e0"));
      root.style.setProperty("--muted", hx(customColors.muted, "#a0a0b0"));
      root.style.setProperty("--accent", hx(customColors.accent, "#e94560"));
      root.style.setProperty("--accent-2", hx(customColors.accent2, "#f5a623"));
      root.style.setProperty("--accent-3", hx(customColors.accent3, "#533483"));
      root.style.setProperty("--accent-4", hx(customColors.accent4, "#0f3460"));
      root.style.setProperty("--border", hx(customColors.border, "#2a2a4e"));
    }
  }

  function getEditorBaseHeight() {
    const rootRect = editorRoot ? editorRoot.getBoundingClientRect() : null;
    const rootHeight = rootRect && rootRect.height ? rootRect.height : window.innerHeight;
    const rootStyles = editorRoot ? window.getComputedStyle(editorRoot) : null;
    const gap = rootStyles ? (parseFloat(rootStyles.rowGap || rootStyles.gap || "0") || 0) : 0;
    const titleHeight = titleInput.getBoundingClientRect().height || 52;
    const available = rootHeight - titleHeight - gap;
    return Math.max(240, Math.min(900, Math.round(available || window.innerHeight * 0.62)));
  }

  function autoResizeContentInput(options = {}) {
    const keepScroll = options.keepScroll !== false;
    const previousScrollTop = keepScroll ? contentInput.scrollTop : 0;
    const nextHeight = `${getEditorBaseHeight()}px`;
    if (contentInput.style.height !== nextHeight) {
      contentInput.style.height = nextHeight;
    }
    if (keepScroll) {
      const maxScrollTop = Math.max(0, contentInput.scrollHeight - contentInput.clientHeight);
      contentInput.scrollTop = Math.min(previousScrollTop, maxScrollTop);
    }
  }

  const _extensionOrigin = (function() {
    try {
      const api = typeof browser !== "undefined" ? browser : chrome;
      return new URL(api.runtime.getURL("/")).origin;
    } catch (_) {
      return "*";
    }
  })();

  function emitToParent(payload) {
    window.parent.postMessage(payload, "*");
  }

  function emitState(reason) {
    if (!state.token || state.suppressEmit) return;
    emitToParent({
      type: "lp-notes-editor-state",
      token: state.token,
      noteId: state.noteId,
      reason: reason || "",
      title: String(titleInput.value || "").slice(0, 120),
      content: String(contentInput.value || "").slice(0, 200000)
    });
  }

  function setNote(note, noteId) {
    const next = note && typeof note === "object" ? note : {};
    state.noteId = noteId ? String(noteId) : "";
    state.suppressEmit = true;
    titleInput.value = next.title == null ? "" : String(next.title).slice(0, 120);
    contentInput.value = next.content == null ? "" : String(next.content).slice(0, 200000);
    autoResizeContentInput({ keepScroll: false });
    contentInput.scrollTop = 0;
    state.suppressEmit = false;
  }

  function focusTarget(target, selectAll) {
    const isTitle = target === "title";
    const el = isTitle ? titleInput : contentInput;
    el.focus();
    if (selectAll === true && typeof el.select === "function") {
      el.select();
      return;
    }
    if (!isTitle && typeof contentInput.setSelectionRange === "function") {
      const end = contentInput.value.length;
      contentInput.setSelectionRange(end, end);
    }
  }

  function insertContent(text) {
    const value = text == null ? "" : String(text);
    const start = Number.isInteger(contentInput.selectionStart) ? contentInput.selectionStart : contentInput.value.length;
    const end = Number.isInteger(contentInput.selectionEnd) ? contentInput.selectionEnd : contentInput.value.length;
    contentInput.setRangeText(value, start, end, "end");
    autoResizeContentInput();
    contentInput.focus();
    emitState("insert");
  }

  function getCurrentLineRange() {
    const value = contentInput.value || "";
    const start = Number.isInteger(contentInput.selectionStart) ? contentInput.selectionStart : value.length;
    const end = Number.isInteger(contentInput.selectionEnd) ? contentInput.selectionEnd : value.length;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndAt = value.indexOf("\n", end);
    const lineEnd = lineEndAt === -1 ? value.length : lineEndAt;
    return {
      start,
      end,
      lineStart,
      lineEnd,
      line: value.slice(lineStart, lineEnd)
    };
  }

  // ── Hierarchical numbered list helpers ──────────────────────────────────

  // Parse any numbered line: "  1. text", "   1.2. text", "1.2.3. text"
  // Returns { indent, prefix, body } or null
  function parseNumberedLine(line) {
    // Accept both flat "N." and hierarchical "N.N.N." prefixes
    const match = String(line || "").match(/^(\s*)((?:\d+\.)+)\s(.*)$/);
    if (!match) return null;
    return {
      indent: match[1] || "",
      prefix: match[2],            // e.g. "1.", "1.2.", "1.2.3."
      body:   match[3] != null ? match[3] : "",
      // For backward compat with old Enter-handling code
      number: parseInt(match[2], 10) || 0,
      spacing: " "
    };
  }

  // Count indent depth — 1 level = 3 spaces (to match the display in the image)
  const INDENT_UNIT = "   "; // 3 spaces per level

  function indentDepth(indentStr) {
    return Math.round((indentStr || "").length / INDENT_UNIT.length);
  }

  // Given all lines and the current line index, compute the correct hierarchical
  // prefix for a line at the given indent depth.
  function computePrefix(lines, lineIdx, depth) {
    // Walk backwards to find counters for each level
    const counters = new Array(depth + 1).fill(0);
    for (let i = lineIdx; i >= 0; i--) {
      const p = parseNumberedLine(lines[i]);
      if (!p) continue;
      const d = indentDepth(p.indent);
      if (d > depth) continue;       // deeper than us — skip
      if (d < 0) continue;
      if (counters[d] === 0) {
        // Find how many siblings of this depth came before, under the same parent
        let count = 0;
        for (let j = i; j >= 0; j--) {
          const q = parseNumberedLine(lines[j]);
          if (!q) {
            // Non-numbered line — stop searching at this level unless it's blank
            if (lines[j].trim() !== "") break;
            continue;
          }
          const qd = indentDepth(q.indent);
          if (qd < d) break;          // hit parent — stop
          if (qd === d) count++;
        }
        counters[d] = count;
      }
      if (d === 0) break;            // reached top level, done
    }
    // Ensure current item is counted
    counters[depth] = (counters[depth] || 0) + 1;
    // Build prefix from top down: "1.2.3."
    let prefix = "";
    for (let l = 0; l <= depth; l++) {
      prefix += (counters[l] || 1) + ".";
    }
    return prefix;
  }

  // Recompute all numbered prefixes in the document based on indentation.
  // Returns new value string, or null if nothing changed.
  function recomputeAllPrefixes(value) {
    const lines = value.split("\n");
    let changed = false;
    // Track counters per depth, reset when a non-list line appears at level 0
    const counters = [];

    const newLines = lines.map((line) => {
      const p = parseNumberedLine(line);
      if (!p) {
        // Reset top-level counter on blank line (separates sections)
        if (line.trim() === "") {
          counters.length = 0;
        }
        return line;
      }
      const depth = indentDepth(p.indent);
      // Reset any deeper levels
      counters.length = Math.min(counters.length, depth + 1);
      counters[depth] = (counters[depth] || 0) + 1;
      // Build new prefix
      let prefix = "";
      for (let l = 0; l <= depth; l++) {
        prefix += (counters[l] || 1) + ".";
      }
      const newLine = p.indent + prefix + " " + p.body;
      if (newLine !== line) changed = true;
      return newLine;
    });

    return changed ? newLines.join("\n") : null;
  }

  function renumberFollowingLines(caretIndex, indent, insertedNumber) {
    // Legacy — kept for backward compat but recomputeAllPrefixes handles this now
    const value = contentInput.value || "";
    const newVal = recomputeAllPrefixes(value);
    if (!newVal) return false;
    const savedStart = contentInput.selectionStart;
    const savedEnd   = contentInput.selectionEnd;
    contentInput.value = newVal;
    contentInput.setSelectionRange(savedStart, savedEnd);
    return true;
  }

  // Handle Tab / Shift+Tab on a numbered line — indent or outdent
  function maybeHandleTabIndent(event) {
    if (event.target !== contentInput) return false;
    if (event.key !== "Tab") return false;
    if (event.ctrlKey || event.altKey || event.metaKey) return false;

    const value = contentInput.value || "";
    const caret = Number.isInteger(contentInput.selectionStart) ? contentInput.selectionStart : value.length;
    const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
    const lineEndAt = value.indexOf("\n", caret);
    const lineEnd = lineEndAt === -1 ? value.length : lineEndAt;
    const line = value.slice(lineStart, lineEnd);

    const parsed = parseNumberedLine(line);
    if (!parsed) return false; // not a numbered line — let Tab work normally (e.g. indent plain text)

    event.preventDefault();

    const currentDepth = indentDepth(parsed.indent);
    const newDepth = event.shiftKey ? Math.max(0, currentDepth - 1) : currentDepth + 1;
    const newIndent = INDENT_UNIT.repeat(newDepth);

    // Replace this line's indent, use placeholder "0." — recompute will fix prefix
    const newLine = newIndent + "0. " + parsed.body;
    const newValue = value.slice(0, lineStart) + newLine + value.slice(lineEnd);

    // Recompute all prefixes
    const recomputed = recomputeAllPrefixes(newValue) || newValue;

    // Caret: place after the new prefix+space, at the same body offset
    const bodyOffset = Math.max(0, caret - lineStart - parsed.indent.length - parsed.prefix.length - 1);

    contentInput.value = recomputed;

    // Find updated line in recomputed value
    const reLineStart = recomputed.lastIndexOf("\n", lineStart) + 1;
    // lineStart is same since we only changed this line's content, not its position
    const reLine = recomputed.slice(lineStart, recomputed.indexOf("\n", lineStart) === -1 ? recomputed.length : recomputed.indexOf("\n", lineStart));
    const rp = parseNumberedLine(reLine);
    const newBodyStart = rp ? lineStart + rp.indent.length + rp.prefix.length + 1 : lineStart;
    const newCaret = Math.min(newBodyStart + bodyOffset, recomputed.length);

    contentInput.setSelectionRange(newCaret, newCaret);
    autoResizeContentInput();
    emitState("tab-indent");
    return true;
  }

  function maybeHandleAutoNumbering(event) {
    if (event.target !== contentInput) return false;
    if (event.key !== "Enter" || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
    const start = Number.isInteger(contentInput.selectionStart) ? contentInput.selectionStart : contentInput.value.length;
    const end = Number.isInteger(contentInput.selectionEnd) ? contentInput.selectionEnd : contentInput.value.length;
    if (start !== end) return false;
    const value = contentInput.value || "";
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndAt = value.indexOf("\n", start);
    const lineEnd = lineEndAt === -1 ? value.length : lineEndAt;
    const line = value.slice(lineStart, lineEnd);
    const parsed = parseNumberedLine(line);
    if (!parsed) return false;

    // If the body is empty, pressing Enter exits the list
    if (!parsed.body.trim()) {
      event.preventDefault();
      contentInput.setRangeText("", lineStart, lineEnd, "end");
      autoResizeContentInput();
      emitState("auto-number-clear");
      return true;
    }

    event.preventDefault();

    // Insert new line with same indent — prefix will be recomputed
    const newLine = "\n" + parsed.indent + "0. ";
    contentInput.setRangeText(newLine, start, end, "end");

    // Recompute all prefixes
    const newVal = recomputeAllPrefixes(contentInput.value);
    if (newVal !== null) {
      const savedCaret = contentInput.selectionStart;
      contentInput.value = newVal;
      contentInput.setSelectionRange(savedCaret, savedCaret);
    }

    autoResizeContentInput();
    emitState("auto-number");
    return true;
  }

  function handleKeydown(event) {
    const capsLockOn = typeof event.getModifierState === "function" && event.getModifierState("CapsLock");
    const realShift = event.shiftKey && !(capsLockOn && event.key && event.key.length === 1 && /[a-zA-Z]/.test(event.key));
    if ((event.ctrlKey || event.metaKey) && !realShift && String(event.key).toLowerCase() === "s") {
      event.preventDefault();
      emitToParent({
        type: "lp-notes-save-request",
        token: state.token
      });
      return;
    }
    if (event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      emitToParent({
        type: "lp-notes-close-request",
        token: state.token
      });
      return;
    }
    // Bridge shortcut boleh-konfigurasi ke parent overlay. Focus dalam editor
    // (iframe) tak sampai ke window listener parent, jadi hantar event ringkas
    // dan biar parent padankan dgn config. Skip Ctrl+S & Escape (dah dihandle native).
    const isNativeSave = (event.ctrlKey || event.metaKey) && !realShift && String(event.key).toLowerCase() === "s";
    const isNativeClose = event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.metaKey;
    if ((event.ctrlKey || event.altKey || event.metaKey) && !isNativeSave && !isNativeClose) {
      emitToParent({
        type: "lp-notes-shortcut-frame",
        token: state.token,
        event: {
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          metaKey: event.metaKey,
          key: event.key
        }
      });
    }
    maybeHandleAutoNumbering(event);
    if (!event.defaultPrevented) maybeHandleTabIndent(event);
  }

  function handleIncomingMessage(event) {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "lp-notes-init") {
      state.token = data.token ? String(data.token) : "";
      state.noteId = data.noteId ? String(data.noteId) : "";
      applyTheme(data.themePreset, data.customThemeColors);
      setNote(data.note, data.noteId);
      return;
    }
    if (!state.token || data.token !== state.token) return;
    if (data.type === "lp-notes-export-snapshot-request") {
      emitToParent({
        type: "lp-notes-export-snapshot-reply",
        token: state.token,
        title: String(titleInput.value || "").slice(0, 120),
        content: String(contentInput.value || "").slice(0, 200000)
      });
      return;
    }
    if (data.type === "lp-notes-set-note") {
      applyTheme(data.themePreset, data.customThemeColors);
      setNote(data.note, data.noteId);
      return;
    }
    if (data.type === "lp-notes-focus") {
      focusTarget(data.target, data.selectAll === true);
      return;
    }
    if (data.type === "lp-notes-blur") {
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
      return;
    }
    if (data.type === "lp-notes-insert-content") {
      insertContent(data.text);
    }
  }

  async function processImageFile(file) {
    if (!file || !file.type.startsWith("image/")) return null;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  async function handlePaste(event) {
    const clipboard = event.clipboardData || window.clipboardData;
    const items = clipboard ? clipboard.items : null;
    if (!items) return;
    let handled = false;
    for (const item of items) {
      if (item.type.indexOf("image") !== -1) {
        handled = true;
        const file = item.getAsFile();
        const base64 = await processImageFile(file);
        if (base64) {
          insertContent(`\n![Image](${base64})\n`);
        }
      }
    }
    if (handled) {
      event.preventDefault();
    }
  }

  async function handleDrop(event) {
    const files = event.dataTransfer ? event.dataTransfer.files : null;
    if (!files || !files.length) return;
    let handled = false;
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        handled = true;
        const base64 = await processImageFile(file);
        if (base64) {
          insertContent(`\n![Image](${base64})\n`);
        }
      }
    }
    if (handled) {
      event.preventDefault();
    }
  }

  titleInput.addEventListener("input", () => emitState("title-input"));
  titleInput.addEventListener("blur", () => emitState("title-blur"));
  contentInput.addEventListener("input", () => {
    emitState("content-input");
  });
  contentInput.addEventListener("blur", () => emitState("content-blur"));
  contentInput.addEventListener("paste", handlePaste);
  contentInput.addEventListener("dragover", (e) => {
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
    }
  });
  contentInput.addEventListener("drop", handleDrop);
  window.addEventListener("resize", autoResizeContentInput);
  window.addEventListener("message", handleIncomingMessage);
  window.addEventListener("pagehide", () => emitState("pagehide"));
  window.addEventListener("beforeunload", () => emitState("beforeunload"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      emitState("hidden");
    }
  });
  document.addEventListener("keydown", handleKeydown, true);

  applyTheme("classic");
  autoResizeContentInput();
  emitToParent({ type: "lp-notes-editor-ready" });

  // SSS — hantar teks terpilih ke parent bila user select dalam editor
  let _sssDebounceTimer = null;
  let _sssLastText = "";
  let _sssLastPointer = { x: 0, y: 0 };

  // Jejak posisi pointer terakhir supaya parent boleh letakkan popup SSS
  // berhampiran lokasi pilihan teks (koordinat relatif kepada iframe ini).
  document.addEventListener("mousemove", (e) => {
    _sssLastPointer = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    const touch = e.changedTouches && e.changedTouches[0];
    if (touch) _sssLastPointer = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  function getFieldSelection(el) {
    if (!el || typeof el.selectionStart !== "number" || typeof el.selectionEnd !== "number") return "";
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return "";
    return String(el.value || "").slice(start, end);
  }

  function readSelectedText() {
    // window.getSelection() tidak mengembalikan teks dalam <textarea>/<input>,
    // jadi baca terus dari selectionStart/selectionEnd medan yang aktif.
    const active = document.activeElement;
    if (active === contentInput || active === titleInput) {
      return getFieldSelection(active).trim();
    }
    // Fallback: cuba kedua-dua medan, kemudian selection dokumen biasa
    const fromContent = getFieldSelection(contentInput).trim();
    if (fromContent) return fromContent;
    const fromTitle = getFieldSelection(titleInput).trim();
    if (fromTitle) return fromTitle;
    const sel = window.getSelection ? window.getSelection() : null;
    return sel ? sel.toString().trim() : "";
  }

  function emitSelection() {
    const text = readSelectedText();
    if (text === _sssLastText) return;
    _sssLastText = text;
    emitToParent({
      type: "lp-notes-selection",
      text,
      x: _sssLastPointer.x,
      y: _sssLastPointer.y
    });
  }

  function scheduleEmitSelection(delay) {
    if (_sssDebounceTimer) clearTimeout(_sssDebounceTimer);
    _sssDebounceTimer = setTimeout(emitSelection, delay == null ? 120 : delay);
  }

  document.addEventListener("selectionchange", () => scheduleEmitSelection(180));
  // Event "select" pada textarea/input adalah cara paling tepat untuk kesan pilihan teks
  contentInput.addEventListener("select", () => scheduleEmitSelection(80));
  titleInput.addEventListener("select", () => scheduleEmitSelection(80));
  // Kesan pilihan melalui papan kekunci (Shift+Arrow, Ctrl+A) dan bila selection hilang
  contentInput.addEventListener("keyup", () => scheduleEmitSelection(80));
  titleInput.addEventListener("keyup", () => scheduleEmitSelection(80));
  // Juga emit bila mouseup dan touchend supaya lebih responsive
  document.addEventListener("mouseup", () => scheduleEmitSelection(30));
  document.addEventListener("touchend", () => scheduleEmitSelection(80));
  // Reset cache bila fokus berubah supaya pilihan yang sama boleh di-emit semula
  window.addEventListener("focus", () => { _sssLastText = ""; scheduleEmitSelection(80); });
  window.addEventListener("blur", () => { _sssLastText = ""; });
})();
