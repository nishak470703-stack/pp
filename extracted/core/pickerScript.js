function buildPickerScript(payload) {
  const safePayload = JSON.stringify(payload || {});
  return `(function () {
    "use strict";
    var lpApi = typeof browser !== "undefined" ? browser : chrome;
    var payload = ${safePayload};
    var pickerStartMode = (payload.pickerStartMode || "home").toLowerCase();
    var pickerHighlightColor = (typeof payload.pickerHighlightColor === "string" && /^#[0-9a-f]{6}$/i.test(payload.pickerHighlightColor))
      ? payload.pickerHighlightColor.toLowerCase()
      : "#48d597";
    function hexToPickerRgba(hex, alpha) {
      var r = parseInt(hex.slice(1, 3), 16);
      var g = parseInt(hex.slice(3, 5), 16);
      var b = parseInt(hex.slice(5, 7), 16);
      return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
    }
    var themePresets = {
      classic: {
        panel: "rgba(18, 18, 18, 0.88)",
        panelAlt: "rgba(24, 26, 31, 0.9)",
        text: "#f3f4f6",
        muted: "#a3acb9",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        inputBg: "rgba(255, 255, 255, 0.06)",
        inputBorder: "1px solid rgba(255, 255, 255, 0.12)",
        chipBg: "rgba(255, 255, 255, 0.06)",
        chipBorder: "1px solid rgba(255, 255, 255, 0.12)",
        accent: "#5ac8ff"
      },
      ocean: {
        panel: "rgba(29, 40, 54, 0.92)",
        panelAlt: "rgba(25, 34, 47, 0.92)",
        text: "#eaf4ff",
        muted: "#a6bfd9",
        border: "1px solid rgba(111, 168, 255, 0.22)",
        inputBg: "rgba(255, 255, 255, 0.07)",
        inputBorder: "1px solid rgba(111, 168, 255, 0.26)",
        chipBg: "rgba(111, 168, 255, 0.12)",
        chipBorder: "1px solid rgba(111, 168, 255, 0.2)",
        accent: "#6fa8ff"
      },
      sunset: {
        panel: "rgba(41, 31, 30, 0.92)",
        panelAlt: "rgba(48, 36, 35, 0.92)",
        text: "#fff1ea",
        muted: "#d6ada0",
        border: "1px solid rgba(240, 154, 72, 0.26)",
        inputBg: "rgba(255, 255, 255, 0.08)",
        inputBorder: "1px solid rgba(240, 154, 72, 0.3)",
        chipBg: "rgba(240, 154, 72, 0.12)",
        chipBorder: "1px solid rgba(240, 154, 72, 0.2)",
        accent: "#f09a48"
      },
      modern: {
        panel: "rgba(16, 18, 23, 0.92)",
        panelAlt: "rgba(20, 24, 32, 0.94)",
        text: "#e7edf5",
        muted: "#9aa7b8",
        border: "1px solid rgba(90, 200, 255, 0.22)",
        inputBg: "rgba(255, 255, 255, 0.05)",
        inputBorder: "1px solid rgba(90, 200, 255, 0.26)",
        chipBg: "rgba(90, 200, 255, 0.12)",
        chipBorder: "1px solid rgba(90, 200, 255, 0.2)",
        accent: "#5ac8ff"
      },
      minimal: {
        panel: "rgba(255, 255, 255, 0.96)",
        panelAlt: "rgba(255, 255, 255, 0.98)",
        text: "#1f2430",
        muted: "#5b6270",
        border: "1px solid rgba(59, 77, 102, 0.18)",
        inputBg: "rgba(0, 0, 0, 0.03)",
        inputBorder: "1px solid rgba(59, 77, 102, 0.2)",
        chipBg: "rgba(59, 77, 102, 0.1)",
        chipBorder: "1px solid rgba(59, 77, 102, 0.22)",
        accent: "#3b82f6"
      },
      cyber: {
        panel: "rgba(12, 15, 28, 0.94)",
        panelAlt: "rgba(8, 11, 22, 0.94)",
        text: "#e4edff",
        muted: "#9cb6ff",
        border: "1px solid rgba(34, 211, 238, 0.28)",
        inputBg: "rgba(255, 255, 255, 0.06)",
        inputBorder: "1px solid rgba(124, 58, 237, 0.35)",
        chipBg: "rgba(34, 211, 238, 0.15)",
        chipBorder: "1px solid rgba(34, 211, 238, 0.26)",
        accent: "#22d3ee"
      },
      forest: {
        panel: "rgba(16, 26, 20, 0.94)",
        panelAlt: "rgba(12, 20, 15, 0.94)",
        text: "#e8f5e9",
        muted: "#9fc3a9",
        border: "1px solid rgba(74, 222, 128, 0.35)",
        inputBg: "rgba(255, 255, 255, 0.04)",
        inputBorder: "1px solid rgba(74, 222, 128, 0.32)",
        chipBg: "rgba(74, 222, 128, 0.14)",
        chipBorder: "1px solid rgba(74, 222, 128, 0.26)",
        accent: "#4ade80"
      },
      pastel: {
        panel: "rgba(255, 249, 241, 0.96)",
        panelAlt: "rgba(255, 255, 255, 0.98)",
        text: "#1f2a3d",
        muted: "#6c7a8a",
        border: "1px solid rgba(245, 158, 11, 0.28)",
        inputBg: "rgba(255, 255, 255, 0.9)",
        inputBorder: "1px solid rgba(245, 158, 11, 0.32)",
        chipBg: "rgba(245, 158, 11, 0.12)",
        chipBorder: "1px solid rgba(245, 158, 11, 0.2)",
        accent: "#f59e0b"
      },
      mono: {
        panel: "rgba(22, 22, 24, 0.94)",
        panelAlt: "rgba(18, 18, 20, 0.94)",
        text: "#f5f5f5",
        muted: "#9ea0a6",
        border: "1px solid rgba(255, 255, 255, 0.16)",
        inputBg: "rgba(255, 255, 255, 0.05)",
        inputBorder: "1px solid rgba(255, 255, 255, 0.14)",
        chipBg: "rgba(255, 255, 255, 0.08)",
        chipBorder: "1px solid rgba(255, 255, 255, 0.18)",
        accent: "#c0c4cc"
      },
      oled: {
        panel: "rgba(6, 6, 6, 0.96)",
        panelAlt: "rgba(10, 10, 10, 0.96)",
        text: "#f8fafc",
        muted: "#a8b1c1",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        inputBg: "rgba(255, 255, 255, 0.03)",
        inputBorder: "1px solid rgba(102, 227, 255, 0.2)",
        chipBg: "rgba(102, 227, 255, 0.12)",
        chipBorder: "1px solid rgba(102, 227, 255, 0.18)",
        accent: "#66e3ff"
      },
      sepia: {
        panel: "rgba(255, 247, 233, 0.96)",
        panelAlt: "rgba(255, 250, 241, 0.98)",
        text: "#302117",
        muted: "#7b5e47",
        border: "1px solid rgba(138, 93, 43, 0.2)",
        inputBg: "rgba(138, 93, 43, 0.04)",
        inputBorder: "1px solid rgba(138, 93, 43, 0.2)",
        chipBg: "rgba(138, 93, 43, 0.1)",
        chipBorder: "1px solid rgba(138, 93, 43, 0.16)",
        accent: "#8a5d2b"
      },
      retro: {
        panel: "rgba(37, 29, 20, 0.95)",
        panelAlt: "rgba(42, 33, 23, 0.96)",
        text: "#f4ead6",
        muted: "#c1a46b",
        border: "1px solid rgba(246, 196, 83, 0.22)",
        inputBg: "rgba(255, 255, 255, 0.04)",
        inputBorder: "1px solid rgba(246, 196, 83, 0.24)",
        chipBg: "rgba(246, 196, 83, 0.12)",
        chipBorder: "1px solid rgba(246, 196, 83, 0.18)",
        accent: "#f6c453"
      },
      aurora: {
        panel: "rgba(17, 24, 40, 0.94)",
        panelAlt: "rgba(12, 18, 32, 0.94)",
        text: "#e8f0fe",
        muted: "#8fa8c8",
        border: "1px solid rgba(45, 212, 191, 0.22)",
        inputBg: "rgba(255, 255, 255, 0.04)",
        inputBorder: "1px solid rgba(45, 212, 191, 0.26)",
        chipBg: "rgba(45, 212, 191, 0.12)",
        chipBorder: "1px solid rgba(45, 212, 191, 0.22)",
        accent: "#2dd4bf"
      }
    };
    var themeKey = payload.themePreset && typeof payload.themePreset === "string"
      ? payload.themePreset.toLowerCase()
      : "classic";
    var theme;
    if (themeKey === "custom" && payload.customThemeColors && typeof payload.customThemeColors === "object") {
      var cc = payload.customThemeColors;
      function hexOrFallback(hex, fallback) {
        return typeof hex === "string" && /^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
      }
      theme = {
        panel: hexToPickerRgba(hexOrFallback(cc.panel, "#0f3460"), 0.9),
        panelAlt: hexToPickerRgba(hexOrFallback(cc.panelAlt, "#1a1a4e"), 0.92),
        text: hexOrFallback(cc.ink, "#e0e0e0"),
        muted: hexOrFallback(cc.muted, "#a0a0b0"),
        border: "1px solid " + hexOrFallback(cc.border, "#2a2a4e"),
        inputBg: hexToPickerRgba(hexOrFallback(cc.bg, "#1a1a2e"), 0.5),
        inputBorder: "1px solid " + hexOrFallback(cc.border, "#2a2a4e"),
        chipBg: hexToPickerRgba(hexOrFallback(cc.accent, "#e94560"), 0.15),
        chipBorder: "1px solid " + hexOrFallback(cc.accent, "#e94560"),
        accent: hexOrFallback(cc.accent, "#e94560")
      };
    } else {
      theme = themePresets[themeKey] || themePresets.classic;
    }
    var enableDedupeButton = payload.enableDedupeButton !== false;
    var showHiddenCategories = payload.showHiddenCategories;
    if (showHiddenCategories === true) showHiddenCategories = 1;
    if (showHiddenCategories === false || typeof showHiddenCategories === "undefined") showHiddenCategories = 0;
    var overlayId = "__local_pocket_category_picker";
    var existing = document.getElementById(overlayId);
    if (existing) {
      existing.remove();
    }

    var ITEM_KEY = "items";
    var TRASH_KEY = "trashItems";
    var CATEGORY_KEY = "categories";
    var SETTINGS_KEY = "settings";
    var SELECTED_CATEGORY_KEY = "selectedCategory";
    var CATEGORY_PICKER_LAST_LOCATION_KEY = "categoryPickerLastLocation";
    var items = [];
    var allItemsCache = [];
    var categoryCounts = { all: 0, none: 0, byId: {} };
    var visibleFavoriteCount = 0;
    var currentSavedItemSummary = null;
    var loadedItemsScopeKey = "";
    var itemsLoading = false;
    var itemsLoadRequestId = 0;
    var categories = [];
    var categoryEntries = [];
    var mode = "items";
    var activeCategoryId = payload.selected || "all";
    var pickerStarted = false;
    var pickerPinned = false;
    var filtered = [];
    var visibleEntries = [];
    var activeIndex = 0;
    var itemEntries = [];
    var navigationFavoritesOnly = payload.navigationFavoritesOnly === true;
    var itemFilter = navigationFavoritesOnly ? "fav" : "all";
    var favoriteSortMode = ["manual", "asc", "desc"].includes(String(payload.favoritesSortMode || "").toLowerCase())
      ? String(payload.favoritesSortMode).toLowerCase()
      : "manual";
    var sortDir = navigationFavoritesOnly ? favoriteSortMode : "manual";
    var pickerLayout = typeof payload.pickerLayout === "string"
      ? payload.pickerLayout.toLowerCase()
      : "cozy";
    var pickerYoutubeThumbnails = payload.pickerYoutubeThumbnails !== false;
    var needsScrollToTop = false;
    var pendingScrollTarget = null; // "top" | "bottom" | null
    var pendingScrollToLastOpened = false;
    var page = 1;
    var totalPages = 1;
    var lastQuery = "";
    var selectionActive = false;
    var pickerAnimation = (payload.pickerAnimation || "fade").toLowerCase();
    var clampDuration = function(val) { return Math.min(Math.max(val, 50), 2000); };
    var pickerAnimationDuration = (function() {
      var raw = Number.parseInt(payload.pickerAnimationDuration, 10);
      if (Number.isFinite(raw)) return clampDuration(raw);
      return pickerAnimation === "slide" ? 240 : (pickerAnimation === "scale" ? 220 : 180);
    })();
    var categoryPaletteOpen = false;
    var categoryPaletteOptions = [];
    var categoryPaletteActiveIndex = 0;
    var categoryPaletteEl = null;
    var categoryPaletteInput = null;
    var categoryPaletteList = null;
    var categoryPalettePendingTargetId = null;
    var categoryPalettePendingOffset = 0;
    var mouseCategorySelectionPausedUntil = 0;
    var MOUSE_SELECTION_PAUSE_MS = 900;
    var mouseHoverPauseUntil = 0;
    var MOUSE_HOVER_PAUSE_MS = 250;
    var CATEGORY_MARQUEE_MASK = "linear-gradient(90deg, transparent 0, rgba(0,0,0,0.65) 10px, rgba(0,0,0,1) 24px, rgba(0,0,0,1) calc(100% - 24px), rgba(0,0,0,0.65) calc(100% - 10px), transparent 100%)";
    var CATEGORY_MARQUEE_MIN_OVERFLOW = 6;
    var selectedItemIds = new Set();
    var draggingItemId = "";
    var dragMoveItemIds = [];
    var pendingFavoriteRestoreIds = [];
    var suppressRowClickUntil = 0;
    // Sekat right-click (contextmenu) selama 1.5 saat selepas picker dibuka
    // untuk elak klik kanan yang tidak sengaja semasa long-press membuka picker
    var suppressContextMenuUntil = Date.now() + 1500;
    // Timestamp dan bilangan item tulis terakhir dari picker
    // Digunakan untuk detect echo dari storage.onChanged dan elak restore item yang dipadam
    var pickerLastWriteAt = 0;
    var pickerLastWriteCount = -1;
    var pickerLastWriteHash = "";
    var PICKER_WRITE_STORAGE_IGNORE_MS = 800;
    var recentWriteHashes = [];
    var RECENT_WRITE_HASHES_MAX = 20;

    function trackWriteHash(hash) {
      if (!hash) return;
      recentWriteHashes.push(hash);
      if (recentWriteHashes.length > RECENT_WRITE_HASHES_MAX) {
        recentWriteHashes.shift();
      }
    }

    function buildItemsHash(itemList) {
      if (!Array.isArray(itemList)) return "";
      return itemList.map(function(item) {
        if (!item) return "";
        return String(item.id || "") + ":" + String(item.categoryId || "");
      }).join("|");
    }
    var pendingUndoMove = null;
    var pendingUndoTimer = null;
    var undoInProgress = false;
    var pendingUndoDelete = null;
    var pendingUndoDeleteTimer = null;
    var moveActionInProgress = false;
    var dragAutoScrollRaf = 0;
    var dragAutoScrollVelocity = 0;
    var reorderHoverRowEl = null;
    var categoryDropHoverRowEl = null;
    var draggingRowEl = null;
    var categorySwipeDeleteOpenEl = null;
    var dropPanelAutoVisible = false;
    var dropPanelAutoHideTimer = null;

    var dropBarTargetsKey = "";
    var dropBarVisualKey = "";
    var itemsRevision = 0;
    var filterInputTimer = null;
    var hoverCategorySelectTimer = null;
    var hoverCategorySelectTargetId = "";
    var dragMoveInfoCacheKey = "";
    var dragMoveInfoCacheRevision = -1;
    var dragMoveInfoCache = null;
    var categoryContextMenuState = null;
    var pendingRefreshDerivedTimer = null;
    var pendingRefreshDerivedOptions = null;
    var storageChangeHandler = null;
    var pendingStartLocation = null;
    var restoredFromLastLocation = false;
    var pickerLocationPersistenceReady = false;
    var pickerLastLocationSaveTimer = null;
    var pickerLastLocationSaveFingerprint = "";
    // ID item yang terakhir dibuka — highlight hijau muncul apabila picker dibuka semula dengan mod last-link
    var lastOpenedItemId = "";
    // Masa link terakhir dibuka dalam sesi ini (ms) — untuk TTL check
    var lastOpenedAt = 0;
    var titleRefreshInFlightCount = 0;
    var pickerAnimReady = pickerAnimation === "none";
    var panelShellManualPosition = null;
    var panelShellDragState = null;
    var panelShellResizeObserver = null;
    var panelShellViewportResizeHandler = null;
    var suppressOverlayClickUntil = 0;
    var dropBarChipByTargetId = new Map();
    var itemById = new Map();
    var hiddenCategoryIds = new Set();
    var titleRefreshQueuedIds = new Set();
    var titleRefreshTriedIds = new Set();
    var scanDupBtn = null;
    var SIDEBAR_AI_OPTIONS = [
      { id: "chatgpt", label: "ChatGPT" },
      { id: "claude", label: "Claude" },
      { id: "gemini", label: "Gemini" },
      { id: "perplexity", label: "Perplexity" },
      { id: "copilot", label: "Copilot" },
      { id: "grok", label: "Grok" },
      { id: "deepseek", label: "DeepSeek" },
      { id: "poe", label: "Poe" },
      { id: "mistral", label: "Mistral" }
    ];
    var CATEGORY_SWIPE_DELETE_REVEAL_PX = 84;
    var DROP_PANEL_REVEAL_RIGHT_OFFSET_PX = 14;
    var FILTER_INPUT_DEBOUNCE_MS = 80;
    var DERIVED_REFRESH_DEBOUNCE_MS = 50;
    var CATEGORY_HOVER_SELECT_DEBOUNCE_MS = 55;
    var TITLE_REFRESH_MAX_CONCURRENT = 2;
    var PICKER_PANEL_MIN_HEIGHT_PX = 360;
    var PICKER_PANEL_DEFAULT_HEIGHT_PX = 720;
    var BULK_SELECT_PLACEHOLDER = "__bulk_choose__";
    var BULK_SELECT_NONE = "__bulk_none__";
    function normalizeSidebarAiProvider(value) {
      var raw = value ? String(value).trim().toLowerCase() : "";
      for (var i = 0; i < SIDEBAR_AI_OPTIONS.length; i++) {
        if (SIDEBAR_AI_OPTIONS[i].id === raw) return raw;
      }
      return "chatgpt";
    }
    function getSidebarAiLabel(providerId) {
      var targetId = normalizeSidebarAiProvider(providerId);
      for (var i = 0; i < SIDEBAR_AI_OPTIONS.length; i++) {
        if (SIDEBAR_AI_OPTIONS[i].id === targetId) return SIDEBAR_AI_OPTIONS[i].label;
      }
      return "ChatGPT";
    }
    var sidebarAiProvider = normalizeSidebarAiProvider(payload.sidebarAiProvider);
    var currentTabUrl = payload.currentTabUrl || "";
    var currentTabTitle = payload.currentTabTitle || "";
    var youtubeAutoNext = payload.youtubeAutoNext === true;
    var youtubeAutoRandom = payload.youtubeAutoRandom === true;
    var deleteAfterOpenActive = payload.deleteAfterOpen === true;
    var randomAcrossAllCategories = payload.randomAcrossAllCategories === true;
    var hoverSoundEnabled = payload.hoverSoundEnabled === true;
    var hoverSoundUrl = payload.hoverSoundUrl ? String(payload.hoverSoundUrl) : "";
    var hoverSoundCtx = null;
    var hoverSoundLastPlayTs = 0;
    var hoverSoundBuffer = null;
    var hoverSoundLoading = false;
    var HOVER_SOUND_COOLDOWN_MS = 40;
    var categoryPaletteShortcut = (payload.categoryPaletteShortcut || "M").toString().trim();
    var pickerNextPageShortcut = (payload.pickerNextPageShortcut || "").toString().trim();
    var pickerToggleDeleteAfterOpenShortcut = (payload.pickerToggleDeleteAfterOpenShortcut || "").toString().trim();
    var pickerToggleShowHiddenShortcut = (payload.pickerToggleShowHiddenShortcut || "").toString().trim();
    var pickerImportShortcut = (payload.pickerImportShortcut || "").toString().trim();
    var pickerExportShortcut = (payload.pickerExportShortcut || "").toString().trim();
    var pickerClearFavShortcut = (payload.pickerClearFavShortcut || "").toString().trim();
    var pickerRestoreFavShortcut = (payload.pickerRestoreFavShortcut || "").toString().trim();
    var pickerAutoNextShortcut = (payload.pickerAutoNextShortcut || "").toString().trim();
    var pickerAutoRandomShortcut = (payload.pickerAutoRandomShortcut || "").toString().trim();
    var pickerSelectPageShortcut = (payload.pickerSelectPageShortcut || "").toString().trim();
    var pickerClearSelectionShortcut = (payload.pickerClearSelectionShortcut || "").toString().trim();
    var pickerBulkDeleteShortcut = (payload.pickerBulkDeleteShortcut || "").toString().trim();
    var pickerBulkFavShortcut = (payload.pickerBulkFavShortcut || "").toString().trim();
    var pickerRenameCategoryShortcut = (payload.pickerRenameCategoryShortcut || "").toString().trim();
    var pickerScanDupShortcut = (payload.pickerScanDupShortcut || "").toString().trim();
    var pickerFavShortcut = (payload.pickerFavShortcut || "F").toString().trim();
    var pickerToggleFavShortcut = (payload.pickerToggleFavShortcut || "").toString().trim();
    var pickerTrashShortcut = (payload.pickerTrashShortcut || "").toString().trim();
    var pickerPinShortcut = (payload.pickerPinShortcut || "").toString().trim();
    // Shortcut untuk toggle picker itu sendiri (contoh: "Alt+A" atau "Alt+Q").
    // Digunakan dalam catch-all block supaya shortcut ini tidak ditelan oleh picker,
    // membenarkan browser command system menutup picker bila shortcut ditekan semula.
    var pickerToggleSelfShortcut = (payload.pickerToggleSelfShortcut || "").toString().trim();
    function sendFavoritesDebugLog(event, detail) {
      if (!lpApi.runtime || !lpApi.runtime.sendMessage) return;
      try {
        var maybePromise = lpApi.runtime.sendMessage({
          type: "favorites-debug-log",
          event: event ? String(event) : "picker-event",
          detail: detail && typeof detail === "object" ? detail : detail == null ? null : String(detail)
        });
        if (maybePromise && typeof maybePromise.catch === "function") {
          maybePromise.catch(function() {});
        }
      } catch (err) {
        // ignore logging failures
      }
    }
    function summarizeFavoriteDebugItem(item) {
      if (!item || typeof item !== "object") return null;
      const rawFavoriteOrder = item.favoriteOrder;
      const favoriteOrder = typeof rawFavoriteOrder === "number" ? rawFavoriteOrder : Number(rawFavoriteOrder);
      const rawManualOrder = item.manualOrder;
      const manualOrder = typeof rawManualOrder === "number" ? rawManualOrder : Number(rawManualOrder);
      return {
        id: item.id ? String(item.id) : "",
        favorite: item.favorite === true,
        favoriteOrder: Number.isFinite(favoriteOrder) ? favoriteOrder : null,
        manualOrder: Number.isFinite(manualOrder) ? manualOrder : null,
        categoryId: item.categoryId ? String(item.categoryId) : "",
        title: item.title ? String(item.title) : "",
        url: item.url ? String(item.url) : ""
      };
    }
    async function persistPickerItemsSnapshot(nextItems, previousItems) {
      const snapshot = Array.isArray(nextItems) ? nextItems : [];
      // Catat masa dan bilangan item tulis supaya storageChangeHandler boleh detect echo
      pickerLastWriteAt = Date.now();
      pickerLastWriteCount = snapshot.length;
      pickerLastWriteHash = buildItemsHash(snapshot);
      trackWriteHash(pickerLastWriteHash);
      // Hantar ke background untuk tulis ke IndexedDB + storage.local secara atomic
      // supaya IndexedDB sentiasa sinkron dan item tidak muncul semula selepas operasi lain
      let writeOk = false;
      try {
        if (lpApi.runtime && lpApi.runtime.sendMessage) {
          const resp = await lpApi.runtime.sendMessage({
            type: "picker-write-items",
            items: snapshot,
            previousItems: Array.isArray(previousItems) ? previousItems : null,
          });
          writeOk = resp && resp.ok === true;
        }
      } catch (err) {
        writeOk = false;
      }
      // Fallback: tulis terus ke storage.local jika mesej gagal
      if (!writeOk) {
        await lpApi.storage.local.set({ [ITEM_KEY]: snapshot });
      }
      return snapshot;
    }
    function matchesShortcut(event, shortcut) {
      if (!shortcut) return false;
      const parts = String(shortcut)
        .split("+")
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
      let key = "";
      const requires = { ctrl: false, alt: false, shift: false, meta: false };
      for (const part of parts) {
        if (part === "ctrl" || part === "control") { requires.ctrl = true; continue; }
        if (part === "alt" || part === "option") { requires.alt = true; continue; }
        if (part === "shift") { requires.shift = true; continue; }
        if (part === "meta" || part === "cmd" || part === "command" || part === "win") { requires.meta = true; continue; }
        key = part;
      }
      const isAltPressed = event.altKey || (typeof event.getModifierState === 'function' && event.getModifierState('Alt'));
      if (requires.ctrl && !event.ctrlKey) return false;
      if (requires.alt && !isAltPressed) return false;
      if (requires.meta && !event.metaKey) return false;
      if (event.ctrlKey && !requires.ctrl) return false;
      if (isAltPressed && !requires.alt) return false;
      if (event.metaKey && !requires.meta) return false;
      if (requires.shift && !event.shiftKey) return false;
      if (event.shiftKey && !requires.shift) return false;
      if (!key) return false;
      return event.key && event.key.toLowerCase() === key.toLowerCase();
    }
    function consumePickerShortcutEvent(event) {
      event.preventDefault();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
      event.stopPropagation();
    }
    async function ensureHoverSoundBuffer() {
      if (!hoverSoundUrl) return null;
      if (hoverSoundBuffer) return hoverSoundBuffer;
      if (hoverSoundLoading) return null;
      hoverSoundLoading = true;
      try {
        const res = await fetch(hoverSoundUrl);
        const buf = await res.arrayBuffer();
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        if (!hoverSoundCtx) hoverSoundCtx = new Ctx();
        const decoded = await hoverSoundCtx.decodeAudioData(buf);
        hoverSoundBuffer = decoded;
        return hoverSoundBuffer;
      } catch (err) {
        hoverSoundBuffer = null;
        return null;
      } finally {
        hoverSoundLoading = false;
      }
    }

    async function playHoverSound() {
      if (!hoverSoundEnabled) return;
      try {
        const nowTs = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        if (nowTs - hoverSoundLastPlayTs < HOVER_SOUND_COOLDOWN_MS) return;
        hoverSoundLastPlayTs = nowTs;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!hoverSoundCtx) {
          hoverSoundCtx = new Ctx();
        }
        if (hoverSoundCtx.state === "suspended") {
          hoverSoundCtx.resume().catch(() => {});
        }
        const ctxNow = hoverSoundCtx.currentTime;
        // Use custom uploaded sound when available; fall back to synthesized click.
        if (hoverSoundUrl) {
          const buffer = await ensureHoverSoundBuffer();
          if (buffer) {
            const src = hoverSoundCtx.createBufferSource();
            src.buffer = buffer;
            const gain = hoverSoundCtx.createGain();
            gain.gain.setValueAtTime(0.5, ctxNow);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctxNow + 0.4);
            src.connect(gain);
            gain.connect(hoverSoundCtx.destination);
            src.start(ctxNow);
            return;
          }
        }
        const oscStart = hoverSoundCtx.currentTime;
        const osc = hoverSoundCtx.createOscillator();
        const gain = hoverSoundCtx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(2300, oscStart);
        osc.frequency.exponentialRampToValueAtTime(1300, oscStart + 0.08);
        gain.gain.setValueAtTime(0.2, oscStart);
        gain.gain.exponentialRampToValueAtTime(0.0001, oscStart + 0.08);
        osc.connect(gain);
        gain.connect(hoverSoundCtx.destination);
        osc.start(oscStart);
        osc.stop(oscStart + 0.1);
      } catch (err) {
        // ignore audio errors
      }
    }
    let runtimeMessageHandler = null;

    setTimeout(() => {
    let inputMode = "mouse";
    let lastMouseX = -1;
    let lastMouseY = -1;
    const overlay = document.createElement("div");
    overlay.id = overlayId;
    
    // Inject CSS for pure CSS hover states to prevent JS execution lag on mouseenter
    const styleEl = document.createElement("style");
    styleEl.textContent = "" +
      "#" + overlayId + ":not(.keyboard-nav-active) div[role='button']:hover:not([data-is-current='1']):not([data-active='1']) {" +
      "  background: rgba(255, 255, 255, 0.08) !important;" +
      "  box-shadow: 0 0 0 1px rgba(255, 214, 51, 0.25) !important;" +
      "}";
    overlay.appendChild(styleEl);

    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0, 0, 0, 0.35)";
    overlay.style.zIndex = "2147483647";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.fontFamily = "Segoe UI, Arial, sans-serif";
    overlay.style.color = theme.text;
    if (pickerAnimation !== "none") {
      overlay.style.transition = "none";
      overlay.style.opacity = "0";
      overlay.style.willChange = "opacity";
      const overlayDur = Math.max(80, Math.min(pickerAnimationDuration, 600));
      // double-rAF ensures the invisible state is painted before transition starts (Firefox-friendly)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.style.transition = "opacity " + overlayDur + "ms ease";
          overlay.style.opacity = "1";
          // clean up willChange after animation to free GPU memory
          setTimeout(() => { overlay.style.willChange = "auto"; }, overlayDur + 50);
        });
      });
    }
    overlay.addEventListener("mousemove", (e) => {
      if (Math.abs(e.clientX - lastMouseX) > 2 || Math.abs(e.clientY - lastMouseY) > 2) {
        inputMode = "mouse";
        overlay.classList.remove("keyboard-nav-active");
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
      if (!categoryPaletteOpen) {
        mouseCategorySelectionPausedUntil = 0;
      }
    });
    // Prevent page scroll when scrolling inside the picker overlay,
    // but allow scrolling in scrollable children (e.g. category list, item list)
    overlay.addEventListener("wheel", (e) => {
      let el = e.target;
      while (el && el !== overlay) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
          // Element is scrollable — only block if at boundary
          const atTop = el.scrollTop <= 0 && e.deltaY < 0;
          const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1 && e.deltaY > 0;
          if (!atTop && !atBottom) return; // allow native scroll
          break; // at boundary, block page scroll
        }
        el = el.parentElement;
      }
      e.preventDefault();
    }, { passive: false });

    const panel = document.createElement("div");
    panel.tabIndex = -1;
    panel.style.width = "min(1400px, 98vw)";
    panel.style.minWidth = MIN_PANEL_WIDTH + "px";
    panel.style.maxWidth = "98vw";
    panel.style.maxHeight = "92vh";
    panel.style.background = theme.panel;
    panel.style.border = theme.border;
    panel.style.borderRadius = "18px";
    panel.style.boxShadow = "0 18px 40px rgba(0, 0, 0, 0.45)";
    panel.style.backdropFilter = "blur(4px)";
    panel.style.padding = "10px 14px 12px";
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.gap = "7px";
    panel.style.opacity = "0";
    panel.style.transformOrigin = "center center";
    panel.style.color = theme.text;
    panel.style.willChange = "opacity";
    panel.style.position = "relative";
    panel.style.boxSizing = "border-box";
    panel.style.minHeight = PICKER_PANEL_MIN_HEIGHT_PX + "px";
    panel.style.height = "min(" + PICKER_PANEL_DEFAULT_HEIGHT_PX + "px, calc(100vh - 28px))";
    panel.style.overflow = "hidden";
    const applyPanelAnimation = () => {
      const defaultDuration = pickerAnimation === "slide" ? 240 : (pickerAnimation === "scale" ? 220 : 180);
      const duration = pickerAnimationDuration || defaultDuration;
      if (pickerAnimation === "none") {
        panel.style.opacity = (pickerOpacity / 100).toString();
        panel.style.transform = "none";
        panel.style.filter = "none";
        panel.style.transition = "none";
        return;
      }
      let startTransform = "none";
      let startFilter = "none";
      let transition = "opacity " + duration + "ms cubic-bezier(0.2, 0.7, 0.4, 1), transform " + duration + "ms cubic-bezier(0.2, 0.7, 0.4, 1)";
      switch (pickerAnimation) {
        case "slide":
          startTransform = "translateY(24px)";
          break;
        case "slide-left":
          startTransform = "translateX(24px)";
          break;
        case "slide-right":
          startTransform = "translateX(-24px)";
          break;
        case "scale":
          startTransform = "scale(0.9)";
          break;
        case "pop":
          startTransform = "scale(0.9)";
          transition = "opacity " + duration + "ms cubic-bezier(0.2, 0.8, 0.3, 1.15), transform " + duration + "ms cubic-bezier(0.2, 0.8, 0.3, 1.15)";
          break;
        case "drop":
          startTransform = "translateY(-18px)";
          transition = "opacity " + duration + "ms cubic-bezier(0.18, 0.8, 0.3, 1.05), transform " + duration + "ms cubic-bezier(0.18, 0.8, 0.3, 1.05)";
          break;
        case "blur":
          startFilter = "blur(6px)";
          transition = "opacity " + duration + "ms ease, transform " + duration + "ms ease, filter " + duration + "ms ease";
          break;
        default:
          startTransform = "none";
      }

      panel.style.transition = "none";
      panel.style.opacity = "0";
      panel.style.transform = startTransform;
      panel.style.filter = startFilter;
      // double-rAF to guarantee invisible state is rendered before transition (Firefox-friendly)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          panel.style.transition = transition;
          panel.style.opacity = (pickerOpacity / 100).toString();
          panel.style.transform = "none";
          panel.style.filter = "none";
          // clean up willChange after animation to free GPU memory
          setTimeout(() => { panel.style.willChange = "auto"; }, duration + 50);
        });
      });
    };

    const panelShell = document.createElement("div");
    panelShell.style.display = "flex";
    panelShell.style.position = "absolute";
    panelShell.style.left = "50%";
    panelShell.style.top = "50%";
    panelShell.style.transform = "translate(-50%, -50%)";
    panelShell.style.alignItems = "stretch";
    panelShell.style.gap = "10px";
    panelShell.style.maxWidth = "98vw";
    panelShell.style.maxHeight = "92vh";
    panelShell.style.boxSizing = "border-box";

    const categoryPalette = document.createElement("div");
    categoryPalette.style.position = "fixed";
    categoryPalette.style.left = "50%";
    categoryPalette.style.top = "18%";
    categoryPalette.style.transform = "translateX(-50%)";
    categoryPalette.style.zIndex = "2147483650";
    categoryPalette.style.minWidth = "340px";
    categoryPalette.style.maxWidth = "min(520px, 92vw)";
    categoryPalette.style.maxHeight = "80vh";
    categoryPalette.style.background = theme.panelAlt;
    categoryPalette.style.border = theme.border;
    categoryPalette.style.borderRadius = "12px";
    categoryPalette.style.boxShadow = "0 18px 40px rgba(0, 0, 0, 0.46)";
    categoryPalette.style.backdropFilter = "none";
    categoryPalette.style.padding = "12px";
    categoryPalette.style.display = "none";
    categoryPalette.style.flexDirection = "column";
    categoryPalette.style.gap = "8px";
    categoryPalette.style.boxSizing = "border-box";

    const categoryPaletteLabel = document.createElement("div");
    categoryPaletteLabel.textContent = "Move link to category";
    categoryPaletteLabel.style.color = theme.text;
    categoryPaletteLabel.style.fontSize = "13px";
    categoryPaletteLabel.style.fontWeight = "600";
    categoryPalette.appendChild(categoryPaletteLabel);

    categoryPaletteInput = document.createElement("input");
    categoryPaletteInput.type = "text";
    categoryPaletteInput.placeholder = "Type category name…";
    categoryPaletteInput.style.width = "100%";
    categoryPaletteInput.style.padding = "10px 12px";
    categoryPaletteInput.style.borderRadius = "10px";
    categoryPaletteInput.style.border = theme.inputBorder;
    categoryPaletteInput.style.background = theme.inputBg;
    categoryPaletteInput.style.color = theme.text;
    categoryPaletteInput.style.fontSize = "14px";
    categoryPaletteInput.style.outline = "none";
    categoryPalette.appendChild(categoryPaletteInput);

    categoryPaletteList = document.createElement("div");
    categoryPaletteList.style.display = "flex";
    categoryPaletteList.style.flexDirection = "column";
    categoryPaletteList.style.maxHeight = "72vh";
    categoryPaletteList.style.overflowY = "auto";
    categoryPaletteList.style.overscrollBehavior = "contain";
    categoryPaletteList.style.borderRadius = "8px";
    categoryPaletteList.style.outline = theme.border;
    categoryPalette.appendChild(categoryPaletteList);

    categoryPaletteInput.addEventListener("input", () => {
      renderCategoryPaletteList();
    });

    // Enlarged Thumbnail Preview Container
    const enlargedThumbnail = document.createElement("div");
    enlargedThumbnail.style.position = "fixed";
    enlargedThumbnail.style.zIndex = "2147483651";
    enlargedThumbnail.style.display = "none";
    enlargedThumbnail.style.pointerEvents = "none";
    enlargedThumbnail.style.background = "#000";
    enlargedThumbnail.style.border = "2px solid rgba(255, 214, 51, 0.6)";
    enlargedThumbnail.style.borderRadius = "12px";
    enlargedThumbnail.style.boxShadow = "0 20px 50px rgba(0,0,0,0.6)";
    enlargedThumbnail.style.overflow = "hidden";
    enlargedThumbnail.style.width = "480px";
    enlargedThumbnail.style.height = "270px"; // 16:9 ratio
    enlargedThumbnail.style.opacity = "0";
    enlargedThumbnail.style.transition = "opacity 150ms ease, transform 150ms ease";
    enlargedThumbnail.style.transform = "scale(0.95)";
    
    const enlargedImg = document.createElement("img");
    enlargedImg.style.width = "100%";
    enlargedImg.style.height = "100%";
    enlargedImg.style.objectFit = "contain";
    enlargedThumbnail.appendChild(enlargedImg);
    overlay.appendChild(enlargedThumbnail);

    let enlargedThumbnailTimer = null;

    function showEnlargedThumbnail(src, event) {
      if (!src) return;
      if (enlargedThumbnailTimer) clearTimeout(enlargedThumbnailTimer);
      
      enlargedImg.src = src;
      enlargedThumbnail.style.display = "block";
      
      const updatePosition = (e) => {
        const padding = 20;
        const w = 480;
        const h = 270;
        let left = e.clientX + 25;
        let top = e.clientY - (h / 2);
        
        // Keep within viewport
        if (left + w + padding > window.innerWidth) {
          left = e.clientX - w - 25;
        }
        if (top + h + padding > window.innerHeight) {
          top = window.innerHeight - h - padding;
        }
        if (top < padding) {
          top = padding;
        }
        
        enlargedThumbnail.style.left = left + "px";
        enlargedThumbnail.style.top = top + "px";
      };
      
      updatePosition(event);
      
      requestAnimationFrame(() => {
        enlargedThumbnail.style.opacity = "1";
        enlargedThumbnail.style.transform = "scale(1)";
      });
    }

    function hideEnlargedThumbnail() {
      enlargedThumbnail.style.opacity = "0";
      enlargedThumbnail.style.transform = "scale(0.95)";
      enlargedThumbnailTimer = setTimeout(() => {
        enlargedThumbnail.style.display = "none";
        enlargedImg.src = "";
      }, 150);
    }
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.flexDirection = "column";
    header.style.gap = "3px";
    header.style.flex = "0 0 auto";
    header.style.cursor = "grab";
    header.style.userSelect = "none";
    header.style.touchAction = "none";
    header.title = "Drag untuk pindah panel. Double-click untuk kembali ke tengah.";

    const headerTop = document.createElement("div");
    headerTop.style.display = "flex";
    headerTop.style.alignItems = "center";
    headerTop.style.justifyContent = "center";
    headerTop.style.gap = "8px";
    headerTop.style.position = "relative";
    headerTop.style.minHeight = "36px";

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.textContent = "←";
    backBtn.style.display = "none";
    backBtn.style.width = "28px";
    backBtn.style.height = "28px";
    backBtn.style.borderRadius = "8px";
    backBtn.style.border = "1px solid rgba(255, 255, 255, 0.12)";
    backBtn.style.background = "rgba(255, 255, 255, 0.08)";
    backBtn.style.color = "#fff";
    backBtn.style.cursor = "pointer";
    backBtn.style.fontSize = "16px";
    backBtn.style.lineHeight = "1";
    backBtn.style.position = "absolute";
    backBtn.style.left = "0";
    backBtn.style.top = "50%";
    backBtn.style.transform = "translateY(-50%)";

    const title = document.createElement("div");
    title.textContent = "Category picker";
    title.style.color = theme.text;
    title.style.fontSize = "16px";
    title.style.fontWeight = "600";
    title.style.textAlign = "center";
    title.style.flex = "1 1 auto";
    title.style.maxWidth = "100%";
    title.style.overflow = "hidden";
    title.style.textOverflow = "ellipsis";
    title.style.whiteSpace = "nowrap";

    const subTitle = document.createElement("div");
    subTitle.style.color = "rgba(255, 255, 255, 0.6)";
    subTitle.style.fontSize = "12px";

    headerTop.append(backBtn, title);
    header.append(headerTop, subTitle);

    const topBar = document.createElement("div");
    topBar.style.display = "flex";
    topBar.style.alignItems = "center";
    topBar.style.justifyContent = "space-between";
    topBar.style.gap = "5px";
    topBar.style.flexWrap = "wrap";
    topBar.style.rowGap = "4px";
    topBar.style.flex = "0 0 auto";

    const topLeft = document.createElement("div");
    topLeft.style.display = "flex";
    topLeft.style.alignItems = "center";
    topLeft.style.gap = "4px";
    topLeft.style.flexWrap = "wrap";
    topLeft.style.flex = "0 1 auto";
    topLeft.style.minWidth = "0";

    const topRight = document.createElement("div");
    topRight.style.display = "flex";
    topRight.style.alignItems = "center";
    topRight.style.gap = "4px";
    topRight.style.flexWrap = "wrap";
    topRight.style.flex = "0 1 auto";
    topRight.style.minWidth = "0";
    topRight.style.justifyContent = "flex-end";

    const importFileInput = document.createElement("input");
    importFileInput.type = "file";
    importFileInput.accept = ".json,application/json";
    importFileInput.style.display = "none";

    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.textContent = "⬇";
    importBtn.title = "Import backup";
    styleActionButton(importBtn, "default");

    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.textContent = "⬆";
    exportBtn.title = "Export backup";
    styleActionButton(exportBtn, "default");

    const settingsBtn = document.createElement("button");
    settingsBtn.type = "button";
    settingsBtn.textContent = "⚙️";
    settingsBtn.title = "Open settings";

    // ── Opacity slider ───────────────────────────────────────────────────────
    let pickerOpacity = 100;
    try {
      const savedOp = sessionStorage.getItem("lpPickerOpacity");
      if (savedOp) pickerOpacity = Math.max(20, Math.min(100, parseInt(savedOp, 10) || 100));
    } catch (_) {}

    const opacityControl = document.createElement("div");
    opacityControl.style.display = "flex";
    opacityControl.style.alignItems = "center";
    opacityControl.style.gap = "4px";
    opacityControl.style.marginLeft = "4px";

    const opacityLabel = document.createElement("span");
    opacityLabel.textContent = pickerOpacity + "%";
    opacityLabel.style.color = theme.muted;
    opacityLabel.style.fontSize = "10px";
    opacityLabel.style.minWidth = "24px";
    opacityLabel.style.textAlign = "right";
    opacityLabel.style.userSelect = "none";

    const opacitySlider = document.createElement("input");
    opacitySlider.type = "range";
    opacitySlider.min = "20";
    opacitySlider.max = "100";
    opacitySlider.value = String(pickerOpacity);
    opacitySlider.title = "Picker transparency";
    opacitySlider.style.width = "60px";
    opacitySlider.style.height = "4px";
    opacitySlider.style.accentColor = theme.accent;
    opacitySlider.style.cursor = "pointer";

    function applyPickerOpacity(val) {
      pickerOpacity = Math.max(20, Math.min(100, parseInt(val, 10) || 100));
      panel.style.opacity = (pickerOpacity / 100).toString();
      opacityLabel.textContent = pickerOpacity + "%";
      opacitySlider.value = String(pickerOpacity);
    }

    opacitySlider.addEventListener("input", () => {
      applyPickerOpacity(opacitySlider.value);
    });
    opacitySlider.addEventListener("change", () => {
      try {
        sessionStorage.setItem("lpPickerOpacity", String(pickerOpacity));
        savePickerLayout();
      } catch (_) {}
    });

    opacityControl.appendChild(opacityLabel);
    opacityControl.appendChild(opacitySlider);

    // Scroll wheel untuk adjust opacity
    opacityControl.addEventListener("wheel", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -5 : 5;
      applyPickerOpacity(pickerOpacity + delta);
      try {
        sessionStorage.setItem("lpPickerOpacity", String(pickerOpacity));
        savePickerLayout();
      } catch (_) {}
    }, { passive: false });

    const saveAllBtn = document.createElement("button");
    saveAllBtn.type = "button";
    saveAllBtn.textContent = "📦";
    saveAllBtn.title = "Save all tabs in this window";

    const saveCurrentBtn = document.createElement("button");
    saveCurrentBtn.type = "button";
    saveCurrentBtn.textContent = "📥";
    saveCurrentBtn.title = "Save current tab";

    const sidebarAiSelect = document.createElement("select");
    sidebarAiSelect.title = "Pilih AI untuk sidebar";
    sidebarAiSelect.setAttribute("aria-label", "Sidebar AI provider");
    styleCategorySelect(sidebarAiSelect);
    sidebarAiSelect.style.height = "28px";
    sidebarAiSelect.style.minWidth = "110px";
    sidebarAiSelect.style.maxWidth = "132px";
    SIDEBAR_AI_OPTIONS.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.label;
      sidebarAiSelect.appendChild(option);
    });
    sidebarAiSelect.value = normalizeSidebarAiProvider(sidebarAiProvider);

    const categoryCountBadge = document.createElement("div");
    categoryCountBadge.style.display = "flex";
    categoryCountBadge.style.alignItems = "center";
    categoryCountBadge.style.padding = "0 10px";
    categoryCountBadge.style.height = "28px";
    categoryCountBadge.style.borderRadius = "8px";
    categoryCountBadge.style.border = "1px solid rgba(255, 255, 255, 0.1)";
    categoryCountBadge.style.background = "rgba(0, 0, 0, 0.2)";
    categoryCountBadge.style.color = "rgba(255, 255, 255, 0.7)";
    categoryCountBadge.style.fontSize = "12px";
    categoryCountBadge.style.fontWeight = "500";
    categoryCountBadge.style.marginLeft = "4px";
    categoryCountBadge.textContent = "0 categories";

    const newCategoryBtn = document.createElement("button");
    newCategoryBtn.type = "button";
    newCategoryBtn.textContent = "➕";
    newCategoryBtn.title = "Create a new category";
    newCategoryBtn.style.marginLeft = "auto";

    const renameCategoryBtn = document.createElement("button");
    renameCategoryBtn.type = "button";
    renameCategoryBtn.textContent = "✏️";
    renameCategoryBtn.title = "Rename the selected category";

    const deleteCategoryBtn = document.createElement("button");
    deleteCategoryBtn.type = "button";
    deleteCategoryBtn.textContent = "❌";
    deleteCategoryBtn.title = "Delete the selected category";

    const trashBtn = document.createElement("button");
    trashBtn.type = "button";
    trashBtn.textContent = "🗑️";
    trashBtn.title = "Buka tong sampah";

    const showHiddenBtn = document.createElement("button");
    showHiddenBtn.type = "button";
    showHiddenBtn.textContent = "👁️";
    showHiddenBtn.title = "Show/hide hidden categories";
    showHiddenBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      let cur = showHiddenCategories;
      if (cur === true) cur = 1;
      if (!cur || cur === false) cur = 0;
      let next = cur >= 2 ? 0 : cur + 1;
      showHiddenCategories = next;

      activeCategoryId = "all";
      lastOpenedItemId = "";
      try {
        lpApi.storage.local.set({ selectedCategory: "all" });
        if (lpApi.runtime && lpApi.runtime.sendMessage) {
          lpApi.runtime.sendMessage({ type: "request-badge" }).catch(() => {});
        }
      } catch (_) {}

      lpApi.storage.local.get(SETTINGS_KEY).then((data) => {
        const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
        settings.showHiddenCategories = showHiddenCategories;
        lpApi.storage.local.set({ [SETTINGS_KEY]: settings });
      }).catch((err) => {
        console.error("Failed to persist showHiddenCategories", err);
      });

      const _hiddenLabels = [
        "👁️ Mod normal — kategori tersembunyi disembunyikan",
        "👁️‍🗨️ Tunjuk SEMUA kategori (termasuk tersembunyi)",
        "🙈 Tunjuk TERSEMBUNYI sahaja",
      ];
      flashHint(_hiddenLabels[next] || "👁️ Tukar mod hidden categories");

      updateTopBar();
      refreshCategoryEntries();
      if (mode === "items") {
        try {
          ensureItemsLoadedForActiveScope({ force: true });
        } catch (err) {
          console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
        }
      } else {
        refreshDerived();
        applyFilter();
      }
    });
    showHiddenBtn.addEventListener("wheel", (event) => {
      event.preventDefault();
      event.stopPropagation();
      let cur = showHiddenCategories;
      if (cur === true) cur = 1;
      if (!cur || cur === false) cur = 0;
      let next;
      if (event.deltaY < 0) {
        next = cur === 0 ? 2 : cur === 1 ? 0 : 1;
      } else {
        next = cur >= 2 ? 0 : cur + 1;
      }
      showHiddenCategories = next;

      activeCategoryId = "all";
      lastOpenedItemId = "";
      try {
        lpApi.storage.local.set({ selectedCategory: "all" });
        if (lpApi.runtime && lpApi.runtime.sendMessage) {
          lpApi.runtime.sendMessage({ type: "request-badge" }).catch(() => {});
        }
      } catch (_) {}

      lpApi.storage.local.get(SETTINGS_KEY).then((data) => {
        const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
        settings.showHiddenCategories = showHiddenCategories;
        lpApi.storage.local.set({ [SETTINGS_KEY]: settings });
      }).catch((err) => {
        console.error("Failed to persist showHiddenCategories", err);
      });

      const _hiddenLabels = [
        "👁️ Mod normal — kategori tersembunyi disembunyikan",
        "👁️‍🗨️ Tunjuk SEMUA kategori (termasuk tersembunyi)",
        "🙈 Tunjuk TERSEMBUNYI sahaja",
      ];
      flashHint(_hiddenLabels[next] || "👁️ Tukar mod hidden categories");

      updateTopBar();
      refreshCategoryEntries();
      if (mode === "items") {
        try {
          ensureItemsLoadedForActiveScope({ force: true });
        } catch (err) {
          console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
        }
      } else {
        refreshDerived();
        applyFilter();
      }
    });

    const deleteAfterOpenBtn = document.createElement("button");
    deleteAfterOpenBtn.type = "button";
    deleteAfterOpenBtn.textContent = "♻️";
    deleteAfterOpenBtn.title = "Delete link after opening";

    const randomAllBtn = document.createElement("button");
    randomAllBtn.type = "button";
    randomAllBtn.textContent = "🌐🎲";
    function updateRandomAllBtn() {
      randomAllBtn.title = randomAcrossAllCategories
        ? "Random merentas semua kategori: AKTIF — klik untuk hadkan ke kategori semasa"
        : "Random hanya dari kategori semasa — klik untuk random merentas semua kategori";
      randomAllBtn.style.opacity = randomAcrossAllCategories ? "1" : "0.35";
      randomAllBtn.style.background = randomAcrossAllCategories ? "rgba(100,180,255,0.18)" : "rgba(255,255,255,0.06)";
      randomAllBtn.style.borderColor = randomAcrossAllCategories ? "rgba(100,180,255,0.5)" : "rgba(255,255,255,0.12)";
    }
    randomAllBtn.style.cssText = "width:36px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:inherit;font-size:13px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;transition:all .2s;padding:0;";
    updateRandomAllBtn();
    randomAllBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const enabled = !randomAcrossAllCategories;
      await updatePickerSettings({ randomAcrossAllCategories: enabled });
      randomAcrossAllCategories = enabled;
      updateRandomAllBtn();
      flashHint(enabled ? "Random merentas semua kategori diaktifkan." : "Random hanya dari kategori semasa.");
    });

    const topFavBtn = document.createElement("button");
    topFavBtn.type = "button";
    topFavBtn.textContent = "⭐";
    topFavBtn.title = "Show favorites only (Alt+F)";

    const clearFavBtn = document.createElement("button");
    clearFavBtn.type = "button";
    clearFavBtn.textContent = "∅⭐";
    clearFavBtn.title = "Buang link daripada Favorite sahaja";
    clearFavBtn.style.display = "none";

    const restoreFavBtn = document.createElement("button");
    restoreFavBtn.type = "button";
    restoreFavBtn.textContent = "↺⭐";
    restoreFavBtn.title = "Pulihkan Favorite terakhir yang dibuang";
    restoreFavBtn.style.display = "none";

    const autoNextBtn = document.createElement("button");
    autoNextBtn.type = "button";
    autoNextBtn.textContent = "⏭️";
    autoNextBtn.title = "Buka link seterusnya automatik selepas video YouTube tamat";

    const autoRandomBtn = document.createElement("button");
    autoRandomBtn.type = "button";
    autoRandomBtn.textContent = "🔀";
    autoRandomBtn.title = "Buka link rawak automatik selepas video YouTube tamat";

    const headerRightActions = document.createElement("div");
    headerRightActions.style.position = "absolute";
    headerRightActions.style.right = "0";
    headerRightActions.style.top = "50%";
    headerRightActions.style.transform = "translateY(-50%)";
    headerRightActions.style.display = "flex";
    headerRightActions.style.gap = "6px";

    // Toggle butang auto page-turn scroll
    let autoPageEnabled = true;
    const autoPageToggleBtn = document.createElement("button");
    autoPageToggleBtn.type = "button";
    autoPageToggleBtn.title = "Toggle auto page-turn on scroll (kawasan kanan)";
    function updateAutoPageToggleBtn() {
      autoPageToggleBtn.textContent = autoPageEnabled ? "⇅" : "⇅";
      autoPageToggleBtn.style.opacity = autoPageEnabled ? "1" : "0.35";
      autoPageToggleBtn.style.background = autoPageEnabled ? "rgba(100,200,150,0.18)" : "rgba(255,255,255,0.06)";
      autoPageToggleBtn.style.borderColor = autoPageEnabled ? "rgba(100,200,150,0.4)" : "rgba(255,255,255,0.12)";
      autoPageToggleBtn.title = autoPageEnabled ? "Auto page-turn: ON — klik untuk matikan" : "Auto page-turn: OFF — klik untuk hidupkan";
    }
    autoPageToggleBtn.style.cssText = "width:28px;height:28px;border-radius:8px;border:1px solid rgba(100,200,150,0.4);background:rgba(100,200,150,0.18);color:#7fcfa0;font-size:15px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;transition:all .2s;";
    autoPageToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      autoPageEnabled = !autoPageEnabled;
      updateAutoPageToggleBtn();
    });
    updateAutoPageToggleBtn();

    headerRightActions.append(importBtn, exportBtn, settingsBtn, autoPageToggleBtn);
    headerTop.append(headerRightActions);

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.textContent = "📌";
    pinBtn.title = "Pin panel supaya tak tutup";
    function updatePinBtn() {
      pinBtn.style.opacity = pickerPinned ? "1" : "0.4";
      pinBtn.style.borderColor = pickerPinned ? "rgba(100,180,255,0.6)" : "rgba(255,255,255,0.15)";
      pinBtn.style.background = pickerPinned ? "rgba(100,180,255,0.15)" : "rgba(255,255,255,0.06)";
      pinBtn.title = pickerPinned ? "Panel dikunci — klik untuk nyahpin" : "Pin panel supaya tak tutup";
    }
    pinBtn.style.cssText = "width:28px;height:28px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:inherit;font-size:14px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;transition:all .2s;";
    pinBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      pickerPinned = !pickerPinned;
      updatePinBtn();
    });
    updatePinBtn();

    scanDupBtn = document.createElement("button");
    scanDupBtn.type = "button";
    scanDupBtn.textContent = "👯";
    scanDupBtn.title = "Imbas link pendua";
    styleTopButton(scanDupBtn, "default");
    scanDupBtn.id = "__lp_scan_dup_btn";
    if (!enableDedupeButton) scanDupBtn.style.display = "none";

    topLeft.append(pinBtn, saveAllBtn, saveCurrentBtn, sidebarAiSelect, categoryCountBadge, newCategoryBtn, deleteCategoryBtn, trashBtn, showHiddenBtn, deleteAfterOpenBtn, autoNextBtn, topFavBtn, clearFavBtn, restoreFavBtn);
    topRight.append(opacityControl, scanDupBtn, autoRandomBtn, randomAllBtn);
    topBar.append(topLeft, topRight);

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Type to filter categories...";
    input.style.width = "100%";
    input.style.padding = "7px 10px";
    input.style.boxSizing = "border-box";
    input.style.borderRadius = "8px";
    input.style.border = theme.inputBorder;
    input.style.background = theme.inputBg;
    input.style.color = theme.text;
    input.style.fontSize = "13px";
    input.style.outline = "none";
    input.style.flex = "0 0 auto";

    const toolbar = document.createElement("div");
    toolbar.style.display = "none";
    toolbar.style.alignItems = "center";
    toolbar.style.justifyContent = "space-between";
    toolbar.style.gap = "8px";
    toolbar.style.flex = "0 0 auto";

    const toolbarLeft = document.createElement("div");
    toolbarLeft.style.display = "flex";
    toolbarLeft.style.alignItems = "center";
    toolbarLeft.style.gap = "6px";

    const toolbarRight = document.createElement("div");
    toolbarRight.style.display = "flex";
    toolbarRight.style.alignItems = "center";
    toolbarRight.style.gap = "6px";

    const sortBtn = document.createElement("button");
    sortBtn.type = "button";
    sortBtn.textContent = "↓";
    sortBtn.title = "Sort by date (newest first)";

    const selectPageBtn = document.createElement("button");
    selectPageBtn.type = "button";
    selectPageBtn.textContent = "Select page";
    selectPageBtn.title = "Select all links on current page";

    const clearSelectionBtn = document.createElement("button");
    clearSelectionBtn.type = "button";
    clearSelectionBtn.textContent = "Clear";
    clearSelectionBtn.title = "Clear selected links";

    const bulkMoveSelect = document.createElement("select");
    bulkMoveSelect.title = "Move selected links to category";


    const bulkDeleteBtn = document.createElement("button");
    bulkDeleteBtn.type = "button";
    bulkDeleteBtn.textContent = "🗑️";
    bulkDeleteBtn.title = "Delete selected links";
    bulkDeleteBtn.style.color = "#ff6b6b";

    const bulkFavBtn = document.createElement("button");
    bulkFavBtn.type = "button";
    bulkFavBtn.textContent = "⭐";
    bulkFavBtn.title = "Favorite/Unfavorite selected links";
    bulkFavBtn.style.color = "#ffd700";

    function appendShortcutToTitle(btn, shortcut) {
      if (!btn || !shortcut) return;
      var base = btn.title || "";
      if (base.indexOf("(" + shortcut + ")") !== -1) return;
      btn.title = base + " (" + shortcut + ")";
    }
    appendShortcutToTitle(importBtn, pickerImportShortcut);
    appendShortcutToTitle(exportBtn, pickerExportShortcut);
    appendShortcutToTitle(clearFavBtn, pickerClearFavShortcut);
    appendShortcutToTitle(restoreFavBtn, pickerRestoreFavShortcut);
    appendShortcutToTitle(autoNextBtn, pickerAutoNextShortcut);
    appendShortcutToTitle(autoRandomBtn, pickerAutoRandomShortcut);
    appendShortcutToTitle(selectPageBtn, pickerSelectPageShortcut);
    appendShortcutToTitle(clearSelectionBtn, pickerClearSelectionShortcut);
    appendShortcutToTitle(bulkDeleteBtn, pickerBulkDeleteShortcut);
    appendShortcutToTitle(bulkFavBtn, pickerBulkFavShortcut);
    appendShortcutToTitle(renameCategoryBtn, pickerRenameCategoryShortcut);
    appendShortcutToTitle(scanDupBtn, pickerScanDupShortcut);
    appendShortcutToTitle(topFavBtn, pickerToggleFavShortcut);
    appendShortcutToTitle(trashBtn, pickerTrashShortcut);
    appendShortcutToTitle(pinBtn, pickerPinShortcut);

    const bulkSelectionInfo = document.createElement("span");
    bulkSelectionInfo.style.color = "rgba(255, 255, 255, 0.7)";
    bulkSelectionInfo.style.fontSize = "12px";
    bulkSelectionInfo.style.minWidth = "74px";
    bulkSelectionInfo.style.textAlign = "right";
    bulkSelectionInfo.textContent = "0 selected";

    const categoryJumpSelect = document.createElement("select");
    categoryJumpSelect.title = "Tukar kategori dengan cepat";
    categoryJumpSelect.addEventListener("change", () => {
      const value = categoryJumpSelect.value;
      if (!value) return;
      activeCategoryId = value;
      try {
        lpApi.storage.local.set({ selectedCategory: value });
        if (lpApi.runtime && lpApi.runtime.sendMessage) {
          lpApi.runtime.sendMessage({ type: "request-badge" });
        }
      } catch (err) {
        // ignore
      }
      setMode("items");
    });

    toolbarLeft.append(sortBtn, categoryJumpSelect);
    toolbarRight.append(selectPageBtn, clearSelectionBtn, bulkMoveSelect, bulkFavBtn, bulkDeleteBtn, bulkSelectionInfo);
    toolbar.append(toolbarLeft, toolbarRight);

    const dropBar = document.createElement("div");
    dropBar.style.display = "none";
    dropBar.style.flexDirection = "column";
    dropBar.style.gap = "7px";
    dropBar.style.flex = "0 0 auto";
    dropBar.style.flexShrink = "0";
    dropBar.style.width = "100%";
    dropBar.style.maxWidth = "100%";
    dropBar.style.minWidth = "0";
    dropBar.style.alignSelf = "stretch";
    dropBar.style.boxSizing = "border-box";
    dropBar.style.overflow = "hidden";
    dropBar.style.padding = "9px 10px";
    dropBar.style.border = "1px dashed rgba(255, 255, 255, 0.2)";
    dropBar.style.borderRadius = "12px";
    dropBar.style.background = "rgba(255, 255, 255, 0.03)";

    const dropBarLabel = document.createElement("div");
    dropBarLabel.style.color = "rgba(255, 255, 255, 0.7)";
    dropBarLabel.style.fontSize = "12px";
    dropBarLabel.style.lineHeight = "1.3";
    dropBarLabel.style.whiteSpace = "nowrap";
    dropBarLabel.style.overflow = "hidden";
    dropBarLabel.style.textOverflow = "ellipsis";
    dropBarLabel.textContent = "Drag link ke kategori untuk pindah";

    const dropBarChips = document.createElement("div");
    dropBarChips.style.display = "flex";
    dropBarChips.style.flexWrap = "wrap";
    dropBarChips.style.gap = "6px";
    dropBarChips.style.flex = "0 0 auto";
    dropBarChips.style.width = "100%";
    dropBarChips.style.maxWidth = "100%";
    dropBarChips.style.minWidth = "0";
    dropBarChips.style.minHeight = "30px";
    dropBarChips.style.maxHeight = "96px";
    dropBarChips.style.overflowX = "hidden";
    dropBarChips.style.overflowY = "auto";
    dropBarChips.style.overscrollBehavior = "contain";

    dropBar.append(dropBarLabel, dropBarChips);

    const dropSidePanel = document.createElement("div");
    dropSidePanel.style.display = "none";
    dropSidePanel.style.flexDirection = "column";
    dropSidePanel.style.width = "min(220px, 22vw)";
    dropSidePanel.style.minWidth = "180px";
    dropSidePanel.style.maxHeight = "92vh";
    dropSidePanel.style.minHeight = PICKER_PANEL_MIN_HEIGHT_PX + "px";
    dropSidePanel.style.background = "rgba(18, 18, 18, 0.88)";
    dropSidePanel.style.border = "1px solid rgba(255, 255, 255, 0.08)";
    dropSidePanel.style.borderRadius = "18px";
    dropSidePanel.style.boxShadow = "0 18px 40px rgba(0, 0, 0, 0.45)";
    dropSidePanel.style.backdropFilter = "none";
    dropSidePanel.style.padding = "12px";
    dropSidePanel.style.boxSizing = "border-box";
    dropSidePanel.style.overflow = "hidden";

    const dropSideTitle = document.createElement("div");
    dropSideTitle.textContent = "Drop Targets";
    dropSideTitle.style.color = "#fff";
    dropSideTitle.style.fontSize = "13px";
    dropSideTitle.style.fontWeight = "600";
    dropSideTitle.style.padding = "2px 4px";

    const dropSideBody = document.createElement("div");
    dropSideBody.style.display = "flex";
    dropSideBody.style.flexDirection = "column";
    dropSideBody.style.flex = "1 1 auto";
    dropSideBody.style.minHeight = "0";
    dropSideBody.style.overflow = "hidden";

    dropSidePanel.append(dropSideTitle, dropSideBody);

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "4px";
    list.style.overflow = "auto";
    list.style.overscrollBehavior = "contain";
    list.style.paddingRight = "28px";
    list.style.flex = "1 1 auto";
    list.style.minHeight = "0";
    list.style.scrollbarGutter = "stable";
    list.style.maxHeight = "none";

    const pager = document.createElement("div");
    pager.style.display = "none";
    pager.style.alignItems = "center";
    pager.style.justifyContent = "space-between";
    pager.style.gap = "8px";
    pager.style.flex = "0 0 auto";

    const pagerLeft = document.createElement("div");
    pagerLeft.style.display = "flex";
    pagerLeft.style.alignItems = "center";
    pagerLeft.style.gap = "6px";

    const pagerRight = document.createElement("div");
    pagerRight.style.display = "flex";
    pagerRight.style.alignItems = "center";
    pagerRight.style.gap = "6px";

    const prevPageBtn = document.createElement("button");
    prevPageBtn.type = "button";
    prevPageBtn.textContent = "←";
    prevPageBtn.title = "Previous page";

    const nextPageBtn = document.createElement("button");
    nextPageBtn.type = "button";
    nextPageBtn.textContent = "→";
    nextPageBtn.title = "Next page";

    const prevPageBtnRight = document.createElement("button");
    prevPageBtnRight.type = "button";
    prevPageBtnRight.textContent = "←";
    prevPageBtnRight.title = "Previous page";

    const nextPageBtnRight = document.createElement("button");
    nextPageBtnRight.type = "button";
    nextPageBtnRight.textContent = "→";
    nextPageBtnRight.title = "Next page";

    const pageInfo = document.createElement("div");
    pageInfo.style.color = "rgba(255, 255, 255, 0.7)";
    pageInfo.style.fontSize = "12px";

    pagerLeft.append(prevPageBtn, nextPageBtn);
    pagerRight.append(prevPageBtnRight, nextPageBtnRight, pageInfo);
    pager.append(pagerLeft, pagerRight);

    const hint = document.createElement("div");
    hint.textContent = "Enter to view links | " + (pickerFavShortcut || "F") + " favorite | D delete | / filter | Esc to close";
    hint.style.color = "rgba(255, 255, 255, 0.6)";
    hint.style.fontSize = "12px";
    hint.style.flex = "0 0 auto";

    const undoToast = document.createElement("div");
    undoToast.style.display = "none";
    undoToast.style.alignItems = "center";
    undoToast.style.justifyContent = "space-between";
    undoToast.style.gap = "10px";
    undoToast.style.padding = "8px 10px";
    undoToast.style.border = "1px solid rgba(255, 214, 51, 0.35)";
    undoToast.style.borderRadius = "10px";
    undoToast.style.background = "rgba(255, 214, 51, 0.1)";
    undoToast.style.color = "#ffe48a";
    undoToast.style.flex = "0 0 auto";

    const undoToastText = document.createElement("span");
    undoToastText.style.fontSize = "12px";
    undoToastText.style.lineHeight = "1.35";
    undoToastText.textContent = "";

    const undoToastBtn = document.createElement("button");
    undoToastBtn.type = "button";
    undoToastBtn.textContent = "Undo";
    undoToastBtn.style.padding = "3px 9px";
    undoToastBtn.style.fontSize = "12px";
    undoToastBtn.style.borderRadius = "8px";
    undoToastBtn.style.border = "1px solid rgba(255, 255, 255, 0.25)";
    undoToastBtn.style.background = "rgba(255, 255, 255, 0.12)";
    undoToastBtn.style.color = "#fff5c1";
    undoToastBtn.style.cursor = "pointer";

    undoToast.append(undoToastText, undoToastBtn);

    // ── Windows 10-style resize handles ───────────────────────────────────────
    var RESIZE_HANDLE_SIZE = 6;
    var RESIZE_EDGE_SIZE = 4;
    var MIN_PANEL_WIDTH = 400;
    var panelShellResizeState = null;
    var panelShellResizeDir = null;

    // Resize handles untuk semua edges dan corners
    var resizeHandles = {};
    var resizeDirections = {
      "n": { cursor: "ns-resize", edge: "top", x: false, y: true },
      "s": { cursor: "ns-resize", edge: "bottom", x: false, y: true },
      "e": { cursor: "ew-resize", edge: "right", x: true, y: false },
      "w": { cursor: "ew-resize", edge: "left", x: true, y: false },
      "ne": { cursor: "nesw-resize", edge: "top-right", x: true, y: true },
      "nw": { cursor: "nwse-resize", edge: "top-left", x: true, y: true },
      "se": { cursor: "nwse-resize", edge: "bottom-right", x: true, y: true },
      "sw": { cursor: "nesw-resize", edge: "bottom-left", x: true, y: true }
    };

    Object.keys(resizeDirections).forEach(function(dir) {
      var info = resizeDirections[dir];
      var handle = document.createElement("div");
      handle.dataset.noPanelDrag = "1";
      handle.dataset.resizeDir = dir;
      handle.title = "Drag to resize";
      handle.style.position = "absolute";
      handle.style.touchAction = "none";
      handle.style.userSelect = "none";
      handle.style.zIndex = "3";

      // Position berdasarkan direction
      if (dir.includes("n")) {
        handle.style.top = "0";
        handle.style.marginTop = "-1px";
      }
      if (dir.includes("s")) {
        handle.style.bottom = "0";
        handle.style.marginBottom = "-1px";
      }
      if (dir.includes("e")) {
        handle.style.right = "0";
        handle.style.marginRight = "-1px";
      }
      if (dir.includes("w")) {
        handle.style.left = "0";
        handle.style.marginLeft = "-1px";
      }

      // Size berdasarkan edge atau corner
      if (dir.length === 1) {
        // Edge handle
        if (dir === "n" || dir === "s") {
          handle.style.left = RESIZE_HANDLE_SIZE + "px";
          handle.style.right = RESIZE_HANDLE_SIZE + "px";
          handle.style.height = RESIZE_EDGE_SIZE + "px";
          handle.style.cursor = info.cursor;
        } else {
          handle.style.top = RESIZE_HANDLE_SIZE + "px";
          handle.style.bottom = RESIZE_HANDLE_SIZE + "px";
          handle.style.width = RESIZE_EDGE_SIZE + "px";
          handle.style.cursor = info.cursor;
        }
      } else {
        // Corner handle
        handle.style.width = (RESIZE_HANDLE_SIZE * 2) + "px";
        handle.style.height = (RESIZE_HANDLE_SIZE * 2) + "px";
        handle.style.cursor = info.cursor;
      }

      resizeHandles[dir] = handle;
    });

    // Visual grip di bottom-right corner
    var panelResizeGrip = document.createElement("div");
    panelResizeGrip.style.position = "absolute";
    panelResizeGrip.style.right = "10px";
    panelResizeGrip.style.bottom = "6px";
    panelResizeGrip.style.width = "28px";
    panelResizeGrip.style.height = "4px";
    panelResizeGrip.style.borderRadius = "999px";
    panelResizeGrip.style.background = "rgba(255, 255, 255, 0.32)";
    panelResizeGrip.style.boxShadow = "0 0 0 1px rgba(255, 255, 255, 0.08)";
    panelResizeGrip.style.pointerEvents = "none";
    panelResizeGrip.style.zIndex = "4";

    const categoryContextMenu = document.createElement("div");
    categoryContextMenu.style.display = "none";
    categoryContextMenu.style.position = "fixed";
    categoryContextMenu.style.left = "-9999px";
    categoryContextMenu.style.top = "-9999px";
    categoryContextMenu.style.minWidth = "190px";
    categoryContextMenu.style.flexDirection = "column";
    categoryContextMenu.style.gap = "4px";
    categoryContextMenu.style.padding = "6px";
    categoryContextMenu.style.border = "1px solid rgba(255, 255, 255, 0.14)";
    categoryContextMenu.style.borderRadius = "10px";
    categoryContextMenu.style.background = "rgba(16, 16, 16, 0.98)";
    categoryContextMenu.style.boxShadow = "0 14px 32px rgba(0, 0, 0, 0.45)";
    categoryContextMenu.style.backdropFilter = "none";
    categoryContextMenu.style.zIndex = "2147483647";

    const categoryMenuOpenBtn = document.createElement("button");
    categoryMenuOpenBtn.type = "button";
    categoryMenuOpenBtn.textContent = "View links";

    const categoryMenuHideBtn = document.createElement("button");
    categoryMenuHideBtn.type = "button";
    categoryMenuHideBtn.textContent = "Hide";

    const categoryMenuRenameBtn = document.createElement("button");
    categoryMenuRenameBtn.type = "button";
    categoryMenuRenameBtn.textContent = "Rename";

    const categoryMenuDeleteBtn = document.createElement("button");
    categoryMenuDeleteBtn.type = "button";
    categoryMenuDeleteBtn.textContent = "Delete";

    [categoryMenuOpenBtn, categoryMenuHideBtn, categoryMenuRenameBtn, categoryMenuDeleteBtn].forEach((btn) => {
      btn.style.width = "100%";
      btn.style.height = "30px";
      btn.style.padding = "0 10px";
      btn.style.borderRadius = "8px";
      btn.style.border = "1px solid rgba(255, 255, 255, 0.12)";
      btn.style.background = "rgba(255, 255, 255, 0.08)";
      btn.style.color = "#fff";
      btn.style.fontSize = "12px";
      btn.style.textAlign = "left";
      btn.style.cursor = "pointer";
      btn.style.lineHeight = "1";
    });
    categoryMenuDeleteBtn.style.border = "1px solid rgba(255, 179, 181, 0.5)";
    categoryMenuDeleteBtn.style.background = "rgba(232, 76, 79, 0.2)";
    categoryMenuDeleteBtn.style.color = "#ffd2d3";

    categoryContextMenu.append(categoryMenuOpenBtn, categoryMenuHideBtn, categoryMenuRenameBtn, categoryMenuDeleteBtn);

    // ── Item image context menu (right-click on badge) ──────────────────────
    let itemImageContextMenuState = null;

    const itemImageContextMenu = document.createElement("div");
    itemImageContextMenu.style.display = "none";
    itemImageContextMenu.style.position = "fixed";
    itemImageContextMenu.style.left = "-9999px";
    itemImageContextMenu.style.top = "-9999px";
    itemImageContextMenu.style.minWidth = "210px";
    itemImageContextMenu.style.flexDirection = "column";
    itemImageContextMenu.style.gap = "4px";
    itemImageContextMenu.style.padding = "6px";
    itemImageContextMenu.style.border = "1px solid rgba(255, 255, 255, 0.14)";
    itemImageContextMenu.style.borderRadius = "10px";
    itemImageContextMenu.style.background = "rgba(16, 16, 16, 0.98)";
    itemImageContextMenu.style.boxShadow = "0 14px 32px rgba(0, 0, 0, 0.45)";
    itemImageContextMenu.style.zIndex = "2147483647";

    // Label header — tunjuk domain item
    const itemImageMenuLabel = document.createElement("div");
    itemImageMenuLabel.style.padding = "2px 10px 4px";
    itemImageMenuLabel.style.fontSize = "11px";
    itemImageMenuLabel.style.color = "rgba(255,255,255,0.4)";
    itemImageMenuLabel.style.userSelect = "none";
    itemImageMenuLabel.style.overflow = "hidden";
    itemImageMenuLabel.style.textOverflow = "ellipsis";
    itemImageMenuLabel.style.whiteSpace = "nowrap";

    const itemMenuRefetchThumbBtn = document.createElement("button");
    itemMenuRefetchThumbBtn.type = "button";
    itemMenuRefetchThumbBtn.textContent = "🔄 Refresh thumbnail";

    const itemMenuSetThumbUrlBtn = document.createElement("button");
    itemMenuSetThumbUrlBtn.type = "button";
    itemMenuSetThumbUrlBtn.textContent = "🖼 Set thumbnail URL…";

    const itemMenuSetFaviconUrlBtn = document.createElement("button");
    itemMenuSetFaviconUrlBtn.type = "button";
    itemMenuSetFaviconUrlBtn.textContent = "🔗 Set favicon URL…";

    const itemMenuClearThumbBtn = document.createElement("button");
    itemMenuClearThumbBtn.type = "button";
    itemMenuClearThumbBtn.textContent = "✕ Clear thumbnail";

    [itemMenuRefetchThumbBtn, itemMenuSetThumbUrlBtn, itemMenuSetFaviconUrlBtn, itemMenuClearThumbBtn].forEach((btn) => {
      btn.style.width = "100%";
      btn.style.height = "30px";
      btn.style.padding = "0 10px";
      btn.style.borderRadius = "8px";
      btn.style.border = "1px solid rgba(255, 255, 255, 0.12)";
      btn.style.background = "rgba(255, 255, 255, 0.08)";
      btn.style.color = "#fff";
      btn.style.fontSize = "12px";
      btn.style.textAlign = "left";
      btn.style.cursor = "pointer";
      btn.style.lineHeight = "1";
    });
    itemMenuClearThumbBtn.style.border = "1px solid rgba(255, 179, 181, 0.5)";
    itemMenuClearThumbBtn.style.background = "rgba(232, 76, 79, 0.2)";
    itemMenuClearThumbBtn.style.color = "#ffd2d3";

    // Divider
    const itemImageMenuDivider = document.createElement("div");
    itemImageMenuDivider.style.height = "1px";
    itemImageMenuDivider.style.background = "rgba(255,255,255,0.08)";
    itemImageMenuDivider.style.margin = "2px 0";

    itemImageContextMenu.append(
      itemImageMenuLabel,
      itemMenuRefetchThumbBtn,
      itemMenuSetThumbUrlBtn,
      itemImageMenuDivider,
      itemMenuSetFaviconUrlBtn,
      itemMenuClearThumbBtn
    );

    // ── Image picker panel (klik pada badge → pilih gambar) ─────────────────
    let imagePanelState = null; // { itemId, entry, loading }
    let imagePanelFetchController = null;

    const imagePickerPanel = document.createElement("div");
    imagePickerPanel.style.cssText = [
      "display:none", "position:fixed", "z-index:2147483646",
      "background:rgba(14,14,14,0.97)", "border:1px solid rgba(255,255,255,0.13)",
      "border-radius:12px", "box-shadow:0 18px 48px rgba(0,0,0,0.65)",
      "flex-direction:column", "gap:0", "overflow:hidden",
      "min-width:280px", "max-width:340px",
    ].join(";");

    const imagePanelHeader = document.createElement("div");
    imagePanelHeader.style.cssText = [
      "display:flex", "align-items:center", "justify-content:space-between",
      "padding:10px 12px 8px", "border-bottom:1px solid rgba(255,255,255,0.08)",
      "flex-shrink:0",
    ].join(";");

    const imagePanelTitle = document.createElement("span");
    imagePanelTitle.textContent = "Pilih gambar";
    imagePanelTitle.style.cssText = "color:#fff;font-size:12px;font-weight:600;";

    const imagePanelDomain = document.createElement("span");
    imagePanelDomain.style.cssText = "color:rgba(255,255,255,0.38);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;";

    const imagePanelCloseBtn = document.createElement("button");
    imagePanelCloseBtn.type = "button";
    imagePanelCloseBtn.textContent = "✕";
    imagePanelCloseBtn.style.cssText = [
      "background:none", "border:none", "color:rgba(255,255,255,0.45)",
      "font-size:13px", "cursor:pointer", "padding:2px 4px", "line-height:1",
      "flex-shrink:0",
    ].join(";");

    imagePanelHeader.append(imagePanelTitle, imagePanelDomain, imagePanelCloseBtn);

    const imagePanelGrid = document.createElement("div");
    imagePanelGrid.style.cssText = [
      "display:grid", "grid-template-columns:repeat(3,1fr)", "gap:6px",
      "padding:10px", "overflow-y:auto", "max-height:260px",
    ].join(";");

    const imagePanelStatus = document.createElement("div");
    imagePanelStatus.style.cssText = [
      "padding:14px 12px", "color:rgba(255,255,255,0.45)", "font-size:12px",
      "text-align:center", "display:none",
    ].join(";");

    imagePickerPanel.append(imagePanelHeader, imagePanelGrid, imagePanelStatus);

    function closeImagePickerPanel() {
      if (imagePanelFetchController) {
        try { imagePanelFetchController.abort(); } catch (e) {}
        imagePanelFetchController = null;
      }
      imagePanelState = null;
      imagePickerPanel.style.display = "none";
      imagePickerPanel.style.left = "-9999px";
      imagePickerPanel.style.top = "-9999px";
    }

    function positionImagePickerPanel(anchorEl) {
      imagePickerPanel.style.display = "flex";
      imagePickerPanel.style.left = "0px";
      imagePickerPanel.style.top = "0px";
      requestAnimationFrame(() => {
        if (!imagePanelState) return;
        const panelRect = imagePickerPanel.getBoundingClientRect();
        const anchorRect = anchorEl ? anchorEl.getBoundingClientRect() : null;
        const pad = 8;
        let left, top;
        if (anchorRect) {
          left = anchorRect.left;
          top = anchorRect.bottom + 6;
          // Kalau terlalu ke bawah, tunjuk di atas badge
          if (top + panelRect.height > window.innerHeight - pad) {
            top = anchorRect.top - panelRect.height - 6;
          }
        } else {
          left = (window.innerWidth - panelRect.width) / 2;
          top = (window.innerHeight - panelRect.height) / 2;
        }
        const maxLeft = Math.max(pad, window.innerWidth - panelRect.width - pad);
        const maxTop = Math.max(pad, window.innerHeight - panelRect.height - pad);
        imagePickerPanel.style.left = Math.round(Math.min(Math.max(left, pad), maxLeft)) + "px";
        imagePickerPanel.style.top = Math.round(Math.min(Math.max(top, pad), maxTop)) + "px";
      });
    }

    function renderImagePickerCandidates(candidates, entry) {
      imagePanelGrid.textContent = "";
      imagePanelStatus.style.display = "none";

      if (!candidates || !candidates.length) {
        imagePanelStatus.textContent = "Tiada gambar dijumpai.";
        imagePanelStatus.style.display = "block";
        return;
      }

      candidates.forEach((candidate) => {
        const cell = document.createElement("div");
        cell.style.cssText = [
          "position:relative", "border-radius:6px", "overflow:hidden",
          "background:rgba(255,255,255,0.06)", "cursor:pointer",
          "aspect-ratio:16/9", "border:2px solid transparent",
          "transition:border-color 120ms ease",
        ].join(";");

        // Highlight kalau ini thumbnail semasa
        if (entry && candidate.url === (entry.thumbnailUrl || entry.pickerThumbnailUrl)) {
          cell.style.borderColor = "#5ac8ff";
        }

        const img = document.createElement("img");
        img.src = candidate.url;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";

        // Label sumber kecil di bawah
        const lbl = document.createElement("span");
        lbl.textContent = candidate.label || "";
        lbl.style.cssText = [
          "position:absolute", "bottom:0", "left:0", "right:0",
          "background:rgba(0,0,0,0.6)", "color:rgba(255,255,255,0.7)",
          "font-size:9px", "padding:2px 4px", "text-align:center",
          "pointer-events:none", "white-space:nowrap", "overflow:hidden",
          "text-overflow:ellipsis",
        ].join(";");

        // Gambar gagal load — tunjuk placeholder
        img.addEventListener("error", () => {
          img.style.display = "none";
          cell.style.background = "rgba(255,255,255,0.04)";
          const ph = document.createElement("span");
          ph.textContent = "✕";
          ph.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.2);font-size:16px;";
          cell.appendChild(ph);
        });

        cell.addEventListener("mouseenter", () => {
          if (cell.style.borderColor !== "rgb(90, 200, 255)") {
            cell.style.borderColor = "rgba(255,255,255,0.35)";
          }
        });
        cell.addEventListener("mouseleave", () => {
          if (cell.style.borderColor !== "rgb(90, 200, 255)") {
            cell.style.borderColor = "transparent";
          }
        });

        cell.addEventListener("click", async (e) => {
          e.stopPropagation();
          const state = imagePanelState;
          if (!state) return;
          closeImagePickerPanel();
          await saveItemImageField(state.itemId, { thumbnailUrl: candidate.url, thumbnailFetchFailed: false, thumbnailManual: true });
          flashHint("Thumbnail dikemas kini.");
        });

        cell.append(img, lbl);
        imagePanelGrid.appendChild(cell);
      });
    }

    async function openImagePickerPanel(badgeEl, entry) {
      if (!entry || !entry.id) return;
      closeImagePickerPanel();
      closeItemImageContextMenu();

      imagePanelState = { itemId: entry.id, entry, loading: true };

      // Set domain label
      try {
        imagePanelDomain.textContent = new URL(entry.url || "").hostname.replace(/^www\./, "");
      } catch (e) {
        imagePanelDomain.textContent = "";
      }

      // Tunjuk loading state
      imagePanelGrid.textContent = "";
      imagePanelStatus.textContent = "Memuatkan gambar…";
      imagePanelStatus.style.display = "block";

      positionImagePickerPanel(badgeEl);

      // Fetch candidates dari background (non-blocking, background buat kerja berat)
      try {
        const resp = await lpApi.runtime.sendMessage({
          type: "fetch-image-candidates",
          url: entry.url || "",
        });
        if (!imagePanelState) return; // panel ditutup semasa fetch
        imagePanelStatus.style.display = "none";
        const candidates = resp && resp.ok && Array.isArray(resp.candidates) ? resp.candidates : [];
        renderImagePickerCandidates(candidates, entry);
        // Reposition selepas grid diisi (saiz panel mungkin berubah)
        positionImagePickerPanel(badgeEl);
      } catch (e) {
        if (!imagePanelState) return;
        imagePanelStatus.textContent = "Gagal memuatkan gambar.";
        imagePanelStatus.style.display = "block";
        imagePanelGrid.textContent = "";
      }
    }

    imagePanelCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeImagePickerPanel();
    });

    // Tutup panel apabila klik di luar
    overlay.addEventListener("click", (e) => {
      if (imagePanelState && !imagePickerPanel.contains(e.target)) {
        closeImagePickerPanel();
      }
    }, true);

    // ── Auto page-turn: hanya apabila cursor berada di scrollbar ──
    const AUTO_PAGE_THRESHOLD_PX = 4;   // dalam 4px dari hujung
    const AUTO_PAGE_COOLDOWN_MS = 200; // cooldown 200ms selepas tukar page
    let autoPageCooldownUntil = 0;
    let autoPageCursorOnScrollbar = false;

    // Track sama ada cursor berada di bahagian kanan list (dari separuh lebar ke kanan, termasuk scrollbar)
    list.addEventListener("mousemove", (e) => {
      const rect = list.getBoundingClientRect();
      const xInList = e.clientX - rect.left;
      autoPageCursorOnScrollbar = xInList >= rect.width * 0.6;
    }, { passive: true });

    list.addEventListener("mouseleave", () => {
      autoPageCursorOnScrollbar = false;
    }, { passive: true });

    function autoPageCancel() {
      // Tiada timer dalam cara ini — instant
    }

    // Tukar page terus bila wheel scroll di 40% kanan — scrollbar dikunci, tidak bergerak
    list.addEventListener("wheel", (e) => {
      if (!autoPageEnabled) return;
      if (!autoPageCursorOnScrollbar) return;
      if (itemsLoading || mode !== "items" || totalPages <= 1) return;

      // Kunci scrollbar — prevent scroll biasa supaya bar tidak bergerak
      e.preventDefault();

      if (Date.now() < autoPageCooldownUntil) return;

      if (e.deltaY > 0 && page < totalPages) {
        autoPageCooldownUntil = Date.now() + AUTO_PAGE_COOLDOWN_MS;
        goToPage(page + 1);
      } else if (e.deltaY < 0 && page > 1) {
        autoPageCooldownUntil = Date.now() + AUTO_PAGE_COOLDOWN_MS;
        goToPage(page - 1);
      }
    });

    // Append semua resize handles ke panel
    var resizeHandlesArray = Object.values(resizeHandles);
    panel.append(header, topBar, input, toolbar, dropBar, list, pager, hint, undoToast, ...resizeHandlesArray, panelResizeGrip);

    // Panel kategori di sebelah kiri — senarai kategori untuk tukar dengan cepat
    const categorySidePanel = document.createElement("div");
    categorySidePanel.id = "__lp_category_side_panel";
    categorySidePanel.style.display = "none";
    categorySidePanel.style.flexDirection = "column";
    categorySidePanel.style.width = "min(220px, 22vw)";
    categorySidePanel.style.minWidth = "180px";
    categorySidePanel.style.maxHeight = "92vh";
    categorySidePanel.style.minHeight = PICKER_PANEL_MIN_HEIGHT_PX + "px";
    categorySidePanel.style.background = theme.panel;
    categorySidePanel.style.border = theme.border;
    categorySidePanel.style.borderRadius = "18px";
    categorySidePanel.style.boxShadow = "0 18px 40px rgba(0, 0, 0, 0.45)";
    categorySidePanel.style.padding = "10px 6px";
    categorySidePanel.style.boxSizing = "border-box";
    categorySidePanel.style.overflow = "hidden";
    categorySidePanel.style.gap = "4px";

    const categorySidePanelHeader = document.createElement("div");
    categorySidePanelHeader.style.display = "flex";
    categorySidePanelHeader.style.alignItems = "center";
    categorySidePanelHeader.style.justifyContent = "space-between";
    categorySidePanelHeader.style.padding = "2px 8px 6px";
    categorySidePanelHeader.style.flex = "0 0 auto";

    const categorySidePanelTitle = document.createElement("div");
    categorySidePanelTitle.textContent = "Categories";
    categorySidePanelTitle.style.color = theme.muted;
    categorySidePanelTitle.style.fontSize = "10px";
    categorySidePanelTitle.style.fontWeight = "700";
    categorySidePanelTitle.style.letterSpacing = "0.06em";
    categorySidePanelTitle.style.textTransform = "uppercase";

    const categorySidePanelNewBtn = document.createElement("button");
    categorySidePanelNewBtn.type = "button";
    categorySidePanelNewBtn.textContent = "NEW";
    categorySidePanelNewBtn.title = "Create a new category";
    categorySidePanelNewBtn.style.cssText = [
      "display:inline-flex",
      "align-items:center",
      "justify-content:center",
      "padding:2px 7px",
      "border-radius:6px",
      "border:" + theme.chipBorder,
      "background:" + theme.chipBg,
      "color:" + theme.accent,
      "font-size:9px",
      "font-weight:700",
      "letter-spacing:0.05em",
      "cursor:pointer",
      "line-height:1.4",
      "transition:background 120ms ease,border-color 120ms ease",
      "outline:none",
    ].join(";");
    categorySidePanelNewBtn.addEventListener("mouseenter", () => {
      categorySidePanelNewBtn.style.background = "rgba(255,255,255,0.12)";
    });
    categorySidePanelNewBtn.addEventListener("mouseleave", () => {
      categorySidePanelNewBtn.style.background = theme.chipBg;
    });
    categorySidePanelNewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      createCategory();
    });

    categorySidePanelHeader.append(categorySidePanelTitle, categorySidePanelNewBtn);

    const categorySidePanelList = document.createElement("div");
    categorySidePanelList.style.display = "flex";
    categorySidePanelList.style.flexDirection = "column";
    categorySidePanelList.style.flex = "1 1 auto";
    categorySidePanelList.style.overflowY = "auto";
    categorySidePanelList.style.overscrollBehavior = "contain";
    categorySidePanelList.style.gap = "2px";

    categorySidePanel.append(categorySidePanelHeader, categorySidePanelList);

    // Halang klik dalam panel kategori dari naik ke overlay (elak tutup picker)
    categorySidePanel.addEventListener("click", (e) => { e.stopPropagation(); });

    let categorySidePanelFingerprint = "";
    let categorySidePanelFocused = false;
    let categorySidePanelActiveIndex = -1;
    let categorySidePanelHoveredCatId = "";
    let categorySidePanelSearchBuffer = "";
    let categorySidePanelSearchTimer = null;

    // Functions untuk manage focus pada category side panel
    function focusCategorySidePanel() {
      if (mode !== "items") return;
      categorySidePanelFocused = true;
      categorySidePanelActiveIndex = 0;
      categorySidePanelSearchBuffer = "";
      highlightCategorySidePanelItem();
      categorySidePanel.style.outline = "2px solid " + theme.accent;
      categorySidePanel.style.outlineOffset = "-2px";
    }

    function unfocusCategorySidePanel() {
      categorySidePanelFocused = false;
      categorySidePanelActiveIndex = -1;
      categorySidePanelHoveredCatId = "";
      categorySidePanelSearchBuffer = "";
      if (categorySidePanelSearchTimer) {
        clearTimeout(categorySidePanelSearchTimer);
        categorySidePanelSearchTimer = null;
      }
      clearCategorySidePanelHighlight();
      categorySidePanel.style.outline = "";
      categorySidePanel.style.outlineOffset = "";
      // Fokus balik ke picker
      restorePickerFocus();
    }

    function getSidePanelButtons() {
      return Array.from(categorySidePanelList.querySelectorAll("button"));
    }

    // Dapatkan kategori sasaran untuk rename: hover > keyboard highlight > active
    function getSidePanelTargetCategoryId() {
      // 1. Hovered category (mouse)
      if (categorySidePanelHoveredCatId) return categorySidePanelHoveredCatId;
      // 2. Keyboard highlighted category
      if (categorySidePanelFocused && categorySidePanelActiveIndex >= 0) {
        const buttons = getSidePanelButtons();
        if (categorySidePanelActiveIndex < buttons.length) {
          return buttons[categorySidePanelActiveIndex].dataset.catId || "";
        }
      }
      // 3. Fallback to active category
      return activeCategoryId;
    }

    function highlightCategorySidePanelItem() {
      const buttons = getSidePanelButtons();
      clearCategorySidePanelHighlight();
      if (categorySidePanelActiveIndex >= 0 && categorySidePanelActiveIndex < buttons.length) {
        const btn = buttons[categorySidePanelActiveIndex];
        btn.style.background = theme.chipBg;
        btn.style.borderColor = theme.accent;
        btn.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    function clearCategorySidePanelHighlight() {
      const buttons = getSidePanelButtons();
      buttons.forEach(btn => {
        // Reset ke default style
        const isActive = btn.dataset.catId === activeCategoryId;
        btn.style.background = isActive ? theme.chipBg : "transparent";
        btn.style.borderColor = isActive
          ? theme.accent.replace(")", ", 0.5)").replace("rgb", "rgba")
          : "transparent";
      });
    }

    function switchCategoryFromSidePanel(btn) {
      if (!btn || !btn.dataset.catId) return;
      const catId = btn.dataset.catId;
      if (catId === activeCategoryId) return;
      activeCategoryId = catId;
      lastOpenedItemId = "";
      try {
        lpApi.storage.local.set({ selectedCategory: catId });
        if (lpApi.runtime && lpApi.runtime.sendMessage) {
          lpApi.runtime.sendMessage({ type: "request-badge" });
        }
      } catch (err) { /* ignore */ }
      // Refresh items tanpa tukar mode atau unfocus
      refreshCategoryEntries();
      page = 1;
      lastQuery = "";
      selectionActive = false;
      itemEntries = buildItemEntries(activeCategoryId);
      try {
        ensureItemsLoadedForActiveScope();
      } catch (err) {
        console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
      }
      render();
      renderCategorySidePanel();
    }

    function handleCategorySidePanelKeydown(event) {
      if (!categorySidePanelFocused) return false;
      const buttons = getSidePanelButtons();
      if (!buttons.length) return false;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        categorySidePanelActiveIndex = Math.min(categorySidePanelActiveIndex + 1, buttons.length - 1);
        highlightCategorySidePanelItem();
        // Tukar kategori tapi kekal fokus pada side panel
        switchCategoryFromSidePanel(buttons[categorySidePanelActiveIndex]);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        categorySidePanelActiveIndex = Math.max(categorySidePanelActiveIndex - 1, 0);
        highlightCategorySidePanelItem();
        // Tukar kategori tapi kekal fokus pada side panel
        switchCategoryFromSidePanel(buttons[categorySidePanelActiveIndex]);
        return true;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        // Pilih kategori yang di-highlight
        if (categorySidePanelActiveIndex >= 0 && categorySidePanelActiveIndex < buttons.length) {
          buttons[categorySidePanelActiveIndex].click();
        }
        return true;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (categorySidePanelActiveIndex >= 0 && categorySidePanelActiveIndex < buttons.length) {
          buttons[categorySidePanelActiveIndex].click();
        }
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        unfocusCategorySidePanel();
        return true;
      }

      // Type-to-search: taip huruf untuk cari kategori
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();

        const typedKey = event.key.toLowerCase();

        // Check jika taip huruf sama berulang (untuk cycle)
        const isRepeat = categorySidePanelSearchBuffer.length === 1 && categorySidePanelSearchBuffer === typedKey;

        if (categorySidePanelSearchTimer) clearTimeout(categorySidePanelSearchTimer);

        if (isRepeat) {
          // Cycle: cari kategori SETELAH yang sedang aktif
          let matchIndex = -1;
          const startFrom = categorySidePanelActiveIndex + 1;
          // Cari dari selepas index semula ke akhir
          for (let i = startFrom; i < buttons.length; i++) {
            const label = (buttons[i].dataset.catLabel || "").toLowerCase();
            if (label.startsWith(typedKey)) {
              matchIndex = i;
              break;
            }
          }
          // Jika tak jumpa, cari dari awal (wrap around)
          if (matchIndex < 0) {
            for (let i = 0; i < startFrom; i++) {
              const label = (buttons[i].dataset.catLabel || "").toLowerCase();
              if (label.startsWith(typedKey)) {
                matchIndex = i;
                break;
              }
            }
          }
          if (matchIndex >= 0) {
            categorySidePanelActiveIndex = matchIndex;
            highlightCategorySidePanelItem();
            switchCategoryFromSidePanel(buttons[matchIndex]);
          }
        } else {
          // Taip huruf baru atau huruf baru selepas buffer
          categorySidePanelSearchBuffer += typedKey;

          // Cari kategori yang mula dengan buffer
          let matchIndex = -1;
          for (let i = 0; i < buttons.length; i++) {
            const label = (buttons[i].dataset.catLabel || "").toLowerCase();
            if (label.startsWith(categorySidePanelSearchBuffer)) {
              matchIndex = i;
              break;
            }
          }

          // Jika tiada match dengan buffer, cuba huruf terakhir sahaja
          if (matchIndex < 0 && categorySidePanelSearchBuffer.length > 1) {
            categorySidePanelSearchBuffer = typedKey;
            for (let i = 0; i < buttons.length; i++) {
              const label = (buttons[i].dataset.catLabel || "").toLowerCase();
              if (label.startsWith(categorySidePanelSearchBuffer)) {
                matchIndex = i;
                break;
              }
            }
          }

          if (matchIndex >= 0) {
            categorySidePanelActiveIndex = matchIndex;
            highlightCategorySidePanelItem();
            switchCategoryFromSidePanel(buttons[matchIndex]);
          }
        }

        // Reset buffer selepas 800ms
        categorySidePanelSearchTimer = setTimeout(() => {
          categorySidePanelSearchBuffer = "";
          categorySidePanelSearchTimer = null;
        }, 800);

        return true;
      }

      return false;
    }

    // Mouse events untuk fokus panel
    categorySidePanel.addEventListener("mouseenter", () => {
      if (mode !== "items") return;
      if (!categorySidePanelFocused) {
        focusCategorySidePanel();
      }
    });

    panel.addEventListener("mouseenter", () => {
      if (categorySidePanelFocused) {
        unfocusCategorySidePanel();
      }
    });

    // ── Emoji map untuk fallback icon kategori ────────────────────────────
    const _LP_SIDE_EMOJI_MAP = [
      ["all categor","🌐"],["uncategor","📋"],["youtube","▶️"],["video","🎬"],
      ["music","🎵"],["lagu","🎵"],["work","💼"],["kerja","💼"],["news","📰"],
      ["berita","📰"],["design","🎨"],["seni","🎨"],["art","🎨"],["code","💻"],
      ["coding","💻"],["dev","💻"],["read","📖"],["baca","📖"],["article","📖"],
      ["finance","💰"],["wang","💰"],["money","💰"],["game","🎮"],["gaming","🎮"],
      ["social","💬"],["sosial","💬"],["health","🏥"],["food","🍔"],["travel","✈️"],
      ["sport","⚽"],["sukan","⚽"],["photo","📷"],["gambar","📷"],["note","📝"],
      ["nota","📝"],["fav","⭐"],["hidden","👁️"],["ai","🤖"],["tech","⚙️"],
      ["shop","🛒"],["beli","🛒"],["tool","🔧"],["learn","📚"],["belajar","📚"],
    ];
    function _lpSideGetEmoji(label) {
      const l = (label || "").toLowerCase();
      for (const [key, emoji] of _LP_SIDE_EMOJI_MAP) {
        if (l.includes(key)) return emoji;
      }
      return "📁";
    }
    function _lpSideRenderIcon(el, icon, sizePx) {
      const sz = sizePx || 16;
      if (!icon) { el.textContent = "📁"; return; }
      if (icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("data:image")) {
        const img = document.createElement("img");
        img.src = icon;
        img.style.cssText = "width:" + sz + "px;height:" + sz + "px;object-fit:contain;border-radius:3px;vertical-align:middle;display:inline-block;flex-shrink:0;";
        img.onerror = function() { img.remove(); el.textContent = "📁"; };
        el.textContent = "";
        el.appendChild(img);
      } else if (icon.startsWith("<svg") || icon.startsWith("<SVG")) {
        try {
          var doc = new DOMParser().parseFromString(icon, "image/svg+xml");
          if (!doc.querySelector("parsererror")) {
            doc.querySelectorAll("script,foreignObject,iframe,object,embed").forEach(function(n){ n.remove(); });
            var svg = doc.querySelector("svg");
            if (svg) {
              svg.querySelectorAll("*").forEach(function(n2){
                for (var i = n2.attributes.length - 1; i >= 0; i--) {
                  var an = n2.attributes[i].name.toLowerCase();
                  if (an.startsWith("on")) n2.removeAttribute(n2.attributes[i].name);
                }
              });
              svg.style.width = sz + "px";
              svg.style.height = sz + "px";
              svg.style.flexShrink = "0";
              el.textContent = "";
              el.appendChild(doc.importNode(svg, true));
            }
          } else { el.textContent = icon; }
        } catch(e) { el.textContent = icon; }
      } else {
        el.textContent = icon;
      }
    }

    function renderCategorySidePanel() {
      if (mode !== "items") {
        categorySidePanel.style.display = "none";
        categorySidePanelFingerprint = "";
        return;
      }

      // Bina fingerprint untuk skip rebuild jika tiada perubahan
      const fp = activeCategoryId + "|" + categories.length + "|" +
        (categoryCounts.all || 0) + "|" + (categoryCounts.none || 0) + "|" +
        JSON.stringify(categoryCounts.byId || {}) + "|" +
        categories.map(function(c) { return c ? (c.id + ":" + (c.icon || "")) : ""; }).join(",");
      if (fp === categorySidePanelFingerprint && categorySidePanel.style.display === "flex") {
        return; // tiada perubahan, skip rebuild
      }
      categorySidePanelFingerprint = fp;
      categorySidePanelList.innerHTML = "";
      // Bina senarai kategori
      const catEntries = [];
      // Tambah "All"
      catEntries.push({ id: "all", label: "All", count: categoryCounts.all || 0, icon: "🌐" });
      // Tambah "Uncategorized"
      if (payload.includeUncategorized !== false && showHiddenCategories !== 2) {
        catEntries.push({ id: "none", label: "Uncategorized", count: categoryCounts.none || 0, icon: "📋" });
      }
      // Tambah "Uncategorize" untuk hidden mode
      if (payload.includeUncategorized !== false && showHiddenCategories >= 1) {
        catEntries.push({ id: "hidden_none", label: "Uncategorize (hidden)", count: categoryCounts.hiddenNone || 0, icon: "🙈" });
      }
      // Tambah kategori lain
      categories.forEach((cat) => {
        if (!cat || !cat.id) return;
        if (showHiddenCategories === 2 && !cat.hidden) return;
        if (!showHiddenCategories && cat.hidden) return;
        const count = categoryCounts.byId && typeof categoryCounts.byId[cat.id] === "number"
          ? categoryCounts.byId[cat.id] : 0;
        const catIcon = cat.icon || _lpSideGetEmoji(cat.name || cat.id);
        catEntries.push({ id: cat.id, label: cat.name || cat.id, count, icon: catIcon });
      });

      if (!catEntries.length) {
        categorySidePanel.style.display = "none";
        return;
      }

      categorySidePanel.style.display = "flex";

      catEntries.forEach((cat) => {
        const isActive = cat.id === activeCategoryId;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.catId = cat.id;
        btn.dataset.catLabel = cat.label;
        btn.style.cssText = [
          "display:flex",
          "align-items:center",
          "justify-content:space-between",
          "gap:4px",
          "width:100%",
          "padding:6px 8px",
          "border-radius:8px",
          "border:1px solid " + (isActive ? theme.accent.replace(")", ", 0.5)").replace("rgb", "rgba") : "transparent"),
          "background:" + (isActive ? theme.chipBg : "transparent"),
          "color:" + (isActive ? theme.accent : theme.text),
          "font-size:12px",
          "font-weight:" + (isActive ? "600" : "400"),
          "text-align:left",
          "cursor:pointer",
          "transition:background 120ms ease,border 120ms ease",
          "outline:none",
          "box-sizing:border-box",
        ].join(";");

        const labelSpan = document.createElement("span");
        labelSpan.textContent = cat.label;
        labelSpan.style.cssText = "flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";

        const iconSpan = document.createElement("span");
        iconSpan.style.cssText = "flex:0 0 auto;margin-right:4px;font-size:14px;line-height:1;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;";
        _lpSideRenderIcon(iconSpan, cat.icon, 16);

        const countSpan = document.createElement("span");
        countSpan.textContent = String(cat.count);
        countSpan.style.cssText = [
          "flex:0 0 auto",
          "font-size:10px",
          "font-weight:600",
          "color:" + (isActive ? theme.accent : theme.muted),
          "background:" + theme.chipBg,
          "padding:1px 5px",
          "border-radius:999px",
          "min-width:18px",
          "text-align:center",
        ].join(";");

        btn.append(iconSpan, labelSpan, countSpan);

        btn.addEventListener("mouseenter", () => {
          categorySidePanelHoveredCatId = cat.id;
          if (!isActive) {
            btn.style.background = theme.inputBg;
            btn.style.color = theme.text;
          }
        });
        btn.addEventListener("mouseleave", () => {
          if (categorySidePanelHoveredCatId === cat.id) {
            categorySidePanelHoveredCatId = "";
          }
          if (!isActive) {
            btn.style.background = "transparent";
            btn.style.color = theme.text;
            btn.style.opacity = "0.75";
          }
        });
        if (!isActive) btn.style.opacity = "0.75";

        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (cat.id === activeCategoryId) {
            unfocusCategorySidePanel();
            return;
          }
          activeCategoryId = cat.id;
          lastOpenedItemId = "";
          try {
            lpApi.storage.local.set({ selectedCategory: cat.id });
            if (lpApi.runtime && lpApi.runtime.sendMessage) {
              lpApi.runtime.sendMessage({ type: "request-badge" });
            }
          } catch (err) { /* ignore */ }
          unfocusCategorySidePanel();
          setMode("items");
        });

        // Klik kanan — buka sidebar context menu (skip "All")
        if (cat.id !== "all") {
          btn.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Sekat 1.5 saat selepas picker dibuka (sama dengan suppressContextMenuUntil)
            if (Date.now() < suppressContextMenuUntil) return;
            openSideCatContextMenu(cat.id, cat.label, e.clientX, e.clientY);
          });
        }

        categorySidePanelList.appendChild(btn);
      });
    }

    // ── Sidebar Category Context Menu ────────────────────────────────────────
    const sideCatCtxMenu = document.createElement("div");
    sideCatCtxMenu.id = "__lp_side_cat_ctx_menu";
    sideCatCtxMenu.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "display:none",
      "flex-direction:column",
      "min-width:160px",
      "padding:6px",
      "border-radius:10px",
      "border:" + theme.border,
      "background:" + theme.panel,
      "box-shadow:0 8px 32px rgba(0,0,0,0.45)",
      "backdrop-filter:blur(12px)",
      "gap:2px",
      "box-sizing:border-box",
    ].join(";");

    let sideCatCtxMenuOpen = false;
    let sideCatCtxMenuTargetId = "";

    function closeSideCatContextMenu() {
      if (!sideCatCtxMenuOpen) return;
      sideCatCtxMenu.style.display = "none";
      sideCatCtxMenuOpen = false;
      sideCatCtxMenuTargetId = "";
    }

    function openSideCatContextMenu(categoryId, categoryLabel, clientX, clientY) {
      // Tutup dulu jika ada yang terbuka
      closeSideCatContextMenu();

      sideCatCtxMenuTargetId = categoryId;
      sideCatCtxMenu.innerHTML = "";

      // ── Header label ──────────────────────────────────────────────────────
      const headerEl = document.createElement("div");
      headerEl.textContent = categoryLabel;
      headerEl.style.cssText = [
        "padding:4px 10px 6px",
        "font-size:11px",
        "font-weight:700",
        "color:" + theme.muted,
        "white-space:nowrap",
        "overflow:hidden",
        "text-overflow:ellipsis",
        "max-width:200px",
        "border-bottom:" + theme.border,
        "margin-bottom:2px",
      ].join(";");
      sideCatCtxMenu.appendChild(headerEl);

      // ── Helper: buat item menu ────────────────────────────────────────────
      function makeMenuItem(label, isDanger, onClick) {
        const item = document.createElement("button");
        item.type = "button";
        item.textContent = label;
        item.style.cssText = [
          "display:block",
          "width:100%",
          "padding:7px 10px",
          "border-radius:7px",
          "border:none",
          "background:" + (isDanger ? "rgba(220,38,38,0.12)" : "transparent"),
          "color:" + (isDanger ? "#fca5a5" : theme.text),
          "font-size:12px",
          "font-weight:500",
          "text-align:left",
          "cursor:pointer",
          "transition:background 100ms ease",
          "outline:none",
          "box-sizing:border-box",
        ].join(";");
        item.addEventListener("mouseenter", () => {
          item.style.background = isDanger ? "rgba(220,38,38,0.22)" : theme.inputBg;
        });
        item.addEventListener("mouseleave", () => {
          item.style.background = isDanger ? "rgba(220,38,38,0.12)" : "transparent";
        });
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          closeSideCatContextMenu();
          onClick();
        });
        return item;
      }

      // ── Rename (hanya untuk user category, bukan "none"/"hidden_none") ───
      if (categoryId !== "none" && categoryId !== "hidden_none") {
        sideCatCtxMenu.appendChild(makeMenuItem("✏️  Rename", false, () => {
          renameCategoryFromSidebar(categoryId);
        }));
      }

      // ── Hide/Unhide category ──────────────────────────────────────────────
      if (categoryId !== "none" && categoryId !== "hidden_none") {
        const catObj = categories.find(c => c.id === categoryId);
        const isHidden = catObj && catObj.hidden;
        const hideLabel = isHidden ? "👁️  Unhide this category" : "🙈  Hide this category";
        sideCatCtxMenu.appendChild(makeMenuItem(hideLabel, false, () => {
          toggleCategoryHidden(categoryId);
        }));
      }

      // ── Delete ────────────────────────────────────────────────────────────
      const deleteLabel = categoryId === "none"
        ? "🗑️  Delete Uncategorized links"
        : (categoryId === "hidden_none" ? "🗑️  Delete Uncategorize (hidden) links" : "🗑️  Delete category & links");
      sideCatCtxMenu.appendChild(makeMenuItem(deleteLabel, true, () => {
        deleteCategoryAndLinksFromSidebar(categoryId);
      }));

      // ── Posisi menu ───────────────────────────────────────────────────────
      sideCatCtxMenu.style.display = "flex";
      sideCatCtxMenuOpen = true;

      // Kira saiz selepas display:flex
      const menuW = sideCatCtxMenu.offsetWidth || 170;
      const menuH = sideCatCtxMenu.offsetHeight || 100;
      const vw = window.innerWidth || document.documentElement.clientWidth || 800;
      const vh = window.innerHeight || document.documentElement.clientHeight || 600;
      const pad = 8;

      let left = clientX;
      let top = clientY;

      // Jangan terkeluar kanan
      if (left + menuW + pad > vw) left = vw - menuW - pad;
      // Jangan terkeluar bawah
      if (top + menuH + pad > vh) top = vh - menuH - pad;
      // Jangan terkeluar kiri/atas
      if (left < pad) left = pad;
      if (top < pad) top = pad;

      sideCatCtxMenu.style.left = left + "px";
      sideCatCtxMenu.style.top = top + "px";
    }

    // ── Rename dari sidebar (tanpa guard mode) ────────────────────────────────
    async function renameCategoryFromSidebar(categoryId) {
      const targetId = categoryId ? String(categoryId) : "";
      if (!targetId || targetId === "all" || targetId === "none" || targetId === "hidden_none") return;
      const category = categories.find((cat) => cat && cat.id === targetId);
      if (!category) { flashHint("Category not found."); return; }
      const currentName = normalizeCategoryName(category.name);
      const input = window.prompt("Rename category:", currentName);
      const nextName = normalizeCategoryName(input);
      if (!nextName) return;
      if (nextName.toLowerCase() === currentName.toLowerCase()) {
        flashHint("Category name unchanged.");
        return;
      }
      const exists = categories.some((cat) => {
        if (!cat || !cat.id || cat.id === targetId) return false;
        return normalizeCategoryName(cat.name).toLowerCase() === nextName.toLowerCase();
      });
      if (exists) { window.alert("That category already exists."); return; }
      const nextCategories = categories.map((cat) => {
        if (!cat || !cat.id || cat.id !== targetId) return cat;
        return { ...cat, name: nextName };
      });
      try {
        await lpApi.storage.local.set({ [CATEGORY_KEY]: nextCategories });
        replaceCategories(nextCategories);
        refreshDerived();
        flashHint('Renamed to "' + nextName + '".');
      } catch (err) {
        flashHint("Unable to rename category.");
      }
    }

    // ── Toggle hide/unhide category ──────────────────────────────────────────
    async function toggleCategoryHidden(categoryId) {
      const targetId = categoryId ? String(categoryId) : "";
      if (!targetId || targetId === "all" || targetId === "none" || targetId === "hidden_none") return;
      const category = categories.find((cat) => cat && cat.id === targetId);
      if (!category) { flashHint("Category not found."); return; }
      const isCurrentlyHidden = !!category.hidden;
      const nextCategories = categories.map((cat) => {
        if (!cat || cat.id !== targetId) return cat;
        return { ...cat, hidden: !isCurrentlyHidden };
      });
      try {
        await lpApi.storage.local.set({ [CATEGORY_KEY]: nextCategories });
        replaceCategories(nextCategories);
        refreshDerived();
        renderCategorySidePanel();
        flashHint(isCurrentlyHidden ? "Category unhidden." : "Category hidden.");
      } catch (err) {
        flashHint("Unable to update category.");
      }
    }

    // ── Delete kategori + semua links terus (bukan pindah ke Uncategorized) ──
    async function deleteCategoryAndLinksFromSidebar(categoryId) {
      const targetId = categoryId ? String(categoryId) : "";
      if (!targetId || targetId === "all") return;

      // Kes khas: padam semua Uncategorized / Uncategorize links
      if (targetId === "none" || targetId === "hidden_none") {
        const label = targetId === "none" ? "Uncategorized" : "Uncategorize (hidden)";
        const confirmed = window.confirm("Delete all " + label + " links? This cannot be undone.");
        if (!confirmed) return;
        try {
          const data = await lpApi.storage.local.get(ITEM_KEY);
          const allItems = Array.isArray(data[ITEM_KEY]) ? data[ITEM_KEY] : [];
          const remaining = allItems.filter((item) => item && item.categoryId);
          await lpApi.storage.local.set({ [ITEM_KEY]: remaining });
          replaceItems(remaining);
          if (activeCategoryId === "none" || activeCategoryId === "hidden_none") activeCategoryId = "all";
          refreshDerived();
          flashHint(label + " links removed.");
        } catch (err) {
          flashHint("Unable to delete " + label + " links.");
        }
        return;
      }

      // Padam user category + semua links dalam kategori tersebut
      const category = categories.find((cat) => cat && cat.id === targetId);
      if (!category) return;
      const confirmed = window.confirm(
        'Delete category "' + (category.name || "") + '" and ALL its links? This cannot be undone.'
      );
      if (!confirmed) return;
      try {
        const nextCategories = categories.filter((cat) => cat && cat.id !== targetId);
        const data = await lpApi.storage.local.get(ITEM_KEY);
        const allItems = Array.isArray(data[ITEM_KEY]) ? data[ITEM_KEY] : [];
        // Buang semua links yang ada dalam kategori ini
        const nextItems = allItems.filter((item) => !(item && item.categoryId === targetId));
        const nextSelected = activeCategoryId === targetId ? "all" : (activeCategoryId || "all");
        await lpApi.storage.local.set({
          [CATEGORY_KEY]: nextCategories,
          [ITEM_KEY]: nextItems,
          selectedCategory: nextSelected,
        });
        replaceItems(nextItems);
        replaceCategories(nextCategories);
        if (activeCategoryId === targetId) activeCategoryId = "all";
        refreshDerived();
        flashHint('Deleted "' + (category.name || "") + '" and its links.');
      } catch (err) {
        flashHint("Unable to delete category.");
      }
    }

    // ── Tutup context menu bila klik luar atau Escape ─────────────────────────
    overlay.addEventListener("click", (e) => {
      if (sideCatCtxMenuOpen && !sideCatCtxMenu.contains(e.target)) {
        closeSideCatContextMenu();
      }
    }, true);

    overlay.addEventListener("keydown", (e) => {
      if (sideCatCtxMenuOpen) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Escape" || e.key === "Esc") {
          closeSideCatContextMenu();
        }
      }
    }, true);

    // Tutup bila scroll dalam panel kiri
    categorySidePanelList.addEventListener("scroll", () => {
      if (sideCatCtxMenuOpen) closeSideCatContextMenu();
    }, { passive: true });

    panelShell.append(categorySidePanel, panel, dropSidePanel);
    overlay.append(panelShell, categoryContextMenu, itemImageContextMenu, imagePickerPanel, categoryPalette, importFileInput, sideCatCtxMenu);
    (document.fullscreenElement || document.webkitFullscreenElement || document.body).appendChild(overlay);

    function getPickerViewportSize() {
      const docEl = document.documentElement || {};
      return {
        width: Math.max(0, window.innerWidth || docEl.clientWidth || 0),
        height: Math.max(0, window.innerHeight || docEl.clientHeight || 0),
      };
    }

    function getPickerViewportMargins(viewport = getPickerViewportSize()) {
      return {
        x: Math.max(8, Math.min(20, Math.round(viewport.width * 0.02))),
        y: Math.max(8, Math.min(20, Math.round(viewport.height * 0.02))),
      };
    }

    function clampPanelShellPosition(left, top) {
      const viewport = getPickerViewportSize();
      const shellRect = panelShell.getBoundingClientRect();
      const shellWidth = Math.min(
        viewport.width,
        Math.max(panelShell.offsetWidth || 0, shellRect.width || 0),
      );
      const shellHeight = Math.min(
        viewport.height,
        Math.max(panelShell.offsetHeight || 0, shellRect.height || 0),
      );
      const margins = getPickerViewportMargins(viewport);
      const marginX = margins.x;
      const marginY = margins.y;
      const minLeft = marginX;
      const minTop = marginY;
      const maxLeft = Math.max(minLeft, viewport.width - shellWidth - marginX);
      const maxTop = Math.max(minTop, viewport.height - shellHeight - marginY);
      return {
        left: Math.min(Math.max(Math.round(left), minLeft), maxLeft),
        top: Math.min(Math.max(Math.round(top), minTop), maxTop),
      };
    }

    function applyManualPanelShellPosition(left, top) {
      const clamped = clampPanelShellPosition(left, top);
      panelShellManualPosition = clamped;
      panelShell.style.left = clamped.left + "px";
      panelShell.style.top = clamped.top + "px";
      panelShell.style.transform = "none";
      return clamped;
    }

    function resetPanelShellPositionToCenter() {
      panelShellManualPosition = null;
      panelShell.style.left = "50%";
      panelShell.style.top = "50%";
      panelShell.style.transform = "translate(-50%, -50%)";
    }

    function ensurePanelShellUsesAbsolutePosition() {
      if (panelShellManualPosition) return panelShellManualPosition;
      const shellRect = panelShell.getBoundingClientRect();
      return applyManualPanelShellPosition(shellRect.left, shellRect.top);
    }

    function getManualPanelHeightBounds() {
      const viewport = getPickerViewportSize();
      const margins = getPickerViewportMargins(viewport);
      const shellRect = panelShell.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const shellTop = panelShellManualPosition ? panelShellManualPosition.top : shellRect.top;
      const shellExtraHeight = Math.max(
        0,
        Math.round(Math.max(shellRect.height || 0, panelShell.offsetHeight || 0) - Math.max(panelRect.height || 0, panel.offsetHeight || 0)),
      );
      const maxHeight = Math.max(
        PICKER_PANEL_MIN_HEIGHT_PX,
        Math.floor(viewport.height - shellTop - margins.y - shellExtraHeight),
      );
      return {
        min: Math.min(PICKER_PANEL_MIN_HEIGHT_PX, maxHeight),
        max: maxHeight,
      };
    }

    // ── Save picker size dan opacity ──────────────────────────────────────────
    var savePickerLayoutTimer = null;

    function savePickerLayout() {
      if (savePickerLayoutTimer) clearTimeout(savePickerLayoutTimer);
      savePickerLayoutTimer = setTimeout(function () {
        try {
          // Guna offsetHeight/offsetWidth untuk dapat nilai pixel sebenar
          var width = panel.offsetWidth || parseInt(panel.style.width, 10) || 0;
          var height = panel.offsetHeight || parseInt(panel.style.height, 10) || 0;
          var data = {};
          if (width >= MIN_PANEL_WIDTH) data.lpPickerWidth = width;
          if (height >= PICKER_PANEL_MIN_HEIGHT_PX) data.lpPickerHeight = height;
          data.lpPickerOpacity = pickerOpacity;
          // Hantar ke background script untuk simpan
          try {
            var msg = lpApi.runtime.sendMessage({
              type: "save-picker-layout",
              data: data
            });
            if (msg && typeof msg.catch === "function") msg.catch(function () {});
          } catch (_) {}
        } catch (_) {}
      }, 300);
    }


    function applyManualPanelHeight(nextHeight) {
      const bounds = getManualPanelHeightBounds();
      const clamped = Math.min(Math.max(Math.round(nextHeight), bounds.min), bounds.max);
      panel.style.height = clamped + "px";
      panel.style.maxHeight = bounds.max + "px";
      savePickerLayout();
      return clamped;
    }

    function constrainManualPanelHeightToViewport() {
      const explicitHeight = Number.parseFloat(panel.style.height);
      if (!Number.isFinite(explicitHeight)) return null;
      return applyManualPanelHeight(explicitHeight);
    }

    function shouldIgnorePanelShellDragTarget(target) {
      return !!(
        target
        && target.closest
        && target.closest(
          "button,input,select,textarea,option,a,label,[data-no-panel-drag='1'],[contenteditable='true']",
        )
      );
    }

    function beginPanelShellDrag(event) {
      if (!event || panelShellDragState) return;
      if (event.isPrimary === false) return;
      if (typeof event.button === "number" && event.button !== 0) return;
      if (shouldIgnorePanelShellDragTarget(event.target)) return;
      const shellRect = panelShell.getBoundingClientRect();
      panelShellDragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originLeft: shellRect.left,
        originTop: shellRect.top,
        moved: false,
        previousUserSelect: document.documentElement.style.userSelect || "",
      };
      document.documentElement.style.userSelect = "none";
      header.style.cursor = "grabbing";
      panelShell.style.willChange = "left, top";
      try {
        header.setPointerCapture(event.pointerId);
      } catch (err) {
        // ignore
      }
      event.preventDefault();
    }

    function movePanelShellDrag(event) {
      if (!panelShellDragState || !event) return;
      if (event.pointerId !== panelShellDragState.pointerId) return;
      const deltaX = event.clientX - panelShellDragState.startX;
      const deltaY = event.clientY - panelShellDragState.startY;
      if (!panelShellDragState.moved && Math.abs(deltaX) < 4 && Math.abs(deltaY) < 4) {
        return;
      }
      panelShellDragState.moved = true;
      applyManualPanelShellPosition(
        panelShellDragState.originLeft + deltaX,
        panelShellDragState.originTop + deltaY,
      );
      suppressOverlayClickUntil = Date.now() + 180;
      event.preventDefault();
    }

    function endPanelShellDrag(event) {
      if (!panelShellDragState) return;
      if (event && typeof event.pointerId === "number" && event.pointerId !== panelShellDragState.pointerId) {
        return;
      }
      try {
        header.releasePointerCapture(panelShellDragState.pointerId);
      } catch (err) {
        // ignore
      }
      document.documentElement.style.userSelect = panelShellDragState.previousUserSelect;
      header.style.cursor = "grab";
      panelShell.style.willChange = "";
      if (panelShellDragState.moved) {
        suppressOverlayClickUntil = Date.now() + 220;
      }
      panelShellDragState = null;
    }

    function beginPanelShellResize(event) {
      if (!event || panelShellResizeState) return;
      if (event.isPrimary === false) return;
      if (typeof event.button === "number" && event.button !== 0) return;

      var dir = event.target && event.target.dataset && event.target.dataset.resizeDir;
      if (!dir || !resizeDirections[dir]) return;

      ensurePanelShellUsesAbsolutePosition();
      const panelRect = panel.getBoundingClientRect();
      panelShellResizeState = {
        pointerId: event.pointerId,
        dir: dir,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: Math.max(panelRect.width || 0, panel.offsetWidth || 0),
        startHeight: Math.max(panelRect.height || 0, panel.offsetHeight || 0),
        startLeft: panelRect.left,
        startTop: panelRect.top,
        previousUserSelect: document.documentElement.style.userSelect || "",
      };
      document.documentElement.style.userSelect = "none";
      panel.style.willChange = "width,height";
      try {
        event.target.setPointerCapture(event.pointerId);
      } catch (err) {
        // ignore
      }
      suppressOverlayClickUntil = Date.now() + 180;
      event.preventDefault();
      event.stopPropagation();
    }

    function movePanelShellResize(event) {
      if (!panelShellResizeState || !event) return;
      if (event.pointerId !== panelShellResizeState.pointerId) return;

      var state = panelShellResizeState;
      var info = resizeDirections[state.dir];
      var deltaX = event.clientX - state.startX;
      var deltaY = event.clientY - state.startY;
      var bounds = getManualPanelHeightBounds();
      var viewportMaxW = window.innerWidth - 16;
      var viewportMaxH = bounds.max;

      if (info.y) {
        // South edges - height increases
        if (state.dir.includes("s")) {
          var newH = Math.min(Math.max(state.startHeight + deltaY, bounds.min), viewportMaxH);
          panel.style.height = newH + "px";
          panel.style.maxHeight = viewportMaxH + "px";
        }
        // North edges - height increases upward
        if (state.dir.includes("n")) {
          var newH = Math.min(Math.max(state.startHeight - deltaY, bounds.min), viewportMaxH);
          var actualDelta = state.startHeight - newH;
          panel.style.height = newH + "px";
          panel.style.maxHeight = viewportMaxH + "px";
          // Move panel up
          if (panelShellManualPosition) {
            panelShellManualPosition.top = state.startTop + actualDelta;
            panel.style.top = panelShellManualPosition.top + "px";
          }
        }
      }

      if (info.x) {
        // East edges - width increases
        if (state.dir.includes("e")) {
          var newW = Math.min(Math.max(state.startWidth + deltaX, MIN_PANEL_WIDTH), viewportMaxW);
          panel.style.width = newW + "px";
        }
        // West edges - width increases leftward
        if (state.dir.includes("w")) {
          var newW = Math.min(Math.max(state.startWidth - deltaX, MIN_PANEL_WIDTH), viewportMaxW);
          var actualDelta = state.startWidth - newW;
          panel.style.width = newW + "px";
          // Move panel left
          if (panelShellManualPosition) {
            panelShellManualPosition.left = state.startLeft + actualDelta;
            panel.style.left = panelShellManualPosition.left + "px";
          }
        }
      }

      syncDropSidePanelHeight();
      suppressOverlayClickUntil = Date.now() + 180;
      event.preventDefault();
      event.stopPropagation();
    }

    function endPanelShellResize(event) {
      if (!panelShellResizeState) return;
      if (event && typeof event.pointerId === "number" && event.pointerId !== panelShellResizeState.pointerId) {
        return;
      }
      try {
        var handle = resizeHandles[panelShellResizeState.dir];
        if (handle) handle.releasePointerCapture(panelShellResizeState.pointerId);
      } catch (err) {
        // ignore
      }
      document.documentElement.style.userSelect = panelShellResizeState.previousUserSelect;
      panel.style.willChange = "auto";
      panelShellResizeState = null;
      savePickerLayout();
      suppressOverlayClickUntil = Date.now() + 220;
    }

    header.addEventListener("pointerdown", beginPanelShellDrag);
    header.addEventListener("pointermove", movePanelShellDrag);
    header.addEventListener("pointerup", endPanelShellDrag);
    header.addEventListener("pointercancel", endPanelShellDrag);
    header.addEventListener("lostpointercapture", endPanelShellDrag);
    header.addEventListener("dblclick", (event) => {
      if (shouldIgnorePanelShellDragTarget(event.target)) return;
      resetPanelShellPositionToCenter();
      suppressOverlayClickUntil = Date.now() + 180;
      event.preventDefault();
    });

    // Attach resize event listeners ke semua handles
    Object.keys(resizeHandles).forEach(function(dir) {
      var handle = resizeHandles[dir];
      handle.addEventListener("pointerdown", beginPanelShellResize);
      handle.addEventListener("pointermove", movePanelShellResize);
      handle.addEventListener("pointerup", endPanelShellResize);
      handle.addEventListener("pointercancel", endPanelShellResize);
      handle.addEventListener("lostpointercapture", endPanelShellResize);
    });

    panelShellViewportResizeHandler = () => {
      constrainManualPanelHeightToViewport();
      syncDropSidePanelHeight();
      if (!panelShellManualPosition) return;
      applyManualPanelShellPosition(panelShellManualPosition.left, panelShellManualPosition.top);
    };
    window.addEventListener("resize", panelShellViewportResizeHandler);
    if (typeof ResizeObserver === "function") {
      panelShellResizeObserver = new ResizeObserver(() => {
        constrainManualPanelHeightToViewport();
        syncDropSidePanelHeight();
        if (!panelShellManualPosition) return;
        const shellRect = panelShell.getBoundingClientRect();
        applyManualPanelShellPosition(shellRect.left, shellRect.top);
      });
      panelShellResizeObserver.observe(panelShell);
    }

    // Initial animation and data are now deferred until the first IPC message arrives
    // to guarantee 100% pre-populated DOM before animation starts.

    function normalize(text) {
      return (text || "").toLowerCase();
    }

    function coerceArray(value) {
      if (Array.isArray(value)) return value.filter((v) => v != null);
      return [];
    }

    function normalizeTitleText(text) {
      return (text ? String(text) : "").replace(/\\s+/g, " ").trim();
    }

    function buildFallbackTitle(referenceUrl) {
      if (referenceUrl) {
        try {
          const host = new URL(referenceUrl).hostname.replace(/^www\\./i, "");
          if (host) return "Link from " + host;
        } catch (err) {
          // ignore parse errors
        }
      }
      return "Saved link";
    }

    function titleLooksLikeUrl(text, referenceUrl) {
      const raw = normalizeTitleText(text);
      if (!raw) return false;
      const lower = raw.toLowerCase();
      if (lower.startsWith("http://") || lower.startsWith("https://")) return true;
      if (/^[a-z0-9.-]+\\.[a-z]{2,}(?:[/:?#]|$)/i.test(raw)) return true;
      if (referenceUrl) {
        try {
          const parsed = new URL(referenceUrl);
          const normalizedHost = parsed.hostname.replace(/^www\\./i, "").toLowerCase();
          if (normalizedHost && raw.toLowerCase() === normalizedHost) {
            return true;
          }
        } catch (err) {
          // keep regex checks only
        }
      }
      return false;
    }

    function titleLooksGeneric(text) {
      const normalized = normalizeTitleText(text).toLowerCase();
      if (!normalized) return false;
      return normalized === "saved link" || normalized.startsWith("link from ");
    }

    function pickReadableTitle(primaryTitle, fallbackTitle, referenceUrl) {
      const primary = normalizeTitleText(primaryTitle);
      const fallback = normalizeTitleText(fallbackTitle);
      const primaryLooksUrl = titleLooksLikeUrl(primary, referenceUrl);
      const fallbackLooksUrl = titleLooksLikeUrl(fallback, referenceUrl);
      if (primary && !primaryLooksUrl && !titleLooksGeneric(primary)) return primary;
      if (fallback && !fallbackLooksUrl && !titleLooksGeneric(fallback)) return fallback;
      return buildFallbackTitle(referenceUrl);
    }

    function queueVisibleTitleRefresh() {
      if (mode !== "items") return;
      if (!lpApi.runtime || !lpApi.runtime.sendMessage) return;
      const source = visibleEntries.length ? visibleEntries : filtered;
      source.forEach((entry) => {
        if (!entry || !entry.needsTitleRefresh || !entry.id || !entry.url) return;
        const entryId = String(entry.id);
        if (titleRefreshTriedIds.has(entryId)) return;
        titleRefreshQueuedIds.add(entryId);
      });
      drainTitleRefreshQueue();
    }

    function drainTitleRefreshQueue() {
      if (!lpApi.runtime || !lpApi.runtime.sendMessage) return;
      while (titleRefreshInFlightCount < TITLE_REFRESH_MAX_CONCURRENT && titleRefreshQueuedIds.size) {
        const next = titleRefreshQueuedIds.values().next();
        if (!next || next.done) return;
        const entryId = String(next.value);
        titleRefreshQueuedIds.delete(entryId);
        if (titleRefreshTriedIds.has(entryId)) continue;
        const item = itemById.get(entryId);
        const targetUrl = item && item.url ? String(item.url) : "";
        titleRefreshTriedIds.add(entryId);
        if (!targetUrl) continue;
        titleRefreshInFlightCount += 1;
        Promise.resolve(lpApi.runtime.sendMessage({
          type: "refresh-item-title",
          itemId: entryId,
          url: targetUrl,
          forceRemote: true
        }))
          .catch(() => null)
          .finally(() => {
            titleRefreshInFlightCount = Math.max(0, titleRefreshInFlightCount - 1);
            if (titleRefreshQueuedIds.size) {
              drainTitleRefreshQueue();
            }
          });
      }
    }

    function safeHostname(url) {
      try {
        return new URL(url).hostname.replace(/^www\\./, "");
      } catch (err) {
        return "";
      }
    }

    function buildCompactUrlText(url) {
      const raw = url ? String(url) : "";
      if (!raw) return "";
      try {
        const parsed = new URL(raw);
        const host = parsed.hostname.replace(/^www\\./, "");
        let path = parsed.pathname || "";
        if (path && path !== "/") {
          path = path.replace(/\\/{2,}/g, "/");
          if (path.endsWith("/")) {
            path = path.slice(0, -1);
          }
        } else {
          path = "";
        }
        const query = parsed.search ? parsed.search : "";
        const compactQuery = query.length > 26 ? query.slice(0, 26) + "..." : query;
        return (host + path + compactQuery) || raw;
      } catch (err) {
        return raw;
      }
    }

    function buildEntryMeta(siteName, url) {
      const compactUrl = buildCompactUrlText(url);
      const site = siteName ? String(siteName).trim() : "";
      if (site && compactUrl) {
        const normalizedSite = site.toLowerCase().replace(/^www\\./, "");
        const normalizedCompact = compactUrl.toLowerCase();
        if (normalizedCompact === normalizedSite
          || normalizedCompact.startsWith(normalizedSite + "/")
          || normalizedCompact.startsWith(normalizedSite + "?")) {
          return compactUrl;
        }
        return site + " • " + compactUrl;
      }
      return compactUrl || site;
    }

    function hueFromString(input) {
      let hash = 0;
      const text = input ? String(input) : "";
      for (let i = 0; i < text.length; i += 1) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
      }
      return Math.abs(hash) % 360;
    }

    function colorFromString(input) {
      const hue = hueFromString(input);
      return "hsl(" + hue + ", 55%, 45%)";
    }

    function getCategoryColorKey(categoryId) {
      const id = categoryId ? String(categoryId) : "";
      if (!id || id === "none") return "__uncategorized__";
      if (id === "hidden_none") return "__hidden_uncategorized__";
      if (id === "all") return "__all__";
      return id;
    }

    function getDropChipPalette(targetId, hueOverride, variantIndex) {
      const normalizedTargetId = targetId ? String(targetId) : "";
      const colorKey = getCategoryColorKey(normalizedTargetId);
      const rawHue = Number.isFinite(hueOverride) ? Number(hueOverride) : hueFromString(colorKey);
      const hue = ((Math.round(rawHue) % 360) + 360) % 360;
      const baseSaturation = colorKey === "__uncategorized__" || colorKey === "__hidden_uncategorized__"
        ? 42
        : (colorKey === "__all__" ? 52 : 74);
      const variant = Number.isFinite(variantIndex) ? Math.max(0, Math.round(variantIndex)) : 0;
      const satShiftPattern = [-10, -4, 0, 6, 12, -7, 3];
      const lightShiftPattern = [-5, -2, 0, 3, 5, -3, 2];
      const satShift = satShiftPattern[variant % satShiftPattern.length];
      const lightShift = lightShiftPattern[variant % lightShiftPattern.length];
      const saturation = Math.max(34, Math.min(90, baseSaturation + satShift));
      const hotSaturation = Math.min(96, saturation + 12);
      const idleLight = Math.max(48, Math.min(67, 58 + lightShift));
      const hotLight = Math.max(52, Math.min(71, 62 + lightShift));
      const idleInkSaturation = Math.max(72, Math.min(100, saturation + 24));
      return {
        idleBorder: "hsla(" + hue + ", " + saturation + "%, 68%, 0.64)",
        idleBackground: "hsla(" + hue + ", " + saturation + "%, " + idleLight + "%, 0.20)",
        idleColor: "hsl(" + hue + ", " + idleInkSaturation + "%, 92%)",
        hotBorder: "hsla(" + hue + ", " + hotSaturation + "%, 72%, 0.98)",
        hotBackground: "hsla(" + hue + ", " + hotSaturation + "%, " + hotLight + "%, 0.34)",
        hotColor: "#fff"
      };
    }

    function getCategoryRowPalette(categoryId, hueOverride) {
      const colorKey = getCategoryColorKey(categoryId);
      const rawHue = Number.isFinite(hueOverride) ? Number(hueOverride) : hueFromString(colorKey);
      const hue = ((Math.round(rawHue) % 360) + 360) % 360;
      const saturation = colorKey === "__uncategorized__" || colorKey === "__hidden_uncategorized__"
        ? 36
        : (colorKey === "__all__" ? 46 : 68);
      const strongSaturation = Math.min(90, saturation + 12);
      return {
        rowBorder: "hsla(" + hue + ", " + saturation + "%, 64%, 0.34)",
        rowBackground: "hsla(" + hue + ", " + saturation + "%, 56%, 0.14)",
        dot: "hsl(" + hue + ", " + strongSaturation + "%, 70%)",
        dotRing: "hsla(" + hue + ", " + strongSaturation + "%, 64%, 0.48)",
        countBorder: "hsla(" + hue + ", " + strongSaturation + "%, 70%, 0.58)",
        countBackground: "hsla(" + hue + ", " + strongSaturation + "%, 62%, 0.27)",
        countColor: "#fff"
      };
    }

    function applyCategorySelectTone(select, categoryId) {
      if (!select) return;
      const colorKey = getCategoryColorKey(categoryId);
      if (colorKey === "__uncategorized__" || colorKey === "__hidden_uncategorized__") {
        select.style.border = "1px solid rgba(0, 0, 0, 0.2)";
        select.style.background = "rgba(255, 255, 255, 0.92)";
        select.style.color = "#111";
        return;
      }
      const hue = hueFromString(colorKey);
      select.style.border = "1px solid hsla(" + hue + ", 58%, 44%, 0.48)";
      select.style.background = "hsla(" + hue + ", 74%, 95%, 0.98)";
      select.style.color = "hsl(" + hue + ", 52%, 24%)";
    }

    function applyDropChipStyle(chip, palette, active) {
      if (!chip || !palette) return;
      const useHot = !!active;
      chip.style.border = useHot
        ? "1px solid " + palette.hotBorder
        : "1px solid " + palette.idleBorder;
      chip.style.background = useHot
        ? palette.hotBackground
        : palette.idleBackground;
      chip.style.color = useHot ? palette.hotColor : palette.idleColor;
    }

    function makeBadgeText(host) {
      if (!host) return "?";
      const parts = host.split(".").filter(Boolean);
      const main = parts[0] ? parts[0] : host;
      return main.slice(0, 1).toUpperCase();
    }

    function getFaviconFromCacheOrGuess(url) {
      try {
        const parsed = new URL(url);
        const domain = parsed.hostname;
        if (!domain) return "";
        
        // Check cache first
        if (faviconCache.has(domain)) {
          return faviconCache.get(domain);
        }
        
        // Use DuckDuckGo for fallback (faster than Google)
        const faviconUrl = "https://icons.duckduckgo.com/favicon.ico?domain=" + domain;
        
        // Store in cache with LRU-style limit
        if (faviconCache.size >= FAVICON_CACHE_MAX) {
          const firstKey = faviconCache.keys().next().value;
          faviconCache.delete(firstKey);
        }
        faviconCache.set(domain, faviconUrl);
        
        return faviconUrl;
      } catch (err) {
        return "";
      }
    }

    function guessFavicon(url) {
      return getFaviconFromCacheOrGuess(url);
    }

    function isYoutubeUrl(url) {
      if (!url) return false;
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (host === "youtu.be") return true;
        if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
          if (parsed.pathname.startsWith("/watch")) return !!parsed.searchParams.get("v");
          if (parsed.pathname.startsWith("/shorts/")) return true;
          if (parsed.pathname.startsWith("/live/")) return true;
        }
      } catch (err) {
        return false;
      }
      return false;
    }

    function extractYoutubeVideoIdForPicker(rawUrl) {
      if (!rawUrl) return "";
      try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.toLowerCase();
        let candidate = "";
        if (host === "youtu.be") {
          const shortSegments = parsed.pathname.split("/").filter(Boolean);
          candidate = shortSegments[0] || "";
        } else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
          if (parsed.pathname.startsWith("/watch")) {
            candidate = parsed.searchParams.get("v") || "";
          } else {
            const segments = parsed.pathname.split("/").filter(Boolean);
            if (segments[0] === "shorts" || segments[0] === "live" || segments[0] === "embed") {
              candidate = segments[1] || "";
            }
          }
        }
        const normalized = String(candidate || "").trim();
        if (!/^[A-Za-z0-9_-]{6,}$/.test(normalized)) return "";
        return normalized;
      } catch (err) {
        return "";
      }
    }

    function buildYoutubeThumbnailUrlForPicker(rawUrl) {
      const videoId = extractYoutubeVideoIdForPicker(rawUrl);
      if (!videoId) return "";
      return "https://i.ytimg.com/vi/" + encodeURIComponent(videoId) + "/mqdefault.jpg";
    }

    function projectItems(list) {
      if (!Array.isArray(list)) return [];
      return list.map((item) => ({
        id: item && item.id ? item.id : "",
        url: item && item.url ? item.url : "",
        title: item && item.title ? item.title : "",
        siteName: item && item.siteName ? item.siteName : "",
        categoryId: item && item.categoryId ? item.categoryId : "",
        savedAt: item && item.savedAt ? item.savedAt : "",
        favorite: !!(item && item.favorite),
        faviconUrl: item && item.faviconUrl ? item.faviconUrl : "",
        thumbnailUrl: item && item.thumbnailUrl ? item.thumbnailUrl : "",
        youtubeThumbnailUrl: item && item.youtubeThumbnailUrl ? item.youtubeThumbnailUrl : "",
        manualOrder: item && typeof item === "object" ? item.manualOrder : null,
        favoriteOrder: item && typeof item === "object" ? item.favoriteOrder : null
      })).filter((item) => item.id && item.url);
    }

    function getManualOrderValue(item) {
      if (!item) return null;
      const raw = item.manualOrder;
      const value = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(value) ? value : null;
    }

    function getFavoriteOrderValue(item) {
      if (!item) return null;
      const raw = item.favoriteOrder;
      const value = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(value) ? value : null;
    }

    function sortItemsByManualOrder(list, fallbackDirection) {
      const safeList = Array.isArray(list) ? list.slice() : [];
      const fallbackDir = fallbackDirection === "asc" ? "asc" : "desc";
      return safeList.sort((a, b) => {
        const aOrder = getManualOrderValue(a);
        const bOrder = getManualOrderValue(b);
        if (aOrder !== null && bOrder !== null && aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        if (aOrder !== null && bOrder === null) return -1;
        if (aOrder === null && bOrder !== null) return 1;
        const aTime = a && a.savedAt ? Date.parse(a.savedAt) : 0;
        const bTime = b && b.savedAt ? Date.parse(b.savedAt) : 0;
        if (aTime !== bTime) {
          return fallbackDir === "asc" ? aTime - bTime : bTime - aTime;
        }
        const aId = a && a.id ? String(a.id) : "";
        const bId = b && b.id ? String(b.id) : "";
        return aId.localeCompare(bId);
      });
    }

    function sortItemsByFavoriteOrder(list, fallbackDirection) {
      const safeList = Array.isArray(list) ? list.slice() : [];
      const fallbackDir = fallbackDirection === "asc" ? "asc" : "desc";
      return safeList.sort((a, b) => {
        const aOrder = getFavoriteOrderValue(a);
        const bOrder = getFavoriteOrderValue(b);
        if (aOrder !== null && bOrder !== null && aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        if (aOrder !== null && bOrder === null) return -1;
        if (aOrder === null && bOrder !== null) return 1;
        const aTime = a && a.savedAt ? Date.parse(a.savedAt) : 0;
        const bTime = b && b.savedAt ? Date.parse(b.savedAt) : 0;
        if (aTime !== bTime) {
          return fallbackDir === "asc" ? aTime - bTime : bTime - aTime;
        }
        const aId = a && a.id ? String(a.id) : "";
        const bId = b && b.id ? String(b.id) : "";
        return aId.localeCompare(bId);
      });
    }

    function getStorageCategoryId(categoryId) {
      if (!categoryId || categoryId === "none" || categoryId === "hidden_none") return "";
      return String(categoryId);
    }

    function canManualReorder() {
      if (mode !== "items") return false;
      if (sortDir !== "manual") return false;
      if (activeCategoryId === "all" && itemFilter !== "fav") return false;
      if (input.value && input.value.trim()) return false;
      return true;
    }

    function getPageSize() {
      const raw = payload.pageSize ? Number(payload.pageSize) : NaN;
      const size = Number.isFinite(raw) ? raw : 20;
      return Math.min(80, Math.max(1, size));
    }

    function clampPage(nextPage, maxPage) {
      return Math.min(Math.max(nextPage, 1), Math.max(1, maxPage));
    }

    function normalizePickerLayout(value) {
      return String(value || "").toLowerCase() === "compact" ? "compact" : "cozy";
    }

    function normalizePickerCounts(value) {
      const source = value && typeof value === "object" ? value : {};
      const rawById = source.byId && typeof source.byId === "object" ? source.byId : {};
      const byId = {};
      Object.keys(rawById).forEach((key) => {
        const count = Number(rawById[key]);
        byId[String(key)] = Number.isFinite(count) ? Math.max(0, count) : 0;
      });
      const all = Number(source.all);
      const none = Number(source.none);
      const hiddenNone = Number(source.hiddenNone);
      return {
        all: Number.isFinite(all) ? Math.max(0, all) : 0,
        none: Number.isFinite(none) ? Math.max(0, none) : 0,
        hiddenNone: Number.isFinite(hiddenNone) ? Math.max(0, hiddenNone) : 0,
        byId,
      };
    }

    function getCurrentItemsScopeKey(categoryId = activeCategoryId, nextFilter = itemFilter) {
      const normalizedCategoryId = categoryId ? String(categoryId) : "none";
      const normalizedFilter = nextFilter === "fav" ? "fav" : "all";
      return normalizedCategoryId + "|" + normalizedFilter + "|" + String(showHiddenCategories || 0);
    }

    function normalizePickerLastLocation(value) {
      if (!value || typeof value !== "object") {
        return null;
      }
      const categoryId = value.categoryId ? String(value.categoryId) : "";
      if (!categoryId) {
        return null;
      }
      const pageNumber = Number.parseInt(value.page, 10);
      const modeValue = value.mode === "items" ? "items" : "categories";
      const itemFilterValue = value.itemFilter === "fav" ? "fav" : "all";
      const sortValue = ["manual", "asc", "desc"].includes(String(value.sortDir || "").toLowerCase())
        ? String(value.sortDir).toLowerCase()
        : "manual";
      const result = {
        mode: modeValue,
        categoryId,
        page: Number.isFinite(pageNumber) ? Math.max(1, pageNumber) : 1,
        itemId: value.itemId ? String(value.itemId) : "",
        url: value.url ? String(value.url) : "",
        itemFilter: itemFilterValue,
        sortDir: sortValue,
        lastOpenedItemId: value.lastOpenedItemId ? String(value.lastOpenedItemId) : "",
        lastOpenedAt: value.lastOpenedAt > 0 ? Number(value.lastOpenedAt) : 0,
      };
      return result;
    }

    function canRestoreCategoryLocation(location) {
      if (!location || !location.categoryId) return false;
      const categoryId = String(location.categoryId);
      if (categoryId === "all") return payload.includeAll !== false;
      if (categoryId === "none") return payload.includeUncategorized !== false && showHiddenCategories !== 2;
      if (categoryId === "hidden_none") return payload.includeUncategorized !== false && showHiddenCategories >= 1;
      const match = categories.find((cat) => cat && String(cat.id) === categoryId);
      if (!match) return false;
      if (showHiddenCategories === 2) return match.hidden === true;
      if (!showHiddenCategories) return match.hidden !== true;
      return true;
    }

    function getActivePickerLocationSnapshot() {
      if (mode !== "items") return null;
      if (input && typeof input.value === "string" && input.value.trim()) return null;
      const entry = visibleEntries.length ? visibleEntries[activeIndex] : null;
      return {
        mode: "items",
        categoryId: activeCategoryId ? String(activeCategoryId) : "none",
        page: Math.max(1, page || 1),
        itemId: entry && entry.id ? String(entry.id) : "",
        url: entry && entry.url ? String(entry.url) : "",
        itemFilter: itemFilter === "fav" ? "fav" : "all",
        sortDir: ["manual", "asc", "desc"].includes(String(sortDir || "").toLowerCase())
          ? String(sortDir).toLowerCase()
          : "manual",
        updatedAt: new Date().toISOString(),
        // Simpan lastOpenedItemId supaya highlight kekal apabila navigate balik ke page yang sama
        lastOpenedItemId: lastOpenedItemId || "",
        // Simpan masa link dibuka — untuk TTL check yang tepat
        lastOpenedAt: lastOpenedAt > 0 ? lastOpenedAt : 0,
      };
    }

    function persistPickerLastLocationNow(snapshot) {
      if (!snapshot || !lpApi.storage || !lpApi.storage.local) return;
      const fingerprint = [
        snapshot.mode,
        snapshot.categoryId,
        snapshot.page,
        snapshot.itemId,
        snapshot.url,
        snapshot.itemFilter,
        snapshot.sortDir,
        snapshot.lastOpenedItemId || "",
        snapshot.lastOpenedAt || 0,
      ].join("|");
      if (fingerprint === pickerLastLocationSaveFingerprint) return;
      pickerLastLocationSaveFingerprint = fingerprint;
      try {
        lpApi.storage.local.set({ [CATEGORY_PICKER_LAST_LOCATION_KEY]: snapshot });
      } catch (err) {
        // ignore
      }
    }

    function clearPickerLastLocation() {
      if (!lpApi.storage || !lpApi.storage.local) return;
      try {
        lpApi.storage.local.set({ [CATEGORY_PICKER_LAST_LOCATION_KEY]: null });
        pickerLastLocationSaveFingerprint = "";
      } catch (err) {}
    }

    function schedulePickerLastLocationSave() {
      if (!pickerStarted || !pickerLocationPersistenceReady) return;
      if (pickerLastLocationSaveTimer) {
        clearTimeout(pickerLastLocationSaveTimer);
      }
      pickerLastLocationSaveTimer = setTimeout(() => {
        pickerLastLocationSaveTimer = null;
        const snapshot = getActivePickerLocationSnapshot();
        if (!snapshot) return;
        persistPickerLastLocationNow(snapshot);
      }, 180);
    }

    function flushPickerLastLocationSave() {
      if (pickerLastLocationSaveTimer) {
        clearTimeout(pickerLastLocationSaveTimer);
        pickerLastLocationSaveTimer = null;
      }
      if (!pickerStarted || !pickerLocationPersistenceReady) return;
      persistPickerLastLocationNow(getActivePickerLocationSnapshot());
    }

    function enablePickerLocationPersistence() {
      if (pickerLocationPersistenceReady) return;
      pickerLocationPersistenceReady = true;
      schedulePickerLastLocationSave();
    }

    function applyPendingStartLocationIfReady() {
      if (!pendingStartLocation || mode !== "items" || itemsLoading) return false;
      const location = pendingStartLocation;
      pendingStartLocation = null;

      // TTL 24 jam untuk highlight — semak bila link sebenarnya dibuka (lastOpenedAt)
      // bukan bila snapshot dikemas kini (updatedAt yang berubah setiap navigate)
      const HIGHLIGHT_TTL_MS = 24 * 60 * 60 * 1000;
      const storedLastOpenedAt = location.lastOpenedAt ? Number(location.lastOpenedAt) : 0;
      const highlightAge = storedLastOpenedAt > 0 ? Date.now() - storedLastOpenedAt : Infinity;
      const isWithinTTL = highlightAge <= HIGHLIGHT_TTL_MS;
      const isLastLinkMode = pickerStartMode === "last-link" || pickerStartMode === "last_link";

      // Restore lastOpenedItemId dari storage jika dalam TTL — berlaku untuk semua mode
      // termasuk "home" supaya highlight rediscover berfungsi walau apa start mode sekalipun.
      if (isWithinTTL && location.lastOpenedItemId) {
        lastOpenedItemId = String(location.lastOpenedItemId);
        lastOpenedAt = storedLastOpenedAt;
      }

      // Utamakan page yang disimpan (bukan dikira dari posisi item) — supaya user
      // kembali ke page yang sama seperti kali terakhir picker digunakan.
      // Cari item dalam visibleEntries page tersebut untuk di-highlight.
      const searchItemId = (isLastLinkMode && isWithinTTL && location.lastOpenedItemId)
        ? String(location.lastOpenedItemId)
        : (location.itemId ? String(location.itemId) : "");
      const hasTarget = !!(searchItemId || location.url);

      // Step 1: Restore page dari saved location
      page = location.page || 1;
      buildVisibleEntries();

      // Step 2: Cari item dalam visibleEntries page tersebut
      let targetIndex = 0;
      if (searchItemId) {
        const visibleIndex = visibleEntries.findIndex((entry) => entry && String(entry.id || "") === searchItemId);
        if (visibleIndex >= 0) {
          targetIndex = visibleIndex;
        } else if (filtered.length > 0) {
          // Item tidak dijumpai di page tersimpan — cari dalam semua filtered items dan kira page betul
          const allIndex = filtered.findIndex((entry) => entry && String(entry.id || "") === searchItemId);
          if (allIndex >= 0) {
            const pageSize = getPageSize();
            const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
            page = clampPage(Math.floor(allIndex / pageSize) + 1, maxPage);
            buildVisibleEntries();
            const newVisibleIndex = visibleEntries.findIndex((entry) => entry && String(entry.id || "") === searchItemId);
            if (newVisibleIndex >= 0) {
              targetIndex = newVisibleIndex;
            }
          }
        }
      }
      if (targetIndex === 0 && location.url) {
        const urlIndex = visibleEntries.findIndex((entry) => entry && String(entry.url || "") === location.url);
        if (urlIndex >= 0) {
          targetIndex = urlIndex;
        }
      }
      setActiveIndex(targetIndex);
      if (hasTarget) {
        selectionActive = true;
      }

      if (hasTarget) {
        needsScrollToTop = false;
        // Set flag untuk scroll ke link terakhir selepas render
        if (isLastLinkMode && isWithinTTL && location.lastOpenedItemId) {
          pendingScrollToLastOpened = true;
        }
      }

      enablePickerLocationPersistence();
      return true;
    }

    function replaceLoadedItems(nextItems) {
      items.length = 0;
      const projected = projectItems(nextItems);
      items.push(...projected);
      itemsRevision += 1;
      dropBarVisualKey = "";
      rebuildItemIndexes();
    }

    function filterLoadedItemsFromAll(nextItems, categoryId = activeCategoryId, nextFilter = itemFilter) {
      const normalizedCategoryId = categoryId ? String(categoryId) : "none";
      let source = nextItems;
      
      // Filter based on global showHiddenCategories state
      if (showHiddenCategories === 2) {
        if (normalizedCategoryId === "hidden_none") {
          source = source.filter((item) => item && item.categoryId === "hidden_none");
        } else {
          source = source.filter((item) => {
            const itemCatId = item && item.categoryId ? String(item.categoryId) : "";
            if (itemCatId === "hidden_none") return true;
            return itemCatId && categoryIsHidden(itemCatId);
          });
        }
      } else if (showHiddenCategories === 0 || showHiddenCategories === false || typeof showHiddenCategories === "undefined") {
        source = source.filter((item) => {
          const itemCatId = item && item.categoryId ? String(item.categoryId) : "";
          if (itemCatId === "hidden_none") return false;
          return !itemCatId || !categoryIsHidden(itemCatId);
        });
      }

      if (normalizedCategoryId === "all") {
        // Done — keep all
      } else if (normalizedCategoryId === "hidden_all" || normalizedCategoryId === "all_hidden") {
        source = source.filter((item) => {
          const itemCatId = item && item.categoryId ? String(item.categoryId) : "";
          return itemCatId === "hidden_none" || categoryIsHidden(itemCatId);
        });
      } else if (normalizedCategoryId === "hidden_none") {
        source = source.filter((item) => item && item.categoryId === "hidden_none");
      } else if (!normalizedCategoryId || normalizedCategoryId === "none") {
        source = source.filter((item) => !item || !item.categoryId);
      } else {
        source = source.filter((item) => item && String(item.categoryId || "") === normalizedCategoryId);
      }

      if (nextFilter === "fav") {
        source = source.filter((item) => item && item.favorite === true);
      }
      return source;
    }

    function rebuildItemIndexes() {
      itemById.clear();
      items.forEach((item) => {
        if (!item || !item.id) return;
        itemById.set(String(item.id), item);
      });
      dragMoveInfoCacheKey = "";
      dragMoveInfoCacheRevision = -1;
      dragMoveInfoCache = null;
    }

    function rebuildHiddenCategoryIndexes() {
      hiddenCategoryIds.clear();
      categories.forEach((cat) => {
        if (!cat || !cat.id || !cat.hidden) return;
        hiddenCategoryIds.add(String(cat.id));
      });
    }

    function replaceItems(nextItems) {
      const allItems = projectItems(nextItems);
      allItemsCache = allItems;
      categoryCounts = buildCategoryCounts(allItems, categories, { showHiddenCategories });
      visibleFavoriteCount = allItems.reduce((count, item) => {
        if (!item || item.favorite !== true) return count;
        const isHidden = categoryIsHidden(item && item.categoryId ? item.categoryId : "");
        if (showHiddenCategories === 2) {
          if (!isHidden) return count;
        } else if (!showHiddenCategories && isHidden) {
          return count;
        }
        return count + 1;
      }, 0);
      currentSavedItemSummary = currentTabUrl
        ? (allItems.find((item) => item && item.url === currentTabUrl) || null)
        : null;
      loadedItemsScopeKey = getCurrentItemsScopeKey();
      replaceLoadedItems(filterLoadedItemsFromAll(allItems, activeCategoryId, itemFilter));
      // Kemaskini badge icon supaya count sentiasa tepat selepas sebarang perubahan item
      try {
        const maybe = lpApi.runtime && lpApi.runtime.sendMessage
          ? lpApi.runtime.sendMessage({ type: "request-badge" })
          : null;
        if (maybe && typeof maybe.catch === "function") maybe.catch(() => {});
      } catch (err) { /* ignore */ }
    }

    function replaceCategories(nextCategories) {
      categories.length = 0;
      hiddenCategoryIds.clear();
      dropBarTargetsKey = "";
      dropBarVisualKey = "";
      if (!Array.isArray(nextCategories)) return;
      nextCategories.forEach((cat) => {
        if (cat && cat.id) {
          const id = String(cat.id);
          const name = cat.name ? String(cat.name).trim() : "";
          const hidden = !!cat.hidden;
          const icon = cat.icon ? String(cat.icon) : "";
          categories.push({ id, name, hidden, icon });
          if (hidden) {
            hiddenCategoryIds.add(id);
          }
        }
      });
    }

    function applyIncomingPayload(data) {
      if (!data || typeof data !== "object") return;
      if (data.clearLoadedItems === true) {
        loadedItemsScopeKey = "";
        itemsLoading = false;
        replaceLoadedItems([]);
      }
      if (Array.isArray(data.items)) {
        if (typeof data.loadedItemsScopeKey === "string") {
          loadedItemsScopeKey = data.loadedItemsScopeKey;
        }
        itemsLoading = false;
        replaceLoadedItems(data.items);
      }
      if (Array.isArray(data.allItems)) {
        allItemsCache = data.allItems;
      }
      if (Array.isArray(data.categories)) {
        replaceCategories(data.categories);
      }
      if (data.counts && typeof data.counts === "object") {
        categoryCounts = normalizePickerCounts(data.counts);
      }
      if (typeof data.favoriteCountVisible !== "undefined") {
        const parsedFavoriteCount = Number(data.favoriteCountVisible);
        visibleFavoriteCount = Number.isFinite(parsedFavoriteCount)
          ? Math.max(0, parsedFavoriteCount)
          : 0;
      }
      if (data.currentItemSummary && typeof data.currentItemSummary === "object") {
        currentSavedItemSummary = projectItems([data.currentItemSummary])[0] || null;
      } else if (Object.prototype.hasOwnProperty.call(data, "currentItemSummary")) {
        currentSavedItemSummary = null;
      }
      if (typeof data.pickerAnimation === "string") {
        pickerAnimation = data.pickerAnimation.toLowerCase();
      }
      if (typeof data.pickerAnimationDuration === "number") {
        payload.pickerAnimationDuration = data.pickerAnimationDuration;
        pickerAnimationDuration = clampDuration(data.pickerAnimationDuration);
      }
      if (typeof data.pickerLayout !== "undefined") {
        pickerLayout = normalizePickerLayout(data.pickerLayout);
      }
      if (typeof data.pickerYoutubeThumbnails !== "undefined") {
        pickerYoutubeThumbnails = data.pickerYoutubeThumbnails !== false;
      }
      if (typeof data.showHiddenCategories !== "undefined") {
        showHiddenCategories = data.showHiddenCategories;
        if (showHiddenCategories === true) showHiddenCategories = 1;
        if (showHiddenCategories === false || typeof showHiddenCategories === "undefined") showHiddenCategories = 0;
      }
      if (typeof data.navigationFavoritesOnly !== "undefined") {
        navigationFavoritesOnly = data.navigationFavoritesOnly === true;
        itemFilter = navigationFavoritesOnly ? "fav" : "all";
      }
      if (typeof data.favoritesSortMode === "string") {
        const nextFavoritesSortMode = String(data.favoritesSortMode).trim().toLowerCase();
        favoriteSortMode = ["manual", "asc", "desc"].includes(nextFavoritesSortMode)
          ? nextFavoritesSortMode
          : "manual";
        if (itemFilter === "fav") {
          sortDir = favoriteSortMode;
        }
      }
      if (typeof data.hoverSoundEnabled !== "undefined") {
        hoverSoundEnabled = data.hoverSoundEnabled === true;
      }
      if (typeof data.hoverSoundUrl === "string") {
        const nextUrl = data.hoverSoundUrl.trim();
        const changed = hoverSoundUrl !== nextUrl;
        hoverSoundUrl = nextUrl;
        if (changed) {
          hoverSoundBuffer = null;
        }
      }
      if (typeof data.pageSize === "number") {
        payload.pageSize = data.pageSize;
      }
      if (typeof data.youtubeAutoNext !== "undefined") {
        youtubeAutoNext = data.youtubeAutoNext === true;
      }
      if (typeof data.youtubeAutoRandom !== "undefined") {
        youtubeAutoRandom = data.youtubeAutoRandom === true;
      }
      if (typeof data.deleteAfterOpen !== "undefined") {
        deleteAfterOpenActive = data.deleteAfterOpen === true;
      }
      if (typeof data.randomAcrossAllCategories !== "undefined") {
        randomAcrossAllCategories = data.randomAcrossAllCategories === true;
        if (typeof updateRandomAllBtn === "function") updateRandomAllBtn();
      }
      if (typeof data.enableDedupeButton !== "undefined") {
        enableDedupeButton = data.enableDedupeButton !== false;
        if (scanDupBtn) {
          scanDupBtn.style.display = enableDedupeButton ? "" : "none";
        }
      }
      if (Object.prototype.hasOwnProperty.call(data, "categoryPickerLastLocation")) {
        payload.categoryPickerLastLocation = data.categoryPickerLastLocation || null;
      }
      if (typeof data.sidebarAiProvider === "string") {
        sidebarAiProvider = normalizeSidebarAiProvider(data.sidebarAiProvider);
        if (sidebarAiSelect) {
          sidebarAiSelect.value = sidebarAiProvider;
          sidebarAiSelect.title = "Sidebar AI: " + getSidebarAiLabel(sidebarAiProvider);
        }
      }
      if (typeof data.pickerHighlightColor === "string" && /^#[0-9a-f]{6}$/i.test(data.pickerHighlightColor)) {
        pickerHighlightColor = data.pickerHighlightColor.toLowerCase();
      }
      if (typeof data.selected !== "undefined") {
        activeCategoryId = data.selected || "none";
      }
      if (typeof data.currentTabUrl === "string") {
        payload.currentTabUrl = data.currentTabUrl;
      }
      if (typeof data.currentTabTitle === "string") {
        payload.currentTabTitle = data.currentTabTitle;
      }
      // Kemaskini shortcut toggle picker supaya catch-all block sentiasa tahu shortcut terkini
      if (typeof data.pickerToggleSelfShortcut === "string") {
        pickerToggleSelfShortcut = data.pickerToggleSelfShortcut.trim();
      }
      // Propagate saved picker dimensions untuk restore
      if (typeof data.savedWidth !== "undefined") payload.savedWidth = data.savedWidth;
      if (typeof data.savedHeight !== "undefined") payload.savedHeight = data.savedHeight;
      if (typeof data.savedOpacity !== "undefined") payload.savedOpacity = data.savedOpacity;
      if (!currentSavedItemSummary && payload.currentTabUrl) {
        currentSavedItemSummary =
          items.find((item) => item && item.url === payload.currentTabUrl) || null;
      }
      sendFavoritesDebugLog("picker-payload-applied", {
        itemCount: items.length,
        favoriteCount: visibleFavoriteCount,
        itemFilter,
        sortDir,
        favoriteSortMode,
        activeCategoryId,
      });
      refreshDerived();
      // refreshDerived() sudah memanggil applyFilter() → render() secara dalaman.
      // Jangan panggil render() lagi di sini kerana ia akan berlaku selepas
      // selectionActive di-reset oleh render pertama, menyebabkan scroll position
      // dikunci semula ke posisi lama dan override scrollIntoView.
      if (mode === "items" && loadedItemsScopeKey !== getCurrentItemsScopeKey()) {
        try {
          ensureItemsLoadedForActiveScope({ force: true });
        } catch (err) {
          console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
        }
      }
    }

    function enableRowTransitionsAfterAnim() {
      const rowTransitionValue = "border 0.16s ease, box-shadow 0.16s ease, background 0.16s ease, transform 0.12s ease, opacity 0.12s ease";
      setTimeout(() => {
        const rows = list.querySelectorAll("[role='button']");
        for (let i = 0; i < rows.length; i++) {
          rows[i].style.transition = rowTransitionValue;
          if (!rows[i].style.boxShadow || rows[i].style.boxShadow === "none") {
            rows[i].style.boxShadow = "0 0 0 1px rgba(255, 255, 255, 0.03)";
          }
        }
      }, Math.max(pickerAnimationDuration + 80, 200));
    }

    function triggerInitialShow(payloadObj) {
      if (fallbackStartAnimTimer) {
        clearTimeout(fallbackStartAnimTimer);
        fallbackStartAnimTimer = null;
      }
      const wasInCategoriesMode = mode === "categories";
      applyIncomingPayload(payloadObj);

      // Restore SAIZ dahulu sebelum animation
      restorePickerSizeAndOpacity();

      // Jika masih dalam mod categories (kerana permulaan tadi gagal cari kategori terakhir),
      // cuba semak semula selepas data kategori sebenar sampai.
      if (wasInCategoriesMode && !lastQuery && !selectionActive) {
        startPicker();
      } else if (!restoredFromLastLocation && payload.categoryPickerLastLocation) {
        // Permulaan awal gagal sebab items/categories masih kosong pada masa itu.
        // Data kategori dan items sudah ada sekarang — cuba restore lokasi terakhir.
        startPicker();
      }

      if (!pickerAnimReady) {
        pickerAnimReady = true;
        applyPanelAnimation();
        enableRowTransitionsAfterAnim();
      }
    }

    let fallbackStartAnimTimer = setTimeout(() => {
      if (!pickerAnimReady) {
        pickerAnimReady = true;
        applyIncomingPayload(payload);
        restorePickerSizeAndOpacity();
        applyPanelAnimation();
        enableRowTransitionsAfterAnim();
      }
    }, 300); // Increase dari 150ms ke 300ms untuk beri masa response sampai

    // Restore size dan opacity dari payload
    function restorePickerSizeAndOpacity() {
      try {
        // Gunakan saved values dari payload jika ada
        if (payload && payload.savedWidth) {
          var w = parseInt(payload.savedWidth, 10);
          if (w >= MIN_PANEL_WIDTH && w <= window.innerWidth * 0.98) {
            panel.style.width = w + "px";
          }
        }
        if (payload && payload.savedHeight) {
          var h = parseInt(payload.savedHeight, 10);
          if (h >= PICKER_PANEL_MIN_HEIGHT_PX && h <= window.innerHeight * 0.92) {
            panel.style.height = h + "px";
          }
        }
        if (payload && payload.savedOpacity) {
          var op = parseInt(payload.savedOpacity, 10);
          if (op >= 20 && op <= 100) {
            pickerOpacity = op;
            applyPickerOpacity(pickerOpacity);
          }
        }
      } catch (_) {}
    }

    function requestFullPayload() {
      try {
        const maybe = lpApi.runtime && lpApi.runtime.sendMessage
          ? lpApi.runtime.sendMessage({ type: "category-picker-ready" })
          : null;
        if (maybe && typeof maybe.then === "function") {
          maybe.then((resp) => {
            if (resp && resp.payload) {
              triggerInitialShow(resp.payload);
            }
          }).catch(() => {});
        }
      } catch (err) {
        // ignore
      }
    }

    async function ensureItemsLoadedForActiveScope(options = {}) {
      if (mode !== "items") return false;
      const desiredScopeKey = getCurrentItemsScopeKey();
      if (!options.force && !itemsLoading && loadedItemsScopeKey === desiredScopeKey) {
        return true;
      }
      itemsLoadRequestId += 1;
      const requestId = itemsLoadRequestId;
      itemsLoading = true;
      loadedItemsScopeKey = "";
      replaceLoadedItems([]);
      refreshDerived();
      render();
      try {
        const maybe = lpApi.runtime && lpApi.runtime.sendMessage
          ? lpApi.runtime.sendMessage({
              type: "category-picker-load-items",
              categoryId: activeCategoryId,
              itemFilter,
              showHiddenCategories,
            })
          : null;
        const response = maybe && typeof maybe.then === "function"
          ? await maybe
          : null;
        if (requestId !== itemsLoadRequestId) {
          return false;
        }
        if (response && response.payload) {
          applyIncomingPayload(response.payload);
          // applyIncomingPayload sudah memanggil refreshDerived() dan render() sendiri,
          // jangan panggil refreshDerived() lagi kerana ia akan reset activeIndex ke 0
          // dan merosakkan scroll ke link terakhir dibuka.
          return true;
        }
        itemsLoading = false;
        flashHint("Gagal muatkan link.");
        render();
        enablePickerLocationPersistence();
        return false;
      } catch (err) {
        if (requestId !== itemsLoadRequestId) {
          return false;
        }
        itemsLoading = false;
        flashHint("Gagal muatkan link.");
        render();
        enablePickerLocationPersistence();
        return false;
      }
    }

    if (lpApi.runtime && lpApi.runtime.onMessage && lpApi.runtime.onMessage.addListener) {
      runtimeMessageHandler = (message) => {
        if (!message || message.type !== "category-picker-data") return;
        if (message.payload && typeof message.payload === "object") {
          triggerInitialShow(message.payload);
        }
      };
      lpApi.runtime.onMessage.addListener(runtimeMessageHandler);
    }

    // Defer network request until after opening animation to keep main thread free
    setTimeout(() => { requestFullPayload(); }, Math.max(pickerAnimationDuration + 60, 120));

    rebuildItemIndexes();
    rebuildHiddenCategoryIndexes();

    function buildCategoryCounts(list, cats, options = {}) {
      const showHidden = options.showHiddenCategories;
      const hiddenIds = cats === categories ? hiddenCategoryIds : (() => {
        const next = new Set();
        for (const cat of cats || []) {
          if (cat && cat.id && cat.hidden) {
            next.add(String(cat.id));
          }
        }
        return next;
      })();
      const counts = { all: 0, none: 0, hiddenNone: 0, hiddenAll: 0, byId: {} };
      for (const item of list || []) {
        if (!item) continue;
        const catId = item.categoryId ? String(item.categoryId) : "";

        if (!catId) {
          counts.none += 1;
          if (showHidden !== 2) {
            counts.all += 1;
          }
        } else if (catId === "hidden_none") {
          counts.hiddenNone += 1;
          counts.hiddenAll += 1;
          if (showHidden === 2 || showHidden === 1) {
            counts.all += 1;
          }
        } else {
          counts.byId[catId] = (counts.byId[catId] || 0) + 1;
          const isHidden = hiddenIds.has(String(catId));
          if (isHidden) {
            counts.hiddenAll += 1;
          }
          if (showHidden === 2) {
            if (isHidden) counts.all += 1;
          } else if (showHidden || !isHidden) {
            counts.all += 1;
          }
        }
      }
      for (const cat of cats || []) {
        if (!cat || !cat.id) continue;
        if (typeof counts.byId[cat.id] !== "number") {
          counts.byId[cat.id] = 0;
        }
      }
      return counts;
    }

    function buildCategoryEntries() {
      const counts = categoryCounts;
      const entries = [];
      const savedCurrentItem = currentSavedItemSummary;
      if (savedCurrentItem) {
        const displayTitle = pickReadableTitle(savedCurrentItem.title, currentTabTitle, savedCurrentItem.url);
        const hostLabel = savedCurrentItem.siteName
          ? savedCurrentItem.siteName
          : safeHostname(savedCurrentItem.url);
        const metaLabel = hostLabel ? "Current tab · " + hostLabel : "Current tab";
        entries.push({
          id: savedCurrentItem.id || "__current_tab__",
          label: displayTitle,
          meta: metaLabel,
          url: savedCurrentItem.url,
          type: "current",
          favorite: !!savedCurrentItem.favorite,
          categoryId: savedCurrentItem.categoryId ? savedCurrentItem.categoryId : "",
          faviconUrl: savedCurrentItem.faviconUrl ? savedCurrentItem.faviconUrl : "",
          searchText: normalize(displayTitle + " " + metaLabel + " " + (savedCurrentItem.url || ""))
        });
      }
      if (payload.includeAll) {
        if (showHiddenCategories === 2) {
          entries.push({
            id: "all",
            label: "All categories (hidden)",
            count: counts.all,
            searchText: normalize("All categories hidden")
          });
        } else {
          entries.push({
            id: "all",
            label: "All categories",
            count: counts.all,
            searchText: normalize("All categories")
          });
        }
      }
      if (payload.includeUncategorized && showHiddenCategories !== 2) {
        entries.push({
          id: "none",
          label: "Uncategorized",
          count: counts.none,
          searchText: normalize("Uncategorized")
        });
      }
      if (payload.includeUncategorized && showHiddenCategories >= 1) {
        entries.push({
          id: "hidden_none",
          label: "Uncategorize (hidden)",
          count: counts.hiddenNone,
          searchText: normalize("Uncategorize (hidden)")
        });
      }
      const visibleCategories = categories.slice().sort((a, b) => {
        const aName = a && a.name ? a.name : "";
        const bName = b && b.name ? b.name : "";
        return aName.localeCompare(bName, undefined, { sensitivity: "base" });
      }).filter((cat) => {
        if (!cat || !cat.id) return false;
        if (showHiddenCategories === 2) {
          return cat.hidden === true;
        }
        return !cat.hidden || showHiddenCategories;
      });
      for (const cat of visibleCategories) {
        const rawName = cat.name ? String(cat.name).trim() : "";
        const displayName = rawName ? rawName : "(untitled)";
        const label = cat.hidden ? displayName + " (hidden)" : displayName;
        entries.push({
          id: cat.id,
          label,
          count: typeof counts.byId[cat.id] === "number" ? counts.byId[cat.id] : 0,
          searchText: normalize(label)
        });
      }
      const visibleCategoryEntries = entries.filter((entry) => entry.type !== "current");
      const hasActive = visibleCategoryEntries.some((entry) => entry.id === activeCategoryId);
      if (!hasActive && visibleCategoryEntries.length) {
        activeCategoryId = visibleCategoryEntries[0].id;
      }
      return entries;
    }

    function refreshCategoryEntries() {
      categoryEntries = buildCategoryEntries();
    }

    function getCategoryLabel(categoryId) {
      if (!categoryId || categoryId === "none") return "Uncategorized";
      if (categoryId === "hidden_none") return "Uncategorize (hidden)";
      if (categoryId === "all" && showHiddenCategories === 2) return "All categories (hidden)";
      if (categoryId === "all") return "All categories";
      if (categoryId === "hidden_all" || categoryId === "all_hidden") return "All categories (hidden)";
      const match = categories.find((cat) => cat && cat.id === categoryId);
      return match && match.name ? match.name : "Category";
    }

    function categoryIsHidden(categoryId) {
      if (!categoryId) return false;
      if (String(categoryId) === "hidden_none") return true;
      return hiddenCategoryIds.has(String(categoryId));
    }

    function getItemsForCategory(categoryId) {
      return Array.isArray(items) ? items.slice() : [];
    }

    function sortItems(list) {
      const inAll = activeCategoryId === "all";
      const hasManualOrder = !inAll && list.some((item) => getManualOrderValue(item) !== null);
      if (itemFilter === "fav" && inAll) {
        if (sortDir === "manual") {
          return sortItemsByFavoriteOrder(list, "desc");
        }
        // Pre-compute timestamps untuk elak Date.parse dalam setiap comparison
        const withTime = list.map((item) => ({
          item,
          t: item && item.savedAt ? Date.parse(item.savedAt) : 0
        }));
        withTime.sort((a, b) => sortDir === "asc" ? a.t - b.t : b.t - a.t);
        return withTime.map((x) => x.item);
      }
      if (!inAll || sortDir === "manual" || hasManualOrder) {
        if (!inAll) {
          return sortItemsByManualOrder(list, "desc");
        }
      }
      // Pre-compute timestamps untuk elak Date.parse dalam setiap comparison
      const withTime = list.map((item) => ({
        item,
        t: item && item.savedAt ? Date.parse(item.savedAt) : 0
      }));
      withTime.sort((a, b) => sortDir === "asc" ? a.t - b.t : b.t - a.t);
      return withTime.map((x) => x.item);
    }

    function applyItemFilters(list) {
      let next = list.slice();
      if (itemFilter === "fav") {
        next = next.filter((item) => item && item.favorite);
      }
      return sortItems(next);
    }

    function formatSavedDate(savedAt) {
      if (!savedAt) return "";
      try {
        const d = new Date(savedAt);
        if (isNaN(d.getTime())) return "";
        const now = new Date();
        const diffMs = now - d;
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return diffDays + " days ago";
        const opts = { month: "short", day: "numeric" };
        if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
        return d.toLocaleDateString(undefined, opts);
      } catch (e) {
        return "";
      }
    }

    function buildItemEntries(categoryId) {
      const listItems = applyItemFilters(getItemsForCategory(categoryId));
      return listItems.map((item) => {
        const rawTitle = item && item.title ? String(item.title) : "";
        const normalizedRawTitle = normalizeTitleText(rawTitle);
        const hasReadableStoredTitle = normalizedRawTitle
          && !titleLooksLikeUrl(normalizedRawTitle, item.url)
          && !titleLooksGeneric(normalizedRawTitle);
        const fallbackTitle = currentTabUrl && item.url === currentTabUrl
          ? currentTabTitle
          : "";
        const label = pickReadableTitle(rawTitle, fallbackTitle, item.url) || "Untitled";
        const needsTitleRefresh = isYoutubeUrl(item.url) && !hasReadableStoredTitle;
        const meta = buildEntryMeta(item.siteName, item.url);
        const genericThumbnail = item.thumbnailUrl ? String(item.thumbnailUrl) : "";
        const ytThumbnail = item.youtubeThumbnailUrl
          ? String(item.youtubeThumbnailUrl)
          : buildYoutubeThumbnailUrlForPicker(item.url);
        return {
          id: item.id,
          label,
          url: item.url,
          meta,
          favorite: !!item.favorite,
          categoryId: item.categoryId ? item.categoryId : "",
          faviconUrl: item.faviconUrl ? item.faviconUrl : "",
          pickerThumbnailUrl: genericThumbnail || ytThumbnail,
          youtubeThumbnailUrl: ytThumbnail,
          savedAtFormatted: formatSavedDate(item.savedAt),
          readingTime: (item.readingTime && item.readingTime > 0) ? Number(item.readingTime) : 0,
          wordCount: (item.wordCount && item.wordCount > 0) ? Number(item.wordCount) : 0,
          manualOrder: getManualOrderValue(item),
          _isCurrent: currentTabUrl && item.url === currentTabUrl,
          needsTitleRefresh,
          searchText: normalize(label + " " + meta + " " + (item.url || ""))
        };
      });
    }

    function filterItemEntriesByCurrentQuery(entries) {
      const source = Array.isArray(entries) ? entries : [];
      const query = normalize(input && typeof input.value === "string" ? input.value.trim() : "");
      if (!query) return source.slice();
      return source.filter((entry) => {
        const searchText = entry && typeof entry.searchText === "string"
          ? entry.searchText
          : normalize(
            (entry && entry.label ? entry.label : "")
            + " "
            + (entry && entry.meta ? entry.meta : "")
            + " "
            + (entry && entry.url ? entry.url : "")
          );
        return searchText.includes(query);
      });
    }

    function getClearFavoriteEntries() {
      if (mode !== "items" || itemFilter !== "fav") return [];
      return filterItemEntriesByCurrentQuery(itemEntries).filter((entry) => {
        return entry && entry.id && entry.favorite === true;
      });
    }

    function getRestorableFavoriteIds() {
      if (!Array.isArray(pendingFavoriteRestoreIds) || !pendingFavoriteRestoreIds.length) {
        return [];
      }
      const seen = new Set();
      const result = [];
      pendingFavoriteRestoreIds.forEach((id) => {
        const normalizedId = id ? String(id) : "";
        if (!normalizedId || seen.has(normalizedId)) return;
        seen.add(normalizedId);
        result.push(normalizedId);
      });
      return result;
    }

    function populateCategorySelect(select, selectedId) {
      select.innerHTML = "";
      if (showHiddenCategories !== 2) {
        const noneOpt = document.createElement("option");
        noneOpt.value = "";
        noneOpt.textContent = "No category";
        noneOpt.style.color = "#111";
        noneOpt.style.background = "#fff";
        select.appendChild(noneOpt);
      }

      if (showHiddenCategories >= 1) {
        const hiddenNoneOpt = document.createElement("option");
        hiddenNoneOpt.value = "hidden_none";
        hiddenNoneOpt.textContent = "Uncategorize (hidden)";
        hiddenNoneOpt.style.color = "#111";
        hiddenNoneOpt.style.background = "#fff";
        select.appendChild(hiddenNoneOpt);
      }

      const sorted = categories.slice().sort((a, b) => {
        const aName = a && a.name ? a.name : "";
        const bName = b && b.name ? b.name : "";
        return aName.localeCompare(bName, undefined, { sensitivity: "base" });
      });
      sorted.forEach((cat) => {
        if (!cat || !cat.id) return;
        if (showHiddenCategories === 2) {
          if (!cat.hidden && cat.id !== selectedId) return;
        } else if (!showHiddenCategories && cat.hidden && cat.id !== selectedId) {
          return;
        }
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.textContent = cat.name ? cat.name : "(untitled)";
        if (cat.hidden) {
          opt.textContent += " (hidden)";
        }
        opt.style.color = "#111";
        opt.style.background = "#fff";
        select.appendChild(opt);
      });
      select.value = selectedId || "";
    }

    function styleCategorySelect(select) {
      select.style.padding = "4px 8px";
      select.style.borderRadius = "8px";
      select.style.border = "1px solid rgba(0, 0, 0, 0.2)";
      select.style.background = "rgba(255, 255, 255, 0.92)";
      select.style.color = "#111";
      select.style.fontSize = "12px";
      select.style.maxWidth = "160px";
      select.style.cursor = "pointer";
      select.style.transition = "border 120ms ease, background 120ms ease, color 120ms ease";
    }

    function styleActionButton(button, variant) {
      button.style.width = "28px";
      button.style.height = "28px";
      button.style.borderRadius = "8px";
      button.style.border = theme.border;
      button.style.cursor = "pointer";
      button.style.fontSize = "14px";
      button.style.lineHeight = "1";
      button.style.padding = "0";
      button.style.boxShadow = "none";
      if (variant === "danger") {
        button.style.background = "rgba(232, 76, 79, 0.18)";
        button.style.color = "#ffb3b5";
        return;
      }
      if (variant === "active") {
        button.style.background = theme.chipBg;
        button.style.color = theme.text;
        return;
      }
      if (variant === "favorite") {
        button.style.background = "rgba(255, 210, 74, 0.16)";
        button.style.border = "1px solid rgba(255, 210, 74, 0.4)";
        button.style.color = "#ffd24a";
        button.style.boxShadow = "inset 0 0 0 1px rgba(255, 210, 74, 0.08)";
        return;
      }
      button.style.background = theme.inputBg;
      button.style.color = theme.text;
    }

    function styleTopButton(button, variant) {
      styleActionButton(button, variant);
      button.style.width = "auto";
      button.style.height = "28px";
      button.style.padding = "4px 10px";
      button.style.fontSize = "12px";
    }

    function styleFavoritesToggleButton(button, active) {
      if (!button) return;
      styleTopButton(button, active ? "active" : "default");
      button.style.fontWeight = "600";
      button.style.minWidth = "28px";
      button.style.padding = "4px 6px";
      if (active) {
        button.style.background = "rgba(255, 210, 74, 0.16)";
        button.style.border = "1px solid rgba(255, 210, 74, 0.48)";
        button.style.color = "#ffd24a";
        button.style.boxShadow = "inset 0 0 0 1px rgba(255, 210, 74, 0.08)";
        return;
      }
      button.style.background = theme.inputBg;
      button.style.border = theme.border;
      button.style.color = "#ffffff";
      button.style.boxShadow = "none";
    }

    function renderFallbackEntryBadge(badge, entry) {
      if (!badge) return;
      
      // Clear all previous content and styles
      while (badge.firstChild) {
        badge.removeChild(badge.firstChild);
      }
      
      const iconUrl = entry && entry.faviconUrl ? entry.faviconUrl : guessFavicon(entry && entry.url ? entry.url : "");
      const host = safeHostname(entry && entry.url ? entry.url : "");
      const entryUrl = entry && entry.url ? entry.url : "";
      const itemId = entry && entry.id ? entry.id : "";
      
      // Reset all styles
      badge.style.cssText = "";
      badge.style.width = "28px";
      badge.style.height = "28px";
      badge.style.borderRadius = "8px";
      badge.style.background = "rgba(255, 255, 255, 0.15)";
      badge.style.border = "2px solid yellow";
      badge.style.cursor = "pointer";
      badge.style.transition = "all 0.2s ease";
      badge.style.display = "flex";
      badge.style.alignItems = "center";
      badge.style.justifyContent = "center";
      badge.style.pointerEvents = "auto";
      badge.style.zIndex = "9999";
      
      // Klik pada fallback badge → buka image picker panel
      try {
        badge.style.cursor = "pointer";
        badge.onclick = (e) => {
          e.stopPropagation();
          openImagePickerPanel(badge, entry);
        };
      } catch (e) {
        // ignore event attach error
      }
      
      if (iconUrl) {
        const img = document.createElement("img");
        img.src = iconUrl;
        img.alt = "";
        img.style.width = "18px";
        img.style.height = "18px";
        img.style.borderRadius = "4px";
        img.style.pointerEvents = "auto"; // Enable pointer events for hover
        img.style.transition = "transform 0.2s ease";

        let hoverTimer = null;
        img.addEventListener("mouseenter", (e) => {
          img.style.transform = "scale(1.15)";
          
          // Clear any existing timer
          if (hoverTimer) clearTimeout(hoverTimer);
          
          // Set a delay of 650ms before refreshing to avoid accidental triggers
          hoverTimer = setTimeout(async () => {
            if (!itemId || !entryUrl) return;
            try {
              flashHint("Refetching thumbnail...");
              await lpApi.runtime.sendMessage({
                type: "fetch-thumbnail-on-demand",
                itemId: itemId,
                url: entryUrl,
                force: true,
              });
              // Refresh the UI to show the new thumbnail if found
              try {
                await ensureItemsLoadedForActiveScope({ force: true });
              } catch (err) {
                console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
              }
            } catch (err) {
              // ignore
            }
          }, 650);
        });

        img.addEventListener("mouseleave", (e) => {
          img.style.transform = "scale(1)";
          if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
          }
        });

        img.onerror = () => {
          img.remove();
          badge.textContent = makeBadgeText(host);
          badge.style.background = colorFromString(host || (entry && entry.url ? entry.url : "") || "local");
          badge.style.color = "#fff";
          badge.style.fontSize = "12px";
          badge.style.fontWeight = "600";
        };
        badge.appendChild(img);
        return;
      }
      badge.textContent = makeBadgeText(host);
      badge.style.background = colorFromString(host || (entry && entry.url ? entry.url : "") || "local");
      badge.style.color = "#fff";
      badge.style.fontSize = "12px";
      badge.style.fontWeight = "600";
    }

    function renderItemEntryBadge(badge, entry) {
      if (!badge) return;
      if (!pickerYoutubeThumbnails) {
        renderFallbackEntryBadge(badge, entry);
        return;
      }
      const originalThumbnailUrl = entry && entry.pickerThumbnailUrl ? String(entry.pickerThumbnailUrl) : "";
      if (!originalThumbnailUrl) {
        renderFallbackEntryBadge(badge, entry);
        return;
      }
      // Only upgrade TikTok thumbnails when rendering!
      let thumbnailUrl = originalThumbnailUrl;
      if (entry && entry.url) {
        try {
          const host = new URL(entry.url).hostname.replace(/^www\./, "");
          const isTikTok = /tiktok\.com/i.test(host);
          if (isTikTok) {
            thumbnailUrl = upgradeSocialThumbnailUrl(thumbnailUrl, entry.url);
          }
        } catch(e) {}
      }
      badge.textContent = "";
      badge.style.width = "56px";
      badge.style.height = "32px";
      badge.style.borderRadius = "8px";
      badge.style.background = "rgba(0, 0, 0, 0.42)";
      badge.style.border = "1px solid rgba(255, 255, 255, 0.08)";
      const img = document.createElement("img");
      img.src = thumbnailUrl;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.crossOrigin = "anonymous";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.display = "block";
      img.style.cursor = "pointer";
      
      img.addEventListener("mouseenter", (e) => {
        showEnlargedThumbnail(thumbnailUrl, e);
      });
      img.addEventListener("mouseleave", () => {
        hideEnlargedThumbnail();
      });

      // Klik pada thumbnail → buka image picker panel
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        hideEnlargedThumbnail();
        openImagePickerPanel(badge, entry);
      });

      img.addEventListener("error", () => {
        // If upgraded URL fails, try original URL first before falling back
        if (thumbnailUrl !== originalThumbnailUrl) {
          img.src = originalThumbnailUrl;
        } else {
          img.remove();
          renderFallbackEntryBadge(badge, entry);
        }
      });
      badge.appendChild(img);

      const isYoutube = !!(entry && entry.youtubeThumbnailUrl);
      if (isYoutube) {
        const playBadge = document.createElement("span");
        playBadge.textContent = "▶";
        playBadge.style.position = "absolute";
        playBadge.style.right = "4px";
        playBadge.style.bottom = "3px";
        playBadge.style.padding = "1px 4px";
        playBadge.style.borderRadius = "999px";
        playBadge.style.background = "rgba(0, 0, 0, 0.72)";
        playBadge.style.color = "#fff";
        playBadge.style.fontSize = "9px";
        playBadge.style.lineHeight = "1.2";
        playBadge.style.pointerEvents = "none";
        badge.appendChild(playBadge);
      }
    }

    async function quickExportBackup() {
      try {
        if (hint) hint.textContent = "Exporting backup...";
        const isPromiseApi = typeof browser !== "undefined" && lpApi === browser;
        if (!lpApi.runtime || !lpApi.runtime.sendMessage) {
          throw new Error("runtime unavailable");
        }
        const response = isPromiseApi
          ? await lpApi.runtime.sendMessage({ type: "build-backup" })
          : await new Promise((resolve, reject) => {
              try {
                lpApi.runtime.sendMessage({ type: "build-backup" }, (resp) => {
                  if (lpApi.runtime && lpApi.runtime.lastError) {
                    reject(new Error(lpApi.runtime.lastError.message || "sendMessage failed"));
                    return;
                  }
                  resolve(resp);
                });
              } catch (err) {
                reject(err);
              }
            });
        if (!response || !response.ok || !response.payload) {
          throw new Error(response && response.error ? response.error : "Unable to build backup");
        }
        const json = JSON.stringify(response.payload, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        a.href = url;
        a.download = "local-pocket-backup-" + stamp + ".json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        if (hint) hint.textContent = "Exported backup.";
      } catch (err) {
        if (hint) hint.textContent = "Export failed.";
      }
    }

    async function quickImportBackup(text) {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") throw new Error("invalid");
      const isPromiseApi = typeof browser !== "undefined" && lpApi === browser;
      const response = isPromiseApi
        ? await lpApi.runtime.sendMessage({ type: "restore-backup", payload: parsed })
        : await new Promise((resolve, reject) => {
            try {
              lpApi.runtime.sendMessage({ type: "restore-backup", payload: parsed }, (resp) => {
                if (lpApi.runtime && lpApi.runtime.lastError) {
                  reject(new Error(lpApi.runtime.lastError.message || "sendMessage failed"));
                  return;
                }
                resolve(resp);
              });
            } catch (err) {
              reject(err);
            }
          });
      if (!response || !response.ok) {
        throw new Error(response && response.error ? response.error : "Import failed");
      }
      const nextSettings = parsed.settings && typeof parsed.settings === "object" ? parsed.settings : null;
      const parsedPickerAnimDuration = nextSettings ? Number(nextSettings.pickerAnimationDuration) : NaN;
      const parsedPageSize = nextSettings ? Number(nextSettings.pageSize) : NaN;
      applyIncomingPayload({
        items: coerceArray(parsed.items),
        categories: coerceArray(parsed.categories),
        selected: parsed.selectedCategory ? String(parsed.selectedCategory) : (parsed.selected ? String(parsed.selected) : "none"),
        showHiddenCategories: nextSettings && nextSettings.showHiddenCategories,
        pickerAnimation: nextSettings && nextSettings.pickerAnimation,
        pickerAnimationDuration: Number.isFinite(parsedPickerAnimDuration) ? parsedPickerAnimDuration : undefined,
        pageSize: Number.isFinite(parsedPageSize) ? parsedPageSize : undefined,
        navigationFavoritesOnly: nextSettings && nextSettings.navigationFavoritesOnly,
        youtubeAutoNext: nextSettings && nextSettings.youtubeAutoNext,
        youtubeAutoRandom: nextSettings && nextSettings.youtubeAutoRandom,
        deleteAfterOpen: nextSettings && nextSettings.deleteAfterOpen
      });
      if (hint) {
        const count = response.result && response.result.counts ? response.result.counts.items : coerceArray(parsed.items).length;
        const noteCount = response.result && response.result.counts
          ? Number(response.result.counts.notes || 0)
          : 0;
        const noteSuffix = noteCount > 0 ? ", " + noteCount + " notes" : "";
        hint.textContent = "Import completed (" + count + " items" + noteSuffix + ").";
      }
    }

    function setCategoryContextMenuButtonState(button, enabled) {
      if (!button) return;
      const canUse = enabled !== false;
      button.disabled = !canUse;
      button.style.opacity = canUse ? "1" : "0.45";
      button.style.cursor = canUse ? "pointer" : "not-allowed";
    }

    function isRenamableCategoryId(categoryId) {
      const id = categoryId ? String(categoryId) : "";
      return !!id && id !== "all" && id !== "none" && id !== "hidden_none";
    }

    function isHideableCategoryId(categoryId) {
      const id = categoryId ? String(categoryId) : "";
      return !!id && id !== "all" && id !== "none" && id !== "hidden_none";
    }

    function isDeletableCategoryId(categoryId) {
      const id = categoryId ? String(categoryId) : "";
      return !!id && id !== "all";
    }

    function closeCategoryContextMenu() {
      if (!categoryContextMenuState) return;
      categoryContextMenuState = null;
      categoryContextMenu.style.display = "none";
      categoryContextMenu.style.left = "-9999px";
      categoryContextMenu.style.top = "-9999px";
    }

    function closeItemImageContextMenu() {
      if (!itemImageContextMenuState) return;
      itemImageContextMenuState = null;
      itemImageContextMenu.style.display = "none";
      itemImageContextMenu.style.left = "-9999px";
      itemImageContextMenu.style.top = "-9999px";
    }

    function openItemImageContextMenu(event, entry) {
      if (!event || !entry) return;
      const itemId = entry.id ? String(entry.id) : "";
      if (!itemId) return;
      event.preventDefault();
      event.stopPropagation();
      closeCategoryContextMenu();
      closeItemImageContextMenu();

      itemImageContextMenuState = { itemId, entry };

      // Tunjuk domain sebagai label
      try {
        itemImageMenuLabel.textContent = new URL(entry.url || "").hostname.replace(/^www\./, "");
      } catch (e) {
        itemImageMenuLabel.textContent = entry.url || "";
      }

      // Tunjuk/sembunyi butang Clear berdasarkan sama ada thumbnail wujud
      const hasThumb = !!(entry.pickerThumbnailUrl || entry.thumbnailUrl);
      itemMenuClearThumbBtn.style.display = hasThumb ? "block" : "none";

      itemImageContextMenu.style.display = "flex";
      itemImageContextMenu.style.left = "0px";
      itemImageContextMenu.style.top = "0px";
      requestAnimationFrame(() => {
        if (!itemImageContextMenuState) return;
        const menuRect = itemImageContextMenu.getBoundingClientRect();
        const pad = 8;
        const clientX = Number.isFinite(event.clientX) ? event.clientX : 0;
        const clientY = Number.isFinite(event.clientY) ? event.clientY : 0;
        const maxLeft = Math.max(pad, window.innerWidth - menuRect.width - pad);
        const maxTop = Math.max(pad, window.innerHeight - menuRect.height - pad);
        const left = Math.min(Math.max(clientX, pad), maxLeft);
        const top = Math.min(Math.max(clientY, pad), maxTop);
        itemImageContextMenu.style.left = Math.round(left) + "px";
        itemImageContextMenu.style.top = Math.round(top) + "px";
      });
    }

    function openCategoryContextMenu(event, entry) {
      if (!event || !entry || mode !== "categories" || entry.type === "current") return;
      const categoryId = entry.id ? String(entry.id) : "";
      if (!categoryId) return;
      event.preventDefault();
      event.stopPropagation();
      if (categorySwipeDeleteOpenEl) {
        closeCategorySwipeDeleteOpen(true);
      }
      categoryContextMenuState = {
        categoryId,
        categoryLabel: entry.label ? String(entry.label) : ""
      };
      categoryMenuOpenBtn.textContent = categoryId === "all" ? "View all links" : "View links";
      const currentlyHidden = categoryIsHidden(categoryId);
      categoryMenuHideBtn.textContent = currentlyHidden ? "Unhide" : "Hide";
      categoryMenuRenameBtn.textContent = "Rename";
      categoryMenuDeleteBtn.textContent = categoryId === "none"
        ? "Delete uncategorized links"
        : (categoryId === "hidden_none" ? "Delete uncategorize (hidden) links" : "Delete category");
      setCategoryContextMenuButtonState(categoryMenuOpenBtn, true);
      setCategoryContextMenuButtonState(categoryMenuHideBtn, isHideableCategoryId(categoryId));
      setCategoryContextMenuButtonState(categoryMenuRenameBtn, isRenamableCategoryId(categoryId));
      setCategoryContextMenuButtonState(categoryMenuDeleteBtn, isDeletableCategoryId(categoryId));

      categoryContextMenu.style.display = "flex";
      categoryContextMenu.style.left = "0px";
      categoryContextMenu.style.top = "0px";
      requestAnimationFrame(() => {
        if (!categoryContextMenuState) return;
        const menuRect = categoryContextMenu.getBoundingClientRect();
        const pad = 8;
        const clientX = Number.isFinite(event.clientX) ? event.clientX : 0;
        const clientY = Number.isFinite(event.clientY) ? event.clientY : 0;
        const maxLeft = Math.max(pad, window.innerWidth - menuRect.width - pad);
        const maxTop = Math.max(pad, window.innerHeight - menuRect.height - pad);
        const left = Math.min(Math.max(clientX, pad), maxLeft);
        const top = Math.min(Math.max(clientY, pad), maxTop);
        categoryContextMenu.style.left = Math.round(left) + "px";
        categoryContextMenu.style.top = Math.round(top) + "px";
      });
    }

    function syncSelectedItemsWithCurrentCategory() {
      if (mode !== "items") {
        selectedItemIds.clear();
        return;
      }
      const categoryItems = getItemsForCategory(activeCategoryId);
      const allowedIds = new Set(categoryItems.map((item) => item && item.id ? item.id : "").filter(Boolean));
      for (const id of Array.from(selectedItemIds)) {
        if (!allowedIds.has(id)) {
          selectedItemIds.delete(id);
        }
      }
    }

    function getSelectedItemIdsForCurrentCategory() {
      syncSelectedItemsWithCurrentCategory();
      return Array.from(selectedItemIds);
    }

    function getVisibleSelectableIds() {
      if (mode !== "items") return [];
      const source = visibleEntries.length ? visibleEntries : filtered;
      return source.filter((entry) => entry && entry.id && entry.url).map((entry) => entry.id);
    }

    function areAllVisibleItemsSelected() {
      const ids = getVisibleSelectableIds();
      if (!ids.length) return false;
      return ids.every((id) => selectedItemIds.has(id));
    }

    function setItemSelected(id, selected) {
      if (!id) return;
      if (selected) {
        selectedItemIds.add(id);
      } else {
        selectedItemIds.delete(id);
      }
      updateToolbar();
    }

    function clearSelectedItems(options = {}) {
      const silent = options.silent === true;
      const skipRender = options.skipRender === true;
      if (!selectedItemIds.size) return;
      selectedItemIds.clear();
      if (!skipRender) {
        render();
      }
      updateToolbar();
      if (!silent) {
        flashHint("Pilihan link dibersihkan.");
      }
    }

    function toggleSelectVisibleItems() {
      const ids = getVisibleSelectableIds();
      if (!ids.length) {
        flashHint("Tiada link pada page ini.");
        return;
      }
      const shouldSelect = !ids.every((id) => selectedItemIds.has(id));
      ids.forEach((id) => {
        if (shouldSelect) {
          selectedItemIds.add(id);
        } else {
          selectedItemIds.delete(id);
        }
      });
      render();
      updateToolbar();
      flashHint(shouldSelect ? "Semua link di page ini dipilih." : "Pilihan page dibuang.");
    }

    function populateBulkMoveSelect(select) {
      if (!select) return;
      const previous = select.value;
      select.innerHTML = "";

      const placeholderOption = document.createElement("option");
      placeholderOption.value = BULK_SELECT_PLACEHOLDER;
      placeholderOption.textContent = "Move to category...";
      placeholderOption.style.color = "#111";
      placeholderOption.style.background = "#fff";
      select.appendChild(placeholderOption);

      const noneOption = document.createElement("option");
      noneOption.value = BULK_SELECT_NONE;
      noneOption.textContent = "Uncategorized";
      noneOption.style.color = "#111";
      noneOption.style.background = "#fff";
      if (showHiddenCategories !== 2) {
        select.appendChild(noneOption);
      }
      if (showHiddenCategories >= 1) {
        const hiddenNoneOption = document.createElement("option");
        hiddenNoneOption.value = "hidden_none";
        hiddenNoneOption.textContent = "Uncategorize (hidden)";
        hiddenNoneOption.style.color = "#111";
        hiddenNoneOption.style.background = "#fff";
        select.appendChild(hiddenNoneOption);
      }

      const sorted = categories.slice().sort((a, b) => {
        const aName = a && a.name ? a.name : "";
        const bName = b && b.name ? b.name : "";
        return aName.localeCompare(bName, undefined, { sensitivity: "base" });
      });
      sorted.forEach((cat) => {
        if (!cat || !cat.id) return;
        if (showHiddenCategories === 2) {
          if (!cat.hidden) return;
        } else if (!showHiddenCategories && cat.hidden) {
          return;
        }
        const option = document.createElement("option");
        option.value = cat.id;
        option.textContent = cat.name ? cat.name : "(untitled)";
        if (cat.hidden) {
          option.textContent += " (hidden)";
        }
        option.style.color = "#111";
        option.style.background = "#fff";
        select.appendChild(option);
      });

      const hasPrevious = previous && Array.from(select.options).some((opt) => opt.value === previous);
      select.value = hasPrevious ? previous : BULK_SELECT_PLACEHOLDER;
    }

    function populateCategoryJumpSelect(select) {
      if (!select) return;
      select.innerHTML = "";
      if (showHiddenCategories === 2) {
        const allHiddenOpt = document.createElement("option");
        allHiddenOpt.value = "all";
        allHiddenOpt.textContent = "All categories (hidden) (" + (categoryCounts.all || 0) + ")";
        allHiddenOpt.style.color = "#111";
        allHiddenOpt.style.background = "#fff";
        select.appendChild(allHiddenOpt);

        const hiddenNoneOpt = document.createElement("option");
        hiddenNoneOpt.value = "hidden_none";
        hiddenNoneOpt.textContent = "Uncategorize (hidden) (" + (categoryCounts.hiddenNone || 0) + ")";
        hiddenNoneOpt.style.color = "#111";
        hiddenNoneOpt.style.background = "#fff";
        select.appendChild(hiddenNoneOpt);
      }
      if (showHiddenCategories !== 2) {
        const allOpt = document.createElement("option");
        allOpt.value = "all";
        allOpt.textContent = "All categories (" + (categoryCounts.all || 0) + ")";
        allOpt.style.color = "#111";
        allOpt.style.background = "#fff";
        select.appendChild(allOpt);

        const noneOpt = document.createElement("option");
        noneOpt.value = "none";
        noneOpt.textContent = "Uncategorized (" + (categoryCounts.none || 0) + ")";
        noneOpt.style.color = "#111";
        noneOpt.style.background = "#fff";
        select.appendChild(noneOpt);

        if (showHiddenCategories === 1) {
          const hiddenNoneOpt = document.createElement("option");
          hiddenNoneOpt.value = "hidden_none";
          hiddenNoneOpt.textContent = "Uncategorize (hidden) (" + (categoryCounts.hiddenNone || 0) + ")";
          hiddenNoneOpt.style.color = "#111";
          hiddenNoneOpt.style.background = "#fff";
          select.appendChild(hiddenNoneOpt);
        }
      }

      const sorted = categories.slice().sort((a, b) => {
        const aName = a && a.name ? a.name : "";
        const bName = b && b.name ? b.name : "";
        return aName.localeCompare(bName, undefined, { sensitivity: "base" });
      });
      sorted.forEach((cat) => {
        if (!cat || !cat.id) return;
        if (showHiddenCategories === 2) {
          if (!cat.hidden && cat.id !== activeCategoryId) return;
        } else if (!showHiddenCategories && cat.hidden && cat.id !== activeCategoryId) {
          return;
        }
        const catCount = typeof categoryCounts.byId[cat.id] === "number"
          ? categoryCounts.byId[cat.id]
          : 0;
        const option = document.createElement("option");
        option.value = cat.id;
        let label = (cat.name ? cat.name : "(untitled)");
        if (cat.hidden) {
          label += " (hidden)";
        }
        option.textContent = label + " (" + catCount + ")";
        option.style.color = "#111";
        option.style.background = "#fff";
        select.appendChild(option);
      });

      select.value = activeCategoryId || "none";
    }

    function cloneItemsSnapshot(list) {
      if (!Array.isArray(list)) return [];
      return list.map((item) => {
        if (!item || typeof item !== "object") return item;
        // Strip content/textContent dari snapshot untuk kurangkan memory dan masa clone
        // Data ini tidak diperlukan untuk undo — hanya metadata yang penting
        if (item.content || item.textContent) {
          const copy = { ...item };
          delete copy.content;
          delete copy.textContent;
          return copy;
        }
        return { ...item };
      });
    }

    function cloneTrashSnapshot(list) {
      if (!Array.isArray(list)) return [];
      return list.map((item) => {
        if (!item || typeof item !== "object") return item;
        return { ...item };
      });
    }

    function clearPendingUndoMove(options = {}) {
      const keepToast = options.keepToast === true;
      if (pendingUndoTimer) {
        clearTimeout(pendingUndoTimer);
        pendingUndoTimer = null;
      }
      pendingUndoMove = null;
      if (!keepToast) {
        undoToast.style.display = "none";
        undoToastText.textContent = "";
      }
    }

    function clearPendingUndoDelete(options = {}) {
      const keepToast = options.keepToast === true;
      if (pendingUndoDeleteTimer) {
        clearTimeout(pendingUndoDeleteTimer);
        pendingUndoDeleteTimer = null;
      }
      pendingUndoDelete = null;
      if (!keepToast) {
        undoToast.style.display = "none";
        undoToastText.textContent = "";
      }
    }

    function queueUndoMove(snapshot, targetCategoryId, movedCount) {
      if (!Array.isArray(snapshot) || movedCount <= 0) return;
      clearPendingUndoDelete();
      clearPendingUndoMove();
      const normalizedTargetId = targetCategoryId ? String(targetCategoryId) : "";
      const targetLabel = getCategoryLabel(normalizedTargetId || "none");
      pendingUndoMove = {
        snapshot: cloneItemsSnapshot(snapshot),
        targetCategoryId: normalizedTargetId,
        movedCount
      };
      undoToastText.textContent = "Moved to " + targetLabel + " • Undo";
      undoToast.style.display = "flex";
      const canUndoNow = !moveActionInProgress && !undoInProgress && (!!pendingUndoMove || !!pendingUndoDelete);
      undoToastBtn.disabled = !canUndoNow;
      undoToastBtn.style.opacity = canUndoNow ? "1" : "0.6";
      undoToastBtn.style.cursor = canUndoNow ? "pointer" : "not-allowed";
    }

    function queueUndoDelete(itemsSnapshot, trashSnapshot, deletedCount) {
      if (!Array.isArray(itemsSnapshot) || deletedCount <= 0) return;
      clearPendingUndoMove();
      clearPendingUndoDelete();
      pendingUndoDelete = {
        itemsSnapshot: itemsSnapshot,
        trashSnapshot: trashSnapshot || [],
        deletedCount
      };
      const label = deletedCount > 1 ? deletedCount + " link dipadam" : "Link dipadam";
      undoToastText.textContent = label + " • Undo";
      undoToast.style.display = "flex";
      const canUndoNow = !undoInProgress && !moveActionInProgress && (!!pendingUndoMove || !!pendingUndoDelete);
      undoToastBtn.disabled = !canUndoNow;
      undoToastBtn.style.opacity = canUndoNow ? "1" : "0.6";
      undoToastBtn.style.cursor = canUndoNow ? "pointer" : "not-allowed";
    }

    async function undoPendingMove() {
      if (!pendingUndoMove || undoInProgress || moveActionInProgress) return false;
      undoInProgress = true;
      setMoveActionBusy(true);
      undoToastBtn.disabled = true;
      undoToastBtn.style.opacity = "0.6";
      undoToastBtn.style.cursor = "not-allowed";
      const snapshot = cloneItemsSnapshot(pendingUndoMove.snapshot || []);
      clearPendingUndoMove({ keepToast: true });
      try {
        await persistPickerItemsSnapshot(snapshot);
        replaceItems(snapshot);
        refreshDerived();
        clearSelectedItems({ silent: true, skipRender: true });
        bulkMoveSelect.value = BULK_SELECT_PLACEHOLDER;
        updateToolbar();
        flashHint("Undo berjaya.");
        undoToast.style.display = "none";
        undoToastText.textContent = "";
        return true;
      } catch (err) {
        undoToast.style.display = "none";
        undoToastText.textContent = "";
        flashHint("Undo gagal.");
        return false;
      } finally {
        undoInProgress = false;
        setMoveActionBusy(false);
        const canUndoNow = !moveActionInProgress && !undoInProgress && (!!pendingUndoMove || !!pendingUndoDelete);
        undoToastBtn.disabled = !canUndoNow;
        undoToastBtn.style.opacity = canUndoNow ? "1" : "0.6";
        undoToastBtn.style.cursor = canUndoNow ? "pointer" : "not-allowed";
      }
    }

    async function undoPendingDelete() {
      if (!pendingUndoDelete || undoInProgress || moveActionInProgress) return false;
      undoInProgress = true;
      undoToastBtn.disabled = true;
      undoToastBtn.style.opacity = "0.6";
      undoToastBtn.style.cursor = "not-allowed";
      const itemsSnapshot = cloneItemsSnapshot(pendingUndoDelete.itemsSnapshot || []);
      const trashSnapshot = cloneItemsSnapshot(pendingUndoDelete.trashSnapshot || []);
      clearPendingUndoDelete({ keepToast: true });
      try {
        await persistPickerItemsSnapshot(itemsSnapshot);
        // Pulihkan trash juga
        try { await lpApi.storage.local.set({ [TRASH_KEY]: trashSnapshot }); } catch (e) {}
        replaceItems(itemsSnapshot);
        refreshDerived();
        clearSelectedItems({ silent: true, skipRender: true });
        bulkMoveSelect.value = BULK_SELECT_PLACEHOLDER;
        updateToolbar();
        flashHint("Undo delete berjaya.");
        undoToast.style.display = "none";
        undoToastText.textContent = "";
        return true;
      } catch (err) {
        undoToast.style.display = "none";
        undoToastText.textContent = "";
        flashHint("Undo delete gagal.");
        return false;
      } finally {
        undoInProgress = false;
        const canUndoNow = !moveActionInProgress && !undoInProgress && (!!pendingUndoMove || !!pendingUndoDelete);
        undoToastBtn.disabled = !canUndoNow;
        undoToastBtn.style.opacity = canUndoNow ? "1" : "0.6";
        undoToastBtn.style.cursor = canUndoNow ? "pointer" : "not-allowed";
      }
    }

    let trashOverlay = null;

    function closeTrashPanel() {
      if (trashOverlay && trashOverlay.parentNode) {
        trashOverlay.parentNode.removeChild(trashOverlay);
      }
      trashOverlay = null;
    }

    async function restoreTrashItemById(id) {
      try {
        const data = await lpApi.storage.local.get([ITEM_KEY, TRASH_KEY]);
        const items = Array.isArray(data[ITEM_KEY]) ? data[ITEM_KEY] : [];
        const trash = Array.isArray(data[TRASH_KEY]) ? data[TRASH_KEY] : [];
        const idx = trash.findIndex((t) => t && t.id === id);
        if (idx < 0) return false;
        const entry = trash[idx];
        const nextTrash = trash.filter((_, i) => i !== idx);
        const restored = { ...entry };
        delete restored.deletedAt;
        const nextItems = [restored, ...items];
        // UI update first — instant
        replaceItems(nextItems);
        refreshDerived();
        flashHint("Dipulihkan dari tong sampah.");
        // Background storage write — guna queueItemsMutation untuk serialization
        queueItemsMutation(async () => {
          await setItems(nextItems, { previousItems: items, skipDedupe: true });
          await lpApi.storage.local.set({ [TRASH_KEY]: nextTrash });
          return nextItems;
        }).catch(() => {
          lpApi.storage.local.set({ [ITEM_KEY]: nextItems, [TRASH_KEY]: nextTrash }).catch(() => {});
        });
        return true;
      } catch (err) {
        return false;
      }
    }

    async function restoreAllTrash() {
      try {
        const data = await lpApi.storage.local.get([ITEM_KEY, TRASH_KEY]);
        const items = Array.isArray(data[ITEM_KEY]) ? data[ITEM_KEY] : [];
        const trash = Array.isArray(data[TRASH_KEY]) ? data[TRASH_KEY] : [];
        if (!trash.length) return false;
        const cleaned = trash.map((t) => {
          const clone = { ...(t || {}) };
          delete clone.deletedAt;
          return clone;
        }).filter((t) => t && t.id);
        const nextItems = [...cleaned, ...items];
        // UI update first — instant
        replaceItems(nextItems);
        refreshDerived();
        flashHint("Semua link dipulihkan.");
        // Background storage write — guna queueItemsMutation untuk serialization
        queueItemsMutation(async () => {
          await setItems(nextItems, { previousItems: items, skipDedupe: true });
          await lpApi.storage.local.set({ [TRASH_KEY]: [] });
          return nextItems;
        }).catch(() => {
          lpApi.storage.local.set({ [ITEM_KEY]: nextItems, [TRASH_KEY]: [] }).catch(() => {});
        });
        return true;
      } catch (err) {
        return false;
      }
    }

    async function emptyTrash() {
      try {
        await lpApi.storage.local.set({ [TRASH_KEY]: [] });
        flashHint("Tong sampah dikosongkan.");
        return true;
      } catch (err) {
        return false;
      }
    }

    async function openTrashPanel() {
      const data = await lpApi.storage.local.get([TRASH_KEY]);
      const trash = Array.isArray(data[TRASH_KEY]) ? data[TRASH_KEY] : [];
      closeTrashPanel();
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.zIndex = "2147483647";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.background = "rgba(0, 0, 0, 0.4)";
      overlay.style.backdropFilter = "blur(3px)";

      const panel = document.createElement("div");
      panel.style.width = "min(520px, 92vw)";
      panel.style.maxHeight = "80vh";
      panel.style.background = theme.panelAlt;
      panel.style.border = theme.border;
      panel.style.color = theme.text;
      panel.style.borderRadius = "14px";
      panel.style.boxShadow = "0 18px 40px rgba(0,0,0,0.35)";
      panel.style.display = "flex";
      panel.style.flexDirection = "column";
      panel.style.padding = "14px 16px";
      panel.style.gap = "12px";

      const headerRow = document.createElement("div");
      headerRow.style.display = "flex";
      headerRow.style.justifyContent = "space-between";
      headerRow.style.alignItems = "center";

      const titleEl = document.createElement("div");
      titleEl.textContent = "Tong Sampah";
      titleEl.style.fontSize = "16px";
      titleEl.style.fontWeight = "700";

      const actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.gap = "6px";

      const restoreAllBtn = document.createElement("button");
      restoreAllBtn.textContent = "Pulihkan semua";
      styleTopButton(restoreAllBtn, "default");

      const emptyBtn = document.createElement("button");
      emptyBtn.textContent = "Kosongkan";
      styleTopButton(emptyBtn, "danger");

      const closeBtn = document.createElement("button");
      closeBtn.textContent = "✕";
      styleActionButton(closeBtn, "danger");

      actions.append(restoreAllBtn, emptyBtn, closeBtn);
      headerRow.append(titleEl, actions);

      const list = document.createElement("div");
      list.style.display = "flex";
      list.style.flexDirection = "column";
      list.style.gap = "8px";
      list.style.overflowY = "auto";
      list.style.maxHeight = "60vh";

      if (!trash.length) {
        const empty = document.createElement("div");
        empty.textContent = "Tong sampah kosong.";
        empty.style.color = theme.muted;
        empty.style.fontSize = "13px";
        list.appendChild(empty);
      } else {
        trash.slice(0, 60).forEach((entry) => {
          const row = document.createElement("div");
          row.style.display = "grid";
          row.style.gridTemplateColumns = "1fr auto";
          row.style.gap = "8px";
          row.style.padding = "8px 10px";
          row.style.border = theme.border;
          row.style.borderRadius = "10px";
          row.style.background = theme.panel;

          const info = document.createElement("div");
          info.style.display = "flex";
          info.style.flexDirection = "column";
          info.style.gap = "4px";

          const title = document.createElement("div");
          title.textContent = entry && entry.title ? entry.title : (entry && entry.url ? entry.url : "Tanpa tajuk");
          title.style.fontWeight = "600";
          title.style.fontSize = "13px";

          const meta = document.createElement("div");
          meta.style.color = theme.muted;
          meta.style.fontSize = "12px";
          const catLabel = getCategoryLabel(entry && entry.categoryId ? String(entry.categoryId) : "none");
          meta.textContent = catLabel + " · " + (entry && entry.siteName ? entry.siteName : "Tiada tapak");

          info.append(title, meta);

          const btns = document.createElement("div");
          btns.style.display = "flex";
          btns.style.gap = "6px";

          const restoreBtn = document.createElement("button");
          restoreBtn.textContent = "Pulihkan";
          styleTopButton(restoreBtn, "default");
          restoreBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            await restoreTrashItemById(entry && entry.id ? entry.id : "");
            closeTrashPanel();
            openTrashPanel();
          });

          btns.append(restoreBtn);
          row.append(info, btns);
          list.append(row);
        });
      }

      panel.append(headerRow, list);
      overlay.append(panel);
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeTrashPanel();
      });
      overlay.addEventListener("keydown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") {
          closeTrashPanel();
        }
      });
      restoreAllBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        await restoreAllTrash();
        closeTrashPanel();
      });
      emptyBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        await emptyTrash();
        closeTrashPanel();
      });
      closeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        closeTrashPanel();
      });

      (document.fullscreenElement || document.webkitFullscreenElement || document.body).appendChild(overlay);
      trashOverlay = overlay;
      setTimeout(() => {
        try {
          restoreAllBtn.focus();
        } catch (err) {
          // ignore
        }
      }, 0);
    }

    function getDropCategoryTargets() {
      const targets = [];
      if (showHiddenCategories !== 2) {
        targets.push({
          id: "",
          label: "Uncategorized"
        });
      }
      if (showHiddenCategories >= 1) {
        targets.push({
          id: "hidden_none",
          label: "Uncategorize (hidden)"
        });
      }
      const sorted = categories.slice().sort((a, b) => {
        const aName = a && a.name ? a.name : "";
        const bName = b && b.name ? b.name : "";
        return aName.localeCompare(bName, undefined, { sensitivity: "base" });
      });
      sorted.forEach((cat) => {
        if (!cat || !cat.id) return;
        if (showHiddenCategories === 2) {
          if (!cat.hidden) return;
        } else if (!showHiddenCategories && cat.hidden) {
          return;
        }
        const baseName = cat.name ? cat.name : "(untitled)";
        const label = cat.hidden ? baseName + " (hidden)" : baseName;
        targets.push({
          id: String(cat.id),
          label
        });
      });
      return targets;
    }

    function getDropTargetKey(categoryId) {
      const id = categoryId ? String(categoryId) : "";
      if (!id || id === "none") return "__uncategorized__";
      if (id === "hidden_none") return "__hidden_uncategorized__";
      return id;
    }

    function buildDistinctDropChipHues(targets) {
      const assignedByTargetKey = new Map();
      const usedHues = [];
      const safeTargets = Array.isArray(targets) ? targets : [];
      const totalTargets = Math.max(1, safeTargets.length);
      const minHueGap = Math.max(9, Math.floor(340 / Math.max(10, totalTargets)));
      const hueDistance = (a, b) => {
        const diff = Math.abs(a - b) % 360;
        return Math.min(diff, 360 - diff);
      };
      safeTargets.forEach((target, index) => {
        const targetId = target && target.id ? String(target.id) : "";
        const targetKey = getDropTargetKey(targetId);
        const colorKey = getCategoryColorKey(targetId);
        const baseHue = hueFromString(colorKey);
        // Golden-angle stepping keeps nearby items visually different.
        let hue = Math.round((baseHue + (index * 137.508) + 17) % 360);
        let attempt = 0;
        while (usedHues.some((usedHue) => hueDistance(usedHue, hue) < minHueGap) && attempt < 360) {
          attempt += 1;
          hue = Math.round((hue + 23 + (attempt % 7)) % 360);
        }
        usedHues.push(hue);
        assignedByTargetKey.set(targetKey, hue);
      });
      return assignedByTargetKey;
    }

    function orderItemIdsByCurrentEntries(ids) {
      const unique = Array.from(new Set((Array.isArray(ids) ? ids : [])
        .map((id) => (id ? String(id) : ""))
        .filter(Boolean)));
      if (!unique.length) return [];
      const idSet = new Set(unique);
      const ordered = [];
      const orderedSet = new Set();
      const sourcePools = [visibleEntries, filtered, itemEntries];
      sourcePools.forEach((pool) => {
        if (!Array.isArray(pool)) return;
        pool.forEach((entry) => {
          if (!entry || !entry.id) return;
          const id = String(entry.id);
          if (!idSet.has(id) || orderedSet.has(id)) return;
          ordered.push(id);
          orderedSet.add(id);
        });
      });
      unique.forEach((id) => {
        if (!orderedSet.has(id)) {
          ordered.push(id);
          orderedSet.add(id);
        }
      });
      return ordered;
    }

    function resolveDragMoveItemIds(primaryId) {
      const id = primaryId ? String(primaryId) : "";
      if (!id) return [];
      syncSelectedItemsWithCurrentCategory();
      if (selectedItemIds.size > 1 && selectedItemIds.has(id)) {
        return orderItemIdsByCurrentEntries(Array.from(selectedItemIds));
      }
      return [id];
    }

    function buildDragMoveInfo(ids) {
      const unique = Array.from(new Set((Array.isArray(ids) ? ids : [])
        .map((id) => (id ? String(id) : ""))
        .filter(Boolean)));
      const cacheKey = unique.join(",");
      if (
        dragMoveInfoCache
        && dragMoveInfoCacheKey === cacheKey
        && dragMoveInfoCacheRevision === itemsRevision
      ) {
        return dragMoveInfoCache;
      }
      const info = {
        ids: unique,
        totalFound: 0,
        countByCategory: new Map()
      };
      if (!unique.length) {
        dragMoveInfoCacheKey = cacheKey;
        dragMoveInfoCacheRevision = itemsRevision;
        dragMoveInfoCache = info;
        return info;
      }
      unique.forEach((id) => {
        const item = itemById.get(id);
        if (!item) return;
        const currentCategoryId = item.categoryId ? String(item.categoryId) : "";
        info.totalFound += 1;
        info.countByCategory.set(
          currentCategoryId,
          (info.countByCategory.get(currentCategoryId) || 0) + 1
        );
      });
      dragMoveInfoCacheKey = cacheKey;
      dragMoveInfoCacheRevision = itemsRevision;
      dragMoveInfoCache = info;
      return info;
    }

    function canDropWithDragInfo(dragInfo, targetCategoryId) {
      if (!dragInfo || dragInfo.totalFound <= 0) return false;
      const normalizedTargetId = targetCategoryId ? String(targetCategoryId) : "";
      const sameCount = dragInfo.countByCategory.get(normalizedTargetId) || 0;
      return (dragInfo.totalFound - sameCount) > 0;
    }

    function ensureDropBarChips(targets) {
      const nextTargets = Array.isArray(targets) ? targets : [];
      const hueByTargetKey = buildDistinctDropChipHues(nextTargets);
      const nextKey = nextTargets
        .map((target) => getDropTargetKey(target && target.id ? target.id : "") + ":" + (target && target.label ? target.label : ""))
        .join("|");
      if (dropBarTargetsKey === nextKey) {
        return;
      }
      dropBarTargetsKey = nextKey;
      dropBarVisualKey = "";
      dropBarChips.innerHTML = "";
      dropBarChipByTargetId.clear();
      nextTargets.forEach((target, index) => {
        const targetId = target && target.id ? String(target.id) : "";
        const targetKey = getDropTargetKey(targetId);
        const targetLabel = target && target.label ? String(target.label) : "Category";
        const palette = getDropChipPalette(targetId, hueByTargetKey.get(targetKey), index);
        const chip = document.createElement("div");
        chip.textContent = targetLabel;
        chip.dataset.targetId = targetId;
        chip.dataset.targetKey = targetKey;
        chip.dataset.canDrop = "0";
        chip._dropPalette = palette;
        chip.style.display = "inline-flex";
        chip.style.alignItems = "center";
        chip.style.padding = "4px 10px";
        chip.style.borderRadius = "999px";
        applyDropChipStyle(chip, palette, false);
        chip.style.fontSize = "12px";
        chip.style.lineHeight = "1.4";
        chip.style.whiteSpace = "nowrap";
        chip.style.maxWidth = "100%";
        chip.style.minWidth = "0";
        chip.style.overflow = "hidden";
        chip.style.textOverflow = "ellipsis";
        chip.style.transition = "border 120ms ease, background 120ms ease, color 120ms ease, opacity 120ms ease";
        chip.style.userSelect = "none";
        chip.style.cursor = "default";
        chip.style.opacity = "0.88";
        const setHot = (active) => {
          if (chip.dataset.canDrop !== "1") return;
          applyDropChipStyle(chip, palette, active);
        };
        chip.addEventListener("dragenter", (event) => {
          if (chip.dataset.canDrop !== "1") return;
          event.preventDefault();
          stopDragAutoScroll();
          setHot(true);
        });
        chip.addEventListener("dragover", (event) => {
          if (chip.dataset.canDrop !== "1") return;
          event.preventDefault();
          stopDragAutoScroll();
          if (event && event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
          }
          setHot(true);
        });
        chip.addEventListener("dragleave", () => {
          setHot(false);
        });
        chip.addEventListener("drop", async (event) => {
          if (chip.dataset.canDrop !== "1") return;
          event.preventDefault();
          event.stopPropagation();
          setHot(false);
          const movingIds = dragMoveItemIds.slice();
          draggingItemId = "";
          dragMoveItemIds = [];
          clearReorderHoverRow();
          clearCategoryDropHoverRow();
          stopDragAutoScroll();
          scheduleDropPanelAutoHide();
          suppressRowClickUntil = Date.now() + 250;
          renderDropBar();
          const result = await moveItemsToCategoryByIds(movingIds, targetId, { enableUndo: true });
          if (result.busy) {
            flashHint("Sedang memproses pindahan. Cuba lagi sebentar.");
            return;
          }
          if (result.invalidTarget) {
            flashHint("Kategori sasaran tidak lagi wujud.");
            return;
          }
          if (!result.ok) {
            flashHint("Gagal pindah link.");
            return;
          }
          selectedItemIds.clear();
          bulkMoveSelect.value = BULK_SELECT_PLACEHOLDER;
          updateToolbar();
          if (result.movedCount <= 0) {
            flashHint("Link sudah berada dalam kategori itu.");
          } else {
            flashHint("Berjaya pindah " + result.movedCount + " link.");
          }
        });
        dropBarChipByTargetId.set(targetKey, chip);
        dropBarChips.appendChild(chip);
      });
    }

    async function moveItemsToCategoryByIds(itemIds, targetCategoryId, options = {}) {
      const normalizedTargetId = targetCategoryId ? String(targetCategoryId) : "";
      const targetLabel = getCategoryLabel(normalizedTargetId || "none");
      if (moveActionInProgress) {
        return {
          ok: false,
          busy: true,
          movedCount: 0,
          targetCategoryId: normalizedTargetId,
          targetLabel
        };
      }
      const requestedIds = Array.from(new Set((Array.isArray(itemIds) ? itemIds : [])
        .map((id) => (id ? String(id) : ""))
        .filter(Boolean)));
      if (!requestedIds.length) {
        return {
          ok: false,
          movedCount: 0,
          targetCategoryId: normalizedTargetId,
          targetLabel
        };
      }
      const categoryExists = normalizedTargetId
        ? categories.some((cat) => cat && cat.id === normalizedTargetId)
        : true;
      if (!categoryExists) {
        return {
          ok: false,
          invalidTarget: true,
          movedCount: 0,
          targetCategoryId: normalizedTargetId,
          targetLabel
        };
      }
      setMoveActionBusy(true);
      try {
        const data = await lpApi.storage.local.get(ITEM_KEY);
        const current = Array.isArray(data[ITEM_KEY]) ? data[ITEM_KEY] : [];
        const snapshot = cloneItemsSnapshot(current);
        const byId = new Map();
        current.forEach((item) => {
          if (!item || !item.id) return;
          byId.set(String(item.id), item);
        });
        const orderedRequestedIds = orderItemIdsByCurrentEntries(
          requestedIds.filter((id) => byId.has(id))
        );
        const movableIds = orderedRequestedIds.filter((id) => {
          const item = byId.get(id);
          if (!item) return false;
          const existingCategoryId = item.categoryId ? String(item.categoryId) : "";
          return existingCategoryId !== normalizedTargetId;
        });
        if (!movableIds.length) {
          return {
            ok: true,
            movedCount: 0,
            targetCategoryId: normalizedTargetId,
            targetLabel
          };
        }
        const movableSet = new Set(movableIds);
        const targetExisting = current.filter((item) => {
          if (!item || !item.id) return false;
          const itemId = String(item.id);
          if (movableSet.has(itemId)) return false;
          const itemCategoryId = item.categoryId ? String(item.categoryId) : "";
          return itemCategoryId === normalizedTargetId;
        });
        const orderedTargetExisting = sortItemsByManualOrder(targetExisting, "desc");
        const nextOrderById = new Map();
        movableIds.forEach((id, index) => {
          nextOrderById.set(id, index);
        });
        orderedTargetExisting.forEach((item, index) => {
          if (!item || !item.id) return;
          nextOrderById.set(String(item.id), movableIds.length + index);
        });
        const next = current.map((item) => {
          if (!item || !item.id) return item;
          const itemId = String(item.id);
          if (!nextOrderById.has(itemId)) return item;
          const nextItem = { ...item, manualOrder: nextOrderById.get(itemId) };
          if (movableSet.has(itemId)) {
            nextItem.categoryId = normalizedTargetId;
          }
          return nextItem;
        });
        await lpApi.storage.local.set({ [ITEM_KEY]: next });
        // Track tulis untuk elakkan storageChangeHandler trigger replaceItems sekali lagi
        pickerLastWriteAt = Date.now();
        pickerLastWriteCount = next.length;
        pickerLastWriteHash = buildItemsHash(next);
        replaceItems(next);
        refreshDerived({ preserveActiveEntry: true });
        if (options.enableUndo !== false) {
          queueUndoMove(snapshot, normalizedTargetId, movableIds.length);
        } else {
          clearPendingUndoMove();
        }
        return {
          ok: true,
          movedCount: movableIds.length,
          targetCategoryId: normalizedTargetId,
          targetLabel
        };
      } catch (err) {
        return {
          ok: false,
          movedCount: 0,
          targetCategoryId: normalizedTargetId,
          targetLabel
        };
      } finally {
        setMoveActionBusy(false);
      }
    }

    async function moveSelectedItemsToCategory(targetValue) {
      const targetCategoryId = targetValue === BULK_SELECT_NONE ? "" : targetValue;
      const selectedIds = getSelectedItemIdsForCurrentCategory();
      if (!selectedIds.length) {
        flashHint("Pilih link dahulu.");
        return;
      }
      const orderedSelectedIds = orderItemIdsByCurrentEntries(selectedIds);
      const result = await moveItemsToCategoryByIds(orderedSelectedIds, targetCategoryId, { enableUndo: true });
      bulkMoveSelect.value = BULK_SELECT_PLACEHOLDER;
      if (result.busy) {
        flashHint("Sedang memproses pindahan. Cuba lagi sebentar.");
        updateToolbar();
        return;
      }
      if (result.invalidTarget) {
        flashHint("Kategori sasaran tidak lagi wujud.");
        updateToolbar();
        return;
      }
      if (!result.ok) {
        flashHint("Gagal pindah link.");
        updateToolbar();
        return;
      }
      selectedItemIds.clear();
      updateToolbar();
      if (result.movedCount > 0) {
        flashHint("Berjaya pindah " + result.movedCount + " link.");
      } else {
        flashHint("Link terpilih sudah berada dalam kategori itu.");
      }
    }

    async function deleteSelectedItems() {
      const selectedIds = getSelectedItemIdsForCurrentCategory();
      if (!selectedIds.length) {
        flashHint("Pilih link dahulu.");
        return;
      }

      const confirmMsg = "Adakah anda pasti mahu memadam " + selectedIds.length + " link terpilih?";
      if (!confirm(confirmMsg)) return;

      try {
        const data = await lpApi.storage.local.get([ITEM_KEY, TRASH_KEY, SETTINGS_KEY]);
        const allItems = Array.isArray(data[ITEM_KEY]) ? data[ITEM_KEY] : [];
        const trash = Array.isArray(data[TRASH_KEY]) ? data[TRASH_KEY] : [];
        const limitRaw = data[SETTINGS_KEY] && typeof data[SETTINGS_KEY].trashLimit !== "undefined"
          ? Number(data[SETTINGS_KEY].trashLimit)
          : (currentSettings && typeof currentSettings.trashLimit !== "undefined" ? currentSettings.trashLimit : 0);
        const trashLimit = Number.isFinite(limitRaw) ? Math.max(0, limitRaw) : 0;

        const prevItems = cloneItemsSnapshot(allItems);
        const prevTrash = cloneItemsSnapshot(trash);

        const selectedIdSet = new Set(selectedIds);
        const targets = allItems.filter((item) => item && selectedIdSet.has(item.id));
        const nextItems = allItems.filter((item) => !item || !selectedIdSet.has(item.id));

        const now = new Date().toISOString();
        const trashEntries = targets.map((target) => ({ ...target, deletedAt: now }));
        const combinedTrash = [...trashEntries, ...trash];
        const nextTrash = trashLimit > 0 ? combinedTrash.slice(0, trashLimit) : combinedTrash;

        // UI update first — instant
        replaceItems(nextItems);
        selectedItemIds.clear();
        refreshDerived({ preserveActiveEntry: true });
        queueUndoDelete(prevItems, prevTrash, selectedIds.length);
        flashHint("Berjaya memadam " + selectedIds.length + " link.");

        // Background storage write — guna message untuk serialization natural
        lpApi.runtime.sendMessage({
          type: "picker-delete-items",
          itemIds: selectedIds,
          trashEntries: trashEntries,
        }).catch(() => {
          persistItemsToPrimaryStore(nextItems, prevItems)
            .then(() => lpApi.storage.local.set({ [TRASH_KEY]: nextTrash }))
            .catch(() => lpApi.storage.local.set({ [ITEM_KEY]: nextItems, [TRASH_KEY]: nextTrash }));
        });
      } catch (err) {
        flashHint("Gagal memadam link.");
      }
    }

    async function favSelectedItems() {
      const selectedIds = getSelectedItemIdsForCurrentCategory();
      if (!selectedIds.length) {
        flashHint("Pilih link dahulu.");
        return;
      }

      try {
        const data = await lpApi.storage.local.get(ITEM_KEY);
        const currentItems = Array.isArray(data[ITEM_KEY]) ? data[ITEM_KEY] : [];
        const selectedIdSet = new Set(selectedIds);

        const targets = currentItems.filter(it => it && selectedIdSet.has(it.id));
        const allFav = targets.every(it => it.favorite === true);
        const nextFavStatus = !allFav;

        const nextItems = currentItems.map((item) => {
          if (item && selectedIdSet.has(item.id)) {
            return { ...item, favorite: nextFavStatus };
          }
          return item;
        });

        await persistPickerItemsSnapshot(nextItems, currentItems);
        replaceItems(nextItems);
        refreshDerived({ preserveActiveEntry: true });

        const msg = nextFavStatus ? "Berjaya jadikan " + selectedIds.length + " link sebagai Favorite." : "Berjaya buang " + selectedIds.length + " link dari Favorite.";
        flashHint(msg);
      } catch (err) {
        flashHint("Gagal mengemaskini Favorite.");
      }
    }

    function syncDropSidePanelHeight() {
      if (dropSidePanel.style.display === "none") return;
      const panelHeight = panel.getBoundingClientRect().height;
      if (panelHeight > 0) {
        dropSidePanel.style.height = Math.round(panelHeight) + "px";
      }
      // Sync tinggi categorySidePanel juga
      if (categorySidePanel.style.display !== "none") {
        categorySidePanel.style.height = Math.round(panelHeight) + "px";
      }
    }

    function clearDropPanelAutoHideTimer() {
      if (dropPanelAutoHideTimer) {
        clearTimeout(dropPanelAutoHideTimer);
        dropPanelAutoHideTimer = null;
      }
    }

    function showDropPanelForDrag() {
      if (mode !== "items" && mode !== "categories") return;
      clearDropPanelAutoHideTimer();
      if (!dropPanelAutoVisible) {
        dropPanelAutoVisible = true;
        dropBarVisualKey = "";
      }
      renderDropBar();
      updateHint();
    }

    function refreshDropPanelOnDragStart() {
      clearDropPanelAutoHideTimer();
      if (dropPanelAutoVisible) {
        renderDropBar();
        updateHint();
      }
    }

    function maybeRevealDropPanelFromDragEvent(event) {
      if (dropPanelAutoVisible) return false;
      if (mode !== "items" && mode !== "categories") return false;
      if (!dragMoveItemIds.length) return false;
      if (!event || !Number.isFinite(event.clientX)) return false;
      const panelRect = panel.getBoundingClientRect();
      if (!panelRect || panelRect.width <= 0) return false;
      if (event.clientX < panelRect.right + DROP_PANEL_REVEAL_RIGHT_OFFSET_PX) {
        return false;
      }
      showDropPanelForDrag();
      return true;
    }

    function scheduleDropPanelAutoHide() {
      // Auto-hide disabled: keep the drop panel visible once shown.
      clearDropPanelAutoHideTimer();
    }

    function placeDropBarInSidePanel(placedInSide) {
      if (placedInSide) {
        if (dropBar.parentNode !== dropSideBody) {
          dropSideBody.appendChild(dropBar);
        }
        dropBar.style.flex = "1 1 auto";
        dropBar.style.height = "100%";
        dropBar.style.maxHeight = "100%";
        dropBar.style.padding = "6px 8px";
        dropBarChips.style.flex = "1 1 auto";
        dropBarChips.style.minHeight = "0";
        dropBarChips.style.maxHeight = "none";
        return;
      }
      if (dropBar.parentNode !== panel) {
        panel.insertBefore(dropBar, list);
      }
      dropBar.style.flex = "0 0 auto";
      dropBar.style.height = "";
      dropBar.style.maxHeight = "";
      dropBar.style.padding = "9px 10px";
      dropBarChips.style.flex = "0 0 auto";
      dropBarChips.style.minHeight = "30px";
      dropBarChips.style.maxHeight = "96px";
    }

    function updateDropPanelLayout() {
      const showSidePanel = (mode === "items" || mode === "categories") && dropPanelAutoVisible;
      // Jika ada saved width dari restore, gunakan itu
      var hasSavedWidth = payload && payload.savedWidth && parseInt(payload.savedWidth, 10) >= MIN_PANEL_WIDTH;
      if (showSidePanel) {
        if (!hasSavedWidth) {
          panel.style.width = "min(720px, 72vw)";
        }
        dropSidePanel.style.display = "flex";
        placeDropBarInSidePanel(true);
        requestAnimationFrame(syncDropSidePanelHeight);
        return;
      }
      if (!hasSavedWidth) {
        panel.style.width = "min(720px, 94vw)";
      }
      dropSidePanel.style.display = "none";
      dropSidePanel.style.height = "";
      placeDropBarInSidePanel(false);
    }

    function renderDropBar() {
      updateDropPanelLayout();
      if (mode !== "items" && mode !== "categories") {
        dropBar.style.display = "none";
        dropBarVisualKey = "";
        return;
      }
      if (!dropPanelAutoVisible) {
        dropBar.style.display = "none";
        dropBarVisualKey = "";
        return;
      }
      dropBar.style.display = "flex";
      const dragIds = dragMoveItemIds.slice();
      const draggingCount = dragIds.length;
      if (!draggingCount) {
        clearReorderHoverRow();
        clearCategoryDropHoverRow();
        stopDragAutoScroll();
      }
      if (draggingCount > 0) {
        dropBarLabel.textContent = "Drop ke kategori untuk pindah " + draggingCount + " link";
      } else if (moveActionInProgress) {
        dropBarLabel.textContent = "Sedang memproses pindahan...";
      } else {
        dropBarLabel.textContent = "Drag link ke kategori untuk pindah";
      }
      const targets = getDropCategoryTargets();
      ensureDropBarChips(targets);
      const visualKey = [
        dropBarTargetsKey,
        String(itemsRevision),
        String(draggingCount),
        dragIds.join(",")
      ].join("|");
      if (dropBarVisualKey === visualKey) {
        return;
      }
      dropBarVisualKey = visualKey;
      const dragInfo = buildDragMoveInfo(dragIds);
      targets.forEach((target) => {
        const targetKey = getDropTargetKey(target && target.id ? target.id : "");
        const chip = dropBarChipByTargetId.get(targetKey);
        if (!chip) return;
        const canDrop = !moveActionInProgress
          && draggingCount > 0
          && canDropWithDragInfo(dragInfo, target && target.id ? target.id : "");
        chip.dataset.canDrop = canDrop ? "1" : "0";
        if (draggingCount > 0) {
          chip.style.cursor = canDrop ? "copy" : "not-allowed";
          chip.style.opacity = canDrop ? "1" : "0.45";
        } else {
          chip.style.cursor = "default";
          chip.style.opacity = "0.88";
        }
        const palette = chip._dropPalette || getDropChipPalette(target && target.id ? target.id : "");
        applyDropChipStyle(chip, palette, false);
      });
    }

    function normalizeCategoryName(input) {
      return input ? String(input).trim() : "";
    }

    function makeCategoryId(name) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const suffix = Date.now().toString(36);
      return (slug || "category") + "-" + suffix;
    }

    async function updatePickerSettings(nextPartial) {
      if (!nextPartial || typeof nextPartial !== "object") return false;
      try {
        const data = await lpApi.storage.local.get(SETTINGS_KEY);
        const current = data && data[SETTINGS_KEY] && typeof data[SETTINGS_KEY] === "object"
          ? data[SETTINGS_KEY]
          : {};
        const next = { ...current, ...nextPartial };
        const changed = Object.keys(nextPartial).some((key) => current[key] !== next[key]);
        if (!changed) {
          youtubeAutoNext = current.youtubeAutoNext === true;
          youtubeAutoRandom = current.youtubeAutoRandom === true;
          deleteAfterOpenActive = current.deleteAfterOpen === true;
          randomAcrossAllCategories = current.randomAcrossAllCategories === true;
          navigationFavoritesOnly = current.navigationFavoritesOnly === true;
          favoriteSortMode = ["manual", "asc", "desc"].includes(String(current.favoritesSortMode || "").toLowerCase())
            ? String(current.favoritesSortMode).toLowerCase()
            : "manual";
          if (navigationFavoritesOnly) {
            sortDir = favoriteSortMode;
          }
          sidebarAiProvider = normalizeSidebarAiProvider(current.sidebarAiProvider);
          if (sidebarAiSelect) {
            sidebarAiSelect.value = sidebarAiProvider;
            sidebarAiSelect.title = "Sidebar AI: " + getSidebarAiLabel(sidebarAiProvider);
          }
          updateTopBar();
          return true;
        }
        await lpApi.storage.local.set({ [SETTINGS_KEY]: next });
        youtubeAutoNext = next.youtubeAutoNext === true;
        youtubeAutoRandom = next.youtubeAutoRandom === true;
        deleteAfterOpenActive = next.deleteAfterOpen === true;
        randomAcrossAllCategories = next.randomAcrossAllCategories === true;
        navigationFavoritesOnly = next.navigationFavoritesOnly === true;
        favoriteSortMode = ["manual", "asc", "desc"].includes(String(next.favoritesSortMode || "").toLowerCase())
          ? String(next.favoritesSortMode).toLowerCase()
          : "manual";
        if (navigationFavoritesOnly) {
          sortDir = favoriteSortMode;
        }
        sidebarAiProvider = normalizeSidebarAiProvider(next.sidebarAiProvider);
        if (sidebarAiSelect) {
          sidebarAiSelect.value = sidebarAiProvider;
          sidebarAiSelect.title = "Sidebar AI: " + getSidebarAiLabel(sidebarAiProvider);
        }
        updateTopBar();
        return true;
      } catch (err) {
        flashHint("Gagal simpan setting.");
        return false;
      }
    }

    function updateCategoryActionButtons() {
      const inCategoryMode = mode === "categories";
      if (newCategoryBtn) {
        newCategoryBtn.disabled = !inCategoryMode;
        newCategoryBtn.style.opacity = inCategoryMode ? "1" : "0.45";
      }
      if (renameCategoryBtn) {
        const canRename = inCategoryMode && isRenamableCategoryId(activeCategoryId);
        renameCategoryBtn.disabled = !canRename;
        renameCategoryBtn.style.opacity = canRename ? "1" : "0.45";
      }
      if (deleteCategoryBtn) {
        const canDelete = inCategoryMode && isDeletableCategoryId(activeCategoryId);
        deleteCategoryBtn.disabled = !canDelete;
        deleteCategoryBtn.style.opacity = canDelete ? "1" : "0.45";
      }
    }

    function canSummarizePickerUrl(url) {
      if (!url) return false;
      try {
        const parsed = new URL(String(url));
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch (err) {
        return false;
      }
    }

    function getYoutubeSummaryTarget() {
      if (canSummarizePickerUrl(currentTabUrl)) {
        return {
          url: currentTabUrl,
          title: currentTabTitle ? String(currentTabTitle) : (document.title ? String(document.title) : ""),
          categoryId: activeCategoryId ? String(activeCategoryId) : ""
        };
      }
      if (mode === "items" && visibleEntries.length) {
        const entry = visibleEntries[activeIndex];
        if (entry && entry.url && canSummarizePickerUrl(entry.url)) {
          return {
            url: entry.url,
            title: entry.label ? String(entry.label) : "",
            categoryId: entry.categoryId ? String(entry.categoryId) : (activeCategoryId ? String(activeCategoryId) : "")
          };
        }
      }
      const currentEntry = categoryEntries.find((entry) => entry && entry.type === "current" && canSummarizePickerUrl(entry.url));
      if (currentEntry) {
        return {
          url: currentEntry.url,
          title: currentEntry.label ? String(currentEntry.label) : "",
          categoryId: currentEntry.categoryId ? String(currentEntry.categoryId) : (activeCategoryId ? String(activeCategoryId) : "")
        };
      }
      return null;
    }

    async function createCategory() {
      const input = window.prompt("New category name:");
      const name = normalizeCategoryName(input);
      if (!name) return;
      const exists = categories.some((cat) => cat.name && cat.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        window.alert("That category already exists.");
        return;
      }
      // Jika dalam mode hidden, kategori baru juga terus hidden
      const shouldBeHidden = showHiddenCategories >= 1;
      const newCat = { id: makeCategoryId(name), name };
      if (shouldBeHidden) newCat.hidden = true;
      const nextCategories = [
        ...categories,
        newCat
      ];
      try {
        await lpApi.storage.local.set({ [CATEGORY_KEY]: nextCategories });
        replaceCategories(nextCategories);
        activeCategoryId = nextCategories[nextCategories.length - 1].id;
        refreshDerived();
        flashHint('Created "' + name + '"' + (shouldBeHidden ? ' (hidden)' : '') + '.');
      } catch (err) {
        console.error("Category creation failed", err);
        flashHint("Unable to create category.");
      }
    }

    async function renameCategoryById(categoryId) {
      if (mode !== "categories" && mode !== "items") return;
      const targetCategoryId = categoryId ? String(categoryId) : "";
      if (!isRenamableCategoryId(targetCategoryId)) {
        return;
      }
      const category = categories.find((cat) => cat && cat.id === targetCategoryId);
      if (!category) {
        flashHint("Category not found.");
        return;
      }
      const currentName = normalizeCategoryName(category.name);
      const input = window.prompt("Rename category:", currentName);
      const nextName = normalizeCategoryName(input);
      if (!nextName) return;
      if (nextName.toLowerCase() === currentName.toLowerCase()) {
        flashHint("Category name unchanged.");
        return;
      }
      const exists = categories.some((cat) => {
        if (!cat || !cat.id || cat.id === targetCategoryId) return false;
        return normalizeCategoryName(cat.name).toLowerCase() === nextName.toLowerCase();
      });
      if (exists) {
        window.alert("That category already exists.");
        return;
      }
      const nextCategories = categories.map((cat) => {
        if (!cat || !cat.id) return cat;
        if (cat.id !== targetCategoryId) return cat;
        return { ...cat, name: nextName };
      });
      try {
        await lpApi.storage.local.set({ [CATEGORY_KEY]: nextCategories });
        replaceCategories(nextCategories);
        if (activeCategoryId !== targetCategoryId) {
          activeCategoryId = targetCategoryId;
        }
        refreshDerived();
        flashHint('Renamed to "' + nextName + '".');
      } catch (err) {
        console.error("Category rename failed", err);
        flashHint("Unable to rename category.");
      }
    }

    async function renameActiveCategory() {
      if (mode !== "categories" && mode !== "items") return;
      await renameCategoryById(activeCategoryId);
    }

    async function toggleCategoryHiddenById(categoryId) {
      // Fix: buang guard mode !== "categories" supaya boleh hide/unhide dari Items mode juga
      const targetCategoryId = categoryId ? String(categoryId) : "";
      if (!isHideableCategoryId(targetCategoryId)) {
        return false;
      }
      const category = categories.find((cat) => cat && cat.id === targetCategoryId);
      if (!category) {
        flashHint("Category not found.");
        return false;
      }
      const nextHidden = category.hidden !== true;
      const nextCategories = categories.map((cat) => {
        if (!cat || !cat.id) return cat;
        if (cat.id !== targetCategoryId) return cat;
        return { ...cat, hidden: nextHidden };
      });
      try {
        await lpApi.storage.local.set({ [CATEGORY_KEY]: nextCategories });
        replaceCategories(nextCategories);

        // Fix: kalau kategori aktif baru di-hide dan state 0 (hidden tak visible),
        // auto-pindah ke "all" supaya picker tak stuck dalam kategori invisible
        if (nextHidden && showHiddenCategories === 0 && activeCategoryId === targetCategoryId) {
          activeCategoryId = "all";
          await lpApi.storage.local.set({ [SELECTED_CATEGORY_KEY]: "all" }).catch(() => {});
        }

        refreshDerived();
        const categoryName = category.name ? String(category.name) : "Category";
        const hintSuffix = nextHidden && showHiddenCategories === 0
          ? ' — klik 👁️ untuk paparkan semula'
          : '';
        flashHint(nextHidden
          ? 'Kategori "' + categoryName + '" disembunyikan.' + hintSuffix
          : 'Kategori "' + categoryName + '" dipaparkan.');
        return true;
      } catch (err) {
        console.error("Category hide toggle failed", err);
        flashHint("Gagal ubah status hide kategori.");
        return false;
      }
    }

    async function deleteCategoryById(categoryId) {
      const targetCategoryId = categoryId ? String(categoryId) : "";
      if (!targetCategoryId || targetCategoryId === "all") return false;
      if (targetCategoryId === "none" || targetCategoryId === "hidden_none") {
        const label = targetCategoryId === "none" ? "Uncategorized" : "Uncategorize (hidden)";
        const confirmed = window.confirm("Delete all " + label + " links? This cannot be undone.");
        if (!confirmed) return false;
        try {
          const data = await lpApi.storage.local.get(ITEM_KEY);
          const allItems = Array.isArray(data[ITEM_KEY]) ? data[ITEM_KEY] : [];
          const remaining = allItems.filter((item) => item && item.categoryId);
          const nextSelectedCategory = (activeCategoryId === "none" || activeCategoryId === "hidden_none")
            ? activeCategoryId
            : (activeCategoryId ? String(activeCategoryId) : "none");
          await lpApi.storage.local.set({
            [ITEM_KEY]: remaining,
            selectedCategory: nextSelectedCategory
          });
          replaceItems(remaining);
          if (activeCategoryId === "none" || activeCategoryId === "hidden_none") {
            activeCategoryId = activeCategoryId;
          }
          refreshDerived();
          flashHint(label + " links removed.");
          return true;
        } catch (err) {
          flashHint("Unable to delete " + label + " links.");
          return false;
        }
      }
      const category = categories.find((cat) => cat && cat.id === targetCategoryId);
      if (!category) return false;
      const confirmed = window.confirm('Delete category "' + (category.name || "") + '"? Items will move to Uncategorized.');
      if (!confirmed) return false;
      try {
        const nextCategories = categories.filter((cat) => cat && cat.id !== targetCategoryId);
        const data = await lpApi.storage.local.get(ITEM_KEY);
        const allItems = Array.isArray(data[ITEM_KEY]) ? data[ITEM_KEY] : [];
        const nextItems = allItems.map((item) => {
          if (item && item.categoryId === targetCategoryId) {
            const nextItem = { ...item, categoryId: "" };
            if (Object.prototype.hasOwnProperty.call(nextItem, "manualOrder")) {
              delete nextItem.manualOrder;
            }
            return nextItem;
          }
          return item;
        });
        const nextSelectedCategory = activeCategoryId === targetCategoryId
          ? "none"
          : (activeCategoryId ? String(activeCategoryId) : "none");
        await lpApi.storage.local.set({
          [CATEGORY_KEY]: nextCategories,
          [ITEM_KEY]: nextItems,
          selectedCategory: nextSelectedCategory
        });
        replaceItems(nextItems);
        replaceCategories(nextCategories);
        if (activeCategoryId === targetCategoryId) {
          activeCategoryId = "none";
        }
        refreshDerived();
        flashHint('Deleted "' + (category.name || "") + '".');
        return true;
      } catch (err) {
        flashHint("Unable to delete category.");
        return false;
      }
    }

    async function deleteActiveCategory() {
      if (mode !== "categories") return;
      await deleteCategoryById(activeCategoryId);
    }

    function setCategorySwipeDeleteOpen(contentEl, open, immediate = false) {
      if (!contentEl) return;
      const shouldOpen = !!open;
      const deleteBtn = contentEl._swipeDeleteButton;
      if (shouldOpen && categorySwipeDeleteOpenEl && categorySwipeDeleteOpenEl !== contentEl) {
        setCategorySwipeDeleteOpen(categorySwipeDeleteOpenEl, false, immediate);
      }
      const transitionStyle = immediate ? "none" : "transform 180ms ease";
      contentEl.style.transition = transitionStyle;
      contentEl.style.transform = shouldOpen
        ? "translateX(-" + CATEGORY_SWIPE_DELETE_REVEAL_PX + "px)"
        : "translateX(0px)";
      contentEl.dataset.swipeDeleteOpen = shouldOpen ? "1" : "0";
      if (shouldOpen) {
        categorySwipeDeleteOpenEl = contentEl;
      } else if (categorySwipeDeleteOpenEl === contentEl) {
        categorySwipeDeleteOpenEl = null;
      }
      if (deleteBtn) {
        deleteBtn.style.opacity = shouldOpen ? "1" : "0";
        deleteBtn.style.pointerEvents = shouldOpen ? "auto" : "none";
      }
      if (immediate) {
        requestAnimationFrame(() => {
          if (!contentEl || !contentEl.isConnected) return;
          contentEl.style.transition = "transform 180ms ease";
        });
      }
    }

    function closeCategorySwipeDeleteOpen(immediate = false) {
      if (!categorySwipeDeleteOpenEl) return;
      setCategorySwipeDeleteOpen(categorySwipeDeleteOpenEl, false, immediate);
    }

    // Fast highlight update untuk ArrowKey navigation — tukar style rows sahaja tanpa rebuild DOM
    function fastUpdateActiveHighlight(prevIndex, nextIndex) {
      const rows = list.querySelectorAll("[role='button']");
      const prevRow = rows[prevIndex];
      const nextRow = rows[nextIndex];
      if (prevRow && prevRow !== nextRow) {
        if (prevRow.dataset.lastOpened) {
          prevRow.style.background = "rgba(10, 38, 28, 0.97)";
          prevRow.style.boxShadow = "0 0 0 1px " + hexToPickerRgba(pickerHighlightColor, 0.3) + ", 0 0 12px " + hexToPickerRgba(pickerHighlightColor, 0.18) + ", inset 0 0 0 1px " + hexToPickerRgba(pickerHighlightColor, 0.08);
        } else {
          prevRow.style.background = "rgba(18, 18, 18, 0.9)";
          prevRow.style.boxShadow = "0 0 0 1px rgba(255, 255, 255, 0.03)";
        }
        delete prevRow.dataset.active;
      }
      if (nextRow) {
        nextRow.style.background = "rgba(255, 255, 255, 0.08)";
        nextRow.style.boxShadow = "0 0 0 1px rgba(255, 214, 51, 0.25)";
        nextRow.dataset.active = "1";
        if (typeof nextRow.scrollIntoView === "function") {
          nextRow.scrollIntoView({ block: "nearest", behavior: "instant" });
        }
      }
    }

    function setActiveIndex(index) {
      const list = visibleEntries.length ? visibleEntries : filtered;
      if (!list.length) {
        activeIndex = 0;
        return;
      }
      const max = list.length - 1;
      activeIndex = Math.max(0, Math.min(index, max));
      schedulePickerLastLocationSave();
    }

    function clearHoverCategorySelectionTimer() {
      if (hoverCategorySelectTimer) {
        clearTimeout(hoverCategorySelectTimer);
        hoverCategorySelectTimer = null;
      }
      hoverCategorySelectTargetId = "";
    }

    function scheduleHoverCategorySelection(entryId) {
      if (mode !== "categories") return;
      if (mouseCategorySelectionPausedUntil && Date.now() < mouseCategorySelectionPausedUntil) return;
      const targetId = entryId ? String(entryId) : "";
      if (!targetId) return;
      clearHoverCategorySelectionTimer();
      hoverCategorySelectTargetId = targetId;
      hoverCategorySelectTimer = setTimeout(() => {
        hoverCategorySelectTimer = null;
        const pendingTargetId = hoverCategorySelectTargetId;
        hoverCategorySelectTargetId = "";
        if (!pendingTargetId) return;
        if (mode !== "categories") return;
        if (dragMoveItemIds.length) return;
        if (categoryContextMenuState) return;
        const list = visibleEntries.length ? visibleEntries : filtered;
        const nextIndex = list.findIndex((entry) => {
          return entry && entry.type !== "current" && String(entry.id || "") === pendingTargetId;
        });
        if (nextIndex < 0) return;
        const indexChanged = activeIndex !== nextIndex;
        if (indexChanged) {
          setActiveIndex(nextIndex);
        }
        const categoryChanged = syncActiveCategoryFromActiveIndex();
        if (indexChanged || categoryChanged) {
          selectionActive = false;
          // We can't entirely skip render if the category actually changed and the category view needs distinct updates, 
          // but if we are in items mode, we only need to update visuals.
          // Wait, this is 'mode !== "categories"' check above, so we are in items mode. 
          // Actually, if category changed, in items mode, we need full render to show new category contents? 
          // Wait, 'syncActiveCategoryFromActiveIndex' in categories mode changes 'activeCategoryId' and might require right panel update, but this timer requires 'mode === "categories"' at start, and 'mode !== "categories"' inside. 
          // Reverting to render() as CSS hover takes care of fast mouse movement now
          render();
          playHoverSound();
        }
      }, CATEGORY_HOVER_SELECT_DEBOUNCE_MS);
    }

    function syncActiveCategoryFromActiveIndex() {
      if (mode !== "categories") return false;
      const list = visibleEntries.length ? visibleEntries : filtered;
      const entry = list[activeIndex];
      if (!entry || entry.type === "current" || !entry.id) return false;
      const nextCategoryId = String(entry.id);
      if (!nextCategoryId || activeCategoryId === nextCategoryId) return false;
      activeCategoryId = nextCategoryId;
      updateCategoryActionButtons();
      try {
        lpApi.storage.local.set({ selectedCategory: nextCategoryId });
        if (lpApi.runtime && lpApi.runtime.sendMessage) {
          lpApi.runtime.sendMessage({ type: "request-badge" });
        }
      } catch (err) {
        // ignore
      }
      return true;
    }

    function updateItemsSubTitle() {
      if (mode !== "items") return;
      const total = activeCategoryId === "all"
        ? (categoryCounts.all || 0)
        : (activeCategoryId === "hidden_all" || activeCategoryId === "all_hidden")
          ? (categoryCounts.hiddenAll || 0)
          : (activeCategoryId === "hidden_none")
            ? (categoryCounts.hiddenNone || 0)
            : (!activeCategoryId || activeCategoryId === "none")
              ? (categoryCounts.none || 0)
              : (typeof categoryCounts.byId[activeCategoryId] === "number"
                ? categoryCounts.byId[activeCategoryId]
                : 0);
      const label = getCategoryLabel(activeCategoryId);
      let suffix = "";
      if (itemFilter === "fav") {
        if (sortDir === "manual") {
          suffix = " · favorites queue · drag to set next";
        } else if (sortDir === "asc") {
          suffix = " · favorites · oldest first";
        } else {
          suffix = " · favorites · newest first";
        }
      }
      subTitle.textContent = label + " · " + total + " link" + (total === 1 ? "" : "s") + suffix;
    }

    function flashHint(message) {
      if (!message) return;
      hint.textContent = message;
      if (hint._timer) {
        clearTimeout(hint._timer);
      }
      hint._timer = setTimeout(() => {
        updateHint();
      }, 1800);
    }

    function focusFilterInput() {
      setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    }

    function focusPickerSurface() {
      setTimeout(() => {
        try {
          input.blur();
        } catch (err) {
          // ignore
        }
        try {
          panel.focus();
        } catch (err) {
          // ignore
        }
      }, 0);
    }

    function restorePickerFocus() {
      if (mode === "items") {
        focusPickerSurface();
      } else {
        focusFilterInput();
      }
    }

    function buildVisibleEntries() {
      if (mode !== "items") {
        totalPages = 1;
        page = 1;
        visibleEntries = filtered.slice();
        return;
      }
      const pageSize = getPageSize();
      totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      page = clampPage(page, totalPages);
      const start = (page - 1) * pageSize;
      visibleEntries = filtered.slice(start, start + pageSize);
    }

    function isInteractiveRowControlTarget(target) {
      if (!target || typeof target.closest !== "function") return false;
      return !!target.closest(
        "button, select, input, textarea, option, label, a, [data-no-row-drag]",
      );
    }

    function bindRowActionControl(control) {
      if (!control) return;
      control.setAttribute("data-no-row-drag", "1");
      control.draggable = false;
      const stop = (event) => {
        event.stopPropagation();
      };
      control.addEventListener("mousedown", stop);
      control.addEventListener("pointerdown", stop);
      control.addEventListener("dragstart", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    }

    function updatePager() {
      if (mode !== "items" || totalPages <= 1) {
        pager.style.display = "none";
        return;
      }
      pager.style.display = "flex";
      prevPageBtn.disabled = page <= 1;
      nextPageBtn.disabled = page >= totalPages;
      prevPageBtnRight.disabled = page <= 1;
      nextPageBtnRight.disabled = page >= totalPages;
      pageInfo.textContent = "Page " + page + " / " + totalPages;
      styleActionButton(prevPageBtn, "default");
      styleActionButton(nextPageBtn, "default");
      styleActionButton(prevPageBtnRight, "default");
      styleActionButton(nextPageBtnRight, "default");
    }

    function goToPage(nextPage, options = {}) {
      const goingBack = nextPage < page;
      page = clampPage(nextPage, totalPages);
      selectionActive = false;
      if (!options.preserveScroll) {
        needsScrollToTop = true;
        pendingScrollTarget = goingBack ? "bottom" : "top";
      }
      autoPageCancel();
      buildVisibleEntries();
      setActiveIndex(0);
      updatePager();
      render();
      clearPickerLastLocation();
      schedulePickerLastLocationSave();
    }

    function refreshDerived(options = {}) {
      refreshCategoryEntries();
      if (mode === "items") {
        itemEntries = buildItemEntries(activeCategoryId);
        syncSelectedItemsWithCurrentCategory();
        updateItemsSubTitle();
      } else {
        selectedItemIds.clear();
      }
      // updateTopBar() dan updateToolbar() akan dipanggil oleh applyFilter() — elak double call
      applyFilter(options);
    }

    function scheduleRefreshDerived(options = {}) {
      if (pendingRefreshDerivedTimer) {
        clearTimeout(pendingRefreshDerivedTimer);
      }
      pendingRefreshDerivedOptions = {
        preserveActiveEntry: options.preserveActiveEntry === true,
      };
      pendingRefreshDerivedTimer = setTimeout(() => {
        const nextOptions = pendingRefreshDerivedOptions || {};
        pendingRefreshDerivedTimer = null;
        pendingRefreshDerivedOptions = null;
        refreshDerived(nextOptions);
      }, DERIVED_REFRESH_DEBOUNCE_MS);
    }

    function setMoveActionBusy(nextBusy) {
      const shouldBeBusy = !!nextBusy;
      if (moveActionInProgress === shouldBeBusy) return;
      moveActionInProgress = shouldBeBusy;
      if (undoToastBtn) {
        const canUndoNow = !moveActionInProgress && !undoInProgress && (!!pendingUndoMove || !!pendingUndoDelete);
        undoToastBtn.disabled = !canUndoNow;
        undoToastBtn.style.opacity = canUndoNow ? "1" : "0.6";
        undoToastBtn.style.cursor = canUndoNow ? "pointer" : "not-allowed";
      }
      updateToolbar();
      renderDropBar();
    }

    async function updateItems(mutate) {
      try {
        // Guna allItemsCache dahulu untuk elak storage read yang lambat
        // Storage read hanya kalau cache kosong
        let current;
        if (allItemsCache && allItemsCache.length) {
          current = allItemsCache.slice();
        } else {
          const data = await lpApi.storage.local.get(ITEM_KEY);
          current = Array.isArray(data[ITEM_KEY]) ? data[ITEM_KEY] : [];
        }
        const next = mutate(current);
        // UI update dahulu — instant feel
        replaceItems(next);
        refreshDerived({ preserveActiveEntry: true });
        // Persist ke storage di background
        await persistPickerItemsSnapshot(next, current);
        return true;
      } catch (err) {
        return false;
      }
    }

    async function toggleFavoriteById(id) {
      let detail = null;
      const ok = await updateItems((current) => current.map((item) => {
        if (!item || item.id !== id) return item;
        const nextFavorite = item.favorite !== true;
        detail = {
          id,
          fromFavorite: item.favorite === true,
          toFavorite: nextFavorite,
          item: summarizeFavoriteDebugItem({ ...item, favorite: nextFavorite }),
          itemFilter,
          sortDir,
          activeCategoryId,
        };
        return { ...item, favorite: nextFavorite };
      }));
      sendFavoritesDebugLog(
        ok ? "picker-toggle-favorite" : "picker-toggle-favorite-failed",
        detail || { id, itemFilter, sortDir, activeCategoryId },
      );
      return ok;
    }

    async function clearFilteredFavorites() {
      const targetEntries = getClearFavoriteEntries();
      const targetIds = targetEntries
        .map((entry) => (entry && entry.id ? String(entry.id) : ""))
        .filter(Boolean);
      if (!targetIds.length) {
        flashHint("Tiada Favorite untuk dibuang.");
        return false;
      }
      const confirmLabel = targetIds.length === 1
        ? "Buang 1 link ini daripada Favorite? Link tidak akan dipadam."
        : "Buang " + targetIds.length + " link ini daripada Favorite? Link tidak akan dipadam.";
      if (!window.confirm(confirmLabel)) {
        restorePickerFocus();
        return false;
      }
      const targetIdSet = new Set(targetIds);
      let changedCount = 0;
      const ok = await updateItems((current) => current.map((item) => {
        if (!item || !item.id || !targetIdSet.has(String(item.id))) return item;
        if (item.favorite !== true) return item;
        changedCount += 1;
        return { ...item, favorite: false };
      }));
      if (ok && changedCount > 0) {
        pendingFavoriteRestoreIds = targetIds.slice();
      }
      sendFavoritesDebugLog(
        ok ? "picker-clear-favorites" : "picker-clear-favorites-failed",
        {
          count: targetIds.length,
          changedCount,
          activeCategoryId,
          itemFilter,
          query: input && typeof input.value === "string" ? input.value.trim() : "",
        },
      );
      restorePickerFocus();
      if (!ok) {
        flashHint("Gagal clear Favorite.");
        return false;
      }
      if (changedCount === 0) {
        flashHint("Tiada Favorite untuk dibuang.");
        return true;
      }
      updateTopBar();
      flashHint(
        changedCount === 1
          ? "1 link dibuang dari Favorite. Link asal tidak dipadam."
          : changedCount + " link dibuang dari Favorite. Link asal tidak dipadam.",
      );
      return true;
    }

    async function restoreClearedFavorites() {
      const targetIds = getRestorableFavoriteIds();
      if (!targetIds.length) {
        pendingFavoriteRestoreIds = [];
        updateTopBar();
        flashHint("Tiada Favorite untuk dipulihkan.");
        restorePickerFocus();
        return false;
      }
      const targetIdSet = new Set(targetIds);
      let changedCount = 0;
      const ok = await updateItems((current) => current.map((item) => {
        if (!item || !item.id || !targetIdSet.has(String(item.id))) return item;
        if (item.favorite === true) return item;
        changedCount += 1;
        return { ...item, favorite: true };
      }));
      sendFavoritesDebugLog(
        ok ? "picker-restore-favorites" : "picker-restore-favorites-failed",
        {
          count: targetIds.length,
          changedCount,
          activeCategoryId,
          itemFilter,
        },
      );
      if (ok) {
        pendingFavoriteRestoreIds = [];
      }
      updateTopBar();
      restorePickerFocus();
      if (!ok) {
        flashHint("Gagal pulihkan Favorite.");
        return false;
      }
      if (changedCount === 0) {
        flashHint("Tiada Favorite untuk dipulihkan.");
        return true;
      }
      flashHint(
        changedCount === 1
          ? "1 link dipulihkan ke Favorite."
          : changedCount + " link dipulihkan ke Favorite.",
      );
      return true;
    }

    async function deleteItem(entry) {
      if (!entry || !entry.id) return false;
      try {
        const { [TRASH_KEY]: rawTrash, [SETTINGS_KEY]: rawSettings, [ITEM_KEY]: rawItems } = await lpApi.storage.local.get([TRASH_KEY, SETTINGS_KEY, ITEM_KEY]);
        const allItems = allItemsCache.length ? allItemsCache : (Array.isArray(rawItems) ? rawItems : []);
        const trash = Array.isArray(rawTrash) ? rawTrash : [];
        const limitRaw = rawSettings && typeof rawSettings.trashLimit !== "undefined"
          ? Number(rawSettings.trashLimit)
          : (currentSettings && typeof currentSettings.trashLimit !== "undefined" ? currentSettings.trashLimit : 0);
        const trashLimit = Number.isFinite(limitRaw) ? Math.max(0, limitRaw) : 0;
        const prevItems = cloneItemsSnapshot(allItems);
        const prevTrash = cloneItemsSnapshot(trash);
        const target = allItems.find((it) => it && it.id === entry.id) || entry;
        const nextItems = allItems.filter((item) => item && item.id !== entry.id);
        const trashEntry = target
          ? { ...target, deletedAt: new Date().toISOString() }
          : { id: entry.id, deletedAt: new Date().toISOString() };
        const combinedTrash = [trashEntry, ...trash];
        const nextTrash = trashLimit > 0 ? combinedTrash.slice(0, trashLimit) : combinedTrash;

        // UI update first — instant
        replaceItems(nextItems);
        refreshDerived({ preserveActiveEntry: true });

        const wantsLast = pickerStartMode === "last" || pickerStartMode === "last-category" || pickerStartMode === "last_category" || pickerStartMode === "last-page" || pickerStartMode === "last-link";
        if (!wantsLast && mode === "items" && itemEntries.length === 0 && activeCategoryId !== "all") {
          activeCategoryId = "all";
          refreshDerived();
          render();
        }

        queueUndoDelete(prevItems, prevTrash, 1);

        // Tulis ke storage melalui pipeline standard supaya IndexedDB/storage.local sinkron
        // dan storage.onChanged dapat detect echo dengan betul.
        persistPickerItemsSnapshot(nextItems, prevItems).catch(() => {});
        lpApi.storage.local.set({ [TRASH_KEY]: nextTrash }).catch(() => {});

        return true;
      } catch (err) {
        return false;
      }
    }

    function updateItemCategoryById(id, categoryId) {
      updateItems((current) => current.map((item) => {
        if (!item || item.id !== id) return item;
        const nextCategoryId = categoryId ? categoryId : "";
        const existingCategoryId = item.categoryId ? item.categoryId : "";
        if (existingCategoryId === nextCategoryId) return item;
        const nextItem = { ...item, categoryId: nextCategoryId };
        if (Object.prototype.hasOwnProperty.call(nextItem, "manualOrder")) {
          delete nextItem.manualOrder;
        }
        return nextItem;
      }));
    }

    async function updateItemFromLink(id) {
      const item = items.find((i) => i && i.id === id);
      if (!item) { flashHint("Item not found."); return; }

      const targetUrl = item.url || "";
      if (!targetUrl) {
        flashHint("Item has no URL.");
        return;
      }

      flashHint("Fetching link metadata...");

      let fetchedTitle = "";
      let fetchedThumbnail = "";
      try {
        const result = await lpApi.runtime.sendMessage({ type: "picker-fetch-link-meta", url: targetUrl });
        if (result && result.ok) {
          fetchedTitle = result.title || "";
          fetchedThumbnail = result.thumbnail || "";
        }
      } catch (err) { /* guna nilai sedia ada jika gagal */ }

      if (!fetchedTitle) fetchedTitle = item.title || targetUrl;
      if (!fetchedThumbnail) fetchedThumbnail = item.thumbnailUrl || "";

      const ok = await updateItems((current) => current.map((i) => {
        if (!i || i.id !== id) return i;
        return { ...i, title: fetchedTitle, thumbnailUrl: fetchedThumbnail };
      }));
      if (ok) {
        flashHint("Link updated" + (fetchedThumbnail ? " with thumbnail" : "") + ".");
      } else {
        flashHint("Unable to update link.");
      }
    }

    async function reorderItemsWithinActiveCategory(draggedId, targetId) {
      if (!draggedId || !targetId) return false;
      if (draggedId === targetId) return false;
      if (!canManualReorder()) return false;
      let source = [];
      try {
        const data = await lpApi.storage.local.get(ITEM_KEY);
        source = Array.isArray(data[ITEM_KEY]) ? data[ITEM_KEY].slice() : [];
      } catch (err) {
        return false;
      }
      if (!source.length) return false;
      let moved = false;
      let next = source;
      let logDetail = {
        draggedId,
        targetId,
        itemFilter,
        sortDir,
        activeCategoryId,
      };

      if (itemFilter === "fav") {
        const storageCategoryId = getStorageCategoryId(activeCategoryId);
        const favoriteItems = source.filter((item) => {
          if (!item || !item.id || item.favorite !== true) return false;
          if (activeCategoryId === "all") return true;
          const itemCategoryId = item.categoryId ? String(item.categoryId) : "";
          return itemCategoryId === storageCategoryId;
        });
        const orderedFavorites = sortItemsByFavoriteOrder(favoriteItems, "desc");
        const fromFavoriteIndex = orderedFavorites.findIndex((item) => item && item.id === draggedId);
        const toFavoriteIndex = orderedFavorites.findIndex((item) => item && item.id === targetId);
        if (fromFavoriteIndex < 0 || toFavoriteIndex < 0 || fromFavoriteIndex === toFavoriteIndex) {
          return false;
        }
        const movingFavorite = orderedFavorites.splice(fromFavoriteIndex, 1)[0];
        orderedFavorites.splice(toFavoriteIndex, 0, movingFavorite);
        const nextFavoriteOrderById = new Map();
        orderedFavorites.forEach((item, index) => {
          if (!item || !item.id) return;
          nextFavoriteOrderById.set(item.id, index);
        });
        logDetail = {
          ...logDetail,
          mode: "favorites",
          orderedIds: orderedFavorites.slice(0, 12).map((item) =>
            item && item.id ? String(item.id) : "",
          ),
        };
        next = source.map((item) => {
          if (!item || !item.id || !nextFavoriteOrderById.has(item.id)) return item;
          return { ...item, favoriteOrder: nextFavoriteOrderById.get(item.id) };
        });
        moved = true;
      } else {
        const storageCategoryId = getStorageCategoryId(activeCategoryId);
        const categoryItems = source.filter((item) => {
          if (!item || !item.id) return false;
          const itemCategoryId = item.categoryId ? String(item.categoryId) : "";
          return itemCategoryId === storageCategoryId;
        });
        const ordered = sortItemsByManualOrder(categoryItems, "desc");
        const fromIndex = ordered.findIndex((item) => item && item.id === draggedId);
        const toIndex = ordered.findIndex((item) => item && item.id === targetId);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
          return false;
        }
        const movingItem = ordered.splice(fromIndex, 1)[0];
        ordered.splice(toIndex, 0, movingItem);
        const nextOrderById = new Map();
        ordered.forEach((item, index) => {
          if (!item || !item.id) return;
          nextOrderById.set(item.id, index);
        });
        logDetail = {
          ...logDetail,
          mode: "category",
          orderedIds: ordered.slice(0, 12).map((item) =>
            item && item.id ? String(item.id) : "",
          ),
        };
        const reorderedQueue = ordered.slice();
        next = source.map((item) => {
          if (!item || !item.id) return item;
          const itemCategoryId = item.categoryId ? String(item.categoryId) : "";
          if (itemCategoryId !== storageCategoryId) return item;
          const nextItem = reorderedQueue.shift();
          if (!nextItem) return item;
          const manualOrder = nextOrderById.get(nextItem.id);
          return { ...nextItem, manualOrder };
        });
        moved = true;
      }

      if (!moved) return false;
      // Update in-memory state immediately for snappier UI, then persist (write-only, no re-fetch).
      replaceItems(next);
      refreshDerived({ preserveActiveEntry: true });
      try {
        await persistPickerItemsSnapshot(next, source);
        sendFavoritesDebugLog("picker-reorder", logDetail);
      } catch (err) {
        // ignore persist error; in-memory still updated
        sendFavoritesDebugLog("picker-reorder-failed", {
          ...logDetail,
          error: err && err.message ? err.message : String(err),
        });
      }
      return true;
    }

    function clearReorderHoverRow() {
      if (!reorderHoverRowEl) return;
      reorderHoverRowEl.style.outline = "none";
      reorderHoverRowEl.style.outlineOffset = "0";
      reorderHoverRowEl = null;
    }

    function setReorderHoverRow(row) {
      if (!row || reorderHoverRowEl === row) return;
      clearReorderHoverRow();
      reorderHoverRowEl = row;
      reorderHoverRowEl.style.outline = "2px solid rgba(255, 214, 51, 0.55)";
      reorderHoverRowEl.style.outlineOffset = "-2px";
    }

    function clearCategoryDropHoverRow() {
      if (!categoryDropHoverRowEl) return;
      categoryDropHoverRowEl.style.outline = "none";
      categoryDropHoverRowEl.style.outlineOffset = "0";
      categoryDropHoverRowEl = null;
    }

    function setCategoryDropHoverRow(row) {
      if (!row || categoryDropHoverRowEl === row) return;
      clearCategoryDropHoverRow();
      categoryDropHoverRowEl = row;
      categoryDropHoverRowEl.style.outline = "2px solid rgba(100, 207, 255, 0.75)";
      categoryDropHoverRowEl.style.outlineOffset = "-2px";
    }

    function stopDragAutoScroll() {
      dragAutoScrollVelocity = 0;
      if (dragAutoScrollRaf) {
        cancelAnimationFrame(dragAutoScrollRaf);
        dragAutoScrollRaf = 0;
      }
    }

    function dragAutoScrollStep() {
      if (!dragAutoScrollVelocity) {
        dragAutoScrollRaf = 0;
        return;
      }
      list.scrollTop += dragAutoScrollVelocity;
      dragAutoScrollRaf = requestAnimationFrame(dragAutoScrollStep);
    }

    function updateDragAutoScroll(event) {
      if (!event || !dragMoveItemIds.length) {
        stopDragAutoScroll();
        return;
      }
      const rect = list.getBoundingClientRect();
      if (!rect || rect.height <= 0) {
        stopDragAutoScroll();
        return;
      }
      const threshold = Math.min(72, Math.max(40, Math.round(rect.height * 0.18)));
      const y = Number(event.clientY || 0);
      let velocity = 0;
      if (y < rect.top + threshold) {
        velocity = -Math.ceil((rect.top + threshold - y) / 6);
      } else if (y > rect.bottom - threshold) {
        velocity = Math.ceil((y - (rect.bottom - threshold)) / 6);
      }
      velocity = Math.max(-16, Math.min(16, velocity));
      if (!velocity) {
        stopDragAutoScroll();
        return;
      }
      dragAutoScrollVelocity = velocity;
      if (!dragAutoScrollRaf) {
        dragAutoScrollRaf = requestAnimationFrame(dragAutoScrollStep);
      }
    }

    function isBlockedRowDragTarget(row, target) {
      if (!row || !target || typeof target.closest !== "function") return false;
      const blocked = target.closest(
        "button,select,input,textarea,option,a,label,[data-no-row-drag='1'],[contenteditable='true']",
      );
      return !!(blocked && blocked !== row);
    }

    function beginRowDrag(event, row, sourceId, movingIds) {
      const normalizedSourceId = sourceId ? String(sourceId) : "";
      if (!normalizedSourceId) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        return false;
      }
      if (
        isBlockedRowDragTarget(
          row,
          event && event.target ? event.target : null,
        )
      ) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        return false;
      }
      const normalizedIds = Array.from(
        new Set(
          (Array.isArray(movingIds) ? movingIds : [])
            .map((id) => (id ? String(id) : ""))
            .filter(Boolean),
        ),
      );
      if (!normalizedIds.length) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        return false;
      }
      draggingItemId = normalizedSourceId;
      dragMoveItemIds = normalizedIds;
      draggingRowEl = row;
      clearReorderHoverRow();
      clearCategoryDropHoverRow();
      stopDragAutoScroll();
      row.style.willChange = "transform, opacity";
      row.style.opacity = "0.58";
      row.style.transform = "scale(0.995)";
      refreshDropPanelOnDragStart();
      if (event && event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        try {
          event.dataTransfer.setData("text/plain", normalizedIds.join(","));
        } catch (err) {
          // ignore
        }
        try {
          const ghost = document.createElement("div");
          const movingCount = normalizedIds.length || 1;
          ghost.textContent = movingCount + " link";
          ghost.style.position = "fixed";
          ghost.style.top = "-9999px";
          ghost.style.left = "-9999px";
          ghost.style.padding = "6px 10px";
          ghost.style.borderRadius = "10px";
          ghost.style.background = "rgba(20, 20, 20, 0.92)";
          ghost.style.border = "1px solid rgba(255, 214, 51, 0.45)";
          ghost.style.color = "#ffe8a8";
          ghost.style.fontSize = "12px";
          ghost.style.fontFamily = "Segoe UI, Arial, sans-serif";
          ghost.style.pointerEvents = "none";
          document.body.appendChild(ghost);
          event.dataTransfer.setDragImage(ghost, 10, 10);
          setTimeout(() => {
            if (ghost && ghost.parentNode) {
              ghost.parentNode.removeChild(ghost);
            }
          }, 0);
        } catch (err) {
          // ignore
        }
      }
      return true;
    }

    function finishRowDrag() {
      draggingItemId = "";
      dragMoveItemIds = [];
      clearReorderHoverRow();
      clearCategoryDropHoverRow();
      stopDragAutoScroll();
      if (draggingRowEl) {
        draggingRowEl.style.willChange = "";
        draggingRowEl.style.opacity = "1";
        draggingRowEl.style.transform = "none";
      }
      draggingRowEl = null;
      suppressRowClickUntil = Date.now() + 180;
      scheduleDropPanelAutoHide();
      renderDropBar();
    }

    function render() {
      const prevScrollTop = list.scrollTop;
      // Jangan reset scroll jika sedang memindahkan link (drag/drop/move)
      const isResettingScroll = needsScrollToTop && !moveActionInProgress;
      updateTopBar();
      clearHoverCategorySelectionTimer();
      closeCategoryContextMenu();
      closeItemImageContextMenu();
      closeImagePickerPanel();
      categorySwipeDeleteOpenEl = null;
      list.textContent = "";
      renderDropBar();
      const entriesToRender = visibleEntries.length ? visibleEntries : filtered;
      const marqueeStartQueue = [];
      const uniqueCategoryHueById = mode === "categories"
        ? buildDistinctDropChipHues(entriesToRender
          .filter((entry) => entry && entry.type !== "current")
          .map((entry) => ({
            id: entry && entry.id ? String(entry.id) : "",
            label: entry && entry.label ? String(entry.label) : ""
          })))
        : null;
      const manualReorderEnabled = canManualReorder();
      const compactLayout = normalizePickerLayout(pickerLayout) === "compact";
      const accentBorderColor = "rgba(255, 214, 51, 0.65)";
      const accentShadow = "0 0 0 1px rgba(255, 214, 51, 0.25)";
      const accentActiveBackground = "rgba(24, 24, 24, 0.95)";
      const focusBackground = "rgba(255, 255, 255, 0.08)";
      if (!entriesToRender.length) {
        const empty = document.createElement("div");
        if (mode === "items" && itemsLoading) {
          empty.textContent = "Loading links...";
        } else if (mode === "items" && !input.value.trim()) {
          empty.textContent = "No links in this category";
        } else {
          empty.textContent = "No matches";
        }
        empty.style.color = "rgba(255, 255, 255, 0.6)";
        empty.style.padding = "10px 12px";
        list.appendChild(empty);
        return;
      }
      if (activeIndex >= entriesToRender.length) {
        activeIndex = Math.max(0, entriesToRender.length - 1);
      }

      // ── Virtual scroll: bila entri > 500 dalam mod tidak-paginated (carian/semua),
      //    render hanya tetingkap ±150 entri di sekitar activeIndex supaya DOM ringan.
      const VIRTUAL_SCROLL_THRESHOLD = 500;
      const VIRTUAL_WINDOW_SIZE = 150;
      let virtualOffset = 0;   // indeks pertama dalam tetingkap dirender
      let topSpacerEl = null;
      let bottomSpacerEl = null;
      const useVirtualScroll = (
        mode === "items"
        && entriesToRender.length > VIRTUAL_SCROLL_THRESHOLD
        && !visibleEntries.length   // hanya bila semua entries (bukan per-page)
      );
      let entriesToRenderWindow = entriesToRender;
      if (useVirtualScroll) {
        const windowHalf = Math.floor(VIRTUAL_WINDOW_SIZE / 2);
        virtualOffset = Math.max(0, Math.min(activeIndex - windowHalf, entriesToRender.length - VIRTUAL_WINDOW_SIZE));
        entriesToRenderWindow = entriesToRender.slice(virtualOffset, virtualOffset + VIRTUAL_WINDOW_SIZE);
        // Spacer atas
        if (virtualOffset > 0) {
          topSpacerEl = document.createElement("div");
          topSpacerEl.style.cssText = "height:" + (virtualOffset * 52) + "px;flex-shrink:0;";
          topSpacerEl.dataset.virtualSpacer = "top";
        }
        // Spacer bawah
        const remaining = entriesToRender.length - virtualOffset - entriesToRenderWindow.length;
        if (remaining > 0) {
          bottomSpacerEl = document.createElement("div");
          bottomSpacerEl.style.cssText = "height:" + (remaining * 52) + "px;flex-shrink:0;";
          bottomSpacerEl.dataset.virtualSpacer = "bottom";
        }
      }

      let activeRow = null;
      let categoryOrdinal = 0;
      const rowsFragment = document.createDocumentFragment();
      if (topSpacerEl) rowsFragment.appendChild(topSpacerEl);
      entriesToRenderWindow.forEach((entry, index) => {
        const _realIndex = useVirtualScroll ? virtualOffset + index : index;
        const isNumberedCategory = (
          mode === "categories"
          && entry
          && entry.type !== "current"
          && entry.id !== "all"
          && entry.id !== "none"
          && entry.id !== "hidden_none"
        );
        const categoryNumber = isNumberedCategory ? (++categoryOrdinal) : null;
        const row = document.createElement("div");
        row.setAttribute("role", "button");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.gap = mode === "items"
          ? (compactLayout ? "8px" : "10px")
          : "8px";
        row.style.width = "100%";
        row.style.padding = mode === "items"
          ? (compactLayout ? "6px 10px" : "8px 12px")
          : "8px 12px";
        row.style.boxSizing = "border-box";
        row.style.borderRadius = "10px";
        row.style.border = "1px solid rgba(255, 255, 255, 0.08)";
        row.style.background = "rgba(18, 18, 18, 0.9)";
        row.style.boxShadow = pickerAnimReady ? "0 0 0 1px rgba(255, 255, 255, 0.03)" : "none";
        row.style.color = "#fff";
        row.style.cursor = "pointer";
        row.style.fontSize = "14px";
        row.style.textAlign = "left";
        row.style.outline = "none";
        row.style.transition = pickerAnimReady ? "border 0.16s ease, box-shadow 0.16s ease, background 0.16s ease, transform 0.12s ease, opacity 0.12s ease" : "none";
        const canDragRow = mode === "items" && !!entry.id && !!entry.url;
        const canDragCurrentRow = (
          mode === "categories"
          && entry
          && entry.type === "current"
          && !!entry.id
          && !!entry.url
        );
        const canRowDragSource = canDragRow || canDragCurrentRow;

        // State swipe-to-delete untuk item (sync dengan guard dragstart native)
        let itemSwipeActive = false;
        let itemSwiping = false;
        let swipeStartX = 0, swipeStartY = 0;

        if (canDragRow) {
          if (manualReorderEnabled) {
            row.addEventListener("dragover", (event) => {
              if (dragMoveItemIds.length !== 1) return;
              if (!draggingItemId || draggingItemId === entry.id) return;
              event.preventDefault();
              setReorderHoverRow(row);
              updateDragAutoScroll(event);
              if (event && event.dataTransfer) {
                event.dataTransfer.dropEffect = "move";
              }
            });
            row.addEventListener("drop", async (event) => {
              if (dragMoveItemIds.length !== 1) return;
              if (!draggingItemId || draggingItemId === entry.id) return;
              event.preventDefault();
              event.stopPropagation();
              const sourceId = draggingItemId;
              const targetId = entry.id;
              draggingItemId = "";
              dragMoveItemIds = [];
              clearReorderHoverRow();
              clearCategoryDropHoverRow();
              stopDragAutoScroll();
              scheduleDropPanelAutoHide();
              renderDropBar();
              suppressRowClickUntil = Date.now() + 250;
              const moved = await reorderItemsWithinActiveCategory(sourceId, targetId);
              if (moved) {
                flashHint("Susunan link dikemas kini.");
              } else {
                render();
              }
            });
          }
        }
        if (canRowDragSource) {
          row.draggable = true;
          row.style.cursor = "grab";
          row.addEventListener("dragstart", (event) => {
            if (itemSwiping) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            // Direction disambiguation: jika dragstart mendahului pointermove,
            // batalkan drag jika gerakan dominan mendatar (swipe-delete)
            if (canSwipeDeleteItem) {
              const dx = (Number.isFinite(event.clientX) ? event.clientX : 0) - swipeStartX;
              const dy = (Number.isFinite(event.clientY) ? event.clientY : 0) - swipeStartY;
              if (Math.abs(dx) > 4 && Math.abs(dx) > Math.abs(dy) && dx < -4) {
                itemSwiping = true;
                event.preventDefault();
                event.stopPropagation();
                return;
              }
            }
            if (isInteractiveRowControlTarget(event.target)) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            const movingIds = canDragRow
              ? resolveDragMoveItemIds(entry.id)
              : [entry.id];
            beginRowDrag(event, row, entry.id, movingIds);
          });
          row.addEventListener("dragend", () => {
            finishRowDrag();
          });
        }
        row.addEventListener("click", (event) => {
          if (Date.now() < suppressRowClickUntil) return;
          if (mode === "categories" && mouseCategorySelectionPausedUntil && Date.now() < mouseCategorySelectionPausedUntil) {
            return;
          }
          if (mouseHoverPauseUntil && Date.now() < mouseHoverPauseUntil) {
            // ignore accidental mouse while keyboard navigating
            return;
          }
          const isNewTab = event.ctrlKey || event.metaKey;
          selectEntry(entry, isNewTab);
        });
        row.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          // Sekat right-click selama 1.5 saat selepas picker dibuka
          // untuk elak klik kanan tidak sengaja semasa long-press
          if (Date.now() < suppressContextMenuUntil) return;
          selectEntry(entry, true);
        });
        row.addEventListener("auxclick", (event) => {
          if (event.button === 1) { // Middle click
            if (Date.now() < suppressRowClickUntil) return;
            if (mode === "categories" && mouseCategorySelectionPausedUntil && Date.now() < mouseCategorySelectionPausedUntil) return;
            selectEntry(entry, true);
          }
        });
        row.addEventListener("mouseenter", () => {
          if (mode !== "items") return;
          if (dragMoveItemIds.length) return;
          if (categoryContextMenuState) return;
          if (activeIndex === index) return;
          selectionActive = true;
          setActiveIndex(index);
          if (activeRow && activeRow !== row && !activeRow.dataset.isCurrent) {
            const currentEntry = entriesToRender ? entriesToRender[activeIndex] : null;
            const isCategoryCurrent = currentEntry && currentEntry.type !== "current";
            if (activeRow.dataset.lastOpened) {
              activeRow.style.background = "rgba(10, 38, 28, 0.97)";
              activeRow.style.boxShadow = "0 0 0 1px " + hexToPickerRgba(pickerHighlightColor, 0.3) + ", 0 0 12px " + hexToPickerRgba(pickerHighlightColor, 0.18) + ", inset 0 0 0 1px " + hexToPickerRgba(pickerHighlightColor, 0.08);
            } else {
              activeRow.style.background = mode === "categories" && isCategoryCurrent ? "" : "rgba(18, 18, 18, 0.9)";
              activeRow.style.boxShadow = pickerAnimReady ? "0 0 0 1px rgba(255, 255, 255, 0.03)" : "none";
            }
            delete activeRow.dataset.active;
            activeRow = null; 
          }
          if (mouseHoverPauseUntil && Date.now() < mouseHoverPauseUntil) return;
          if (inputMode === "keyboard") return;
          playHoverSound();
        });

        const canSwipeDeleteItem = mode === "items" && !!entry.id;
        let itemAppendEl = row;
        if (canSwipeDeleteItem) {
          // Shell + indikator delete merah di belakang (gaya sama seperti note overlay)
          const shell = document.createElement("div");
          shell.style.cssText = [
            "position:relative", "width:100%", "overflow:hidden",
            "border-radius:10px", "flex-shrink:0"
          ].join(";");
          const delIndicator = document.createElement("div");
          delIndicator.style.cssText = [
            "position:absolute", "inset:0", "display:flex",
            "align-items:center", "justify-content:flex-end",
            "gap:6px", "padding:0 14px",
            "background:linear-gradient(135deg,rgba(210,76,76,0.72),rgba(210,76,76,0.5))",
            "color:#fff3f3", "font-size:11px", "font-weight:700",
            "letter-spacing:0.06em", "text-transform:uppercase",
            "opacity:0", "pointer-events:none",
            "transition:opacity 150ms ease,background 150ms ease",
            "border-radius:10px"
          ].join(";");
          delIndicator.textContent = "🗑 Delete";
          row.style.position = "relative";
          row.style.touchAction = "pan-y";
          row.style.userSelect = "none";
          shell.append(delIndicator, row);
          itemAppendEl = shell;

          const SWIPE_DELETE_PX = 108;
          let ptId = null, startX = 0, startY = 0;
          let swipeOffset = 0, swipeActive = false, swipeTracking = false;
          let suppressClick = false;

          const resetSwipe = () => {
            row.style.transform = "";
            row.style.transition = "";
            row.style.opacity = "";
            delIndicator.style.opacity = "0";
            delIndicator.style.background = "linear-gradient(135deg,rgba(210,76,76,0.72),rgba(210,76,76,0.5))";
            swipeOffset = 0; swipeActive = false; swipeTracking = false;
            itemSwiping = false; itemSwipeActive = false;
            if (ptId != null && row.hasPointerCapture && row.hasPointerCapture(ptId)) {
              try { row.releasePointerCapture(ptId); } catch (_) {}
            }
            ptId = null;
          };

          row.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            if (dragMoveItemIds.length) return;
            itemSwipeActive = true;
            itemSwiping = false;
            ptId = event.pointerId;
            startX = Number.isFinite(event.clientX) ? event.clientX : 0;
            startY = Number.isFinite(event.clientY) ? event.clientY : 0;
            swipeOffset = 0; swipeActive = false; swipeTracking = true;
            suppressClick = false;
            swipeStartX = startX; swipeStartY = startY;
          });

          row.addEventListener("pointermove", (event) => {
            if (!swipeTracking || ptId == null || event.pointerId !== ptId) return;
            const dx = (Number.isFinite(event.clientX) ? event.clientX : 0) - startX;
            const dy = (Number.isFinite(event.clientY) ? event.clientY : 0) - startY;
            if (!swipeActive) {
              if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
              // Gerakan menegak -> biarkan drag/reorder asli berfungsi
              if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
                if (canRowDragSource) row.draggable = true;
                swipeTracking = false;
                itemSwiping = false; itemSwipeActive = false;
                return;
              }
              // Early lock: block dragstart seawal mungkin
              if (dx < -6 && Math.abs(dx) > Math.abs(dy) + 2) {
                itemSwiping = true;
                if (dx <= -10) {
                  swipeActive = true;
                  suppressClick = true;
                  if (row.setPointerCapture && ptId !== null) {
                    try { row.setPointerCapture(ptId); } catch (_) {}
                  }
                } else {
                  return;
                }
              } else {
                if (dx > -10 || Math.abs(dx) < Math.abs(dy)) return;
                swipeActive = true;
                itemSwiping = true;
                suppressClick = true;
                if (row.setPointerCapture && ptId !== null) {
                  try { row.setPointerCapture(ptId); } catch (_) {}
                }
              }
            }
            event.preventDefault();
            swipeOffset = Math.max(-130, Math.min(0, dx));
            row.style.transition = "none";
            row.style.transform = "translateX(" + swipeOffset + "px)";
            const progress = Math.min(1, Math.abs(swipeOffset) / SWIPE_DELETE_PX);
            delIndicator.style.opacity = String(progress);
            if (Math.abs(swipeOffset) >= SWIPE_DELETE_PX) {
              delIndicator.style.background = "linear-gradient(135deg,rgba(210,76,76,0.96),rgba(210,76,76,0.72))";
            } else {
              delIndicator.style.background = "linear-gradient(135deg,rgba(210,76,76,0.72),rgba(210,76,76,0.5))";
            }
          });

          const finalizeSwipe = () => {
            if (ptId == null) return;
            const shouldDelete = swipeActive && Math.abs(swipeOffset) >= SWIPE_DELETE_PX;
            if (suppressClick) suppressRowClickUntil = Date.now() + 260;
            if (!shouldDelete) {
              row.style.transition = "transform 200ms ease";
              resetSwipe();
              return;
            }
            // Animate out kemudian padam (undo disediakan oleh deleteItem)
            row.style.transition = "transform 200ms ease, opacity 200ms ease";
            row.style.transform = "translateX(-100%)";
            row.style.opacity = "0";
            resetSwipe();
            const _entry = entry;
            setTimeout(() => { deleteItem(_entry); }, 180);
          };

          row.addEventListener("pointerup", (event) => {
            if (ptId == null || event.pointerId !== ptId) return;
            finalizeSwipe();
          });
          row.addEventListener("pointercancel", (event) => {
            if (ptId == null || event.pointerId !== ptId) return;
            row.style.transition = "transform 200ms ease";
            resetSwipe();
            suppressClick = false;
          });
        }
        const isActiveRow = (useVirtualScroll ? _realIndex : index) === activeIndex;
        if (isActiveRow) {
          row.dataset.active = "1";
          activeRow = row;
        }
        // Semak sama ada ini adalah link terakhir dibuka (untuk highlight khas)
        const isLastOpenedRow = mode !== "categories"
          && !!lastOpenedItemId
          && !!(
            (entry.id && String(entry.id) === lastOpenedItemId)
            || (entry.url && String(entry.url) === lastOpenedItemId)
          );        if (isLastOpenedRow) {
          // Highlight khas "link terakhir dibuka"
          row.dataset.lastOpened = "1";
          row.style.border = "2px solid " + hexToPickerRgba(pickerHighlightColor, 0.85);
          row.style.boxShadow = "0 0 0 1px " + hexToPickerRgba(pickerHighlightColor, 0.3) + ", 0 0 12px " + hexToPickerRgba(pickerHighlightColor, 0.18) + ", inset 0 0 0 1px " + hexToPickerRgba(pickerHighlightColor, 0.08);
          row.style.background = "rgba(10, 38, 28, 0.97)";
          // Label "Last opened" di sudut kanan atas
          const lastOpenedBadge = document.createElement("div");
          lastOpenedBadge.textContent = "↩ Last opened";
          lastOpenedBadge.style.cssText = [
            "position:absolute",
            "top:-1px",
            "right:10px",
            "font-size:9px",
            "font-weight:700",
            "letter-spacing:0.04em",
            "text-transform:uppercase",
            "color:" + hexToPickerRgba(pickerHighlightColor, 1),
            "background:rgba(10,38,28,0.97)",
            "padding:1px 6px",
            "border-radius:0 0 6px 6px",
            "border:1px solid " + hexToPickerRgba(pickerHighlightColor, 0.4),
            "border-top:none",
            "pointer-events:none",
            "z-index:2",
            "line-height:1.6",
          ].join(";");
          row.style.position = "relative";
          row.appendChild(lastOpenedBadge);
        } else if (isActiveRow) {
          row.style.background = focusBackground;
          row.style.boxShadow = accentShadow;
        }

        if (mode === "categories") {
          if (entry.type === "current") {
            const badge = document.createElement("div");
            badge.style.width = "32px";
            badge.style.height = "32px";
            badge.style.borderRadius = "12px";
            badge.style.display = "flex";
            badge.style.alignItems = "center";
            badge.style.justifyContent = "center";
            badge.style.flex = "0 0 auto";
            badge.style.overflow = "hidden";
            badge.style.background = "rgba(255, 255, 255, 0.08)";

            const iconUrl = entry.faviconUrl || guessFavicon(entry.url);
            const host = safeHostname(entry.url);
            if (iconUrl) {
              const img = document.createElement("img");
              img.src = iconUrl;
              img.alt = "";
              img.style.width = "20px";
              img.style.height = "20px";
              img.style.borderRadius = "5px";
              img.addEventListener("error", () => {
                img.remove();
                badge.textContent = makeBadgeText(host);
                badge.style.background = colorFromString(host || entry.url || "local");
                badge.style.color = "#fff";
                badge.style.fontSize = "12px";
                badge.style.fontWeight = "600";
              });
              badge.appendChild(img);
            } else {
              badge.textContent = makeBadgeText(host);
              badge.style.background = colorFromString(host || entry.url || "local");
              badge.style.color = "#fff";
              badge.style.fontSize = "12px";
              badge.style.fontWeight = "600";
            }

            const info = document.createElement("div");
            info.style.display = "flex";
            info.style.flexDirection = "column";
            info.style.gap = "4px";
            info.style.minWidth = "0";
            info.style.flex = "1 1 auto";

            const label = document.createElement("span");
            label.textContent = entry.label || "Current tab";
            label.style.fontWeight = "600";
            label.style.width = "100%";
            label.style.whiteSpace = "nowrap";
            label.style.overflow = "hidden";
            label.style.textOverflow = "ellipsis";

            const meta = document.createElement("span");
            meta.textContent = entry.meta || "Current tab";
            meta.style.color = "rgba(255, 255, 255, 0.6)";
            meta.style.fontSize = "12px";
            meta.style.width = "100%";
            meta.style.whiteSpace = "nowrap";
            meta.style.overflow = "hidden";
            meta.style.textOverflow = "ellipsis";

            info.append(label, meta);

            const actions = document.createElement("div");
            actions.style.display = "flex";
            actions.style.alignItems = "center";
            actions.style.gap = "6px";
            actions.style.flex = "0 0 auto";

            const select = document.createElement("select");
            styleCategorySelect(select);
            populateCategorySelect(select, entry.categoryId);
            applyCategorySelectTone(select, entry.categoryId);
            bindRowActionControl(select);
            select.addEventListener("click", (event) => event.stopPropagation());
            select.addEventListener("mousedown", (event) => event.stopPropagation());
            select.addEventListener("change", (event) => {
              event.stopPropagation();
              const nextCategoryId = event.target.value;
              applyCategorySelectTone(select, nextCategoryId);
              updateItemCategoryById(entry.id, nextCategoryId);
            });

            const favBtn = document.createElement("button");
            favBtn.type = "button";
            favBtn.textContent = entry.favorite ? "★" : "☆";
            favBtn.title = entry.favorite ? "Unfavorite (F)" : "Favorite (F)";
            styleActionButton(favBtn, entry.favorite ? "favorite" : "default");
            bindRowActionControl(favBtn);
            favBtn.addEventListener("click", (event) => {
              event.stopPropagation();
              toggleFavoriteById(entry.id);
            });

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.textContent = "×";
            deleteBtn.title = "Delete (D)";
            styleActionButton(deleteBtn, "danger");
            bindRowActionControl(deleteBtn);
            deleteBtn.addEventListener("click", (event) => {
              event.stopPropagation();
              deleteItem(entry);
            });

            const updateBtn = document.createElement("button");
            updateBtn.type = "button";
            updateBtn.textContent = "↻";
            updateBtn.title = "Update This Link";
            styleActionButton(updateBtn, "default");
            bindRowActionControl(updateBtn);
            updateBtn.addEventListener("click", async (event) => {
              event.stopPropagation();
              if (updateBtn.disabled) return;
              updateBtn.disabled = true;
              updateBtn.textContent = "⏳";
              try {
                await updateItemFromLink(entry.id);
              } finally {
                updateBtn.disabled = false;
                updateBtn.textContent = "↻";
              }
            });

            actions.append(select, favBtn, updateBtn, deleteBtn);
            row.append(badge, info, actions);
          } else {
            const countValue = typeof entry.count === "number" ? entry.count : 0;
            const categoryKey = getDropTargetKey(entry.id);
            const categoryHueOverride = uniqueCategoryHueById && uniqueCategoryHueById.has(categoryKey)
              ? uniqueCategoryHueById.get(categoryKey)
              : null;
            const categoryPalette = getCategoryRowPalette(entry.id, categoryHueOverride);

            row.style.border = "1px solid " + categoryPalette.rowBorder;
            row.style.background = categoryPalette.rowBackground;

            const labelWrap = document.createElement("div");
            labelWrap.style.display = "flex";
            labelWrap.style.alignItems = "center";
            labelWrap.style.gap = "8px";
            labelWrap.style.flex = "1 1 auto";
            labelWrap.style.minWidth = "0";

            const colorDot = document.createElement("span");
            colorDot.setAttribute("aria-hidden", "true");
            colorDot.style.width = "9px";
            colorDot.style.height = "9px";
            colorDot.style.borderRadius = "999px";
            colorDot.style.background = categoryPalette.dot;
            colorDot.style.boxShadow = "0 0 0 1px " + categoryPalette.dotRing;
            colorDot.style.flex = "0 0 auto";

            const label = document.createElement("span");
            label.dataset.marquee = "label";
            label.style.fontWeight = entry.id === activeCategoryId ? "600" : "500";
            label.style.flex = "1 1 auto";
            label.style.minWidth = "0";
            label.style.whiteSpace = "nowrap";
            label.style.overflow = "hidden";
            label.style.textOverflow = "ellipsis";
            const labelInner = document.createElement("span");
            labelInner.textContent = isNumberedCategory ? (categoryNumber + ". " + entry.label) : entry.label;
            labelInner.style.display = "inline-block";
            labelInner.style.paddingRight = "12px";
            label.__lpMarqueeInner = labelInner;
            label.appendChild(labelInner);

            labelWrap.append(colorDot, label);

            const count = document.createElement("span");
            count.textContent = String(countValue);
            count.style.color = categoryPalette.countColor;
            count.style.fontSize = "12px";
            count.style.fontWeight = "600";
            count.style.padding = "2px 8px";
            count.style.borderRadius = "999px";
            count.style.border = "1px solid " + categoryPalette.countBorder;
            count.style.background = categoryPalette.countBackground;
            count.style.flex = "0 0 auto";
            count.style.minWidth = "32px";
            count.style.whiteSpace = "nowrap";
            count.style.textAlign = "center";

            row.addEventListener("contextmenu", (event) => {
              // Sekat right-click selama 1.5 saat selepas picker dibuka
              if (Date.now() < suppressContextMenuUntil) return;
              openCategoryContextMenu(event, entry);
            });
            row.addEventListener("mouseenter", () => {
              if (mode !== "categories") return;
              if (entry.type === "current") return;
              if (dragMoveItemIds.length) return;
              if (categoryContextMenuState) return;
              if (mouseHoverPauseUntil && Date.now() < mouseHoverPauseUntil) return;
              scheduleHoverCategorySelection(entry.id);
            });

            const rowContent = document.createElement("div");
            rowContent.style.display = "flex";
            rowContent.style.alignItems = "center";
            rowContent.style.justifyContent = "space-between";
            rowContent.style.gap = "10px";
            rowContent.style.width = "100%";
            rowContent.style.minWidth = "0";
            rowContent.style.position = "relative";
            rowContent.style.zIndex = "1";
            rowContent.style.transition = pickerAnimReady ? "transform 180ms ease" : "none";
            rowContent.style.transform = "translateX(0px)";
            rowContent.style.touchAction = "pan-y";
            rowContent.dataset.swipeDeleteOpen = "0";
            rowContent.append(labelWrap, count);

            if (entry.id === activeCategoryId) {
              row.style.border = "1px solid rgba(255, 214, 51, 0.55)";
              row.style.boxShadow = "0 0 0 1px rgba(255, 214, 51, 0.2), inset 0 0 0 1px " + categoryPalette.countBorder;
            }
            const startLabelMarqueeLoop = () => startCategoryLabelMarquee(label, true);
            const stopLabelMarqueeLoop = () => stopCategoryLabelMarquee(label);
            if (isActiveRow) marqueeStartQueue.push(startLabelMarqueeLoop);
            row.addEventListener("mouseenter", () => startLabelMarqueeLoop());
            row.addEventListener("mouseleave", stopLabelMarqueeLoop);
            row.addEventListener("focusin", () => startLabelMarqueeLoop());
            row.addEventListener("focusout", stopLabelMarqueeLoop);
            label.addEventListener("mouseenter", () => startLabelMarqueeLoop());
            label.addEventListener("mouseleave", stopLabelMarqueeLoop);

            const isCategoryDropTarget = !!entry.id && entry.id !== "all";
            if (isCategoryDropTarget) {
              const targetCategoryId = entry.id === "none" || entry.id === "hidden_none" ? "" : String(entry.id);
              row.addEventListener("dragover", (event) => {
                if (!dragMoveItemIds.length) return;
                const dragInfo = buildDragMoveInfo(dragMoveItemIds);
                event.preventDefault();
                setCategoryDropHoverRow(row);
                if (event && event.dataTransfer) {
                  event.dataTransfer.dropEffect = canDropWithDragInfo(dragInfo, targetCategoryId)
                    ? "move"
                    : "none";
                }
              });
              row.addEventListener("dragleave", () => {
                if (categoryDropHoverRowEl === row) {
                  clearCategoryDropHoverRow();
                }
              });
              row.addEventListener("drop", async (event) => {
                if (!dragMoveItemIds.length) return;
                const dragInfo = buildDragMoveInfo(dragMoveItemIds);
                event.preventDefault();
                event.stopPropagation();
                const movingIds = dragMoveItemIds.slice();
                draggingItemId = "";
                dragMoveItemIds = [];
                clearCategoryDropHoverRow();
                clearReorderHoverRow();
                stopDragAutoScroll();
                if (draggingRowEl) {
                  draggingRowEl.style.willChange = "";
                  draggingRowEl.style.opacity = "1";
                  draggingRowEl.style.transform = "none";
                }
                draggingRowEl = null;
                suppressRowClickUntil = Date.now() + 250;
                scheduleDropPanelAutoHide();
                renderDropBar();
                if (dragInfo.totalFound <= 0) {
                  flashHint("Link belum disimpan. Tekan Save dahulu.");
                  return;
                }
                const result = await moveItemsToCategoryByIds(movingIds, targetCategoryId, { enableUndo: true });
                if (result.busy) {
                  flashHint("Sedang memproses pindahan. Cuba lagi sebentar.");
                  return;
                }
                if (result.invalidTarget) {
                  flashHint("Kategori sasaran tidak lagi wujud.");
                  return;
                }
                if (!result.ok) {
                  flashHint("Gagal pindah link.");
                  return;
                }
                if (result.movedCount > 0) {
                  flashHint("Berjaya pindah " + result.movedCount + " link.");
                } else {
                  flashHint("Link sudah berada dalam kategori itu.");
                }
              });
            }

            const canSwipeDeleteCategory = !!entry.id && entry.id !== "all" && entry.id !== "none" && entry.id !== "hidden_none";
            if (canSwipeDeleteCategory) {
              row.style.position = "relative";
              row.style.overflow = "hidden";
              const deleteSlideBtn = document.createElement("button");
              deleteSlideBtn.type = "button";
              deleteSlideBtn.textContent = "Delete";
              deleteSlideBtn.title = "Delete category";
              deleteSlideBtn.style.position = "absolute";
              deleteSlideBtn.style.right = "10px";
              deleteSlideBtn.style.top = "50%";
              deleteSlideBtn.style.transform = "translateY(-50%)";
              deleteSlideBtn.style.width = "74px";
              deleteSlideBtn.style.height = "32px";
              deleteSlideBtn.style.borderRadius = "10px";
              deleteSlideBtn.style.border = "1px solid rgba(255, 179, 181, 0.5)";
              deleteSlideBtn.style.background = "rgba(232, 76, 79, 0.3)";
              deleteSlideBtn.style.color = "#ffd2d3";
              deleteSlideBtn.style.fontSize = "12px";
              deleteSlideBtn.style.cursor = "pointer";
              deleteSlideBtn.style.zIndex = "0";
              deleteSlideBtn.style.opacity = "0";
              deleteSlideBtn.style.pointerEvents = "none";
              deleteSlideBtn.style.transition = "opacity 140ms ease";
              rowContent._swipeDeleteButton = deleteSlideBtn;
              deleteSlideBtn.addEventListener("click", async (event) => {
                event.stopPropagation();
                if (deleteSlideBtn.disabled) return;
                deleteSlideBtn.disabled = true;
                deleteSlideBtn.style.opacity = "0.6";
                suppressRowClickUntil = Date.now() + 260;
                setCategorySwipeDeleteOpen(rowContent, false, true);
                try {
                  await deleteCategoryById(String(entry.id));
                } finally {
                  if (deleteSlideBtn && deleteSlideBtn.isConnected) {
                    deleteSlideBtn.disabled = false;
                    const stillOpen = rowContent && rowContent.dataset && rowContent.dataset.swipeDeleteOpen === "1";
                    deleteSlideBtn.style.opacity = stillOpen ? "1" : "0";
                    deleteSlideBtn.style.pointerEvents = stillOpen ? "auto" : "none";
                  }
                }
              });

              let swipeTracking = false;
              let swipeDragging = false;
              let swipePointerId = null;
              let swipeStartX = 0;
              let swipeStartY = 0;
              let swipeStartOffset = 0;
              let swipeCurrentOffset = 0;

              const clampSwipeOffset = (offset) => {
                return Math.max(-CATEGORY_SWIPE_DELETE_REVEAL_PX, Math.min(0, offset));
              };

              const applySwipeOffset = (offset) => {
                swipeCurrentOffset = clampSwipeOffset(offset);
                rowContent.style.transform = "translateX(" + Math.round(swipeCurrentOffset) + "px)";
                if (rowContent._swipeDeleteButton) {
                  const reveal = Math.max(0, Math.min(1, Math.abs(swipeCurrentOffset) / CATEGORY_SWIPE_DELETE_REVEAL_PX));
                  rowContent._swipeDeleteButton.style.opacity = String(reveal);
                  rowContent._swipeDeleteButton.style.pointerEvents = "none";
                }
              };

              rowContent.addEventListener("pointerdown", (event) => {
                if (event.button !== 0) return;
                if (dragMoveItemIds.length) return;
                if (categorySwipeDeleteOpenEl && categorySwipeDeleteOpenEl !== rowContent) {
                  setCategorySwipeDeleteOpen(categorySwipeDeleteOpenEl, false);
                }
                swipeTracking = true;
                swipeDragging = false;
                swipePointerId = typeof event.pointerId === "number" ? event.pointerId : null;
                swipeStartX = Number.isFinite(event.clientX) ? event.clientX : 0;
                swipeStartY = Number.isFinite(event.clientY) ? event.clientY : 0;
                swipeStartOffset = rowContent.dataset.swipeDeleteOpen === "1"
                  ? -CATEGORY_SWIPE_DELETE_REVEAL_PX
                  : 0;
                swipeCurrentOffset = swipeStartOffset;
                rowContent.style.transition = "none";
                if (rowContent.setPointerCapture && swipePointerId !== null) {
                  try {
                    rowContent.setPointerCapture(swipePointerId);
                  } catch (err) {
                    // ignore
                  }
                }
              });

              rowContent.addEventListener("pointermove", (event) => {
                if (!swipeTracking) return;
                if (swipePointerId !== null && event.pointerId !== swipePointerId) return;
                const dx = (Number.isFinite(event.clientX) ? event.clientX : 0) - swipeStartX;
                const dy = (Number.isFinite(event.clientY) ? event.clientY : 0) - swipeStartY;
                if (!swipeDragging) {
                  if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
                  if (Math.abs(dx) <= Math.abs(dy)) {
                    swipeTracking = false;
                    rowContent.style.transition = "transform 180ms ease";
                    return;
                  }
                  swipeDragging = true;
                }
                event.preventDefault();
                applySwipeOffset(swipeStartOffset + dx);
              });

              const finishSwipe = (event) => {
                if (!swipeTracking) return;
                if (swipePointerId !== null && event && typeof event.pointerId === "number" && event.pointerId !== swipePointerId) {
                  return;
                }
                swipeTracking = false;
                rowContent.style.transition = "transform 180ms ease";
                if (swipeDragging) {
                  suppressRowClickUntil = Date.now() + 220;
                  const shouldOpen = swipeCurrentOffset <= -(CATEGORY_SWIPE_DELETE_REVEAL_PX * 0.45);
                  setCategorySwipeDeleteOpen(rowContent, shouldOpen);
                }
                swipeDragging = false;
                if (rowContent.releasePointerCapture && swipePointerId !== null) {
                  try {
                    rowContent.releasePointerCapture(swipePointerId);
                  } catch (err) {
                    // ignore
                  }
                }
                swipePointerId = null;
              };

              rowContent.addEventListener("pointerup", finishSwipe);
              rowContent.addEventListener("pointercancel", finishSwipe);
              rowContent.addEventListener("click", (event) => {
                if (rowContent.dataset.swipeDeleteOpen === "1" && Date.now() >= suppressRowClickUntil) {
                  event.stopPropagation();
                  suppressRowClickUntil = Date.now() + 180;
                  setCategorySwipeDeleteOpen(rowContent, false);
                }
              });

              row.append(deleteSlideBtn, rowContent);
            } else {
              row.append(rowContent);
            }
          }
        }
        if (mode !== "categories") {
          // Jangan override highlight "last opened" dengan styling _isCurrent
          if (entry._isCurrent && !isLastOpenedRow) {
            row.style.border = "1px solid rgba(255, 214, 51, 0.45)";
            row.style.boxShadow = "0 0 0 1px rgba(255, 214, 51, 0.2)";
          }

          const numberEl = document.createElement("span");
          // Kira nombor sebenar berdasarkan sama ada render dari visibleEntries (per-page),
          // virtual scroll window, atau filtered (semua items).
          const _entryIndex = useVirtualScroll ? _realIndex : index;
          const globalIndex = visibleEntries.length
            ? (page - 1) * getPageSize() + _entryIndex + 1
            : _entryIndex + 1;
          numberEl.textContent = globalIndex + ".";
          numberEl.style.cssText = [
            "min-width:36px",
            "text-align:center",
            "font-size:15px",
            "font-weight:800",
            "color:" + theme.accent,
            "background:rgba(255,214,51,0.10)",
            "border-radius:8px",
            "padding:2px 4px",
            "flex:0 0 auto",
            "user-select:none",
          ].join(";");

          const checkboxWrap = document.createElement("div");
          checkboxWrap.dataset.noRowDrag = "1";
          checkboxWrap.style.display = "flex";
          checkboxWrap.style.alignItems = "center";
          checkboxWrap.style.justifyContent = "center";
          checkboxWrap.style.flex = "0 0 auto";
          checkboxWrap.style.width = "28px";
          checkboxWrap.style.height = "28px";
          checkboxWrap.style.borderRadius = "8px";
          checkboxWrap.style.marginLeft = "-2px";
          checkboxWrap.style.padding = "4px";
          checkboxWrap.style.boxSizing = "border-box";
          checkboxWrap.style.transition = "background 140ms ease";
          checkboxWrap.addEventListener("mouseenter", () => {
            checkboxWrap.style.background = "rgba(255, 255, 255, 0.06)";
          });
          checkboxWrap.addEventListener("mouseleave", () => {
            checkboxWrap.style.background = "transparent";
          });
          checkboxWrap.addEventListener("click", (event) => {
            event.stopPropagation();
            event.preventDefault();
            checkbox.checked = !checkbox.checked;
            setItemSelected(entry.id, checkbox.checked);
          });
          checkboxWrap.addEventListener("mousedown", (event) => {
            event.stopPropagation();
          });
          checkboxWrap.tabIndex = 0;
          checkboxWrap.addEventListener("keydown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.key === "Enter" || event.key === " ") {
              checkbox.checked = !checkbox.checked;
              setItemSelected(entry.id, checkbox.checked);
            }
          });

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = selectedItemIds.has(entry.id);
          checkbox.style.width = "16px";
          checkbox.style.height = "16px";
          checkbox.style.cursor = "pointer";
          checkbox.style.accentColor = "#ffd633";
          checkbox.addEventListener("click", (event) => {
            event.stopPropagation();
          });
          checkbox.addEventListener("mousedown", (event) => {
            event.stopPropagation();
          });
          checkbox.addEventListener("change", (event) => {
            event.stopPropagation();
            setItemSelected(entry.id, !!event.target.checked);
          });
          checkboxWrap.appendChild(checkbox);

          const badge = document.createElement("div");
          badge.style.width = compactLayout ? "48px" : "56px";
          badge.style.height = compactLayout ? "28px" : "32px";
          badge.style.borderRadius = "8px";
          badge.style.display = "flex";
          badge.style.alignItems = "center";
          badge.style.justifyContent = "center";
          badge.style.flex = "0 0 auto";
          badge.style.overflow = "hidden";
          badge.style.position = "relative";
          badge.style.background = "rgba(255, 255, 255, 0.08)";
          renderItemEntryBadge(badge, entry);

          // Right-click pada badge sahaja → menu tukar favicon/thumbnail
          badge.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            event.stopPropagation(); // elak row contextmenu (open new tab) terpanggil
            if (Date.now() < suppressContextMenuUntil) return;
            openItemImageContextMenu(event, entry);
          });

          const info = document.createElement("div");
          info.style.display = "flex";
          info.style.flexDirection = "column";
          info.style.gap = "2px";
          info.style.minWidth = "0";
          info.style.flex = "1 1 auto";

          const label = document.createElement("span");
          label.dataset.marquee = "label";
          label.style.fontWeight = "600";
          label.style.fontSize = compactLayout ? "13px" : "14px";
          label.style.width = "100%";
          label.style.whiteSpace = "nowrap";
          label.style.overflow = "hidden";
          label.style.textOverflow = "ellipsis";
          const labelInner = document.createElement("span");
          labelInner.textContent = entry.label;
          labelInner.style.display = "inline-block";
          labelInner.style.paddingRight = "12px";
          label.__lpMarqueeInner = labelInner;
          label.appendChild(labelInner);

          // Domain chip + saved date row
          const metaRow = document.createElement("div");
          metaRow.style.cssText = [
            "display:flex",
            "align-items:center",
            "gap:8px",
            "width:100%",
            "min-width:0",
          ].join(";");

          const domainChip = document.createElement("span");
          const domainText = entry.meta || entry.url || "";
          domainChip.textContent = domainText;
          domainChip.style.cssText = [
            "color:" + theme.muted,
            "font-size:" + (compactLayout ? "10px" : "11px"),
            "white-space:nowrap",
            "overflow:hidden",
            "text-overflow:ellipsis",
            "min-width:0",
            "background:" + (typeof theme.inputBg === "string" ? theme.inputBg : "rgba(255,255,255,0.06)"),
            "padding:1px 6px",
            "border-radius:4px",
            "max-width:60%",
          ].join(";");

          const dateEl = document.createElement("span");
          dateEl.textContent = entry.savedAtFormatted || "";
          dateEl.style.cssText = [
            "color:" + theme.muted,
            "font-size:" + (compactLayout ? "9px" : "10px"),
            "opacity:0.7",
            "white-space:nowrap",
            "flex:0 0 auto",
            "margin-left:auto",
          ].join(";");

          // Reading time chip — tunjuk jika ada readingTime > 0
          if (entry.readingTime && entry.readingTime > 0) {
            const rtChip = document.createElement("span");
            rtChip.textContent = "\u23F1 " + entry.readingTime + "m";
            rtChip.title = entry.wordCount > 0
              ? entry.wordCount + " patah perkataan \u2022 " + entry.readingTime + " min baca"
              : entry.readingTime + " min baca";
            rtChip.style.cssText = [
              "color:" + theme.muted,
              "font-size:" + (compactLayout ? "9px" : "10px"),
              "white-space:nowrap",
              "flex:0 0 auto",
              "opacity:0.75",
              "background:rgba(255,255,255,0.05)",
              "padding:1px 5px",
              "border-radius:4px",
            ].join(";");
            metaRow.append(domainChip, rtChip, dateEl);
          } else {
            metaRow.append(domainChip, dateEl);
          }
          info.append(label, metaRow);

          const actions = document.createElement("div");
          actions.style.display = "flex";
          actions.style.alignItems = "center";
          actions.style.gap = compactLayout ? "3px" : "4px";
          actions.style.flex = "0 0 auto";

          const select = document.createElement("select");
          styleCategorySelect(select);
          populateCategorySelect(select, entry.categoryId);
          applyCategorySelectTone(select, entry.categoryId);
          bindRowActionControl(select);
          select.addEventListener("click", (event) => event.stopPropagation());
          select.addEventListener("mousedown", (event) => event.stopPropagation());
          select.addEventListener("change", (event) => {
            event.stopPropagation();
            const nextCategoryId = event.target.value;
            applyCategorySelectTone(select, nextCategoryId);
            updateItemCategoryById(entry.id, nextCategoryId);
          });

          const favBtn = document.createElement("button");
          favBtn.type = "button";
          favBtn.textContent = entry.favorite ? "★" : "☆";
          favBtn.title = entry.favorite ? "Unfavorite (F)" : "Favorite (F)";
          styleActionButton(favBtn, entry.favorite ? "favorite" : "default");
          bindRowActionControl(favBtn);
          favBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            toggleFavoriteById(entry.id);
          });

          const deleteBtn = document.createElement("button");
          deleteBtn.type = "button";
          deleteBtn.textContent = "×";
          deleteBtn.title = "Delete (D)";
          styleActionButton(deleteBtn, "danger");
          bindRowActionControl(deleteBtn);
          deleteBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            deleteItem(entry);
          });

          const updateBtn = document.createElement("button");
          updateBtn.type = "button";
          updateBtn.textContent = "↻";
          updateBtn.title = "Update This Link";
          styleActionButton(updateBtn, "default");
          bindRowActionControl(updateBtn);
          updateBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            if (updateBtn.disabled) return;
            updateBtn.disabled = true;
            updateBtn.textContent = "⏳";
            try {
              await updateItemFromLink(entry.id);
            } finally {
              updateBtn.disabled = false;
              updateBtn.textContent = "↻";
            }
          });

          actions.append(select, favBtn, updateBtn, deleteBtn);

          row.style.gap = "6px";
          row.style.padding = mode === "items"
            ? (compactLayout ? "6px 10px" : "8px 12px")
            : "8px 12px";
          row.append(numberEl, checkboxWrap, badge, info, actions);
          const startLabelMarqueeLoop = () => startCategoryLabelMarquee(label, true);
          const stopLabelMarqueeLoop = () => stopCategoryLabelMarquee(label);
          if (isActiveRow) marqueeStartQueue.push(startLabelMarqueeLoop);
          row.addEventListener("mouseenter", () => {
            if (mouseHoverPauseUntil && Date.now() < mouseHoverPauseUntil) return;
            startLabelMarqueeLoop();
          });
          row.addEventListener("mouseleave", stopLabelMarqueeLoop);
          row.addEventListener("focusin", () => startLabelMarqueeLoop());
          row.addEventListener("focusout", stopLabelMarqueeLoop);
          label.addEventListener("mouseenter", () => {
            if (mouseHoverPauseUntil && Date.now() < mouseHoverPauseUntil) return;
            startLabelMarqueeLoop();
          });
          label.addEventListener("mouseleave", stopLabelMarqueeLoop);

          rowsFragment.appendChild(itemAppendEl);
        } else {
          rowsFragment.appendChild(itemAppendEl);
        }
      });
      if (bottomSpacerEl) rowsFragment.appendChild(bottomSpacerEl);
      list.appendChild(rowsFragment);

      // ── Virtual scroll: pasang listener scroll untuk re-render tetingkap baru
      if (useVirtualScroll && !list._lpVirtualScrollBound) {
        list._lpVirtualScrollBound = true;
        let _vsScrollTimer = null;
        list.addEventListener("scroll", () => {
          if (_vsScrollTimer) clearTimeout(_vsScrollTimer);
          _vsScrollTimer = setTimeout(() => {
            // Hitung activeIndex baru dari scroll position supaya tetingkap
            // render dikemas kini bila user scroll jauh
            const scrollRatio = list.scrollTop / Math.max(1, list.scrollHeight - list.clientHeight);
            const approxIndex = Math.round(scrollRatio * (entriesToRender.length - 1));
            if (Math.abs(approxIndex - (virtualOffset + Math.floor(VIRTUAL_WINDOW_SIZE / 2))) > Math.floor(VIRTUAL_WINDOW_SIZE / 3)) {
              activeIndex = Math.max(0, Math.min(approxIndex, entriesToRender.length - 1));
              render();
            }
          }, 80);
        }, { passive: true });
      }
      
      // 1. Restore the scroll position immediately before any scroll requests
      if (isResettingScroll) {
        needsScrollToTop = false;
        const scrollTarget = pendingScrollTarget;
        pendingScrollTarget = null;
        if (scrollTarget === "bottom") {
          // Set instant dulu supaya posisi betul, kemudian smooth ke bawah
          list.scrollTop = list.scrollHeight;
          requestAnimationFrame(() => {
            list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
          });
        } else {
          // Set instant dulu supaya posisi betul, kemudian smooth ke atas
          list.scrollTop = 0;
          requestAnimationFrame(() => {
            list.scrollTo({ top: 0, behavior: "smooth" });
          });
        }
      } else {
        // Jika asalnya disuruh reset tapi kita sekat (misal: masa move),
        // kita tetap kena anggap "reset" itu sudah diproses supaya tidak melompat nanti.
        if (needsScrollToTop && moveActionInProgress) {
          needsScrollToTop = false;
          pendingScrollTarget = null;
        }
        if (prevScrollTop > 0) {
          list.scrollTop = prevScrollTop;
        }
      }

      if (selectionActive && activeRow && typeof activeRow.scrollIntoView === "function") {
        // Capture activeRow dan reset selectionActive supaya render berikutnya
        // (dari hover, storage change, dll.) tidak scroll semula secara tidak sengaja.
        const capturedActiveRow = activeRow;
        selectionActive = false;
        setTimeout(() => {
          if (capturedActiveRow && typeof capturedActiveRow.scrollIntoView === "function") {
            try {
              // "instant" untuk scroll yang pasti tanpa animasi yang mungkin tidak selesai
              capturedActiveRow.scrollIntoView({ block: "center", behavior: "instant" });
            } catch (e) {
              try { capturedActiveRow.scrollIntoView({ block: "center" }); } catch (e2) {}
            }
          }
        }, 20);
      } else if (!isResettingScroll && prevScrollTop > 0) {
        // Lock scroll position hanya jika tiada scrollIntoView yang akan berlaku.
        // Gunakan synchronous assignment sahaja — requestAnimationFrame boleh
        // override scrollIntoView yang dijadualkan dalam setTimeout.
        list.scrollTop = prevScrollTop;
      }

      if (marqueeStartQueue.length) {
        requestAnimationFrame(() => marqueeStartQueue.forEach((fn) => {
          try {
            fn();
          } catch (err) {
            debugWarn("marquee callback failed", err);
          }
        }));
      }
      if (mode === "items") {
        queueVisibleTitleRefresh();
      }
    }

    function applyFilter(options = {}) {
      const preserveActiveEntry = options.preserveActiveEntry === true;
      let preservedActiveId = "";
      let preservedFilteredIndex = -1;
      if (preserveActiveEntry && mode === "items") {
        const previousVisibleEntries = visibleEntries.length ? visibleEntries : filtered;
        const previousActiveEntry = previousVisibleEntries[activeIndex];
        preservedActiveId = previousActiveEntry && previousActiveEntry.id
          ? String(previousActiveEntry.id)
          : "";
        if (preservedActiveId) {
          preservedFilteredIndex = filtered.findIndex((entry) => {
            return entry && String(entry.id || "") === preservedActiveId;
          });
        }
        if (preservedFilteredIndex < 0 && previousVisibleEntries.length) {
          const pageSize = getPageSize();
          const pageOffset = visibleEntries.length
            ? Math.max(0, (Math.max(1, page) - 1) * pageSize)
            : 0;
          preservedFilteredIndex = pageOffset + activeIndex;
        }
      }
      const query = normalize(input.value.trim());
      const queryChanged = query !== lastQuery;
      if (queryChanged) {
        lastQuery = query;
        needsScrollToTop = true;
        if (mode === "items") {
          page = 1;
        }
        selectionActive = false;
        lastOpenedItemId = ""; // clear highlight apabila user menaip dalam filter
      }
      const base = mode === "categories" ? categoryEntries : itemEntries;
      if (!query) {
        filtered = base.slice();
      } else if (mode === "categories") {
        filtered = base.filter((entry) => {
          const searchText = entry && typeof entry.searchText === "string"
            ? entry.searchText
            : normalize(entry && entry.label ? entry.label : "");
          return searchText.includes(query);
        });
      } else {
        filtered = base.filter((entry) => {
          const searchText = entry && typeof entry.searchText === "string"
            ? entry.searchText
            : normalize(
              (entry && entry.label ? entry.label : "")
              + " "
              + (entry && entry.meta ? entry.meta : "")
              + " "
              + (entry && entry.url ? entry.url : "")
            );
          return searchText.includes(query);
        });
      }
      if (mode === "items" && sortDir !== "manual" && !query && currentTabUrl) {
        const currentIndex = filtered.findIndex((entry) => entry.url === currentTabUrl);
        if (currentIndex >= 0) {
          const current = filtered[currentIndex];
          current._isCurrent = true;
          if (currentIndex > 0) {
            filtered.splice(currentIndex, 1);
            filtered.unshift(current);
          }
        }
      }
      let preservedNextFilteredIndex = -1;
      if (mode === "items" && preserveActiveEntry && !queryChanged && filtered.length) {
        if (preservedActiveId) {
          preservedNextFilteredIndex = filtered.findIndex((entry) => {
            return entry && String(entry.id || "") === preservedActiveId;
          });
        }
        if (preservedNextFilteredIndex < 0 && preservedFilteredIndex >= 0) {
          preservedNextFilteredIndex = Math.min(preservedFilteredIndex, filtered.length - 1);
        }
        if (preservedNextFilteredIndex >= 0) {
          const pageSize = getPageSize();
          const nextTotalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
          page = clampPage(Math.floor(preservedNextFilteredIndex / pageSize) + 1, nextTotalPages);
        }
      }
      buildVisibleEntries();
      updateTopBar();
      if (mode === "categories") {
        const selectedIndex = visibleEntries.findIndex((entry) => entry.id === activeCategoryId);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      } else {
        syncSelectedItemsWithCurrentCategory();
        if (preserveActiveEntry && !queryChanged && preservedNextFilteredIndex >= 0) {
          const pageSize = getPageSize();
          const pageOffset = Math.max(0, (Math.max(1, page) - 1) * pageSize);
          setActiveIndex(preservedNextFilteredIndex - pageOffset);
        } else {
          setActiveIndex(0);
        }
      }
      applyPendingStartLocationIfReady();
      updatePager();
      render();
      // Scroll ke link terakhir jika picker dibuka dalam mod last-link
      if (pendingScrollToLastOpened) {
        pendingScrollToLastOpened = false;
        const lastRow = list.querySelector('[data-last-opened="1"]');
        if (lastRow && typeof lastRow.scrollIntoView === "function") {
          lastRow.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
      updateToolbar();
      updateHint();
    }

    function flushPendingFilterInput() {
      if (!filterInputTimer) return false;
      clearTimeout(filterInputTimer);
      filterInputTimer = null;
      applyFilter();
      return true;
    }

    function close() {
      if (pickerPinned) {
        return;
      }
      flushPickerLastLocationSave();
      endPanelShellDrag();
      if (runtimeMessageHandler && lpApi.runtime && lpApi.runtime.onMessage && lpApi.runtime.onMessage.removeListener) {
        try {
          lpApi.runtime.onMessage.removeListener(runtimeMessageHandler);
        } catch (err) {
          // ignore
        }
        runtimeMessageHandler = null;
      }
      try {
        window.removeEventListener("keydown", onKeyDown, true);
      } catch (err) {
        // ignore
      }
      try {
        document.removeEventListener("visibilitychange", _onVisibilityChange);
      } catch (err) {
        // ignore
      }
      if (filterInputTimer) {
        clearTimeout(filterInputTimer);
        filterInputTimer = null;
      }
      if (pendingRefreshDerivedTimer) {
        clearTimeout(pendingRefreshDerivedTimer);
        pendingRefreshDerivedTimer = null;
      }
      pendingRefreshDerivedOptions = null;
      clearHoverCategorySelectionTimer();
      hideEnlargedThumbnail();
      if (enlargedThumbnailTimer) clearTimeout(enlargedThumbnailTimer);
      closeCategoryPalette();
      clearPendingUndoMove();
      draggingItemId = "";
      dragMoveItemIds = [];
      clearReorderHoverRow();
      clearCategoryDropHoverRow();
      stopDragAutoScroll();
      closeCategorySwipeDeleteOpen(true);
      closeCategoryContextMenu();
      closeItemImageContextMenu();
      clearDropPanelAutoHideTimer();
      dropPanelAutoVisible = false;
      dropBarVisualKey = "";
      endPanelShellResize();
      endPanelShellDrag();
      if (draggingRowEl) {
        draggingRowEl.style.willChange = "";
        draggingRowEl.style.opacity = "1";
        draggingRowEl.style.transform = "none";
      }
      draggingRowEl = null;
      if (storageChangeHandler && lpApi.storage && lpApi.storage.onChanged && lpApi.storage.onChanged.removeListener) {
        try {
          lpApi.storage.onChanged.removeListener(storageChangeHandler);
        } catch (err) {
          // ignore
        }
        storageChangeHandler = null;
      }
      if (panelShellResizeObserver) {
        try {
          panelShellResizeObserver.disconnect();
        } catch (err) {
          // ignore
        }
        panelShellResizeObserver = null;
      }
      if (panelShellViewportResizeHandler) {
        try {
          window.removeEventListener("resize", panelShellViewportResizeHandler);
        } catch (err) {
          // ignore
        }
        panelShellViewportResizeHandler = null;
      }
      overlay.remove();
    }

    function updateHint() {
      var favKey = pickerFavShortcut || "F";
      if (mode === "categories") {
        hint.textContent = "Drag header untuk pindah panel, drag handle bawah untuk resize | Hover/Arrow pilih kategori | Drag row current link ke kanan untuk panel drop | Right-click category untuk menu | Slide kiri untuk delete | Enter view links | Esc close";
        return;
      }
      if (canManualReorder()) {
        hint.textContent = itemFilter === "fav"
          ? "Favorites queue manual aktif | " + favKey + " favorite | D delete | / filter | Drag row untuk tentukan link next | Drop ke category chip untuk pindah | Arrow navigate | Next page/open | Esc close"
          : "Drag header untuk pindah panel, drag handle bawah untuk resize | " + favKey + " favorite | D delete | / filter | Drag row link to reorder/drop to category chip | Arrow navigate | Next page/open | Prev page/back | M move category | Alt+Arrow quick move | Esc close";
        return;
      }
      hint.textContent = "Drag header untuk pindah panel, drag handle bawah untuk resize | " + favKey + " favorite | D delete | / filter | Drag row link to category chip | Arrow navigate | Next page/open | Prev page/back | M move category | Alt+Arrow quick move | Backspace back | Esc close";
      return;
      if (mode === "categories") {
        hint.textContent = "Drag header untuk pindah panel · Hover/↑/↓ pilih kategori · Drag row current link, seret ke luar kanan untuk panel drop · Right-click category untuk menu · Slide kiri untuk delete · Enter view links · Esc close";
      } else {
        if (canManualReorder()) {
          hint.textContent = itemFilter === "fav"
            ? "Favorites queue manual aktif · " + favKey + " favorite · D delete · / filter · Drag row untuk tentukan link next · Drop ke category chip untuk pindah · ↑/↓ navigate · → next page/open · Esc close"
            : "Drag header untuk pindah panel · " + favKey + " favorite · D delete · / filter · Drag row link to reorder/drop to category chip · ↑/↓ navigate · → next page/open · ← page/back · M move category · Alt+↑/↓ quick move · Esc close";
        } else {
          hint.textContent = "Drag header untuk pindah panel · " + favKey + " favorite · D delete · / filter · Drag row link to category chip · ↑/↓ navigate · → next page/open · ← page/back · M move category · Alt+↑/↓ quick move · Backspace back · Esc close";
        }
      }
    }

    function updateTopBar() {
      const favoriteCount = visibleFavoriteCount;
      const clearFavoriteEntries = getClearFavoriteEntries();
      const canShowClearFavorites = mode === "items" && itemFilter === "fav";
      const clearFavoriteCount = clearFavoriteEntries.length;
      const restorableFavoriteIds = getRestorableFavoriteIds();
      const restoreFavoriteCount = restorableFavoriteIds.length;

      if (categoryCountBadge) {
        const totalLinks = categoryCounts.all || 0;
        categoryCountBadge.textContent = "Total: " + totalLinks;
      }

      // Kemaskini panel kategori sebelah kiri
      renderCategorySidePanel();

      const favActive = itemFilter === "fav";
      topFavBtn.textContent = (favActive ? "\u2605" : "\u2606");
      let favTitle = (favActive ? "Show all links" : "Show favorites only") + " (Alt+F)";
      if (favoriteCount > 0) {
        favTitle += " - " + favoriteCount + " favorites";
      }
      topFavBtn.title = favTitle;
       
       styleFavoritesToggleButton(topFavBtn, favActive);
       topFavBtn.disabled = false;
      topFavBtn.style.opacity = "1";
      topFavBtn.style.cursor = "pointer";
      if (clearFavBtn) {
        clearFavBtn.style.display = canShowClearFavorites ? "inline-flex" : "none";
        clearFavBtn.textContent = clearFavoriteCount > 0 ? "Clear Fav (" + clearFavoriteCount + ")" : "Clear Fav";
        clearFavBtn.disabled = !canShowClearFavorites || clearFavoriteCount === 0;
        clearFavBtn.style.opacity = clearFavBtn.disabled ? "0.45" : "1";
        clearFavBtn.style.cursor = clearFavBtn.disabled ? "not-allowed" : "pointer";
        styleTopButton(clearFavBtn, "default");
        clearFavBtn.style.background = clearFavBtn.disabled
          ? theme.inputBg
          : "rgba(255, 210, 74, 0.12)";
        clearFavBtn.style.border = clearFavBtn.disabled
          ? theme.border
          : "1px solid rgba(255, 210, 74, 0.32)";
        clearFavBtn.style.color = clearFavBtn.disabled ? theme.text : "#ffe08a";
        clearFavBtn.title = (clearFavBtn.disabled
          ? "Tiada Favorite untuk dibuang"
          : "Buang link dipaparkan dari Favorite sahaja (tidak delete link)")
          + (pickerClearFavShortcut ? " (" + pickerClearFavShortcut + ")" : "");
      }
      if (restoreFavBtn) {
        restoreFavBtn.style.display = restoreFavoriteCount > 0 ? "inline-flex" : "none";
        restoreFavBtn.textContent = restoreFavoriteCount > 0 ? "Restore Fav (" + restoreFavoriteCount + ")" : "Restore Fav";
        restoreFavBtn.disabled = restoreFavoriteCount === 0;
        restoreFavBtn.style.opacity = restoreFavBtn.disabled ? "0.45" : "1";
        restoreFavBtn.style.cursor = restoreFavBtn.disabled ? "not-allowed" : "pointer";
        styleTopButton(restoreFavBtn, "default");
        restoreFavBtn.style.background = restoreFavBtn.disabled
          ? theme.inputBg
          : "rgba(92, 214, 154, 0.14)";
        restoreFavBtn.style.border = restoreFavBtn.disabled
          ? theme.border
          : "1px solid rgba(92, 214, 154, 0.32)";
        restoreFavBtn.style.color = restoreFavBtn.disabled ? theme.text : "#b8ffd8";
        restoreFavBtn.title = (restoreFavBtn.disabled
          ? "Tiada Favorite untuk dipulihkan"
          : "Pulihkan Favorite terakhir yang dibuang")
          + (pickerRestoreFavShortcut ? " (" + pickerRestoreFavShortcut + ")" : "");
      }
      styleTopButton(autoNextBtn, youtubeAutoNext ? "active" : "default");
      styleTopButton(autoRandomBtn, youtubeAutoRandom ? "active" : "default");
      styleTopButton(deleteAfterOpenBtn, deleteAfterOpenActive ? "active" : "default");
      updateRandomAllBtn();
      deleteAfterOpenBtn.title = deleteAfterOpenActive
        ? "Delete link after opening (aktif)"
        : "Delete link after opening (tidak aktif)";
      autoNextBtn.title = (youtubeAutoNext
        ? "Auto Next aktif: buka link seterusnya selepas video YouTube tamat"
        : "Auto Next tidak aktif")
        + (pickerAutoNextShortcut ? " (" + pickerAutoNextShortcut + ")" : "");
      autoRandomBtn.title = (youtubeAutoRandom
        ? "Auto Random aktif: buka link rawak selepas video YouTube tamat"
        : "Auto Random tidak aktif")
        + (pickerAutoRandomShortcut ? " (" + pickerAutoRandomShortcut + ")" : "");
      styleTopButton(settingsBtn, "default");
      styleTopButton(saveAllBtn, "default");
      styleTopButton(saveCurrentBtn, "default");
      if (sidebarAiSelect) {
        sidebarAiSelect.value = normalizeSidebarAiProvider(sidebarAiProvider);
        sidebarAiSelect.title = "Sidebar AI: " + getSidebarAiLabel(sidebarAiProvider);
        sidebarAiSelect.style.opacity = "1";
        sidebarAiSelect.style.cursor = "pointer";
      }
      styleTopButton(newCategoryBtn, "default");
      styleTopButton(renameCategoryBtn, "default");
      styleTopButton(deleteCategoryBtn, "default");
      styleTopButton(trashBtn, "default");
      styleTopButton(showHiddenBtn, showHiddenCategories ? "active" : "default");
      if (showHiddenCategories === 2) {
        showHiddenBtn.title = "Mod: Tersembunyi sahaja — klik untuk kembali normal";
        showHiddenBtn.textContent = "🙈";
      } else if (showHiddenCategories === 1 || showHiddenCategories === true) {
        showHiddenBtn.title = "Mod: Tunjuk semua — klik untuk mod tersembunyi sahaja";
        showHiddenBtn.textContent = "👁️‍🗨️";
      } else {
        showHiddenBtn.title = "Klik untuk tunjuk semua kategori (termasuk tersembunyi)";
        showHiddenBtn.textContent = "👁️";
      }
      showHiddenBtn.style.display = "inline-flex";
      updateCategoryActionButtons();
    }

    function toggleFavoriteView() {
      itemFilter = itemFilter === "fav" ? "all" : "fav";
      navigationFavoritesOnly = itemFilter === "fav";
      if (navigationFavoritesOnly) {
        sortDir = favoriteSortMode;
      }
      needsScrollToTop = true;
      lastOpenedItemId = ""; // clear highlight apabila tukar view
      updatePickerSettings({ navigationFavoritesOnly });
      page = 1;
      if (navigationFavoritesOnly && activeCategoryId !== "all") {
        activeCategoryId = "all";
        try {
          lpApi.storage.local.set({ selectedCategory: "all" });
          if (lpApi.runtime && lpApi.runtime.sendMessage) {
            lpApi.runtime.sendMessage({ type: "request-badge" });
          }
        } catch (err) {
          // ignore
        }
      }
      sendFavoritesDebugLog("picker-toggle-favorites-view", {
        itemFilter,
        navigationFavoritesOnly,
        sortDir,
        favoriteSortMode,
        activeCategoryId,
      });
      if (mode === "categories") {
        syncActiveCategoryFromActiveIndex();
        setMode("items");
        return;
      }
      updateItemsSubTitle();
      updateTopBar();
      updateToolbar();
      itemEntries = buildItemEntries(activeCategoryId);
      applyFilter();
      try {
        ensureItemsLoadedForActiveScope({ force: true });
      } catch (err) {
        console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
      }
    }

    function updateToolbar() {
      if (mode !== "items") {
        toolbar.style.display = "none";
        return;
      }
      toolbar.style.display = "flex";
      const inAll = activeCategoryId === "all";
      const manualAvailable = !inAll || itemFilter === "fav";
      if (!inAll) {
        // Disable sort toggle outside "All" so manual order stays persistent.
        sortBtn.textContent = "⇅";
        sortBtn.title = "Manual order only. Sorting disabled for this category.";
        sortBtn.disabled = true;
        sortBtn.style.opacity = "0.55";
        sortBtn.style.cursor = "not-allowed";
      } else if (itemFilter === "fav" && sortDir === "manual") {
        sortBtn.textContent = "\u21C5";
        sortBtn.title = "Manual order for Favorites. Drag link rows to decide which one opens next. Click to switch to newest first.";
        sortBtn.disabled = false;
        sortBtn.style.opacity = "1";
        sortBtn.style.cursor = "grab";
      } else if (sortDir === "asc") {
        sortBtn.textContent = "↑";
        sortBtn.title = itemFilter === "fav"
          ? "Favorites sorted by date (oldest first). Click for manual order."
          : "Sort by date (oldest first). Click for newest first";
        sortBtn.disabled = false;
        sortBtn.style.opacity = "1";
        sortBtn.style.cursor = "pointer";
      } else {
        sortBtn.textContent = "↓";
        sortBtn.title = itemFilter === "fav"
          ? "Favorites sorted by date (newest first). Click for oldest first."
          : "Sort by date (newest first). Click for oldest first";
        sortBtn.disabled = false;
        sortBtn.style.opacity = "1";
        sortBtn.style.cursor = "pointer";
      }
      styleActionButton(sortBtn, "default");
      styleTopButton(selectPageBtn, "default");
      styleTopButton(clearSelectionBtn, "default");

      styleTopButton(bulkFavBtn, "default");
      styleTopButton(bulkDeleteBtn, "default");

      styleCategorySelect(bulkMoveSelect);
      bulkMoveSelect.style.height = "28px";
      bulkMoveSelect.style.maxWidth = "180px";
      populateBulkMoveSelect(bulkMoveSelect);

      styleCategorySelect(categoryJumpSelect);
      categoryJumpSelect.style.height = "28px";
      categoryJumpSelect.style.maxWidth = "200px";
      populateCategoryJumpSelect(categoryJumpSelect);

      syncSelectedItemsWithCurrentCategory();
      const selectedCount = getSelectedItemIdsForCurrentCategory().length;
      const allVisibleSelected = areAllVisibleItemsSelected();
      const hasVisibleItems = getVisibleSelectableIds().length > 0;
      selectPageBtn.textContent = allVisibleSelected ? "Unselect page" : "Select page";
      const canSelectVisible = hasVisibleItems && !moveActionInProgress;
      selectPageBtn.disabled = !canSelectVisible;
      selectPageBtn.style.opacity = canSelectVisible ? "1" : "0.5";
      selectPageBtn.style.cursor = canSelectVisible ? "pointer" : "not-allowed";

      const canClearSelection = selectedCount > 0 && !moveActionInProgress;
      clearSelectionBtn.disabled = !canClearSelection;
      clearSelectionBtn.style.opacity = canClearSelection ? "1" : "0.5";
      clearSelectionBtn.style.cursor = canClearSelection ? "pointer" : "not-allowed";

      bulkMoveSelect.disabled = moveActionInProgress;
      bulkMoveSelect.style.opacity = moveActionInProgress ? "0.65" : "1";
      bulkMoveSelect.style.cursor = moveActionInProgress ? "not-allowed" : "pointer";

      const canBulkDelete = !moveActionInProgress && selectedCount > 0;
      bulkDeleteBtn.disabled = !canBulkDelete;
      bulkDeleteBtn.style.opacity = canBulkDelete ? "1" : "0.5";
      bulkDeleteBtn.style.cursor = canBulkDelete ? "pointer" : "not-allowed";

      const canBulkFav = !moveActionInProgress && selectedCount > 0;
      bulkFavBtn.disabled = !canBulkFav;
      bulkFavBtn.style.opacity = canBulkFav ? "1" : "0.5";
      bulkFavBtn.style.cursor = canBulkFav ? "pointer" : "not-allowed";

      bulkSelectionInfo.textContent = selectedCount + " selected";
    }

    function setMode(nextMode) {
      // Reset category side panel focus bila tukar mode
      if (categorySidePanelFocused) {
        categorySidePanelFocused = false;
        categorySidePanelActiveIndex = -1;
        categorySidePanel.style.outline = "";
        categorySidePanel.style.outlineOffset = "";
      }
      if (filterInputTimer) {
        clearTimeout(filterInputTimer);
        filterInputTimer = null;
      }
      clearHoverCategorySelectionTimer();
      autoPageCancel();
      mode = nextMode;
      needsScrollToTop = true;
      refreshCategoryEntries();
      page = 1;
      lastQuery = "";
      selectionActive = false;
      lastOpenedItemId = ""; // clear highlight apabila tukar mod
      selectedItemIds.clear();
      draggingItemId = "";
      dragMoveItemIds = [];
      clearReorderHoverRow();
      clearCategoryDropHoverRow();
      stopDragAutoScroll();
      closeCategorySwipeDeleteOpen(true);
      closeCategoryContextMenu();
      closeItemImageContextMenu();
      clearDropPanelAutoHideTimer();
      dropPanelAutoVisible = false;
      dropBarVisualKey = "";
      if (draggingRowEl) {
        draggingRowEl.style.willChange = "";
        draggingRowEl.style.opacity = "1";
        draggingRowEl.style.transform = "none";
      }
      draggingRowEl = null;
      bulkMoveSelect.value = BULK_SELECT_PLACEHOLDER;
      if (mode === "items") {
        if (activeCategoryId === "all") {
          if (sortDir === "manual") sortDir = "desc";
        } else {
          sortDir = "manual";
        }
        backBtn.style.display = "inline-flex";
        const catLabel = getCategoryLabel(activeCategoryId);
        title.textContent = catLabel || "Links";
        title.style.fontSize = "24px";
        updateItemsSubTitle();
        input.placeholder = "Filter links...";
        itemEntries = buildItemEntries(activeCategoryId);
        try {
          ensureItemsLoadedForActiveScope();
        } catch (err) {
          console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
        }
      } else {
        backBtn.style.display = "none";
        title.textContent = "Category picker";
        title.style.fontSize = "20px";
        subTitle.textContent = "Select a category";
        input.placeholder = "Type to filter categories...";
      }
      updateTopBar();
      updateToolbar();
      input.value = "";
      updateHint();
      applyFilter();
      renderCategorySidePanel();
      restorePickerFocus();
    }

    function startPicker() {
      pickerStarted = true;
      if (payload && payload.forceCategories) {
        // Categories mode sudah dibuang, stay dalam items mode
        setMode("items");
        enablePickerLocationPersistence();
        return;
      }
      // Gesture: terus buka trash panel
      if (payload && payload.openTrash) {
        setMode("items");
        enablePickerLocationPersistence();
        openTrashPanel();
        return;
      }

      // Normalize pickerStartMode - sokong nilai lama "last" sebagai "last-category"
      const normalizedStartMode = (() => {
        const raw = (pickerStartMode || "home").toLowerCase();
        if (raw === "last" || raw === "last-category" || raw === "last_category") return "last-category";
        if (raw === "last-page" || raw === "last_page") return "last-page";
        if (raw === "last-link" || raw === "last_link") return "last-link";
        return "home";
      })();

      // Restore lastOpenedItemId dari storage untuk highlight "last opened" —
      // berlaku untuk SEMUA start mode, bukan hanya "last-link".
      // Ini supaya highlight rediscover dan link lain berfungsi walaupun user guna "home" mode.
      const _highlightLocation = normalizePickerLastLocation(payload.categoryPickerLastLocation);
      if (_highlightLocation && _highlightLocation.lastOpenedItemId) {
        const _HIGHLIGHT_TTL_MS = 24 * 60 * 60 * 1000;
        const _storedAt = _highlightLocation.lastOpenedAt || 0;
        const _age = _storedAt > 0 ? Date.now() - _storedAt : Infinity;
        if (_age <= _HIGHLIGHT_TTL_MS) {
          lastOpenedItemId = String(_highlightLocation.lastOpenedItemId);
          lastOpenedAt = _storedAt;
        }
      }

      const wantsAnyLast = normalizedStartMode !== "home";
      const storedLocation = wantsAnyLast
        ? normalizePickerLastLocation(payload.categoryPickerLastLocation)
        : null;

      const restoreLocation = storedLocation && storedLocation.mode === "items" && canRestoreCategoryLocation(storedLocation)
        ? storedLocation
        : null;

      const lastCategoryId = restoreLocation
        ? restoreLocation.categoryId
        : (activeCategoryId ? String(activeCategoryId) : "");
      const isSpecialLast = lastCategoryId === "all" || lastCategoryId === "none" || lastCategoryId === "hidden_none";
      const existsLast = categories.some((cat) => cat && cat.id === lastCategoryId);
      const canJumpLast = wantsAnyLast && lastCategoryId && (isSpecialLast || existsLast);

      if (canJumpLast) {
        activeCategoryId = lastCategoryId;

        if (normalizedStartMode === "last-link" && restoreLocation) {
          pendingStartLocation = restoreLocation;
          restoredFromLastLocation = true;
          itemFilter = restoreLocation.itemFilter === "fav" ? "fav" : "all";
          sortDir = restoreLocation.sortDir || sortDir;
          setMode("items");
          applyFilter();
          return;
        } else if (normalizedStartMode === "last-page" && restoreLocation) {
          const pageOnlyLocation = { ...restoreLocation, itemId: "", url: "" };
          pendingStartLocation = pageOnlyLocation;
          restoredFromLastLocation = true;
          itemFilter = restoreLocation.itemFilter === "fav" ? "fav" : "all";
          sortDir = restoreLocation.sortDir || sortDir;
          setMode("items");
          applyFilter();
          return;
        } else {
          setMode("items");
          enablePickerLocationPersistence();
          return;
        }
      }

      setMode("items");
      enablePickerLocationPersistence();
    }

    function openItem(entry, newTab = false) {
      if (!entry || !entry.url) return;
      // Set highlight untuk link yang dibuka — berlaku untuk semua cara (click, ctrl+click, dll.)
      lastOpenedItemId = entry.id ? String(entry.id) : (entry.url ? String(entry.url) : "");
      // Simpan masa link dibuka untuk TTL check apabila picker dibuka semula
      lastOpenedAt = Date.now();
      // Simpan snapshot ke storage segera supaya lastOpenedItemId terpelihara
      schedulePickerLastLocationSave();
      try {
        if (lpApi.runtime && lpApi.runtime.sendMessage) {
          lpApi.runtime.sendMessage({ type: "open-picker-item", url: entry.url, newTab: newTab });
        } else {
          window.open(entry.url, "_blank");
        }
      } catch (err) {
        try {
          window.open(entry.url, "_blank");
        } catch (err2) {
          // ignore
        }
      }
      if (!newTab) {
        close();
      } else {
        // Render semula untuk papar highlight apabila picker kekal terbuka
        render();
      }
    }


    function selectEntry(entry, newTab = false) {
      if (!entry) return;
      if (mode === "categories") {
        if (entry.type === "current") {
          openItem(entry, newTab);
          return;
        }
        activeCategoryId = entry.id;
        try {
          lpApi.storage.local.set({ selectedCategory: entry.id });
          if (lpApi.runtime && lpApi.runtime.sendMessage) {
            lpApi.runtime.sendMessage({ type: "request-badge" });
          }
        } catch (err) {
          // ignore
        }
        setMode("items");
        clearPickerLastLocation();
      } else {
        const selectedIndex = visibleEntries.findIndex((visibleEntry) => {
          return visibleEntry && entry && visibleEntry.id && entry.id && String(visibleEntry.id) === String(entry.id);
        });
        if (selectedIndex >= 0) {
          setActiveIndex(selectedIndex);
        }
        // lastOpenedItemId dan render() dikendalikan dalam openItem()
        openItem(entry, newTab);
      }
    }

    function selectRandomItemEntry() {
      if (mode !== "items") return false;
      // Bila randomAcrossAllCategories aktif, guna semua item tanpa filter kategori
      let basePool;
      if (randomAcrossAllCategories && allItemsCache.length) {
        basePool = allItemsCache.filter((entry) => entry && entry.url);
      } else {
        basePool = (filtered.length ? filtered : itemEntries).filter((entry) => entry && entry.url);
      }
      if (!basePool.length) return false;

      let candidates = basePool.slice();
      const activeEntry = visibleEntries.length ? visibleEntries[activeIndex] : null;
      if (activeEntry && activeEntry.id && candidates.length > 1) {
        const nextCandidates = candidates.filter((entry) => entry.id !== activeEntry.id);
        if (nextCandidates.length) {
          candidates = nextCandidates;
        }
      }
      if (currentTabUrl && candidates.length > 1) {
        const nextCandidates = candidates.filter((entry) => entry.url !== currentTabUrl);
        if (nextCandidates.length) {
          candidates = nextCandidates;
        }
      }

      const randomIndex = Math.floor(Math.random() * candidates.length);
      const choice = candidates[randomIndex];
      if (!choice) return false;
      selectEntry(choice);
      return true;
    }

    function selectNextItemEntry() {
      if (mode !== "items") return false;
      const basePool = (filtered.length ? filtered : itemEntries).filter((entry) => entry && entry.url);
      if (!basePool.length) return false;
      if (basePool.length === 1) {
        selectEntry(basePool[0]);
        return true;
      }

      let startIndex = -1;
      if (currentTabUrl) {
        startIndex = basePool.findIndex((entry) => entry.url === currentTabUrl);
      }
      if (startIndex < 0 && visibleEntries.length) {
        const activeEntry = visibleEntries[activeIndex];
        if (activeEntry && activeEntry.id) {
          startIndex = basePool.findIndex((entry) => entry.id === activeEntry.id);
        }
      }

      const normalizedStart = startIndex >= 0 ? startIndex : 0;
      for (let step = 1; step <= basePool.length; step += 1) {
        const index = (normalizedStart + step) % basePool.length;
        const candidate = basePool[index];
        if (!candidate || !candidate.url) continue;
        if (currentTabUrl && candidate.url === currentTabUrl && basePool.length > 1) {
          continue;
        }
        selectEntry(candidate);
        return true;
      }
      return false;
    }

    function buildCategoryPaletteOptions() {
      const counts = categoryCounts;
      const options = [{
        id: "",
        label: "Uncategorized",
        searchText: normalize("Uncategorized"),
        count: counts.none || 0,
        hidden: false
      }];
      if (showHiddenCategories >= 1) {
        options.push({
          id: "hidden_none",
          label: "Uncategorize (hidden)",
          searchText: normalize("Uncategorize (hidden)"),
          count: counts.hiddenNone || 0,
          hidden: true
        });
      }
      const visibleCategories = categories
        .filter((cat) => cat && cat.id && (showHiddenCategories || !cat.hidden))
        .slice()
        .sort((a, b) => {
          const aName = a && a.name ? a.name : "";
          const bName = b && b.name ? b.name : "";
          return aName.localeCompare(bName, undefined, { sensitivity: "base" });
        });
      visibleCategories.forEach((cat) => {
        const rawName = cat && cat.name ? String(cat.name).trim() : "";
        const label = rawName || "(untitled)";
        options.push({
          id: String(cat.id),
          label: cat.hidden ? label + " (hidden)" : label,
          searchText: normalize(label),
          count: typeof counts.byId[cat.id] === "number" ? counts.byId[cat.id] : 0,
          hidden: cat.hidden === true
        });
      });
      return options;
    }

    function stopCategoryLabelMarquee(labelEl) {
      if (!labelEl) return;
      if (labelEl.__lpMarqueeAnim) {
        labelEl.__lpMarqueeAnim.cancel();
        labelEl.__lpMarqueeAnim = null;
      }
      if (labelEl.__lpMarqueeInner) {
        labelEl.__lpMarqueeInner.style.transform = "translateX(0)";
      }
      labelEl.style.webkitMaskImage = "";
      labelEl.style.maskImage = "";
    }

    function startCategoryLabelMarquee(labelEl, loop = false) {
      if (!labelEl || !labelEl.__lpMarqueeInner) return;
      stopCategoryLabelMarquee(labelEl);
      const overflow = labelEl.__lpMarqueeInner.scrollWidth - labelEl.clientWidth;
      if (overflow <= CATEGORY_MARQUEE_MIN_OVERFLOW) return;
      labelEl.style.webkitMaskImage = CATEGORY_MARQUEE_MASK;
      labelEl.style.maskImage = CATEGORY_MARQUEE_MASK;
      const distance = Math.max(12, overflow + 12);
      const duration = Math.min(16000, Math.max(3800, distance * 28));
      const anim = labelEl.__lpMarqueeInner.animate(
        [
          { transform: "translateX(0px)" },
          { transform: "translateX(-" + distance + "px)" }
        ],
        {
          duration,
          easing: "linear",
          iterations: loop ? Infinity : 1,
          direction: loop ? "alternate" : "normal",
          fill: "forwards"
        }
      );
      labelEl.__lpMarqueeAnim = anim;
      if (!loop && anim) {
        anim.onfinish = () => {
          labelEl.__lpMarqueeAnim = null;
          if (labelEl.__lpMarqueeInner) {
            labelEl.__lpMarqueeInner.style.transform = "translateX(0)";
          }
          labelEl.style.webkitMaskImage = "";
          labelEl.style.maskImage = "";
        };
      }
    }

    function cancelAllCategoryMarquees() {
      if (!categoryPaletteList) return;
      const labels = categoryPaletteList.querySelectorAll("[data-marquee='label']");
      labels.forEach((el) => stopCategoryLabelMarquee(el));
    }

    function renderCategoryPaletteList() {
      cancelAllCategoryMarquees();
      const prevScrollTop = categoryPaletteList ? categoryPaletteList.scrollTop : 0;
      categoryPaletteList.textContent = "";
      const query = normalize(categoryPaletteInput.value || "");
      const allOptions = buildCategoryPaletteOptions();
      let filtered = query
        ? allOptions.filter((opt) => opt.searchText.includes(query))
        : allOptions;
      if (query) {
        filtered = filtered
          .map((opt, idx) => {
            const starts = opt.searchText.startsWith(query);
            const pos = opt.searchText.indexOf(query);
            return {
              opt,
              starts,
              pos: pos >= 0 ? pos : 9999,
              idx
            };
          })
          .sort((a, b) => {
            if (a.starts !== b.starts) return a.starts ? -1 : 1;
            if (a.pos !== b.pos) return a.pos - b.pos;
            return a.opt.label.localeCompare(b.opt.label, undefined, { sensitivity: "base" });
          })
          .map((entry) => entry.opt);
      }
      categoryPaletteOptions = filtered;
      if (categoryPalettePendingTargetId !== null && filtered.length) {
        const baseIndex = filtered.findIndex((opt) => opt && opt.id === categoryPalettePendingTargetId);
        if (baseIndex >= 0) {
          categoryPaletteActiveIndex = ((baseIndex + categoryPalettePendingOffset) % filtered.length + filtered.length) % filtered.length;
        }
        categoryPalettePendingTargetId = null;
        categoryPalettePendingOffset = 0;
      }
      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.textContent = "No matching categories.";
        empty.style.color = "rgba(255, 255, 255, 0.7)";
        empty.style.padding = "8px 10px";
        categoryPaletteList.appendChild(empty);
        categoryPaletteActiveIndex = 0;
        return;
      }
      if (categoryPaletteActiveIndex >= filtered.length) {
        categoryPaletteActiveIndex = Math.max(0, filtered.length - 1);
      }
      filtered.forEach((opt, index) => {
        const row = document.createElement("div");
        row.dataset.index = String(index);
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";
        row.style.gap = "10px";
        row.style.padding = "9px 12px";
        row.style.cursor = "pointer";
        row.style.borderBottom = "1px solid rgba(255, 255, 255, 0.06)";
        row.style.transition = "background 120ms ease, border 120ms ease";
        if (index === filtered.length - 1) {
          row.style.borderBottom = "none";
        }
        const label = document.createElement("div");
        label.dataset.marquee = "label";
        label.style.color = "#fff";
        label.style.fontWeight = "600";
        label.style.fontSize = "13px";
        label.style.whiteSpace = "nowrap";
        label.style.overflow = "hidden";
        label.style.textOverflow = "ellipsis";
        const labelInner = document.createElement("span");
        labelInner.textContent = opt.label;
        labelInner.style.display = "inline-block";
        labelInner.style.paddingRight = "12px";
        label.__lpMarqueeInner = labelInner;
        label.appendChild(labelInner);
        const meta = document.createElement("div");
        meta.textContent = typeof opt.count === "number" ? opt.count + " link" + (opt.count === 1 ? "" : "s") : "";
        meta.style.color = "rgba(255, 255, 255, 0.62)";
        meta.style.fontSize = "12px";
        meta.style.flex = "0 0 auto";
        row.append(label, meta);
        const isActive = index === categoryPaletteActiveIndex;
        if (isActive) {
          row.style.background = "rgba(255, 214, 51, 0.12)";
          row.style.border = "1px solid rgba(255, 214, 51, 0.35)";
          setTimeout(() => {
            try { row.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
            startCategoryLabelMarquee(label, true);
          }, 5);
        } else {
          row.style.border = "1px solid rgba(255, 255, 255, 0.06)";
          stopCategoryLabelMarquee(label);
        }
        row.addEventListener("mouseenter", () => {
          if (mouseCategorySelectionPausedUntil && Date.now() < mouseCategorySelectionPausedUntil) return;
          // Update highlight terus pada DOM tanpa rebuild penuh
          const prevActive = categoryPaletteList.querySelector("[data-palette-active='1']");
          if (prevActive) {
            prevActive.removeAttribute("data-palette-active");
            prevActive.style.background = "";
            prevActive.style.border = "1px solid rgba(255, 255, 255, 0.06)";
          }
          categoryPaletteActiveIndex = index;
          row.setAttribute("data-palette-active", "1");
          row.style.background = "rgba(255, 214, 51, 0.12)";
          row.style.border = "1px solid rgba(255, 214, 51, 0.35)";
          startCategoryLabelMarquee(label, true);
        });
        label.addEventListener("mouseenter", () => startCategoryLabelMarquee(label, true));
        label.addEventListener("mouseleave", () => stopCategoryLabelMarquee(label));
        row.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          chooseCategoryPaletteOption(index);
        });
        categoryPaletteList.appendChild(row);
      });
      if (prevScrollTop > 0) categoryPaletteList.scrollTop = prevScrollTop;
    }

    function setCategoryPaletteActiveIndex(next) {
      if (!categoryPaletteOptions.length) return;
      const total = categoryPaletteOptions.length;
      const safe = ((next % total) + total) % total;
      categoryPaletteActiveIndex = safe;
      renderCategoryPaletteList();
    }

    function chooseCategoryPaletteOption(index) {
      if (!categoryPaletteOptions.length) return;
      const option = categoryPaletteOptions[index];
      if (!option) return;
      if (mode !== "items") {
        flashHint("Buka senarai link dahulu (→).");
        closeCategoryPalette();
        return;
      }
      if (!visibleEntries.length) {
        flashHint("Tiada link aktif untuk dipindahkan.");
        closeCategoryPalette();
        return;
      }
      const entry = visibleEntries[activeIndex];
      if (!entry || !entry.id) {
        flashHint("Tiada link aktif untuk dipindahkan.");
        closeCategoryPalette();
        return;
      }
      updateItemCategoryById(entry.id, option.id);
      const targetLabel = getCategoryLabel(option.id || "none");
      flashHint("Kategori link ditukar ke " + targetLabel + ".");
      closeCategoryPalette();
      restorePickerFocus();
    }

    function openCategoryPalette(targetId = null, offset = 0) {
      if (mode !== "items") {
        flashHint("Tekan → untuk buka senarai link dahulu.");
        return;
      }
      categoryPaletteOpen = true;
      categoryPaletteActiveIndex = 0;
      categoryPaletteInput.value = "";
      categoryPalettePendingTargetId = targetId;
      categoryPalettePendingOffset = offset;
      renderCategoryPaletteList();
      categoryPalette.style.display = "flex";
      setTimeout(() => {
        categoryPaletteInput.focus();
        categoryPaletteInput.select();
      }, 0);
    }

    function closeCategoryPalette() {
      categoryPaletteOpen = false;
      categoryPalette.style.display = "none";
      cancelAllCategoryMarquees();
      categoryPaletteOptions = [];
      categoryPaletteActiveIndex = 0;
    }

    function onKeyDown(event) {
      // Let Ctrl+A / Cmd+A pass through in filter input for native Select All.
      if ((event.ctrlKey || event.metaKey) && (event.key || '').toLowerCase() === 'a' && event.target === input) {
        return;
      }
      // Guard: if overlay was removed externally (e.g. by floatingButton.js),
      // clean up the leaked listener and bail out.
      if (!overlay.parentNode) {
        event.preventDefault();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        event.stopPropagation();
        close();
        return;
      }

      // Handle Alt+Z (save current tab) and Alt+R (open settings) directly in picker
      // Tangani di sini upfront supaya berfungsi tanpa bergantung pada browser command system
      const altPressed = event.altKey || (event.getModifierState && event.getModifierState('Alt'));
      if (altPressed && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        const key = (event.key || '').toLowerCase();
        const code = (event.code || '').replace('Key', '').toLowerCase();
        // Periksa shortcut toggle picker dahulu — tutup picker terus jika match.
        // Ini penting di YouTube di mana browser command system mungkin tidak dihantar
        // kerana YouTube intercept keyboard events sebelum browser sempat proses command.
        if (pickerToggleSelfShortcut && matchesShortcut(event, pickerToggleSelfShortcut)) {
          consumePickerShortcutEvent(event);
          close();
          return;
        }
        if (key === 'z' || code === 'z') {
          consumePickerShortcutEvent(event);
          saveCurrentBtn.click();
          flashHint("Saving current tab...");
          return;
        }
        if (key === 'r' || code === 'r') {
          consumePickerShortcutEvent(event);
          flashHint("Opening settings...");
          try { if (lpApi.runtime && lpApi.runtime.sendMessage) { lpApi.runtime.sendMessage({ type: "open-options" }); } } catch (e) { /* ignore */ }
          return;
        }
        // Alt+F — toggle favorites (mesti sebelum catch-all supaya tak ditelan)
        if (key === 'f') {
          consumePickerShortcutEvent(event);
          if (mode === "items" && !categoryPaletteOpen) {
            topFavBtn.click();
          }
          return;
        }
        // Alt+T — buka trash panel (mesti sebelum catch-all supaya tak ditelan)
        if (key === 't') {
          consumePickerShortcutEvent(event);
          if (!categoryPaletteOpen) {
            openTrashPanel();
          }
          return;
        }
        // Catch-all: if Alt is held with any letter key, consume it here
        // supaya tak bertembung dengan shortcut huruf-sahaja dalam picker.
        if (/^[a-z]$/.test(key)) {
          consumePickerShortcutEvent(event);
          return;
        }
      }

      const isSearch = event.target === input;
      if (isSearch) {
        const altMod = event.altKey || (event.getModifierState && event.getModifierState('Alt'));
        const hasModifiers = altMod || event.ctrlKey || event.metaKey;
        if (!hasModifiers) {
          if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
          }
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (visibleEntries[activeIndex]) {
              selectEntry(visibleEntries[activeIndex]);
            }
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            selectionActive = true;
            setActiveIndex(activeIndex + 1);
            syncActiveCategoryFromActiveIndex();
            render();
            playHoverSound();
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            selectionActive = true;
            setActiveIndex(activeIndex - 1);
            syncActiveCategoryFromActiveIndex();
            render();
            playHoverSound();
            return;
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            const cursorAtStart = input.selectionStart === 0 && input.selectionEnd === 0;
            const cursorAtEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
            if (event.key === "ArrowLeft" && cursorAtStart) {
              event.preventDefault();
              if (totalPages <= 1 || page <= 1) {
                if (categorySidePanel.style.display === "flex") {
                  focusCategorySidePanel();
                }
              } else {
                goToPage(page - 1);
              }
              return;
            }
            if (event.key === "ArrowRight" && cursorAtEnd) {
              event.preventDefault();
              if (totalPages > 1 && page < totalPages) {
                goToPage(page + 1);
              }
              return;
            }
          }
          return;
        }
      }
      const capsLockOn = typeof event.getModifierState === "function" && event.getModifierState("CapsLock");
      const effectiveShift = event.shiftKey && !(capsLockOn && event.key && event.key.length === 1 && /[a-zA-Z]/.test(event.key));
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        inputMode = "keyboard";
        overlay.classList.add("keyboard-nav-active");
      }
      // Skip pause timers for pure modifier keys (Ctrl/Meta/Alt/Shift) so that
      // Ctrl+Click (open in new tab) is not accidentally suppressed.
      const isModifierOnlyKey = (
        event.key === "Control"
        || event.key === "Meta"
        || event.key === "Alt"
        || event.key === "Shift"
      );
      if (!isModifierOnlyKey) {
        mouseCategorySelectionPausedUntil = Date.now() + MOUSE_SELECTION_PAUSE_MS;
        mouseHoverPauseUntil = Date.now() + MOUSE_HOVER_PAUSE_MS;
      }
      if (categoryPaletteOpen) {
        if (matchesShortcut(event, categoryPaletteShortcut)) {
          event.preventDefault();
          event.stopPropagation();
          closeCategoryPalette();
          restorePickerFocus();
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          setCategoryPaletteActiveIndex(categoryPaletteActiveIndex + 1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          setCategoryPaletteActiveIndex(categoryPaletteActiveIndex - 1);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          chooseCategoryPaletteOption(categoryPaletteActiveIndex);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeCategoryPalette();
          restorePickerFocus();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (categoryContextMenuState) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") {
          closeCategoryContextMenu();
        }
        return;
      }
      if (itemImageContextMenuState) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") {
          closeItemImageContextMenu();
        }
        return;
      }
      if (imagePanelState) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") {
          closeImagePickerPanel();
        }
        return;
      }
      const tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
      if (tag === "select") {
        event.stopPropagation();
        return;
      }
      if (tag === "input" && event.target !== input && event.target.type !== "checkbox") {
        event.stopPropagation();
        return;
      }
      if (categorySidePanelFocused) {
        if (handleCategorySidePanelKeydown(event)) return;
      }
      if (
        filterInputTimer
        && event.key !== "Shift"
        && event.key !== "Control"
        && event.key !== "Alt"
        && event.key !== "Meta"
      ) {
        flushPendingFilterInput();
      }
      if (isSearch && input.value && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.stopPropagation();
        return;
      }
      if (matchesShortcut(event, categoryPaletteShortcut)) {
        const tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
        if ((tag === "input" || tag === "textarea" || tag === "select") && event.target !== input) {
          event.stopPropagation();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (categoryPaletteOpen) {
          closeCategoryPalette();
          restorePickerFocus();
        } else {
          openCategoryPalette();
        }
        return;
      }
      if (
        mode === "items"
        && !categoryPaletteOpen
        && !event.shiftKey
        && !event.metaKey
        && event.altKey
        && !event.ctrlKey
        && (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        event.preventDefault();
        event.stopPropagation();
        const entry = visibleEntries[activeIndex];
        const currentCatId = entry && entry.categoryId ? String(entry.categoryId) : "";
        const offset = event.key === "ArrowDown" ? 1 : -1;
        openCategoryPalette(currentCatId, offset);
        return;
      }
      if (
        mode === "items"
        && !categoryPaletteOpen
        && !isSearch
        && !effectiveShift
        && !event.metaKey
        && !event.altKey
        && !event.ctrlKey
        && (event.key === "d" || event.key === "D")
      ) {
        event.preventDefault();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        event.stopPropagation();
        const entry = visibleEntries[activeIndex];
        if (entry && entry.id) {
          deleteItem(entry).then(() => {
            restorePickerFocus();
          });
        }
        return;
      }
      if (
        mode === "items"
        && !categoryPaletteOpen
        && !isSearch
        && matchesShortcut(event, pickerFavShortcut)
      ) {
        event.preventDefault();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        event.stopPropagation();
        const entry = visibleEntries[activeIndex];
        if (entry && entry.id) {
          const nextFavorite = entry.favorite !== true;
          toggleFavoriteById(entry.id).then(() => {
            restorePickerFocus();
          });
        }
        return;
      }
      if (
        mode === "items"
        && !categoryPaletteOpen
        && !event.shiftKey
        && !event.metaKey
        && !event.altKey
        && !event.ctrlKey
        && event.key === "/"
      ) {
        event.preventDefault();
        if (typeof event.stopImmediatePropagation === "function") {
          event.stopImmediatePropagation();
        }
        event.stopPropagation();
        focusFilterInput();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (mode === "items" && !isSearch && matchesShortcut(event, pickerNextPageShortcut)) {
        consumePickerShortcutEvent(event);
        handlePickerCommand("page-next");
        return;
      }
      if (!isSearch && matchesShortcut(event, pickerToggleDeleteAfterOpenShortcut)) {
        consumePickerShortcutEvent(event);
        const enabled = !deleteAfterOpenActive;
        updatePickerSettings({ deleteAfterOpen: enabled });
        flashHint(enabled ? "Delete after open diaktifkan." : "Delete after open dimatikan.");
        return;
      }
      if (!isSearch && matchesShortcut(event, pickerToggleShowHiddenShortcut)) {
        consumePickerShortcutEvent(event);
        showHiddenBtn.click();
        return;
      }
      // Shortcut H — hide/unhide kategori aktif semasa (tanpa buka context menu)
      if (
        !categoryPaletteOpen
        && !isSearch
        && !event.altKey
        && !event.ctrlKey
        && !event.metaKey
        && !event.shiftKey
        && (event.key === "h" || event.key === "H")
      ) {
        const targetCatId = mode === "items" ? activeCategoryId : (visibleEntries[activeIndex] && visibleEntries[activeIndex].id ? visibleEntries[activeIndex].id : activeCategoryId);
        if (isHideableCategoryId(targetCatId)) {
          event.preventDefault();
          event.stopPropagation();
          toggleCategoryHiddenById(targetCatId).then((ok) => {
            // Kalau kategori di-hide dan kita dalam mode 0 (normal), reset ke all
            // supaya next/random item tidak stuck dalam kategori yang dah invisible
            if (ok && showHiddenCategories === 0) {
              handlePickerCommand("reset-to-all");
            }
          }).catch(() => {});
          return;
        }
      }
      // Configurable picker button shortcuts
      if (!isSearch && matchesShortcut(event, pickerImportShortcut)) {
        consumePickerShortcutEvent(event);
        importBtn.click();
        return;
      }
      if (!isSearch && matchesShortcut(event, pickerExportShortcut)) {
        consumePickerShortcutEvent(event);
        exportBtn.click();
        return;
      }
      if (!isSearch && matchesShortcut(event, pickerClearFavShortcut)) {
        consumePickerShortcutEvent(event);
        clearFavBtn.click();
        return;
      }
      if (!isSearch && matchesShortcut(event, pickerRestoreFavShortcut)) {
        consumePickerShortcutEvent(event);
        restoreFavBtn.click();
        return;
      }
      if (!isSearch && matchesShortcut(event, pickerAutoNextShortcut)) {
        consumePickerShortcutEvent(event);
        autoNextBtn.click();
        return;
      }
      if (!isSearch && matchesShortcut(event, pickerAutoRandomShortcut)) {
        consumePickerShortcutEvent(event);
        autoRandomBtn.click();
        return;
      }
      if (mode === "items" && !isSearch && matchesShortcut(event, pickerSelectPageShortcut)) {
        consumePickerShortcutEvent(event);
        selectPageBtn.click();
        return;
      }
      if (mode === "items" && !isSearch && matchesShortcut(event, pickerClearSelectionShortcut)) {
        consumePickerShortcutEvent(event);
        clearSelectionBtn.click();
        return;
      }
      if (mode === "items" && !isSearch && matchesShortcut(event, pickerBulkDeleteShortcut)) {
        consumePickerShortcutEvent(event);
        bulkDeleteBtn.click();
        return;
      }
      if (mode === "items" && !isSearch && matchesShortcut(event, pickerBulkFavShortcut)) {
        consumePickerShortcutEvent(event);
        bulkFavBtn.click();
        return;
      }
      if (!isSearch && matchesShortcut(event, pickerRenameCategoryShortcut)) {
        consumePickerShortcutEvent(event);
        const targetCatId = getSidePanelTargetCategoryId();
        if (targetCatId) renameCategoryById(targetCatId);
        return;
      }
      if (!isSearch && matchesShortcut(event, pickerScanDupShortcut)) {
        consumePickerShortcutEvent(event);
        scanDupBtn.click();
        return;
      }
      if (!isSearch && matchesShortcut(event, pickerToggleFavShortcut)) {
        consumePickerShortcutEvent(event);
        topFavBtn.click();
        return;
      }
      if (!isSearch && matchesShortcut(event, pickerTrashShortcut)) {
        consumePickerShortcutEvent(event);
        trashBtn.click();
        return;
      }
      if (!isSearch && matchesShortcut(event, pickerPinShortcut)) {
        consumePickerShortcutEvent(event);
        pinBtn.click();
        return;
      }
      if (mode === "items") {
        if (event.key === "ArrowLeft" && (!isSearch || !input.value)) {
          event.preventDefault();
          event.stopPropagation();
          if (totalPages <= 1 || page <= 1) {
            // Fokus ke category side panel
            if (categorySidePanel.style.display === "flex") {
              focusCategorySidePanel();
            }
          } else {
            goToPage(page - 1);
          }
          return;
        }
        if (event.key === "ArrowRight" && (!isSearch || !input.value) && totalPages > 1 && page < totalPages) {
          event.preventDefault();
          event.stopPropagation();
          goToPage(page + 1);
          return;
        }
      }
      if (!visibleEntries.length) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        selectionActive = true;
        const prevIndex = activeIndex;
        setActiveIndex(activeIndex + 1);
        syncActiveCategoryFromActiveIndex();
        if (mode === "items") {
          fastUpdateActiveHighlight(prevIndex, activeIndex);
        } else {
          render();
        }
        playHoverSound();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        selectionActive = true;
        const prevIndex = activeIndex;
        setActiveIndex(activeIndex - 1);
        syncActiveCategoryFromActiveIndex();
        if (mode === "items") {
          fastUpdateActiveHighlight(prevIndex, activeIndex);
        } else {
          render();
        }
        playHoverSound();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        selectEntry(visibleEntries[activeIndex]);
      } else if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        selectEntry(visibleEntries[activeIndex]);
      } else if (event.key === " " && mode === "items" && !isSearch) {
        // Space — tick/untick kotak semak pada item aktif
        event.preventDefault();
        event.stopPropagation();
        const entry = visibleEntries[activeIndex];
        if (entry && entry.id) {
          const nowSelected = !selectedItemIds.has(entry.id);
          setItemSelected(entry.id, nowSelected);
          render();
        }
      }
      // Let Alt+Z/R pass through for Firefox command system (commands.onCommand)
      const altPressedFinal = event.altKey || (event.getModifierState && event.getModifierState('Alt'));
      const isAltZ = altPressedFinal && !event.ctrlKey && !event.metaKey && !event.shiftKey && (event.key || '').toLowerCase() === 'z';
      const isAltR = altPressedFinal && !event.ctrlKey && !event.metaKey && !event.shiftKey && (event.key || '').toLowerCase() === 'r';
      if (!isAltZ && !isAltR) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function handlePickerCommand(command) {
      if (!command) return false;
      if (command === "save-current-tab") {
        saveCurrentBtn.click();
        return true;
      }
      if (command === "save-all-tabs") {
        saveAllBtn.click();
        return true;
      }
      if (command === "open-settings") {
        settingsBtn.click();
        return true;
      }
      if (command === "new-category") {
        if (mode !== "categories") return false;
        createCategory();
        return true;
      }
      if (command === "rename-category") {
        if (mode !== "categories") return false;
        renameActiveCategory();
        return true;
      }
      if (command === "delete-category") {
        if (mode !== "categories") return false;
        deleteActiveCategory();
        return true;
      }
      if (command === "move-category-next") {
        return moveActiveItemCategory(1);
      }
      if (command === "move-category-prev") {
        return moveActiveItemCategory(-1);
      }
      if (command === "toggle-favorites") {
        topFavBtn.click();
        return true;
      }
      if (command === "toggle-sort") {
        if (mode !== "items") return false;
        sortBtn.click();
        return true;
      }
      if (command === "page-prev") {
        if (mode !== "items") return false;
        if (totalPages <= 1 || page <= 1) {
          // Fokus ke category side panel
          if (categorySidePanel.style.display === "flex") {
            focusCategorySidePanel();
          }
        } else {
          goToPage(page - 1);
        }
        return true;
      }
      if (command === "page-next") {
        if (mode !== "items") return false;
        if (totalPages > 1 && page < totalPages) {
          goToPage(page + 1);
        } else if (visibleEntries.length) {
          selectEntry(visibleEntries[activeIndex]);
        }
        return true;
      }
      if (command === "open-random") {
        return selectRandomItemEntry();
      }
      if (command === "open-next") {
        return selectNextItemEntry();
      }
      if (command === "back") {
        if (mode !== "items") return false;
        // Fokus ke category side panel
        if (categorySidePanel.style.display === "flex") {
          focusCategorySidePanel();
        }
        return true;
      }
      if (command === "select") {
        if (!visibleEntries.length) return false;
        selectEntry(visibleEntries[activeIndex]);
        return true;
      }
      if (command === "close") {
        close();
        return true;
      }
      if (command === "move-up") {
        if (!visibleEntries.length) return false;
        selectionActive = true;
        setActiveIndex(activeIndex - 1);
        syncActiveCategoryFromActiveIndex();
        render();
        return true;
      }
      if (command === "move-down") {
        if (!visibleEntries.length) return false;
        selectionActive = true;
        setActiveIndex(activeIndex + 1);
        syncActiveCategoryFromActiveIndex();
        render();
        return true;
      }
      if (command === "youtube-summary") {
        runGlobalCategoryShortcutFallback("picker-youtube-summary");
        return true;
      }
      if (command === "toggle-pin") {
        pinBtn.click();
        return true;
      }
      if (command === "toggle-auto-page-turn") {
        autoPageToggleBtn.click();
        return true;
      }
      // Reset active category ke "all" untuk pool semasa
      if (command === "reset-to-all") {
        activeCategoryId = "all";
        lastOpenedItemId = "";
        try {
          lpApi.storage.local.set({ selectedCategory: "all" });
          if (lpApi.runtime && lpApi.runtime.sendMessage) {
            lpApi.runtime.sendMessage({ type: "request-badge" }).catch(() => {});
          }
        } catch (_) {}
        if (mode === "items") {
          try { ensureItemsLoadedForActiveScope({ force: true }); } catch (_) {}
        } else {
          refreshDerived();
          applyFilter();
        }
        return true;
      }
      return false;
    }

    if (lpApi.runtime && lpApi.runtime.onMessage && lpApi.runtime.onMessage.addListener) {
      if (runtimeMessageHandler && lpApi.runtime.onMessage.removeListener) {
        try { lpApi.runtime.onMessage.removeListener(runtimeMessageHandler); } catch (err) {}
      }
      runtimeMessageHandler = (message) => {
        if (!message) return;
        if (message.type === "refresh-picker-ui") {
          // Guna ensureItemsLoadedForActiveScope untuk reload items dari background
          // (guna cachedItems, elak baca storage terus)
          if (mode === "items") {
            try {
              ensureItemsLoadedForActiveScope({ force: true });
            } catch (err) {
              console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
            }
          } else {
            refreshDerived({ preserveActiveEntry: true });
            render();
          }
          return { ok: true };
        }
        if (message.type !== "category-picker-command") return;
        // Handle switch-category command dari background (apabila mini category tukar kategori)
        if (message.command === "switch-category" && message.categoryId) {
          const newCategoryId = String(message.categoryId);
          if (newCategoryId !== activeCategoryId) {
            activeCategoryId = newCategoryId;
            lastOpenedItemId = "";
            if (mode === "items") {
              try {
                ensureItemsLoadedForActiveScope({ force: true });
              } catch (err) {
                console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
              }
            } else {
              setMode("items");
            }
          }
          return { ok: true };
        }
        const handled = handlePickerCommand(message.command ? String(message.command) : "");
        return { ok: handled };
      };
      lpApi.runtime.onMessage.addListener(runtimeMessageHandler);
    }

    input.addEventListener("input", () => {
      if (filterInputTimer) {
        clearTimeout(filterInputTimer);
      }
      filterInputTimer = setTimeout(() => {
        filterInputTimer = null;
        applyFilter();
      }, FILTER_INPUT_DEBOUNCE_MS);
    });
    window.addEventListener("keydown", onKeyDown, true);
    backBtn.addEventListener("click", () => {
      // Fokus ke category side panel
      if (categorySidePanel.style.display === "flex") {
        focusCategorySidePanel();
      }
    });
    importBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      importFileInput.value = "";
      // Set flag supaya visibilitychange tidak tutup picker
      // apabila OS file dialog menyebabkan tab kelihatan hidden
      _suppressVisibilityClose = true;
      importFileInput.click();
    });
    exportBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      quickExportBackup();
    });
    importFileInput.addEventListener("change", (event) => {
      const file = event.target && event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          await quickImportBackup(e && e.target ? e.target.result : "");
        } catch (err) {
          if (hint) hint.textContent = "Import failed.";
        } finally {
          importFileInput.value = "";
        }
      };
      reader.readAsText(file);
    });
    settingsBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      try {
        if (lpApi.runtime && lpApi.runtime.sendMessage) {
          lpApi.runtime.sendMessage({ type: "open-options" });
          return;
        }
        if (lpApi.runtime && lpApi.runtime.openOptionsPage) {
          lpApi.runtime.openOptionsPage();
          return;
        }
        if (lpApi.runtime && lpApi.runtime.getURL) {
          window.open(lpApi.runtime.getURL("options.html"), "_blank");
        }
      } catch (err) {
        // ignore
      }
    });
    saveAllBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!lpApi.runtime || !lpApi.runtime.sendMessage) return;
      flashHint("Saving tabs...");
      try {
        const response = lpApi.runtime.sendMessage({ type: "save-all-tabs" });
        if (response && typeof response.then === "function") {
          response.then((result) => {
            if (result && result.busy) {
              flashHint("Save all sedang berjalan. Sila tunggu.");
            } else if (result && typeof result.added === "number") {
              const skipped = Number.isFinite(result.skipped) ? result.skipped : 0;
              if (skipped > 0) {
                flashHint(
                  "Saved "
                  + result.added
                  + " tab"
                  + (result.added === 1 ? "" : "s")
                  + " · "
                  + skipped
                  + " sudah disimpan."
                );
              } else {
                flashHint("Saved " + result.added + " tab" + (result.added === 1 ? "" : "s") + ".");
              }
            } else {
              flashHint("Save complete.");
            }
          }).catch(() => {
            flashHint("Save failed.");
          });
        }
      } catch (err) {
        flashHint("Save failed.");
      }
    });
    saveCurrentBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!lpApi.runtime || !lpApi.runtime.sendMessage) return;
      flashHint("Saving current tab...");
      try {
        const response = lpApi.runtime.sendMessage({ type: "save-current-tab" });
        if (response && typeof response.then === "function") {
          response.then((result) => {
            if (result && result.ok) {
              const label = result && result.categoryName
                ? result.categoryName
                : getCategoryLabel(
                  result && result.categoryId ? result.categoryId : activeCategoryId
                );
              flashHint(label ? ("Saved to " + label + ".") : "Saved current tab.");
              if (mode === "items") {
                ensureItemsLoadedForActiveScope({ force: true }).catch(() => {});
              } else {
                refreshDerived({ preserveActiveEntry: true });
                applyFilter();
                render();
              }
            } else {
              flashHint("Save failed.");
            }
          }).catch(() => {
            flashHint("Save failed.");
          });
        }
      } catch (err) {
        flashHint("Save failed.");
      }
    });
    sidebarAiSelect.addEventListener("change", async (event) => {
      event.stopPropagation();
      const nextProvider = normalizeSidebarAiProvider(sidebarAiSelect.value);
      const previousProvider = sidebarAiProvider;
      if (nextProvider === previousProvider) return;
      sidebarAiProvider = nextProvider;
      sidebarAiSelect.value = nextProvider;
      sidebarAiSelect.title = "Sidebar AI: " + getSidebarAiLabel(nextProvider);
      sidebarAiSelect.disabled = true;
      const saved = await updatePickerSettings({ sidebarAiProvider: nextProvider });
      sidebarAiSelect.disabled = false;
      if (!saved) {
        sidebarAiProvider = previousProvider;
        sidebarAiSelect.value = previousProvider;
        sidebarAiSelect.title = "Sidebar AI: " + getSidebarAiLabel(previousProvider);
        return;
      }
      flashHint("Sidebar AI: " + getSidebarAiLabel(nextProvider) + ".");
    });
    autoNextBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const enabled = !youtubeAutoNext;
      await updatePickerSettings({ youtubeAutoNext: enabled });
      flashHint(enabled ? "Auto Next diaktifkan." : "Auto Next dimatikan.");
    });
    autoRandomBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const enabled = !youtubeAutoRandom;
      await updatePickerSettings({ youtubeAutoRandom: enabled });
      flashHint(enabled ? "Auto Random diaktifkan." : "Auto Random dimatikan.");
    });
    deleteAfterOpenBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const enabled = !deleteAfterOpenActive;
      await updatePickerSettings({ deleteAfterOpen: enabled });
      flashHint(enabled ? "Delete after open diaktifkan." : "Delete after open dimatikan.");
    });
    newCategoryBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      createCategory();
    });
    renameCategoryBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      renameActiveCategory();
    });
    deleteCategoryBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteActiveCategory();
    });
    trashBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openTrashPanel();
    });
    categoryMenuOpenBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const state = categoryContextMenuState;
      if (!state || !state.categoryId) return;
      const targetId = String(state.categoryId);
      closeCategoryContextMenu();
      const targetEntry = categoryEntries.find((entry) => {
        return entry && entry.type !== "current" && String(entry.id) === targetId;
      });
      if (!targetEntry) {
        refreshDerived();
        return;
      }
      selectEntry(targetEntry);
    });
    categoryMenuHideBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const state = categoryContextMenuState;
      if (!state || !isHideableCategoryId(state.categoryId)) return;
      const targetId = String(state.categoryId);
      closeCategoryContextMenu();
      await toggleCategoryHiddenById(targetId);
    });
    categoryMenuRenameBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const state = categoryContextMenuState;
      if (!state || !isRenamableCategoryId(state.categoryId)) return;
      const targetId = String(state.categoryId);
      closeCategoryContextMenu();
      await renameCategoryById(targetId);
    });
    categoryMenuDeleteBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const state = categoryContextMenuState;
      if (!state || !isDeletableCategoryId(state.categoryId)) return;
      const targetId = String(state.categoryId);
      closeCategoryContextMenu();
      await deleteCategoryById(targetId);
    });

    // ── Item image context menu button handlers ──────────────────────────────

    // Helper: hantar kemaskini faviconUrl atau thumbnailUrl ke background dan refresh UI
    async function saveItemImageField(itemId, fields) {
      try {
        const resp = await lpApi.runtime.sendMessage({
          type: "set-item-image",
          itemId,
          fields,
        });
        if (resp && resp.ok) {
          try {
            await ensureItemsLoadedForActiveScope({ force: true });
          } catch (err) {
            console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
          }
        } else {
          flashHint("Failed to update.");
        }
      } catch (e) {
        flashHint("Failed to update.");
      }
    }

    // Refresh thumbnail — fetch semula dari URL halaman
    itemMenuRefetchThumbBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const state = itemImageContextMenuState;
      closeItemImageContextMenu();
      if (!state) return;
      flashHint("Fetching thumbnail…");
      try {
        await lpApi.runtime.sendMessage({
          type: "fetch-thumbnail-on-demand",
          itemId: state.itemId,
          url: state.entry.url || "",
          force: true,
        });
        try {
          await ensureItemsLoadedForActiveScope({ force: true });
        } catch (err) {
          console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
        }
        flashHint("Thumbnail updated.");
      } catch (e) {
        flashHint("Fetch failed.");
      }
    });

    // Set thumbnail URL manual — tunjuk input prompt
    itemMenuSetThumbUrlBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const state = itemImageContextMenuState;
      closeItemImageContextMenu();
      if (!state) return;

      // Bina dialog input inline
      const dialog = document.createElement("div");
      dialog.style.cssText = [
        "position:fixed", "inset:0", "z-index:2147483647",
        "display:flex", "align-items:center", "justify-content:center",
        "background:rgba(0,0,0,0.55)",
      ].join(";");

      const box = document.createElement("div");
      box.style.cssText = [
        "background:rgba(22,22,22,0.98)", "border:1px solid rgba(255,255,255,0.14)",
        "border-radius:12px", "padding:18px 20px", "width:340px",
        "box-shadow:0 16px 40px rgba(0,0,0,0.6)", "display:flex",
        "flex-direction:column", "gap:10px",
      ].join(";");

      const title = document.createElement("div");
      title.textContent = "Set thumbnail URL";
      title.style.cssText = "color:#fff;font-size:13px;font-weight:600;";

      const input = document.createElement("input");
      input.type = "url";
      input.placeholder = "https://example.com/image.jpg";
      input.value = state.entry.thumbnailUrl || state.entry.pickerThumbnailUrl || "";
      input.style.cssText = [
        "width:100%", "box-sizing:border-box", "padding:8px 10px",
        "border-radius:8px", "border:1px solid rgba(255,255,255,0.18)",
        "background:rgba(255,255,255,0.07)", "color:#fff",
        "font-size:12px", "outline:none",
      ].join(";");

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = "padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.08);color:#fff;font-size:12px;cursor:pointer;";

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.textContent = "Save";
      saveBtn.style.cssText = "padding:6px 14px;border-radius:8px;border:none;background:#5ac8ff;color:#000;font-size:12px;font-weight:600;cursor:pointer;";

      btnRow.append(cancelBtn, saveBtn);
      box.append(title, input, btnRow);
      dialog.appendChild(box);
      overlay.appendChild(dialog);
      input.focus();
      input.select();

      const close = () => dialog.remove();
      cancelBtn.addEventListener("click", close);
      dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });
      input.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          saveBtn.click();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      });
      saveBtn.addEventListener("click", async () => {
        const url = input.value.trim();
        close();
        if (!url) return;
        await saveItemImageField(state.itemId, { thumbnailUrl: url, thumbnailFetchFailed: false, thumbnailManual: true });
        flashHint("Thumbnail set.");
      });
    });

    // Set favicon URL manual
    itemMenuSetFaviconUrlBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const state = itemImageContextMenuState;
      closeItemImageContextMenu();
      if (!state) return;

      const dialog = document.createElement("div");
      dialog.style.cssText = [
        "position:fixed", "inset:0", "z-index:2147483647",
        "display:flex", "align-items:center", "justify-content:center",
        "background:rgba(0,0,0,0.55)",
      ].join(";");

      const box = document.createElement("div");
      box.style.cssText = [
        "background:rgba(22,22,22,0.98)", "border:1px solid rgba(255,255,255,0.14)",
        "border-radius:12px", "padding:18px 20px", "width:340px",
        "box-shadow:0 16px 40px rgba(0,0,0,0.6)", "display:flex",
        "flex-direction:column", "gap:10px",
      ].join(";");

      const title = document.createElement("div");
      title.textContent = "Set favicon URL";
      title.style.cssText = "color:#fff;font-size:13px;font-weight:600;";

      const input = document.createElement("input");
      input.type = "url";
      input.placeholder = "https://example.com/favicon.ico";
      input.value = state.entry.faviconUrl || "";
      input.style.cssText = [
        "width:100%", "box-sizing:border-box", "padding:8px 10px",
        "border-radius:8px", "border:1px solid rgba(255,255,255,0.18)",
        "background:rgba(255,255,255,0.07)", "color:#fff",
        "font-size:12px", "outline:none",
      ].join(";");

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = "padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.08);color:#fff;font-size:12px;cursor:pointer;";

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.textContent = "Save";
      saveBtn.style.cssText = "padding:6px 14px;border-radius:8px;border:none;background:#5ac8ff;color:#000;font-size:12px;font-weight:600;cursor:pointer;";

      btnRow.append(cancelBtn, saveBtn);
      box.append(title, input, btnRow);
      dialog.appendChild(box);
      overlay.appendChild(dialog);
      input.focus();
      input.select();

      const close = () => dialog.remove();
      cancelBtn.addEventListener("click", close);
      dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });
      input.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          saveBtn.click();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      });
      saveBtn.addEventListener("click", async () => {
        const url = input.value.trim();
        close();
        if (!url) return;
        await saveItemImageField(state.itemId, { faviconUrl: url });
        flashHint("Favicon set.");
      });
    });

    // Clear thumbnail
    itemMenuClearThumbBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const state = itemImageContextMenuState;
      closeItemImageContextMenu();
      if (!state) return;
      await saveItemImageField(state.itemId, { thumbnailUrl: "", thumbnailFetchFailed: false });
      flashHint("Thumbnail cleared.");
    });

    // Tutup item image menu apabila klik di luar
    overlay.addEventListener("click", (e) => {
      if (itemImageContextMenuState && !itemImageContextMenu.contains(e.target)) {
        closeItemImageContextMenu();
      }
    }, true);

    topFavBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavoriteView();
    });
    clearFavBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      clearFilteredFavorites();
    });
    restoreFavBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      restoreClearedFavorites();
    });
    scanDupBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!lpApi.runtime || !lpApi.runtime.sendMessage) return;
      flashHint("Mengimbas link pendua...");
      try {
        const maybe = lpApi.runtime.sendMessage({ type: "dedupe-items" });
        if (maybe && typeof maybe.then === "function") {
          maybe.then((result) => {
            if (result && result.ok) {
              if (result.deduped) {
                flashHint("Imbasan tamat. Link pendua telah digabungkan.");
                if (mode === "items") {
                  try {
                    ensureItemsLoadedForActiveScope({ force: true });
                  } catch (err) {
                    console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
                  }
                } else {
                  refreshDerived({ preserveActiveEntry: true });
                  applyFilter();
                  render();
                }
              } else {
                flashHint("Tiada link pendua ditemui.");
              }
            } else {
              flashHint("Gagal mengimbas link pendua.");
            }
          }).catch(() => {
            flashHint("Gagal mengimbas link pendua.");
          });
        }
      } catch (err) {
        flashHint("Gagal mengimbas link pendua.");
      }
    });
    sortBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (activeCategoryId !== "all") return; // sorting disabled outside All
      if (itemFilter === "fav") {
        if (sortDir === "manual") {
          sortDir = "desc";
        } else if (sortDir === "desc") {
          sortDir = "asc";
        } else {
          sortDir = "manual";
        }
        favoriteSortMode = sortDir;
        updatePickerSettings({ favoritesSortMode: favoriteSortMode });
        sendFavoritesDebugLog("picker-favorites-sort-changed", {
          sortDir,
          favoriteSortMode,
          itemFilter,
          activeCategoryId,
        });
      } else if (sortDir === "desc") {
        sortDir = "asc";
      } else {
        sortDir = "desc";
      }
      page = 1;
      lastOpenedItemId = ""; // clear highlight apabila tukar sort
      updateToolbar();
      itemEntries = buildItemEntries(activeCategoryId);
      updateHint();
      applyFilter();
    });
    selectPageBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSelectVisibleItems();
    });
    clearSelectionBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      clearSelectedItems();
    });
    bulkMoveSelect.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    bulkMoveSelect.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    bulkMoveSelect.addEventListener("change", (event) => {
      event.stopPropagation();
      updateToolbar();
    });
    bulkMoveSelect.addEventListener("change", async (event) => {
      if (moveActionInProgress) {
        flashHint("Sedang memproses pindahan. Sila tunggu.");
        bulkMoveSelect.value = BULK_SELECT_PLACEHOLDER;
        return;
      }
      const targetValue = event.target.value;
      if (targetValue === BULK_SELECT_PLACEHOLDER) return;
      await moveSelectedItemsToCategory(targetValue);
    });
    bulkDeleteBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await deleteSelectedItems();
    });
    bulkFavBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await favSelectedItems();
    });
    undoToastBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (await undoPendingDelete()) return;
      await undoPendingMove();
    });
    prevPageBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (page <= 1) return;
      goToPage(page - 1);
    });
    nextPageBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (page >= totalPages) return;
      goToPage(page + 1);
    });
    prevPageBtnRight.addEventListener("click", (event) => {
      event.stopPropagation();
      if (page <= 1) return;
      goToPage(page - 1);
    });
    nextPageBtnRight.addEventListener("click", (event) => {
      event.stopPropagation();
      if (page >= totalPages) return;
      goToPage(page + 1);
    });
    list.addEventListener("dragover", (event) => {
      if (!dragMoveItemIds.length) return;
      maybeRevealDropPanelFromDragEvent(event);
      updateDragAutoScroll(event);
    });
    list.addEventListener("drop", () => {
      clearReorderHoverRow();
      clearCategoryDropHoverRow();
      stopDragAutoScroll();
      scheduleDropPanelAutoHide();
    });
    dropSidePanel.addEventListener("dragenter", () => {
      if (!dragMoveItemIds.length) return;
      clearReorderHoverRow();
      stopDragAutoScroll();
    });
    dropSidePanel.addEventListener("dragover", (event) => {
      if (!dragMoveItemIds.length) return;
      event.preventDefault();
      clearReorderHoverRow();
      stopDragAutoScroll();
      if (event && event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });
    dropSidePanel.addEventListener("drop", () => {
      clearReorderHoverRow();
      clearCategoryDropHoverRow();
      stopDragAutoScroll();
      scheduleDropPanelAutoHide();
    });
    categoryContextMenu.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    categoryContextMenu.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    overlay.addEventListener("dragover", (event) => {
      if (!dragMoveItemIds.length) return;
      maybeRevealDropPanelFromDragEvent(event);
    });
    overlay.addEventListener("click", (event) => {
      if (Date.now() < suppressOverlayClickUntil) {
        return;
      }
      if (
        categoryPaletteOpen
        && categoryPalette
        && !categoryPalette.contains(event.target)
      ) {
        closeCategoryPalette();
      }
      if (
        categorySwipeDeleteOpenEl
        && !categorySwipeDeleteOpenEl.contains(event.target)
      ) {
        closeCategorySwipeDeleteOpen();
      }
      if (
        categoryContextMenuState
        && !categoryContextMenu.contains(event.target)
      ) {
        closeCategoryContextMenu();
      }
      if (event.target === overlay) close();
      // Tutup bila klik pada background overlay di luar semua panel utama
      // Semak dengan tepat — hanya tutup jika klik BUKAN dalam mana-mana elemen picker
      else if (
        event.target !== overlay &&
        !panelShell.contains(event.target) &&
        !(categoryContextMenu && categoryContextMenu.contains(event.target)) &&
        !(imagePickerPanel && imagePickerPanel.contains(event.target)) &&
        !(categoryPalette && categoryPalette.contains(event.target)) &&
        !(sideCatCtxMenu && sideCatCtxMenu.contains(event.target)) &&
        !(categorySidePanel && categorySidePanel.contains(event.target)) &&
        Date.now() >= suppressOverlayClickUntil
      ) {
        close();
      }
    });

    let _suppressVisibilityClose = false;
    const _onVisibilityChange = () => {
      if (document.hidden) {
        if (_suppressVisibilityClose) {
          _suppressVisibilityClose = false;
          return;
        }
        document.removeEventListener("visibilitychange", _onVisibilityChange);
        close();
      }
    };
    document.addEventListener("visibilitychange", _onVisibilityChange);

    if (lpApi.storage && lpApi.storage.onChanged && lpApi.storage.onChanged.addListener) {
      storageChangeHandler = (changes, area) => {
        if (area !== "local") return;
        let needsRefresh = false;
        let refreshOptions = {};
        if (changes[ITEM_KEY]) {
          const newItems = changes[ITEM_KEY].newValue || [];
          const newHash = buildItemsHash(newItems);
          // Abaikan jika hash ini masih dalam senarai recent — ia echo dari tulis sendiri
          const isPending = newHash && recentWriteHashes.includes(newHash);
          if (!isPending) {
            replaceItems(newItems);
            needsRefresh = true;
            if (mode === "items") {
              refreshOptions.preserveActiveEntry = true;
            }
          }
        }
        if (changes[CATEGORY_KEY]) {
          replaceCategories(changes[CATEGORY_KEY].newValue || []);
          needsRefresh = true;
          if (mode === "items") {
            refreshOptions.preserveActiveEntry = true;
          }
        }
        if (changes[SELECTED_CATEGORY_KEY]) {
          // Kategori terpilih berubah dari luar picker (contoh: mini category dalam floating button)
          const newCategoryId = changes[SELECTED_CATEGORY_KEY].newValue
            ? String(changes[SELECTED_CATEGORY_KEY].newValue)
            : "none";
          if (newCategoryId && newCategoryId !== activeCategoryId) {
            activeCategoryId = newCategoryId;
            lastOpenedItemId = "";
            if (mode === "items") {
              // Sudah dalam mod items — reload items untuk kategori baru
              try {
                ensureItemsLoadedForActiveScope({ force: true });
              } catch (err) {
                console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
              }
            } else {
              // Dalam mod categories — tukar ke items
              setMode("items");
            }
            return;
          }
        }
        if (changes[SETTINGS_KEY]) {
          const next = changes[SETTINGS_KEY].newValue && typeof changes[SETTINGS_KEY].newValue === "object"
            ? changes[SETTINGS_KEY].newValue
            : {};
          const oldShowHidden = showHiddenCategories;
          showHiddenCategories = next.showHiddenCategories;
          if (showHiddenCategories === true) showHiddenCategories = 1;
          if (showHiddenCategories === false || typeof showHiddenCategories === "undefined") showHiddenCategories = 0;
          
          youtubeAutoNext = next.youtubeAutoNext === true;
          youtubeAutoRandom = next.youtubeAutoRandom === true;
          deleteAfterOpenActive = next.deleteAfterOpen === true;
          randomAcrossAllCategories = next.randomAcrossAllCategories === true;
          if (typeof updateRandomAllBtn === "function") updateRandomAllBtn();
          navigationFavoritesOnly = next.navigationFavoritesOnly === true;
          favoriteSortMode = ["manual", "asc", "desc"].includes(String(next.favoritesSortMode || "").toLowerCase())
            ? String(next.favoritesSortMode).toLowerCase()
            : "manual";
          const desiredItemFilter = navigationFavoritesOnly ? "fav" : "all";
          if (desiredItemFilter !== itemFilter) {
            itemFilter = desiredItemFilter;
            if (itemFilter === "fav") {
              sortDir = favoriteSortMode;
            }
            page = 1;
            needsRefresh = true;
            refreshOptions = {};
          }

          if (oldShowHidden !== showHiddenCategories && mode === "items") {
            try {
              ensureItemsLoadedForActiveScope({ force: true });
            } catch (err) {
              console.warn('[Picker] ensureItemsLoadedForActiveScope failed:', err);
            }
            return; // ensureItemsLoadedForActiveScope will handle refresh/render
          }

          needsRefresh = true;
          updateTopBar();
          updateToolbar();
        }
        if (needsRefresh) {
          scheduleRefreshDerived(refreshOptions);
        }
      };
      lpApi.storage.onChanged.addListener(storageChangeHandler);
    }

    startPicker();
    }, 0);
  })();`;
}

