/**
 * core/selectionSearchShared.js
 *
 * Shared Selection-Search (SSS) engine for Local Pocket Reader.
 *
 * This is the SINGLE SOURCE OF TRUTH for the "selection search" popup
 * (__lp_selection_search_popup) and its trigger (__lp_selection_search_trigger).
 * It is consumed by:
 *   - contentScriptSidebarAi.js  (runs inside AI provider iframes; isPanel:false)
 *   - jarvisSidebar.js           (runs inside the JARVIS panel page; isPanel:true)
 *
 * It is intentionally fully self-contained (no dependency on the focus/composer
 * logic in the provider scripts) so it can run both as a content script on a
 * provider page AND as a normal <script> inside the extension's own panel page
 * (content scripts cannot run on extension pages, hence the panel loads this
 * file directly via jarvisSidebar.html).
 *
 * The original SSS implementation lived inline inside contentScriptSidebarAi.js.
 * It was extracted here so the JARVIS panel can reuse the exact same popup /
 * settings without re-implementing it ("jangan reka baru").
 */
(function () {
  "use strict";

  if (window.LPSelectionSearch) return; // idempotent: never double-install

  // ── extension API (overridden in init) ──────────────────────────────────────
  var extensionApi =
    typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);

  // When true we are running inside the JARVIS panel page (chrome-extension://),
  // where there is no AI provider surface — selection search is always active.
  var isPanel = false;

  // Guard so init() can be called more than once safely.
  var initialized = false;

  // Optional hook supplied by the provider script so the switcher host can
  // suppress selection-search handling (provider pages only).
  var hookIsInsideSwitcherHost = function () { return false; };

  // ── defaults (copied verbatim from the original SSS code) ───────────────────
  var DEFAULT_SELECTION_POPUP_SETTINGS = {
    enabled: false,
    openBehavior: "auto",
    minChars: 0,
    maxChars: 0,
    delayMs: 0,
    location: "cursor",
    leftClickAction: "new-background-tab",
    rightClickAction: "new-tab",
    middleClickAction: "new-tab",
    shortcutAction: "new-background-tab",
    allowOnEditable: false,
    hideOnScroll: true,
    hideOnRightClick: true,
    allowShortcutsWithoutPopup: true,
    animationMs: 100,
    autoCopySelection: false
  };
  var DEFAULT_SELECTION_ENGINES_LIST = [
    {
      id: "copy",
      type: "copy",
      name: "Copy to clipboard",
      url: "",
      iconUrl: "",
      showPopup: true,
      showContextMenu: false,
      shortcut: ""
    },
    {
      id: "open-link",
      type: "open-link",
      name: "Open as link",
      url: "",
      iconUrl: "",
      showPopup: true,
      showContextMenu: false,
      shortcut: ""
    },
    {
      id: "google",
      type: "engine",
      name: "Google",
      url: "https://www.google.com/search?q=%s",
      iconUrl: "https://www.google.com/favicon.ico",
      showPopup: true,
      showContextMenu: true,
      shortcut: "G"
    },
    {
      id: "bing",
      type: "engine",
      name: "Bing",
      url: "https://www.bing.com/search?q=%s",
      iconUrl: "https://www.bing.com/sa/simg/favicon-2x.ico",
      showPopup: true,
      showContextMenu: true,
      shortcut: "B"
    },
    {
      id: "ddg",
      type: "engine",
      name: "DuckDuckGo",
      url: "https://duckduckgo.com/?q=%s",
      iconUrl: "https://duckduckgo.com/favicon.ico",
      showPopup: true,
      showContextMenu: true,
      shortcut: "D"
    }
  ];

  // ── runtime state ───────────────────────────────────────────────────────────
  var selectionSearchPopupSettings = { ...DEFAULT_SELECTION_POPUP_SETTINGS };
  var selectionSearchEnginesList = DEFAULT_SELECTION_ENGINES_LIST.map((entry) => ({ ...entry }));
  var selectionSearchPopupSignature = "";
  var selectionSearchTriggerSignature = "";
  var selectionSearchLastPointer = { x: 0, y: 0 };
  var selectionSearchPopupTimer = null;
  var selectionSearchPopupManualPosition = null;
  var selectionSearchPopupPositionLoaded = false;
  var selectionSearchPopupPositionLoadPending = false;
  var selectionSearchMouseDown = false;
  var selectionSearchMouseDownAt = 0; // masa mousedown terakhir (ms)
  var SELECTION_POPUP_MOUSEDOWN_MAX_MS = 1200; // had: selepas ini, anggap mouseup terlepas
  var SELECTION_POPUP_POSITION_KEY = "__lpSelectionSearchPopupPosition";

  // ── provider / surface detection (self-contained) ───────────────────────────
  var PROVIDER_HOSTS = {
    chatgpt: ["chatgpt.com", "www.chatgpt.com", "chat.openai.com", "www.chat.openai.com"],
    claude: ["claude.ai"],
    gemini: ["gemini.google.com", "www.gemini.google.com", "gemini.googleusercontent.com", "www.gemini.googleusercontent.com"],
    perplexity: ["perplexity.ai"],
    copilot: ["copilot.microsoft.com"],
    grok: ["grok.com"],
    deepseek: ["deepseek.com"],
    poe: ["poe.com"],
    mistral: ["chat.mistral.ai"],
    notebooklm: ["notebooklm.google.com", "www.notebooklm.google.com"]
  };
  var PROVIDER_LABELS = {
    chatgpt: "ChatGPT",
    claude: "Claude",
    gemini: "Gemini",
    perplexity: "Perplexity",
    copilot: "Copilot",
    grok: "Grok",
    deepseek: "DeepSeek",
    poe: "Poe",
    mistral: "Mistral",
    notebooklm: "NotebookLM"
  };

  function hostToProvider(hostname) {
    var host = String(hostname || "").toLowerCase();
    var keys = Object.keys(PROVIDER_HOSTS);
    for (var i = 0; i < keys.length; i++) {
      var patterns = PROVIDER_HOSTS[keys[i]];
      if (!Array.isArray(patterns)) continue;
      var matches = patterns.some(function (pattern) { return host === pattern || host.endsWith("." + pattern); });
      if (matches) return keys[i];
    }
    return "";
  }
  function normalizeProvider(value) {
    var key = value ? String(value).trim().toLowerCase() : "";
    return Object.prototype.hasOwnProperty.call(PROVIDER_HOSTS, key) ? key : "";
  }
  function providerLabel(provider) {
    var key = normalizeProvider(provider);
    return key && PROVIDER_LABELS[key] ? PROVIDER_LABELS[key] : "AI";
  }
  function currentProviderFromHost() {
    return hostToProvider(window.location.hostname || "");
  }
  function providerFromReferrer() {
    var refHost = "";
    try { refHost = new URL(String(document.referrer || "")).hostname || ""; } catch (err) { refHost = ""; }
    return hostToProvider(refHost);
  }
  function detectProvider() {
    var fromHost = currentProviderFromHost();
    if (fromHost) return fromHost;
    try {
      var hostname = window.location.hostname.toLowerCase();
      if (hostname === "gemini.google.com" || hostname.endsWith(".gemini.google.com")) return "gemini";
      if (hostname === "notebooklm.google.com" || hostname.endsWith(".notebooklm.google.com")) return "notebooklm";
    } catch (err) {}
    return providerFromReferrer();
  }
  var CONTEXT_CHECK_THROTTLE_MS = 100;
  var lastSidebarContextCheck = 0;
  var lastLikelySidebarSurfaceCheck = 0;
  function isSidebarContext() {
    var now = Date.now();
    if (now - lastSidebarContextCheck < CONTEXT_CHECK_THROTTLE_MS) {
      return window.__lpCachedSidebarContext || false;
    }
    lastSidebarContextCheck = now;
    try {
      var params = new URLSearchParams(window.location.search || "");
      if (params.get("lp_sidebar") === "1" || params.get("lp_popup") === "1") {
        try { window.sessionStorage.setItem("__lpSidebarContext", "1"); } catch (err) {}
        window.__lpCachedSidebarContext = true;
        return true;
      }
      try {
        var sessionVal = window.sessionStorage.getItem("__lpSidebarContext");
        if (sessionVal === "1") {
          var currentHref = window.location.href || "";
          var looksSidebar = currentHref.includes("lp_sidebar=1")
            || currentHref.includes("lp_popup=1")
            || window.name === "__LP_SIDEBAR__"
            || window.name === "__LP_OVERLAY__"
            || (typeof window.innerWidth === "number" && window.innerWidth < 900);
          if (!looksSidebar) {
            try { window.sessionStorage.removeItem("__lpSidebarContext"); } catch (_) {}
            window.__lpCachedSidebarContext = false;
            return false;
          }
          window.__lpCachedSidebarContext = true;
          return true;
        }
      } catch (err) {}
    } catch (err) {}
    var windowNameCheck = window.name === "__LP_SIDEBAR__" || window.name === "__LP_OVERLAY__" || window.innerWidth < 900;
    window.__lpCachedSidebarContext = windowNameCheck;
    return windowNameCheck;
  }
  function isLikelySidebarSurface() {
    var now = Date.now();
    if (now - lastLikelySidebarSurfaceCheck < CONTEXT_CHECK_THROTTLE_MS) {
      return window.__lpCachedLikelySidebarSurface || false;
    }
    lastLikelySidebarSurfaceCheck = now;
    if (isSidebarContext()) {
      window.__lpCachedLikelySidebarSurface = true;
      return true;
    }
    var provider = detectProvider();
    if (provider) {
      window.__lpCachedLikelySidebarSurface = true;
      return true;
    }
    try {
      var ref = String(document.referrer || "").toLowerCase();
      if (ref.includes("lp_sidebar=1") || ref.includes("sidebar.html")) {
        window.__lpCachedLikelySidebarSurface = true;
        return true;
      }
    } catch (err) {}
    var innerWidthCheck = typeof window.innerWidth === "number" && window.innerWidth < 900;
    window.__lpCachedLikelySidebarSurface = innerWidthCheck;
    return innerWidthCheck;
  }

  // In the panel we are always an active surface; on provider pages we defer to
  // the existing surface detection so behavior is unchanged.
  function isActiveSurface() {
    if (isPanel) return true;
    try { return isLikelySidebarSurface(); } catch (e) { return false; }
  }

  // ── small generic helpers (also used by provider focus code; copied) ────────
  function isTextEditableElement(target) {
    if (!target) return false;
    var tag = target.tagName ? String(target.tagName).toUpperCase() : "";
    if (tag === "TEXTAREA" || tag === "INPUT") return true;
    if (target.isContentEditable) return true;
    try {
      var ce = target.getAttribute ? String(target.getAttribute("contenteditable") || "").toLowerCase() : "";
      return ce === "true" || ce === "plaintext-only";
    } catch (err) { return false; }
  }
  function getDeepActiveElement(root) {
    root = root || document;
    var active = root && root.activeElement ? root.activeElement : null;
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active;
  }
  function isNodeInsideEditable(node) {
    if (!node) return false;
    var current = node.nodeType === 1 ? node : node.parentElement;
    while (current) {
      if (isTextEditableElement(current)) return true;
      current = current.parentElement;
    }
    return false;
  }
  function isEventInsideEditable(event) {
    if (!event) return false;
    if (typeof event.composedPath === "function") {
      var path = event.composedPath();
      for (var i = 0; i < path.length; i++) {
        if (isTextEditableElement(path[i])) return true;
      }
    }
    return isTextEditableElement(event.target) || isTextEditableElement(getDeepActiveElement());
  }

  // ── selection text helpers ──────────────────────────────────────────────────
  function sanitizeSelectionText(raw) {
    return String(raw || "").replace(/\s+/g, " ").trim().slice(0, 500);
  }
  function getSelectionText() {
    var selection = window.getSelection ? window.getSelection() : null;
    if (!selection || selection.isCollapsed || !selection.rangeCount) return "";
    try {
      var r = selection.getRangeAt(0);
      var txt = r.toString() || "";
      if (!txt.trim()) { try { txt = (r.cloneContents().textContent || "").trim(); } catch (e3) {} }
      return sanitizeSelectionText(txt);
    } catch (e) { return sanitizeSelectionText(selection.toString()); }
  }
  async function copyTextToClipboard(text) {
    var value = String(text || "");
    if (!value) return false;
    // Simpan pilihan semasa supaya penyalinan (textarea sementara di bawah)
    // TIDAK mengcollapse pilihan pengguna — kalau tidak, popup SSS tersembunyi
    // dan tak muncul lagi selepas pilihan pertama.
    var sel = window.getSelection ? window.getSelection() : null;
    var savedRange = null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      try { savedRange = sel.getRangeAt(0).cloneRange(); } catch (e0) {}
    }
    try {
      if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(value);
        restoreSelection(sel, savedRange);
        return true;
      }
    } catch (err) {}
    try {
      var area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "readonly");
      area.style.position = "fixed";
      area.style.opacity = "0";
      area.style.pointerEvents = "none";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.focus();
      area.select();
      var ok = document.execCommand ? document.execCommand("copy") : false;
      if (area.parentNode) area.parentNode.removeChild(area);
      restoreSelection(sel, savedRange);
      return !!ok;
    } catch (err) {
      restoreSelection(sel, savedRange);
      return false;
    }
  }
  function restoreSelection(sel, savedRange) {
    if (!sel || !savedRange) return;
    try { sel.removeAllRanges(); sel.addRange(savedRange); } catch (e) {}
  }
  function hasActiveSelection() {
    try {
      var selection = window.getSelection ? window.getSelection() : null;
      return !!(selection && selection.rangeCount > 0 && !selection.isCollapsed);
    } catch (err) { return false; }
  }

  // ── settings normalization (copied verbatim from the original) ──────────────
  function applySelectionSearchSettings(rawSettings) {
    var settings = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
    var popupRaw = settings.selectionSearchPopup && typeof settings.selectionSearchPopup === "object"
      ? settings.selectionSearchPopup
      : {};
    var listRaw = Array.isArray(settings.selectionSearchEnginesList)
      ? settings.selectionSearchEnginesList
      : [];
    var legacyEngines = settings.selectionSearchEngines && typeof settings.selectionSearchEngines === "object"
      ? settings.selectionSearchEngines
      : {};
    var legacyOrder = Array.isArray(settings.selectionSearchOrder)
      ? settings.selectionSearchOrder
      : [];

    var normalizeAction = function (value, fallback) {
      var raw = typeof value === "string" ? value.trim().toLowerCase() : "";
      if (["new-tab", "new-background-tab", "same-tab"].includes(raw)) return raw;
      return fallback;
    };

    var normalizePopup = function () {
      var minCharsRaw = Number.parseInt(popupRaw.minChars, 10);
      var maxCharsRaw = Number.parseInt(popupRaw.maxChars, 10);
      var delayRaw = Number.parseInt(popupRaw.delayMs, 10);
      var animRaw = Number.parseInt(popupRaw.animationMs, 10);
      var openBehavior = typeof popupRaw.openBehavior === "string"
        ? popupRaw.openBehavior.trim().toLowerCase()
        : DEFAULT_SELECTION_POPUP_SETTINGS.openBehavior;
      var location = typeof popupRaw.location === "string"
        ? popupRaw.location.trim().toLowerCase()
        : DEFAULT_SELECTION_POPUP_SETTINGS.location;
      return {
        enabled: popupRaw.enabled === true,
        openBehavior: openBehavior === "manual" ? "manual" : "auto",
        minChars: Number.isFinite(minCharsRaw) ? Math.max(0, minCharsRaw) : DEFAULT_SELECTION_POPUP_SETTINGS.minChars,
        maxChars: Number.isFinite(maxCharsRaw) ? Math.max(0, maxCharsRaw) : DEFAULT_SELECTION_POPUP_SETTINGS.maxChars,
        delayMs: Number.isFinite(delayRaw) ? Math.min(Math.max(delayRaw, 0), 5000) : DEFAULT_SELECTION_POPUP_SETTINGS.delayMs,
        location: location === "selection" ? "selection" : "cursor",
        leftClickAction: normalizeAction(popupRaw.leftClickAction, DEFAULT_SELECTION_POPUP_SETTINGS.leftClickAction),
        rightClickAction: normalizeAction(popupRaw.rightClickAction, DEFAULT_SELECTION_POPUP_SETTINGS.rightClickAction),
        middleClickAction: normalizeAction(popupRaw.middleClickAction, DEFAULT_SELECTION_POPUP_SETTINGS.middleClickAction),
        shortcutAction: normalizeAction(popupRaw.shortcutAction, DEFAULT_SELECTION_POPUP_SETTINGS.shortcutAction),
        allowOnEditable: popupRaw.allowOnEditable === true,
        hideOnScroll: popupRaw.hideOnScroll !== false,
        hideOnRightClick: popupRaw.hideOnRightClick !== false,
        allowShortcutsWithoutPopup: popupRaw.allowShortcutsWithoutPopup !== false,
        animationMs: Number.isFinite(animRaw)
          ? Math.min(Math.max(animRaw, 0), 1200)
          : DEFAULT_SELECTION_POPUP_SETTINGS.animationMs,
        autoCopySelection: false
      };
    };

    var normalizeShortcut = function (value) {
      var raw = typeof value === "string" ? value.trim() : "";
      if (!raw) return "";
      if (raw.length === 1) return raw.toUpperCase();
      return raw.slice(0, 2).toUpperCase();
    };

    var normalizeEngineEntry = function (entry, index) {
      var raw = entry && typeof entry === "object" ? entry : {};
      var id = raw.id ? String(raw.id).trim() : "engine-" + index;
      var typeRaw = raw.type ? String(raw.type).trim().toLowerCase() : "engine";
      var type = ["engine", "copy", "open-link", "separator", "group"].includes(typeRaw) ? typeRaw : "engine";
      var name = raw.name ? String(raw.name).trim() : (type === "separator" ? "Separator" : "Engine");
      return {
        id: id.slice(0, 60),
        type,
        name: name.slice(0, 80),
        url: raw.url ? String(raw.url).trim().slice(0, 500) : "",
        iconUrl: raw.iconUrl ? String(raw.iconUrl).trim().slice(0, 500) : "",
        showPopup: raw.showPopup !== false && type !== "group" && type !== "separator",
        showContextMenu: raw.showContextMenu === true,
        shortcut: normalizeShortcut(raw.shortcut)
      };
    };

    var mapLegacyEngines = function () {
      var list = [];
      var seen = new Set();
      legacyOrder.forEach(function (id) {
        var key = String(id || "").trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        var entry = legacyEngines[key];
        if (!entry) return;
        list.push({
          id: key,
          type: key === "copy" ? "copy" : "engine",
          name: entry.label || key,
          url: entry.url || "",
          iconUrl: "",
          showPopup: entry.enabled !== false,
          showContextMenu: false,
          shortcut: ""
        });
      });
      return list.length ? list : DEFAULT_SELECTION_ENGINES_LIST.map(function (e) { return { ...e }; });
    };

    selectionSearchPopupSettings = normalizePopup();
    selectionSearchEnginesList = listRaw.length
      ? listRaw.map(function (entry, idx) { return normalizeEngineEntry(entry, idx); })
      : mapLegacyEngines();

    if (!selectionSearchPopupSettings.enabled) {
      selectionSearchPopupSignature = "";
      selectionSearchTriggerSignature = "";
      hideSelectionSearchPopup();
      hideSelectionSearchTrigger();
    }
  }

  // Public alias.
  function applySettings(rawSettings) {
    applySelectionSearchSettings(rawSettings);
  }

  // ── selection-search popup internals ───────────────────────────────────────
  function isSelectionInsideNotesOverlay() {
    var sel = window.getSelection ? window.getSelection() : null;
    if (!sel || sel.isCollapsed) return false;
    var node = sel.anchorNode;
    if (!node) return false;
    if (node.nodeType === 3) node = node.parentNode;
    var host = document.getElementById("__lp_notes_overlay_root");
    if (!host) return false;
    if (host.contains(node)) return true;
    if (node.getRootNode && typeof node.getRootNode === "function") {
      var root = node.getRootNode();
      if (root && root.host === host) return true;
    }
    return false;
  }

  var lastAutoCopiedSelectionText = "";
  function maybeAutoCopySelection() {
    if (selectionSearchPopupSettings.autoCopySelection !== true) return;
    if (!isActiveSurface()) return;
    if (isSelectionInsideNotesOverlay()) return;
    var sel = window.getSelection ? window.getSelection() : null;
    if (!sel || sel.isCollapsed) {
      lastAutoCopiedSelectionText = "";
      return;
    }
    if (!selectionSearchPopupSettings.allowOnEditable) {
      if (isNodeInsideEditable(sel.anchorNode) || isNodeInsideEditable(sel.focusNode)) return;
    }
    var text = sanitizeSelectionText(sel.toString());
    if (!text) return;
    var len = text.length;
    var minChars = Number.isFinite(selectionSearchPopupSettings.minChars) ? selectionSearchPopupSettings.minChars : 0;
    var maxChars = Number.isFinite(selectionSearchPopupSettings.maxChars) ? selectionSearchPopupSettings.maxChars : 0;
    if (minChars > 0 && len < minChars) return;
    if (maxChars > 0 && len > maxChars) return;
    if (text === lastAutoCopiedSelectionText) return;
    lastAutoCopiedSelectionText = text;
    copyTextToClipboard(text).catch(function () {});
  }

  function shouldShowSelectionPopup() {
    if (!selectionSearchPopupSettings || selectionSearchPopupSettings.enabled !== true) return false;
    var selection = window.getSelection ? window.getSelection() : null;
    if (!selection || selection.isCollapsed) return false;
    if (isSelectionInsideNotesOverlay()) return false;
    if (!selectionSearchPopupSettings.allowOnEditable) {
      if (isNodeInsideEditable(selection.anchorNode) || isNodeInsideEditable(selection.focusNode)) return false;
    }
    var text = "";
    try {
      var r = selection.getRangeAt(0);
      text = sanitizeSelectionText(r.toString() || "");
      if (!text) { try { text = sanitizeSelectionText((r.cloneContents().textContent || "").trim()); } catch (e3) {} }
    } catch (eRange) {}
    if (!text) return false;
    var length = text.length;
    var minChars = Number.isFinite(selectionSearchPopupSettings.minChars) ? selectionSearchPopupSettings.minChars : 0;
    var maxChars = Number.isFinite(selectionSearchPopupSettings.maxChars) ? selectionSearchPopupSettings.maxChars : 0;
    if (minChars > 0 && length < minChars) return false;
    if (maxChars > 0 && length > maxChars) return false;
    return true;
  }

  function getSelectionRect() {
    var selection = window.getSelection ? window.getSelection() : null;
    if (!selection || selection.rangeCount === 0) return null;
    try {
      var range = selection.getRangeAt(0);
      var rect = range.getBoundingClientRect();
      if (rect && rect.width >= 0 && rect.height >= 0) return rect;
    } catch (err) {}
    return null;
  }

  function openSelectionSearchUrl(url, action) {
    if (!url) return;
    if (action === "same-tab") {
      window.location.href = url;
      return;
    }
    var active = action !== "new-background-tab";
    try {
      if (extensionApi && extensionApi.runtime && extensionApi.runtime.sendMessage) {
        extensionApi.runtime.sendMessage({ type: "selection-search-open-url", url: url, active: active }).catch(function () {});
        return;
      }
    } catch (_err) {}
    window.open(url, "_blank");
  }

  function buildSelectionSearchUrl(entry, query) {
    if (!entry) return "";
    if (entry.type === "open-link") {
      var raw = query.trim();
      if (!raw) return "";
      try {
        if (/^https?:\/\//i.test(raw)) return new URL(raw).toString();
        return new URL("https://" + raw).toString();
      } catch (_err) { return ""; }
    }
    if (entry.type === "engine") {
      var rawUrl = entry.url || "";
      if (!rawUrl) return "";
      var encoded = encodeURIComponent(query);
      if (/%s/i.test(rawUrl)) return rawUrl.replace(/%s/gi, encoded);
      if (/\{searchTerms\}/i.test(rawUrl)) return rawUrl.replace(/\{searchTerms\}/gi, encoded);
      return rawUrl + encoded;
    }
    return "";
  }

  function handleSelectionEngineActivate(entry, button) {
    if (!entry) return;
    var query = getSelectionText();
    if (!query) return;
    if (entry.type === "copy") {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(query).catch(function () {});
      }
      if (selectionSearchPopupSettings.hideOnEngineClick) {
        hideSelectionSearchPopup();
        hideSelectionSearchTrigger();
      }
      return;
    }
    var action = button === 1
      ? selectionSearchPopupSettings.middleClickAction
      : (button === 2 ? selectionSearchPopupSettings.rightClickAction : selectionSearchPopupSettings.leftClickAction);
    var url = buildSelectionSearchUrl(entry, query);
    if (url) openSelectionSearchUrl(url, action);
    if (selectionSearchPopupSettings.hideOnEngineClick) {
      hideSelectionSearchPopup();
      hideSelectionSearchTrigger();
    }
  }

  function ensureSelectionSearchPopup() {
    if (!isActiveSurface()) return null;
    if (!selectionSearchPopupSettings.enabled) return null;
    var popup = document.getElementById("__lp_selection_search_popup");
    var signature = JSON.stringify({
      settings: selectionSearchPopupSettings,
      engines: selectionSearchEnginesList.map(function (entry) {
        return {
          id: entry.id,
          name: entry.name,
          type: entry.type,
          iconUrl: entry.iconUrl,
          showPopup: entry.showPopup,
          shortcut: entry.shortcut
        };
      })
    });
    if (popup && selectionSearchPopupSignature === signature) return popup;
    selectionSearchPopupSignature = signature;
    popup = document.createElement("div");
    popup.id = "__lp_selection_search_popup";
    popup.style.cssText = "position:fixed;z-index:2147483001;display:none;flex-direction:column;align-items:stretch;gap:8px;width:min(240px,calc(100vw - 20px));max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);padding:10px;border-radius:14px;border:1px solid rgba(255,255,255,0.12);background:linear-gradient(180deg,rgba(23,26,38,0.99),rgba(13,15,23,0.99));color:#eef2ff;font-size:12px;font-weight:600;box-shadow:0 20px 46px rgba(0,0,0,0.5);overflow:hidden;";
    var duration = Number.isFinite(selectionSearchPopupSettings.animationMs)
      ? selectionSearchPopupSettings.animationMs
      : 100;
    popup.style.transition = "opacity " + duration + "ms ease, transform " + duration + "ms ease";
    popup.style.opacity = "0";
    popup.style.transform = "translateY(8px) scale(0.985)";

    var header = document.createElement("div");
    header.style.cssText = "display:flex;flex-direction:column;gap:3px;padding:2px 2px 4px;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;";
    var titleRow = document.createElement("div");
    titleRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;";
    var title = document.createElement("div");
    title.textContent = "SSS Sidebar";
    title.style.cssText = "font-size:13px;font-weight:700;color:#ffffff;";
    var settingsBtn = document.createElement("button");
    settingsBtn.type = "button";
    settingsBtn.title = "Buka tetapan SSS Search";
    settingsBtn.textContent = "⚙";
    settingsBtn.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.55);font-size:13px;cursor:pointer;transition:background 0.14s ease,color 0.14s ease,border-color 0.14s ease;flex-shrink:0;";
    settingsBtn.addEventListener("mouseenter", function () {
      settingsBtn.style.background = "rgba(99,179,237,0.18)";
      settingsBtn.style.borderColor = "rgba(99,179,237,0.4)";
      settingsBtn.style.color = "#90cdf4";
    });
    settingsBtn.addEventListener("mouseleave", function () {
      settingsBtn.style.background = "rgba(255,255,255,0.04)";
      settingsBtn.style.borderColor = "rgba(255,255,255,0.1)";
      settingsBtn.style.color = "rgba(255,255,255,0.55)";
    });
    settingsBtn.addEventListener("mousedown", function (ev) { ev.stopPropagation(); });
    settingsBtn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      try { extensionApi.runtime.sendMessage({ type: "open-sss-settings" }).catch(function () {}); } catch (_) {}
    });
    titleRow.append(title, settingsBtn);
    var subtitle = document.createElement("div");
    subtitle.textContent = "Pilih enjin carian untuk teks terpilih.";
    subtitle.style.cssText = "font-size:11px;color:rgba(255,255,255,0.6);";
    header.append(titleRow, subtitle);
    popup.appendChild(header);

    var options = document.createElement("div");
    options.style.cssText = "display:flex;flex-direction:column;gap:5px;flex:1 1 auto;max-height:min(calc(100vh - 92px),320px);overflow-y:auto;padding-right:2px;";
    popup.appendChild(options);
    selectionSearchEnginesList.forEach(function (entry) {
      if (!entry) return;
      if (entry.type === "separator") {
        var sep = document.createElement("div");
        sep.style.cssText = "height:1px;background:rgba(255,255,255,0.08);margin:3px 0;";
        options.appendChild(sep);
        return;
      }
      if (entry.type === "group") {
        var group = document.createElement("div");
        group.textContent = entry.name || "Group";
        group.style.cssText = "padding:3px 2px 1px;color:rgba(255,255,255,0.48);font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;";
        options.appendChild(group);
        return;
      }
      if (entry.showPopup !== true) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:9px 11px;border-radius:11px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.03);color:#edf2ff;font-size:12px;cursor:pointer;text-align:left;transition:background 0.14s ease,border-color 0.14s ease,transform 0.14s ease;user-select:none;-webkit-user-select:none;touch-action:manipulation;";
      btn.addEventListener("mouseenter", function () {
        btn.style.background = "rgba(255,214,51,0.12)";
        btn.style.borderColor = "rgba(255,214,51,0.24)";
        btn.style.transform = "translateY(-1px)";
      });
      btn.addEventListener("mouseleave", function () {
        btn.style.background = "rgba(255,255,255,0.03)";
        btn.style.borderColor = "rgba(255,255,255,0.06)";
        btn.style.transform = "translateY(0)";
      });

      var left = document.createElement("span");
      left.style.cssText = "display:inline-flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto;";
      left.style.pointerEvents = "none";
      if (entry.iconUrl) {
        var icon = document.createElement("img");
        icon.src = entry.iconUrl;
        icon.alt = "";
        icon.style.cssText = "width:16px;height:16px;border-radius:4px;object-fit:cover;flex:0 0 auto;";
        left.appendChild(icon);
      } else {
        var bullet = document.createElement("span");
        bullet.textContent = (entry.name || "S").slice(0, 1).toUpperCase();
        bullet.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:999px;background:rgba(255,214,51,0.16);color:#ffe38a;font-size:10px;font-weight:700;flex:0 0 auto;";
        left.appendChild(bullet);
      }
      var text = document.createElement("span");
      text.textContent = entry.name || "Engine";
      text.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;";
      left.appendChild(text);

      var shortcut = document.createElement("span");
      shortcut.textContent = entry.shortcut ? entry.shortcut.toUpperCase() : "";
      shortcut.style.cssText = "flex:0 0 auto;padding:2px 6px;border-radius:999px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.55);font-size:10px;font-weight:700;min-width:22px;text-align:center;";
      shortcut.style.pointerEvents = "none";

      btn.append(left, shortcut);
      btn.addEventListener("mousedown", function (ev) {
        if (typeof ev.button === "number" && ev.button === 0) ev.preventDefault();
      });
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        handleSelectionEngineActivate(entry, 0);
      });
      btn.addEventListener("auxclick", function (ev) {
        if (typeof ev.button !== "number" || ev.button !== 1) return;
        ev.preventDefault();
        ev.stopPropagation();
        handleSelectionEngineActivate(entry, 1);
      });
      btn.addEventListener("contextmenu", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        handleSelectionEngineActivate(entry, 2);
      });
      btn.addEventListener("dragstart", function (ev) { ev.preventDefault(); });
      options.appendChild(btn);
    });
    attachSelectionSearchPopupDrag(popup, header);
    (document.body || document.documentElement).appendChild(popup);
    return popup;
  }

  function clampSelectionPopupPosition(element, left, top) {
    var margin = 8;
    var width = Math.max(
      Number(element && element.offsetWidth) || 0,
      Number(element && element.scrollWidth) || 0,
      160
    );
    var height = Math.max(
      Number(element && element.offsetHeight) || 0,
      Number(element && element.scrollHeight) || 0,
      120
    );
    var maxLeft = Math.max(margin, window.innerWidth - width - margin);
    var maxTop = Math.max(margin, window.innerHeight - height - margin);
    return {
      left: Math.max(margin, Math.min(left, maxLeft)),
      top: Math.max(margin, Math.min(top, maxTop))
    };
  }
  function applySelectionPopupPosition(element, left, top) {
    if (!element) return;
    var next = clampSelectionPopupPosition(element, left, top);
    element.style.left = next.left + "px";
    element.style.top = next.top + "px";
  }
  function normalizeSelectionPopupPosition(value) {
    if (!value || typeof value !== "object") return null;
    var left = Number(value.left);
    var top = Number(value.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { left: left, top: top };
  }
  function persistSelectionPopupManualPosition() {
    if (
      !selectionSearchPopupManualPosition
      || !extensionApi
      || !extensionApi.storage
      || !extensionApi.storage.local
      || !extensionApi.storage.local.set
    ) {
      return;
    }
    var payload = {};
    payload[SELECTION_POPUP_POSITION_KEY] = {
      left: selectionSearchPopupManualPosition.left,
      top: selectionSearchPopupManualPosition.top
    };
    try {
      var maybePromise = extensionApi.storage.local.set(payload);
      if (maybePromise && typeof maybePromise.catch === "function") {
        maybePromise.catch(function () {});
      }
    } catch (err) {
      try {
        extensionApi.storage.local.set(payload, function () {
          void (extensionApi.runtime && extensionApi.runtime.lastError);
        });
      } catch (innerErr) {}
    }
  }
  function readLocalStorageValue(key, done) {
    var finish = function (value) {
      try { done(value); } catch (err) {}
    };
    if (!extensionApi.storage || !extensionApi.storage.local || !extensionApi.storage.local.get) {
      finish(null);
      return;
    }
    try {
      var maybePromise = extensionApi.storage.local.get(key);
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then(function (result) {
            if (!result || typeof result !== "object") { finish(null); return; }
            finish(result[key]);
          })
          .catch(function () { finish(null); });
        return;
      }
      if (maybePromise && typeof maybePromise === "object") {
        finish(maybePromise[key]);
        return;
      }
    } catch (err) {}
    try {
      extensionApi.storage.local.get(key, function (result) {
        var runtimeErr = extensionApi.runtime && extensionApi.runtime.lastError;
        if (runtimeErr || !result || typeof result !== "object") { finish(null); return; }
        finish(result[key]);
      });
    } catch (err) { finish(null); }
  }
  function loadSelectionPopupManualPosition() {
    if (selectionSearchPopupPositionLoaded || selectionSearchPopupPositionLoadPending) return;
    selectionSearchPopupPositionLoadPending = true;
    readLocalStorageValue(SELECTION_POPUP_POSITION_KEY, function (value) {
      selectionSearchPopupPositionLoadPending = false;
      selectionSearchPopupPositionLoaded = true;
      if (!selectionSearchPopupManualPosition) {
        selectionSearchPopupManualPosition = normalizeSelectionPopupPosition(value);
      }
      var popup = document.getElementById("__lp_selection_search_popup");
      if (
        popup
        && popup.style.display !== "none"
        && selectionSearchPopupManualPosition
      ) {
        applySelectionPopupPosition(
          popup,
          selectionSearchPopupManualPosition.left,
          selectionSearchPopupManualPosition.top
        );
      }
    });
  }
  function attachSelectionSearchPopupDrag(popup, handle) {
    if (!popup || !handle || popup.__lpDragBound) return;
    popup.__lpDragBound = true;
    var dragPointerId = null;
    var dragStartX = 0;
    var dragStartY = 0;
    var dragOriginLeft = 0;
    var dragOriginTop = 0;

    var finishDrag = function (event) {
      if (dragPointerId === null) return;
      if (event && typeof event.pointerId === "number" && event.pointerId !== dragPointerId) return;
      if (handle.releasePointerCapture) {
        try { handle.releasePointerCapture(dragPointerId); } catch (err) {}
      }
      dragPointerId = null;
      handle.style.cursor = "grab";
      persistSelectionPopupManualPosition();
    };

    handle.addEventListener("pointerdown", function (event) {
      if (!popup.isConnected || popup.style.display === "none") return;
      if (typeof event.button === "number" && event.button !== 0) return;
      if (event.target && typeof event.target.closest === "function" && event.target.closest("button, input, select, textarea, a")) {
        return;
      }
      event.preventDefault();
      var rect = popup.getBoundingClientRect();
      dragPointerId = typeof event.pointerId === "number" ? event.pointerId : 1;
      dragStartX = Number.isFinite(event.clientX) ? event.clientX : rect.left;
      dragStartY = Number.isFinite(event.clientY) ? event.clientY : rect.top;
      dragOriginLeft = rect.left;
      dragOriginTop = rect.top;
      handle.style.cursor = "grabbing";
      if (handle.setPointerCapture) {
        try { handle.setPointerCapture(dragPointerId); } catch (err) {}
      }
    });

    handle.addEventListener("pointermove", function (event) {
      if (dragPointerId === null) return;
      if (typeof event.pointerId === "number" && event.pointerId !== dragPointerId) return;
      event.preventDefault();
      var clientX = Number.isFinite(event.clientX) ? event.clientX : dragStartX;
      var clientY = Number.isFinite(event.clientY) ? event.clientY : dragStartY;
      var nextLeft = dragOriginLeft + (clientX - dragStartX);
      var nextTop = dragOriginTop + (clientY - dragStartY);
      var clamped = clampSelectionPopupPosition(popup, nextLeft, nextTop);
      selectionSearchPopupManualPosition = { left: clamped.left, top: clamped.top };
      popup.style.left = clamped.left + "px";
      popup.style.top = clamped.top + "px";
    });

    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);
  }

  function ensureSelectionSearchTrigger() {
    if (!isActiveSurface()) return null;
    if (!selectionSearchPopupSettings.enabled) return null;
    var trigger = document.getElementById("__lp_selection_search_trigger");
    var signature = JSON.stringify({
      enabled: selectionSearchPopupSettings.enabled,
      behavior: selectionSearchPopupSettings.openBehavior
    });
    if (trigger && selectionSearchTriggerSignature === signature) return trigger;
    selectionSearchTriggerSignature = signature;
    trigger = document.createElement("button");
    trigger.id = "__lp_selection_search_trigger";
    trigger.type = "button";
    trigger.textContent = "SSS";
    trigger.style.cssText = "position:fixed;z-index:2147483001;display:none;align-items:center;justify-content:center;min-width:48px;min-height:34px;padding:6px 12px;border-radius:999px;border:1px solid rgba(255,214,51,0.26);background:linear-gradient(180deg,rgba(26,29,44,0.98),rgba(14,16,26,0.96));color:#fff1bf;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 16px 34px rgba(0,0,0,0.42);";
    trigger.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      showSelectionSearchPopup(true);
    });
    (document.body || document.documentElement).appendChild(trigger);
    return trigger;
  }

  function hideSelectionSearchPopup() {
    var popup = document.getElementById("__lp_selection_search_popup");
    if (!popup) return;
    popup.style.opacity = "0";
    popup.style.transform = "translateY(4px)";
    popup.style.display = "none";
  }
  function hideSelectionSearchTrigger() {
    var trigger = document.getElementById("__lp_selection_search_trigger");
    if (!trigger) return;
    trigger.style.display = "none";
  }

  function positionSelectionElement(element) {
    if (!element) return;
    if (selectionSearchPopupManualPosition) {
      applySelectionPopupPosition(
        element,
        selectionSearchPopupManualPosition.left,
        selectionSearchPopupManualPosition.top
      );
      return;
    }
    var left = 8;
    var top = 8;
    var rect = getSelectionRect();
    if (
      selectionSearchPopupSettings.location === "cursor"
      && selectionSearchLastPointer
      && Number.isFinite(selectionSearchLastPointer.x)
      && Number.isFinite(selectionSearchLastPointer.y)
    ) {
      left = selectionSearchLastPointer.x;
      top = selectionSearchLastPointer.y;
    } else if (rect) {
      left = rect.left + Math.min(rect.width / 2, 12);
      top = rect.bottom + 8;
      if (top + element.offsetHeight + 8 > window.innerHeight && rect.top - element.offsetHeight - 8 >= 8) {
        top = rect.top - element.offsetHeight - 8;
      }
    }
    applySelectionPopupPosition(element, left, top);
  }

  function showSelectionSearchPopup(force) {
    if (!selectionSearchPopupSettings.enabled) return;
    if (selectionSearchPopupSettings.openBehavior === "manual" && !force) return;
    var popup = ensureSelectionSearchPopup();
    if (!popup) return;
    if (!shouldShowSelectionPopup()) {
      hideSelectionSearchPopup();
      return;
    }
    popup.style.visibility = "hidden";
    popup.style.pointerEvents = "none";
    popup.style.display = "flex";
    positionSelectionElement(popup);
    popup.style.visibility = "visible";
    popup.style.pointerEvents = "auto";
    popup.style.opacity = "1";
    popup.style.transform = "translateY(0px) scale(1)";
    hideSelectionSearchTrigger();
  }

  function showSelectionSearchTrigger() {
    if (!selectionSearchPopupSettings.enabled) return;
    if (selectionSearchPopupSettings.openBehavior !== "manual") return;
    if (!shouldShowSelectionPopup()) return;
    var trigger = ensureSelectionSearchTrigger();
    if (!trigger) return;
    positionSelectionElement(trigger);
    trigger.style.display = "flex";
  }

  function scheduleSelectionPopupUpdate(forceOpen) {
    if (selectionSearchPopupTimer) clearTimeout(selectionSearchPopupTimer);
    if (!selectionSearchPopupSettings.enabled) {
      hideSelectionSearchPopup();
      hideSelectionSearchTrigger();
      return;
    }
    if (!shouldShowSelectionPopup()) {
      hideSelectionSearchPopup();
      hideSelectionSearchTrigger();
      return;
    }
    if (selectionSearchPopupSettings.openBehavior === "manual" && !forceOpen) {
      hideSelectionSearchPopup();
      showSelectionSearchTrigger();
      return;
    }
    hideSelectionSearchTrigger();
    var delay = Number.isFinite(selectionSearchPopupSettings.delayMs) ? selectionSearchPopupSettings.delayMs : 0;
    selectionSearchPopupTimer = setTimeout(function () { showSelectionSearchPopup(true); }, delay);
  }

  // ── event listeners (gated by isActiveSurface) ──────────────────────────────
  function isInsideSwitcherHost(event) {
    return hookIsInsideSwitcherHost ? !!hookIsInsideSwitcherHost(event) : false;
  }

  function onSelectionChange() {
    if (!isActiveSurface()) return;
    if (selectionSearchPopupSettings.enabled === false) return;
    // Jangan sekat SELAMANYA jika mouseup terlepas (cth. klik enjin buka tab) —
    // selepas tempoh tamat, anggap pemilihan sudah selesai dan benarkan popup
    // muncul semula. (Fix: popup SSS hanya boleh guna sekali selepas jawapan.)
    if (selectionSearchMouseDown && Date.now() - selectionSearchMouseDownAt < SELECTION_POPUP_MOUSEDOWN_MAX_MS) return;
    setTimeout(function () {
      maybeAutoCopySelection();
      scheduleSelectionPopupUpdate(false);
    }, 0);
  }
  function onMouseUp(event) {
    if (!isActiveSurface()) return;
    if (selectionSearchPopupSettings.enabled === false) return;
    if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      selectionSearchLastPointer = { x: event.clientX, y: event.clientY };
    }
    selectionSearchMouseDown = false;
    if (event && event.button === 0) {
      setTimeout(function () {
        maybeAutoCopySelection();
        scheduleSelectionPopupUpdate(false);
      }, 0);
    }
  }
  function onMouseDown(event) {
    if (!isActiveSurface()) return;
    if (selectionSearchPopupSettings.enabled === false) return;
    if (isInsideSwitcherHost(event)) return;
    if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      selectionSearchLastPointer = { x: event.clientX, y: event.clientY };
    }
    if (!event || event.button === 0) { selectionSearchMouseDown = true; selectionSearchMouseDownAt = Date.now(); }
    var popup = document.getElementById("__lp_selection_search_popup");
    if (popup && event && popup.contains(event.target)) return;
    if (!shouldShowSelectionPopup()) {
      hideSelectionSearchPopup();
      hideSelectionSearchTrigger();
    }
  }
  function onPointerDown(event) {
    if (!isActiveSurface()) return;
    if (selectionSearchPopupSettings.enabled === false) return;
    if (isInsideSwitcherHost(event)) return;
    if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      selectionSearchLastPointer = { x: event.clientX, y: event.clientY };
    }
    var popup = document.getElementById("__lp_selection_search_popup");
    if (popup && event && popup.contains(event.target)) return;
    if (!shouldShowSelectionPopup()) {
      hideSelectionSearchPopup();
      hideSelectionSearchTrigger();
    }
  }
  function onContextMenu() {
    if (!isActiveSurface()) return;
    if (selectionSearchPopupSettings.enabled === false) return;
    if (selectionSearchPopupSettings.hideOnRightClick) {
      hideSelectionSearchPopup();
      hideSelectionSearchTrigger();
    }
  }
  function onScroll() {
    if (!isActiveSurface()) return;
    if (selectionSearchPopupSettings.enabled === false) return;
    if (selectionSearchPopupSettings.hideOnScroll) {
      hideSelectionSearchPopup();
      hideSelectionSearchTrigger();
    }
  }
  function onKeyUp(event) {
    if (!isActiveSurface()) return;
    if (!selectionSearchPopupSettings.enabled) return;
    if (isEventInsideEditable(event)) return;
    var key = event && event.key ? String(event.key) : "";
    if (!key || key.length > 2) return;
    if (!selectionSearchPopupSettings.allowShortcutsWithoutPopup) {
      var popup = document.getElementById("__lp_selection_search_popup");
      if (!popup || popup.style.display === "none") return;
    }
    if (!shouldShowSelectionPopup()) return;
    var normalizedKey = key.length === 1 ? key.toUpperCase() : key.toUpperCase();
    var match = selectionSearchEnginesList.find(function (entry) {
      return entry
        && entry.type !== "separator"
        && entry.type !== "group"
        && entry.showPopup === true
        && entry.shortcut
        && entry.shortcut.toUpperCase() === normalizedKey;
    });
    if (!match) return;
    handleSelectionEngineActivate(match, 0);
  }

  // ── public init ─────────────────────────────────────────────────────────────
  function init(opts) {
    if (initialized) return;
    initialized = true;
    opts = opts && typeof opts === "object" ? opts : {};
    if (opts.extensionApi) extensionApi = opts.extensionApi;
    isPanel = !!opts.isPanel;
    if (typeof opts.isInsideSwitcherHost === "function") {
      hookIsInsideSwitcherHost = opts.isInsideSwitcherHost;
    }
    document.addEventListener("selectionchange", onSelectionChange, { passive: true });
    document.addEventListener("mouseup", onMouseUp, { passive: true });
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keyup", onKeyUp);
    loadSelectionPopupManualPosition();
  }

  window.LPSelectionSearch = {
    init: init,
    applySettings: applySettings,
    applySelectionSearchSettings: applySelectionSearchSettings,
    show: function (force) { showSelectionSearchPopup(force); },
    hide: hideSelectionSearchPopup,
    hideTrigger: hideSelectionSearchTrigger,
    ensurePopup: ensureSelectionSearchPopup,
    ensureTrigger: ensureSelectionSearchTrigger,
    position: positionSelectionElement,
    scheduleUpdate: scheduleSelectionPopupUpdate,
    shouldShow: shouldShowSelectionPopup,
    getSelectionText: getSelectionText,
    getAllSelectionText: getSelectionText,
    activate: handleSelectionEngineActivate,
    buildUrl: buildSelectionSearchUrl,
    openUrl: openSelectionSearchUrl,
    maybeAutoCopy: maybeAutoCopySelection,
    isInsideNotesOverlay: isSelectionInsideNotesOverlay,
    isNodeInsideEditable: isNodeInsideEditable,
    isEventInsideEditable: isEventInsideEditable,
    getRect: getSelectionRect,
    sanitize: sanitizeSelectionText,
    isActiveSurface: isActiveSurface,
    setPanel: function (v) { isPanel = !!v; }
  };
})();
