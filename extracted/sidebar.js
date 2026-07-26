(function () {
  const SETTINGS_KEY = "settings";
  const PROVIDER_CONFIGS = {
    chatgpt: { url: "https://chatgpt.com/" },
    claude: { url: "https://claude.ai/new" },
    gemini: { url: "https://gemini.google.com/app" },
    perplexity: { url: "https://www.perplexity.ai/" },
    copilot: { url: "https://copilot.microsoft.com/" },
    grok: { url: "https://grok.com/" },
    deepseek: { url: "https://chat.deepseek.com/" },
    poe: { url: "https://poe.com/" },
    mistral: { url: "https://chat.mistral.ai/chat" },
    notebooklm: { url: "https://notebooklm.google.com/" }
  };

  function normalizeProvider(value) {
    const key = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (key === "jarvis") return "jarvis";
    return Object.prototype.hasOwnProperty.call(PROVIDER_CONFIGS, key) ? key : "chatgpt";
  }

  function normalizeOptionalProvider(value) {
    const key = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (key === "jarvis") return "jarvis";
    return key && Object.prototype.hasOwnProperty.call(PROVIDER_CONFIGS, key) ? key : "";
  }

  function buildSidebarUrl(providerKey) {
    const normalizedProvider = normalizeProvider(providerKey);
    // JARVIS isn't a web provider — its URL is the extension's own sidebar page.
    if (normalizedProvider === "jarvis") {
      try {
        const extApi = getExtensionApi();
        if (extApi && extApi.runtime && typeof extApi.runtime.getURL === "function") {
          return extApi.runtime.getURL("jarvisSidebar.html");
        }
      } catch (err) {}
      return "jarvisSidebar.html";
    }
    const config = PROVIDER_CONFIGS[normalizedProvider] || PROVIDER_CONFIGS.chatgpt;
    let reloadParam = "";
    try {
      const params = new URLSearchParams(window.location.search || "");
      reloadParam = params.get("reload") || "";
    } catch (err) {}

    try {
      const url = new URL(config.url);
      url.searchParams.set("lp_sidebar", "1");
      if (reloadParam) {
        url.searchParams.set("lp_reload", reloadParam);
      }
      return url.toString();
    } catch (err) {
      const sep = config.url.includes("?") ? "&" : "?";
      const base = `${config.url}${sep}lp_sidebar=1`;
      return reloadParam ? `${base}&lp_reload=${encodeURIComponent(reloadParam)}` : base;
    }
  }

  function getExtensionApi() {
    if (typeof browser !== "undefined") return browser;
    if (typeof chrome !== "undefined") return chrome;
    return null;
  }

  function storageGetLocal(key) {
    const extensionApi = getExtensionApi();
    if (!extensionApi || !extensionApi.storage || !extensionApi.storage.local || !extensionApi.storage.local.get) {
      return Promise.resolve({});
    }
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        resolve(value && typeof value === "object" ? value : {});
      };
      try {
        const maybePromise = extensionApi.storage.local.get(key, (value) => {
          const err = extensionApi.runtime && extensionApi.runtime.lastError;
          if (err) {
            finish({});
            return;
          }
          finish(value);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(finish).catch(err => {
            console.error("[Sidebar] Storage get error:", err);
            finish({});
          });
        }
      } catch (err) {
        finish({});
      }
    });
  }

  function storageSetLocal(data) {
    const extensionApi = getExtensionApi();
    if (!extensionApi || !extensionApi.storage || !extensionApi.storage.local || !extensionApi.storage.local.set) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      try {
        const maybePromise = extensionApi.storage.local.set(data, () => {
          const err = extensionApi.runtime && extensionApi.runtime.lastError;
          if (err) {
            console.error("Storage set error:", err);
          }
          finish();
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(finish).catch(err => {
            console.error("[Sidebar] Storage set error:", err);
            finish();
          });
        }
      } catch (err) {
        finish();
      }
    });
  }

  function runtimeSendMessage(message, timeoutMs) {
    const extensionApi = getExtensionApi();
    if (!extensionApi || !extensionApi.runtime || !extensionApi.runtime.sendMessage) {
      return Promise.resolve(null);
    }
    // Default timeout so init() can never hang if the background service worker
    // is slow to wake up, or a listener returns `true` (async) but never calls
    // sendResponse — in which case the callback would otherwise never fire.
    const limitMs = typeof timeoutMs === "number" && timeoutMs > 0 ? timeoutMs : 2500;
    return new Promise((resolve) => {
      let done = false;
      let timer = null;
      const finish = (value) => {
        if (done) return;
        done = true;
        if (timer) { clearTimeout(timer); timer = null; }
        resolve(value == null ? null : value);
      };
      timer = setTimeout(() => finish(null), limitMs);
      try {
        const maybePromise = extensionApi.runtime.sendMessage(message, (response) => {
          const err = extensionApi.runtime && extensionApi.runtime.lastError;
          if (err) {
            finish(null);
            return;
          }
          finish(response);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(finish).catch(err => {
            console.error("[Sidebar] Runtime sendMessage error:", err);
            finish(null);
          });
        }
      } catch (err) {
        finish(null);
      }
    });
  }

  async function resolveSidebarTargetUrl() {
    try {
      const data = await storageGetLocal(SETTINGS_KEY);
      const settings = data && typeof data[SETTINGS_KEY] === "object" ? data[SETTINGS_KEY] : null;
      const providerFromSettings = normalizeProvider(settings && settings.sidebarAiProvider);
      const providerState = await runtimeSendMessage({ type: "peek-pending-sidebar-provider" });
      const providerFromOverride =
        providerState && providerState.hasPendingProvider === true
          ? normalizeOptionalProvider(providerState.provider)
          : "";

      const promptState = await runtimeSendMessage({ type: "peek-pending-sidebar-prompt" });
      if (promptState && promptState.hasPendingPrompt === true) {
        const pendingProvider = normalizeProvider(
          promptState.provider || providerFromOverride || providerFromSettings
        );
        return {
          provider: pendingProvider,
          url: buildSidebarUrl(pendingProvider)
        };
      }
      if (providerFromOverride) {
        return {
          provider: providerFromOverride,
          url: buildSidebarUrl(providerFromOverride)
        };
      }
      return {
        provider: providerFromSettings,
        url: buildSidebarUrl(providerFromSettings)
      };
    } catch (err) {
      return {
        provider: "chatgpt",
        url: buildSidebarUrl("chatgpt")
      };
    }
  }

  // Resolve ONLY the provider from a pending sidebar prompt/override.
  // Lebih ringan daripada resolveSidebarTargetUrl — tidak baca settings
  // (pemanggil sudah ada settings) dan hanya return provider string.
  async function resolvePendingSidebarProvider() {
    try {
      const providerState = await runtimeSendMessage({ type: "peek-pending-sidebar-provider" }, 1500);
      const providerFromOverride =
        providerState && providerState.hasPendingProvider === true
          ? normalizeOptionalProvider(providerState.provider)
          : "";

      const promptState = await runtimeSendMessage({ type: "peek-pending-sidebar-prompt" }, 1500);
      if (promptState && promptState.hasPendingPrompt === true) {
        return normalizeProvider(
          promptState.provider || providerFromOverride || ""
        ) || "";
      }
      return providerFromOverride || "";
    } catch (err) {
      return "";
    }
  }

  function normalizeSummaryMode(value) {
    var v = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (v === "auto" || v === "quick" || v === "deep" || v === "action" || v === "study" || v === "research" || v === "custom") return v;
    return "deep";
  }

  // UI Elements
  const topbar = document.getElementById("lp-sidebar-topbar");
  const providerDropdown = document.getElementById("lp-provider-dropdown");
  const aiModeDropdown = document.getElementById("lp-ai-mode-dropdown");
  const summaryModeDropdown = document.getElementById("lp-summary-mode-dropdown");
  const iframe = document.getElementById("lp-sidebar-iframe");
  const jarvisSidebarBtn = document.getElementById("lp-jarvis-sidebar-btn");

  let currentProvider = "chatgpt";
  let currentAiMode = "sidebar";
  let currentSidebarMode = "ai"; // "ai" | "jarvis"

  // Tukar panel sidebar kepada JARVIS. Firefox menyekat iframing halaman
  // extension dalam sidebar, jadi kita ganti panel sidebar secara terus ke
  // jarvisSidebar.html (panel peringkat atas) dan biarkan background muat semula.
  function loadJarvisInIframe() {
    currentSidebarMode = "jarvis";
    // Chrome/Edge (tiada sidebarAction): muat JARVIS dalam iframe (extension
    // page boleh di-iframe di Chrome). Di Firefox, JARVIS dibuka via setPanel
    // (panel penuh), jadi fungsi ini tak pernah dipanggil.
    try {
      const extApi = getExtensionApi();
      if (extApi && extApi.runtime && typeof extApi.runtime.getURL === "function") {
        iframe.src = extApi.runtime.getURL("jarvisSidebar.html");
      }
    } catch (err) {}
  }

  // Load AI provider in iframe
  function loadProviderInIframe(provider) {
    // JARVIS is selected from the provider dropdown — route it to the dedicated
    // JARVIS sidebar (iframe on Chrome; the dropdown handler does the Firefox
    // setPanel switch before calling this).
    if (provider === "jarvis") {
      currentProvider = "jarvis";
      try { providerDropdown.value = "jarvis"; } catch (e) {}
      loadJarvisInIframe();
      return;
    }
    currentSidebarMode = "ai";
    try {
      const params = new URLSearchParams(window.location.search || "");
      const historyChatUrl = params.get("historyChatUrl");
      if (historyChatUrl) {
        const chatUrl = new URL(historyChatUrl);
        chatUrl.searchParams.set("lp_sidebar", "1");
        iframe.src = chatUrl.toString();
        return;
      }
    } catch (err) {}
    const url = buildSidebarUrl(provider);
    iframe.src = url;
    currentProvider = provider;
    providerDropdown.value = provider;
  }

  // Handle provider dropdown change
  function handleProviderChange() {
    const newProvider = providerDropdown.value;
    if (!newProvider || newProvider === currentProvider) return;
    const extApi = getExtensionApi();
    const goingToJarvis = newProvider === "jarvis";

    if (goingToJarvis) {
      currentSidebarMode = "jarvis";
      // On Firefox the JARVIS sidebar is a separate top-level panel (extension
      // pages can't be iframed in the sidebar). We can NOT reuse the
      // close()+open() trick that the JARVIS button uses: Firefox only allows
      // sidebarAction.open() from a genuine user-input handler, and a <select>
      // "change" event does NOT qualify (a <button> click does). Previously
      // this meant close() succeeded but open() silently threw, leaving the
      // panel closed ("panel tertutup tapi JARVIS tak terbuka").
      //
      // Instead, switch the panel in place by navigating THIS document to
      // jarvisSidebar.html — no user gesture is required for that. We still
      // call setPanel() (also gesture-free) so Firefox remembers JARVIS as the
      // panel for the next time the sidebar is toggled open.
      if (extApi && extApi.sidebarAction) {
        try {
          if (extApi.sidebarAction.setPanel) extApi.sidebarAction.setPanel({ panel: extApi.runtime.getURL("jarvisSidebar.html") });
        } catch (e) {}
        // Persist mode BEFORE navigating away so it is saved even though this
        // document is about to be replaced.
        storageGetLocal(SETTINGS_KEY).then(data => {
          const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
          settings.sidebarMode = "jarvis";
          storageSetLocal({ [SETTINGS_KEY]: settings }).catch(function () {});
        });
        try {
          window.location.replace(extApi.runtime.getURL("jarvisSidebar.html"));
        } catch (e) {}
        return;
      }
      // Chrome/Edge (no sidebarAction): load JARVIS inside the iframe.
      loadProviderInIframe("jarvis");
      storageGetLocal(SETTINGS_KEY).then(data => {
        const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
        settings.sidebarMode = "jarvis";
        storageSetLocal({ [SETTINGS_KEY]: settings }).catch(function () {});
      });
      return;
    }

    // Switching between AI providers (AI->AI): just reload the iframe. Do NOT
    // close the sidebar.
    loadProviderInIframe(newProvider);
    // Save to storage
    storageGetLocal(SETTINGS_KEY).then(data => {
      const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
      settings.sidebarAiProvider = newProvider;
      storageSetLocal({ [SETTINGS_KEY]: settings }).catch(err => console.error("[Sidebar] Failed to save settings:", err));
    });
  }

  // Handle AI mode dropdown change
  function handleAiModeChange() {
    const newMode = aiModeDropdown.value;
    if (newMode && newMode !== currentAiMode) {
      currentAiMode = newMode;
      // Save to storage
      storageGetLocal(SETTINGS_KEY).then(data => {
        const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
        settings.aiMode = newMode;
        storageSetLocal({ [SETTINGS_KEY]: settings }).catch(err => console.error("[Sidebar] Failed to save settings:", err));
      });
    }
  }

  // Handle summary mode dropdown change
  function handleSummaryModeChange() {
    const newMode = normalizeSummaryMode(summaryModeDropdown.value);
    if (newMode) {
      storageSetLocal({ summaryModePreference: newMode }).catch(err => console.error("[Sidebar] Failed to save summary mode:", err));
    }
  }

  // ── Custom Prompt Panel ────────────────────────────────────────────────

  const customPromptPanel = document.getElementById("lp-custom-prompt-panel");
  const customPromptTextarea = document.getElementById("lp-custom-prompt-textarea");
  const customPromptSaveBtn = document.getElementById("lp-custom-prompt-save-btn");
  const customPromptNewBtn = document.getElementById("lp-custom-prompt-new-btn");
  const customPromptClearBtn = document.getElementById("lp-custom-prompt-clear-btn");
  const customPromptTemplateList = document.getElementById("lp-custom-prompt-template-list");
  const customPromptToggle = document.getElementById("lp-custom-prompt-toggle");
  const updateTemplateBtn = document.getElementById("lp-update-template-btn");
  const cancelEditBtn = document.getElementById("lp-cancel-edit-btn");
  const editTemplateBanner = document.getElementById("lp-edit-template-banner");
  const editTemplateNameSpan = document.getElementById("lp-edit-template-name");
  const summaryPageBtn = document.getElementById("lp-summary-page-btn");
  const importSummaryBtn = document.getElementById("lp-import-summary-btn");
  const selSearchToggleBtn = document.getElementById("lp-sel-search-toggle");
  const toneToggleBtn = document.getElementById("lp-tone-toggle");

  // Tone options
  const TONE_OPTIONS = [
    { value: "neutral",     label: "Neutral",     icon: "⚖️" },
    { value: "formal",      label: "Formal",      icon: "👔" },
    { value: "casual",      label: "Santai",      icon: "😊" },
    { value: "educational", label: "Pendidikan",  icon: "📚" }
  ];
  let _currentTone = "neutral";

  // ── Edit template state ───────────────────────────────────────────────
  var _editingTemplateIndex = -1;  // -1 = tidak dalam edit mode
  var _preEditPromptText = "";     // simpan nilai textarea sebelum edit

  function enterEditMode(index, tpl) {
    _editingTemplateIndex = index;
    _preEditPromptText = customPromptTextarea ? customPromptTextarea.value : "";
    if (customPromptTextarea) customPromptTextarea.value = tpl.text || "";
    // Tunjuk banner + butang update, sembunyikan save-as
    if (editTemplateBanner) {
      editTemplateBanner.style.display = "flex";
    }
    if (editTemplateNameSpan) editTemplateNameSpan.textContent = tpl.name || ("Templat " + (index + 1));
    if (customPromptSaveBtn) customPromptSaveBtn.style.display = "none";
    if (updateTemplateBtn) updateTemplateBtn.style.display = "";
    // Highlight textarea border supaya nampak jelas dalam edit mode
    if (customPromptTextarea) customPromptTextarea.style.borderColor = "rgba(200,160,40,0.6)";
    if (customPromptTextarea) customPromptTextarea.focus();
  }

  function exitEditMode() {
    _editingTemplateIndex = -1;
    if (editTemplateBanner) editTemplateBanner.style.display = "none";
    if (customPromptSaveBtn) customPromptSaveBtn.style.display = "";
    if (updateTemplateBtn) updateTemplateBtn.style.display = "none";
    if (customPromptTextarea) customPromptTextarea.style.borderColor = "rgba(255,255,255,0.15)";
  }

  // ── Selection Search Toggle ────────────────────────────────────────────
  let _selSearchEnabled = true; // state tempatan, diisi semasa init

  function applySelSearchToggleUI(enabled) {
    if (!selSearchToggleBtn) return;
    selSearchToggleBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
    selSearchToggleBtn.title = enabled ? "Selection Search: ON (klik untuk matikan)" : "Selection Search: OFF (klik untuk hidupkan)";
    selSearchToggleBtn.style.background = enabled ? "rgba(59,130,246,0.18)" : "rgba(0,0,0,0.2)";
    selSearchToggleBtn.style.borderColor = enabled ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.15)";
    selSearchToggleBtn.style.color = enabled ? "#7ab8ff" : "#555";
  }

  async function loadSelSearchState() {
    try {
      const data = await storageGetLocal(SETTINGS_KEY);
      const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
      // Cek KEDUA-DUA flag — sama logik dengan applySelectionSearchSettings dalam iframe
      const popupEnabled = settings.selectionSearchPopup && typeof settings.selectionSearchPopup === "object"
        ? settings.selectionSearchPopup.enabled !== false
        : true;
      _selSearchEnabled = popupEnabled && settings.selectionSearchEnabled !== false;
    } catch (_) {
      _selSearchEnabled = true;
    }
    applySelSearchToggleUI(_selSearchEnabled);
  }

  function handleSelSearchToggle() {
    _selSearchEnabled = !_selSearchEnabled;
    applySelSearchToggleUI(_selSearchEnabled);
    // Simpan ke storage — kemas kini KEDUA-DUA selectionSearchEnabled DAN
    // selectionSearchPopup.enabled supaya applySelectionSearchSettings dalam
    // contentScriptSidebarAi.js tidak reject kerana satu nilai masih false.
    storageGetLocal(SETTINGS_KEY).then(data => {
      const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
      settings.selectionSearchEnabled = _selSearchEnabled;
      if (settings.selectionSearchPopup && typeof settings.selectionSearchPopup === "object") {
        settings.selectionSearchPopup.enabled = _selSearchEnabled;
      } else {
        settings.selectionSearchPopup = { enabled: _selSearchEnabled };
      }
      storageSetLocal({ [SETTINGS_KEY]: settings }).catch(err => console.error("[Sidebar] Failed to save selectionSearchEnabled:", err));
    });
    // Beritahu iframe supaya ia reload settings
    try {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "__lp_selection_search_toggle", enabled: _selSearchEnabled }, "*");
      }
    } catch (_) {}
  }

  // ── Tone Toggle ───────────────────────────────────────────────────────

  function applyToneToggleUI(tone) {
    if (!toneToggleBtn) return;
    const opt = TONE_OPTIONS.find(o => o.value === tone) || TONE_OPTIONS[0];
    toneToggleBtn.textContent = opt.icon;
    toneToggleBtn.title = "Gaya penulisan ringkasan: " + opt.label + " (klik untuk tukar)";
    // Highlight butang bila bukan neutral
    const isActive = tone !== "neutral";
    toneToggleBtn.style.background = isActive ? "rgba(180,120,255,0.18)" : "rgba(0,0,0,0.2)";
    toneToggleBtn.style.borderColor = isActive ? "rgba(180,120,255,0.5)" : "rgba(255,255,255,0.15)";
    toneToggleBtn.style.color = isActive ? "#c99aff" : "#aaa";
  }

  async function loadToneState() {
    try {
      // Baca dari key berasingan dulu
      const prefData = await storageGetLocal("summaryTonePreference");
      if (prefData && prefData.summaryTonePreference) {
        const prefTone = String(prefData.summaryTonePreference).trim().toLowerCase();
        if (["neutral", "formal", "casual", "educational"].includes(prefTone)) {
          _currentTone = prefTone;
          applyToneToggleUI(_currentTone);
          return;
        }
      }
      // Fallback ke settings.summaryTone
      const data = await storageGetLocal(SETTINGS_KEY);
      const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
      const tone = typeof settings.summaryTone === "string" ? settings.summaryTone.trim().toLowerCase() : "neutral";
      _currentTone = ["neutral", "formal", "casual", "educational"].includes(tone) ? tone : "neutral";
    } catch (_) {
      _currentTone = "neutral";
    }
    applyToneToggleUI(_currentTone);
  }

  function handleToneToggle() {
    // Cycle ke tone seterusnya
    const idx = TONE_OPTIONS.findIndex(o => o.value === _currentTone);
    const nextIdx = (idx + 1) % TONE_OPTIONS.length;
    _currentTone = TONE_OPTIONS[nextIdx].value;
    applyToneToggleUI(_currentTone);
    // Simpan ke key berasingan — TIDAK menyentuh settings object utama
    storageSetLocal({ summaryTonePreference: _currentTone }).catch(err => console.error("[Sidebar] Failed to save summaryTonePreference:", err));
  }
  function showCustomPromptPanel(show) {
    if (!customPromptPanel) return;
    customPromptPanel.style.display = show ? "flex" : "none";
    if (customPromptToggle) {
      customPromptToggle.style.background = show ? "rgba(110,180,255,0.2)" : "rgba(0,0,0,0.2)";
      customPromptToggle.style.color = show ? "#8ab8ff" : "#aaa";
    }
  }

  function toggleCustomPromptPanel() {
    const willShow = !customPromptPanel || customPromptPanel.style.display !== "flex";
    if (!willShow && _editingTemplateIndex >= 0) {
      // Keluar edit mode bila panel ditutup
      handleCancelEdit();
    }
    showCustomPromptPanel(willShow);
  }

  async function loadCustomPromptText() {
    try {
      const data = await storageGetLocal(SETTINGS_KEY);
      const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
      if (customPromptTextarea) {
        customPromptTextarea.value = typeof settings.summaryCustomPrompt === "string" ? settings.summaryCustomPrompt : "";
      }
    } catch (err) {
      if (customPromptTextarea) customPromptTextarea.value = "";
    }
  }

  function saveCustomPromptText(text) {
    storageGetLocal(SETTINGS_KEY).then(data => {
      const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
      settings.summaryCustomPrompt = text;
      storageSetLocal({ [SETTINGS_KEY]: settings }).catch(err => console.error("[Sidebar] Failed to save custom prompt:", err));
    }).catch(err => console.error("[Sidebar] Failed to load settings for custom prompt:", err));
  }

  async function getPromptTemplates() {
    try {
      const data = await storageGetLocal("summaryPromptTemplates");
      return Array.isArray(data.summaryPromptTemplates) ? data.summaryPromptTemplates : [];
    } catch (err) {
      return [];
    }
  }

  function savePromptTemplates(templates) {
    storageSetLocal({ summaryPromptTemplates: templates }).catch(err => console.error("[Sidebar] Failed to save prompt templates:", err));
  }

  function renderTemplateList(templates) {
    if (!customPromptTemplateList) return;
    customPromptTemplateList.textContent = "";
    
    if (!templates || templates.length === 0) {
      return;
    }
    
    var header = document.createElement("div");
    header.style.fontSize = "11px";
    header.style.color = tryGetThemeMuted ? tryGetThemeMuted() : "#888";
    header.style.margin = "4px 0 2px";
    header.textContent = "Templat Tersimpan:";
    customPromptTemplateList.appendChild(header);
    
    templates.forEach(function(t, i) {
      var name = t.name || ("Templat " + (i + 1));
      var div = document.createElement("div");
      div.style.display = "flex";
      div.style.alignItems = "center";
      div.style.gap = "4px";
      div.style.padding = "4px 6px";
      div.style.borderRadius = "6px";
      div.style.background = "rgba(255,255,255,0.04)";
      div.style.fontSize = "11px";
      
      var span = document.createElement("span");
      span.style.flex = "1";
      span.style.overflow = "hidden";
      span.style.textOverflow = "ellipsis";
      span.style.whiteSpace = "nowrap";
      span.style.color = "#ccc";
      span.textContent = name;
      div.appendChild(span);
      
      var applyBtn = document.createElement("button");
      applyBtn.dataset.tplApply = i;
      applyBtn.style.padding = "2px 6px";
      applyBtn.style.borderRadius = "4px";
      applyBtn.style.border = "1px solid rgba(110,180,255,0.3)";
      applyBtn.style.background = "rgba(70,140,255,0.1)";
      applyBtn.style.color = "#8ab8ff";
      applyBtn.style.fontSize = "10px";
      applyBtn.style.cursor = "pointer";
      applyBtn.textContent = "Apply";
      applyBtn.addEventListener("click", function(e) { handleApplyTemplate(i); });
      div.appendChild(applyBtn);
      
      var editBtn = document.createElement("button");
      editBtn.dataset.tplEdit = i;
      editBtn.style.padding = "2px 6px";
      editBtn.style.borderRadius = "4px";
      editBtn.style.border = "1px solid rgba(200,180,100,0.3)";
      editBtn.style.background = "rgba(200,180,60,0.1)";
      editBtn.style.color = "#d4c878";
      editBtn.style.fontSize = "10px";
      editBtn.style.cursor = "pointer";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", function(e) { handleEditTemplate(i); });
      div.appendChild(editBtn);
      
      var delBtn = document.createElement("button");
      delBtn.dataset.tplDel = i;
      delBtn.style.padding = "2px 6px";
      delBtn.style.borderRadius = "4px";
      delBtn.style.border = "1px solid rgba(255,100,100,0.3)";
      delBtn.style.background = "rgba(255,60,60,0.1)";
      delBtn.style.color = "#ff9090";
      delBtn.style.fontSize = "10px";
      delBtn.style.cursor = "pointer";
      delBtn.textContent = "Del";
      delBtn.addEventListener("click", function(e) { handleDeleteTemplate(i); });
      div.appendChild(delBtn);
      
      var dupBtn = document.createElement("button");
      dupBtn.dataset.tplDup = i;
      dupBtn.style.padding = "2px 6px";
      dupBtn.style.borderRadius = "4px";
      dupBtn.style.border = "1px solid rgba(150,200,150,0.3)";
      dupBtn.style.background = "rgba(100,200,100,0.1)";
      dupBtn.style.color = "#90d090";
      dupBtn.style.fontSize = "10px";
      dupBtn.style.cursor = "pointer";
      dupBtn.textContent = "Dup";
      dupBtn.addEventListener("click", function(e) { handleDuplicateTemplate(i); });
      div.appendChild(dupBtn);
      
      customPromptTemplateList.appendChild(div);
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Helper to get theme muted color — try from parent scope if available
  function tryGetThemeMuted() {
    try {
      if (typeof theme !== "undefined" && theme && theme.muted) return theme.muted;
    } catch (e) {}
    return "#888";
  }

  var _customPromptDebounceTimer = null;

  function handleCustomPromptInput() {
    if (_customPromptDebounceTimer) clearTimeout(_customPromptDebounceTimer);
    _customPromptDebounceTimer = setTimeout(function() {
      saveCustomPromptText(customPromptTextarea ? customPromptTextarea.value : "");
    }, 1500);
  }

  function handleSaveAsTemplate() {
    var text = customPromptTextarea ? customPromptTextarea.value.trim() : "";
    if (!text) {
      alert("Tulis arahan custom prompt dahulu sebelum simpan sebagai templat.");
      return;
    }
    var name = prompt("Nama untuk templat ini:");
    if (!name || !name.trim()) return;
    var trimmedName = name.trim().slice(0, 50);
    getPromptTemplates().then(function(templates) {
      templates.push({ name: trimmedName, text: text });
      savePromptTemplates(templates);
      renderTemplateList(templates);
    });
  }

  function handleApplyTemplate(index) {
    getPromptTemplates().then(function(templates) {
      var tpl = templates[index];
      if (!tpl) return;
      if (customPromptTextarea) customPromptTextarea.value = tpl.text;
      saveCustomPromptText(tpl.text);
    });
  }

  function handleEditTemplate(index) {
    getPromptTemplates().then(function(templates) {
      var tpl = templates[index];
      if (!tpl) return;
      // Masuk edit mode — load teks ke textarea, tunjuk butang Update
      enterEditMode(index, tpl);
    });
  }

  function handleUpdateTemplate() {
    if (_editingTemplateIndex < 0) return;
    var newText = customPromptTextarea ? customPromptTextarea.value.trim() : "";
    if (!newText) {
      alert("Teks templat tidak boleh kosong.");
      return;
    }
    getPromptTemplates().then(function(templates) {
      var tpl = templates[_editingTemplateIndex];
      if (!tpl) { exitEditMode(); return; }
      // Simpan teks baru ke templat yang sama, nama kekal
      templates[_editingTemplateIndex] = { name: tpl.name, text: newText };
      savePromptTemplates(templates);
      renderTemplateList(templates);
      exitEditMode();
      // Juga update active custom prompt text
      saveCustomPromptText(newText);
    });
  }

  function handleCancelEdit() {
    // Restore textarea ke nilai sebelum edit
    if (customPromptTextarea) customPromptTextarea.value = _preEditPromptText;
    exitEditMode();
  }

  function handleNewPrompt() {
    // Kalau sedang dalam edit mode, keluar dulu tanpa simpan
    if (_editingTemplateIndex >= 0) exitEditMode();
    // Kosongkan textarea untuk buat prompt baru
    if (customPromptTextarea) {
      customPromptTextarea.value = "";
      customPromptTextarea.focus();
    }
    saveCustomPromptText("");
  }

  function handleDeleteTemplate(index) {
    getPromptTemplates().then(function(templates) {
      var tpl = templates[index];
      if (!tpl) return;
      if (!confirm('Padam templat "' + (tpl.name || "?") + '"?')) return;
      templates.splice(index, 1);
      savePromptTemplates(templates);
      renderTemplateList(templates);
    });
  }

  function handleDuplicateTemplate(index) {
    getPromptTemplates().then(function(templates) {
      var tpl = templates[index];
      if (!tpl) return;
      var dupName = (tpl.name || "Templat") + " (Copy)";
      var counter = 1;
      while (templates.some(function(t) { return t.name === dupName; })) {
        counter++;
        dupName = (tpl.name || "Templat") + " (Copy " + counter + ")";
      }
      templates.push({ name: dupName, text: tpl.text });
      savePromptTemplates(templates);
      renderTemplateList(templates);
    });
  }

  function handleClearPrompt() {
    if (customPromptTextarea) customPromptTextarea.value = "";
    saveCustomPromptText("");
  }

  // ── End Custom Prompt ──────────────────────────────────────────────────

  // Disable iframe pointer events when dropdown is open
  function disableIframePointerEvents() {
    iframe.classList.add("pointer-events-none");
  }

  // Enable iframe pointer events when dropdown is closed
  function enableIframePointerEvents() {
    iframe.classList.remove("pointer-events-none");
  }

  function suppressAiFocusOnIframe(durationMs) {
    try {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "suppress-ai-focus", durationMs: durationMs }, "*");
      }
    } catch (err) {}
  }

  // Show/hide topbar based on sidebar AI state
  function updateTopbarVisibility() {
    runtimeSendMessage({ type: "is-sidebar-ai-open" }).then(response => {
      if (response && response.open === true) {
        topbar.classList.remove("hidden");
      } else {
        topbar.classList.add("hidden");
      }
    }).catch(() => {
      topbar.classList.add("hidden");
    });
  }

  // Auto-focus the provider AI iframe (all providers) when the sidebar opens.
  // Focusing the iframe element from the parent grants it OS focus in Firefox
  // (when the sidebar itself holds focus), then we tell the content script
  // inside to move the text caret into the provider input box.
  function focusProviderFrame() {
    try { iframe.focus(); } catch (err) {}
    try {
      if (iframe && iframe.contentWindow) {
        // NOTE: never touch iframe.contentWindow.document here — the provider
        // iframe is cross-origin, so reading .document throws
        // "Permission denied" and would abort this function before the
        // focus-input signal is posted.
        iframe.contentWindow.postMessage({ type: "focus-input", forceFocus: true }, "*");
      }
    } catch (err) {}
    // Also ask the background to push focus via the sidebar focus PORT (the
    // reliable channel the content script already listens on). The port is
    // only connected once the provider iframe has loaded, so retries in
    // autoFocusProviderFrameOnOpen() will land after it is ready.
    try {
      runtimeSendMessage({ type: "sidebar-request-ai-focus" }).catch(function () {});
    } catch (err) {}
    console.log("[LP-FOCUS] focusProviderFrame", {
      sidebarHasFocus: document.hasFocus(),
      iframePresent: !!(iframe && iframe.contentWindow),
      activeElement: document.activeElement ? document.activeElement.tagName + (document.activeElement.id ? "#" + document.activeElement.id : "") : null,
      ts: Date.now()
    });
  }

  // Retry the focus push across the iframe load/render window so the caret
  // lands in the box regardless of when the provider finishes rendering.
  function autoFocusProviderFrameOnOpen() {
    focusProviderFrame();
    [80, 200, 400, 700, 1100, 1600].forEach(function (delay) {
      setTimeout(focusProviderFrame, delay);
    });
  }

  // Initialize
  async function init() {
    var _t0 = Date.now();
    console.log("[LP-SIDEBAR-TIMING] init() START");
    try {
      window.name = "__LP_SIDEBAR__";
      window.focus();
      // Move focus into the provider iframe immediately (the iframe may not
      // be ready yet — autoFocusProviderFrameOnOpen() + the load listener
      // below cover the late-ready case).
      focusProviderFrame();
    } catch (err) {}

    // ── Resolve provider FIRST, then load iframe ONCE ─────────────────────
    // Baca settings dari storage. Pada masa yang sama resolve pending prompt
    // (supaya sidebar tidak reset ke muka depan provider bila ada prompt).
    // Barulah iframe dimuat SEKALI sahaja — tiada reload berganda.
    const data = await storageGetLocal(SETTINGS_KEY);
    console.log("[LP-SIDEBAR-TIMING] storageGetLocal done:", Date.now() - _t0, "ms");
    const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};

    currentProvider = normalizeProvider(settings.sidebarAiProvider);
    currentAiMode = settings.aiMode === "jarvis" ? "jarvis" : (settings.aiMode === "overlay" ? "overlay" : "sidebar");

    providerDropdown.value = currentProvider;
    aiModeDropdown.value = currentAiMode;

    // Cek jika ini buka chat sejarah — jika ya, jangan override.
    let hasHistoryChatUrl = false;
    try {
      const _params = new URLSearchParams(window.location.search || "");
      hasHistoryChatUrl = !!_params.get("historyChatUrl");
    } catch (_) {}

    let resolvedProvider = currentProvider;
    if (!hasHistoryChatUrl) {
      try {
        // Guna settings yang sedia ada dan resolve pending prompt (dengan
        // timeout) — sekiranya gagal, guna currentProvider sebagai fallback.
        const pendingProvider = await resolvePendingSidebarProvider();
        if (pendingProvider) {
          resolvedProvider = pendingProvider;
        }
      } catch (_) {}
    }
    console.log("[LP-SIDEBAR-TIMING] provider resolved:", resolvedProvider, "| elapsed:", Date.now() - _t0, "ms");

    // Fix dropdown and load iframe SEKALI
    if (resolvedProvider !== currentProvider) {
      currentProvider = resolvedProvider;
      providerDropdown.value = currentProvider;
    }
    // Sidebar sentiasa buka ke AI (Gemini) sebagai lalai. JARVIS hanya dipaparkan
    // bila dibuka secara eksplisit melalui param ?jarvis=1 (dari pintasan
    // Alt+Shift+J / open-jarvis-sidebar), dan ia dimuat di dalam iframe —
    // bukan sebagai panel berasingan. Ini elak panel "tersangkut" kosong/jarvis
    // dan memastikan bukaan biasa sentiasa tunjuk AI.
    const sidebarParams = new URLSearchParams(window.location.search || "");
    if (sidebarParams.get("jarvis") === "1") {
      loadJarvisInIframe();
    } else {
      loadProviderInIframe(currentProvider);
    }
    console.log("[LP-SIDEBAR-TIMING] iframe src set to:", iframe.src, "| elapsed:", Date.now() - _t0, "ms");

    // ── Bacaan UI bukan-kritikal (selepas iframe mula dimuat) ─────────────
    // Load summary mode preference
    try {
      const modeData = await storageGetLocal("summaryModePreference");
      const savedMode = modeData && modeData.summaryModePreference ? modeData.summaryModePreference : "deep";
      summaryModeDropdown.value = normalizeSummaryMode(savedMode);
    } catch (err) {
      summaryModeDropdown.value = "deep";
    }

    // Load custom prompt text and templates
    await loadCustomPromptText();
    var templates = await getPromptTemplates();
    renderTemplateList(templates);

    // Load selection search toggle state
    await loadSelSearchState();

    // Load tone state
    await loadToneState();

    // Re-push focus into the provider input once the iframe actually loads.
    // The early focus in init() is often missed because the iframe isn't
    // ready yet, so without this the caret never lands in the box on sidebar
    // open. Firing on load guarantees the open trigger focuses the box.
    try {
      iframe.addEventListener("load", function () {
        // Parent typically holds OS focus at this point (sidebar was just
        // opened / a provider was just selected), so focusing the iframe
        // element grants the iframe OS focus — required in Firefox for the
        // text caret to actually appear in the provider input.
        focusProviderFrame();
      });
    } catch (err) {}

    // Also push focus whenever the sidebar window itself gains OS focus
    // (e.g. the moment it opens), and run the staggered retries so the caret
    // lands in the box no matter when the provider finishes rendering.
    try { window.addEventListener("focus", focusProviderFrame); } catch (err) {}
    autoFocusProviderFrameOnOpen();

    // Add event listeners
    providerDropdown.addEventListener("change", handleProviderChange);
    aiModeDropdown.addEventListener("change", handleAiModeChange);
    if (jarvisSidebarBtn) jarvisSidebarBtn.addEventListener("click", function () {
      // Toggle: JARVIS <-> AI. Klik pertama buka JARVIS, klik lagi kembali ke
      // AI (Gemini). Elak panel "tersangkut" kosong.
      try {
        const extApi = getExtensionApi();
        const goingToJarvis = currentSidebarMode !== "jarvis";
        if (goingToJarvis) {
          // Tukar panel sidebar kepada JARVIS. Lakukan terus dari halaman
          // extension ini (ada akses sidebarAction) secara segerak dalam klik
          // supaya gestur pengguna kekal — tutup + buka semula memaksa panel
          // baharu dimuat (Firefox). Di Chrome, loadJarvisInIframe muat
          // jarvisSidebar.html ke dalam iframe.
          const target = "jarvisSidebar.html";
          if (extApi && extApi.sidebarAction) {
            try { if (extApi.sidebarAction.setPanel) extApi.sidebarAction.setPanel({ panel: extApi.runtime.getURL(target) }); } catch (e) {}
            try { if (extApi.sidebarAction.close) extApi.sidebarAction.close(); } catch (e) {}
            try { if (extApi.sidebarAction.open) extApi.sidebarAction.open(); } catch (e) {}
          }
          loadJarvisInIframe();
          storageGetLocal(SETTINGS_KEY).then(data => {
            const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
            settings.sidebarMode = "jarvis";
            storageSetLocal({ [SETTINGS_KEY]: settings }).catch(function () {});
          });
        } else {
          // Kembali ke AI (Gemini). Pada Firefox tukar panel; pada Chrome muat
          // provider terus ke iframe.
          if (extApi && extApi.sidebarAction) {
            try { if (extApi.sidebarAction.setPanel) extApi.sidebarAction.setPanel({ panel: extApi.runtime.getURL("sidebar.html") }); } catch (e) {}
            try { if (extApi.sidebarAction.close) extApi.sidebarAction.close(); } catch (e) {}
            try { if (extApi.sidebarAction.open) extApi.sidebarAction.open(); } catch (e) {}
          }
          loadProviderInIframe(currentProvider);
          storageGetLocal(SETTINGS_KEY).then(data => {
            const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
            settings.sidebarMode = "ai";
            storageSetLocal({ [SETTINGS_KEY]: settings }).catch(function () {});
          });
        }
      } catch (err) {}
    });
    summaryModeDropdown.addEventListener("change", handleSummaryModeChange);
    if (customPromptToggle) customPromptToggle.addEventListener("click", toggleCustomPromptPanel);
    if (selSearchToggleBtn) selSearchToggleBtn.addEventListener("click", handleSelSearchToggle);
    if (toneToggleBtn) toneToggleBtn.addEventListener("click", handleToneToggle);
    if (summaryPageBtn) summaryPageBtn.addEventListener("click", function() {
      runtimeSendMessage({ type: "trigger-summary-from-sidebar" }).catch(function(err) {
        console.error("[Sidebar] Failed to trigger summary:", err);
      });
    });
    if (importSummaryBtn) importSummaryBtn.addEventListener("click", function() {
      // Tunjuk feedback visual segera
      importSummaryBtn.style.opacity = "0.6";
      importSummaryBtn.disabled = true;

      // Minta teks AI dari iframe via postMessage — lebih dipercayai
      // berbanding background → tab kerana sidebar.html adalah extension page
      var _pendingImport = false;
      var _importTimeout = null;

      function _finishImport(ok) {
        if (_pendingImport) return;
        _pendingImport = true;
        if (_importTimeout) { clearTimeout(_importTimeout); _importTimeout = null; }
        window.removeEventListener("message", _onIframeMsg);
        importSummaryBtn.style.opacity = "1";
        importSummaryBtn.disabled = false;
        if (ok) {
          importSummaryBtn.textContent = "✓";
          importSummaryBtn.style.color = "#7fcfa0";
          importSummaryBtn.style.borderColor = "rgba(100,200,150,0.5)";
        } else {
          importSummaryBtn.textContent = "✕";
          importSummaryBtn.style.color = "#ff9090";
          importSummaryBtn.style.borderColor = "rgba(255,100,100,0.4)";
        }
        setTimeout(function() {
          importSummaryBtn.textContent = "📋";
          importSummaryBtn.style.color = "#b39dff";
          importSummaryBtn.style.borderColor = "rgba(150,120,255,0.4)";
        }, 2000);
      }

      function _onIframeMsg(event) {
        if (!event || !event.data) return;
        if (event.data.type !== "__lp_ai_summary_text_reply") return;
        const text = typeof event.data.text === "string" ? event.data.text.trim() : "";
        if (!text) { _finishImport(false); return; }
        // Hantar ke background dengan teks yang sudah diambil
        runtimeSendMessage({
          type: "import-summary-to-note",
          summaryText: text,
          summaryTitle: typeof event.data.title === "string" ? event.data.title : ""
        }).then(function(res) {
          _finishImport(!!(res && res.ok));
        }).catch(function() {
          _finishImport(false);
        });
      }

      window.addEventListener("message", _onIframeMsg);

      // Timeout jika iframe tidak balas dalam 3 saat
      _importTimeout = setTimeout(function() {
        _finishImport(false);
      }, 3000);

      // Hantar permintaan ke iframe AI untuk extract teks ringkasan
      try {
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: "__lp_extract_ai_summary" }, "*");
        } else {
          _finishImport(false);
        }
      } catch (e) {
        _finishImport(false);
      }
    });
    if (customPromptTextarea) customPromptTextarea.addEventListener("input", handleCustomPromptInput);
    if (customPromptTextarea) {
      // Suppress AI iframe auto-focus while user is typing in the custom prompt textarea
      customPromptTextarea.addEventListener("focus", function() {
        try {
          var iframeEl = document.getElementById("lp-sidebar-ai-frame") || document.querySelector("iframe[src*='sidebar']");
          if (iframeEl && iframeEl.contentWindow) {
            iframeEl.contentWindow.postMessage({ type: "suppress-ai-focus", durationMs: 60000 }, "*");
          }
        } catch (err) {}
      });
      customPromptTextarea.addEventListener("blur", function() {
        try {
          var iframeEl = document.getElementById("lp-sidebar-ai-frame") || document.querySelector("iframe[src*='sidebar']");
          if (iframeEl && iframeEl.contentWindow) {
            iframeEl.contentWindow.postMessage({ type: "suppress-ai-focus", durationMs: 0 }, "*");
          }
        } catch (err) {}
      });
    }
    if (customPromptSaveBtn) customPromptSaveBtn.addEventListener("click", handleSaveAsTemplate);
    if (customPromptNewBtn) customPromptNewBtn.addEventListener("click", handleNewPrompt);
    if (customPromptClearBtn) customPromptClearBtn.addEventListener("click", handleClearPrompt);
    if (updateTemplateBtn) updateTemplateBtn.addEventListener("click", handleUpdateTemplate);
    if (cancelEditBtn) cancelEditBtn.addEventListener("click", handleCancelEdit);
    
    // Track genuine user interaction. On sidebar open, window.focus() can land
    // on the first focusable element (a topbar <select>), whose focus listener
    // would otherwise lock the iframe (pointer-events:none + 60s focus suppress)
    // and trap focus "at the header". Only lock the iframe when the user
    // actually interacts with the dropdown, not on the initial programmatic focus.
    let _sidebarInteracted = false;
    document.addEventListener("pointerdown", () => { _sidebarInteracted = true; }, true);
    document.addEventListener("keydown", () => { _sidebarInteracted = true; }, true);

    providerDropdown.addEventListener("focus", function() {
      if (!_sidebarInteracted) return;
      disableIframePointerEvents(); suppressAiFocusOnIframe(60000);
    });
    aiModeDropdown.addEventListener("focus", function() {
      if (!_sidebarInteracted) return;
      disableIframePointerEvents(); suppressAiFocusOnIframe(60000);
    });
    summaryModeDropdown.addEventListener("focus", function() {
      if (!_sidebarInteracted) return;
      disableIframePointerEvents(); suppressAiFocusOnIframe(60000);
    });
    
    // Enable iframe pointer events when dropdown is blurred and restore AI auto-focus
    providerDropdown.addEventListener("blur", function() { enableIframePointerEvents(); suppressAiFocusOnIframe(0); });
    aiModeDropdown.addEventListener("blur", function() { enableIframePointerEvents(); suppressAiFocusOnIframe(0); });
    summaryModeDropdown.addEventListener("blur", function() { enableIframePointerEvents(); suppressAiFocusOnIframe(0); });
    
    // Enable iframe pointer events after selection and restore AI auto-focus
    providerDropdown.addEventListener("change", function() { enableIframePointerEvents(); suppressAiFocusOnIframe(0); });
    aiModeDropdown.addEventListener("change", function() { enableIframePointerEvents(); suppressAiFocusOnIframe(0); });
    summaryModeDropdown.addEventListener("change", function() { enableIframePointerEvents(); suppressAiFocusOnIframe(0); });

    // Show topbar
    topbar.classList.remove("hidden");

    // Handle F6 keydown to prevent focus going to dropdown buttons
    document.addEventListener("keydown", (event) => {
      if (event.key === "F6" && event.isTrusted) {
        event.preventDefault();
        event.stopPropagation();
        // Focus iframe first, then send message to focus input
        iframe.focus();
        try {
          iframe.contentWindow.postMessage({ type: "focus-input", forceFocus: true }, "*");
        } catch (err) {}
      }
    }, true);

    // Listen for sidebar state changes
    runtimeSendMessage({ type: "sidebar-ai-loaded", provider: currentProvider }).catch(err => console.error("[Sidebar] Failed to send loaded message:", err));

    // Relay postMessage dari iframe AI ke background — untuk butang "Ai" teks pilihan
    window.addEventListener("message", function(event) {
      if (!event || !event.data) return;
      if (event.data.type === "__lp_ai_sel_send") {
        const text = typeof event.data.text === "string" ? event.data.text.trim() : "";
        if (!text) return;
        runtimeSendMessage({ type: "open-ai-sidebar-with-prompt", prompt: text }).catch(() => {});
      }
      if (event.data.type === "__lp_ai_note_insert") {
        const text = typeof event.data.text === "string" ? event.data.text.trim() : "";
        if (!text) return;
        runtimeSendMessage({ type: "lp-insert-ai-text-final", text: text, mode: "append" }).catch(() => {});
      }
    });

    // Relay runtime messages from background to the AI iframe via postMessage
    // Ini penting kerana background tidak boleh sendMessageToTab ke cross-origin iframe secara langsung
    const extensionApi = getExtensionApi();
    if (extensionApi && extensionApi.runtime && extensionApi.runtime.onMessage) {
      extensionApi.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (!message || typeof message !== "object") return;

        if (message.type === "check-pending-prompt") {
          // Relay ke iframe — postMessage ke AI content script dalam iframe
          try {
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({ type: "__lp_check_pending_prompt" }, "*");
            }
          } catch (err) {}
          // JANGAN respond dengan applied:false — biarkan background retry
          // sehingga content script dalam iframe yang respond dengan applied:true
          // Hanya respond supaya tak ada "no response" error
          setTimeout(function() {
            try { if (sendResponse) sendResponse({ ok: true, relayed: true }); } catch(e) {}
          }, 600);
          return true;
        }

        if (message.type === "focus-sidebar-ai-input" || message.type === "focus-sidebar-iframe") {
          try {
            // Parent iframe.focus() carries the open gesture's user activation,
            // so Firefox grants the cross-origin iframe OS focus — required for
            // the text caret to appear on sidebar open (the storage-signal path
            // alone lacks activation and the caret stays hidden).
            iframe.focus();
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({ type: "focus-input", forceFocus: true }, "*");
            }
          } catch (err) {}
          if (sendResponse) sendResponse({ ok: true });
          return true;
        }
      });
    }
  }

  // Start
  init();
})();
