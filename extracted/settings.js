// Use var to avoid any accidental redeclaration across background scripts.
var api = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : {});

const SETTINGS_KEY = "settings";
const THEME_PRESETS = ["classic", "ocean", "sunset", "modern", "minimal", "cyber", "forest", "pastel", "mono", "oled", "sepia", "retro", "aurora", "custom"];

const DEFAULT_CUSTOM_COLORS = {
  bg: "#1a1a2e",
  bgAlt: "#16213e",
  panel: "#0f3460",
  panelAlt: "#1a1a4e",
  ink: "#e0e0e0",
  muted: "#a0a0b0",
  accent: "#e94560",
  accent2: "#f5a623",
  accent3: "#533483",
  accent4: "#0f3460",
  border: "#2a2a4e"
};
const SIDEBAR_AI_PROVIDERS = [
  "chatgpt",
  "claude",
  "gemini",
  "google",
  "perplexity",
  "copilot",
  "grok",
  "deepseek",
  "poe",
  "mistral",
  "notebooklm"
];
// Modern floating button icons: glossy plus (icon_2) and yellow lightning (icon_3)
const FLOATING_BUTTON_ICONS = ["icon_2.png", "icon_3.png"];
const LINK_SAVE_MODIFIER_COMBOS = [
  "ctrl",
  "alt",
  "shift",
  "meta",
  "ctrl+alt",
  "ctrl+shift",
  "ctrl+meta",
  "alt+shift",
  "alt+meta",
  "shift+meta",
  "ctrl+alt+shift",
  "ctrl+alt+meta",
  "ctrl+shift+meta",
  "alt+shift+meta",
  "ctrl+alt+shift+meta"
];
const LINK_SAVE_MOUSE_BUTTONS = ["left", "middle", "right", "hover"];
const LINK_SAVE_KEY_ALIASES = {
  space: "Space",
  spacebar: "Space",
  enter: "Enter",
  return: "Enter",
  tab: "Tab",
  escape: "Esc",
  esc: "Esc",
  backspace: "Backspace",
  delete: "Delete",
  del: "Delete",
  insert: "Insert",
  ins: "Insert",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pgup: "PageUp",
  pagedown: "PageDown",
  pgdn: "PageDown",
  arrowleft: "Left",
  left: "Left",
  arrowright: "Right",
  right: "Right",
  arrowup: "Up",
  up: "Up",
  arrowdown: "Down",
  down: "Down",
  capslock: "CapsLock",
  numlock: "NumLock",
  scrolllock: "ScrollLock",
  pause: "Pause",
  printscreen: "PrintScreen",
  menu: "Menu"
};
const DEFAULT_SETTINGS = {
  showBadge: true,
  showPageAction: true,
  enableCategoryPicker: true,
  enableDedupeButton: true,
  deleteAfterOpen: false,
  // Shortcut used inside category picker to open move-to-category palette
  // Fixed default: single quote key (')
  categoryPaletteShortcut: "'",
  // Optional extra shortcuts inside the category picker for page navigation.
  // ArrowLeft/ArrowRight always remain active.
  pickerHoverSound: false,
  // Optional custom hover sounds (up to 10) and active selection.
  pickerHoverSounds: [],
  activePickerHoverSoundId: "",
  // Configurable keyboard shortcuts for category picker buttons (all optional, empty = disabled).
  pickerImportShortcut: "",
  pickerExportShortcut: "",
  pickerClearFavShortcut: "",
  pickerRestoreFavShortcut: "",
  pickerAutoNextShortcut: "",
  pickerAutoRandomShortcut: "",
  pickerSelectPageShortcut: "",
  pickerClearSelectionShortcut: "",
  pickerBulkDeleteShortcut: "",
  pickerBulkFavShortcut: "",
  pickerRenameCategoryShortcut: "",
  pickerScanDupShortcut: "",
  pickerFavShortcut: "F",
  pickerToggleFavShortcut: "",
  pickerTrashShortcut: "",
  pickerPinShortcut: "",
  commandPaletteShortcut: "Ctrl+K",
  // Hover Image Search: hover atas gambar + tekan shortcut → buka Jarvis sidebar + "cari"
  hoverImageSearchEnabled: true,
  hoverImageSearchShortcut: "Alt+Q",
  // Pintasan boleh dikonfigurasi untuk butang & fungsi di dalam Notes Overlay
  // (nota & mindmap). Kekunci = actionId terus dari handleAction (notesOverlay.js).
  // Nilai = string shortcut (format sama dengan picker shortcuts). Kosong = tiada shortcut.
  notesOverlayShortcuts: {
    "open-mindmap": "",
    "new-note": "",
    "save-now": "",
    "toggle-pin": "",
    "duplicate-note": "",
    "delete-note": "",
    "open-trash": "",
    "toggle-preview": "",
    "npp-back": "",
    "mindmap-zoom-in": "",
    "mindmap-zoom-out": "",
    "mindmap-fit": "",
    "mindmap-toggle-layout": "",
    "mindmap-toggle-mode": "",
    "mindmap-collapse-all": "",
    "mindmap-expand-all": "",
    "mindmap-export-png": "",
    "mindmap-export-svg": "",
    "open-ai": "",
    "new-folder": "",
    "toggle-mindmap-click": "",
    "export-note-txt": "",
    "import-note-txt": "",
    "undo-delete-note": "",
    "toggle-panel-pin": "",
    "set-view-all": "",
    "set-view-pinned": "",
    "set-view-tasks": "",
    "open-todo": "",
    "new-todo-list": "",
    "todo-add-item": "",
    "delete-todo-list": "",
    "rename-todo-list": "",
    "todo-filter-all": "",
    "todo-filter-active": "",
    "todo-filter-completed": ""
  },
  cycleIncludeAll: true,
  cycleIncludeUncategorized: true,
  zoomLevel: "md",
  pageSize: 10,
  pickerAnimation: "fade",
  pickerAnimationDuration: 200,
  pickerLayout: "cozy",
  pickerYoutubeThumbnails: true,
  favoritesSortMode: "manual",
  // Picker start behavior: "home" (category list), "last-category" (last category), "last-page" (last page in last category), or "last-link" (last opened link with full history).
  pickerStartMode: "last-link",
  // Color for the "last opened link" highlight border/glow in the category picker (hex format).
  pickerHighlightColor: "#48d597",
  // Notes overlay start behavior: "home" (categories view) or "last" (open last opened note).
  notesStartMode: "home",
  // Max items kept in trash; 0 = unlimited.
  trashLimit: 0,
  // Floating button: show "Next up" label under icon.
  floatingNextUpLabel: true,
  floatingNextUpMaxWidth: 220,
  closeOnSave: false,
  closeOnSaveAllTabs: false,
  floatingButtonEnabled: true,
  // Enable AI selection button that appears when text is selected on a page.
  floatingAiSelectionEnabled: true,
  // Auto-pause the floating button when eligible web tabs exceed this threshold. 0 = off.
  floatingButtonAutoSuspendTabThreshold: 5,
  // Runtime state maintained by the background script.
  floatingButtonAutoSuspendActive: false,
  floatingButtonAutoSuspendTabCount: 0,
  floatingButtonVisibilityMode: "hover", // "hover", "always", "scroll", "click", "longpress"
  miniCategoryTriggerDirection: "right", // "right", "left", "up", "down"
  miniCategoryPanelLayout: "list", // "list", "grid", "horizontal", "radial", "wheel"
  floatingButtonLongPressDuration: 800,
  floatingButtonCategoryPickerLongPressDuration: 250,
  categoryPickerMouseGesture: false,
  // Gesture system (Gesturefy-style)
  gestureEnabled: true,
  gestureMouseButton: "right",
  gestureMaxDeviation: 0.8,
  gestureDirectionSensitivity: 1.0,
  gestureTraceColor: "#e94560",
  gestureTraceWidth: 3,
  gestureDistanceThreshold: 5,
  customGesturePattern: [],
  gestureActionMappings: [
    // Last entry duplicated � format sama dengan extractGesturePattern dan makePatternConstructor.getPattern
    { id: "g_default_dn",     name: "Buka Picker",      pattern: [[0, 200], [0, 200]],                  action: "open-category-picker" },
    { id: "g_default_rt",     name: "Item Pertama",     pattern: [[200, 0], [200, 0]],                  action: "open-first-item" },
    { id: "g_default_lt",     name: "Item Rawak",       pattern: [[-200, 0], [-200, 0]],                action: "open-random-item" },
    { id: "g_default_up",     name: "Simpan",           pattern: [[0, -200], [0, -200]],                action: "save-to-local-pocket" },
    { id: "g_default_dn_rt",  name: "Kategori Set",     pattern: [[0, 200], [200, 0], [200, 0]],        action: "cycle-category" },
    { id: "g_default_dn_lt",  name: "Kategori Sebelum", pattern: [[0, 200], [-200, 0], [-200, 0]],      action: "cycle-category-prev" },
    { id: "g_default_rt_dn",  name: "Nota",             pattern: [[200, 0], [0, 200], [0, 200]],        action: "toggle-notes-overlay" },
    { id: "g_default_up_lt",  name: "AI Sidebar",       pattern: [[0, -200], [-200, 0], [-200, 0]],      action: "open-ai-sidebar" },
    { id: "g_default_up_rt",  name: "AI Overlay",       pattern: [[0, -200], [200, 0], [200, 0]],        action: "toggle-ai-overlay" },
    { id: "g_default_pomodoro", name: "Pomodoro",       pattern: [[0, -200], [0, 200], [-200, 0]],       action: "toggle-pomodoro-overlay" },
    { id: "g_default_todo",    name: "Todo List",      pattern: [[200, 0], [0, -200], [0, -200]],        action: "toggle-todo-overlay" },
  ],

  gestureTimeoutActive: false,
  gestureTimeoutDuration: 2,
  gestureSuppressionKey: "",
  gestureSmartSuppression: true,
  // Gesturefy-compatible settings (baru)
  gestureMatchingAlgorithm: "combined",   // "strict" | "shape-independent" | "combined"
  gestureDeviationTolerance: 0.25,        // maxDeviation (0.05�1.0)
  gestureDifferenceThreshold: 0.12,       // PatternConstructor differenceThreshold (rad, Gesturefy default)
  gestureTraceLineGrowth: true,           // growing line trace (on/off)
  gestureCommandFontSize: "2.5vh",        // saiz font command label
  gestureCommandFontColor: "#ffffff",     // warna teks command label
  gestureCommandBgColor: "#000000b8",     // warna latar command label
  gestureCommandBgOpacity: 72,            // kelegapan latar command label (0-100%)
  gestureCommandPositionX: 50,            // % horizontal (0�100)
  gestureCommandPositionY: 92,            // % vertical (0�100, 92 = bawah)
  gestureExclusions: [],                  // senarai URL pattern untuk disable gesture
  floatingButtonLongPressSwap: false,
  floatingButtonCategoryPickerLongPressEnabled: true,
  blockPickerOnTextCursor: true,
  floatingSubButtonSize: 32,
  // Distance (px) from the right edge before the floating icon appears.
  floatingButtonSensitivity: 150,
  // Legacy alias kept for backward compatibility with older bundles.
  floatingButtonShowTime: 150,
  floatingButtonHideTime: 100,
  floatingButtonAnimation: "fade",
  floatingButtonShowAnimDuration: 200,
  floatingButtonHideAnimDuration: 100,
  floatingButtonSizePreset: "custom",
  floatingButtonSize: 84, // legacy single-size
  floatingButtonWidth: 84,
  floatingButtonHeight: 84,
  floatingButtonOffsetX: 10,
  floatingButtonOffsetY: 300,
  floatingButtonAnchor: "custom", // manual positioning; respects saved offsets
  floatingButtonAnchorX: "right",
  floatingButtonAnchorY: "top",
  floatingButtonDomainExceptions: [],
  ctrlAltLinkSaveEnabled: false,
  linkSaveModifierCombo: "ctrl+alt",
  linkSaveMouseButton: "left",
  linkSaveBundleModifier: "",
  linkSaveDirectModifier: "",
  linkSaveActiveCategoryModifier: "",
  linkSavePromptCategoryEnabled: false,
  linkSaveBundlePromptCategory: true,
  linkSaveBundleDuration: 3,
  linkSavePinnedCategoryIds: [],
  floatingButtonIcon: "custom:1771435255030-i56eqg",
  floatingButtonCustomIcons: (typeof DEFAULT_CUSTOM_ICONS_1 !== "undefined" ? DEFAULT_CUSTOM_ICONS_1 : []).concat(typeof DEFAULT_CUSTOM_ICONS_2 !== "undefined" ? DEFAULT_CUSTOM_ICONS_2 : []),
  showHiddenCategories: 0,
  contextMenuSaveToUncategorized: false,
  navigationFavoritesOnly: false,
  randomAcrossAllCategories: false,
  globalLinkInBackgroundTab: true,
  youtubeAutoNext: false,
  youtubeAutoRandom: false,
  themePreset: "classic",
  customThemeColors: { ...DEFAULT_CUSTOM_COLORS },
  sidebarAiEnabled: true,
  sidebarAiProvider: "gemini",
  // Otak JARVIS (AI brain): provider yang digunakan sebagai "otak" perancang &
  // sembang JARVIS. Berasingan dari sidebarAiProvider supaya pengguna boleh
  // gunakan Gemini untuk AI Sidebar tetapi Claude/Ollama/etc. untuk JARVIS.
  // Lalai "gemini" supaya kelakuan sedia ada kekal.
  jarvisBrainProvider: "gemini",
  // Mode AI button: "sidebar" = buka sidebar, "overlay" = buka floating popup
  aiMode: "sidebar",
  // Paparan JARVIS: "overlay" = popup terapung, "sidebar" = panel dok di tepi
  jarvisMode: "overlay",
  // Default CARA JARVIS dibuka (sidebar panel vs overlay terapung) apabila
  // pengguna MENCETUSKAN buka JARVIS (shortcut/gesture/AI button). Dikawal oleh
  // butang "Tukar paparan JARVIS". Lalai "overlay" supaya butang AI buka JARVIS
  // terapung berdekatan teks (tiada native helper diperlukan).
  jarvisOpenMode: "overlay",
  // Pra-tonton pelan JARVIS sebelum dijalan: papar JSON pelan + butang
  // sahkan (elak arahan berisiko terus jalan tanpa pengesahan).
  jarvisPreviewPlan: true,
  // Ringkasan sentiasa guna sidebar AI
  summaryDeliveryMode: "sidebar",
  // Mode buka summary: "sidebar" = sidebar Local Pocket, "overlay" = popup terapung, "native-sidebar" = sidebar Firefox asli
  summaryOpenMode: "sidebar",
  // Bahasa output untuk ringkasan AI: "ms" (Melayu), "en" (English), "id" (Indonesia), dll.
  summaryOutputLanguage: "ms",
  // Nada penulisan ringkasan: "neutral", "formal", "casual", "educational"
  summaryTone: "neutral",
  // Had maksimum perkataan untuk ringkasan (0 = auto, tanpa had)
  summaryMaxWords: 0,
  // Mod "URL sahaja" untuk Gemini: biar Gemini ambil transkrip sendiri dari URL
  // YouTube (langkau extract transcript oleh extension). Default OFF supaya
  // kelakuan asal kekal.
  summaryYoutubeUrlOnlyForGemini: false,
  // Delay before synthetic F6 is fired to focus AI sidebar prompt.
  sidebarFocusF6DelayMs: 80,
  // When enabled, use the optional Windows native helper to send a real F6 keypress.
  sidebarNativeFocusHelperEnabled: true,
  selectionSearchEnabled: false,
  selectionSearchOrder: ["google", "bing", "ddg", "copy", "custom1", "custom2"],
  selectionSearchEngines: {
    google: { label: "Google", enabled: true, url: "https://www.google.com/search?q=%s" },
    bing: { label: "Bing", enabled: true, url: "https://www.bing.com/search?q=%s" },
    ddg: { label: "DuckDuckGo", enabled: true, url: "https://duckduckgo.com/?q=%s" },
    copy: { label: "Copy", enabled: true, url: "" },
    custom1: { label: "Custom 1", enabled: false, url: "" },
    custom2: { label: "Custom 2", enabled: false, url: "" }
  },
  selectionSearchPopup: {
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
    hideOnEngineClick: true,
    allowShortcutsWithoutPopup: true,
    animationMs: 100,
    autoCopySelection: false
  },
  selectionSearchContextMenu: {
    enabled: false,
    title: "Search for \"%s\"",
    leftClickAction: "new-tab",
    rightClickAction: "new-tab",
    middleClickAction: "new-background-tab"
  },
  selectionSearchEnginesList: [
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
  ],
  rediscoverEnabled: false,
  rediscoverInterval: 86400,
  rediscoverDismissAfterMs: 8000,
  rediscoverMode: "sequential",
  rediscoverCursor: null,
  rediscoverColor: "#8b5cf6",
  rediscoverToastRight: 16,
  rediscoverToastBottom: 16,
};

function normalizeThemePreset(value) {
  const preset = typeof value === "string" ? value.trim().toLowerCase() : "";
  return THEME_PRESETS.includes(preset) ? preset : "classic";
}

function normalizeSidebarAiProvider(value) {
  const provider = typeof value === "string" ? value.trim().toLowerCase() : "";
  return SIDEBAR_AI_PROVIDERS.includes(provider) ? provider : "chatgpt";
}

function normalizeJarvisBrainProvider(value) {
  const provider = typeof value === "string" ? value.trim().toLowerCase() : "";
  return SIDEBAR_AI_PROVIDERS.includes(provider) ? provider : "gemini";
}

function normalizeLinkSaveKeyboardKey(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const alias = LINK_SAVE_KEY_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  if (/^F\d{1,2}$/i.test(raw)) {
    const fn = Number.parseInt(raw.slice(1), 10);
    return Number.isFinite(fn) && fn >= 1 && fn <= 24 ? `F${fn}` : "";
  }
  if (raw.length === 1) return raw.toUpperCase();
  return "";
}

function normalizeLinkSaveTriggerValue(value) {
  const combo = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (LINK_SAVE_MODIFIER_COMBOS.includes(combo)) return combo;
  const key = normalizeLinkSaveKeyboardKey(value);
  return key || DEFAULT_SETTINGS.linkSaveModifierCombo;
}

function normalizePickerShortcut(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  const parts = raw
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  const modifiers = { ctrl: false, alt: false, shift: false, meta: false };
  let key = "";
  for (const part of parts) {
    const normalizedPart = part.toLowerCase();
    if (normalizedPart === "ctrl" || normalizedPart === "control") {
      modifiers.ctrl = true;
      continue;
    }
    if (normalizedPart === "alt" || normalizedPart === "option") {
      modifiers.alt = true;
      continue;
    }
    if (normalizedPart === "shift") {
      modifiers.shift = true;
      continue;
    }
    if (
      normalizedPart === "meta"
      || normalizedPart === "command"
      || normalizedPart === "cmd"
      || normalizedPart === "win"
    ) {
      modifiers.meta = true;
      continue;
    }
    const normalizedKey = normalizeLinkSaveKeyboardKey(part);
    if (!normalizedKey || key) return "";
    key = normalizedKey;
  }
  if (!key) return "";
  const normalized = [];
  if (modifiers.ctrl) normalized.push("Ctrl");
  if (modifiers.alt) normalized.push("Alt");
  if (modifiers.shift) normalized.push("Shift");
  if (modifiers.meta) normalized.push("Command");
  normalized.push(key);
  return normalized.join("+");
}

function normalizeLinkSaveModifierCombo(value) {
  return normalizeLinkSaveTriggerValue(value);
}

function normalizeLinkSaveMouseButton(value) {
  const button = typeof value === "string" ? value.trim().toLowerCase() : "";
  return LINK_SAVE_MOUSE_BUTTONS.includes(button) ? button : DEFAULT_SETTINGS.linkSaveMouseButton;
}

function normalizeLinkSavePinnedCategoryIds(value) {
  const entries = Array.isArray(value) ? value : [];
  const normalized = [];
  const seen = new Set();
  entries.forEach((entry) => {
    const id = entry ? String(entry).trim() : "";
    if (!id || seen.has(id)) return;
    seen.add(id);
    normalized.push(id.slice(0, 120));
  });
  return normalized.slice(0, 20);
}

function normalizeSelectionSearchSettings(value) {
  const raw = value && typeof value === "object" ? value : {};
  const popupRaw = raw.selectionSearchPopup && typeof raw.selectionSearchPopup === "object"
    ? raw.selectionSearchPopup
    : {};
  const contextMenuRaw = raw.selectionSearchContextMenu && typeof raw.selectionSearchContextMenu === "object"
    ? raw.selectionSearchContextMenu
    : {};
  const enginesListRaw = Array.isArray(raw.selectionSearchEnginesList)
    ? raw.selectionSearchEnginesList
    : [];
  const fallbackEnginesRaw = raw.selectionSearchEngines && typeof raw.selectionSearchEngines === "object"
    ? raw.selectionSearchEngines
    : {};
  const fallbackOrderRaw = Array.isArray(raw.selectionSearchOrder) ? raw.selectionSearchOrder : [];
  const defaults = DEFAULT_SETTINGS;

  const normalizeAction = (value, fallback) => {
    const rawValue = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (["new-tab", "new-background-tab", "same-tab"].includes(rawValue)) return rawValue;
    return fallback;
  };

  const normalizePopupSettings = () => {
    const minCharsRaw = Number.parseInt(popupRaw.minChars, 10);
    const maxCharsRaw = Number.parseInt(popupRaw.maxChars, 10);
    const delayRaw = Number.parseInt(popupRaw.delayMs, 10);
    const animRaw = Number.parseInt(popupRaw.animationMs, 10);
    const openBehavior = typeof popupRaw.openBehavior === "string"
      ? popupRaw.openBehavior.trim().toLowerCase()
      : defaults.selectionSearchPopup.openBehavior;
    const location = typeof popupRaw.location === "string"
      ? popupRaw.location.trim().toLowerCase()
      : defaults.selectionSearchPopup.location;
    return {
      enabled: false,
      openBehavior: openBehavior === "manual" ? "manual" : "auto",
      minChars: Number.isFinite(minCharsRaw) ? Math.max(0, minCharsRaw) : defaults.selectionSearchPopup.minChars,
      maxChars: Number.isFinite(maxCharsRaw) ? Math.max(0, maxCharsRaw) : defaults.selectionSearchPopup.maxChars,
      delayMs: Number.isFinite(delayRaw) ? Math.min(Math.max(delayRaw, 0), 5000) : defaults.selectionSearchPopup.delayMs,
      location: location === "selection" ? "selection" : "cursor",
      leftClickAction: normalizeAction(popupRaw.leftClickAction, defaults.selectionSearchPopup.leftClickAction),
      rightClickAction: normalizeAction(popupRaw.rightClickAction, defaults.selectionSearchPopup.rightClickAction),
      middleClickAction: normalizeAction(popupRaw.middleClickAction, defaults.selectionSearchPopup.middleClickAction),
      shortcutAction: normalizeAction(popupRaw.shortcutAction, defaults.selectionSearchPopup.shortcutAction),
      allowOnEditable: popupRaw.allowOnEditable === true,
      hideOnScroll: popupRaw.hideOnScroll !== false,
      hideOnRightClick: popupRaw.hideOnRightClick !== false,
      hideOnEngineClick: popupRaw.hideOnEngineClick !== false,
      allowShortcutsWithoutPopup: popupRaw.allowShortcutsWithoutPopup !== false,
      animationMs: Number.isFinite(animRaw) ? Math.min(Math.max(animRaw, 0), 1200) : defaults.selectionSearchPopup.animationMs,
      autoCopySelection: false
    };
  };

  const normalizeContextMenuSettings = () => {
    return {
      enabled: contextMenuRaw.enabled === true,
      title: (contextMenuRaw.title ? String(contextMenuRaw.title) : defaults.selectionSearchContextMenu.title).slice(0, 120),
      leftClickAction: normalizeAction(contextMenuRaw.leftClickAction, defaults.selectionSearchContextMenu.leftClickAction),
      rightClickAction: normalizeAction(contextMenuRaw.rightClickAction, defaults.selectionSearchContextMenu.rightClickAction),
      middleClickAction: normalizeAction(contextMenuRaw.middleClickAction, defaults.selectionSearchContextMenu.middleClickAction)
    };
  };

  const normalizeShortcut = (value) => {
    const rawValue = typeof value === "string" ? value.trim() : "";
    if (!rawValue) return "";
    if (rawValue.length === 1) return rawValue.toUpperCase();
    return rawValue.slice(0, 2).toUpperCase();
  };

  const normalizeEngineEntry = (entry, index) => {
    const rawEntry = entry && typeof entry === "object" ? entry : {};
    const id = rawEntry.id ? String(rawEntry.id).trim() : `engine-${index}`;
    const typeRaw = rawEntry.type ? String(rawEntry.type).trim().toLowerCase() : "engine";
    const type = ["engine", "copy", "open-link", "separator", "group"].includes(typeRaw) ? typeRaw : "engine";
    const nameRaw = rawEntry.name ? String(rawEntry.name).trim() : "";
    const name = nameRaw ? nameRaw.slice(0, 80) : (type === "separator" ? "Separator" : "New engine");
    const url = rawEntry.url ? String(rawEntry.url).trim().slice(0, 500) : "";
    const iconUrl = rawEntry.iconUrl ? String(rawEntry.iconUrl).trim().slice(0, 500) : "";
    return {
      id: id.slice(0, 60),
      type,
      name,
      url,
      iconUrl,
      showPopup: rawEntry.showPopup !== false && type !== "group" && type !== "separator",
      showContextMenu: rawEntry.showContextMenu === true,
      shortcut: normalizeShortcut(rawEntry.shortcut)
    };
  };

  const mapLegacyEngines = () => {
    const defaultsMap = DEFAULT_SETTINGS.selectionSearchEngines;
    const orderRaw = Array.isArray(fallbackOrderRaw) ? fallbackOrderRaw : [];
    const list = [];
    const seen = new Set();
    orderRaw.forEach((id) => {
      const key = String(id || "").trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      const entry = fallbackEnginesRaw[key] || defaultsMap[key];
      if (!entry) return;
      const isCopy = key === "copy";
      list.push({
        id: key,
        type: isCopy ? "copy" : "engine",
        name: entry.label || key,
        url: entry.url || "",
        iconUrl: "",
        showPopup: entry.enabled !== false,
        showContextMenu: false,
        shortcut: ""
      });
    });
    if (!list.length) {
      DEFAULT_SETTINGS.selectionSearchEnginesList.forEach((engine, idx) => {
        list.push(normalizeEngineEntry(engine, idx));
      });
    }
    return list;
  };

  const normalizedEnginesList = enginesListRaw.length
    ? enginesListRaw.map((entry, idx) => normalizeEngineEntry(entry, idx)).filter((entry) => entry)
    : mapLegacyEngines();

  if (!normalizedEnginesList.length) {
    DEFAULT_SETTINGS.selectionSearchEnginesList.forEach((engine, idx) => {
      normalizedEnginesList.push(normalizeEngineEntry(engine, idx));
    });
  }

  return {
    selectionSearchPopup: normalizePopupSettings(),
    selectionSearchContextMenu: normalizeContextMenuSettings(),
    selectionSearchEnginesList: normalizedEnginesList
  };
}

function normalizeDomainExceptionEntry(value) {
  if (!value || typeof value !== "string") return "";
  let raw = value.trim().toLowerCase();
  if (!raw) return "";
  let wildcard = false;
  if (raw.startsWith("*.")) {
    wildcard = true;
    raw = raw.slice(2);
  }
  if (!raw) return "";
  if (!raw.startsWith("http://") && !raw.startsWith("https://") && !raw.startsWith("//")) {
    raw = `https://${raw}`;
  } else if (raw.startsWith("//")) {
    raw = `https:${raw}`;
  }
  let hostname = "";
  try {
    hostname = new URL(raw).hostname;
  } catch (err) {
    const fallback = raw.replace(/^https?:\/\//, "");
    const slashIndex = fallback.indexOf("/");
    hostname = slashIndex >= 0 ? fallback.slice(0, slashIndex) : fallback;
  }
  hostname = hostname.replace(/^\.+|\.+$/g, "");
  if (!hostname) return "";
  if (!/^[a-z0-9.-]+$/.test(hostname)) return "";
  if (hostname.includes("..")) return "";
  return wildcard ? `*.${hostname}` : hostname;
}

function normalizeDomainExceptionList(value) {
  const entries = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = [];
  entries.forEach((entry) => {
    const candidate = normalizeDomainExceptionEntry(entry);
    if (candidate && !seen.has(candidate)) {
      seen.add(candidate);
      normalized.push(candidate);
    }
  });
  return normalized;
}

function normalizeCategoryAutoRules(value) {
  const entries = Array.isArray(value) ? value : [];
  const normalized = [];
  const seen = new Set();
  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const pattern = entry.pattern ? String(entry.pattern).trim() : "";
    const category = entry.category ? String(entry.category).trim() : "";
    if (!pattern || !category) return;
    const key = `${pattern.toLowerCase()}=>${category.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push({
      pattern: pattern.slice(0, 160),
      category: category.slice(0, 120)
    });
  });
  return normalized.slice(0, 100);
}

function mergeSettings(value) {
  const next = { ...DEFAULT_SETTINGS, ...(value || {}) };
  const anim = typeof next.pickerAnimation === "string" ? next.pickerAnimation.trim().toLowerCase() : "fade";
  next.pickerAnimation = [
    "fade",
    "slide",
    "scale",
    "none",
    "slide-left",
    "slide-right",
    "pop",
    "drop",
    "blur"
  ].includes(anim) ? anim : "fade";
  const dur = Number.parseInt(next.pickerAnimationDuration, 10);
  next.pickerAnimationDuration = Number.isFinite(dur) ? Math.min(Math.max(dur, 50), 2000) : DEFAULT_SETTINGS.pickerAnimationDuration;
  const pickerLayoutRaw = typeof next.pickerLayout === "string"
    ? next.pickerLayout.trim().toLowerCase()
    : DEFAULT_SETTINGS.pickerLayout;
  next.pickerLayout = ["compact", "cozy"].includes(pickerLayoutRaw)
    ? pickerLayoutRaw
    : DEFAULT_SETTINGS.pickerLayout;
  next.pickerYoutubeThumbnails = next.pickerYoutubeThumbnails !== false;
  const favoritesSortModeRaw = typeof next.favoritesSortMode === "string"
    ? next.favoritesSortMode.trim().toLowerCase()
    : DEFAULT_SETTINGS.favoritesSortMode;
  next.favoritesSortMode = ["manual", "asc", "desc"].includes(favoritesSortModeRaw)
    ? favoritesSortModeRaw
    : DEFAULT_SETTINGS.favoritesSortMode;
  if (!["home", "last-category", "last-page", "last-link"].includes(next.pickerStartMode)) {
    next.pickerStartMode = "last-link";
  }
  const notesStartModeRaw = typeof next.notesStartMode === "string" ? next.notesStartMode.trim().toLowerCase() : DEFAULT_SETTINGS.notesStartMode;
  next.notesStartMode = notesStartModeRaw === "last" ? "last" : "home";
  next.floatingNextUpLabel = next.floatingNextUpLabel !== false;
  next.floatingAiSelectionEnabled = true;
  const floatingNextUpMaxWidthRaw = Number.parseInt(next.floatingNextUpMaxWidth, 10);
  next.floatingNextUpMaxWidth = Number.isFinite(floatingNextUpMaxWidthRaw) ? Math.min(Math.max(floatingNextUpMaxWidthRaw, 50), 800) : 220;
  const trashLimitRaw = Number.parseInt(next.trashLimit, 10);
  if (!Number.isFinite(trashLimitRaw) || trashLimitRaw < 0) {
    next.trashLimit = DEFAULT_SETTINGS.trashLimit;
  } else {
    next.trashLimit = Math.min(trashLimitRaw, 2000);
  }
  next.themePreset = normalizeThemePreset(next.themePreset);
    next.sidebarAiEnabled = next.sidebarAiEnabled !== false;
        next.sidebarAiProvider = normalizeSidebarAiProvider(next.sidebarAiProvider);
        next.jarvisBrainProvider = normalizeJarvisBrainProvider(next.jarvisBrainProvider);
        if (next.aiMode !== "sidebar" && next.aiMode !== "overlay" && next.aiMode !== "jarvis") {
          next.aiMode = DEFAULT_SETTINGS.aiMode;
        }
        if (next.jarvisMode !== "overlay" && next.jarvisMode !== "sidebar") {
          next.jarvisMode = DEFAULT_SETTINGS.jarvisMode;
        }
        if (next.jarvisOpenMode !== "overlay" && next.jarvisOpenMode !== "sidebar") {
          next.jarvisOpenMode = DEFAULT_SETTINGS.jarvisOpenMode;
        }
        if (!["sidebar", "overlay", "native-sidebar"].includes(next.summaryOpenMode)) {
          next.summaryOpenMode = DEFAULT_SETTINGS.summaryOpenMode;
        }
  if (typeof next.summaryOutputLanguage !== "string" || !next.summaryOutputLanguage.trim()) {
    next.summaryOutputLanguage = DEFAULT_SETTINGS.summaryOutputLanguage;
  }
  if (typeof next.summaryTone !== "string" || !["neutral", "formal", "casual", "educational"].includes(next.summaryTone.trim().toLowerCase())) {
    next.summaryTone = DEFAULT_SETTINGS.summaryTone;
  }
  const maxWordsRaw = Number.parseInt(next.summaryMaxWords, 10);
  next.summaryMaxWords = Number.isFinite(maxWordsRaw) ? Math.min(Math.max(maxWordsRaw, 0), 5000) : DEFAULT_SETTINGS.summaryMaxWords;
  const sidebarFocusF6DelayRaw = Number.parseInt(next.sidebarFocusF6DelayMs, 10);
  next.sidebarFocusF6DelayMs = Number.isFinite(sidebarFocusF6DelayRaw)
    ? Math.min(Math.max(sidebarFocusF6DelayRaw, 0), 5000)
    : DEFAULT_SETTINGS.sidebarFocusF6DelayMs;
  next.sidebarNativeFocusHelperEnabled = next.sidebarNativeFocusHelperEnabled !== false;
  const selectionSearch = normalizeSelectionSearchSettings(next);
  next.selectionSearchPopup = selectionSearch.selectionSearchPopup;
  next.selectionSearchContextMenu = selectionSearch.selectionSearchContextMenu;
  next.selectionSearchEnginesList = selectionSearch.selectionSearchEnginesList;
  next.selectionSearchEnabled = selectionSearch.selectionSearchPopup.enabled;
  const floatingAutoSuspendThresholdRaw = Number.parseInt(
    next.floatingButtonAutoSuspendTabThreshold,
    10,
  );
  next.floatingButtonAutoSuspendTabThreshold = Number.isFinite(floatingAutoSuspendThresholdRaw)
    ? Math.min(Math.max(floatingAutoSuspendThresholdRaw, 0), 500)
    : DEFAULT_SETTINGS.floatingButtonAutoSuspendTabThreshold;
  next.floatingButtonAutoSuspendActive = next.floatingButtonAutoSuspendActive === true;
  const floatingAutoSuspendCountRaw = Number.parseInt(
    next.floatingButtonAutoSuspendTabCount,
    10,
  );
  next.floatingButtonAutoSuspendTabCount = Number.isFinite(floatingAutoSuspendCountRaw)
    ? Math.min(Math.max(floatingAutoSuspendCountRaw, 0), 10000)
    : DEFAULT_SETTINGS.floatingButtonAutoSuspendTabCount;
  
  const visibilityModeRaw = typeof next.floatingButtonVisibilityMode === "string" ? next.floatingButtonVisibilityMode.trim().toLowerCase() : "";
  next.floatingButtonVisibilityMode = ["hover", "always", "scroll", "click", "longpress"].includes(visibilityModeRaw) ? visibilityModeRaw : "hover";
  const miniCategoryTriggerDirectionRaw = typeof next.miniCategoryTriggerDirection === "string" ? next.miniCategoryTriggerDirection.trim().toLowerCase() : "";
  next.miniCategoryTriggerDirection = ["right", "left", "up", "down"].includes(miniCategoryTriggerDirectionRaw) ? miniCategoryTriggerDirectionRaw : "right";
  const miniCategoryPanelLayoutRaw = typeof next.miniCategoryPanelLayout === "string" ? next.miniCategoryPanelLayout.trim().toLowerCase() : "";
  next.miniCategoryPanelLayout = ["list", "grid", "horizontal", "radial", "wheel"].includes(miniCategoryPanelLayoutRaw) ? miniCategoryPanelLayoutRaw : "list";
  const longPressDurationRaw = Number.parseInt(next.floatingButtonLongPressDuration, 10);
  next.floatingButtonLongPressDuration = Number.isFinite(longPressDurationRaw)
    ? Math.min(Math.max(longPressDurationRaw, 0), 1000)
    : DEFAULT_SETTINGS.floatingButtonLongPressDuration;
  const categoryPickerLongPressDurationRaw = Number.parseInt(
    next.floatingButtonCategoryPickerLongPressDuration,
    10,
  );
  next.floatingButtonCategoryPickerLongPressDuration = Number.isFinite(categoryPickerLongPressDurationRaw)
    ? Math.min(Math.max(categoryPickerLongPressDurationRaw, 0), 1000)
    : DEFAULT_SETTINGS.floatingButtonCategoryPickerLongPressDuration;
  next.floatingButtonLongPressSwap = next.floatingButtonLongPressSwap === true;
  next.floatingButtonCategoryPickerLongPressEnabled = next.floatingButtonCategoryPickerLongPressEnabled !== false;
  next.categoryPickerMouseGesture = next.categoryPickerMouseGesture === true;
  next.blockPickerOnTextCursor = next.blockPickerOnTextCursor !== false;
  // Sanitize new gesture settings
  next.gestureEnabled = next.gestureEnabled === true || next.gestureEnabled === "true";
  next.gestureMouseButton = ["right", "left", "middle", "both"].includes(next.gestureMouseButton) ? next.gestureMouseButton : "right";
  const rawMaxDev = parseFloat(next.gestureMaxDeviation);
  next.gestureMaxDeviation = Number.isFinite(rawMaxDev) ? Math.min(Math.max(rawMaxDev, 0.1), 2.0) : 0.8;
  const rawSens = parseFloat(next.gestureDirectionSensitivity);
  next.gestureDirectionSensitivity = Number.isFinite(rawSens) ? Math.min(Math.max(rawSens, 0.5), 2.0) : 1.0;
  next.gestureTraceColor = (typeof next.gestureTraceColor === "string" && /^#[0-9a-fA-F]{6}$/.test(next.gestureTraceColor)) ? next.gestureTraceColor : "#e94560";
  const rawTraceW = Number.parseInt(next.gestureTraceWidth, 10);
  next.gestureTraceWidth = Number.isFinite(rawTraceW) ? Math.min(Math.max(rawTraceW, 1), 20) : 3;
  const rawDistThresh = Number.parseInt(next.gestureDistanceThreshold, 10);
  next.gestureDistanceThreshold = Number.isFinite(rawDistThresh) ? Math.min(Math.max(rawDistThresh, 5), 100) : 10;
  // Timeout settings
  next.gestureTimeoutActive = next.gestureTimeoutActive === true;
  const rawTimeoutDur = Number.parseInt(next.gestureTimeoutDuration, 10);
  next.gestureTimeoutDuration = Number.isFinite(rawTimeoutDur) ? Math.min(Math.max(rawTimeoutDur, 1), 30) : 2;
  // Suppression key � hanya nilai yang dikenali
  next.gestureSuppressionKey = ["shiftKey","ctrlKey","altKey",""].includes(next.gestureSuppressionKey) ? next.gestureSuppressionKey : "";
  next.gestureSmartSuppression = next.gestureSmartSuppression !== false;
  // Gesturefy-compatible settings
  const validAlgos = ["strict", "shape-independent", "combined"];
  next.gestureMatchingAlgorithm = validAlgos.includes(next.gestureMatchingAlgorithm) ? next.gestureMatchingAlgorithm : "combined";
  const rawDevTol = parseFloat(next.gestureDeviationTolerance);
  next.gestureDeviationTolerance = Number.isFinite(rawDevTol) ? Math.min(Math.max(rawDevTol, 0.01), 2.0) : 0.15;
  const rawDiffThresh = parseFloat(next.gestureDifferenceThreshold);
  next.gestureDifferenceThreshold = Number.isFinite(rawDiffThresh) ? Math.min(Math.max(rawDiffThresh, 0.05), 1.5) : 0.12;
  next.gestureTraceLineGrowth = next.gestureTraceLineGrowth !== false;
  next.gestureCommandFontSize = (typeof next.gestureCommandFontSize === "string" && next.gestureCommandFontSize.trim()) ? next.gestureCommandFontSize.trim().slice(0, 20) : "2.5vh";
  next.gestureCommandFontColor = (typeof next.gestureCommandFontColor === "string" && /^#[0-9a-fA-F]{6,8}$/.test(next.gestureCommandFontColor)) ? next.gestureCommandFontColor : "#ffffff";
  next.gestureCommandBgColor = (typeof next.gestureCommandBgColor === "string" && /^#[0-9a-fA-F]{6,8}$/.test(next.gestureCommandBgColor)) ? next.gestureCommandBgColor : "#000000b8";
  const rawOpacity = Number.parseInt(next.gestureCommandBgOpacity, 10);
  next.gestureCommandBgOpacity = Number.isFinite(rawOpacity) ? Math.min(Math.max(rawOpacity, 0), 100) : 72;
  const rawCmdX = Number.parseInt(next.gestureCommandPositionX, 10);
  next.gestureCommandPositionX = Number.isFinite(rawCmdX) ? Math.min(Math.max(rawCmdX, 0), 100) : 50;
  const rawCmdY = Number.parseInt(next.gestureCommandPositionY, 10);
  next.gestureCommandPositionY = Number.isFinite(rawCmdY) ? Math.min(Math.max(rawCmdY, 0), 100) : 92;
  next.gestureExclusions = Array.isArray(next.gestureExclusions)
    ? next.gestureExclusions.filter(s => typeof s === "string" && s.trim()).map(s => s.trim().slice(0, 300)).slice(0, 100)
    : [];
  next.customGesturePattern = Array.isArray(next.customGesturePattern) ? next.customGesturePattern.slice(0, 100) : [];
  // pattern.length >= 1 (bukan 2) � pattern 1-arah seperti ? adalah sah
  next.gestureActionMappings = Array.isArray(next.gestureActionMappings) ? next.gestureActionMappings.filter(m => m && m.id && m.pattern && Array.isArray(m.pattern) && m.pattern.length >= 1 && m.action).map(m => {
    const entry = {
      id: String(m.id).slice(0, 60),
      name: (m.name && typeof m.name === 'string' ? m.name : 'Gesture').slice(0, 60),
      pattern: m.pattern.slice(0, 100),
      action: String(m.action).slice(0, 60),
    };
    if (m.gestureType) entry.gestureType = String(m.gestureType).slice(0, 20);
    if (m.shapeData && m.shapeData.points) entry.shapeData = m.shapeData;
    if (Array.isArray(m.rawPoints)) entry.rawPoints = m.rawPoints;
    if (typeof m.shapeThreshold === 'number') entry.shapeThreshold = m.shapeThreshold;
    if (typeof m.customLabel === 'string') entry.customLabel = m.customLabel.slice(0, 80);
    if (typeof m.useCount === 'number') entry.useCount = Math.max(0, Math.floor(m.useCount));
    if (typeof m.lastUsedAt === 'number') entry.lastUsedAt = m.lastUsedAt;
    return entry;
  }).slice(0, 50) : [];
  
  const rawSubSize = Number.parseInt(next.floatingSubButtonSize, 10);
  next.floatingSubButtonSize = Number.isFinite(rawSubSize) ? Math.min(Math.max(rawSubSize, 20), 100) : DEFAULT_SETTINGS.floatingSubButtonSize;

  const rawSensitivity = Number.parseInt(
    typeof next.floatingButtonSensitivity !== "undefined"
      ? next.floatingButtonSensitivity
      : next.floatingButtonShowTime,
    10
  );
  const clampedSensitivity = Number.isFinite(rawSensitivity)
    ? Math.min(Math.max(rawSensitivity, 40), 600)
    : DEFAULT_SETTINGS.floatingButtonSensitivity;
  next.floatingButtonSensitivity = clampedSensitivity;
  // Keep the legacy field in sync so older builds continue to read the same number.
  next.floatingButtonShowTime = clampedSensitivity;
  const customIcons = Array.isArray(next.floatingButtonCustomIcons) ? next.floatingButtonCustomIcons : [];
  // Merge default icons (from DEFAULT_CUSTOM_ICONS_1/2) into saved icons,
  // so built-in icons like Goku always appear even on existing installs.
  const defaultIconSources = [
    ...(typeof DEFAULT_CUSTOM_ICONS_1 !== "undefined" ? DEFAULT_CUSTOM_ICONS_1 : []),
    ...(typeof DEFAULT_CUSTOM_ICONS_2 !== "undefined" ? DEFAULT_CUSTOM_ICONS_2 : []),
  ];
  const savedIds = new Set(customIcons.map(e => e && e.id).filter(Boolean));
  const mergedIcons = [
    ...customIcons,
    ...defaultIconSources.filter(e => e && e.id && !savedIds.has(e.id)),
  ];
  next.floatingButtonCustomIcons = mergedIcons
    .map((entry, idx) => {
      if (!entry || typeof entry !== "object") return null;
      const id = entry.id ? String(entry.id) : String(idx);
      const dataUrl = typeof entry.dataUrl === "string" && entry.dataUrl.startsWith("data:")
        ? entry.dataUrl
        : "";
      if (!dataUrl) return null;
      const label = entry.label && typeof entry.label === "string" ? entry.label.trim() : `Custom ${idx + 1}`;
      return { id, label, dataUrl };
    })
    .filter(Boolean)
    .slice(0, 10);
  next.floatingButtonDomainExceptions = normalizeDomainExceptionList(
    next.floatingButtonDomainExceptions,
  );
  const icon = typeof next.floatingButtonIcon === "string" ? next.floatingButtonIcon.trim() : "";
  // Allow built-in, data URL, or custom slot reference.
  if (icon.startsWith("data:")) {
    next.floatingButtonIcon = icon;
  } else if (icon.startsWith("custom:")) {
    const key = icon.slice("custom:".length);
    const exists = next.floatingButtonCustomIcons.some((c) => c && c.id === key);
    next.floatingButtonIcon = exists ? icon : FLOATING_BUTTON_ICONS[0];
  } else {
    next.floatingButtonIcon = FLOATING_BUTTON_ICONS.includes(icon) ? icon : FLOATING_BUTTON_ICONS[0];
  }
  if (next.floatingButtonIcon.startsWith("custom:")) {
    const key = next.floatingButtonIcon.slice("custom:".length);
    const exists = next.floatingButtonCustomIcons.some((c) => c && c.id === key);
    if (!exists) {
      next.floatingButtonIcon = FLOATING_BUTTON_ICONS[0];
    }
  }
  const size = Number.parseInt(next.floatingButtonSize, 10);
  next.floatingButtonSize = Number.isFinite(size)
    ? Math.min(Math.max(size, 40), 400)
    : DEFAULT_SETTINGS.floatingButtonSize;
  const width = Number.parseInt(next.floatingButtonWidth, 10);
  const height = Number.parseInt(next.floatingButtonHeight, 10);
  // Always honor explicit width/height; treat size as legacy fallback; force preset to custom so UI elsewhere won't overwrite.
  const resolvedWidth = Number.isFinite(width)
    ? width
    : (Number.isFinite(size) ? size : DEFAULT_SETTINGS.floatingButtonWidth);
  const resolvedHeight = Number.isFinite(height)
    ? height
    : (Number.isFinite(size) ? size : DEFAULT_SETTINGS.floatingButtonHeight);
  const clampedWidth = Math.min(Math.max(resolvedWidth, 40), 400);
  const clampedHeight = Math.min(Math.max(resolvedHeight, 40), 400);
  next.floatingButtonSizePreset = "custom";
  next.floatingButtonWidth = clampedWidth;
  next.floatingButtonHeight = clampedHeight;
  next.floatingButtonSize = Math.min(Math.max(Number.parseInt(next.floatingButtonSize, 10) || clampedWidth, 40), 400);
  const offsetX = Number.parseInt(next.floatingButtonOffsetX, 10);
  next.floatingButtonOffsetX = Number.isFinite(offsetX) ? Math.min(Math.max(offsetX, 0), 500) : DEFAULT_SETTINGS.floatingButtonOffsetX;
  const offsetY = Number.parseInt(next.floatingButtonOffsetY, 10);
  next.floatingButtonOffsetY = Number.isFinite(offsetY) ? Math.min(Math.max(offsetY, 0), 1000) : DEFAULT_SETTINGS.floatingButtonOffsetY;
  const anchorX = typeof next.floatingButtonAnchorX === "string" ? next.floatingButtonAnchorX.trim().toLowerCase() : DEFAULT_SETTINGS.floatingButtonAnchorX;
  next.floatingButtonAnchorX = ["left", "right"].includes(anchorX) ? anchorX : DEFAULT_SETTINGS.floatingButtonAnchorX;
  const anchorY = typeof next.floatingButtonAnchorY === "string" ? next.floatingButtonAnchorY.trim().toLowerCase() : DEFAULT_SETTINGS.floatingButtonAnchorY;
  next.floatingButtonAnchorY = ["top", "bottom"].includes(anchorY) ? anchorY : DEFAULT_SETTINGS.floatingButtonAnchorY;
  const anchor = typeof next.floatingButtonAnchor === "string" ? next.floatingButtonAnchor.trim().toLowerCase() : DEFAULT_SETTINGS.floatingButtonAnchor;
  // Always respect manual positioning; treat legacy "center" as custom with right/bottom anchor.
  if (anchor === "center") {
    next.floatingButtonAnchor = "custom";
    next.floatingButtonAnchorX = "right";
    next.floatingButtonAnchorY = "bottom";
  } else {
    next.floatingButtonAnchor = "custom";
  }
  next.ctrlAltLinkSaveEnabled = next.ctrlAltLinkSaveEnabled === true;
  next.linkSaveModifierCombo = normalizeLinkSaveModifierCombo(next.linkSaveModifierCombo);
  next.linkSaveMouseButton = normalizeLinkSaveMouseButton(next.linkSaveMouseButton);
  const bundleModifierRaw = typeof next.linkSaveBundleModifier === "string" ? next.linkSaveBundleModifier.trim() : "";
  if (!bundleModifierRaw) {
    next.linkSaveBundleModifier = "";
  } else {
    next.linkSaveBundleModifier = normalizeLinkSaveTriggerValue(bundleModifierRaw);
  }
  const directModifierRaw = typeof next.linkSaveDirectModifier === "string" ? next.linkSaveDirectModifier.trim() : "";
  if (!directModifierRaw) {
    next.linkSaveDirectModifier = "";
  } else {
    next.linkSaveDirectModifier = normalizeLinkSaveTriggerValue(directModifierRaw);
  }
  next.linkSavePromptCategoryEnabled = next.linkSavePromptCategoryEnabled === true;
  next.linkSaveBundlePromptCategory = next.linkSaveBundlePromptCategory !== false;
  next.linkSaveBundleDuration =
    typeof next.linkSaveBundleDuration === "number" && next.linkSaveBundleDuration >= 0
      ? Math.round(next.linkSaveBundleDuration)
      : 3;
  next.linkSavePinnedCategoryIds = normalizeLinkSavePinnedCategoryIds(
    next.linkSavePinnedCategoryIds,
  );
  const paletteShortcut = typeof next.categoryPaletteShortcut === "string"
    ? next.categoryPaletteShortcut.trim()
    : DEFAULT_SETTINGS.categoryPaletteShortcut;
  if (typeof next.categoryPaletteShortcut !== "string" || !next.categoryPaletteShortcut.trim()) {
    next.categoryPaletteShortcut = DEFAULT_SETTINGS.categoryPaletteShortcut;
  }
  next.pickerToggleDeleteAfterOpenShortcut = normalizePickerShortcut(next.pickerToggleDeleteAfterOpenShortcut);
  next.pickerToggleShowHiddenShortcut = normalizePickerShortcut(next.pickerToggleShowHiddenShortcut);
  next.pickerImportShortcut = normalizePickerShortcut(next.pickerImportShortcut);
  next.pickerExportShortcut = normalizePickerShortcut(next.pickerExportShortcut);
  next.pickerClearFavShortcut = normalizePickerShortcut(next.pickerClearFavShortcut);
  next.pickerRestoreFavShortcut = normalizePickerShortcut(next.pickerRestoreFavShortcut);
  next.pickerAutoNextShortcut = normalizePickerShortcut(next.pickerAutoNextShortcut);
  next.pickerAutoRandomShortcut = normalizePickerShortcut(next.pickerAutoRandomShortcut);
  next.pickerSelectPageShortcut = normalizePickerShortcut(next.pickerSelectPageShortcut);
  next.pickerClearSelectionShortcut = normalizePickerShortcut(next.pickerClearSelectionShortcut);
  next.pickerBulkDeleteShortcut = normalizePickerShortcut(next.pickerBulkDeleteShortcut);
  next.pickerBulkFavShortcut = normalizePickerShortcut(next.pickerBulkFavShortcut);
  next.pickerRenameCategoryShortcut = normalizePickerShortcut(next.pickerRenameCategoryShortcut);
  next.pickerScanDupShortcut = normalizePickerShortcut(next.pickerScanDupShortcut);
  next.pickerFavShortcut = normalizePickerShortcut(next.pickerFavShortcut);
  next.pickerToggleFavShortcut = normalizePickerShortcut(next.pickerToggleFavShortcut);
  next.pickerTrashShortcut = normalizePickerShortcut(next.pickerTrashShortcut);
  next.pickerPinShortcut = normalizePickerShortcut(next.pickerPinShortcut);
  next.commandPaletteShortcut = typeof next.commandPaletteShortcut === "string" && next.commandPaletteShortcut.trim() ? next.commandPaletteShortcut.trim() : "Ctrl+K";
  next.hoverImageSearchEnabled = next.hoverImageSearchEnabled !== false;
  next.hoverImageSearchShortcut = typeof next.hoverImageSearchShortcut === "string" && next.hoverImageSearchShortcut.trim() ? next.hoverImageSearchShortcut.trim() : "Alt+Q";
  // Normalize configurable note overlay shortcuts (object: actionId -> shortcut string)
  (function () {
    const raw = next.notesOverlayShortcuts && typeof next.notesOverlayShortcuts === "object"
      ? next.notesOverlayShortcuts
      : {};
    const out = {};
    Object.keys(DEFAULT_SETTINGS.notesOverlayShortcuts).forEach(function (id) {
      out[id] = normalizePickerShortcut(raw[id]);
    });
    next.notesOverlayShortcuts = out;
  })();
  // Normalize highlight color � must be a valid hex color
  const rawColor = typeof next.pickerHighlightColor === "string" ? next.pickerHighlightColor.trim() : "";
  next.pickerHighlightColor = /^#[0-9a-f]{6}$/i.test(rawColor) ? rawColor.toLowerCase() : DEFAULT_SETTINGS.pickerHighlightColor;
  next.pickerHoverSound = next.pickerHoverSound === true;
  // Normalize hover sounds list (up to 10, data URLs only).
  const sounds = Array.isArray(next.pickerHoverSounds) ? next.pickerHoverSounds : [];
  next.pickerHoverSounds = sounds
    .map((entry, idx) => {
      if (!entry || typeof entry !== "object") return null;
      const id = entry.id ? String(entry.id) : String(idx);
      const label = entry.label && typeof entry.label === "string" ? entry.label.trim().slice(0, 60) : `Sound ${idx + 1}`;
      const dataUrl = typeof entry.dataUrl === "string" && entry.dataUrl.startsWith("data:audio") ? entry.dataUrl : "";
      if (!dataUrl) return null;
      return { id, label, dataUrl };
    })
    .filter(Boolean)
    .slice(0, 10);
  const activeId = typeof next.activePickerHoverSoundId === "string" ? next.activePickerHoverSoundId.trim() : "";
  next.activePickerHoverSoundId = next.pickerHoverSounds.some((s) => s.id === activeId) ? activeId : "";
  return next;
}

async function getSettings() {
  const data = await api.storage.local.get(SETTINGS_KEY);
  const raw = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
  // One-time migration (v2.6.3): the legacy "overlay" AI mode embeds Gemini on a
  // non-Google page where sign-in is blocked, so flip it to "sidebar". Also flip the
  // old default provider "chatgpt" to "gemini". Gated by a flag so the user can still
  // switch back to overlay / chatgpt afterwards (migration only runs once).
  if (raw.migratedAiModeToSidebar !== true) {
    let changed = false;
    const migrated = { ...raw };
    if (migrated.aiMode === "overlay") {
      migrated.aiMode = "sidebar";
      changed = true;
    }
    if (migrated.sidebarAiProvider === "chatgpt") {
      migrated.sidebarAiProvider = "gemini";
      changed = true;
    }
    migrated.migratedAiModeToSidebar = true;
    try {
      await api.storage.local.set({ [SETTINGS_KEY]: migrated });
    } catch (err) {
      // ignore persistence failure; merged result below still reflects the change
    }
    return mergeSettings(migrated);
  }
  return mergeSettings(raw);
}

async function setSettings(partial) {
  const current = await getSettings();
  const next = mergeSettings({ ...current, ...(partial || {}) });
  await api.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

const LocalPocketSettingsCore = {
  SETTINGS_KEY,
  THEME_PRESETS,
  SIDEBAR_AI_PROVIDERS,
  FLOATING_BUTTON_ICONS,
  LINK_SAVE_MODIFIER_COMBOS,
  LINK_SAVE_MOUSE_BUTTONS,
  LINK_SAVE_KEY_ALIASES,
  DEFAULT_SETTINGS,
  normalizeThemePreset,
  normalizeSidebarAiProvider,
  normalizeJarvisBrainProvider,
  normalizeLinkSaveKeyboardKey,
  normalizePickerShortcut,
  normalizeLinkSaveTriggerValue,
  normalizeLinkSaveModifierCombo,
  normalizeLinkSaveMouseButton,
  normalizeLinkSavePinnedCategoryIds,
  normalizeDomainExceptionEntry,
  normalizeDomainExceptionList,
  normalizeCategoryAutoRules,
  mergeSettings
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = LocalPocketSettingsCore;
}
if (typeof globalThis !== "undefined") {
  globalThis.LocalPocketSettingsCore = LocalPocketSettingsCore;
}
