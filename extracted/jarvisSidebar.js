/**
 * Local Pocket Reader - JARVIS Overlay (content script)
 *
 * A persistent, floating chat panel that acts as the JARVIS assistant UI.
 * It parses user input via LocalPocketJarvisCore, executes local actions
 * (page + DOM) directly, and routes browser/addon actions to the background
 * script. AI provider responses (Gemini) stream back via `ai-overlay-response`.
 */
(function () {
  "use strict";

   if (typeof window === "undefined") return;
   if (window.__lpJarvisInstalled) return;
   window.__lpJarvisInstalled = true;

   // Dedicated JARVIS sidebar host (Architecture B). This file is loaded ONLY by
   // jarvisSidebar.html (the native sidebar panel), so we force the host flag on
   // up-front. The whole JARVIS brain + UI runs inside the sidebar; all page-DOM
   // operations are relayed to the active tab via the background bridge. This is
   // intentionally a SEPARATE file from jarvisOverlay.js (which stays as the
   // floating-overlay content script on web pages).
   window.__lpJarvisSidebarHost = true;

   // Peringkap ralat visual: dalam panel sidebar host (halaman extension),
   // tiada konsol mudah dibaca. Jika JARVIS gagal bina panel, paparkan ralat
   // terus ke dalam panel supaya ia tidak kelihatan "kosong" tanpa petunjuk.
   function showFatalError(msg) {
     console.error("[JARVIS]", msg);
   }
   try {
      window.addEventListener("error", function (ev) {
        try {
          var m = (ev && ev.message) ? ev.message : "";
          // Ralat "ResizeObserver loop" adalah BENIGN & async — jangan biarkan
          // ia mengganggu apa-apa (dan jangan paparkan sebagai fatal). Telan sahaja.
          if (m.indexOf("ResizeObserver loop") >= 0 || m.indexOf("undelivered notifications") >= 0) {
            ev.stopImmediatePropagation();
            ev.preventDefault();
            return;
          }
        } catch (e2) {}
      });
      // Tangkap juga promise rejection yang tidak dikendali (hanya log, jangan
      // ganggu halaman dengan showFatalError — rejection dari skrip pihak ketiga
      // seperti Instagram bukan ralat JARVIS).
      window.addEventListener("unhandledrejection", function (ev) {
        try {
          var r = ev && ev.reason;
          var rm = r && (r.message || String(r));
          if (rm && (rm.indexOf("ResizeObserver loop") >= 0)) { ev.preventDefault(); return; }
        } catch (e2) {}
      });
   } catch (e0) {}


  // SIDEBAR HOST MODE (Architecture B): when this script is loaded inside the
  // dedicated JARVIS sidebar page (jarvisSidebar.html sets window.__lpJarvisSidebarHost
  // = true BEFORE this script), the whole JARVIS "brain" + UI runs inside the
  // native browser sidebar instead of as a floating page overlay. All page-DOM
  // operations (page context, DOM snapshot, click/fill/scroll/find/…) are then
  // relayed to the content-script JARVIS running in the ACTIVE TAB via the
  // background "jarvis-relay-to-active-tab" bridge. Everything host-specific is
  // gated behind SIDEBAR_HOST so the normal page-overlay path is untouched.
  var SIDEBAR_HOST = false;
  try { SIDEBAR_HOST = (window.__lpJarvisSidebarHost === true); } catch (e0) {}

  // NOTE: this is the DEDICATED sidebar build (jarvisSidebar.js). Unlike
  // jarvisOverlay.js — which bails out here when loaded as a content script on
  // the sidebar page — this file IS the sidebar host instance, so we do NOT
  // early-return. SIDEBAR_HOST is forced true above, and the host path below
  // builds the full JARVIS panel inside jarvisSidebar.html.

  // Don't run JARVIS on AI provider surfaces (Gemini, ChatGPT, Claude, …) or on
  // pages loaded inside the extension's own AI sidebar/overlay frames. JARVIS's
  // continuous MutationObserver + element scanning would otherwise compete with
  // the provider's own heavy DOM work and make the Gemini sidebar/provider slow
  // to open and respond. (Skipped for the dedicated sidebar host page, which is
  // exactly where JARVIS is meant to run.)
  function isAiProviderHostname(host) {
    if (!host) return false;
    host = String(host).toLowerCase();
    var providers = [
      "gemini.google.com", "notebooklm.google.com", "chatgpt.com", "chat.openai.com",
      "claude.ai", "www.perplexity.ai", "perplexity.ai", "copilot.microsoft.com",
      "grok.com", "chat.deepseek.com", "poe.com", "chat.mistral.ai"
    ];
    for (var i = 0; i < providers.length; i++) {
      if (host === providers[i] || host.endsWith("." + providers[i])) return true;
    }
    return false;
  }
  if (!SIDEBAR_HOST) {
    try {
      var _loc = window.location || {};
      if (isAiProviderHostname(_loc.hostname) ||
          (_loc.search && (_loc.search.indexOf("lp_sidebar") >= 0 || _loc.search.indexOf("lp_popup") >= 0))) {
        return;
      }
    } catch (e) {}
  }

  var api = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);

function lpStorageGet(keys, cb) {
  var called = false;
  var invoke = function (data) { if (called) return; called = true; if (cb) cb(data || {}); };
  var ret;
  try { ret = api.storage.local.get(keys, invoke); } catch (e) { invoke({}); return; }
  if (ret && typeof ret.then === "function") {
    ret.then(invoke).catch(function () { invoke({}); });
  }
}
  if (!api || !api.runtime) return;

  // Minta background tekan F6 tulen (native helper) beberapa kali. Relay
  // sahaja ke background.js — logic sebenar (connectNative ke
  // "localpocket_focus_helper", cooldown, dsb.) dikendalikan di sana melalui
  // handler `message.type === "press-native-f6"`. Wrapper ni sengaja dibuat
  // "fire-and-forget" (tak return Promise) supaya selamat dipanggil terus
  // dalam try/catch blocks sedia ada tanpa perlu await.
  function pressNativeF6(count) {
    try {
      var n = (typeof count === "number" && isFinite(count)) ? count : 3;
      var p = api.runtime.sendMessage({ type: "press-native-f6", count: n });
      if (p && typeof p.then === "function") p.catch(function () {});
    } catch (e) {}
  }

  var Core = window.LocalPocketJarvisCore;

  // ─────────────────────────────────────────────────────────────────────────
  // SIDEBAR HOST BRIDGE (Architecture B)
  // The sidebar page has no live web-page DOM of its own, so page context, the
  // interactive-element snapshot, planning prompts and DOM actions are all
  // fulfilled by the JARVIS content script running in the ACTIVE TAB. The
  // background relays each sub-message to that tab and returns its reply.
  // ─────────────────────────────────────────────────────────────────────────
  // Cached observation of the active tab, refreshed before each command so the
  // (synchronous) chat/summarize prompt builders and runSinglePlan see fresh
  // context. Planning/re-plan prompts (which embed a live DOM snapshot) are
  // built ON the active tab instead, so they never rely on this cache.
  var hostCtx = { title: "", url: "", text: "" };
  var hostHost = "";
  var hostSelection = "";
  function hostRelay(sub) {
    return new Promise(function (resolve) {
      var settled = false;
      var done = function (r) { if (settled) return; settled = true; resolve(r || null); };
      try {
        var p = api.runtime.sendMessage({ type: "jarvis-relay-to-active-tab", sub: sub });
        if (p && typeof p.then === "function") p.then(done).catch(function () { done(null); });
        else done(null);
      } catch (e) { done(null); }
    });
  }
  function refreshHostObservation() {
    if (!SIDEBAR_HOST) return Promise.resolve(null);
    return hostRelay({ type: "jarvis-host-observe" }).then(function (res) {
      if (res && res.ok !== false) {
        if (res.context) hostCtx = res.context;
        if (typeof res.host === "string") hostHost = res.host;
        hostSelection = res.selection || "";
      }
      return res;
    });
  }
  if (SIDEBAR_HOST && Core) {
    // Route the overlay's own (external) calls to page context / selection
    // through the cached active-tab observation. Note: jarvisCore's INTERNAL
    // prompt builders call their own closures, so those are relayed separately
    // (see planWithGemini / rePlanStep host branches) rather than overridden.
    var _origExtract = Core.extractPageContext;
    Core.extractPageContext = function () {
      return hostCtx || { title: "", url: "", text: "" };
    };
  }

  // Dalam sidebar host, "halaman semasa" ialah TAB AKTIF (bukan halaman extension
  // sidebar sendiri). Fungsi ini mengembalikan URL/tajuk tab aktif supaya arahan
  // seperti salin URL, prefill Gemini, dll. menggunakan konteks yang BETUL.
  function currentPageUrl() {
    if (SIDEBAR_HOST) return (hostCtx && hostCtx.url) ? hostCtx.url : (location.href || "");
    return location.href || "";
  }
  function currentPageTitle() {
    if (SIDEBAR_HOST) return (hostCtx && hostCtx.title) ? hostCtx.title : (document.title || "");
    return document.title || "";
  }

  // The "brain" provider is configurable: JARVIS follows the extension's
  // configured "Jarvis AI Brain" (settings.jarvisBrainProvider), falling back
  // to sidebarAiProvider and finally Gemini. No longer hard-wired to Gemini.
  var PROVIDER = "gemini";
  // JARVIS render mode: "overlay" (floating popup) or "sidebar" (docked panel).
  // Digunakan untuk GAYA panel (CSS docking) — TIDAK diubah di sini.
  var jarvisMode = "overlay";
  // Default CARA JARVIS dibuka (sidebar panel vs overlay terapung) apabila
  // pengguna MENCETUSKAN buka JARVIS (shortcut/gesture). Dikawal oleh butang
  // "Tukar paparan JARVIS" dan berbeza dari jarvisMode (gaya). Lalai "sidebar"
  // supaya pintasan buka JARVIS kekal buka panel sidebar seperti sedia ada.
  var jarvisOpenMode = "sidebar";
  // Resolve a provider id against the list of selectable providers, falling
  // back to Gemini (the safe default) for anything unknown/empty.
  function resolveBrainProvider(value) {
    var p = String(value || "").trim().toLowerCase();
    for (var i = 0; i < PROVIDERS.length; i++) {
      if (PROVIDERS[i].id === p) return p;
    }
    return "gemini";
  }
  function loadProvider() {
    try {
       lpStorageGet("settings", function (data) {
         var s = data && data.settings;
         PROVIDER = resolveBrainProvider((s && s.jarvisBrainProvider) || (s && s.sidebarAiProvider));
          if (s && typeof s.jarvisMode === "string" && (s.jarvisMode === "overlay" || s.jarvisMode === "sidebar")) {
            jarvisMode = s.jarvisMode;
          }
          if (s && typeof s.jarvisOpenMode === "string" && (s.jarvisOpenMode === "overlay" || s.jarvisOpenMode === "sidebar")) {
            jarvisOpenMode = s.jarvisOpenMode;
          }
          if (s && s.jarvisSessionTtlDays > 0) sessionTtlDays = s.jarvisSessionTtlDays;
          if (s && typeof s.jarvisPreviewPlan === "boolean") jarvisPreviewPlan = s.jarvisPreviewPlan;
          applyJarvisModeClass();
          updateModeToggleLabel();
       });
    } catch (e) {}
  }
  // React to live changes in the extension settings so switching the AI
  // provider in Options takes effect in JARVIS without reloading the tab.
  try {
    if (api.storage && api.storage.onChanged) {
      api.storage.onChanged.addListener(function (changes, area) {
        if (area === "local" && changes && changes.settings) {
          var ns = changes.settings.newValue;
          // Sekalikan enjin SSS kongsi bila tetapan berubah secara langsung
          // (contoh: toggle Selection Search dalam panel) supaya popup
          // carian pilihan dalam panel sentiasa selari dengan options-sss.
          try {
            if (window.LPSelectionSearch) window.LPSelectionSearch.applySettings(ns);
          } catch (eSss) {}
          // JARVIS kini mengikuti tetapan "Jarvis AI Brain" (jarvisBrainProvider)
          // secara langsung — tukar provider segera bila ia berubah di Options.
          PROVIDER = resolveBrainProvider((ns && ns.jarvisBrainProvider) || (ns && ns.sidebarAiProvider));
          var psel = document.getElementById("lp-jarvis-provider");
          if (psel && psel.value !== PROVIDER) psel.value = PROVIDER;
          if (providerIframe && providerVisible && providerIframe.src !== providerIframeUrl(PROVIDER)) {
            try { providerIframe.src = providerIframeUrl(PROVIDER); } catch (e3) {}
          }
          var jm = ns && ns.jarvisMode;
          if (jm === "overlay" || jm === "sidebar") {
            jarvisMode = jm;
            applyJarvisModeClass();
            updateModeToggleLabel();
          }
          var jpp = ns && ns.jarvisPreviewPlan;
          if (typeof jpp === "boolean") {
            jarvisPreviewPlan = jpp;
            var pt = document.getElementById("lp-jarvis-preview-toggle");
            if (pt) {
              pt.setAttribute("aria-pressed", jarvisPreviewPlan ? "true" : "false");
              pt.title = "Pra-tonton pelan: " + (jarvisPreviewPlan ? "ON" : "OFF") + " (klik untuk tukar)";
            }
          }
        }
      });
    }
  } catch (e) {}
  // Map a provider id to the embedded provider surface URL.
  function providerIframeUrl(provider) {
    switch (provider) {
      case "claude": return "https://claude.ai/new?lp_sidebar=1";
      case "chatgpt": return "https://chat.openai.com/?lp_sidebar=1";
      case "perplexity": return "https://www.perplexity.ai/";
      case "copilot": return "https://copilot.microsoft.com/";
      case "grok": return "https://grok.com/";
      case "deepseek": return "https://chat.deepseek.com/";
      case "poe": return "https://poe.com/";
      case "mistral": return "https://chat.mistral.ai/";
      case "notebooklm": return "https://notebooklm.google.com/";
      default: return "https://gemini.google.com/app?lp_sidebar=1";
    }
  }
  // Pra-tonton pelan sebelum JARVIS jalan (default ON). Pelan berbilang-langkah
  // atau tindakan berisiko akan dipaparkan untuk pengesahan user dulu supaya
  // arahan berisiko tak terus jalan (gaya browser-use).
  var jarvisPreviewPlan = true;

  // Togol & kekal (persist) status pra-tonton pelan.
  function setJarvisPreviewPlan(on) {
    jarvisPreviewPlan = !!on;
    try {
      lpStorageGet("settings", function (data) {
        var s = (data && data.settings) || {};
        s.jarvisPreviewPlan = jarvisPreviewPlan;
        try { api.storage.local.set({ settings: s }); } catch (e2) {}
      });
    } catch (e) {}
    var btn = document.getElementById("lp-jarvis-preview-toggle");
    if (btn) {
      btn.setAttribute("aria-pressed", jarvisPreviewPlan ? "true" : "false");
      btn.title = "Pra-tonton pelan: " + (jarvisPreviewPlan ? "ON" : "OFF") + " (klik untuk tukar)";
    }
  }

  // Providers selectable from the in-panel dropdown.
  var PROVIDERS = [
    { id: "chatgpt", label: "ChatGPT" },
    { id: "gemini", label: "Gemini" },
    { id: "claude", label: "Claude" },
    { id: "perplexity", label: "Perplexity" },
    { id: "copilot", label: "Copilot" },
    { id: "grok", label: "Grok" },
    { id: "deepseek", label: "DeepSeek" },
    { id: "poe", label: "Poe" },
    { id: "mistral", label: "Mistral" },
    { id: "notebooklm", label: "NotebookLM" }
  ];
  // Persist the chosen provider to the extension settings and apply it live.
  // The selection becomes JARVIS's "AI Brain" (jarvisBrainProvider) so it
  // survives reloads and is reflected in the Options page.
  function setProvider(p) {
    p = String(p || "").toLowerCase();
    if (!p) return;
    PROVIDER = resolveBrainProvider(p);
    try {
      lpStorageGet("settings", function (data) {
        var s = (data && data.settings) || {};
        s.jarvisBrainProvider = PROVIDER;
        try { api.storage.local.set({ settings: s }); } catch (e2) {}
      });
    } catch (e) {}
    // Refresh the embedded provider surface for the new provider.
    if (providerIframe) {
      try { providerIframe.src = providerIframeUrl(PROVIDER); } catch (e3) {}
    }
  }
  var STYLE_URL = api.runtime.getURL && api.runtime.getURL("styles/jarvisOverlay.css");

  // ----- Font size / font family preferences (persisted, user-configurable) -----
  var FONT_PREFS_KEY = "jarvisFontPrefs";
  // User-selectable font families. The "sistem" option clears the CSS variable
  // so the stylesheet's default stack is used.
  var FONT_FAMILIES = [
    { id: "sistem", label: "Sistem", stack: "" },
    { id: "sans", label: "Sans", stack: 'Arial, Helvetica, "Segoe UI", Roboto, sans-serif' },
    { id: "serif", label: "Serif", stack: 'Georgia, "Times New Roman", Cambria, serif' },
    { id: "mono", label: "Mono", stack: '"SF Mono", "Cascadia Code", Consolas, "Courier New", monospace' },
    { id: "rounded", label: "Rounded", stack: '"Comic Sans MS", "Trebuchet MS", "Segoe UI", sans-serif' }
  ];
  var FONT_SIZE_MIN = 10;
  var FONT_SIZE_MAX = 24;
  var FONT_SIZE_DEFAULT = 13;
  var fontPrefs = { size: FONT_SIZE_DEFAULT, family: "sistem" };

  function loadFontPrefs() {
    try {
      lpStorageGet(FONT_PREFS_KEY, function (data) {
        var p = data && data[FONT_PREFS_KEY];
        if (p && typeof p === "object") {
          if (typeof p.size === "number") {
            fontPrefs.size = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, p.size));
          }
          if (typeof p.family === "string") fontPrefs.family = p.family;
        }
        applyFontPrefs();
      });
    } catch (e) {}
  }
  function saveFontPrefs() {
    try { api.storage.local.set({ [FONT_PREFS_KEY]: fontPrefs }); } catch (e) {}
  }
  // Reflect the stored prefs onto the panel root via CSS custom properties. When
  // the family is "sistem" we remove the variable so the stylesheet default is
  // used instead of overriding it.
  function applyFontPrefs() {
    if (!root) return;
    root.style.setProperty("--jarvis-font-size", fontPrefs.size + "px");
    var fam = null;
    for (var i = 0; i < FONT_FAMILIES.length; i++) {
      if (FONT_FAMILIES[i].id === fontPrefs.family) { fam = FONT_FAMILIES[i]; break; }
    }
    if (fam && fam.stack) root.style.setProperty("--jarvis-font-family", fam.stack);
    else root.style.removeProperty("--jarvis-font-family");
    // Keep the UI controls in sync if they already exist.
    var sizeLabel = root.querySelector("#lp-jarvis-font-size-label");
    if (sizeLabel) sizeLabel.textContent = fontPrefs.size + "px";
    var famSelect = root.querySelector("#lp-jarvis-font-family");
    if (famSelect) famSelect.value = fontPrefs.family;
  }
  function changeFontSize(delta) {
    var next = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, fontPrefs.size + delta));
    if (next === fontPrefs.size) return;
    fontPrefs.size = next;
    saveFontPrefs();
    applyFontPrefs();
  }
  function setFontFamily(id) {
    fontPrefs.family = id;
    saveFontPrefs();
    applyFontPrefs();
  }

  // ----- JARVIS output preferences: summary mode + tone (copied from LP Sidebar AI) -----
  var summaryMode = "auto";        // auto | quick | deep | action_items | study_notes | research | custom
  var tone = "neutral";            // neutral | formal | casual | educational
  var summaryCustomPrompt = "";    // used when summaryMode === "custom"
  var summaryOutputLanguage = "ms";
  var summaryMaxWords = 0;
  var bottomSectionHidden = false;
  var _prefEls = {};
  function _pr(id) { return _prefEls[id] || (_prefEls[id] = document.getElementById(id)); }
  // Pintu "pref sedia": panel tak dipapar (lp-jarvis-open) sehingga prefs
  // selesai dimuat, supaya tiada kelibat "terbuka lalu tertutup" (panel sempat
  // dipapar dalam keadaan default sebelum prefs async membetulkannya).
  var jarvisPrefsReady = false;
  var jarvisPendingReveal = null;

  // #6 — JARVIS Memory (core/memoryLayers.js) ialah sumber kebenaran preferensi
  // (canonical). Selepas baca `settings`, tindih dengan profil ingatan.
  function applyJarvisMemoryPrefs() {
    try {
      var ML = (typeof window !== "undefined") ? window.LocalPocketMemoryLayers : null;
      if (!ML) return;
      ML.ensureLoaded().then(function () {
        var mp = ML.getCachedProfile();
        if (mp.defaultTone) {
          tone = mp.defaultTone;
          var ts = _pr("lp-jarvis-tone");
          if (ts) ts.value = tone;
        }
        if (mp.defaultSummaryMode) {
          summaryMode = mp.defaultSummaryMode;
          var sm = _pr("lp-jarvis-summary-mode");
          if (sm) sm.value = summaryMode;
          var cr = _pr("lp-jarvis-custom-row");
          if (cr) cr.style.display = (summaryMode === "custom") ? "flex" : "none";
          var ci = _pr("lp-jarvis-custom-prompt");
          if (ci && summaryCustomPrompt && ci.value !== summaryCustomPrompt) ci.value = summaryCustomPrompt;
        }
        if (mp.defaultLanguage) summaryOutputLanguage = mp.defaultLanguage;
      }).catch(function () {});
    } catch (e) {}
  }

  // #6 — Helper: rekod tindakan laman & tabiat masa ke Memory Layers supaya
  // JARVIS belajar preferensi khusus laman / waktu dari interaksi UI terus.
  function recordJarvisSiteAction(url, action) {
    try {
      var ML = (typeof window !== "undefined") ? window.LocalPocketMemoryLayers : null;
      if (ML && typeof ML.recordSiteAction === "function") ML.recordSiteAction(url, action);
    } catch (e) {}
  }
  function recordJarvisTimeHabit(field, value) {
    try {
      var ML = (typeof window !== "undefined") ? window.LocalPocketMemoryLayers : null;
      if (!ML || typeof ML.recordTimeHabit !== "function") return;
      var period = (typeof ML.timePeriodForDate === "function") ? ML.timePeriodForDate() : "malam";
      ML.recordTimeHabit(period, field, value);
    } catch (e) {}
  }

   function loadJarvisPrefs() {
     // Jaring keselamatan: jika bacaan storage gagal / tak pernah kembali,
     // tetap dedahkan panel supaya ia tak tersembunyi selama-lamanya.
     try { setTimeout(markJarvisPrefsReady, 1500); } catch (eSafety) {}
     try {
       lpStorageGet(["settings", JARVIS_TTS_KEY], function (data) {
         var s = data && data.settings;
         if (s) {
           if (s.summaryMode) summaryMode = String(s.summaryMode);
           if (s.tone) tone = String(s.tone);
           if (typeof s.summaryCustomPrompt === "string") summaryCustomPrompt = s.summaryCustomPrompt;
           if (s.summaryOutputLanguage) summaryOutputLanguage = String(s.summaryOutputLanguage);
           if (typeof s.summaryMaxWords === "number") summaryMaxWords = s.summaryMaxWords;
            if (typeof s.jarvisBottomHidden === "boolean") bottomSectionHidden = s.jarvisBottomHidden;
            if (typeof s.puterApiKey === "string") puterApiKey = s.puterApiKey;
            if (typeof s.googleApiKey === "string") googleApiKey = s.googleApiKey;
            if (typeof s.jarvisVoiceMs === "string") jarvisVoiceMs = s.jarvisVoiceMs;
            if (typeof s.jarvisVoiceEn === "string") jarvisVoiceEn = s.jarvisVoiceEn;
            if (typeof s.jarvisTtsProvider === "string") ttsProvider = s.jarvisTtsProvider;
            // Puter / Gemini-Puter telah dibuang — gunakan Gemini API sebagai ganti.
            if (ttsProvider === "puter" || ttsProvider === "gemini") ttsProvider = "google";
            if (typeof s.jarvisVoiceHidden === "boolean") jarvisVoiceHidden = s.jarvisVoiceHidden;
            if (typeof s.jarvisAccApiHidden === "boolean") jarvisAccApiHidden = s.jarvisAccApiHidden;
            if (typeof s.jarvisAccDisplayHidden === "boolean") jarvisAccDisplayHidden = s.jarvisAccDisplayHidden;
    syncPuterKeyUi();
    try { applyTtsPrefsUi(); } catch (e0) {}
          }
         // #3 — TTS: baca toggle TTS yang dikekal (default OFF supaya senyap).
         jarvisTtsEnabled = !!(data && data[JARVIS_TTS_KEY] === true);
         applyTtsButton();
        // Segerakkan UI mod ringkasan + baris custom prompt ikut settings (fallback
        // bila ingatan tiada/belum dimuat). applyJarvisMemoryPrefs() akan tindih.
        try {
          var _sm = _pr("lp-jarvis-summary-mode");
          if (_sm) _sm.value = summaryMode;
          var _cr = _pr("lp-jarvis-custom-row");
          if (_cr) _cr.style.display = (summaryMode === "custom") ? "flex" : "none";
          var _ci = _pr("lp-jarvis-custom-prompt");
          if (_ci && summaryCustomPrompt) _ci.value = summaryCustomPrompt;
          var _t = _pr("lp-jarvis-tone");
          if (_t) _t.value = tone;
        } catch (e0) {}
        // #6 — ingatan mengatasi settings sebagai canonical.
        applyJarvisMemoryPrefs();
        // Prefs siap dimuat & keadaan UI tersimpan (bahagian bawah / accordion)
        // telah disegerakkan — kini selamat paparkan panel tanpa kelibat.
        markJarvisPrefsReady();
      });
    } catch (e) {
      // Bacaan storage gagal secara segerak — tetap dedahkan panel.
      markJarvisPrefsReady();
    }
  }

  // Persist a single JARVIS preference under the extension `settings` object.
  function setJarvisPref(key, value) {
    try {
      lpStorageGet("settings", function (data) {
        var s = (data && data.settings) || {};
        s[key] = value;
        try { api.storage.local.set({ settings: s }); } catch (e2) {}
      });
    } catch (e) {}
  }

  function currentJarvisPromptOpts() {
    return { summaryMode: summaryMode, tone: tone, customPrompt: summaryCustomPrompt, outputLanguage: summaryOutputLanguage, maxWords: summaryMaxWords };
  }

  // Options for ordinary chat / commands: tone only. The summary mode and custom
  // prompt are intentionally omitted so they are NOT prepended to every message
  // (they apply solely to the "Ringkas" summarize action).
  // #4 Cross-tab Context Awareness: konteks tab lain (dijejak di background)
  // di-cache sini dan disuntik ke prompt bila pengguna merujuk tab lain.
  var currentTabId = null;
  try {
    api.runtime.sendMessage({ type: "jarvis-get-tab-id" }, function (id) { currentTabId = id; });
  } catch (e) {}
  var currentCrossTabContexts = [];
  function refreshCrossTabContexts() {
    try {
      return api.runtime.sendMessage({
        type: "jarvis-get-recent-contexts",
        excludeTabId: currentTabId,
        limit: 12
      }).then(function (res) {
        if (res && res.ok && Array.isArray(res.contexts)) currentCrossTabContexts = res.contexts;
        return currentCrossTabContexts;
      }).catch(function () { return currentCrossTabContexts; });
    } catch (e) { return Promise.resolve(currentCrossTabContexts); }
  }
  // Hanya suntik konteks rentas tab bila soalan MEMANG rujuk tab lain — elak
  // bengkak token pada setiap chat (selaras dengan matlamat kecekapan P0–P4).
  function isCrossTabQuery(text) {
    try { var p = Core.parseIntent(text); return !!(p && p.type === "crosstab"); } catch (e) { return false; }
  }
  function maybeRefreshCrossTab(text) {
    if (isCrossTabQuery(text)) return refreshCrossTabContexts();
    currentCrossTabContexts = [];
    return Promise.resolve([]);
  }
  function getCrossTabContexts(limit) {
    return new Promise(function (resolve) {
      try {
        api.runtime.sendMessage({
          type: "jarvis-get-recent-contexts",
          excludeTabId: null,
          limit: limit || 40
        }, function (res) {
          var ctxs = (res && res.ok && Array.isArray(res.contexts)) ? res.contexts : [];
          // Susun ikut posisi sebenar tab di bar pelayar (index menaik).
          ctxs = ctxs.slice().sort(function (a, b) {
            var ia = (a && a.index != null) ? a.index : 1e9;
            var ib = (b && b.index != null) ? b.index : 1e9;
            return ia - ib;
          });
          resolve(ctxs);
        });
      } catch (e) { resolve([]); }
    });
  }

  function chatPromptOpts() {
    return {
      tone: tone,
      crossTabContexts: currentCrossTabContexts
    };
  }

  // Helper: panggil cb dengan array kosong (RAG telah dialih keluar).
  // Ambil keyword dari soalan (tapis stop-word BM/EN) untuk carian RAG lokal.
  function extractRagKeywords(text) {
    var stop = { tanya:1, simpanan:1, link:1, saya:1, apa:1, dalam:1, yang:1,
      ini:1, itu:1, ada:1, boleh:1, tolong:1, bagaimana:1, siapa:1, bila:1, mana:1,
      dengan:1, dan:1, atau:1, untuk:1, pada:1, tentang:1, pasal:1, the:1, my:1,
      of:1, to:1, a:1, is:1, are:1, what:1, how:1, do:1, i:1, you:1, me:1, in:1,
      on:1, at:1, this:1, that:1, from:1, about:1 };
    var kws = (String(text || "").toLowerCase().match(/[a-z0-9À-ÿ]+/gi) || [])
      .filter(function (w) { return w.length > 2 && !stop[w]; })
      .slice(0, 6);
    return kws;
  }

  // RAG lokal: cari artikel simpanan yang relevan dengan soalan, kembalikan
  // sebagai ragDocs untuk disuntik ke prompt (lihat core/jarvisCore.buildRagBlock).
  function withRagDocs(query, ctx, cb) {
    try {
      var kws = extractRagKeywords(query);
      if (!kws.length) { cb([]); return; }
      api.runtime.sendMessage({ type: "jarvis-rag-search", keywords: kws, limit: 5 }).then(function (res) {
        var docs = (res && res.ok && res.docs) || [];
        cb(docs);
      }).catch(function () { cb([]); });
    } catch (e) { cb([]); }
  }

  // ----- Saved prompt templates (DIKONGSI dengan LP Sidebar AI) -----
  // Guna store yang SAMA (summaryPromptTemplates) supaya templat prompt custom
  // dikongsi dua hala antara JARVIS dan AI Sidebar. Templat lama JARVIS
  // (jarvisPromptTemplates) dimigrasi sekali sahaja ke store dikongsi.
  var promptTemplates = [];
  var TEMPLATES_KEY = "summaryPromptTemplates";
  var LEGACY_TEMPLATES_KEY = "jarvisPromptTemplates";
  var templatesModal = null;

  function loadPromptTemplates(cb) {
    try {
      lpStorageGet([TEMPLATES_KEY, LEGACY_TEMPLATES_KEY], function (data) {
        var shared = Array.isArray(data[TEMPLATES_KEY]) ? data[TEMPLATES_KEY] : [];
        var legacy = Array.isArray(data[LEGACY_TEMPLATES_KEY]) ? data[LEGACY_TEMPLATES_KEY] : [];
        if (legacy.length) {
          legacy.forEach(function (lt) {
            if (!lt || !lt.name) return;
            var dup = shared.some(function (s) { return s && s.name === lt.name && s.text === lt.text; });
            if (!dup) shared.push({ name: lt.name, text: lt.text });
          });
          promptTemplates = shared;
          try { api.storage.local.set({ [TEMPLATES_KEY]: shared }); } catch (e) {}
          try { api.storage.local.remove(LEGACY_TEMPLATES_KEY); } catch (e) {}
        } else {
          promptTemplates = shared;
        }
        if (cb) cb();
      });
    } catch (e) { if (cb) cb(); }
  }
  function savePromptTemplates() {
    try { api.storage.local.set({ [TEMPLATES_KEY]: promptTemplates }); } catch (e) {}
  }
  // Terapkan teks templat sebagai CUSTOM summary prompt + tukar mod ke "custom"
  // (selaras kelakuan AI Sidebar). Kekalkan ke settings + ingatan (#6).
  function applyCustomPromptTemplate(text) {
    summaryMode = "custom";
    summaryCustomPrompt = text || "";
    var sm = _pr("lp-jarvis-summary-mode");
    if (sm) sm.value = "custom";
    var cr = _pr("lp-jarvis-custom-row");
    if (cr) cr.style.display = "flex";
    var ci = _pr("lp-jarvis-custom-prompt");
    if (ci) ci.value = summaryCustomPrompt;
    setJarvisPref("summaryMode", "custom");
    setJarvisPref("summaryCustomPrompt", summaryCustomPrompt);
    try { if (window.LocalPocketMemoryLayers) window.LocalPocketMemoryLayers.setPreference("defaultSummaryMode", "custom"); } catch (e) {}
  }
  function openTemplatesModal() {
    if (!templatesModal) buildTemplatesModal();
    renderTemplatesModal();
    // Muat semula dari store dikongsi supaya templat dari AI Sidebar turut muncul.
    loadPromptTemplates(function () { renderTemplatesModal(); });
    templatesModal.classList.add("lp-jarvis-show");
    var ta = templatesModal.querySelector("#lp-jarvis-tpl-text");
    if (ta) {
      // Pra-isi dengan prompt custom semasa supaya mudah "simpan sebagai templat".
      if (!ta.value && summaryCustomPrompt) ta.value = summaryCustomPrompt;
      ta.focus();
    }
  }
  function closeTemplatesModal() {
    if (templatesModal) templatesModal.classList.remove("lp-jarvis-show");
  }
  function buildTemplatesModal() {
    var list = el("div", { id: "lp-jarvis-tpl-list", className: "lp-jarvis-tpl-list" });
    var nameInput = el("input", { id: "lp-jarvis-tpl-name", type: "text", placeholder: "Nama templat…", className: "lp-jarvis-tpl-name" });
    var textArea = el("textarea", { id: "lp-jarvis-tpl-text", placeholder: "Teks prompt…", rows: "3", className: "lp-jarvis-tpl-text" });
    var saveBtn = el("button", { id: "lp-jarvis-tpl-save", text: "Simpan", className: "lp-jarvis-tpl-save" });
    var cancelBtn = el("button", { id: "lp-jarvis-tpl-cancel", text: "Tutup", className: "lp-jarvis-tpl-cancel" });
    var form = el("div", { className: "lp-jarvis-tpl-form" }, [
      nameInput, textArea,
      el("div", { className: "lp-jarvis-tpl-form-btns" }, [saveBtn, cancelBtn])
    ]);
    var modal = el("div", { id: "lp-jarvis-tpl-modal", className: "lp-jarvis-tpl-modal" }, [
      el("div", { className: "lp-jarvis-tpl-head" }, [
        el("span", { text: "Templat Prompt" }),
        el("button", { id: "lp-jarvis-tpl-close", text: "×", className: "lp-jarvis-tpl-close" })
      ]),
      list,
      el("div", { className: "lp-jarvis-tpl-divider", text: "Templat baharu:" }),
      form
    ]);
    templatesModal = modal;
    if (root) root.appendChild(modal);
    saveBtn.addEventListener("click", function () {
      var name = (nameInput.value || "").trim();
      var txt = (textArea.value || "").trim();
      if (!name || !txt) { nameInput.focus(); return; }
      promptTemplates.push({ id: "t" + Date.now().toString(36), name: name, text: txt });
      savePromptTemplates();
      nameInput.value = ""; textArea.value = "";
      renderTemplatesModal();
    });
    cancelBtn.addEventListener("click", closeTemplatesModal);
    modal.querySelector("#lp-jarvis-tpl-close").addEventListener("click", closeTemplatesModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeTemplatesModal(); });
  }
  function renderTemplatesModal() {
    if (!templatesModal) return;
    var list = templatesModal.querySelector("#lp-jarvis-tpl-list");
    list.innerHTML = "";
    if (!promptTemplates.length) {
      list.appendChild(el("div", { className: "lp-jarvis-tpl-empty", text: "(Tiada templat lagi)" }));
      return;
    }
    promptTemplates.forEach(function (tpl, idx) {
      var useBtn = el("button", { text: "Guna", className: "lp-jarvis-tpl-use", title: "Guna sebagai custom prompt (mod Custom)" });
      var editBtn = el("button", { text: "Edit", className: "lp-jarvis-tpl-edit", title: "Edit templat" });
      var dupBtn = el("button", { text: "Dup", className: "lp-jarvis-tpl-dup", title: "Salin templat" });
      var delBtn = el("button", { text: "×", className: "lp-jarvis-tpl-del", title: "Padam templat" });
      useBtn.addEventListener("click", function () {
        applyCustomPromptTemplate(tpl.text);
        closeTemplatesModal();
      });
      editBtn.addEventListener("click", function () {
        var ni = templatesModal.querySelector("#lp-jarvis-tpl-name");
        var ta = templatesModal.querySelector("#lp-jarvis-tpl-text");
        ni.value = tpl.name; ta.value = tpl.text;
        promptTemplates.splice(idx, 1);
        savePromptTemplates();
        renderTemplatesModal();
        ta.focus();
      });
      dupBtn.addEventListener("click", function () {
        promptTemplates.push({ id: "t" + Date.now().toString(36), name: tpl.name + " (copy)", text: tpl.text });
        savePromptTemplates();
        renderTemplatesModal();
      });
      delBtn.addEventListener("click", function () {
        promptTemplates.splice(idx, 1);
        savePromptTemplates();
        renderTemplatesModal();
      });
      var row = el("div", { className: "lp-jarvis-tpl-item" }, [
        el("span", { className: "lp-jarvis-tpl-name-lbl", text: tpl.name }),
        el("div", { className: "lp-jarvis-tpl-item-btns" }, [useBtn, editBtn, dupBtn, delBtn])
      ]);
      list.appendChild(row);
    });
  }

  // ----- Floating text-selection buttons: "Ai" (chat) + "＋ Note" (insert to note) -----
  // Plus a configurable selection-search popup (copied from LP Sidebar AI).
  var SEARCH_ENGINES = [
    { id: "google", label: "G", title: "Cari di Google", url: "https://www.google.com/search?q=" },
    { id: "bing", label: "B", title: "Cari di Bing", url: "https://www.bing.com/search?q=" },
    { id: "ddg", label: "D", title: "Cari di DuckDuckGo", url: "https://duckduckgo.com/?q=" },
    { id: "youtube", label: "YT", title: "Cari di YouTube", url: "https://www.youtube.com/results?search_query=" }
  ];
  var selSearchEngines = ["google", "bing", "ddg", "youtube"]; // ids enabled (from settings)
  var selSearchEnabled = true; // master toggle for selection search
  var selButtonsPos = null;    // { top, left } persisted drag position
  var jarvisSelSearchEnabled = true; // toggle selection search dalam sidebar JARVIS (sama seperti AI sidebar)

  function buildSelectionSearchUrl(engineId, query) {
    for (var i = 0; i < SEARCH_ENGINES.length; i++) {
      if (SEARCH_ENGINES[i].id === engineId) {
        return SEARCH_ENGINES[i].url + encodeURIComponent(query);
      }
    }
    return "https://www.google.com/search?q=" + encodeURIComponent(query);
  }

  // Buka carian pilihan dalam tab BAHARU. Dalam host sidebar (halaman extension)
  // window.open tidak boleh buka tab dengan pasti, jadi guna api.tabs.create.
  function openSelectionSearch(engineId, query) {
    var url = buildSelectionSearchUrl(engineId, query);
    try {
      if (api.tabs && typeof api.tabs.create === "function") { api.tabs.create({ url: url }); return; }
    } catch (e) {}
    try { window.open(url, "_blank"); } catch (e2) {}
  }

  function loadSelSearchEngines() {
    try {
      lpStorageGet("settings", function (data) {
        var s = data && data.settings;
        if (s && Array.isArray(s.selSearchEngines) && s.selSearchEngines.length) {
          selSearchEngines = s.selSearchEngines.filter(function (id) {
            for (var k = 0; k < SEARCH_ENGINES.length; k++) {
              if (SEARCH_ENGINES[k].id === id) return true;
            }
            return false;
          });
        }
        if (s && typeof s.selSearchEnabled === "boolean") {
          selSearchEnabled = s.selSearchEnabled;
        }
        if (s && s.selButtonsPos && typeof s.selButtonsPos.top === "number" && typeof s.selButtonsPos.left === "number") {
          selButtonsPos = { top: s.selButtonsPos.top, left: s.selButtonsPos.left };
        }
      });
    } catch (e) {}
  }

  var selButtonsEl = null;

  function ensureSelButtons() {
    if (selButtonsEl) return;
    selButtonsEl = el("div", { id: "lp-jarvis-sel-buttons", className: "lp-jarvis-sel-buttons" });
    // Container sepadan dengan LP Sidebar AI (initAiSelectionButton): floating,
    // bulat — biru (Ai) + hijau (➕). Tiada butang carian sebaris: carian pilihan
    // (SSS) dikendalikan oleh popup BERASINGAN (butang kanta pembesar), SAMA seperti
    // AI sidebar. Butang Ai / ➕ muncul pada SEBARANG pilihan teks tanpa perlu
    // menghidupkan SSS.
    selButtonsEl.style.cssText = [
      "position:fixed", "z-index:2147483647", "display:flex", "align-items:center",
      "gap:6px", "pointer-events:auto",
      "transition:opacity 0.15s ease,transform 0.15s cubic-bezier(0.175,0.885,0.32,1.275)"
    ].join(";");

    function roundSelBtn(label, bg, hoverBg, title) {
      var b = el("button", { type: "button", text: label, title: title });
      b.style.cssText = [
        "width:34px", "height:34px", "border-radius:50%",
        "background:" + bg, "color:#fff", "border:2px solid rgba(255,255,255,0.4)",
        "box-shadow:0 4px 12px rgba(0,0,0,0.35)",
        "font-family:'Orbitron','Rajdhani',sans-serif", "font-size:13px", "font-weight:700",
        "cursor:pointer", "display:flex", "align-items:center", "justify-content:center",
        "padding:0", "margin:0", "transition:transform 0.15s ease,background 0.15s ease"
      ].join(";");
      b.addEventListener("mouseenter", function () { b.style.transform = "scale(1.12)"; b.style.background = hoverBg; });
      b.addEventListener("mouseleave", function () { b.style.transform = "scale(1)"; b.style.background = bg; });
      b.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
      return b;
    }

    var aiBtn = roundSelBtn("Ai", "rgba(59,130,246,0.95)", "#2563eb", "Hantar teks pilihan ke AI");
    var noteBtn = roundSelBtn("➕", "rgba(16,185,129,0.95)", "#059669", "Masukkan teks pilihan ke nota");
    selButtonsEl.appendChild(aiBtn);
    selButtonsEl.appendChild(noteBtn);
    (document.body || document.documentElement).appendChild(selButtonsEl);

    aiBtn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      var txt = getSelectionText();
      hideSelButtons();
      if (txt) { processMessage("/" + txt); }
    });
    noteBtn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      var txt = getSelectionText();
      hideSelButtons();
      if (!txt) return;
      // Buka popover "Sisip ke nota" (append ATAU sebagai anak node) — dipindahkan
      // dari LP Sidebar AI supaya pengguna boleh pilih node sasaran, bukan append
      // ke bawah sahaja.
      openJarvisNoteInsertPopover(txt).then(function (result) {
        if (!result) return;
        try {
          api.runtime.sendMessage({
            type: "lp-insert-ai-text-final",
            text: txt,
            mode: result.mode,
            lineIndex: result.lineIndex
          }).catch(function () {});
        } catch (e2) {}
        addBubble("jarvis", result.mode === "child"
          ? "Teks pilihan disisip sebagai anak node."
          : "Teks pilihan dihantar ke nota Local Pocket.");
      });
    });

    // Make the popup draggable by its background (not the buttons). Position is
    // persisted so it stays where the user leaves it (mirrors LP Sidebar AI).
    selButtonsEl.addEventListener("mousedown", function (e) {
      if (e.target !== selButtonsEl) return; // only drag via empty background
      e.preventDefault();
      var startX = e.clientX, startY = e.clientY;
      var origTop = selButtonsEl.offsetTop, origLeft = selButtonsEl.offsetLeft;
      var dragging = true;
      function onMove(ev) {
        if (!dragging) return;
        var nx = origLeft + (ev.clientX - startX);
        var ny = origTop + (ev.clientY - startY);
        nx = Math.max(0, Math.min(window.innerWidth - selButtonsEl.offsetWidth, nx));
        ny = Math.max(0, Math.min(window.innerHeight - selButtonsEl.offsetHeight, ny));
        selButtonsEl.style.left = nx + "px";
        selButtonsEl.style.top = ny + "px";
      }
      function onUp() {
        dragging = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        selButtonsPos = { top: selButtonsEl.offsetTop, left: selButtonsEl.offsetLeft };
        setJarvisPref("selButtonsPos", selButtonsPos);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function showSelButtons(rect) {
    if (!selButtonsEl) ensureSelButtons();
    if (!selButtonsEl) return;
    selButtonsEl.style.display = "flex";
    if (SIDEBAR_HOST) {
      if (selButtonsPos) {
        selButtonsEl.style.top = selButtonsPos.top + "px";
        selButtonsEl.style.left = selButtonsPos.left + "px";
      } else if (rect) {
        // Letak berhampiran pilihan (sepadan AI sidebar) bila pilihan dibuat
        // DALAM panel JARVIS (cth. transkrip).
        var sp = 10;
        var cw = selButtonsEl.offsetWidth || 74;
        var ch = selButtonsEl.offsetHeight || 34;
        var top = rect.bottom + sp;
        var left = rect.left + rect.width / 2 - cw / 2;
        if (top + ch > window.innerHeight - sp) top = rect.top - ch - sp;
        left = Math.max(sp, Math.min(left, window.innerWidth - cw - sp));
        selButtonsEl.style.top = top + "px";
        selButtonsEl.style.left = left + "px";
      } else if (inputEl) {
        try {
          var ir = inputEl.getBoundingClientRect();
          selButtonsEl.style.left = Math.max(0, ir.left) + "px";
          selButtonsEl.style.top = Math.max(0, ir.top + ir.height + 6) + "px";
        } catch (e) {}
      }
    } else if (rect) {
      var top = (rect.bottom != null ? rect.bottom : rect.top) + 6;
      var left = rect.left != null ? rect.left : 0;
      selButtonsEl.style.top = top + "px";
      selButtonsEl.style.left = left + "px";
    }
  }

  function hideSelButtons() {
    if (selButtonsEl) selButtonsEl.style.display = "none";
  }

  // ── Popover "Sisip ke nota" (dipindahkan dari LP Sidebar AI) ──
  // Bila butang ＋ Note diklik, paparkan popover dengan dua pilihan:
  // "Tambah ke bawah nota" (append) ATAU "Sebagai anak node" (child) dengan
  // pemilih senarai node nota. Menyokong sisip ke node tertentu (lineIndex)
  // melalui hook lp-insert-ai-text-final (mode "child").
  function getNoteContentNodes() {
    return new Promise(function (resolve) {
      try {
        var p = api.runtime.sendMessage({ type: "lp-get-content-nodes" });
        if (p && typeof p.then === "function") {
          p.then(function (r) { resolve((r && Array.isArray(r.nodes)) ? r.nodes : []); })
            .catch(function () { resolve([]); });
        } else {
          resolve([]);
        }
      } catch (e) { resolve([]); }
    });
  }

  function openJarvisNoteInsertPopover(text) {
    return getNoteContentNodes().then(function (nodes) {
      return showJarvisNoteInsertPopoverUI(nodes || [], text);
    });
  }

  function showJarvisNoteInsertPopoverUI(nodes, text) {
    return new Promise(function (resolve) {
      var _popoverOpen = true;
      function IMP() { return "color:#ffffff !important;"; }
      var popup = el("div", {
        id: "lp-jarvis-note-insert-popup",
        style: [
          "position:fixed", "z-index:2147483647",
          "background:rgb(18,20,28) !important",
          "border:1px solid rgba(255,255,255,0.18) !important", "border-radius:14px",
          "box-shadow:0 20px 48px rgba(0,0,0,0.6),0 2px 8px rgba(0,0,0,0.4) !important",
          "padding:16px", "min-width:300px", "max-width:380px",
          "top:50%", "left:50%", "transform:translate(-50%,-50%)",
          "display:flex", "flex-direction:column", "gap:12px",
          IMP()
        ].join(";")
      });

      popup.appendChild(el("div", {
        text: "📝 Sisip teks ke nota",
        style: "font-size:14px !important;font-weight:700 !important;color:#ffffff !important;text-align:center;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.12) !important;"
      }));

      var mode = "append";
      var selLineIndex = null;

      function mkOpt(labelText) {
        var o = el("div", {
          style: "display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer !important;background:rgba(255,255,255,0.04) !important;color:#ffffff !important;font-size:13px !important;"
        });
        var dot = el("span", {
          style: "width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,0.5) !important;flex:0 0 auto;display:inline-block;"
        });
        var txt = el("span", { text: labelText, style: "color:#ffffff !important;font-size:13px !important;font-weight:500 !important;" });
        o.append(dot, txt);
        o._dot = dot;
        o.addEventListener("mouseenter", function () { o.style.background = "rgba(255,255,255,0.1) !important"; });
        o.addEventListener("mouseleave", function () { o.style.background = "rgba(255,255,255,0.04) !important"; });
        return o;
      }

      function setSelected(target) {
        [appendOpt, childOpt].forEach(function (o) {
          if (o && o._dot) o._dot.style.cssText = "width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,0.5) !important;flex:0 0 auto;display:inline-block;background:transparent !important;";
        });
        if (target && target._dot) target._dot.style.cssText = "width:14px;height:14px;border-radius:50%;border:2px solid #10b981 !important;background:#10b981 !important;flex:0 0 auto;display:inline-block;";
      }

      var appendOpt = mkOpt("Tambah ke bawah nota");
      appendOpt.addEventListener("click", function () {
        mode = "append"; setSelected(appendOpt); nodeWrap.style.display = "none";
      });
      popup.appendChild(appendOpt);

      var childOpt = mkOpt("Sebagai anak node:");
      childOpt.addEventListener("click", function () {
        if (nodes.length === 0) return;
        mode = "child"; setSelected(childOpt); nodeWrap.style.display = "block";
      });
      popup.appendChild(childOpt);

      // Custom dropdown (bukan <select>) supaya CSS halaman tidak menimpa.
      var nodeWrap = el("div", { style: "display:none;margin-left:22px;margin-top:4px;" });
      var nodeBox = el("div", {
        style: "max-height:170px;overflow-y:auto !important;background:rgb(28,30,40) !important;border:1px solid rgba(255,255,255,0.14) !important;border-radius:8px;padding:4px;"
      });
      var icons = { heading: "#", task: "☐", bullet: "•", numbered: "1.", text: "T" };
      if (nodes.length === 0) {
        nodeBox.appendChild(el("div", {
          text: "(tiada node dalam nota)",
          style: "padding:8px;color:#9aa0aa !important;font-size:12px !important;"
        }));
      }
      nodes.forEach(function (n) {
        var row = el("div", {
          text: (icons[n.type] || "•") + " " + n.label,
          style: "padding:7px 8px;border-radius:6px;cursor:pointer !important;color:#ffffff !important;font-size:12px !important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
        });
        row.addEventListener("mouseenter", function () { row.style.background = "rgba(16,185,129,0.25) !important"; });
        row.addEventListener("mouseleave", function () { row.style.background = "transparent !important"; });
        row.addEventListener("click", function () {
          selLineIndex = n.lineIndex;
          nodeBox.querySelectorAll("div").forEach(function (d) {
            if (d._sel) { d._sel = false; d.style.background = "transparent !important"; }
          });
          row._sel = true; row.style.background = "rgba(16,185,129,0.4) !important";
          nodeLabel.textContent = (icons[n.type] || "•") + " " + n.label;
        });
        nodeBox.appendChild(row);
      });
      var nodeLabel = el("div", {
        text: "— pilih node —",
        style: "padding:7px 8px;border-radius:6px;background:rgba(255,255,255,0.06) !important;color:#cdd2da !important;font-size:12px !important;cursor:pointer !important;margin-bottom:4px;"
      });
      nodeLabel.addEventListener("click", function () {
        nodeBox.style.display = nodeBox.style.display === "none" ? "block" : "none";
      });
      nodeWrap.append(nodeLabel, nodeBox);
      popup.appendChild(nodeWrap);
      nodeBox.style.display = "none";

      // Buttons
      var btnRow = el("div", {
        style: "display:flex;gap:8px;justify-content:flex-end;padding-top:8px;border-top:1px solid rgba(255,255,255,0.12) !important;"
      });
      var cancelBtn = el("div", {
        text: "Batal",
        style: "padding:7px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.18) !important;background:transparent !important;color:#cdd2da !important;font-size:12px !important;font-weight:500 !important;cursor:pointer !important;"
      });
      var confirmBtn = el("div", {
        text: "Masukkan",
        style: "padding:7px 16px;border-radius:8px;border:none !important;background:#10b981 !important;color:#ffffff !important;font-size:12px !important;font-weight:600 !important;cursor:pointer !important;"
      });
      btnRow.append(cancelBtn, confirmBtn);
      popup.appendChild(btnRow);

      (document.body || document.documentElement).appendChild(popup);

      var backdrop = el("div", {
        style: "position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483646;background:rgba(0,0,0,0.35) !important;"
      });
      (document.body || document.documentElement).appendChild(backdrop);

      function cleanup() {
        _popoverOpen = false;
        document.removeEventListener("keydown", onKey);
        if (popup.parentNode) popup.parentNode.removeChild(popup);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      }
      function onKey(e) { if (e.key === "Escape") { cleanup(); resolve(null); } }
      document.addEventListener("keydown", onKey);

      cancelBtn.addEventListener("click", function () { cleanup(); resolve(null); });
      backdrop.addEventListener("click", function () { cleanup(); resolve(null); });
      popup.addEventListener("mousedown", function (e) { e.stopPropagation(); });
      popup.addEventListener("click", function (e) { e.stopPropagation(); });

      // Default selection
      setSelected(appendOpt);

      confirmBtn.addEventListener("click", function () {
        if (mode === "child" && selLineIndex == null) {
          nodeLabel.style.borderColor = "#ef4444";
          nodeBox.style.display = "block";
          return;
        }
        cleanup();
        if (mode === "append") resolve({ mode: "append", lineIndex: null });
        else resolve({ mode: "child", lineIndex: selLineIndex });
      });
    });
  }

  // ── Toggle Selection Search dalam sidebar JARVIS (sama seperti AI sidebar) ──
  function applyJarvisSelSearchToggleUI(enabled) {
    var btn = root && root.querySelector("#lp-jarvis-sel-search-toggle");
    if (!btn) return;
    btn.setAttribute("aria-pressed", enabled ? "true" : "false");
    btn.title = enabled ? "Selection Search: ON (klik untuk matikan)" : "Selection Search: OFF (klik untuk hidupkan)";
    btn.style.background = enabled ? "rgba(59,130,246,0.18)" : "rgba(0,0,0,0.2)";
    btn.style.borderColor = enabled ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.15)";
    btn.style.color = enabled ? "#7ab8ff" : "#555";
  }

  // Baca state dari settings — guna KEDUA-DUA flag (selectionSearchEnabled &
  // selectionSearchPopup.enabled) supaya sepadan dengan AI sidebar.
  function loadJarvisSelSearchState() {
    try {
      lpStorageGet("settings", function (data) {
        var s = data && data.settings;
        if (!s) {
          jarvisSelSearchEnabled = true;
          s = {};
        } else {
          var popupEnabled = (s.selectionSearchPopup && typeof s.selectionSearchPopup === "object")
            ? (s.selectionSearchPopup.enabled !== false) : true;
          jarvisSelSearchEnabled = popupEnabled && (s.selectionSearchEnabled !== false);
        }
        applyJarvisSelSearchToggleUI(jarvisSelSearchEnabled);
        // Pastikan settings yang dihantar ke LPSelectionSearch mengandungi
        // selectionSearchPopup.enabled yang selari dengan jarvisSelSearchEnabled,
        // kerana SSS default kepada disabled (enabled: false).
        try {
          if (window.LPSelectionSearch) {
            var sssSettings = JSON.parse(JSON.stringify(s || {}));
            if (!sssSettings.selectionSearchPopup || typeof sssSettings.selectionSearchPopup !== "object") {
              sssSettings.selectionSearchPopup = {};
            }
            sssSettings.selectionSearchPopup.enabled = jarvisSelSearchEnabled;
            window.LPSelectionSearch.applySettings(sssSettings);
          }
        } catch (e2) {}
      });
    } catch (e) {
      jarvisSelSearchEnabled = true;
      applyJarvisSelSearchToggleUI(true);
    }
  }

  function handleJarvisSelSearchToggle() {
    jarvisSelSearchEnabled = !jarvisSelSearchEnabled;
    applyJarvisSelSearchToggleUI(jarvisSelSearchEnabled);
    // Synchronous: set enabled flag dalam LPSelectionSearch sekarang juga
    // (tanpa tunggu lpStorageGet async) supaya sebarang event selectionchange
    // atau mouseup setTimeout TIDAK re-show popup sebelum storage selesai.
    // Walaupun enjin list di-reset ke default, ianya tidak penting selagi
    // enabled=false — popup tidak akan dipaparkan.
    try {
      if (window.LPSelectionSearch) {
        window.LPSelectionSearch.applySettings({
          selectionSearchPopup: { enabled: jarvisSelSearchEnabled }
        });
      }
    } catch (eSync) {}
    // Simpan KEDUA-DUA flag supaya konsisten dengan AI sidebar
    // (dengan settings penuh dari storage, termasuk enjin list asal).
    try {
      lpStorageGet("settings", function (data) {
        var s = (data && data.settings) || {};
        s.selectionSearchEnabled = jarvisSelSearchEnabled;
        if (s.selectionSearchPopup && typeof s.selectionSearchPopup === "object") {
          s.selectionSearchPopup.enabled = jarvisSelSearchEnabled;
        } else {
          s.selectionSearchPopup = { enabled: jarvisSelSearchEnabled };
        }
        try { api.storage.local.set({ settings: s }); } catch (e2) {}
        try {
          if (window.LPSelectionSearch) window.LPSelectionSearch.applySettings(s);
        } catch (e3) {}
      });
    } catch (e) {}
  }

  function initSelectionButtons() {
    if (SIDEBAR_HOST) {
      // Pilihan teks hidup di TAB AKTIF, bukan halaman sidebar ini. Kita TIDAK
      // "poll" — sebaliknya mendengar mesej "jarvis-host-selection" yang
      // dihantar oleh skrip halaman aktif (floatingButtonFull.js) bila
      // pengguna memilih teks. Ini guna semula pengesanan pilihan sedia ada
      // dan memaparkan butang selection search sedia ada (ensureSelButtons)
      // dalam panel JARVIS dengan serta-merta.
      try { ensureSelButtons(); } catch (e) {}

      // Inisialisasi enjin Selection Search (SSS) yang dikongsi supaya highlight
      // TEKS DI DALAM panel JARVIS (transkrip) turut memaparkan popup carian
      // pilihan penuh (__lp_selection_search_popup) — menggunakan enjin & tetapan
      // dari options-sss, SAMA seperti Sidebar AI. (Content script tak boleh
      // jalan di halaman extension, jadi kita muat fail ini terus di sini dan
      // panggil modul kongsi dan bukannya "rinvent" SSS.)
      try {
        if (window.LPSelectionSearch) {
          window.LPSelectionSearch.init({ extensionApi: api, isPanel: true });
          lpStorageGet("settings", function (data) {
            var s = data && data.settings;
            if (s) {
              // Guna state toggle terkini supaya SSS tak terset ke disabled
              var sssSettings = JSON.parse(JSON.stringify(s));
              if (!sssSettings.selectionSearchPopup || typeof sssSettings.selectionSearchPopup !== "object") {
                sssSettings.selectionSearchPopup = {};
              }
              sssSettings.selectionSearchPopup.enabled = jarvisSelSearchEnabled;
              window.LPSelectionSearch.applySettings(sssSettings);
            }
          });
        }
      } catch (e) {}

      // Pilihan teks DALAM panel JARVIS (cth. teks transkrip) juga mesti
      // memaparkan butang Ai / ＋ Note / carian — SAMA seperti pilihan teks dalam
      // tab aktif. Tanpa ini, memilih teks di dalam panel sidebar tidak memunculkan
      // butang pilihan (hanya pilihan dari tab aktif yang di-relay yang memunculkan).
      // Autocopy: bila teks dipilih DALAM panel JARVIS, salin terus ke clipboard
      // tanpa klik apa-apa (tiada toggle, tiada notifikasi). Kekal hanya salin
      // teks yang BERBEZA supaya tak menulis semula clipboard pada setiap
      // micro-event selectionchange.
      var lastAutoCopied = "";
      document.addEventListener("selectionchange", function () {
        try {
          if (__jarvisCopyGuard) return;
          var sel = window.getSelection();
          if (!sel || sel.isCollapsed) { hideSelButtons(); return; }
          // Guna Range.toString() sebagai ganti sel.toString() yang kadang-
          // kala return empty untuk range valid lepas DOM diubah. Jika masih
          // kosong, guna cloneContents().textContent sebagai sandaran.
          try {
            var r = sel.getRangeAt(0);
            var selTxt = r.toString() || "";
            if (!selTxt.trim()) {
              try {
                var frag = r.cloneContents();
                selTxt = (frag.textContent || "").trim();
              } catch (e3) {}
            }
            if (!selTxt.trim()) { hideSelButtons(); return; }
          } catch (eRange) { hideSelButtons(); return; }
          var rect = null;
          try { var r = sel.getRangeAt(0).getBoundingClientRect(); if (r) rect = r; } catch (e2) {}
          showSelButtons(rect);
          // Auto-copy: hanya untuk pilihan di dalam panel (bukan medan edit
          // composer) supaya teks yang sedang diedit tak disalin secara tak sengaja.
          var aNode = sel.anchorNode;
          var ae = document.activeElement;
          var editing = ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
          if (!editing && aNode && root && root.contains(aNode) && selTxt && selTxt !== lastAutoCopied) {
            lastAutoCopied = selTxt;
            copyText(selTxt);
          }
        } catch (e3) {}
      });
      document.addEventListener("scroll", function () { hideSelButtons(); }, true);

      return;
    }
    document.addEventListener("selectionchange", function () {
      try {
        if (__jarvisCopyGuard) return;
        var sel = window.getSelection();
        if (!sel || sel.isCollapsed) { hideSelButtons(); return; }
        try {
          var r = sel.getRangeAt(0);
          var selTxt = r.toString() || "";
          if (!selTxt.trim()) {
            try { selTxt = (r.cloneContents().textContent || "").trim(); } catch (e3) {}
          }
          if (!selTxt.trim()) { hideSelButtons(); return; }
        } catch (eRange) { hideSelButtons(); return; }
        var rect = null;
        try { var r = sel.getRangeAt(0).getBoundingClientRect(); if (r) rect = r; } catch (e) {}
        showSelButtons(rect);
      } catch (e) {}
    });
    document.addEventListener("scroll", function () { hideSelButtons(); }, true);
  }

  var root = null;
  var transcriptEl = null;
  var inputEl = null;
  var open = false;
  var jarvisSuspended = false; // true while the Local Pocket AI sidebar is open
  var pinned = false;
  var currentToken = "";
  var activeAssistantBubble = null;
  // Conversation memory is stored as PER-TAB sessions (feature #2) under a
  // single storage object keyed by session id. The active tab resumes its own
  // session by page URL; sessions auto-expire after N days (default 30).
  var SESSIONS_KEY = "jarvisSessions";
  var SESSION_CAP = 50;
  var DEFAULT_TTL_DAYS = 30;
  var sessionTtlDays = DEFAULT_TTL_DAYS;
  var sessions = null;            // in-memory cache of the storage object
  var activeSessionId = null;
  var sessionsModal = null;       // session-list modal element (set in buildPanel)
  var CONVO_KEY = "jarvisConversations";   // saved conversation snapshots
  var CONVO_CAP = 20;
  var history = [];
   var pendingImage = null;        // captured screenshot (data URL) attached to next question (feature #6)
   var pendingImageUsed = false;    // true when pendingImage was consumed by sendToProvider
   var pendingAttachImage = null;   // image queued to push into the provider iframe (see deliverImageToProvider)
   var pendingCapturePromise = null; // Promise that resolves when a screenshot capture completes
   var pendingUserImage = null;     // image to show in the next user bubble (Gemini-style)
   var _autoSearchTriggered = false; // true bila auto-search "/cari" dah dihantar (elak double-submit)
   // When a text-only question is sent and the user later attaches a screenshot/
   // image, we re-send that question together with the picture (fixes the
   // "ask question THEN screenshot → image not sent" ordering bug).
    var expectingImageAfterQuestion = false;
    var expectingImageAfterQuestionTs = 0;
    // Debounced auto-resend timer (see maybeAutoSendImageWithLastQuestion). Any
    // explicit user action (typing, pressing send, clicking the /cari chip)
    // cancels it so a NEW command is never hijacked by the previous question.
    var pendingImageAutoSendTimer = null;
    function cancelImageAutoSend() {
      if (pendingImageAutoSendTimer) { clearTimeout(pendingImageAutoSendTimer); pendingImageAutoSendTimer = null; }
    }
    var imgThumb = null;            // thumbnail preview element (set in buildPanel)
   var imgAttachBtn = null;        // camera button element (set in buildPanel)
   var fileInputEl = null;         // hidden file picker input
   var capturePopup = null;        // capture-mode popup (set lazily)

    // ── Interaksi Pelbagai Modaliti (#3): TTS ──
    // Puter TTS SAHAJA (puter.ai.txt2speech) — suara neural, percuma, TIADA
    // speechSynthesis OS. SDK dimuat secara malas bila TTS dihidupkan.
    // Untuk elak popup auth Puter (yang tak boleh siap dalam extension), guna
    // API key Puter percuma melalui medan di bahagian bawah panel.
    var ttsBtn = null;              // TTS toggle button element (set in buildPanel)
    var jarvisTtsEnabled = false;   // persisted toggle (default OFF)
    var JARVIS_TTS_KEY = "jarvisTtsEnabled";
    var voiceLang = "ms-MY";        // bahasa untuk Puter TTS
    var jarvisAudio = null;         // <audio> dari Puter TTS (untuk stop)
    var puterApiKey = "";           // Puter API key (percuma) — elak popup auth dlm extension
    var puterKeyInput = null;       // input medan API key (set in buildPanel)
    var puterKeyStatus = null;      // status kecil bila key disimpan (set in buildPanel)
    var puterKeyChip = null;        // chip ringkas "🔑 Puter ✓" bila key dah diset (set in buildPanel)
    var googleApiKey = "";          // Google AI Studio API key (percuma) — untuk TTS Google terus
    var googleKeyInput = null;      // input medan Google key (set in buildPanel)
    var googleKeyRow = null;        // baris medan Google key (set in buildPanel)
    var _googleKeyWarned = false;   // elak amaran TTS Google berulang bila tiada key
    var jarvisVoiceMs = "";         // suara pilihan untuk teks Melayu (kosong = auto)
    var jarvisVoiceEn = "";         // suara pilihan untuk teks English (kosong = auto)
    var jarvisVoiceMsSelect = null; // <select> suara Melayu (set in buildPanel)
    var jarvisVoiceEnSelect = null; // <select> suara English (set in buildPanel)
    var ttsProvider = "google";     // "google" (Gemini API) atau "gemini" (Puter)
    var jarvisVoiceHidden = true;   // Suara TTS tertutup secara default
    var jarvisAccApiHidden = false;     // Kunci API BUKA secara default (kunci Gemini mudah dicanai)
    var jarvisAccDisplayHidden = true;  // Paparan tertutup secara default
    var GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
    var puterVoiceMap = {};         // metadata suara Puter (id -> objek) untuk bina opts
    // Senarai suara Puter TERPILIH — HANYA Bahasa Melayu & English (tiada JP/CN).
    // "Auto" ikut default Puter untuk bahasa yang dikesan.
    var PUTER_VOICES = [
      { id: "", label: "Auto (default Puter)" },
      { id: "Yasmin", label: "Yasmin (Melayu · ms-MY)" },
      { id: "Joanna", label: "Joanna (English US · neural)" },
      { id: "Matthew", label: "Matthew (English US · neural)" },
      { id: "Amy", label: "Amy (English UK)" },
      { id: "Brian", label: "Brian (English UK)" },
      { id: "Salli", label: "Salli (English US)" },
      { id: "Kimberly", label: "Kimberly (English US)" },
      { id: "Emma", label: "Emma (English UK · neural)" },
      { id: "Aria", label: "Aria (English US · neural)" }
    ];
    // Suara Gemini (model gemini-2.5-flash-preview-tts). Suara ini serba guna —
    // boleh bercakap pelbagai bahasa (termasuk Melayu & English). "Auto" ikut
    // suara default Gemini.
    var GEMINI_VOICES = [
      { id: "", label: "Auto (default Gemini)" },
      { id: "Zephyr", label: "Zephyr" },
      { id: "Puck", label: "Puck" },
      { id: "Charon", label: "Charon" },
      { id: "Kore", label: "Kore" },
      { id: "Fenrir", label: "Fenrir" },
      { id: "Aoede", label: "Aoede" },
      { id: "Leda", label: "Leda" },
      { id: "Orus", label: "Orus" }
    ];
    // Senarai suara ikut provider semasa (modul-level supaya boleh dipanggil
    // semula lepas prefs dimuat secara async).
    function currentVoiceList() {
      return (ttsProvider === "gemini" || ttsProvider === "google") ? GEMINI_VOICES : PUTER_VOICES;
    }
    // Isi semula kedua-dua dropdown suara ikut provider semasa (kekalkan pilihan).
    function refreshVoiceOptions() {
      [jarvisVoiceMsSelect, jarvisVoiceEnSelect].forEach(function (sel) {
        if (!sel) return;
        while (sel.options.length > 0) sel.remove(0);
        currentVoiceList().forEach(function (v) {
          sel.appendChild(el("option", { value: v.id, text: v.label }));
        });
      });
      if (jarvisVoiceMsSelect) jarvisVoiceMsSelect.value = jarvisVoiceMs || "";
      if (jarvisVoiceEnSelect) jarvisVoiceEnSelect.value = jarvisVoiceEn || "";
    }
    // Tapis medan key ikut provider & papar semula nilai tersimpan ke UI.
    // Dipanggil lepas buildPanel dan lepas loadJarvisPrefs (async) siap, supaya
    // nilai tersimpan (provider, suara, Google key) benar-benar dipaparkan.
    function applyTtsPrefsUi() {
      try {
        var prov = document.getElementById("lp-jarvis-tts-provider");
        if (prov) prov.value = ttsProvider || "puter";
        var isGoogle = ttsProvider === "google";
        var pkRow = document.getElementById("lp-jarvis-puter-key-row");
        var pkChip = document.getElementById("lp-jarvis-puter-chip");
        var gRow = document.getElementById("lp-jarvis-google-key-row");
        if (pkRow) pkRow.style.display = isGoogle ? "none" : "";
        if (pkChip) pkChip.style.display = (isGoogle || !puterApiKey) ? "none" : "";
        if (gRow) gRow.style.display = isGoogle ? "flex" : "none";
        var gi = document.getElementById("lp-jarvis-google-key");
        if (gi) gi.value = googleApiKey || "";
        if (jarvisVoiceMsSelect) jarvisVoiceMsSelect.value = jarvisVoiceMs || "";
        if (jarvisVoiceEnSelect) jarvisVoiceEnSelect.value = jarvisVoiceEn || "";
        // Samakan keadaan bahagian bawah & accordion dengan pref tersimpan.
        // Dipanggil lepas buildPanel (muatan pref async). Guna getElementById
        // (bukan rujukan pembolehubah buildPanel) supaya selamat tak kira
        // susunan async — membetulkan "sembunyi bahagian bawah" / accordion
        // tertutup yang muncul semula selepas buka semula JARVIS.
        try {
          var _bs = document.getElementById("lp-jarvis-bottom-section");
          if (_bs) {
            if (bottomSectionHidden) _bs.classList.add("lp-jarvis-bottom-hidden");
            else _bs.classList.remove("lp-jarvis-bottom-hidden");
          }
        } catch (eBs) {}
        try {
          var _tBody = document.getElementById("lp-jarvis-acc-tts-body");
          if (_tBody) _tBody.style.display = jarvisAccApiHidden ? "none" : "flex";
          var _tHead = document.getElementById("lp-jarvis-acc-tts");
          if (_tHead) _tHead.textContent = (jarvisAccApiHidden ? "▶ " : "▼ ") + "TTS & Suara";
          var _dBody = document.getElementById("lp-jarvis-acc-disp-body");
          if (_dBody) _dBody.style.display = jarvisAccDisplayHidden ? "none" : "flex";
          var _dHead = document.getElementById("lp-jarvis-acc-disp");
          if (_dHead) _dHead.textContent = (jarvisAccDisplayHidden ? "▶ " : "▼ ") + "Paparan";
        } catch (eAcc) {}
      } catch (e) {}
    }
    var _puterTtsWarned = false;    // elak amaran TTS berulang bila tiada auth
    // Puter TTS guna model "user-pays" — ia MEMERLUKAN akaun Puter percuma.
    // Bila pengguna TAK log masuk, Puter cuba buka popup auth
    // (puter.com/?request_auth=...). Dalam konteks extension, popup ini
    // TAK BOLEH siap (handshake merentas asal gagal) lalu papar KOSONG.
    // Penyelesaian: guna API key Puter (puter.setAPIKey) — ini LANGSUNG buka
    // TTS tanpa popup. Tiada API key & tak log masuk → TTS senyap (tiada audio).
    // Popup auth Puter disekat supaya tiada tingkap kosong muncul.
    var _puterPopupGuardInstalled = false;
    function installPuterPopupGuard() {
      if (_puterPopupGuardInstalled) return;
      _puterPopupGuardInstalled = true;
      try {
        var origOpen = window.open ? window.open.bind(window) : null;
        window.open = function (url, name, features) {
          var u = String(url || "");
          if (u.indexOf("puter.com") >= 0 && u.indexOf("request_auth") >= 0) {
            // Sekat popup auth Puter yang kosong — jangan biarkan ia kelihatan.
            return null;
          }
          return origOpen ? origOpen(url, name, features) : null;
        };
      } catch (e) {}
    }
    // Guna API key Puter (jika diberi) supaya TTS berfungsi TANPA popup auth
    // interaktif — penting dalam extension di mana popup auth tak boleh siap.
    // SDK Puter guna setAuthToken() (bukan setAPIKey) untuk bearer token.
    function applyPuterApiKey() {
      if (!puterApiKey) return;
      try {
        var p = window.puter;
        if (!p) return;
        if (typeof p.setAuthToken === "function") p.setAuthToken(puterApiKey);
        else if (p.auth && typeof p.auth.setAuthToken === "function") p.auth.setAuthToken(puterApiKey);
        else if (typeof p.init === "function") { try { p.init({ authToken: puterApiKey }); } catch (e2) {} }
      } catch (e) {}
    }
    // Muat SENARAI PENUH suara Puter secara dinamik (bukan senarai hardcoded)
    // supaya pengguna boleh pilih dari berpuluh-puluh suara merentas provider.
    // HANYA suara Bahasa Melayu & English dimasukkan (tapisan bahasa).
    var puterVoicesLoaded = false;
    function populatePuterVoices() {
      if (ttsProvider !== "puter") return;
      if (puterVoicesLoaded) return;
      var ai = window.puter && window.puter.ai;
      if (!ai || !ai.txt2speech || typeof ai.txt2speech.listVoices !== "function") return;
      try {
        ai.txt2speech.listVoices().then(function (voices) {
          if (!Array.isArray(voices)) return;
          puterVoicesLoaded = true;
          puterVoiceMap = {};
          var selects = [jarvisVoiceMsSelect, jarvisVoiceEnSelect];
          selects.forEach(function (sel) {
            if (!sel) return;
            var existing = {};
            Array.prototype.forEach.call(sel.options, function (o) { existing[o.value] = true; });
            voices.forEach(function (v) {
              var id = v && (v.id || v.name);
              if (!id || existing[id]) return;
              var lang = String(v.language || "").toLowerCase();
              // Tapis: kekalkan HANYA suara Melayu (ms) & English (en).
              if (lang.indexOf("ms") !== 0 && lang.indexOf("en") !== 0) return;
              existing[id] = true;
              puterVoiceMap[id] = v;
              var label = (v.name || id) + (v.language ? " · " + v.language : "") + (v.provider ? " (" + v.provider + ")" : "");
              var opt = document.createElement("option");
              opt.value = id; opt.textContent = label;
              sel.appendChild(opt);
            });
          });
          if (jarvisVoiceMsSelect) jarvisVoiceMsSelect.value = jarvisVoiceMs || "";
          if (jarvisVoiceEnSelect) jarvisVoiceEnSelect.value = jarvisVoiceEn || "";
        }).catch(function () { /* kekal senarai hardcoded */ });
      } catch (e) {}
    }
    // Dipanggil bila SDK sedia: apply key + muat senarai suara.
    function onPuterReady() {
      applyPuterApiKey();
      populatePuterVoices();
    }
    // yang berlaku SECARA ASYNC — lepas panel dibina). Jika key sudah wujud,
    // SEMBUNYIKAN terus medan & chip (jangan papar panel berkaitan). Jika tiada
    // key, papar medan input sahaja. Guna getElementById supaya tak bergantung
    // pada pembolehubah lokal buildPanel (elak ReferenceError dalam strict mode).
    function syncPuterKeyUi() {
      var input = document.getElementById("lp-jarvis-puter-key");
      var row = document.getElementById("lp-jarvis-puter-key-row");
      var chip = document.getElementById("lp-jarvis-puter-chip");
      if (!input) return;
      input.value = puterApiKey || "";
      var has = !!puterApiKey;
      if (row) row.style.display = has ? "none" : "flex";
      if (chip) chip.style.display = "none";
    }
    // Papar hanya medan key yang sepadan dengan provider TTS semasa:
    // Puter ↔ Puter key, Google (Gemini API) ↔ Gemini key. Medan berkaitan
    // muncul sebaik pengguna tukar provider TTS di bahagian "Kunci API".
    function syncProviderKeyUi() {
      var isGoogle = ttsProvider === "google";
      if (puterKeyRow) puterKeyRow.style.display = isGoogle ? "none" : "";
      if (puterKeyChip) puterKeyChip.style.display = (isGoogle || !puterApiKey) ? "none" : "";
      if (googleKeyRow) googleKeyRow.style.display = isGoogle ? "flex" : "none";
    }
    // Ciri TTS Puter telah dibuang — SDK Puter tidak lagi dimuatkan. Fungsi ini
    // dikembalikan sebagai no-op yang sentiasa gagal supaya tiada kod pihak ketiga
    // (lib/puter.js) dimuatkan ke dalam halaman.
    function loadPuterSdk() {
      return Promise.resolve(false);
    }
  var selectOverlay = null;       // region-selection overlay (lazy)
  var selectBox = null;
  var selectBar = null;
  var selectHandles = {};
  var regionMode = false;
  var regionDrawing = false, regionMoving = false, regionResizing = false;
  var regionHandle = null, regionStartMouse = null, regionStartRect = null, regionStart = null;
  var regionRect = null;
  var imageSelectMode = false;   // "Pilih imej" mode (hover + click to snap)
  var imageSelectHL = null;      // hover highlight box (lazy)
  var imageSelectLabel = null;   // label inside the highlight box
  var imageSelectHint = null;    // bottom instruction/hint bar (lazy)
  var _imgSelMove = null, _imgSelClick = null, _imgSelKey = null;
  var proactiveDone = false;
  var providerIframe = null;
  var providerVisible = false;
   var sendBtn = null;
    var busyIndicator = null;
    var activeDone = null;
    // After this long in a busy (processing/cancellable) state with no progress,
    // flag the cancel button as "stuck" (orange blink) so the user knows they
    // can force-cancel JARVIS if a turn is genuinely hung.
    var STUCK_MS = 5000;
    var stuckTimer = null;
   // The transcript bubble that currently shows an in-flight "processing /
   // cancellable" indicator. Tracked so the indicator can be moved (planning ->
   // answer bubble) and cleared centrally when JARVIS goes idle.
   var processingBubble = null;

  // Tools the Gemini "brain" can choose from when planning an action.
  var TOOLS = [
    { action: "save", desc: "Simpan halaman semasa ke dalam library." },
    { action: "summarize", desc: "Ringkaskan halaman semasa." },
    { action: "search_library", params: ["query"], desc: "Cari dalam simpanan artikel tersimpan." },
    { action: "search_web", params: ["query"], desc: "Cari di internet (buka tab carian)." },
    { action: "search_youtube", params: ["query"], desc: "Cari dalam YouTube dan buka tab hasil carian YouTube." },
    { action: "open_youtube_tabs", params: ["query", "count"], desc: "Cari YouTube dan buka beberapa tab berbeza dengan hasil berkaitan (count = bilangan tab)." },
    { action: "open_category", params: ["name"], desc: "Buka pemilih kategori." },
    { action: "open_url", params: ["target"], desc: "Buka laman web (URL atau domain, contoh github.com) dalam tab BAHARU." },
    { action: "navigate", params: ["target"], desc: "Pergi ke laman web DALAM tab semasa (tukar halaman ini, bukan buka tab baharu). Guna untuk 'buka X di halaman ini'." },
    { action: "click_first_link", desc: "Klik pautan (link) PERTAMA dalam halaman semasa. Guna bila arahan menyebut 'klik link pertama' / 'click first link'." },
    { action: "new_tab", desc: "Buka tab baharu." },
    { action: "close_tab", desc: "Tutup tab semasa." },
    { action: "close_all_tabs", desc: "Tutup semua tab lain (PERLU disahkan pengguna)." },
    { action: "reload", desc: "Muat semula halaman." },
    { action: "back", desc: "Sejarah ke belakang." },
    { action: "forward", desc: "Sejarah ke hadapan." },
    { action: "bookmark", desc: "Tandakan halaman ke penanda buku." },

    { action: "scroll", params: ["direction"], desc: "Tatal ke atas atau bawah." },
    { action: "click", params: ["target", "index"], desc: "Klik elemen (butang/pautan). Guna 'index' (nombor dari snapshot DOM) untuk ketepatan, ATAU 'target' teks yang kelihatan." },
    { action: "fill", params: ["field", "value", "index"], desc: "Isi medan borang. Guna 'index' (nombor snapshot) atau 'field'=label medan, 'value'=teks." },
    { action: "snapshot", desc: "Papar senarai elemen interaktif halaman semasa (untuk rujukan/debug)." },
    { action: "open_sidebar", desc: "Buka sidebar AI add-on." },
    { action: "open_library", desc: "Buka library/senarai simpanan." },
    { action: "toggle_notes", desc: "Buka atau tutup overlay nota." },
    { action: "toggle_pomodoro", params: ["minutes"], desc: "Mula pemasa Pomodoro. Jika arahan menyebut 'N minit'/'N min'/'N jam', sertakan minutes=N (1 jam = 60)." },
    { action: "open_settings", desc: "Buka tetapan add-on ini." },
    { action: "toggle_ai_overlay", desc: "Buka atau tutup overlay AI." },
    { action: "copy_answer", desc: "Salin jawapan JARVIS terakhir ke clipboard." },
    { action: "copy_url", desc: "Salin URL halaman semasa ke clipboard." },
    { action: "copy_markdown", desc: "Salin tajuk + URL halaman sebagai pautan markdown ke clipboard." },
    { action: "translate_selection", params: ["query"], desc: "Terjemah teks yang dipilih (highlight) di halaman menggunakan AI." },
    { action: "summarize_selection", params: ["query"], desc: "Ringkaskan teks yang dipilih (highlight) di halaman menggunakan AI." },
    { action: "print_page", desc: "Cetak halaman semasa." },
    { action: "duplicate_tab", desc: "Buat salinan tab semasa." },
    { action: "zoom", params: ["direction"], desc: "Zum masuk ('in') atau keluar ('out') pada halaman." },
    { action: "chat", params: ["question"], desc: "Soalan bebas atau perbualan. JANGAN jawab; hanya label sebagai chat." },
    { action: "self_check", desc: "JARVIS lakukan diagnostik diri: gunakan AI untuk mengaudit kerosakan, ralat dan kelemahan JARVIS sendiri, kemudian beri laporan." },
    { action: "export_diagnostic", desc: "Eksport diagnostik JARVIS (snapshot + keputusan probe) sebagai JSON: disalin ke clipboard & dimuat turun, untuk dihantar kepada pembangang." },
    { action: "save_conversation", desc: "Simpan snapshot perbualan JARVIS semasa (disalin ke clipboard & dimuat turun JSON) untuk rujukan masa depan." },
    { action: "save_macro", params: ["name", "commands"], desc: "Cipta makro: rantaian arahan bernama (cth. 'simpan makro pagi: buka github.com; ringkas')." },
    { action: "run_macro", params: ["name"], desc: "Jalankan makro tersimpan (rantaian arahan). Boleh juga sebut terus nama makro." },
    { action: "list_macros", desc: "Senaraikan makro tersimpan." },
    { action: "delete_macro", params: ["name"], desc: "Padam makro tersimpan." }
  ];

   // Self-diagnostic material: runtime errors captured so the Gemini "brain"
   // can audit JARVIS's own faults/weaknesses when the user asks for a check.
   var jarvisErrors = [];
   function recordJarvisError(where, err) {
     try {
       var msg = err && (err.message || err.reason || err.error || String(err));
       jarvisErrors.push({ t: Date.now(), where: String(where || "unknown"), msg: String(msg || "unknown").slice(0, 300) });
       if (jarvisErrors.length > 50) jarvisErrors.shift();
     } catch (e) {}
   }
   try {
     window.addEventListener("error", function (e) {
       recordJarvisError("window.error:" + (e && e.filename ? e.filename + ":" + e.lineno : "global"), e && e.error ? e.error : e && e.message);
     });
     window.addEventListener("unhandledrejection", function (e) {
       recordJarvisError("unhandledrejection", e && e.reason ? e.reason : "promise rejection");
     });
   } catch (e) {}

   var planningMode = false;
   var planAcc = "";
   var lastUserText = "";
   var planningBubble = null;
   var _lastCachePrompt = "";
   var _cacheEnabled = true;

   // Watchdogs: if a provider response (planner OR chat) stalls and never sends
   // a terminal "done" signal, finalize gracefully instead of leaving the panel
   // stuck on a "…" placeholder forever.
    var RESPONSE_TIMEOUT_MS = 120000;
   var responseWatchdogTimer = null;
   var plannerWatchdogTimer = null;
   var activeOnComplete = null;
   var pendingPlanOnComplete = null;
   function armResponseWatchdog() {
     if (responseWatchdogTimer) clearTimeout(responseWatchdogTimer);
     responseWatchdogTimer = setTimeout(function () {
       responseWatchdogTimer = null;
        if (activeAssistantBubble) {
          var have = getBubbleText(activeAssistantBubble).replace(/^…$/, "").trim();
          if (have) {
            setBubbleText(activeAssistantBubble, have + "\n\n(Jawapan mungkin tidak lengkap — tiada isyarat 'done' dari " + PROVIDER + ".)");
          } else {
            setBubbleText(activeAssistantBubble, "Jawapan tergendala: tiada isyarat 'done' dari " + PROVIDER + ". Cuba lagi atau semak sambungan/AI Sidebar.");
          }
           recordTurn("jarvis", getBubbleText(activeAssistantBubble));
           activeAssistantBubble = null;
         }
        // Clear the in-transcript "Memproses…" indicator on timeout too, so a
        // stalled provider never leaves it stuck on the bubble.
        clearBubbleProcessing();
        currentToken = "";
       var cb = activeOnComplete; activeOnComplete = null;
       if (cb) cb();
       focusInput();
     }, RESPONSE_TIMEOUT_MS);
   }
   function clearResponseWatchdog() {
     if (responseWatchdogTimer) { clearTimeout(responseWatchdogTimer); responseWatchdogTimer = null; }
   }
   function armPlannerWatchdog() {
     if (plannerWatchdogTimer) clearTimeout(plannerWatchdogTimer);
     plannerWatchdogTimer = setTimeout(function () {
        plannerWatchdogTimer = null;
        planningMode = false;
        currentToken = "";
         if (planningBubble) { setBubbleText(planningBubble, "Perancangan tergendala (tiada jawapan dari " + PROVIDER + "). Cuba arahan setempat atau semak sambungan."); planningBubble = null; }
       var h = pendingPlanHandler; pendingPlanHandler = null;
       var oc = pendingPlanOnComplete; pendingPlanOnComplete = null;
       if (h) h(null);
       else { executePlan("", lastUserText); if (oc) oc(); }
       focusInput();
     }, RESPONSE_TIMEOUT_MS);
   }
    function clearPlannerWatchdog() {
      if (plannerWatchdogTimer) { clearTimeout(plannerWatchdogTimer); plannerWatchdogTimer = null; }
    }

    // Reflect whether JARVIS is mid-command (and thus cancellable) on the single
    // existing send button: "▶" to send, "■" to stop/cancel the in-flight request.
    // Also toggle a clear "loading" indicator so the user knows it's processing.
     function updateCancelButton() {
       if (!sendBtn) return;
         if (jarvisBusy) {
          sendBtn.textContent = "■";
          sendBtn.title = "Batalkan arahan / hentikan jawapan JARVIS";
          var _n = (typeof collectFollowUps === "function") ? collectFollowUps().length : 0;
          if (_n > 0) sendBtn.title += " (" + _n + " susulan beratur)";
          sendBtn.classList.add("lp-jarvis-cancel-mode");
          if (root) root.classList.add("lp-jarvis-busy-state");
          if (busyIndicator) busyIndicator.classList.add("lp-jarvis-busy-show");
          if (inputEl) {
            if (!inputEl.dataset.idlePlaceholder) inputEl.dataset.idlePlaceholder = inputEl.placeholder;
            inputEl.placeholder = "JARVIS menjawab… taip & Enter untuk susulan (■ batal)";
            inputEl.classList.add("lp-jarvis-followup-input");
            // Kekal fokus pada kotak input semasa menjawab supaya pengguna
            // boleh terus taip susulan tanpa kotak "hilang" fokus.
            expectInputFocus = true;
            startFocusKeeper();
          }
          // If JARVIS stays busy past STUCK_MS with no progress, mark the cancel
         // button as "stuck" (orange blink) so the user can spot a hung turn and
         // force-cancel it. Reset whenever we re-enter the busy state.
         if (stuckTimer) clearTimeout(stuckTimer);
         stuckTimer = setTimeout(function () {
           stuckTimer = null;
           if (jarvisBusy && sendBtn) sendBtn.classList.add("lp-jarvis-busy-stuck");
         }, STUCK_MS);
        } else {
         sendBtn.textContent = "▶";
         sendBtn.title = "Hantar (Enter)";
         sendBtn.classList.remove("lp-jarvis-cancel-mode");
          sendBtn.classList.remove("lp-jarvis-busy-stuck");
          if (root) root.classList.remove("lp-jarvis-busy-state");
          if (busyIndicator) busyIndicator.classList.remove("lp-jarvis-busy-show");
          if (inputEl) {
            if (inputEl.dataset.idlePlaceholder) inputEl.placeholder = inputEl.dataset.idlePlaceholder;
            inputEl.classList.remove("lp-jarvis-followup-input");
            // Berhenti kekalkan fokus bila sudah tidak sibuk.
            expectInputFocus = false;
            stopFocusKeeper();
          }
          if (stuckTimer) { clearTimeout(stuckTimer); stuckTimer = null; }
         // No longer busy -> drop the in-transcript "processing / cancellable"
         // indicator from whichever bubble still carries it.
         clearBubbleProcessing();
       }
     }

    // In-transcript indicator so the user can tell — right inside the
    // conversation, not only on the input row — that a JARVIS turn is still
    // being generated and can be cancelled. The indicator is a sibling of the
    // bubble's ".lp-jarvis-bubble-content" element so it survives streaming
    // content updates (setBubbleText only rewrites the content element).
    // Clicking it cancels the in-flight request, mirroring the ■ send button.
    function markBubbleProcessing(bubble) {
      if (!bubble) return;
      // Move the single indicator from any previous bubble onto this one.
      if (processingBubble && processingBubble !== bubble) clearBubbleProcessing();
      processingBubble = bubble;
      bubble.classList.add("lp-jarvis-bubble-processing");
      if (!bubble.querySelector(".lp-jarvis-bubble-status")) {
        var status = el("div", {
          className: "lp-jarvis-bubble-status",
          title: "JARVIS sedang memproses — klik untuk batalkan (■)",
          role: "status",
          "aria-label": "JARVIS sedang memproses. Klik untuk batalkan."
        }, [
          el("span", { className: "lp-jarvis-bubble-status-dots", html: "<i></i><i></i><i></i>" }),
          el("span", { className: "lp-jarvis-bubble-status-text", text: "Memproses… klik untuk batal" })
        ]);
        status.addEventListener("click", function (e) {
          e.stopPropagation();
          if (jarvisBusy) cancelCurrentKeepQueue();
        });
        bubble.appendChild(status);
      }
    }
    function clearBubbleProcessing() {
      if (processingBubble && processingBubble.isConnected) {
        var status = processingBubble.querySelector(".lp-jarvis-bubble-status");
        if (status) status.remove();
        processingBubble.classList.remove("lp-jarvis-bubble-processing");
        processingBubble = null;
        return;
      }
      processingBubble = null;
      if (!transcriptEl) return;
      try {
        var marks = transcriptEl.querySelectorAll(".lp-jarvis-bubble-status");
        for (var i = 0; i < marks.length; i++) {
          if (marks[i].parentNode) marks[i].parentNode.removeChild(marks[i]);
        }
        var busyBubbles = transcriptEl.querySelectorAll(".lp-jarvis-bubble-processing");
        for (var j = 0; j < busyBubbles.length; j++) {
          busyBubbles[j].classList.remove("lp-jarvis-bubble-processing");
        }
      } catch (e) {}
    }
    // Abort the current JARVIS request: invalidate the provider token so any
    // late response is ignored, stop the watchdogs, finalize any open bubble as
    // cancelled, drop queued commands, and ask the provider to stop its own
    // generation (best-effort). Then advance the command queue to idle.
    function cancelJarvis() {
      currentToken = "";
      planningMode = false;
      // Jejak sama ada pengguna sudah nampak pengesahan pembatalan, supaya kita
      // sentiasa beri maklum balas walaupun tiada bubble aktif untuk diubah.
      var shownCancelMsg = false;
       if (planningBubble) {
        setBubbleText(planningBubble, "Perancangan dibatalkan.");
        planningBubble = null;
        shownCancelMsg = true;
      }
      if (activeAssistantBubble) {
        var have = getBubbleText(activeAssistantBubble).replace(/^…$/, "").trim();
        setBubbleText(activeAssistantBubble, (have ? have + "\n\n" : "") + "(Dibatalkan oleh pengguna.)");
        recordTurn("jarvis", getBubbleText(activeAssistantBubble));
        activeAssistantBubble = null;
        shownCancelMsg = true;
      }
      // Tiada bubble untuk diubah (cth. batal semasa queue arahan / antara langkah)
      // — tetap tunjuk pengesahan ringkas supaya pengguna tahu ia berjaya dibatalkan.
      if (!shownCancelMsg) {
        addBubble("jarvis", "Arahan dibatalkan.");
      }
       clearPlannerWatchdog();
       clearResponseWatchdog();
       clearQueueWatchdog();
       pendingPlanHandler = null;
      pendingPlanOnComplete = null;
      activeOnComplete = null;
      try {
        api.runtime.sendMessage({ type: "jarvis-cancel-generation", provider: PROVIDER }).catch(function () {});
      } catch (e) {}
      commandQueue = [];
      // (Susulan beratur disimpan dalam commandQueue, jadi `commandQueue = []`
      //  di atas sudah membuangnya. Kosongkan preview.)
      renderFollowUps();
      var d = activeDone; activeDone = null;
      if (d) d();
      updateCancelButton();
      focusInput();
    }
    // Hentikan proses semasa tapi kekalkan susulan beratur dalam commandQueue.
    // Berbeza dengan cancelJarvis() yang membuang semua susulan. Fungsi ini
    // membatalkan bubble aktif, watchdog, token, tapi commandQueue dibiarkan
    // utuh supaya pumpQueue() segera memproses item seterusnya.
    function cancelCurrentKeepQueue() {
      currentToken = "";
      planningMode = false;
      var shownCancelMsg = false;
      if (planningBubble) {
        setBubbleText(planningBubble, "Perancangan dibatalkan.");
        planningBubble = null;
        shownCancelMsg = true;
      }
      if (activeAssistantBubble) {
        var have = getBubbleText(activeAssistantBubble).replace(/^…$/, "").trim();
        setBubbleText(activeAssistantBubble, (have ? have + "\n\n" : "") + "(Dibatalkan — giliran susulan seterusnya.)");
        recordTurn("jarvis", getBubbleText(activeAssistantBubble));
        activeAssistantBubble = null;
        shownCancelMsg = true;
      }
      if (!shownCancelMsg) {
        addBubble("jarvis", "Giliran ini dibatalkan, susulan diteruskan.");
      }
      clearPlannerWatchdog();
      clearResponseWatchdog();
      clearQueueWatchdog();
      pendingPlanHandler = null;
      pendingPlanOnComplete = null;
      activeOnComplete = null;
      try {
        api.runtime.sendMessage({ type: "jarvis-cancel-generation", provider: PROVIDER }).catch(function () {});
      } catch (e) {}
      // TIDAK kosongkan commandQueue — biar susulan beratur terus jalan
      renderFollowUps();
      var d = activeDone; activeDone = null;
      if (d) d();
      updateCancelButton();
      focusInput();
    }

   /* ---------- Learning from Gemini (auto-learn) ---------- */
   // Persisted, in-memory caches so learned commands run locally (fast + can
   // work offline) and element targets keep their known-good index per site.
     var LEARN_KEY = "jarvisLearnedCommands";
     var ELEM_KEY = "jarvisElementMemory";
     var HINT_CACHE_KEY = "jarvisElementHintsCache";
     var MACRO_KEY = "jarvisMacros";
     var macros = {};   // { "<name>": ["cmd1", "cmd2", ...] }
     // Per-host snapshot of auto-captured element hints, persisted so hints are
     // available immediately on the next visit / SPA navigation even before the
     // live DOM is re-scanned (Persistent Element Hints Cache).
     var hintCache = {};   // { "<host>": { "<target>": <index> } }
     var HINT_CACHE_CAP = 60;
   var learnedCommands = [];   // [{ phrase, plan, site, hits, created }]
    var elementMemory = {};     // { "<host>": { "<target>": <index> } } — learned/corrected (persisted)
    // Auto-captured element hints (from the live page). Kept SEPARATE and in
    // memory only so they can be flushed on every navigation without wiping the
    // learned corrections above, and without bloating storage with stale DOM.
    var elementHints = {};      // { "<host>": { "<target>": <index> } }

   function siteHost() {
     // In sidebar-host mode the meaningful host is the ACTIVE TAB's host (cached
     // from the last observation), not the moz-extension:// sidebar page host —
     // so learned commands / element hints key correctly per website.
     if (SIDEBAR_HOST) return hostHost || "";
     try { return new URL(location.href).hostname || ""; } catch (e) { return ""; }
   }
    // Merge learned commands that share the same normalized phrase (e.g. old
    // entries saved before phrase normalization existed, like "buka youtube di
    // page ni" vs "buka youtube d page ini"). Keeps the entry with the most
    // hits and sums the rest, so the stored cache stays clean over time.
    function dedupeLearnedCommands() {
      if (!Array.isArray(learnedCommands) || !learnedCommands.length) return;
      var byKey = {};
      var order = [];
      learnedCommands.forEach(function (e) {
        var key = Core.normalizeCommandPhrase(e && e.phrase);
        if (!key) return;
        if (byKey[key]) {
          var ex = byKey[key];
          ex.hits = (ex.hits || 0) + (e.hits || 0);
          if ((e.lastUsed || 0) > (ex.lastUsed || 0)) ex.lastUsed = e.lastUsed;
          if ((e.created || 0) < (ex.created || 0)) ex.created = e.created;
          if (!ex.plan && e.plan) ex.plan = e.plan;
        } else {
          e.phrase = key; // normalize the stored phrase so legacy entries (e.g.
                          // "buka youtube di page ni") are rewritten cleanly
          byKey[key] = e;
          order.push(key);
        }
      });
      learnedCommands = order.map(function (k) { return byKey[k]; });
    }
    // Drop low-value learned commands so the persisted JSON (and the per-call
    // JSON.stringify during storage) doesn't grow without bound. Keeps anything
    // used more than once, plus one-off commands touched recently (so a brand-new
    // phrase isn't pruned before it can be reused). Hard-caps the list size.
    function pruneLearnedCommands() {
      if (!Array.isArray(learnedCommands) || !learnedCommands.length) return;
      var MAX = 200;
      var NOW = Date.now();
      var RECENT_MS = 30 * 24 * 60 * 60 * 1000;
      var kept = learnedCommands.filter(function (e) {
        var hits = (e && e.hits) || 0;
        if (hits >= 2) return true;
        var lastUsed = (e && e.lastUsed) || (e && e.created) || 0;
        return (NOW - lastUsed) < RECENT_MS;
      });
      if (kept.length > MAX) {
        kept.sort(function (a, b) {
          var ha = (a && a.hits) || 0, hb = (b && b.hits) || 0;
          if (hb !== ha) return hb - ha;
          return ((b && b.lastUsed) || 0) - ((a && a.lastUsed) || 0);
        });
        kept = kept.slice(0, MAX);
      }
      learnedCommands = kept;
    }
    function loadLearning() {
      try {
        lpStorageGet([LEARN_KEY, ELEM_KEY, HINT_CACHE_KEY], function (data) {
          if (data && Array.isArray(data[LEARN_KEY])) learnedCommands = data[LEARN_KEY];
          if (data && data[ELEM_KEY] && typeof data[ELEM_KEY] === "object") elementMemory = data[ELEM_KEY];
          if (data && data[HINT_CACHE_KEY] && typeof data[HINT_CACHE_KEY] === "object") hintCache = data[HINT_CACHE_KEY];
          // Clean up legacy duplicate phrases, prune low-value entries, then
          // persist the result.
          dedupeLearnedCommands();
          pruneLearnedCommands();
          persistLearning();
        });
      } catch (e) {}
    }
    var _persistTimer = null;
    function persistLearning() {
      if (_persistTimer) clearTimeout(_persistTimer);
      _persistTimer = setTimeout(function () {
        _persistTimer = null;
        try { api.storage.local.set({ [LEARN_KEY]: learnedCommands, [ELEM_KEY]: elementMemory }); } catch (e) {}
      }, 3000);
    }
   // Recall a previously learned command for `text` (or null).
   function recallCommand(text) {
     return Core.matchLearnedCommand(text, learnedCommands);
   }
   // Store/refresh a learned command (phrase -> plan) for the current site.
   function learnCommand(phrase, plan, site) {
     if (!plan || (Array.isArray(plan) && !plan.length)) return;
      var key = Core.normalizeCommandPhrase(phrase);
      if (!key) return;
     // Don't learn pure chat intents.
     var first = Array.isArray(plan) ? plan[0] : plan;
     if (first && first.action === "chat") return;
     var existing = null;
     for (var i = 0; i < learnedCommands.length; i++) {
        if (Core.normalizeCommandPhrase(learnedCommands[i].phrase) === key) { existing = learnedCommands[i]; break; }
     }
     if (existing) {
       existing.plan = plan;
       existing.site = site || existing.site;
       existing.hits = (existing.hits || 0) + 1;
       existing.lastUsed = Date.now();
     } else {
       learnedCommands.push({ phrase: key, plan: plan, site: site || "", hits: 1, created: Date.now(), lastUsed: Date.now() });
     }
     persistLearning();
   }
   function bumpLearnedHit(entry) {
     if (!entry) return;
     entry.hits = (entry.hits || 0) + 1;
     entry.lastUsed = Date.now();
     persistLearning();
   }
   // Element memory: remember a target's index on a site (from ReAct corrections).
   function learnElement(site, target, index) {
     if (!site || !target || index == null) return;
     if (!elementMemory[site]) elementMemory[site] = {};
     elementMemory[site][Core.normalizeCommand(target)] = index;
     persistLearning();
   }
     function recallElement(site, target) {
       if (!site || !target) return null;
       var key = Core.normalizeCommand(target);
       var m = elementMemory[site];
       if (m && m.hasOwnProperty(key)) return m[key];
       var h = elementHints[site];
       if (h && h.hasOwnProperty(key)) return h[key];
       return null;
     }
     // Auto-seed element hints from the page's interactive elements so JARVIS can
     // resolve "klik butang <X>" by visible text alone (fallback when the planner
     // emits a `target` string instead of a snapshot `index`). Indices use the
     // SAME 1-based ordering as Core.getInteractiveNodes / resolveByIndex, so a
     // recalled index clicks the correct node. Kept in a SEPARATE in-memory map
     // (elementHints) that is flushed + re-captured on every navigation, so stale
     // entries from dynamic/SPA rendering never accumulate. Bounded per site.
      function capturePageElements() {
        // In the dedicated sidebar host there is no page DOM to scan (the active
        // tab is relayed separately). Scanning the panel's OWN DOM — including the
        // growing transcript — on every mutation storm (i.e. while JARVIS streams
        // an answer) wasted CPU and caused intermittent typing jank.
        if (SIDEBAR_HOST) return;
        try {
          var site = siteHost();
          if (!site || !Core || !Core.getInteractiveNodes) return;
          var nodes = Core.getInteractiveNodes({ max: 200 }) || [];
          var fresh = {};
          var added = 0;
          for (var i = 0; i < nodes.length; i++) {
            if (added >= HINT_CACHE_CAP) break;
            var node = nodes[i];
            if (!node || !node.getAttribute) continue;
            var label = (node.getAttribute("aria-label") || node.getAttribute("title") ||
                         node.textContent || node.value || node.placeholder || "").trim();
            label = Core.normalizeCommand ? Core.normalizeCommand(label) : String(label || "").toLowerCase();
            label = (label || "").trim();
            if (!label || label.length > 60) continue;
            // Prefer a learned/corrected index if one exists for this target.
            if (elementMemory[site] && elementMemory[site].hasOwnProperty(label)) continue;
            if (fresh[label] !== undefined) continue;
            fresh[label] = i + 1; // 1-based to match resolveByIndex
            added++;
          }
          // Merge: start from any cached hints (persisted or primed), then
          // override/add with the fresh live capture so indices stay correct.
          var merged = {};
          var base = hintCache[site] || elementHints[site] || {};
          for (var ck in base) { if (!(ck in fresh)) merged[ck] = base[ck]; }
          for (var fk in fresh) { merged[fk] = fresh[fk]; }
          // Cap the merged set per site.
          var capped = {};
          var count = 0;
          for (var mk in merged) { if (count >= HINT_CACHE_CAP) break; capped[mk] = merged[mk]; count++; }
          elementHints[site] = capped;
          persistHintCache(site);
         } catch (e) {}
      }
      // Persist this site's hints to the per-host storage cache (bounded).
      function persistHintCache(site) {
        if (!site || !elementHints[site]) return;
        try {
          hintCache[site] = {};
          var m = elementHints[site];
          var c = 0;
          for (var k in m) { if (c >= HINT_CACHE_CAP) break; hintCache[site][k] = m[k]; c++; }
          api.storage.local.set({ [HINT_CACHE_KEY]: hintCache });
        } catch (e) {}
      }
      // Prime in-memory hints from the persisted cache so they're usable the
      // instant the panel needs them (before the live DOM scan completes).
      function primeElementHints(site) {
        if (!site || !hintCache[site]) return;
        if (!elementHints[site]) elementHints[site] = {};
        var c = hintCache[site];
        for (var k in c) { if (elementHints[site][k] === undefined) elementHints[site][k] = c[k]; }
      }

      // SmartElementRecycle: drop in-memory element hints that no longer point at
      // a live DOM node. Hints are auto-captured from the page, so they go stale
      // as the page mutates (SPA navigation, dynamic lists). Removing dead
      // entries keeps `recallElement` from resolving to a detached/incorrect node.
      function purgeDeadHints() {
        try {
          var site = siteHost();
          if (!site || !elementHints[site]) return;
          var nodes = (Core && Core.getInteractiveNodes) ? Core.getInteractiveNodes({ max: 200 }) : [];
          var m = elementHints[site];
          Object.keys(m).forEach(function (k) {
            var idx = m[k];
            if (!nodes[idx - 1]) delete m[k];
          });
        } catch (e) {}
      }

      // Watch the page for structural changes and re-seed the element hints on a
      // debounce, so they never accumulate against a stale DOM. capturePageElements
      // flushes + re-captures, which is the recycle step itself.
      // The observer is only CONNECTED while JARVIS is open (startHintObserver /
      // stopHintObserver in toggle) — never left running after JARVIS is closed,
      // otherwise its continuous capturePageElements() would burn CPU forever and
      // make the tab (and any sidebar sharing the process) sluggish.
      var hintObserver = null;
      var _hintCooldown = 8000;
      var _hintDisconnectTimer = null;
      var _lastHintScan = 0;
      function attachHintObserver() {
        if (hintObserver) return;
        if (!window.MutationObserver) return;
        var timer = null;
        hintObserver = new MutationObserver(function () {
          if (timer) return;
          timer = setTimeout(function () {
            timer = null;
            try { capturePageElements(); } catch (e) {}
          }, 5000);
        });
      }
      function startHintObserver() {
        // The sidebar host page has no web page to observe; skip entirely.
        if (SIDEBAR_HOST) return;
        if (!hintObserver) attachHintObserver();
        if (!hintObserver) return;
        var now = Date.now();
        if (now - _lastHintScan < _hintCooldown) return;
        _lastHintScan = now;
        try { hintObserver.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
        if (_hintDisconnectTimer) clearTimeout(_hintDisconnectTimer);
        _hintDisconnectTimer = setTimeout(function () {
          _hintDisconnectTimer = null;
          try { if (hintObserver) hintObserver.disconnect(); } catch (e) {}
        }, 10000);
      }
      function stopHintObserver() {
        if (hintObserver) { try { hintObserver.disconnect(); } catch (e) {} }
        if (_hintDisconnectTimer) { clearTimeout(_hintDisconnectTimer); _hintDisconnectTimer = null; }
      }
       function elementHintsForSite(site) {
       var out = [];
       var m = site ? elementMemory[site] : null;
       if (m) {
         Object.keys(m).forEach(function (k) { out.push({ target: k, index: m[k] }); });
       }
       var h = site ? elementHints[site] : null;
       if (h) {
         Object.keys(h).forEach(function (k) { out.push({ target: k, index: h[k] }); });
       }
       return out;
     }

    // Merge imported memory (from a backup file) into the live caches.
    function mergeMemory(data) {
      if (!data || typeof data !== "object") return;
      if (Array.isArray(data.learnedCommands)) {
        data.learnedCommands.forEach(function (e) {
          if (!e || !e.phrase || !e.plan) return;
          var key = Core.normalizeCommand(e.phrase);
          var ex = null;
          for (var i = 0; i < learnedCommands.length; i++) {
            if (Core.normalizeCommandPhrase(learnedCommands[i].phrase) === key) { ex = learnedCommands[i]; break; }
          }
          if (ex) { ex.plan = e.plan; if (e.site) ex.site = e.site; }
          else learnedCommands.push({ phrase: key, plan: e.plan, site: e.site || "", hits: e.hits || 1, created: e.created || Date.now(), lastUsed: Date.now() });
        });
      }
      if (data.elementMemory && typeof data.elementMemory === "object") {
        Object.keys(data.elementMemory).forEach(function (site) {
          var src = data.elementMemory[site];
          if (!src || typeof src !== "object") return;
          if (!elementMemory[site]) elementMemory[site] = {};
          Object.keys(src).forEach(function (k) { elementMemory[site][k] = src[k]; });
        });
      }
      persistLearning();
    }

    // Export learned memory as a downloadable JSON backup file.
    function exportMemory() {
      try {
        var data = { version: 1, exportedAt: Date.now(), learnedCommands: learnedCommands, elementMemory: elementMemory };
        var json = JSON.stringify(data, null, 2);
        var blob = new Blob([json], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "jarvis-memory-" + new Date().toISOString().slice(0, 10) + ".json";
        (document.body || document.documentElement).appendChild(a);
        a.click();
        setTimeout(function () { try { URL.revokeObjectURL(url); a.remove(); } catch (e) {} }, 1000);
        addBubble("jarvis", "Ingatan dieksport: " + learnedCommands.length + " arahan, " + Object.keys(elementMemory).length + " laman. Fail: " + a.download);
      } catch (e) {
        addBubble("jarvis", "Gagal eksport ingatan: " + (e && e.message ? e.message : e));
      }
    }

    // Open a file picker and import a memory backup.
    function importMemoryViaPicker() {
      try {
        var inp = document.createElement("input");
        inp.type = "file";
        inp.accept = "application/json,.json";
        inp.style.position = "fixed";
        inp.style.left = "-9999px";
        inp.style.top = "0";
        inp.addEventListener("change", function () {
          var f = inp.files && inp.files[0];
          if (!f) return;
          var reader = new FileReader();
          reader.onload = function () {
            try {
              var parsed = JSON.parse(String(reader.result || ""));
              mergeMemory(parsed);
              addBubble("jarvis", "Ingatan diimport: " + learnedCommands.length + " arahan, " + Object.keys(elementMemory).length + " laman.");
            } catch (e2) {
              addBubble("jarvis", "Fail tak sah: " + (e2 && e2.message ? e2.message : e2));
            }
          };
          reader.onerror = function () { addBubble("jarvis", "Gagal baca fail."); };
          reader.readAsText(f);
        });
        (document.body || document.documentElement).appendChild(inp);
        inp.click();
        setTimeout(function () { try { inp.remove(); } catch (e) {} }, 6000);
      } catch (e) {
        addBubble("jarvis", "Gagal buka pemilih fail: " + (e && e.message ? e.message : e));
      }
    }

    /* ---------- Command macros (QuickCommandMacro) ----------
     * A macro is a named chain of JARVIS commands. Stored in storage.local so it
     * survives reloads. Members are enqueued into the serial command queue, so
     * they run one-by-one using the existing queue machinery. */

    function loadMacros() {
      try {
        lpStorageGet([MACRO_KEY], function (data) {
          if (data && data[MACRO_KEY] && typeof data[MACRO_KEY] === "object") {
            macros = data[MACRO_KEY];
          }
        });
      } catch (e) {}
    }
    function saveMacros() {
      try { api.storage.local.set({ [MACRO_KEY]: macros }); } catch (e) {}
    }
    // Normalize a macro name for matching/storage (lowercase, trimmed).
    function normMacroName(s) {
      return Core && Core.normalizeCommand ? Core.normalizeCommand(s) : String(s || "").toLowerCase().trim();
    }
    // Parse management commands: "simpan makro <nama>: cmd1; cmd2",
    // "makro <nama> = cmd1; cmd2", "padam makro <nama>", "senarai makro".
    // Returns { op, name, commands } or null.
    function parseMacroCommand(text) {
      var lower = String(text || "").toLowerCase().trim();
      var m;
      // save / create
      m = text.match(/^(?:(simpan|save|buat|new)\s+)?makro\s+(.+?)\s*(:=|=>|:|=)\s*(.+)$/i);
      if (m) {
        var body = (m[3] || "").trim();
        var cmds = splitMacroCommands(m[4] || "");
        if (!cmds.length) return null;
        return { op: "save", name: normMacroName(m[2]), commands: cmds };
      }
      // delete
      m = text.match(/^(padam|delete|hapus|buang)\s+makro\s+(.+)$/i);
      if (m) return { op: "delete", name: normMacroName(m[2]) };
      // list
      if (/^(senarai|list|show|papar)\s+makro|^makro\s*$/i.test(lower)) return { op: "list" };
      return null;
    }
    // Split a macro body into individual commands on ";" or newlines or " dan ".
    function splitMacroCommands(s) {
      return String(s || "").split(/\s*;\s*|\s*dan\s+|\n+/i)
        .map(function (c) { return c.trim(); })
        .filter(function (c) { return c.length > 0; });
    }
    // Resolve a free-form utterance to a macro: exact name, or
    // "jalankan/run macro <name>". Returns the command array or null.
    function matchMacro(text) {
      if (!text) return null;
      var lower = String(text).toLowerCase().trim();
      var m = lower.match(/^(jalankan|run|execute|laksana)\s+(makro\s+)?(.+)$/);
      var name = m ? m[3].trim() : text.trim();
      name = normMacroName(name);
      if (macros && macros.hasOwnProperty(name) && Array.isArray(macros[name]) && macros[name].length) {
        return { name: name, commands: macros[name] };
      }
      return null;
    }
    function doSaveMacro(name, commands) {
      // Macro-to-Command Normalizer: reject unusable macros before persisting.
      if (!name) { addBubble("jarvis", "Nama makro kosong."); return; }
      if (!Array.isArray(commands) || !commands.length) {
        addBubble("jarvis", "Makro \"" + name + "\" tiada arahan sah."); return;
      }
      // Drop blank commands and guard against obviously malformed input.
      var clean = commands.map(function (c) { return String(c || "").trim(); }).filter(function (c) { return c.length > 0; });
      if (!clean.length) { addBubble("jarvis", "Makro \"" + name + "\" tiada arahan sah."); return; }
      commands = clean;
      if (!macros) macros = {};
      macros[name] = commands;
      saveMacros();
      addBubble("jarvis", "Makro \"" + name + "\" disimpan dengan " + commands.length + " arahan: " + commands.join(" ; "));
    }
    function doDeleteMacro(name) {
      if (macros && macros.hasOwnProperty(name)) {
        delete macros[name];
        saveMacros();
        addBubble("jarvis", "Makro \"" + name + "\" dipadam.");
      } else {
        addBubble("jarvis", "Tiada makro \"" + name + "\".");
      }
    }
    function doListMacros() {
      var names = macros ? Object.keys(macros) : [];
      if (!names.length) { addBubble("jarvis", "Tiada makro disimpan. Cipta dengan: simpan makro <nama>: <arahan1>; <arahan2>"); return; }
      var lines = names.map(function (n) { return "• " + n + " (" + (macros[n] || []).length + " arahan)"; });
      addBubble("jarvis", "Makro (" + names.length + "):\n" + lines.join("\n"));
    }
    // Whether a macro step is a "recognized" command (i.e. it will do something
    // concrete) rather than free-form chat that falls back to the AI. Mirrors
    // the recognition order in processOne: management commands, saved macros,
    // learned commands, then a non-chat parsed intent. Supplied to the core
    // Macro Validation Engine so its step classification matches real behaviour.
    function isRecognizedCommand(cmd) {
      var t = String(cmd || "").trim();
      if (!t) return false;
      try {
        if (parseMacroCommand(t)) return true;
        if (Core && Core.parseMemoryCommand && Core.parseMemoryCommand(t)) return true;
        if (matchMacro(t)) return true;
        if (recallCommand(t)) return true;
        var lc = t.toLowerCase();
        if (/^(simpan|save)\s+perbualan|^save\s+conversation/.test(lc)) return true;
        if (/^(senarai|list)\s+perbualan|^list\s+conversations/.test(lc)) return true;
        var intent = Core && Core.parseIntent ? Core.parseIntent(t) : null;
        return !!(intent && intent.type && intent.type !== "chat" && intent.type !== "unknown");
      } catch (e) { return false; }
    }
    // Enqueue a macro's commands into the serial queue (tagged so the queue
    // finalizer can surface per-step progress) and pump it.
    function enqueueMacro(name, commands) {
      // Macro Validation Engine: verify the chain before running it. Guards
      // against cycles / self-reference (which would loop forever) and warns
      // when a step will silently fall back to the AI, so a broken chain never
      // runs blindly.
      if (Core && Core.validateMacroChain) {
        var v = Core.validateMacroChain(name, commands, macros, { isRecognized: isRecognizedCommand });
        if (v.cyclic) {
          addBubble("jarvis", "Makro \"" + name + "\" tidak dijalankan: dikesan kitaran/rujuk-diri (" +
            (v.cyclePath || []).join(" → ") + "). Ini boleh menyebabkan gelung tak terhingga.");
          return;
        }
        if (!v.runnable.length) {
          addBubble("jarvis", "Makro \"" + name + "\" tiada langkah sah untuk dijalankan.");
          return;
        }
        var chatSteps = v.steps.filter(function (s) { return s.kind === "chat"; });
        if (chatSteps.length) {
          addBubble("system", "⚠ Makro \"" + name + "\": " + chatSteps.length +
            " langkah tak dikenali akan dihantar sebagai soalan AI (" +
            chatSteps.map(function (s) { return "\"" + s.cmd + "\""; }).join(", ") + ").");
        }
        commands = v.runnable;
      }
      startMacroStatus(name, (commands || []).length);
      (commands || []).forEach(function (c) { commandQueue.push({ __macro: name, text: c }); });
      pumpQueue();
    }

    /* ---------- DOM helpers ---------- */

  // Assign a sanitizer under `Sanitizer.unwrapSafeHTML`.
  if (typeof Sanitizer === "undefined") { window.Sanitizer = {}; }
  if (typeof Sanitizer.unwrapSafeHTML !== "function") {
    Sanitizer.unwrapSafeHTML = function (html) { return sanitizeHtml(html); };
  }

  // Safely set an element's HTML without assigning a dynamic value to `innerHTML`
  // (addons-linter's no-unsanitized rule rejects any dynamic innerHTML assignment,
  // including Sanitizer.unwrapSafeHTML which is NOT whitelisted in its config).
  // We sanitize the markup and parse it into DOM nodes via DOMParser, then swap
  // them in with replaceChildren/appendChild so no `innerHTML` assignment exists.
  function safeSetHtml(el, html) {
    if (!el) return;
    var src = (html == null) ? "" : String(html);
    var clean = sanitizeHtml(src);
    el.replaceChildren();
    if (!clean) return;
    var doc = new DOMParser().parseFromString(clean, "text/html");
    var frag = document.createDocumentFragment();
    while (doc.body.firstChild) frag.appendChild(doc.body.firstChild);
    el.appendChild(frag);
  }

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === "className") node.className = props[k];
        else if (k === "text") node.textContent = props[k];
        else if (k === "html") safeSetHtml(node, props[k]);
        else node.setAttribute(k, props[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  function applyJarvisModeClass() {
    if (!root) return;
    root.classList.toggle("lp-jarvis-sidebar", jarvisMode === "sidebar");
  }
    function updateModeToggleLabel() {
      var b = root && root.querySelector("#lp-jarvis-mode-toggle");
      if (!b) return;
      // Butang memaparkan DEFAULT buka JARVIS semasa (bukan arahan switch).
      // Klik menogol antara "Sidebar" <-> "Overlay"; label berubah dengan serta-merta.
      if (jarvisOpenMode === "sidebar") {
        b.textContent = "Sidebar";
        b.title = "Default buka JARVIS: Sidebar — klik tukar ke Overlay";
      } else {
        b.textContent = "Overlay";
        b.title = "Default buka JARVIS: Overlay — klik tukar ke Sidebar";
      }
    }
  function toggleJarvisMode() {
    jarvisMode = jarvisMode === "sidebar" ? "overlay" : "sidebar";
    applyJarvisModeClass();
    updateModeToggleLabel();
    try {
      lpStorageGet("settings", function (data) {
        var s = (data && data.settings) || {};
        s.jarvisMode = jarvisMode;
        try { api.storage.local.set({ settings: s }); } catch (e2) {}
      });
    } catch (e) {}
  }
   // Tetapkan & kekal DEFAULT buka JARVIS (sidebar panel / overlay terapung).
   // Digunakan oleh butang "flip" supaya default sepadan dengan paparan yang
   // sedang dibuka (dan pintasan/F4 seterusnya buka mode yang sama).
   function setJarvisOpenMode(mode) {
     if (mode !== "sidebar" && mode !== "overlay") return;
     jarvisOpenMode = mode;
     updateModeToggleLabel();
     try {
       lpStorageGet("settings", function (data) {
         var s = (data && data.settings) || {};
         s.jarvisOpenMode = jarvisOpenMode;
         try { api.storage.local.set({ settings: s }); } catch (e2) {}
       });
     } catch (e) {}
   }
   // Togol & kekal DEFAULT buka JARVIS (sidebar panel / overlay terapung).
   // Dipanggil oleh butang "Tukar paparan JARVIS"; tidak membuka/switch terus.
   function toggleJarvisOpenMode() {
     setJarvisOpenMode(jarvisOpenMode === "sidebar" ? "overlay" : "sidebar");
   }
  function toggleSidebarAiForJarvis() {
    // In sidebar mode JARVIS delegates its AI to the working Local Pocket
    // AI Sidebar (Gemini signs in fine there), instead of the broken
    // embedded provider iframe. The captured image (if any) is forwarded.
    try {
      var promptText = buildPageContextText() || "";
      api.runtime.sendMessage({
        type: "open-ai-sidebar-with-prompt",
        prompt: promptText,
        image: pendingAttachImage || null,
        fromJarvis: true
      });
    } catch (e) {}
  }

  function formatTime(ts) {
    var d = new Date(ts);
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return h + ":" + (m < 10 ? "0" : "") + m + " " + ampm;
  }

  function buildPanel() {
   try {
    loadProvider();
    loadFontPrefs();
    loadJarvisPrefs();
    loadPromptTemplates();
     loadSelSearchEngines();
     loadJarvisSelSearchState();
    if (STYLE_URL) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = STYLE_URL;
      (document.head || document.documentElement).appendChild(link);
    }

    // In-panel AI provider selector ("Jarvis AI Brain"). Now functional: the
    // chosen value becomes JARVIS's brain (jarvisBrainProvider) and is applied
    // live via setProvider().
    var providerSelect = el("select", { id: "lp-jarvis-provider", title: "Pilih otak AI JARVIS" });
    PROVIDERS.forEach(function (pv) {
      providerSelect.appendChild(el("option", { value: pv.id, text: pv.label }));
    });
    providerSelect.value = PROVIDER;
    providerSelect.style.display = "";
    providerSelect.removeAttribute("aria-hidden");

    // Summary mode selector (copied from LP Sidebar AI).
    var summaryModeSelect = el("select", { id: "lp-jarvis-summary-mode", title: "Mod ringkasan" });
    (Core.SUMMARY_MODES || []).forEach(function (m) {
      summaryModeSelect.appendChild(el("option", { value: m.id, text: "R: " + m.label }));
    });
    summaryModeSelect.value = summaryMode;

    // Writing tone selector (copied from LP Sidebar AI).
    var toneSelect = el("select", { id: "lp-jarvis-tone", title: "Nada penulisan" });
    (Core.TONE_OPTIONS || []).forEach(function (t) {
      toneSelect.appendChild(el("option", { value: t.id, text: "T: " + t.label }));
    });
    toneSelect.value = tone;

    // Saved prompt templates button (copied from LP Sidebar AI).
    var templatesBtn = el("button", { id: "lp-jarvis-tpl-btn", title: "Templat prompt tersimpan", text: "Templat" });

    // Custom summary-mode prompt input (shown only when mode === "custom").
    var summaryCustomInput = el("input", {
      id: "lp-jarvis-custom-prompt", type: "text",
      placeholder: "Arahan ringkasan custom…", className: "lp-jarvis-custom-prompt"
    });
    summaryCustomInput.value = summaryCustomPrompt;
    // Butang simpan/urus templat prompt custom (buka modal Templat: Simpan/Edit/Padam).
    var customTplBtn = el("button", {
      id: "lp-jarvis-custom-tpl-btn", className: "lp-jarvis-custom-tpl-btn",
      title: "Simpan / urus templat prompt (Simpan, Edit, Padam)", text: "💾 Templat"
    });
    customTplBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      // Segerakkan teks semasa dulu supaya modal pra-isi dengan prompt terkini.
      summaryCustomPrompt = summaryCustomInput.value;
      setJarvisPref("summaryCustomPrompt", summaryCustomPrompt);
      openTemplatesModal();
    });
    var customRow = el("div", { id: "lp-jarvis-custom-row", className: "lp-jarvis-custom-row" }, [
      el("span", { className: "lp-jarvis-custom-label", text: "Custom:" }),
      summaryCustomInput,
      customTplBtn
    ]);
    if (summaryMode !== "custom") customRow.style.display = "none";

    var header = el("div", { id: "lp-jarvis-header" }, [
      el("div", { id: "lp-jarvis-title" }, [
        el("span", { id: "lp-jarvis-dot" }),
        el("span", { text: "JARVIS" })
      ]),
      el("div", { id: "lp-jarvis-header-controls" }, [
        providerSelect,
        el("button", { id: "lp-jarvis-pin", title: "Pin panel (kekal terbuka bila klik luar)", "aria-pressed": "false", text: "\u{1F4CC}" }),
        el("button", { id: "lp-jarvis-ai-toggle", title: "Lihat AI", text: "AI" }),
        el("button", { id: "lp-jarvis-mode-toggle", title: "Tukar paparan JARVIS", text: jarvisMode === "sidebar" ? "▭ Overlay" : "▥ Sidebar" }),
        el("button", { id: "lp-jarvis-sel-search-toggle", title: "Selection Search: ON (klik untuk matikan)", text: "🔍", "aria-pressed": "true" }),
        el("button", { id: "lp-jarvis-save-convo", title: "Simpan perbualan ke nota", text: "📒" }),
        el("button", { id: "lp-jarvis-automation", title: "Automation Studio (bina makro/otomasi)", text: "🤖" }),
        el("button", { id: "lp-jarvis-sessions", title: "Senarai sesi perbualan", text: "💬" }),
        el("button", { id: "lp-jarvis-clear", title: "Padam sejarah perbualan", text: "Padam" }),
        el("button", { id: "lp-jarvis-close", title: "Tutup (F4)", text: "×" })
      ])
    ]);

    transcriptEl = el("div", { id: "lp-jarvis-transcript" });
    // Open real URLs when links in JARVIS answers are wrapped in a search
    // engine redirect (Gemini does this). See handleJarvisLinkClick.
    transcriptEl.addEventListener("click", handleJarvisLinkClick);

    inputEl = el("textarea", {
      id: "lp-jarvis-input",
      placeholder: "Arahan atau soalan… (Enter untuk hantar)",
      rows: "1"
    });

    sendBtn = el("button", { id: "lp-jarvis-send", title: "Hantar (Enter)", text: "▶" });

    // Bottom-section toggle button: ▲ when hidden, ▼ when visible.
    var bottomToggleBtn = el("button", { id: "lp-jarvis-bottom-toggle", title: "Sembunyi/Tunjuk bahagian bawah", text: bottomSectionHidden ? "▲" : "▼" });

    // "Loading" feedback shown while JARVIS is mid-command (busy), so the user
    // can clearly see the system is processing (and that the ■ button cancels).
    busyIndicator = el("div", { id: "lp-jarvis-busy", className: "lp-jarvis-busy" }, [
      el("span", { className: "lp-jarvis-spinner" }),
      el("span", { className: "lp-jarvis-busy-text", text: "Memproses…" })
    ]);

    imgAttachBtn = el("button", { id: "lp-jarvis-img-attach", title: "Tanya pasal gambar (tangkap screenshot halaman)", text: "📷" });
    var fileUploadBtn = el("button", { id: "lp-jarvis-file-upload", title: "Muat naik gambar dari komputer", text: "📁" });
    // #3 — TTS: butang togol untuk JARVIS membacakan respons ringkas.
    ttsBtn = el("button", { id: "lp-jarvis-tts", title: "Bacakan jawapan JARVIS (TTS): OFF", text: "🔈", type: "button", "aria-pressed": "false" });
    ttsBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleTts(); });
    applyTtsButton();
    fileInputEl = el("input", { id: "lp-jarvis-file-input", type: "file", accept: "image/*", style: "display:none" });
    // Gemini-style image chips inside the input box (shown only when an image is attached)
    var imgChips = el("div", { id: "lp-jarvis-img-chips", className: "lp-jarvis-img-chips" });
    // Gemini-style composer: a single bordered container holding the chips on top
    // and the action row (attach / upload / TTS / textarea / send) at the bottom.
    var inputBottom = el("div", { className: "lp-jarvis-input-bottom" }, [imgAttachBtn, fileUploadBtn, ttsBtn, inputEl, bottomToggleBtn, sendBtn]);
    // Preview beratur text susulan (ditunjukkan bila JARVIS sedang menjawab
    // dan pengguna taip text yang akan dihantar bila giliran selesai).
    var followUpPreview = el("div", { id: "lp-jarvis-followup", className: "lp-jarvis-followup" });
    var inputBox = el("div", { id: "lp-jarvis-input-box", className: "lp-jarvis-input-box" }, [imgChips, followUpPreview, inputBottom]);
    var inputRow = el("div", { id: "lp-jarvis-input-row" }, [inputBox, busyIndicator, fileInputEl]);
    // Keep imgThumb reference but repurpose it as alias for imgChips
    imgThumb = imgChips;
    // Contextual command suggestions: a live dropdown of learned commands +
    // built-in examples, filtered as the user types (discovery / autocomplete).
    var suggestionList = el("div", { id: "lp-jarvis-suggest", className: "lp-jarvis-suggest" });
    var memoryRow = el("div", { className: "lp-jarvis-memory-row" }, [
      el("button", { id: "lp-jarvis-export", title: "Eksport ingatan JARVIS (backup JSON)", text: "⬇ Eksport" }),
      el("button", { id: "lp-jarvis-import", title: "Import ingatan JARVIS dari fail", text: "⬆ Import" })
    ]);
    // Font size / font family controls (ubah saiz tulisan / jenis font).
    var fontDecreaseBtn = el("button", { id: "lp-jarvis-font-dec", title: "Kecilkan saiz tulisan", text: "A−" });
    var fontSizeLabel = el("span", { id: "lp-jarvis-font-size-label", className: "lp-jarvis-font-size-label", text: fontPrefs.size + "px" });
    var fontIncreaseBtn = el("button", { id: "lp-jarvis-font-inc", title: "Besarkan saiz tulisan", text: "A+" });
    var fontFamilySelect = el("select", { id: "lp-jarvis-font-family", title: "Jenis font" });
    FONT_FAMILIES.forEach(function (f) {
      fontFamilySelect.appendChild(el("option", { value: f.id, text: f.label }));
    });
    fontFamilySelect.value = fontPrefs.family;
    var fontRow = el("div", { className: "lp-jarvis-font-row" }, [
      el("span", { className: "lp-jarvis-font-label", text: "Font:" }),
      fontDecreaseBtn,
      fontSizeLabel,
      fontIncreaseBtn,
      fontFamilySelect
    ]);
    // Output preferences row (summary mode + tone), copied from LP Sidebar AI.
    var prefsRow = el("div", { id: "lp-jarvis-prefs-row", className: "lp-jarvis-prefs-row" }, [
      summaryModeSelect,
      toneSelect,
      templatesBtn
    ]);
    var hint = el("div", { id: "lp-jarvis-hint", text: "Cuba: \"simpan halaman ini\", \"buka laman github.com\", \"klik butang Langgan\", \"cari ai\", atau tanya apa-apa." });
    // Quick-command chips (feature #3): one-tap common actions so users discover
    // JARVIS without typing. Each chip runs the same pipeline as typing the cmd.
    var QUICK_CHIPS = [
      { label: "💡 Ringkas", cmd: "ringkaskan halaman ini" },
      { label: "💾 Simpan", cmd: "simpan halaman ini" },
      { label: "❓ Tanya hal ini", cmd: "Terangkan perkara utama dalam halaman ini" },
      { label: "📚 Tanya Simpanan", prefill: "Tanya simpanan saya: " },
      { label: "⚙ Tetapan", cmd: "buka tetapan" },
      { label: "🖼 Galeri", cmd: "//gambar" }
    ];
    var quickChips = el("div", { id: "lp-jarvis-quick-chips", className: "lp-jarvis-quick-chips" });
    QUICK_CHIPS.forEach(function (c) {
      var b = el("button", { className: "lp-jarvis-chip", type: "button", text: c.label, title: c.cmd || c.prefill });
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        if (c.prefill && inputEl) {
          // Masukkan teks permulaan ke kotak input supaya pengguna lengkapkan
          // soalan (tidak terus hantar).
          inputEl.value = c.prefill;
          inputEl.focus();
          if (inputEl.style && inputEl.style.height) inputEl.style.height = "auto";
          return;
        }
        processMessage(c.cmd);
      });
      quickChips.appendChild(b);
    });
    var resizeHandle = el("div", { id: "lp-jarvis-resize" });
    // #3 — TTS Puter: medan API key (percuma). Dengan key, TTS neural berfungsi
    // TANPA popup auth yang tak boleh siap dalam konteks extension.
    puterKeyInput = el("input", {
      id: "lp-jarvis-puter-key", type: "password",
      placeholder: "Puter API key (percuma)", className: "lp-jarvis-puter-key",
      style: "flex:1;min-width:0;box-sizing:border-box;"
    });
    puterKeyInput.value = puterApiKey || "";
    puterKeyStatus = el("span", {
      id: "lp-jarvis-puter-key-status", className: "lp-jarvis-puter-key-status",
      style: "font-size:11px;white-space:nowrap;min-width:64px;text-align:right;"
    });
    // Togol antara medan input key dan chip ringkas.
    function showPuterKeyEditing(show) {
      if (show) {
        if (puterKeyRow) puterKeyRow.style.display = "flex";
        if (puterKeyChip) puterKeyChip.style.display = "none";
        try { puterKeyInput.focus(); puterKeyInput.select(); } catch (e) {}
      } else {
        if (puterKeyRow) puterKeyRow.style.display = "none";
        if (puterKeyChip) puterKeyChip.style.display = "";
      }
    }
    // Simpan + apply key. Dipanggil bila blur (change) ATAU tekan Enter.
    function commitPuterKey() {
      puterApiKey = (puterKeyInput.value || "").trim();
      try {
        lpStorageGet("settings", function (data) {
          var s = (data && data.settings) || {};
          s.puterApiKey = puterApiKey;
          try { api.storage.local.set({ settings: s }); } catch (e2) {}
        });
      } catch (e) {}
      if (!puterApiKey) { puterKeyStatus.textContent = ""; showPuterKeyEditing(true); return; }
      // Muat SDK (jika perlu) supaya key terus diaplikasikan & boleh disahkan.
      loadPuterSdk().then(function () {
        applyPuterApiKey();
        var check = (window.puter && window.puter.auth && typeof window.puter.auth.isSignedIn === "function")
          ? window.puter.auth.isSignedIn() : Promise.resolve(false);
        Promise.resolve(check).then(function (signed) {
          puterKeyStatus.textContent = signed ? "✓ sedia" : "✓ disimpan";
          puterKeyStatus.style.color = "#10b981";
          puterKeyChip.textContent = signed ? "🔑 Puter ✓" : "🔑 Puter (key)";
        }).catch(function () {
          puterKeyStatus.textContent = "✓ disimpan";
          puterKeyStatus.style.color = "#10b981";
        });
        // Lepas simpan, sembunyikan TERUS medan & chip (jangan papar panel
        // berkaitan bila key sudah ada).
        syncPuterKeyUi();
      });
    }
    puterKeyInput.addEventListener("change", commitPuterKey);
    puterKeyInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commitPuterKey(); }
    });
    var puterKeyRow = el("div", { id: "lp-jarvis-puter-key-row", className: "lp-jarvis-puter-key-row", style: "display:flex;gap:6px;align-items:center;margin-top:4px;" }, [
      el("span", { className: "lp-jarvis-puter-key-label", text: "Puter key:", style: "font-size:11px;white-space:nowrap;" }),
      puterKeyInput,
      puterKeyStatus
    ]);
    // Chip ganti medan bila key dah diset — klik untuk edit semula.
    puterKeyChip = el("div", {
      id: "lp-jarvis-puter-chip", className: "lp-jarvis-puter-chip",
      title: "Puter TTS sedia — klik untuk tukar key", text: "🔑 Puter ✓",
      style: "font-size:11px;cursor:pointer;color:#10b981;margin-top:4px;"
    });
    puterKeyChip.addEventListener("click", function () { showPuterKeyEditing(true); });
    // Papar/sembunyi medan key ikut nilai tersimpan (chip disembunyikan
    // sepenuhnya bila key sudah ada, mengikut permintaan).
    syncPuterKeyUi();
    // Medan API key Google AI Studio (percuma) — untuk TTS Google terus.
    googleKeyInput = el("input", { id: "lp-jarvis-google-key", type: "password", placeholder: "Google AI Studio key", style: "flex:1;min-width:0;" });
    var googleKeyStatus = el("span", { id: "lp-jarvis-google-key-status", text: "", style: "font-size:11px;color:#10b981;white-space:nowrap;" });
    function commitGoogleKey() {
      googleApiKey = (googleKeyInput.value || "").trim();
      setJarvisPref("googleApiKey", googleApiKey);
      googleKeyStatus.textContent = googleApiKey ? "✓ disimpan" : "";
      setTimeout(function () { if (googleKeyStatus) googleKeyStatus.textContent = ""; }, 2000);
    }
    googleKeyInput.addEventListener("change", commitGoogleKey);
    googleKeyInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); commitGoogleKey(); } });
    googleKeyRow = el("div", { id: "lp-jarvis-google-key-row", className: "lp-jarvis-google-key-row", style: "display:flex;gap:6px;align-items:center;margin-top:4px;" }, [
      el("span", { className: "lp-jarvis-puter-key-label", text: "Google key:", style: "font-size:11px;white-space:nowrap;" }),
      googleKeyInput,
      googleKeyStatus
    ]);
    if (googleKeyInput) googleKeyInput.value = googleApiKey || "";
    // Pilihan suara Puter/Gemini TTS — DUA slot (Melayu & English) supaya TTS
    // boleh menyesuaikan suara mengikut bahasa teks yang dibaca. Senarai suara
    // bergantung pada provider (Puter = ms/en sahaja; Gemini = suara Gemini).
    function buildVoiceSelect(id, selected) {
      var sel = el("select", { id: id, className: "lp-jarvis-puter-voice", style: "flex:1;min-width:0;" });
      currentVoiceList().forEach(function (v) {
        sel.appendChild(el("option", { value: v.id, text: v.label }));
      });
      sel.value = selected || "";
      return sel;
    }
    var ttsProviderSelect = el("select", { id: "lp-jarvis-tts-provider", className: "lp-jarvis-puter-voice", style: "flex:1;min-width:0;" }, [
      el("option", { value: "google", text: "Google (Gemini API)" })
    ]);
    ttsProviderSelect.value = ttsProvider || "google";
    ttsProviderSelect.addEventListener("change", function () {
      ttsProvider = ttsProviderSelect.value || "google";
      setJarvisPref("jarvisTtsProvider", ttsProvider);
      refreshVoiceOptions();
      try { syncProviderKeyUi(); } catch (e2) {}
      try { if (ttsProvider !== "google") loadPuterSdk(); } catch (e3) {}
    });
    jarvisVoiceMsSelect = buildVoiceSelect("lp-jarvis-puter-voice-ms", jarvisVoiceMs);
    jarvisVoiceMsSelect.addEventListener("change", function () {
      jarvisVoiceMs = jarvisVoiceMsSelect.value || "";
      setJarvisPref("jarvisVoiceMs", jarvisVoiceMs);
      try { loadPuterSdk(); } catch (e2) {}
    });
    jarvisVoiceEnSelect = buildVoiceSelect("lp-jarvis-puter-voice-en", jarvisVoiceEn);
    jarvisVoiceEnSelect.addEventListener("change", function () {
      jarvisVoiceEn = jarvisVoiceEnSelect.value || "";
      setJarvisPref("jarvisVoiceEn", jarvisVoiceEn);
      try { loadPuterSdk(); } catch (e2) {}
    });
    // Gaya seragam untuk pengepala accordion bahagian bawah.
    var ACC_HEADER_STYLE = "align-self:flex-start;font-size:11px;padding:1px 6px;border-radius:6px;border:1px solid rgba(120,170,255,0.25);background:rgba(8,10,18,0.7);color:#cdd6e6;cursor:pointer;";
    // Panel pilih suara (badan accordion "Suara TTS") — PEMILIH provider TTS
    // dipindah ke bahagian "Kunci API" supaya hubungan provider↔kunci jelas.
    var voiceInner = el("div", { id: "lp-jarvis-voice-inner", style: "display:flex;flex-direction:column;gap:4px;" }, [
      el("div", { style: "display:flex;gap:6px;align-items:center;" }, [
        el("span", { className: "lp-jarvis-puter-voice-label", text: "Suara Melayu:", style: "font-size:11px;white-space:nowrap;" }),
        jarvisVoiceMsSelect
      ]),
      el("div", { style: "display:flex;gap:6px;align-items:center;" }, [
        el("span", { className: "lp-jarvis-puter-voice-label", text: "Suara English:", style: "font-size:11px;white-space:nowrap;" }),
        jarvisVoiceEnSelect
      ])
    ]);
    // ---- Bahagian bawah sebagai accordion: "TTS" (provider + kunci + suara
    // sekali gus) dan "Paparan" ----
    // Provider TTS menentukan medan kunci DAN senarai suara yang dipapar, jadi
    // ketiga-tiganya diletakkan dalam satu accordion yang sama supaya hubungan
    // provider↔kunci↔suara jelas (pilih Gemini → kunci Gemini + suara Gemini).
    var ttsAccBody = el("div", { id: "lp-jarvis-acc-tts-body", className: "lp-jarvis-acc-body", style: "display:flex;flex-direction:column;gap:4px;" }, [
      el("div", { style: "display:flex;gap:6px;align-items:center;" }, [
        el("span", { className: "lp-jarvis-puter-voice-label", text: "Provider TTS:", style: "font-size:11px;white-space:nowrap;" }),
        ttsProviderSelect
      ]),
      googleKeyRow,
      el("div", { className: "lp-jarvis-acc-hint", text: "Kunci percuma: Gemini (aistudio.google.com/apikey).", style: "font-size:10px;opacity:0.7;" }),
      voiceInner
    ]);
    var ttsAccHeader = el("button", { id: "lp-jarvis-acc-tts", type: "button", className: "lp-jarvis-acc-header", style: ACC_HEADER_STYLE }, []);
    function setTtsAccOpen(open) {
      ttsAccBody.style.display = open ? "flex" : "none";
      ttsAccHeader.textContent = (open ? "▼ " : "▶ ") + "TTS & Suara";
    }
    setTtsAccOpen(!jarvisAccApiHidden);
    ttsAccHeader.addEventListener("click", function () {
      var open = ttsAccBody.style.display !== "none";
      setTtsAccOpen(!open);
      jarvisAccApiHidden = !open;
      setJarvisPref("jarvisAccApiHidden", jarvisAccApiHidden);
    });
    var ttsAcc = el("div", { className: "lp-jarvis-acc", style: "display:flex;flex-direction:column;gap:2px;margin-top:4px;" }, [ttsAccHeader, ttsAccBody]);

    // 2) Paparan — saiz fon & memori. Tertutup secara default.
    var displayAccBody = el("div", { id: "lp-jarvis-acc-disp-body", className: "lp-jarvis-acc-body", style: "display:flex;flex-direction:column;gap:4px;" }, [fontRow, memoryRow]);
    var displayAccHeader = el("button", { id: "lp-jarvis-acc-disp", type: "button", className: "lp-jarvis-acc-header", style: ACC_HEADER_STYLE }, []);
    function setDisplayAccOpen(open) {
      displayAccBody.style.display = open ? "flex" : "none";
      displayAccHeader.textContent = (open ? "▼ " : "▶ ") + "Paparan";
    }
    setDisplayAccOpen(!jarvisAccDisplayHidden);
    displayAccHeader.addEventListener("click", function () {
      var open = displayAccBody.style.display !== "none";
      setDisplayAccOpen(!open);
      jarvisAccDisplayHidden = !open;
      setJarvisPref("jarvisAccDisplayHidden", jarvisAccDisplayHidden);
    });
    var displayAcc = el("div", { className: "lp-jarvis-acc", style: "display:flex;flex-direction:column;gap:2px;margin-top:4px;" }, [displayAccHeader, displayAccBody]);

    var bottomSection = el("div", { id: "lp-jarvis-bottom-section", className: "lp-jarvis-bottom-section" }, [hint, ttsAcc, displayAcc]);
    try { syncProviderKeyUi(); } catch (e) {}
    root = el("div", { id: "lp-jarvis-root" }, [header, prefsRow, customRow, transcriptEl, quickChips, inputRow, suggestionList, bottomSection, resizeHandle]);
    // stays clickable while the embedded AI surface covers the rest of the panel.
    var providerBackBtn = el("button", { id: "lp-jarvis-provider-back", title: "Tutup AI / kembali ke JARVIS", text: "← JARVIS" });
    root.appendChild(providerBackBtn);
    // Session-list modal (feature #2): reuse the template-modal styling.
    sessionsModal = el("div", { id: "lp-jarvis-sessions-modal", className: "lp-jarvis-tpl-modal" }, [
      el("div", { className: "lp-jarvis-tpl-head" }, [
        el("span", { text: "Sesi Perbualan" }),
        el("button", { id: "lp-jarvis-sessions-close", className: "lp-jarvis-tpl-close", text: "×" })
      ]),
      el("div", { id: "lp-jarvis-sessions-list", className: "lp-jarvis-tpl-list" }),
      el("div", { className: "lp-jarvis-tpl-foot" }, [
        el("button", { id: "lp-jarvis-sessions-clear", className: "lp-jarvis-tpl-clear-btn", text: "Padam semua" })
      ])
    ]);
    root.appendChild(sessionsModal);
    (document.body || document.documentElement).appendChild(root);

    // Apply persisted bottom-section state.
    if (bottomSectionHidden) {
      bottomSection.classList.add("lp-jarvis-bottom-hidden");
    }

    initResize(resizeHandle);
    initSelectionButtons();

    header.querySelector("#lp-jarvis-close").addEventListener("click", function () {
      toggle();
    });
    header.querySelector("#lp-jarvis-pin").addEventListener("click", function () {
      togglePin();
    });
    header.querySelector("#lp-jarvis-ai-toggle").addEventListener("click", function () {
      // "AI": tunjuk/sembunyi surface AI (Gemini/ChatGPT dll) TERBENAM di dalam
      // panel JARVIS. Bertukar jadi "← JARVIS" untuk kembali ke chat JARVIS.
      // (Tidak lagi membuka Local Pocket AI sidebar berasingan.)
      try { toggleProviderView(); } catch (e) {}
    });
    var modeToggleBtn = root.querySelector("#lp-jarvis-mode-toggle");
    if (modeToggleBtn) modeToggleBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      // FLIP: kita sedang dalam SIDEBAR → sekalikan default buka JARVIS = overlay
      // dan minta background BUKA TERUS overlay JARVIS pada tab aktif & reset panel
      // sidebar ke AI. (Arah sebaliknya dikendalikan dalam jarvisOverlay.js.)
      try {
        setJarvisOpenMode("overlay");
        // Minta background buka overlay + reset panel sidebar ke AI (sidebarMode).
        try { api.runtime.sendMessage({ type: "open-jarvis-overlay" }); } catch (e3) {}
        // TUTUP sidebar INI terus dari halaman sidebar — DALAM konteks gesture klik
        // sebenar. Background TAK boleh panggil sidebarAction.close() (Firefox
        // menolak "may only be called from a user input handler" bila gesture
        // hilang merentas mesej), jadi lakukan di sini supaya panel benar-benar
        // tertutup, bukan sekadar bertukar ke panel AI.
        try { if (api.sidebarAction && typeof api.sidebarAction.close === "function") api.sidebarAction.close(); } catch (e4) {}
      } catch (e0) {}
    });
    var selSearchToggleBtn = root.querySelector("#lp-jarvis-sel-search-toggle");
    if (selSearchToggleBtn) selSearchToggleBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      try { handleJarvisSelSearchToggle(); } catch (e0) {}
    });
    updateModeToggleLabel();
    providerBackBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleProviderView();
    });
    header.querySelector("#lp-jarvis-clear").addEventListener("click", function () {
      clearHistory();
    });
    // D2: Carian dalam transkrip — sambung butang toggle, input & tutup.
    var saveConvoBtn = root.querySelector("#lp-jarvis-save-convo");
    if (saveConvoBtn) saveConvoBtn.addEventListener("click", function () { doSaveConversationToNote(); });
    var sessionsBtn = root.querySelector("#lp-jarvis-sessions");
    if (sessionsBtn) sessionsBtn.addEventListener("click", function () { openSessionsModal(); });
    var sessionsClose = root.querySelector("#lp-jarvis-sessions-close");
    if (sessionsClose) sessionsClose.addEventListener("click", function () { closeSessionsModal(); });
    var automationBtn = root.querySelector("#lp-jarvis-automation");
    if (automationBtn) automationBtn.addEventListener("click", function (e) { e.stopPropagation(); openAutomation(); });
    var sessionsClearAll = root.querySelector("#lp-jarvis-sessions-clear");
    if (sessionsClearAll) sessionsClearAll.addEventListener("click", function () { deleteAllSessions(); });
    if (imgAttachBtn) imgAttachBtn.addEventListener("click", function (e) { e.stopPropagation(); openCapturePopup(); });
    var fileUploadBtnEl = root.querySelector("#lp-jarvis-file-upload");
    if (fileUploadBtnEl) fileUploadBtnEl.addEventListener("click", function (e) { e.stopPropagation(); openFilePicker(); });
    if (fileInputEl) fileInputEl.addEventListener("change", handleFileSelected);
    showPendingImageThumb();
    // Pick up a screenshot captured while the sidebar was closed (the capture
    // flow hides the native sidebar so it stays out of the image, then stores
    // the result here for the reloaded panel to apply).
    try {
      api.storage.local.get("pendingJarvisCapture", function (res) {
        try {
          var pc = res && res.pendingJarvisCapture;
          if (pc && pc.dataUrl && (Date.now() - (pc.ts || 0)) < 60000) {
            pendingImage = pc.dataUrl;
            pendingUserImage = pc.dataUrl;
            showPendingImageThumb();
            try { api.storage.local.remove("pendingJarvisCapture"); } catch (e2) {}
          }
        } catch (e) {}
      });
    } catch (e) {}
    // Hover Image Search: pick up pending image + "cari" command triggered by
    // the hover-image-search shortcut (Alt+Q by default). Auto-submit "/cari"
    // with the captured image attached.
    try {
      api.storage.local.get("__lpHoverImageSearchPending", function (res) {
        try {
          var his = res && res.__lpHoverImageSearchPending;
          if (!his || !his.image) return;
          try { api.storage.local.remove("__lpHoverImageSearchPending"); } catch (e2) {}
          // If image already set by jarvis-restore-capture, skip to avoid double-submit
          if (_autoSearchTriggered) return;
          if (Date.now() - (his.ts || 0) > 15000) return;
          setTimeout(function () {
            pendingImage = his.image;
            pendingUserImage = his.image;
            showPendingImageThumb();
            try { saveScreenshotToGallery(his.image); } catch (e) {}
            if (inputEl) {
              inputEl.value = "/cari";
              if (typeof submit === "function") submit();
              else {
                var _s = document.getElementById("lp-jarvis-send");
                if (_s) _s.click();
              }
            }
          }, 500);
        } catch (e) {}
      });
    } catch (e) {}
    var exportBtn = root.querySelector("#lp-jarvis-export");
    if (exportBtn) exportBtn.addEventListener("click", function () { exportMemory(); });
    var importBtn = root.querySelector("#lp-jarvis-import");
    if (importBtn) importBtn.addEventListener("click", function () { importMemoryViaPicker(); });
    var fontDecBtn = root.querySelector("#lp-jarvis-font-dec");
    if (fontDecBtn) fontDecBtn.addEventListener("click", function () { changeFontSize(-1); });
    var fontIncBtn = root.querySelector("#lp-jarvis-font-inc");
    if (fontIncBtn) fontIncBtn.addEventListener("click", function () { changeFontSize(1); });
    var famSelect = root.querySelector("#lp-jarvis-font-family");
    if (famSelect) famSelect.addEventListener("change", function () { setFontFamily(famSelect.value); });
    providerSelect.addEventListener("change", function () {
      setProvider(providerSelect.value);
    });
    summaryModeSelect.addEventListener("change", function () {
      summaryMode = summaryModeSelect.value;
      setJarvisPref("summaryMode", summaryMode);
      // #6 — kekalkan ingatan selari dengan pilihan panel.
      try { if (window.LocalPocketMemoryLayers) window.LocalPocketMemoryLayers.setPreference("defaultSummaryMode", summaryMode); } catch (e) {}
      // #6 — belajar tabiat masa: pengguna tukar mod ringkasan via UI.
      recordJarvisTimeHabit("summaryMode", summaryMode);
      if (summaryMode === "custom") { customRow.style.display = "flex"; try { summaryCustomInput.focus(); } catch (e) {} }
      else customRow.style.display = "none";
    });
    summaryCustomInput.addEventListener("input", function () {
      summaryCustomPrompt = summaryCustomInput.value;
      setJarvisPref("summaryCustomPrompt", summaryCustomPrompt);
    });
    toneSelect.addEventListener("change", function () {
      tone = toneSelect.value;
      setJarvisPref("tone", tone);
      // #6 — kekalkan ingatan selari dengan pilihan panel.
      try { if (window.LocalPocketMemoryLayers) window.LocalPocketMemoryLayers.setPreference("defaultTone", tone); } catch (e) {}
      // #6 — belajar tabiat masa: pengguna tukar nada via UI.
      recordJarvisTimeHabit("tone", tone);
    });
    templatesBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openTemplatesModal();
    });
    // Quick "Ringkas" (summarize) button — mirrors the LP Sidebar AI "S" button.
    var summarizeBtn = el("button", { id: "lp-jarvis-summarize-btn", title: "Ringkaskan halaman ini (ikut mod & tone)", text: "Ringkas" });
    prefsRow.appendChild(summarizeBtn);
    summarizeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      doSummarize();
    });
    // Sync the in-panel dropdown with the configured brain provider (which may
    // have been changed in Options or via another JARVIS instance).
    try {
      providerSelect.value = PROVIDER;
    } catch (e) {}
    bottomToggleBtn.addEventListener("click", function () {
      bottomSectionHidden = !bottomSectionHidden;
      bottomToggleBtn.textContent = bottomSectionHidden ? "▲" : "▼";
      bottomToggleBtn.title = bottomSectionHidden ? "Tunjuk bahagian bawah" : "Sembunyi bahagian bawah";
      if (bottomSectionHidden) {
        bottomSection.classList.add("lp-jarvis-bottom-hidden");
      } else {
        bottomSection.classList.remove("lp-jarvis-bottom-hidden");
      }
      setJarvisPref("jarvisBottomHidden", bottomSectionHidden);
    });
    sendBtn.addEventListener("click", function () {
      if (jarvisBusy) cancelJarvis();
      else submit();
    });
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        // If a suggestion is actively highlighted, Enter fills the input
        // (like Tab) instead of sending. Otherwise Enter sends the message.
        if (suggestionItems.length && suggestionIndex >= 0) {
        e.preventDefault();
        applySuggestion(suggestionItems[suggestionIndex]);
        return;
      }
      e.preventDefault();
      // JARVIS sedang menjawab: jangan batal. Susun text sebagai susulan
      // beratur yang dihantar bila giliran semasa selesai.
      if (jarvisBusy) {
        queueFollowUp();
        return;
      }
      submit();
    }
    });
    inputEl.addEventListener("input", function () {
      inputEl.style.height = "38px";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 110) + "px";
      inputHistoryIndex = inputHistory.length;
      updateSuggestions();
      // User is composing a NEW question — don't auto-re-send an old one with
      // a later screenshot.
      if ((inputEl.value || "").trim()) {
        expectingImageAfterQuestion = false;
        expectingImageAfterQuestionTs = 0;
        cancelImageAutoSend();
      }
    });
    // Drag & drop (feature #6e): drop an image into the chat input. Supports
    // BOTH an OS file AND an image dragged from a web page. A web-page image
    // is delivered as a URL (text/uri-list or an <img> in text/html), NOT a
    // file — the previous handler only read files, so those drags were ignored
    // and the picture never attached. The captured picture is then sent with the
    // next question, or (if a text question was just asked) re-sent with it.
    function setPendingImageFromDataUrl(dataUrl) {
      if (!dataUrl) return false;
      pendingImage = dataUrl;
      pendingUserImage = dataUrl;
      showPendingImageThumb();
      return true;
    }
    function fetchImageUrlAsDataUrl(url, cb) {
      if (!url) return cb(null);
      try {
        api.runtime.sendMessage({ type: "jarvis-fetch-image", url: url }, function (res) {
          cb(res && res.ok && res.dataUrl ? res.dataUrl : null);
        });
      } catch (e) { cb(null); }
    }
    function resolveImageFromDrop(dt, cb) {
      if (!dt) return cb(null);
      // 1) File: an OS file, or a web-page image Chrome serialises as a file.
      // Firefox may report a dragged web image with an empty/non-standard type.
      if (dt.files && dt.files.length) {
        var f = dt.files[0];
        var ft = (f && f.type || "").toLowerCase();
        if (f && (ft.indexOf("image/") === 0 || ft === "" || ft.indexOf("moz-file") >= 0)) {
          var reader = new FileReader();
          reader.onload = function (ev) { cb(ev.target.result); };
          reader.onerror = function () { cb(null); };
          reader.readAsDataURL(f);
          return;
        }
      }
      // 2) Image dragged from a web page → delivered as a URL, not a file.
      var url = "";
      // Prefer <img src> from text/html (Google Images etc. wrap the picture
      // in an overlay — text/uri-list gives the intermediary page, not the image).
      try {
        var html = dt.getData("text/html") || "";
        var m = /<img[^>]+src=["']([^"']+)["']/i.exec(html) || /src=["']([^"']+)["']/i.exec(html);
        if (m) url = m[1];
      } catch (e2) {}
      if (!url) { try { url = dt.getData("text/uri-list") || ""; } catch (e1) {} }
      if (!url) { try { url = dt.getData("text/plain") || ""; } catch (e1b) {} }
      url = (url || "").trim().split(/\s+/)[0];
      // If the URL is a Google Images intermediary page, extract the actual image URL.
      if (url && url.indexOf("google.com/imgres") >= 0) {
        try { var _p = new URL(url); var _iu = _p.searchParams.get("imgurl"); if (_iu && _iu.indexOf("http") === 0) url = decodeURIComponent(_iu); } catch (e3) {}
      }
      // Resolve relative src (from text/html <img>) against the page base URL.
      try { if (url && !/^[a-z][a-z0-9+.\-]*:/i.test(url)) { var _a2 = document.createElement("a"); _a2.href = url; if (_a2.href && /^https?:/i.test(_a2.href)) url = _a2.href; } } catch (e2b) {}
      if (!url || url.indexOf("http") !== 0) return cb(null);
      fetchImageUrlAsDataUrl(url, function (dataUrl) {
        if (dataUrl) cb(dataUrl);
        else captureDroppedWebImage(url);
      });
    }
    function attachImageFile(file) {
      if (!file || !file.type || file.type.indexOf("image/") !== 0) {
        addBubble("jarvis", "Sila lepas fail gambar (JPEG, PNG, GIF, WebP).");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        addBubble("jarvis", "Gambar terlalu besar. Maksimum 10 MB.");
        return;
      }
      var reader = new FileReader();
      reader.onload = function (ev) { setPendingImageFromDataUrl(ev.target.result); };
      reader.onerror = function () { addBubble("jarvis", "Gagal baca fail gambar."); };
      reader.readAsDataURL(file);
    }
    var _imgDropTarget = inputBox || inputEl;
    if (_imgDropTarget) {
      _imgDropTarget.addEventListener("dragover", function (e) {
        var dt = e.dataTransfer;
        if (!dt) return;
        // Allow the drop whenever it could be an image/file/url drag, so the
        // browser doesn't navigate to the image URL instead of dropping it.
        var ok = false;
        var items = dt.items || [];
        for (var i = 0; i < items.length; i++) {
          var t = (items[i].type || "").toLowerCase();
          if (items[i].kind === "file" || t.indexOf("image/") === 0 || t.indexOf("text/uri-list") === 0 || t.indexOf("text/html") === 0) { ok = true; break; }
        }
        if (!ok && dt.types) {
          for (var j = 0; j < dt.types.length; j++) {
            var tt = String(dt.types[j]).toLowerCase();
            if (tt.indexOf("files") === 0 || tt.indexOf("image/") === 0 || tt.indexOf("text/uri-list") === 0 || tt.indexOf("text/html") === 0) { ok = true; break; }
          }
        }
        if (ok) {
          e.preventDefault();
          e.stopPropagation();
          _imgDropTarget.classList.add("lp-jarvis-drag-over");
        }
      });
      _imgDropTarget.addEventListener("dragleave", function () {
        _imgDropTarget.classList.remove("lp-jarvis-drag-over");
      });
      _imgDropTarget.addEventListener("drop", function (e) {
        _imgDropTarget.classList.remove("lp-jarvis-drag-over");
        var dt = e.dataTransfer;
        if (!dt) return;
        e.preventDefault();
        // NOTE: do NOT stopPropagation here. The root-level initDragDrop
        // handler is the canonical, robust one (it converts web-page
        // image URLs to data URLs via the background). Letting the event
        // bubble guarantees the picture is captured.
        resolveImageFromDrop(dt, function (dataUrl) {
          if (dataUrl) {
            setPendingImageFromDataUrl(dataUrl);
            cancelImageAutoSend();
            setTimeout(function () { processMessage("/cari"); }, 100);
          } else {
            addBubble("jarvis", "Tak dapat ambil gambar itu. Cuba muat naik fail (📁) atau tangkap skrin.");
          }
        });
      });
    }
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "ArrowUp" && !suggestionItems.length && inputHistory.length && document.activeElement === inputEl) {
        if (inputHistoryIndex > 0) {
          inputHistoryIndex--;
          inputEl.value = inputHistory[inputHistoryIndex];
          e.preventDefault();
        }
        return;
      }
      if (e.key === "ArrowDown" && !suggestionItems.length && document.activeElement === inputEl) {
        if (inputHistoryIndex < inputHistory.length - 1) {
          inputHistoryIndex++;
          inputEl.value = inputHistory[inputHistoryIndex];
        } else {
          inputHistoryIndex = inputHistory.length;
          inputEl.value = "";
        }
        e.preventDefault();
        return;
      }
      // Arrow/Enter navigation through the suggestion dropdown.
      if (e.key === "ArrowDown" && suggestionIndex < suggestionItems.length - 1) {
        suggestionIndex++; highlightSuggestion(); e.preventDefault();
      } else if (e.key === "ArrowUp" && suggestionIndex > 0) {
        suggestionIndex--; highlightSuggestion(); e.preventDefault();
      } else if (e.key === "Tab" && suggestionItems.length) {
        applySuggestion(suggestionItems[suggestionIndex]); e.preventDefault();
      } else if (e.key === "Escape") {
        hideSuggestions();
      }
    });
    inputEl.addEventListener("blur", function () {
      setTimeout(hideSuggestions, 200);
    });

    // ----- Contextual command autocomplete (discovery / type-ahead) -----
    var suggestionItems = [];
    var suggestionIndex = -1;
    var SUGGEST_DEFAULTS = [
      "simpan halaman ini", "ringkaskan", "buka github.com", "cari ai",
      "cari youtube tutorial", "buka 5 tab youtube ai", "tab baharu",
      "tutup tab", "muat semula", "ke belakang", "tatal ke bawah",
      "klik butang Langgan", "isi email dengan test@test.com", "buka library",
      "buka notes", "//gambar", "buka settings", "salin jawapan", "cetak halaman"
    ];
    function hideSuggestions() {
      suggestionItems = [];
      suggestionIndex = -1;
      if (suggestionList) { suggestionList.innerHTML = ""; suggestionList.classList.remove("lp-jarvis-suggest-show"); }
    }
    // Float the suggestion dropdown so its bottom edge sits at the top of the
    // input row, overlaying the transcript instead of pushing/covering the
    // bottom control rows (memory/font/hint). Recomputed each render because the
    // panel can be dragged/resized.
    function positionSuggestionDropdown() {
      if (!suggestionList || !root || !inputRow) return;
      var bottom = root.offsetHeight - inputRow.offsetTop;
      if (bottom < 0 || isNaN(bottom)) bottom = 0;
      suggestionList.style.bottom = bottom + "px";
    }
    function renderSuggestions() {
      if (!suggestionList) return;
      positionSuggestionDropdown();
      suggestionList.innerHTML = "";
      suggestionItems.forEach(function (cmd, i) {
        var item = el("div", { className: "lp-jarvis-suggest-item" + (i === suggestionIndex ? " lp-jarvis-suggest-active" : ""), text: cmd });
        item.addEventListener("mousedown", function (e) {
          e.preventDefault();
          applySuggestion(cmd);
        });
        suggestionList.appendChild(item);
      });
      suggestionList.classList.toggle("lp-jarvis-suggest-show", suggestionItems.length > 0);
    }
    function highlightSuggestion() {
      for (var i = 0; i < suggestionItems.length; i++) {
        var node = suggestionList.childNodes[i];
        if (node) node.classList.toggle("lp-jarvis-suggest-active", i === suggestionIndex);
      }
      var active = suggestionList.childNodes[suggestionIndex];
      if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
    }
    function applySuggestion(cmd) {
      inputEl.value = cmd;
      inputEl.style.height = "38px";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 110) + "px";
      hideSuggestions();
      inputEl.focus();
    }
    function updateSuggestions() {
      var val = (inputEl.value || "").toLowerCase().trim();
      if (!val) { hideSuggestions(); return; }
      if (val.indexOf("/") === 0) {
        var slashPool = Object.keys(SLASH_COMMANDS).map(function(k) { return k + " \u2014 " + SLASH_COMMANDS[k].desc; });
        var matches = slashPool.filter(function(s) { return s.indexOf(val) === 0; }).slice(0, 6);
        suggestionItems = matches;
        suggestionIndex = -1;
        renderSuggestions();
        return;
      }
      var pool = SUGGEST_DEFAULTS.slice();
      if (Array.isArray(learnedCommands)) {
        learnedCommands.forEach(function (e) { if (e && e.phrase && pool.indexOf(e.phrase) === -1) pool.push(e.phrase); });
      }
      // Resurface previously typed user messages as type-ahead suggestions.
      if (Array.isArray(history)) {
        var addedFromHistory = 0;
        for (var h = history.length - 1; h >= 0 && addedFromHistory < 12; h--) {
          var t = history[h];
          if (t && t.role === "user" && t.text) {
            var txt = String(t.text).trim();
            if (txt && txt.length <= 80 && pool.indexOf(txt) === -1) {
              pool.push(txt);
              addedFromHistory++;
            }
          }
        }
      }
      var prefixMatches = [];
      var containsMatches = [];
      pool.forEach(function (c) {
        var lc = c.toLowerCase();
        if (lc === val) return;
        if (lc.indexOf(val) === 0) prefixMatches.push(c);
        else if (lc.indexOf(val) !== -1) containsMatches.push(c);
      });
      var matches = prefixMatches.concat(containsMatches).slice(0, 6);
      suggestionItems = matches;
      // No auto-highlight: Enter sends unless the user explicitly picks one
      // (ArrowDown/Up) via the keyboard.
      suggestionIndex = -1;
      renderSuggestions();
    }

    addBubble("system", "JARVIS sedia. Taip arahan atau soalan.");
    loadHistory();

    initHeaderDrag(header);
    registerOutsideClose();
   } catch (buildErr) {
     console.error("[JARVIS buildPanel]", buildErr);
    }
   }

  // Drag the panel by its header. Clicks on the header buttons are ignored so
  // they keep working. While dragging we switch the panel from right/bottom
  // anchoring to left/top so the movement tracks the cursor exactly.
  var suppressCloseUntil = 0;
  function initHeaderDrag(header) {
    if (SIDEBAR_HOST) return; // the sidebar host fills the panel; no dragging
    if (!root || !header) return;
    var dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0, moved = false;
    header.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      // Let the header buttons (close / AI / Padam) and the provider <select>
      // handle their own clicks instead of starting a drag.
      var t = e.target;
      if (t && (t.closest ? t.closest("button, select") : (t.tagName === "BUTTON" || t.tagName === "SELECT"))) return;
      if (!open || !root) return;
      var rect = root.getBoundingClientRect();
      root.style.left = rect.left + "px";
      root.style.top = rect.top + "px";
      root.style.right = "auto";
      root.style.bottom = "auto";
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      header.style.cursor = "grabbing";
      e.preventDefault();
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    function onMove(e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      var w = root.offsetWidth, h = root.offsetHeight;
      var maxLeft = Math.max(0, window.innerWidth - w);
      var maxTop = Math.max(0, window.innerHeight - h);
      // Keep the panel a small margin away from every edge so it never tucks
      // flush under the browser toolbar (e.g. y=0).
      var MARGIN = PANEL_MARGIN;
      var left = Math.min(Math.max(startLeft + dx, MARGIN), Math.max(MARGIN, maxLeft - MARGIN));
      var top = Math.min(Math.max(startTop + dy, MARGIN), Math.max(MARGIN, maxTop - MARGIN));
      root.style.left = left + "px";
      root.style.top = top + "px";
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      header.style.cursor = "grab";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      // If the drag ended with the cursor outside the panel, don't treat the
      // trailing click as an "outside click" that would close the panel.
      if (moved) suppressCloseUntil = Date.now() + 350;
      // Persist the new position so the panel stays put next time.
      savePanelLayout();
    }
  }

  // Close the panel when the user clicks anywhere outside it.
  var outsideCloseAttached = false;
  function registerOutsideClose() {
    if (outsideCloseAttached) return;
    outsideCloseAttached = true;
     document.addEventListener("click", function (e) {
      if (!open || !root) return;
      if (pinned) return;
      if (Date.now() < suppressCloseUntil) return;
      if (root.contains(e.target)) return;
      toggle();
    }, true);
  }

  // Resize the panel by dragging its bottom-right handle. Size AND position
  // are persisted (under one key) so the layout the user set is remembered
  // across reopens and reloads until they change it again.
  var SIZE_KEY = "jarvisPanelLayoutV1";
  var resizeAttached = false;
  // Persist the current width/height/left/top so the panel stays where the
  // user put it. Stored values are restored in initResize on every load.
  // Keep the panel a safe distance from every viewport edge so the header never
  // tucks flush under the browser toolbar (the recurring y=0 issue). Used on
  // save, restore, and grab so a persisted/clamped position can never be 0.
  var PANEL_MARGIN = 12;
  function clampPanelPos(left, top) {
    var w = root ? root.offsetWidth : 0, h = root ? root.offsetHeight : 0;
    var maxLeft = Math.max(0, window.innerWidth - w);
    var maxTop = Math.max(0, window.innerHeight - h);
    var L = (left == null || isNaN(left)) ? null
      : Math.min(Math.max(left, PANEL_MARGIN), Math.max(PANEL_MARGIN, maxLeft - PANEL_MARGIN));
    var T = (top == null || isNaN(top)) ? null
      : Math.min(Math.max(top, PANEL_MARGIN), Math.max(PANEL_MARGIN, maxTop - PANEL_MARGIN));
    return { left: L, top: T };
  }
  function savePanelLayout() {
    if (!root) return;
    var rawLeft = parseInt(root.style.left, 10);
    var rawTop = parseInt(root.style.top, 10);
    var c = clampPanelPos(rawLeft, rawTop);
    try {
      api.storage.local.set({
        [SIZE_KEY]: {
          width: root.offsetWidth,
          height: root.offsetHeight,
          left: c.left,
          top: c.top
        }
      });
    } catch (e) {}
  }
  function initResize(handle) {
    if (SIDEBAR_HOST) return; // fixed full-panel size in the sidebar host
    if (!root || !handle || resizeAttached) return;
    resizeAttached = true;
    // Restore a previously persisted layout (size + position).
    try {
      lpStorageGet(SIZE_KEY, function (data) {
        var s = data && data[SIZE_KEY];
        if (s && s.width && s.height) {
          root.style.width = s.width + "px";
          root.style.height = s.height + "px";
          if (s.left != null && s.top != null) {
            var c = clampPanelPos(s.left, s.top);
            root.style.left = (c.left != null ? c.left : s.left) + "px";
            root.style.top = (c.top != null ? c.top : s.top) + "px";
            root.style.right = "auto";
            root.style.bottom = "auto";
          }
        }
      });
    } catch (e) {}
    var resizing = false, startX = 0, startY = 0, startW = 0, startH = 0;
    handle.addEventListener("mousedown", function (e) {
      if (e.button !== 0 || !open) return;
      // Make sure we resize from the same left/top anchoring the drag uses.
      var rect = root.getBoundingClientRect();
      root.style.left = rect.left + "px";
      root.style.top = rect.top + "px";
      root.style.right = "auto";
      root.style.bottom = "auto";
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = rect.width;
      startH = rect.height;
      e.preventDefault();
      e.stopPropagation();
      document.addEventListener("mousemove", onResizeMove);
      document.addEventListener("mouseup", onResizeUp);
    });
    function onResizeMove(e) {
      if (!resizing) return;
      var minW = 300, maxW = Math.max(300, window.innerWidth - 20);
      var minH = 280, maxH = Math.max(280, window.innerHeight - 20);
      var w = Math.min(Math.max(startW + (e.clientX - startX), minW), maxW);
      var h = Math.min(Math.max(startH + (e.clientY - startY), minH), maxH);
      root.style.width = w + "px";
      root.style.height = h + "px";
    }
    function onResizeUp() {
      if (!resizing) return;
      resizing = false;
      document.removeEventListener("mousemove", onResizeMove);
      document.removeEventListener("mouseup", onResizeUp);
      // Don't let the trailing click (possibly outside the panel) close it.
      suppressCloseUntil = Date.now() + 350;
      savePanelLayout();
    }
  }

   function toggleProviderView() {
     if (!root) buildPanel();
     // Butang "AI" sentiasa tunjuk/sembunyi surface provider TERBENAM di dalam
     // panel JARVIS (baik dalam overlay terapung mahupun dalam sidebar host).
     // Ia tidak lagi mendelegasikan ke Local Pocket AI sidebar berasingan.
     providerVisible = !providerVisible;
     // Lazily create the provider surface when first revealed (so it isn't
     // loaded — and can't steal focus — while the user is just typing).
       if (providerVisible) {
         ensureProviderIframe();
         root.classList.add("lp-jarvis-show-provider");
         // Tekan F6 tulen 4 kali bila paparan AI provider dibuka.
         pressNativeF6(4);
         // The provider surface just became visible — re-deliver the current page
         // context so Gemini is pointed at the page the user is viewing.
         deliverPageContextToProvider();
       } else root.classList.remove("lp-jarvis-show-provider");
       // Bila pandangan AI disembunyi, biasanya musnahkan sesi provider supaya tak
       // berebut dengan Local Pocket AI Sidebar. TETAPI bila TTS dihidupkan, KEKAL
       // iframe provider (tersembunyi via CSS opacity:0, bukan display:none) supaya
       // "Read Aloud" provider masih boleh memainkan audio walaupun dalam pandangan
       // sembang JARVIS. Iframe dimusnahkan hanya bila TTS dimatikan.
       if (!providerVisible && !jarvisTtsEnabled) destroyProviderIframe();
    // Reflect the mode on the toggle button itself: while the AI view is open
    // it becomes a "back to JARVIS" control, so returning is one obvious click.
    var aiToggle = root && root.querySelector("#lp-jarvis-ai-toggle");
    if (aiToggle) {
      if (providerVisible) {
        aiToggle.textContent = "← JARVIS";
        aiToggle.title = "Tutup AI / kembali ke JARVIS";
      } else {
        aiToggle.textContent = "AI";
        aiToggle.title = "Lihat AI";
      }
    }
    // When the provider pane is revealed it must be fully interactive — including
    // text selection inside the (cross-origin) Gemini iframe. `inert` blocks
    // selection, so we clear it explicitly (property + attribute) when shown.
    // When hidden we normally keep it inert (property + attribute) so Gemini's
    // composer can't steal the cursor; CSS (opacity:0; pointer-events:none) + the
    // suppressProviderFocus message also guard against focus stealing.
    // KECUALI bila TTS dihidupkan: biarkan iframe TIDAK inert supaya skrip
    // provider boleh mengklik butang "Read Aloud" secara programatik walaupun
    // iframe tersembunyi (opacity:0). CSS pointer-events:none tetap halang
    // interaksi pengguna, jadi tiada curi fokus.
    if (providerIframe) {
      try {
        var keepAlive = !providerVisible && jarvisTtsEnabled;
        if (providerVisible || keepAlive) {
          providerIframe.inert = false;
          providerIframe.removeAttribute("inert");
        } else {
          providerIframe.inert = true;
          providerIframe.setAttribute("inert", "");
        }
      } catch (e) {}
    }
    // Stop holding focus on the input once the provider pane takes over, and
    // resume it when the provider pane is hidden again.
    expectInputFocus = !providerVisible;
    if (providerVisible) stopFocusKeeper();
    else startFocusKeeper();
  }

  // Escape closes the embedded AI provider view (if open) and returns to the
  // JARVIS chat. Ignored when the provider view isn't showing so Esc keeps its
  // normal behaviour elsewhere.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open && providerVisible) {
      e.preventDefault();
      e.stopPropagation();
      toggleProviderView();
    }
  });

   function ensureProviderIframe() {
     if (providerIframe) return;
     if (!root) buildPanel();
     if (providerIframe) return;
     providerIframe = document.createElement("iframe");
     providerIframe.id = "lp-jarvis-provider-iframe";
     providerIframe.src = providerIframeUrl(PROVIDER);
     providerIframe.setAttribute("title", "JARVIS AI Provider");
     // Keep the iframe non-focusable while hidden so Gemini's own composer
     // auto-focus can't steal the cursor from the JARVIS input box. `inert`
     // blocks focus/input but still lets the content script inject + read.
     providerIframe.tabIndex = -1;
     try { providerIframe.inert = true; } catch (e) {}
      providerIframe.addEventListener("load", function () {
        suppressProviderFocus(600000);
        // Once the embedded provider surface has loaded, deliver the queued
        // page-context pre-fill so Gemini already "knows" the current page.
        deliverPageContextToProvider();
        // If an image is queued for the question being sent, push it straight
        // into the composer and tell the provider not to pre-fill the page URL.
        deliverImageToProvider();
      });
      if (root) root.appendChild(providerIframe);
    }

    // Tear down the embedded provider surface so it stops holding a live
    // provider session in the background. Without this, a hidden (CSS-only)
    // provider iframe keeps Gemini/Claude/etc. loaded after JARVIS is closed,
    // competing with the Local Pocket AI Sidebar's own provider and making it
    // slow or fail to load. The iframe is recreated lazily on next use.
    function destroyProviderIframe() {
      if (providerIframe && providerIframe.parentNode) {
        try { providerIframe.parentNode.removeChild(providerIframe); } catch (e) {}
      }
      providerIframe = null;
      providerVisible = false;
    }

   // ── Pre-fill the embedded Gemini/provider with the current page context ──
   // Every time JARVIS is opened we send the current page's title + URL to the
   // provider so Gemini is aware of which page the user is looking at. The text
   // lands in the provider's input (pre-filled, NOT submitted) so the user can
   // edit/send it themselves. Cross-origin, so we postMessage into the iframe.
   var pendingPageContextText = null;
   function buildPageContextText() {
     try {
       var title = currentPageTitle();
       var url = currentPageUrl();
       if (!url) return "";
       var parts = [];
       parts.push("Halaman semasa: " + (title || url));
       parts.push("URL: " + url);
       return parts.join("\n");
     } catch (e) { return ""; }
   }
    function deliverPageContextToProvider() {
      if (!providerIframe || !providerIframe.contentWindow || !pendingPageContextText) return;
      // If an image is attached to the question, don't pre-fill the page URL.
      if (pendingAttachImage) return;
      try {
        providerIframe.contentWindow.postMessage({
          type: "__lp_jarvis_prefill_context",
          text: pendingPageContextText
        }, "*");
      } catch (e) {}
    }
    // Push a queued captured image straight into the provider composer (and tell
    // it to skip the page-URL pre-fill). Sent on iframe load and again at send
    // time so the image arrives regardless of load/submit ordering.
    function deliverImageToProvider() {
      if (!providerIframe || !providerIframe.contentWindow || !pendingAttachImage) return;
      try {
        providerIframe.contentWindow.postMessage({ type: "__lp_jarvis_suppress_prefill" }, "*");
        providerIframe.contentWindow.postMessage({ type: "__lp_jarvis_attach_image", image: pendingAttachImage }, "*");
      } catch (e) {}
    }
      function notifyProviderOfPage() {
     var text = buildPageContextText();
     if (!text) return;
     pendingPageContextText = text;
   }

  // Tell the embedded provider iframe to stop auto-focusing its own composer so
  // the cursor stays in the JARVIS input box (contentScriptSidebarAi listens for
  // this and skips its programmatic focus steal while suppressed).
  function suppressProviderFocus(durationMs) {
    if (providerIframe && providerIframe.contentWindow) {
      try {
        providerIframe.contentWindow.postMessage(
          { type: "suppress-ai-focus", durationMs: durationMs },
          "*"
        );
      } catch (e) {}
    }
  }

  var inputFocusGuardAttached = false;
  function attachInputFocusGuard() {
    if (inputFocusGuardAttached || !inputEl) return;
    inputFocusGuardAttached = true;
    inputEl.addEventListener("blur", function () {
      if (!open) return;
      if (typeof hasActiveTextSelection === "function" && hasActiveTextSelection()) return;
      if (jarvisBusy || expectInputFocus) {
        requestAnimationFrame(function () {
          if (!open) return;
          var ae = document.activeElement;
          if (ae === inputEl) return;
          if (typeof document.hasFocus === "function" && !document.hasFocus()) return;
          if (typeof hasActiveTextSelection === "function" && hasActiveTextSelection()) return;
          if (typeof isPanelControl === "function" && isPanelControl(ae)) return;
          try { inputEl.focus({ preventScroll: true }); } catch (e2) {}
        });
        return;
      }
      setTimeout(function () {
        if (!open) return;
        var ae = document.activeElement;
        if (ae === inputEl) return;
        if (typeof document.hasFocus === "function" && !document.hasFocus()) return;
        if (typeof hasActiveTextSelection === "function" && hasActiveTextSelection()) return;
        if (typeof isPanelControl === "function" && isPanelControl(ae)) return;
        if (providerVisible) return;
        if (ae !== providerIframe) return;
        try { inputEl.focus({ preventScroll: true }); } catch (e) {}
      }, 0);
    });
  }

  var expectInputFocus = false;
  var focusKeeperTimer = null;

  function isPanelControl(node) {
    if (!node || !root) return false;
    return root.contains(node) && node !== inputEl && node !== providerIframe;
  }
  function hasActiveTextSelection() {
    try {
      var s = window.getSelection();
      return !!(s && s.rangeCount > 0 && !s.isCollapsed && s.toString().trim());
    } catch (e) { return false; }
  }
  function stopFocusKeeper() {
    if (focusKeeperTimer) {
      clearInterval(focusKeeperTimer);
      focusKeeperTimer = null;
    }
  }
   function startFocusKeeper() {
     stopFocusKeeper();
     if (!open || !inputEl) return;
     if (jarvisBusy || expectInputFocus) suppressProviderFocus(600000);
     var _lastStolenAt = 0;
     focusKeeperTimer = setInterval(function () {
       if (!open) return;
       var ae = document.activeElement;
       // CRITICAL FIX: DO NOT re-focus if inputEl is ALREADY the activeElement!
       if (ae === inputEl) return;
       if (typeof document.hasFocus === "function" && !document.hasFocus()) return;
       if (hasActiveTextSelection()) return;
       // Don't steal focus from real page inputs the user is typing in
       if (ae && ae.tagName === "INPUT" && ae.type !== "hidden") return;
       if (ae && ae.tagName === "TEXTAREA") return;
       // Don't steal focus from contentEditable elements
        if (ae && ae.isContentEditable) return;
        // Jangan curi focus dari <video> — elak ganggu YouTube/Plex/video player lain
        if (ae && ae.tagName === "VIDEO") return;

        if (jarvisBusy) {
         if (isPanelControl(ae)) return;
         if (ae === providerIframe || providerVisible) {
           suppressProviderFocus(600000);
           return;
         }
         try { inputEl.focus({ preventScroll: true }); } catch (e2) {
           try { inputEl.focus(); } catch (e3) {}
         }
         return;
       }
       if (providerVisible) return;
       if (isPanelControl(ae)) return;
       // When panel is open and focus is anywhere outside the input,
       // politely pull it back so cursor stays in JARVIS chat box without F6.
       var now = Date.now();
       if (now - _lastStolenAt < 1000) return;
       _lastStolenAt = now;
       try { inputEl.focus({ preventScroll: true }); } catch (e2) {
         try { inputEl.focus(); } catch (e3) {}
       }
     }, 250);
   }
  function onPanelPointerDown(e) {
    if (!e || !e.target) return;
    if (e.target === inputEl) { expectInputFocus = true; startFocusKeeper(); }
    else expectInputFocus = false;
  }
  document.addEventListener("mousedown", onPanelPointerDown, true);

  function focusInput() {
    attachInputFocusGuard();
    expectInputFocus = true;
    if (inputEl && document.activeElement !== inputEl) {
      try { inputEl.focus({ preventScroll: true }); } catch (e) {
        try { inputEl.focus(); } catch (e2) {}
      }
    }
    startFocusKeeper();
  }

  function togglePin() {
    pinned = !pinned;
    if (root) {
      root.classList.toggle("lp-jarvis-pinned", pinned);
      var btn = root.querySelector("#lp-jarvis-pin");
      if (btn) {
        btn.classList.toggle("lp-jarvis-pin-active", pinned);
        btn.classList.remove("lp-jarvis-pin-pop");
        // restart the pop animation
        void btn.offsetWidth;
        btn.classList.add("lp-jarvis-pin-pop");
        btn.setAttribute("aria-pressed", pinned ? "true" : "false");
        btn.title = pinned
          ? "Unpin panel (benarkan tutup bila klik luar)"
          : "Pin panel (kekal terbuka bila klik luar)";
      }
    }
  }

    // Paparkan panel HANYA bila prefs sedia (elak kelibat). Jika prefs belum
    // dimuat, tangguh reveal sehingga loadJarvisPrefs selesai (lihat callback).
    function revealJarvis() {
      if (root && !root.classList.contains("lp-jarvis-open")) root.classList.add("lp-jarvis-open");
      if (expectInputFocus) { try { focusInput(); } catch (e) {} }
    }
    function revealJarvisWhenReady() {
      if (jarvisPrefsReady) revealJarvis();
      else jarvisPendingReveal = revealJarvis;
    }
    // Tandakan prefs telah siap dimuat & lepaskan sebarang reveal tertunda.
    // Idempotent — selamat dipanggil dari callback storage, blok catch, atau
    // pemasa keselamatan (jangan biar panel tersembunyi selama-lamanya jika
    // bacaan storage gagal/tidak pernah kembali).
    function markJarvisPrefsReady() {
      if (jarvisPrefsReady) return;
      jarvisPrefsReady = true;
      var pending = jarvisPendingReveal;
      jarvisPendingReveal = null;
      if (pending) { try { pending(); } catch (e) {} }
    }

    function toggle() {
      // Dalam sidebar host, panel sentiasa terbuka (ia mengisi panel sidebar).
      // Jangan benarkan "tutup" — mengalih kelas lp-jarvis-open akan sembunyikan
      // keseluruhan panel tanpa cara buka semula. Abaikan toggle tutup.
      if (SIDEBAR_HOST) { open = true; return; }
      if (jarvisSuspended) return; // JARVIS disabled while AI sidebar is open
      if (!root) buildPanel();
      open = !open;
      if (open) {
         applyJarvisModeClass();
         expectInputFocus = true;
         // Tangguh paparan sehingga prefs sedia supaya keadaan tersimpan
         // (bahagian bawah / accordion) tak sempat "terbuka lalu tertutup".
         revealJarvisWhenReady();
          // Tekan F6 tulen 4 kali bila sidebar JARVIS dibuka.
          pressNativeF6(4);
         // Re-inject a persisted AI command now that JARVIS is actually open
         // (avoids creating a hidden provider iframe on page load).
         replayPendingCommand();
        suppressProviderFocus(600000);
        // Only watch the page for element-hint changes while JARVIS is open;
        // stop on close so it never burns CPU in the background.
        startHintObserver();
        // Let the embedded Gemini/provider know which page we're on by
        // pre-filling its input with the current page's URL + title.
        notifyProviderOfPage();
        if (!proactiveDone && history.length === 0) {
         var ctx = Core.extractPageContext();
         if (ctx && ctx.text && ctx.text.length > 200) {
           addBubble("jarvis", "Saya nampak anda membuka \"" + (ctx.title || ctx.url) + "\". Taip \"ringkaskan\" untuk saya rumuskan, atau tanya apa-apa.");
           proactiveDone = true;
         }
       }
      } else {
        root.classList.remove("lp-jarvis-open");
        expectInputFocus = false;
        stopFocusKeeper();
        // Disconnect the page-watch observer so JARVIS adds zero background
        // overhead once closed — this keeps the tab (and sidebar) responsive.
        stopHintObserver();
        // Release the embedded provider session so it doesn't compete with the
        // Local Pocket AI Sidebar's own provider after JARVIS is closed. Kecuali
        // bila TTS dihidupkan (iframe dipelihara supaya read-aloud terus main).
        if (!jarvisTtsEnabled) destroyProviderIframe();
      }
   }

   // Force-close the panel and tear down any active work. Used when JARVIS is
   // suspended because the Local Pocket AI sidebar is open.
    function closePanelIfOpen() {
      if (open) open = false;
      if (root) root.classList.remove("lp-jarvis-open");
      expectInputFocus = false;
      stopFocusKeeper();
       stopHintObserver();
       // Release the embedded provider session so it doesn't compete with the
       // Local Pocket AI Sidebar's own provider after JARVIS is suspended/closed.
       // Kecuali bila TTS dihidupkan (iframe dipelihara supaya read-aloud terus main).
       if (!jarvisTtsEnabled) destroyProviderIframe();
     }

   // Suspend (or resume) JARVIS in response to the AI sidebar open/close state
   // broadcast by the background script. While suspended, JARVIS does nothing:
   // the panel cannot be opened, no messages are processed, and the page
   // element-hint scanning is skipped. Resuming restores full functionality.
   function setJarvisSuspended(state) {
     if (SIDEBAR_HOST) return; // the sidebar host is never suspended by AI-sidebar state
     state = !!state;
     if (jarvisSuspended === state) return;
     jarvisSuspended = state;
     if (jarvisSuspended) closePanelIfOpen();
   }

   var userScrolledUp = false;
   var SCROLL_TOLERANCE = 20; // px dari bawah dikira "di dasar"
   var _scrollInit = false;
   function updateScrollIndicator() {
     var ind = root && root.querySelector("#lp-jarvis-scroll-down");
     if (ind) ind.style.display = userScrolledUp ? "flex" : "none";
   }
    function scrollToBottom(force) {
      initScrollDetection();
      if (!transcriptEl) return;
      if (!force && userScrolledUp) return;
      userScrolledUp = false;
      requestAnimationFrame(function () {
        if (transcriptEl) transcriptEl.scrollTop = transcriptEl.scrollHeight;
      });
    }
   function initScrollDetection() {
     if (!transcriptEl || _scrollInit) return;
     _scrollInit = true;
     transcriptEl.addEventListener("scroll", function () {
       var atBottom = transcriptEl.scrollHeight - transcriptEl.scrollTop - transcriptEl.clientHeight < SCROLL_TOLERANCE;
       userScrolledUp = !atBottom;
       updateScrollIndicator();
     });
     var ind = root && root.querySelector("#lp-jarvis-scroll-down");
     if (!ind && root) {
       ind = el("button", { id: "lp-jarvis-scroll-down", className: "lp-jarvis-scroll-down", title: "Ke bawah", text: "↓" });
       ind.addEventListener("click", function () {
         userScrolledUp = false;
         if (transcriptEl) transcriptEl.scrollTop = transcriptEl.scrollHeight;
         updateScrollIndicator();
       });
       root.appendChild(ind);
     }
     updateScrollIndicator();
     // Letak tepat di atas baris input (clear input row + jarak kecil) supaya
     // tak bertindih dengan input / butang hantar, walau tinggi baris berubah.
     try {
       var _row = root.querySelector("#lp-jarvis-input-row");
       var _rowH = (_row && _row.offsetHeight) ? _row.offsetHeight : 56;
       ind.style.bottom = (_rowH + 10) + "px";
     } catch (e) {}
   }
   function initDragDrop() {
     if (!root) return;
     root.addEventListener("dragover", function (e) {
       if (!e.dataTransfer) return;
       e.preventDefault(); e.stopPropagation();
       root.classList.add("lp-jarvis-drag-over");
     });
     root.addEventListener("dragleave", function (e) {
       if (e.target === root) root.classList.remove("lp-jarvis-drag-over");
     });
      root.addEventListener("drop", function (e) {
        e.preventDefault(); e.stopPropagation();
        root.classList.remove("lp-jarvis-drag-over");
        var _ul = "";
        try { _ul = e.dataTransfer.getData("text/uri-list") || ""; } catch (_) { _ul = "(blocked)"; }
        try { console.log("[JARVIS drag] drop:", { files: e.dataTransfer ? e.dataTransfer.files.length : -1, types: e.dataTransfer ? e.dataTransfer.types : null, uriList: _ul }); } catch (e0) {}
        if (!e.dataTransfer) return;
       var files = e.dataTransfer.files;
       var imageFile = null;
       if (files && files.length) {
         for (var i = 0; i < files.length; i++) {
           var ft = (files[i].type || "").toLowerCase();
           // Accept image/* files. Also accept files with an empty or
           // non-standard type — Firefox often reports a dragged web image with
           // no type (or as application/x-moz-file); if a file is present on an
           // image drag it IS the dropped picture.
           if (ft.indexOf("image/") === 0 || ft === "" || ft.indexOf("moz-file") >= 0) {
             imageFile = files[i]; break;
           }
         }
       }
       if (imageFile) {
         var reader = new FileReader();
         reader.onload = function (ev) {
           try { if (ev && ev.target && ev.target.result) { pendingImage = ev.target.result; showPendingImageThumb(); } } catch (e2) {}
         };
         reader.onerror = function () { handleDroppedUrl(); };
         reader.readAsDataURL(imageFile);
         return;
       }
       handleDroppedUrl();
        function handleDroppedUrl() {
         // Web-page image drag: delivered as a URL, not a file. A raw
         // (often cross-origin) URL can't be attached to Gemini's composer
         // (CORS), so fetch it in the background and use the returned
         // data URL — the same form a screenshot produces.
         var url = "";
         try {
           var html = e.dataTransfer.getData("text/html");
           if (html) {
             var m = html.match(/<img[^>]+src=["']([^"']+)["']/i) || html.match(/src=["']([^"']+)["']/i);
             if (m && m[1]) url = m[1];
           }
         } catch (e2) {}
         if (!url) { try { url = e.dataTransfer.getData("text/uri-list") || ""; } catch (_u) {} }
         if (!url) { try { url = e.dataTransfer.getData("text/plain") || ""; } catch (e1) {} }
         url = (url || "").trim().split(/\s+/)[0];
         if (url && url.indexOf("google.com/imgres") >= 0) {
           try { var _p = new URL(url); var _iu = _p.searchParams.get("imgurl"); if (_iu && _iu.indexOf("http") === 0) url = decodeURIComponent(_iu); } catch (e3) {}
         }
         // Resolve relative src (from text/html <img>) against the page base URL.
         try { if (url && !/^[a-z][a-z0-9+.\-]*:/i.test(url)) { var _a = document.createElement("a"); _a.href = url; if (_a.href && /^https?:/i.test(_a.href)) url = _a.href; } } catch (e) {}
         if (url && url.indexOf("http") === 0) {
           try {
             api.runtime.sendMessage({ type: "jarvis-fetch-image", url: url }, function (res) {
               if (res && res.ok && res.dataUrl) { pendingImage = res.dataUrl; showPendingImageThumb(); }
               else { captureDroppedWebImage(url); }
             });
           } catch (e3) {}
         }
       }
     });
   }

   // Escape HTML special characters so provider text can never inject markup.
   function escapeHtml(s) {
     return String(s == null ? "" : s)
       .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
   }
    // Defense-in-depth: only ever treat http(s) URLs as clickable. Even though
    // the linkify regex already requires an http(s) scheme, this explicit guard
    // rejects sneaky/malformed schemes (javascript:, data:, vbscript:, etc.)
    // BEFORE we build an <a href>, in case the regex is ever loosened later.
    function isSafeHttpUrl(url) {
      var u = String(url == null ? "" : url).trim();
      if (/[\u0000-\u001F\u007F]/.test(u)) return false; // control chars (obfuscation)
      return /^https?:\/\//i.test(u);
    }
    // Turn real URLs and markdown [label](url) in answer text into safe,
    // clickable anchors (open in a new tab). Input is escaped first, so the
    // provider cannot inject scripts/markup — only our own <a> tags are added.
    function linkify(text) {
      var safe = escapeHtml(text);
      var re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<]+/gi;
      safe = safe.replace(re, function (m, label, url) {
        if (label && url) {
          if (!isSafeHttpUrl(url)) return m; // reject unsafe scheme, keep as text
          return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + "</a>";
        }
        if (!isSafeHttpUrl(m)) return m; // reject unsafe scheme, keep as text
        return '<a href="' + m + '" target="_blank" rel="noopener noreferrer">' + m + "</a>";
      });
       return safe.replace(/\n/g, "<br>");
     }

     // Intercept clicks on links inside JARVIS answer bubbles. Some providers
     // (e.g. Gemini) wrap a real URL inside a search-engine redirect
     // (https://www.google.com/search?q=https://www.youtube.com/@DeddyCorbuzier)
     // so clicking "opens a Google search of the URL" instead of the URL itself.
     // When we detect a wrapped URL we open the REAL target directly.
     function unwrapLinkHref(anchor) {
       try {
         var href = anchor.getAttribute("href") || anchor.href || "";
         var text = (anchor.textContent || "").trim();
         if (!href) return null;
         var candidate = null;
         // 1) Search-engine wrapper: q= / url= / uddg= param that is itself a URL.
         try {
           var u = new URL(href, location.href);
           var raw = u.searchParams.get("q") || u.searchParams.get("url") || u.searchParams.get("uddg") || "";
           // DuckDuckGo's uddg is double-encoded; decode a couple of times to be safe.
           for (var _d = 0; _d < 3 && /%[0-9a-f]{2}/i.test(raw); _d++) raw = decodeURIComponent(raw);
           if (raw && /^https?:\/\//i.test(raw)) candidate = raw;
         } catch (e1) {}
         // 2) Link text is a bare URL but the href points somewhere else (wrapped/aliased).
         if (!candidate && /^https?:\/\/\S+$/i.test(text)) {
           try {
             var rh = new URL(href, location.href).href;
             var rt = new URL(text, location.href).href;
             if (rt !== rh) candidate = rt;
           } catch (e2) {}
         }
         return candidate && /^https?:\/\//i.test(candidate) ? candidate : null;
       } catch (e) { return null; }
     }

     function handleJarvisLinkClick(e) {
       if (!e || !e.target || e.defaultPrevented) return;
       var a = e.target.closest ? e.target.closest("a") : null;
       if (!a) return;
       // Only touch links rendered inside JARVIS chat bubbles (not the provider
       // iframe, settings UI, etc.).
       if (!a.closest || !a.closest(".lp-jarvis-bubble")) return;
       var real = unwrapLinkHref(a);
       if (real) {
         e.preventDefault();
         e.stopPropagation();
         try { window.open(real, "_blank"); } catch (e3) {}
       }
     }

    // Defense-in-depth XSS sanitization for any HTML we inject into bubbles.
    // Provider/markdown text is already HTML-escaped by linkify() first, but
    // running the result through DOMPurify guarantees no script/injection can
    // survive (e.g. a crafted [label](javascript:...) or exotic markup). Falls
    // back to the already-escaped input if DOMPurify isn't available.
    function sanitizeHtml(html) {
      try {
        if (window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
          return window.DOMPurify.sanitize(html, {
            ADD_ATTR: ["target", "rel"],
            ALLOWED_TAGS: ["a", "br", "b", "i", "strong", "em", "code", "pre", "ul", "ol", "li", "p", "span",
              "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td",
              "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "hr", "details", "summary", "mark", "del", "ins"],
            ALLOWED_ATTR: ["href", "target", "rel", "class", "title", "src", "alt", "width", "height",
              "loading", "style", "colspan", "rowspan", "align"]
          });
        }
      } catch (e) {}
      return html;
    }

    function getBubblePlainText(bubble) {
     try {
        var clone = bubble.cloneNode(true);
        var btn = clone.querySelector(".lp-jarvis-copy-btn");
        if (btn) btn.remove();
        var rbtn = clone.querySelector(".lp-jarvis-resend-btn");
        if (rbtn) rbtn.remove();
       var html = clone.innerHTML || "";
       html = html.replace(/<br\s*\/?>/gi, "\n");
       var tmp = document.createElement("div");
       safeSetHtml(tmp, html);
       return (tmp.textContent || "").replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
      } catch (e) { return (bubble.textContent || "").trim(); }
    }

    // Convert a sanitized HTML string to plain text for history storage, so that
    // re-rendering (which runs linkify) does not escape the original markup.
    function htmlToPlainText(html) {
      try {
        var tmp = document.createElement("div");
        safeSetHtml(tmp, html || "");
        return (tmp.textContent || "").replace(/\s+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      } catch (e) { return String(html || "").replace(/<[^>]*>/g, " ").trim(); }
    }

    // The jarvis bubble holds its text inside an inner ".lp-jarvis-bubble-content"
   // element so the copy button (a sibling) survives content updates (streaming,
   // watchdog finalize, cancel). These helpers read/write that inner element.
   function getBubbleContentEl(bubble) {
     return bubble ? bubble.querySelector(".lp-jarvis-bubble-content") : null;
   }
  function setBubbleText(bubble, text) {
    if (!bubble) return;
    bubble.classList.remove("lp-jarvis-bubble-loading");
    text = text || "";
      var html = LPJarvisMarkdown ? sanitizeHtml(LPJarvisMarkdown.render(linkify(text))) : linkify(text);
      var c = getBubbleContentEl(bubble);
      if (c) safeSetHtml(c, html);
      else safeSetHtml(bubble, html);
      if (LPJarvisMarkdown) LPJarvisMarkdown.addCodeCopyButtons(bubble);
    }
   function getBubbleText(bubble) {
     var c = getBubbleContentEl(bubble);
     return c ? (c.textContent || "") : (bubble ? (bubble.textContent || "") : "");
   }

   function renderBubble(role, text, imgDataUrl, ts) {
      if (!transcriptEl) buildPanel();
       var bubble = el("div", { className: "lp-jarvis-bubble lp-jarvis-bubble-" + role });
        // Remember the attached image so the "Hantar semula" (resend) button can
        // re-send the question together with its picture (not text-only).
        bubble.__img = (role === "user" && imgDataUrl) ? imgDataUrl : null;
        if (role === "user" && imgDataUrl) {
         var imgWrap = el("div", { className: "lp-jarvis-bubble-img-wrap" });
         var img = document.createElement("img");
         img.src = imgDataUrl;
         img.className = "lp-jarvis-bubble-img";
         img.alt = "Gambar dilampirkan";
         imgWrap.appendChild(img);
         bubble.appendChild(imgWrap);
       }
       var rendered = LPJarvisMarkdown ? sanitizeHtml(LPJarvisMarkdown.render(linkify(text))) : sanitizeHtml(linkify(text));
       var content = el("div", { className: "lp-jarvis-bubble-content", html: rendered });
      bubble.appendChild(content);
      if (LPJarvisMarkdown) LPJarvisMarkdown.addCodeCopyButtons(bubble);
        if (role === "jarvis") {
          var copyBtn = el("button", { className: "lp-jarvis-copy-btn", title: "Salin jawapan", text: "📋" });
          copyBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            copyText(getBubblePlainText(bubble)).then(function (ok) {
              copyBtn.textContent = ok ? "✅" : "✕";
              setTimeout(function () { copyBtn.textContent = "📋"; }, 2000);
            }).catch(function () {
              copyBtn.textContent = "✕";
              setTimeout(function () { copyBtn.textContent = "📋"; }, 2000);
            });
          });
          bubble.appendChild(copyBtn);
          // "Save to note" button (copied from LP Sidebar AI's import-summary-to-note).
          var noteBtn = el("button", { className: "lp-jarvis-note-btn", title: "Simpan jawapan ke nota", text: "📝" });
          noteBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var txt = getBubblePlainText(bubble) || getBubbleText(bubble);
            if (!txt) return;
            try {
              api.runtime.sendMessage({ type: "lp-insert-ai-text-final", text: txt, mode: "append" }).catch(function () {});
            } catch (e2) {}
            noteBtn.textContent = "✅";
            setTimeout(function () { noteBtn.textContent = "📝"; }, 2000);
          });
          bubble.appendChild(noteBtn);
          // "Bacakan semula" button — ulang-baca mesej ini melalui TTS walaupun
          // toggle TTS (🔈) dimatikan. Berfungsi secara atas permintaan.
          var speakBtn = el("button", { className: "lp-jarvis-speak-btn", title: "Bacakan semula jawapan", text: "🔊" });
          speakBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var txt = getBubblePlainText(bubble) || getBubbleText(bubble);
            if (!txt) return;
            replaySpeak(txt);
            speakBtn.textContent = "🔈";
            setTimeout(function () { speakBtn.textContent = "🔊"; }, 1500);
          });
          bubble.appendChild(speakBtn);
        }
       // Resend button on the user's own (sent) bubbles: re-runs the exact same
       // text through JARVIS's normal processing pipeline (local + AI), like the
       // user had typed it again. Revealed on hover via CSS.
        if (role === "user") {
          var resendBtn = el("button", { className: "lp-jarvis-resend-btn", title: "Hantar semula", text: "↻" });
          // Inline layout so the button always appears BELOW the bubble even if
          // the stylesheet is stale/cached. position:static overrides any old
          // absolute positioning from a previous CSS version; the stylesheet
          // still handles the hover reveal + theme colours.
          resendBtn.style.position = "static";
          resendBtn.style.display = "block";
          resendBtn.style.marginTop = "4px";
          resendBtn.style.marginLeft = "auto";
          resendBtn.style.marginRight = "0";
          resendBtn.style.width = "max-content";
           resendBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var txt = getBubbleText(bubble);
            if (txt) {
              // Re-attach the original image (if any) so the resend reaches Gemini
              // with the picture, not just the text.
              if (bubble.__img) { pendingImage = bubble.__img; pendingUserImage = bubble.__img; showPendingImageThumb(); }
              processMessage(txt);
            }
          });
          bubble.appendChild(resendBtn);
          // E6: butang edit / padam mesej sendiri
          var editBtn = el("button", { className: "lp-jarvis-edit-btn", title: "Edit mesej", text: "✎" });
          editBtn.style.position = "static";
          editBtn.style.display = "block";
          editBtn.style.marginTop = "4px";
          editBtn.style.marginLeft = "4px";
          editBtn.style.marginRight = "0";
          editBtn.style.width = "max-content";
          editBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var txt = getBubbleText(bubble);
            if (txt) { inputEl.value = txt; inputEl.focus(); }
          });
          bubble.appendChild(editBtn);
          var delBtn = el("button", { className: "lp-jarvis-del-btn", title: "Padam mesej", text: "🗑" });
          delBtn.style.position = "static";
          delBtn.style.display = "block";
          delBtn.style.marginTop = "4px";
          delBtn.style.marginLeft = "4px";
          delBtn.style.marginRight = "0";
          delBtn.style.width = "max-content";
          delBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            if (typeof bubble.__hidx === "number" && bubble.__hidx >= 0 && bubble.__hidx < history.length) {
              history.splice(bubble.__hidx, 1);
              try {
                Array.prototype.forEach.call(transcriptEl.children, function (c) {
                  if (typeof c.__hidx === "number" && c.__hidx > bubble.__hidx) c.__hidx--;
                });
              } catch (e2) {}
            }
            if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
            try { saveHistory(); } catch (e3) {}
          });
          bubble.appendChild(delBtn);
        }
        if (ts !== null) {
          var timeEl = el("div", { className: "lp-jarvis-bubble-time", text: formatTime(ts == null ? Date.now() : ts) });
          bubble.appendChild(timeEl);
        }
      transcriptEl.appendChild(bubble);
      scrollToBottom();
      if (root && !root.__dragInit) { root.__dragInit = true; initDragDrop(); }
      return bubble;
    }

    function addBubble(role, text, imgDataUrl) {
      // #3 — TTS: berhenti baca bila pengguna menghantar mesej baharu.
      if (role === "user") stopSpeaking();
      var b = renderBubble(role, text, imgDataUrl);
     if (role === "user" || role === "jarvis") {
       recordTurn(role, text);
       b.__hidx = history.length - 1;
     }
     pruneTranscriptBubbles();
     return b;
   }

   function addUserBubble(text) {
     var img = pendingUserImage || null;
     pendingUserImage = null;
     return addBubble("user", text, img);
   }

  function addPlaceholderBubble() {
    var b = renderBubble("jarvis", "…", undefined, null);
    // E10: ganti teks "…" dengan skeleton animasi supaya pengguna nampak
    // JARVIS sedang memproses (bukan sekadar titik). Sorok butang
    // salin/nota sementara memproses.
    b.classList.add("lp-jarvis-bubble-loading");
    try {
      var _sk = b.querySelector(".lp-jarvis-bubble-content");
      if (_sk) {
        _sk.innerHTML =
          '<div class="lp-jarvis-skeleton">' +
            '<div class="lp-jarvis-skeleton-line" style="width:85%"></div>' +
            '<div class="lp-jarvis-skeleton-line" style="width:70%"></div>' +
            '<div class="lp-jarvis-skeleton-line" style="width:55%"></div>' +
          '</div>';
      }
    } catch (e) {}
    // A placeholder bubble is only ever created while a turn is in flight, so
    // surface the in-transcript "processing / cancellable" indicator on it.
    markBubbleProcessing(b);
    return b;
  }

   // Keep the persisted conversation bounded so memory/storage don't grow
   // without limit (self-check suggested pruning once it approaches ~15 turns).
   var HISTORY_CAP = 30;
   function pruneHistory() {
     if (history.length > HISTORY_CAP) history = history.slice(-HISTORY_CAP);
   }
   // Cap the number of rendered bubbles in the DOM so a long session can't
   // exhaust memory / make the transcript scroll sluggish (Transcript Truncator).
   var TRANSCRIPT_BUBBLE_CAP = 50;
   function pruneTranscriptBubbles() {
     if (!transcriptEl) return;
     try {
       while (transcriptEl.childNodes.length > TRANSCRIPT_BUBBLE_CAP) {
         var first = transcriptEl.firstChild;
         // Never drop a bubble that's still streaming its answer.
         if (first === activeAssistantBubble || first === planningBubble) break;
         transcriptEl.removeChild(first);
       }
     } catch (e) {}
   }
    function recordTurn(role, text) {
      // Remember the most recent URL the assistant shared so the user can later
      // say "buka link tu" and JARVIS opens THAT link (context awareness),
      // instead of treating "link tu" as literal search text.
      if (role === "jarvis") rememberAssistantLink(text);
      history.push({ role: role, text: String(text || ""), ts: Date.now() });
      pruneHistory();
      saveHistory();
    }

    // Most recent URL mentioned by the assistant (for "buka link tu" resolution).
    var lastMentionedLink = null;
    var LINK_RE = /https?:\/\/[^\s<>"')\]]+/gi;
    function rememberAssistantLink(text) {
      if (!text) return;
      var urls = String(text).match(LINK_RE);
      if (urls && urls.length) {
        lastMentionedLink = urls[urls.length - 1];
      }
    }

  /* ---------- Conversation sessions (feature #2) ---------- */
   function urlNow() { try { return currentPageUrl() || ""; } catch (e) { return ""; } }

  // Read the whole sessions object from storage (async).
  function readSessions(cb) {
    lpStorageGet([SESSIONS_KEY], function (data) {
      var obj = (data && data[SESSIONS_KEY] && typeof data[SESSIONS_KEY] === "object") ? data[SESSIONS_KEY] : {};
      cb(obj);
    });
  }
  // Persist the whole sessions object to storage.
  function writeSessions(obj, cb) {
    try { api.storage.local.set({ [SESSIONS_KEY]: obj }, function () { if (cb) cb(); }); }
    catch (e) { if (cb) cb(); }
  }
  // Drop sessions older than the TTL and cap the total count (most-recent kept).
  function sweepSessions(obj) {
    var ttl = (sessionTtlDays > 0 ? sessionTtlDays : DEFAULT_TTL_DAYS) * 86400000;
    var now = Date.now();
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var s = obj[keys[i]];
      if (!s || !s.updatedAt || (now - s.updatedAt) > ttl) delete obj[keys[i]];
    }
    var remaining = Object.keys(obj);
    if (remaining.length > SESSION_CAP) {
      remaining.sort(function (a, b) { return (obj[b].updatedAt || 0) - (obj[a].updatedAt || 0); });
      for (var j = SESSION_CAP; j < remaining.length; j++) delete obj[remaining[j]];
    }
    return obj;
  }
  // Start a brand-new (empty) session for the current tab.
  function newSession() {
    activeSessionId = genToken();
    history = [];
  }
  // Persist the working `history` into the active session (creates it on first save).
  // Reads the latest sessions from storage first and MERGES the current session in,
  // so a save that races ahead of loadHistory() can never clobber/wipe the other
  // already-saved sessions (fixes "senarai sesi perbualan" showing empty).
  function saveHistory() {
    if (!activeSessionId) return;
    var ctx = Core.extractPageContext();
    var now = Date.now();
    readSessions(function (obj) {
      if (!obj || typeof obj !== "object") obj = {};
      var s = obj[activeSessionId];
      if (!s) { s = { id: activeSessionId, createdAt: now, turns: [] }; obj[activeSessionId] = s; }
      s.turns = history.slice();
      s.updatedAt = now;
      if (!s.title) s.title = (ctx && ctx.title) || "";
      if (!s.page) s.page = {};
      if (!s.page.url) s.page.url = urlNow();
      if (!s.page.title && ctx && ctx.title) s.page.title = ctx.title;
      sessions = obj;
      writeSessions(sweepSessions(obj));
    });
  }

  function loadHistory() {
    readSessions(function (obj) {
      sessions = sweepSessions(obj);
      var url = urlNow();
      var found = null;
      Object.keys(sessions).forEach(function (k) {
        var s = sessions[k];
        if (s && s.page && s.page.url === url && !found) { found = s; }
      });
      if (found && Array.isArray(found.turns) && found.turns.length) {
        activeSessionId = found.id || genToken();
        found.id = activeSessionId;
        history = found.turns.slice();
        pruneHistory();
        history.forEach(function (t) {
          renderBubble(t.role === "user" ? "user" : "jarvis", t.text, undefined, t.ts);
        });
      } else {
        newSession();
      }
    });
  }

  // Clear the entire JARVIS conversation history: memory, persisted storage,
  // and the rendered bubbles in the panel.
  function clearHistory() {
    if (sessions && activeSessionId && sessions[activeSessionId]) {
      delete sessions[activeSessionId];
      writeSessions(sweepSessions(sessions));
    }
    history = [];
    activeSessionId = null;
    newSession();
    if (transcriptEl) transcriptEl.innerHTML = "";
    activeAssistantBubble = null;
    planningBubble = null;
    processingBubble = null;
    planningMode = false;
    currentToken = "";
    addBubble("system", "Sejarah perbualan dipadam. JARVIS sedia. Taip arahan atau soalan.");
  }

  /* ---------- Session-list modal (feature #2) ---------- */
  function openSessionsModal() {
    renderSessionsList();
    if (sessionsModal) sessionsModal.classList.add("lp-jarvis-show");
  }
  function closeSessionsModal() {
    if (sessionsModal) sessionsModal.classList.remove("lp-jarvis-show");
  }
  function renderSessionsList() {
    var list = root && root.querySelector("#lp-jarvis-sessions-list");
    if (!list) return;
    list.innerHTML = "";
    var obj = sweepSessions(sessions || {});
    var arr = Object.keys(obj).map(function (k) { return obj[k]; });
    arr.sort(function (a, b) { return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0); });
    if (!arr.length) {
      list.appendChild(el("div", { className: "lp-jarvis-tpl-empty", text: "Tiada sesi perbualan disimpan." }));
      return;
    }
    arr.forEach(function (s) {
      var name = (s.title || (s.page && s.page.url) || "Tanpa tajuk");
      var d = new Date(s.updatedAt || s.createdAt || Date.now());
      var item = el("div", { className: "lp-jarvis-tpl-item" });
      var label = el("div", { className: "lp-jarvis-tpl-name-lbl", text: name + " · " + d.toLocaleDateString() + " (" + ((s.turns && s.turns.length) || 0) + ")" });
      var btns = el("div", { className: "lp-jarvis-tpl-item-btns" });
      var openBtn = el("button", { text: "Buka", title: "Muat sesi ini" });
      openBtn.addEventListener("click", function (e) { e.stopPropagation(); openSession(s.id); });
      var delBtn = el("button", { text: "Padam", title: "Padam sesi" });
      delBtn.addEventListener("click", function (e) { e.stopPropagation(); deleteSession(s.id); });
      btns.appendChild(openBtn); btns.appendChild(delBtn);
      item.appendChild(label); item.appendChild(btns);
      list.appendChild(item);
    });
  }
  function openSession(id) {
    readSessions(function (obj) {
      var s = obj[id];
      if (!s) return;
      history = Array.isArray(s.turns) ? s.turns.slice() : [];
      activeSessionId = id;
      pruneHistory();
      if (transcriptEl) transcriptEl.innerHTML = "";
      activeAssistantBubble = null; planningBubble = null; processingBubble = null; planningMode = false; currentToken = "";
      history.forEach(function (t) { renderBubble(t.role === "user" ? "user" : "jarvis", t.text, undefined, t.ts); });
      closeSessionsModal();
    });
  }
  function deleteSession(id) {
    if (!sessions) sessions = {};
    delete sessions[id];
    writeSessions(sweepSessions(sessions));
    renderSessionsList();
  }
  // Wipe every saved conversation session (with confirmation so it can't be hit
  // by accident). Also clears the in-memory cache and the active session.
  function deleteAllSessions() {
    if (!sessions || !Object.keys(sessions).length) { renderSessionsList(); return; }
    if (!window.confirm("Padam SEMUA sesi perbualan? Tindakan ini tak boleh dibatalkan.")) return;
    readSessions(function (obj) {
      var keys = Object.keys(obj || {});
      keys.forEach(function (k) { delete obj[k]; });
      sessions = obj;
      writeSessions(obj);
      renderSessionsList();
    });
    if (activeSessionId) {
      history = [];
      activeSessionId = null;
      newSession();
      if (transcriptEl) transcriptEl.innerHTML = "";
    }
  }

  // Built-in response for "what can you do" / help requests, so JARVIS lists
  // its own capabilities instead of bouncing the question to the AI provider.
  function showCapabilities() {
    var lines = [
      "Saya JARVIS boleh buat antaranya:",
      "",
      "• Simpan & baca — \"simpan halaman ini\", \"buka library\", \"buka kategori <nama>\"",
      "• Rumuskan — \"ringkaskan\" (guna konteks halaman semasa)",
      "• Cari — \"cari ai\" (simpanan + web), \"cari X di web\", \"cari di youtube X\", \"buka 5 tab youtube X\"",
      "• Laman & tab — \"buka github.com\", \"tab baharu\", \"tutup tab\", \"muat semula\", \"ke belakang\"",
      "• Kawalan halaman — \"cari perkataan X\", \"tatal ke bawah\", \"klik butang Langgan\", \"isi email dengan a@b.com\"",
      "• Add-on — \"buka sidebar\", \"buka notes\", \"//gambar\", \"buka settings\"",
      "• Padam sejarah — butang \"Padam\" di header",
      "• Ingatan — \"eksport ingatan\" (backup JSON), \"import ingatan\" (pulih dari fail). JARVIS belajar arahan dari Gemini secara automatik.",
      "• Makro — \"simpan makro pagi: buka github.com; ringkas\" (rantaian arahan), \"jalankan makro pagi\", \"senarai makro\", \"padam makro pagi\".",
      "• Snapshot perbualan — \"simpan perbualan\" (simpan ke storan + muat turun JSON), \"senarai perbualan\".",
      "• Smart element — \"klik butang <teks>\" / \"isi <medan> dengan <nilai>\" selesai ikut teks via pemetaan indeks elemen.",
      "• Soalan bebas — tanya apa sahaja, saya hantar ke Gemini dengan konteks halaman.",
      "",
      "Tekan F4 untuk buka/tutup panel."
    ];
    addBubble("jarvis", lines.join("\n"));
  }

    // ── Streaming render coalescing ──────────────────────────────────────────
    // While JARVIS answers, the background scrapes the provider and fires an
    // `ai-overlay-response` chunk for (potentially) every token. Rendering the
    // full accumulated text (markdown + DOMPurify sanitize + code-button scan)
    // on EVERY chunk kept the main thread busy and made typing in the input box
    // janky. We now coalesce chunk updates to at most one DOM write per
    // animation frame, and during streaming do a cheap plain-text/innerHTML
    // write; the expensive markdown + sanitize + code-button pass happens ONCE
    // on the final `done` (see _finishStreamRender).
    var _streamRaf = 0;
    var _streamText = null;
    var _streamHtml = null;
    var _streamIsHtml = false;
    var _streamInit = false;

    function _cancelStreamRaf() {
      if (_streamRaf) {
        try { (window.cancelAnimationFrame || clearTimeout)(_streamRaf); } catch (e) {}
        _streamRaf = 0;
      }
    }
    function _streamPrepareBubble() {
      if (_streamInit || !activeAssistantBubble) return;
      _streamInit = true;
      activeAssistantBubble.classList.remove("lp-jarvis-bubble-loading");
      var c = getBubbleContentEl(activeAssistantBubble);
      if (c) c.innerHTML = "";
    }
    function _flushStream() {
      _streamRaf = 0;
      if (!activeAssistantBubble) { _streamText = _streamHtml = null; return; }
      _streamPrepareBubble();
      if (_streamIsHtml) {
        // Sanitize HERE (coalesced to one pass per animation frame) instead of
        // per chunk in the message handler — that was the main cause of the
        // typing jank while JARVIS streamed an answer.
        var html = sanitizeHtml(_streamHtml || "");
        var c = getBubbleContentEl(activeAssistantBubble);
        if (c) safeSetHtml(c, html || "");
        else safeSetHtml(activeAssistantBubble, html || "");
      } else {
        var txt = _streamText;
        var cc = getBubbleContentEl(activeAssistantBubble);
        if (cc) cc.textContent = (txt == null ? "" : txt);
        else activeAssistantBubble.textContent = (txt == null ? "" : txt);
      }
      scrollToBottom();
    }
    function _scheduleStream() {
      if (_streamRaf) return;
      var raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
      _streamRaf = raf(_flushStream);
    }
    // Final, fully-formatted render for the completed turn (markdown + sanitize
    // + code-copy buttons). Cancel any pending coalesced frame first.
    function _finishStreamRender(finalText, finalHtml) {
      _cancelStreamRaf();
      _streamText = _streamHtml = null;
      if (!activeAssistantBubble) return;
      _streamInit = true;
      activeAssistantBubble.classList.remove("lp-jarvis-bubble-loading");
      if (finalHtml != null) {
        // Sanitize once, on completion (the per-frame flush already sanitized
        // each intermediate frame).
        var cleanHtml = sanitizeHtml(finalHtml || "");
        var c = getBubbleContentEl(activeAssistantBubble);
        if (c) safeSetHtml(c, cleanHtml || "");
        else safeSetHtml(activeAssistantBubble, cleanHtml || "");
      } else if (finalText != null) {
        setBubbleText(activeAssistantBubble, finalText);
      }
      scrollToBottom();
    }
    // Reset the streaming buffers at the start of each assistant turn so a new
    // placeholder bubble begins clean.
    function resetStreamState() {
      _cancelStreamRaf();
      _streamText = _streamHtml = null;
      _streamIsHtml = false;
      _streamInit = false;
    }

    function appendAssistantText(text) {
      if (!activeAssistantBubble) return;
      _streamIsHtml = false;
      _streamText = text || "";
      _scheduleStream();
    }

    // Render a rich HTML response (Gemini) directly into the bubble content,
    // bypassing linkify's plain-text escaping. The HTML has already been
    // sanitized by sanitizeHtml() (which permits rich tags) before reaching here.
    function appendAssistantHtml(html) {
      if (!activeAssistantBubble) return;
      _streamIsHtml = true;
      _streamHtml = html || "";
      _scheduleStream();
    }

  // Strip Gemini UI chrome that can leak into the scraped response text
  // (account email, "Google Account", action buttons like promptCopy/promptStop,
  // and the "You stopped this response" notice). Returns cleaned text.
  function sanitizeProviderResponse(text) {
    if (!text) return "";
    var lines = String(text).split(/\r?\n/);
    var NOISE = [
      /you\s*stopped\s*this\s*response/i,
      /google\s*account/i,
      /promptcopy/i,
      /promptstop/i,
      /new\s*chat/i,
      /gemini\s*can\s*make\s*mistakes/i,
      /sign\s*out/i,
      /sign\s*in/i
    ];
    var kept = [];
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (!ln) continue;
      var isNoise = false;
      for (var j = 0; j < NOISE.length; j++) {
        if (NOISE[j].test(ln)) { isNoise = true; break; }
      }
      // Drop a bare email line (account switcher leak)
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ln)) isNoise = true;
      if (!isNoise) kept.push(lines[i]);
    }
    return kept.join("\n").trim();
  }

  function showConfirm(description, action) {
    var bubble = el("div", { className: "lp-jarvis-bubble lp-jarvis-bubble-system" });
    bubble.appendChild(document.createTextNode(description + " "));
    var btn = el("button", { className: "lp-jarvis-confirm", text: "Ya, buat" });
    btn.addEventListener("click", function () {
      bubble.remove();
      runIntent(action);
    });
    bubble.appendChild(btn);
    transcriptEl.appendChild(bubble);
    scrollToBottom();
  }

  function describeAction(intent) {
    switch (intent.type) {
      case "close_all_tabs": return "Tutup SEMUA tab.";
      default: return intent.type;
    }
  }

  // When the user explicitly asks to OPEN a site, ask where to open it —
  // replace the current page (navigate) or a new tab (open_url) — instead of
  // silently choosing. Rendered as an inline choice in the transcript. The
  // command queue is released by the caller (done() already fired) so JARVIS is
  // NOT left "busy" while waiting for the click (which would trip the queue
  // watchdog). The chosen action then runs as its own standalone step.
  function askOpenLocation(target, url) {
    if (!transcriptEl) buildPanel();
    var bubble = el("div", { className: "lp-jarvis-bubble lp-jarvis-bubble-system" });
    bubble.appendChild(document.createTextNode("Buka \"" + target + "\" di mana?"));
    bubble.appendChild(el("div", {
      className: "lp-jarvis-choice-hint",
      text: "Guna ← → untuk pilih, Enter untuk sahkan, Esc untuk batal."
    }));
    var picked = false;
    function pick(fn) {
      if (picked) return;
      picked = true;
      document.removeEventListener("keydown", onKey, true);
      bubble.remove();
      try { fn(); } catch (e) { recordJarvisError("askOpenLocation.pick", e); }
      // Return the cursor to the input so the user can keep typing.
      focusInput();
    }
    var bThis = el("button", { className: "lp-jarvis-confirm", text: "Halaman ini" });
    bThis.addEventListener("click", function () { pick(function () { doNavigate(target); }); });
    var bNew = el("button", { className: "lp-jarvis-confirm", text: "Tab baru" });
    bNew.addEventListener("click", function () { pick(function () { doOpenUrl(target); }); });
    var bCancel = el("button", { className: "lp-jarvis-confirm lp-jarvis-choice-cancel", text: "Batal" });
    bCancel.addEventListener("click", function () { pick(function () { addBubble("jarvis", "Dibatalkan."); }); });
    var buttons = [bThis, bNew, bCancel];
    // Keyboard navigation: arrows move between choices, Enter activates the
    // focused one (native), Esc cancels. Captured so JARVIS's global F6/Enter
    // handlers and the focus keeper don't interfere while choosing.
    function focusAt(i) {
      var n = (i + buttons.length) % buttons.length;
      try { buttons[n].focus(); } catch (e) {}
    }
    function onKey(e) {
      if (picked) return;
      var idx = buttons.indexOf(document.activeElement);
      var k = e.key;
      if (k === "ArrowRight" || k === "ArrowDown" || (k === "Tab" && !e.shiftKey)) {
        e.preventDefault(); e.stopPropagation();
        focusAt((idx < 0 ? 0 : idx) + 1);
      } else if (k === "ArrowLeft" || k === "ArrowUp" || (k === "Tab" && e.shiftKey)) {
        e.preventDefault(); e.stopPropagation();
        focusAt((idx < 0 ? 0 : idx) - 1);
      } else if (k === "Enter" || k === " " || k === "Spacebar") {
        if (idx >= 0) { e.preventDefault(); e.stopPropagation(); buttons[idx].click(); }
      } else if (k === "Escape" || k === "Esc") {
        e.preventDefault(); e.stopPropagation();
        pick(function () { addBubble("jarvis", "Dibatalkan."); });
      }
    }
    document.addEventListener("keydown", onKey, true);
    bubble.appendChild(el("div", { className: "lp-jarvis-choice-row" }, [bThis, bNew, bCancel]));
    transcriptEl.appendChild(bubble);
    scrollToBottom();
    // Stop the focus keeper from pulling the cursor back to the input, then put
    // focus on the first choice so arrow keys/Enter work immediately.
    expectInputFocus = false;
    setTimeout(function () { focusAt(0); }, 0);
  }

  // Smarter "buka/open" handling: decide WHERE to open from the command's own
  // context instead of always asking. Returns "this" (navigate current tab),
  // "new" (open in a new tab) or null (no explicit cue → let the AI brain decide).
  function jarvisOpenCue(text) {
    var lc = String(text || "").toLowerCase();
    // "di page ni" / "kat sini" / "ganti halaman" / "current page" → current tab
    if (/(di|kat|dekat|dalam)\s+(page|halaman|tab)\s+(ni|ini|skrg|sekarang)/.test(lc)) return "this";
    if (/(ganti|tukar|replace)\s+halaman/.test(lc)) return "this";
    if (/(current|this)\s+page/.test(lc)) return "this";
    if (/(^|\s)(sini|kat sini|dekat sini)(\s|$)/.test(lc)) return "this";
    // "tab baru" / "new tab" / "tab lain" → new tab
    if (/(tab\s+(baru|baharu|new|lain)|new\s+tab|dalam\s+tab\s+(baru|baharu|lain))/.test(lc)) return "new";
    return null;
  }
  // Detect a chained command: "buka X dan <aksi>" / "buka X kemudian klik …".
  // The follow-up step must run ON that page, so we route to the planner which
  // returns a [navigate, <aksi>] sequence.
  function jarvisOpenChained(text) {
    return /\bbuka\b[\s\S]*?\b(dan|kemudian|lalu|then|and|lepas|selepas)\b[\s\S]*?\b(klik|isi|fill|tekan|scroll|find|cari|tapis|pilih|submit|hantar|tonton|lihat|main|play|watch|read|baca|select|search|type|open|navigasi|pergi)\b/i.test(text || "");
  }
  // Detect "buka/klik link tu/itu/tersebut" — a reference to the link the
  // assistant just shared. Used to open THAT link via context, not as text.
  function refersToMentionedLink(text) {
    var lc = String(text || "").toLowerCase();
    if (!/\blink\b/i.test(lc)) return false;
    // explicit demonstrative: tu/itu/tersebut/ni/ini/tadi/atas/diberi/berikan
    if (/\b(tu|itu|tersebut|ni|ini|tadi|atas|diberi|berikan)\b/.test(lc)) return true;
    // bare "buka link" / "klik link" (nothing else after) → the shared link
    if (/^\s*(buka|open|klik|click|pergi)\s+link\s*$/i.test(text.trim())) return true;
    return false;
  }

   // AI-type commands worth re-injecting after a reload (copied from the
   // LP Sidebar AI's pending-prompt persistence). Destructive/local commands
   // (save, click, close_tab, …) are intentionally excluded.
   var AI_PENDING_KINDS = { chat: 1, summarize: 1, translate_selection: 1, summarize_selection: 1 };

   // Persist the latest AI command so it survives a reload and re-injects.
   function persistPendingCommand(text) {
     if (window.__jarvisReplaying) return;
     var intent = Core.parseIntent(text);
     if (!AI_PENDING_KINDS[intent.type]) return;
     var tid = window.__jarvisTabId;
     if (tid == null) return;
     try {
       api.storage.local.set({ ["jarvisPendingCmd:" + tid]: { text: text, ts: Date.now() } });
     } catch (e) {}
   }

    // Re-run a persisted AI command — but ONLY when the user actually opens
    // JARVIS. Running it automatically on page load would create a hidden
    // provider (Gemini) iframe in the background that competes with the Local
    // Pocket AI Sidebar's own provider and makes it slow/fail to load.
    function replayPendingCommand() {
      var tid = window.__jarvisTabId;
      if (tid == null) return;
      try {
        api.storage.local.get("jarvisPendingCmd:" + tid, function (res) {
          var c = res && res["jarvisPendingCmd:" + tid];
          if (!c || !c.text) return;
          try { api.storage.local.remove("jarvisPendingCmd:" + tid); } catch (e2) {}
          window.__jarvisReplaying = true;
          if (inputEl) { inputEl.value = c.text; submit(); }
          window.__jarvisReplaying = false;
        });
      } catch (e) {}
    }

    // ----- Input history (↑↓ recall) -----
    // Declared at this (outer) scope so BOTH the in-panel keydown/input
    // handlers (inside buildPanel) and submit() (defined here, outside
    // buildPanel) can read/write it. Was previously declared inside
    // buildPanel, which made recordInputHistory() invisible to submit()
    // and threw "recordInputHistory is not defined" on every send.
    var inputHistory = [];
    var inputHistoryIndex = -1;
    function recordInputHistory(text) {
      if (!text.trim()) return;
      if (inputHistory[inputHistory.length - 1] === text) return;
      inputHistory.push(text);
      if (inputHistory.length > 50) inputHistory.shift();
      inputHistoryIndex = inputHistory.length;
    }

    // Local text normalizer for keyword matching: folds diacritics
    // (e.g. "gámbar" -> "gambar") and lowercases. Declared here because the
    // global `normalize` previously referenced in isVisionRequest was never
    // defined, throwing a ReferenceError that aborted submit() on every send.
    function normalize(s) {
      try {
        return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      } catch (e) {
        return String(s || "").toLowerCase();
      }
    }

    // #3 Vision — kesan arahan "lihat/gambar/imej" supaya JARVIS tangkap
    // skrin tab aktif secara automatik dan lampirkan ke soalan.
    function isVisionRequest(text) {
      var t = normalize(String(text || "")).toLowerCase().trim();
      if (!t) return false;
      var visualWord = /^(gambar|imej|image|foto|photo|screenshot|skrin|capture|carta|chart|graf|graph|jadual|table|rajah|diagram|visual|picture|tangkap|snapshot)$/;
      var fillerWord = /^(ni|tu|ini|itu|saya|aku|kau|awak|anda|nak|mau|mahu|tolong|sila|bagi|please|look|see|tengok|lihat|boleh|buat|satu|yg|yang)$/;
      var tokens = t.split(/\s+/).filter(Boolean);
      // Must contain a visual word, otherwise it's not a vision request.
      if (!tokens.some(function (w) { return visualWord.test(w); })) return false;
      var cue = /(baca|analisis|analyze|ringkas|ringkaskan|terang|jelas|describe|explain|apa|siapa|tengok|lihat|look|read|summar|content|isi|dalam|ni|tu|ini|sekarang|show|tunjuk|huraikan|terangkan)/;
      // Explicit analysis/deictic cue -> capture the CURRENT screen.
      if (cue.test(t)) return true;
      // A bare visual word (or padded only with filler/deictic words like "ni" /
      // "saya nak") means "capture + analyze THIS screen" -> capture.
      // But a SUBJECT after the visual word (e.g. "gambar deddy corbuzier",
      // "gambar kucing", "graf jualan") is an IMAGE SEARCH, not a screen
      // capture, so don't capture — let the planner search instead.
      var content = tokens.filter(function (w) { return !visualWord.test(w) && !fillerWord.test(w); });
      return content.length === 0;
    }

    // Tangkap skrin (captureVisibleTab) lalu sambung ke proses soalan
    // dengan imej tersebut dilampirkan (pendingImage). Amaran dipapar
    // jika provider bukan Gemini (imej mungkin diabaikan oleh composer).
    function captureVisionThen(text) {
      try { hidePanelForCapture(); } catch (e) {}
      api.runtime.sendMessage({ type: "jarvis-capture-screenshot" }).then(function (res) {
        showPanelAfterCapture();
        if (res && res.ok && res.dataUrl) {
          pendingImage = res.dataUrl;
          showPendingImageThumb();
          saveScreenshotToGallery(res.dataUrl);
        }
        if (PROVIDER !== "gemini") {
          try {
            addBubble("system", "⚠️ Penglihatan hanya berfungsi penuh dengan Gemini. Provider '" + PROVIDER + "' mungkin abaikan imej.");
          } catch (e) {}
        }
        // Proses semula — kali ini pendingImage sudah diisi, jadi
        // arahan vision tidak berulang dan imej dihantar ke provider.
        processMessage(text);
      }).catch(function () {
        showPanelAfterCapture();
        processMessage(text);
      });
    }

    function submit() {
      if (!inputEl) return;
      cancelImageAutoSend();
      var text = inputEl.value.trim();
      if (!text) {
        // Empty input but an image is attached (screenshot / file / drag-drop):
        // send the picture together with the previous question (or a neutral
        // caption) so it actually reaches Gemini.  Without this, asking a
        // question first and screenshotting afterwards would never send the image.
        if (pendingImage) {
          text = lastUserText || "Terangkan gambar ini.";
        } else {
          return;
        }
      }
      pendingUserImage = pendingImage || null;
      inputEl.value = "";
      inputEl.style.height = "38px";
      recordInputHistory(text);
      // #3 Vision: auto-capture the visible tab when the user asks JARVIS
      // to look at / analyse an image, screenshot, table or chart on the page.
      if (isVisionRequest(text) && !pendingImage) {
        captureVisionThen(text);
        return;
      }
      processMessage(text);
      persistPendingCommand(text);
    }

    // ── Text susulan beratur (follow-up queue) ──────────────────────────────
    // Semasa JARVIS sedang menjawab, pengguna boleh taip text susulan terus di
    // kotak; text itu disusun (FIFO) ke dalam commandQueue dan akan dihantar
    // secara automatik bila giliran semasa selesai. Butang ■ kekal untuk
    // membatalkan jawapan. Preview sentiasa memaparkan item yang MASIH beratur
    // (termasuk semasa giliran susulan sedang berjalan) kerana sumber tunggal
    // ialah commandQueue — item yang sedang diproses sudah di-shift keluar.
    function queueFollowUp() {
      if (!inputEl) return;
      var text = (inputEl.value || "").trim();
      if (!text) { focusInput(); return; }
      commandQueue.push({ __followup: true, text: text });
      inputEl.value = "";
      inputEl.style.height = "38px";
      recordInputHistory(text);
      renderFollowUps();
      updateCancelButton();
      pumpQueue();
      focusInput();
    }
    // Kumpul entri susulan yang masih beratur dalam commandQueue.
    function collectFollowUps() {
      var items = [];
      for (var i = 0; i < commandQueue.length; i++) {
        var it = commandQueue[i];
        if (it && typeof it === "object" && it.__followup) items.push({ queueIndex: i, text: it.text });
      }
      return items;
    }
    function renderFollowUpPreview() {
      if (!followUpPreview) return;
      followUpPreview.innerHTML = "";
      var items = collectFollowUps();
      if (!items.length) {
        followUpPreview.classList.remove("lp-jarvis-followup-show");
        return;
      }
      var head = el("div", {
        className: "lp-jarvis-followup-head",
        text: "📨 Akan dihantar bila selesai (" + items.length + "):"
      });
      followUpPreview.appendChild(head);
      items.forEach(function (it, displayIdx) {
        var idx = el("span", { className: "lp-jarvis-followup-idx", text: (displayIdx + 1) + "." });
        var txt = el("span", { className: "lp-jarvis-followup-text", text: it.text });
        var x = el("button", { className: "lp-jarvis-followup-x", title: "Buang dari barisan", text: "✕" });
        x.addEventListener("click", function () {
          commandQueue.splice(it.queueIndex, 1);
          renderFollowUps();
          updateCancelButton();
          focusInput();
        });
        var row = el("div", { className: "lp-jarvis-followup-item" }, [idx, txt, x]);
        followUpPreview.appendChild(row);
      });
      followUpPreview.classList.add("lp-jarvis-followup-show");
    }
    // Satu bubble "status barisan" di dalam transcript supaya susulan yang
    // beratur nampak jelas (bukan sahaja di kotak input). Ia dikemas kini setiap
    // kali item diqueue / selesai, jadi pengguna nampak kemajuan (progress).
    var queueStatusBubble = null;
    function renderFollowUpTranscript() {
      if (!transcriptEl) return;
      var items = collectFollowUps();
      if (!items.length) {
        if (queueStatusBubble && queueStatusBubble.parentNode) {
          try { queueStatusBubble.parentNode.removeChild(queueStatusBubble); } catch (e) {}
        }
        queueStatusBubble = null;
        return;
      }
      if (!queueStatusBubble) {
        try { queueStatusBubble = addBubble("system", ""); } catch (e) { return; }
        if (queueStatusBubble) queueStatusBubble.classList.add("lp-jarvis-queue-status");
      }
      var lines = ["⏳ " + items.length + " susulan beratur (menunggu giliran selesai):"];
      for (var i = 0; i < items.length; i++) {
        var t = String(items[i].text || "");
        if (t.length > 70) t = t.slice(0, 67) + "…";
        lines.push((i + 1) + ". " + t);
      }
      setBubbleText(queueStatusBubble, lines.join("\n"));
    }
    // Papar SEKALIGUS preview dalam kotak dan status barisan dalam transcript.
    function renderFollowUps() {
      try { renderFollowUpPreview(); } catch (e) {}
      try { renderFollowUpTranscript(); } catch (e) {}
    }

  /* ---------- Routing ---------- */

  function genToken() {
    return "j" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function str(v) { return v == null ? "" : String(v).trim(); }
  function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }

  /** Extract the first JSON object from arbitrary text. */
  function extractJson(text) {
    if (!text) return null;
    // 1) Whole thing is JSON already.
    try { return JSON.parse(text.trim()); } catch (err) {}
    // 2) Strip ```json fences anywhere, then try.
    var fenced = text.replace(/```(?:json)?/gi, "").trim();
    try { return JSON.parse(fenced); } catch (err) {}
    // 3) First { ... last }.
    var s = text.indexOf("{");
    var e = text.lastIndexOf("}");
    if (s !== -1 && e !== -1 && e > s) {
      var raw = text.slice(s, e + 1).trim();
      try { return JSON.parse(raw); } catch (err) {}
      // 4) Tolerate a trailing comma before the closing brace.
      try { return JSON.parse(raw.replace(/,(\s*[\]}])/g, "$1")); } catch (err2) {}
    }
    return null;
  }

  /**
   * Every command is first sent to Gemini (the "brain") which returns a JSON
   * action object. JARVIS then executes that action. This makes command
   * understanding robust to phrasing (e.g. "buka setting" vs "open settings").
   * The regex parser remains as a fallback if planning fails.
   */
   // Serial command queue: the provider ("brain") only supports ONE in-flight
   // prompt at a time, and JARVIS uses single shared state (token/planner/
   // assistant bubble). Issuing commands in quick succession used to clobber
   // that state and leave later answers empty. We process one command at a time
   // and only start the next once the current one has fully completed.
    var commandQueue = [];
    var jarvisBusy = false;
    var lastProcessedText = "";
    var lastProcessedTime = 0;
    function processMessage(text) {
      if (!Core) {
        addBubble("jarvis", "Teras JARVIS tidak dimuat.");
        return;
      }
      // Dedup: jangan process teks yang sama dalam 3 saat — elak hantar
      // dua kali bila kedua-dua floating button dan sidebar hantar serentak.
      if (text === lastProcessedText && Date.now() - lastProcessedTime < 3000) {
        return;
      }
      lastProcessedText = text || "";
      lastProcessedTime = Date.now();
      // #4 Sahkan "tutup semua tab lain" (close-others) bila pengguna jawab "ya".
      if (pendingCloseOthers) {
        pendingCloseOthers = false;
        var lc = (text || "").toLowerCase();
        if (/\b(ya|yes|sahkan|confirm|ok|betul|push)\b/.test(lc)) {
          try {
            api.runtime.sendMessage({ type: "jarvis-crosstab-command", action: "close-others", tabId: currentTabId })
              .then(function (res) {
                if (res && res.ok) addBubble("jarvis", "Tutup " + (res.closed || 0) + " tab lain.");
                else addBubble("jarvis", "Gagal tutup tab lain.");
              }).catch(function () { addBubble("jarvis", "Gagal tutup tab lain (sambungan)."); });
          } catch (e) { addBubble("jarvis", "Gagal tutup tab lain."); }
          return;
        }
        addBubble("jarvis", "Dibatalkan. Tiada tab ditutup.");
        return;
      }
      // #4 Sahkan "tutup tab N" (close-tab) bila pengguna jawab "ya".
      if (pendingCloseTab != null) {
        var n = pendingCloseTab;
        pendingCloseTab = null;
        var lc2 = (text || "").toLowerCase();
        if (/\b(ya|yes|sahkan|confirm|ok|betul|push)\b/.test(lc2)) {
          try {
            api.runtime.sendMessage({ type: "jarvis-crosstab-command", action: "close-tab", ordinals: [n] })
              .then(function (res) {
                if (res && res.ok) addBubble("jarvis", "Tutup " + (res.closed || 0) + " tab.");
                else addBubble("jarvis", "Gagal tutup tab.");
              }).catch(function () { addBubble("jarvis", "Gagal tutup tab (sambungan)."); });
          } catch (e) { addBubble("jarvis", "Gagal tutup tab."); }
          return;
        }
        addBubble("jarvis", "Dibatalkan. Tiada tab ditutup.");
        return;
      }
      // #5.3 — kalau makro //auto baru disimpan, layan input sebagai edit
      // (namakan / jadual) terus pada makro tersebut.
      if (lastAutoMacro && isAutoEditCommand(String(text || ""))) {
        handleAutoEdit(String(text || ""));
        return;
      }
      commandQueue.push(text);
      pumpQueue();
    }
    // Macro-run progress indicator: a single system bubble that updates as each
    // command in the macro chain finishes, so the user always knows which macro
    // is running and how far along it is.
    var macroStatus = null; // { name, total, done, bubble }
    function startMacroStatus(name, total) {
      try {
        macroStatus = { name: name, total: total, done: 0, bubble: null };
        macroStatus.bubble = addBubble("system", "⚡ Makro \"" + name + "\": 0/" + total + " selesai…");
      } catch (e) {}
    }
    function bumpMacroStatus(meta) {
      try {
        if (!macroStatus || macroStatus.name !== meta.__macro) {
          macroStatus = { name: meta.__macro, total: 0, done: 0, bubble: addBubble("system", "") };
        }
        macroStatus.done += 1;
        if (macroStatus.bubble) {
          setBubbleText(macroStatus.bubble, "⚡ Makro \"" + macroStatus.name + "\": " + macroStatus.done + "/" + macroStatus.total + " selesai…");
        }
      } catch (e) {}
    }
    function finalizeMacroStatus() {
      try {
        if (!macroStatus) return;
        if (macroStatus.bubble) {
          setBubbleText(macroStatus.bubble, "✅ Makro \"" + macroStatus.name + "\" selesai (" + macroStatus.done + "/" + macroStatus.total + ").");
        }
      } catch (e) {}
      macroStatus = null;
    }

    // Queue busy-deadlock watchdog: if `done()` is never fired (e.g. a provider
    // round-trip stalls with no terminal signal), `jarvisBusy` would stay `true`
    // forever and block every future command. If the queue stays busy too long
    // without progress, force a graceful reset so JARVIS stays usable.
    var QUEUE_WATCHDOG_MS = RESPONSE_TIMEOUT_MS + 15000;
    var queueWatchdogTimer = null;
    function armQueueWatchdog() {
      if (queueWatchdogTimer) clearTimeout(queueWatchdogTimer);
      queueWatchdogTimer = setTimeout(function () {
        queueWatchdogTimer = null;
        if (!jarvisBusy) return;
        jarvisBusy = false;
        if (activeAssistantBubble) {
          var t = getBubbleText(activeAssistantBubble).replace(/^…$/, "").trim();
          setBubbleText(activeAssistantBubble, (t ? t + "\n\n" : "") + "(Dibatalkan: tiada tindak balas — JARVIS ditetapkan semula.)");
          recordTurn("jarvis", getBubbleText(activeAssistantBubble));
          activeAssistantBubble = null;
        }
        if (planningBubble) { setBubbleText(planningBubble, "Perancangan dibatalkan (tiada tindak balas)."); planningBubble = null; }
        clearPlannerWatchdog();
        clearResponseWatchdog();
        planningMode = false;
        currentToken = "";
        var d = activeDone; activeDone = null;
        updateCancelButton();
        if (d) d(); else pumpQueue();
      }, QUEUE_WATCHDOG_MS);
    }
    function clearQueueWatchdog() {
      if (queueWatchdogTimer) { clearTimeout(queueWatchdogTimer); queueWatchdogTimer = null; }
    }

    function pumpQueue() {
      if (jarvisBusy) return;
      if (!commandQueue.length) { finalizeMacroStatus(); clearQueueWatchdog(); return; }
      jarvisBusy = true;
      activeDone = null;
      var item = commandQueue.shift();
      var meta = (item && typeof item === "object" && (item.__macro || item.__followup)) ? item : null;
      var text = meta ? meta.text : item;
      // Idempotent finalizer: guarantees the queue always advances even if a
      // step throws, so a single error can never permanently deadlock JARVIS.
      var finished = false;
      var done = function () {
        if (finished) return;
        finished = true;
        jarvisBusy = false;
        activeDone = null;
        clearQueueWatchdog();
        updateCancelButton();
        // Papar semula preview susulan — item yang baru selesai sudah di-shift
        // keluar, jadi yang tinggal ialah yang masih beratur (jika ada).
        renderFollowUps();
        if (meta && meta.__macro) bumpMacroStatus(meta);
        pumpQueue();
      };
      activeDone = done;
      updateCancelButton();
      armQueueWatchdog();
      try {
        if (SIDEBAR_HOST) {
          // Pull a fresh active-tab observation so chat/summarize context and
          // runSinglePlan's ctx are current before this command runs.
          refreshHostObservation().then(function () {
            try { processOne(text, done); }
            catch (e2) { recordJarvisError("processOne", e2); done(); }
          });
        } else {
          processOne(text, done);
        }
      } catch (e) {
        recordJarvisError("processOne", e);
        done();
      }
    }
   // ── Slash Commands ───────────────────────────────────────────────────────
   var SLASH_COMMANDS = {
     "/help":     { desc: "Papar senarai kebolehan JARVIS" },
     "/clear":    { desc: "Padam sejarah perbualan" },
     "/save":     { desc: "Simpan halaman semasa" },
     "/sum":      { desc: "Ringkaskan halaman semasa" },
     "/export":   { desc: "Eksport perbualan sebagai markdown" },
     "/memory":   { desc: "Papar status ingatan JARVIS" },
     "/theme":    { desc: "Tukar tema (light/dark)" },
     "/session":  { desc: "Buka pengurusan session" },
     "/macro":    { desc: "Senarai makro tersimpan" },
     "/diagnose": { desc: "Jalankan diagnostik JARVIS" }
    };
    // Alias tapak TERKENAL: "/youtube", "/google", "/github", … buka URL
    // terus tanpa AI/perancang. Tambah mana-mana domain yang sudah etablis.
    var SITE_ALIASES = {
      "/youtube":   "https://www.youtube.com",
      "/google":    "https://www.google.com",
      "/gmail":     "https://mail.google.com",
      "/github":    "https://www.github.com",
      "/twitter":   "https://twitter.com",
      "/x":         "https://x.com",
      "/facebook":  "https://www.facebook.com",
      "/reddit":    "https://www.reddit.com",
      "/wikipedia": "https://www.wikipedia.org",
      "/amazon":    "https://www.amazon.com",
      "/netflix":   "https://www.netflix.com",
      "/chatgpt":   "https://chat.openai.com",
      "/gemini":    "https://gemini.google.com/app",
      "/claude":    "https://claude.ai",
      "/perplexity":"https://www.perplexity.ai",
      "/bing":      "https://www.bing.com",
      "/duckduckgo":"https://duckduckgo.com",
      "/stackoverflow": "https://stackoverflow.com",
      "/linkedin":  "https://www.linkedin.com",
      "/instagram": "https://www.instagram.com",
      "/tiktok":    "https://www.tiktok.com",
      "/maps":      "https://maps.google.com",
      "/translate": "https://translate.google.com",
      "/news":      "https://news.google.com",
      "/yahoo":     "https://www.yahoo.com"
    };
    // Pemetaan kata tunggal (tanpa "/") untuk "buka <site>" tanpa .com.
    // DIPAKAI HANYA untuk tapak dikenali — JANGAN teka .com secara umum
    // (elak "buka cerita" terbuka cerita.com). "buka github" -> github.com.
    var BARE_SITE_ALIASES = {
      github: "github.com", gmail: "mail.google.com", google: "google.com",
      facebook: "facebook.com", fb: "facebook.com", twitter: "twitter.com",
      x: "x.com", reddit: "reddit.com", wikipedia: "wikipedia.org",
      amazon: "amazon.com", netflix: "netflix.com", chatgpt: "chat.openai.com",
      claude: "claude.ai", perplexity: "perplexity.ai", bing: "bing.com",
      duckduckgo: "duckduckgo.com", stackoverflow: "stackoverflow.com",
      linkedin: "linkedin.com", instagram: "instagram.com", tiktok: "tiktok.com",
      youtube: "youtube.com", yahoo: "yahoo.com", maps: "maps.google.com"
    };
    function resolveBareSite(word) {
      var w = String(word || "").toLowerCase().trim().replace(/^(buka|open|pergi|gi)\s+/i, "").replace(/^www\./, "");
      if (!w || /\s/.test(w)) return null;
      if (BARE_SITE_ALIASES[w]) return "https://" + BARE_SITE_ALIASES[w];
      return null;
    }
    // Kata arahan "buka" (dengan "/"): "/buka youtube", "/open google", …
    // buka alias tapak terus tanpa URL. Nama tapak di belakang di padankan
    // dengan SITE_ALIASES.
    var OPEN_VERBS = { "/buka": 1, "/open": 1, "/pergi": 1, "/navigate": 1, "/gi": 1 };
    function handleSlashCommand(text, done) {
      if (typeof text !== "string") return false;
      var _raw = String(text).trim();
      if (!_raw) return false;
      var parts = _raw.split(/\s+/);
      // Terima dengan ATAU tanpa "/" — shortcut kini dicetuskan tanpa slash.
      var _first = parts[0];
      var cmd = _first.charAt(0) === "/" ? _first.toLowerCase() : "/" + _first.toLowerCase();
     addUserBubble(text);
     switch (cmd) {
       case "/help":      showCapabilities(); done(); return true;
       case "/clear":     clearHistory(); done(); return true;
       case "/save":      addBubble("jarvis", "Taip \"simpan halaman ini\" untuk menyimpan halaman semasa."); done(); return true;
       case "/sum":       addBubble("jarvis", "Taip \"ringkaskan\" untuk meringkaskan halaman semasa."); done(); return true;
       case "/export":    addBubble("jarvis", "Taip \"simpan perbualan\" untuk mengeksport perbualan."); done(); return true;
       case "/memory":    addBubble("jarvis", "Gunakan panel Tetapan JARVIS untuk melihat/mengurus ingatan."); done(); return true;
       case "/theme":     cycleJarvisTheme ? (cycleJarvisTheme(), done()) : (addBubble("jarvis", "Tukar tema dalam panel Tetapan."), done()); return true;
       case "/session":   openSessionManager ? (openSessionManager(), done()) : (addBubble("jarvis", "Gunakan panel Session untuk mengurus sesi."), done()); return true;
       case "/macro":     doListMacros(); done(); return true;
       case "/diagnose":  runSelfCheck(done); return true;
       default:
         var suggestions = Object.keys(SLASH_COMMANDS)
           .filter(function(k) { return k !== cmd; })
           .slice(0, 5)
           .map(function(k) { return k + " — " + SLASH_COMMANDS[k].desc; })
           .join("\n");
         addBubble("system", "Arahan \"" + cmd + "\" tidak dikenali. Arahan slash yang ada:\n" + suggestions);
         done();
         return true;
     }
   }
   function processOne(text, done) {
      // Explicit memory export/import (works fully offline, no AI needed).
     var mc = Core.parseMemoryCommand(text);
     if (mc === "export") { addUserBubble(text); exportMemory(); return done(); }
     if (mc === "import") { addUserBubble(text); importMemoryViaPicker(); return done(); }
     // Conversation snapshots (HistorySnapshot) — fully offline.
     var lowerCmd = String(text || "").toLowerCase().trim();
     if (/^(simpan|save)\s+perbualan|^save\s+conversation/.test(lowerCmd)) {
       addUserBubble(text); doSaveConversation(); return done();
     }
     if (/^(senarai|list)\s+perbualan|^list\s+conversations/.test(lowerCmd)) {
       addUserBubble(text); listConversations(); return done();
     }
     // Command-macro management (save/delete/list) — fully offline.
     var mgmt = parseMacroCommand(text);
     if (mgmt) {
       addUserBubble(text);
       if (mgmt.op === "save") doSaveMacro(mgmt.name, mgmt.commands);
       else if (mgmt.op === "delete") doDeleteMacro(mgmt.name);
       else doListMacros();
           return done();
         }
         // //cari -> buka editor ayat carian.
         if (/^\/\/cari\s*$/i.test(String(text || "").trim())) {
           addUserBubble(text);
           openCariSuffixEditor();
           return done();
         }
          // /cari (atau "cari" sahaja, tiada topik) -> buat carian (gambar disertakan jika ada).
          if (/^\/?cari\s*$/i.test(String(text || "").trim())) {
            cariKeGemini("cari", done);
            return;
          }
          // #5 Automation: //auto <description> — cipta makro terus dari chat.
          // PERLU didahulukan sebelum slash-strip di bawah (yang buang "//").
          var autoMatch = String(text || "").match(/^\/\/auto(?:mation)?\b\s*([\s\S]*)$/i);
          if (autoMatch) {
            addUserBubble(text);
            createAutomationFromChat(autoMatch[1] || "");
            return done();
          }
          // //gambar -> buka galeri screenshot JARVIS (disimpan kekal dlm IndexedDB).
          if (/^\/\/gambar\b/i.test(String(text || "").trim())) {
            addUserBubble(text);
            openGalleryOverlay();
            return done();
          }
          // ── Slash = input bebas; tanpa slash = arahan eksplisit ──
        // PERATURAN BARU: apa-apa yang MULA dengan "/" ialah INPUT BEBAS
        // (chat pendek tanpa konteks halaman). Tanggalkan slash dan biar
        // parseIntent tentukan — kalau soalan biasa, hantar ke AI pendek
        // tanpa konteks; kalau arahan, guna perancang penuh.
        // Input TANPA "/" pula dianggap ARAHAN EKSPLISIT (isExplicitCommand),
        // masuk perancang penuh dengan konteks halaman. Shortcut terbina
        // (SLASH_COMMANDS) & alias tapak (SITE_ALIASES) kini dicetuskan
        // TANPA "/" (cth. "help", "youtube", "buka youtube").
        var isExplicitCommand = false;
        if (typeof text === "string" && text.charAt(0) === "/") {
          // "/" = input bebas: buang slash, layan sebagai soalan biasa di bawah.
          text = text.replace(/^\/+/, "").trim();
        } else {
          // tanpa "/" = arahan eksplisit. Tangani shortcut terbina & alias
          // tapak (kini tanpa slash), selebihnya terus ke perancang penuh.
          var _cmdToken = text.split(/\s+/)[0].toLowerCase();
          var _cmdKey = _cmdToken.charAt(0) === "/" ? _cmdToken : "/" + _cmdToken;
          if (SLASH_COMMANDS[_cmdKey]) {
            if (handleSlashCommand(text, done)) return;
          } else if (SITE_ALIASES[_cmdKey]) {
            // Tapak etablis: buka URL terus tanpa AI/perancang.
            addUserBubble(text);
            doOpenUrl(SITE_ALIASES[_cmdKey]);
            return done();
          } else if (OPEN_VERBS[_cmdKey]) {
            // "buka youtube", "open google", … -> buka alias terus.
            var _rest = text.slice(_cmdToken.length).trim().toLowerCase().replace(/^\/+/, "");
            var _aliasKey = "/" + _rest.split(/\s+/)[0];
            if (SITE_ALIASES[_aliasKey]) {
              addUserBubble(text);
              if (jarvisOpenCue(text) === "this") doNavigate(SITE_ALIASES[_aliasKey]);
              else doOpenUrl(SITE_ALIASES[_aliasKey]);
              return done();
            }
            // Bukan alias dikenali: layan sebagai arahan eksplisit biasa.
            isExplicitCommand = true;
          } else {
            isExplicitCommand = true;
          }
        }
         var pre = Core.parseIntent(text);
        // Soalan biasa (awalan "/" atau input bebas): hantar TERUS ke AI sebagai
        // chat PENDEK — TANPA konteks halaman / snapshot DOM / sejarah panjang.
        // Arahan eksplisit (tanpa "/") terus guna perancang penuh di bawah.
        // Ringkasan kekal arahan, jadi konteksnya tidak terjejas.
         if (!isExplicitCommand && (pre.type === "chat" || pre.type === "unknown")) {
           addUserBubble(text);
           // Soalan yang merujuk SIMPANAN LINK perlukan konteks simpanan
           // (tajuk/URL) — guna askSavedLinks. Soalan yang merujuk halaman
           // SEMASA perlukan konteks halaman — guna doChat. Lain-lain dihantar
           // pendek tanpa konteks.
           if (/(simpanan|perpustakaan|link\s+(saya|tersimpan|disimpan|simpan)|artikel\s+(saya|tersimpan|disimpan)|yang\s+saya\s+save|saved\s+items|my\s+library)/i.test(text)) {
             askSavedLinks(text, done);
           } else if (/(halaman|laman|page)\s+(ini|semasa|skrg|sekarang)|this\s+page|dalam\s+halaman|hal\s+ini|perkara\s+utama\s+dalam/i.test(text)) {
             doChat(text, done);
           } else {
             sendPlainChat(text, done);
           }
           return;
         }
          // ── SEMUA perintah "cari" → hantar TERUS ke Gemini dalam panel JARVIS.
          //    Tiada carian dalam halaman, tiada panel pilihan enjin / lokasi.
          //    "cari" SAHAJA (tiada topik) + gambar → hantar gambar ke Gemini. ──
          if (pre.type === "search" || /^\s*cari\s*$/i.test(text)) {
            cariKeGemini(text, done);
            return;
          }
         // ── Conflict Resolution Mode ──
        var ctx = Core.extractPageContext();
        var conflicts = Core.detectConflicts(text, pre, ctx);
        if (conflicts && conflicts.length) {
          addUserBubble(text);
          renderConflictUI(conflicts, function (chosenAlt) {
            if (chosenAlt.customText) { processMessage(chosenAlt.customText); return done(); }
            addBubble("system", "✅ Pilihan: " + chosenAlt.label);
            resolveConflict(chosenAlt, text);
            done();
          });
          return;
        }
        // ── Kategori: soalan & reklasifikasi (pelan kategori, item 4) ──
        if (pre.type === "category_query") { addUserBubble(text); askCategoryQuestion(text, done); return; }
        if (pre.type === "reclassify_category") { addUserBubble(text); reclassifyCategory(text, done); return; }
        // #4 Cross-tab Context Awareness: senarai / huraikan / bandingkan / tutup
        // tab lain dikendalikan secara setempat (tanpa planner AI).
        if (pre.type === "crosstab") { addUserBubble(text); handleCrossTab(pre); return done(); }

        // ── Local sahaja (browser + addon, NO Gemini) ──
        if (pre.type === "help") { addUserBubble(text); showCapabilities(); return done(); }
        if (pre.type === "self_check") { addUserBubble(text); runSelfCheck(done); return; }
        if (pre.type === "export_diagnostic") { addUserBubble(text); exportDiagnostic(done); return; }
        if (pre.type === "search" && (pre.mode === "library" || pre.mode === "web")) {
          addUserBubble(text);
          if (pre.mode === "library") doLibrarySearch(pre.query);
          if (pre.mode === "web") sendWebSearch(pre.query);
          return done();
        }
        if (pre.type === "search" && (pre.ambiguous || pre.mode === "youtube")) {
          cariAskAI(text, pre, done);
          return;
        }
        if (pre.type === "open_url" && /\b(buka|open)\b/i.test(text)) {
          var openTargetUrl = Core.toUrl(pre.target);
          if (!openTargetUrl) openTargetUrl = resolveBareSite(pre.target);
          if (openTargetUrl) {
            addUserBubble(text);
            var cue = jarvisOpenCue(text);
            if (cue === "this") { doNavigate(pre.target); return done(); }
            if (cue === "new") { doOpenUrl(pre.target); return done(); }
            if (refersToMentionedLink(text) && lastMentionedLink) { doOpenUrl(lastMentionedLink); return done(); }
            doOpenUrl(pre.target);
            return done();
          }
          // Bare word — hantar ke Gemini untuk interpretasi
          cariAskAI(text, pre, done);
          return;
        }
        var LOCAL_INTENTS = {
          save: 1, save_answer_note: 1, toggle_pomodoro: 1, open_settings: 1,
          toggle_notes: 1, toggle_ai_overlay: 1, open_sidebar: 1, open_library: 1,
          open_category: 1, copy_answer: 1, copy_url: 1, copy_markdown: 1,
          print_page: 1, duplicate_tab: 1, close_tab: 1, close_all_tabs: 1,
          new_tab: 1, reload: 1, back: 1, forward: 1, bookmark: 1, zoom: 1,
          click_first_link: 1, scroll: 1, click: 1, fill: 1,
          snapshot: 1
        };
        if (LOCAL_INTENTS[pre.type]) {
          addUserBubble(text);
          runIntent(pre);
          return done();
        }
        // ── Macro / learned commands (lokal, offline) ──
        var macroMatch = matchMacro(text);
        if (macroMatch) { addUserBubble(text); enqueueMacro(macroMatch.name, macroMatch.commands); return done(); }
        var cached = recallCommand(text);
        if (cached && cached.plan) {
          addUserBubble(text); bumpLearnedHit(cached);
          addBubble("system", "⚡ (dari ingatan JARVIS)");
          runPlanSequential(cached.plan, 0, text, 0, done);
          return;
        }
        // ── Gemini (AI brain) — semua yang lain ──
        addUserBubble(text);
        planWithGemini(text, done);
    }

   // Generic planner round-trip: send `prompt` to the AI provider ("brain") and
   // deliver the parsed plan array to `onPlan(planOrNull)`. Used both for the
   // initial plan and for the ReAct self-correction loop. A single outstanding
   // plan is supported at a time (the ReAct loop is sequential).
   var pendingPlanHandler = null;
   function requestPlan(prompt, onPlan) {
     var token = genToken();
     currentToken = token;
      planningMode = true;
      planAcc = "";
      planningBubble = addPlaceholderBubble();
      ensureProviderIframe();
      focusInput();
      armPlannerWatchdog();
       pendingPlanHandler = function (plan) { if (onPlan) onPlan(plan); };
       pendingPlanOnComplete = onPlan || null;
      api.runtime.sendMessage({
       type: "open-ai-sidebar-with-prompt",
       prompt: prompt,
       provider: PROVIDER,
       overlayToken: token,
       fromOverlay: true
     }).then(function (res) {
        if (!res || !res.ok) {
          planningMode = false;
          if (planningBubble) { setBubbleText(planningBubble, "Tak dapat hubungi " + PROVIDER + " untuk merancang. Cuba arahan setempat atau semak sambungan."); planningBubble = null; }
          var h = pendingPlanHandler; pendingPlanHandler = null;
          if (h) h(null);
        }
      }).catch(function () {
        planningMode = false;
        if (planningBubble) { setBubbleText(planningBubble, "Ralat merancang (mungkin offline). Arahan setempat masih cuba dijalankan."); planningBubble = null; }
       var h = pendingPlanHandler; pendingPlanHandler = null;
       if (h) h(null);
     });
   }

    function planWithGemini(text, onComplete) {
      lastUserText = text;
      var onPlan = function (plan) {
        try {
          if (!plan) {
            runIntent(Core.parseIntent(lastUserText));
            if (onComplete) onComplete();
            return;
          }
          // Auto-learn: remember how Gemini resolved this command so future runs
          // can skip the planner (fast + offline) and improve over time.
          learnCommand(lastUserText, plan, siteHost());
          runPlanSequential(plan, 0, lastUserText, 0, onComplete);
        } catch (e) {
          recordJarvisError("planWithGemini.onPlan", e);
          if (onComplete) onComplete();
        }
      };
      if (SIDEBAR_HOST) {
        // The plan prompt embeds a live DOM snapshot, so build it on the active
        // tab (where the real page DOM is) and send the finished prompt.
        hostRelay({ type: "jarvis-host-build-plan-prompt", command: text, history: history }).then(function (res) {
          var prompt = (res && res.prompt)
            ? res.prompt
            : Core.buildPlanPrompt(text, Core.extractPageContext(), history, TOOLS, elementHintsForSite(siteHost()));
          requestPlan(prompt, onPlan);
        });
        return;
      }
      var ctx = Core.extractPageContext();
      var prompt = Core.buildPlanPrompt(text, ctx, history, TOOLS, elementHintsForSite(siteHost()));
      requestPlan(prompt, onPlan);
    }

   // JARVIS development context surfaced to the self-diagnostic "brain" so it can
   // assess what has been built and suggest a sensible roadmap.
   var JARVIS_VERSION = (api.runtime && api.runtime.getManifest && api.runtime.getManifest().version) || "?";
    var JARVIS_CHANGELOG = [
      "v2.6.2 — Panel overlay JARVIS (chat) dengan queue arahan serial + callback selesai (done) supaya arahan tak bertindih.",
     "Fungsi 'semak diri' — JARVIS audit state sendiri (queue, errors, memory, history) guna AI sebagai otak diagnostik.",
     "Jawapan panel boleh klik — URL & markdown [label](url) di-linkify (selamat, XSS-escaped).",
     "Pembelajaran arahan auto + normalisasi frasa ('d'->'di', 'ni'->'ini') supaya varian loghat digabung.",
     "Scraper respons lebih robus — tak finalize awal pada status sementara ('Searching the web') atau pause menjana.",
      "Self-clean: duplikat learned-command digabung on load; sejarah dipangkas ke 15 pusingan.",
      "elementMemory di-auto-isi dari elemen interaktif halaman (index selari resolveByIndex) supaya 'klik butang <X>' selesai ikut teks; hint dibuang & dirakam semula setiap navigasi (tiada elemen usang).",
      "Tombol hantar bertukar jadi 'batal' (■) semasa arahan diproses — klik untuk hentikan generasi/perancangan JARVIS serta-merta.",
      "Setiap jawapan JARVIS ada butang salin (📋, muncul bila hover) — klik untuk salin teks jawapan ke clipboard.",
      "'Semak diri' kini juga minta otak (Gemini) cadangkan 3-5 ciri BARU yang konkrit & berasaskan codeMap/capabilities untuk tambah fungsi JARVIS.",
      "SmartElementNavigator — klik/isi ikut teks diselesaikan via pemetaan indeks elementHints tanpa pusingan planner.",
      "HistorySnapshot — 'simpan perbualan' snapshot perbualan ke storage.local (+ muat turun JSON); 'senarai perbualan' papar.",
      "QuickCommandMacro — 'simpan makro <nama>: c1; c2' cipta rantaian arahan; 'jalankan makro <nama>' / sebut terus nama jalankan melalui queue.",
       "Semak diri dipertingkat: audit MENYELURUH 10 aspek (ralat, resilien, keselamatan, prestasi, UI/UX, architektur, integrasi, i18n, UX flow) + cadangan upgrade dari setiap aspek; kecuali API luaran & MV3.",
       "Peneguhan traversal DOM (collectInteractiveNodes per-node try/catch) — satu nod cross-origin tak lagi potong peta elemen; normalisasi dialek ('x'->'tidak','jgk'->'juga','skali'->'sekali','tlg'->'tolong'); butang salin 📋 sentiasa nampak (0.4) + tombol batal (■) jingga berkelip bila tersekat >5s."
     ];

    // Gather a snapshot of JARVIS's own UI/UX state so the diagnostic can audit
    // the panel itself (visibility, position, styling, overflow, elements).
    function collectJarvisUIState() {
      var ui = {};
      try {
        ui.open = !!open;
        ui.pinned = !!pinned;
        ui.panelPresent = !!root;
        ui.inputPresent = !!inputEl;
        ui.transcriptPresent = !!transcriptEl;
        if (root) {
          var r = root.getBoundingClientRect();
          ui.rect = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
          ui.inViewport = r.width > 0 && r.height > 0 &&
            r.left >= -1 && r.top >= -1 &&
            r.right <= (window.innerWidth + 1) && r.bottom <= (window.innerHeight + 1);
          ui.overflowX = r.right > window.innerWidth + 1;
          ui.overflowY = r.bottom > window.innerHeight + 1;
        }
        // Is our stylesheet actually applied?
        ui.cssLoaded = false;
        try {
          var sheets = document.styleSheets || [];
          for (var i = 0; i < sheets.length; i++) {
            var h = sheets[i] && sheets[i].href;
            if (h && /jarvisOverlay\.css/.test(h)) { ui.cssLoaded = true; break; }
          }
        } catch (e) {}
        if (transcriptEl) {
          ui.bubbleCount = transcriptEl.childElementCount;
          ui.transcriptScrollable = transcriptEl.scrollHeight > transcriptEl.clientHeight + 2;
        }
        ui.viewport = { w: window.innerWidth, h: window.innerHeight };
        ui.devicePixelRatio = window.devicePixelRatio || 1;
      } catch (e) {
        recordJarvisError("collectJarvisUIState", e);
      }
      return ui;
    }

    // Gather a snapshot of JARVIS's own internal state so Gemini can audit it.
    function collectJarvisDiagnostics() {
     var diag = {};
     try {
        diag.provider = PROVIDER;
        diag.arch = SIDEBAR_HOST ? "sidebar-host" : "overlay";
        diag.sidebarHost = {
          SIDEBAR_HOST: !!SIDEBAR_HOST,
          hostHost: (typeof hostHost === "string") ? hostHost : "",
          hasHostCtx: !!(hostCtx && (hostCtx.title || hostCtx.url)),
          hostSelectionLen: (hostSelection || "").length
        };
        try { if (SIDEBAR_HOST && window.location) diag.sidebarHost.panelUrl = String(window.location.href); } catch (e) {}
        diag.overlaySuspended = !!jarvisSuspended;
        diag.open = !!open;
       diag.learnedCommands = (learnedCommands || []).length;
       diag.learnedSample = (learnedCommands || []).slice(-5).map(function (c) {
         return { phrase: c.phrase, hits: c.hits, site: c.site };
       });
       var sites = 0, elems = 0;
       var em = elementMemory || {};
       Object.keys(em).forEach(function (k) { sites++; var m = em[k] || {}; elems += Object.keys(m).length; });
       diag.elementMemorySites = sites;
       diag.elementMemoryCount = elems;
        diag.historyTurns = (history || []).length;
        // A provider request is "in flight" only while planning or a chat bubble
        // is open (the response/planner watchdogs are armed in those states).
        var awaitingProvider = !!(planningMode || activeAssistantBubble || responseWatchdogTimer || plannerWatchdogTimer);
        diag.queue = { pending: commandQueue.length, busy: !!jarvisBusy, awaitingProvider: awaitingProvider };
        // Help the diagnostic "brain" avoid misreading a TRANSIENT busy state as a
        // deadlock: busy:true with pending:0 is normal while a command is actively
        // executing (including waiting for the AI provider or running synchronous
        // local steps). It is only a real hang if busy:true AND awaitingProvider:false
        // AND recent errors exist.
        diag.busyInterpretation = jarvisBusy
          ? (awaitingProvider ? "NORMAL: arahan sedang diproses / menunggu jawapan AI."
                               : "PERIKSA: busy:true tanpa permintaan provider aktif — semak 'errors' terkini.")
          : "NORMAL: tiada arahan sedang berjalan.";
        diag.planning = { mode: !!planningMode, activeBubble: !!activeAssistantBubble };
        diag.watchdogs = { response: !!responseWatchdogTimer, planner: !!plannerWatchdogTimer };
        diag.toolCount = (TOOLS || []).length;
        diag.capabilities = (TOOLS || []).map(function (t) { return t.action; });
        diag.version = JARVIS_VERSION;
        diag.changelog = JARVIS_CHANGELOG;
        // Map of the codebase so the "brain" can ground its feature suggestions
        // in real files/functions instead of inventing vague futuristic features.
        diag.codeMap = {
          "jarvisOverlay.js": "Panel chat JARVIS: buildPanel (UI), processMessage/pumpQueue (queue serial), processOne (routing), requestPlan/planWithGemini (planner ke provider), runPlanSequential (laksana plan), sendToProvider (chat), cancelJarvis (batal), renderBubble (bubble + butang salin), collectJarvisDiagnostics/computeJarvisVerdict/runSelfCheck (semak diri + verdict lokal).",
          "core/jarvisCore.js": "parseIntent, toUrl, buildConversationPrompt, buildPlanPrompt, normalizeCommandPhrase, matchLearnedCommand, extractPageContext — pemahaman arahan & konteks halaman.",
          "contentScriptSidebarAi.js": "Surface provider AI (Gemini/ChatGPT/Claude dll) dalam sidebar: poll respons, isi composer, kesan 'Stop' semasa menjana, klik butang.",
          "background.js": "Router mesej (open-ai-sidebar-with-prompt, jarvis-*), storage, arahan keyboard (F4 toggle-jarvis).",
          "styles/jarvisOverlay.css": "Gaya panel JARVIS."
        };
        // Extra state so the audit covers macros, element hints, panel + provider.
        diag.macrosCount = macros ? Object.keys(macros).length : 0;
        var ehSites = 0, ehCount = 0;
        var eh = elementHints || {};
        Object.keys(eh).forEach(function (k) { ehSites++; ehCount += Object.keys(eh[k] || {}).length; });
        diag.elementHintsSites = ehSites;
        diag.elementHintsCount = ehCount;
        diag.transcriptBubbles = transcriptEl ? transcriptEl.childElementCount : 0;
        diag.providerIframeLoaded = !!providerIframe;
        diag.providerVisible = !!providerVisible;
        var ctx = Core ? Core.extractPageContext() : {};
        diag.page = { title: (ctx && ctx.title) || "", url: (ctx && ctx.url) || "" };
         diag.ui = collectJarvisUIState();
         diag.errors = jarvisErrors.slice(-10);
         // Safeguards that ALREADY exist in the code. Exposed so the diagnostic
         // "brain" does not re-report them as new bugs / suggest re-adding them
         // (a frequent false-positive source — the AI can't see the source, so
         // it invents "missing" protections that are in fact present).
         diag.mitigationsInPlace = [
           "queue: done() idempotent (flag 'finished') + try/catch dalam pumpQueue — satu step throw tak boleh kekalkan deadlock.",
           "queue: armQueueWatchdog() paksa reset jarvisBusy selepas timeout bila tersekat; clearQueueWatchdog() bila selesai.",
           "cancel: cancelJarvis() reset penuh (currentToken, planningMode, semua watchdog, commandQueue=[], panggil activeDone).",
           "history: HISTORY_CAP=15 + pruneHistory(); transkrip cap 50 bubble via pruneTranscriptBubbles().",
           "context: extractPageContext() potong teks halaman (MAX 6000 char); buildConversationPrompt() guna ~6 turn + teks dipotong.",
           "xss: linkify() escapeHtml dahulu, regex hanya padan skema http(s) + isSafeHttpUrl(), diikuti DOMPurify sanitizeHtml() (buang javascript:/markup).",
           "provider: INTERIM_RE tapis status sementara ('Searching the web'/'thinking'/'generating') supaya tak difinalkan sebagai jawapan sebenar."
         ];
      } catch (e) {
        recordJarvisError("collectJarvisDiagnostics", e);
      }
      return diag;
    }

    // Compute a LOCAL diagnostic verdict from the collected snapshot + probes,
    // BEFORE asking the AI. This gives an objective, deterministic baseline the
    // AI must stay consistent with (it can't inflate a healthy system into a
    // fake crisis). Levels: SIHAT (healthy) < PERIKSA (needs attention) <
    // KEROSAKAN (a real fault is proven by evidence).
    function computeJarvisVerdict(diag) {
      var v = { level: "SIHAT", reasons: [], failedProbes: [] };
      try {
        var probes = diag.probes || [];
        probes.forEach(function (p) { if (p && !p.ok) v.failedProbes.push(p.name); });
        var errCount = (diag.errors || []).length;
        var q = diag.queue || {};
        // A REAL hang requires all three: busy, no provider request in flight,
        // AND recent errors. busy:true alone is normal during local steps.
        var realHang = !!q.busy && !q.awaitingProvider && errCount > 0;
        if (v.failedProbes.length) {
          v.level = "KEROSAKAN";
          v.reasons.push(v.failedProbes.length + " probe GAGAL: " + v.failedProbes.join(", "));
        }
        if (realHang) {
          v.level = "KEROSAKAN";
          v.reasons.push("Queue tersekat sebenar: busy:true + awaitingProvider:false + ada ralat terkini.");
        } else if (q.busy && !q.awaitingProvider) {
          if (v.level === "SIHAT") v.level = "PERIKSA";
          v.reasons.push("busy:true tanpa permintaan provider — kemungkinan besar langkah lokal, BUKAN deadlock (errors kosong).");
        }
        if (errCount > 0 && v.level === "SIHAT") {
          v.level = "PERIKSA";
          v.reasons.push(errCount + " ralat direkod dalam 'errors'.");
        }
        if (!v.reasons.length) v.reasons.push("Tiada probe gagal, tiada ralat direkod, queue normal.");
      } catch (e) {
        recordJarvisError("computeJarvisVerdict", e);
      }
      return v;
    }

   // Self-diagnostic: send JARVIS's own state snapshot to the Gemini "brain" and
   // ask it to identify faults/weaknesses and suggest fixes. `done` advances the
   // command queue once the diagnosis stream finishes (or fails).
    // Actively EXERCISE JARVIS's own functions (not just inspect state) so the
    // diagnostic can catch "broken but no error logged" cases. Each probe is
    // wrapped so one failure never breaks the others. `onProbes` receives the
    // array (the async storage probe resolves last).
    function runJarvisProbes(onProbes) {
      var probes = [];
      function add(name, ok, detail) { probes.push({ name: name, ok: !!ok, detail: detail || "" }); }
      try {
        var pi = Core.parseIntent("buka youtube di page ini");
        add("parseIntent(open_url/navigate)", !!(pi && (pi.type === "open_url" || pi.type === "navigate")), "type=" + (pi && pi.type));
      } catch (e) { add("parseIntent", false, String(e && e.message || e)); }
      try {
        var u = Core.toUrl("github.com");
        add("toUrl(github.com)", !!u && /^https:\/\//.test(u), u || "null");
      } catch (e) { add("toUrl", false, String(e && e.message || e)); }
      try {
        var cp = Core.buildConversationPrompt("uji", { title: "t", url: "u", text: "x" }, []);
        add("buildConversationPrompt", typeof cp === "string" && cp.length > 0, "len=" + (cp ? cp.length : 0));
      } catch (e) { add("buildConversationPrompt", false, String(e && e.message || e)); }
      try {
        var np = Core.normalizeCommandPhrase("buka youtube d page ini");
        add("normalizeCommandPhrase", np === "buka youtube di page ini", np);
      } catch (e) { add("normalizeCommandPhrase", false, String(e && e.message || e)); }
      try {
        var matched = learnedCommands.length ? Core.matchLearnedCommand(learnedCommands[0].phrase, learnedCommands) : null;
        add("matchLearnedCommand", learnedCommands.length === 0 || !!matched, learnedCommands.length + " learned");
      } catch (e) { add("matchLearnedCommand", false, String(e && e.message || e)); }
      try {
        var surf = (typeof providerIframeUrl === "function") ? providerIframeUrl(PROVIDER) : "";
        add("provider.surface", !!surf && /^https:\/\//.test(surf), surf ? surf.slice(0, 36) + "…" : "no url");
      } catch (e) { add("provider.surface", false, String(e && e.message || e)); }
       // UI probes
       try {
         var cssOk = false;
         var sheets = document.styleSheets || [];
         for (var s = 0; s < sheets.length; s++) {
           var h = sheets[s] && sheets[s].href;
           if (h && /jarvisOverlay\.css/.test(h)) { cssOk = true; break; }
         }
         add("ui.cssLoaded", cssOk, cssOk ? "jarvisOverlay.css applied" : "stylesheet missing");
       } catch (e) { add("ui.cssLoaded", false, String(e && e.message || e)); }
       try {
         add("ui.panelElements", !!(root && inputEl && transcriptEl), "root/input/transcript present");
       } catch (e) { add("ui.panelElements", false, String(e && e.message || e)); }
        // Architecture / sidebar-host probes (Seni Bina B).
        // NOTA: mod "overlay" (SIDEBAR_HOST === false) ialah keadaan NORMAL &
        // BETUL untuk JARVIS terapung — probe ini HANYA melaporkan mod yang aktif,
        // bukan mengassert mesti sidebar-host. Mengassert SIDEBAR_HOST === true
        // menyebabkan verdict palsu "KEROSAKAN" setiap kali JARVIS berjalan
        // sebagai overlay (kes biasa). Jadi ok sentiasa true; butiran nyatakan mod.
        try {
          add("arch.mode", true, SIDEBAR_HOST ? "sidebar-host (betul)" : "overlay (betul, mod terapung normal)");
        } catch (e) { add("arch.mode", false, String(e && e.message || e)); }
       try {
         add("overlay.suspended", jarvisSuspended === false, jarvisSuspended ? "SUSPENDED (sidebar AI open)" : "not suspended");
       } catch (e) { add("overlay.suspended", false, String(e && e.message || e)); }
        try {
          var _rect = (root && root.getBoundingClientRect) ? root.getBoundingClientRect() : null;
          add("ui.panelVisible", !!(root && _rect && _rect.width > 0 && _rect.height > 0), _rect ? ("w=" + Math.round(_rect.width) + " h=" + Math.round(_rect.height)) : "no rect");
        } catch (e) { add("ui.panelVisible", false, String(e && e.message || e)); }
        // Sidebar-host TIDAK BOLEH KOSONG: mesti ada sekurang-kurangnya satu
        // bubble alu-aluan supaya pengguna tak nampak panel "kosong tiada apa".
        try {
          if (SIDEBAR_HOST) {
            var _bub = transcriptEl ? transcriptEl.childElementCount : 0;
            add("sidebar.notEmpty", _bub >= 1, _bub + " bubble dalam transkrip");
          } else {
            add("sidebar.notEmpty", true, "bukan sidebar-host (tidak berkaitan)");
          }
        } catch (e) { add("sidebar.notEmpty", false, String(e && e.message || e)); }
        // Async probes — host relay (only meaningful in sidebar-host), then
        // storage, then a probe that verifies the flip→sidebar flow actually
        // CAN open the JARVIS sidebar (without disrupting the user). onProbes
        // resolves once all async probes complete.
        function finishWithStorage() {
          try {
            if (api.storage && api.storage.local && api.storage.local.get) {
              lpStorageGet("settings", function () {
                add("storage.read", true, "settings readable");
                finishWithFlipProbe();
              });
            } else {
              add("storage.read", false, "storage API missing");
              finishWithFlipProbe();
            }
          } catch (e) {
            add("storage.read", false, String(e && e.message || e));
            finishWithFlipProbe();
          }
        }
        // Probe flip→sidebar: sahkan background BOLEH buka sidebar JARVIS. Guna
        // mod "__probe" supaya sidebar TIDAK benar-benar dibuka (tak ganggu
        // pengguna). Gagal = butang flip overlay tak akan buka sidebar.
        function finishWithFlipProbe() {
          try {
            if (api.runtime && typeof api.runtime.sendMessage === "function") {
              var p = api.runtime.sendMessage({ type: "open-jarvis-sidebar", __probe: true });
              var got = function (resp) {
                var ok = !!(resp && resp.ok === true);
                add("flip.canOpenSidebar", ok, ok ? "background berjaya set/notify sidebar JARVIS" : "sidebarAction tiada/tak boleh dibuka pada pelayar ini");
                onProbes(probes);
              };
              if (p && typeof p.then === "function") p.then(got).catch(function () { got({ ok: false }); });
              else got({ ok: false });
            } else {
              add("flip.canOpenSidebar", false, "runtime.sendMessage tiada");
              onProbes(probes);
            }
          } catch (e) {
            add("flip.canOpenSidebar", false, String(e && e.message || e));
            onProbes(probes);
          }
        }
        if (SIDEBAR_HOST && typeof hostRelay === "function") {
          try {
            hostRelay({ type: "jarvis-host-observe" }).then(function (res) {
              var ok = !!(res && res.ok !== false && res.context);
              add("hostRelay.observe", ok, ok ? "active-tab context diterima" : "tiada respons dari tab aktif (relay rosak?)");
              add("hostRelay.activeTabHost", !!(res && typeof res.host === "string" && res.host.length), (res && res.host) ? res.host : "none");
              finishWithStorage();
            }).catch(function (err) {
              add("hostRelay.observe", false, "relay threw: " + String(err && err.message || err));
              finishWithStorage();
            });
          } catch (e) {
            add("hostRelay.observe", false, String(e && e.message || e));
            finishWithStorage();
          }
        } else {
          finishWithStorage();
        }
    }

    // Self-diagnostic: send JARVIS's own state snapshot + active probe results to
    // the Gemini "brain" and ask it to identify faults/weaknesses and suggest
    // fixes. `done` advances the command queue once the diagnosis finishes.
    function runSelfCheck(done) {
      var diag = collectJarvisDiagnostics();
      runJarvisProbes(function (probes) {
        diag.probes = probes;
        // Deterministic local verdict computed BEFORE the AI sees the data.
        diag.verdict = computeJarvisVerdict(diag);
        var diagJson = "";
        try { diagJson = JSON.stringify(diag, null, 2); } catch (e) { diagJson = String(diag); }
        var prompt = [
          "Anda ialah pakar diagnostik untuk JARVIS, pembantu dalam ekstensi 'Local Pocket Reader' pada pelayar.",
          "VERDICT LOKAL (dikira JARVIS sendiri secara deterministik — PERCAYAI & selaras dengannya): level=" + diag.verdict.level + "; sebab=" + diag.verdict.reasons.join(" | ") + ".",
          "Berikut ialah 'snapshot' keadaan DALAMAN JARVIS sendiri (bukan halaman pengguna), termasuk keputusan PROBE fungsi sebenar:",
          "",
          "```json",
          diagJson,
          "```",
          "",
          "Tugas anda: JALANKAN AUDIT MENYELURUH ke atas JARVIS merangkumi SEMUA aspek di bawah, kenalpasti setiap KEROSAKAN, BUG, KEGAGALAN dan KELEMAHAN, serta beri CADANGAN UPGRADE/penambahbaikan dari SETIAP aspek. Gunakan field 'codeMap' & 'capabilities' supaya setiap cadangan BERASASKAN kod sebenar (fail & fungsi), bukan idea kabur. Aspek yang WAJIB diliputi:",
          "1. RALAT & KEROSAKAN FUNGSI — field 'errors' dan 'probes' (sebarang probe ok:false = KEROSAKAN FUNGSI walaupun errors kosong). Cari punca & fix konkrit.",
          "2. KEBOLEHPERCAYAAN / RESILIENSI — deadlock, queue 'busy' tertinggal true, watchdog tak fire, finalisasi tak jamin (done tak dipanggil), cancelJarvis takhentikan sepenuhnya, ReAct correction gagal/infinite loop, planWithGemini fallback salah.",
          "3. KESELAMATAN — XSS pada linkify/escapeHtml, injection via teks pengguna/provider, sanitizeProviderResponse (bocor 'stop'/'account'), clipboard, storage, URL dibina (toUrl).",
          "4. PRESTASI & MEMORI — saiz learnedCommands/elementMemory/elementHints, storage bloat (JSON.stringify besar), polling/string ops, transkrip terlalu panjang, leak (event listener/pending timer).",
          "5. UI/UX & KEBOLEHCAPAIAN — panel (rect, inViewport, overflow), bubble, butang salin/batal, drag clamp, responsive (<800px tinggi), jarak sentuh, kontras, focus management, feedback semasa sibuk.",
          "6. ARCHITECTURE & KEBOLEHSELENGARAAN — coupling, duplikasi kod, magic string, konsistensi error handling, penggunaan codeMap; cadangkan refactor jika ada.",
          "7. KAWALAN TEMPATAN & INTEGRASI — click/fill/scroll/snapshot, element hints (recallElement), macros, provider iframe (providerIframeLoaded/providerVisible), integrasi library/bookmarks/sidebar.",
          "8. INTERNATIONALISASI (Bahasa Melayu) — konsistensi & ketepatan terjemahan, typo, frasa tidak natural dalam bubel/sistem.",
          "9. ALIRAN PENGGUNA (UX FLOW) — queue serialization, maklum balas (busy/cancel), notifikasi, discovery ciri (contoh: adakah pengguna tahu butang salin/batal wujud?).",
          "10. CADANGAN UPGRADE — dari SETIAP aspek (1-9) di atas, cadangkan 5-8 penambahbaikan konkrit. Untuk SETIAP cadangan beri: (a) nama, (b) aspek (1-9), (c) masalah/kegunaan, (d) pendekatan kasar + rujukan fail/fungsi (codeMap), (e) anggaran skop KECIL/SEDERHANA/BESAR, (f) keutamaan (Tinggi/Sederhana/Rendah).",
          "",
          "PERATURAN PENTING (jangan salah diagnosa):",
          "- PATUHI 'verdict' LOKAL. Jika verdict.level='SIHAT', JANGAN cipta masalah KRITIS/SEDERHANA yang tiada bukti dalam 'errors' atau 'probes'. Naik taraf keterukan HANYA jika ada bukti konkrit (probe ok:false atau entri 'errors').",
          "- Field 'mitigationsInPlace' menyenaraikan perlindungan yang SUDAH ADA dalam kod. JANGAN lapor mana-mana daripadanya sebagai bug/kelemahan/masalah baharu, dan JANGAN cadang 'menambah' atau 'melaksanakan' perkara yang sudah tersenarai di situ. Jika ingin memperbaiki, cadang penambahbaikan DI ATAS perlindungan sedia ada dan nyatakan ia sudah wujud.",
          "- queue.busy:true dengan pending:0 ADALAH NORMAL semasa arahan aktif (tunggu AI / langkah lokal). BACA 'busyInterpretation' & 'queue.awaitingProvider'. HANYA flag 'deadlock' KRITIS jika busy:true DAN awaitingProvider:false DAN 'errors' ada entri terkini (rujuk verdict.level).",
          "- watchdogs:false NORMAL semasa langkah lokal serentak; bukan bug.",
          "- JANGAN cadangkan 'timeout paksa reset busy' membuta tuli — benarkan arahan bertindih & rosakkan state berkongsi.",
          "- CADANGAN mesti KONKRIT & BERASASKAN codeMap/capabilities. JANGAN reka ciri kabur ('multi-modal AI', 'cross-tab sync') tanpa langkah kod sebenar.",
          "- PENGECUALIAN CADANGAN: JANGAN cadangkan penyelesaian yang memerlukan API LUARAN / PIHAK KETIGA (external/3rd-party API) atau perkhidmatan awan BAHARU. JANGAN cadangkan naik taraf ke MANIFEST V3 (MV3). Kedua-dua ini DILARANG sama sekali — abaikan terus.",
          "",
          "Balas dalam bahasa Melayu, padat & berstruktur. Format: RINGKASAN, SENARAI MASALAH (setiap satu: aspek, tahap KRITIS/SEDERHANA/RENDAH, punca, fix), CADANGAN UPGRADE (5-8 item, setiap satu lengkap dengan (a)-(f) di atas, diisih mengikut keutamaan), dan UI/UX. Jika JARVIS sihat, SAHKAN sihat & beri 2-3 penambahbaikan kecil berimpak tinggi."
        ].join("\n");
        addBubble("system", "🩺 JARVIS sedang mengaudit diri sendiri… (verdict lokal: " + diag.verdict.level + " — " + diag.verdict.reasons.join("; ") + ")");
        sendToProvider(prompt, done);
      });
    }

   // Export the full diagnostic (snapshot + active probes) as JSON: copy to
   // clipboard and trigger a download, so the user can easily share it with the
   // developer for analysis.
   function exportDiagnostic(done) {
     var diag = collectJarvisDiagnostics();
      runJarvisProbes(function (probes) {
        diag.probes = probes;
        diag.verdict = computeJarvisVerdict(diag);
        var json = "";
       try { json = JSON.stringify(diag, null, 2); } catch (e) { json = String(diag); }
       var filename = "jarvis-diagnostic-" + Date.now() + ".json";
       // Copy to clipboard (primary path).
       try {
         if (navigator.clipboard && navigator.clipboard.writeText) {
           navigator.clipboard.writeText(json).catch(function () {});
         }
       } catch (e) {}
       // Best-effort download via blob.
       try {
         var blob = new Blob([json], { type: "application/json" });
         var url = URL.createObjectURL(blob);
         var a = document.createElement("a");
         a.href = url; a.download = filename;
         document.body.appendChild(a); a.click();
         setTimeout(function () { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e2) {} }, 1000);
       } catch (e) {}
       addBubble("jarvis", "📋 Diagnostik disalin ke clipboard & dimuat turun sebagai " + filename + ". Hantar teks/fail ini kepada pembangang untuk analisis.");
       if (done) done();
     });
   }

   // Extract either a single action object or an array of action objects from the
   // brain's reply, normalized to an array (or null when nothing actionable).
   function extractPlan(acc) {
    if (!acc) return null;
    var trimmed = acc.replace(/```(?:json)?/gi, "").trim();
    // 1) Whole reply is a JSON array of steps.
    try {
      var whole = JSON.parse(trimmed);
      if (Array.isArray(whole)) {
        var wf = whole.filter(function (p) { return p && p.action; });
        if (wf.length) return wf;
      }
    } catch (err) {}
    // 2) Whole reply is a single JSON action object.
    try {
      var obj = JSON.parse(trimmed);
      if (obj && obj.action) return [obj];
    } catch (err2) {}
    // 3) Array somewhere inside the reply.
    var s = acc.indexOf("[");
    var e = acc.lastIndexOf("]");
    if (s !== -1 && e !== -1 && e > s) {
      var arrRaw = acc.slice(s, e + 1)
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
      try {
        var arr = JSON.parse(arrRaw);
        if (Array.isArray(arr)) {
          var filtered = arr.filter(function (p) { return p && p.action; });
          if (filtered.length) return filtered;
        }
      } catch (err3) {}
    }
    // 4) Fall back to a single object extracted from surrounding prose.
    var obj2 = extractJson(acc);
    if (obj2 && obj2.action) return [obj2];
    return null;
  }

  // Page-DOM action types that, in sidebar-host mode, must execute in the ACTIVE
  // TAB (relayed) rather than against the sidebar's own document.
  var HOST_DOM_ACTIONS = { click: 1, fill: 1, scroll: 1, click_first_link: 1, snapshot: 1 };
  // Relay a single page-DOM action to the active tab, surface the bubbles its
  // executor produced, then refresh the cached observation (so the ReAct loop's
  // re-plan step sees the post-action page state) and report the action result.
  function hostRunDomAction(plan, userText, callDone) {
    hostRelay({ type: "jarvis-host-run-action", plan: plan, userText: userText || "" }).then(function (res) {
      if (res && Array.isArray(res.bubbles)) {
        res.bubbles.forEach(function (b) { if (b && b.text) addBubble(b.role || "jarvis", b.text); });
      } else if (!res) {
        addBubble("jarvis", "Tiada tab aktif untuk melaksanakan tindakan halaman ini.");
      }
      refreshHostObservation().then(function () {
        callDone(res && res.result ? res.result : { ok: !!(res && res.ok !== false) });
      });
    });
  }

  function runSinglePlan(plan, userText, done) {
    var ctxNow = Core.extractPageContext();
    var action = String(plan.action).toLowerCase();
    var res;
    var doneCalled = false;
    function callDone(r) { if (doneCalled) return; doneCalled = true; if (done) done(r); }
    if (SIDEBAR_HOST && HOST_DOM_ACTIONS[action]) {
      hostRunDomAction(plan, userText, callDone);
      return;
    }
    switch (action) {
      case "save": runIntent({ type: "save" }); break;
      case "summarize": runIntent({ type: "summarize" }); break;
      case "search_library": runIntent({ type: "search", query: str(plan.query) || userText, mode: "library" }); break;
      case "search_web": runIntent({ type: "search", query: str(plan.query) || userText, mode: "web" }); break;
      case "search_youtube": sendYouTubeSearch(str(plan.query) || userText); break;
      case "open_youtube_tabs": openYouTubeTabs(str(plan.query) || userText, num(plan.count, 5)); break;
      case "open_category": runIntent({ type: "open-category", query: str(plan.name) }); break;
      case "open_url": doOpenUrl(str(plan.target)); break;
      case "navigate": doNavigate(str(plan.target)); break;
      case "click_first_link": doClickFirstLink(callDone); return;
      case "new_tab": runIntent({ type: "new_tab" }); break;
      case "close_tab": runIntent({ type: "close_tab" }); break;
      case "close_all_tabs": runIntent({ type: "close_all_tabs", risk: "confirm" }); break;
      case "reload": runIntent({ type: "reload" }); break;
      case "back": runIntent({ type: "back" }); break;
      case "forward": runIntent({ type: "forward" }); break;
      case "bookmark": runIntent({ type: "bookmark" }); break;

      case "scroll": runIntent({ type: "scroll", direction: plan.direction === "up" ? "up" : "down" }); break;
      case "click": {
        var ci = (plan.index != null && plan.index !== "") ? plan.index : recallElement(siteHost(), str(plan.target));
        return callDone(doClick(str(plan.target), ci));
      }
      case "fill": {
        var fi = (plan.index != null && plan.index !== "") ? plan.index : recallElement(siteHost(), str(plan.field));
        return callDone(doFill(str(plan.field), str(plan.value), fi));
      }
      case "snapshot": doSnapshot(); return callDone({ ok: true });
      case "open_sidebar": runIntent({ type: "open_sidebar" }); break;
      case "open_library": runIntent({ type: "open_library" }); break;
      case "toggle_notes": runIntent({ type: "toggle_notes" }); break;
      case "toggle_pomodoro": doPomodoro(num(plan.minutes, 25)); break;
      case "open_settings": runIntent({ type: "open_settings" }); break;
      case "toggle_ai_overlay": runIntent({ type: "toggle_ai_overlay" }); break;
      case "copy_answer": doCopyAnswer(); break;
      case "copy_url": doCopyUrl(); break;
      case "copy_markdown": doCopyMarkdown(); break;
      case "translate_selection": doTranslateSelection(str(plan.query)); break;
      case "summarize_selection": doSummarizeSelection(str(plan.query)); break;
      case "print_page": sendBrowser("print", {}); break;
      case "duplicate_tab": sendBrowser("duplicate_tab", {}); break;
      case "zoom": sendBrowser("zoom", { direction: plan.direction === "out" ? "out" : "in" }); break;
      case "self_check": runSelfCheck(function () {}); return callDone({ ok: true });
      case "export_diagnostic": exportDiagnostic(function () {}); return callDone({ ok: true });
      case "save_conversation": doSaveConversation(); return callDone({ ok: true });
      case "save_macro": doSaveMacro(normMacroName(str(plan.name)), splitMacroCommands(plan.commands || "")); return callDone({ ok: true });
      case "run_macro": {
        var rname = normMacroName(str(plan.name));
        var rcmds = macros && macros[rname];
        if (rcmds && rcmds.length) { enqueueMacro(rname, rcmds); return callDone({ ok: true }); }
        addBubble("jarvis", "Tiada makro \"" + str(plan.name) + "\".");
        return callDone({ ok: false, reason: "no-macro" });
      }
      case "list_macros": doListMacros(); return callDone({ ok: true });
      case "delete_macro": doDeleteMacro(normMacroName(str(plan.name))); return callDone({ ok: true });
      case "chat":
      default:
         maybeRefreshCrossTab(str(plan.question) || userText).then(function () {
           sendToProvider(Core.buildConversationPrompt(str(plan.question) || userText, ctxNow, history, chatPromptOpts()), callDone);
         }).catch(function () {
           sendToProvider(Core.buildConversationPrompt(str(plan.question) || userText, ctxNow, history, chatPromptOpts()), callDone);
         });
        return;
    }
    callDone(res);
  }

    // Detect a follow-up local action implied by the user's wording when the
    // planner only returned a navigation/open step (LLMs sometimes omit the
    // second step even though the user clearly chained a command like
    // "buka youtube dan klik link"). This makes the chained click fire
    // in the loaded tab via the collapse mechanism below.
    function followupActionFromIntent(text) {
      var t = (text || "").toLowerCase();
      if (/\b(klik|click)\b/.test(t) && /\b(first|pertama|1st|awal|pertama)\b/.test(t) && /\b(link|pautan|tautan|video)\b/.test(t)) {
        return { action: "click_first_link" };
      }
      if (/\b(first|pertama|1st|awal)\b/.test(t) && /\b(link|pautan|tautan|video)\b/.test(t)) {
        return { action: "click_first_link" };
      }
      // "klik link" / "click link" / "klik pautan" (tanpa perkataan "pertama")
      // juga bermaksud klik pautan pertama dalam halaman yang dimuat. Jika
      // ada perkataan penerang (bukan "pertama"), guna sebagai penapis supaya
      // ia klik link YANG SEPAIan, bukan link pertama secara membuta.
      if (/\b(klik|click)\b/.test(t) && /\b(link|pautan|tautan)\b/.test(t)) {
        var lm = t.match(/\b(klik|click)\b\s+(?:link|pautan|tautan)\s*(.*)$/);
        var rest = lm ? lm[1].trim() : "";
        var tgt = /^(pertama|first|1st|awal)\b/i.test(rest) ? "" : rest;
        return { action: "click_first_link", target: tgt };
      }
      return null;
    }

    function jarvisDebug(m) { try { addBubble("jarvis", "🐞 " + m); } catch (e) {} }

    // Click-family plan actions physically interact with the page by clicking.
    // These must only run when the user explicitly typed a click keyword
    // ("klik"/"click"/"tekan"/"press") — otherwise JARVIS would click on its own
    // against the user's intent.
    var CLICK_PLAN_ACTIONS = { click: 1, click_first_link: 1, click_link: 1 };
    function isClickAction(a) { return !!CLICK_PLAN_ACTIONS[String(a || "").toLowerCase()]; }
    function hasClickKeyword(text) {
      return /\b(klik|click|tekan|press|tap|ketik)\b/i.test(String(text || ""));
    }

    function executePlan(acc, userText) {
      var plans = extractPlan(acc);
       if (!plans || !plans.length) {
         // Brain returned nothing actionable -> treat as free chat
         console.log("[JARVIS-DEBUG] executePlan: no plan, falling back to chat");
         jarvisDebug("tiada pelan -> chat");
          doChat(userText);
         return;
       }
       // If the plan ends on an open/navigate step but the user's text implies a
       // follow-up click (and the planner didn't include it), append it so the
       // collapse path runs it inside the newly loaded tab.
       var fu = followupActionFromIntent(userText);
       if (fu) {
         var lastAct = String(plans[plans.length - 1].action).toLowerCase();
         var opens = (lastAct === "open_url" || lastAct === "navigate" || lastAct === "search_youtube" || lastAct === "open_youtube_tabs");
         if (opens) { plans = plans.concat([fu]); }
       }
        console.log("[JARVIS-DEBUG] executePlan plans=" + JSON.stringify(plans));
        jarvisDebug("PELAN=" + JSON.stringify(plans));
        // GATE: if the plan would click the page but the user never typed a click
        // keyword ("klik"/"click"/...), force a plan preview so JARVIS never
        // clicks on its own — the user must approve first. (When Preview Plan is
        // OFF, runPlanSequential additionally skips the click.)
        if (plans.some(function (p) { return isClickAction(p && p.action); }) && !hasClickKeyword(userText)) {
          renderPlanPreview(plans, userText);
          return;
        }
        if (planNeedsPreview(plans)) {
          renderPlanPreview(plans, userText);
        } else {
          runPlanSequential(plans, 0, userText, 0);
        }
     }

    // ----- Pra-tonton pelan sebelum jalan (gaya browser-use) -----
    // Tindakan berisiko / tak boleh dibalik sentiasa dipra-tonton supaya arahan
    // berisiko tak terus jalan tanpa pengesahan user. Pelan >1 langkah pun
    // dipra-tonton (termasuk klik pautan berantai).
    var RISKY_PLAN_ACTIONS = {
      close_tab: 1, close_all_tabs: 1, back: 1, forward: 1, bookmark: 1,
      print_page: 1, duplicate_tab: 1, zoom: 1, open_settings: 1,
      toggle_ai_overlay: 1, toggle_notes: 1, toggle_pomodoro: 1
    };
    function planNeedsPreview(plans) {
      if (jarvisPreviewPlan === false) return false;
      if (!plans || !plans.length) return false;
      if (plans.length > 1) return true;
      var a = String((plans[0] && plans[0].action) || "").toLowerCase();
      return !!RISKY_PLAN_ACTIONS[a];
    }
    function renderPlanPreview(plans, userText) {
      try { addBubble("jarvis", "📋 Pelan dijana — sahkan sebelum JARVIS jalan:"); } catch (e) {}
      var wrap = el("div", { className: "lp-jarvis-plan-preview" });
      wrap.style.cssText = "border:1px solid rgba(148,163,184,0.45);border-radius:10px;background:rgba(15,23,42,0.6);padding:8px 10px;margin:4px 0;";
      var pre = el("pre", { className: "lp-jarvis-plan-json" });
      pre.textContent = JSON.stringify(plans, null, 2);
      pre.style.cssText = "margin:0;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-word;font:12px/1.45 ui-monospace,Consolas,monospace;color:#cbd5e1;";
      var row = el("div", { className: "lp-jarvis-plan-preview-btns" });
      row.style.cssText = "display:flex;gap:8px;margin-top:8px;";
      var runBtn = el("button", { className: "lp-jarvis-plan-run", text: "▶ Jalan" });
      runBtn.style.cssText = "padding:6px 14px;border-radius:8px;border:none;background:#10b981;color:#04231a;font-size:12px;font-weight:600;cursor:pointer;";
      var cancelBtn = el("button", { className: "lp-jarvis-plan-cancel", text: "✕ Batal" });
      cancelBtn.style.cssText = "padding:6px 14px;border-radius:8px;border:1px solid rgba(148,163,184,0.5);background:transparent;color:#cbd5e1;font-size:12px;cursor:pointer;";
      runBtn.addEventListener("click", function () {
        try { wrap.remove(); } catch (e2) {}
        runPlanSequential(plans, 0, userText, 0);
      });
      cancelBtn.addEventListener("click", function () {
        try { wrap.remove(); } catch (e2) {}
        addBubble("jarvis", "Pelan dibatalkan.");
        focusInput();
      });
      row.appendChild(runBtn);
      row.appendChild(cancelBtn);
      wrap.appendChild(pre);
      wrap.appendChild(row);
      if (transcriptEl) transcriptEl.appendChild(wrap);
      scrollToBottom();
    }

   // ─────────────────────────────────────────────────────────────────────
   // Conflict Resolution UI (Fasa 1) — port from jarvisOverlay.js
   // ─────────────────────────────────────────────────────────────────────

   function renderConflictUI(conflicts, onResolve) {
     if (!transcriptEl) buildPanel();
     if (!conflicts || !conflicts.length) return;
     conflicts.forEach(function (conflict) {
       renderConflictCard(conflict, onResolve);
     });
     scrollToBottom();
   }

   function renderConflictCard(conflict, onResolve) {
     var wrap = el("div", { className: "lp-jarvis-conflict-card" });
     var header = el("div", { className: "lp-jarvis-conflict-header" },
       [el("span", { className: "lp-jarvis-conflict-icon", text: "⚡" }),
        el("span", { className: "lp-jarvis-conflict-label", text: conflict.label })]);
     wrap.appendChild(header);
     if (conflict.description) {
       wrap.appendChild(el("div", { className: "lp-jarvis-conflict-desc", text: conflict.description }));
     }
     var altRow = el("div", { className: "lp-jarvis-conflict-alts" });
     var altButtons = [];
     var picked = false;
     function pick(alt) {
       if (picked) return;
       picked = true;
       document.removeEventListener("keydown", onKey, true);
       wrap.remove();
       if (alt && alt.plan) {
         onResolve(alt);
       } else {
         addBubble("jarvis", "Dibatalkan.");
         focusInput();
       }
     }
     conflict.alternatives.forEach(function (alt) {
       var card = el("button", { className: "lp-jarvis-conflict-alt", type: "button" });
       var iconMap = {
         "Web": "🌐", "YouTube": "🎬", "Simpanan": "📚",
         "Halaman ini": "📄", "Tab baru": "🆕",
         "Ya, teruskan": "✅", "Batal": "✕",
         "Tutup tab": "🗑", "Padam penanda buku": "🔖"
       };
       var icon = iconMap[alt.label] || "🔹";
       card.appendChild(el("div", { className: "lp-jarvis-conflict-alt-icon", text: icon }));
       card.appendChild(el("div", { className: "lp-jarvis-conflict-alt-label", text: alt.label }));
       card.appendChild(el("div", { className: "lp-jarvis-conflict-alt-desc", text: alt.description }));
       if (conflict.allow_edit && alt.plan) {
         var editBtn = el("span", { className: "lp-jarvis-conflict-alt-edit", text: "✏️" });
         editBtn.addEventListener("click", function (e) {
           e.stopPropagation();
           editAlternative(alt, conflict, function (modified) { pick(modified); });
         });
         card.appendChild(editBtn);
       }
       card.addEventListener("click", function () { pick(alt); });
       altButtons.push(card);
       altRow.appendChild(card);
     });
     if (conflict.allow_custom) {
       var customCard = el("button", { className: "lp-jarvis-conflict-alt lp-jarvis-conflict-custom", type: "button" });
       customCard.appendChild(el("div", { className: "lp-jarvis-conflict-alt-icon", text: "✏️" }));
       customCard.appendChild(el("div", { className: "lp-jarvis-conflict-alt-label", text: "Taip sendiri" }));
       customCard.appendChild(el("div", { className: "lp-jarvis-conflict-alt-desc", text: "Tulis scope manual" }));
       customCard.addEventListener("click", function () {
         customInputModal(conflict, function (alt) { if (alt) pick(alt); });
       });
       altButtons.push(customCard);
       altRow.appendChild(customCard);
     }
     wrap.appendChild(altRow);
     var prefRow = el("div", { className: "lp-jarvis-conflict-pref" });
     var dontAsk = el("label", { className: "lp-jarvis-conflict-dontask" }, [
       el("input", { type: "checkbox", className: "lp-jarvis-conflict-dontask-cb" }),
       el("span", { text: "Jangan tanya lagi untuk '" + conflict.type + "'" })
     ]);
     prefRow.appendChild(dontAsk);
     wrap.appendChild(prefRow);
     var timerBar = el("div", { className: "lp-jarvis-conflict-timer" });
     var timerFill = el("div", { className: "lp-jarvis-conflict-timer-fill" });
     timerBar.appendChild(timerFill);
     wrap.appendChild(timerBar);
     transcriptEl.appendChild(wrap);
     var focusIdx = 0;
     function focusAt(i) {
       focusIdx = (i + altButtons.length) % altButtons.length;
       try { altButtons[focusIdx].focus(); } catch (e) {}
     }
     function onKey(e) {
       if (picked) return;
       var k = e.key;
       if (k === "ArrowRight" || k === "ArrowDown") { e.preventDefault(); e.stopPropagation(); focusAt(focusIdx + 1); }
       else if (k === "ArrowLeft" || k === "ArrowUp") { e.preventDefault(); e.stopPropagation(); focusAt(focusIdx - 1); }
       else if (k === "Enter" || k === " ") { e.preventDefault(); e.stopPropagation(); if (altButtons[focusIdx]) altButtons[focusIdx].click(); }
       else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); pick(null); }
     }
     document.addEventListener("keydown", onKey, true);
     var timeoutMs = (conflict.timeout_seconds || 30) * 1000;
     timerFill.style.transition = "width " + timeoutMs + "ms linear";
     setTimeout(function () { timerFill.style.width = "0%"; }, 10);
     var timerId = setTimeout(function () { if (!picked) { pick(null); addBubble("jarvis", "Masa tamat — dibatalkan."); } }, timeoutMs);
     var cb = dontAsk.querySelector("input");
     cb.addEventListener("change", function () {
       if (cb.checked) {
         try { var prefs = {}; prefs["jarvisConflictPrefs"] = {}; prefs["jarvisConflictPrefs"][conflict.type] = "always_ask"; api.storage.local.set(prefs).catch(function () {}); } catch (e) {}
       }
     });
     setTimeout(function () { focusAt(0); }, 50);
     var _origRemove = wrap.remove.bind(wrap);
     wrap.remove = function () { clearTimeout(timerId); document.removeEventListener("keydown", onKey, true); _origRemove(); };
   }

   function editAlternative(alt, conflict, onModified) {
     var backdrop = el("div", { className: "lp-jarvis-modal-backdrop" });
     var modal = el("div", { className: "lp-jarvis-modal" });
     modal.appendChild(el("div", { className: "lp-jarvis-modal-title", text: "✏️ Edit Alternatif" }));
     var fields = el("div", { className: "lp-jarvis-modal-fields" });
     var plan = alt.plan || {};
     fields.appendChild(buildField("Tindakan", "text", plan.action || "", true));
     Object.keys(plan).forEach(function (k) { if (k === "action") return; fields.appendChild(buildField(k, "text", String(plan[k] || ""), false)); });
     modal.appendChild(fields);
     var btnRow = el("div", { className: "lp-jarvis-modal-btnrow" });
     var saveBtn = el("button", { className: "lp-jarvis-modal-btn lp-jarvis-modal-btn-primary", text: "✔ OK" });
     var cancelBtn = el("button", { className: "lp-jarvis-modal-btn", text: "Batal" });
     btnRow.appendChild(saveBtn); btnRow.appendChild(cancelBtn);
     modal.appendChild(btnRow);
     backdrop.appendChild(modal);
     if (root) root.appendChild(backdrop);
     saveBtn.addEventListener("click", function () {
       var modified = { action: plan.action };
       var inputs = fields.querySelectorAll("input");
       inputs.forEach(function (inp) { var key = inp.getAttribute("data-key"); if (key && key !== "action") modified[key] = inp.value; });
       backdrop.remove();
       onModified({ id: alt.id, label: alt.label, description: alt.description, preview: alt.preview, plan: modified });
     });
     cancelBtn.addEventListener("click", function () { backdrop.remove(); onModified(null); });
     backdrop.addEventListener("click", function (e) { if (e.target === backdrop) { backdrop.remove(); onModified(null); } });
   }

   function buildField(label, type, value, readonly) {
     var row = el("div", { className: "lp-jarvis-modal-field" });
     row.appendChild(el("label", { className: "lp-jarvis-modal-field-label", text: label }));
     var input = el("input", { type: type, className: "lp-jarvis-modal-field-input", value: value, "data-key": label.toLowerCase() });
     if (readonly) input.disabled = true;
     row.appendChild(input);
     return row;
   }

   function customInputModal(conflict, onResult) {
     var backdrop = el("div", { className: "lp-jarvis-modal-backdrop" });
     var modal = el("div", { className: "lp-jarvis-modal" });
     modal.appendChild(el("div", { className: "lp-jarvis-modal-title", text: "✏️ Taip sendiri" }));
     modal.appendChild(el("div", { className: "lp-jarvis-modal-desc", text: "Tulis arahan lengkap untuk JARVIS:" }));
     var textarea = el("textarea", { className: "lp-jarvis-modal-textarea", placeholder: "Contoh: cari resepi nasi lemak di YouTube" });
     modal.appendChild(textarea);
     var btnRow = el("div", { className: "lp-jarvis-modal-btnrow" });
     var sendBtn = el("button", { className: "lp-jarvis-modal-btn lp-jarvis-modal-btn-primary", text: "Hantar" });
     var cancelBtn = el("button", { className: "lp-jarvis-modal-btn", text: "Batal" });
     btnRow.appendChild(sendBtn); btnRow.appendChild(cancelBtn);
     modal.appendChild(btnRow);
     backdrop.appendChild(modal);
     if (root) root.appendChild(backdrop);
     setTimeout(function () { try { textarea.focus(); } catch (e) {} }, 50);
     function sendCustom() { var t = (textarea.value || "").trim(); if (!t) { textarea.focus(); return; } backdrop.remove(); onResult({ id: "custom", label: "Custom", description: t, preview: t, plan: null, customText: t }); }
     sendBtn.addEventListener("click", sendCustom);
     textarea.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCustom(); } });
     cancelBtn.addEventListener("click", function () { backdrop.remove(); onResult(null); });
     backdrop.addEventListener("click", function (e) { if (e.target === backdrop) { backdrop.remove(); onResult(null); } });
   }

   function resolveConflict(chosenAlt, userText) {
     if (!chosenAlt || !chosenAlt.plan) { addBubble("jarvis", "Dibatalkan."); focusInput(); return; }
     var plan = chosenAlt.plan;
     if (Array.isArray(plan)) { runPlanSequential(plan, 0, userText || "", 0); }
     else { runSinglePlan(plan, userText || ""); }
   }

   // Collapse a navigation/open step that is immediately followed by a local
   // page action: the background opens/navigates, then runs that action in the
   // loaded tab after it finishes loading (the action can't run inline across a
   // navigation that destroys the current content-script context).
    var LOCAL_AFTER_NAV = { click: 1, fill: 1, scroll: 1, click_first_link: 1 };
    function tryCollapseNav(plans, idx, userText) {
      var plan = plans[idx];
      var next = plans[idx + 1];
      var act = String(plan.action).toLowerCase();
      console.log("[JARVIS-DEBUG] tryCollapseNav idx=" + idx + " act=" + act + " next=" + (next ? next.action : "none") + " collapse=" + ((act === "navigate" || act === "open_url" || act === "search_youtube" || act === "open_youtube_tabs") && !!next));
      // Any step that opens/navigates a tab and is immediately followed by a
      // local page action must collapse: the action can't run inline because the
      // navigation destroys the current content-script context, so the rest of
      // the plan is handed to the background to run in the loaded tab instead.
      if ((act === "navigate" || act === "open_url" || act === "search_youtube" || act === "open_youtube_tabs") && next) {
        var pendingPlan = plans.slice(idx + 1);
        jarvisDebug("GABUNG: " + act + " + " + next.action + " -> klik selepas tab muat");
        if (act === "navigate") doNavigate(str(plan.target), null, pendingPlan, userText);
        else if (act === "search_youtube") sendYouTubeSearch(str(plan.query) || userText, pendingPlan, userText);
        else if (act === "open_youtube_tabs") openYouTubeTabs(str(plan.query) || userText, num(plan.count, 1), pendingPlan, userText);
        else doOpenUrlWithAction(str(plan.target), null, pendingPlan, userText);
        return true;
      }
      return false;
    }

   // ReAct self-correction: when a local DOM action (click/fill) fails, re-ask
   // the brain with the post-action observation + a fresh DOM snapshot so it can
   // pick a corrected target by `index` (or choose a different action).
    function rePlanStep(failedAction, userText, cont) {
      var onReplan = function (plan) {
        if (plan && plan.length) {
          // Learn the corrected target's index on this site so future runs
          // (and future planner hints) use it directly without re-correcting.
          var corrected = plan[0];
          if (corrected && corrected.index != null && corrected.index !== "") {
            var tgt = corrected.target || corrected.field || "";
            if (tgt) learnElement(siteHost(), tgt, corrected.index);
          }
          // Execute only the first corrected step here; we don't recurse into
          // another correction round-trip (bounded to avoid infinite loops).
          runSinglePlan(corrected, userText);
        } else {
          addBubble("jarvis", "JARVIS tak dapat membetulkan langkah yang gagal tanpa " + PROVIDER + ".");
        }
        if (cont) cont();
      };
      if (SIDEBAR_HOST) {
        hostRelay({ type: "jarvis-host-build-replan-prompt", failedAction: failedAction }).then(function (res) {
          if (res && res.prompt) { requestPlan(res.prompt, onReplan); }
          else { addBubble("jarvis", "JARVIS tak dapat memerhati halaman untuk membetulkan langkah."); if (cont) cont(); }
        });
        return;
      }
      var obs = Core.buildObservation();
      var snap = Core.buildDomSnapshot({ max: 80 });
      var prompt = Core.buildReplanPrompt(failedAction, obs, snap);
      requestPlan(prompt, onReplan);
    }

   // Sequential plan executor with a lightweight ReAct loop: steps run one at a
   // time, and a failed local DOM action (click/fill) triggers an observation +
   // re-plan before the rest of the plan continues.
     // Wait until the page is actually settled before acting — mirrors an agent's
     // `wait_for_stable_state`: don't just trust the `load` event (which fires
     // before SPA content like YouTube search results finishes rendering). We
     // wait for `readyState` complete AND a short window with no in-flight network
     // requests, capped by a timeout so we never hang.
     function waitForPageStable(opts) {
       opts = opts || {};
       var timeout = opts.timeout || 5000;
       var stableFor = opts.stableFor || 600;
       return new Promise(function (resolve) {
         var start = Date.now();
         var lastActivity = Date.now();
         var pending = 0;
         var po = null;
         try {
           if (typeof PerformanceObserver !== "undefined") {
             po = new PerformanceObserver(function (list) {
               var entries = list.getEntries();
               for (var i = 0; i < entries.length; i++) {
                 var e = entries[i];
                 if (e.entryType === "resource") {
                   if (e.responseEnd === 0 && e.startTime > 0) pending++;
                   else pending = Math.max(0, pending - 1);
                   lastActivity = Date.now();
                 }
               }
             });
             po.observe({ entryTypes: ["resource"] });
           }
         } catch (e) { po = null; }
         var done = false;
         function finish() {
           if (done) return; done = true;
           if (po && po.disconnect) { try { po.disconnect(); } catch (e2) {} }
           resolve();
         }
         var iv = setInterval(function () {
           var ready = (document.readyState === "complete" || document.readyState === "interactive");
           var idleLongEnough = (pending === 0 && (Date.now() - lastActivity) >= stableFor);
           if ((ready && idleLongEnough) || (Date.now() - start) >= timeout) finish();
    }, (jarvisBusy ? 60 : 150));
         setTimeout(finish, timeout + 600);
       });
     }

     function runPlanSequential(plans, idx, userText, depth, onComplete) {
       if (idx >= plans.length) {
         addBubble("jarvis", "✅ Selesai.");
         focusInput();
         if (onComplete) onComplete();
         return;
       }
       if (depth > 6) {
         addBubble("jarvis", "…(had langkah ReAct dicapai, berhenti).");
         focusInput();
        if (onComplete) onComplete();
        return;
      }
       // Before the FIRST step of a (handed-off) plan, wait for the page to settle
       // so SPA content (e.g. YouTube search results) is present before we act.
       if (idx === 0) {
         waitForPageStable().then(function () { step(); });
         return;
       }
       // Run the step inside a guard so a thrown error in any action can never
       // leave the queue stuck (jarvisBusy would stay true and block all later
       // commands). On failure we skip the step and keep going.
        function step() {
         var plan = plans[idx];
         var next = plans[idx + 1];
         if (tryCollapseNav(plans, idx, userText)) {
           if (idx + 2 >= plans.length && onComplete) onComplete();
           return;
         }
         var act = String(plan.action || "").toLowerCase();
         var advanced = false;
            function advance(res) {
             if (advanced) return; advanced = true;
             scrollToBottom();
             var isLocalDomFail = (act === "click" || act === "fill") && res && res.ok === false;
             if (isLocalDomFail && depth < 3) {
               rePlanStep(plan, userText, function () {
                 runPlanSequential(plans, idx + 1, userText, depth + 1, onComplete);
               });
             } else {
               runPlanSequential(plans, idx + 1, userText, depth, onComplete);
             }
           }
          // GATE (Preview Plan OFF): never click the page unless the user
          // explicitly typed a click keyword ("klik"/"click"/...). Skip the step
          // so JARVIS never acts on its own; the rest of the plan still runs.
          if (jarvisPreviewPlan === false && isClickAction(plan.action) && !hasClickKeyword(userText)) {
            addBubble("jarvis", "⚠️ Tindakan klik dibatalkan (tiada kata 'klik'). Taip 'klik' untuk benarkan.");
            advance({ ok: true, skipped: true });
            return;
          }
          // A `fill` (especially into a search box) can submit the form and
          // navigate to a new page. If it does, the remaining steps must run on
          // the LOADED page, not on the pre-navigation DOM. Arm the rest of the
          // plan for this tab so the background delivers it once the new page
          // finishes loading; only fall back to running inline if no navigation
          // occurs shortly after.
          if (act === "fill" && next) {
            runSinglePlan(plan, userText);
            deferRemainingOnNav(plans, idx, userText, advance);
            return;
          }
          runSinglePlan(plan, userText, advance);
        }
       try {
         step();
      } catch (e) {
        recordJarvisError("runPlanSequential.step:" + (plans[idx] && plans[idx].action), e);
        addBubble("jarvis", "⚠️ Langkah \"" + (plans[idx] && plans[idx].action) + "\" gagal dijalankan (ralat). Teruskan langkah seterusnya.");
        runPlanSequential(plans, idx + 1, userText, depth, onComplete);
      }
     }

     // When a `fill` step submits the page (e.g. a search box) and navigates,
     // the remaining plan must run on the page that just loaded. We arm it on the
     // background the moment the navigation actually starts (pagehide), so it is
     // delivered after the new page finishes loading. If no navigation happens,
     // the next step runs inline as usual.
     function deferRemainingOnNav(plans, idx, userText, advance) {
       var remaining = plans.slice(idx + 1);
       var navigated = false;
       function onHide() {
         if (navigated) return;
         navigated = true;
         try {
           if (api && api.runtime && api.runtime.sendMessage) {
             api.runtime.sendMessage({ type: "jarvis-arm-pending-plan", plan: remaining, userText: userText || "" });
           }
         } catch (e) {}
       }
       window.addEventListener("pagehide", onHide, true);
       window.addEventListener("beforeunload", onHide, true);
       setTimeout(function () {
         window.removeEventListener("pagehide", onHide, true);
         window.removeEventListener("beforeunload", onHide, true);
         if (!navigated) advance();
       }, 1600);
     }

      // Ayat tambahan TETAP yang dilampirkan ke Gemini untuk SETIAP perintah "cari".
      // Ayat tambahan TETAP yang dilampirkan ke Gemini untuk SETIAP perintah "cari".
      // Nilai boleh diubah & disimpan oleh pengguna melalui arahan //cari.
      var CARI_SUFFIX_KEY = "lp_jarvis_cari_suffix";
      var CARI_SUFFIX = "(berikan info lengkap,carian mesti dari pelbagai sumber. Sediakan link LANGSUNG (boleh klik) ke semua media sosial & video berkaitan. Jika ia sesuatu yang boleh dibeli, sediakan juga link ke Shopee, Lazada & platform beli-belah seumpamanya. JANGAN sekadar terangkan gambar/perkara ini.)";
      // Muat ayat tersimpan (jika ada) supaya kekal selepas muat semula.
      try {
        api.storage.local.get(CARI_SUFFIX_KEY, function (res) {
          if (res && res[CARI_SUFFIX_KEY]) CARI_SUFFIX = res[CARI_SUFFIX_KEY];
        });
      } catch (e) {}

      // Buka panel editor dalam JARVIS untuk pengguna ubah & simpan ayat "cari".
      function openCariSuffixEditor() {
        if (!transcriptEl) buildPanel();
        var bubble = el("div", { className: "lp-jarvis-bubble lp-jarvis-bubble-system" });
        bubble.appendChild(el("div", { text: "Edit ayat tambahan untuk \"cari\" (disimpan & dipakai mulai sekarang):" }));
        var ta = el("textarea", { className: "lp-jarvis-cari-suffix-editor" });
        ta.value = CARI_SUFFIX;
        ta.style.cssText = "width:100%;min-height:130px;margin:6px 0;box-sizing:border-box;font:inherit;";
        bubble.appendChild(ta);
        function save() {
          var v = (ta.value || "").trim();
          if (!v) { addBubble("jarvis", "Ayat tak boleh kosong — edit dibatalkan."); bubble.remove(); return; }
          CARI_SUFFIX = v;
          try { api.storage.local.set({ [CARI_SUFFIX_KEY]: v }); } catch (e2) {}
          bubble.remove();
          addBubble("jarvis", "✅ Ayat carian dikemas kini. Taip \"cari <topik>\" untuk cuba.");
        }
        function cancel() {
          bubble.remove();
          addBubble("jarvis", "Dibatalkan.");
        }
        var bSave = el("button", { className: "lp-jarvis-confirm", text: "Simpan" });
        bSave.addEventListener("click", save);
        var bCancel = el("button", { className: "lp-jarvis-confirm lp-jarvis-choice-cancel", text: "Batal" });
        bCancel.addEventListener("click", cancel);
        bubble.appendChild(el("div", { className: "lp-jarvis-choice-row" }, [bSave, bCancel]));
        transcriptEl.appendChild(bubble);
        scrollToBottom();
        try { ta.focus(); } catch (e3) {}
      }

     // "cari" → hantar terus teks pengguna + CARI_SUFFIX ke Gemini DALAM panel
     // JARVIS (via sendToProvider). Tiada konteks halaman, tiada panel pilihan
     // enjin/lokasi, tiada carian dalam halaman.
     function cariKeGemini(text, done) {
       addUserBubble(text);
       sendToProvider(text + CARI_SUFFIX, function () {
         if (done) done();
       });
     }

     // Fallback untuk "buka X" (perkataan bukan laman dikenali): hantar teks
     // mentah ke Gemini untuk tafsiran (TIADA ayat carian ditambah, TIADA panel).
     function cariAskAI(text, pre, done) {
       addUserBubble(text);
       sendToProvider(text, function () {
         if (done) done();
       });
     }

     function runIntent(intent) {
    switch (intent.type) {
      case "save": doSave(); break;
      case "pomodoro": doPomodoro(intent.minutes); break;
      case "open-category": doOpenCategory(intent.query); break;
      case "summarize": doSummarize(); break;
      case "search":
        if (intent.mode === "library" || intent.mode === "both") doLibrarySearch(intent.query);
        if (intent.mode === "web" || intent.mode === "both") sendWebSearch(intent.query);
        if (intent.mode === "youtube") sendYouTubeSearch(intent.query);
        break;
      case "scroll": doScroll(intent.direction); break;
      case "click": doClick(intent.target, intent.index); break;
      case "fill": doFill(intent.field, intent.value, intent.index); break;
      case "open_url": doOpenUrl(intent.target); break;
      case "navigate": doNavigate(intent.target); break;
      case "click_first_link": doClickFirstLink(); break;
      case "new_tab": sendBrowser("new_tab", {}); break;
      case "close_tab": sendBrowser("close_tab", {}); break;
      case "close_all_tabs": sendBrowser("close_all_tabs", {}); break;
      case "reload": sendBrowser("reload", {}); break;
      case "back": sendBrowser("back", {}); break;
      case "forward": sendBrowser("forward", {}); break;
      case "bookmark": sendBrowser("bookmark", {}); break;
      case "open_sidebar": sendAddon("open_sidebar"); break;
      case "open_library_link": doOpenLibraryLink(intent.query); break;
      case "open_library": sendAddon("open_library"); break;
      case "toggle_notes": sendAddon("toggle_notes"); break;
      case "toggle_pomodoro": sendAddon("toggle_pomodoro"); break;
      case "open_settings": sendAddon("open_settings"); break;
      case "open_automation": openAutomation(); break;
      case "create_automation": createAutomationFromChat(intent.raw); break;
      case "run_automation": runAutomationByName(intent.name); break;
      case "delete_automation": deleteAutomationByName(intent.name); break;
      case "toggle_ai_overlay": sendAddon("toggle_ai_overlay"); break;
      case "copy_answer": doCopyAnswer(); break;
      case "copy_url": doCopyUrl(); break;
      case "copy_markdown": doCopyMarkdown(); break;
      case "save_answer_note": doSaveAnswerToNote(); break;
      case "translate_selection": doTranslateSelection(str(intent.query)); break;
      case "summarize_selection": doSummarizeSelection(str(intent.query)); break;
      case "print_page": sendBrowser("print", {}); break;
      case "duplicate_tab": sendBrowser("duplicate_tab", {}); break;
      case "zoom": sendBrowser("zoom", { direction: intent.direction === "out" ? "out" : "in" }); break;
      case "help":
        showCapabilities();
        break;
      case "crosstab":
        handleCrossTab(intent);
        break;
      case "self_check": runSelfCheck(function () {}); break;
      case "export_diagnostic": exportDiagnostic(function () {}); break;
      case "chat":
      default:
        doChat(intent.raw);
        break;
    }
  }

  /* ---------- #4 Cross-tab Context Awareness ---------- */

  // Selesaikan rujukan tab ("tab 2", "tab kiri", "tab tadi", URL) kepada satu
  // entri konteks. `contexts` ialah senarai terkini (susun ikut posisi bar,
  // tab semasa disertakan supaya jiran kiri/kanan boleh diselesaikan).
  function currentContextIndex(contexts) {
    if (currentTabId == null) return -1;
    for (var i = 0; i < contexts.length; i++) {
      if (contexts[i].tabId === currentTabId) return i;
    }
    return -1;
  }

  function pickTabByRef(contexts, intent) {
    if (!Array.isArray(contexts) || !contexts.length) return null;
    if (intent && intent.url) {
      var u = String(intent.url).toLowerCase();
      var hit = contexts.filter(function (c) { return c.url && c.url.toLowerCase().indexOf(u) !== -1; })[0];
      if (hit) return hit;
    }
    var ref = intent && intent.ref ? intent.ref : null;
    var ord = (typeof (intent && intent.ordinal) === "number") ? intent.ordinal : null;
    if (ord != null && ord >= 1 && ord <= contexts.length) return contexts[ord - 1];
    if (ref === "current") return null;
    // "prev"/"tadi"/"sebelah" = jiran kiri; "left" = kiri; "right"/"kanan" = kanan.
    var ci = currentContextIndex(contexts);
    var wantLeft = (ref === "prev" || ref === "left" || ref === "sebelah");
    if (ci === -1) {
      return wantLeft ? contexts[contexts.length - 1] : contexts[0];
    }
    if (wantLeft) return ci > 0 ? contexts[ci - 1] : contexts[ci];
    return ci < contexts.length - 1 ? contexts[ci + 1] : contexts[ci];
  }

  function fmtTabList(contexts) {
    try {
      if (window.LocalPocketCrossTabPrompts && window.LocalPocketCrossTabPrompts.formatTabList) {
        return window.LocalPocketCrossTabPrompts.formatTabList(contexts, currentTabId);
      }
    } catch (e) {}
    return "Tiada tab lain yang dibuka.";
  }
  function fmtTabGroups(contexts) {
    try {
      if (window.LocalPocketCrossTabPrompts && window.LocalPocketCrossTabPrompts.formatTabGroups) {
        return window.LocalPocketCrossTabPrompts.formatTabGroups(contexts, currentTabId);
      }
    } catch (e) {}
    return "Tiada kumpulan tab dikesan.";
  }

   var pendingCloseOthers = false;
   var pendingCloseTab = null;
   // Makro terakhir yang dicipta via //auto — dibenarkan edit (namakan/jadual)
   // terus dari chat selepas disimpan.
   var lastAutoMacro = null;

  function handleCrossTab(intent) {
    var action = (intent && intent.action) || "list-tabs";
    if (action === "list-tabs") {
      getCrossTabContexts(20).then(function (ctxs) { addBubble("jarvis", fmtTabList(ctxs)); });
      return;
    }
    if (action === "list-groups") {
      getCrossTabContexts(40).then(function (ctxs) { addBubble("jarvis", fmtTabGroups(ctxs)); });
      return;
    }
    if (action === "close-others") {
      pendingCloseOthers = true;
      addBubble("jarvis", "Tutup SEMUA tab lain (kecuali tab ini)? Jawab “ya” untuk sahkan. Tab AI provider akan dikekalkan.");
      return;
    }
    if (action === "close-tab") {
      if (!intent.ordinal) { addBubble("jarvis", "Nyatakan nombor tab, cth. “tutup tab 3”."); return; }
      pendingCloseTab = Number(intent.ordinal);
      addBubble("jarvis", "Tutup tab " + intent.ordinal + "? Jawab “ya” untuk sahkan.");
      return;
    }
    if (action === "describe-tab") {
      // "tab ini" = tab semasa -> tak perlu rentas tab, hantar ke chat biasa.
      if (intent && intent.ref === "current") { doChat(intent.raw); return; }
      getCrossTabContexts(20).then(function (ctxs) {
        var target = pickTabByRef(ctxs, intent);
        if (!target) { addBubble("jarvis", "Tiada tab sepadan. " + fmtTabList(ctxs)); return; }
        // Suntik HANYA tab berkaitan (bukan semua) untuk kecekapan + kejelasan.
        currentCrossTabContexts = [target];
        var lead = "Huraikan / ringkaskan kandungan tab berikut (tajuk: " + (target.title || target.url) + "):\n" + (target.textPreview || target.url);
        var ctxt = { title: target.title, url: target.url, text: target.textPreview || "" };
        lastUserText = intent.raw || lead;
        sendToProvider(Core.buildConversationPrompt(lead, ctxt, history, chatPromptOpts()), function () {});
      });
      return;
    }
    if (action === "compare-tabs") {
      getCrossTabContexts(20).then(function (ctxs) {
        var a = pickTabByRef(ctxs, { ordinal: intent.ordinalA || 1 });
        var b = pickTabByRef(ctxs, { ordinal: intent.ordinalB || 2 }) || (ctxs[0]);
        if (!a) { addBubble("jarvis", "Tiada tab untuk dibandingkan. " + fmtTabList(ctxs)); return; }
        // Suntik HANYA kedua-dua tab yang dibandingkan.
        currentCrossTabContexts = b ? [a, b] : [a];
        var ctxt = { title: a.title, url: a.url, text: a.textPreview || "" };
        var lead = "Bandingkan KANDUNGAN dua tab berikut.\n" +
          "TAB 1: " + (a.title || a.url) + " — " + (a.textPreview || a.url) + "\n" +
          "TAB 2: " + (b ? (b.title || b.url) + " — " + (b.textPreview || b.url) : "halaman semasa") + "\n\n" +
          "Soalan: " + (intent.raw || "Apakah perbezaan utama antara kedua-duanya?");
        lastUserText = intent.raw || lead;
        sendToProvider(Core.buildConversationPrompt(lead, ctxt, history, chatPromptOpts()), function () {});
      });
      return;
    }
    addBubble("jarvis", "Arahan rentas tab tidak dikenali.");
  }

  /* ---------- Local addon actions (background) ---------- */

  function doSave() {
    try { var _ctx = Core.extractPageContext(); recordJarvisSiteAction((_ctx && _ctx.url) || "", "save"); } catch (e) {}
    api.runtime.sendMessage({ type: "jarvis-save-page" }).then(function (res) {
      if (res && res.ok) {
        addBubble("jarvis", "Disimpan: " + (res.title || "halaman ini") + ". AI sedang mengkategorikan secara automatik.");
      } else {
        addBubble("jarvis", "Gagal simpan: " + ((res && res.message) || "tidak diketahui"));
      }
    }).catch(function () { addBubble("jarvis", "Ralat sambungan ke latar."); });
  }

  // HistorySnapshot: snapshot the current conversation (turns) plus the page
  // context into storage.local so the user can revisit it later. Kept separate
  // from the web-page library (which requires a URL); this is pure conversation
  // state. Also copied to the clipboard + downloaded as JSON for easy sharing.
  function doSaveConversation() {
    try {
      if (!history.length) { addBubble("jarvis", "Tiada perbualan untuk disimpan lagi."); return; }
      var ctx = Core.extractPageContext();
      var snap = {
        id: "c" + Date.now().toString(36),
        title: (ctx && ctx.title ? ctx.title : "") + " — " + new Date().toLocaleString(),
        createdAt: Date.now(),
        page: { title: (ctx && ctx.title) || "", url: (ctx && ctx.url) || "" },
        turns: history.slice()
      };
      lpStorageGet([CONVO_KEY], function (data) {
        var arr = (data && Array.isArray(data[CONVO_KEY])) ? data[CONVO_KEY] : [];
        arr.push(snap);
        if (arr.length > CONVO_CAP) arr = arr.slice(-CONVO_CAP);
        api.storage.local.set({ [CONVO_KEY]: arr }, function () {
          addBubble("jarvis", "Perbualan disimpan (" + arr.length + "/" + CONVO_CAP + " snapshot). Tajuk: " + snap.title);
        });
      });
      // Best-effort clipboard + file download for sharing.
      try {
        var json = JSON.stringify(snap, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).catch(function () {});
        var blob = new Blob([json], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = "jarvis-conversation-" + snap.id + ".json";
        document.body.appendChild(a); a.click();
        setTimeout(function () { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e2) {} }, 1000);
      } catch (e) {}
    } catch (e) {
      addBubble("jarvis", "Gagal simpan perbualan: " + (e && e.message ? e.message : e));
    }
  }

  function listConversations() {
    lpStorageGet([CONVO_KEY], function (data) {
      var arr = (data && Array.isArray(data[CONVO_KEY])) ? data[CONVO_KEY] : [];
      if (!arr.length) { addBubble("jarvis", "Tiada snapshot perbualan disimpan."); return; }
      var lines = arr.slice().reverse().slice(0, 10).map(function (c, i) {
        return "• " + (c.title || c.id) + " (" + ((c.turns && c.turns.length) || 0) + " pusingan)";
      });
      addBubble("jarvis", "Snapshot perbualan (" + arr.length + "):\n" + lines.join("\n"));
    });
  }

  // Format hasil carian library sebagai teks dengan link boleh klik.
  // renderBubble -> linkify() tukar [tajuk](url) menjadi <a target="_blank">,
  // jadi klik terus buka artikel di tab baru. Kurungan dalam tajuk dibuang
  // supaya tak rosakkan syntax markdown linkify.
  function libraryLinkLines(results) {
    return (results || []).map(function (r) {
      var cat = r && r.category ? " (" + r.category + ")" : "";
      var title = (r && (r.title || (r.text ? String(r.text).slice(0, 60) : r.url))) || "(tanpa tajuk)";
      var safe = String(title).replace(/[\[\]()]/g, " ");
      if (r && r.url) return "\u2022 [" + safe + "](" + r.url + ")" + cat;
      return "\u2022 " + safe + cat;
    });
  }

  function doLibrarySearch(query) {
    var q = String(query || "").trim();
    if (!q) { addBubble("jarvis", "Nak cari apa dalam simpanan?"); return; }
    doLibraryKeywordSearch(q);
  }

  // Had atas bilangan padanan simpanan yang dipaparkan supaya jawapan
  // "cari" tidak jadi terlalu panjang (cth. 102 padanan "anime").
  var MAX_LIBRARY_RESULTS = 8;

  function doLibraryKeywordSearch(query) {
    api.runtime.sendMessage({ type: "jarvis-search-library", query: query }).then(function (res) {
      if (res && res.ok && res.results && res.results.length) {
        var all = res.results;
        var shown = all.slice(0, MAX_LIBRARY_RESULTS);
        var head = "Dalam simpanan anda (" + all.length + "):";
        var body = libraryLinkLines(shown).join("\n");
        if (all.length > shown.length) {
          body += "\n…dan " + (all.length - shown.length) + " lagi. Taip \"cari " + query + " dalam simpanan\" untuk lihat semua, atau semak panel Simpanan.";
        }
        addBubble("jarvis", head + "\n" + body);
      } else {
        addBubble("jarvis", "Tiada padanan dalam simpanan untuk \"" + query + "\".");
      }
    }).catch(function () { addBubble("jarvis", "Ralat carian library."); });
  }

  function doOpenLibraryLink(query) {
    var q = String(query || "").trim();
    if (!q) { addBubble("jarvis", "Buka link apa dalam simpanan?"); return; }
    doLibraryKeywordSearch(q);
  }

  function doOpenCategory(name) {
    api.runtime.sendMessage({ type: "jarvis-open-category", name: name }).then(function (res) {
      addBubble("jarvis", res && res.ok
        ? "Membuka Category Picker" + (name ? ' untuk "' + name + '"' : "") + "."
        : "Gagal buka Category Picker.");
    }).catch(function () { addBubble("jarvis", "Ralat buka picker."); });
  }

  function doPomodoro(minutes) {
    api.runtime.sendMessage({ type: "jarvis-pomodoro", minutes: minutes }).then(function (res) {
      addBubble("jarvis", res && res.ok ? "Pomodoro " + minutes + " minit dimulakan." : "Gagal mula Pomodoro.");
    }).catch(function () { addBubble("jarvis", "Ralat Pomodoro."); });
  }

  function sendWebSearch(query) {
    api.runtime.sendMessage({ type: "jarvis-web-search", query: query }).then(function (res) {
      addBubble("jarvis", res && res.ok
        ? "Membuka carian web untuk \"" + query + "\"."
        : "Gagal buka carian web.");
    }).catch(function () { addBubble("jarvis", "Gagal buka carian web."); });
  }

  function sendYouTubeSearch(query, pendingPlan, userText) {
    var url = "https://www.youtube.com/results?search_query=" + encodeURIComponent(query || "");
    var payload = { url: url };
    console.log("[JARVIS-DEBUG] sendYouTubeSearch query=" + query + " pendingPlan=" + (pendingPlan && pendingPlan.length ? JSON.stringify(pendingPlan) : "none"));
    if (pendingPlan && pendingPlan.length) { payload.pendingPlan = pendingPlan; payload.userText = userText || ""; }
    sendBrowser("open_url", payload);
    addBubble("jarvis", "Membuka carian YouTube untuk \"" + query + "\".");
  }

  // Open several distinct YouTube search tabs for one topic (e.g. "buka 5 tab").
  // When pendingPlan is given (chained command like "buka youtube dan klik link
  // pertama"), it is attached to the FIRST opened tab so the next step runs there
  // once it finishes loading.
  var YT_VARIANTS = ["", " tutorial", " news", " explained", " for beginners", " 2024", " vs", " review"];
  function openYouTubeTabs(query, count, pendingPlan, userText) {
    var n = Math.max(1, Math.min(count || 5, 10));
    for (var i = 0; i < n; i++) {
      var q = (query + (YT_VARIANTS[i] || (" " + (i + 1)))).trim();
      var url = "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
      var payload = { url: url };
      if (i === 0 && pendingPlan && pendingPlan.length) { payload.pendingPlan = pendingPlan; payload.userText = userText || ""; }
      sendBrowser("open_url", payload);
    }
    addBubble("jarvis", "Membuka " + n + " tab YouTube untuk \"" + query + "\".");
  }

  /* ---------- Browser / addon actions (background) ---------- */

  function sendBrowser(action, payload) {
    payload = payload || {};
    payload.type = "jarvis-browser-action";
    payload.action = action;
    api.runtime.sendMessage(payload).then(function (res) {
      if (!res || !res.ok) {
        addBubble("jarvis", "Gagal: " + ((res && res.message) || action));
      } else if (res.message) {
        addBubble("jarvis", res.message);
      }
    }).catch(function () { addBubble("jarvis", "Ralat kawalan browser."); });
  }

  function sendAddon(action) {
    api.runtime.sendMessage({ type: "jarvis-addon-action", action: action }).then(function (res) {
      addBubble("jarvis", res && res.ok
        ? (res.message || "OK.")
        : "Gagal: " + ((res && res.message) || action));
    }).catch(function () { addBubble("jarvis", "Ralat kawalan add-on."); });
  }

  function doOpenUrl(target) {
    var url = Core.toUrl(target);
    if (url) {
      sendBrowser("open_url", { url: url });
    } else {
      sendWebSearch(target);
    }
  }

  // Like doOpenUrl but also asks the background to click the first link in the
  // newly opened tab once it has loaded (the click can't run inline because a
  // new tab is a different content-script context).
  function doOpenUrlWithAction(target, pendingAction, pendingPlan, userText) {
    var url = Core.toUrl(target);
    if (url) {
      var payload = { url: url };
      if (pendingPlan && pendingPlan.length) { payload.pendingPlan = pendingPlan; payload.userText = userText || ""; }
      else if (pendingAction) { payload.pendingAction = pendingAction; }
      sendBrowser("open_url", payload);
    } else {
      sendWebSearch(target);
    }
  }

  // Navigate the CURRENT tab to a URL (replaces the page) instead of opening a
  // new tab. Needed for chained commands like "buka youtube di halaman ini dan
  // klik link pertama" where the next step must act on the loaded page. When
  // pendingPlan is set, the background runs the remaining plan steps in the
  // loaded tab (the inline context is destroyed by the navigation).
  function doNavigate(target, pendingAction, pendingPlan, userText) {
    var url = Core.toUrl(target) || (Core.isUrl(target) ? "https://" + target : null);
    if (!url) { addBubble("jarvis", "URL tak sah: " + target); return; }
    var payload = { url: url };
    if (pendingPlan && pendingPlan.length) { payload.pendingPlan = pendingPlan; payload.userText = userText || ""; }
    else if (pendingAction) { payload.pendingAction = pendingAction; }
    sendBrowser("navigate", payload);
  }

  // Click the first real, navigable hyperlink in the current page. Polls
  // briefly so it also works right after a navigation (the link may not exist
  // yet). Uses walkAll() so links inside iframes / shadow DOM (same-origin) are
  // considered, and skips no-op anchors (logo, "#" toggles, javascript:, etc.)
  // in favour of the first genuine content link.
   function doClickFirstLink(done, target) {
    console.log("[JARVIS-DEBUG] doClickFirstLink start (tab=" + (window.location && window.location.href || "") + ")");
    jarvisDebug("KLIK: cari link" + (target ? " \"" + target + "\"" : " pertama") + " di " + (window.location && window.location.hostname || ""));
    var tgt = (target || "").toLowerCase().trim();
    function firstLink() {
      var firstReal = null;
      var firstText = null;
      var firstMatch = null;
      try {
        walkAll(document.documentElement, function (node) {
          if (firstMatch) return;
          if (!node.tagName || node.tagName.toLowerCase() !== "a") return;
          if (!isVisible(node)) return;
          var href = (node.getAttribute("href") || "").trim();
          if (!href) return;
          if (/^(#|javascript:|about:|mailto:|tel:|data:|blob:)/i.test(href)) return;
          if (!/^(https?:|\/|[\w.-]+\.[a-z]{2,}(\/|$))/i.test(href)) return;
          if (!firstReal) firstReal = node;
          var txt = (node.textContent || "").trim();
          if (txt && !firstText) firstText = node;
          if (tgt && txt && txt.toLowerCase().indexOf(tgt) !== -1) firstMatch = node;
        });
      } catch (e) {}
      return firstMatch || firstText || firstReal;
    }
    var tries = 0;
    function attempt() {
      var a = firstLink();
      if (a) {
        var url = "";
        try { url = a.href || ""; } catch (e) {}
        var label = ((a.textContent || url || "").trim().slice(0, 60));
        try { a.scrollIntoView({ block: "center" }); } catch (e) {}
        try {
          // Navigate directly to the link. YouTube/Google SPAs intercept link
          // clicks and ignore programmatic (untrusted) a.click() events, so a
          // synthetic click alone often does nothing. a.href is already the
          // fully-resolved absolute URL, so this is equivalent to clicking it.
          if (/^https?:/i.test(url)) {
            if (window.top && window.top !== window) {
              try { window.top.location.href = url; }
              catch (e2) { window.location.href = url; }
            } else {
              window.location.href = url;
            }
          } else {
            a.click();
          }
          addBubble("jarvis", "Mengklik link" + (tgt ? " \"" + tgt + "\"" : " pertama") + ": " + label);
        } catch (e) {
          try { a.click(); addBubble("jarvis", "Mengklik link" + (tgt ? " \"" + tgt + "\"" : " pertama") + ": " + label); }
          catch (e2) { addBubble("jarvis", "Gagal klik link" + (tgt ? " \"" + tgt + "\"" : " pertama") + "."); }
        }
        if (done) done();
        return;
      }
      tries++;
      if (tries < 40) {
        setTimeout(attempt, 200);
      } else {
        addBubble("jarvis", "Tiada link pertama dijumpai dalam halaman (mungkin belum dimuat).");
        if (done) done();
      }
    }
    attempt();
  }

  /* ---------- Page + DOM control (local) ---------- */

  function doScroll(direction) {
    pageScroll(direction);
    addBubble("jarvis", "Tatal " + (direction === "down" ? "bawah" : "atas") + ".");
  }

   // Resolve a snapshot `index` back to the live DOM node. Uses the SAME
   // traversal order as jarvisCore.buildDomSnapshot so the index the planner
   // saw matches the node we click/fill here.
   function resolveByIndex(index) {
     var n = Number(index);
     if (!Number.isFinite(n) || n < 1) return null;
     try {
       var nodes = Core.getInteractiveNodes({ max: 200 });
       return nodes[n - 1] || null;
     } catch (e) { return null; }
   }

   function domClickByIndex(index) {
     var node = resolveByIndex(index);
     if (!node) return { ok: false, reason: "Index " + index + " tiada dalam snapshot halaman" };
     try {
       node.scrollIntoView({ block: "center" });
       node.click();
       return { ok: true, label: ((node.getAttribute("aria-label") || node.textContent || "").trim().slice(0, 40)) };
     } catch (e) {
       return { ok: false, reason: "Gagal klik index " + index };
     }
   }

   function domFillByIndex(index, value) {
     var node = resolveByIndex(index);
     if (!node) return { ok: false, reason: "Index " + index + " tiada dalam snapshot halaman" };
     try {
       node.scrollIntoView({ block: "center" });
       node.focus();
       var proto = node.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype
         : (node.tagName === "INPUT" ? HTMLInputElement.prototype : null);
       if (proto && Object.getOwnPropertyDescriptor(proto, "value")) {
         Object.getOwnPropertyDescriptor(proto, "value").set.call(node, value);
        } else if (node.getAttribute("contenteditable") != null && node.getAttribute("contenteditable").toLowerCase() !== "false") {
         node.textContent = value;
       } else {
         node.value = value;
       }
       node.dispatchEvent(new Event("input", { bubbles: true }));
       node.dispatchEvent(new Event("change", { bubbles: true }));
       return { ok: true };
     } catch (e) {
       return { ok: false, reason: "Gagal isi index " + index };
     }
   }

   function doClick(target, index) {
     var r;
     if (index != null && index !== "") {
       // Grounding: prefer the snapshot index; fall back to text if it fails.
       r = domClickByIndex(index);
       if (!r.ok && target) r = domClick(target);
     } else if (target) {
       // SmartElementNavigator: resolve visible text -> snapshot index via the
       // element memory/hints mapping, so "klik butang Langgan" hits the right
       // node without a planner round-trip.
       var hi = recallElement(siteHost(), target);
       if (hi != null) {
         r = domClickByIndex(hi);
         if (!r.ok) r = domClick(target);
       } else {
         r = domClick(target);
       }
     } else {
       r = { ok: false, reason: "Tiada sasaran" };
     }
      if (r.ok) addBubble("jarvis", "Mengklik: " + (r.label || target || ("index " + index)));
      else addBubble("jarvis", "Gagal klik \"" + (target || index) + "\": " + (r.reason || "elemen tak dijumpai") + ". Mungkin elemen berada dalam iframe lintas-domain, tersembunyi, atau disabled — JARVIS tak dapat \u201cnampak\u201dnya.");
      return r;
   }

    function askFillValue(field, cb) {
      var backdrop = el("div", { className: "lp-jarvis-modal-backdrop" });
      var modal = el("div", { className: "lp-jarvis-modal" });
      modal.appendChild(el("div", { className: "lp-jarvis-modal-title", text: "📝 Nilai untuk \"" + field + "\"" }));
      modal.appendChild(el("div", { className: "lp-jarvis-modal-desc", text: "Taip nilai yang nak diisi ke medan \"" + field + "\":" }));
      var ta = el("textarea", { className: "lp-jarvis-modal-textarea", placeholder: "Contoh: a@b.com" });
      modal.appendChild(ta);
      var row = el("div", { className: "lp-jarvis-modal-btnrow" });
      var ok = el("button", { className: "lp-jarvis-modal-btn lp-jarvis-modal-btn-primary", text: "Isi" });
      var cancel = el("button", { className: "lp-jarvis-modal-btn", text: "Batal" });
      row.appendChild(ok); row.appendChild(cancel);
      modal.appendChild(row);
      backdrop.appendChild(modal);
      if (root) root.appendChild(backdrop);
      setTimeout(function () { try { ta.focus(); } catch (e) {} }, 50);
      function submit() { var v = (ta.value || "").trim(); backdrop.remove(); cb(v || null); }
      ok.addEventListener("click", submit);
      ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } });
      cancel.addEventListener("click", function () { backdrop.remove(); cb(null); });
      backdrop.addEventListener("click", function (e) { if (e.target === backdrop) { backdrop.remove(); cb(null); } });
    }

    function doFill(field, value, index) {
      // 'text'/'query' dah ditukar ke 'value' oleh pemanggil (automationHandlers).
      if ((!value || !String(value).trim()) && field) {
        askFillValue(field, function (val) {
          if (val == null) { addBubble("jarvis", "Dibatalkan — tiada nilai diisi ke \"" + field + "\"."); return; }
          doFill(field, val, index);
        });
        return;
      }
      var r;
      if (field && String(field).trim()) {
        var fi = recallElement(siteHost(), field);
        if (fi != null) {
          r = domFillByIndex(fi, value);
          if (!r.ok) r = domFill(field, value);
        } else {
          r = domFill(field, value);
        }
      } else if (index != null && index !== "" && Number(index) > 0) {
        // Hanya guna index bila >0 (0 = tiada index, bukan elemen pertama).
        r = domFillByIndex(index, value);
      } else {
        // Tiada field & tiada index sah — isi ke elemen FOKUS (activeElement).
        // Ini mengendalikan "taip X" tanpa sasaran medan tertentu.
        r = domFillFocused(value);
        if (!r || !r.ok) r = { ok: false, reason: "Tiada medan fokus — klik medan dahulu atau nyatakan field" };
      }
      if (r.ok) addBubble("jarvis", "Mengisi \"" + (field || (index ? ("index " + index) : "medan fokus")) + "\" dengan \"" + value + "\".");
      else addBubble("jarvis", "Gagal isi \"" + (field || index || "fokus") + "\": " + (r.reason || "medan tak dijumpai") + ". Semak ejaan label medan, atau elemen mungkin dalam iframe lintas-domain / tersembunyi.");
      return r;
    }

    // Isi ke elemen yang sedang fokus (document.activeElement) — untuk arahan
    // "taip X" tanpa medan tertentu.
    function domFillFocused(value) {
      var inp = document.activeElement;
      if (!inp) return { ok: false, reason: "Tiada elemen fokus" };
      var t = inp.tagName ? inp.tagName.toLowerCase() : "";
      var ce = inp.getAttribute && inp.getAttribute("contenteditable");
      if (t !== "input" && t !== "textarea" && (ce == null || ce.toLowerCase() === "false")) {
        return { ok: false, reason: "Elemen fokus bukan medan input" };
      }
      try {
        inp.scrollIntoView({ block: "center" });
        inp.focus();
        var proto = inp.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype
          : (inp.tagName === "INPUT" ? HTMLInputElement.prototype : null);
        if (proto && Object.getOwnPropertyDescriptor(proto, "value")) {
          Object.getOwnPropertyDescriptor(proto, "value").set.call(inp, value);
        } else {
          inp.textContent = value;
        }
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
        if (isSearchField(inp)) {
          if (location.hostname && /(^|\.)youtube\.com$/i.test(location.hostname)) {
            try {
              window.location.href = "https://www.youtube.com/results?search_query=" + encodeURIComponent(value || "");
              return { ok: true };
            } catch (e2) {}
          }
          submitSearchField(inp);
        }
        return { ok: true };
      } catch (e) { return { ok: false, reason: "Gagal isi" }; }
    }


   function doSnapshot() {
     var snap = Core.buildDomSnapshot({ max: 80 });
     if (!snap || !snap.length) {
       addBubble("jarvis", "Tiada elemen interaktif dijumpai dalam halaman ini.");
       return;
     }
     var lines = snap.slice(0, 40).map(function (el) {
       var bits = [];
       if (el.text) bits.push("teks:" + el.text);
       if (el.aria) bits.push("aria:" + el.aria);
       if (el.placeholder) bits.push("ph:" + el.placeholder);
       if (el.input) bits.push("[input]");
       return "[" + el.i + "] <" + el.tag + "> " + bits.join(" ");
     });
     addBubble("jarvis", "Elemen interaktif halaman (" + snap.length + "):\n" + lines.join("\n"));
   }

  function pageScroll(direction) {
    try {
      window.scrollBy({ top: direction === "down" ? 600 : -600, behavior: "smooth" });
    } catch (e) {
      window.scrollBy(0, direction === "down" ? 600 : -600);
    }
  }

  // Walk the entire DOM tree including Shadow DOM and SAME-ORIGIN iframes,
  // invoking `cb(node)` for every element. Cross-origin iframes can't be
  // traversed (browser security) — there is no workaround for that. The
  // JARVIS panel's own subtree is skipped so its buttons/input are never
  // matched as page targets.
  function walkAll(rootNode, cb) {
    var stack = [rootNode];
    while (stack.length) {
      var node = stack.pop();
      if (!node) continue;
      cb(node);
      if (node === root) continue; // never descend into the JARVIS panel itself
      var kids = node.children;
      if (kids && kids.length) {
        for (var i = 0; i < kids.length; i++) stack.push(kids[i]);
      }
      if (node.shadowRoot) stack.push(node.shadowRoot);
      if (node.tagName === "IFRAME" && node.contentDocument) {
        try { stack.push(node.contentDocument); } catch (e) {}
      }
    }
  }

  function isVisible(node) {
    try {
      if (node.offsetWidth > 0 && node.offsetHeight > 0) return true;
      var rect = node.getBoundingClientRect();
      return !!(rect && rect.width > 0 && rect.height > 0);
    } catch (e) { return true; }
  }

  function getClickableElements() {
    var out = [];
    walkAll(document.documentElement, function (node) {
      var t = node.tagName;
      if (!t) return;
      t = t.toLowerCase();
      var role = node.getAttribute && node.getAttribute("role");
      var type = (node.getAttribute && node.getAttribute("type")) || "";
      if (t === "a" || t === "button" || t === "summary" ||
          (t === "input" && /^(submit|button|reset)$/i.test(type)) ||
          role === "button") {
        if (isVisible(node)) out.push(node);
      }
    });
    return out;
  }

  function tokenizeLabel(node) {
    var label = (
      (node.getAttribute("aria-label") || "") + " " +
      (node.getAttribute("title") || "") + " " +
      (node.getAttribute("value") || "") + " " +
      (node.textContent || "")
    ).toLowerCase();
    return { label: label, words: label.split(/[\s\-_/.:,()\[\]]+/).filter(Boolean) };
  }

  function scoreElement(node, terms) {
    var info = tokenizeLabel(node);
    var words = info.words, label = info.label;
    var score = 0;
    terms.forEach(function (t) {
      if (!t) return;
      if (label.indexOf(t) === -1) return;
      // Whole-word match is far more reliable than a bare substring match:
      // "link" should not score against "linkedin", "datalink", "blink", etc.
      if (words.indexOf(t) !== -1) score += 5;
      else score += 1;
    });
    var txt = (node.textContent || "").trim().toLowerCase();
    if (terms.length && txt === terms.join(" ")) score += 6;
    // Strongly prefer an element whose visible text IS the target (e.g. a
    // "Subscribe" button) over one that merely mentions it.
    if (txt && terms.length === 1 && txt === terms[0]) score += 10;
    return score;
  }

  function isLinkNode(node) {
    var t = (node.tagName || "").toLowerCase();
    return t === "a" || (node.getAttribute && node.getAttribute("role") === "link");
  }

  function domClick(target) {
    var raw = String(target || "").trim();
    if (!raw) return { ok: false, reason: "Tiada sasaran" };
    var terms = raw.toLowerCase().split(/\s+/).filter(Boolean);
    // "klik link pertama" / "click the first link" should behave like
    // click_first_link instead of a fuzzy text match against the word "link".
    var wantsFirst = terms.some(function (t) { return t === "first" || t === "pertama" || t === "1st" || t === "awal"; });
    var wantsLink = terms.some(function (t) { return t === "link" || t === "links" || t === "pautan" || t === "tautan"; });
    if (wantsFirst && wantsLink) { doClickFirstLink(); return { ok: true, label: "link pertama" }; }
    var els = getClickableElements();
    var scored = [];
    for (var i = 0; i < els.length; i++) {
      var s = scoreElement(els[i], terms);
      if (s <= 0) continue;
      // Bias towards anchors when the user is clearly asking for a link.
      if (wantsLink && isLinkNode(els[i])) s += 4;
      scored.push({ el: els[i], score: s });
    }
    if (!scored.length) return { ok: false, reason: "Elemen tak dijumpai" };
    scored.sort(function (a, b) { return b.score - a.score; });
    var best = scored[0].el;
    try {
      best.scrollIntoView({ block: "center" });
      best.click();
      return { ok: true, label: ((best.getAttribute("aria-label") || best.textContent || "").trim().slice(0, 40)) };
    } catch (e) {
      return { ok: false, reason: "Gagal klik" };
    }
  }

   function findInputByField(field) {
     var raw = String(field || "").trim();
     if (!raw) return null;
     var terms = raw.toLowerCase().split(/\s+/).filter(Boolean);
     var searchSyn = /^(search|cari|query|q|carian)$/.test(raw.toLowerCase());
     var best = null, bestScore = 0;
     walkAll(document.documentElement, function (node) {
       var t = node.tagName ? node.tagName.toLowerCase() : "";
       var ce = node.getAttribute && node.getAttribute("contenteditable");
       if (t !== "input" && t !== "textarea" && (ce == null || ce.toLowerCase() === "false")) return;
       if (!isVisible(node)) return;
       var inp = node;
       var lbl = "";
       try {
         if (inp.id) {
           var lab = document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(inp.id) : inp.id) + '"]');
           if (lab) lbl += " " + lab.textContent;
         }
         if (inp.labels && inp.labels.length) {
           for (var li = 0; li < inp.labels.length; li++) lbl += " " + (inp.labels[li].textContent || "");
         }
         var alb = inp.getAttribute && inp.getAttribute("aria-labelledby");
         if (alb) {
           alb.split(/\s+/).forEach(function (id) {
             try { var el = document.getElementById(id); if (el) lbl += " " + el.textContent; } catch (e2) {}
           });
         }
       } catch (e) {}
       lbl += " " + (inp.getAttribute("aria-label") || "") + " " +
              (inp.getAttribute("placeholder") || "") + " " +
              (inp.getAttribute("title") || "") + " " + (inp.name || "") + " " +
              (inp.id || "") + " " + (inp.getAttribute("type") || "") + " " +
              (inp.getAttribute("role") || "") + " " + (inp.value || "");
       lbl = lbl.toLowerCase();
       var s = 0;
       terms.forEach(function (tt) { if (tt && lbl.indexOf(tt) !== -1) s += 2; });
       // Kalau field nampak macam carian, beri markah pada medan carian.
       if (searchSyn && isSearchField(inp)) s += 3;
       if (s > bestScore) { bestScore = s; best = inp; }
     });
     if (best) return best;
     // Fallback: medan carian paling mungkin (type=search / role=searchbox).
     if (searchSyn) {
       var cand = null;
       walkAll(document.documentElement, function (node) {
         if (cand) return;
         var t = node.tagName ? node.tagName.toLowerCase() : "";
         var ce = node.getAttribute && node.getAttribute("contenteditable");
         if (t !== "input" && t !== "textarea" && (ce == null || ce.toLowerCase() === "false")) return;
         if (!isVisible(node)) return;
         if (isSearchField(node)) cand = node;
       });
       return cand;
     }
     return null;
   }

   function isSearchField(inp) {
     try {
       if (!inp) return false;
       var type = inp.getAttribute && inp.getAttribute("type");
       if (type === "search") return true;
       var role = (inp.getAttribute && inp.getAttribute("role")) || "";
       if (role === "searchbox" || role === "search") return true;
       var sig = ((inp.id || "") + " " + (inp.name || "") + " " +
         (inp.getAttribute && (inp.getAttribute("aria-label") || "")) + " " +
         (inp.getAttribute && (inp.getAttribute("placeholder") || "")) + " " +
         (inp.getAttribute && (inp.getAttribute("role") || ""))).toLowerCase();
       if (/(^|\s)(search|cari|query|q)(\s|$)/.test(sig)) return true;
       try {
         if (location.hostname && /(^|\.)youtube\.com$/.test(location.hostname)) return true;
       } catch (e) {}
     } catch (e) {}
     return false;
   }

   function submitSearchField(inp) {
     // Simulate "taip dan terus enter": dispatch an Enter key so the site's own
     // keydown handler (e.g. YouTube search) performs the search / navigation.
     try {
       var opts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
       inp.dispatchEvent(new KeyboardEvent("keydown", opts));
       inp.dispatchEvent(new KeyboardEvent("keyup", opts));
     } catch (e) {}
   }

   function domFill(field, value) {
     var inp = findInputByField(field);
     if (!inp) return { ok: false, reason: "Medan tak dijumpai" };
     try {
       inp.scrollIntoView({ block: "center" });
       inp.focus();
       var proto = inp.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype
         : (inp.tagName === "INPUT" ? HTMLInputElement.prototype : null);
       if (proto && Object.getOwnPropertyDescriptor(proto, "value")) {
         Object.getOwnPropertyDescriptor(proto, "value").set.call(inp, value);
       } else {
         inp.textContent = value;
       }
       inp.dispatchEvent(new Event("input", { bubbles: true }));
       inp.dispatchEvent(new Event("change", { bubbles: true }));
       if (isSearchField(inp)) {
         // On YouTube, programmatic (untrusted) Enter key events are ignored by
         // the SPA, so navigate directly to the results page to guarantee the
         // search runs (this also triggers the navigation the plan waits on).
         if (location.hostname && /(^|\.)youtube\.com$/i.test(location.hostname)) {
           try {
             window.location.href = "https://www.youtube.com/results?search_query=" + encodeURIComponent(value || "");
             return { ok: true };
           } catch (e2) {}
         }
         submitSearchField(inp);
       }
       return { ok: true };
     } catch (e) {
       return { ok: false, reason: "Gagal isi" };
     }
   }

  /* ---------- Clipboard + selection helpers (local, no network) ---------- */

  // Copy text to the clipboard. Prefers the async Clipboard API and falls back
  // to a hidden textarea + execCommand so it works without the clipboardWrite
  // permission and inside content scripts.
  function copyText(text) {
    text = String(text || "");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        var p = navigator.clipboard.writeText(text);
        if (p && p.then) {
          return p.then(function () { return true; }).catch(function () { return fallbackCopy(text); });
        }
      } catch (e) {}
    }
    return Promise.resolve(fallbackCopy(text));
  }
  var __jarvisCopyGuard = false;
  function fallbackCopy(text) {
    if (__jarvisCopyGuard) return true;
    __jarvisCopyGuard = true;
    try {
      // Simpan pilihan semasa supaya salinan (yang memilih <textarea> sementara)
      // TIDAK mengcollapse pilihan pengguna — kalau tidak, butang pilihan terapung
      // (selButtonsEl) akan hilang dan tak muncul lagi sehingga panel dimuat semula.
      var sel = window.getSelection ? window.getSelection() : null;
      var savedRange = null;
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        try { savedRange = sel.getRangeAt(0).cloneRange(); } catch (e0) {}
      }
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.style.top = "0";
      ta.style.pointerEvents = "none";
      ta.style.left = "-9999px";
      (document.body || document.documentElement).appendChild(ta);
      ta.focus();
      ta.select();
      var ok = document.execCommand && document.execCommand("copy");
      ta.remove();
      __jarvisCopyGuard = false;
      // Pulihkan pilihan asal pengguna supaya popup & highlight kekal kelihatan.
      if (sel && savedRange) {
        try { sel.removeAllRanges(); sel.addRange(savedRange); } catch (e2) {}
      }
      return ok;
    } catch (e) { __jarvisCopyGuard = false; return false; }
  }
  // Remember the most recent page selection so "terjemah/ringkas pilihan"
  // still works after the user clicks into the JARVIS input (which clears the
  // browser selection). Selections made inside the JARVIS panel itself are
  // ignored so they don't clobber the page selection.
  var lastPageSelection = "";
  function capturePageSelection() {
    if (SIDEBAR_HOST) return; // selection lives in the active tab, fetched via observe
    try {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      var node = sel.anchorNode;
      if (node && root && root.contains(node)) return; // selection inside JARVIS
      var text = "";
      try { text = (sel.getRangeAt(0).toString() || "").trim(); } catch (eR) {}
      if (!text) try { text = (sel.getRangeAt(0).cloneContents().textContent || "").trim(); } catch (eR2) {}
      if (text) lastPageSelection = text;
    } catch (e) {}
  }
  try { document.addEventListener("selectionchange", capturePageSelection); } catch (e) {}
  function getSelectionText() {
    if (SIDEBAR_HOST) {
      // Utamakan pilihan TEKS LANGSUNG di dalam panel (cth. transkrip) — jika ada,
      // guna itu; jika tiada, jatuh balik ke pilihan dari tab aktif (di-relay).
      try {
        var s = window.getSelection();
        if (s && !s.isCollapsed && s.rangeCount > 0) {
          var r = s.getRangeAt(0);
          var panelSel = r.toString() || "";
          if (!panelSel.trim()) {
            try { panelSel = (r.cloneContents().textContent || "").trim(); } catch (e3) {}
          }
          if (panelSel && panelSel.trim()) return panelSel.trim();
        }
      } catch (e) {}
      return hostSelection || lastPageSelection || "";
    }
    try {
      var s = window.getSelection();
      if (s && !s.isCollapsed && s.rangeCount > 0) {
        var r = s.getRangeAt(0);
        var t = r.toString() || "";
        if (!t.trim()) { try { t = (r.cloneContents().textContent || "").trim(); } catch (e3) {} }
        if (t) return t;
      }
      return "";
    } catch (e) { return ""; }
  }

  function doCopyAnswer() {
    var last = null;
    for (var i = history.length - 1; i >= 0; i--) {
      if (history[i].role === "jarvis") { last = history[i].text; break; }
    }
    if (!last) { addBubble("jarvis", "Tiada jawapan untuk disalin lagi."); return; }
    copyText(last).then(function (ok) {
      addBubble("jarvis", ok ? "Jawapan terakhir disalin ke clipboard." : "Gagal salin ke clipboard.");
    });
  }
  function doCopyUrl() {
    copyText(currentPageUrl()).then(function (ok) {
      addBubble("jarvis", ok ? "URL halaman disalin." : "Gagal salin URL.");
    });
  }
  // Save JARVIS's last answer into a Local Pocket note (copied from LP Sidebar
  // AI's import-summary-to-note). Reuses the same lp-insert-ai-text-final hook.
  function doSaveAnswerToNote() {
    var last = null;
    for (var i = history.length - 1; i >= 0; i--) {
      if (history[i].role === "jarvis") { last = history[i].text; break; }
    }
    if (!last) { addBubble("jarvis", "Tiada jawapan untuk disimpan ke nota lagi."); return; }
    try {
      api.runtime.sendMessage({ type: "lp-insert-ai-text-final", text: last, mode: "append" }).catch(function () {});
      addBubble("jarvis", "Jawapan terakhir dihantar ke nota Local Pocket.");
    } catch (e2) {
        addBubble("jarvis", "Gagal hantar ke nota.");
      }
    }
    // Save the ENTIRE current conversation into a single Local Pocket note as
    // Markdown (feature #5). Reuses the existing create-note-from-summary hook
    // in notesOverlay.js; background.js forwards the message to the notes tab.
    function doSaveConversationToNote() {
      if (!history.length) {
        addBubble("jarvis", "Tiada perbualan untuk disimpan ke nota lagi.");
        return;
      }
      var ctx = Core.extractPageContext();
      var lines = [];
      lines.push("# Perbualan JARVIS — " + (ctx && ctx.title ? ctx.title : "Tanpa tajuk"));
      lines.push("");
      lines.push("URL: " + (ctx && ctx.url ? ctx.url : "-"));
      lines.push("Tarikh: " + new Date().toLocaleString());
      lines.push("");
      history.forEach(function (t) {
        var who = t.role === "user" ? "**Pengguna:**" : "**JARVIS:**";
        lines.push(who + " " + (t.text || ""));
        lines.push("");
      });
      var text = lines.join("\n");
      var title = "JARVIS: " + (ctx && ctx.title ? ctx.title : "Perbualan") + " · " + new Date().toLocaleDateString();
      try {
        api.runtime.sendMessage({ type: "create-note-from-summary", title: title, text: text }).catch(function () {});
        addBubble("jarvis", "Perbualan dihantar ke nota Local Pocket sebagai nota baru.");
      } catch (e2) {
        addBubble("jarvis", "Gagal hantar perbualan ke nota.");
      }
    }
    function doCopyMarkdown() {
    var md = "[" + currentPageTitle() + "](" + currentPageUrl() + ")";
    copyText(md).then(function (ok) {
      addBubble("jarvis", ok ? "Pautan markdown disalin: " + md : "Gagal salin.");
    });
  }
  // Append the active summary mode + tone styling to a raw provider instruction
  // (used by the selection translate action, which bypasses the page-context
  // builder). Mirrors buildConversationPrompt's opts handling.
  function appendOutputStyle(text) {
    var extra = "";
    if (summaryMode && summaryMode !== "auto") {
      if (summaryMode === "custom" && summaryCustomPrompt) {
        extra += "\n\n" + summaryCustomPrompt;
      } else {
        var m = Core.summaryModeInstruction(summaryMode, summaryCustomPrompt);
        if (m) extra += "\n\n" + m;
      }
    }
    if (tone) extra += "\n\n" + Core.toneInstruction(tone);
    return text + extra;
  }

  function doTranslateSelection(query) {
    var sel = getSelectionText() || lastPageSelection;
    if (!sel) { addBubble("jarvis", "Pilih (highlight) teks di halaman dulu, kemudian minta terjemah."); return; }
    var target = str(query) || "Bahasa Melayu";
    sendToProvider(appendOutputStyle("Terjemah teks berikut ke " + target + ":\n\n" + sel));
  }
  function doSummarizeSelection(query) {
    var sel = getSelectionText() || lastPageSelection;
    if (!sel) { addBubble("jarvis", "Pilih (highlight) teks di halaman dulu, kemudian minta ringkasan."); return; }
    var ctx = Core.extractPageContext();
    ctx.text = sel;
    var prompt = Core.buildSidebarSummaryPrompt(ctx, currentJarvisPromptOpts());
    sendToProvider(prompt);
  }

  /* ---------- AI provider (Gemini) ---------- */

  function doSummarize() {
    var ctx = Core.extractPageContext();
    // BUGFIX: jangan hantar prompt bila mod "custom" tanpa arahan — pandu pengguna.
    if (summaryMode === "custom" && !(summaryCustomPrompt && summaryCustomPrompt.trim())) {
      var _cr = document.getElementById("lp-jarvis-custom-row");
      if (_cr) _cr.style.display = "flex";
      var _ci = document.getElementById("lp-jarvis-custom-prompt");
      if (_ci) { try { _ci.focus(); } catch (e) {} }
      addBubble("jarvis", "Mod ringkasan \"Custom\" dipilih tetapi arahan custom masih kosong. Sila taip arahan ringkasan anda dalam kotak \"Custom:\" dahulu.");
      return;
    }
    recordJarvisSiteAction((ctx && ctx.url) || "", "summarize");
    var prompt = Core.buildSidebarSummaryPrompt(ctx, currentJarvisPromptOpts());
    sendToProvider(prompt);
  }

    function doChat(text, onComplete) {
      var ctx = Core.extractPageContext();
      recordJarvisSiteAction((ctx && ctx.url) || "", "ask");
      var opts = chatPromptOpts();
      withRagDocs(text, ctx, function (ragDocs) {
        opts.ragDocs = ragDocs || [];
        maybeRefreshCrossTab(text).then(function () {
          sendToProvider(Core.buildConversationPrompt(text, ctx, history, chatPromptOpts()), onComplete);
        }).catch(function () {
          sendToProvider(Core.buildConversationPrompt(text, ctx, history, chatPromptOpts()), onComplete);
        });
      });
    }

    // Soalan biasa (tiada awalan "/"): hantar HANYA teks soalan ke AI —
    // TANPA konteks halaman, snapshot DOM, atau sejarah panjang. (Peraturan
    // pengguna: soalan biasa tidak perlu prompt panjang; ringkasan/arahah
    // kekal guna konteks penuh di tempat lain.)
    function sendPlainChat(text, onComplete) {
      lastUserText = text;
      sendToProvider(text, onComplete);
    }

    // Tanya tentang SIMPANAN LINK pengguna (metadata: tajuk/URL). Cari merentasi
    // SEMUA link tersimpan mengikut keyword soalan, then hantar hanya link
    // paling relevan (bukan RAG teks, bukan dump semua — sesuai 1500+ link).
    var SAVED_STOP = { tanya:1, simpanan:1, link:1, saya:1, apa:1, dalam:1, yang:1,
      ini:1, itu:1, ada:1, boleh:1, tolong:1, bagaimana:1, siapa:1, bila:1, mana:1,
      dengan:1, dan:1, atau:1, untuk:1, pada:1, tentang:1, pasal:1, the:1, my:1,
      of:1, to:1, a:1, is:1, are:1, what:1, how:1, do:1, i:1, you:1, me:1, in:1,
      on:1, at:1, this:1, that:1, from:1, about:1 };
    function askSavedLinks(text, onComplete) {
      lastUserText = text;
      var kws = (text.toLowerCase().match(/[a-z0-9À-ÿ]+/gi) || [])
        .filter(function (w) { return w.length > 2 && !SAVED_STOP[w]; })
        .slice(0, 6);
      api.runtime.sendMessage({ type: "jarvis-library-search", keywords: kws, limit: 20 }).then(function (res) {
        var items = (res && res.ok && res.items) || [];
        var total = (res && res.totalScanned) || "?";
        var header = "Berikut ialah link simpanan pengguna yang PALING RELEVAN dengan soalan (daripada " + total + " link keseluruhan):\n";
        var body = items.length
          ? items.map(function (it, i) { return (i + 1) + ". " + (it.title || it.url) + (it.url ? " — " + it.url : ""); }).join("\n")
          : "(tiada link sepadan dalam simpanan)";
        var prompt = header + body +
          "\n\nSoalan pengguna: " + text +
          "\n\nJawab berdasarkan link di atas. Jika soalan merujuk topik/kategori tertentu, sebutkan link yang berkaitan (dengan URLnya).";
        sendToProvider(prompt, onComplete);
      }).catch(function () {
        addBubble("jarvis", "Gagal akses simpanan link.");
        if (onComplete) onComplete();
      });
    }

    // ---- Kategori: jawab soalan tentang kategori (pelan kategori, item 4) ----
    function askCategoryQuestion(text, onComplete) {
      lastUserText = text;
      api.runtime.sendMessage({ type: "jarvis-get-categories" }).then(function (res) {
        var cats = (res && res.ok && res.categories) || [];
        var n = cats.length;
        var lower = (text || "").toLowerCase();
        var reply;
        if (/(ada\s+berapa|berapa|bilangan|count|how\s+many)/.test(lower)) {
          reply = "Anda mempunyai " + n + " kategori.";
        } else {
          reply = "Anda mempunyai " + n + " kategori:";
        }
        if (n > 0) {
          reply += "\n" + cats.map(function (c, i) { return (i + 1) + ". " + c.name; }).join("\n");
        } else {
          reply += " (tiada kategori dikonfigurasi)";
        }
        addBubble("jarvis", reply);
        if (onComplete) onComplete();
      }).catch(function () {
        addBubble("jarvis", "Gagal dapatkan senarai kategori.");
        if (onComplete) onComplete();
      });
    }

    // ---- Kategori: reklasifikasi (pindah link tak sesuai B -> A) ----
    function resolveCategoryInText(span, cats) {
      if (!span) return null;
      span = String(span).toLowerCase();
      var i, nm;
      for (i = 0; i < cats.length; i++) {
        nm = cats[i].name ? cats[i].name.toLowerCase() : "";
        if (nm && span.indexOf(nm) === 0) return cats[i];
      }
      for (i = 0; i < cats.length; i++) {
        nm = cats[i].name ? cats[i].name.toLowerCase() : "";
        if (nm && span.indexOf(nm) !== -1) return cats[i];
      }
      return null;
    }

    function reclassifyCategory(text, onComplete) {
      lastUserText = text;
      api.runtime.sendMessage({ type: "jarvis-get-categories" }).then(function (res) {
        var cats = (res && res.ok && res.categories) || [];
        if (!cats.length) {
          addBubble("jarvis", "Tiada kategori dikonfigurasi.");
          return finishReclassify(onComplete);
        }
        var srcSpan = null, tgtSpan = null;
        var m;
        m = text.match(/\b(?:di|dalam|daripada|dari)\s+kategori\s+([^.?!\n]+)/i);
        if (m) srcSpan = m[1];
        m = text.match(/\b(?:ke|kepada|ke\s+pada)\s+kategori\s+([^.?!\n]+)/i);
        if (m) tgtSpan = m[1];
        if (!srcSpan) {
          m = text.match(/kategori\s+([^.?!\n]+?)\s+(?:yang\s+)?(?:tak|tidak)\s+sesuai/i);
          if (m) srcSpan = m[1];
        }
        var srcCat = resolveCategoryInText(srcSpan, cats);
        var tgtCat = resolveCategoryInText(tgtSpan, cats);
        if (!srcCat || !tgtCat) {
          addBubble("jarvis", "Sila nyatakan dengan jelas kategori sumber (B) dan kategori sasaran (A), contoh: \"pindahkan link tak sesuai di kategori B ke kategori A\".");
          return finishReclassify(onComplete);
        }
        if (srcCat.id === tgtCat.id) {
          addBubble("jarvis", "Kategori sumber dan sasaran adalah sama.");
          return finishReclassify(onComplete);
        }
        api.runtime.sendMessage({ type: "jarvis-library-search", categoryId: srcCat.id, limit: 200 }).then(function (r) {
          var items = (r && r.ok && r.items) || [];
          if (!items.length) {
            addBubble("jarvis", "Tiada link dalam kategori \"" + srcCat.name + "\". Semua sesuai, tiada dipindah.");
            return finishReclassify(onComplete);
          }
          var list = items.map(function (it, i) {
            return (i + 1) + ". [" + it.id + "] " + (it.title || it.url) + (it.url ? " — " + it.url : "");
          }).join("\n");
          var prompt = "Kategori B = \"" + srcCat.name + "\". Kategori A = \"" + tgtCat.name + "\".\n" +
            "Berikut ialah senarai link dalam kategori B (setiap satu ada id dalam kurungan siku):\n" +
            list + "\n\nTentukan yang MANA TIDAK sesuai berada dalam kategori B (patut dipindah ke A). " +
            "Kembalikan HANYA senarai id (satu per baris, tanpa teks lain). Jika semua sesuai, kembalikan perkataan TIADA.";
          sendToProvider(prompt, function (answer) {
            var valid = {};
            items.forEach(function (it) { if (it.id != null) valid[String(it.id)] = it; });
            var chosen = [];
            String(answer || "").split(/\r?\n/).forEach(function (line) {
              var id = String(line).trim().replace(/^\[|\]$/g, "").trim();
              if (valid[id]) { if (chosen.indexOf(id) === -1) chosen.push(id); return; }
              Object.keys(valid).forEach(function (vid) {
                if (vid && (vid.indexOf(id) !== -1 || id.indexOf(vid) !== -1) && chosen.indexOf(vid) === -1) chosen.push(vid);
              });
            });
            if (!chosen.length) {
              addBubble("jarvis", "Semua link nampak sesuai untuk kategori \"" + srcCat.name + "\". Tiada dipindah.");
              return finishReclassify(onComplete);
            }
            var capped = chosen.slice(0, 50);
            var over = chosen.length - capped.length;
            var names = capped.map(function (id) { var it = valid[id]; return "- " + (it ? (it.title || it.url) : id); }).join("\n");
            var msg = capped.length + " link ini nampak TAK sesuai untuk \"" + srcCat.name + "\" dan dicadang pindah ke \"" + tgtCat.name + "\":" +
              "\n" + names + (over > 0 ? "\n(...+" + over + " lagi dihadkan ke 50)" : "");
            var bubble = addBubble("jarvis", msg);
            if (bubble) {
              var yes = el("button", { className: "lp-jarvis-cap-opt", text: "✅ Ya, pindah", type: "button" });
              var no = el("button", { className: "lp-jarvis-cap-opt", text: "❌ Batal", type: "button" });
              yes.style.marginRight = "6px";
              yes.addEventListener("click", function () {
                yes.disabled = true; no.disabled = true;
                api.runtime.sendMessage({ type: "jarvis-set-item-category", ids: capped, categoryId: tgtCat.id }).then(function (w) {
                  if (w && w.ok) addBubble("jarvis", "✅ " + (w.updated || 0) + " link dipindah ke \"" + tgtCat.name + "\"");
                  else addBubble("jarvis", "❌ Gagal pindah: " + ((w && w.message) || "ralat"));
                  finishReclassify(onComplete);
                }).catch(function () {
                  addBubble("jarvis", "❌ Gagal pindah (ralat komunikasi).");
                  finishReclassify(onComplete);
                });
              });
              no.addEventListener("click", function () {
                addBubble("jarvis", "Batal — tiada link dipindah.");
                finishReclassify(onComplete);
              });
              try {
                var ctr = el("div", { className: "lp-jarvis-reclassify-actions" }, [yes, no]);
                bubble.appendChild(ctr);
              } catch (e) {}
            }
          });
        }).catch(function () {
          addBubble("jarvis", "Gagal akses simpanan untuk penilaian kategori.");
          finishReclassify(onComplete);
        });
      }).catch(function () {
        addBubble("jarvis", "Gagal dapatkan senarai kategori.");
        finishReclassify(onComplete);
      });
      function finishReclassify(cb) { if (cb) cb(); }
    }

    // ---- Region capture (feature #6b): let the user snap a chosen area ----
    function openCapturePopup() {
      ensureCapturePopup();
      if (capturePopup) capturePopup.classList.toggle("lp-jarvis-show");
    }
    function closeCapturePopup() {
      if (capturePopup) capturePopup.classList.remove("lp-jarvis-show");
    }
    function hidePanelForCapture() {
      // In SIDEBAR_HOST (native sidebar) mode we must NOT unload the panel
      // (sidebarAction.close() destroys this document), otherwise the
      // background's capture response has nowhere to land and the screenshot
      // is lost. captureVisibleTab only captures the tab, never the sidebar, so
      // hiding the panel's own root locally is enough — no reload needed.
      if (root) root.style.display = "none";
      if (typeof SIDEBAR_HOST === "undefined" || !SIDEBAR_HOST) {
        if (root) root.classList.remove("lp-jarvis-open");
      }
      suppressCloseUntil = Date.now() + 600000;
    }
    function showPanelAfterCapture() {
      if (root) root.style.display = "";
      if (typeof SIDEBAR_HOST === "undefined" || !SIDEBAR_HOST) {
        if (root) root.classList.add("lp-jarvis-open");
      }
      suppressCloseUntil = 0;
    }
    function ensureCapturePopup() {
      if (capturePopup) return;
      var capOpts = [el("button", { id: "lp-jarvis-cap-full", className: "lp-jarvis-cap-opt", text: "📸 Seluruh tab" })];
      capOpts.push(el("button", { id: "lp-jarvis-cap-region", className: "lp-jarvis-cap-opt", text: "✂ Pilih kawasan" }));
      capOpts.push(el("button", { id: "lp-jarvis-cap-image", className: "lp-jarvis-cap-opt", text: "🖼 Pilih imej" }));
      capOpts.push(el("button", { id: "lp-jarvis-cap-file", className: "lp-jarvis-cap-opt", text: "📁 Muat naik gambar" }));
      capOpts.push(el("button", { id: "lp-jarvis-cap-gallery", className: "lp-jarvis-cap-opt", text: "🖼 Galeri" }));
      capturePopup = el("div", { id: "lp-jarvis-capture-popup", className: "lp-jarvis-capture-popup" }, capOpts);
      if (root) root.appendChild(capturePopup);
      capturePopup.querySelector("#lp-jarvis-cap-full").addEventListener("click", function (e) {
        e.stopPropagation(); closeCapturePopup();
        captureScreenshot();
      });
      var regionBtn = capturePopup.querySelector("#lp-jarvis-cap-region");
      if (regionBtn) regionBtn.addEventListener("click", function (e) {
        e.stopPropagation(); closeCapturePopup();
        if (typeof SIDEBAR_HOST !== "undefined" && SIDEBAR_HOST) {
          try { hidePanelForCapture(); } catch (eHide) {}
          hostRelay({ type: "jarvis-host-capture-region" }).then(function (res) {
            try { showPanelAfterCapture(); } catch (eShow) {}
            if (res && res.dataUrl) {
              pendingImage = res.dataUrl;
              showPendingImageThumb();
              saveScreenshotToGallery(res.dataUrl);
            } else if (res === null) {
              addBubble("jarvis", "Gagal tangkap kawasan.");
            }
          });
        } else {
          startRegionCapture();
        }
      });
      var imageBtn = capturePopup.querySelector("#lp-jarvis-cap-image");
      if (imageBtn) imageBtn.addEventListener("click", function (e) {
        e.stopPropagation(); closeCapturePopup();
        if (typeof SIDEBAR_HOST !== "undefined" && SIDEBAR_HOST) {
          try { hidePanelForCapture(); } catch (eHide) {}
          hostRelay({ type: "jarvis-host-capture-image" }).then(function (res) {
            try { showPanelAfterCapture(); } catch (eShow) {}
            if (res && res.dataUrl) {
              pendingImage = res.dataUrl;
              showPendingImageThumb();
              try { saveScreenshotToGallery(res.dataUrl); } catch (e) {}
            } else if (res === null) {
              addBubble("jarvis", "Gagal pilih imej.");
            }
          });
        } else {
          startImageSelect();
        }
      });
      var fileBtn = capturePopup.querySelector("#lp-jarvis-cap-file");
      if (fileBtn) fileBtn.addEventListener("click", function (e) {
        e.stopPropagation(); closeCapturePopup(); openFilePicker();
      });
      var galBtn = capturePopup.querySelector("#lp-jarvis-cap-gallery");
      if (galBtn) galBtn.addEventListener("click", function (e) {
        e.stopPropagation(); closeCapturePopup(); openGalleryOverlay();
      });
      document.addEventListener("click", function (e) {
        if (capturePopup && capturePopup.classList.contains("lp-jarvis-show") &&
            !capturePopup.contains(e.target) && e.target !== imgAttachBtn) {
          closeCapturePopup();
        }
      });
    }

    function ensureSelectEls() {
      if (selectOverlay) return;
      selectOverlay = el("div", { id: "lp-jarvis-select-overlay", className: "lp-jarvis-select-overlay" });
      selectBox = el("div", { id: "lp-jarvis-select-box", className: "lp-jarvis-select-box" });
      ["nw", "ne", "sw", "se"].forEach(function (h) {
        var hd = el("div", { className: "lp-jarvis-select-handle lp-jarvis-select-handle-" + h, "data-h": h });
        selectBox.appendChild(hd);
      });
      selectBar = el("div", { id: "lp-jarvis-select-bar", className: "lp-jarvis-select-bar" }, [
        el("button", { id: "lp-jarvis-select-save", className: "lp-jarvis-cap-opt", text: "✓ Simpan" }),
        el("button", { id: "lp-jarvis-select-cancel", className: "lp-jarvis-cap-opt", text: "✕ Batal" })
      ]);
      selectOverlay.appendChild(selectBox);
      selectOverlay.appendChild(selectBar);
      (document.body || document.documentElement).appendChild(selectOverlay);
      wireSelectEvents();
    }

    function pt(e) { return { x: e.clientX, y: e.clientY }; }
    function setBox(x, y, w, h) {
      regionRect = { left: x, top: y, width: w, height: h };
      if (!selectBox) return;
      selectBox.style.left = x + "px";
      selectBox.style.top = y + "px";
      selectBox.style.width = w + "px";
      selectBox.style.height = h + "px";
    }
    function wireSelectEvents() {
      if (!selectOverlay) return;
      selectOverlay.addEventListener("mousedown", function (e) {
        if (!regionMode || e.button !== 0) return;
        if (e.target === selectBar || (selectBar && selectBar.contains(e.target))) return;
        var p = pt(e);
        if (e.target === selectBox) {
          regionMoving = true; regionStartMouse = p; regionStartRect = Object.assign({}, regionRect);
          e.preventDefault(); return;
        }
        if (e.target && e.target.classList && e.target.classList.contains("lp-jarvis-select-handle")) {
          regionResizing = true; regionHandle = e.target.getAttribute("data-h");
          regionStartMouse = p; regionStartRect = Object.assign({}, regionRect);
          e.preventDefault(); return;
        }
        regionDrawing = true; regionStart = p; setBox(p.x, p.y, 0, 0);
        selectBox.style.display = "block"; e.preventDefault();
      });
      window.addEventListener("mousemove", function (e) {
        if (!regionMode) return;
        var p = pt(e);
        if (regionDrawing) {
          setBox(Math.min(regionStart.x, p.x), Math.min(regionStart.y, p.y),
                 Math.abs(p.x - regionStart.x), Math.abs(p.y - regionStart.y));
        } else if (regionMoving && regionStartRect) {
          setBox(regionStartRect.left + (p.x - regionStartMouse.x), regionStartRect.top + (p.y - regionStartMouse.y),
                 regionStartRect.width, regionStartRect.height);
        } else if (regionResizing && regionStartRect) {
          var r = Object.assign({}, regionStartRect);
          var dx = p.x - regionStartMouse.x, dy = p.y - regionStartMouse.y;
          if (regionHandle.indexOf("e") >= 0) r.width = Math.max(5, r.width + dx);
          if (regionHandle.indexOf("s") >= 0) r.height = Math.max(5, r.height + dy);
          if (regionHandle.indexOf("w") >= 0) { r.left += dx; r.width = Math.max(5, r.width - dx); }
          if (regionHandle.indexOf("n") >= 0) { r.top += dy; r.height = Math.max(5, r.height - dy); }
          setBox(r.left, r.top, r.width, r.height);
        }
      });
      window.addEventListener("mouseup", function () {
        regionDrawing = false; regionMoving = false; regionResizing = false;
      });
      selectBar.querySelector("#lp-jarvis-select-save").addEventListener("click", function (e) {
        e.stopPropagation(); confirmRegion();
      });
      selectBar.querySelector("#lp-jarvis-select-cancel").addEventListener("click", function (e) {
        e.stopPropagation(); cancelRegion(); showPanelAfterCapture();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && regionMode) { cancelRegion(); showPanelAfterCapture(); }
      });
    }
    function startRegionCapture() {
      ensureSelectEls();
      regionMode = true; regionRect = null; regionDrawing = false;
      regionMoving = false; regionResizing = false;
      hidePanelForCapture();
      if (selectBox) selectBox.style.display = "none";
      if (selectOverlay) selectOverlay.style.display = "block";
    }
    function cancelRegion() {
      regionMode = false;
      if (selectOverlay) selectOverlay.style.display = "none";
      if (selectBox) selectBox.style.display = "none";
      regionRect = null;
    }
    function confirmRegion() {
      if (!regionRect || regionRect.width < 5 || regionRect.height < 5) { cancelRegion(); showPanelAfterCapture(); return; }
      var rect = regionRect;
      cancelRegion();
      pendingCapturePromise = api.runtime.sendMessage({ type: "jarvis-capture-screenshot" }).then(function (res) {
        showPanelAfterCapture();
        if (!res || !res.ok || !res.dataUrl) {
          addBubble("jarvis", "Gagal tangkap: " + ((res && res.reason) || "tidak diketahui"));
          return null;
        }
        return cropDataUrl(res.dataUrl, rect).then(function (outUrl) {
          if (outUrl) { pendingImage = outUrl; showPendingImageThumb(); saveScreenshotToGallery(outUrl); }
          else { addBubble("jarvis", "Gagal potong gambar."); }
          return outUrl;
        });
      }).catch(function () {
        showPanelAfterCapture();
        addBubble("jarvis", "Gagal tangkap.");
        return null;
      });
    }
    function cropDataUrl(dataUrl, rect) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          try {
            var vw = window.innerWidth || img.naturalWidth;
            var scale = img.naturalWidth / vw;
            var sx = rect.left * scale, sy = rect.top * scale;
            var sw = rect.width * scale, sh = rect.height * scale;
            var cnv = document.createElement("canvas");
            cnv.width = Math.max(1, Math.round(sw));
            cnv.height = Math.max(1, Math.round(sh));
            var ctx = cnv.getContext("2d");
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cnv.width, cnv.height);
            resolve(cnv.toDataURL("image/png"));
          } catch (e) { resolve(null); }
        };
        img.onerror = function () { resolve(null); };
        img.src = dataUrl;
      });
    }

    // ── JARVIS Gallery: galeri screenshot kekal (IndexedDB) ─────────────────
    // Setiap screenshot yang ditangkap secara sengaja (📷 seluruh tab, ✂ pilih
    // kawasan, atau permintaan "lihat skrin" tersirat) disimpan automatik ke
    // sini. Gambar KEKAL sehingga dipadam secara eksplisit oleh pengguna
    // (padam satu / padam semua) — tiada auto-expiry. Taip "//gambar" utk
    // buka galeri terus dalam transkrip.
    //
    // IndexedDB dipilih (bukan browser.storage.local) sebab jarvisSidebar.js
    // ialah halaman extension (jarvisSidebar.html) dgn origin TETAP — jadi
    // tiada isu fragmentasi ikut origin laman web (tak macam content script
    // jarvisOverlay.js). IndexedDB juga lebih sesuai utk bilangan/saiz gambar
    // yang boleh membesar drastik berbanding storage.local (yang perlu tulis
    // semula seluruh array pada setiap tambahan).
    var GALLERY_DB_NAME = "lpJarvisGallery";
    var GALLERY_DB_VERSION = 1;
    var GALLERY_STORE = "shots";
    var galleryDbPromise = null;

    function openGalleryDb() {
      if (galleryDbPromise) return galleryDbPromise;
      galleryDbPromise = new Promise(function (resolve, reject) {
        try {
          var req = indexedDB.open(GALLERY_DB_NAME, GALLERY_DB_VERSION);
          req.onupgradeneeded = function (ev) {
            var db = ev.target.result;
            if (!db.objectStoreNames.contains(GALLERY_STORE)) {
              var store = db.createObjectStore(GALLERY_STORE, { keyPath: "id" });
              store.createIndex("ts", "ts", { unique: false });
            }
          };
          req.onsuccess = function (ev) { resolve(ev.target.result); };
          req.onerror = function () { reject(req.error || new Error("indexedDB open gagal")); };
        } catch (e) { reject(e); }
      });
      return galleryDbPromise;
    }

    // Simpan satu screenshot. Sengaja "fire-and-forget" (tak pernah throw ke
    // pemanggil) supaya panggilan ni selamat ditambah selepas mana-mana
    // pendingImage/showPendingImageThumb() sedia ada tanpa risiko pecahkan
    // flow capture yang dah berfungsi.
    function saveScreenshotToGallery(dataUrl) {
      if (!dataUrl) return;
      try {
        openGalleryDb().then(function (db) {
          try {
            var tx = db.transaction(GALLERY_STORE, "readwrite");
            tx.objectStore(GALLERY_STORE).put({
              id: "shot_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
              dataUrl: dataUrl,
              ts: Date.now()
            });
          } catch (e2) {}
        }).catch(function () {});
      } catch (e) {}
    }

    function listGalleryShots(cb) {
      openGalleryDb().then(function (db) {
        try {
          var tx = db.transaction(GALLERY_STORE, "readonly");
          var idx = tx.objectStore(GALLERY_STORE).index("ts");
          var items = [];
          var req = idx.openCursor(null, "prev"); // terbaru dahulu
          req.onsuccess = function (ev) {
            var cur = ev.target.result;
            if (cur) { items.push(cur.value); cur.continue(); }
            else cb(items);
          };
          req.onerror = function () { cb([]); };
        } catch (e) { cb([]); }
      }).catch(function () { cb([]); });
    }

    function deleteGalleryShot(id, cb) {
      openGalleryDb().then(function (db) {
        try {
          var tx = db.transaction(GALLERY_STORE, "readwrite");
          tx.objectStore(GALLERY_STORE).delete(id);
          tx.oncomplete = function () { if (cb) cb(true); };
          tx.onerror = function () { if (cb) cb(false); };
        } catch (e) { if (cb) cb(false); }
      }).catch(function () { if (cb) cb(false); });
    }

    function deleteAllGalleryShots(cb) {
      openGalleryDb().then(function (db) {
        try {
          var tx = db.transaction(GALLERY_STORE, "readwrite");
          tx.objectStore(GALLERY_STORE).clear();
          tx.oncomplete = function () { if (cb) cb(true); };
          tx.onerror = function () { if (cb) cb(false); };
        } catch (e) { if (cb) cb(false); }
      }).catch(function () { if (cb) cb(false); });
    }

    // Bina & papar bubble galeri (grid thumbnail) dalam transkrip. "//gambar"
    // panggil fungsi ni terus; setiap panggilan bina bubble BARU dgn data
    // terkini (bukan re-guna bubble lama), konsisten dgn bubble lain.
    function openGalleryBubble() {
      var bubble = addBubble("jarvis", "🖼 Galeri screenshot JARVIS:");
      renderGalleryGridInto(bubble);
    }

    function renderGalleryGridInto(bubble) {
      var oldGrid = bubble.querySelector(".lp-jarvis-gallery-grid");
      if (oldGrid && oldGrid.parentNode) oldGrid.parentNode.removeChild(oldGrid);
      var oldBar = bubble.querySelector(".lp-jarvis-gallery-bar");
      if (oldBar && oldBar.parentNode) oldBar.parentNode.removeChild(oldBar);
      var oldEmpty = bubble.querySelector(".lp-jarvis-gallery-empty");
      if (oldEmpty && oldEmpty.parentNode) oldEmpty.parentNode.removeChild(oldEmpty);

      listGalleryShots(function (items) {
        if (!items.length) {
          var empty = el("div", { className: "lp-jarvis-gallery-empty", text: "Tiada gambar disimpan lagi." });
          bubble.appendChild(empty);
          scrollToBottom();
          return;
        }
        var grid = el("div", { className: "lp-jarvis-gallery-grid" });
        items.forEach(function (item) {
          var cell = el("div", { className: "lp-jarvis-gallery-cell" });
          var img = document.createElement("img");
          img.src = item.dataUrl;
          img.className = "lp-jarvis-gallery-thumb";
          img.alt = "Screenshot";
          try { img.title = formatTime(item.ts); } catch (eT) {}
          img.addEventListener("click", function () {
            try {
              if (api.tabs && api.tabs.create) api.tabs.create({ url: item.dataUrl });
              else window.open(item.dataUrl, "_blank");
            } catch (e) { try { window.open(item.dataUrl, "_blank"); } catch (e2) {} }
          });
          var delBtn = el("button", { className: "lp-jarvis-gallery-del", type: "button", title: "Padam gambar ini", text: "🗑" });
          delBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            deleteGalleryShot(item.id, function () {
              // Bina semula grid sepenuhnya — kemaskan label "Padam Semua (n)"
              // dan papar "Tiada gambar" automatik jika ini gambar terakhir.
              renderGalleryGridInto(bubble);
            });
          });
          cell.appendChild(img);
          cell.appendChild(delBtn);
          grid.appendChild(cell);
        });
        bubble.appendChild(grid);

        var bar = el("div", { className: "lp-jarvis-gallery-bar" });
        var delAllBtn = el("button", {
          className: "lp-jarvis-chip lp-jarvis-chip-followup", type: "button",
          text: "🗑 Padam Semua (" + items.length + ")"
        });
        delAllBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          if (!window.confirm("Padam SEMUA " + items.length + " gambar dalam galeri? Tindakan ini tidak boleh dibatalkan.")) return;
          deleteAllGalleryShots(function () {
            renderGalleryGridInto(bubble);
          });
        });
        bar.appendChild(delAllBtn);
        bubble.appendChild(bar);
        scrollToBottom();
      });
    }

    // ── Gallery Overlay (full-window, ganti openGalleryBubble) ───────────────
    const GALLERY_OVERLAY_ID = "__lp_jarvis_gallery_overlay";
    function buildGalleryOverlay(items) {
      closeGalleryOverlay();
      var backdrop = el("div", { id: GALLERY_OVERLAY_ID });
      backdrop.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 180ms ease;font-family:Aptos,'Segoe UI Variable','Segoe UI',sans-serif;";
      var modal = el("div");
      modal.style.cssText = "background:rgba(18,18,30,0.97);border:1px solid rgba(120,170,255,0.25);border-radius:14px;width:min(94vw,640px);height:min(88vh,600px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.5);transform:translateY(-8px);transition:transform 200ms cubic-bezier(0.2,0.8,0.2,1),opacity 180ms ease;opacity:0;";
      // Header
      var hdr = el("div");
      hdr.style.cssText = "display:flex;align-items:center;gap:8px;padding:12px 16px 8px;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,0.06);";
      var title = el("span", { text: "\u{1F5BC}\uFE0F Galeri Gambar" });
      title.style.cssText = "font-size:15px;font-weight:700;color:#e8ecf4;flex:1;";
      var countLabel = el("span");
      countLabel.style.cssText = "font-size:11px;color:rgba(255,255,255,0.35);";
      countLabel.textContent = "(" + items.length + ")";
      var delAllBtn = el("button", { type: "button", text: "\u{1F5D1} Padam Semua" });
      delAllBtn.style.cssText = "font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid rgba(255,80,80,0.3);background:rgba(255,80,80,0.12);color:#ff6b6b;cursor:pointer;white-space:nowrap;";
      delAllBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (!window.confirm("Padam SEMUA " + items.length + " gambar dalam galeri? Tindakan ini tidak boleh dibatalkan.")) return;
        deleteAllGalleryShots(function () { closeGalleryOverlay(); });
      });
      var closeBtn = el("button", { type: "button", text: "\u2715" });
      closeBtn.style.cssText = "font-size:16px;padding:2px 8px;border:none;background:transparent;color:rgba(255,255,255,0.5);cursor:pointer;border-radius:4px;";
      closeBtn.addEventListener("click", closeGalleryOverlay);
      hdr.append(title, countLabel, delAllBtn, closeBtn);
      // Body (scrollable grid)
      var body = el("div");
      body.style.cssText = "overflow-y:auto;flex:1;min-height:0;padding:12px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.12) transparent;display:flex;flex-wrap:wrap;align-content:flex-start;gap:8px;";
      if (!items.length) {
        var empty = el("div", { text: "Tiada gambar disimpan lagi." });
        empty.style.cssText = "width:100%;text-align:center;color:rgba(255,255,255,0.3);padding:40px 0;font-size:14px;";
        body.appendChild(empty);
      } else {
        items.forEach(function (item) {
          var cell = el("div");
          cell.style.cssText = "position:relative;width:calc(33.33% - 6px);border-radius:8px;overflow:hidden;cursor:pointer;background:rgba(255,255,255,0.04);transition:transform 120ms ease;";
          cell.addEventListener("mouseenter", function () { cell.style.transform = "scale(1.03)"; });
          cell.addEventListener("mouseleave", function () { cell.style.transform = "scale(1)"; });
          cell.addEventListener("click", function () {
            closeGalleryOverlay();
            try { pendingImage = item.dataUrl; pendingUserImage = item.dataUrl; showPendingImageThumb(); } catch (e) {}
            if (inputEl) {
              inputEl.value = "/cari";
              setTimeout(function () { try { inputEl.focus(); } catch (e) {} }, 200);
            }
          });
          var img = document.createElement("img");
          img.src = item.dataUrl;
          img.style.cssText = "width:100%;aspect-ratio:1;object-fit:cover;display:block;";
          var tsLabel = el("div");
          tsLabel.style.cssText = "position:absolute;bottom:0;left:0;right:0;font-size:9px;color:rgba(255,255,255,0.7);background:linear-gradient(transparent,rgba(0,0,0,0.7));padding:14px 4px 3px 5px;text-align:left;pointer-events:none;";
          try { tsLabel.textContent = formatTime(item.ts); } catch (eT) {}
          var delBtn = el("button", { type: "button", text: "\u{1F5D1}" });
          delBtn.style.cssText = "position:absolute;top:3px;right:3px;font-size:13px;padding:1px 4px;border:none;background:rgba(0,0,0,0.55);color:#ff6b6b;cursor:pointer;border-radius:4px;line-height:1;";
          delBtn.title = "Padam gambar ini";
          delBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            deleteGalleryShot(item.id, function () { openGalleryOverlay(); });
          });
          cell.appendChild(img);
          cell.appendChild(tsLabel);
          cell.appendChild(delBtn);
          body.appendChild(cell);
        });
      }
      modal.append(hdr, body);
      backdrop.appendChild(modal);
      (document.body || document.documentElement).appendChild(backdrop);
      // Escape key to close
      backdrop._lpGalKey = function (e) { if (e.key === "Escape") closeGalleryOverlay(); };
      document.addEventListener("keydown", backdrop._lpGalKey, true);
      // Animate in
      requestAnimationFrame(function () {
        backdrop.style.opacity = "1";
        modal.style.opacity = "1";
        modal.style.transform = "translateY(0)";
      });
    }
    function closeGalleryOverlay() {
      var el2 = document.getElementById(GALLERY_OVERLAY_ID);
      if (!el2) return;
      if (el2._lpGalKey) document.removeEventListener("keydown", el2._lpGalKey, true);
      var m = el2.firstElementChild;
      if (m) { m.style.opacity = "0"; m.style.transform = "translateY(-8px)"; }
      el2.style.opacity = "0";
      setTimeout(function () { if (el2.parentNode) el2.parentNode.removeChild(el2); }, 200);
    }
    function openGalleryOverlay() {
      listGalleryShots(function (items) { buildGalleryOverlay(items); });
    }

    // ---- "Pilih imej" (feature #6c): hover to highlight, click to snap the
    // picture you want. Clicking an <img> grabs its REAL source (high quality,
    // via a background fetch that bypasses CORS — like search_by_image's "select"
    // view); clicking any other element crops the visible-tab screenshot to that
    // element's box. Either way the result is attached to the next question. ----
    function ensureImageSelectEls() {
      if (imageSelectHL) return;
      imageSelectHL = el("div", { id: "lp-jarvis-img-select-hl", className: "lp-jarvis-img-select-hl" });
      imageSelectLabel = el("span", { className: "lp-jarvis-img-select-label" });
      imageSelectHL.appendChild(imageSelectLabel);
      imageSelectHint = el("div", { id: "lp-jarvis-img-select-hint", className: "lp-jarvis-img-select-hint" }, [
        el("span", { text: "Klik imej atau elemen untuk snap · Esc untuk batal" }),
        el("button", { id: "lp-jarvis-img-select-cancel", className: "lp-jarvis-cap-opt", text: "✕ Batal" })
      ]);
      (document.body || document.documentElement).appendChild(imageSelectHL);
      (document.body || document.documentElement).appendChild(imageSelectHint);
      imageSelectHint.querySelector("#lp-jarvis-img-select-cancel").addEventListener("click", function (e) {
        e.stopPropagation(); cancelImageSelect();
      });
    }
    function showImgSelHL(r, isImg) {
      if (!imageSelectHL) return;
      imageSelectHL.style.display = "block";
      imageSelectHL.style.left = Math.round(r.left) + "px";
      imageSelectHL.style.top = Math.round(r.top) + "px";
      imageSelectHL.style.width = Math.round(r.width) + "px";
      imageSelectHL.style.height = Math.round(r.height) + "px";
      imageSelectHL.style.borderColor = isImg ? "#5fff9d" : "#5fd0ff";
      imageSelectHL.style.background = isImg ? "rgba(95,255,157,0.14)" : "rgba(95,208,255,0.12)";
      if (imageSelectLabel) imageSelectLabel.textContent = isImg ? "🖼 Imej" : "▦ Elemen";
    }
    function hideImgSelHL() { if (imageSelectHL) imageSelectHL.style.display = "none"; }
    function imgSelTargetAt(x, y) {
      var t = document.elementFromPoint(x, y);
      if (!t || !t.getBoundingClientRect) return null;
      if (root && root.contains(t)) return null; // ignore our own panel
      if (imageSelectHint && imageSelectHint.contains(t)) return null; // ignore hint bar
      var img = (t.closest && t.closest("img")) || (t.tagName === "IMG" ? t : null);
      var node = img || t;
      var r = node.getBoundingClientRect();
      if (r.width < 3 || r.height < 3) return null;
      return { node: node, img: img, rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
    }
    function imgSelOnMove(e) {
      if (!imageSelectMode) return;
      var hit = imgSelTargetAt(e.clientX, e.clientY);
      if (!hit) { hideImgSelHL(); return; }
      showImgSelHL(hit.rect, !!hit.img);
    }
    function imgSelOnClick(e) {
      if (!imageSelectMode) return;
      var hit = imgSelTargetAt(e.clientX, e.clientY);
      if (!hit) return; // click on our own panel etc. — ignore, stay in mode
      e.preventDefault(); e.stopPropagation();
      var rect = hit.rect, img = hit.img;
      cleanupImageSelect();
      if (img) captureImageBySrc(img, rect);
      else captureElementByCrop(rect);
    }
    function startImageSelect() {
      ensureImageSelectEls();
      imageSelectMode = true;
      if (imageSelectHL) imageSelectHL.style.display = "none";
      if (imageSelectHint) imageSelectHint.style.display = "flex";
      hidePanelForCapture();
      document.body.style.cursor = "crosshair";
      document.body.style.userSelect = "none";
      _imgSelMove = function (e) { imgSelOnMove(e); };
      _imgSelClick = function (e) { imgSelOnClick(e); };
      _imgSelKey = function (e) { if (e.key === "Escape") cancelImageSelect(); };
      document.addEventListener("mousemove", _imgSelMove, true);
      document.addEventListener("click", _imgSelClick, true);
      document.addEventListener("keydown", _imgSelKey, true);
    }
    function cleanupImageSelect() {
      imageSelectMode = false;
      hideImgSelHL();
      if (imageSelectHint) imageSelectHint.style.display = "none";
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (_imgSelMove) document.removeEventListener("mousemove", _imgSelMove, true);
      if (_imgSelClick) document.removeEventListener("click", _imgSelClick, true);
      if (_imgSelKey) document.removeEventListener("keydown", _imgSelKey, true);
      _imgSelMove = _imgSelClick = _imgSelKey = null;
    }
    // Cancel = abort the selection AND bring the panel back.
    function cancelImageSelect() {
      cleanupImageSelect();
      showPanelAfterCapture();
    }
    // Grab the actual image source (best quality). Data URLs are used directly;
    // http(s) URLs are fetched in the background to dodge CORS. On any failure we
    // fall back to cropping the visible-tab screenshot around the element.
    function captureImageBySrc(img, rect) {
      var src = img.currentSrc || img.src;
      if (!src) { captureElementByCrop(rect); return; }
      if (src.indexOf("data:") === 0) { pendingImage = src; showPendingImageThumb(); showPanelAfterCapture(); try { saveScreenshotToGallery(src); } catch (e) {} return; }
      pendingCapturePromise = api.runtime.sendMessage({ type: "jarvis-fetch-image", url: src }).then(function (res) {
        if (res && res.ok && res.dataUrl) { pendingImage = res.dataUrl; showPendingImageThumb(); try { saveScreenshotToGallery(res.dataUrl); } catch (e) {} }
        else { captureElementByCrop(rect); return null; }
        showPanelAfterCapture();
      }).catch(function () { captureElementByCrop(rect); });
    }
    function captureElementByCrop(rect) {
      pendingCapturePromise = api.runtime.sendMessage({ type: "jarvis-capture-screenshot" }).then(function (res) {
        showPanelAfterCapture();
        if (!res || !res.ok || !res.dataUrl) {
          addBubble("jarvis", "Gagal tangkap: " + ((res && res.reason) || "tidak diketahui"));
          return null;
        }
        return cropDataUrl(res.dataUrl, rect).then(function (outUrl) {
          if (outUrl) { pendingImage = outUrl; showPendingImageThumb(); try { saveScreenshotToGallery(outUrl); } catch (e) {} }
          else { addBubble("jarvis", "Gagal potong gambar."); }
          return outUrl;
        });
      }).catch(function () {
        showPanelAfterCapture();
        addBubble("jarvis", "Gagal tangkap.");
        return null;
      });
    }

    // Drag-and-drop fallback for a web-page image delivered as a URL (not a file).
    // The background fetch (jarvis-fetch-image) can still fail on CORS/network for
    // some hosts, so mirror the "Pilih imej" path: find the source <img> in the DOM
    // (matched by its resolved src), then capture the visible-tab screenshot and
    // crop to that element's box. This is a browser-level capture — NO CORS.
    var _lastDropCaptureTs = 0;
    function captureDroppedWebImage(url) {
      // Debounce: both the input-level and root-level drop handlers may fire for
      // the same drop, so only run one screenshot capture per ~1.5s window.
      var _now = Date.now();
      if (_now - _lastDropCaptureTs < 1500) return;
      _lastDropCaptureTs = _now;
      // Don't clobber an image that a parallel handler already captured.
      if (pendingImage) return;
      try {
        var img = null;
        var imgs = document.images || [];
        for (var i = 0; i < imgs.length; i++) {
          var s = imgs[i].currentSrc || imgs[i].src || "";
          if (s === url) { img = imgs[i]; break; }
        }
        if (!img) {
          for (var j = 0; j < imgs.length; j++) {
            var s2 = imgs[j].currentSrc || imgs[j].src || "";
            if (s2 && (s2.indexOf(url) === 0 || url.indexOf(s2) === 0)) { img = imgs[j]; break; }
          }
        }
        if (img) {
          var r = img.getBoundingClientRect();
          if (r.width >= 3 && r.height >= 3) {
            var rect = { left: r.left, top: r.top, width: r.width, height: r.height };
            try { hidePanelForCapture(); } catch (e) {}
            captureElementByCrop(rect);
            return;
          }
        }
      } catch (e) {}
      addBubble("jarvis", "Tak dapat ambil gambar itu (CORS?). Cuba tangkap skrin.");
    }

    // Vision (feature #6): capture the visible tab as a screenshot and attach it
    // to the next question. Gemini is the only provider whose composer reliably
    // accepts a pasted image; other providers fall back to text (image ignored).
    function captureScreenshot() {
      try {
        hidePanelForCapture();
        pendingCapturePromise = api.runtime.sendMessage({ type: "jarvis-capture-screenshot" }).then(function (res) {
          showPanelAfterCapture();
          if (res && res.ok && res.dataUrl) {
            pendingImage = res.dataUrl;
            showPendingImageThumb();
            saveScreenshotToGallery(res.dataUrl);
          } else {
            addBubble("jarvis", "Gagal tangkap screenshot: " + ((res && res.reason) || "tidak diketahui"));
          }
        }).catch(function () {
          showPanelAfterCapture();
          addBubble("jarvis", "Gagal tangkap screenshot.");
        });
      } catch (e) {
        showPanelAfterCapture();
        addBubble("jarvis", "Gagal tangkap screenshot.");
      }
    }
    function maybeAutoSendImageWithLastQuestion() {
      // Flow: user asked a text-only question, THEN attached a screenshot/image.
      // Re-send that question together with the picture so Gemini receives it.
      // Guard: only when (a) a text question was just sent without an image,
      // (b) the user isn't already composing a brand-new question, and (c) we
      // still have the previous question text.  The "composing a new question"
      // check (empty input) is what keeps the normal "screenshot THEN ask" flow
      // from firing prematurely.
      if (!pendingImage) return;
      if (!expectingImageAfterQuestion) return;
      if (Date.now() - expectingImageAfterQuestionTs > 15000) {
        expectingImageAfterQuestion = false;
        return;
      }
      if (inputEl && (inputEl.value || "").trim()) return;
      if (!lastUserText) return;
      expectingImageAfterQuestion = false;
      expectingImageAfterQuestionTs = 0;
      // Re-send the question together with the picture.  Route it through the
      // serial command queue (processMessage) instead of calling sendToProvider
      // directly, so it waits for the previous turn's response to finish before
      // injecting a new message into the (still-busy) provider composer — otherwise
      // the image message fails to submit and never reaches Gemini.
      // Defer the dispatch by a short window and make it cancellable: if the user
      // types a NEW command (or taps the /cari chip) in the meantime, that action
      // cancels this timer so the previous question is never sent instead of the
      // new one (bug: image + "cari" showing the previous answer).
      var q = lastUserText;
      cancelImageAutoSend();
      pendingImageAutoSendTimer = setTimeout(function () {
        pendingImageAutoSendTimer = null;
        if (!pendingImage) return;
        if (inputEl && (inputEl.value || "").trim()) return;
        if (!lastUserText) return;
        processMessage(q);
      }, 900);
    }
     var cariImgChipBtn = null;
     function ensureCariImgChip(chip) {
       if (!chip || cariImgChipBtn) return;
       cariImgChipBtn = el("button", { className: "lp-jarvis-img-cari-chip", text: "/cari", title: "Cari maklumat & link untuk gambar ini" });
        cariImgChipBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          // A deliberate command on the image — cancel any pending auto-resend
          // of the previous question so THIS "cari" is what gets sent.
          cancelImageAutoSend();
          if (cariImgChipBtn && cariImgChipBtn.parentNode) cariImgChipBtn.parentNode.removeChild(cariImgChipBtn);
          cariImgChipBtn = null;
          processMessage("/cari");
        });
       chip.appendChild(cariImgChipBtn);
     }
     function showPendingImageThumb() {
       if (!imgThumb) return;
       imgThumb.innerHTML = "";
       cariImgChipBtn = null;
       if (!pendingImage) { imgThumb.style.display = "none"; if (inputEl) inputEl.style.paddingTop = ""; return; }
       imgThumb.style.display = "flex";
       var chip = document.createElement("div");
       chip.className = "lp-jarvis-img-chip";
       var img = document.createElement("img");
       img.src = pendingImage;
       img.className = "lp-jarvis-img-chip-img";
       img.title = "Klik untuk buang gambar";
       img.addEventListener("click", function (e) { e.stopPropagation(); clearPendingImage(); });
       var x = document.createElement("span");
       x.className = "lp-jarvis-img-chip-x";
       x.textContent = "✕";
       x.addEventListener("click", function (e) { e.stopPropagation(); clearPendingImage(); });
       chip.appendChild(img);
       chip.appendChild(x);
       imgThumb.appendChild(chip);
       ensureCariImgChip(chip);
       if (inputEl) inputEl.style.paddingTop = "4px";
       maybeAutoSendImageWithLastQuestion();
     }
    function clearPendingImage() {
      pendingImage = null;
      pendingUserImage = null;
      showPendingImageThumb();
    }

    function openFilePicker() {
      if (!fileInputEl) return;
      fileInputEl.value = "";
      fileInputEl.click();
    }

    function handleFileSelected(e) {
      var file = e && e.target && e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type || file.type.indexOf("image/") !== 0) {
        addBubble("jarvis", "Sila pilih fail gambar (JPEG, PNG, GIF, WebP).");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        addBubble("jarvis", "Gambar terlalu besar. Maksimum 10 MB.");
        return;
      }
      var reader = new FileReader();
      reader.onload = function (ev) {
        pendingImage = ev.target.result;
        showPendingImageThumb();
      };
      reader.onerror = function () {
        addBubble("jarvis", "Gagal baca fail gambar.");
      };
      reader.readAsDataURL(file);
    }

    // ── #3 INTERAKSI PELBAGAI MODALITI: TTS via "Read Aloud" provider ──
    // ── TTS: bacakan respons ringkas JARVIS melalui provider ──
    function applyTtsButton() {
      if (!ttsBtn) return;
      ttsBtn.setAttribute("aria-pressed", jarvisTtsEnabled ? "true" : "false");
      ttsBtn.classList.toggle("lp-jarvis-tts-on", !!jarvisTtsEnabled);
      ttsBtn.title = "Bacakan jawapan JARVIS (TTS): " + (jarvisTtsEnabled ? "ON" : "OFF");
      ttsBtn.style.background = jarvisTtsEnabled ? "rgba(16,185,129,0.18)" : "";
    }
    function setTts(on) {
      jarvisTtsEnabled = !!on;
      try { api.storage.local.set({ [JARVIS_TTS_KEY]: jarvisTtsEnabled }); } catch (e) {}
      applyTtsButton();
      if (!jarvisTtsEnabled) {
        stopSpeaking();
        // TTS dimatikan: musnahkan iframe provider yang dipelihara (jika ia
        // tersembunyi) supaya tak berebut sesi dengan AI Sidebar.
        if (!providerVisible && providerIframe) destroyProviderIframe();
      }
    }
    function toggleTts() {
      setTts(!jarvisTtsEnabled);
      if (jarvisTtsEnabled) addBubble("jarvis", "TTS dihidupkan — JARVIS akan membacakan jawapan ringkas.");
    }
    function stopSpeaking() {
      // Hentikan audio Puter TTS (primer). Tiada speechSynthesis OS.
      try { if (jarvisAudio && jarvisAudio.pause) { jarvisAudio.pause(); jarvisAudio = null; } } catch (e) {}
      try { api.runtime.sendMessage({ type: "jarvis-tts-stop" }).catch(function () {}); } catch (e2) {}
    }
    // Bersihkan teks respons (buang markdown/HTML) sebelum disebut.
    function ttsPlainText(text) {
      return String(text || "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`[^`]*`/g, " ")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[#*_>~`|]/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    var _puterTtsErrorShown = false;
    function _showTtsError(err) {
      try { console.error("[JARVIS TTS] gagal:", err); } catch (e2) {}
      if (_puterTtsErrorShown) return;
      _puterTtsErrorShown = true;
      var msg = (err && (err.message || String(err))) || "Ralat tidak diketahui";
      try { addBubble("jarvis", "TTS gagal: " + msg.slice(0, 200)); } catch (e3) {}
    }
    // Puter TTS SAHAJA (tiada speechSynthesis OS). Jika tiada API key Puter dan
    // pengguna TAK log masuk, TTS senyap — popup auth Puter disekat kerana tak
    // boleh siap dalam konteks extension (tingkap jadi kosong).
    // Kesan bahasa teks (Melayu / English) supaya TTS boleh menyesuaikan suara
    // seperti "speech Gemini" — bacaan auto-pilih suara mengikut bahasa teks.
    function detectTextLanguage(text) {
      var ms = /\b(dan|yang|ini|itu|adalah|ialah|saya|kita|anda|untuk|dengan|pada|kepada|di|dari|akan|telah|bagi|sebagai|jika|apabila|tidak|boleh|perlu|mengapa|bagaimana|apa|siapa|sudah|masih|oleh|antara|tersebut|kerana|sebab|serta|atau|tetapi|namun|juga|lagi|bila|serta|cuma|sahaja|semua|lain)\b/gi;
      var en = /\b(the|is|are|was|were|and|or|but|you|your|we|our|they|their|for|with|on|in|at|to|from|of|this|that|these|those|i|am|be|been|have|has|had|do|does|did|will|would|can|could|should|if|when|why|how|what|who|where|it|its|as|by|an|a|not|no|yes|he|she|them|his|her|my|me|us)\b/gi;
      var m = (text.match(ms) || []).length;
      var e = (text.match(en) || []).length;
      if (m === 0 && e === 0) return null;
      return m >= e ? "ms" : "en";
    }
    function _playPuterAudio(audio, force) {
      if (!jarvisTtsEnabled && !force) return;
      try { if (jarvisAudio && jarvisAudio.pause) jarvisAudio.pause(); } catch (e) {}
      jarvisAudio = audio;
      try { (document.body || document.documentElement).appendChild(audio); } catch (e2) {}
      var pl = audio && audio.play && audio.play();
      if (pl && typeof pl.catch === "function") {
        pl.catch(function () { /* autoplay mungkin disekat — biar senyap */ });
      }
    }
    // Gemini TTS memulangkan PCM mentah (LINEAR16, mis. audio/L16;rate=24000),
    // BUKAN fail WAV. <audio> tak boleh main PCM mentah tanpa header RIFF, jadi
    // kita bina header WAV di sekeliling data itu supaya boleh dimain browser.
    function _b64ToUint8(b64) {
      var bin = atob(b64);
      var len = bin.length;
      var out = new Uint8Array(len);
      for (var i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    function _pcmToWavBlob(pcmBytes, sampleRate, channels, bitsPerSample) {
      sampleRate = sampleRate || 24000;
      channels = channels || 1;
      bitsPerSample = bitsPerSample || 16;
      var blockAlign = channels * bitsPerSample / 8;
      var byteRate = sampleRate * blockAlign;
      var dataLen = pcmBytes.length;
      var buf = new ArrayBuffer(44 + dataLen);
      var view = new DataView(buf);
      function wstr(off, s) { for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }
      wstr(0, "RIFF");
      view.setUint32(4, 36 + dataLen, true);
      wstr(8, "WAVE");
      wstr(12, "fmt ");
      view.setUint32(16, 16, true);        // PCM chunk size
      view.setUint16(20, 1, true);         // audio format = PCM
      view.setUint16(22, channels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitsPerSample, true);
      wstr(36, "data");
      view.setUint32(40, dataLen, true);
      new Uint8Array(buf, 44).set(pcmBytes);
      return new Blob([buf], { type: "audio/wav" });
    }
    function _parseRateFromMime(mime) {
      var m = /rate=(\d+)/i.exec(String(mime || ""));
      return m ? parseInt(m[1], 10) : 24000;
    }
    // TTS terus ke Google Gemini API (bypass Puter) guna API key AI Studio
    // percuma. Hasilkan audio (PCM LINEAR16 → bungkus WAV) via generateContent +
    // responseModalities AUDIO.
    function speakJarvisGoogle(plain, force) {
      if (!jarvisTtsEnabled && !force) return;
      if (!googleApiKey) {
        if (!_googleKeyWarned) {
          _googleKeyWarned = true;
          try { addBubble("jarvis", "TTS Google perlu API key percuma dari Google AI Studio — isi di medan 'Google key' (https://aistudio.google.com/apikey)."); } catch (e) {}
        }
        return;
      }
      // Kesan bahasa → pilih suara slot (Melayu/English). Gemini serba guna, tapi
      // tetap gunakan suara dipilih; "Auto" guna suara default (Kore).
      var lang = detectTextLanguage(plain);
      var voiceId = lang === "ms" ? jarvisVoiceMs : (lang === "en" ? jarvisVoiceEn : "");
      var voiceName = voiceId || "Kore";
      var url = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_TTS_MODEL + ":generateContent?key=" + encodeURIComponent(googleApiKey);
      var body = {
        contents: [{ role: "user", parts: [{ text: plain }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } }
          }
        }
      };
      try {
        fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
          .then(function (r) {
            if (!r.ok) {
              return r.text().then(function (txt) {
                var msg = "HTTP " + r.status;
                try { var j = JSON.parse(txt); if (j && j.error && j.error.message) msg = j.error.message; } catch (e2) {}
                throw new Error(msg);
              }).catch(function () { throw new Error("HTTP " + r.status); });
            }
            return r.json();
          })
          .then(function (data) {
            try {
              var cand = data && data.candidates && data.candidates[0];
              var part = cand && cand.content && cand.content.parts && cand.content.parts[0];
              var inline = part && part.inlineData;
              if (!inline || !inline.data) throw new Error("Tiada data audio dari Google TTS");
              var mime = String(inline.mimeType || "audio/L16;rate=24000").toLowerCase();
              var src;
              if (mime.indexOf("wav") >= 0 || mime.indexOf("mp3") >= 0 || mime.indexOf("mpeg") >= 0 || mime.indexOf("ogg") >= 0) {
                // Sudah format terbungkus — main terus.
                src = "data:" + inline.mimeType + ";base64," + inline.data;
              } else {
                // PCM mentah (L16/pcm/linear16) → bungkus jadi WAV.
                var rate = _parseRateFromMime(mime);
                var wav = _pcmToWavBlob(_b64ToUint8(inline.data), rate, 1, 16);
                src = URL.createObjectURL(wav);
              }
              var audio = new Audio(src);
              _playPuterAudio(audio, force);
            } catch (e) { _showTtsError(e); }
          })
          .catch(function (err) { _showTtsError(err); });
      } catch (e) { _showTtsError(e); }
    }
    function speakJarvisPuter(plain, force) {
      if (ttsProvider === "google") { speakJarvisGoogle(plain, force); return; }
      loadPuterSdk().then(function (ok) {
        if (!ok || (!jarvisTtsEnabled && !force)) return;
        // Jika API key diberi → terus guna TTS (key auth, tiada popup). Jika
        // TIDAK, semak sama ada pengguna sudah log masuk Puter; jika tidak, elak
        // popup auth kosong dan amankan sekali sahaja.
        var proceed = Promise.resolve(true);
        if (!puterApiKey && window.puter.auth && typeof window.puter.auth.isSignedIn === "function") {
          try { proceed = window.puter.auth.isSignedIn(); } catch (e) {}
        }
        Promise.resolve(proceed).then(function (signedIn) {
          if (!signedIn) {
            if (!_puterTtsWarned) {
              _puterTtsWarned = true;
              try { addBubble("jarvis", "TTS Puter perlu API key percuma — isi di bahagian bawah panel. (Popup auth tak berfungsi dalam extension.)"); } catch (e) {}
            }
            return;
          }
          try {
            // Kesan bahasa teks dan pilih suara yang sepadan (Melayu ↔ jarvisVoiceMs,
            // English ↔ jarvisVoiceEn). Jika tiada suara dipilih untuk bahasa itu,
            // biarkan provider pilih suara default mengikut kod bahasa.
            var lang = detectTextLanguage(plain); // "ms" | "en" | null
            var voiceId = lang === "ms" ? jarvisVoiceMs : (lang === "en" ? jarvisVoiceEn : "");
            var langCode = lang === "ms" ? "ms-MY" : (lang === "en" ? "en-US" : voiceLang);
            // Bina opts ikut provider: Gemini guna model + suara sendiri; Puter
            // guna suara/metadata dari senarai dinamik.
            function buildTtsOpts(vid, lcode) {
              if (ttsProvider === "gemini") {
                var go = { provider: "gemini", model: GEMINI_TTS_MODEL };
                if (vid) go.voice = vid;
                return go;
              }
              var pv = vid ? puterVoiceMap[vid] : null;
              if (vid) {
                var po = { voice: vid };
                if (pv && pv.language) po.language = pv.language;
                if (pv && pv.provider) po.provider = pv.provider;
                return po;
              }
              return { language: lcode };
            }
            var opts = buildTtsOpts(voiceId, langCode);
            window.puter.ai.txt2speech(plain, opts)
              .then(function (a) { _playPuterAudio(a, force); })
              .catch(function (err) {
                // Cuba sekali lagi dengan opts yang sama (kekalkan pilihan suara,
                // jangan jatuh balik ke default senyap).
                try {
                  var o2 = buildTtsOpts(voiceId, langCode);
                  window.puter.ai.txt2speech(plain, o2).then(function (a) { _playPuterAudio(a, force); }).catch(function (err2) {
                    _showTtsError(err2 || err);
                  });
                } catch (e2) { _showTtsError(err); }
              });
          } catch (e) { _showTtsError(e); }
        }).catch(function () {});
      });
    }
    // Bacakan respons ringkas MELALUI Puter TTS (suara neural). Tiada fallback OS.
    function speakJarvis(text) {
      if (!jarvisTtsEnabled) return;
      var plain = ttsPlainText(text);
      if (!plain) return;
      if (plain.length > 600) plain = plain.slice(0, 597).replace(/\s+\S*$/, "") + "…";
      stopSpeaking();
      speakJarvisPuter(plain);
    }
    // Ulang-baca mesej tertentu atas permintaan (butang 🔊 pada bubble), walaupun
    // toggle TTS dimatikan. Teruskan ke Puter TTS tanpa mengubah status toggle.
    function replaySpeak(text) {
      var plain = ttsPlainText(text);
      if (!plain) return;
      if (plain.length > 600) plain = plain.slice(0, 597).replace(/\s+\S*$/, "") + "…";
      stopSpeaking();
      speakJarvisPuter(plain, true);
    }

    // ── Voice I/O (SpeechRecognition) DIBUANG: tidak disokong di Firefox ──

    function sendToProvider(prompt, onComplete) {
      if (pendingCapturePromise) {
        var p = pendingCapturePromise;
        pendingCapturePromise = null;
        p.then(function () { sendToProvider(prompt, onComplete); }).catch(function () { sendToProvider(prompt, onComplete); });
        return;
      }
      if (_cacheEnabled && !planningMode && !pendingImage) {
        var Cache = window.LocalPocketJarvisCache;
        if (Cache) {
          var cached = Cache.get(prompt);
          if (cached) {
            _lastCachePrompt = prompt;
            var token = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            currentToken = token;
            activeAssistantBubble = addPlaceholderBubble();
            resetStreamState();
            activeOnComplete = onComplete || null;
            pendingImage = null;
            pendingImageUsed = false;
            if (cached.responseHtml) {
              var cleanHtml = sanitizeHtml(cached.responseHtml || "");
              if (cleanHtml) {
                recordTurn("jarvis", htmlToPlainText(cleanHtml));
                _finishStreamRender(null, cached.responseHtml);
              } else if (activeAssistantBubble) {
                setBubbleText(activeAssistantBubble, "Jawapan dihentikan (tiada teks dijana). Cuba taip semula.");
              }
            } else {
              var clean = sanitizeProviderResponse(cached.responseText || "");
              if (clean) {
                recordTurn("jarvis", clean);
                _finishStreamRender(clean, null);
              } else if (activeAssistantBubble) {
                setBubbleText(activeAssistantBubble, "Jawapan dihentikan (tiada teks dijana). Cuba taip semula.");
              }
            }
            finishChat();
            focusInput();
            return;
          }
        }
      }
      var token = "j" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      currentToken = token;
      activeAssistantBubble = addPlaceholderBubble();
      resetStreamState();
      activeOnComplete = onComplete || null;
      ensureProviderIframe();
      focusInput();
      armResponseWatchdog();
      var hasImage = !!pendingImage;
      _lastCachePrompt = hasImage ? "" : prompt;
      pendingImageUsed = hasImage;
      pendingAttachImage = hasImage ? pendingImage : null;
      // If a text-only question is sent (no image), remember it so that an image
      // attached afterwards (screenshot / file / drag-drop) can be re-sent with
      // the question.  Otherwise clear the expectation.
      if (hasImage) {
        expectingImageAfterQuestion = false;
        expectingImageAfterQuestionTs = 0;
      } else {
        expectingImageAfterQuestion = true;
        expectingImageAfterQuestionTs = Date.now();
      }
      // Include the image in the runtime.sendMessage payload so the content
      // script can read it directly from peek-pending-sidebar-prompt.image —
      // this avoids the postMessage race condition.  Cropped regions are
      // typically <300 KB, well within the ~1 MB limit.  If the image is
      // unusually large (>800 KB base64 = ~600 KB binary) we skip it here
      // so the message never exceeds the limit; the postMessage backup
      // (deliverImageToProvider) handles those cases.
      var msgImage = null;
      if (hasImage && pendingImage.length < 800000) { msgImage = pendingImage; }
      pendingImage = null;  // keep thumbnail visible until finishChat
      api.runtime.sendMessage({
      type: "open-ai-sidebar-with-prompt",
      prompt: prompt,
      image: msgImage,
      provider: PROVIDER,
      overlayToken: token,
      fromOverlay: true,
      suppressPageContext: hasImage
     }).then(function (res) {
       if (!res || !res.ok) {
         if (activeAssistantBubble) setBubbleText(activeAssistantBubble,
           "JARVIS tak dapat hubungi " + PROVIDER + " (offline / belum log masuk / AI Sidebar dimatikan). " +
           "Arahan setempat seperti simpan, tatal, klik dan isi masih berfungsi tanpa " + PROVIDER + "."
         );
         finishChat();
       }
       }).catch(function () {
         if (activeAssistantBubble) setBubbleText(activeAssistantBubble,
           "Tiada sambungan ke " + PROVIDER + ". Semak internet anda. " +
           "Arahan setempat (simpan, tatal, klik, isi, salin) tetap boleh digunakan."
         );
         finishChat();
       });
      deliverImageToProvider();
    }
    // Finalize the active chat turn and fire its completion callback so the
    // command queue can advance.
    // Offline follow-up question chips (feature #3) are enabled by default.
    var followupsEnabled = true;

    // Render up to 3 tappable follow-up suggestion chips under a finished
    // JARVIS answer. Tapping a chip re-runs JARVIS with that question.
    function renderFollowupChips(bubble, suggestions) {
      if (!bubble || !Array.isArray(suggestions) || !suggestions.length) return;
      var row = el("div", { className: "lp-jarvis-followups" });
      suggestions.slice(0, 3).forEach(function (s) {
        var b = el("button", { className: "lp-jarvis-chip lp-jarvis-chip-followup", type: "button", text: s });
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          processMessage(s);
        });
        row.appendChild(b);
      });
      bubble.appendChild(row);
    }

    function finishChat() {
      clearResponseWatchdog();
      // Drop the in-transcript "Memproses…" indicator now that the answer turn
      // is finalized. This must happen here (not only via updateCancelButton),
      // because sendToProvider is often called without a completion callback
      // (doSummarize/doChat/translate/etc.), so the queue done() — and thus
      // updateCancelButton — may never run for this bubble.
      clearBubbleProcessing();
      // Clear attached image ONLY if it was successfully consumed by
      // sendToProvider. If the image was set AFTER sendToProvider ran (async
      // screenshot completing after the question was sent), don't clear it
      // — it persists for the next question.
      if (pendingImageUsed) { clearPendingImage(); pendingImageUsed = false; }
      var finishedBubble = activeAssistantBubble;
      activeAssistantBubble = null;
      currentToken = "";
      // #3 — TTS: bacakan respons ringkas JARVIS bila togol dihidupkan.
      if (jarvisTtsEnabled && finishedBubble) {
        try { speakJarvis(getBubblePlainText(finishedBubble) || ""); } catch (eTts) {}
      }
      // Offline follow-up suggestions (feature #3): show 2-3 tappable chips
      // under the just-finished answer so the user can keep digging.
      if (finishedBubble && followupsEnabled) {
        var lastAnswer = getBubblePlainText(finishedBubble) || "";
        if (lastAnswer && lastAnswer !== "…" && lastAnswer.indexOf("Tiada sambungan") === -1) {
          try {
            var fctx = Core.extractPageContext();
            renderFollowupChips(finishedBubble, Core.buildFollowupSuggestions(fctx, history, lastAnswer));
          } catch (e2) {}
        }
      }
      // #5 — Ekstrak fakta pengguna dari sejarah sembang ke graf pengetahuan
      // (memoryExtractor.js) supaya JARVIS "ingat" preferensi jangka panjang.
      // Dithrottle supaya tak berlari setiap mesej.
      try {
        if (window.LocalPocketMemoryExtractor) {
          window.LocalPocketMemoryExtractor.maybeRun(history).catch(function () {});
        }
      } catch (eMem) {}
      if (finishedBubble) {
        userScrolledUp = false;
        requestAnimationFrame(function () {
          if (finishedBubble) finishedBubble.scrollIntoView({ block: "start", behavior: "smooth" });
        });
      }
      var cb = activeOnComplete; activeOnComplete = null;
      if (cb) cb();
    }

  /* ---------- Incoming messages ---------- */

   // Storage-based handoff for chained navigation commands: the background arms
   // a pending plan/action in chrome.storage.local keyed by the new tab's id
   // (see armPlanOnLoad/armActionOnLoad). This is immune to the timing problems
   // of tabs.sendMessage to a freshly-created tab, guaranteeing the queued step
   // (e.g. click_first_link) runs in the loaded tab even if the live message is
   // missed. Guarded so it never double-executes with the live message path.
    function checkPendingPlan() {
      var tid = window.__jarvisTabId;
      if (tid == null) return;
      if (window.__jarvisPendingExecuted) return;
      try {
        if (api.storage && api.storage.local && api.storage.local.get) {
          api.storage.local.get("jarvisPending:" + tid, function (res) {
            var entry = res && res["jarvisPending:" + tid];
            if (!entry) return;
            try { api.storage.local.remove("jarvisPending:" + tid); } catch (e2) {}
            if (window.__jarvisPendingExecuted) return;
            window.__jarvisPendingExecuted = true;
            console.log("[JARVIS-DEBUG] checkPendingPlan executing " + entry.kind);
            jarvisDebug("HANDOFF: jalankan " + entry.kind + " dalam tab ini");
            if (entry.kind === "plan" && Array.isArray(entry.plan)) runPlanSequential(entry.plan, 0, entry.userText || "", 0);
            else if (entry.kind === "action" && entry.action) runSinglePlan(entry.action, entry.userText || "");
          });
        }
      } catch (e) {}
    }

   // Ask the background for our own tab id, then check for a pending handoff.
   try {
     api.runtime.sendMessage({ type: "jarvis-get-tab-id" }, function (id) {
       window.__jarvisTabId = id;
       setTimeout(checkPendingPlan, 1200);
     });
   } catch (e) {}

  api.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || typeof message !== "object") return undefined;

    // Restore the panel after a region/image capture: the panel was hidden (its
    // content set to display:none) while the user picked a region/image on the
    // active tab. Bring it back and attach the captured image — no reload needed.
    if (message.type === "jarvis-restore-capture") {
      try { showPanelAfterCapture(); } catch (e) {}
      if (message.dataUrl) {
        try { pendingImage = message.dataUrl; showPendingImageThumb(); } catch (e) {}
        try { saveScreenshotToGallery(message.dataUrl); } catch (e) {}
      }
      try { if (api && api.storage && api.storage.local) api.storage.local.remove("pendingJarvisCapture"); } catch (e) {}
      // Quick image search: auto-submit "/cari" with the captured image
      if (message.autoSearch === true && pendingImage) {
        _autoSearchTriggered = true;
        try { if (api && api.storage && api.storage.local) api.storage.local.remove("__lpHoverImageSearchPending"); } catch (e2) {}
        setTimeout(function () {
          try {
            pendingUserImage = pendingImage;
            if (inputEl) {
              inputEl.value = "/cari";
              if (typeof submit === "function") submit();
              else {
                var _s = document.getElementById("lp-jarvis-send");
                if (_s) _s.click();
              }
            }
          } catch (e) {}
        }, 300);
      }
      try { sendResponse({ ok: true }); } catch (e) {}
      return true;
    }

    // Pilihan teks dari TAB AKTIF dihantar oleh skrip halaman (floatingButtonFull.js)
    // bila pengguna memilih teks. Dalam sidebar host, paparkan butang selection
    // search sedia ada (G/B/D/YT, Ai, ＋Note) dalam panel JARVIS. Guna semula
    // pengesanan pilihan sedia ada — tiada "poll".
    if (message.type === "jarvis-host-selection") {
      if (SIDEBAR_HOST) {
        try {
          var selTxt = (typeof message.text === "string") ? message.text.trim() : "";
          hostSelection = selTxt;
          // Butang Ai / ➕ sentiasa muncul pada pilihan teks — TIDAK digates oleh
          // toggle SSS (kanta pembesar). SSS dikendalikan popup berasingan.
          if (selTxt) showSelButtons(null);
          else hideSelButtons();
          // Beritahu LPSelectionSearch supaya popup SSS turut muncul untuk
          // pilihan teks dari tab aktif (selectionchange DOM tak fire untuk
          // pilihan di dokumen lain).
          try {
            if (window.LPSelectionSearch && selTxt) {
              LPSelectionSearch.scheduleUpdate(true);
            }
          } catch (e2) {}
        } catch (e) {}
      }
      return undefined;
    }

    // ── Sidebar-host bridge (page side) ──────────────────────────────────────
    // When JARVIS runs in the native sidebar (SIDEBAR_HOST), its page-DOM needs
    // are fulfilled HERE, in the active tab's content script, and relayed back.
    // These must run even while JARVIS is suspended (the AI sidebar is open
    // exactly when the host is active), so they sit above the suspend guard.
    if (!SIDEBAR_HOST && message.type === "jarvis-host-observe") {
      try {
        try { capturePageElements(); } catch (eCap) {}
        sendResponse({ ok: true, context: Core.extractPageContext(), host: siteHost(), selection: getSelectionText() });
      } catch (e) { try { sendResponse({ ok: false }); } catch (e2) {} }
      return true;
    }
    if (!SIDEBAR_HOST && message.type === "jarvis-host-build-plan-prompt") {
      try {
        try { capturePageElements(); } catch (eCap) {}
        var _h = Array.isArray(message.history) ? message.history : [];
        var _prompt = Core.buildPlanPrompt(String(message.command || ""), Core.extractPageContext(), _h, TOOLS, elementHintsForSite(siteHost()));
        sendResponse({ ok: true, prompt: _prompt });
      } catch (e) { try { sendResponse({ ok: false }); } catch (e2) {} }
      return true;
    }
    if (!SIDEBAR_HOST && message.type === "jarvis-host-build-replan-prompt") {
      try {
        var _rp = Core.buildReplanPrompt(message.failedAction, Core.buildObservation(), Core.buildDomSnapshot({ max: 80 }));
        sendResponse({ ok: true, prompt: _rp });
      } catch (e) { try { sendResponse({ ok: false }); } catch (e2) {} }
      return true;
    }
    if (!SIDEBAR_HOST && message.type === "jarvis-host-run-action") {
      var _plan = message.plan;
      if (!_plan || typeof _plan !== "object") { try { sendResponse({ ok: false }); } catch (e2) {} return true; }
      // Capture the executor's user-facing bubbles so the sidebar can render
      // them (the active tab's own JARVIS panel is closed/suspended).
      var _captured = [];
      var _origAdd = addBubble;
      addBubble = function (role, text) { try { _captured.push({ role: role, text: text }); } catch (e) {} return null; };
      var _finished = false;
      var _finish = function (res) {
        if (_finished) return; _finished = true;
        addBubble = _origAdd;
        try { sendResponse({ ok: true, result: res || { ok: true }, bubbles: _captured }); } catch (e) {}
      };
      try { runSinglePlan(_plan, String(message.userText || ""), _finish); }
      catch (e) { addBubble = _origAdd; try { sendResponse({ ok: false, bubbles: _captured }); } catch (e2) {} }
      return true;
    }

    // State sync from the background: the Local Pocket AI sidebar just opened
    // (open=true) or closed (open=false). This message is always processed,
    // even while JARVIS is suspended, so it can resume when the sidebar closes.
    if (message.type === "lp-ai-sidebar-state") {
      // Only suspend JARVIS (overlay mode) while the AI sidebar is open.
      // In sidebar mode JARVIS stays docked alongside the AI sidebar.
      setJarvisSuspended(message.open === true && jarvisMode === "overlay");
      return undefined;
    }

    // While the AI sidebar is open JARVIS is fully suspended — ignore every
    // other JARVIS-related message so it does nothing until the sidebar closes.
    // NOTE: forwarded plan/action steps (from a chained navigation command) must
    // run EVEN while JARVIS is suspended, because they are part of the user's own
    // command execution, not proactive automation.
     if (message.type === "jarvis-run-plan") {
       var jrp = message.plan;
       console.log("[JARVIS-DEBUG] jarvis-run-plan received: " + (Array.isArray(jrp) ? JSON.stringify(jrp) : String(jrp)));
       jarvisDebug("LIVE: jarvis-run-plan diterima");
       if (Array.isArray(jrp) && jrp.length) {
         window.__jarvisPendingExecuted = true;
         try { if (window.__jarvisTabId != null) api.storage.local.remove("jarvisPending:" + window.__jarvisTabId); } catch (e2) {}
         runPlanSequential(jrp, 0, message.userText || "", 0);
       }
        return undefined;
      }
     if (message.type === "jarvis-run-action") {
      var ra = message.action;
      window.__jarvisPendingExecuted = true;
       try { if (window.__jarvisTabId != null) api.storage.local.remove("jarvisPending:" + window.__jarvisTabId); } catch (e2) {}
      if (ra && typeof ra === "object" && ra.action) runSinglePlan(ra, "");
      else if (ra === "click_first_link") doClickFirstLink();
      return undefined;
    }
    if (jarvisSuspended) return undefined;

    if (message.type === "close-jarvis-overlay") {
      try { if (open) closePanelIfOpen(); } catch (e) {}
      return undefined;
    }
    if (message.type === "toggle-jarvis-overlay") {
      // Hormati arahan buka/tutup eksplisit supaya flip dari sidebar sentiasa
      // membuka overlay (dan tak terbalik tutup bila dah terbuka). Bila arahan
      // buka datang, pastikan JARVIS tak tertahan — sidebar sedang ditutup, jadi
      // saiz lampau (race) dengan broadcast lp-ai-sidebar-state tak halang buka.
      if (message.open === true) {
        setJarvisSuspended(false);
        if (!open) toggle();
      } else if (message.open === false) {
        if (open) toggle();
      } else {
        toggle();
      }
      return undefined;
    }

    if (message.type === "jarvis-set-prompt") {
      // Panel sidebar (SIDEBAR_HOST) terima prompt luar daripada butang AI.
      if (!SIDEBAR_HOST) return undefined;
      try {
        if (typeof processMessage === "function" && typeof message.text === "string" && message.text) {
          processMessage(message.text);
        } else {
          var _ta = document.getElementById("lp-jarvis-input");
          var _send = document.getElementById("lp-jarvis-send");
          if (_ta && _send && typeof message.text === "string" && message.text) {
            _ta.value = message.text;
            _ta.dispatchEvent(new Event("input", { bubbles: true }));
            _send.click();
          }
        }
      } catch (e2) {}
      // Prompt dah sampai — buang salinan tertunggak dalam storage supaya
      // ia tak dihantar sekali lagi bila panel dimuat semula.
      try { api.storage.local.remove("jarvisSidebarPendingPrompt"); } catch (e3) {}
      return undefined;
    }

    // Sent by the background on every main-frame navigation (webNavigation
    // onCommitted) so JARVIS flushes its per-site element hints against the
    // new DOM instead of letting stale hints accumulate (perf/memory hygiene).
     if (message.type === "jarvis-flush-element-hints") {
       if (message.tabId != null) window.__jarvisTabId = message.tabId;
       setTimeout(function () { try { seedElements(); } catch (e2) {} }, 800);
       // A navigation just committed in this tab — re-check for any pending
       // chained action handed off by the background (storage-based fallback).
       setTimeout(checkPendingPlan, 1200);
       return undefined;
     }

    if (message.type === "ai-overlay-response") {
      if (!message.overlayToken || message.overlayToken !== currentToken) return undefined;
      if (planningMode) {
        planAcc = message.responseText || "";
        armPlannerWatchdog();
        // Panangkan semula pemasa queue pada setiap chunk supaya provider
        // yang lambat tapi masih menjana tidak dianggap "mati" dan tidak
        // membatalkan JARVIS sebelum jawapan sempat sampai.
        armQueueWatchdog();
        // Execute as soon as a complete, valid plan is present. This also covers
        // the case where generation is stopped before the final `done` event
        // arrives (e.g. "You stopped this response"), so the intent still runs.
        function finishPlanning() {
          clearPlannerWatchdog();
          planningMode = false;
          currentToken = "";
          if (planningBubble) { planningBubble.remove(); planningBubble = null; }
          var plan = extractPlan(planAcc);
          // Route to the requester (initial plan OR ReAct self-correction); fall
          // back to executePlan which handles the no-plan -> chat case.
           var h = pendingPlanHandler; pendingPlanHandler = null;
           var oc = pendingPlanOnComplete; pendingPlanOnComplete = null;
           if (h) { h(plan); }
           else { executePlan(planAcc, lastUserText); if (oc) oc(); }
          focusInput();
        }
        var earlyPlan = extractJson(planAcc);
        if (earlyPlan && earlyPlan.action) {
          finishPlanning();
          return undefined;
        }
        if (message.done) {
          finishPlanning();
        }
        return undefined;
      }
      if (activeAssistantBubble) {
        var responseHtml = message.responseHtml;
        var isHtmlResponse = !!responseHtml;
        if (responseHtml) {
          // Rich HTML response (Gemini) — DON'T sanitize here (it's expensive
          // and ran per chunk, blocking typing). The coalesced frame flush /
          // final render sanitize once each.
          appendAssistantHtml(responseHtml);
        } else {
          var clean = sanitizeProviderResponse(message.responseText || "");
          if (clean) appendAssistantText(clean);
        }
        armResponseWatchdog();
        // Panangkan semula pemasa queue pada setiap chunk (sama seperti di atas).
        armQueueWatchdog();
          if (message.done) {
             if (isHtmlResponse) {
               var clean = sanitizeHtml(responseHtml || "");
               if (clean) {
                 recordTurn("jarvis", htmlToPlainText(clean));
                 _finishStreamRender(null, responseHtml);
               } else if (activeAssistantBubble) {
                 setBubbleText(activeAssistantBubble, "Jawapan dihentikan (tiada teks dijana). Cuba taip semula.");
               }
             } else if (clean) {
               // History stores plain text; for HTML responses, strip markup so
               // re-rendering (which runs linkify) does not escape the tags.
               recordTurn("jarvis", clean);
               // Final, fully-formatted (markdown + sanitize + code buttons) render
               // — done ONCE here instead of on every streamed chunk.
               _finishStreamRender(clean, null);
             }
             else if (activeAssistantBubble) {
               setBubbleText(activeAssistantBubble, "Jawapan dihentikan (tiada teks dijana). Cuba taip semula.");
             }
             // Simpan respons dalam cache untuk pertanyaan yang sama akan datang
             if (_lastCachePrompt && window.LocalPocketJarvisCache && !planningMode) {
               window.LocalPocketJarvisCache.set(_lastCachePrompt, responseHtml || null, clean || null);
             }
            finishChat();
            focusInput();
          }
      }
      return undefined;
    }

    return undefined;
  });

  // The JARVIS panel is toggled by the configurable "toggle-jarvis" manifest
  // command (default F4), managed via the Options → Keyboard section. Routing
  // the toggle through the command API keeps it customizable; the command fires
  // in the background and messages this content script (see the
  // "toggle-jarvis-overlay" message handler above).
  // Keep focus in the JARVIS input: block the browser's native F6 focus-cycle
  // (page -> address bar -> sidebar) from yanking the cursor out while the
  // overlay is open. The synthetic F6 dispatch is already disabled in the
  // background/sidebar scripts; this stops the real F6 keypress from doing it.
  document.addEventListener("keydown", function (e) {
    if (open && (e.key === "F6" || e.code === "F6") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      focusInput();
    }
  }, true);

    loadLearning();
    loadMacros();
    var __built = false;
    try {
      buildPanel();
      __built = true;
    } catch (buildErr) {
      showFatalError("[buildPanel] " + (buildErr && buildErr.stack ? buildErr.stack : buildErr));
    }
    // Buang penunjuk "loading" (jika ada) sebaik sahaja bina selesai, tak kira
    // berjaya atau gagal (fallback dipaparkan oleh showFatalError jika gagal).
    try {
      var boot = document.getElementById("lp-jarvis-boot");
      if (boot && boot.parentNode) boot.parentNode.removeChild(boot);
    } catch (e) {}

    if (SIDEBAR_HOST) {
      // The sidebar host is always "open" and fills the whole panel. Skip the
      // AI-sidebar suspension probe and the page element-hint seeding (there is
      // no host web page to scan here — that happens on the active tab instead).
      try {
        open = true;
        if (root) {
          root.classList.add("lp-jarvis-host");
        }
        applyJarvisModeClass();
        expectInputFocus = true;
        // Jangan tambah "lp-jarvis-open" (paparkan panel) sehingga prefs sedia,
        // supaya keadaan tersimpan tak kelihatan "terbuka lalu tertutup".
        revealJarvisWhenReady();
        // Tekan F6 tulen 4 kali bila panel sidebar JARVIS dimuatkan (sentiasa terbuka).
        pressNativeF6(4);
        startFocusKeeper();
        refreshHostObservation();
        // Ambil prompt tertunggak dari butang "Ai" (disimpan ke storage oleh
        // background kerana panel mungkin belum sedia bila mesej jarvis-set-prompt
        // dihantar). Hanya guna jika segar (<10s) supaya prompt lama tak dihantar
        // semula bila panel dibuka semula secara manual.
        try {
          api.storage.local.get("jarvisSidebarPendingPrompt", function (res) {
            var pend = res && res.jarvisSidebarPendingPrompt;
            if (!pend || !pend.text) return;
            try { api.storage.local.remove("jarvisSidebarPendingPrompt"); } catch (e2) {}
            if (Date.now() - (pend.ts || 0) > 10000) return;
            setTimeout(function () {
              try {
                if (!inputEl) return;
                inputEl.value = pend.text;
                if (typeof submit === "function") submit();
                else {
                  var _s = document.getElementById("lp-jarvis-send");
                  if (_s) _s.click();
                }
              } catch (e3) {}
            }, 300);
          });
        } catch (e) {}
        // JANGAN BIAR SIDEBAR KOSONG: papar mesej alu-aluan bila transkrip masih
        // kosong (tiada perbualan diingati). Guna renderBubble (bukan addBubble)
        // supaya mesej alu-aluan TAK direkod ke dalam history.
        try {
          if (transcriptEl && transcriptEl.childElementCount === 0) {
            renderBubble("jarvis",
              "JARVIS berjalan di sidebar. Tanya apa-apa, atau taip \"ringkaskan halaman ini\". " +
              "Gunakan butang \"↩ Overlay\" untuk kembali ke overlay terapung. Konteks diambil dari tab aktif.");
          }
        } catch (e) {}
        // Bila panel JARVIS ditutup, reset panel sidebar kembali ke
        // sidebar.html (AI/Gemini) supaya bukaan seterusnya tak kekal JARVIS.
        try {
          window.addEventListener("pagehide", function () {
            try { api.runtime.sendMessage({ type: "reset-sidebar-panel" }).catch(function () {}); } catch (e2) {}
          });
        } catch (e) {}
      } catch (e) {}
    } else {
    // If the Local Pocket AI sidebar is already open when this page loads,
    // suspend JARVIS immediately so it never activates alongside the sidebar.
    try {
      var probe = api.runtime.sendMessage({ type: "is-sidebar-ai-open" }, function (resp) {
        if (resp && resp.open === true) setJarvisSuspended(true);
      });
      if (probe && typeof probe.then === "function") {
        probe.then(function (resp) { if (resp && resp.open === true) setJarvisSuspended(true); }).catch(function () {});
      }
    } catch (e) {}
    }

    // Watchdog: jika selepas 8s panel masih belum dibina (root tiada), paparkan
    // mesej fallback supaya panel tidak kekal "kosong" tanpa penunjuk.
    try {
      setTimeout(function () {
        if (!root || !document.getElementById("lp-jarvis-root")) {
          if (!document.getElementById("lp-jarvis-fatal")) {
            showFatalError("[watchdog] JARVIS gagal bina panel dalam 8s. " +
              "Semak konsol / pastikan core/jarvisCore.js dimuat.");
          }
        }
      }, 8000);
    } catch (e) {}

   // ── #3 Proactive Agent: perhati konteks halaman & tawar bantuan proaktif ────
   // JARVIS memerhati halaman (artikel panjang, ralat, borang, YouTube, topik
   // dalam library) dan MENAWARKAN bantuan melalui lencana kecil (tak ganggu).
   // Enjin: core/proactiveEngine.js. UI: proactiveIndicator.js.
   // NOTA: panel sidebar sentiasa SIDEBAR_HOST, jadi runProactiveScan() keluar
   // awal — pengimbasan proaktif dijalankan oleh content script halaman
   // (jarvisOverlay.js). Kod ini dikekalkan simetri & untuk masa depan.
   var __proactiveIndicatorMounted = false;

   function ensureProactiveIndicator() {
     if (__proactiveIndicatorMounted) return;
     var PI = window.LocalPocketProactiveIndicator;
     if (!PI) return;
     try {
       PI.mount({
         onAccept: onProactiveAccept,
         onReject: function (s) {
           try { if (window.LocalPocketProactiveEngine) window.LocalPocketProactiveEngine.recordFeedback(s.id, false); } catch (e) {}
         },
         onDismiss: function () {}
       });
       __proactiveIndicatorMounted = true;
     } catch (e) {}
   }

   function ensureOpenPanel() {
     try { if (!SIDEBAR_HOST && !open) toggle(); } catch (e) {}
   }

   function openWaybackForCurrent() {
     var url = currentPageUrl();
     if (!url) return;
     var wb = "https://web.archive.org/web/*/" + url;
     try { window.open(wb, "_blank"); }
     catch (e) { try { api.runtime.sendMessage({ type: "jarvis-open-url", url: wb }); } catch (e2) {} }
   }

   function onProactiveAccept(s) {
     try { if (window.LocalPocketProactiveEngine) window.LocalPocketProactiveEngine.recordFeedback(s.id, true); } catch (e) {}
     if (!s || !s.action) return;
     switch (s.action) {
       case "suggest_summarize":
       case "suggest_youtube":
         ensureOpenPanel();
         setTimeout(function () { try { doSummarize(); } catch (e) {} }, 80);
         break;
       case "suggest_wayback":
         openWaybackForCurrent();
         break;
       case "suggest_autofill":
         ensureOpenPanel();
         setTimeout(function () {
           try { addBubble("jarvis", "Saya boleh bantu isi medan tertentu. Cuba beritahu, cth: \"isi medan emel dengan nama@contoh.com\"."); } catch (e) {}
         }, 80);
         break;
       case "suggest_library":
         ensureOpenPanel();
         setTimeout(function () {
           try { processMessage("Tanya simpanan saya: " + (currentPageTitle() || "")); } catch (e) {}
         }, 80);
         break;
       default:
         break;
     }
   }

   function countFormFields() {
     try {
       var nodes = document.querySelectorAll("form input, form textarea, form select");
       var n = 0;
       for (var i = 0; i < nodes.length; i++) {
         var t = (nodes[i].type || "").toLowerCase();
         if (t === "hidden" || t === "submit" || t === "button" || t === "reset" || t === "image") continue;
         n++;
       }
       return n;
     } catch (e) { return 0; }
   }

   function buildProactiveRaw() {
     var ctx = null;
     try { ctx = Core.extractPageContext(); } catch (e) {}
     ctx = ctx || {};
     return { url: currentPageUrl(), title: currentPageTitle(), text: ctx.text || "" };
   }

   function proactiveKeywords(title) {
     return (String(title || "").toLowerCase().match(/[a-z0-9\u00c0-\u024f]+/gi) || [])
       .filter(function (w) { return w.length > 3; }).slice(0, 5);
   }

   function showProactiveSuggestion(sug) {
     var PE = window.LocalPocketProactiveEngine;
     var PI = window.LocalPocketProactiveIndicator;
     if (!PE || !PI || !sug) return;
     ensureProactiveIndicator();
     PE.noteShown(sug.id);
     PI.show(sug);
   }

   function runProactiveScan() {
     if (SIDEBAR_HOST) return;        // konteks proaktif diuruskan oleh content script halaman
     if (jarvisSuspended) return;     // jangan aktif semasa AI sidebar dibuka
     var PE = window.LocalPocketProactiveEngine;
     var PI = window.LocalPocketProactiveIndicator;
     if (!PE || !PI) return;
     if (PI.isVisible && PI.isVisible()) return; // sudah ada cadangan dipapar
     var raw = buildProactiveRaw();
     if (!raw.url || /^about:|^moz-extension:|^chrome-extension:/.test(raw.url)) return;
     var opts = { formFieldCount: countFormFields(), now: Date.now() };
     var sug = PE.evaluate(raw, opts);
     if (sug) { showProactiveSuggestion(sug); return; }
     // Fasa 2: cadangan library (perlu carian latar) — hanya bila sangat proaktif.
     try {
       if (PE.proactiveLevel() >= 4 && raw.text && raw.text.length > 400) {
         var kws = proactiveKeywords(raw.title);
         if (kws.length) {
           api.runtime.sendMessage({ type: "jarvis-library-search", keywords: kws, limit: 6 }).then(function (res) {
             var items = (res && res.ok && res.items) || [];
             if (items.length >= 2) {
               var sug2 = PE.evaluate(raw, { formFieldCount: 0, libraryMatches: items.length, now: Date.now() });
               if (sug2 && sug2.action === "suggest_library") showProactiveSuggestion(sug2);
             }
           }).catch(function () {});
         }
       }
     } catch (e) {}
   }

   // Seed elementMemory from the current page once it has settled, and refresh it
   // on SPA-style navigation (history changes without a full reload).
   function seedElements() {
     if (SIDEBAR_HOST) return; // no host web page to scan in the sidebar
     if (jarvisSuspended) return; // don't scan the page while AI sidebar is open
     try { primeElementHints(siteHost()); } catch (e) {}
     try { capturePageElements(); } catch (e) {}
     try { purgeDeadHints(); } catch (e) {}
   }
  if (document.readyState === "complete") setTimeout(seedElements, 1200);
  else window.addEventListener("load", function () { setTimeout(seedElements, 800); });
  window.addEventListener("popstate", function () { setTimeout(seedElements, 600); });
  window.addEventListener("hashchange", function () { setTimeout(seedElements, 600); });
  // #3 Proactive Agent: imbas selepas halaman settle & pada navigasi SPA.
  if (document.readyState === "complete") setTimeout(runProactiveScan, 2500);
  else window.addEventListener("load", function () { setTimeout(runProactiveScan, 2200); });
  window.addEventListener("popstate", function () { setTimeout(runProactiveScan, 1500); });
  window.addEventListener("hashchange", function () { setTimeout(runProactiveScan, 1500); });
  // StatePersistenceSnapshot: the conversation is already auto-saved on every
  // turn (recordTurn -> saveHistory), but also flush on unload so a sudden
  // browser/app close can never drop the most recent turn.
  window.addEventListener("beforeunload", function () {
    try { saveHistory(); } catch (e) {}
    try { persistLearning(); } catch (e2) {}
  });
   // ─────────────────────────────────────────────────────────────────────────
   // #5 Automation Studio — dedahkan fungsi JARVIS kepada enjin makro & buka studio.
   // ─────────────────────────────────────────────────────────────────────────
   function openAutomation() {
     try {
       if (window.LocalPocketAutomationStudio) window.LocalPocketAutomationStudio.open();
     } catch (e) {}
   }
   try {
     window.LocalPocketJarvisActions = {
       openUrl: function (u) { try { doOpenUrl(u); } catch (e) {} },
       navigate: function (u) { try { doNavigate(u); } catch (e) {} },
       newTab: function () { try { sendBrowser("new_tab", {}); } catch (e) {} },
       closeTab: function () { try { sendBrowser("close_tab", {}); } catch (e) {} },
       closeAllTabs: function () { try { sendBrowser("close_all_tabs", {}); } catch (e) {} },
       reload: function () { try { sendBrowser("reload", {}); } catch (e) {} },
       back: function () { try { sendBrowser("back", {}); } catch (e) {} },
       forward: function () { try { sendBrowser("forward", {}); } catch (e) {} },
       duplicateTab: function () { try { sendBrowser("duplicate_tab", {}); } catch (e) {} },
       bookmark: function () { try { sendBrowser("bookmark", {}); } catch (e) {} },
       printPage: function () { try { sendBrowser("print", {}); } catch (e) {} },
       zoom: function (d) { try { sendBrowser("zoom", { direction: d === "out" ? "out" : "in" }); } catch (e) {} },
       save: function () { try { doSave(); } catch (e) {} },
       summarize: function () { try { doSummarize(); } catch (e) {} },
       ask: function (t) { try { doChat(t || "", function () {}); } catch (e) {} },
       summarizeSelection: function (q) { try { doSummarizeSelection(q); } catch (e) {} },
       translateSelection: function (q) { try { doTranslateSelection(q); } catch (e) {} },
       copyUrl: function () { try { doCopyUrl(); } catch (e) {} },
       copyAnswer: function () { try { doCopyAnswer(); } catch (e) {} },
       click: function (t, i) { try { doClick(t, i || 0); } catch (e) {} },
       clickFirstLink: function () { try { doClickFirstLink(); } catch (e) {} },
       fill: function (f, v, i) { try { doFill(f, v, i); } catch (e) {} },
        scroll: function (d) { try { doScroll(d === "up" ? "up" : "down"); } catch (e) {} },
       // Hantar prompt ke Gemini (otak berfikir) & kembalikan jawapan teks.
       // sendToProvider tak beri jawapan via callback, jadi kita baca dari
       // bubble assistant terakhir dalam transkrip bila siap.
       askGemini: function (prompt) {
         return new Promise(function (resolve) {
           if (typeof sendToProvider !== "function") { resolve(""); return; }
           sendToProvider(prompt, function () {
             var ans = "";
             try {
               var bubbles = transcriptEl ? transcriptEl.children : [];
               for (var i = bubbles.length - 1; i >= 0; i--) {
                 var b = bubbles[i];
                 if (b && b.className && typeof b.className === "string" &&
                     b.className.indexOf("lp-jarvis-bubble-jarvis") !== -1) {
                   var content = b.querySelector ? b.querySelector(".lp-jarvis-bubble-content") : null;
                   var node = content || b;
                   var clone = node.cloneNode(true);
                   var rm = clone.querySelectorAll ? clone.querySelectorAll(".lp-jarvis-bubble-actions, .lp-jarvis-followups, .lp-jarvis-bubble-status") : [];
                   for (var k = 0; k < rm.length; k++) { if (rm[k].parentNode) rm[k].parentNode.removeChild(rm[k]); }
                   ans = (clone.textContent || "").trim();
                   break;
                 }
               }
             } catch (e2) {}
             resolve(ans);
           });
         });
       },
       getContext: function () {
         try {
           if (SIDEBAR_HOST && hostCtx) {
             var h = "";
             try { h = new URL(hostCtx.url || "").hostname; } catch (e) { h = location.hostname; }
             return { url: hostCtx.url || location.href, title: hostCtx.title || "", host: h, text: hostCtx.text || "" };
           }
           return { url: location.href, title: document.title, host: location.hostname, text: "" };
         } catch (e) { return { url: location.href, title: document.title, host: location.hostname, text: "" }; }
       }
      };
    } catch (e) {}

   // ─────────────────────────────────────────────────────────────────────────
   // #5 — cipta / jalan / padam automasi TERUS dari chat (tanpa buka studio).
   // ─────────────────────────────────────────────────────────────────────────
   function automationHandlers() {
     var A = window.LocalPocketJarvisActions || {};
     return {
       open_url: function (p) { A.openUrl && A.openUrl(p.target); },
       navigate: function (p) { A.navigate && A.navigate(p.target); },
       new_tab: function () { A.newTab && A.newTab(); },
       close_tab: function () { A.closeTab && A.closeTab(); },
       close_all_tabs: function () { A.closeAllTabs && A.closeAllTabs(); },
       reload: function () { A.reload && A.reload(); },
       back: function () { A.back && A.back(); },
       forward: function () { A.forward && A.forward(); },
       duplicate_tab: function () { A.duplicateTab && A.duplicateTab(); },
       bookmark: function () { A.bookmark && A.bookmark(); },
       print_page: function () { A.printPage && A.printPage(); },
       zoom: function (p) { A.zoom && A.zoom(p.direction); },
       save: function () { A.save && A.save(); },
       summarize: function () { A.summarize && A.summarize(); },
       ask: function (p) { A.ask && A.ask(p.text || ""); },
       summarize_selection: function (p) { A.summarizeSelection && A.summarizeSelection(p.query); },
       translate_selection: function (p) { A.translateSelection && A.translateSelection(p.query); },
       copy_url: function () { A.copyUrl && A.copyUrl(); },
       copy_answer: function () { A.copyAnswer && A.copyAnswer(); },
       click: function (p) { A.click && A.click(p.target, p.index); },
       click_first_link: function () { A.clickFirstLink && A.clickFirstLink(); },
       fill: function (p) { A.fill && A.fill(p.field, (p.value != null ? p.value : p.text), p.index); },
        scroll: function (p) { A.scroll && A.scroll(p.direction); }
     };
   }

    function plannerPrompt(description) {
      // Bina senarai action SEBENAR daripada katalog enjin supaya sentiasa
      // selari (Gemini tak akan cadang action yang tak wujud).
      var actions = [];
      var Eng = window.LocalPocketMacroEngine;
      if (Eng && Eng.ACTION_CATALOG) {
        actions = Eng.ACTION_CATALOG.map(function (a) { return a.id; });
      } else {
        actions = ["open_url","navigate","new_tab","close_tab","reload","back","forward",
          "duplicate_tab","bookmark","print_page","zoom","save","summarize","ask",
          "summarize_selection","translate_selection","copy_url","copy_answer","click",
          "click_first_link","fill","scroll","wait"];
      }
      return [
        "Awak perancang automasi untuk JARVIS. Tukar permintaan pengguna kepada SATU objek JSON makro sahaja.",
        "Jangan tulis teks lain, jangan guna markdown/code-fence. Hanya JSON sah.",
        'Format: {"name":"...","enabled":true,"trigger":{"type":"manual"},"blocks":[]}',
        "Action dibenarkan: " + actions.join(", ") + ".",
        'Blok: {"type":"action","action":"<id>","params":{...}} | {"type":"wait","ms":N} (ms DI LUAR params) |',
        '{"type":"condition","when":{"field":"url","op":"contains","value":"x"},"then":[...],"else":[...]} |',
        '{"type":"loop","times":N,"do":[...]} | {"type":"call","macro":"Nama Makro"}.',
        'Medan when/then/else/times/do/macro/ms mesti DI PERINGKAT ATAS blok, BUKAN dalam "params".',
        'Param ikut action: open_url/navigate → target(URL); ask → text; translate_selection/summarize_selection → query;',
        'fill → field(label medan, cth "carian") + value(teks diisi) + index(int, pilihan); click → target + index;',
        'scroll/zoom → direction("in"/"out"/"up"/"down"); wait → ms(int, DI LUAR params).',
        'UNTUK "taip X": guna fill dengan field=label medan & value="X". JANGAN guna param bernama "text" untuk fill.',
        'Trigger: manual {} | time {kind:"daily",time:"HH:MM",days:[0-6]} | time {kind:"interval",minutes:N} | tab {urlMatch:"..."} | shortcut {}.',
        'Guna action "ask" dengan params.text bila perlu tanya AI. Jangan reka action di luar senarai.',
        "Permintaan pengguna: " + description,
        "JSON:"
      ].join("\n");
    }

    // Keluarkan objek JSON tunggal daripada teks Gemini (tangani code-fence,
    // teks pengantar, dan JSON nested).
    function extractJson(text) {
      if (!text) return null;
      var t = String(text).trim();
      // Buang code-fence ```json ... ``` atau ``` ... ```
      var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fence) t = fence[1].trim();
      var s = t.indexOf("{");
      var e = t.lastIndexOf("}");
      if (s === -1 || e === -1 || e <= s) return null;
      var raw = t.slice(s, e + 1);
      try { return JSON.parse(raw); }
      catch (e1) {
        // Cuba baiki JSON longgar: tukar ' kepada ", buang koma trailing.
        try {
          var fixed = raw
            .replace(/,\s*([}\]])/g, "$1")
            .replace(/([{:,])\s*'([^']*)'\s*:/g, '$1"$2":')
            .replace(/:\s*'([^']*)'/g, ':"$1"');
          return JSON.parse(fixed);
        } catch (e2) { return null; }
      }
    }

    // Seragamkan bentuk blok — Gemini kadang letak medan struktur dalam
    // "params" (cth {"type":"wait","params":{"ms":3000}}) sedangkan enjin/
    // pengesah jangka medan di peringkat atas. Pindah ke atas supaya sah.
    function normalizeMacro(macro) {
      if (!macro || !Array.isArray(macro.blocks)) return macro;
      function walk(blocks) {
        if (!Array.isArray(blocks)) return;
        blocks.forEach(function (b) {
          if (!b || typeof b !== "object") return;
          if (b.type === "wait") {
            if (b.ms == null && b.params && b.params.ms != null) b.ms = Number(b.params.ms);
          } else if (b.type === "condition") {
            if (b.params) {
              if (!b.when && b.params.when) b.when = b.params.when;
              if (!b.then && b.params.then) b.then = b.params.then;
              if (b.else == null && b.params.else != null) b.else = b.params.else;
            }
            if (Array.isArray(b.then)) walk(b.then);
            if (Array.isArray(b.else)) walk(b.else);
          } else if (b.type === "loop") {
            if (b.params) {
              if (b.times == null && b.params.times != null) b.times = Number(b.params.times);
              if (!b.do && b.params.do) b.do = b.params.do;
            }
            if (Array.isArray(b.do)) walk(b.do);
          } else if (b.type === "call") {
            if (!b.macro && b.params && b.params.macro) b.macro = b.params.macro;
          } else if (b.type === "action" && b.action === "fill" && b.params) {
            // Gemini kadang guna "text" dan\/atau "query" dan\/atau tiada "field".
            if (b.params.value == null && b.params.text != null) b.params.value = b.params.text;
            if (b.params.value == null && b.params.query != null) b.params.value = b.params.query;
          }
        });
      }
      walk(macro.blocks);
      return macro;
    }

    var PLAN_TIMEOUT_MS = 30000;

    function createAutomationFromChat(raw) {
      var m = String(raw || "").match(/(cipta|buat|hasilkan|wujudkan|setup|setkan|jadualkan|otomasikan)\s+(automasi|otomasi|makro|routine|rutin|workflow)\s*[:\-]?\s*(.*)/i);
      var desc = (m && m[3] && m[3].trim()) ? m[3].trim() : String(raw || "").trim();
      // Buang baki slash command (//auto, //automation) supaya kosong betul-betul kosong.
      desc = desc.replace(/^\s*\/?\/auto(?:mation)?\b\s*/i, "").trim();
      if (!desc) { addBubble("jarvis", "Apakah yang nak diautomasikan? Cth: \"//auto setiap pagi buka berita, ringkas, simpan\"."); return; }
      var A = window.LocalPocketJarvisActions;
      if (!A || typeof A.askGemini !== "function") { addBubble("jarvis", "⚠ askGemini tiada (pastikan JARVIS & Gemini sedia)."); return; }
      planAutomation(desc, A);
    }

    // Panggil Gemini & urus timeout + percubaan semula.
    function planAutomation(desc, A) {
      var token = { alive: true };
      var planningBubble = addBubble("jarvis", "🧠 Meminta Gemini merancang automasi…");
      var watchdog = setTimeout(function () {
        if (!token.alive) return;
        token.alive = false;
        if (planningBubble) setBubbleText(planningBubble, "⏳ Gemini lambat balas (>30s). Mungkin sedang sibuk — boleh cuba lagi.");
        addRetryChip(desc, A);
      }, PLAN_TIMEOUT_MS);
      A.askGemini(plannerPrompt(desc)).then(function (ans) {
        if (!token.alive) return; // sudah tamat masa / dicuba semula
        token.alive = false;
        clearTimeout(watchdog);
        if (!ans) {
          addBubble("jarvis", "⚠ Gemini tak jawab. Pastikan Gemini log masuk dalam AI Sidebar.");
          addRetryChip(desc, A);
          return;
        }
        var macro = extractJson(ans);
        if (!macro) {
          addBubble("jarvis", "⚠ Gemini tak return JSON sah. Jawapan: " + ans.slice(0, 240));
          addRetryChip(desc, A);
          return;
        }
        // Seragamkan bentuk blok (Gemini kadang letak medan dalam "params").
        normalizeMacro(macro);
        // Lengkapkan medan asas.
        if (!macro.blocks) macro.blocks = [];
        if (!macro.name) macro.name = "Makro " + new Date().toLocaleDateString();
        macro.id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        if (!macro.trigger) macro.trigger = { type: "manual" };

        // Sahkan makro sebelum simpan (pakai pengesah rantai makro sedia ada).
        var validation = null;
        var Val = window.LocalPocketMacroValidator;
        if (Val && typeof Val.validate === "function") {
          validation = Val.validate(macro, {});
        }
        if (validation && !validation.ok) {
          addBubble("jarvis", "⚠ Makro dari Gemini tak sah — tak disimpan.\n• " +
            validation.errors.slice(0, 6).join("\n• "));
          addRetryChip(desc, A);
          return;
        }
        var warnMsg = "";
        if (validation && validation.warnings && validation.warnings.length) {
          warnMsg = "\n⚠ Amaran: " + validation.warnings.slice(0, 4).join("; ");
        }

        // Sah & auto-simpan (pengguna tak perlu tekan Simpan; boleh Buang
        // kemudian). Pratonton langkah dipapar dalam bubble kejayaan.
        commitAutomation(macro, warnMsg);
      }).catch(function (err) {
        if (!token.alive) return;
        token.alive = false;
        clearTimeout(watchdog);
        addBubble("jarvis", "⚠ Rancangan gagal: " + (err && err.message ? err.message : err));
        addRetryChip(desc, A);
      });
    }

    // Cip "Cuba lagi" — rancang semula dengan description sama.
    function addRetryChip(desc, A) {
      var b = addBubble("jarvis", "🔁 Nak cuba rancang semula?");
      if (!b) { planAutomation(desc, A); return; }
      try {
        var row = el("div", { className: "lp-jarvis-followups" });
        var retry = el("button", {
          className: "lp-jarvis-chip lp-jarvis-chip-action", type: "button", text: "🔁 Cuba lagi"
        });
        retry.addEventListener("click", function (e) {
          e.stopPropagation();
          if (row.parentNode) row.parentNode.removeChild(row);
          planAutomation(desc, A);
        });
        row.appendChild(retry);
        b.appendChild(row);
      } catch (e2) {
        planAutomation(desc, A);
      }
    }

    // Papar senarai langkah (digunakan dalam bubble kejayaan).
    function previewSteps(macro) {
      var Val = window.LocalPocketMacroValidator;
      var steps = (Val && Val.classifySteps) ? Val.classifySteps(macro) : [];
      return steps.map(function (s, i) { return (i + 1) + ". " + s.label; }).join("\n");
    }

    // Adakah input ini arahan edit untuk makro terakhir? (elak sapa chat biasa).
    function isAutoEditCommand(text) {
      return /^(?:namakan|nama|rename|tukar\s+nama|jadual|schedule|setiap\s+hari|setkan\s+masa|set\s+time|setiap|interval|ulang)\b/i.test(String(text || "").trim());
    }

    // Edit makro yang BARU disimpan terus dari chat (namakan / jadual).
    function handleAutoEdit(text) {
      var macro = lastAutoMacro;
      if (!macro) return;
      var renamed = false, rescheduled = false;

      var rn = text.match(/^(?:namakan|nama|rename|tukar\s+nama)\s*[:=]?\s*(.+)$/i);
      if (rn && rn[1].trim()) {
        macro.name = rn[1].trim();
        renamed = true;
      }
      var sc = text.match(/^(?:jadual|schedule|setiap\s+hari|setkan\s+masa|set\s+time)\s*[:=]?\s*(.+)$/i);
      if (sc) {
        var hhmm = parseTimeToHHMM(sc[1]);
        if (!hhmm) {
          addBubble("jarvis", "⚠ Format masa tak faham. Cth: 'jadual 9 pagi', 'jadual 21:00', 'setiap hari 8 malam'.");
          return;
        }
        macro.trigger = { type: "time", kind: "daily", time: hhmm, days: [0, 1, 2, 3, 4, 5, 6] };
        rescheduled = true;
      }
      var iv = text.match(/^(?:setiap|interval|ulang)\s*(\d+)\s*(minit|minute|jam|hour|hr|j)\b/i);
      if (iv) {
        var num = parseInt(iv[1], 10) || 1;
        var unit = (iv[2] || "").toLowerCase();
        var minutes = (unit.indexOf("jam") !== -1 || unit.indexOf("hour") !== -1 || unit === "j") ? num * 60 : num;
        macro.trigger = { type: "time", kind: "interval", minutes: Math.max(1, minutes) };
        rescheduled = true;
      }

      if (!renamed && !rescheduled) {
        addBubble("jarvis", "📝 Tak faham. Taip 'namakan X' untuk tukar nama, atau 'jadual 9 pagi' untuk jadual.");
        return;
      }
      // Simpan perubahan ke store & jadual semula.
      var Sched = window.LocalPocketMacroScheduler;
      Sched.storeGet(function (arr) {
        arr = arr || [];
        for (var i = 0; i < arr.length; i++) {
          if (arr[i].id === macro.id) { arr[i] = macro; break; }
        }
        Sched.storeSet(arr, function () {
          if (rescheduled && Sched.scheduleMacro) Sched.scheduleMacro(macro);
          addBubble("jarvis", "✅ Dikemas kini: \"" + macro.name + "\" — pemicu: " +
            (macro.trigger.type || "manual") + describeNextRun(macro));
        });
      });
    }

    // Tukar teks masa bahasa Melayu/Inggeris ke "HH:MM".
    function parseTimeToHHMM(t) {
      t = String(t || "").trim().toLowerCase();
      var hm = t.match(/(\d{1,2}):(\d{2})/);
      if (hm) {
        var h0 = Math.max(0, Math.min(23, parseInt(hm[1], 10) || 0));
        var m0 = Math.max(0, Math.min(59, parseInt(hm[2], 10) || 0));
        return pad2(h0) + ":" + pad2(m0);
      }
      var m = t.match(/(\d{1,2})(?:\s*(?:[.,])?\s*(\d{1,2}))?\s*(pagi|subuh|tengah\s*ari|petang|malam|am|pm)?/);
      if (!m) return null;
      var h = parseInt(m[1], 10) || 0;
      var min = m[2] ? parseInt(m[2], 10) : 0;
      var mer = m[3] || "";
      if (mer.indexOf("petang") !== -1 || mer === "pm") { if (h < 12) h += 12; }
      else if (mer.indexOf("malam") !== -1) { if (h < 12) h += 12; }
      else if (mer.indexOf("tengah") !== -1) { h = 12; }
      else if (mer === "am" && h === 12) { h = 0; }
      h = Math.max(0, Math.min(23, h));
      min = Math.max(0, Math.min(59, min));
      return pad2(h) + ":" + pad2(min);
    }
    function pad2(n) { return (n < 10 ? "0" : "") + n; }

    // Terangkan masa larian seterusnya untuk trigger masa (pengesahan jadual).
    function describeNextRun(macro) {
      var tr = macro.trigger || {};
      if (tr.type !== "time") return "";
      if (tr.kind === "interval" && tr.minutes) return " (seterusnya: setiap " + tr.minutes + " minit)";
      var parts = (tr.time || "08:00").split(":");
      var h = parseInt(parts[0], 10) || 0, mi = parseInt(parts[1], 10) || 0;
      if (h < 0 || h > 23 || mi < 0 || mi > 59) { h = 8; mi = 0; }
      var days = tr.days && tr.days.length ? tr.days : [0, 1, 2, 3, 4, 5, 6];
      var now = new Date(), next = null;
      for (var d = 0; d < 14; d++) {
        var cand = new Date(now.getTime() + d * 86400000);
        cand.setHours(h, mi, 0, 0);
        if (cand.getTime() <= now.getTime()) continue;
        if (days.indexOf(cand.getDay()) === -1) continue;
        next = cand; break;
      }
      if (!next) return " (dijadual)";
      return " (seterusnya: " + next.toLocaleString() + ")";
    }

    // (Edit makro //auto kini dikendali oleh handleAutoEdit — terus pada
    //  makro yang baru disimpan, tanpa langkah "Simpan" berasingan.)

    // Simpan makro ke scheduler & papar kejayaan dengan cip jalankan.
    function commitAutomation(macro, warnMsg) {
      var Sched = window.LocalPocketMacroScheduler;
      Sched.storeGet(function (arr) {
        arr = arr || [];
        // #5 — kesan nama pendua; auto-namakan semula bagi elak pertembungan.
        var dupNote = "";
        var clash = arr.some(function (m) {
          return m.name && m.name.toLowerCase() === (macro.name || "").toLowerCase();
        });
        if (clash) {
          var base = macro.name, i = 2;
          while (arr.some(function (m) {
            return m.name && m.name.toLowerCase() === (base + " (" + i + ")").toLowerCase();
          })) i++;
          macro.name = base + " (" + i + ")";
          dupNote = "\n⚠ Nama pendua — ditukar ke \"" + macro.name + "\".";
        }
        arr.push(macro);
        Sched.storeSet(arr, function () {
          if (Sched.scheduleMacro && macro.trigger.type === "time") Sched.scheduleMacro(macro);
          var savedName = macro.name;
          // Ingat makro terakhir untuk edit terus dari chat (namakan/jadual).
          lastAutoMacro = macro;
          // #4 — sahkan jadual dengan tunjuk masa larian seterusnya.
          var runInfo = describeNextRun(macro);
          var steps = previewSteps(macro);
          var b = addBubble("jarvis", "✅ Automasi \"" + savedName + "\" dicipta — " + macro.blocks.length +
            " blok, pemicu: " + (macro.trigger.type || "manual") + "." + dupNote + runInfo + warnMsg +
            (steps ? "\n" + steps : "") +
            "\nTaip \"jalankan automasi " + savedName + "\" untuk jalankan, atau 'namakan X' / 'jadual 9 pagi' untuk ubah.");
          // Cip: Buang (undo) + Jalankan sekarang. Risiko tinggi
          // (close_all_tabs) tak ditawarkan butang jalan.
          var risky = (macro.blocks || []).some(function (bl) {
            return bl && bl.type === "action" && bl.action === "close_all_tabs";
          });
          if (b) {
            try {
              var row = el("div", { className: "lp-jarvis-followups" });
              var delBtn = el("button", {
                className: "lp-jarvis-chip lp-jarvis-chip-followup", type: "button", text: "🗑 Buang"
              });
              delBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                if (row.parentNode) row.parentNode.removeChild(row);
                deleteAutomationById(macro.id);
                if (lastAutoMacro === macro) lastAutoMacro = null;
                addBubble("jarvis", "🗑 Automasi \"" + savedName + "\" dibuang.");
              });
              row.appendChild(delBtn);
              if (!risky) {
                var runBtn = el("button", {
                  className: "lp-jarvis-chip lp-jarvis-chip-action", type: "button",
                  text: "▶ Jalankan sekarang"
                });
                runBtn.addEventListener("click", function (e) {
                  e.stopPropagation();
                  runAutomationByName(savedName);
                });
                row.appendChild(runBtn);
              }
              b.appendChild(row);
            } catch (e2) {}
          }
        });
      });
    }

   function findAutomationByName(name, cb) {
     var Sched = window.LocalPocketMacroScheduler;
     Sched.storeGet(function (arr) {
       arr = arr || [];
       var low = String(name || "").toLowerCase();
       var hit = null;
       for (var i = 0; i < arr.length; i++) {
         if (arr[i].name && arr[i].name.toLowerCase().indexOf(low) !== -1) { hit = arr[i]; break; }
       }
       cb(hit, arr);
     });
   }

   function runAutomationByName(name) {
     var Engine = window.LocalPocketMacroEngine;
     if (!Engine) { addBubble("jarvis", "⚠ Enjin makro tiada."); return; }
     findAutomationByName(name, function (macro) {
       if (!macro) { addBubble("jarvis", "⚠ Tiada automasi bernama \"" + name + "\"."); return; }
       addBubble("jarvis", "▶▶ Jalankan automasi \"" + macro.name + "\"…");
       Engine.runMacro(macro, {
         handlers: automationHandlers(),
         getContext: function () { var A = window.LocalPocketJarvisActions; return A && A.getContext ? (A.getContext() || {}) : {}; },
         resolveMacro: function (n) { var r = null; findAutomationByName(n, function (m) { r = m; }); return r; },
         log: function (s) { addBubble("jarvis", s); }
       });
     });
   }

    function deleteAutomationByName(name) {
      var Sched = window.LocalPocketMacroScheduler;
      findAutomationByName(name, function (macro, arr) {
        if (!macro) { addBubble("jarvis", "⚠ Tiada automasi bernama \"" + name + "\"."); return; }
        var rest = arr.filter(function (m) { return m.id !== macro.id; });
        Sched.storeSet(rest, function () {
          if (Sched.unschedule) Sched.unschedule(macro.id);
          addBubble("jarvis", "🗑 Automasi \"" + macro.name + "\" dipadam.");
        });
      });
    }

    // Padam makro ikut id (untuk cip "Buang" selepas //auto).
    function deleteAutomationById(id) {
      var Sched = window.LocalPocketMacroScheduler;
      Sched.storeGet(function (arr) {
        arr = arr || [];
        var rest = arr.filter(function (m) { return m.id !== id; });
        Sched.storeSet(rest, function () {
          if (Sched.unschedule) Sched.unschedule(id);
        });
      });
    }

  // ─────────────────────────────────────────────────────────────────────────


  })();
