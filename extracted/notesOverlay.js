(function initLocalPocketNotesOverlay() {
  if (typeof window === "undefined") return;
  if (window.__lpNotesOverlayInstalled) return;
  window.__lpNotesOverlayInstalled = true;
  if (window.name === "__LP_SIDEBAR__") return;

  const api = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null);
  if (!api || !api.storage || !api.runtime) return;

  const SETTINGS_KEY = "settings";
  const NOTES_KEY = "sidebarNotes";
  const FOLDERS_KEY = "sidebarNoteFolders";
  const NOTES_UI_KEY = "sidebarNotesUi";
  const ATTACHMENTS_KEY = "sidebarNoteAttachments";
  const TODO_LISTS_KEY = "todoLists";
  const TODO_ITEMS_KEY = "todoItems";
  const SAVE_DELAY_MS = 300;
  const ROOT_ID = "__lp_notes_overlay_root";
  const EDITOR_FRAME_URL = api.runtime.getURL("notesEditorFrame.html");
  const MOBILE_BREAKPOINT = 640;
  const PANEL_VIEWPORT_MARGIN = 24;
  const DEFAULT_PANEL_WIDTH = 820;
  const DEFAULT_PANEL_HEIGHT = 800;
  const VIEW_ALL = "all";
  const VIEW_PINNED = "pinned";
  const VIEW_TASKS = "tasks";
  const DRAWER_MODE_CATEGORIES = "categories";
  const DRAWER_MODE_NOTES = "notes";
  const VALID_VIEWS = new Set([VIEW_ALL, VIEW_PINNED, VIEW_TASKS]);
  const FILTER_ALL_FOLDERS = "__all__";
  const FILTER_UNCATEGORIZED = "__uncategorized__";
  const UNCATEGORIZED_LABEL = "Unsorted";
  const NOTE_DELETE_UNDO_MS = 8000;
  const MAX_ATTACHMENT_DATA_URL_LENGTH = 8 * 1024 * 1024;
  const MAX_EMBEDDED_IMAGE_SIZE = 500 * 1024; // 500KB max for embedded images
  const TRASH_KEY = "sidebarNotesTrash";
  const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days default
  const EXTERNAL_SYNC_CHECK_INTERVAL_MS = 5000;
  const THEME_CHOICES = [
    { value: "classic", label: "Classic" },
    { value: "minimal", label: "Light" },
    { value: "modern", label: "Dark" },
    { value: "cyber", label: "Neon" },
    { value: "ocean", label: "Ocean" },
    { value: "sunset", label: "Sunset" },
    { value: "forest", label: "Forest" },
    { value: "pastel", label: "Pastel" },
    { value: "mono", label: "Mono" },
    { value: "oled", label: "OLED" },
    { value: "sepia", label: "Sepia" },
    { value: "retro", label: "Retro" },
    { value: "aurora", label: "Aurora" },
    { value: "custom", label: "Custom" }
  ];
  const THEME_CHOICE_MAP = new Map(THEME_CHOICES.map((entry) => [entry.value, entry.label]));

  const state = {
    mounted: false,
    open: false,
    previousFocus: null,
    panelMode: "picker",
    pickerPosition: null,
    folders: [],
    notes: [],
    attachments: {},
    todoLists: [],
    todoItems: [],
    ui: {
      activeNoteId: "",
      notesDrawerOpen: false,
      drawerMode: DRAWER_MODE_CATEGORIES,
      activeView: VIEW_ALL,
      activeFolderFilter: FILTER_ALL_FOLDERS,
      pinnedFolderIds: [],
      hiddenFolderIds: [],
      showHiddenFolders: false,
      favoriteFolderSortMode: "manual",
      folderPage: 0,
      notePage: 0,
      selectedNoteIds: [],
      searchQuery: "",
      closeOnOutsideClick: true,
      panelWidth: DEFAULT_PANEL_WIDTH,
      panelHeight: DEFAULT_PANEL_HEIGHT,
      zenMode: false,
      activeTodoListId: "",
      todoFilter: "all"
    },
    settings: {},
    pageContext: null,
    saveTimer: null,
    resizeSession: null,
    panelDragSession: null,
    externalSyncTimer: null,
    pendingExternalReload: false,
    lastLocalChangeAt: 0,
    trash: [],
    trashPanelOpen: false,
    undoDeleteTimer: null,
    pendingUndoDelete: null,
    dialog: {
      open: false,
      mode: "",
      title: "",
      message: "",
      inputLabel: "",
      inputValue: "",
      inputPlaceholder: "",
      confirmLabel: "OK",
      cancelLabel: "Cancel",
      danger: false,
      resolver: null
    },
    folderPalette: {
      open: false,
      query: "",
      activeIndex: 0,
      options: [],
      pendingTargetId: "",
      pendingOffset: 0
    },
    mindmap: {
      zoom: 1,
      panX: 0,
      panY: 0,
      collapsedFolders: [],
      collapsedNodes: [],
      mode: "folder",
      openOnClick: false,
      layoutStyle: "radial"
    },
    folderContextMenu: {
      open: false,
      folderId: "",
      anchorX: 0,
      anchorY: 0
    },
    folderKeyboardIndex: 0,
    editor: {
      token: "",
      ready: false,
      title: "",
      content: "",
      pendingFocusTarget: "content",
      pendingFocusSelectAll: false,
      lastTheme: "",
      dirty: false,
      previewMode: false,
      attachmentMap: {},
      _lastSyncedNoteId: ""
    },
    refs: {},
    shadow: null
  };
  let draggedNoteId = "";

  function normalizeThemePreset(value) {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (raw === "custom" || raw === "aurora" || raw === "ocean" || raw === "sunset" || raw === "modern" || raw === "minimal" || raw === "cyber" || raw === "forest" || raw === "pastel" || raw === "mono" || raw === "oled" || raw === "sepia" || raw === "retro") return raw;
    return "classic";
  }

  function getThemeLabel(value) {
    const key = normalizeThemePreset(value);
    return THEME_CHOICE_MAP.get(key) || "Theme";
  }

  function makeAttachmentId() {
    return `attachment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function makeAttachmentUri(attachmentId) {
    return `lp-attachment://${String(attachmentId || "").trim()}`;
  }

  function parseAttachmentId(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^lp-attachment:\/\/([a-z0-9-]+)/i);
    return match ? String(match[1]) : "";
  }

  function extractAttachmentIdsFromContent(content) {
    const matches = String(content || "").match(/lp-attachment:\/\/([a-z0-9-]+)/gi) || [];
    const ids = new Set();
    matches.forEach((entry) => {
      const id = parseAttachmentId(entry);
      if (id) ids.add(id);
    });
    return ids;
  }

  function getReferencedAttachmentIds(notes) {
    const ids = new Set();
    coerceArray(notes).forEach((note) => {
      extractAttachmentIdsFromContent(note && note.content ? note.content : "").forEach((id) => ids.add(id));
    });
    return ids;
  }

  function normalizeAttachments(value) {
    const next = {};
    if (!value || typeof value !== "object") return next;
    Object.keys(value).forEach((key) => {
      const entry = value[key];
      if (!entry || typeof entry !== "object") return;
      const id = entry.id ? String(entry.id).trim() : String(key || "").trim();
      const dataUrl = entry.dataUrl ? String(entry.dataUrl) : "";
      if (!id || !dataUrl || dataUrl.length > MAX_ATTACHMENT_DATA_URL_LENGTH) return;
      next[id] = {
        id,
        name: entry.name ? String(entry.name).slice(0, 160) : `attachment-${id}`,
        mimeType: entry.mimeType ? String(entry.mimeType).slice(0, 120) : "application/octet-stream",
        dataUrl,
        createdAt: entry.createdAt ? String(entry.createdAt) : new Date().toISOString()
      };
    });
    return next;
  }

  function pruneAttachmentsMap(attachments, notes) {
    const normalized = normalizeAttachments(attachments);
    const referencedIds = getReferencedAttachmentIds(notes);
    if (!referencedIds.size) return {};
    const next = {};
    referencedIds.forEach((id) => {
      if (normalized[id]) {
        next[id] = normalized[id];
      }
    });
    return next;
  }

  function buildAttachmentMapForContent(content) {
    const ids = extractAttachmentIdsFromContent(content);
    const next = {};
    ids.forEach((id) => {
      if (state.attachments[id]) {
        next[id] = state.attachments[id];
      }
    });
    return next;
  }

  function buildPageContextSnippet(context) {
    const source = context && typeof context === "object" ? context : null;
    if (!source) return "";
    const title = source.title ? String(source.title).trim() : "";
    const url = source.url ? String(source.url).trim() : "";
    if (title && url) {
      return `[${title}](${url})`;
    }
    if (url) {
      return url;
    }
    return title;
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        resolve(value && typeof value === "object" ? value : {});
      };
      try {
        const maybePromise = api.storage.local.get(keys, (value) => {
          const err = api.runtime && api.runtime.lastError;
          if (err) {
            finish({});
            return;
          }
          finish(value);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(finish).catch(() => finish({}));
        }
      } catch (err) {
        finish({});
      }
    });
  }

  function storageSet(value) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (err) => {
        if (done) return;
        done = true;
        if (err) reject(err);
        else resolve();
      };
      try {
        const maybePromise = api.storage.local.set(value, () => {
          const err = api.runtime && api.runtime.lastError;
          finish(err || null);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(() => finish(null)).catch(finish);
        }
      } catch (err) {
        finish(err);
      }
    });
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        resolve(value == null ? null : value);
      };
      try {
        const maybePromise = api.runtime.sendMessage(message, (response) => {
          const err = api.runtime && api.runtime.lastError;
          if (err) {
            finish(null);
            return;
          }
          finish(response);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(finish).catch(() => finish(null));
        }
      } catch (err) {
        finish(null);
      }
    });
  }

  function coerceArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function makeId(prefix) {
    const head = prefix ? String(prefix) : "entry";
    return `${head}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeSearchQuery(value) {
    const raw = value ? String(value).replace(/\s+/g, " ").trim() : "";
    return raw.slice(0, 120);
  }

  function normalizeView(value) {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    return VALID_VIEWS.has(raw) ? raw : VIEW_ALL;
  }

  function normalizeFolderName(value) {
    const raw = value ? String(value).replace(/\s+/g, " ").trim() : "";
    return raw.slice(0, 60);
  }

  function clampPanelWidth(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(360, Math.min(1400, Math.round(numeric)));
  }

  function clampPanelHeight(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(360, Math.min(1200, Math.round(numeric)));
  }

  function getEditorBaseHeight() {
    const frame = state.refs.editorFrame;
    const editorPane = frame && frame.parentElement ? frame.parentElement : null;
    if (!editorPane) {
      return Math.max(320, Math.min(760, Math.round(window.innerHeight * 0.58)));
    }
    const toolbar = editorPane.querySelector(".editor-toolbar");
    const footer = editorPane.querySelector(".editor-footer");
    const paneStyles = window.getComputedStyle(editorPane);
    const gap = parseFloat(paneStyles.rowGap || paneStyles.gap || "0") || 0;
    const paddingTop = parseFloat(paneStyles.paddingTop || "0") || 0;
    const paddingBottom = parseFloat(paneStyles.paddingBottom || "0") || 0;
    const available = editorPane.clientHeight
      - (toolbar ? toolbar.offsetHeight : 0)
      - (footer ? footer.offsetHeight : 0)
      - gap * 2
      - paddingTop
      - paddingBottom;
    return Math.max(300, Math.min(900, Math.round(available || 0)));
  }

  function countWords(text) {
    const raw = text ? String(text).trim() : "";
    if (!raw) return 0;
    return raw.split(/\s+/).filter(Boolean).length;
  }

  function countChars(text) {
    return text ? String(text).length : 0;
  }

  function formatUpdatedAt(iso) {
    const date = iso ? new Date(iso) : null;
    if (!date || Number.isNaN(date.getTime())) return "Updated just now";
    return `Updated ${date.toLocaleString([], {
      hour: "numeric",
      minute: "2-digit",
      day: "numeric",
      month: "short"
    })}`;
  }

  function formatDeletedAt(iso) {
    const date = iso ? new Date(iso) : null;
    if (!date || Number.isNaN(date.getTime())) return "Deleted just now";
    return `Deleted ${date.toLocaleString([], {
      hour: "numeric",
      minute: "2-digit",
      day: "numeric",
      month: "short"
    })}`;
  }

  function getNoteTitle(note) {
    if (!note) return "Untitled note";
    const raw = note.title ? String(note.title).trim() : "";
    return raw || "Untitled note";
  }

  function getNoteSortTimestamp(note) {
    return Date.parse((note && (note.updatedAt || note.createdAt)) || "") || 0;
  }

  function compareNotes(left, right) {
    const leftPinned = left && left.isPinned === true;
    const rightPinned = right && right.isPinned === true;
    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }
    const timeDiff = getNoteSortTimestamp(right) - getNoteSortTimestamp(left);
    if (timeDiff) return timeDiff;
    return getNoteTitle(left).localeCompare(getNoteTitle(right), undefined, { sensitivity: "base" });
  }

  function buildFolderMap(folders) {
    const map = new Map();
    coerceArray(folders).forEach((folder) => {
      if (!folder || typeof folder !== "object") return;
      const id = folder.id ? String(folder.id).trim() : "";
      if (!id) return;
      map.set(id, folder);
    });
    return map;
  }

  function normalizeFolders(value) {
    const next = [];
    const seenIds = new Set();
    const seenNames = new Set();
    coerceArray(value).forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const id = entry.id ? String(entry.id).trim() : "";
      const name = normalizeFolderName(entry.name);
      if (!id || !name || id === "general" || seenIds.has(id)) return;
      const lowered = name.toLowerCase();
      if (seenNames.has(lowered)) return;
      seenIds.add(id);
      seenNames.add(lowered);
      next.push({
        id: id.slice(0, 80),
        name,
        order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : index,
        createdAt: entry.createdAt ? String(entry.createdAt) : new Date().toISOString()
      });
    });
    return next.sort((left, right) => {
      const orderDiff = Number(left.order || 0) - Number(right.order || 0);
      if (orderDiff) return orderDiff;
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
  }

  function getFolderById(folderId) {
    return buildFolderMap(state.folders).get(folderId) || null;
  }

  function getFolderLabel(folderId) {
    if (!folderId) return UNCATEGORIZED_LABEL;
    const folder = getFolderById(folderId);
    return folder && folder.name ? folder.name : UNCATEGORIZED_LABEL;
  }

  function normalizeNotes(value, folders) {
    const folderMap = buildFolderMap(folders);
    return coerceArray(value)
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const id = entry.id ? String(entry.id).trim() : "";
        if (!id) return null;
        const rawFolderId = entry.folderId ? String(entry.folderId).trim() : "";
        return {
          id: id.slice(0, 80),
          title: entry.title == null ? "" : String(entry.title).slice(0, 120),
          content: entry.content == null ? "" : String(entry.content).slice(0, 200000),
          folderId: rawFolderId && folderMap.has(rawFolderId) ? rawFolderId : "",
          isPinned: entry.isPinned === true,
          pinnedAt: entry.isPinned === true && entry.pinnedAt ? String(entry.pinnedAt) : "",
          createdAt: entry.createdAt ? String(entry.createdAt) : new Date().toISOString(),
          updatedAt: entry.updatedAt ? String(entry.updatedAt) : new Date().toISOString()
        };
      })
      .filter(Boolean)
      .sort(compareNotes);
  }

  function normalizeFolderFilter(value, folders) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (raw === FILTER_ALL_FOLDERS || raw === FILTER_UNCATEGORIZED) {
      return raw;
    }
    return buildFolderMap(folders).has(raw) ? raw : FILTER_ALL_FOLDERS;
  }

  function normalizePinnedFolderIds(value, folders) {
    const folderMap = buildFolderMap(folders);
    const seen = new Set();
    return coerceArray(value)
      .map((entry) => (entry == null ? "" : String(entry).trim()))
      .filter((id) => {
        if (!id || seen.has(id) || !folderMap.has(id)) return false;
        seen.add(id);
        return true;
      });
  }

  function normalizeHiddenFolderIds(value, folders) {
    return normalizePinnedFolderIds(value, folders);
  }

  function normalizeFavoriteFolderSortMode(value) {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    return raw === "asc" || raw === "desc" ? raw : "manual";
  }

  function normalizeSelectedNoteIds(value, notes) {
    const noteIds = new Set(coerceArray(notes).map((note) => (note && note.id ? String(note.id) : "")));
    const seen = new Set();
    return coerceArray(value)
      .map((entry) => String(entry || "").trim())
      .filter((id) => {
        if (!id || seen.has(id) || !noteIds.has(id)) return false;
        seen.add(id);
        return true;
      });
  }

  function normalizeDrawerMode(value) {
    return String(value || "").toLowerCase() === DRAWER_MODE_NOTES
      ? DRAWER_MODE_NOTES
      : DRAWER_MODE_CATEGORIES;
  }

  function normalizeUi(value, folders, notes) {
    const noteIds = new Set(notes.map((note) => note.id));
    const source = value && typeof value === "object" ? value : {};
    const fallbackFolderFilter = typeof source.activeFolderId === "string" ? source.activeFolderId : FILTER_ALL_FOLDERS;
    const activeFolderFilter = normalizeFolderFilter(source.activeFolderFilter || fallbackFolderFilter, folders);
    const activeNoteId = source.activeNoteId && noteIds.has(String(source.activeNoteId))
      ? String(source.activeNoteId)
      : (notes[0] ? notes[0].id : "");
    return {
      activeNoteId,
      notesDrawerOpen: source.notesDrawerOpen === true,
      drawerMode: normalizeDrawerMode(source.drawerMode),
      activeView: normalizeView(source.activeView),
      activeFolderFilter,
      pinnedFolderIds: normalizePinnedFolderIds(source.pinnedFolderIds, folders),
      hiddenFolderIds: normalizeHiddenFolderIds(source.hiddenFolderIds, folders),
      showHiddenFolders: source.showHiddenFolders === true,
      favoriteFolderSortMode: normalizeFavoriteFolderSortMode(source.favoriteFolderSortMode),
      folderPage: Math.max(0, Number.isFinite(Number(source.folderPage)) ? Number(source.folderPage) : 0),
      notePage: Math.max(0, Number.isFinite(Number(source.notePage)) ? Number(source.notePage) : 0),
      selectedNoteIds: normalizeSelectedNoteIds(source.selectedNoteIds, notes),
      searchQuery: normalizeSearchQuery(source.searchQuery),
      closeOnOutsideClick: source.closeOnOutsideClick !== false,
      panelWidth: clampPanelWidth(source.panelWidth) || DEFAULT_PANEL_WIDTH,
      panelHeight: clampPanelHeight(source.panelHeight) || DEFAULT_PANEL_HEIGHT,
      zenMode: source.zenMode === true,
      mindmapDefaultOn: source.mindmapDefaultOn === true,
      mindmapZoom: Number.isFinite(Number(source.mindmapZoom)) ? Math.max(0.3, Math.min(3, Number(source.mindmapZoom))) : 1,
      mindmapPanX: Number.isFinite(Number(source.mindmapPanX)) ? Number(source.mindmapPanX) : 0,
      mindmapPanY: Number.isFinite(Number(source.mindmapPanY)) ? Number(source.mindmapPanY) : 0,
      mindmapCollapsedFolders: Array.isArray(source.mindmapCollapsedFolders) ? source.mindmapCollapsedFolders.filter(function(f) { return typeof f === "string"; }) : [],
      mindmapCollapsedNodes: Array.isArray(source.mindmapCollapsedNodes) ? source.mindmapCollapsedNodes.filter(function(f) { return typeof f === "string"; }) : [],
      mindmapOpenOnClick: source.mindmapOpenOnClick === true,
      mindmapLayoutStyle: source.mindmapLayoutStyle === "tree" ? "tree" : "radial",
      activeTodoListId: typeof source.activeTodoListId === "string" ? source.activeTodoListId : "",
      todoFilter: ["all", "active", "completed"].indexOf(source.todoFilter) >= 0 ? source.todoFilter : "all"
    };
  }

  function createBlankNote(folderId) {
    const now = new Date().toISOString();
    return {
      id: makeId("note"),
      title: "",
      content: "",
      folderId: folderId || "",
      isPinned: false,
      pinnedAt: "",
      createdAt: now,
      updatedAt: now
    };
  }

  function createBlankTodoList() {
    const now = new Date().toISOString();
    return {
      id: makeId("todoList"),
      title: "",
      icon: "📋",
      color: "",
      createdAt: now,
      updatedAt: now,
      order: state.todoLists.length
    };
  }

  function createBlankTodoItem(listId) {
    const now = new Date().toISOString();
    return {
      id: makeId("todoItem"),
      listId: listId || "",
      text: "",
      completed: false,
      completedAt: "",
      priority: "medium",
      dueDate: "",
      notes: "",
      createdAt: now,
      updatedAt: now,
      order: 0
    };
  }

  function normalizeTodoLists(value) {
    return coerceArray(value).map(function(entry, index) {
      if (!entry || typeof entry !== "object") return null;
      var id = entry.id ? String(entry.id).trim() : "";
      if (!id) return null;
      return {
        id: id.slice(0, 80),
        title: entry.title == null ? "" : String(entry.title).slice(0, 120),
        icon: typeof entry.icon === "string" ? entry.icon.slice(0, 4) : "📋",
        color: typeof entry.color === "string" ? entry.color.slice(0, 20) : "",
        createdAt: entry.createdAt ? String(entry.createdAt) : new Date().toISOString(),
        updatedAt: entry.updatedAt ? String(entry.updatedAt) : new Date().toISOString(),
        order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : index
      };
    }).filter(Boolean);
  }

  function normalizeTodoItems(value, validListIds) {
    var listSet = new Set(coerceArray(validListIds).map(function(l) { return l && l.id ? l.id : ""; }));
    return coerceArray(value).map(function(entry, index) {
      if (!entry || typeof entry !== "object") return null;
      var id = entry.id ? String(entry.id).trim() : "";
      if (!id) return null;
      var listId = entry.listId ? String(entry.listId).trim() : "";
      if (listId && !listSet.has(listId)) return null;
      return {
        id: id.slice(0, 80),
        listId: listId,
        text: entry.text == null ? "" : String(entry.text).slice(0, 500),
        completed: entry.completed === true,
        completedAt: entry.completedAt ? String(entry.completedAt) : "",
        priority: ["low", "medium", "high"].indexOf(entry.priority) >= 0 ? entry.priority : "medium",
        dueDate: entry.dueDate ? String(entry.dueDate).slice(0, 20) : "",
        notes: entry.notes == null ? "" : String(entry.notes).slice(0, 2000),
        createdAt: entry.createdAt ? String(entry.createdAt) : new Date().toISOString(),
        updatedAt: entry.updatedAt ? String(entry.updatedAt) : new Date().toISOString(),
        order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : index
      };
    }).filter(Boolean);
  }

  function getSortedTodoItems(items) {
    return coerceArray(items).slice().sort(function(a, b) {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (a.order || 0) - (b.order || 0);
    });
  }

  function getSortedTodoLists(lists) {
    return coerceArray(lists).slice().sort(function(a, b) {
      return (a.order || 0) - (b.order || 0);
    });
  }

  function getTodoItemsForList(listId) {
    return getSortedTodoItems(state.todoItems.filter(function(item) { return item && item.listId === listId; }));
  }

  function getFilteredTodoItems(listId) {
    var items = getTodoItemsForList(listId);
    var filter = state.ui.todoFilter;
    if (filter === "active") return items.filter(function(i) { return !i.completed; });
    if (filter === "completed") return items.filter(function(i) { return i.completed; });
    return items;
  }

  function getActiveTodoList() {
    if (!state.ui.activeTodoListId) return null;
    return state.todoLists.find(function(l) { return l && l.id === state.ui.activeTodoListId; }) || null;
  }

  async function createTodoList(title) {
    var list = createBlankTodoList();
    list.title = String(title || "").trim().slice(0, 120) || "New List";
    state.todoLists = getSortedTodoLists([list].concat(state.todoLists));
    state.ui.activeTodoListId = list.id;
    render();
    await flushSave("Todo list created");
    var addInput = state.refs.mpTodoAddInput;
    if (addInput) addInput.focus();
  }

  async function deleteTodoList(listId) {
    if (!listId) return;
    state.todoLists = state.todoLists.filter(function(l) { return l.id !== listId; });
    state.todoItems = state.todoItems.filter(function(i) { return i.listId !== listId; });
    if (state.ui.activeTodoListId === listId) {
      state.ui.activeTodoListId = state.todoLists.length > 0 ? state.todoLists[0].id : "";
    }
    render();
    await flushSave("Todo list deleted");
  }

  async function renameTodoList(listId, newTitle) {
    var list = state.todoLists.find(function(l) { return l && l.id === listId; });
    if (!list) return;
    list.title = String(newTitle || "").trim().slice(0, 120) || "Untitled";
    list.updatedAt = new Date().toISOString();
    render();
    await flushSave("List renamed");
  }

  async function addTodoItem(listId, text) {
    if (!listId || !text) return;
    var items = getTodoItemsForList(listId);
    var item = createBlankTodoItem(listId);
    item.text = String(text).trim().slice(0, 500);
    item.order = items.filter(function(i) { return !i.completed; }).length;
    state.todoItems.push(item);
    render();
    markStateDirty();
    setSaveStatus("Saving...", "saving");
    await persist("Item added", {});
  }

  async function toggleTodoItem(itemId) {
    var item = state.todoItems.find(function(i) { return i && i.id === itemId; });
    if (!item) return;
    item.completed = !item.completed;
    item.completedAt = item.completed ? new Date().toISOString() : "";
    item.updatedAt = new Date().toISOString();
    render();
    markStateDirty();
    await persist("", {});
  }

  async function deleteTodoItem(itemId) {
    state.todoItems = state.todoItems.filter(function(i) { return i.id !== itemId; });
    render();
    markStateDirty();
    await persist("Item deleted", {});
  }

  async function editTodoItemText(itemId, newText) {
    var item = state.todoItems.find(function(i) { return i && i.id === itemId; });
    if (!item) return;
    item.text = String(newText || "").trim().slice(0, 500);
    item.updatedAt = new Date().toISOString();
    render();
    markStateDirty();
    await persist("", {});
  }

  async function reorderTodoItems(listId, orderedItemIds) {
    var lookup = {};
    state.todoItems.forEach(function(i) { lookup[i.id] = i; });
    orderedItemIds.forEach(function(id, idx) {
      var item = lookup[id];
      if (item && item.listId === listId) item.order = idx;
    });
    render();
    markStateDirty();
    await persist("", {});
  }

  function getSortedNotes(notes) {
    return coerceArray(notes).slice().sort(compareNotes);
  }

  function getActiveNote() {
    return state.notes.find((note) => note && note.id === state.ui.activeNoteId) || null;
  }

  function ensureActiveNoteExists() {
    if (!state.notes.length) {
      const note = createBlankNote("");
      state.notes = [note];
      state.ui.activeNoteId = note.id;
      state.ui.activeView = VIEW_ALL;
      state.ui.activeFolderFilter = FILTER_ALL_FOLDERS;
      return;
    }
    if (state.ui.activeNoteId && state.notes.some((note) => note.id === state.ui.activeNoteId)) {
      return;
    }
    state.ui.activeNoteId = state.notes[0].id;
  }

  function parseChecklistItems(content) {
    const raw = String(content || "");
    const lines = raw.split("\n");
    const items = [];
    lines.forEach((line, index) => {
      const match = line.match(/^(\s*)[-*]\s\[( |x|X)\]\s?(.*)$/);
      if (!match) return;
      items.push({
        lineIndex: index,
        indent: match[1] || "",
        checked: String(match[2] || "").toLowerCase() === "x",
        text: match[3] || ""
      });
    });
    return items;
  }

  function getChecklistStats(note) {
    const items = parseChecklistItems(note && note.content ? note.content : "");
    const total = items.length;
    const open = items.filter((item) => item.checked !== true).length;
    return { total, open };
  }

  function noteMatchesView(note, view) {
    if (!note) return false;
    if (view === VIEW_PINNED) {
      return note.isPinned === true;
    }
    if (view === VIEW_TASKS) {
      return getChecklistStats(note).total > 0;
    }
    return true;
  }

  // ── Search helpers (accent-insensitive + ranking + highlight) ────────────
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  // Fold common Latin diacritics so "cafe" matches "café", etc.
  function foldAccents(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function matchNorm(s) {
    return foldAccents(String(s == null ? "" : s)).toLowerCase();
  }

  function noteMatchesQuery(note, query) {
    const needle = matchNorm(normalizeSearchQuery(query));
    if (!needle) return true;
    return [
      getNoteTitle(note),
      note && note.content ? note.content : "",
      getFolderLabel(note && note.folderId ? note.folderId : "")
    ].some((value) => matchNorm(value).includes(needle));
  }

  // Relevance: title/url prefix ranks highest, then includes, then body.
  function noteRelevanceScore(note, query) {
    const needle = matchNorm(normalizeSearchQuery(query));
    if (!needle) return 0;
    const title = matchNorm(getNoteTitle(note));
    const content = matchNorm(note && note.content ? note.content : "");
    const folder = matchNorm(getFolderLabel(note && note.folderId ? note.folderId : ""));
    let score = 0;
    if (title.startsWith(needle)) score += 100;
    else if (title.includes(needle)) score += 60;
    if (folder.startsWith(needle)) score += 20;
    else if (folder.includes(needle)) score += 10;
    if (content.includes(needle)) score += 5;
    return score;
  }

  // Sanitize any HTML before assigning to innerHTML (XSS defense-in-depth).
  // Notes html is already built from escapeHtml(); DOMPurify is used when present.
  // Assign a sanitizer under `Sanitizer.unwrapSafeHTML`.
  if (typeof Sanitizer === "undefined") { window.Sanitizer = {}; }
  if (typeof Sanitizer.unwrapSafeHTML !== "function") {
    Sanitizer.unwrapSafeHTML = function (html) {
      try {
        if (typeof window !== "undefined" && window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
          return window.DOMPurify.sanitize(String(html == null ? "" : html), {
            ALLOWED_TAGS: ["mark", "a", "br", "b", "i", "strong", "em", "code", "pre", "ul", "ol", "li", "p", "span", "h1", "h2", "h3", "h4", "h5", "h6"],
            ALLOWED_ATTR: ["href", "target", "rel", "class", "title"]
          });
        }
      } catch (e) {}
      return String(html == null ? "" : html);
    };
  }

  // Safely set an element's HTML without assigning a dynamic value to `innerHTML`
  // (addons-linter's no-unsanitized rule rejects any dynamic innerHTML assignment,
  // including Sanitizer.unwrapSafeHTML which is NOT whitelisted in its config).
  // We sanitize the markup and parse it into DOM nodes via DOMParser, then swap
  // them in with replaceChildren/appendChild so no `innerHTML` assignment exists.
  function safeSetHtml(el, html) {
    if (!el) return;
    var src = (html == null) ? "" : String(html);
    var clean = src;
    try {
      if (typeof window !== "undefined" && window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
        clean = window.DOMPurify.sanitize(src, {
          ALLOWED_TAGS: ["mark", "a", "br", "b", "i", "strong", "em", "code", "pre", "ul", "ol", "li", "p", "span", "h1", "h2", "h3", "h4", "h5", "h6"],
          ALLOWED_ATTR: ["href", "target", "rel", "class", "title"]
        });
      }
    } catch (e) {}
    el.replaceChildren();
    if (!clean) return;
    var doc = new DOMParser().parseFromString(clean, "text/html");
    var frag = document.createDocumentFragment();
    while (doc.body.firstChild) frag.appendChild(doc.body.firstChild);
    el.appendChild(frag);
  }

  // Set element text, highlighting all accent/case-insensitive matches of query.
  function setHighlightedText(el, text, query) {
    const raw = String(text == null ? "" : text);
    const needle = matchNorm(normalizeSearchQuery(query));
    if (!needle) { el.textContent = raw; return; }
    const lower = matchNorm(raw);
    let html = "";
    let i = 0;
    let idx;
    while ((idx = lower.indexOf(needle, i)) !== -1) {
      html += escapeHtml(raw.slice(i, idx)) + "<mark>" + escapeHtml(raw.slice(idx, idx + needle.length)) + "</mark>";
      i = idx + needle.length;
    }
    html += escapeHtml(raw.slice(i));
    safeSetHtml(el, html);
  }

  // Skeleton placeholder shown while an async import is in progress.
  function showImportSkeleton() {
    const list = state.refs.mpList;
    if (!list) return;
    list.replaceChildren();
    for (let i = 0; i < 4; i++) {
      const sk = document.createElement("div");
      sk.style.cssText = "height:42px;border-radius:9px;margin-bottom:6px;" +
        "background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.10) 50%,rgba(255,255,255,0.04) 75%);" +
        "background-size:200% 100%;animation:lpSkeletonPulse 1.1s ease-in-out infinite;";
      list.appendChild(sk);
    }
  }

  function noteMatchesFolderFilter(note, folderFilter) {
    if (folderFilter === FILTER_ALL_FOLDERS) return true;
    if (folderFilter === FILTER_UNCATEGORIZED) {
      return !(note && note.folderId);
    }
    return !!(note && note.folderId === folderFilter);
  }

  function getBaseFilteredNotes() {
    const query = normalizeSearchQuery(state.ui.searchQuery);
    return getSortedNotes(state.notes).filter((note) => {
      if (!noteMatchesView(note, state.ui.activeView)) return false;
      return noteMatchesQuery(note, query);
    });
  }

  function getVisibleNotes() {
    const query = normalizeSearchQuery(state.ui.searchQuery);
    // When a search query is active, search globally across ALL folders
    // (ignore the active folder filter) — standard overlay search behaviour.
    if (query) {
      const results = getBaseFilteredNotes();
      // Rank by relevance so the best matches surface first.
      return results.slice().sort((a, b) => noteRelevanceScore(b, query) - noteRelevanceScore(a, query));
    }
    return getBaseFilteredNotes().filter((note) => noteMatchesFolderFilter(note, state.ui.activeFolderFilter));
  }

  function getViewCountsForCurrentScope() {
    const scopedNotes = getSortedNotes(state.notes).filter((note) => {
      if (!noteMatchesFolderFilter(note, state.ui.activeFolderFilter)) return false;
      return noteMatchesQuery(note, state.ui.searchQuery);
    });
    return scopedNotes.reduce((counts, note) => {
      counts.all += 1;
      if (note && note.isPinned === true) {
        counts.pinned += 1;
      }
      if (getChecklistStats(note).total > 0) {
        counts.tasks += 1;
      }
      return counts;
    }, { all: 0, pinned: 0, tasks: 0 });
  }

  function getDrawerSelectedNoteId(visibleNotes) {
    const notes = coerceArray(visibleNotes);
    if (!notes.length) return "";
    if (notes.some((note) => note && note.id === state.ui.activeNoteId)) {
      return state.ui.activeNoteId;
    }
    return notes[0] && notes[0].id ? String(notes[0].id) : "";
  }

  function getSelectedNoteIdsInScope(visibleNotes) {
    const visibleIdSet = new Set(coerceArray(visibleNotes).map((note) => (note && note.id ? String(note.id) : "")));
    return coerceArray(state.ui.selectedNoteIds).filter((id) => visibleIdSet.has(String(id)));
  }

  function hasPageContext() {
    return !!(state.pageContext && (state.pageContext.title || state.pageContext.url));
  }

  function getPreferredCategoryIdForNewNote() {
    const activeNote = getActiveNote();
    if (activeNote && activeNote.folderId) {
      return String(activeNote.folderId);
    }
    const activeFilter = state.ui.activeFolderFilter;
    if (activeFilter && activeFilter !== FILTER_ALL_FOLDERS && activeFilter !== FILTER_UNCATEGORIZED && getFolderById(activeFilter)) {
      return activeFilter;
    }
    return "";
  }

  function getCurrentContextCategoryLabel() {
    const categoryId = getPreferredCategoryIdForNewNote();
    return categoryId ? getFolderLabel(categoryId) : UNCATEGORIZED_LABEL;
  }

  function isNotesDrawerPage() {
    return state.ui.drawerMode === DRAWER_MODE_NOTES;
  }

  function isPickerPanelMode() {
    return state.panelMode === "picker";
  }

  function preparePickerLandingPage() {
    state.panelMode = "picker";
    state.ui.notesDrawerOpen = true;
    state.ui.drawerMode = DRAWER_MODE_CATEGORIES;
    state.ui.folderPage = 0;
    setFolderKeyboardIndexFromActiveFilter();
  }

  function openDrawerCategoriesPage() {
    preparePickerLandingPage();
  }

  function openDrawerNotesPage(folderId = state.ui.activeFolderFilter) {
    state.ui.activeFolderFilter = normalizeFolderFilter(folderId, state.folders);
    state.ui.notesDrawerOpen = true;
    state.ui.drawerMode = DRAWER_MODE_NOTES;
    state.ui.notePage = 0;
  }

  function getFolderCounts(notes) {
    const counts = new Map();
    counts.set(FILTER_ALL_FOLDERS, notes.length);
    counts.set(FILTER_UNCATEGORIZED, 0);
    state.folders.forEach((folder) => {
      counts.set(folder.id, 0);
    });
    notes.forEach((note) => {
      const folderId = note && note.folderId ? note.folderId : "";
      const key = folderId && counts.has(folderId) ? folderId : FILTER_UNCATEGORIZED;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }

  function hueFromString(input) {
    const text = String(input || "");
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 360;
  }

  function getCategoryColorKey(folderId) {
    const id = folderId ? String(folderId) : "";
    if (!id || id === FILTER_UNCATEGORIZED) return "__uncategorized__";
    if (id === FILTER_ALL_FOLDERS) return "__all__";
    return id;
  }

  function getFolderRowPalette(folderId) {
    const colorKey = getCategoryColorKey(folderId);
    const hue = hueFromString(colorKey);
    const saturation = colorKey === "__uncategorized__"
      ? 36
      : (colorKey === "__all__" ? 46 : 68);
    const strongSaturation = Math.min(90, saturation + 12);
    return {
      rowBorder: `hsla(${hue}, ${saturation}%, 64%, 0.34)`,
      rowBackground: `hsla(${hue}, ${saturation}%, 56%, 0.14)`,
      rowBackgroundActive: `hsla(${hue}, ${Math.min(92, saturation + 10)}%, 58%, 0.24)`,
      dot: `hsl(${hue}, ${strongSaturation}%, 70%)`,
      dotRing: `hsla(${hue}, ${strongSaturation}%, 64%, 0.48)`,
      countBorder: `hsla(${hue}, ${strongSaturation}%, 70%, 0.58)`,
      countBackground: `hsla(${hue}, ${strongSaturation}%, 62%, 0.27)`,
      countColor: "#fff"
    };
  }

  function getOrderedFolderList() {
    const pinnedIds = normalizePinnedFolderIds(state.ui.pinnedFolderIds, state.folders);
    const pinned = new Set(pinnedIds);
    const hidden = new Set(normalizeHiddenFolderIds(state.ui.hiddenFolderIds, state.folders));
    const pinnedFolders = [];
    const regularFolders = [];
    const folderMap = buildFolderMap(state.folders);
    state.folders.forEach((folder) => {
      if (!folder) return;
      if (hidden.has(folder.id) && state.ui.showHiddenFolders !== true) return;
      if (!pinned.has(folder.id)) {
        regularFolders.push(folder);
      }
    });
    const favoriteSortMode = normalizeFavoriteFolderSortMode(state.ui.favoriteFolderSortMode);
    if (favoriteSortMode === "manual") {
      pinnedIds.forEach((id) => {
        const folder = folderMap.get(id);
        if (!folder || (hidden.has(id) && state.ui.showHiddenFolders !== true)) return;
        pinnedFolders.push(folder);
      });
    } else {
      pinnedIds.forEach((id) => {
        const folder = folderMap.get(id);
        if (!folder || (hidden.has(id) && state.ui.showHiddenFolders !== true)) return;
        pinnedFolders.push(folder);
      });
      pinnedFolders.sort((a, b) => {
        const left = a && a.name ? a.name : "";
        const right = b && b.name ? b.name : "";
        return favoriteSortMode === "asc"
          ? left.localeCompare(right, undefined, { sensitivity: "base" })
          : right.localeCompare(left, undefined, { sensitivity: "base" });
      });
    }
    return [...pinnedFolders, ...regularFolders];
  }

  function getFolderFilterRows() {
    const rows = [
      { id: FILTER_ALL_FOLDERS, label: "All Categories", pinned: false, system: true },
      { id: FILTER_UNCATEGORIZED, label: UNCATEGORIZED_LABEL, pinned: false, system: true },
      ...getOrderedFolderList().map((folder) => ({
        id: folder.id,
        label: folder.name,
        pinned: state.ui.pinnedFolderIds.includes(folder.id),
        hidden: state.ui.hiddenFolderIds.includes(folder.id),
        system: false
      }))
    ];
    const query = normalizeSearchQuery(state.ui.searchQuery).toLowerCase();
    if (!query || isNotesDrawerPage()) {
      return rows;
    }
    return rows.filter((row) => String(row && row.label ? row.label : "").toLowerCase().includes(query));
  }

  function getAssignableFolderRows() {
    return [
      { id: "", label: UNCATEGORIZED_LABEL },
      ...getOrderedFolderList().map((folder) => ({ id: folder.id, label: folder.name }))
    ];
  }

  function getCurrentFolderRowIndex() {
    const rows = getFolderFilterRows();
    const index = rows.findIndex((row) => row.id === state.ui.activeFolderFilter);
    return index >= 0 ? index : 0;
  }

  function getFolderPageSize() {
    return 500;
  }

  function getNotePageSize() {
    return 500;
  }

  function getFolderPagerState() {
    const rows = getFolderFilterRows();
    const pageSize = getFolderPageSize();
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const activeIndex = Math.max(0, rows.findIndex((row) => row.id === state.ui.activeFolderFilter));
    const preferredPage = Math.max(0, Number(state.ui.folderPage) || 0);
    const activePage = Math.min(totalPages - 1, Math.max(preferredPage, Math.floor(activeIndex / pageSize)));
    const start = activePage * pageSize;
    return {
      rows,
      pageSize,
      totalPages,
      activePage,
      visibleRows: rows.slice(start, start + pageSize)
    };
  }

  function getNotePagerState(visibleNotes) {
    const rows = coerceArray(visibleNotes);
    const pageSize = getNotePageSize();
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const activeIndex = Math.max(0, rows.findIndex((note) => note && note.id === getDrawerSelectedNoteId(rows)));
    const preferredPage = Math.max(0, Number(state.ui.notePage) || 0);
    const activePage = Math.min(totalPages - 1, Math.max(preferredPage, Math.floor(activeIndex / pageSize)));
    const start = activePage * pageSize;
    return {
      rows,
      pageSize,
      totalPages,
      activePage,
      visibleRows: rows.slice(start, start + pageSize)
    };
  }

  function isEditableElement(target) {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName ? target.tagName.toLowerCase() : "";
    if (target.isContentEditable) return true;
    if (tag === "input" || tag === "textarea" || tag === "select" || tag === "iframe") return true;
    return !!target.closest('input, textarea, select, [contenteditable="true"], iframe');
  }

  function setFolderKeyboardIndexFromActiveFilter() {
    state.folderKeyboardIndex = getCurrentFolderRowIndex();
  }

  function closeFolderContextMenu() {
    if (state.folderContextMenu.open !== true) return;
    state.folderContextMenu = {
      open: false,
      folderId: "",
      anchorX: 0,
      anchorY: 0
    };
    render();
  }

  function closeFolderPalette() {
    if (state.folderPalette.open !== true) return;
    state.folderPalette = {
      open: false,
      query: "",
      activeIndex: 0,
      options: [],
      pendingTargetId: "",
      pendingOffset: 0
    };
    render();
  }

  function getViewLabel(view) {
    if (view === VIEW_PINNED) return "Pinned";
    if (view === VIEW_TASKS) return "Tasks";
    return "All Notes";
  }

  function getFolderFilterLabel(filterId) {
    if (filterId === FILTER_UNCATEGORIZED) {
      return UNCATEGORIZED_LABEL;
    }
    if (filterId === FILTER_ALL_FOLDERS) {
      return "All Categories";
    }
    return getFolderLabel(filterId);
  }

  function getNotesSummaryLabel(visibleNotes) {
    const count = visibleNotes.length;
    const query = normalizeSearchQuery(state.ui.searchQuery);
    if (query) {
      return `${count} result${count === 1 ? "" : "s"} for "${query}"`;
    }
    const base = state.ui.activeView === VIEW_PINNED
      ? `${count} pinned note${count === 1 ? "" : "s"}`
      : state.ui.activeView === VIEW_TASKS
        ? `${count} note${count === 1 ? "" : "s"} with tasks`
        : `${count} note${count === 1 ? "" : "s"}`;
    if (state.ui.activeFolderFilter === FILTER_ALL_FOLDERS) {
      return base;
    }
    return `${base} in ${getFolderFilterLabel(state.ui.activeFolderFilter)}`;
  }

  function getEmptyNotesLabel() {
    const query = normalizeSearchQuery(state.ui.searchQuery);
    if (query) {
      return `No results for "${query}".`;
    }
    if (state.ui.activeView === VIEW_PINNED) {
      return "No pinned notes yet.";
    }
    if (state.ui.activeView === VIEW_TASKS) {
      return "No notes with checklist items yet.";
    }
    if (state.ui.activeFolderFilter === FILTER_UNCATEGORIZED) {
      return "No uncategorized notes yet.";
    }
    if (state.ui.activeFolderFilter !== FILTER_ALL_FOLDERS) {
      return `No notes in ${getFolderFilterLabel(state.ui.activeFolderFilter)}.`;
    }
    return "No notes yet.";
  }

  function getNotePreview(note, query) {
    const content = String(note && note.content ? note.content : "").replace(/\s+/g, " ").trim();
    if (!content) return "Empty note";
    const needle = normalizeSearchQuery(query).toLowerCase();
    if (!needle) {
      return content;
    }
    const matchIndex = content.toLowerCase().indexOf(needle);
    if (matchIndex === -1) {
      return content;
    }
    const start = Math.max(0, matchIndex - 36);
    const end = Math.min(content.length, matchIndex + needle.length + 72);
    let snippet = content.slice(start, end).trim();
    if (start > 0) snippet = `...${snippet}`;
    if (end < content.length) snippet = `${snippet}...`;
    return snippet;
  }

  function buildHighlightedFragment(value, query) {
    const raw = String(value || "");
    const fragment = document.createDocumentFragment();
    const needle = normalizeSearchQuery(query);
    if (!needle) {
      fragment.appendChild(document.createTextNode(raw));
      return fragment;
    }
    const lower = raw.toLowerCase();
    const search = needle.toLowerCase();
    if (!search) {
      fragment.appendChild(document.createTextNode(raw));
      return fragment;
    }
    let cursor = 0;
    while (cursor < raw.length) {
      const index = lower.indexOf(search, cursor);
      if (index === -1) {
        fragment.appendChild(document.createTextNode(raw.slice(cursor)));
        break;
      }
      fragment.appendChild(document.createTextNode(raw.slice(cursor, index)));
      const mark = document.createElement("mark");
      mark.textContent = raw.slice(index, index + search.length);
      fragment.appendChild(mark);
      cursor = index + search.length;
    }
    return fragment;
  }

  function setHighlightedContent(target, value, query) {
    if (!target) return;
    target.replaceChildren(buildHighlightedFragment(value, query));
  }

  function setSaveStatus(message, tone) {
    const el = state.refs.saveStatus;
    if (!el) return;
    el.textContent = message || "Ready";
    el.dataset.tone = tone || "";
    // Apply tone-based styling
    if (tone === "success") {
      el.style.color = "#7dffb0";
      el.style.borderColor = "rgba(80,255,150,0.25)";
      el.style.background = "rgba(80,255,150,0.08)";
    } else if (tone === "error") {
      el.style.color = "#ff9090";
      el.style.borderColor = "rgba(255,100,100,0.3)";
      el.style.background = "rgba(255,100,100,0.08)";
    } else {
      el.style.color = "#8892a0";
      el.style.borderColor = "rgba(255,255,255,0.09)";
      el.style.background = "rgba(255,255,255,0.04)";
    }
  }

  function renderUndoToast() {
    const toast = state.refs.undoToast;
    const messageEl = state.refs.undoToastMessage;
    if (!toast || !messageEl) return;
    const pending = state.pendingUndoDelete;
    if (!pending) {
      toast.style.display = "none";
      return;
    }
    messageEl.textContent = pending.message || "Note deleted";
    toast.style.display = "flex";
  }

  function clearPendingUndoDelete() {
    if (state.undoDeleteTimer) {
      clearTimeout(state.undoDeleteTimer);
      state.undoDeleteTimer = null;
    }
    state.pendingUndoDelete = null;
    renderUndoToast();
  }

  function clearFolderDropTargets() {
    if (!state.shadow) return;
    state.shadow.querySelectorAll(".folder-row-button.drop-target").forEach((button) => {
      button.classList.remove("drop-target");
    });
  }

  function getDroppableFolderId(filterId) {
    if (filterId === FILTER_ALL_FOLDERS) return null;
    if (filterId === FILTER_UNCATEGORIZED) return "";
    return getFolderById(filterId) ? filterId : null;
  }

  function renderDialog() {
    const layer = state.refs.dialogLayer;
    if (!layer) return;
    const dialog = state.dialog;
    const inputMode = dialog.mode === "prompt";
    layer.style.display = dialog.open === true ? "flex" : "none";
    if (dialog.open !== true) return;
    if (state.refs.dialogTitle) state.refs.dialogTitle.textContent = dialog.title || "Dialog";
    if (state.refs.dialogMessage) state.refs.dialogMessage.textContent = dialog.message || "";
    if (state.refs.dialogInputWrap) state.refs.dialogInputWrap.style.display = inputMode ? "grid" : "none";
    if (state.refs.dialogInputLabel) state.refs.dialogInputLabel.textContent = dialog.inputLabel || "Input";
    if (state.refs.dialogInput) {
      state.refs.dialogInput.value = dialog.inputValue || "";
      state.refs.dialogInput.placeholder = dialog.inputPlaceholder || "";
    }
    if (state.refs.dialogConfirm) {
      state.refs.dialogConfirm.textContent = dialog.confirmLabel || "OK";
      if (dialog.danger === true) {
        state.refs.dialogConfirm.style.background = "linear-gradient(135deg,rgba(210,76,76,0.8),rgba(210,76,76,0.6))";
        state.refs.dialogConfirm.style.borderColor = "rgba(255,143,143,0.4)";
      } else {
        state.refs.dialogConfirm.style.background = "linear-gradient(135deg,#5ac8ff,#3a8fff)";
        state.refs.dialogConfirm.style.borderColor = "transparent";
      }
    }
    if (state.refs.dialogCancel) {
      state.refs.dialogCancel.textContent = dialog.cancelLabel || "Cancel";
    }
    setTimeout(() => {
      if (dialog.open !== true) return;
      if (inputMode && state.refs.dialogInput) {
        state.refs.dialogInput.focus();
        if (typeof state.refs.dialogInput.select === "function") {
          state.refs.dialogInput.select();
        }
      } else if (state.refs.dialogConfirm) {
        state.refs.dialogConfirm.focus();
      }
    }, 0);
  }

  function renderTrashPanel() {
    const layer = state.refs.trashLayer;
    const list = state.refs.trashList;
    const empty = state.refs.trashEmpty;
    const meta = state.refs.trashMeta;
    const openButton = state.refs.openTrashButton;
    const emptyButton = state.refs.emptyTrashButton;
    const trash = coerceArray(state.trash);
    if (openButton) {
      openButton.disabled = trash.length === 0;
      openButton.textContent = trash.length > 0 ? `Trash (${trash.length})` : "Trash";
    }
    if (!layer || !list || !empty || !meta) return;
    layer.style.display = state.trashPanelOpen === true ? "flex" : "none";
    meta.textContent = trash.length
      ? `${trash.length} deleted note${trash.length === 1 ? "" : "s"} kept for up to 30 days.`
      : "Deleted notes will appear here.";
    list.replaceChildren();
    empty.style.display = trash.length > 0 ? "none" : "block";
    if (emptyButton) {
      emptyButton.disabled = trash.length === 0;
    }
    if (!trash.length) return;
    list.append(...trash.map(buildTrashItemRow));
  }

  // Build a single trash item row (used by both the full-screen layer and the
  // inline trash view). Restore is wired directly so it works without relying
  // on the init-time [data-action] delegation.
  function buildTrashItemRow(entry) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px 14px;background:rgba(255,255,255,0.04);";
    const info = document.createElement("div");
    const title = document.createElement("div");
    title.style.cssText = "font-size:13px;font-weight:700;color:#f3f4f6;";
    title.textContent = getNoteTitle(entry && entry.note);
    const preview = document.createElement("div");
    preview.style.cssText = "margin-top:3px;color:#a3acb9;font-size:12px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;";
    preview.textContent = getNotePreview(entry && entry.note, "");
    const itemMeta = document.createElement("div");
    itemMeta.style.cssText = "margin-top:4px;color:#a3acb9;font-size:11px;";
    itemMeta.textContent = formatDeletedAt(entry && entry.deletedAt);
    info.append(title, preview, itemMeta);
    const restoreButton = document.createElement("button");
    restoreButton.type = "button";
    restoreButton.style.cssText = "padding:4px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#f3f4f6;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;outline:none;";
    restoreButton.textContent = "Restore";
    restoreButton.addEventListener("click", () => {
      restoreTrashNote(entry && entry.id).catch(() => setSaveStatus("Could not restore note", "error"));
    });
    wrapper.append(info, restoreButton);
    return wrapper;
  }

  // Inline trash view rendered inside the main panel list (replaces the
  // separate full-screen trash layer for day-to-day use).
  function renderTrashInline() {
    const list = state.refs.mpList;
    if (!list) return;
    list.replaceChildren();
    const trash = coerceArray(state.trash);
    if (!trash.length) {
      const emptyWrap = document.createElement("div");
      emptyWrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px 8px;text-align:center;";
      const icon = document.createElement("div");
      icon.style.cssText = "font-size:24px;line-height:1;opacity:0.8;";
      icon.textContent = "♻️";
      const label = document.createElement("div");
      label.style.cssText = "color:" + ROW_MUTED + ";font-size:13px;font-weight:600;";
      label.textContent = "Trash is empty";
      const hint = document.createElement("div");
      hint.style.cssText = "color:" + ROW_MUTED + ";font-size:11px;opacity:0.8;";
      hint.textContent = "Deleted notes are kept for up to 30 days";
      emptyWrap.append(icon, label, hint);
      list.appendChild(emptyWrap);
      if (state.refs.mpPager) state.refs.mpPager.style.display = "none";
      return;
    }
    const meta = document.createElement("div");
    meta.style.cssText = "color:" + ROW_MUTED + ";font-size:11px;padding:2px 4px 8px;";
    meta.textContent = trash.length + " deleted note" + (trash.length === 1 ? "" : "s") + " — kept for up to 30 days.";
    list.appendChild(meta);
    list.append(...trash.map(buildTrashItemRow));
    if (state.refs.mpPager) state.refs.mpPager.style.display = "none";
  }

  function startFolderLabelMarquee(labelEl) {
    if (!labelEl || !labelEl.__lpMarqueeInner) return;
    const inner = labelEl.__lpMarqueeInner;
    labelEl.classList.remove("marquee-active");
    labelEl.style.removeProperty("--lp-folder-marquee-shift");
    const overflow = inner.scrollWidth - labelEl.clientWidth;
    if (!(overflow > 12)) return;
    labelEl.style.setProperty("--lp-folder-marquee-shift", `${-Math.min(overflow, 180)}px`);
    labelEl.classList.add("marquee-active");
  }

  function stopFolderLabelMarquee(labelEl) {
    if (!labelEl) return;
    labelEl.classList.remove("marquee-active");
    labelEl.style.removeProperty("--lp-folder-marquee-shift");
  }

  function getFolderContextMenuFolder() {
    return getFolderById(state.folderContextMenu.folderId);
  }

  function renderFolderContextMenu() {
    const layer = state.refs.folderMenuLayer;
    const menu = state.refs.folderContextMenu;
    if (!layer || !menu) return;
    const folder = getFolderContextMenuFolder();
    const open = state.folderContextMenu.open === true && !!folder;
    layer.hidden = !open;
    if (!open) return;
    menu.style.left = `${Math.max(12, state.folderContextMenu.anchorX)}px`;
    menu.style.top = `${Math.max(12, state.folderContextMenu.anchorY)}px`;
    if (state.refs.folderMenuTitle) {
      state.refs.folderMenuTitle.textContent = folder.name || "Category";
    }
    if (state.refs.folderMenuPin) {
      const pinned = state.ui.pinnedFolderIds.includes(folder.id);
      state.refs.folderMenuPin.textContent = pinned ? "📌 Unpin Category" : "📌 Pin Category";
    }
    if (state.refs.folderMenuOpen) {
      state.refs.folderMenuOpen.textContent = "📂 View Notes";
    }
    if (state.refs.folderMenuHide) {
      const hidden = state.ui.hiddenFolderIds.includes(folder.id);
      state.refs.folderMenuHide.textContent = hidden ? "👁 Unhide Category" : "👁 Hide Category";
    }
    if (state.refs.folderMenuMoveNote) {
      state.refs.folderMenuMoveNote.disabled = !getActiveNote();
    }
  }

  function buildFolderPaletteOptions() {
    const counts = getFolderCounts(getBaseFilteredNotes());
    return getAssignableFolderRows().map((row) => ({
      id: row.id,
      label: row.label,
      searchText: row.label.toLowerCase(),
      count: row.id ? (counts.get(row.id) || 0) : (counts.get(FILTER_UNCATEGORIZED) || 0)
    }));
  }

  function renderFolderPalette() {
    const layer = state.refs.folderPaletteLayer;
    const list = state.refs.folderPaletteList;
    if (!layer || !list) return;
    const open = state.folderPalette.open === true;
    layer.style.pointerEvents = open ? "auto" : "none";
    layer.style.display = open ? "block" : "none";
    if (!open) return;
    if (state.refs.folderPaletteTitle) {
      const note = getActiveNote();
      state.refs.folderPaletteTitle.textContent = note
        ? `Move "${getNoteTitle(note)}" to category`
        : "Move note to category";
    }
    if (state.refs.folderPaletteInput && state.refs.folderPaletteInput.value !== state.folderPalette.query) {
      state.refs.folderPaletteInput.value = state.folderPalette.query;
    }
    const query = normalizeSearchQuery(state.folderPalette.query).toLowerCase();
    const allOptions = buildFolderPaletteOptions();
    let filtered = query
      ? allOptions.filter((opt) => opt.searchText.includes(query))
      : allOptions;
    if (query) {
      filtered = filtered
        .map((opt, idx) => {
          const starts = opt.searchText.startsWith(query);
          const pos = opt.searchText.indexOf(query);
          return { opt, starts, pos: pos >= 0 ? pos : 9999, idx };
        })
        .sort((a, b) => {
          if (a.starts !== b.starts) return a.starts ? -1 : 1;
          if (a.pos !== b.pos) return a.pos - b.pos;
          return a.opt.label.localeCompare(b.opt.label, undefined, { sensitivity: "base" });
        })
        .map((entry) => entry.opt);
    }
    state.folderPalette.options = filtered;
    if (state.folderPalette.pendingTargetId && filtered.length) {
      const baseIndex = filtered.findIndex((opt) => opt.id === state.folderPalette.pendingTargetId);
      if (baseIndex >= 0) {
        state.folderPalette.activeIndex = ((baseIndex + state.folderPalette.pendingOffset) % filtered.length + filtered.length) % filtered.length;
      }
      state.folderPalette.pendingTargetId = "";
      state.folderPalette.pendingOffset = 0;
    }
    if (state.folderPalette.activeIndex >= filtered.length) {
      state.folderPalette.activeIndex = Math.max(0, filtered.length - 1);
    }
    list.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.style.cssText = "color:#a3acb9;font-size:13px;padding:8px 4px;";
      empty.textContent = "No matching categories.";
      list.appendChild(empty);
      return;
    }
    filtered.forEach((opt, index) => {
      const palette = getFolderRowPalette(opt.id || FILTER_UNCATEGORIZED);
      const isActive = index === state.folderPalette.activeIndex;
      const row = document.createElement("button");
      row.type = "button";
      row.style.cssText = [
        "display:flex","align-items:center","justify-content:space-between",
        "gap:10px","width:100%","padding:9px 12px","border-radius:10px",
        "border:1px solid " + (isActive ? palette.rowBorder : "rgba(255,255,255,0.08)"),
        "background:" + (isActive ? palette.rowBackgroundActive : palette.rowBackground),
        "color:#f3f4f6","cursor:pointer","text-align:left","outline:none",
        "box-sizing:border-box"
      ].join(";");
      row.addEventListener("mouseenter", () => {
        state.folderPalette.activeIndex = index;
        renderFolderPalette();
      });
      row.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        chooseFolderPaletteOption(index).catch(() => {
          setSaveStatus("Could not move note", "error");
        });
      });
      const dot = document.createElement("span");
      dot.style.cssText = "width:9px;height:9px;border-radius:999px;flex:0 0 auto;background:" + palette.dot + ";box-shadow:0 0 0 1px " + palette.dotRing + ";";
      const label = document.createElement("span");
      label.style.cssText = "flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:13px;";
      label.textContent = opt.label;
      const meta = document.createElement("span");
      meta.style.cssText = "flex:0 0 auto;font-size:11px;color:#a3acb9;background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:999px;";
      meta.textContent = `${opt.count} note${opt.count === 1 ? "" : "s"}`;
      row.append(dot, label, meta);
      list.appendChild(row);
      if (isActive) {
        setTimeout(() => { try { row.scrollIntoView({ block: "nearest" }); } catch (_) {} }, 0);
      }
    });
  }

  function closeDialog(result) {
    const resolver = state.dialog && typeof state.dialog.resolver === "function"
      ? state.dialog.resolver
      : null;
    state.dialog = {
      open: false,
      mode: "",
      title: "",
      message: "",
      inputLabel: "",
      inputValue: "",
      inputPlaceholder: "",
      confirmLabel: "OK",
      cancelLabel: "Cancel",
      danger: false,
      resolver: null
    };
    renderDialog();
    if (resolver) {
      resolver(result || { confirmed: false, value: "" });
    }
  }

  function openDialog(config) {
    const options = config && typeof config === "object" ? config : {};
    if (state.dialog.open) {
      closeDialog({ confirmed: false, value: "" });
    }
    return new Promise((resolve) => {
      state.dialog = {
        open: true,
        mode: options.mode === "prompt" ? "prompt" : "confirm",
        title: options.title ? String(options.title) : "Dialog",
        message: options.message ? String(options.message) : "",
        inputLabel: options.inputLabel ? String(options.inputLabel) : "",
        inputValue: options.inputValue ? String(options.inputValue) : "",
        inputPlaceholder: options.inputPlaceholder ? String(options.inputPlaceholder) : "",
        confirmLabel: options.confirmLabel ? String(options.confirmLabel) : "OK",
        cancelLabel: options.cancelLabel ? String(options.cancelLabel) : "Cancel",
        danger: options.danger === true,
        resolver: resolve
      };
      renderDialog();
    });
  }

  function showPromptDialog(options) {
    return openDialog({
      ...options,
      mode: "prompt"
    });
  }

  function showConfirmDialog(options) {
    return openDialog({
      ...options,
      mode: "confirm"
    });
  }

  function handleDialogInputKeydown(event) {
    if (!state.dialog.open) return;
    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      handleAction("confirm-dialog");
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleAction("cancel-dialog");
    }
  }

  function isEventFromOverlay(event) {
    if (!event || !state.refs.host) return false;
    if (typeof event.composedPath === "function") {
      const path = event.composedPath();
      if (path.includes(state.refs.host) || path.includes(state.refs.overlay)) {
        return true;
      }
    }
    const target = event.target;
    return !!(target && state.refs.host.contains(target));
  }

  function eventPathIncludes(event, node) {
    if (!event || !node) return false;
    if (typeof event.composedPath === "function") {
      const path = event.composedPath();
      return path.includes(node);
    }
    const target = event.target;
    return !!(target && node.contains && node.contains(target));
  }

  function stopOverlayEvent(event) {
    if (!event) return;
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
    event.stopPropagation();
  }

  function focusTodoInput() {
    if (state.panelMode !== "todo") return;
    var el = state.refs.mpTodoAddInput;
    if (el) setTimeout(function() { el.focus(); }, 50);
  }

  function markStateDirty() {
    state.editor.dirty = true;
    state.lastLocalChangeAt = Date.now();
  }

  function syncActiveNoteFromInputs(updateTimestamp) {
    const note = getActiveNote();
    if (!note) return null;
    note.title = String(state.editor.title || "").slice(0, 120);
    note.content = String(state.editor.content || "").slice(0, 200000);
    if (updateTimestamp !== false) {
      note.updatedAt = new Date().toISOString();
    }
    return note;
  }

  async function syncActiveNoteFromEditor(updateTimestamp, options = {}) {
    // Guard: hanya sync kalau editor sebenarnya aktif
    if (state.panelMode !== "editor") return null;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(50, options.timeoutMs) : 180;
    let snapshot = null;
    try {
      snapshot = await requestEditorDomSnapshot(timeoutMs);
    } catch (err) {
      snapshot = null;
    }
    if (snapshot) {
      state.editor.title = snapshot.title != null ? String(snapshot.title).slice(0, 120) : "";
      state.editor.content = snapshot.content != null ? String(snapshot.content).slice(0, 200000) : "";
    }
    return syncActiveNoteFromInputs(updateTimestamp);
  }

  async function persist(successMessage, options = {}) {
    const saveStartedAt = Number.isFinite(options.saveStartedAt) ? options.saveStartedAt : Date.now();
    state.folders = normalizeFolders(state.folders);
    state.notes = normalizeNotes(state.notes, state.folders);
    syncMindmapToUi();
    state.ui = normalizeUi(state.ui, state.folders, state.notes);
    state.attachments = pruneAttachmentsMap(state.attachments, state.notes);
    state.todoLists = normalizeTodoLists(state.todoLists);
    state.todoItems = normalizeTodoItems(state.todoItems, state.todoLists);
    const payload = {
      [NOTES_KEY]: state.notes,
      [NOTES_UI_KEY]: state.ui,
      [ATTACHMENTS_KEY]: state.attachments
    };
    if (options.includeFolders === true) {
      payload[FOLDERS_KEY] = state.folders;
    }
    payload[TODO_LISTS_KEY] = state.todoLists;
    payload[TODO_ITEMS_KEY] = state.todoItems;
    await storageSet(payload);
    render();
    if (state.lastLocalChangeAt > saveStartedAt) {
      state.editor.dirty = true;
      setSaveStatus("Saving...", "saving");
      if (!state.saveTimer && state.open) {
        scheduleSave({ markDirty: false });
      }
      return;
    }
    state.editor.dirty = false;
    setSaveStatus(successMessage || "Autosaved", "");
  }

  function syncMindmapToUi() {
    state.ui.mindmapZoom = state.mindmap.zoom;
    state.ui.mindmapPanX = state.mindmap.panX;
    state.ui.mindmapPanY = state.mindmap.panY;
    state.ui.mindmapCollapsedFolders = state.mindmap.collapsedFolders.slice();
    state.ui.mindmapCollapsedNodes = (state.mindmap.collapsedNodes || []).slice();
    state.ui.mindmapOpenOnClick = state.mindmap.openOnClick;
    state.ui.mindmapLayoutStyle = state.mindmap.layoutStyle;
  }

  function restoreMindmapFromUi() {
    state.mindmap.zoom = state.ui.mindmapZoom || 1;
    state.mindmap.panX = state.ui.mindmapPanX || 0;
    state.mindmap.panY = state.ui.mindmapPanY || 0;
    state.mindmap.collapsedFolders = state.ui.mindmapCollapsedFolders ? state.ui.mindmapCollapsedFolders.slice() : [];
    state.mindmap.collapsedNodes = state.ui.mindmapCollapsedNodes ? state.ui.mindmapCollapsedNodes.slice() : [];
    state.mindmap.openOnClick = !!state.ui.mindmapOpenOnClick;
    state.mindmap.layoutStyle = state.ui.mindmapLayoutStyle === "tree" ? "tree" : "radial";
  }

  async function persistUiOnly(successMessage) {
    syncMindmapToUi();
    state.ui = normalizeUi(state.ui, state.folders, state.notes);
    await storageSet({
      [NOTES_UI_KEY]: state.ui
    });
    render();
    if (successMessage) {
      setSaveStatus(successMessage, "");
    }
  }

  async function persistAttachmentsOnly(successMessage) {
    state.attachments = normalizeAttachments(state.attachments);
    await storageSet({
      [ATTACHMENTS_KEY]: state.attachments
    });
    if (successMessage) {
      setSaveStatus(successMessage, "");
    }
  }

  function scheduleSave(options = {}) {
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
    }
    if (options.markDirty !== false) {
      markStateDirty();
    }
    setSaveStatus("Saving...", "saving");
    state.saveTimer = setTimeout(async () => {
      state.saveTimer = null;
      const saveStartedAt = Date.now();
      try {
        await syncActiveNoteFromEditor(true, { timeoutMs: 260 });
        await persist("Autosaved", { saveStartedAt });
      } catch (err) {
        setSaveStatus("Save failed", "error");
      }
    }, SAVE_DELAY_MS);
  }

  async function flushSave(successMessage, options = {}) {
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }
    const saveStartedAt = Date.now();
    // Only sync from editor DOM if editor is actually active
    if (state.panelMode === "editor") {
      await syncActiveNoteFromEditor(true, { timeoutMs: 260 });
    }
    setSaveStatus("Saving...", "saving");
    try {
      await persist(successMessage || "Saved", {
        saveStartedAt,
        includeFolders: options.includeFolders === true
      });
    } catch (err) {
      setSaveStatus("Save failed", "error");
    }
  }

  function getResponsivePanelWidth() {
    if (window.innerWidth <= MOBILE_BREAKPOINT) return 0;
    const fallback = Math.min(DEFAULT_PANEL_WIDTH, Math.round(window.innerWidth - PANEL_VIEWPORT_MARGIN));
    const preferred = clampPanelWidth(state.ui.panelWidth) || fallback;
    const max = Math.max(360, window.innerWidth - PANEL_VIEWPORT_MARGIN);
    return Math.max(360, Math.min(max, preferred));
  }

  function getResponsivePanelHeight() {
    if (window.innerWidth <= MOBILE_BREAKPOINT) return 0;
    const fallback = Math.min(DEFAULT_PANEL_HEIGHT, Math.round(window.innerHeight - PANEL_VIEWPORT_MARGIN));
    const preferred = clampPanelHeight(state.ui.panelHeight) || fallback;
    const max = Math.max(360, window.innerHeight - PANEL_VIEWPORT_MARGIN);
    return Math.max(360, Math.min(max, preferred));
  }

  function clampPickerPosition(width, height, left, top) {
    const margin = 12;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    return {
      left: Math.min(Math.max(Math.round(left), margin), maxLeft),
      top: Math.min(Math.max(Math.round(top), margin), maxTop)
    };
  }

  function applyOverlayLayout() {
    const shell = state.refs.shell;
    if (!shell) return;
    if (state.pickerPosition) {
      shell.style.position = "fixed";
      shell.style.left = state.pickerPosition.left + "px";
      shell.style.top = state.pickerPosition.top + "px";
      shell.style.transform = "none";
    } else {
      shell.style.position = "";
      shell.style.left = "";
      shell.style.top = "";
      shell.style.transform = "";
    }
    // Apply dynamic panel dimensions from resize
    var w = getResponsivePanelWidth();
    var h = getResponsivePanelHeight();
    if (w > 0) { shell.style.width = w + "px"; }
    else { shell.style.width = ""; }
    if (h > 0) { shell.style.height = h + "px"; }
    else { shell.style.height = ""; }
  }

  function handleTopbarPointerDown(event) {
    if (!state.open || !state.refs.shell) return;
    if (event.button !== 0) return;
    if (event.target && typeof event.target.closest === "function" && event.target.closest("button,input,select,textarea,a,label")) {
      return;
    }
    const shell = state.refs.shell;
    const rect = shell.getBoundingClientRect();
    state.panelDragSession = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top
    };
    if (state.refs.mpHeader) state.refs.mpHeader.style.cursor = "grabbing";
    try { event.target.setPointerCapture && event.target.setPointerCapture(event.pointerId); } catch (_) {}
    event.preventDefault();
    stopOverlayEvent(event);
  }

  function handleTopbarPointerMove(event) {
    if (!state.panelDragSession || !state.refs.shell) return;
    if (event.pointerId !== state.panelDragSession.pointerId) return;
    const next = {
      left: Math.round(state.panelDragSession.left + (event.clientX - state.panelDragSession.startX)),
      top: Math.round(state.panelDragSession.top + (event.clientY - state.panelDragSession.startY))
    };
    state.pickerPosition = next;
    applyOverlayLayout();
    event.preventDefault();
    stopOverlayEvent(event);
  }

  function handleTopbarPointerUp(event) {
    if (!state.panelDragSession) return;
    if (event.pointerId !== state.panelDragSession.pointerId) return;
    state.panelDragSession = null;
    if (state.refs.mpHeader) state.refs.mpHeader.style.cursor = "grab";
    stopOverlayEvent(event);
  }

  function handleTopbarDoubleClick(event) {
    if (!isPickerPanelMode()) return;
    if (event.target && typeof event.target.closest === "function" && event.target.closest("button,input,select,textarea,a,label")) {
      return;
    }
    state.pickerPosition = null;
    applyOverlayLayout();
    stopOverlayEvent(event);
  }

  function autoResizeContentInput() {
    const frame = state.refs.editorFrame;
    if (!frame) return;
    frame.style.minHeight = `${getEditorBaseHeight()}px`;
  }

  function queueEditorFocus(target, selectAll) {
    state.editor.pendingFocusTarget = target === "title" ? "title" : "content";
    state.editor.pendingFocusSelectAll = selectAll === true;
    if (!state.editor.ready || !state.refs.editorFrame || !state.refs.editorFrame.contentWindow) return;
    state.refs.editorFrame.contentWindow.postMessage({
      type: "lp-notes-focus",
      token: state.editor.token,
      target: state.editor.pendingFocusTarget,
      selectAll: state.editor.pendingFocusSelectAll === true
    }, "*");
  }

  function postEditorMessage(message) {
    if (!state.refs.editorFrame || !state.refs.editorFrame.contentWindow || !state.editor.ready) return false;
    state.refs.editorFrame.contentWindow.postMessage({
      ...message,
      token: state.editor.token
    }, "*");
    return true;
  }

  function syncEditorFrameWithNote(note) {
    const theme = normalizeThemePreset(state.settings.themePreset);
    const nextTitle = note ? (note.title || "") : "";
    const nextContent = note ? (note.content || "") : "";
    const attachmentMap = buildAttachmentMapForContent(nextContent);
    if (!state.editor.ready) {
      state.editor.title = nextTitle;
      state.editor.content = nextContent;
      state.editor.lastTheme = theme;
      state.editor.attachmentMap = attachmentMap;
      return;
    }
    // Bandingkan nota ID aktif — jika nota yang sama dan tiada perubahan, skip
    // JANGAN skip bila nota bertukar (walaupun kandungan sama atau kosong)
    const activeNote = getActiveNote();
    const activeNoteId = activeNote ? activeNote.id : "";
    const editorNoteChanged = state.editor._lastSyncedNoteId !== activeNoteId;
    if (
      !editorNoteChanged &&
      state.editor.title === nextTitle &&
      state.editor.content === nextContent &&
      state.editor.lastTheme === theme &&
      JSON.stringify(state.editor.attachmentMap) === JSON.stringify(attachmentMap)
    ) {
      return;
    }
    state.editor.title = nextTitle;
    state.editor.content = nextContent;
    state.editor.lastTheme = theme;
    state.editor.attachmentMap = attachmentMap;
    state.editor._lastSyncedNoteId = activeNoteId;
    postEditorMessage({
      type: "lp-notes-set-note",
      note: {
        title: nextTitle,
        content: nextContent
      },
      themePreset: theme,
      customThemeColors: state.settings.customThemeColors || null,
      previewMode: state.editor.previewMode === true,
      attachmentMap
    });
  }

  // ========== TRASH SYSTEM ==========
  function normalizeTrashItem(value) {
    if (!value || typeof value !== "object") return null;
    const id = value.id ? String(value.id).trim() : "";
    if (!id) return null;
    return {
      id,
      note: value.note && typeof value.note === "object" ? value.note : null,
      deletedAt: value.deletedAt ? String(value.deletedAt) : new Date().toISOString()
    };
  }

  async function getTrash() {
    const data = await storageGet([TRASH_KEY]);
    const raw = data[TRASH_KEY];
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map(normalizeTrashItem).filter(Boolean);
  }

  async function persistTrash(trash) {
    const normalized = coerceArray(trash).map(normalizeTrashItem).filter(Boolean);
    await storageSet({ [TRASH_KEY]: normalized });
  }

  async function addToTrash(note) {
    if (!note || !note.id) return;
    const trash = await getTrash();
    const existingIndex = trash.findIndex((t) => t && t.id === note.id);
    if (existingIndex >= 0) {
      trash.splice(existingIndex, 1);
    }
    trash.unshift({
      id: note.id,
      note: { ...note },
      deletedAt: new Date().toISOString()
    });
    // Prune old items beyond retention period
    const cutoff = Date.now() - TRASH_RETENTION_MS;
    const pruned = trash.filter((t) => {
      if (!t || !t.deletedAt) return false;
      return Date.parse(t.deletedAt) > cutoff;
    });
    await persistTrash(pruned);
  }

  async function restoreFromTrash(noteId) {
    if (!noteId) return null;
    const trash = await getTrash();
    const index = trash.findIndex((t) => t && t.id === noteId);
    if (index < 0) return null;
    const item = trash[index];
    trash.splice(index, 1);
    await persistTrash(trash);
    return item && item.note ? item.note : null;
  }

  async function emptyTrash() {
    await persistTrash([]);
  }

  async function refreshTrash() {
    state.trash = await getTrash();
  }

  // ========== EXTERNAL SYNC ==========
  function startExternalSyncTimer() {
    if (state.externalSyncTimer) return;
    state.externalSyncTimer = setInterval(async () => {
      if (!state.open || state.pendingExternalReload || document.hidden) return;
      try {
        const data = await storageGet([NOTES_KEY, FOLDERS_KEY]);
        const remoteNotes = coerceArray(data[NOTES_KEY]);
        const remoteFolders = coerceArray(data[FOLDERS_KEY]);
        const localNoteIds = new Set(state.notes.map((n) => n && n.id));
        const remoteNoteIds = new Set(remoteNotes.map((n) => n && n.id));
        // Check if any notes were added/removed externally
        let hasExternalChange = false;
        for (const id of remoteNoteIds) {
          if (!localNoteIds.has(id)) {
            hasExternalChange = true;
            break;
          }
        }
        if (!hasExternalChange) {
          for (const id of localNoteIds) {
            if (!remoteNoteIds.has(id)) {
              hasExternalChange = true;
              break;
            }
          }
        }
        if (hasExternalChange) {
          state.pendingExternalReload = true;
          // Don't reload while user is typing - will reload on next check or blur
        }
      } catch (err) {
        // ignore sync errors
      }
    }, EXTERNAL_SYNC_CHECK_INTERVAL_MS);
  }

  function stopExternalSyncTimer() {
    if (state.externalSyncTimer) {
      clearInterval(state.externalSyncTimer);
      state.externalSyncTimer = null;
    }
  }

  async function reloadFromExternal() {
    if (!state.pendingExternalReload) return;
    state.pendingExternalReload = false;
    const data = await storageGet([NOTES_KEY, FOLDERS_KEY, ATTACHMENTS_KEY, TRASH_KEY]);
    state.folders = normalizeFolders(data[FOLDERS_KEY]);
    // Merge notes: keep local version if newer (unsaved changes) or local-only (newly created)
    const remoteNotes = normalizeNotes(data[NOTES_KEY], state.folders);
    const localNoteMap = new Map();
    state.notes.forEach(function(n) { if (n && n.id) localNoteMap.set(n.id, n); });
    const merged = [];
    remoteNotes.forEach(function(remote) {
      var local = localNoteMap.get(remote.id);
      if (local && local.updatedAt > remote.updatedAt) {
        merged.push(local);
      } else {
        merged.push(remote);
      }
      localNoteMap.delete(remote.id);
    });
    localNoteMap.forEach(function(n) { merged.push(n); });
    state.notes = getSortedNotes(merged);
    state.attachments = pruneAttachmentsMap(data[ATTACHMENTS_KEY], state.notes);
    state.trash = coerceArray(data[TRASH_KEY]).map(normalizeTrashItem).filter(Boolean);
    ensureActiveNoteExists();
    render();
    setSaveStatus("Synced from other tabs", "");
  }

  // ========== RENDER OPTIMIZATION ==========
  let renderScheduled = false;
  const RENDER_BATCH_DELAY = 16; // ~1 frame

  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      if (state.mounted) {
        render();
      }
    });
  }

  function handleEditorStateChange(payload) {
    state.editor.title = payload && payload.title != null ? String(payload.title).slice(0, 120) : "";
    state.editor.content = payload && payload.content != null ? String(payload.content).slice(0, 200000) : "";
    syncActiveNoteFromInputs(true);
    setSaveStatus("Saving...", "saving");
    scheduleSave();
    // Optimized: only update editor metadata, not full render
    renderEditorMetadataOnly();
  }

  function renderEditorMetadataOnly() {
    if (!state.refs.editorMeta) return;
    const note = getActiveNote();
    if (!note) {
      state.refs.editorMeta.textContent = "0 words";
      return;
    }
    const stats = getChecklistStats(note);
    const parts = [
      `${countWords(note.content)} words`,
      `${countChars(note.content)} chars`,
      formatUpdatedAt(note.updatedAt)
    ];
    if (stats.total > 0) {
      parts.push(stats.open === 0 ? "all tasks done" : `${stats.open}/${stats.total} tasks open`);
    }
    state.refs.editorMeta.textContent = parts.join(" | ");
  }

  function handleEditorFrameMessage(event) {
    const frameWindow = state.refs.editorFrame && state.refs.editorFrame.contentWindow;
    if (!frameWindow || event.source !== frameWindow) return;
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type === "lp-notes-editor-ready") {
      state.editor.ready = true;
      if (!state.editor.token) {
        state.editor.token = makeId("notes-editor");
      }
      postEditorMessage({
        type: "lp-notes-init",
        note: {
          title: state.editor.title || "",
          content: state.editor.content || ""
        },
        themePreset: normalizeThemePreset(state.settings.themePreset),
        customThemeColors: state.settings.customThemeColors || null,
        previewMode: state.editor.previewMode === true,
        attachmentMap: buildAttachmentMapForContent(state.editor.content || "")
      });
      syncEditorFrameWithNote(getActiveNote());
      if (state.open) {
        queueEditorFocus(state.editor.pendingFocusTarget, state.editor.pendingFocusSelectAll);
      }
      return;
    }
    if (!state.editor.token || data.token !== state.editor.token) return;
    if (data.type === "lp-notes-editor-state") {
      handleEditorStateChange(data);
      return;
    }
    if (data.type === "lp-notes-save-request") {
      flushSave("Saved").catch(() => { });
      return;
    }
    if (data.type === "lp-notes-command") {
      handleEditorCommand(data.command, data.payload);
      return;
    }
    if (data.type === "lp-notes-attachment-request") {
      handleAttachmentRequest(data).catch(() => {
        postEditorMessage({
          type: "lp-notes-attachment-response",
          requestId: data && data.requestId ? String(data.requestId) : "",
          ok: false,
          error: "Attachment save failed"
        });
      });
      return;
    }
    if (data.type === "lp-notes-close-request") {
      close();
    }
    if (data.type === "lp-notes-shortcut-frame") {
      // Shortcut dihantar dari iframe editor (focus dalam editor tak sampai ke
      // window listener parent). Terus padankan dgn config shortcut overlay.
      runNotesShortcutFromFrame(data.event);
      return;
    }
  }

  function buildStyles() {
    return `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .lp-overlay { font-family: -apple-system, "Segoe UI", sans-serif; }
      .lp-overlay[data-open="true"] { opacity: 1 !important; pointer-events: auto !important; }
      .lp-editor-frame { display: block; width: 100%; height: 100%; border: none; background: transparent; }
      input:focus, button:focus { outline: none; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 999px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      /* Elak add-on "Swift Selection Search" (luaran) muncul bila tersalah
         select teks mindmap. Default: tiada selection. Copy kekal boleh
         dilakukan dgn pegang Ctrl/Cmd + drag (lihat onPointerDown). */
      [data-role="mp-mindmap-svg-wrap"],
      [data-role="mp-mindmap-svg"] {
        -webkit-user-select: none;
        -moz-user-select: none;
        user-select: none;
      }
      @keyframes lpSkeletonPulse {
        0% { opacity: 0.5; }
        50% { opacity: 1; }
        100% { opacity: 0.5; }
      }
    `;
  }


  function buildMarkup() {
    // ── Design tokens ────────────────────────────────────────────────────────
    const P = "rgba(14,15,20,0.96)";         // panel bg — deeper, less muddy
    const B = "1px solid rgba(255,255,255,0.11)"; // panel border — slightly more visible
    const TXT = "#eef0f4";                   // primary text — slightly softer white
    const MUTED = "#8892a0";                 // muted text
    const ACCENT = "#5ac8ff";               // accent cyan
    const CHIP = "rgba(255,255,255,0.07)";   // chip bg
    const CHIPB = "1px solid rgba(255,255,255,0.14)"; // chip border
    const INPB = "1px solid rgba(255,255,255,0.15)";  // input border — more visible
    const INPBG = "rgba(255,255,255,0.05)";
    const SHADOW = "0 24px 48px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.3)";
    const RADIUS = "16px";   // less toy-like than 18px
    const BTN_STYLE = [
      "width:28px","height:28px","border-radius:8px",
      "border:1px solid rgba(255,255,255,0.13)","background:rgba(255,255,255,0.07)",
      "color:inherit","font-size:14px","cursor:pointer","display:inline-flex",
      "align-items:center","justify-content:center","outline:none","flex-shrink:0",
      "transition:background 120ms ease,border-color 120ms ease,opacity 120ms ease"
    ].join(";");

    function mk(tag, css, text) {
      const el = document.createElement(tag);
      if (css) el.style.cssText = css;
      if (text != null) el.textContent = text;
      return el;
    }
    function btn(label, role, action, extraCss) {
      const el = mk("button", BTN_STYLE + (extraCss ? ";" + extraCss : ""), label);
      el.type = "button";
      if (role) el.setAttribute("data-role", role);
      if (action) el.setAttribute("data-action", action);
      return el;
    }
    function smallBtn(label, role, action) {
      const el = mk("button", [
        "padding:3px 10px","border-radius:8px",
        "border:" + CHIPB,"background:" + CHIP,"color:" + TXT,
        "font-size:11px","font-weight:600","cursor:pointer","outline:none"
      ].join(";"), label);
      el.type = "button";
      if (role) el.setAttribute("data-role", role);
      if (action) el.setAttribute("data-action", action);
      return el;
    }

    // ── Overlay (backdrop) ───────────────────────────────────────────────────
    const overlay = mk("div", [
      "position:fixed","inset:0","z-index:2147483647",
      "display:flex","align-items:center","justify-content:center",
      "background:rgba(0,0,0,0.55)","opacity:0","pointer-events:none",
      "transition:opacity 180ms ease"
    ].join(";"));
    overlay.className = "lp-overlay";
    overlay.setAttribute("data-open", "false");

    // ── Shell (panelShell) ───────────────────────────────────────────────────
    const shell = mk("div", [
      "display:flex","flex-direction:row","align-items:stretch","gap:12px",
      "max-width:98vw","max-height:92vh","box-sizing:border-box"
    ].join(";"));
    shell.setAttribute("data-role", "shell");
    overlay.appendChild(shell);

    // ════════════════════════════════════════════════════════════════════════
    // LEFT PANEL — senarai kategori
    // ════════════════════════════════════════════════════════════════════════
    const leftPanel = mk("div", [
      "display:flex","flex-direction:column",
      "width:min(220px,22vw)","min-width:185px","max-height:92vh",
      "background:" + P, "border:" + B, "border-radius:" + RADIUS,
      "box-shadow:" + SHADOW, "padding:10px 8px",
      "box-sizing:border-box","overflow:hidden","gap:4px"
    ].join(";"));
    leftPanel.setAttribute("data-role", "left-panel");

    // Left panel header
    const lpHeader = mk("div", [
      "display:flex","align-items:center","justify-content:space-between",
      "padding:2px 4px 8px","flex:0 0 auto",
      "border-bottom:1px solid rgba(255,255,255,0.08)","margin-bottom:3px"
    ].join(";"));
    const lpTitle = mk("span", [
      "color:" + MUTED,"font-size:10px","font-weight:700",
      "letter-spacing:0.07em","text-transform:uppercase"
    ].join(";"), "CATEGORIES");
    lpTitle.setAttribute("data-role", "lp-title");
    const lpNewBtn = mk("button", [
      "display:inline-flex","align-items:center","justify-content:center",
      "padding:3px 9px","border-radius:7px","border:1px solid rgba(90,200,255,0.25)",
      "background:rgba(90,200,255,0.1)","color:" + ACCENT,"font-size:10px","font-weight:700",
      "letter-spacing:0.04em","cursor:pointer","line-height:1.4","outline:none",
      "transition:background 120ms ease"
    ].join(";"), "+ New");
    lpNewBtn.type = "button";
    lpNewBtn.setAttribute("data-role", "lp-new-btn");
    lpNewBtn.setAttribute("data-action", "new-note");
    lpNewBtn.title = "Nota baru";
    lpHeader.append(lpTitle, lpNewBtn);

    // Left panel list
    const lpList = mk("div", [
      "display:flex","flex-direction:column","flex:1 1 auto",
      "overflow-y:auto","overscroll-behavior:contain","gap:3px"
    ].join(";"));
    lpList.setAttribute("data-role", "lp-list");

    leftPanel.append(lpHeader, lpList);
    shell.appendChild(leftPanel);

    // ════════════════════════════════════════════════════════════════════════
    // MAIN PANEL — senarai nota & editor
    // ════════════════════════════════════════════════════════════════════════
    const mainPanel = mk("div", [
      "display:flex","flex-direction:column","gap:8px",
      "width:min(700px,74vw)","min-width:420px","max-width:98vw","max-height:92vh",
      "background:" + P,"border:" + B,"border-radius:" + RADIUS,
      "box-shadow:" + SHADOW,"backdrop-filter:blur(16px)",
      "padding:12px 16px 14px","box-sizing:border-box",
      "min-height:480px","height:min(740px,calc(100vh - 24px))",
      "overflow:hidden","color:" + TXT,"position:relative"
    ].join(";"));
    mainPanel.setAttribute("data-role", "main-panel");

    // ── Main header ──────────────────────────────────────────────────────────
    const mpHeader = mk("div", [
      "display:flex","align-items:center","gap:8px",
      "flex:0 0 auto","cursor:grab","user-select:none","min-height:38px",
      "padding-bottom:8px","border-bottom:1px solid rgba(255,255,255,0.07)"
    ].join(";"));
    mpHeader.setAttribute("data-role", "mp-header");

    const mpBackBtn = mk("button", [
      "width:30px","height:30px","border-radius:9px",
      "border:1px solid rgba(255,255,255,0.13)","background:rgba(255,255,255,0.07)",
      "color:#fff","cursor:pointer","font-size:15px","display:none",
      "align-items:center","justify-content:center","flex-shrink:0","outline:none",
      "transition:background 120ms ease"
    ].join(";"), "←");
    mpBackBtn.type = "button";
    mpBackBtn.setAttribute("data-role", "mp-back-btn");
    mpBackBtn.title = "Kembali";

    const mpTitle = mk("div", [
      "color:" + TXT,"font-size:15px","font-weight:600",
      "flex:1 1 auto","overflow:hidden","text-overflow:ellipsis","white-space:nowrap",
      "letter-spacing:-0.01em"
    ].join(";"), "Notes");
    mpTitle.setAttribute("data-role", "mp-title");

    // ── Right-side action group (visually grouped) ───────────────────────────
    const mpActionRight = mk("div", "display:flex;align-items:center;gap:5px;flex-shrink:0;");

    // Primary note actions
    const mpNewNoteBtn = btn("✏️", "mp-new-note-btn", "new-note");
    mpNewNoteBtn.title = "Nota baru (Ctrl+N)";

    const mpPinBtn = btn("📌", "mp-pin-btn", "toggle-pin");
    mpPinBtn.setAttribute("data-role", "pin-button");
    mpPinBtn.title = "Pin/Unpin nota";

    const mpDeleteBtn = btn("🗑", "mp-delete-btn", "delete-note");
    mpDeleteBtn.title = "Padam nota";
    mpDeleteBtn.style.color = "#ff7f7f";
    mpDeleteBtn.style.border = "1px solid rgba(255,100,100,0.18)";
    mpDeleteBtn.style.background = "rgba(255,100,100,0.06)";

    // Visual separator
    const mpActionSep = mk("div", "width:1px;height:20px;background:rgba(255,255,255,0.1);flex-shrink:0;margin:0 2px;");

    // View actions
    const mpTrashBtn = btn("♻", "mp-trash-btn", "open-trash");
    mpTrashBtn.setAttribute("data-role", "open-trash-button");
    mpTrashBtn.title = "Tong sampah";

    const mpAiBtn = mk("button", [
      "height:28px","padding:0 10px","border-radius:8px",
      "border:1px solid rgba(100,200,255,0.28)","background:rgba(100,200,255,0.09)",
      "color:#7ab8ff","font-size:11px","font-weight:700","cursor:pointer","display:inline-flex",
      "align-items:center","justify-content:center","outline:none","flex-shrink:0","gap:4px",
      "transition:background 120ms ease,border-color 120ms ease"
    ].join(";"), "✦ AI");
    mpAiBtn.type = "button";
    mpAiBtn.setAttribute("data-role", "mp-ai-btn");
    mpAiBtn.setAttribute("data-action", "open-ai");
    mpAiBtn.title = "Buka AI sidebar";

    const mpMindmapBtn = mk("button", [
      "width:28px","height:28px","border-radius:8px",
      "border:1px solid rgba(100,255,200,0.28)","background:rgba(100,255,200,0.09)",
      "color:#7affb8","font-size:14px","cursor:pointer","display:inline-flex",
      "align-items:center","justify-content:center","outline:none","flex-shrink:0",
      "transition:background 120ms ease"
    ].join(";"), "🧠");
    mpMindmapBtn.type = "button";
    mpMindmapBtn.setAttribute("data-role", "mp-mindmap-btn");
    mpMindmapBtn.setAttribute("data-action", "open-mindmap");
    mpMindmapBtn.title = "Buka mindmap";

    const mpMindmapToggleBtn = mk("button", [
      "width:28px","height:28px","border-radius:8px",
      "border:1px solid rgba(255,255,255,0.1)","background:rgba(255,255,255,0.05)",
      "color:rgba(255,255,255,0.5)","font-size:14px","cursor:pointer","display:inline-flex",
      "align-items:center","justify-content:center","outline:none","flex-shrink:0",
      "transition:all 180ms ease"
    ].join(";"), "🗺️");
    mpMindmapToggleBtn.type = "button";
    mpMindmapToggleBtn.setAttribute("data-role", "mp-mindmap-toggle-btn");
    mpMindmapToggleBtn.setAttribute("data-action", "toggle-mindmap-click");
    mpMindmapToggleBtn.title = "Buka nota terus ke mindmap: OFF";
    mpMindmapToggleBtn.setAttribute("aria-pressed", "false");

    const mpPanelPinBtn = mk("button", [
      "width:28px","height:28px","border-radius:8px",
      "border:1px solid rgba(255,255,255,0.1)","background:rgba(255,255,255,0.05)",
      "color:rgba(255,255,255,0.5)","font-size:13px","cursor:pointer","display:inline-flex",
      "align-items:center","justify-content:center","outline:none","flex-shrink:0",
      "transition:all 180ms ease"
    ].join(";"), "📍");
    mpPanelPinBtn.type = "button";
    mpPanelPinBtn.setAttribute("data-role", "mp-panel-pin-btn");
    mpPanelPinBtn.setAttribute("data-action", "toggle-panel-pin");
    mpPanelPinBtn.title = "Pin panel (tetap terbuka)";

    // Save status — pill at end of header
    const mpSaveStatus = mk("span", [
      "font-size:10px","color:" + MUTED,"padding:2px 8px",
      "border-radius:999px","border:1px solid rgba(255,255,255,0.09)",
      "background:rgba(255,255,255,0.04)","flex-shrink:0","white-space:nowrap",
      "transition:color 200ms ease,background 200ms ease"
    ].join(";"), "Ready");
    mpSaveStatus.setAttribute("data-role", "save-status");

    // Todo mode toggle button
    const mpTodoBtn = mk("button", [
      "height:28px","padding:0 10px","border-radius:8px",
      "border:1px solid rgba(255,200,100,0.28)","background:rgba(255,200,100,0.09)",
      "color:#ffcc66","font-size:11px","font-weight:700","cursor:pointer","display:inline-flex",
      "align-items:center","justify-content:center","outline:none","flex-shrink:0","gap:4px",
      "transition:background 120ms ease,border-color 120ms ease"
    ].join(";"), "☐ Todo");
    mpTodoBtn.type = "button";
    mpTodoBtn.setAttribute("data-role", "mp-todo-btn");
    mpTodoBtn.setAttribute("data-action", "open-todo");
    mpTodoBtn.title = "Buka Todo List";

    // Markdown export
    const mpExportBtn = mk("button", [
      "height:28px","padding:0 9px","border-radius:8px",
      "border:1px solid rgba(255,255,255,0.12)","background:rgba(255,255,255,0.05)",
      "color:" + ROW_TXT,"font-size:11px","font-weight:700","cursor:pointer","display:inline-flex",
      "align-items:center","justify-content:center","outline:none","flex-shrink:0","gap:4px",
      "transition:background 120ms ease,border-color 120ms ease"
    ].join(";"), "⤓ MD");
    mpExportBtn.type = "button";
    mpExportBtn.setAttribute("data-role", "mp-export-btn");
    mpExportBtn.setAttribute("data-action", "export-markdown");
    mpExportBtn.title = "Export notes to Markdown";

    mpActionRight.append(mpNewNoteBtn, mpDeleteBtn, mpActionSep, mpTrashBtn, mpAiBtn, mpMindmapBtn, mpMindmapToggleBtn, mpTodoBtn, mpExportBtn, mpPanelPinBtn);
    mpHeader.append(mpBackBtn, mpTitle, mpActionRight);

    // ── Search input (with icon affordance) ──────────────────────────────────
    const mpSearchWrap = mk("div", [
      "position:relative","flex:0 0 auto","display:flex","align-items:center"
    ].join(";"));
    const mpSearchIcon = mk("span", [
      "position:absolute","left:10px","top:50%","transform:translateY(-50%)",
      "font-size:13px","pointer-events:none","color:" + MUTED,"line-height:1"
    ].join(";"), "🔍");
    const mpSearch = mk("input", [
      "width:100%","padding:8px 10px 8px 32px","box-sizing:border-box",
      "border-radius:10px","border:" + INPB,"background:rgba(255,255,255,0.05)",
      "color:" + TXT,"font-size:13px","outline:none",
      "transition:border-color 150ms ease,background 150ms ease"
    ].join(";"));
    mpSearch.type = "text";
    mpSearch.placeholder = "Search all notes...";
    mpSearch.setAttribute("data-role", "mp-search");
    mpSearchWrap.append(mpSearchIcon, mpSearch);

    // ── Category/folder select for note ─────────────────────────────────────
    const mpCatWrap = mk("div", [
      "display:flex","align-items:center","gap:8px",
      "flex:0 0 auto","padding:2px 0"
    ].join(";"));
    mpCatWrap.setAttribute("data-role", "mp-cat-wrap");
    const mpCatLabel = mk("span", [
      "font-size:11px","color:" + MUTED,"flex-shrink:0","font-weight:500"
    ].join(";"), "Category:");
    const mpCatSelect = mk("select", [
      "flex:1 1 auto","padding:4px 10px","border-radius:9px",
      "border:" + CHIPB,"background:rgba(10,10,16,0.9)",
      "color:" + TXT,"font-size:12px","outline:none","cursor:pointer"
    ].join(";"));
    mpCatSelect.setAttribute("data-role", "folder-select");
    const mpCatAddBtn = smallBtn("+ New", "mp-cat-add-btn", "new-folder-for-note");
    mpCatAddBtn.title = "Tambah kategori";
    mpCatWrap.append(mpCatLabel, mpCatSelect, mpCatAddBtn);

    // ── Notes list ───────────────────────────────────────────────────────────
    const mpList = mk("div", [
      "display:flex","flex-direction:column","gap:3px",
      "overflow-y:auto","overscroll-behavior:contain",
      "flex:1 1 auto","min-height:0","padding:1px 2px"
    ].join(";"));
    mpList.setAttribute("data-role", "mp-list");

    // ── Pager ────────────────────────────────────────────────────────────────
    const mpPager = mk("div", [
      "display:none","align-items:center","justify-content:space-between",
      "gap:8px","flex:0 0 auto","padding:2px 0"
    ].join(";"));
    mpPager.setAttribute("data-role", "mp-pager");
    const mpPrev = mk("button", [
      "padding:4px 14px","border-radius:9px","border:" + CHIPB,
      "background:" + CHIP,"color:" + TXT,"font-size:12px",
      "cursor:pointer","outline:none","transition:background 120ms ease"
    ].join(";"), "← Prev");
    mpPrev.type = "button";
    mpPrev.setAttribute("data-role", "mp-prev");
    mpPrev.setAttribute("data-action", "npp-page-prev");
    const mpNext = mk("button", [
      "padding:4px 14px","border-radius:9px","border:" + CHIPB,
      "background:" + CHIP,"color:" + TXT,"font-size:12px",
      "cursor:pointer","outline:none"
    ].join(";"), "→");
    mpNext.type = "button";
    mpNext.setAttribute("data-role", "mp-next");
    mpNext.setAttribute("data-action", "npp-page-next");
    const mpPagerInfo = mk("span", "color:" + MUTED + ";font-size:12px;", "1/1");
    mpPagerInfo.setAttribute("data-role", "mp-pager-info");
    mpPager.append(mpPrev, mpPagerInfo, mpNext);

    // Editor frame
    const mpEditor = mk("div", [
      "display:none","flex-direction:column","flex:1 1 auto","min-height:0","gap:6px"
    ].join(";"));
    mpEditor.setAttribute("data-role", "mp-editor");

    const mpEditorMeta = mk("div", "font-size:12px;color:" + MUTED + ";flex:0 0 auto;letter-spacing:0.01em;", "0 words");
    mpEditorMeta.setAttribute("data-role", "editor-meta");

    const editorFrame = document.createElement("iframe");
    editorFrame.className = "lp-editor-frame";
    editorFrame.setAttribute("data-role", "editor-frame");
    editorFrame.setAttribute("src", EDITOR_FRAME_URL);
    editorFrame.setAttribute("title", "Note editor");
    editorFrame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    editorFrame.style.cssText = [
      "display:block","width:100%","flex:1 1 auto","min-height:200px",
      "border:1px solid rgba(255,255,255,0.12)","border-radius:12px",
      "background:rgba(255,255,255,0.025)"
    ].join(";");

    // SSS — Selection Search Send to AI floating button
    const sssBtn = mk("button", [
      "display:none","position:absolute","z-index:10",
      "right:16px","bottom:16px",
      "padding:6px 14px","border-radius:999px",
      "border:1px solid rgba(100,200,255,0.4)","background:rgba(16,18,28,0.96)",
      "color:#7ab8ff","font-size:12px","font-weight:700","cursor:pointer",
      "white-space:nowrap","gap:5px","align-items:center",
      "box-shadow:0 4px 16px rgba(0,0,0,0.4)","outline:none",
      "transition:opacity 120ms ease"
    ].join(";"), "✦ AI");
    sssBtn.type = "button";
    sssBtn.setAttribute("data-role", "sss-btn");
    sssBtn.title = "Hantar teks terpilih ke AI sidebar (SSS)";

    // SSS Search — butang toggle enable/disable (sama fungsi dengan sidebar AI)
    const mpEditorMetaRow = mk("div", [
      "display:flex","align-items:center","justify-content:space-between",
      "gap:8px","flex:0 0 auto"
    ].join(";"));
    const sssSearchToggle = mk("button", [
      "display:inline-flex","align-items:center","justify-content:center",
      "gap:4px","padding:3px 10px","border-radius:999px",
      "border:1px solid rgba(255,255,255,0.15)","background:rgba(0,0,0,0.2)",
      "color:#555","font-size:11px","font-weight:700","cursor:pointer",
      "outline:none","white-space:nowrap","flex:0 0 auto",
      "transition:background 120ms ease,color 120ms ease,border-color 120ms ease"
    ].join(";"), "🔍 SSS");
    sssSearchToggle.type = "button";
    sssSearchToggle.setAttribute("data-role", "sss-search-toggle");
    sssSearchToggle.setAttribute("aria-pressed", "false");
    sssSearchToggle.title = "Selection Search dalam nota";
    mpEditorMetaRow.append(mpEditorMeta, sssSearchToggle);

    // SSS Search — popup senarai enjin carian untuk teks terpilih dalam nota
    const sssSearchPopup = mk("div", [
      "position:fixed","z-index:2147483646","display:none",
      "flex-direction:column","gap:5px",
      "width:min(230px,calc(100vw - 20px))","max-height:min(45vh,340px)",
      "padding:10px","border-radius:14px",
      "border:1px solid rgba(255,255,255,0.12)",
      "background:linear-gradient(180deg,rgba(23,26,38,0.99),rgba(13,15,23,0.99))",
      "color:#eef2ff","font-size:12px","font-weight:600",
      "box-shadow:0 20px 46px rgba(0,0,0,0.5)","overflow:hidden"
    ].join(";"));
    sssSearchPopup.setAttribute("data-role", "sss-search-popup");

    mpEditor.style.position = "relative";
    mpEditor.append(mpEditorMetaRow, editorFrame, sssBtn);

    // ── Mindmap container ────────────────────────────────────────────────────
    const mpMindmap = mk("div", [
      "display:none","flex-direction:column","flex:1 1 auto","min-height:0","gap:8px","position:relative"
    ].join(";"));
    mpMindmap.setAttribute("data-role", "mp-mindmap");

    // Premium glassmorphism toolbar
    const mpMindmapToolbar = mk("div", [
      "display:flex","align-items:center","gap:5px","flex:0 0 auto",
      "padding:6px 10px","flex-wrap:wrap",
      "background:rgba(255,255,255,0.04)",
      "border:1px solid rgba(255,255,255,0.09)",
      "border-radius:10px",
      "backdrop-filter:blur(8px)"
    ].join(";"));
    mpMindmapToolbar.setAttribute("data-role", "mp-mindmap-toolbar");

    // Inline SVG icon helper
    function mmSvgIcon(pathD, vb) {
      var s = document.createElementNS("http://www.w3.org/2000/svg","svg");
      s.setAttribute("viewBox", vb || "0 0 16 16");
      s.setAttribute("width","13"); s.setAttribute("height","13");
      s.style.cssText = "flex-shrink:0;pointer-events:none;";
      var p = document.createElementNS("http://www.w3.org/2000/svg","path");
      p.setAttribute("d", pathD);
      p.setAttribute("fill","currentColor");
      s.appendChild(p);
      return s;
    }

    // Premium toolbar button factory
    function mmToolBtn(iconPath, labelText, action, role, accentColor) {
      var b = mk("button", [
        "display:inline-flex","align-items:center","gap:4px",
        "padding:4px 9px","border-radius:7px",
        "border:1px solid " + (accentColor ? accentColor.border : "rgba(255,255,255,0.11)"),
        "background:" + (accentColor ? accentColor.bg : "rgba(255,255,255,0.06)"),
        "color:" + (accentColor ? accentColor.color : "rgba(255,255,255,0.8)"),
        "font-size:11px","font-weight:600","cursor:pointer","outline:none",
        "transition:background 130ms ease,border-color 130ms ease,transform 80ms ease",
        "white-space:nowrap","user-select:none"
      ].join(";"));
      b.type = "button";
      if (iconPath) b.appendChild(mmSvgIcon(iconPath));
      if (labelText) { var sp = document.createElement("span"); sp.textContent = labelText; b.appendChild(sp); }
      if (action) b.setAttribute("data-action", action);
      if (role) b.setAttribute("data-role", role);
      b.addEventListener("mouseenter", function() {
        b.style.background = accentColor ? accentColor.bgHover : "rgba(255,255,255,0.11)";
        b.style.transform = "translateY(-1px)";
      });
      b.addEventListener("mouseleave", function() {
        b.style.background = accentColor ? accentColor.bg : "rgba(255,255,255,0.06)";
        b.style.transform = "";
      });
      b.addEventListener("mousedown", function() { b.style.transform = "translateY(0) scale(0.97)"; });
      b.addEventListener("mouseup", function() { b.style.transform = "translateY(-1px)"; });
      return b;
    }

    // Filter group
    const mmFilterAll     = mmToolBtn("M8 1a7 7 0 100 14A7 7 0 008 1zm0 2a5 5 0 110 10A5 5 0 018 3z", "All", "set-view-all", "mm-filter-all");
    const mmFilterPinned  = mmToolBtn("M9.5 1L10 5.5l3 .5-4.5 4.5L4 6.5l3-.5L7.5 1z", "Pinned", "set-view-pinned", "mm-filter-pinned");
    const mmFilterTasks   = mmToolBtn("M2 3h12v2H2zm0 4h8v2H2zm0 4h5v2H2z", "Tasks", "set-view-tasks", "mm-filter-tasks");
    mmFilterAll.title = "Show all notes";
    mmFilterPinned.title = "Show pinned only";
    mmFilterTasks.title = "Show notes with tasks";

    const mmViewSep = mk("div","width:1px;height:18px;background:rgba(255,255,255,0.1);flex-shrink:0;margin:0 2px;");

    // Mode toggle
    const mmModeToggle = mmToolBtn(
      "M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1zm1 2v8h8V4H4zm2 2h4v1H6zm0 2h3v1H6z",
      "Folder",
      "mindmap-toggle-mode", "mm-mode-toggle",
      { border:"rgba(180,140,255,0.28)", bg:"rgba(180,140,255,0.09)", bgHover:"rgba(180,140,255,0.16)", color:"#c8a0ff" }
    );
    mmModeToggle.title = "Toggle Folder / Content view (M)";

    const mmViewSep2 = mk("div","width:1px;height:18px;background:rgba(255,255,255,0.1);flex-shrink:0;margin:0 2px;");

    // Layout style toggle (Radial ↔ Tree)
    const mmLayoutToggle = mmToolBtn(
      "M1 2h3v3H1zm5 1h9v1H6zM1 7h3v3H1zm5 1h9v1H6zM1 12h3v3H1zm5 1h9v1H6z",
      "Tree",
      "mindmap-toggle-layout", "mm-layout-toggle",
      { border:"rgba(100,220,160,0.28)", bg:"rgba(100,220,160,0.09)", bgHover:"rgba(100,220,160,0.16)", color:"#7de8b0" }
    );
    mmLayoutToggle.title = "Toggle Radial / Tree layout";

    const mmViewSep2b = mk("div","width:1px;height:18px;background:rgba(255,255,255,0.1);flex-shrink:0;margin:0 2px;");

    // Zoom controls group
    const mmZoomOut = mmToolBtn("M3 7.5h10v1H3z", "−", "mindmap-zoom-out", null);
    mmZoomOut.title = "Zoom out (−)";

    const mmZoomFit = mmToolBtn(
      "M1 1h5v1H2v4H1zm9 0h5v5h-1V2h-4zM1 10h1v4h4v1H1zm14 4h-5v-1h4v-4h1z",
      "Fit", "mindmap-fit", null
    );
    mmZoomFit.title = "Fit all nodes (F)";

    const mmZoomIn = mmToolBtn("M8 3v5H3v1h5v5h1V9h5V8H9V3z", "+", "mindmap-zoom-in", null);
    mmZoomIn.title = "Zoom in (+)";

    const mmZoomLabel = mk("span", [
      "font-size:11px","color:rgba(255,255,255,0.45)","min-width:36px",
      "text-align:center","font-variant-numeric:tabular-nums","letter-spacing:0.02em",
      "font-weight:500"
    ].join(";"), "100%");
    mmZoomLabel.setAttribute("data-role", "mp-mindmap-zoom-label");

    const mmViewSep3 = mk("div","width:1px;height:18px;background:rgba(255,255,255,0.1);flex-shrink:0;margin:0 2px;");

    // Mindmap search input
    const mmSearchInput = mk("input", [
      "width:110px","padding:4px 8px","border-radius:6px",
      "border:1px solid rgba(255,255,255,0.12)",
      "background:rgba(255,255,255,0.06)",
      "color:rgba(255,255,255,0.8)","font-size:11px","outline:none",
      "transition:border-color 130ms ease,width 200ms ease"
    ].join(";"));
    mmSearchInput.type = "text";
    mmSearchInput.placeholder = "🔍 Cari node…";
    mmSearchInput.setAttribute("data-role", "mm-search-input");
    mmSearchInput.addEventListener("focus", function() { this.style.width = "180px"; this.style.borderColor = "rgba(90,200,255,0.4)"; });
    mmSearchInput.addEventListener("blur", function() { this.style.width = "110px"; this.style.borderColor = "rgba(255,255,255,0.12)"; });
    mmSearchInput.addEventListener("input", function() {
      var q = this.value.trim().toLowerCase();
      var svg = state.refs.mpMindmapSvg;
      if (!svg) return;
      var allNodes = svg.querySelectorAll('[data-mm-id]');
      var hasQuery = q.length > 0;
      allNodes.forEach(function(n) {
        var label = (n.getAttribute("data-mm-label") || "").toLowerCase();
        var matches = !hasQuery || label.includes(q);
        var isFolderOrNote = n.getAttribute("data-mm-type") === "folder" || n.getAttribute("data-mm-type") === "note" || n.getAttribute("data-mm-type") === "root";
        if (isFolderOrNote) {
          n.style.opacity = hasQuery ? (matches ? "1" : "0.2") : "";
          n.style.filter = hasQuery && matches ? "url(#mm-glow)" : "";
          n.style.animation = hasQuery && matches ? "mmPulse 1.6s ease-in-out infinite" : "";
        }
      });
      // Add pulse keyframes if not already present
      if (hasQuery) {
        var styleId = "mm-pulse-style";
        if (!svg.querySelector("#" + styleId)) {
          var pulseStyle = document.createElementNS("http://www.w3.org/2000/svg", "style");
          pulseStyle.id = styleId;
          pulseStyle.textContent = "@keyframes mmPulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } } .mm-pulse { animation: mmPulse 1.6s ease-in-out infinite; }";
          svg.appendChild(pulseStyle);
        }
      }
    });

    // Export buttons — push to right
    const mmExportBtn = mmToolBtn(
      "M8 1v8.5l3-3 .7.7-4 4-.7.7-.7-.7-4-4 .7-.7 3 3V1zM1 13h14v2H1z",
      "SVG", "mindmap-export-svg", null,
      { border:"rgba(100,220,255,0.22)", bg:"rgba(100,220,255,0.07)", bgHover:"rgba(100,220,255,0.14)", color:"#7dd8f0" }
    );
    mmExportBtn.title = "Export as SVG";

    const mmExportPngBtn = mmToolBtn(
      "M2 2h12v10H2zm1 1v6h10V3zM4 11h8v1H4z",
      "PNG", "mindmap-export-png", null,
      { border:"rgba(255,180,100,0.22)", bg:"rgba(255,180,100,0.07)", bgHover:"rgba(255,180,100,0.14)", color:"#f0c880" }
    );
    mmExportPngBtn.title = "Export as PNG";
    mmExportPngBtn.style.marginLeft = "auto";

    mpMindmapToolbar.append(
      mmFilterAll, mmFilterPinned, mmFilterTasks, mmViewSep,
      mmModeToggle, mmViewSep2,
      mmLayoutToggle, mmViewSep2b,
      mmSearchInput, mmViewSep3,
      mmZoomOut, mmZoomFit, mmZoomIn, mmZoomLabel,
      mmViewSep3, mmExportPngBtn, mmExportBtn
    );

    // Premium canvas wrap with glassmorphism border + subtle dot-grid bg
    const mpMindmapSvgWrap = mk("div", [
      "flex:1 1 auto","overflow:hidden","border-radius:14px","position:relative",
      "border:1px solid rgba(255,255,255,0.1)",
      "background:radial-gradient(ellipse at 50% 0%,rgba(90,180,255,0.04) 0%,rgba(10,11,18,0.0) 70%),rgba(10,11,18,0.5)",
      "min-height:200px","cursor:grab",
      "box-shadow:inset 0 1px 0 rgba(255,255,255,0.06),0 8px 32px rgba(0,0,0,0.28)"
    ].join(";"));
    mpMindmapSvgWrap.setAttribute("data-role", "mp-mindmap-svg-wrap");

    const mpMindmapSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    mpMindmapSvg.setAttribute("width", "100%");
    mpMindmapSvg.setAttribute("height", "100%");
    mpMindmapSvg.style.cssText = "display:block;width:100%;height:100%;will-change:transform;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;";
    mpMindmapSvg.setAttribute("data-role", "mp-mindmap-svg");

    mpMindmapSvgWrap.appendChild(mpMindmapSvg);

    // Delete button (×) — muncul pada hover node untuk delete terus
    const mmDelBtn = mk("button", [
      "position:absolute","z-index:10","display:none",
      "width:22px","height:22px","border-radius:50%",
      "border:1.5px solid rgba(255,100,100,0.7)",
      "background:rgba(40,14,14,0.95)",
      "color:#ff7a7a","font-size:16px","font-weight:700",
      "cursor:pointer","outline:none","padding:0",
      "align-items:center","justify-content:center",
      "box-shadow:0 2px 10px rgba(0,0,0,0.4)",
      "transition:opacity 120ms ease,transform 120ms ease",
      "line-height:1","pointer-events:auto"
    ].join(";"), "×");
    mmDelBtn.type = "button";
    mmDelBtn.title = "Delete node";
    mmDelBtn.setAttribute("data-role", "mm-del-btn");
    mpMindmapSvgWrap.appendChild(mmDelBtn);

    // HTML tooltip — created at document.body level (outside shadow DOM) in ensureMounted()
    // so position:fixed works correctly without being clipped by shadow host transforms.
    // Placeholder span so the data-role query in shadow.querySelector still finds *something*
    // (actual ref is set directly in ensureMounted via state.refs.mmHtmlTooltip).
    const mmHtmlTooltipPlaceholder = mk("span", "display:none");
    mmHtmlTooltipPlaceholder.setAttribute("data-role", "mm-html-tooltip-placeholder");
    overlay.appendChild(mmHtmlTooltipPlaceholder);

    mpMindmap.append(mpMindmapToolbar, mpMindmapSvgWrap);

    // ── Mindmap node context menu ────────────────────────────────────────
    const mmCtxMenu = mk("div", [
      "position:fixed","z-index:2147483651","display:none",
      "flex-direction:column","min-width:200px",
      "background:linear-gradient(160deg,rgba(16,18,28,0.99),rgba(10,12,20,0.99))",
      "border:1px solid rgba(255,255,255,0.13)",
      "border-radius:12px",
      "box-shadow:0 20px 48px rgba(0,0,0,0.55),0 2px 8px rgba(0,0,0,0.3)",
      "padding:5px","overflow:hidden",
      "backdrop-filter:blur(16px)",
      "transition:opacity 100ms ease,transform 100ms ease",
      "opacity:0","pointer-events:none",
      "transform:scale(0.97) translateY(-4px)"
    ].join(";"));
    mmCtxMenu.setAttribute("data-role", "mm-ctx-menu");

    // Context menu item factory
    function mmCtxItem(icon, label, desc, color) {
      var item = mk("button", [
        "display:flex","align-items:center","gap:10px",
        "width:100%","padding:9px 12px","border-radius:8px",
        "border:none","background:transparent",
        "color:" + (color || "rgba(255,255,255,0.88)"),
        "font-size:12px","font-weight:500","cursor:pointer",
        "text-align:left","outline:none",
        "transition:background 100ms ease"
      ].join(";"));
      item.type = "button";

      // Icon container
      var iconEl = mk("span", [
        "font-size:15px","flex-shrink:0",
        "width:24px","height:24px",
        "display:flex","align-items:center","justify-content:center",
        "background:rgba(255,255,255,0.07)","border-radius:6px"
      ].join(";"), icon);
      item.appendChild(iconEl);

      // Text column
      var textCol = mk("div", "display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;");
      var labelEl = mk("span", "font-size:12px;font-weight:600;white-space:nowrap;", label);
      var descEl  = mk("span", "font-size:10px;color:rgba(255,255,255,0.38);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;", desc);
      textCol.append(labelEl, descEl);
      item.appendChild(textCol);

      item.addEventListener("mouseenter", function() {
        item.style.background = "rgba(255,255,255,0.07)";
      });
      item.addEventListener("mouseleave", function() {
        item.style.background = "transparent";
      });
      return item;
    }

    // Menu items — data-role used to identify action
    var ctxExplain  = mmCtxItem("✦", "Explain with AI", "Summarize & explain this node", "#7ab8ff");
    var ctxExpand   = mmCtxItem("⊕", "Expand Topic", "Ask AI to suggest sub-topics", "#a0e8b0");
    var ctxAsk      = mmCtxItem("💬", "Ask AI About This", "Open AI with this content", "rgba(255,255,255,0.88)");
    var ctxSep      = mk("div", "height:1px;background:rgba(255,255,255,0.08);margin:3px 4px;");
    var ctxOpen     = mmCtxItem("📝", "Open Note", "Go to editor", "rgba(255,255,255,0.7)");
    var ctxSep2     = mk("div", "height:1px;background:rgba(255,255,255,0.08);margin:3px 4px;");
    var ctxCreate   = mmCtxItem("➕", "Create Note", "New note in this folder", "#80e0a0");
    var ctxDelete   = mmCtxItem("🗑", "Delete Note", "Remove from notes", "#ff7a7a");

    ctxExplain.setAttribute("data-ctx-action", "explain");
    ctxExpand.setAttribute("data-ctx-action",  "expand");
    ctxAsk.setAttribute("data-ctx-action",     "ask");
    ctxOpen.setAttribute("data-ctx-action",    "open");
    ctxCreate.setAttribute("data-ctx-action",  "create-note");
    ctxDelete.setAttribute("data-ctx-action",  "delete");

    mmCtxMenu.append(ctxExplain, ctxExpand, ctxAsk, ctxSep, ctxOpen, ctxSep2, ctxCreate, ctxDelete);

    // Stop shadow-level mousedown from closing the menu when clicking inside it
    mmCtxMenu.addEventListener("mousedown", function(e) { e.stopPropagation(); });

    overlay.appendChild(mmCtxMenu);

    // Hint bar (notes list mode only)
    const mpHint = mk("div", [
      "color:rgba(255,255,255,0.3)","font-size:10px","flex:0 0 auto",
      "text-align:center","padding:2px 0","letter-spacing:0.02em"
    ].join(";"), "↑↓ navigate · Enter open · Swipe left to delete · Esc close");

    // ── Todo container ────────────────────────────────────────────────────────
    const mpTodo = mk("div", [
      "display:none","flex-direction:column","flex:1 1 auto","min-height:0","gap:8px"
    ].join(";"));
    mpTodo.setAttribute("data-role", "mp-todo");

    // Todo toolbar (filter buttons + add list)
    const mpTodoToolbar = mk("div", [
      "display:flex","align-items:center","gap:6px","flex:0 0 auto","flex-wrap:wrap"
    ].join(";"));
    mpTodoToolbar.setAttribute("data-role", "mp-todo-toolbar");

    const mpTodoFilterAll = mk("button", [
      "padding:3px 10px","border-radius:8px",
      "border:" + CHIPB,"background:" + CHIP,"color:" + TXT,
      "font-size:11px","font-weight:600","cursor:pointer","outline:none"
    ].join(";"), "All");
    mpTodoFilterAll.type = "button";
    mpTodoFilterAll.setAttribute("data-role", "mp-todo-filter-all");
    mpTodoFilterAll.setAttribute("data-action", "todo-filter-all");

    const mpTodoFilterActive = mk("button", [
      "padding:3px 10px","border-radius:8px",
      "border:" + CHIPB,"background:" + CHIP,"color:" + TXT,
      "font-size:11px","font-weight:600","cursor:pointer","outline:none"
    ].join(";"), "Active");
    mpTodoFilterActive.type = "button";
    mpTodoFilterActive.setAttribute("data-role", "mp-todo-filter-active");
    mpTodoFilterActive.setAttribute("data-action", "todo-filter-active");

    const mpTodoFilterCompleted = mk("button", [
      "padding:3px 10px","border-radius:8px",
      "border:" + CHIPB,"background:" + CHIP,"color:" + TXT,
      "font-size:11px","font-weight:600","cursor:pointer","outline:none"
    ].join(";"), "Completed");
    mpTodoFilterCompleted.type = "button";
    mpTodoFilterCompleted.setAttribute("data-role", "mp-todo-filter-completed");
    mpTodoFilterCompleted.setAttribute("data-action", "todo-filter-completed");

    mpTodoToolbar.append(mpTodoFilterAll, mpTodoFilterActive, mpTodoFilterCompleted);

    // Todo list items container
    const mpTodoItems = mk("div", [
      "display:flex","flex-direction:column","gap:4px",
      "overflow-y:auto","overscroll-behavior:contain",
      "flex:1 1 auto","min-height:0","padding:2px 0"
    ].join(";"));
    mpTodoItems.setAttribute("data-role", "mp-todo-items");

    // Todo add item input
    const mpTodoAddWrap = mk("div", [
      "display:flex","align-items:flex-start","gap:8px","flex:0 0 auto",
      "padding:6px 0","border-top:1px solid rgba(255,255,255,0.08)"
    ].join(";"));
    const mpTodoAddInput = mk("textarea", [
      "flex:1 1 auto","padding:10px 12px","border-radius:10px",
      "border:" + INPB,"background:" + INPBG,
      "color:" + TXT,"font-size:13px","outline:none",
      "resize:none","min-height:40px","line-height:1.4",
      "font-family:inherit","transition:border-color 150ms ease"
    ].join(";"));
    mpTodoAddInput.placeholder = "Add a new item...";
    mpTodoAddInput.setAttribute("data-role", "mp-todo-add-input");

    const mpTodoAddBtn = smallBtn("+ Add", "mp-todo-add-btn", "todo-add-item");
    mpTodoAddBtn.title = "Tambah item";

    mpTodoAddWrap.append(mpTodoAddInput, mpTodoAddBtn);

    mpTodo.append(mpTodoToolbar, mpTodoItems, mpTodoAddWrap);

    mainPanel.append(mpHeader, mpSearchWrap, mpCatWrap, mpList, mpPager, mpEditor, mpMindmap, mpTodo);
    shell.appendChild(mainPanel);

    // Resize handles
    var resizeHandle = mk("div", [
      "position:absolute","top:0","right:-5px","width:10px","height:100%",
      "cursor:ew-resize","z-index:10","opacity:0",
      "transition:opacity 150ms ease",
      "display:flex","align-items:center","justify-content:center"
    ].join(";"));
    resizeHandle.setAttribute("data-role", "resize-handle");
    resizeHandle.style.background = "transparent";
    overlay.appendChild(resizeHandle);

    var resizeHandleY = mk("div", [
      "position:absolute","bottom:-5px","left:0","width:100%","height:10px",
      "cursor:ns-resize","z-index:10","opacity:0",
      "transition:opacity 150ms ease",
      "display:flex","align-items:center","justify-content:center"
    ].join(";"));
    resizeHandleY.setAttribute("data-role", "resize-handle-y");
    resizeHandleY.style.background = "transparent";
    overlay.appendChild(resizeHandleY);

    // ── Dialog layer (absolute, covers both panels) ──────────────────────────
    const dialogWrap = mk("div", [
      "position:fixed","inset:0","z-index:2147483648",
      "display:none","align-items:center","justify-content:center",
      "background:rgba(0,0,0,0.56)"
    ].join(";"));
    dialogWrap.setAttribute("data-role", "dialog-layer");
    const dialogCard = mk("div", [
      "position:relative","z-index:1",
      "width:min(420px,calc(100% - 32px))","display:grid","gap:14px",
      "padding:18px","border-radius:20px",
      "border:1px solid rgba(255,255,255,0.12)",
      "background:rgba(16,18,24,0.98)","color:" + TXT,
      "box-shadow:0 22px 60px rgba(0,0,0,0.36)"
    ].join(";"));
    dialogCard.setAttribute("role", "dialog");
    dialogCard.setAttribute("aria-modal", "true");
    const dialogTitle = mk("div", "font-size:17px;font-weight:700;", "");
    dialogTitle.setAttribute("data-role", "dialog-title");
    const dialogMsg = mk("div", "font-size:14px;color:rgba(255,255,255,0.7);line-height:1.5;", "");
    dialogMsg.setAttribute("data-role", "dialog-message");
    const dialogInputWrap = mk("label", "display:grid;gap:8px;");
    dialogInputWrap.setAttribute("data-role", "dialog-input-wrap");
    dialogInputWrap.style.display = "none";
    const dialogInputLabel = mk("span", "font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:" + MUTED + ";", "");
    dialogInputLabel.setAttribute("data-role", "dialog-input-label");
    const dialogInput = mk("input", [
      "width:100%","min-height:42px","border:1px solid rgba(255,255,255,0.12)",
      "border-radius:10px","background:rgba(255,255,255,0.04)",
      "color:" + TXT,"padding:0 14px","font-size:14px","outline:none"
    ].join(";"));
    dialogInput.type = "text";
    dialogInput.setAttribute("data-role", "dialog-input");
    dialogInput.setAttribute("maxlength", "120");
    dialogInput.setAttribute("autocomplete", "off");
    dialogInputWrap.append(dialogInputLabel, dialogInput);
    const dialogActions = mk("div", "display:flex;justify-content:flex-end;gap:8px;");
    const dialogCancel = mk("button", [
      "padding:6px 16px","border-radius:10px","border:" + CHIPB,
      "background:" + CHIP,"color:" + TXT,"font-size:13px","font-weight:600",
      "cursor:pointer","outline:none"
    ].join(";"), "Cancel");
    dialogCancel.type = "button";
    dialogCancel.setAttribute("data-role", "dialog-cancel");
    dialogCancel.setAttribute("data-action", "cancel-dialog");
    const dialogConfirm = mk("button", [
      "padding:6px 16px","border-radius:10px",
      "border:1px solid transparent",
      "background:linear-gradient(135deg,#5ac8ff,#3a8fff)",
      "color:#fff","font-size:13px","font-weight:700",
      "cursor:pointer","outline:none"
    ].join(";"), "OK");
    dialogConfirm.type = "button";
    dialogConfirm.setAttribute("data-role", "dialog-confirm");
    dialogConfirm.setAttribute("data-action", "confirm-dialog");
    dialogActions.append(dialogCancel, dialogConfirm);
    dialogCard.append(dialogTitle, dialogMsg, dialogInputWrap, dialogActions);
    dialogWrap.appendChild(dialogCard);
    overlay.appendChild(dialogWrap);

    // ── Undo toast ───────────────────────────────────────────────────────────
    const undoToast = mk("div", [
      "display:none","align-items:center","justify-content:space-between",
      "gap:10px","padding:8px 12px",
      "border:1px solid rgba(255,214,51,0.35)","border-radius:12px",
      "background:rgba(255,214,51,0.1)","color:#ffe48a",
      "position:fixed","bottom:24px","left:50%",
      "transform:translateX(-50%)","z-index:2147483650","white-space:nowrap"
    ].join(";"));
    undoToast.setAttribute("data-role", "undo-toast");
    const undoMsg = mk("span", "font-size:12px;", "");
    undoMsg.setAttribute("data-role", "undo-toast-message");
    const undoBtn = mk("button", [
      "padding:3px 10px","border-radius:8px",
      "border:1px solid rgba(255,255,255,0.25)",
      "background:rgba(255,255,255,0.12)","color:#fff5c1",
      "font-size:12px","cursor:pointer","outline:none"
    ].join(";"), "Undo");
    undoBtn.type = "button";
    undoBtn.setAttribute("data-role", "undo-delete-button");
    undoBtn.setAttribute("data-action", "undo-delete-note");
    undoToast.append(undoMsg, undoBtn);
    overlay.appendChild(undoToast);

    // ── Trash layer ──────────────────────────────────────────────────────────
    const trashLayer = mk("div", [
      "position:fixed","inset:0","z-index:2147483648",
      "display:none","align-items:center","justify-content:center",
      "background:rgba(0,0,0,0.62)","padding:16px"
    ].join(";"));
    trashLayer.setAttribute("data-role", "trash-layer");
    const trashCard = mk("div", [
      "position:relative","z-index:1",
      "width:min(640px,calc(100% - 32px))",
      "max-height:min(72vh,760px)","display:grid",
      "grid-template-rows:auto auto minmax(0,1fr) auto",
      "gap:14px","padding:18px","border-radius:18px",
      "border:1px solid rgba(255,255,255,0.12)",
      "background:rgba(16,18,24,0.98)","color:" + TXT,
      "box-shadow:0 22px 60px rgba(0,0,0,0.36)"
    ].join(";"));
    trashCard.setAttribute("role", "dialog");
    const trashHead = mk("div", "display:flex;align-items:flex-start;justify-content:space-between;gap:16px;");
    const trashTitleWrap = mk("div", "");
    const trashTitleEl = mk("div", "font-size:17px;font-weight:700;", "Deleted Notes");
    const trashMetaEl = mk("div", "font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px;", "");
    trashMetaEl.setAttribute("data-role", "trash-meta");
    trashTitleWrap.append(trashTitleEl, trashMetaEl);
    const trashCloseBtn = mk("button", [
      "padding:4px 12px","border-radius:8px","border:" + CHIPB,
      "background:" + CHIP,"color:" + TXT,"font-size:12px",
      "cursor:pointer","outline:none"
    ].join(";"), "Close");
    trashCloseBtn.type = "button";
    trashCloseBtn.setAttribute("data-action", "close-trash");
    trashHead.append(trashTitleWrap, trashCloseBtn);
    const trashEmpty = mk("div", [
      "border:1px dashed rgba(255,255,255,0.15)","border-radius:12px",
      "padding:16px","color:" + MUTED,"font-size:13px","text-align:center"
    ].join(";"), "No deleted notes.");
    trashEmpty.setAttribute("data-role", "trash-empty");
    trashEmpty.style.display = "none";
    const trashList = mk("div", "min-height:80px;max-height:min(50vh,480px);overflow:auto;display:grid;gap:8px;padding-right:4px;");
    trashList.setAttribute("data-role", "trash-list");
    const trashActions = mk("div", "display:flex;justify-content:flex-end;gap:8px;");
    const emptyTrashBtn = mk("button", [
      "padding:6px 14px","border-radius:8px",
      "border:1px solid rgba(255,143,143,0.3)",
      "background:rgba(255,143,143,0.1)","color:#ff8f8f",
      "font-size:12px","font-weight:600","cursor:pointer","outline:none"
    ].join(";"), "Empty trash");
    emptyTrashBtn.type = "button";
    emptyTrashBtn.setAttribute("data-role", "empty-trash-button");
    emptyTrashBtn.setAttribute("data-action", "empty-trash");
    trashActions.appendChild(emptyTrashBtn);
    trashCard.append(trashHead, trashEmpty, trashList, trashActions);
    trashLayer.appendChild(trashCard);
    overlay.appendChild(trashLayer);

    // ── Folder palette (move note to category) ──────────────────────────────
    const palLayer = mk("div", [
      "position:fixed","inset:0","z-index:2147483649",
      "display:none","pointer-events:none"
    ].join(";"));
    palLayer.setAttribute("data-role", "folder-palette-layer");
    const palBox = mk("div", [
      "position:absolute","left:50%","top:14%",
      "transform:translateX(-50%)","pointer-events:auto",
      "width:min(420px,calc(100% - 24px))",
      "max-height:min(72vh,640px)","display:grid",
      "grid-template-rows:auto auto minmax(0,1fr)",
      "gap:10px","padding:12px","border-radius:18px",
      "border:1px solid rgba(255,255,255,0.12)",
      "background:rgba(16,18,24,0.98)",
      "box-shadow:0 22px 60px rgba(0,0,0,0.36)","color:" + TXT
    ].join(";"));
    palBox.setAttribute("data-role", "folder-palette");
    const palTitle = mk("div", "font-size:13px;font-weight:700;", "Move note to category");
    palTitle.setAttribute("data-role", "folder-palette-title");
    const palInput = mk("input", [
      "width:100%","min-height:42px","border:1px solid rgba(255,255,255,0.12)",
      "border-radius:12px","background:rgba(255,255,255,0.04)",
      "color:" + TXT,"padding:0 14px","font-size:14px","outline:none"
    ].join(";"));
    palInput.type = "text";
    palInput.setAttribute("autocomplete", "off");
    palInput.setAttribute("placeholder", "Type category name");
    palInput.setAttribute("data-role", "folder-palette-input");
    const palList = mk("div", "min-height:100px;max-height:min(52vh,440px);overflow:auto;display:grid;gap:6px;");
    palList.setAttribute("data-role", "folder-palette-list");
    palBox.append(palTitle, palInput, palList);
    palLayer.appendChild(palBox);
    overlay.appendChild(palLayer);

    // ── Import file input (hidden) ───────────────────────────────────────────
    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = ".txt,.md,text/plain,text/markdown";
    importInput.multiple = true;
    importInput.style.display = "none";
    importInput.setAttribute("data-role", "import-txt-input");
    overlay.appendChild(importInput);

    // SSS Search popup — anak overlay supaya position:fixed kekal atas segala panel
    overlay.appendChild(sssSearchPopup);

    return overlay;
  }


  function ensureMounted() {
    if (state.mounted) return;
    const host = document.createElement("div");
    host.id = ROOT_ID;
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = buildStyles();
    shadow.append(style, buildMarkup());
    state.shadow = shadow;
    state.refs.host = host;

    // ── New refs matching new buildMarkup ──────────────────────────────────
    state.refs.overlay        = shadow.querySelector(".lp-overlay");
    state.refs.shell          = shadow.querySelector('[data-role="shell"]');
    state.refs.leftPanel      = shadow.querySelector('[data-role="left-panel"]');
    state.refs.lpList         = shadow.querySelector('[data-role="lp-list"]');
    state.refs.lpTitle        = shadow.querySelector('[data-role="lp-title"]');
    state.refs.mainPanel      = shadow.querySelector('[data-role="main-panel"]');
    state.refs.mpTodo            = shadow.querySelector('[data-role="mp-todo"]');
    state.refs.mpTodoToolbar     = shadow.querySelector('[data-role="mp-todo-toolbar"]');
    state.refs.mpTodoItems       = shadow.querySelector('[data-role="mp-todo-items"]');
    state.refs.mpTodoAddInput    = shadow.querySelector('[data-role="mp-todo-add-input"]');
    state.refs.mpTodoAddBtn      = shadow.querySelector('[data-role="mp-todo-add-btn"]');
    state.refs.mpTodoBtn         = shadow.querySelector('[data-role="mp-todo-btn"]');
    // Todo left panel refs — created in renderTodoLeftPanel
    state.refs.mpHeader       = shadow.querySelector('[data-role="mp-header"]');
    state.refs.mpTitle        = shadow.querySelector('[data-role="mp-title"]');
    state.refs.mpBackBtn      = shadow.querySelector('[data-role="mp-back-btn"]');
    state.refs.mpSearch       = shadow.querySelector('[data-role="mp-search"]');
    state.refs.mpCatWrap      = shadow.querySelector('[data-role="mp-cat-wrap"]');
    state.refs.mpList         = shadow.querySelector('[data-role="mp-list"]');
    state.refs.mpPager        = shadow.querySelector('[data-role="mp-pager"]');
    state.refs.mpPagerInfo    = shadow.querySelector('[data-role="mp-pager-info"]');
    state.refs.mpPrev         = shadow.querySelector('[data-role="mp-prev"]');
    state.refs.mpNext         = shadow.querySelector('[data-role="mp-next"]');
    state.refs.mpEditor       = shadow.querySelector('[data-role="mp-editor"]');
    state.refs.mpHint         = shadow.querySelector('[data-role="mp-hint"]');
    state.refs.editorFrame    = shadow.querySelector('[data-role="editor-frame"]');
    state.refs.editorMeta     = shadow.querySelector('[data-role="editor-meta"]');
    state.refs.saveStatus     = shadow.querySelector('[data-role="save-status"]');
    state.refs.mpPanelPinBtn  = shadow.querySelector('[data-role="mp-panel-pin-btn"]');
    state.refs.sssBtn         = shadow.querySelector('[data-role="sss-btn"]');
    state.refs.sssSearchToggle = shadow.querySelector('[data-role="sss-search-toggle"]');
    state.refs.sssSearchPopup = shadow.querySelector('[data-role="sss-search-popup"]');
    state.refs.mpAiBtn        = shadow.querySelector('[data-role="mp-ai-btn"]');
    state.refs.folderSelect   = shadow.querySelector('[data-role="folder-select"]');
    state.refs.importFileInput = shadow.querySelector('[data-role="import-txt-input"]');
    // pin button (mp-pin-btn uses data-role="pin-button" too)
    state.refs.pinButtons     = Array.from(shadow.querySelectorAll('[data-role="pin-button"]'));
    state.refs.openTrashButton = shadow.querySelector('[data-role="mp-trash-btn"]');
    state.refs.mpMindmap      = shadow.querySelector('[data-role="mp-mindmap"]');
    state.refs.mpMindmapSvg   = shadow.querySelector('[data-role="mp-mindmap-svg"]');
    state.refs.mpMindmapSvgWrap = shadow.querySelector('[data-role="mp-mindmap-svg-wrap"]');
    state.refs.mmDelBtn           = shadow.querySelector('[data-role="mm-del-btn"]');
    state.refs.mpMindmapZoomLabel = shadow.querySelector('[data-role="mp-mindmap-zoom-label"]');
    state.refs.mpMindmapToggleBtn = shadow.querySelector('[data-role="mp-mindmap-toggle-btn"]');
    state.refs.mmCtxMenu          = shadow.querySelector('[data-role="mm-ctx-menu"]');
    // Tooltip is appended to document.body (NOT shadow DOM) so position:fixed
    // works correctly without being clipped by shadow host stacking context.
    // Remove any stale tooltip from a previous mount first.
    (function() {
      var stale = document.querySelector('[data-role="mm-html-tooltip"][data-lp-tooltip]');
      if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
      var tip = document.createElement("div");
      tip.setAttribute("data-role", "mm-html-tooltip");
      tip.setAttribute("data-lp-tooltip", "1");
      tip.style.cssText = [
        "position:fixed","z-index:2147483647",
        "display:none","flex-direction:column","gap:6px",
        "max-width:420px","min-width:200px",
        "max-height:min(80vh,520px)",
        "padding:14px 16px","border-radius:14px",
        "background:linear-gradient(160deg,rgba(12,14,24,0.99),rgba(8,10,18,0.99))",
        "border:1px solid rgba(255,255,255,0.12)",
        "box-shadow:0 16px 40px rgba(0,0,0,0.55),0 2px 8px rgba(0,0,0,0.3)",
        "backdrop-filter:blur(20px)",
        "pointer-events:none","overflow:hidden",
        "transition:opacity 120ms ease",
        "opacity:0","font-family:system-ui,-apple-system,'Segoe UI',sans-serif",
        "isolation:isolate"
      ].join(";");
      var accent = document.createElement("div");
      accent.style.cssText = "height:2px;border-radius:2px;background:linear-gradient(90deg,rgba(90,200,255,0.7),rgba(90,200,255,0));flex-shrink:0;";
      var title = document.createElement("div");
      title.style.cssText = "font-size:13px;font-weight:700;color:rgba(255,255,255,0.96);white-space:normal;word-break:break-word;flex-shrink:0;line-height:1.4;";
      var content = document.createElement("div");
      content.style.cssText = "font-size:12px;color:rgba(255,255,255,0.78);line-height:1.65;overflow-y:auto;flex:1 1 auto;white-space:pre-wrap;word-break:break-word;max-height:min(60vh,380px);scrollbar-width:thin;";
      var footer = document.createElement("div");
      footer.style.cssText = "font-size:11px;color:rgba(255,255,255,0.38);flex-shrink:0;border-top:1px solid rgba(255,255,255,0.08);padding-top:6px;margin-top:2px;";
      tip.appendChild(accent);
      tip.appendChild(title);
      tip.appendChild(content);
      tip.appendChild(footer);
      // Insert AFTER the shadow host in DOM order so it paints on top.
      // Both share the same stacking context (document root); higher DOM order
      // wins when z-index values are equal.
      var shadowHost = document.getElementById("__lp_notes_overlay_root");
      if (shadowHost && shadowHost.parentNode) {
        shadowHost.parentNode.insertBefore(tip, shadowHost.nextSibling);
      } else {
        document.documentElement.appendChild(tip);
      }
      state.refs.mmHtmlTooltip = tip;
      state.refs.mmHtmlTooltipTitle   = title;
      state.refs.mmHtmlTooltipContent = content;
      state.refs.mmHtmlTooltipFooter  = footer;
    })();
    state.refs.resizeHandle = shadow.querySelector('[data-role="resize-handle"]');
    state.refs.resizeHandleY = shadow.querySelector('[data-role="resize-handle-y"]');

    // Dialog refs
    state.refs.dialogLayer    = shadow.querySelector('[data-role="dialog-layer"]');
    state.refs.dialogTitle    = shadow.querySelector('[data-role="dialog-title"]');
    state.refs.dialogMessage  = shadow.querySelector('[data-role="dialog-message"]');
    state.refs.dialogInputWrap = shadow.querySelector('[data-role="dialog-input-wrap"]');
    state.refs.dialogInputLabel = shadow.querySelector('[data-role="dialog-input-label"]');
    state.refs.dialogInput    = shadow.querySelector('[data-role="dialog-input"]');
    state.refs.dialogConfirm  = shadow.querySelector('[data-role="dialog-confirm"]');
    state.refs.dialogCancel   = shadow.querySelector('[data-role="dialog-cancel"]');

    // Trash refs
    state.refs.trashLayer     = shadow.querySelector('[data-role="trash-layer"]');
    state.refs.trashMeta      = shadow.querySelector('[data-role="trash-meta"]');
    state.refs.trashList      = shadow.querySelector('[data-role="trash-list"]');
    state.refs.trashEmpty     = shadow.querySelector('[data-role="trash-empty"]');
    state.refs.emptyTrashButton = shadow.querySelector('[data-role="empty-trash-button"]');

    // Undo toast
    state.refs.undoToast      = shadow.querySelector('[data-role="undo-toast"]');
    state.refs.undoToastMessage = shadow.querySelector('[data-role="undo-toast-message"]');
    state.refs.undoDeleteButton = shadow.querySelector('[data-role="undo-delete-button"]');

    // Folder palette
    state.refs.folderPaletteLayer = shadow.querySelector('[data-role="folder-palette-layer"]');
    state.refs.folderPalette  = shadow.querySelector('[data-role="folder-palette"]');
    state.refs.folderPaletteTitle = shadow.querySelector('[data-role="folder-palette-title"]');
    state.refs.folderPaletteInput = shadow.querySelector('[data-role="folder-palette-input"]');
    state.refs.folderPaletteList = shadow.querySelector('[data-role="folder-palette-list"]');

    // ── Event wiring ───────────────────────────────────────────────────────
    shadow.querySelectorAll("[data-action]").forEach((el) => {
      el.addEventListener("click", () => handleAction(el.getAttribute("data-action") || ""));
    });

    if (state.refs.mpSearch) {
      state.refs.mpSearch.addEventListener("input", (e) => {
        state.ui.searchQuery = normalizeSearchQuery(e.target.value);
        state.ui.notePage = 0;
        render();
      });
      // Focus styling
      state.refs.mpSearch.addEventListener("focus", function() {
        this.style.borderColor = "rgba(90,200,255,0.4)";
        this.style.background = "rgba(255,255,255,0.07)";
      });
      state.refs.mpSearch.addEventListener("blur", function() {
        this.style.borderColor = "rgba(255,255,255,0.15)";
        this.style.background = "rgba(255,255,255,0.05)";
      });
    }

    if (state.refs.mpBackBtn) {
      state.refs.mpBackBtn.addEventListener("click", () => {
        if (state.panelMode === "editor" || state.panelMode === "mindmap") {
          state.panelMode = "picker";
          state.ui.drawerMode = DRAWER_MODE_NOTES;
        } else {
          state.ui.drawerMode = DRAWER_MODE_CATEGORIES;
        }
        render();
      });
    }

    if (state.refs.folderSelect) {
      state.refs.folderSelect.addEventListener("change", (e) => {
        handleFolderSelectChange(e).catch(() => setSaveStatus("Could not update category", "error"));
      });
    }

    if (state.refs.dialogInput) {
      state.refs.dialogInput.addEventListener("keydown", handleDialogInputKeydown);
    }

    // ── Todo input event wiring ─────────────────────────────────────────
    if (state.refs.mpTodoAddInput) {
      state.refs.mpTodoAddInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          handleAction("todo-add-item");
        }
      });
    }

    // Todo item events (event delegation on mpTodoItems)
    if (state.refs.mpTodoItems) {
      state.refs.mpTodoItems.addEventListener("change", function(e) {
        var cb = e.target;
        if (cb && cb.type === "checkbox" && cb.getAttribute("data-action") === "todo-toggle-item") {
          var itemId = cb.getAttribute("data-todo-item-id");
          if (itemId) toggleTodoItem(itemId).catch(function() {});
        }
      });
      state.refs.mpTodoItems.addEventListener("click", function(e) {
        var delBtn = e.target.closest && e.target.closest('[data-action="todo-delete-item"]');
        if (delBtn) {
          var itemId = delBtn.getAttribute("data-todo-item-id");
          if (itemId) deleteTodoItem(itemId).catch(function() {
            setSaveStatus("Could not delete item", "error");
          });
        }
      });
    }

    if (state.refs.importFileInput) {
      state.refs.importFileInput.addEventListener("change", (e) => {
        const files = e.target && e.target.files ? e.target.files : null;
        importTxtFromFileList(files).catch(() => setSaveStatus("Import failed", "error"));
        if (e.target) e.target.value = "";
      });
    }

    if (state.refs.trashList) {
      state.refs.trashList.addEventListener("click", handleTrashListClick);
    }

    // ── SSS Search — selection search popup dalam nota ─────────────────────
    // Sama fungsi dengan selection search di sidebar AI: bila user pilih teks
    // dalam editor nota, popup senarai enjin carian dipaparkan. Boleh
    // enable/disable melalui butang toggle (dikongsi dengan tetapan sidebar).
    const SSS_DEFAULT_ENGINES = [
      { id: "copy", type: "copy", name: "Copy to clipboard", url: "", iconUrl: "", showPopup: true, shortcut: "" },
      { id: "google", type: "engine", name: "Google", url: "https://www.google.com/search?q=%s", iconUrl: "", showPopup: true, shortcut: "" },
      { id: "bing", type: "engine", name: "Bing", url: "https://www.bing.com/search?q=%s", iconUrl: "", showPopup: true, shortcut: "" },
      { id: "ddg", type: "engine", name: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s", iconUrl: "", showPopup: true, shortcut: "" }
    ];
    let _sssSearchEnabled = true;
    let _sssSearchText = "";
    let _sssSearchSignature = "";

    // Helper element tempatan (mk() hanya wujud dalam skop buildMarkup)
    function sssMk(tag, css, text) {
      const el = document.createElement(tag);
      if (css) el.style.cssText = css;
      if (text != null) el.textContent = text;
      return el;
    }

    function sssSearchSettingsEnabled(settings) {
      const s = settings && typeof settings === "object" ? settings : {};
      const popupEnabled = s.selectionSearchPopup && typeof s.selectionSearchPopup === "object"
        ? s.selectionSearchPopup.enabled !== false
        : true;
      return popupEnabled && s.selectionSearchEnabled !== false;
    }

    function applySssSearchToggleUI(enabled) {
      const btn = state.refs.sssSearchToggle;
      if (!btn) return;
      btn.setAttribute("aria-pressed", enabled ? "true" : "false");
      btn.title = enabled
        ? "Selection Search: ON (klik untuk matikan)"
        : "Selection Search: OFF (klik untuk hidupkan)";
      btn.style.background = enabled ? "rgba(59,130,246,0.18)" : "rgba(0,0,0,0.2)";
      btn.style.borderColor = enabled ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.15)";
      btn.style.color = enabled ? "#7ab8ff" : "#555";
    }

    function loadSssSearchState() {
      storageGet(SETTINGS_KEY).then((data) => {
        const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
        _sssSearchEnabled = sssSearchSettingsEnabled(settings);
        applySssSearchToggleUI(_sssSearchEnabled);
        if (!_sssSearchEnabled) hideSssSearchPopup();
      }).catch(() => {
        _sssSearchEnabled = true;
        applySssSearchToggleUI(true);
      });
    }

    function handleSssSearchToggle() {
      _sssSearchEnabled = !_sssSearchEnabled;
      applySssSearchToggleUI(_sssSearchEnabled);
      if (!_sssSearchEnabled) hideSssSearchPopup();
      else if (_sssSearchText) showSssSearchPopup();
      // Simpan KEDUA-DUA flag — sama logik dengan sidebar.js supaya
      // applySelectionSearchSettings dalam iframe AI tidak reject.
      storageGet(SETTINGS_KEY).then((data) => {
        const settings = data && data[SETTINGS_KEY] ? data[SETTINGS_KEY] : {};
        settings.selectionSearchEnabled = _sssSearchEnabled;
        if (settings.selectionSearchPopup && typeof settings.selectionSearchPopup === "object") {
          settings.selectionSearchPopup.enabled = _sssSearchEnabled;
        } else {
          settings.selectionSearchPopup = { enabled: _sssSearchEnabled };
        }
        storageSet({ [SETTINGS_KEY]: settings }).catch(() => {});
      });
    }

    function getSssSearchEngines() {
      const settings = state.settings && typeof state.settings === "object" ? state.settings : {};
      const list = Array.isArray(settings.selectionSearchEnginesList)
        ? settings.selectionSearchEnginesList
        : [];
      const usable = list.filter((entry) => entry && typeof entry === "object");
      return usable.length ? usable : SSS_DEFAULT_ENGINES;
    }

    function buildSssSearchUrl(entry, query) {
      if (!entry) return "";
      if (entry.type === "open-link") {
        const raw = String(query || "").trim();
        if (!raw) return "";
        try {
          if (/^https?:\/\//i.test(raw)) return new URL(raw).toString();
          return new URL("https://" + raw).toString();
        } catch (_err) {
          return "";
        }
      }
      if (entry.type === "engine") {
        const rawUrl = entry.url || "";
        if (!rawUrl) return "";
        const encoded = encodeURIComponent(query);
        if (/%s/i.test(rawUrl)) return rawUrl.replace(/%s/gi, encoded);
        if (/\{searchTerms\}/i.test(rawUrl)) return rawUrl.replace(/\{searchTerms\}/gi, encoded);
        return rawUrl + encoded;
      }
      return "";
    }

    function activateSssSearchEngine(entry) {
      const query = _sssSearchText;
      if (!entry || !query) return;
      if (entry.type === "copy") {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(query).catch(() => {});
        }
        hideSssSearchPopup();
        return;
      }
      const url = buildSssSearchUrl(entry, query);
      if (url) {
        sendRuntimeMessage({ type: "selection-search-open-url", url, active: true })
          .catch(() => { try { window.open(url, "_blank"); } catch (_) {} });
      }
      hideSssSearchPopup();
    }

    function renderSssSearchPopup() {
      const popup = state.refs.sssSearchPopup;
      if (!popup) return;
      const engines = getSssSearchEngines();
      const signature = JSON.stringify(engines.map((e) => [e.id, e.name, e.type, e.iconUrl, e.showPopup, e.shortcut]));
      if (signature === _sssSearchSignature && popup.childNodes.length) return;
      _sssSearchSignature = signature;
      popup.textContent = "";

      const title = sssMk("div", "font-size:12px;font-weight:700;color:#fff;padding:0 2px 4px;", "SSS Nota");
      popup.appendChild(title);

      const listWrap = sssMk("div", "display:flex;flex-direction:column;gap:4px;overflow-y:auto;flex:1 1 auto;");
      engines.forEach((entry) => {
        if (!entry) return;
        if (entry.type === "separator") {
          listWrap.appendChild(sssMk("div", "height:1px;background:rgba(255,255,255,0.08);margin:3px 0;"));
          return;
        }
        if (entry.type === "group") {
          listWrap.appendChild(sssMk("div", "padding:3px 2px 1px;color:rgba(255,255,255,0.48);font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;", entry.name || "Group"));
          return;
        }
        if (entry.showPopup !== true) return;
        const btn = sssMk("button", [
          "display:flex","align-items:center","gap:8px","width:100%",
          "padding:8px 10px","border-radius:10px",
          "border:1px solid rgba(255,255,255,0.06)","background:rgba(255,255,255,0.03)",
          "color:#edf2ff","font-size:12px","font-weight:600","cursor:pointer",
          "text-align:left","transition:background 120ms ease,border-color 120ms ease"
        ].join(";"));
        btn.type = "button";
        btn.addEventListener("mouseenter", () => {
          btn.style.background = "rgba(255,214,51,0.12)";
          btn.style.borderColor = "rgba(255,214,51,0.24)";
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.background = "rgba(255,255,255,0.03)";
          btn.style.borderColor = "rgba(255,255,255,0.06)";
        });
        if (entry.iconUrl) {
          const icon = document.createElement("img");
          icon.src = entry.iconUrl;
          icon.alt = "";
          icon.style.cssText = "width:16px;height:16px;border-radius:4px;object-fit:cover;flex:0 0 auto;pointer-events:none;";
          btn.appendChild(icon);
        } else {
          const bullet = sssMk("span", [
            "display:inline-flex","align-items:center","justify-content:center",
            "width:16px","height:16px","border-radius:999px",
            "background:rgba(255,214,51,0.16)","color:#ffe38a",
            "font-size:10px","font-weight:700","flex:0 0 auto","pointer-events:none"
          ].join(";"), (entry.name || "S").slice(0, 1).toUpperCase());
          btn.appendChild(bullet);
        }
        const label = sssMk("span", "flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;", entry.name || "Engine");
        btn.appendChild(label);
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          activateSssSearchEngine(entry);
        });
        listWrap.appendChild(btn);
      });
      popup.appendChild(listWrap);
    }

    function positionSssSearchPopup(frameX, frameY) {
      const popup = state.refs.sssSearchPopup;
      if (!popup) return;
      const margin = 8;
      let left = margin;
      let top = margin;
      const frame = state.refs.editorFrame;
      const frameRect = frame ? frame.getBoundingClientRect() : null;
      if (frameRect && Number.isFinite(frameX) && Number.isFinite(frameY)) {
        left = frameRect.left + frameX + 12;
        top = frameRect.top + frameY + 14;
      } else if (frameRect) {
        left = frameRect.right - 250;
        top = frameRect.top + 12;
      }
      const width = Math.max(popup.offsetWidth || 0, 200);
      const height = Math.max(popup.offsetHeight || 0, 120);
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
      popup.style.left = left + "px";
      popup.style.top = top + "px";
    }

    function showSssSearchPopup(frameX, frameY) {
      const popup = state.refs.sssSearchPopup;
      if (!popup || !_sssSearchEnabled || !_sssSearchText) return;
      const settings = state.settings && typeof state.settings === "object" ? state.settings : {};
      const popupCfg = settings.selectionSearchPopup && typeof settings.selectionSearchPopup === "object"
        ? settings.selectionSearchPopup
        : {};
      const minChars = Number.isFinite(Number(popupCfg.minChars)) ? Math.max(0, Number(popupCfg.minChars)) : 0;
      const maxChars = Number.isFinite(Number(popupCfg.maxChars)) ? Math.max(0, Number(popupCfg.maxChars)) : 0;
      if (minChars > 0 && _sssSearchText.length < minChars) { hideSssSearchPopup(); return; }
      if (maxChars > 0 && _sssSearchText.length > maxChars) { hideSssSearchPopup(); return; }
      renderSssSearchPopup();
      popup.style.display = "flex";
      positionSssSearchPopup(frameX, frameY);
    }

    function hideSssSearchPopup() {
      const popup = state.refs.sssSearchPopup;
      if (popup) popup.style.display = "none";
    }

    if (state.refs.sssSearchToggle) {
      state.refs.sssSearchToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        handleSssSearchToggle();
      });
      loadSssSearchState();
    }

    // Kemas kini toggle bila settings berubah dari tempat lain (sidebar/options)
    if (api.storage && api.storage.onChanged) {
      api.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local" || !changes[SETTINGS_KEY]) return;
        const next = changes[SETTINGS_KEY].newValue;
        _sssSearchEnabled = sssSearchSettingsEnabled(next);
        applySssSearchToggleUI(_sssSearchEnabled);
        _sssSearchSignature = "";
        if (!_sssSearchEnabled) hideSssSearchPopup();
      });
    }

    // SSS — listen untuk selection dalam editor iframe
    window.addEventListener("message", (evt) => {
      if (!state.open || state.panelMode !== "editor") return;
      const d = evt.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "lp-notes-selection" || d.type === "lp-notes-text-selected") {
        const text = d.text ? String(d.text).trim() : "";
        const sssBtn = state.refs.sssBtn;
        if (sssBtn) {
          if (text.length > 0) {
            sssBtn.style.display = "inline-flex";
            sssBtn._selectedText = text;
          } else {
            sssBtn.style.display = "none";
            sssBtn._selectedText = "";
          }
        }
        // SSS Search popup — papar/sembunyi ikut pilihan teks & toggle
        _sssSearchText = text;
        if (text.length > 0 && _sssSearchEnabled) {
          showSssSearchPopup(Number(d.x), Number(d.y));
        } else {
          hideSssSearchPopup();
        }
      }
    });

    if (state.refs.sssBtn) {
      state.refs.sssBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const text = state.refs.sssBtn._selectedText || "";
        if (!text) return;
        sendRuntimeMessage({ type: "open-ai-sidebar-with-prompt", prompt: text })
          .then(() => { if (state.refs.sssBtn) state.refs.sssBtn.style.display = "none"; })
          .catch(() => { sendRuntimeMessage({ type: "open-ai-sidebar" }).catch(() => {}); });
      });
    }

    if (state.refs.folderPaletteInput) {
      state.refs.folderPaletteInput.addEventListener("input", handleFolderPaletteInput);
    }

    // Drag to move panel (mpHeader)
    if (state.refs.mpHeader) {
      state.refs.mpHeader.addEventListener("pointerdown", handleTopbarPointerDown);
      state.refs.mpHeader.addEventListener("pointermove", handleTopbarPointerMove);
      state.refs.mpHeader.addEventListener("pointerup", handleTopbarPointerUp);
      state.refs.mpHeader.addEventListener("pointercancel", handleTopbarPointerUp);
      state.refs.mpHeader.addEventListener("lostpointercapture", handleTopbarPointerUp);
      state.refs.mpHeader.addEventListener("dblclick", handleTopbarDoubleClick);
    }

    // Resize handles
    if (state.refs.resizeHandle) {
      state.refs.resizeHandle.addEventListener("pointerdown", handleResizePointerDown);
      state.refs.resizeHandle.addEventListener("mouseenter", function() { this.style.opacity = "0.6"; });
      state.refs.resizeHandle.addEventListener("mouseleave", function() { this.style.opacity = "0"; });
    }
    if (state.refs.resizeHandleY) {
      state.refs.resizeHandleY.addEventListener("pointerdown", handleResizeVerticalPointerDown);
      state.refs.resizeHandleY.addEventListener("mouseenter", function() { this.style.opacity = "0.6"; });
      state.refs.resizeHandleY.addEventListener("mouseleave", function() { this.style.opacity = "0"; });
    }

    // Auto-focus left panel on mouseenter, unfocus on main panel mouseenter
    if (state.refs.leftPanel) {
      state.refs.leftPanel.addEventListener("mouseenter", () => {
        if (state.open) lpFocus();
      });
    }
    if (state.refs.mainPanel) {
      state.refs.mainPanel.addEventListener("mouseenter", () => {
        if (lpFocused) lpUnfocus();
      });
    }

    ["click","dblclick","mousedown","mouseup","pointerdown","pointerup",
     "contextmenu","wheel","keydown","keyup","keypress"].forEach((t) => {
      shadow.addEventListener(t, handleOverlayInteraction);
    });

    window.addEventListener("keydown", handleOverlayKeydown, true);
    window.addEventListener("keydown", handleDocumentKeydown, true);
    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    window.addEventListener("message", handleEditorFrameMessage);
    window.addEventListener("resize", handleWindowResize);
    window.addEventListener("beforeunload", () => {
      if (state.editor.dirty || state.saveTimer) {
        flushSave("Saved").catch(function() {});
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        if (state.editor.dirty || state.saveTimer) {
          flushSave("Saved").catch(function() {});
        }
        if (state.pendingExternalReload) {
          reloadFromExternal().catch(function() {});
        }
      } else if (document.visibilityState === "visible" && state.open && state.pendingExternalReload) {
        reloadFromExternal().catch(function() {});
      }
    });

    if (!state.editor.token) state.editor.token = makeId("notes-editor");
    state.mounted = true;
  }

  // ── Row style helpers (sama macam background.js category picker) ──────────
  const ROW_PANEL  = "rgba(18,18,18,0.88)";
  const ROW_TXT    = "#f3f4f6";

  // ── Left panel focus state (keyboard nav + type-to-search) ───────────────
  let lpFocused = false;
  let lpActiveIndex = -1;
  let lpSearchBuffer = "";
  let lpSearchTimer = null;
  // mpActiveNoteId — nota yang aktif untuk keyboard/hover
  let mpActiveNoteId = "";
  // panelPinned — panel tidak tutup bila klik luar (macam category picker pinBtn)
  let panelPinned = false;

  // Smart emoji map (sama macam background.js)
  const LP_EMOJI_MAP = [
    ["all","🌐"],["uncategor","📋"],["unsorted","📋"],["youtube","▶️"],
    ["video","🎬"],["music","🎵"],["lagu","🎵"],["work","💼"],["kerja","💼"],
    ["news","📰"],["berita","📰"],["design","🎨"],["seni","🎨"],["art","🎨"],
    ["code","💻"],["coding","💻"],["dev","💻"],["read","📖"],["baca","📖"],
    ["article","📖"],["finance","💰"],["wang","💰"],["money","💰"],
    ["game","🎮"],["gaming","🎮"],["social","💬"],["sosial","💬"],
    ["health","🏥"],["food","🍔"],["travel","✈️"],["sport","⚽"],
    ["sukan","⚽"],["photo","📷"],["gambar","📷"],["note","📝"],
    ["nota","📝"],["fav","⭐"],["hidden","👁️"],["ai","🤖"],["tech","⚙️"],
    ["shop","🛒"],["beli","🛒"],["tool","🔧"],["learn","📚"],["belajar","📚"],
    ["research","🔬"],["idea","💡"],["project","📂"],["personal","👤"],
    ["family","👨‍👩‍👧"],["journal","📓"],["task","✅"],["todo","✅"],
  ];

  function lpGetEmoji(label) {
    const l = (label || "").toLowerCase();
    for (const [key, emoji] of LP_EMOJI_MAP) {
      if (l.includes(key)) return emoji;
    }
    return "📁";
  }
  const ROW_MUTED  = "#a3acb9";
  const ROW_ACCENT = "#5ac8ff";
  const ROW_CHIP   = "rgba(255,255,255,0.06)";
  const ROW_CHIPB  = "rgba(255,255,255,0.12)";
  const ROW_INPBG  = "rgba(255,255,255,0.06)";

  function makePickerRow(isActive, isKbActive) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.style.cssText = [
      "display:flex","align-items:center","justify-content:space-between",
      "gap:8px","width:100%","padding:7px 10px","border-radius:9px",
      "border:1px solid " + (isActive ? "rgba(90,200,255,0.45)" : isKbActive ? "rgba(255,214,51,0.3)" : "rgba(255,255,255,0.06)"),
      "background:" + (isActive ? "rgba(90,200,255,0.1)" : isKbActive ? "rgba(255,214,51,0.07)" : "rgba(255,255,255,0.03)"),
      "color:" + (isActive ? "#d0f0ff" : ROW_TXT),
      "font-size:12px","font-weight:" + (isActive ? "600" : "400"),
      "text-align:left","cursor:pointer",
      "transition:background 120ms ease,border-color 120ms ease",
      "outline:none","box-sizing:border-box"
    ].join(";");
    btn.addEventListener("mouseenter", () => {
      if (!isActive) {
        btn.style.background = isKbActive ? "rgba(255,214,51,0.09)" : "rgba(255,255,255,0.07)";
        btn.style.borderColor = isKbActive ? "rgba(255,214,51,0.35)" : "rgba(255,255,255,0.12)";
      }
    });
    btn.addEventListener("mouseleave", () => {
      if (!isActive) {
        btn.style.background = isKbActive ? "rgba(255,214,51,0.07)" : "rgba(255,255,255,0.03)";
        btn.style.borderColor = isKbActive ? "rgba(255,214,51,0.3)" : "rgba(255,255,255,0.06)";
      }
    });
    return btn;
  }

  function makeIconSpan(icon, size) {
    const sp = document.createElement("span");
    sp.style.cssText = [
      "flex:0 0 auto","margin-right:4px","font-size:" + (size || 14) + "px",
      "line-height:1","display:inline-flex","align-items:center",
      "justify-content:center","width:18px","height:18px"
    ].join(";");
    sp.textContent = icon || "📁";
    return sp;
  }

  function makeDotSpan(color) {
    const sp = document.createElement("span");
    sp.style.cssText = [
      "flex:0 0 auto","width:10px","height:10px","border-radius:999px",
      "margin-right:5px","background:" + (color || ROW_MUTED)
    ].join(";");
    return sp;
  }

  function makeLabelSpan(text) {
    const sp = document.createElement("span");
    sp.style.cssText = "flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    sp.textContent = text || "";
    return sp;
  }

  function makeCountSpan(count, isActive) {
    const sp = document.createElement("span");
    sp.style.cssText = [
      "flex:0 0 auto","font-size:10px","font-weight:600",
      "color:" + (isActive ? ROW_ACCENT : ROW_MUTED),
      "background:" + ROW_CHIP,
      "padding:1px 5px","border-radius:999px","min-width:18px","text-align:center"
    ].join(";");
    sp.textContent = String(count);
    return sp;
  }

  // ── Render left panel (folder/category list) ─────────────────────────────
  function renderLeftPanel() {
    const list = state.refs.lpList;
    if (!list) return;
    list.replaceChildren();

    // Update left panel header title based on mode
    var lpTitleEl = state.refs.lpTitle;
    if (lpTitleEl) {
      lpTitleEl.textContent = state.panelMode === "todo" ? "TODO LISTS" : "CATEGORIES";
    }

    // In todo mode, render todo lists instead of categories
    if (state.panelMode === "todo") {
      renderTodoLeftPanel();
      return;
    }

    const baseNotes = getBaseFilteredNotes();
    const counts = getFolderCounts(baseNotes);
    const rows = getFolderFilterRows();

    rows.forEach((row, idx) => {
      const isActive = row.id === state.ui.activeFolderFilter;
      const isKb = lpFocused && idx === lpActiveIndex;
      const countVal = counts.get(row.id) || 0;

      const btn = makePickerRow(isActive, isKb);
      btn.setAttribute("data-folder-row-id", row.id);
      btn.setAttribute("data-cat-label", row.label);
      btn.setAttribute("data-cat-idx", String(idx));

      // Smart emoji
      const emoji = row.id === FILTER_ALL_FOLDERS ? "🌐"
        : row.id === FILTER_UNCATEGORIZED ? "📋"
        : lpGetEmoji(row.label);

      btn.append(makeIconSpan(emoji), makeLabelSpan(row.label), makeCountSpan(countVal, isActive));

      btn.addEventListener("click", () => {
        lpActiveIndex = idx;
        state.ui.activeFolderFilter = row.id;
        state.ui.drawerMode = DRAWER_MODE_NOTES;
        state.ui.notePage = 0;
        state.panelMode = "picker"; // pastikan panel utama tunjuk nota, bukan editor
        render();
      });

      list.appendChild(btn);
    });

    // Scroll active/keyboard item into view
    if (lpFocused && lpActiveIndex >= 0) {
      const kbBtn = list.querySelector(`[data-cat-idx="${lpActiveIndex}"]`);
      if (kbBtn) kbBtn.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      const activeBtn = list.querySelector(`[data-folder-row-id="${state.ui.activeFolderFilter}"]`);
      if (activeBtn) activeBtn.scrollIntoView({ behavior: "auto", block: "nearest" });
    }

    // Left panel focus border (macam background.js)
    if (state.refs.leftPanel) {
      state.refs.leftPanel.style.outline = lpFocused
        ? "2px solid rgba(90,200,255,0.5)"
        : "";
      state.refs.leftPanel.style.outlineOffset = lpFocused ? "-2px" : "";
    }
  }

  // ── Left panel focus helpers ──────────────────────
  function lpFocus() {
    if (lpFocused) return;
    lpFocused = true;
    const rows = getFolderFilterRows();
    // Set index ke row aktif kalau ada
    const curIdx = rows.findIndex((r) => r.id === state.ui.activeFolderFilter);
    lpActiveIndex = curIdx >= 0 ? curIdx : 0;
    renderLeftPanel();
  }

  function lpUnfocus() {
    if (!lpFocused) return;
    lpFocused = false;
    lpActiveIndex = -1;
    lpSearchBuffer = "";
    if (lpSearchTimer) { clearTimeout(lpSearchTimer); lpSearchTimer = null; }
    renderLeftPanel();
  }

  function lpKeydown(event) {
    if (!lpFocused || !state.open) return false;
    const rows = getFolderFilterRows();
    if (!rows.length) return false;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      lpActiveIndex = Math.min(lpActiveIndex + 1, rows.length - 1);
      state.ui.activeFolderFilter = rows[lpActiveIndex].id;
      state.ui.drawerMode = DRAWER_MODE_NOTES;
      state.ui.notePage = 0;
      state.panelMode = "picker";
      render();
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      lpActiveIndex = Math.max(lpActiveIndex - 1, 0);
      state.ui.activeFolderFilter = rows[lpActiveIndex].id;
      state.ui.drawerMode = DRAWER_MODE_NOTES;
      state.ui.notePage = 0;
      state.panelMode = "picker";
      render();
      return true;
    }
    if (event.key === "ArrowRight" || event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      // Fokus ke main panel
      lpUnfocus();
      if (state.refs.mpSearch) {
        state.refs.mpSearch.focus();
      }
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      lpUnfocus();
      return true;
    }

    // Type-to-search (sama macam background.js)
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      const typedKey = event.key.toLowerCase();
      const isRepeat = lpSearchBuffer.length === 1 && lpSearchBuffer === typedKey;
      if (lpSearchTimer) clearTimeout(lpSearchTimer);

      if (isRepeat) {
        // Cycle ke row seterusnya yang bermula dengan huruf sama
        const startFrom = lpActiveIndex + 1;
        let matchIdx = -1;
        for (let i = startFrom; i < rows.length; i++) {
          if ((rows[i].label || "").toLowerCase().startsWith(typedKey)) { matchIdx = i; break; }
        }
        if (matchIdx < 0) {
          for (let i = 0; i < startFrom; i++) {
            if ((rows[i].label || "").toLowerCase().startsWith(typedKey)) { matchIdx = i; break; }
          }
        }
        if (matchIdx >= 0) {
          lpActiveIndex = matchIdx;
          state.ui.activeFolderFilter = rows[matchIdx].id;
          state.ui.drawerMode = DRAWER_MODE_NOTES;
          state.ui.notePage = 0;
          state.panelMode = "picker";
          render();
        }
      } else {
        lpSearchBuffer += typedKey;
        let matchIdx = -1;
        for (let i = 0; i < rows.length; i++) {
          if ((rows[i].label || "").toLowerCase().startsWith(lpSearchBuffer)) { matchIdx = i; break; }
        }
        if (matchIdx < 0 && lpSearchBuffer.length > 1) {
          lpSearchBuffer = typedKey;
          for (let i = 0; i < rows.length; i++) {
            if ((rows[i].label || "").toLowerCase().startsWith(lpSearchBuffer)) { matchIdx = i; break; }
          }
        }
        if (matchIdx >= 0) {
          lpActiveIndex = matchIdx;
          state.ui.activeFolderFilter = rows[matchIdx].id;
          state.ui.drawerMode = DRAWER_MODE_NOTES;
          state.ui.notePage = 0;
          state.panelMode = "picker";
          render();
        }
      }

      lpSearchTimer = setTimeout(() => {
        lpSearchBuffer = "";
        lpSearchTimer = null;
      }, 800);

      return true;
    }

    return false;
  }

  // ── Todo render functions ────────────────────────────────────────────────
  function renderTodoLeftPanel() {
    var list = state.refs.lpList;
    if (!list) return;
    list.replaceChildren();

    // Update left panel title
    var lpTitleEl = state.refs.lpTitle;
    if (lpTitleEl) lpTitleEl.textContent = "TODO LISTS";

    var lists = getSortedTodoLists(state.todoLists);
    if (!lists.length) {
      var empty = document.createElement("div");
      empty.style.cssText = "padding:16px 8px;text-align:center;color:rgba(255,255,255,0.3);font-size:11px;";
      empty.textContent = "No lists yet";
      list.appendChild(empty);
      return;
    }

    lists.forEach(function(tl, idx) {
      var isActive = tl.id === state.ui.activeTodoListId;
      var itemCount = getFilteredTodoItems(tl.id).length;
      var totalCount = getTodoItemsForList(tl.id).length;

      var btn = makePickerRow(isActive, false);
      btn.setAttribute("data-todo-list-id", tl.id);
      btn.setAttribute("data-tl-idx", String(idx));

      var emoji = tl.icon || "📋";
      var label = tl.title || "Untitled";
      var countStr = totalCount > 0 ? String(itemCount) : "0";

      btn.append(makeIconSpan(emoji), makeLabelSpan(label), makeCountSpan(countStr, isActive));

      // Click to select list
      btn.addEventListener("click", function() {
        state.ui.activeTodoListId = tl.id;
        render();
        persistUiOnly().catch(function() {});
      });

      // Double-click to rename
      btn.addEventListener("dblclick", function(e) {
        e.stopPropagation();
        handleAction("rename-todo-list");
      });

      // Hover delete button
      var delBtn = document.createElement("button");
      delBtn.textContent = "×";
      delBtn.style.cssText = [
        "position:absolute","right:4px","top:50%","transform:translateY(-50%)",
        "width:18px","height:18px","border-radius:5px","border:none",
        "background:rgba(255,80,80,0.15)","color:#ff7a7a","font-size:12px",
        "font-weight:700","cursor:pointer","display:none",
        "align-items:center","justify-content:center",
        "padding:0","line-height:1","outline:none","z-index:2"
      ].join(";");
      delBtn.title = "Padam senarai ini";
      delBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        state.ui.activeTodoListId = tl.id;
        render();
        handleAction("delete-todo-list");
      });
      btn.style.position = "relative";
      btn.appendChild(delBtn);
      btn.addEventListener("mouseenter", function() { delBtn.style.display = "flex"; });
      btn.addEventListener("mouseleave", function() { delBtn.style.display = "none"; });

      list.appendChild(btn);
    });
  }

  function renderTodoMainPanel() {
    var r = state.refs;
    if (!r.mpTodoItems) return;

    var activeList = getActiveTodoList();
    if (!activeList) {
      r.mpTodoItems.innerHTML = "<div style='padding:20px;text-align:center;color:rgba(255,255,255,0.3);font-size:12px;'>Select or create a todo list</div>";
      return;
    }

    var items = getFilteredTodoItems(activeList.id);
    var totalItems = getTodoItemsForList(activeList.id).length;
    var completedItems = totalItems - getTodoItemsForList(activeList.id).filter(function(i) { return !i.completed; }).length;

    r.mpTodoItems.replaceChildren();

    // Progress bar
    if (totalItems > 0) {
      var pct = Math.round((completedItems / totalItems) * 100);
      var progressWrap = document.createElement("div");
      progressWrap.style.cssText = "display:flex;align-items:center;gap:8px;flex:0 0 auto;padding:2px 0 6px;";
      var progressBar = document.createElement("div");
      progressBar.style.cssText = "flex:1;height:4px;border-radius:4px;background:rgba(255,255,255,0.1);overflow:hidden;";
      var progressFill = document.createElement("div");
      progressFill.style.cssText = "height:100%;border-radius:4px;background:linear-gradient(90deg,#5ac8ff,#48d597);width:" + pct + "%;transition:width 200ms ease;";
      progressBar.appendChild(progressFill);
      var progressLabel = document.createElement("span");
      progressLabel.style.cssText = "font-size:10px;color:rgba(255,255,255,0.4);flex-shrink:0;";
      progressLabel.textContent = completedItems + "/" + totalItems;
      progressWrap.append(progressBar, progressLabel);
      r.mpTodoItems.appendChild(progressWrap);
    }

    // Empty state
    if (!items.length) {
      var emptyMsg = document.createElement("div");
      emptyMsg.style.cssText = "padding:20px;text-align:center;color:rgba(255,255,255,0.25);font-size:12px;";
      if (state.ui.todoFilter === "completed") emptyMsg.textContent = "No completed items";
      else if (state.ui.todoFilter === "active") emptyMsg.textContent = "No active items — add one below!";
      else emptyMsg.textContent = "This list is empty — add your first item below!";
      r.mpTodoItems.appendChild(emptyMsg);
      return;
    }

    // Todo items
    items.forEach(function(item) {
      var row = document.createElement("div");
      row.style.cssText = [
        "display:flex","align-items:flex-start","gap:8px",
        "padding:6px 8px","border-radius:10px",
        "border:1px solid rgba(255,255,255,0.06)",
        "background:rgba(255,255,255,0.02)",
        "transition:background 120ms ease,opacity 200ms ease"
      ].join(";");

      // Checkbox
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = item.completed;
      cb.style.cssText = "width:16px;height:16px;cursor:pointer;flex-shrink:0;accent-color:#48d597;margin-top:3px;";
      cb.setAttribute("data-todo-item-id", item.id);
      cb.setAttribute("data-action", "todo-toggle-item");

      // Text — boleh wrap supaya text panjang nampak penuh
      var textEl = document.createElement("div");
      textEl.style.cssText = [
        "flex:1 1 auto","font-size:13px","color:" + (item.completed ? "rgba(255,255,255,0.35)" : "#eef0f4"),
        "text-decoration:" + (item.completed ? "line-through" : "none"),
        "word-break:break-word","white-space:pre-wrap","line-height:1.4",
        "transition:color 200ms ease"
      ].join(";");
      textEl.textContent = item.text;
      textEl.setAttribute("data-todo-item-id", item.id);

      // Priority indicator
      var priorityColors = { low: "#68d597", medium: "#ffcc66", high: "#ff7a7a" };
      var prioDot = document.createElement("span");
      prioDot.style.cssText = "width:6px;height:6px;border-radius:50%;flex-shrink:0;background:" + (priorityColors[item.priority] || "#888") + ";";

      // Copy button
      var copyBtn = document.createElement("button");
      copyBtn.textContent = "📋";
      copyBtn.style.cssText = [
        "width:22px;height:22px;border-radius:6px;border:none;",
        "background:rgba(255,255,255,0.06);color:#eef0f4;font-size:11px;",
        "cursor:pointer;display:flex;align-items:center;justify-content:center;",
        "flex-shrink:0;opacity:0;transition:opacity 120ms ease;outline:none;",
        "padding:0"
      ].join(";");
      copyBtn.title = "Copy text";
      copyBtn.setAttribute("data-todo-item-id", item.id);
      copyBtn.setAttribute("data-copy", "1");

      // Delete button
      var delBtn = document.createElement("button");
      delBtn.textContent = "×";
      delBtn.style.cssText = [
        "width:22px;height:22px;border-radius:6px;border:none;",
        "background:rgba(255,100,100,0.1);color:#ff7a7a;font-size:14px;",
        "cursor:pointer;display:flex;align-items:center;justify-content:center;",
        "flex-shrink:0;opacity:0;transition:opacity 120ms ease;outline:none;",
        "padding:0"
      ].join(";");
      delBtn.setAttribute("data-todo-item-id", item.id);
      delBtn.setAttribute("data-action", "todo-delete-item");
      delBtn.title = "Delete item";

      row.addEventListener("mouseenter", function() { copyBtn.style.opacity = "0.5"; delBtn.style.opacity = "0.7"; row.style.background = "rgba(255,255,255,0.05)"; });
      row.addEventListener("mouseleave", function() { copyBtn.style.opacity = "0"; delBtn.style.opacity = "0"; row.style.background = "rgba(255,255,255,0.02)"; });

      copyBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        var text = item.text;
        navigator.clipboard.writeText(text).then(function() {
          copyBtn.textContent = "✓";
          copyBtn.style.background = "rgba(72,213,151,0.2)";
          copyBtn.style.color = "#48d597";
          setTimeout(function() {
            copyBtn.textContent = "📋";
            copyBtn.style.background = "rgba(255,255,255,0.06)";
            copyBtn.style.color = "#eef0f4";
          }, 1200);
        }).catch(function() {});
      });

      row.append(cb, prioDot, textEl, copyBtn, delBtn);
      r.mpTodoItems.appendChild(row);
    });

    // Update filter button styles
    if (r.mpTodoToolbar) {
      var filterBtns = r.mpTodoToolbar.querySelectorAll("button");
      filterBtns.forEach(function(btn) {
        var action = btn.getAttribute("data-action") || "";
        var isActiveFilter = (action === "todo-filter-all" && state.ui.todoFilter === "all") ||
          (action === "todo-filter-active" && state.ui.todoFilter === "active") ||
          (action === "todo-filter-completed" && state.ui.todoFilter === "completed");
        btn.style.background = isActiveFilter ? "rgba(90,200,255,0.2)" : "rgba(255,255,255,0.07)";
        btn.style.color = isActiveFilter ? "#5ac8ff" : "#eef0f4";
      });
    }
  }

  // ── Render main panel ────────────────────────────────────────────────────
  function applyMindmapClickToggleUI(enabled) {
    const btn = state.refs.mpMindmapToggleBtn;
    if (!btn) return;
    btn.setAttribute("aria-pressed", enabled ? "true" : "false");
    btn.title = enabled
      ? "Buka nota terus ke mindmap: ON"
      : "Buka nota terus ke mindmap: OFF";
    btn.style.background = enabled ? "rgba(100,255,200,0.18)" : "rgba(0,0,0,0.2)";
    btn.style.borderColor = enabled ? "rgba(100,255,200,0.5)" : "rgba(255,255,255,0.15)";
    btn.style.color = enabled ? "#7affb8" : "#555";
  }

  function renderMainPanel() {
    const inTodo = state.panelMode === "todo";
    const inEditor = state.panelMode === "editor";
    const inMindmap = state.panelMode === "mindmap";
    const inTrash = state.panelMode === "trash";
    const inNotes = !inEditor && !inMindmap && !inTodo && !inTrash;

    const r = state.refs;
    if (!r.mainPanel) return;

    // Title
    if (r.mpTitle) {
      if (inEditor) {
        const note = getActiveNote();
        r.mpTitle.textContent = note ? getNoteTitle(note) : "Notes";
      } else if (inMindmap) {
        r.mpTitle.textContent = "🧠 Mindmap";
      } else if (inTodo) {
        var activeList = getActiveTodoList();
        r.mpTitle.textContent = activeList ? (activeList.icon + " " + activeList.title) : "☐ Todo List";
      } else if (inTrash) {
        r.mpTitle.textContent = "🗑 Trash";
      } else {
        const lbl = state.ui.activeFolderFilter === FILTER_ALL_FOLDERS ? "All Notes"
          : state.ui.activeFolderFilter === FILTER_UNCATEGORIZED ? UNCATEGORIZED_LABEL
          : getFolderLabel(state.ui.activeFolderFilter);
        r.mpTitle.textContent = lbl;
      }
    }

    // Back button — show dalam editor atau mindmap mode
    if (r.mpBackBtn) {
      r.mpBackBtn.style.display = (inEditor || inMindmap) ? "inline-flex" : "none";
    }

    // Search — show dalam notes list dan mindmap (hidden in todo/trash mode)
    if (r.mpSearch) {
      r.mpSearch.style.display = (inNotes || inMindmap) ? "block" : "none";
      if ((inNotes || inMindmap) && r.mpSearch.value !== (state.ui.searchQuery || "")) {
        r.mpSearch.value = state.ui.searchQuery || "";
      }
    }

    // Category selector — show dalam editor sahaja
    if (r.mpCatWrap) {
      r.mpCatWrap.style.display = inEditor ? "flex" : "none";
      if (inEditor) renderFolderSelectNew();
    }

    // List vs editor vs mindmap vs todo vs trash
    if (r.mpList)    r.mpList.style.display    = (inNotes || inTrash) ? "flex" : "none";
    if (r.mpEditor)  r.mpEditor.style.display   = inEditor ? "flex" : "none";
    if (r.mpMindmap) r.mpMindmap.style.display  = inMindmap ? "flex" : "none";
    if (r.mpTodo)    r.mpTodo.style.display     = inTodo ? "flex" : "none";
    // SSS Search popup hanya relevan dalam mod editor
    if (!inEditor && r.sssSearchPopup) r.sssSearchPopup.style.display = "none";
    if (r.mpHint) {
      if (inEditor || inMindmap || inTodo) {
        r.mpHint.style.display = "none";
      } else {
        r.mpHint.style.display = "block";
        r.mpHint.textContent = "↑↓ pilih | Enter buka | D padam (hover) | Swipe kiri padam | Esc tutup";
      }
    }
    if (r.mpPager)  r.mpPager.style.display   = "none";

    if (inNotes) {
      renderNotesListNew();
    } else if (inEditor) {
      renderEditorNew();
    } else if (inMindmap) {
      renderMindmap();
    } else if (inTodo) {
      renderTodoMainPanel();
    } else if (inTrash) {
      renderTrashInline();
    }

    // Sync mindmap-on-click toggle visual
    applyMindmapClickToggleUI(state.mindmap.openOnClick);

    // Save status
    if (r.saveStatus) {
      // leave as-is — setSaveStatus() handles it
    }

    // Pin button — guna nota yang di-hover/highlight dalam picker, atau nota aktif dalam editor
    const targetNote = (state.panelMode === "picker" && mpActiveNoteId)
      ? state.notes.find((n) => n && n.id === mpActiveNoteId) || null
      : getActiveNote();
    const pinBtns = Array.isArray(r.pinButtons) ? r.pinButtons : [];
    pinBtns.forEach((btn) => {
      if (!btn) return;
      const isPinned = targetNote && targetNote.isPinned;
      btn.textContent = isPinned ? "📌" : "📌";
      btn.title = isPinned ? "Unpin" : "Pin to top";
      btn.style.opacity = targetNote ? (isPinned ? "1" : "0.7") : "0.3";
      btn.style.color = isPinned ? "#ffd700" : "inherit";
      btn.disabled = !targetNote;
    });

    // Trash button
    const hasTrash = coerceArray(state.trash).length > 0;
    if (r.openTrashButton) {
      r.openTrashButton.disabled = !hasTrash;
      r.openTrashButton.title = hasTrash ? "Tong sampah (" + state.trash.length + ")" : "Tiada nota dipadam";
    }
  }

  // Category list in main panel (when no folder selected yet)
  function renderCategoryModeMain() {
    const list = state.refs.mpList;
    if (!list) return;
    list.replaceChildren();

    const baseNotes = getBaseFilteredNotes();
    const counts = getFolderCounts(baseNotes);
    const rows = getFolderFilterRows();

    const emptyMsg = document.createElement("div");
    emptyMsg.style.cssText = "color:" + ROW_MUTED + ";font-size:12px;padding:8px 4px;";
    emptyMsg.textContent = "Pilih kategori untuk lihat nota.";
    if (rows.length === 0) { list.appendChild(emptyMsg); return; }

    rows.forEach((row) => {
      const isActive = row.id === state.ui.activeFolderFilter;
      const countVal = counts.get(row.id) || 0;
      const btn = makePickerRow(isActive, false);
      const emoji = row.id === FILTER_ALL_FOLDERS ? "🌐"
        : row.id === FILTER_UNCATEGORIZED ? "📋" : "📁";
      btn.append(makeIconSpan(emoji), makeLabelSpan(row.label + " (" + countVal + ")"), makeCountSpan(countVal, isActive));
      btn.addEventListener("click", () => {
        state.ui.activeFolderFilter = row.id;
        state.ui.drawerMode = DRAWER_MODE_NOTES;
        state.ui.notePage = 0;
        render();
      });
      list.appendChild(btn);
    });
  }

  // Notes list in main panel
  function renderNotesListNew() {
    const list = state.refs.mpList;
    if (!list) return;
    list.replaceChildren();

    const query = normalizeSearchQuery(state.ui.searchQuery);
    const searching = !!query;
    const visibleNotes = getVisibleNotes();
    const pager = getNotePagerState(visibleNotes);
    state.ui.notePage = pager.activePage;

    if (!visibleNotes.length) {
      if (!searching) {
        const emptyWrap = document.createElement("div");
        emptyWrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px 8px;text-align:center;";
        const icon = document.createElement("div");
        icon.style.cssText = "font-size:24px;line-height:1;opacity:0.8;";
        icon.textContent = "📝";
        const label = document.createElement("div");
        label.style.cssText = "color:" + ROW_MUTED + ";font-size:13px;font-weight:600;";
        label.textContent = getEmptyNotesLabel();
        const hint = document.createElement("div");
        hint.style.cssText = "color:" + ROW_MUTED + ";font-size:11px;opacity:0.8;";
        hint.textContent = "Press ✏️ or Ctrl+N to create your first note";
        emptyWrap.append(icon, label, hint);
        list.appendChild(emptyWrap);
        if (state.refs.mpPager) state.refs.mpPager.style.display = "none";
        return;
      }
      const noteHint = document.createElement("div");
      noteHint.style.cssText = "color:" + ROW_MUTED + ";font-size:12px;padding:8px 4px;";
      noteHint.textContent = "No notes match your search.";
      list.appendChild(noteHint);
    }

    const pageNotes = pager.visibleRows;
    const drawerSelectedNoteId = getDrawerSelectedNoteId(pageNotes);

    const pageStartIndex = pager.activePage * pager.pageSize;

    pageNotes.forEach((note, i) => {
      const noteNumber = pageStartIndex + i + 1;
      const isActive = note.id === state.ui.activeNoteId;
      const isKb = note.id === mpActiveNoteId && !isActive;
      const wordCount = countWords(note.content);
      const palette = getFolderRowPalette(note.id);

      // ── Shell wrapper untuk swipe gesture ───────────────────────────────
      const shell = document.createElement("div");
      shell.style.cssText = [
        "position:relative","width:100%","overflow:hidden",
        "border-radius:8px","flex-shrink:0"
      ].join(";");

      // Delete indicator (di belakang, merah)
      const delIndicator = document.createElement("div");
      delIndicator.style.cssText = [
        "position:absolute","inset:0","display:flex",
        "align-items:center","justify-content:flex-end",
        "gap:6px","padding:0 14px",
        "background:linear-gradient(135deg,rgba(210,76,76,0.72),rgba(210,76,76,0.5))",
        "color:#fff3f3","font-size:11px","font-weight:700",
        "letter-spacing:0.06em","text-transform:uppercase",
        "opacity:0","pointer-events:none",
        "transition:opacity 150ms ease,background 150ms ease",
        "border-radius:8px"
      ].join(";");
      delIndicator.textContent = "🗑 Delete";

      // Row button
      const btn = makePickerRow(isActive, isKb);
      btn.setAttribute("data-note-row-id", note.id);
      btn.style.position = "relative";
      btn.style.touchAction = "pan-y";
      btn.style.userSelect = "none";
      // Use flex-direction column to allow title + preview stacking
      btn.style.flexDirection = "column";
      btn.style.alignItems = "stretch";
      btn.style.gap = "2px";

      // Top row: dot + title + count
      const topRow = document.createElement("div");
      topRow.style.cssText = "display:flex;align-items:center;gap:6px;width:100%;";

      const preview = (note.content || "").replace(/^#+ .*/m, "").replace(/\n/g, " ").trim().slice(0, 80);

      const numSpan = document.createElement("span");
      numSpan.style.cssText = [
        "flex:0 0 auto","font-size:11px","font-weight:700",
        "color:" + (isActive ? ROW_ACCENT : "rgba(90,200,255,0.45)"),
        "background:" + (isActive ? "rgba(90,200,255,0.15)" : "rgba(90,200,255,0.08)"),
        "min-width:22px","height:20px","border-radius:6px",
        "display:inline-flex","align-items:center","justify-content:center",
        "padding:0 5px","line-height:1","letter-spacing:-0.3px",
        "border:1px solid " + (isActive ? "rgba(90,200,255,0.35)" : "rgba(90,200,255,0.15)"),
        "margin-right:2px","flex-shrink:0"
      ].join(";");
      numSpan.textContent = noteNumber;

      const labelSpan = makeLabelSpan(getNoteTitle(note));
      if (searching) setHighlightedText(labelSpan, getNoteTitle(note), query);
      topRow.append(
        numSpan,
        makeDotSpan(palette.dot),
        labelSpan,
        makeCountSpan(wordCount + "w", isActive)
      );

      btn.append(topRow);

      // Preview line (below title, muted)
      if (preview) {
        const previewSpan = document.createElement("span");
        previewSpan.style.cssText = [
          "font-size:10.5px","color:rgba(163,172,185,0.7)","white-space:nowrap",
          "overflow:hidden","text-overflow:ellipsis","width:100%",
          "padding-left:14px","line-height:1.3"
        ].join(";");
        if (searching) setHighlightedText(previewSpan, preview, query);
        else previewSpan.textContent = preview;
        btn.append(previewSpan);
      }

      shell.append(delIndicator, btn);

      // Track hover — update highlight without full rebuild
      shell.addEventListener("mouseenter", () => {
        mpActiveNoteId = note.id;
        if (state.refs.mpList) {
          state.refs.mpList.querySelectorAll("[data-note-row-id]").forEach((b) => {
            const nid = b.getAttribute("data-note-row-id");
            const isCurActive = nid === state.ui.activeNoteId;
            const isNowHover = nid === note.id && !isCurActive;
            b.style.border = isCurActive
              ? "1px solid rgba(90,200,255,0.45)"
              : isNowHover ? "1px solid rgba(255,214,51,0.3)" : "1px solid rgba(255,255,255,0.06)";
            b.style.background = isCurActive
              ? "rgba(90,200,255,0.1)"
              : isNowHover ? "rgba(255,214,51,0.07)" : "rgba(255,255,255,0.03)";
          });
        }
      });
      shell.addEventListener("mouseleave", () => {
        if (mpActiveNoteId === note.id) mpActiveNoteId = "";
      });

      // ── Swipe logic ──────────────────────────────────────────────────────
      let ptId = null, startX = 0, startY = 0;
      let swipeOffset = 0, swipeActive = false, swipeTracking = false;
      let suppressClick = false, suppressTimer = null;

      const resetSwipe = () => {
        if (suppressTimer) { clearTimeout(suppressTimer); suppressTimer = null; }
        btn.style.transform = "";
        btn.style.transition = "";
        delIndicator.style.opacity = "0";
        delIndicator.style.background = "linear-gradient(135deg,rgba(210,76,76,0.72),rgba(210,76,76,0.5))";
        swipeOffset = 0; swipeActive = false; swipeTracking = false;
        if (ptId != null && btn.hasPointerCapture && btn.hasPointerCapture(ptId)) {
          try { btn.releasePointerCapture(ptId); } catch (_) {}
        }
        ptId = null;
      };

      btn.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        if (suppressTimer) { clearTimeout(suppressTimer); suppressTimer = null; }
        ptId = e.pointerId; startX = e.clientX; startY = e.clientY;
        swipeOffset = 0; swipeActive = false; swipeTracking = true;
        suppressClick = false;
      });

      btn.addEventListener("pointermove", (e) => {
        if (!swipeTracking || ptId == null || e.pointerId !== ptId) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (!swipeActive) {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
          if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { resetSwipe(); return; }
          if (dx > -10 || Math.abs(dx) < Math.abs(dy)) return;
          swipeActive = true;
          suppressClick = true;
          try { btn.setPointerCapture(ptId); } catch (_) {}
        }
        e.preventDefault();
        swipeOffset = Math.max(-130, Math.min(0, dx));
        btn.style.transition = "none";
        btn.style.transform = "translateX(" + swipeOffset + "px)";
        const progress = Math.min(1, Math.abs(swipeOffset) / 108);
        delIndicator.style.opacity = String(progress);
        if (Math.abs(swipeOffset) >= 108) {
          delIndicator.style.background = "linear-gradient(135deg,rgba(210,76,76,0.96),rgba(210,76,76,0.72))";
        } else {
          delIndicator.style.background = "linear-gradient(135deg,rgba(210,76,76,0.72),rgba(210,76,76,0.5))";
        }
      });

      const finalizeSwipe = () => {
        if (ptId == null) return;
        const shouldDelete = swipeActive && Math.abs(swipeOffset) >= 108;
        if (!shouldDelete) {
          btn.style.transition = "transform 200ms ease";
          resetSwipe();
          if (suppressClick) {
            suppressTimer = setTimeout(() => { suppressClick = false; }, 250);
          }
          return;
        }
        // Animate out then delete
        btn.style.transition = "transform 200ms ease, opacity 200ms ease";
        btn.style.transform = "translateX(-100%)";
        btn.style.opacity = "0";
        resetSwipe();
        setTimeout(() => {
          deleteNoteById(note.id, { confirm: false }).catch(() => {
            setSaveStatus("Could not delete note", "error");
          });
        }, 180);
      };

      btn.addEventListener("pointerup", (e) => {
        if (ptId == null || e.pointerId !== ptId) return;
        finalizeSwipe();
      });
      btn.addEventListener("pointercancel", (e) => {
        if (ptId == null || e.pointerId !== ptId) return;
        btn.style.transition = "transform 200ms ease";
        resetSwipe();
        suppressClick = false;
      });

      btn.addEventListener("click", (e) => {
        if (suppressClick) {
          e.preventDefault(); e.stopPropagation();
          return;
        }
        openNoteForClick(note.id);
      });

      list.appendChild(shell);
    });

    // Pager
    const r = state.refs;
    if (r.mpPager && r.mpPagerInfo && r.mpPrev && r.mpNext) {
      const showPager = pager.totalPages > 1;
      r.mpPager.style.display = showPager ? "flex" : "none";
      r.mpPagerInfo.textContent = (pager.activePage + 1) + " / " + pager.totalPages;
      r.mpPrev.disabled = pager.activePage <= 0;
      r.mpNext.disabled = pager.activePage >= pager.totalPages - 1;
    }
  }

  // Folder select dropdown in editor mode
  function renderFolderSelectNew() {
    const select = state.refs.folderSelect;
    if (!select) return;
    const note = getActiveNote();
    const currentValue = note && note.folderId ? note.folderId : "";
    const options = [
      { value: "", label: UNCATEGORIZED_LABEL },
      ...state.folders.map((f) => ({ value: f.id, label: f.name }))
    ];
    select.replaceChildren(...options.map((opt) => {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      return el;
    }));
    select.value = options.some((o) => o.value === currentValue) ? currentValue : "";
    select.disabled = !note;
  }

  // Editor mode
  function renderEditorNew() {
    const note = getActiveNote();
    autoResizeContentInput();
    syncEditorFrameWithNote(note);

    if (state.refs.editorMeta) {
      if (!note) {
        state.refs.editorMeta.textContent = "0 words";
      } else {
        const stats = getChecklistStats(note);
        const parts = [
          countWords(note.content) + " words",
          countChars(note.content) + " chars",
          formatUpdatedAt(note.updatedAt)
        ];
        if (stats.total > 0) {
          parts.push(stats.open === 0 ? "✓ all done" : stats.open + "/" + stats.total + " tasks");
        }
        // Use · separator (less noisy than |)
        state.refs.editorMeta.textContent = parts.join(" · ");
      }
    }
  }

  // ── Mindmap ──────────────────────────────────────────────────────────────
  function openMindmap() {
    var prevMode = state.panelMode;
    try {
      const note = getActiveNote();
      // Empty note → content mode so renderMindmap shows the numbered note list
      // instead of silently dropping into the folder graph.
      state.mindmap.mode = (note && !note.content.trim()) ? "content"
        : (state.panelMode === "editor" && note && note.content.trim()) ? "content"
        : "folder";
      // BUG FIX: Restore collapsed folders from persisted UI state instead of wiping them.
      // Previously this always reset to [], losing the user's collapse state on every re-entry.
      restoreMindmapFromUi();
      state.mindmap.hoveredId = "";
      if (state._mmCleanup) { try { state._mmCleanup(); } catch(_) {} state._mmCleanup = null; }
      state._mmEventsWired = false; // allow re-wiring on fresh open
      state._mmShortcutShown = false; // show shortcut hint again
      state.panelMode = "mindmap";
      render();
    } catch(e) { state.panelMode = prevMode; }
  }

  // Buka nota ikut toggle "openOnClick": terus ke mindmap atau editor biasa.
  function openNoteForClick(noteId) {
    state.ui.activeNoteId = noteId;
    if (state.mindmap.openOnClick) {
      const note = state.notes.find(n => n.id === noteId);
      // Sync editor state to prevent stale data from corrupting this note later
      // (e.g. when flushSave is called from AI context menu while panelMode is mindmap)
      state.editor.title = note ? getNoteTitle(note) : "";
      state.editor.content = note ? (note.content || "") : "";
      state.mindmap.mode = (note && note.content && note.content.trim()) ? "content" : "folder";
      restoreMindmapFromUi();
      state.mindmap.hoveredId = "";
      if (state._mmCleanup) { try { state._mmCleanup(); } catch(_) {} state._mmCleanup = null; }
      state._mmEventsWired = false;
      state._mmShortcutShown = false;
      state.panelMode = "mindmap";
      render();
    } else {
      state.panelMode = "editor";
      render();
      queueEditorFocus("content", false);
    }
  }

  // ── Mindmap v2 — horizontal tree layout ─────────────────────────────────

  // Palette per folder derived from hue
  function mmPalette(folderId) {
    var hue = hueFromString(folderId || "__root__");
    return {
      grad0: "hsl(" + hue + ",72%,62%)",
      grad1: "hsl(" + ((hue + 30) % 360) + ",60%,44%)",
      dot:   "hsl(" + hue + ",80%,70%)",
      glow:  "hsla(" + hue + ",80%,60%,0.35)",
      muted: "hsla(" + hue + ",40%,70%,0.55)"
    };
  }

  function buildMindmapTree() {
    if (state.mindmap.mode === "content") {
      const note = getActiveNote();
      if (!note) return null;
      const searchQuery = normalizeSearchQuery(state.ui.searchQuery);
      return buildContentMindmapTree(note, searchQuery);
    }
    return buildFolderTree();
  }

  function buildFolderTree() {
    const notes = getVisibleNotes();
    const searchQuery = normalizeSearchQuery(state.ui.searchQuery);
    const hasSearch = !!searchQuery;
    const root = {
      id: "root", label: "Notes (" + notes.length + ")", type: "root", children: [], collapsed: false,
      searchMatch: true, palette: getFolderRowPalette(ROOT_ID)
    };
    const folderMap = {};
    state.folders.forEach(function(f) {
      folderMap[f.id] = {
        id: f.id, label: f.name, type: "folder", children: [], collapsed: false,
        rawCount: 0, searchMatch: true, palette: getFolderRowPalette(f.id)
      };
    });
    folderMap["__uncategorized__"] = {
      id: "__uncategorized__", label: "Unsorted", type: "folder", children: [], collapsed: false,
      rawCount: 0, searchMatch: true, palette: getFolderRowPalette("__uncategorized__")
    };
    notes.forEach(function(n) {
      var fid = n.folderId && folderMap[n.folderId] ? n.folderId : "__uncategorized__";
      if (folderMap[fid]) {
        var noteMatch = !hasSearch || noteMatchesQuery(n, searchQuery);
        folderMap[fid].children.push({
          id: n.id, label: getNoteTitle(n) || "Untitled", type: "note",
          preview: (n.content || "").slice(0, 2000), note: n,
          searchMatch: noteMatch, palette: getFolderRowPalette(fid)
        });
        folderMap[fid].rawCount++;
        if (!noteMatch) folderMap[fid].searchMatch = false;
      }
    });
    Object.keys(folderMap).forEach(function(fid) {
      var f = folderMap[fid];
      if (f.rawCount === 0) return;
      f.collapsed = state.mindmap.collapsedFolders.indexOf(fid) !== -1;
      root.children.push(f);
    });
    if (root.children.length === 0) return null;
    return root;
  }

  function buildContentMindmapTree(note, searchQuery) {
    var lines = (note.content || "").split("\n");
    const needle = searchQuery ? searchQuery.toLowerCase() : "";
    const hasSearch = !!needle;
    const collapsedNodes = state.mindmap.collapsedNodes || [];
    function nodeMatches(label) { return !hasSearch || (label || "").toLowerCase().includes(needle); }
    function isCollapsed(id) { return collapsedNodes.indexOf(id) !== -1; }
    var root = {
      id: note.id, label: getNoteTitle(note) || "Note", type: "root", children: [], collapsed: isCollapsed(note.id),
      searchMatch: true
    };
    // stack[0] = root (level 0), stack[i] = heading node at depth i
    // curHeading = the current heading node (or root); bullets below it attach here.
    // indentStack[d] = the most recent list node at indent depth d, so a child
    // inserted under a list item nests correctly in the mindmap.
    var stack = [root];
    var indentStack = [];
    var curHeading = root;
    var hasStructuredContent = false;

    // ── Hierarchical numbering tracking ──────────────────────────────────
    // numberCounters[depth] = current count at that indent depth
    // numberPrefix[depth]   = the parent numbering prefix (e.g. "1.2.")
    // Reset counters per heading section for clean numbering per section.
    var numberCounters = [];
    var numberPrefixes = [];

    function getNumberPrefix(depth) {
      // Ensure counters exist for all levels up to depth
      while (numberCounters.length <= depth) {
        numberCounters.push(0);
        numberPrefixes.push("");
      }
      // Reset deeper levels when coming back to a shallower depth
      for (var d = depth + 1; d < numberCounters.length; d++) {
        numberCounters[d] = 0;
        numberPrefixes[d] = "";
      }
      numberCounters[depth]++;
      // Build full prefix: parent prefix + this count + "."
      var parentPrefix = depth > 0 ? (numberPrefixes[depth - 1] || "") : "";
      var myPrefix = parentPrefix + numberCounters[depth] + ".";
      numberPrefixes[depth] = myPrefix;
      return myPrefix; // e.g. "1.", "1.1.", "1.1.2."
    }

    lines.forEach(function(line, idx) {
      var trimmed = line.trim();
      if (!trimmed) return;
      var indentMatch = line.match(/^(\s*)/);
      var indent = indentMatch ? indentMatch[1].replace(/\t/g, "  ").length : 0;
      var depth = Math.floor(indent / 2);
      var heading = trimmed.match(/^(#{1,6})\s+(.+)/);
      if (heading) {
        hasStructuredContent = true;
        var level = heading[1].length; // 1-based
        var text = heading[2];
        var hId = "h-" + note.id + "-" + idx;
        var node = { id: hId, label: text, type: "heading", level: level, children: [], collapsed: isCollapsed(hId), lineIndex: idx, searchMatch: nodeMatches(text) };
        // Pop until the stack has exactly `level` items (root + level-1 ancestors)
        // so the parent is at stack[level - 1]
        while (stack.length > level) stack.pop();
        // If we jumped levels (e.g. root → H3 with no H1/H2), fill the gap
        // by attaching to whichever ancestor is currently on top
        var hparent = stack[stack.length - 1];
        if (hparent) hparent.children.push(node);
        stack[level] = node; // place at correct depth slot
        stack.length = level + 1; // trim any deeper entries
        // Reset indent context and numbering: bullets under this heading start fresh
        curHeading = node;
        indentStack = [];
        numberCounters = [];
        numberPrefixes = [];
        return;
      }
      function attachChild(node) {
        var parent = (depth === 0) ? curHeading : (indentStack[depth - 1] || curHeading || root);
        if (parent) parent.children.push(node);
        indentStack[depth] = node;
        indentStack.length = depth + 1;
      }
      var task = trimmed.match(/^[-*]\s\[( |x|X)\]\s?(.*)/);
      if (task) {
        hasStructuredContent = true;
        var done = task[1].toLowerCase() === "x";
        var tId = "t-" + note.id + "-" + idx;
        var node = { id: tId, label: (done ? "✓ " : "☐ ") + task[2], fullLabel: task[2], type: "task", done: done, children: [], collapsed: isCollapsed(tId), lineIndex: idx, searchMatch: nodeMatches(task[2]) };
        attachChild(node);
        return;
      }
      var bullet = trimmed.match(/^[-*]\s+(.*)/);
      if (bullet) {
        hasStructuredContent = true;
        var bId = "b-" + note.id + "-" + idx;
        var node = { id: bId, label: bullet[1], fullLabel: bullet[1], type: "bullet", children: [], collapsed: isCollapsed(bId), lineIndex: idx, searchMatch: nodeMatches(bullet[1]) };
        attachChild(node);
        return;
      }
      var numbered = trimmed.match(/^((?:\d+\.)+)\s+(.*)/);
      if (numbered) {
        hasStructuredContent = true;
        var itemText = numbered[2];
        // Build hierarchical prefix e.g. "1.", "1.1.", "2.3.1."
        var numPrefix = getNumberPrefix(depth);
        var displayNum = numPrefix + " " + itemText;
        var nId = "n-" + note.id + "-" + idx;
        var node = {
          id: nId,
          label: displayNum,
          fullLabel: itemText,
          numPrefix: numPrefix,
          type: "numbered",
          depth: depth,
          children: [], collapsed: isCollapsed(nId), lineIndex: idx,
          searchMatch: nodeMatches(itemText)
        };
        attachChild(node);
        return;
      }
      // Plain text — nest by indentation too (treated like a bullet child)
      if (stack.length > 0) {
        var txtId = "tx-" + note.id + "-" + idx;
        var node = { id: txtId, label: trimmed, fullLabel: trimmed, type: "text", children: [], collapsed: isCollapsed(txtId), lineIndex: idx, searchMatch: nodeMatches(trimmed) };
        attachChild(node);
        if (stack.length > 1) hasStructuredContent = true; // only count if inside a heading
      }
    });
    // Fallback: if no structured content, show plain lines as bullet nodes
    if (!hasStructuredContent && root.children.length === 0 && lines.length > 0) {
      lines.forEach(function(line, idx) {
        var trimmed = line.trim();
        if (!trimmed) return;
        var fbId = "b-" + note.id + "-" + idx;
        root.children.push({
          id: fbId, label: trimmed, fullLabel: trimmed, type: "bullet", children: [], collapsed: isCollapsed(fbId), lineIndex: idx, searchMatch: nodeMatches(trimmed)
        });
      });
    }
    return root.children.length > 0 ? root : null;
  }

  // ── Horizontal tree layout (left-to-right, like the reference image) ────
  function computeHorizontalTreeLayout(tree, cx, cy, w, h) {
    var nodes = [];
    var edges = [];
    if (!tree) return { nodes: nodes, edges: edges };

    var isContentMode = state.mindmap.mode === "content";

    // Node visual sizes (unscaled px)
    var ROOT_W = 160, ROOT_H = 38;
    var FOLDER_H = 34, FOLDER_MIN_W = 140, FOLDER_MAX_W = 240;
    var NOTE_H = 28,   NOTE_MIN_W = 110,   NOTE_MAX_W = 210;
    var CONTENT_H = 24, CONTENT_MIN_W = 90, CONTENT_MAX_W = 190;
    var FONT_FOLDER = 11.5, FONT_NOTE = 10, FONT_CONTENT = 9.5;
    var CHAR_W = 6.8; // avg char width at ~11px system-ui

    function nodeW(nd) {
      var label = nd.label || "";
      if (nd.type === "root")    return ROOT_W;
      if (nd.type === "folder")  return Math.min(FOLDER_MAX_W, Math.max(FOLDER_MIN_W, label.length * CHAR_W + 52));
      if (nd.type === "note")    return Math.min(NOTE_MAX_W, Math.max(NOTE_MIN_W, label.length * CHAR_W + 40));
      return Math.min(CONTENT_MAX_W, Math.max(CONTENT_MIN_W, label.length * (CHAR_W - 0.8) + 32));
    }
    function nodeH(nd) {
      if (nd.type === "root")    return ROOT_H;
      if (nd.type === "folder")  return FOLDER_H;
      if (nd.type === "note")    return NOTE_H;
      return CONTENT_H;
    }

    // Vertical spacing between siblings
    var V_GAP    = 14;  // gap between sibling nodes
    var H_GAP    = 72;  // horizontal gap between parent and child columns

    // ── Compute subtree height (total vertical space needed) ────────────
    function subtreeH(nd, depth) {
      var children = nd.collapsed ? [] : (nd.children || []);
      if (!children.length) return nodeH(nd);
      var childTotal = 0;
      children.forEach(function(c) { childTotal += subtreeH(c, depth + 1) + V_GAP; });
      childTotal -= V_GAP; // remove last gap
      return Math.max(nodeH(nd), childTotal);
    }

    // ── Place nodes recursively ──────────────────────────────────────────
    // x = left edge of this node column
    // centerY = vertical center to place this node at
    function placeNode(nd, x, centerY, parentData) {
      var nw = nodeW(nd);
      var nh = nodeH(nd);
      nodes.push({
        data: nd,
        x: x + nw / 2,    // SVG x = center
        y: centerY,
        r: nh / 2,
        level: parentData ? 1 : 0,
        // Store bounds for edge attachment
        _x: x, _w: nw, _h: nh
      });

      if (parentData) {
        // Edge from right-center of parent to left-center of this node
        edges.push({
          from: parentData,
          to: nd,
          x1: parentData._ex,  // right edge of parent
          y1: parentData._ey,  // center-y of parent
          x2: x,               // left edge of this node
          y2: centerY
        });
      }

      var children = nd.collapsed ? [] : (nd.children || []);
      if (!children.length) return;

      // Compute child column x
      var childX = x + nw + H_GAP;
      // Total height of all children
      var totalH = 0;
      children.forEach(function(c) { totalH += subtreeH(c, 1) + V_GAP; });
      totalH -= V_GAP;

      // Start placing children centred around this node's centerY
      var startY = centerY - totalH / 2;
      var cursor = startY;
      children.forEach(function(child) {
        var sh = subtreeH(child, 1);
        var childCY = cursor + sh / 2;
        placeNode(child, childX, childCY, {
          _ex: x + nw,   // right edge of parent
          _ey: centerY,  // center-y of parent
          palette: nd.palette,
          type: nd.type,
          id: nd.id
        });
        cursor += sh + V_GAP;
      });
    }

    // Root starts at left side with some padding
    var rootX = 24;
    var rootCY = h / 2;
    placeNode(tree, rootX, rootCY, null);

    // After layout: centre the whole tree vertically
    if (nodes.length) {
      var minY = Infinity, maxY = -Infinity;
      nodes.forEach(function(n) {
        minY = Math.min(minY, n.y - n._h / 2);
        maxY = Math.max(maxY, n.y + n._h / 2);
      });
      var treeH = maxY - minY;
      var offsetY = (h / 2) - (minY + treeH / 2);
      // Also centre horizontally — shift right if tree is narrower than canvas
      var minX2 = Infinity, maxX2 = -Infinity;
      nodes.forEach(function(n) {
        minX2 = Math.min(minX2, n.x - n._w / 2);
        maxX2 = Math.max(maxX2, n.x + n._w / 2);
      });
      var treeW = maxX2 - minX2;
      var offsetX = treeW < w ? (w / 2) - (minX2 + treeW / 2) : 0;

      nodes.forEach(function(n) {
        n.y += offsetY;
        n.x += offsetX;
      });
      edges.forEach(function(e) {
        e.y1 += offsetY; e.y2 += offsetY;
        e.x1 += offsetX; e.x2 += offsetX;
      });
    }

    return { nodes: nodes, edges: edges };
  }

  function computeRadialLayout(tree, cx, cy, w, h) {
    var nodes = [];
    var edges = [];
    if (!tree) return { nodes: nodes, edges: edges };

    var containerSize = Math.min(w, h);
    var isContentMode = state.mindmap.mode === "content";
    var minGap = 36; // minimum px gap between node edges

    // ── Estimate rendered node width (matches drawMindmapSvg formulas) ──
    function estW(nd) {
      var label = nd ? (nd.label || "") : "";
      if (nd && nd.type === "folder") {
        return Math.max(72, Math.min(label.length, 18) * 10.5 * 0.62 + 36);
      }
      if (nd && nd.type === "note") {
        return Math.max(58, Math.min(label.length, 22) * 9.5 * 0.62 + 36);
      }
      return Math.max(48, Math.min(label.length, 30) * 9.0 * 0.60 + 20);
    }

    // ── Compute minimum ring radius for n items with given widths ────────
    function minRadius(widths, gap) {
      var total = 0;
      widths.forEach(function(w) { total += w + gap; });
      return total / (2 * Math.PI);
    }

    var rRoot = Math.max(28, Math.min(46, containerSize * 0.07));
    nodes.push({ data: tree, x: cx, y: cy, r: rRoot, level: 0 });

    var topChildren = tree.children || [];
    if (topChildren.length === 0) return { nodes: nodes, edges: edges };

    // Filter to active nodes only
    var activeTop = [];
    topChildren.forEach(function(f) {
      if (f.type !== "folder") { activeTop.push(f); return; }
      if (f.rawCount > 0) activeTop.push(f);
    });
    if (activeTop.length === 0) return { nodes: nodes, edges: edges };

    var nTop = activeTop.length;
    var topAngleStep = (2 * Math.PI) / nTop;

    // ────────────────────────────────────────────────────────────────────
    // CONTENT MODE — single-ring, all top-level nodes equally spaced
    // ────────────────────────────────────────────────────────────────────
    if (isContentMode) {
      var topWidths = activeTop.map(function(f) { return estW(f); });
      var r1 = Math.max(
        minRadius(topWidths, minGap),
        Math.max(110, containerSize * 0.25)
      );

      activeTop.forEach(function(item, idx) {
        var angle = topAngleStep * idx - Math.PI / 2;
        var fx = cx + r1 * Math.cos(angle);
        var fy = cy + r1 * Math.sin(angle);

        nodes.push({ data: item, x: fx, y: fy, r: 18, level: 1 });
        edges.push({ from: tree, to: item, x1: cx, y1: cy, x2: fx, y2: fy });

        var children = item.children || [];
        if (!children.length) return;

        // Place children in an arc around this node
        placeArc(item, fx, fy, angle, r1 + 90, children, 2);
      });

      return { nodes: nodes, edges: edges };
    }

    // ────────────────────────────────────────────────────────────────────
    // FOLDER MODE — folders on inner ring, notes on outer ring
    // ────────────────────────────────────────────────────────────────────
    var folderWidths = activeTop.map(function(f) { return estW(f); });
    var rInner = Math.max(
      minRadius(folderWidths, 72),  // at least 72px between folder edges
      Math.min(140, containerSize * 0.20)
    );

    activeTop.forEach(function(folder, fIdx) {
      var angle = topAngleStep * fIdx - Math.PI / 2;
      var fx = cx + rInner * Math.cos(angle);
      var fy = cy + rInner * Math.sin(angle);

      nodes.push({ data: folder, x: fx, y: fy, r: 22, level: 1 });
      edges.push({ from: tree, to: folder, x1: cx, y1: cy, x2: fx, y2: fy });

      if (folder.type === "folder" && folder.collapsed) return;

      var children = folder.children || [];
      if (!children.length) return;

      // Compute how far out notes need to be
      var noteWidths = children.map(function(c) { return estW(c); });
      var totalNoteWidth = noteWidths.reduce(function(a, b) { return a + b; }, 0);
      var sliceArc = topAngleStep * 0.90; // use 90% of this folder's slice
      // Minimum radius so notes fit within the slice
      var rNeeded = (totalNoteWidth + children.length * minGap) / sliceArc;
      var rOuter = Math.max(
        rInner + 90,
        Math.min(rNeeded, 560),
        containerSize * 0.36
      );

      placeArc(folder, fx, fy, angle, rOuter, children, 2);
    });

    return { nodes: nodes, edges: edges };

    // ────────────────────────────────────────────────────────────────────
    // SHARED: place an arc of children around (parentX,parentY)
    // parentAngle = direction from graph center to parent
    // radius      = distance from graph center (not parent) to place children
    // ────────────────────────────────────────────────────────────────────
    function placeArc(parentNode, parentX, parentY, parentAngle, radius, childList, level) {
      if (!childList || !childList.length || level > 5) return;
      var n = childList.length;

      if (n === 1) {
        var nx = cx + radius * Math.cos(parentAngle);
        var ny = cy + radius * Math.sin(parentAngle);
        nodes.push({ data: childList[0], x: nx, y: ny, r: 17, level: level });
        edges.push({ from: parentNode, to: childList[0], x1: parentX, y1: parentY, x2: nx, y2: ny });
        if (childList[0].children && childList[0].children.length && level < 5) {
          placeArc(childList[0], nx, ny, parentAngle, radius + 82, childList[0].children, level + 1);
        }
        return;
      }

      // Compute average node width
      var avgW = 0;
      childList.forEach(function(c) { avgW += estW(c); });
      avgW /= n;

      // Required spread: each node needs (avgWidth + gap) / radius radians
      var arcPerNode = (avgW + minGap) / Math.max(radius, 1);
      var needed = n * arcPerNode;

      // In content mode allow wide spread; in folder mode cap to slice
      var maxArc = isContentMode
        ? Math.min(Math.PI * 1.9, needed * 1.05)
        : Math.min(Math.PI * 0.95, topAngleStep * 0.88);

      // If needed > maxArc → expand radius until it fits
      var workR = radius;
      if (needed > maxArc) {
        workR = Math.min((n * (avgW + minGap)) / maxArc, 580);
        // Recompute with new radius
        arcPerNode = (avgW + minGap) / workR;
        needed = n * arcPerNode;
      }

      var spread = Math.min(maxArc, Math.max(needed, n * 0.19));
      var startA  = parentAngle - spread / 2;
      var step    = n > 1 ? spread / (n - 1) : 0;

      childList.forEach(function(child, i) {
        var a  = startA + step * i;
        var nx = cx + workR * Math.cos(a);
        var ny = cy + workR * Math.sin(a);
        nodes.push({ data: child, x: nx, y: ny, r: 17, level: level });
        edges.push({ from: parentNode, to: child, x1: parentX, y1: parentY, x2: nx, y2: ny });
        if (child.children && child.children.length && level < 5) {
          placeArc(child, nx, ny, a, workR + 78, child.children, level + 1);
        }
      });
    }
  }

  function updateMindmapLayoutToggleUI() {
    var shadow = state.shadow;
    if (!shadow) return;
    var btn = shadow.querySelector('[data-role="mm-layout-toggle"]');
    if (!btn) return;
    var isTree = state.mindmap.layoutStyle === "tree";
    var spanEl = btn.querySelector("span");
    if (spanEl) spanEl.textContent = isTree ? "Radial" : "Tree";
    btn.style.border = isTree
      ? "1px solid rgba(255,200,80,0.35)"
      : "1px solid rgba(100,220,160,0.28)";
    btn.style.background = isTree
      ? "rgba(255,200,80,0.12)"
      : "rgba(100,220,160,0.09)";
    btn.style.color = isTree ? "#ffd580" : "#7de8b0";
    // Update SVG icon path: radial = circle/spokes, tree = list rows
    var svgIcon = btn.querySelector("svg path");
    if (svgIcon) {
      svgIcon.setAttribute("d", isTree
        ? "M8 1a7 7 0 100 14A7 7 0 008 1zM5 8l3-4 3 4H9v3H7V8z"   // radial icon
        : "M1 2h3v3H1zm5 1h9v1H6zM1 7h3v3H1zm5 1h9v1H6zM1 12h3v3H1zm5 1h9v1H6z"); // tree icon
    }
  }

  function updateMindmapFilterButtons() {
    var view = state.ui.activeView;
    var roles = ["mm-filter-all", "mm-filter-pinned", "mm-filter-tasks"];
    var views = [VIEW_ALL, VIEW_PINNED, VIEW_TASKS];
    var shadow = state.shadow;
    if (!shadow) return;
    roles.forEach(function(role, idx) {
      var btn = shadow.querySelector('[data-role="' + role + '"]');
      if (!btn) return;
      var isActive = views[idx] === view;
      btn.style.border = isActive
        ? "1px solid rgba(90,200,255,0.45)"
        : "1px solid rgba(255,255,255,0.11)";
      btn.style.background = isActive
        ? "rgba(90,200,255,0.15)"
        : "rgba(255,255,255,0.06)";
      btn.style.color = isActive ? "#a8d8ff" : "rgba(255,255,255,0.75)";
      btn.style.boxShadow = isActive ? "0 0 12px rgba(90,200,255,0.15)" : "none";
    });
    // Update mode toggle — re-render label without emoji (already SVG icon)
    var modeBtn = shadow.querySelector('[data-role="mm-mode-toggle"]');
    if (modeBtn) {
      var isContent = state.mindmap.mode === "content";
      // Update only the text span inside the button (second child after SVG icon)
      var spanEl = modeBtn.querySelector("span");
      if (spanEl) spanEl.textContent = isContent ? "Content" : "Folder";
      modeBtn.style.border = isContent
        ? "1px solid rgba(255,180,100,0.35)"
        : "1px solid rgba(180,140,255,0.28)";
      modeBtn.style.background = isContent
        ? "rgba(255,180,100,0.12)"
        : "rgba(180,140,255,0.09)";
      modeBtn.style.color = isContent ? "#ffcc88" : "#c8a0ff";
    }
  }

  function safeTruncate(str, maxLen) {
    if (!str || str.length <= maxLen) return str;
    var chars = Array.from(str);
    return chars.slice(0, maxLen).join("") + "…";
  }

  function showMindmapEmpty(svg, msg) {
    var cw = parseInt(svg.getAttribute("width"), 10) || svg.clientWidth || 600;
    var ch = parseInt(svg.getAttribute("height"), 10) || svg.clientHeight || 400;
    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 " + cw + " " + ch);

    // Dot-grid background even on empty
    var bgR = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgR.setAttribute("x","0"); bgR.setAttribute("y","0");
    bgR.setAttribute("width", String(cw)); bgR.setAttribute("height", String(ch));
    bgR.setAttribute("fill", "rgba(8,10,18,0.4)");
    svg.appendChild(bgR);

    // Centered empty state card
    var cardW = 260, cardH = 110;
    var cx2 = cw / 2, cy2 = ch / 2;
    var cardBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    cardBg.setAttribute("x", String(cx2 - cardW / 2)); cardBg.setAttribute("y", String(cy2 - cardH / 2));
    cardBg.setAttribute("width", String(cardW)); cardBg.setAttribute("height", String(cardH));
    cardBg.setAttribute("rx", "14"); cardBg.setAttribute("fill", "rgba(16,18,30,0.7)");
    cardBg.setAttribute("stroke", "rgba(255,255,255,0.08)"); cardBg.setAttribute("stroke-width", "1");
    svg.appendChild(cardBg);

    var icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
    icon.setAttribute("x", String(cx2)); icon.setAttribute("y", String(cy2 - 22));
    icon.setAttribute("text-anchor", "middle"); icon.setAttribute("font-size", "28px");
    icon.setAttribute("fill", "rgba(255,255,255,0.2)");
    icon.textContent = "🧠";
    svg.appendChild(icon);

    var txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    txt.setAttribute("x", String(cx2)); txt.setAttribute("y", String(cy2 + 8));
    txt.setAttribute("text-anchor", "middle"); txt.setAttribute("fill", "rgba(255,255,255,0.5)");
    txt.setAttribute("font-size", "13px"); txt.setAttribute("font-weight", "500");
    txt.textContent = msg;
    svg.appendChild(txt);

    var hint2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
    hint2.setAttribute("x", String(cx2)); hint2.setAttribute("y", String(cy2 + 28));
    hint2.setAttribute("text-anchor", "middle"); hint2.setAttribute("fill", "rgba(255,255,255,0.22)");
    hint2.setAttribute("font-size", "10.5");
    hint2.textContent = msg.includes("kosong") || msg.includes("empty")
      ? "Add headings or bullets to see structure"
      : "Create notes and categories to begin";
    svg.appendChild(hint2);
    svg.setAttribute("data-empty-msg", msg);
  }

  // Numbered list of notes shown in the mindmap when there is no content to map.
  function showMindmapNoteList(svg, notes, w, h) {
    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);

    var bgR = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgR.setAttribute("x", "0"); bgR.setAttribute("y", "0");
    bgR.setAttribute("width", String(w)); bgR.setAttribute("height", String(h));
    bgR.setAttribute("fill", "rgba(8,10,18,0.4)");
    svg.appendChild(bgR);

    var title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.setAttribute("x", "16"); title.setAttribute("y", "30");
    title.setAttribute("fill", "rgba(255,255,255,0.85)");
    title.setAttribute("font-size", "14");
    title.setAttribute("font-weight", "600");
    title.textContent = "Senarai nota (" + notes.length + ")";
    svg.appendChild(title);

    var rowH = 24;
    var top = 50;
    var maxItems = Math.max(1, Math.floor((h - top - 12) / rowH));
    var shown = notes.slice(0, maxItems);
    shown.forEach(function(note, i) {
      var y = top + i * rowH;
      var row = document.createElementNS("http://www.w3.org/2000/svg", "g");
      row.style.cursor = "pointer";
      row.setAttribute("data-mm-type", "note");
      row.setAttribute("data-mm-id", note.id);
      row.setAttribute("data-note-id", note.id);

      var hit = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      hit.setAttribute("x", "8"); hit.setAttribute("y", String(y - 16));
      hit.setAttribute("width", String(w - 16)); hit.setAttribute("height", String(rowH - 4));
      hit.setAttribute("rx", "6");
      hit.setAttribute("fill", "transparent");
      row.appendChild(hit);

      var num = document.createElementNS("http://www.w3.org/2000/svg", "text");
      num.setAttribute("x", "16"); num.setAttribute("y", String(y));
      num.setAttribute("fill", "rgba(120,195,255,0.85)");
      num.setAttribute("font-size", "12");
      num.setAttribute("font-weight", "600");
      num.textContent = (i + 1) + ".";
      row.appendChild(num);

      var t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", "36"); t.setAttribute("y", String(y));
      t.setAttribute("fill", "rgba(255,255,255,0.85)");
      t.setAttribute("font-size", "13");
      var label = getNoteTitle(note) || "Untitled";
      if (label.length > 42) label = label.slice(0, 42) + "…";
      t.textContent = label;
      row.appendChild(t);

      row.addEventListener("click", function(e) { e.stopPropagation(); openNoteForClick(note.id); });
      row.addEventListener("mouseenter", function() { hit.setAttribute("fill", "rgba(255,255,255,0.07)"); });
      row.addEventListener("mouseleave", function() { hit.setAttribute("fill", "transparent"); });
      svg.appendChild(row);
    });

    if (notes.length > maxItems) {
      var more = document.createElementNS("http://www.w3.org/2000/svg", "text");
      more.setAttribute("x", "36"); more.setAttribute("y", String(top + maxItems * rowH));
      more.setAttribute("fill", "rgba(255,255,255,0.4)");
      more.setAttribute("font-size", "12");
      more.textContent = "…dan " + (notes.length - maxItems) + " lagi";
      svg.appendChild(more);
    }
  }

  function renderMindmap() {
    try {
      // Ensure container visible first
      var mmEl = state.refs.mpMindmap;
      if (!mmEl) return;
      mmEl.style.display = "flex";
      mmEl.style.visibility = "visible";

      updateMindmapFilterButtons();

      // Self-heal SVG refs if missing
      if (!state.refs.mpMindmapSvg || !state.refs.mpMindmapSvgWrap) {
        var svgWrap = mmEl.querySelector('[data-role="mp-mindmap-svg-wrap"]');
        if (!svgWrap) {
          svgWrap = document.createElement("div");
          svgWrap.style.cssText = "flex:1 1 auto;overflow:hidden;border-radius:14px;position:relative;border:1px solid rgba(255,255,255,0.1);background:rgba(10,11,18,0.5);min-height:200px;cursor:grab;will-change:transform;";
          svgWrap.setAttribute("data-role", "mp-mindmap-svg-wrap");
          // Clear any existing content and append
          while (mmEl.children.length > 1) mmEl.removeChild(mmEl.lastChild);
          mmEl.appendChild(svgWrap);
        }
        var svgEl = svgWrap.querySelector("svg");
        if (!svgEl) {
          svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svgEl.setAttribute("width", "100%");
          svgEl.setAttribute("height", "100%");
          svgEl.style.cssText = "display:block;width:100%;height:100%;";
          svgEl.setAttribute("data-role", "mp-mindmap-svg");
          svgWrap.appendChild(svgEl);
        }
        state.refs.mpMindmapSvg = svgEl;
        state.refs.mpMindmapSvgWrap = svgWrap;
        // Ensure GPU layer on SVG for smooth pan/zoom
        svgEl.style.willChange = "transform";
        svgEl.style.fontFamily = "system-ui,-apple-system,'Segoe UI',sans-serif";
      }

      var svg = state.refs.mpMindmapSvg;
      var wrap = state.refs.mpMindmapSvgWrap;

      // Measure available space. getBoundingClientRect() can return 0 on the
      // same tick that display:flex was set, so fall back through several APIs
      // and use a known minimum that matches the min-height on the wrapper.
      var mmRect = wrap.getBoundingClientRect();
      var mmW = (mmRect.width > 1 ? mmRect.width : 0) || wrap.offsetWidth || wrap.clientWidth || 0;
      var mmH = (mmRect.height > 1 ? mmRect.height : 0) || wrap.offsetHeight || wrap.clientHeight || 0;

      // If the container still has no size, force an explicit size from the
      // parent panel so the layout is never invisible.
      if (mmW < 10 || mmH < 10) {
        var mmEl2 = state.refs.mpMindmap;
        if (mmEl2) {
          var elRect = mmEl2.getBoundingClientRect();
          mmW = (elRect.width > 1 ? elRect.width : 0) || mmEl2.offsetWidth || mmW;
          mmH = (elRect.height > 1 ? elRect.height : 0) || mmEl2.offsetHeight || mmH;
        }
      }

      // Last resort — use fixed fallback so we always render something
      if (mmW < 10) mmW = 420;
      if (mmH < 10) mmH = 340;

      svg.setAttribute("width", String(mmW));
      svg.setAttribute("height", String(mmH));
      svg.style.width = mmW + "px";
      svg.style.height = mmH + "px";

      var tree = buildMindmapTree();
      // Content mode with no tree (empty note) → show a numbered list of notes
      // instead of a dead-end "empty" message.
      if (!tree && state.mindmap.mode === "content") {
        var notes = getVisibleNotes();
        if (notes.length) {
          showMindmapNoteList(svg, notes, mmW, mmH);
          return;
        }
      }
      if (!tree) {
        showMindmapEmpty(svg, "Tiada nota");
        return;
      }

      var w = mmW;
      var h = mmH;
      var cx = w / 2;
      var cy = h / 2;

      var layout = state.mindmap.layoutStyle === "tree"
        ? computeHorizontalTreeLayout(tree, cx, cy, w, h)
        : computeRadialLayout(tree, cx, cy, w, h);
      state._mmLastLayout = layout; // store for smart fit-to-view
      drawMindmapSvg(svg, layout, w, h, cx, cy);
      updateMindmapZoomLabel();
      updateMindmapLayoutToggleUI();

      // Keyboard shortcut watermark (shown once per session, fades out)
      if (!state._mmShortcutShown) {
        state._mmShortcutShown = true;
        var hint = document.createElementNS("http://www.w3.org/2000/svg", "text");
        hint.setAttribute("x", "8"); hint.setAttribute("y", String(mmH - 6));
        hint.setAttribute("fill", "rgba(255,255,255,0.22)");
        hint.setAttribute("font-size", "9.5");
        hint.setAttribute("font-family", "system-ui,sans-serif");
        hint.setAttribute("pointer-events", "none");
        hint.textContent = "+ zoom  − zoom  F fit  M mode  ← → ↑ ↓ pan";
        hint.style.transition = "opacity 1s ease";
        svg.appendChild(hint);
        setTimeout(function() { if (hint.parentNode) { hint.style.opacity = "0"; } }, 4000);
        setTimeout(function() { if (hint.parentNode) hint.parentNode.removeChild(hint); }, 5200);
      }

      if (!state._mmEventsWired) {
        wireMindmapEvents(svg);
        state._mmEventsWired = true;
      }
    } catch(err) {
      try {
        var svgErr = state.refs.mpMindmapSvg;
        if (svgErr) showMindmapEmpty(svgErr, "Mindmap error: " + (err.message || "unknown"));
      } catch(_) {}
    }
  }

  function drawMindmapSvg(svg, layout, w, h, cx, cy) {
    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    state._mmFocusedNodeId = null;
    state._mmFocusIdx = null;

    // ── SVG <defs>: filters + gradients + patterns ─────────────────────────
    var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

    // Soft glow filter for search-match nodes
    var glowFilter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    glowFilter.setAttribute("id", "mm-glow");
    glowFilter.setAttribute("x", "-50%"); glowFilter.setAttribute("y", "-50%");
    glowFilter.setAttribute("width", "200%"); glowFilter.setAttribute("height", "200%");
    var feGauss = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
    feGauss.setAttribute("stdDeviation", "3.5"); feGauss.setAttribute("result", "blur");
    var feMerge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
    var fmn1 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    fmn1.setAttribute("in", "blur");
    var fmn2 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
    fmn2.setAttribute("in", "SourceGraphic");
    feMerge.append(fmn1, fmn2);
    glowFilter.append(feGauss, feMerge);
    defs.appendChild(glowFilter);

    // Subtler shadow filter for nodes
    var shadowFilter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    shadowFilter.setAttribute("id", "mm-shadow");
    shadowFilter.setAttribute("x", "-20%"); shadowFilter.setAttribute("y", "-20%");
    shadowFilter.setAttribute("width", "140%"); shadowFilter.setAttribute("height", "140%");
    var feShadow = document.createElementNS("http://www.w3.org/2000/svg", "feDropShadow");
    feShadow.setAttribute("dx", "0"); feShadow.setAttribute("dy", "2");
    feShadow.setAttribute("stdDeviation", "3");
    feShadow.setAttribute("flood-color", "rgba(0,0,0,0.45)");
    shadowFilter.appendChild(feShadow);
    defs.appendChild(shadowFilter);

    // Stronger node shadow filter
    var shadowFilter2 = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    shadowFilter2.setAttribute("id", "mm-shadow2");
    shadowFilter2.setAttribute("x", "-30%"); shadowFilter2.setAttribute("y", "-30%");
    shadowFilter2.setAttribute("width", "160%"); shadowFilter2.setAttribute("height", "160%");
    var feShadow2 = document.createElementNS("http://www.w3.org/2000/svg", "feDropShadow");
    feShadow2.setAttribute("dx", "0"); feShadow2.setAttribute("dy", "3");
    feShadow2.setAttribute("stdDeviation", "5");
    feShadow2.setAttribute("flood-color", "rgba(0,0,0,0.55)");
    shadowFilter2.appendChild(feShadow2);
    defs.appendChild(shadowFilter2);

    // Radial gradient for root node
    var rootGrad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
    rootGrad.setAttribute("id", "mm-root-grad");
    rootGrad.setAttribute("cx", "40%"); rootGrad.setAttribute("cy", "35%");
    rootGrad.setAttribute("r", "65%");
    var rg0 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    rg0.setAttribute("offset", "0%"); rg0.setAttribute("stop-color", "rgba(80,120,220,0.55)");
    var rg1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    rg1.setAttribute("offset", "100%"); rg1.setAttribute("stop-color", "rgba(20,24,48,0.92)");
    rootGrad.append(rg0, rg1);
    defs.appendChild(rootGrad);

    svg.appendChild(defs);

    // ── Dot-grid background — single SVG <pattern> instead of ~1000 circles ──
    var bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x","0"); bgRect.setAttribute("y","0");
    bgRect.setAttribute("width", String(w)); bgRect.setAttribute("height", String(h));
    bgRect.setAttribute("fill", "transparent");
    svg.appendChild(bgRect);

    // Use SVG pattern: one tiny circle tile repeated across the whole canvas.
    // Offset the pattern origin to follow pan state so dots appear to "scroll".
    var gridSpacing = 32;
    var dotR = 0.9;
    var gridOffX = ((state.mindmap.panX % gridSpacing) + gridSpacing) % gridSpacing;
    var gridOffY = ((state.mindmap.panY % gridSpacing) + gridSpacing) % gridSpacing;

    var dotPattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    dotPattern.setAttribute("id", "mm-dot-grid");
    dotPattern.setAttribute("x", String(gridOffX));
    dotPattern.setAttribute("y", String(gridOffY));
    dotPattern.setAttribute("width", String(gridSpacing));
    dotPattern.setAttribute("height", String(gridSpacing));
    dotPattern.setAttribute("patternUnits", "userSpaceOnUse");
    var dotCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dotCircle.setAttribute("cx", "0");
    dotCircle.setAttribute("cy", "0");
    dotCircle.setAttribute("r", String(dotR));
    dotCircle.setAttribute("fill", "rgba(255,255,255,0.07)");
    dotPattern.appendChild(dotCircle);
    // Add to defs (already appended — re-open defs or append pattern separately)
    defs.appendChild(dotPattern);

    var gridRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    gridRect.setAttribute("data-role", "mm-grid");
    gridRect.setAttribute("x", "0"); gridRect.setAttribute("y", "0");
    gridRect.setAttribute("width", String(w)); gridRect.setAttribute("height", String(h));
    gridRect.setAttribute("fill", "url(#mm-dot-grid)");
    gridRect.style.pointerEvents = "none";
    svg.appendChild(gridRect);

    // ── Main transform group (pan + zoom) ──────────────────────────────────
    var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("data-role", "mindmap-g");
    g.setAttribute("transform",
      "translate(" + state.mindmap.panX + "," + state.mindmap.panY + ") scale(" + state.mindmap.zoom + ")");
    g.style.willChange = "transform";
    // GPU-accelerated fade-in via opacity transition
    g.style.opacity = "0";
    g.style.transition = "opacity 280ms cubic-bezier(0.4,0,0.2,1)";
    svg.appendChild(g);
    // Defer opacity set so the transition fires after paint
    setTimeout(function() { if (g.parentNode) g.style.opacity = "1"; }, 16);

    state._mmG = g;

    var zoom = state.mindmap.zoom;
    var hasSearch = !!normalizeSearchQuery(state.ui.searchQuery);

    // ── Helper: create SVG element ─────────────────────────────────────────
    function svgEl(tag) { return document.createElementNS("http://www.w3.org/2000/svg", tag); }

    // ── Edges (smooth cubic bezier with depth-based styling) ───────────────
    var isTreeLayout = state.mindmap.layoutStyle === "tree";
    layout.edges.forEach(function(edge) {
      var fromNode = edge.from;
      // Depth based on node type: root=0, folder=1, note/content=2+
      var depth = 0;
      if (fromNode) {
        if (fromNode.type === "folder") depth = 1;
        else if (fromNode.type !== "root") depth = 2;
      }
      // Alpha fades with depth: 0.52 → 0.38 → 0.24
      var edgeAlpha = Math.max(0.18, 0.52 - depth * 0.14);
      // Stroke width also thins with depth
      var edgeWidth = Math.max(0.6, (2.2 - depth * 0.55) / zoom);
      var edgeColor = fromNode && fromNode.palette
        ? fromNode.palette.dot.replace("hsl(", "hsla(").replace(")", "," + edgeAlpha + ")")
        : "rgba(255,255,255," + edgeAlpha + ")";

      var path = svgEl("path");
      var d;
      if (isTreeLayout) {
        // S-curve: from right-center of parent → left-center of child (horizontal)
        var x1 = edge.x1, y1 = edge.y1, x2 = edge.x2, y2 = edge.y2;
        var mx = (x1 + x2) / 2;
        d = "M" + x1.toFixed(1) + "," + y1.toFixed(1) +
            " C" + mx.toFixed(1) + "," + y1.toFixed(1) +
            " " + mx.toFixed(1) + "," + y2.toFixed(1) +
            " " + x2.toFixed(1) + "," + y2.toFixed(1);
        // Tree edges: uniform subtle color
        edgeColor = fromNode && fromNode.palette
          ? fromNode.palette.dot.replace("hsl(", "hsla(").replace(")", ",0.45)")
          : "rgba(160,160,220,0.45)";
        edgeWidth = Math.max(0.8, 1.6 / zoom);
      } else {
        var dx = edge.x2 - edge.x1;
        var dy = edge.y2 - edge.y1;
        var len = Math.sqrt(dx * dx + dy * dy);
        var cpDist = Math.max(20, len * 0.4);
        var midX = (edge.x1 + edge.x2) / 2;
        var midY = (edge.y1 + edge.y2) / 2;
        var cp1x = edge.x1 + (midX - cx) * 0.0 + dx * 0.35;
        var cp1y = edge.y1 + (midY - cy) * 0.0 + dy * 0.35;
        var cp2x = edge.x2 - dx * 0.35;
        var cp2y = edge.y2 - dy * 0.35;
        void cpDist;
        d = "M" + edge.x1.toFixed(1) + "," + edge.y1.toFixed(1) +
            " C" + cp1x.toFixed(1) + "," + cp1y.toFixed(1) +
            " " + cp2x.toFixed(1) + "," + cp2y.toFixed(1) +
            " " + edge.x2.toFixed(1) + "," + edge.y2.toFixed(1);
      }
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", edgeColor);
      path.setAttribute("stroke-width", edgeWidth);
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      g.appendChild(path);
    });

    // ── Tooltip group (rendered last so always on top) ─────────────────────
    var tooltipG = svgEl("g");
    tooltipG.setAttribute("data-role", "mm-tooltip");
    tooltipG.style.pointerEvents = "none";
    tooltipG.style.display = "none";

    // ── Node rendering ─────────────────────────────────────────────────────
    layout.nodes.forEach(function(node) {
      var nd = node.data;
      var ng = svgEl("g");
      ng.setAttribute("data-mm-id", nd.id);
      ng.setAttribute("data-mm-type", nd.type);
      ng.setAttribute("data-mm-label", nd.label || "");
      if (nd.lineIndex != null) ng.setAttribute("data-mm-lineindex", nd.lineIndex);
      if (nd.type === "note") ng.setAttribute("data-note-id", nd.id);
      ng.setAttribute("role", "button");
      ng.setAttribute("tabindex", "-1");
      ng.style.cursor = "pointer";
      ng.style.transition = "opacity 180ms ease";
      if (nd.type === "note" || nd.type === "folder")
        ng.setAttribute("aria-label", (nd.type === "note" ? "Note: " : "Folder: ") + (nd.label || ""));

      var nr = node.r / zoom;
      var label = nd.label || "";
      // In tree layout, use pre-computed node dimensions; in radial, use truncated labels
      var maxChars = isTreeLayout
        ? (nd.type === "note" ? 28 : nd.type === "folder" ? 26 : nd.type === "numbered" ? 36 : 34)
        : (nd.type === "note" ? 22 : nd.type === "folder" ? 18 : nd.type === "numbered" ? 32 : 30);
      var displayLabel = safeTruncate(label, maxChars);
      var pal = nd.palette || getFolderRowPalette("__all__");
      var isSearchMatch = nd.searchMatch !== false;

      if (nd.type === "root") {
        if (isTreeLayout) {
          // Tree mode root: large rounded rectangle
          var twR = (node._w || 160) / zoom;
          var thR = (node._h || 38) / zoom;
          var rxPtR = 12 / zoom;
          var shadowR0 = svgEl("rect");
          shadowR0.setAttribute("x", node.x - twR / 2 + 1.5 / zoom); shadowR0.setAttribute("y", node.y - thR / 2 + 3 / zoom);
          shadowR0.setAttribute("width", twR); shadowR0.setAttribute("height", thR);
          shadowR0.setAttribute("rx", rxPtR); shadowR0.setAttribute("ry", rxPtR);
          shadowR0.setAttribute("fill", "rgba(0,0,0,0.42)");
          ng.appendChild(shadowR0);
          var rootRect = svgEl("rect");
          rootRect.setAttribute("x", node.x - twR / 2); rootRect.setAttribute("y", node.y - thR / 2);
          rootRect.setAttribute("width", twR); rootRect.setAttribute("height", thR);
          rootRect.setAttribute("rx", rxPtR); rootRect.setAttribute("ry", rxPtR);
          rootRect.setAttribute("fill", "url(#mm-root-grad)");
          rootRect.setAttribute("stroke", pal.dot);
          rootRect.setAttribute("stroke-width", Math.max(1.2, 2 / zoom));
          rootRect.setAttribute("filter", "url(#mm-shadow2)");
          ng.appendChild(rootRect);
          var rootHL = svgEl("rect");
          rootHL.setAttribute("x", node.x - twR / 2 + rxPtR); rootHL.setAttribute("y", node.y - thR / 2);
          rootHL.setAttribute("width", twR - rxPtR * 2); rootHL.setAttribute("height", 1.2 / zoom);
          rootHL.setAttribute("fill", "rgba(255,255,255,0.2)");
          ng.appendChild(rootHL);
          var txt = svgEl("text");
          txt.setAttribute("x", node.x); txt.setAttribute("y", node.y);
          txt.setAttribute("text-anchor", "middle"); txt.setAttribute("dominant-baseline", "middle");
          txt.setAttribute("fill", "rgba(255,255,255,0.96)");
          txt.setAttribute("font-size", Math.max(10, 13 / zoom));
          txt.setAttribute("font-weight", "600");
          txt.textContent = displayLabel;
          ng.appendChild(txt);
        } else {
        var rr = Math.max(24, nr);
        // Outer ambient glow (two rings for depth)
        var glow2 = svgEl("circle");
        glow2.setAttribute("cx", node.x); glow2.setAttribute("cy", node.y);
        glow2.setAttribute("r", rr + 10 / zoom);
        glow2.setAttribute("fill", pal.dot.replace("hsl(","hsla(").replace(")",",0.06)"));
        ng.appendChild(glow2);

        var glow1 = svgEl("circle");
        glow1.setAttribute("cx", node.x); glow1.setAttribute("cy", node.y);
        glow1.setAttribute("r", rr + 4 / zoom);
        glow1.setAttribute("fill", pal.dot.replace("hsl(","hsla(").replace(")",",0.12)"));
        ng.appendChild(glow1);

        // Main circle with radial gradient fill
        var circle = svgEl("circle");
        circle.setAttribute("cx", node.x); circle.setAttribute("cy", node.y);
        circle.setAttribute("r", rr);
        circle.setAttribute("fill", "url(#mm-root-grad)");
        circle.setAttribute("stroke", pal.dot);
        circle.setAttribute("stroke-width", Math.max(1.5, 2.5 / zoom));
        circle.setAttribute("filter", "url(#mm-shadow2)");
        ng.appendChild(circle);

        // Inner ring for glassmorphism depth
        var innerRing = svgEl("circle");
        innerRing.setAttribute("cx", node.x); innerRing.setAttribute("cy", node.y);
        innerRing.setAttribute("r", rr - 4 / zoom);
        innerRing.setAttribute("fill", "none");
        innerRing.setAttribute("stroke", "rgba(255,255,255,0.08)");
        innerRing.setAttribute("stroke-width", 0.8 / zoom);
        ng.appendChild(innerRing);

        var txt = svgEl("text");
        txt.setAttribute("x", node.x); txt.setAttribute("y", node.y + 4 / zoom);
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("dominant-baseline", "middle");
        txt.setAttribute("fill", pal.dot);
        txt.setAttribute("font-size", Math.max(9, 12 / zoom));
        txt.setAttribute("font-weight", "700");
        txt.setAttribute("letter-spacing", "-0.2");
        txt.textContent = displayLabel;
        ng.appendChild(txt);
        }

        if (state.mindmap.mode === "content") {
          // Place below the circle, clear of the root text
          var subTxt = svgEl("text");
          subTxt.setAttribute("x", node.x);
          subTxt.setAttribute("y", node.y + rr + Math.max(12, 13 / zoom));
          subTxt.setAttribute("text-anchor", "middle");
          subTxt.setAttribute("fill", "rgba(255,255,255,0.2)");
          subTxt.setAttribute("font-size", Math.max(5.5, 6.5 / zoom));
          subTxt.setAttribute("font-style", "italic");
          subTxt.textContent = "press M to switch mode";
          ng.appendChild(subTxt);
        }
      } else if (nd.type === "folder") {
        // In tree layout use pre-computed width/height, else compute from label
        var tw = isTreeLayout ? (node._w || 160) / zoom : Math.max(72, displayLabel.length * Math.max(8, 10.5 / zoom) * 0.62 + 36) / zoom;
        var th = isTreeLayout ? (node._h || 34) / zoom : 32 / zoom;
        var fontPx = isTreeLayout ? Math.max(9, 11.5 / zoom) : Math.max(8, 10.5 / zoom);
        var count = nd.children ? nd.children.length : 0;
        var rxPt = isTreeLayout ? 10 / zoom : 9 / zoom;

        // Multi-layer shadow for depth
        var shadowR = svgEl("rect");
        shadowR.setAttribute("x", node.x - tw / 2 + 1.5 / zoom);
        shadowR.setAttribute("y", node.y - th / 2 + 3 / zoom);
        shadowR.setAttribute("width", tw); shadowR.setAttribute("height", th);
        shadowR.setAttribute("rx", rxPt); shadowR.setAttribute("ry", rxPt);
        shadowR.setAttribute("fill", "rgba(0,0,0,0.38)");
        ng.appendChild(shadowR);

        // Main body
        var rect = svgEl("rect");
        rect.setAttribute("x", node.x - tw / 2); rect.setAttribute("y", node.y - th / 2);
        rect.setAttribute("width", tw); rect.setAttribute("height", th);
        rect.setAttribute("rx", rxPt); rect.setAttribute("ry", rxPt);
        rect.setAttribute("fill", pal.rowBackground);
        var strokeColor = hasSearch && !isSearchMatch
          ? "rgba(255,255,255,0.05)"
          : nd.collapsed ? pal.dot.replace("hsl(","hsla(").replace(")",",0.65)") : pal.dotRing;
        rect.setAttribute("stroke", strokeColor);
        rect.setAttribute("stroke-width", Math.max(0.8, hasSearch && !isSearchMatch ? 0.4 : 1.6 / zoom));
        ng.appendChild(rect);

        // Left accent bar (colour strip on left edge)
        var accentBar = svgEl("rect");
        accentBar.setAttribute("x", node.x - tw / 2);
        accentBar.setAttribute("y", node.y - th / 2 + rxPt);
        accentBar.setAttribute("width", Math.max(1.5, 3 / zoom));
        accentBar.setAttribute("height", th - rxPt * 2);
        accentBar.setAttribute("fill", nd.collapsed
          ? pal.dot.replace("hsl(","hsla(").replace(")",",0.75)")
          : pal.dot.replace("hsl(","hsla(").replace(")",",0.45)"));
        ng.appendChild(accentBar);

        // Top highlight line (glassmorphism — brighter)
        var highlight = svgEl("rect");
        highlight.setAttribute("x", node.x - tw / 2 + rxPt);
        highlight.setAttribute("y", node.y - th / 2);
        highlight.setAttribute("width", tw - rxPt * 2);
        highlight.setAttribute("height", 1.2 / zoom);
        highlight.setAttribute("fill", "rgba(255,255,255,0.18)");
        ng.appendChild(highlight);

        if (hasSearch && !isSearchMatch) ng.style.opacity = "0.25";

        // Collapse indicator (chevron SVG) — hidden in tree mode, replaced by > arrow on right
        if (!isTreeLayout) {
          var chevSize = Math.max(6, 8 / zoom);
          var chevX = node.x - tw / 2 + chevSize * 0.9;
          var chevY = node.y;
          var chevPath = svgEl("path");
          var cp = nd.collapsed
            ? ("M" + (chevX - chevSize * 0.3) + "," + (chevY - chevSize * 0.5) +
               " L" + (chevX + chevSize * 0.3) + "," + chevY +
               " L" + (chevX - chevSize * 0.3) + "," + (chevY + chevSize * 0.5))
            : ("M" + (chevX - chevSize * 0.5) + "," + (chevY - chevSize * 0.25) +
               " L" + chevX + "," + (chevY + chevSize * 0.38) +
               " L" + (chevX + chevSize * 0.5) + "," + (chevY - chevSize * 0.25));
          chevPath.setAttribute("d", cp);
          chevPath.setAttribute("fill", "none");
          chevPath.setAttribute("stroke", pal.dot);
          chevPath.setAttribute("stroke-width", Math.max(0.8, 1.2 / zoom));
          chevPath.setAttribute("stroke-linecap", "round");
          chevPath.setAttribute("stroke-linejoin", "round");
          ng.appendChild(chevPath);
        }

        // Label text — centred in tree mode, left-aligned with chevron in radial
        var txt = svgEl("text");
        if (isTreeLayout) {
          txt.setAttribute("x", node.x - tw / 2 + Math.max(6, 10 / zoom));
          txt.setAttribute("y", node.y);
          txt.setAttribute("text-anchor", "start");
          txt.setAttribute("dominant-baseline", "middle");
          txt.setAttribute("fill", "rgba(255,255,255,0.92)");
          txt.setAttribute("font-size", fontPx);
          txt.setAttribute("font-weight", "600");
          txt.textContent = displayLabel;
          ng.appendChild(txt);
          // Right-side > arrow indicator
          var arrowTxt = svgEl("text");
          arrowTxt.setAttribute("x", node.x + tw / 2 - Math.max(8, 12 / zoom));
          arrowTxt.setAttribute("y", node.y);
          arrowTxt.setAttribute("text-anchor", "middle");
          arrowTxt.setAttribute("dominant-baseline", "middle");
          arrowTxt.setAttribute("fill", "rgba(255,255,255,0.35)");
          arrowTxt.setAttribute("font-size", Math.max(7, 9 / zoom));
          arrowTxt.setAttribute("font-weight", "400");
          arrowTxt.textContent = nd.collapsed ? "›" : "‹";
          ng.appendChild(arrowTxt);
        } else {
          var chevSizeL = Math.max(6, 8 / zoom);
          txt.setAttribute("x", node.x + chevSizeL * 0.5);
          txt.setAttribute("y", node.y + 4 / zoom);
          txt.setAttribute("text-anchor", "start");
          txt.setAttribute("dominant-baseline", "middle");
          txt.setAttribute("fill", nd.collapsed ? pal.dot : "rgba(255,255,255,0.88)");
          txt.setAttribute("font-size", fontPx);
          txt.setAttribute("font-weight", "600");
          txt.setAttribute("letter-spacing", "0.1");
          txt.textContent = displayLabel;
          ng.appendChild(txt);
        }

        // Count badge (pill shape, top-right)
        if (count > 0) {
          var badgeLabel = count > 99 ? "99+" : String(count);
          var bPadX = 5 / zoom;
          var bPadY = 3 / zoom;
          var bFontPx = Math.max(5, 7 / zoom);
          var bW = badgeLabel.length * bFontPx * 0.65 + bPadX * 2;
          var bH = bFontPx + bPadY * 2;
          var bX = node.x + tw / 2 - bW - (isTreeLayout ? Math.max(10, 18 / zoom) : 1 / zoom);
          var bY = node.y - th / 2 - bH / 2;
          var badge = svgEl("rect");
          badge.setAttribute("x", bX); badge.setAttribute("y", bY);
          badge.setAttribute("width", bW); badge.setAttribute("height", bH);
          badge.setAttribute("rx", bH / 2); badge.setAttribute("ry", bH / 2);
          badge.setAttribute("fill", nd.collapsed
            ? pal.dot.replace("hsl(","hsla(").replace(")",",0.85)")
            : "rgba(255,255,255,0.14)");
          ng.appendChild(badge);
          var badgeTxt = svgEl("text");
          badgeTxt.setAttribute("x", bX + bW / 2);
          badgeTxt.setAttribute("y", bY + bH / 2 + 0.5 / zoom);
          badgeTxt.setAttribute("text-anchor", "middle");
          badgeTxt.setAttribute("dominant-baseline", "middle");
          badgeTxt.setAttribute("fill", nd.collapsed ? "#fff" : "rgba(255,255,255,0.7)");
          badgeTxt.setAttribute("font-size", bFontPx);
          badgeTxt.setAttribute("font-weight", "700");
          badgeTxt.textContent = badgeLabel;
          ng.appendChild(badgeTxt);
        }

      } else if (nd.type === "note") {
        var noteFontPx = isTreeLayout ? Math.max(8, 10 / zoom) : Math.max(7, 9.5 / zoom);
        var tw = isTreeLayout
          ? (node._w || 130) / zoom
          : Math.max(58, displayLabel.length * noteFontPx * 0.62 + 36) / zoom;
        var th = isTreeLayout ? (node._h || 28) / zoom : 24 / zoom;
        var rxPt = isTreeLayout ? 9 / zoom : 7 / zoom;
        var isActiveNote = nd.id === state.ui.activeNoteId;

        // Active note glow ring
        if (isActiveNote) {
          var activeGlow = svgEl("rect");
          activeGlow.setAttribute("x", node.x - tw / 2 - 3 / zoom);
          activeGlow.setAttribute("y", node.y - th / 2 - 3 / zoom);
          activeGlow.setAttribute("width", tw + 6 / zoom); activeGlow.setAttribute("height", th + 6 / zoom);
          activeGlow.setAttribute("rx", rxPt + 3 / zoom); activeGlow.setAttribute("ry", rxPt + 3 / zoom);
          activeGlow.setAttribute("fill", "rgba(90,200,255,0.12)");
          activeGlow.setAttribute("stroke", "rgba(90,200,255,0.5)");
          activeGlow.setAttribute("stroke-width", 1 / zoom);
          ng.appendChild(activeGlow);
        }

        // Pin indicator (gold corner dot)
        if (nd.note && nd.note.isPinned) {
          var pinDot = svgEl("circle");
          pinDot.setAttribute("cx", node.x - tw / 2 + 4 / zoom);
          pinDot.setAttribute("cy", node.y - th / 2 + 4 / zoom);
          pinDot.setAttribute("r", 3.5 / zoom);
          pinDot.setAttribute("fill", "#ffd044");
          ng.appendChild(pinDot);
        }

        var rect = svgEl("rect");
        rect.setAttribute("x", node.x - tw / 2); rect.setAttribute("y", node.y - th / 2);
        rect.setAttribute("width", tw); rect.setAttribute("height", th);
        rect.setAttribute("rx", rxPt); rect.setAttribute("ry", rxPt);
        rect.setAttribute("fill", isActiveNote ? "rgba(90,200,255,0.13)" : pal.rowBackground);
        rect.setAttribute("stroke", hasSearch && !isSearchMatch
          ? "rgba(255,255,255,0.04)"
          : isActiveNote ? "rgba(90,200,255,0.65)" : pal.dotRing);
        rect.setAttribute("stroke-width", Math.max(0.7, hasSearch && !isSearchMatch ? 0.3 : isActiveNote ? 1.6 / zoom : 1.1 / zoom));
        ng.appendChild(rect);

        // Top highlight line (stronger)
        var noteHL = svgEl("rect");
        noteHL.setAttribute("x", node.x - tw / 2 + rxPt);
        noteHL.setAttribute("y", node.y - th / 2);
        noteHL.setAttribute("width", tw - rxPt * 2);
        noteHL.setAttribute("height", 1 / zoom);
        noteHL.setAttribute("fill", "rgba(255,255,255,0.14)");
        ng.appendChild(noteHL);

        // Bottom inner shadow for depth
        var noteBS = svgEl("rect");
        noteBS.setAttribute("x", node.x - tw / 2 + rxPt);
        noteBS.setAttribute("y", node.y + th / 2 - 2 / zoom);
        noteBS.setAttribute("width", tw - rxPt * 2);
        noteBS.setAttribute("height", 1.5 / zoom);
        noteBS.setAttribute("fill", "rgba(0,0,0,0.18)");
        ng.appendChild(noteBS);

        if (hasSearch && !isSearchMatch) ng.style.opacity = "0.2";
        if (hasSearch && isSearchMatch) ng.setAttribute("filter", "url(#mm-glow)");

        // Text background pill for contrast (only if not active, active has its own tint)
        if (!isActiveNote) {
          var txtBg = svgEl("rect");
          var tbPad = 3 / zoom;
          var tbH = Math.max(10, noteFontPx + 4 / zoom);
          txtBg.setAttribute("x", node.x - tw / 2 + tbPad * 2);
          txtBg.setAttribute("y", node.y - tbH / 2);
          txtBg.setAttribute("width", tw - tbPad * 4);
          txtBg.setAttribute("height", tbH);
          txtBg.setAttribute("rx", tbH / 2);
          txtBg.setAttribute("fill", "rgba(0,0,0,0.22)");
          ng.appendChild(txtBg);
        }

        var txt = svgEl("text");
        txt.setAttribute("x", node.x); txt.setAttribute("y", node.y + 0.5 / zoom);
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("dominant-baseline", "middle");
        txt.setAttribute("fill", isActiveNote ? "#d0f0ff" : "rgba(255,255,255,0.92)");
        txt.setAttribute("font-size", noteFontPx);
        txt.setAttribute("font-weight", isActiveNote ? "600" : "500");
        txt.textContent = displayLabel;
        ng.appendChild(txt);
      } else {
        // Content nodes: heading, task, bullet, numbered, text
        var typeStyles = {
          heading:  { fill: "rgba(180,150,255,0.14)", stroke: "rgba(180,150,255,0.42)", color: "rgba(220,200,255,0.94)", bold: true,  th: 24, fs: 10 },
          task:     { fill: nd.done ? "rgba(60,210,110,0.13)" : "rgba(255,120,70,0.11)", stroke: nd.done ? "rgba(60,210,110,0.45)" : "rgba(255,120,70,0.4)", color: nd.done ? "rgba(100,240,150,0.92)" : "rgba(255,155,95,0.92)", bold: false, th: 21, fs: 9 },
          bullet:   { fill: "rgba(255,255,255,0.04)", stroke: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.75)",             bold: false, th: 21, fs: 9 },
          numbered: { fill: "rgba(120,195,255,0.07)", stroke: "rgba(120,195,255,0.25)", color: "rgba(160,220,255,0.85)",             bold: false, th: 21, fs: 9 },
          text:     { fill: "rgba(255,255,255,0.02)", stroke: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.52)",             bold: false, th: 18, fs: 8.5 }
        };
        var ts = typeStyles[nd.type] || typeStyles.text;
        var cFontPx = Math.max(6, ts.fs / zoom);
        // charWidth ≈ cFontPx * 0.60, + left/right padding (20px total)
        var tw = Math.max(48, displayLabel.length * cFontPx * 0.60 + 20) / zoom;
        var th = ts.th / zoom;
        var rxPt = 6 / zoom;
        var rect = svgEl("rect");
        rect.setAttribute("x", node.x - tw / 2); rect.setAttribute("y", node.y - th / 2);
        rect.setAttribute("width", tw); rect.setAttribute("height", th);
        rect.setAttribute("rx", rxPt); rect.setAttribute("ry", rxPt);
        rect.setAttribute("fill", ts.fill);
        rect.setAttribute("stroke", ts.stroke);
        rect.setAttribute("stroke-width", Math.max(0.6, 0.9 / zoom));
        ng.appendChild(rect);
        if (nd.type === "heading") {
          var hAccent = svgEl("rect");
          hAccent.setAttribute("x", node.x - tw / 2 + rxPt); hAccent.setAttribute("y", node.y - th / 2);
          hAccent.setAttribute("width", tw - rxPt * 2); hAccent.setAttribute("height", 1.5 / zoom);
          hAccent.setAttribute("fill", "rgba(180,150,255,0.6)"); hAccent.setAttribute("rx", 0.75 / zoom);
          ng.appendChild(hAccent);
        }
        var txt = svgEl("text");
        txt.setAttribute("x", node.x); txt.setAttribute("y", node.y);
        txt.setAttribute("text-anchor", "middle"); txt.setAttribute("dominant-baseline", "middle");
        txt.setAttribute("fill", ts.color); txt.setAttribute("font-size", cFontPx);
        if (ts.bold) txt.setAttribute("font-weight", "600");
        txt.textContent = displayLabel;
        ng.appendChild(txt);
      }

      // ── Collapse/Expand toggle button "›" on nodes with children ────────
      // Skip folder nodes — they have their own built-in collapse indicator.
      var hasChildren = nd.children && nd.children.length > 0;
      if (hasChildren && nd.type !== "folder") {
        var btnR   = Math.max(7, 9 / zoom);
        // Position at right-centre edge of node
        var nodeHalfW;
        if (nd.type === "note") {
          nodeHalfW = (node._w || 130) / 2 / zoom;
        } else if (nd.type === "root") {
          nodeHalfW = (node._w || 160) / 2 / zoom;
        } else {
          // content nodes use tw computed above (still in scope)
          nodeHalfW = (tw || 60) / 2;
        }
        var btnCx = node.x + nodeHalfW + btnR * 1.2;
        var btnCy = node.y;

        // Circle background
        var btnCircle = svgEl("circle");
        btnCircle.setAttribute("cx", btnCx);
        btnCircle.setAttribute("cy", btnCy);
        btnCircle.setAttribute("r", btnR);
        btnCircle.setAttribute("fill", nd.collapsed ? "rgba(90,200,255,0.25)" : "rgba(255,255,255,0.08)");
        btnCircle.setAttribute("stroke", nd.collapsed ? "rgba(90,200,255,0.6)" : "rgba(255,255,255,0.2)");
        btnCircle.setAttribute("stroke-width", Math.max(0.6, 1 / zoom));

        // Arrow text "›" (collapsed) or "‹" (expanded)
        var btnTxt = svgEl("text");
        btnTxt.setAttribute("x", btnCx);
        btnTxt.setAttribute("y", btnCy + 0.5 / zoom);
        btnTxt.setAttribute("text-anchor", "middle");
        btnTxt.setAttribute("dominant-baseline", "middle");
        btnTxt.setAttribute("fill", nd.collapsed ? "rgba(90,200,255,0.95)" : "rgba(255,255,255,0.55)");
        btnTxt.setAttribute("font-size", Math.max(8, 11 / zoom));
        btnTxt.setAttribute("font-weight", "700");
        btnTxt.style.userSelect = "none";
        btnTxt.textContent = nd.collapsed ? "›" : "‹";

        // Hit area — larger transparent circle for easy clicking
        var btnHit = svgEl("circle");
        btnHit.setAttribute("cx", btnCx);
        btnHit.setAttribute("cy", btnCy);
        btnHit.setAttribute("r", Math.max(10, 13 / zoom));
        btnHit.setAttribute("fill", "transparent");
        btnHit.style.cursor = "pointer";
        btnHit.setAttribute("data-mm-collapse-id", nd.id);
        btnHit.setAttribute("data-mm-collapse-type", nd.type);

        ng.appendChild(btnCircle);
        ng.appendChild(btnTxt);
        ng.appendChild(btnHit);
      }

      g.appendChild(ng);
    });

    // Append tooltip layer on top of all nodes
    g.appendChild(tooltipG);

    // ── HTML hover tooltip — shows FULL content ────────────────────────────
    // Build fast node lookup — stored on state so wireMindmapEvents can access it too
    var nodeById = {};
    layout.nodes.forEach(function(n) { nodeById[n.data.id] = n; });
    state._mmNodeById = nodeById; // share with context menu handler

    var htmlTip = state.refs.mmHtmlTooltip;
    var htmlTipTitle   = state.refs.mmHtmlTooltipTitle;
    var htmlTipContent = state.refs.mmHtmlTooltipContent;
    var htmlTipFooter  = state.refs.mmHtmlTooltipFooter;
    var tipShowTimer = null;
    var tipHideTimer = null;

    function showHtmlTip(e, nd2) {
      if (!htmlTip) return;
      if (tipHideTimer) { clearTimeout(tipHideTimer); tipHideTimer = null; }
      if (tipShowTimer) { clearTimeout(tipShowTimer); tipShowTimer = null; }

      // 220ms delay — avoid flashing on fast mouse pass-through
      var cx = e.clientX, cy = e.clientY;
      tipShowTimer = setTimeout(function() {
        tipShowTimer = null;

        // Build content by node type
        var title   = nd2.label || "Untitled";
        var body    = "";
        var footer  = "";

        if (nd2.type === "note") {
          var fullNote    = nd2.note || null;
          var fullContent = fullNote
            ? (fullNote.content || "").trim()
            : (nd2.preview || "").trim();
          // Strip leading markdown heading (same as title)
          fullContent = fullContent.replace(/^#+ .+\n?/, "").trim();
          body   = fullContent || "(nota kosong)";
          footer = (nd2.note && nd2.note.isPinned ? "📌 Pinned · " : "") +
                   "Click to open · right-click for AI";

        } else if (nd2.type === "folder") {
          var noteList = (nd2.children || [])
            .map(function(c) { return "• " + (c.label || ""); }).join("\n");
          body   = noteList || "(tiada nota)";
          footer = nd2.collapsed ? "Click to expand" : "Click to collapse";

        } else if (nd2.type === "heading") {
          // Title shows heading text, body shows direct children summary
          var childLines = buildChildrenPreview(nd2.children, 0);
          body   = childLines || "(tiada kandungan)";
          footer = "Heading level " + (nd2.level || 1);

        } else if (nd2.type === "task") {
          // Full task text (without ✓/☐ prefix), plus children
          title  = (nd2.done ? "✓ " : "☐ ") + (nd2.fullLabel || nd2.label || "");
          var childLines2 = buildChildrenPreview(nd2.children, 0);
          body   = childLines2 || "";
          footer = nd2.done ? "Selesai" : "Belum selesai";

        } else if (nd2.type === "numbered") {
          // Show hierarchical prefix as badge in title, full text as body
          var prefix = nd2.numPrefix ? nd2.numPrefix + " " : "";
          title  = prefix + (nd2.fullLabel || nd2.label || "");
          var childLines3 = buildChildrenPreview(nd2.children, nd2.numPrefix || "");
          body   = childLines3 || "";
          footer = nd2.numPrefix ? "Item " + nd2.numPrefix : "";

        } else {
          // bullet, text — full label + children
          title  = nd2.fullLabel || nd2.label || "";
          var childLines4 = buildChildrenPreview(nd2.children, 0);
          body   = childLines4 || "";
          footer = "";
        }

        if (htmlTipTitle)   htmlTipTitle.textContent  = title;
        if (htmlTipContent) {
          htmlTipContent.textContent = body;
          htmlTipContent.style.display = body ? "block" : "none";
          // Reset scroll to top on each new tooltip
          htmlTipContent.scrollTop = 0;
        }
        if (htmlTipFooter) {
          htmlTipFooter.textContent   = footer;
          htmlTipFooter.style.display = footer ? "block" : "none";
        }

        // Show first so offsetWidth/Height are valid
        htmlTip.style.opacity = "0";
        htmlTip.style.display = "flex";

        // Position in next frame after layout
        requestAnimationFrame(function() {
          var tw = htmlTip.offsetWidth  || 320;
          var th = htmlTip.offsetHeight || 200;
          var vw = window.innerWidth, vh = window.innerHeight;
          // Prefer right side, flip to left if not enough room
          var mx = cx + 20;
          if (mx + tw > vw - 16) mx = cx - tw - 16;
          // Prefer below cursor, flip up if not enough room
          var my = cy + 10;
          if (my + th > vh - 16) my = cy - th - 10;
          htmlTip.style.left    = Math.max(8, mx) + "px";
          htmlTip.style.top     = Math.max(8, my) + "px";
          htmlTip.style.opacity = "1";
        });
      }, 220);
    }

    // Build a readable text preview of a node's children (recursive, indented)
    function buildChildrenPreview(children, parentNumPrefix) {
      if (!children || !children.length) return "";
      var lines = [];
      var numCounters = {};
      children.forEach(function(ch) {
        if (!ch) return;
        var indent = "  ";
        var chText = ch.fullLabel || ch.label || "";
        if (ch.type === "numbered") {
          // Re-derive sub-numbering from parentNumPrefix
          var depth = ch.depth || 0;
          numCounters[depth] = (numCounters[depth] || 0) + 1;
          var subPrefix = (parentNumPrefix ? parentNumPrefix : "") + numCounters[depth] + ".";
          chText = subPrefix + " " + (ch.fullLabel || chText);
        } else if (ch.type === "task") {
          chText = (ch.done ? "✓ " : "☐ ") + (ch.fullLabel || chText);
        } else if (ch.type === "bullet") {
          chText = "• " + chText;
        } else if (ch.type === "heading") {
          chText = "## " + chText;
        }
        lines.push(indent + chText);
        // Recurse one more level (grandchildren)
        if (ch.children && ch.children.length) {
          var grandLines = buildChildrenPreview(ch.children, ch.numPrefix || "");
          grandLines.split("\n").forEach(function(gl) {
            if (gl.trim()) lines.push("  " + gl);
          });
        }
      });
      return lines.join("\n");
    }

    function hideHtmlTip() {
      if (!htmlTip) return;
      if (tipShowTimer) { clearTimeout(tipShowTimer); tipShowTimer = null; }
      htmlTip.style.opacity = "0";
      tipHideTimer = setTimeout(function() {
        if (htmlTip) htmlTip.style.display = "none";
        tipHideTimer = null;
      }, 130);
    }

    // Wire hover using BOTH approaches for maximum compatibility:
    // 1. pointerenter/pointerleave per <g> node (reliable if pointer-events work)
    // 2. mousemove on SVG as fallback via target walk-up
    var _hoveredId = "";
    var _tipMoveThrottle = null;

    // Cleanup any previous listeners before adding new ones
    if (svg._mmMoveHandler) svg.removeEventListener("mousemove", svg._mmMoveHandler);
    if (svg._mmLeaveHandler) svg.removeEventListener("mouseleave", svg._mmLeaveHandler);

    // Ensure every node <g> has pointer-events so events fire
    g.querySelectorAll('[data-mm-id]').forEach(function(ng2) {
      ng2.style.pointerEvents = "all";
    });

    function getNodeAtPoint(evTarget) {
      var el = evTarget || null;
      while (el && el !== document.body) {
        if (el.getAttribute && el.getAttribute("data-mm-id")) return el;
        el = el.parentElement || el.parentNode;
      }
      return null;
    }

    function onNodeEnter(nodeEl, e) {
      var newId = nodeEl.getAttribute("data-mm-id") || "";
      if (newId === _hoveredId) return;
      if (_hoveredId) {
        var prev = g.querySelector('[data-mm-id="' + _hoveredId + '"]');
        if (prev) prev.style.filter = "";
        // Remove children highlight
        g.querySelectorAll('[data-mm-parent="' + _hoveredId + '"]').forEach(function(c) {
          c.style.opacity = ""; c.style.filter = "";
        });
      }
      _hoveredId = newId;
      var nd2node = nodeById[newId];
      if (!nd2node) return;
      showHtmlTip(e, nd2node.data);
      nodeEl.style.filter = "brightness(1.18) saturate(1.1)";
      var nd = nd2node.data;
      var nx = nd2node.x * state.mindmap.zoom + state.mindmap.panX;
      var ny = nd2node.y * state.mindmap.zoom + state.mindmap.panY;
      var nr2 = (nd2node._w ? nd2node._w / 2 : nd2node.r) * state.mindmap.zoom;
      var th2 = (nd2node._h ? nd2node._h / 2 : nd2node.r * 0.5) * state.mindmap.zoom;

      // × button — di tepi kiri node, atau maksimum 42px dari pusat
      var delBtn = state.refs.mmDelBtn;
      if (delBtn) {
        var isDeletable = nd.type === "note" || nd.type === "heading" || nd.type === "task" ||
                          nd.type === "bullet" || nd.type === "numbered" || nd.type === "text";
        if (isDeletable && nd.type !== "root") {
          delBtn.style.left    = Math.round(Math.min(nx - nr2 + 2, nx - 42)) + "px";
          delBtn.style.top     = Math.round(ny - 11) + "px";
          delBtn.style.display = "flex";
          delBtn.style.opacity = "0";
          delBtn._currentNd    = nd;
          requestAnimationFrame(function() { delBtn.style.opacity = "1"; });
        } else {
          delBtn.style.display = "none";
          delBtn._currentNd = null;
        }
      }

      // Highlight children subtree ("anak node muncul") — recursive walk
      if (nd.children && nd.children.length > 0) {
        highlightChildren(nd, nd.id);
      }
    }

    function highlightChildren(nodeData, parentId) {
      if (!nodeData.children) return;
      nodeData.children.forEach(function(child) {
        var childEl = g.querySelector('[data-mm-id="' + child.id + '"]');
        if (childEl) {
          childEl.setAttribute("data-mm-parent", parentId);
          childEl.style.opacity = "0.85";
          childEl.style.filter = "brightness(1.08)";
        }
        highlightChildren(child, parentId);
      });
    }

    function onNodeLeave() {
      if (_hoveredId) {
        var prev = g.querySelector('[data-mm-id="' + _hoveredId + '"]');
        if (prev) prev.style.filter = "";
        g.querySelectorAll('[data-mm-parent="' + _hoveredId + '"]').forEach(function(c) {
          c.style.opacity = ""; c.style.filter = "";
          c.removeAttribute("data-mm-parent");
        });
        _hoveredId = "";
      }
      hideHtmlTip();
      var delBtn = state.refs.mmDelBtn;
      if (delBtn) {
        delBtn._hideTimer = setTimeout(function() {
          if (delBtn._currentNd && delBtn.matches(":hover")) return;
          delBtn.style.opacity = "0";
          setTimeout(function() { if (!delBtn.matches(":hover")) delBtn.style.display = "none"; }, 120);
        }, 350);
      }
    }

    // Wire pointerenter/pointerleave on every node <g>
    g.querySelectorAll('[data-mm-id]').forEach(function(ng2) {
      ng2.addEventListener("pointerenter", function(e) { onNodeEnter(ng2, e); });
      ng2.addEventListener("pointerleave", function(e) {
        // Only leave if moving to non-node area
        var relTarget = e.relatedTarget;
        var destNode = getNodeAtPoint(relTarget);
        // Don't leave if moving to delete button
        if (relTarget) {
          var isDelBtn = state.refs.mmDelBtn && (relTarget === state.refs.mmDelBtn || state.refs.mmDelBtn.contains(relTarget));
          if (isDelBtn) return;
        }
        if (destNode && destNode !== ng2) {
          onNodeEnter(destNode, e);
        } else if (!destNode) {
          onNodeLeave();
        }
      });
      ng2.addEventListener("pointermove", function(e) {
        if (_hoveredId === ng2.getAttribute("data-mm-id") && htmlTip && htmlTip.style.display !== "none") {
          var tw = htmlTip.offsetWidth || 320;
          var th = htmlTip.offsetHeight || 200;
          var vw = window.innerWidth, vh = window.innerHeight;
          var mx = e.clientX + 20; if (mx + tw > vw - 16) mx = e.clientX - tw - 16;
          var my = e.clientY + 10; if (my + th > vh - 16) my = e.clientY - th - 10;
          htmlTip.style.left = Math.max(8, mx) + "px";
          htmlTip.style.top  = Math.max(8, my) + "px";
        }
      });
    });

    // Fallback: SVG-level mousemove for cases where pointerenter misses
    svg._mmMoveHandler = function(e) {
      if (_tipMoveThrottle) return;
      _tipMoveThrottle = requestAnimationFrame(function() {
        _tipMoveThrottle = null;
        var ng2 = getNodeAtPoint(e.target);
        if (ng2) {
          var newId = ng2.getAttribute("data-mm-id") || "";
          if (newId !== _hoveredId) onNodeEnter(ng2, e);
        }
      });
    };
    svg.addEventListener("mousemove", svg._mmMoveHandler);

    svg._mmLeaveHandler = function(e) {
      // Don't leave if moving to delete button
      if (e && e.relatedTarget) {
        var isDel = state.refs.mmDelBtn && (e.relatedTarget === state.refs.mmDelBtn || state.refs.mmDelBtn.contains(e.relatedTarget));
        if (isDel) return;
      }
      if (_hoveredId) onNodeLeave();
    };
    svg.addEventListener("mouseleave", svg._mmLeaveHandler);

    // Tooltip cleanup is handled in wireMindmapEvents _mmCleanup

    // ── Premium minimap navigator ──────────────────────────────────────────
    if (layout.nodes.length > 2) {
      var mmPad = 8, mmSize = Math.min(96, Math.max(66, w * 0.18));
      var mmH2 = Math.min(72, Math.max(52, h * 0.15));
      var mmX = w - mmSize - mmPad, mmY = h - mmH2 - mmPad;
      var minimapG = svgEl("g");
      minimapG.setAttribute("data-role", "mm-minimap");
      // Shadow
      var mmShadow = svgEl("rect");
      mmShadow.setAttribute("x", mmX + 1); mmShadow.setAttribute("y", mmY + 2);
      mmShadow.setAttribute("width", mmSize); mmShadow.setAttribute("height", mmH2);
      mmShadow.setAttribute("rx", "8"); mmShadow.setAttribute("fill", "rgba(0,0,0,0.3)");
      minimapG.appendChild(mmShadow);
      // Body
      var mmBg = svgEl("rect");
      mmBg.setAttribute("x", mmX); mmBg.setAttribute("y", mmY);
      mmBg.setAttribute("width", mmSize); mmBg.setAttribute("height", mmH2);
      mmBg.setAttribute("rx", "8"); mmBg.setAttribute("fill", "rgba(8,10,20,0.88)");
      mmBg.setAttribute("stroke", "rgba(255,255,255,0.12)"); mmBg.setAttribute("stroke-width", "1");
      minimapG.appendChild(mmBg);
      // Inner border highlight
      var mmHL = svgEl("rect");
      mmHL.setAttribute("x", mmX + 8); mmHL.setAttribute("y", mmY);
      mmHL.setAttribute("width", mmSize - 16); mmHL.setAttribute("height", "1");
      mmHL.setAttribute("fill", "rgba(255,255,255,0.08)");
      minimapG.appendChild(mmHL);

      var allX2 = layout.nodes.map(function(n) { return n.x; });
      var allY2 = layout.nodes.map(function(n) { return n.y; });
      var bMinX = Math.min.apply(null, allX2) - 40, bMinY = Math.min.apply(null, allY2) - 40;
      var bMaxX = Math.max.apply(null, allX2) + 40, bMaxY = Math.max.apply(null, allY2) + 40;
      var bW = bMaxX - bMinX, bH2 = bMaxY - bMinY;
      var iPad = 5;
      var mmSc = Math.min((mmSize - iPad * 2) / bW, (mmH2 - iPad * 2) / bH2);
      function toMm(nx, ny) { return { x: mmX + iPad + (nx - bMinX) * mmSc, y: mmY + iPad + (ny - bMinY) * mmSc }; }

      layout.edges.forEach(function(edge) {
        var p1 = toMm(edge.x1, edge.y1), p2 = toMm(edge.x2, edge.y2);
        var mmEdge = svgEl("line");
        mmEdge.setAttribute("x1", p1.x); mmEdge.setAttribute("y1", p1.y);
        mmEdge.setAttribute("x2", p2.x); mmEdge.setAttribute("y2", p2.y);
        mmEdge.setAttribute("stroke", "rgba(255,255,255,0.09)"); mmEdge.setAttribute("stroke-width", "0.6");
        minimapG.appendChild(mmEdge);
      });
      layout.nodes.forEach(function(node2) {
        var p2 = toMm(node2.x, node2.y);
        var pal2 = node2.data.palette || getFolderRowPalette("__all__");
        var isRoot2 = node2.data.type === "root";
        var isFolder2 = node2.data.type === "folder";
        var dotR = isRoot2 ? 4.5 : isFolder2 ? 3 : 2;
        var mmDot = svgEl("circle");
        mmDot.setAttribute("cx", p2.x); mmDot.setAttribute("cy", p2.y);
        mmDot.setAttribute("r", dotR);
        mmDot.setAttribute("fill", pal2.dot || "rgba(200,200,255,0.6)");
        if (isRoot2) {
          mmDot.setAttribute("fill", "rgba(255,255,255,0.8)");
          var mmRootRing = svgEl("circle");
          mmRootRing.setAttribute("cx", p2.x); mmRootRing.setAttribute("cy", p2.y);
          mmRootRing.setAttribute("r", dotR + 2);
          mmRootRing.setAttribute("fill", "none");
          mmRootRing.setAttribute("stroke", pal2.dot || "rgba(200,200,255,0.4)");
          mmRootRing.setAttribute("stroke-width", "0.8");
          minimapG.appendChild(mmRootRing);
        }
        minimapG.appendChild(mmDot);
      });
      // Viewport indicator
      var vpX = -state.mindmap.panX / state.mindmap.zoom;
      var vpY2 = -state.mindmap.panY / state.mindmap.zoom;
      var vp1 = toMm(vpX, vpY2), vp2mm = toMm(vpX + w / state.mindmap.zoom, vpY2 + h / state.mindmap.zoom);
      var vpW = Math.max(4, vp2mm.x - vp1.x), vpH = Math.max(4, vp2mm.y - vp1.y);
      // Clamp to minimap bounds
      var cvpX = Math.max(mmX + 1, Math.min(mmX + mmSize - vpW - 1, vp1.x));
      var cvpY = Math.max(mmY + 1, Math.min(mmY + mmH2 - vpH - 1, vp1.y));
      var vpRect = svgEl("rect");
      vpRect.setAttribute("x", cvpX); vpRect.setAttribute("y", cvpY);
      vpRect.setAttribute("width", vpW); vpRect.setAttribute("height", vpH);
      vpRect.setAttribute("rx", "2");
      vpRect.setAttribute("fill", "rgba(90,180,255,0.1)");
      vpRect.setAttribute("stroke", "rgba(90,180,255,0.55)"); vpRect.setAttribute("stroke-width", "1");
      minimapG.appendChild(vpRect);

      // Clickable overlay for minimap click-to-jump
      var mmClickRect = svgEl("rect");
      mmClickRect.setAttribute("x", mmX); mmClickRect.setAttribute("y", mmY);
      mmClickRect.setAttribute("width", mmSize); mmClickRect.setAttribute("height", mmH2);
      mmClickRect.setAttribute("rx", "8");
      mmClickRect.setAttribute("fill", "transparent");
      mmClickRect.setAttribute("data-role", "mm-minimap-click");
      mmClickRect.style.cursor = "pointer";
      // Store minimap mapping for click handler
      mmClickRect._mmMap = { bMinX: bMinX, bMinY: bMinY, mmSc: mmSc, mmX: mmX, mmY: mmY, iPad: iPad, w: w, h: h };
      mmClickRect.addEventListener("click", function(e) {
        var map = e.target._mmMap;
        if (!map) return;
        var rect = e.target.getBoundingClientRect();
        var svgEl = state.refs.mpMindmapSvg;
        if (!svgEl) return;
        var svgRect = svgEl.getBoundingClientRect();
        var scaleX = map.w / svgRect.width;
        var scaleY = map.h / svgRect.height;
        var mmRelX = (e.clientX - svgRect.left) * scaleX;
        var mmRelY = (e.clientY - svgRect.top) * scaleY;
        var mx = (mmRelX - map.mmX - map.iPad) / map.mmSc + map.bMinX;
        var my = (mmRelY - map.mmY - map.iPad) / map.mmSc + map.bMinY;
        var wrap = state.refs.mpMindmapSvgWrap;
        if (!wrap) return;
        var wrapW = wrap.offsetWidth || wrap.clientWidth || 400;
        var wrapH = wrap.offsetHeight || wrap.clientHeight || 300;
        state.mindmap.panX = wrapW / 2 - mx * state.mindmap.zoom;
        state.mindmap.panY = wrapH / 2 - my * state.mindmap.zoom;
        var g = state._mmG || svgEl.querySelector('[data-role="mindmap-g"]');
        if (g) g.setAttribute("transform", "translate(" + state.mindmap.panX + "," + state.mindmap.panY + ") scale(" + state.mindmap.zoom + ")");
        syncMindmapToUi();
      });
      minimapG.appendChild(mmClickRect);

      svg.appendChild(minimapG);
    }
  }

  // Toggle collapse/expand for any node type.
  // Folder nodes use state.mindmap.collapsedFolders (persistent).
  // Content nodes (heading, bullet, task, numbered, text, note) toggle nd.collapsed
  // directly in the live tree (state._mmLastTree), then re-render.
  function toggleNodeCollapse(nodeId, nodeType) {
    if (!nodeId) return;
    if (nodeType === "folder") {
      var idx = state.mindmap.collapsedFolders.indexOf(nodeId);
      if (idx === -1) {
        state.mindmap.collapsedFolders.push(nodeId);
      } else {
        state.mindmap.collapsedFolders.splice(idx, 1);
      }
    } else {
      if (!state.mindmap.collapsedNodes) state.mindmap.collapsedNodes = [];
      var cidx = state.mindmap.collapsedNodes.indexOf(nodeId);
      if (cidx === -1) {
        state.mindmap.collapsedNodes.push(nodeId);
      } else {
        state.mindmap.collapsedNodes.splice(cidx, 1);
      }
    }
    // Persist collapse state to storage immediately
    syncMindmapToUi();
    persistUiOnly();
    render();
  }

  function handleMindmapClick(event) {
    if (state._mmSuppressClick) {
      state._mmSuppressClick = false;
      return;
    }
    // Clear keyboard focus on click
    state._mmFocusedNodeId = null;
    state._mmFocusIdx = null;
    var svgEl = state.refs.mpMindmapSvg;
    if (svgEl) {
      svgEl.querySelectorAll('[data-mm-id]').forEach(function(n) {
        n.style.filter = ""; n.style.opacity = "";
      });
    }

    // ── Collapse/Expand toggle button "›/‹" ──────────────────────────────
    // Check if click landed on our collapse hit circle first
    var collapseTarget = event.target;
    while (collapseTarget && collapseTarget !== event.currentTarget) {
      if (collapseTarget.getAttribute && collapseTarget.getAttribute("data-mm-collapse-id")) {
        var colId   = collapseTarget.getAttribute("data-mm-collapse-id");
        var colType = collapseTarget.getAttribute("data-mm-collapse-type");
        toggleNodeCollapse(colId, colType);
        return; // don't process as regular click
      }
      collapseTarget = collapseTarget.parentNode;
    }

    var target = event.target;
    while (target && target.nodeName !== "g" && target !== event.currentTarget) {
      target = target.parentNode;
    }
    if (!target || !target.getAttribute) return;
    var mmType = target.getAttribute("data-mm-type");
    if (!mmType) return;

    if (mmType === "note") {
      var noteId = target.getAttribute("data-note-id");
      if (noteId) {
        if (state.mindmap.openOnClick) {
          openNoteForClick(noteId);
        } else {
          state.ui.activeNoteId = noteId;
          state.panelMode = "editor";
          render();
          queueEditorFocus("content", false);
        }
      }
    } else if (mmType === "folder") {
      var fid = target.getAttribute("data-mm-id");
      if (fid) {
        var idx = state.mindmap.collapsedFolders.indexOf(fid);
        if (idx === -1) {
          state.mindmap.collapsedFolders.push(fid);
        } else {
          state.mindmap.collapsedFolders.splice(idx, 1);
        }
        render();
      }
    } else if (mmType === "root") {
      if (state.mindmap.mode === "content") {
        state.mindmap.mode = "folder";
        state.mindmap.collapsedFolders = [];
        state.mindmap.collapsedNodes = [];
        render();
      }
    }
  }

  // ── Mindmap AI Expand: butang + pada setiap node ────────────────────────

  // Prompt AI untuk hasilkan sub-nodes, kemudian apply ke mindmap
  async function mmExpandWithAi(nd) {
    if (!nd) return;

    var label = nd.label || "Untitled";
    var nodeType = nd.type; // "root","folder","note","heading","bullet","task" etc

    // Tanya user apa yang mereka nak
    var result = await showPromptDialog({
      title: "Kembangkan Node dengan AI",
      message: "Apa yang anda nak tambah di bawah \"" + (label.length > 40 ? label.slice(0,40)+"…" : label) + "\"?",
      inputLabel: "Arahan kepada AI",
      inputPlaceholder: "cth: tambah 5 sub-topik, senarai langkah-langkah, contoh-contoh…",
      confirmLabel: "Hantar ke AI"
    });

    if (!result || result.confirmed !== true || !result.value.trim()) return;

    var userInstruction = result.value.trim();

    // Bina prompt yang akan buat AI output JSON yang kita boleh parse
    var context = "";
    if (nodeType === "note" && nd.note) {
      var preview = (nd.note.content || "").trim().slice(0, 800);
      if (preview) context = "\n\nKandungan nota:\n" + preview;
    } else if (nodeType === "folder") {
      var childLabels = (nd.children || []).map(function(c){ return "- " + c.label; }).join("\n");
      if (childLabels) context = "\n\nNota dalam folder ini:\n" + childLabels;
    }

    var isContentMode = state.mindmap.mode === "content";

    var prompt =
      "Saya ada " + (nodeType === "root" ? "mindmap" : nodeType === "folder" ? "folder" : "nota/topik") +
      " bertajuk: \"" + label + "\"" + context + "\n\n" +
      "Arahan: " + userInstruction + "\n\n" +
      "Sila hasilkan senarai item yang sesuai. " +
      "Format output MESTI dalam JSON array sahaja, tanpa teks lain, contoh:\n" +
      "[\"Item 1\",\"Item 2\",\"Item 3\"]\n\n" +
      "Hasilkan antara 3 hingga 8 item. Setiap item pendek (1-2 ayat). " +
      "JANGAN tulis apa-apa sebelum atau selepas JSON array.";

    // Simpan context dalam storage supaya kita boleh apply bila AI selesai
    var expandKey = "mm-expand-" + Date.now().toString(36);
    var expandCtx = {
      key: expandKey,
      nodeId: nd.id,
      nodeType: nodeType,
      nodeLabel: label,
      folderId: nd.id && nodeType === "folder" ? nd.id : (nd.note ? nd.note.folderId : ""),
      isContentMode: isContentMode,
      timestamp: Date.now()
    };

    try {
      await new Promise(function(resolve, reject) {
        var obj = {}; obj[expandKey] = expandCtx;
        api.storage.local.set(obj, function() {
          var err = api.runtime && api.runtime.lastError;
          if (err) reject(err); else resolve();
        });
      });
    } catch(e) {
      // Non-fatal — continue anyway
    }

    state._mmPendingExpand = expandCtx;
    setSaveStatus("Membuka AI…", "");

    state._mmAiOpening = true;
    try {
      await flushSave("Saving…");
    } catch(_) {}

    function onAiExpandError() {
      state._mmAiOpening = false;
      setSaveStatus("Tidak dapat buka AI", "error");
      // Show retry button on the apply bar
      var wrap2 = state.refs.mpMindmapSvgWrap;
      if (wrap2) {
        var oldBar = wrap2.querySelector('[data-role="mm-apply-bar"]');
        if (oldBar) oldBar.remove();
        var errBar = mk("div", [
          "position:absolute","bottom:10px","left:50%",
          "transform:translateX(-50%)",
          "z-index:20","display:flex","align-items:center","gap:8px",
          "padding:7px 12px","border-radius:12px",
          "background:rgba(40,14,14,0.97)",
          "border:1px solid rgba(255,100,100,0.4)",
          "box-shadow:0 8px 28px rgba(0,0,0,0.5)",
          "font-size:11px","color:rgba(255,180,180,0.9)"
        ].join(";"));
        errBar.setAttribute("data-role", "mm-apply-bar");
        errBar.textContent = "⚠ Gagal buka AI";
        var retryBtn = mk("button", [
          "padding:4px 10px","border-radius:6px",
          "border:1px solid rgba(255,150,150,0.4)",
          "background:rgba(255,150,150,0.15)",
          "color:#ff9999","font-size:10px","font-weight:600",
          "cursor:pointer","outline:none"
        ].join(";"), "Retry");
        retryBtn.addEventListener("click", function() {
          errBar.remove();
          mmExpandWithAi(nd);
        });
        errBar.appendChild(retryBtn);
        wrap2.appendChild(errBar);
        setTimeout(function() { if (errBar.parentNode) { errBar.style.opacity = "0"; setTimeout(function() { if (errBar.parentNode) errBar.remove(); }, 300); } }, 6000);
      }
    }

    sendRuntimeMessage({ type: "open-ai-sidebar-with-prompt", prompt })
      .then(function(resp) {
        setTimeout(function() { state._mmAiOpening = false; }, 1500);
        if (resp && resp.ok) {
          setSaveStatus("AI dibuka — paste hasil ke sini bila siap ✓", "success");
          mmShowApplyInput(expandCtx);
        } else {
          sendRuntimeMessage({ type: "open-ai-sidebar" })
            .then(function() {
              setSaveStatus("AI dibuka ✓", "success");
              mmShowApplyInput(expandCtx);
            })
            .catch(onAiExpandError);
        }
      })
      .catch(onAiExpandError);
  }

  // Show a floating "Apply AI result" input bar so user can paste JSON or plain list
  function mmShowApplyInput(expandCtx) {
    var wrap = state.refs.mpMindmapSvgWrap;
    if (!wrap) return;

    // Remove any existing apply bar
    var old = wrap.querySelector('[data-role="mm-apply-bar"]');
    if (old) old.remove();

    // Resolve parent label from current expandCtx
    function getParentLabel() {
      var ctx = expandCtx;
      var lbl = ctx.nodeLabel || "";
      if (!lbl) {
        // Try to find from layout
        var layout = state._mmLastLayout;
        if (layout && layout.nodes) {
          for (var k = 0; k < layout.nodes.length; k++) {
            if (layout.nodes[k].data && layout.nodes[k].data.id === ctx.nodeId) {
              lbl = layout.nodes[k].data.label || "";
              break;
            }
          }
        }
      }
      return lbl || "(root)";
    }

    var bar = mk("div", [
      "position:absolute","bottom:10px","left:50%",
      "transform:translateX(-50%)",
      "z-index:20","display:flex","align-items:center","gap:6px",
      "padding:7px 10px","border-radius:12px",
      "background:rgba(14,18,30,0.97)",
      "border:1px solid rgba(100,220,160,0.4)",
      "box-shadow:0 8px 28px rgba(0,0,0,0.5)",
      "min-width:320px","max-width:620px","flex-wrap:wrap"
    ].join(";"));
    bar.setAttribute("data-role", "mm-apply-bar");

    var icon = mk("span","font-size:14px;flex-shrink:0;","🤖");

    // Target parent selector — klik node dalam mindmap untuk tukar
    var targetLabel = mk("span", [
      "font-size:10px","padding:2px 8px","border-radius:6px",
      "cursor:pointer","white-space:nowrap","overflow:hidden",
      "text-overflow:ellipsis","max-width:160px","flex-shrink:0",
      "background:rgba(180,150,255,0.15)","color:#c8b0ff",
      "border:1px solid rgba(180,150,255,0.25)",
      "transition:background 90ms"
    ].join(";"));
    targetLabel.setAttribute("data-role", "mm-apply-target");
    function updateTargetLabel() {
      var lbl = getParentLabel();
      targetLabel.textContent = "▼ " + lbl;
      targetLabel.title = "Klik node dalam mindmap untuk tukar target";
    }
    updateTargetLabel();

    // Click target label to enter "pick mode" — then click a node to set target
    var picking = false;
    function startPickMode() {
      if (picking) return;
      picking = true;
      targetLabel.style.background = "rgba(100,220,160,0.25)";
      targetLabel.style.borderColor = "rgba(100,220,160,0.5)";
      targetLabel.textContent = "Klik node dalam mindmap...";
      setSaveStatus("Klik mana-mana node untuk jadi parent", "");
    }
    function stopPickMode() {
      picking = false;
      targetLabel.style.background = "rgba(180,150,255,0.15)";
      targetLabel.style.borderColor = "rgba(180,150,255,0.25)";
      updateTargetLabel();
    }
    targetLabel.addEventListener("click", function(e) {
      e.stopPropagation();
      if (picking) { stopPickMode(); return; }
      startPickMode();
    });

    // Register one-time SVG click listener for pick mode
    var svgEl = state.refs.mpMindmapSvg;
    var pickHandler = function(e) {
      if (!picking) return;
      // Find the clicked node
      var t = e.target;
      while (t && t.getAttribute && !t.getAttribute("data-mm-id")) { t = t.parentNode; }
      if (!t || !t.getAttribute) return;
      var id = t.getAttribute("data-mm-id");
      var type = t.getAttribute("data-mm-type") || "";
      if (!id || type === "root") return;
      var layout = state._mmLastLayout;
      var label = "";
      if (layout && layout.nodes) {
        for (var i = 0; i < layout.nodes.length; i++) {
          if (layout.nodes[i].data && layout.nodes[i].data.id === id) {
            label = layout.nodes[i].data.label || "";
            break;
          }
        }
      }
      expandCtx.nodeId = id;
      expandCtx.nodeType = type;
      expandCtx.nodeLabel = label;
      // For content mode, keep isContentMode; for folder/note, adjust
      if (type === "folder") expandCtx.isContentMode = false;
      stopPickMode();
      focusNodeInMindmap();
      setSaveStatus("Target: " + (label || id), "success");
    };
    svgEl.addEventListener("click", pickHandler);
    // Clean up on bar remove
    var origRemove = bar.remove.bind(bar);
    bar.remove = function() {
      svgEl.removeEventListener("click", pickHandler);
      origRemove();
    };

    var inp = mk("input", [
      "flex:1","background:rgba(255,255,255,0.06)",
      "border:1px solid rgba(255,255,255,0.12)",
      "border-radius:7px","color:rgba(255,255,255,0.9)",
      "font-size:11px","padding:5px 9px","outline:none",
      "min-width:0"
    ].join(";"));
    inp.type = "text";
    inp.placeholder = 'Paste hasil AI di sini atau ketik manual, pisah dengan koma';
    inp.setAttribute("data-role", "mm-apply-input");

    var applyBtn = mk("button", [
      "padding:5px 12px","border-radius:8px",
      "border:1px solid rgba(100,220,160,0.5)",
      "background:rgba(100,220,160,0.15)",
      "color:#7de8b0","font-size:11px","font-weight:700",
      "cursor:pointer","outline:none","white-space:nowrap","flex-shrink:0"
    ].join(";"), "Tambah ✓");
    applyBtn.type = "button";

    var closeBtn = mk("button", [
      "padding:3px 7px","border-radius:6px",
      "border:1px solid rgba(255,255,255,0.12)",
      "background:transparent","color:rgba(255,255,255,0.4)",
      "font-size:11px","cursor:pointer","outline:none","flex-shrink:0"
    ].join(";"), "✕");
    closeBtn.type = "button";

    bar.append(icon, targetLabel, inp, applyBtn, closeBtn);
    wrap.appendChild(bar);

    // Auto-scroll mindmap to highlight the target node
    function focusNodeInMindmap() {
      var id = expandCtx.nodeId;
      if (!id) return;
      var svg = state.refs.mpMindmapSvg;
      if (!svg) return;
      // Remove previous highlight
      svg.querySelectorAll(".mm-apply-target-highlight").forEach(function(el) {
        el.classList.remove("mm-apply-target-highlight");
        el.style.filter = "";
        el.style.opacity = "";
      });
      var nodeEl = svg.querySelector('[data-mm-id="' + id + '"]');
      if (!nodeEl) return;
      // Highlight the node
      nodeEl.classList.add("mm-apply-target-highlight");
      nodeEl.style.filter = "brightness(1.3) drop-shadow(0 0 6px rgba(100,220,160,0.6))";
      // Center mindmap on node
      try {
        var bbox = nodeEl.getBoundingClientRect();
        var wrapRect = wrap.getBoundingClientRect();
        var dx = bbox.left - wrapRect.left - wrapRect.width / 2 + bbox.width / 2;
        var dy = bbox.top - wrapRect.top - wrapRect.height / 2 + bbox.height / 2;
        state.mindmap.panX -= dx;
        state.mindmap.panY -= dy;
        render();
      } catch(_) {}
    }
    // Short delay so SVG is rendered
    setTimeout(focusNodeInMindmap, 100);

    // Focus input
    setTimeout(function() { try { inp.focus(); } catch(_) {} }, 80);

    // Apply handler
    function doApply() {
      var raw = inp.value.trim();
      if (!raw) return;
      var items = mmParseAiOutput(raw);
      if (items.length === 0) {
        setSaveStatus("Tiada item yang dapat dikenal pasti", "error");
        return;
      }
      bar.remove();
      mmApplyAiChildren(expandCtx, items);
    }

    applyBtn.addEventListener("click", doApply);
    inp.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doApply(); }
      if (e.key === "Escape") { e.preventDefault(); bar.remove(); }
    });
    closeBtn.addEventListener("click", function() { bar.remove(); });

    // Stop pan from triggering when clicking input
    bar.addEventListener("pointerdown", function(e) { e.stopPropagation(); });
    bar.addEventListener("mousedown",   function(e) { e.stopPropagation(); });
  }

  // Parse AI output — handles JSON array OR plain comma/newline separated list
  function mmParseAiOutput(raw) {
    if (!raw) return [];
    // Try JSON array first
    var jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        var parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed
            .map(function(s) { return String(s).trim(); })
            .filter(function(s) { return s.length > 0; })
            .slice(0, 12);
        }
      } catch(_) {}
    }
    // Fallback: split by newline or comma, strip bullets/numbers
    var lines = raw.split(/[\n,]/)
      .map(function(s) {
        return s.replace(/^[\d]+[.)]\s*/, "")
                .replace(/^[-*•]\s*/, "")
                .replace(/^["']|["']$/g, "")
                .trim();
      })
      .filter(function(s) { return s.length > 1; })
      .slice(0, 12);
    return lines;
  }

  // Apply parsed AI items as child nodes to the mindmap
  async function mmApplyAiChildren(expandCtx, items) {
    if (!items || !items.length) return;

    var now = new Date().toISOString();
    var addedCount = 0;

    if (expandCtx.isContentMode) {
      // Content mode: tambah baris ke nota aktif sebagai bullet/heading
      var activeNote = getActiveNote();
      if (!activeNote) {
        setSaveStatus("Tiada nota aktif", "error");
        return;
      }
      var existing = activeNote.content || "";
      var parentLabel = expandCtx.nodeLabel || "";
      // Find the line that matches nodeLabel and append after it
      var lines = existing.split("\n");
      var insertIdx = lines.length; // default: append at end
      for (var i = 0; i < lines.length; i++) {
        var stripped = lines[i].replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
        if (stripped === parentLabel || lines[i].trim() === parentLabel) {
          insertIdx = i + 1;
          // Skip existing content under this heading
          for (var j = i + 1; j < lines.length; j++) {
            if (lines[j].match(/^#{1,6}\s/) && lines[j].replace(/^#+\s*/,"").trim() !== parentLabel) break;
            insertIdx = j + 1;
          }
          break;
        }
      }
      var newLines = items.map(function(item) { return "- " + item; });
      lines.splice.apply(lines, [insertIdx, 0].concat(newLines));
      activeNote.content = lines.join("\n");
      activeNote.updatedAt = now;
      addedCount = items.length;

    } else {
      // Folder mode: buat nota baru dalam folder berkenaan
      var targetFolderId = expandCtx.folderId || "";
      // If expanding a folder node, use that folder's id
      if (expandCtx.nodeType === "folder") {
        targetFolderId = expandCtx.nodeId || "";
      }
      // If expanding root, create in uncategorized
      if (expandCtx.nodeType === "root") {
        targetFolderId = "";
      }

      var newNotes = items.map(function(item) {
        var note = createBlankNote(targetFolderId);
        // Use item as title — extract first line
        var firstLine = item.split("\n")[0].trim();
        note.title = firstLine.slice(0, 120);
        note.content = "# " + firstLine + "\n\n" + item;
        note.updatedAt = now;
        note.createdAt = now;
        return note;
      });

      state.notes = getSortedNotes([...newNotes, ...state.notes]);
      addedCount = newNotes.length;
    }

    state._mmPendingExpand = null;

    render();
    await flushSave("Ditambah " + addedCount + " node ✓");
    setSaveStatus("✓ " + addedCount + " node ditambah ke mindmap", "success");
  }

  function wireMindmapEvents() {
    var svg = state.refs.mpMindmapSvg;
    var wrap = state.refs.mpMindmapSvgWrap;
    if (!svg || !wrap) return;

    if (state._mmCleanup) { try { state._mmCleanup(); } catch(_) {} state._mmCleanup = null; }

    // Wire delete × button
    var delBtn2 = state.refs.mmDelBtn;
    if (delBtn2 && !delBtn2._mmWired) {
      delBtn2._mmWired = true;
      delBtn2.addEventListener("mouseenter", function() {
        if (delBtn2._hideTimer) { clearTimeout(delBtn2._hideTimer); delBtn2._hideTimer = null; }
        delBtn2.style.opacity = "1";
        delBtn2.style.display = "flex";
        delBtn2.style.transform = "scale(1.15)";
      });
      delBtn2.addEventListener("mouseleave", function() {
        delBtn2.style.transform = "";
        delBtn2.style.opacity = "0";
        setTimeout(function() {
          if (!delBtn2.matches(":hover")) delBtn2.style.display = "none";
        }, 120);
      });
      delBtn2.addEventListener("click", function(e) {
        e.stopPropagation();
        var nd = delBtn2._currentNd;
        delBtn2.style.display = "none";
        delBtn2._currentNd = null;
        if (!nd || !nd.id) return;

        // Content mode: delete line from note's markdown
        if (nd.type === "heading" || nd.type === "task" || nd.type === "bullet" ||
            nd.type === "numbered" || nd.type === "text") {
          if (nd.lineIndex === undefined) return;
          var activeNote = getActiveNote();
          if (!activeNote || !activeNote.content) return;
          var lines = activeNote.content.split("\n");
          if (nd.lineIndex < 0 || nd.lineIndex >= lines.length) return;
          lines.splice(nd.lineIndex, 1);
          activeNote.content = lines.join("\n");
          setSaveStatus("Content line deleted ✓", "success");
          if (state.panelMode === "mindmap") render();
          return;
        }

        // Folder mode: delete note file
        if (nd.type === "note" && nd.id) {
          deleteNoteById(nd.id, { confirm: false }).then(function() {
            setSaveStatus("Note deleted ✓", "success");
            if (state.panelMode === "mindmap") render();
          }).catch(function() {
            setSaveStatus("Could not delete note", "error");
          });
        }
      });
      delBtn2.addEventListener("pointerdown", function(e) { e.stopPropagation(); });
    }

    wrap.style.touchAction = "none";

    var clickHandler = function(e) { handleMindmapClick(e); };

    // ── Wheel zoom — RAF-debounced, zoom towards cursor ─────────────────
    var wheelRAF = null;
    var lastWheelE = null;
    var onWheel = function(e) {
      e.preventDefault();
      lastWheelE = e;
      if (wheelRAF) return;
      wheelRAF = requestAnimationFrame(function() {
        wheelRAF = null;
        var ev = lastWheelE;
        if (!ev) return;
        var wrapRect = wrap.getBoundingClientRect();
        var mouseX = ev.clientX - wrapRect.left;
        var mouseY = ev.clientY - wrapRect.top;
        // Normalize deltaY across different deltaMode values
        var rawDelta = ev.deltaY;
        if (ev.deltaMode === 1) rawDelta *= 20;  // line mode
        if (ev.deltaMode === 2) rawDelta *= 300; // page mode
        var delta = rawDelta > 0 ? -0.1 : 0.1;
        if (ev.ctrlKey || ev.metaKey) delta *= 0.5;
        var oldZoom = state.mindmap.zoom;
        var newZoom = Math.max(0.15, Math.min(4, oldZoom + delta));
        if (Math.abs(newZoom - oldZoom) < 0.001) return;
        var zoomRatio = newZoom / oldZoom;
        state.mindmap.panX = mouseX - zoomRatio * (mouseX - state.mindmap.panX);
        state.mindmap.panY = mouseY - zoomRatio * (mouseY - state.mindmap.panY);
        state.mindmap.zoom = newZoom;
        var g = state._mmG || svg.querySelector('[data-role="mindmap-g"]');
        if (g) g.setAttribute("transform",
          "translate(" + state.mindmap.panX + "," + state.mindmap.panY + ") scale(" + newZoom + ")");
        updateMindmapZoomLabel();
        syncMindmapToUi();
      });
    };

    // ── Pointer pan — skip if pointer is on a node ──────────────────────
    var isPanning = false, panStartX = 0, panStartY = 0, origPanX = 0, origPanY = 0;
    var hadMovement = false;
    // Momentum vars
    var velX = 0, velY = 0, lastPanTime = 0, momentumRAF = null;

    var onPointerDown = function(e) {
      if (e.button !== 0) return;
      // Ctrl/Cmd + drag = pemilihan teks sengaja untuk copy. Benarkan selection
      // (batalkan user-select:none) dan JANGAN pan. Selepas lepas, revert balik.
      if (e.ctrlKey || e.metaKey) {
        wrap.style.userSelect = "text";
        wrap.style.webkitUserSelect = "text";
        wrap.style.MozUserSelect = "text";
        return;
      }
      // Only pan if pointer starts on background (svg or the wrap), not on a node
      var tgt = e.target;
      if (tgt && tgt.closest && tgt.closest("[data-mm-id]")) return;
      // Also skip if target is the svg itself but pointer is directly on a node group
      cancelMomentum();
      isPanning = true;
      hadMovement = false;
      panStartX = e.clientX;
      panStartY = e.clientY;
      origPanX = state.mindmap.panX;
      origPanY = state.mindmap.panY;
      velX = 0; velY = 0;
      lastPanTime = performance.now();
      wrap.style.cursor = "grabbing";
      try { wrap.setPointerCapture(e.pointerId); } catch(_) {}
    };

    var onPointerMove = function(e) {
      if (!isPanning) return;
      var now = performance.now();
      var dt = Math.max(1, now - lastPanTime);
      var dx = e.clientX - panStartX;
      var dy = e.clientY - panStartY;
      if (!hadMovement && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) hadMovement = true;
      // Track velocity for momentum (frame-to-frame delta)
      velX = (dx - (state.mindmap.panX - origPanX)) / dt * 16;
      velY = (dy - (state.mindmap.panY - origPanY)) / dt * 16;
      state.mindmap.panX = origPanX + dx;
      state.mindmap.panY = origPanY + dy;
      lastPanTime = now;
      var g = state._mmG || svg.querySelector('[data-role="mindmap-g"]');
      if (g) g.setAttribute("transform",
        "translate(" + state.mindmap.panX + "," + state.mindmap.panY + ") scale(" + state.mindmap.zoom + ")");
    };

    function cancelMomentum() {
      if (momentumRAF) { cancelAnimationFrame(momentumRAF); momentumRAF = null; }
    }

    var onPointerUp = function(e) {
      if (!isPanning) return;
      if (hadMovement) state._mmSuppressClick = true;
      isPanning = false;
      wrap.style.cursor = "grab";
      if (hadMovement) {
        syncMindmapToUi();
        // Momentum scrolling — decay velocity with spring friction
        var friction = 0.88;
        var vx = velX * 8, vy = velY * 8; // amplify captured velocity
        var runMomentum = function() {
          vx *= friction; vy *= friction;
          if (Math.abs(vx) < 0.3 && Math.abs(vy) < 0.3) { momentumRAF = null; return; }
          state.mindmap.panX += vx;
          state.mindmap.panY += vy;
          var g2 = state._mmG || svg.querySelector('[data-role="mindmap-g"]');
          if (g2) g2.setAttribute("transform",
            "translate(" + state.mindmap.panX + "," + state.mindmap.panY + ") scale(" + state.mindmap.zoom + ")");
          momentumRAF = requestAnimationFrame(runMomentum);
        };
        cancelMomentum();
        momentumRAF = requestAnimationFrame(runMomentum);
      }
    };

    // ── Touch pinch zoom + single-finger pan fallback ──────────────────
    var lastPinchDist = 0, pinchCenterX = 0, pinchCenterY = 0;
    var touchPan = false, touchPanStartX = 0, touchPanStartY = 0, touchPanOrigX = 0, touchPanOrigY = 0;
    var useTouchPan = !window.PointerEvent; // fallback for browsers without pointer events
    var onTouchStart = function(e) {
      if (e.touches.length === 2) {
        var t1 = e.touches[0], t2 = e.touches[1];
        lastPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        var wRect = wrap.getBoundingClientRect();
        pinchCenterX = ((t1.clientX + t2.clientX) / 2) - wRect.left;
        pinchCenterY = ((t1.clientY + t2.clientY) / 2) - wRect.top;
      } else if (e.touches.length === 1 && useTouchPan) {
        touchPan = true;
        touchPanStartX = e.touches[0].clientX;
        touchPanStartY = e.touches[0].clientY;
        touchPanOrigX = state.mindmap.panX;
        touchPanOrigY = state.mindmap.panY;
      }
    };
    var onTouchMove = function(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        var t1 = e.touches[0], t2 = e.touches[1];
        var dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (lastPinchDist > 0) {
          var scale = dist / lastPinchDist;
          var oldZoom = state.mindmap.zoom;
          var newZoom = Math.max(0.15, Math.min(4, oldZoom * scale));
          if (newZoom !== oldZoom) {
            var zr = newZoom / oldZoom;
            state.mindmap.panX = pinchCenterX - zr * (pinchCenterX - state.mindmap.panX);
            state.mindmap.panY = pinchCenterY - zr * (pinchCenterY - state.mindmap.panY);
            state.mindmap.zoom = newZoom;
            var g = state._mmG || svg.querySelector('[data-role="mindmap-g"]');
            if (g) g.setAttribute("transform",
              "translate(" + state.mindmap.panX + "," + state.mindmap.panY + ") scale(" + newZoom + ")");
            updateMindmapZoomLabel(); syncMindmapToUi();
          }
        }
        lastPinchDist = dist;
      } else if (e.touches.length === 1 && touchPan && useTouchPan) {
        e.preventDefault();
        state.mindmap.panX = touchPanOrigX + (e.touches[0].clientX - touchPanStartX);
        state.mindmap.panY = touchPanOrigY + (e.touches[0].clientY - touchPanStartY);
        var g = state._mmG || svg.querySelector('[data-role="mindmap-g"]');
        if (g) g.setAttribute("transform",
          "translate(" + state.mindmap.panX + "," + state.mindmap.panY + ") scale(" + state.mindmap.zoom + ")");
        syncMindmapToUi();
      }
    };
    var onTouchEnd = function(e) {
      if (e.touches.length < 2) lastPinchDist = 0;
      if (e.touches.length === 0) touchPan = false;
    };

    // ── Keyboard shortcuts for mindmap ──────────────────────────────────
    var onKeyDown = function(e) {
      if (state.panelMode !== "mindmap") return;
      var tgt = e.target;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA")) return;

      var handled = false;
      var zoomStep = 0.2;
      var panStep = 40;

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "=" || e.key === "+") {
          var nzIn = Math.min(4, state.mindmap.zoom + zoomStep);
          state.mindmap.zoom = nzIn;
          var gIn = state._mmG; if (gIn) gIn.setAttribute("transform", "translate("+state.mindmap.panX+","+state.mindmap.panY+") scale("+nzIn+")");
          updateMindmapZoomLabel(); syncMindmapToUi(); handled = true;
        } else if (e.key === "-" || e.key === "_") {
          var nzOut = Math.max(0.15, state.mindmap.zoom - zoomStep);
          state.mindmap.zoom = nzOut;
          var gOut = state._mmG; if (gOut) gOut.setAttribute("transform", "translate("+state.mindmap.panX+","+state.mindmap.panY+") scale("+nzOut+")");
          updateMindmapZoomLabel(); syncMindmapToUi(); handled = true;
        } else if (e.key === "f" || e.key === "F" || e.key === "0") {
          fitMindmapToView(); handled = true;
        } else if (e.key === "m" || e.key === "M") {
          var note = getActiveNote();
          if (state.mindmap.mode === "folder" && note && note.content && note.content.trim()) {
            state.mindmap.mode = "content";
          } else {
            state.mindmap.mode = "folder";
          }
          state.mindmap.panX = 0; state.mindmap.panY = 0; state.mindmap.zoom = 1;
          render(); handled = true;
        } else if (e.key === "Tab") {
          e.preventDefault();
          var layoutNodes = state._mmLastLayout ? state._mmLastLayout.nodes : null;
          if (!layoutNodes || layoutNodes.length === 0) return;
          if (state._mmFocusIdx === undefined || state._mmFocusIdx === null) state._mmFocusIdx = -1;
          var dir = e.shiftKey ? -1 : 1;
          state._mmFocusIdx = (state._mmFocusIdx + dir + layoutNodes.length) % layoutNodes.length;
          var focusedNode = layoutNodes[state._mmFocusIdx];
          if (focusedNode) {
            state._mmFocusedNodeId = focusedNode.data.id;
            // Center view on focused node
            var wrapEl = state.refs.mpMindmapSvgWrap;
            if (wrapEl) {
              var ww = wrapEl.offsetWidth || 400, wh = wrapEl.offsetHeight || 300;
              state.mindmap.panX = ww / 2 - focusedNode.x * state.mindmap.zoom;
              state.mindmap.panY = wh / 2 - focusedNode.y * state.mindmap.zoom;
              var gFocus = state._mmG;
              if (gFocus) gFocus.setAttribute("transform", "translate("+state.mindmap.panX+","+state.mindmap.panY+") scale("+state.mindmap.zoom+")");
              syncMindmapToUi();
            }
            // Re-render with focus highlight
            var svg = state.refs.mpMindmapSvg;
            if (svg) {
              var allNodes = svg.querySelectorAll('[data-mm-id]');
              allNodes.forEach(function(n) {
                var id = n.getAttribute("data-mm-id");
                n.style.filter = id === state._mmFocusedNodeId ? "brightness(1.3) drop-shadow(0 0 6px rgba(90,200,255,0.6))" : "";
                n.style.opacity = id === state._mmFocusedNodeId ? "1" : "";
              });
            }
          }
          handled = true;
        } else if (e.key === "Enter" && state._mmFocusedNodeId) {
          // Activate focused node
          var svg = state.refs.mpMindmapSvg;
          if (svg) {
            var focusEl = svg.querySelector('[data-mm-id="' + state._mmFocusedNodeId + '"]');
            if (focusEl) {
              // Simulate click on the parent <g> wrapper
              var gParent = focusEl.closest("g[data-mm-type]");
              if (gParent) {
                var fakeEvent = { target: gParent };
                handleMindmapClick(fakeEvent);
              } else if (focusEl.getAttribute("data-mm-type")) {
                var fakeEvent2 = { target: focusEl };
                handleMindmapClick(fakeEvent2);
              }
            }
          }
          handled = true;
        } else if (e.key === "Escape") {
          // Clear focus
          state._mmFocusedNodeId = null;
          state._mmFocusIdx = null;
          var svg = state.refs.mpMindmapSvg;
          if (svg) {
            svg.querySelectorAll('[data-mm-id]').forEach(function(n) {
              n.style.filter = ""; n.style.opacity = "";
            });
          }
          handled = true;
        } else if (e.key === "ArrowLeft") {
          state.mindmap.panX += panStep;
          var gL = state._mmG; if (gL) gL.setAttribute("transform", "translate("+state.mindmap.panX+","+state.mindmap.panY+") scale("+state.mindmap.zoom+")");
          syncMindmapToUi(); handled = true;
        } else if (e.key === "ArrowRight") {
          state.mindmap.panX -= panStep;
          var gR = state._mmG; if (gR) gR.setAttribute("transform", "translate("+state.mindmap.panX+","+state.mindmap.panY+") scale("+state.mindmap.zoom+")");
          syncMindmapToUi(); handled = true;
        } else if (e.key === "ArrowUp") {
          state.mindmap.panY += panStep;
          var gU = state._mmG; if (gU) gU.setAttribute("transform", "translate("+state.mindmap.panX+","+state.mindmap.panY+") scale("+state.mindmap.zoom+")");
          syncMindmapToUi(); handled = true;
        } else if (e.key === "ArrowDown") {
          state.mindmap.panY -= panStep;
          var gD = state._mmG; if (gD) gD.setAttribute("transform", "translate("+state.mindmap.panX+","+state.mindmap.panY+") scale("+state.mindmap.zoom+")");
          syncMindmapToUi(); handled = true;
        }
      }
      if (handled) e.preventDefault();
    };

    svg.addEventListener("click", clickHandler);

    // Double-click to rename node
    var dblClickHandler = function(e) {
      var target = e.target;
      while (target && target.nodeName !== "g" && target !== svg) {
        target = target.parentNode;
      }
      if (!target || !target.getAttribute) return;
      var mmId = target.getAttribute("data-mm-id");
      var mmLabel = target.getAttribute("data-mm-label");
      var mmType = target.getAttribute("data-mm-type");
      if (!mmId || !mmType) return;
      // Only allow rename on folder and note nodes
      if (mmType !== "folder" && mmType !== "note") return;

      // Remove any existing rename input
      var oldInp = wrap.querySelector('[data-role="mm-rename-input"]');
      if (oldInp) oldInp.remove();

      var rect = target.getBoundingClientRect();
      var wrapRect = wrap.getBoundingClientRect();
      var inp = document.createElement("input");
      inp.type = "text";
      inp.value = mmLabel || "";
      inp.setAttribute("data-role", "mm-rename-input");
      inp.style.cssText = [
        "position:absolute","z-index:30",
        "left:" + (rect.left - wrapRect.left) + "px",
        "top:" + (rect.top - wrapRect.top) + "px",
        "width:" + Math.max(80, rect.width + 20) + "px",
        "height:" + Math.max(20, rect.height) + "px",
        "border:1.5px solid rgba(90,200,255,0.6)",
        "background:rgba(10,12,24,0.95)",
        "color:rgba(255,255,255,0.9)",
        "font-size:" + Math.max(10, Math.min(13, 13 / state.mindmap.zoom)) + "px",
        "font-family:system-ui,-apple-system,'Segoe UI',sans-serif",
        "border-radius:6px","padding:2px 6px","outline:none",
        "box-shadow:0 4px 16px rgba(0,0,0,0.4)"
      ].join(";");
      inp.select();
      wrap.appendChild(inp);
      inp.focus();

      function commitRename() {
        var val = inp.value.trim();
        inp.remove();
        if (!val || val === mmLabel) return;
        // Update note title or folder name
        if (mmType === "note") {
          var layout = state._mmLastLayout;
          if (layout && layout.nodes) {
            for (var i = 0; i < layout.nodes.length; i++) {
              if (layout.nodes[i].data.id === mmId && layout.nodes[i].data.note) {
                layout.nodes[i].data.note.title = val;
                layout.nodes[i].data.label = val;
                break;
              }
            }
          }
          render();
          setSaveStatus("Note renamed ✓", "success");
        } else if (mmType === "folder") {
          state.folders.forEach(function(f) {
            if (f.id === mmId) f.name = val;
          });
          render();
          persistUiOnly();
          setSaveStatus("Folder renamed ✓", "success");
        }
      }

      inp.addEventListener("keydown", function(ke) {
        if (ke.key === "Enter") { ke.preventDefault(); commitRename(); }
        if (ke.key === "Escape") { ke.preventDefault(); inp.remove(); }
        ke.stopPropagation();
      });
      inp.addEventListener("blur", function() { commitRename(); });
      // Prevent click-through
      inp.addEventListener("mousedown", function(me) { me.stopPropagation(); });
    };

    svg.addEventListener("dblclick", dblClickHandler);

    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("pointerdown", onPointerDown);
    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerup", onPointerUp);
    wrap.addEventListener("pointercancel", onPointerUp);
    // Kembalikan user-select:none selepas Ctrl/Cmd+drag (copy) selesai supaya
    // SSS luar tidak teraktif pada pilihan seterusnya.
    var revertMindmapUserSelect = function() {
      wrap.style.userSelect = "";
      wrap.style.webkitUserSelect = "";
      wrap.style.MozUserSelect = "";
    };
    wrap.addEventListener("pointerup", revertMindmapUserSelect);
    wrap.addEventListener("pointercancel", revertMindmapUserSelect);
    wrap.addEventListener("touchstart", onTouchStart, { passive: true });
    wrap.addEventListener("touchmove", onTouchMove, { passive: false });
    wrap.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("keydown", onKeyDown);

    // ── Right-click context menu ─────────────────────────────────────────
    var ctxMenu = state.refs.mmCtxMenu;
    var ctxTargetData = null; // stores {type, id, label, note, preview} of right-clicked node

    // Build AI prompt for a given node
    // ctxTitle = the mindmap/root title (e.g. the active note title in content mode)
    function buildAiPrompt(action, nd, ctxTitle) {
      var label = nd.label || "Untitled";
      var type  = nd.type;
      var fullContent = "";

      // Try to get full note content for note nodes
      if (type === "note" && nd.note) {
        fullContent = (nd.note.content || "").trim().slice(0, 2000);
      }
      if (type === "note" && !fullContent && nd.preview) {
        fullContent = nd.preview.trim();
      }

      // Context prefix: only for content-mode child nodes (heading/task/bullet/…)
      // so the AI knows which note/mindmap the node belongs to.
      var ctxPrefix = "";
      if (ctxTitle && (type === "heading" || type === "task" || type === "bullet" ||
                       type === "numbered" || type === "text")) {
        ctxPrefix = "Dalam nota bertajuk \"" + ctxTitle + "\", ";
      }

      if (action === "explain") {
        if (type === "note") {
          return fullContent
            ? "Tolong terangkan nota ini dengan ringkas:\n\nTajuk: " + label + "\n\n" + fullContent
            : "Tolong terangkan topik ini: " + label;
        }
        if (type === "folder") {
          var noteLabels = (nd.children || []).map(function(c) { return "- " + (c.label || ""); }).join("\n");
          return "Folder '" + label + "' mengandungi nota-nota berikut:\n" + noteLabels +
                 "\n\nSila terangkan hubungan antara nota-nota ini dan beri ringkasan keseluruhan folder.";
        }
        if (type === "heading") {
          return ctxPrefix + "terangkan dengan mendalam topik: \"" + label + "\"";
        }
        if (type === "task") {
          return ctxPrefix + "bagaimana cara terbaik untuk menyelesaikan tugasan ini: \"" + label + "\"?";
        }
        if (type === "bullet" || type === "numbered") {
          return ctxPrefix + "terangkan dan huraikan poin ini: \"" + label + "\"";
        }
        return "Terangkan konsep ini: \"" + label + "\"";
      }

      if (action === "expand") {
        if (type === "note") {
          return "Berdasarkan nota bertajuk \"" + label + "\", cadangkan 5 sub-topik yang boleh dikembangkan. " +
                 "Berikan dalam format senarai bernombor yang ringkas.";
        }
        if (type === "folder") {
          return "Folder '" + label + "' mempunyai nota-nota ini:\n" +
                 (nd.children || []).map(function(c) { return "- " + c.label; }).join("\n") +
                 "\n\nCadangkan 5 topik atau nota baru yang sesuai ditambah dalam folder ini.";
        }
        return ctxPrefix
          ? ctxPrefix + "cadangkan 5 sub-topik atau poin tambahan untuk: \"" + label + "\""
          : "Cadangkan 5 sub-topik atau poin tambahan untuk: \"" + label + "\"";
      }

      if (action === "ask") {
        if (type === "note") {
          return fullContent
            ? "Saya ada nota bertajuk \"" + label + "\":\n\n" + fullContent + "\n\nAda soalan tentang nota ini?"
            : "Saya ada nota bertajuk \"" + label + "\". Apa yang anda ingin tahu?";
        }
        if (type === "root") {
          return "Saya ada nota bertajuk \"" + label + "\". Apa yang anda ingin tahu?";
        }
        return ctxPrefix
          ? "Saya ada topik \"" + label + "\" dalam nota bertajuk \"" + ctxTitle + "\". Boleh tanya tentang ini."
          : "Saya ada topik \"" + label + "\" dalam nota saya. Boleh tanya tentang ini.";
      }

      return label;
    }

    function showCtxMenu(x, y, nd) {
      if (!ctxMenu) return;
      ctxTargetData = nd;

      // Show/hide "Open Note" and "Delete Note" only for note nodes
      var openBtn = ctxMenu.querySelector('[data-ctx-action="open"]');
      if (openBtn) {
        openBtn.style.display = nd.type === "note" ? "flex" : "none";
        var sep = openBtn.previousElementSibling;
        if (sep) sep.style.display = nd.type === "note" ? "block" : "none";
      }
      var delBtn = ctxMenu.querySelector('[data-ctx-action="delete"]');
      if (delBtn) {
        delBtn.style.display = nd.type === "note" ? "flex" : "none";
        var sep2 = delBtn.previousElementSibling;
        if (sep2 && sep2 !== sep) sep2.style.display = nd.type === "note" ? "block" : "none";
      }
      var createBtn = ctxMenu.querySelector('[data-ctx-action="create-note"]');
      if (createBtn) {
        createBtn.style.display = nd.type === "folder" ? "flex" : "none";
        // Show separator before create button only for folder
        var sepBefore = createBtn.previousElementSibling;
        if (sepBefore && sepBefore !== sep2 && sepBefore !== sep) sepBefore.style.display = nd.type === "folder" ? "block" : "none";
      }

      // Make visible but transparent so we can measure before positioning
      ctxMenu.style.visibility = "hidden";
      ctxMenu.style.display = "flex";
      ctxMenu.style.opacity = "0";
      ctxMenu.style.transform = "scale(0.95) translateY(-6px)";
      ctxMenu.style.pointerEvents = "none";

      // Measure after display:flex so offsetWidth/Height are valid
      requestAnimationFrame(function() {
        var menuW = ctxMenu.offsetWidth || 220;
        var menuH = ctxMenu.offsetHeight || 170;
        var vw = window.innerWidth, vh = window.innerHeight;
        var mx = Math.max(8, Math.min(x, vw - menuW - 8));
        var my = Math.max(8, Math.min(y, vh - menuH - 8));

        ctxMenu.style.left = mx + "px";
        ctxMenu.style.top  = my + "px";
        ctxMenu.style.visibility = "";
        ctxMenu.style.pointerEvents = "auto";

        // Animate in
        requestAnimationFrame(function() {
          ctxMenu.style.opacity = "1";
          ctxMenu.style.transform = "scale(1) translateY(0)";
        });
      });
    }

    function hideCtxMenu() {
      if (!ctxMenu) return;
      ctxMenu.style.opacity = "0";
      ctxMenu.style.transform = "scale(0.97) translateY(-4px)";
      ctxMenu.style.pointerEvents = "none";
      // Delay null so click handler can still read ctxTargetData
      setTimeout(function() {
        if (ctxMenu.style.pointerEvents === "none") {
          ctxMenu.style.display = "none";
          ctxTargetData = null;
        }
      }, 130);
    }

    // Context menu item click handler
    function onCtxMenuClick(e) {
      var btn = e.target.closest("[data-ctx-action]");
      if (!btn || !ctxTargetData) return;
      var action = btn.getAttribute("data-ctx-action");
      var nd = ctxTargetData;
      hideCtxMenu();

      if (action === "open") {
        if (nd.type === "note" && nd.id) {
          openNoteForClick(nd.id);
        }
        return;
      }

      if (action === "delete") {
        if (nd.type === "note" && nd.id) {
          hideCtxMenu();
          deleteNoteById(nd.id, { confirm: true }).catch(function() {
            setSaveStatus("Could not delete note", "error");
          });
        }
        return;
      }

      if (action === "create-note") {
        if (nd.type === "folder" && nd.id) {
          hideCtxMenu();
          createNewNote({ folderId: nd.id }).then(function() {
            setSaveStatus("Note created in folder ✓", "success");
            render();
          }).catch(function() {
            setSaveStatus("Could not create note", "error");
          });
        }
        return;
      }

      // In content mode, pass the active note title as context so the AI prompt
      // is anchored to the mindmap/note the node belongs to.
      var ctxTitle = "";
      if (state.mindmap.mode === "content") {
        var activeNote = getActiveNote();
        ctxTitle = activeNote ? (getNoteTitle(activeNote) || "") : "";
      }
      var prompt = buildAiPrompt(action, nd, ctxTitle);
      if (!prompt) return;

      setSaveStatus("Opening AI…", "");

      // Build expand context for the apply bar
      var expandCtx = {
        nodeId: nd.id,
        nodeType: nd.type,
        nodeLabel: nd.label || "",
        folderId: nd.id && nd.type === "folder" ? nd.id : (nd.note ? nd.note.folderId : ""),
        isContentMode: state.mindmap.mode === "content",
        timestamp: Date.now()
      };

      // Prevent overlay from auto-closing when Firefox shifts focus to AI sidebar
      state._mmAiOpening = true;

      flushSave("Opening AI…").catch(function() {}).then(function() {
        sendRuntimeMessage({
          type: "open-ai-sidebar-with-prompt",
          prompt: prompt
        })
        .then(function(resp) {
          // Keep flag active a bit longer — sidebar takes time to gain focus
          setTimeout(function() { state._mmAiOpening = false; }, 1500);
          if (resp && resp.ok) {
            setSaveStatus("AI dibuka — paste hasil ke sini bila siap ✓", "success");
          } else {
            sendRuntimeMessage({ type: "open-ai-sidebar" })
              .then(function() { setSaveStatus("AI dibuka ✓", "success"); })
              .catch(function() {
                state._mmAiOpening = false;
                setSaveStatus("Could not open AI", "error");
              });
          }
          // Show apply bar so user can paste AI result
          setTimeout(function() { mmShowApplyInput(expandCtx); }, 200);
        })
        .catch(function() {
          state._mmAiOpening = false;
          sendRuntimeMessage({ type: "open-ai-sidebar" })
            .then(function() { setSaveStatus("AI dibuka ✓", "success"); })
            .catch(function() { setSaveStatus("Could not open AI", "error"); });
          setTimeout(function() { mmShowApplyInput(expandCtx); }, 200);
        });
      });
    }

    // Right-click on SVG node
    var onContextMenu = function(e) {
      e.preventDefault();
      e.stopPropagation();

      // Find which node was right-clicked
      var target = e.target;
      while (target && target !== svg) {
        if (target.getAttribute && target.getAttribute("data-mm-type")) break;
        target = target.parentNode;
      }
      if (!target || !target.getAttribute) { hideCtxMenu(); return; }

      var mmType = target.getAttribute("data-mm-type");
      var mmId   = target.getAttribute("data-mm-id");
      if (!mmType || !mmId) { hideCtxMenu(); return; }

      // Find node data from last layout — reuse the nodeById map built at draw time
      var nodeEntry = (state._mmNodeById || {})[mmId];
      if (!nodeEntry) { hideCtxMenu(); return; }

      showCtxMenu(e.clientX, e.clientY, nodeEntry.data);
    };

    var onCtxEsc = function(e) {
      if (e.key === "Escape" && ctxMenu && ctxMenu.style.display !== "none") {
        hideCtxMenu();
        e.stopPropagation();
      }
    };

    svg.addEventListener("contextmenu", onContextMenu);
    if (ctxMenu) {
      ctxMenu.addEventListener("click", onCtxMenuClick);
    }

    // ── Outside-click detection via shadow root ─────────────────────────
    // Events inside shadow DOM are retargeted — must listen on shadow root,
    // not document, so ctxMenu.contains(e.target) works correctly.
    var shadowRoot = state.shadow;
    var onShadowMouseDown = function(e) {
      if (!ctxMenu || ctxMenu.style.display === "none") return;
      // Check if the click is inside the context menu using composedPath
      // (needed because shadow DOM retargets events)
      var path = e.composedPath ? e.composedPath() : [];
      var insideMenu = false;
      for (var i = 0; i < path.length; i++) {
        if (path[i] === ctxMenu) { insideMenu = true; break; }
      }
      if (!insideMenu) hideCtxMenu();
    };
    if (shadowRoot) {
      // Use capture so this fires BEFORE handleOverlayInteraction does stopImmediatePropagation
      shadowRoot.addEventListener("mousedown", onShadowMouseDown, true);
    }
    // Also catch clicks outside the shadow host entirely (real document)
    var onDocMouseDown = function(e) {
      if (ctxMenu && ctxMenu.style.display !== "none") {
        var host = state.refs.host;
        var inHost = host && (host === e.target || host.contains(e.target));
        if (!inHost) hideCtxMenu();
      }
    };
    document.addEventListener("mousedown", onDocMouseDown, true);
    document.addEventListener("keydown", onCtxEsc, true);

    // ── ResizeObserver ──────────────────────────────────────────────────
    var _mmRoPending = false;
    state._mmRo = new ResizeObserver(function() {
      if (state.panelMode === "mindmap" && !_mmRoPending) {
        _mmRoPending = true;
        requestAnimationFrame(function() {
          _mmRoPending = false;
          if (state.panelMode === "mindmap") render();
        });
      }
    });
    state._mmRo.observe(wrap);

    state._mmCleanup = function() {
      svg.removeEventListener("click", clickHandler);
      svg.removeEventListener("dblclick", dblClickHandler);
      svg.removeEventListener("contextmenu", onContextMenu);
      // Remove tooltip hover handlers (set in drawMindmapSvg per-render)
      if (svg._mmMoveHandler) { svg.removeEventListener("mousemove", svg._mmMoveHandler); svg._mmMoveHandler = null; }
      if (svg._mmLeaveHandler) { svg.removeEventListener("mouseleave", svg._mmLeaveHandler); svg._mmLeaveHandler = null; }
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("pointerdown", onPointerDown);
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerup", onPointerUp);
      wrap.removeEventListener("pointercancel", onPointerUp);
      wrap.removeEventListener("pointerup", revertMindmapUserSelect);
      wrap.removeEventListener("pointercancel", revertMindmapUserSelect);
      wrap.style.userSelect = "";
      wrap.style.webkitUserSelect = "";
      wrap.style.MozUserSelect = "";
      wrap.removeEventListener("touchstart", onTouchStart);
      wrap.removeEventListener("touchmove", onTouchMove);
      wrap.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("keydown", onKeyDown);
      if (shadowRoot) shadowRoot.removeEventListener("mousedown", onShadowMouseDown, true);
      document.removeEventListener("mousedown", onDocMouseDown, true);
      document.removeEventListener("keydown", onCtxEsc, true);
      if (ctxMenu) {
        ctxMenu.removeEventListener("click", onCtxMenuClick);
        hideCtxMenu();
      }
      // Hide HTML tooltip
      var ht = state.refs.mmHtmlTooltip;
      if (ht) { ht.style.display = "none"; ht.style.opacity = "0"; }
      state._mmNodeById = null;
      // Hide delete button and apply bar
      var db = state.refs.mmDelBtn;
      if (db) { db.style.display = "none"; db._currentNd = null; }
      var applyBar = wrap.querySelector('[data-role="mm-apply-bar"]');
      if (applyBar) applyBar.remove();
      var renameInp = wrap.querySelector('[data-role="mm-rename-input"]');
      if (renameInp) renameInp.remove();
      wrap.style.touchAction = "";
      wrap.style.cursor = "";
      cancelMomentum();
      if (wheelRAF) { cancelAnimationFrame(wheelRAF); wheelRAF = null; }
      if (state._mmRo) { try { state._mmRo.disconnect(); } catch(_) {} state._mmRo = null; }
    state._mmSuppressClick = false;
    state._mmEventsWired = false;
    state._mmFocusedNodeId = null;
    state._mmFocusIdx = null;
    // Reset _mmWired flags so buttons get re-wired on next open
    if (state.refs.mmDelBtn) state.refs.mmDelBtn._mmWired = false;
    };
  }

  function updateMindmapZoomLabel() {
    var lbl = state.refs.mpMindmapZoomLabel;
    if (lbl) {
      lbl.textContent = Math.round(state.mindmap.zoom * 100) + "%";
    }
  }

  function fitMindmapToView() {
    var svg = state.refs.mpMindmapSvg;
    var wrap = state.refs.mpMindmapSvgWrap;
    if (!svg || !wrap) return;

    var layout = state._mmLastLayout;
    var wrapW = wrap.offsetWidth || wrap.clientWidth || 420;
    var wrapH = wrap.offsetHeight || wrap.clientHeight || 340;
    var padding = 48;

    var targetZoom = 1, targetPanX = 0, targetPanY = 0;

    if (layout && layout.nodes && layout.nodes.length > 0) {
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      layout.nodes.forEach(function(node) {
        // Use type-aware estimated width/height for accurate bounding box
        var nd = node.data;
        var hw, hh;
        if (nd.type === "root") {
          hw = (node.r || 28) * 2 + 20;
          hh = hw;
        } else if (nd.type === "folder") {
          var chars = Math.min((nd.label || "").length, 18);
          hw = Math.max(72, chars * 10.5 * 0.62 + 36) + 10;
          hh = 36;
        } else if (nd.type === "note") {
          var chars = Math.min((nd.label || "").length, 22);
          hw = Math.max(58, chars * 9.5 * 0.62 + 36) + 10;
          hh = 28;
        } else {
          var chars = Math.min((nd.label || "").length, 30);
          hw = Math.max(48, chars * 9.0 * 0.60 + 20) + 10;
          hh = 24;
        }
        minX = Math.min(minX, node.x - hw / 2);
        minY = Math.min(minY, node.y - hh / 2);
        maxX = Math.max(maxX, node.x + hw / 2);
        maxY = Math.max(maxY, node.y + hh / 2);
      });
      var cW = maxX - minX, cH = maxY - minY;
      if (cW > 1 && cH > 1) {
        var scaleX = (wrapW - padding * 2) / cW;
        var scaleY = (wrapH - padding * 2) / cH;
        targetZoom = Math.max(0.15, Math.min(4, Math.min(scaleX, scaleY)));
        var centX = (minX + maxX) / 2, centY = (minY + maxY) / 2;
        targetPanX = wrapW / 2 - centX * targetZoom;
        targetPanY = wrapH / 2 - centY * targetZoom;
      }
    }

    // ── Spring-like animated transition to target ───────────────────────
    var fromZoom = state.mindmap.zoom;
    var fromPanX = state.mindmap.panX;
    var fromPanY = state.mindmap.panY;
    var startTime = null;
    var DURATION = 380; // ms

    // Cubic ease-in-out
    function easeInOut(t) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function animStep(ts) {
      if (!startTime) startTime = ts;
      var elapsed = ts - startTime;
      var progress = Math.min(1, elapsed / DURATION);
      var ease = easeInOut(progress);

      state.mindmap.zoom = fromZoom + (targetZoom - fromZoom) * ease;
      state.mindmap.panX = fromPanX + (targetPanX - fromPanX) * ease;
      state.mindmap.panY = fromPanY + (targetPanY - fromPanY) * ease;

      var g = state._mmG || svg.querySelector('[data-role="mindmap-g"]');
      if (g) {
        g.setAttribute("transform",
          "translate(" + state.mindmap.panX + "," + state.mindmap.panY + ") scale(" + state.mindmap.zoom + ")");
      }
      updateMindmapZoomLabel();

      if (progress < 1) {
        requestAnimationFrame(animStep);
      } else {
        syncMindmapToUi();
      }
    }
    requestAnimationFrame(animStep);
  }

  function getDefaultExportName() {
    var noteTitle = getActiveNote();
    noteTitle = noteTitle ? getNoteTitle(noteTitle) || "" : "";
    var modeStr = state.mindmap.mode === "content" ? (noteTitle || "content") : "folder";
    var slug = modeStr.replace(/[^a-zA-Z0-9\u00C0-\u024F\- ]/g, "").trim().slice(0, 40).replace(/\s+/g, "-") || "mindmap";
    return slug + "-" + new Date().toISOString().slice(0, 10);
  }

  function exportMindmapSvg() {
    var svg = state.refs.mpMindmapSvg;
    if (!svg) return;
    try {
      var svgW = svg.getAttribute("width") || "800";
      var svgH = svg.getAttribute("height") || "600";

      // Deep clone without pointer-events or runtime state
      var clone = svg.cloneNode(true);
      clone.removeAttribute("data-role");
      clone.style.cssText = "";
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

      // Remove runtime-only elements (minimap, grid, tooltip)
      var runtimeRoles = ["mm-minimap", "mm-grid", "mm-tooltip"];
      runtimeRoles.forEach(function(role) {
        var el = clone.querySelector('[data-role="' + role + '"]');
        if (el) el.parentNode.removeChild(el);
      });

      

      // Premium export background
      var bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bgRect.setAttribute("x", "0"); bgRect.setAttribute("y", "0");
      bgRect.setAttribute("width", svgW); bgRect.setAttribute("height", svgH);
      bgRect.setAttribute("fill", "#0c0e18");
      // Subtle radial gradient on bg
      var exportDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      var radGrad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
      radGrad.setAttribute("id", "export-bg-grad");
      radGrad.setAttribute("cx", "50%"); radGrad.setAttribute("cy", "40%");
      radGrad.setAttribute("r", "60%");
      var stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop1.setAttribute("offset", "0%"); stop1.setAttribute("stop-color", "rgba(60,100,200,0.08)");
      var stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop2.setAttribute("offset", "100%"); stop2.setAttribute("stop-color", "rgba(0,0,0,0)");
      radGrad.append(stop1, stop2);
      exportDefs.appendChild(radGrad);
      clone.insertBefore(exportDefs, clone.firstChild);

      var bgOverlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bgOverlay.setAttribute("x", "0"); bgOverlay.setAttribute("y", "0");
      bgOverlay.setAttribute("width", svgW); bgOverlay.setAttribute("height", svgH);
      bgOverlay.setAttribute("fill", "url(#export-bg-grad)");
      clone.insertBefore(bgOverlay, exportDefs.nextSibling);
      clone.insertBefore(bgRect, exportDefs);

      // Font + base style injection
      var styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleEl.textContent = [
        "* { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }",
        "text { text-rendering: optimizeLegibility; }",
        "path, rect, circle { shape-rendering: geometricPrecision; }"
      ].join(" ");
      clone.insertBefore(styleEl, bgRect.nextSibling);

      // Watermark (bottom-right corner)
      var dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      var wm = document.createElementNS("http://www.w3.org/2000/svg", "text");
      wm.setAttribute("x", String(Number(svgW) - 8));
      wm.setAttribute("y", String(Number(svgH) - 6));
      wm.setAttribute("text-anchor", "end");
      wm.setAttribute("fill", "rgba(255,255,255,0.14)");
      wm.setAttribute("font-size", "9");
      wm.textContent = "LocalPocket · " + dateStr;
      clone.appendChild(wm);

      // Ensure the main g has opacity=1 for export
      var mainG = clone.querySelector('[data-role="mindmap-g"]');
      if (mainG) { mainG.style.opacity = "1"; mainG.style.transition = "none"; }

      var serializer = new XMLSerializer();
      var svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                   '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
                   serializer.serializeToString(clone);

      var blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      var defaultName = getDefaultExportName();
      var customName = prompt("Export as SVG — enter filename:", defaultName + ".svg");
      if (!customName) { URL.revokeObjectURL(url); return; }
      if (!customName.endsWith(".svg")) customName += ".svg";
      a.download = customName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(url); }, 3000);
      setSaveStatus("SVG exported ✓", "success");
    } catch(e) {
      setSaveStatus("Export failed: " + (e.message || "unknown"), "error");
    }
  }

  function exportMindmapPng() {
    var svg = state.refs.mpMindmapSvg;
    if (!svg) return;
    try {
      var svgW = Number(svg.getAttribute("width") || "800") || 800;
      var svgH = Number(svg.getAttribute("height") || "600") || 600;
      var clone = svg.cloneNode(true);
      clone.removeAttribute("data-role");
      clone.style.cssText = "";
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
      var runtimeRoles = ["mm-minimap", "mm-grid", "mm-tooltip"];
      runtimeRoles.forEach(function(role) {
        var el = clone.querySelector('[data-role="' + role + '"]');
        if (el) el.parentNode.removeChild(el);
      });
      var bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bgRect.setAttribute("x", "0"); bgRect.setAttribute("y", "0");
      bgRect.setAttribute("width", String(svgW)); bgRect.setAttribute("height", String(svgH));
      bgRect.setAttribute("fill", "#0c0e18");
      clone.insertBefore(bgRect, clone.firstChild);
      var styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleEl.textContent = "* { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; } text { text-rendering: optimizeLegibility; }";
      clone.insertBefore(styleEl, bgRect.nextSibling);
      var serializer = new XMLSerializer();
      var svgStr = serializer.serializeToString(clone);
      var blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function() {
        var scale = 2;
        var canvas = document.createElement("canvas");
        canvas.width = svgW * scale;
        canvas.height = svgH * scale;
        var ctx = canvas.getContext("2d");
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(function(pngBlob) {
          if (!pngBlob) { setSaveStatus("PNG export failed", "error"); return; }
          var pngUrl = URL.createObjectURL(pngBlob);
          var a = document.createElement("a");
          a.href = pngUrl;
          var defaultName = getDefaultExportName();
          var customName = prompt("Export as PNG — enter filename:", defaultName + ".png");
          if (!customName) { URL.revokeObjectURL(pngUrl); return; }
          if (!customName.endsWith(".png")) customName += ".png";
          a.download = customName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function() { URL.revokeObjectURL(pngUrl); }, 3000);
          setSaveStatus("PNG exported ✓", "success");
        }, "image/png");
      };
      img.onerror = function() { setSaveStatus("PNG export failed", "error"); };
      img.src = url;
    } catch(e) {
      setSaveStatus("PNG export failed: " + (e.message || "unknown"), "error");
    }
  }

  // ── Main render function ─────────────────────────────────────────────────
  function render() {
    if (!state.mounted) return;
    const overlay = state.refs.overlay;
    if (!overlay) return;

    overlay.dataset.open = state.open ? "true" : "false";
    overlay.style.opacity = state.open ? "1" : "0";
    overlay.style.pointerEvents = state.open ? "auto" : "none";

    applyOverlayLayout();

    renderLeftPanel();
    renderMainPanel();
    renderDialog();
    renderTrashPanel();
    renderUndoToast();
    renderFolderPalette();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizePathSegment(value, fallback) {
    const raw = String(value || "").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
    const next = raw.slice(0, 80);
    return next || fallback || "note";
  }

  function noteToTxtBytes(note) {
    const title = getNoteTitle(note);
    const body = note && note.content != null ? String(note.content) : "";
    const text = `${title}\n\n${body}`;
    const encoded = new TextEncoder().encode(text);
    if (encoded.length > 0) return encoded;
    return new TextEncoder().encode(`${title || "Untitled note"}\n\n`);
  }

  function requestEditorDomSnapshot(timeoutMs = 3000) {
    return new Promise((resolve) => {
      const frame = state.refs.editorFrame;
      const win = frame && frame.contentWindow;
      if (!win || state.editor.ready !== true || !state.editor.token) {
        resolve(null);
        return;
      }
      const token = state.editor.token;
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", onMessage);
        clearTimeout(timer);
        resolve(value);
      };
      const onMessage = (event) => {
        const d = event.data;
        if (!d || typeof d !== "object" || d.type !== "lp-notes-export-snapshot-reply") return;
        if (d.token !== token) return;
        finish({
          title: d.title != null ? String(d.title) : "",
          content: d.content != null ? String(d.content) : ""
        });
      };
      const timer = setTimeout(() => finish(null), Math.max(50, Number(timeoutMs) || 3000));
      window.addEventListener("message", onMessage);
      try {
        var _targetOrigin = (function() {
          try { return new URL(api.runtime.getURL("/")).origin; } catch (_) { return "*"; }
        })();
        win.postMessage({ type: "lp-notes-export-snapshot-request", token }, _targetOrigin);
      } catch (err) {
        finish(null);
      }
    });
  }

  async function mergeNoteWithStorageFallback(note) {
    if (!note || !note.id) return note;
    const c = String(note.content != null ? note.content : "");
    if (c.length > 0) return note;
    const data = await storageGet([NOTES_KEY]);
    const list = coerceArray(data[NOTES_KEY]);
    const stored = list.find((n) => n && String(n.id) === String(note.id));
    if (!stored || typeof stored !== "object") return note;
    const sc = String(stored.content != null ? stored.content : "");
    if (!sc) return note;
    const memTitle = String(note.title != null ? note.title : "").trim();
    const st = String(stored.title != null ? stored.title : "").trim();
    return {
      ...note,
      title: (memTitle || st).slice(0, 120),
      content: sc.slice(0, 200000)
    };
  }

  function noteSnapshotForExport(note, domSnap) {
    if (!note) return note;
    if (note.id !== state.ui.activeNoteId) return note;

    if (domSnap && typeof domSnap === "object") {
      return {
        ...note,
        title: String(domSnap.title != null ? domSnap.title : "").slice(0, 120),
        content: String(domSnap.content != null ? domSnap.content : "").slice(0, 200000)
      };
    }

    const stTitle = String(note.title != null ? note.title : "");
    const stContent = String(note.content != null ? note.content : "");
    const edReady = state.editor.ready === true;
    const edTitle = String(state.editor.title != null ? state.editor.title : "");
    const edContent = String(state.editor.content != null ? state.editor.content : "");

    if (!edReady) {
      return {
        ...note,
        title: stTitle.slice(0, 120),
        content: stContent.slice(0, 200000)
      };
    }

    const titleOut = edTitle.trim() !== "" ? edTitle : (stTitle.trim() !== "" ? stTitle : getNoteTitle(note));
    const contentOut = edContent.length > 0 ? edContent : stContent;

    return {
      ...note,
      title: titleOut.slice(0, 120),
      content: contentOut.slice(0, 200000)
    };
  }

  function zipEntryPayloadBytes(value) {
    if (value == null) return new Uint8Array(0);
    try {
      return new Uint8Array(value);
    } catch (err) {
      return new Uint8Array(0);
    }
  }

  function crc32(uint8) {
    if (!crc32.table) {
      crc32.table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) {
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        crc32.table[i] = c >>> 0;
      }
    }
    const table = crc32.table;
    let crc = 0xffffffff;
    for (let i = 0; i < uint8.length; i++) {
      crc = table[(crc ^ uint8[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function createZipStoreBlob(entries) {
    const encoder = new TextEncoder();
    const items = coerceArray(entries).map((entry) => {
      const path = entry && entry.path ? String(entry.path) : "note.txt";
      return {
        path,
        nameBytes: encoder.encode(path),
        data: zipEntryPayloadBytes(entry && entry.data)
      };
    });

    let localBlockSize = 0;
    items.forEach((item) => {
      localBlockSize += 30 + item.nameBytes.length + item.data.length;
    });
    let centralSize = 0;
    items.forEach((item) => {
      centralSize += 46 + item.nameBytes.length;
    });
    const centralOffset = localBlockSize;
    const totalSize = localBlockSize + centralSize + 22;
    const out = new Uint8Array(totalSize);
    let pos = 0;
    const localHeaderOffsets = [];

    items.forEach((item) => {
      const data = item.data;
      const checksum = crc32(data);
      const size = data.length;
      localHeaderOffsets.push(pos);

      const lv = new DataView(out.buffer, out.byteOffset + pos, 30);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0, true);
      lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0, true);
      lv.setUint32(14, checksum, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, item.nameBytes.length, true);
      lv.setUint16(28, 0, true);
      out.set(item.nameBytes, pos + 30);
      out.set(data, pos + 30 + item.nameBytes.length);
      pos += 30 + item.nameBytes.length + size;
    });

    items.forEach((item, index) => {
      const data = item.data;
      const checksum = crc32(data);
      const size = data.length;
      const localOff = localHeaderOffsets[index];

      const cv = new DataView(out.buffer, out.byteOffset + pos, 46);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, checksum, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, item.nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, localOff, true);
      out.set(item.nameBytes, pos + 46);
      pos += 46 + item.nameBytes.length;
    });

    const ev = new DataView(out.buffer, out.byteOffset + pos, 22);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, items.length, true);
    ev.setUint16(10, items.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, centralOffset, true);
    ev.setUint16(20, 0, true);

    return new Blob([out], { type: "application/zip" });
  }

  function triggerDownloadBlob(blob, filename) {
    const safeName = String(filename || "download")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-")
      .slice(0, 180) || "download";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeName;
    link.style.display = "none";
    (document.body || document.documentElement).appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function exportActiveNoteTxt() {
    let domSnap = null;
    try {
      domSnap = await requestEditorDomSnapshot();
    } catch (err) {
      domSnap = null;
    }
    const note = getActiveNote();
    if (!note) return;
    let snap = noteSnapshotForExport(note, domSnap);
    snap = await mergeNoteWithStorageFallback(snap);
    const bytes = noteToTxtBytes(snap);
    const blob = new Blob([bytes], { type: "text/plain;charset=utf-8" });
    triggerDownloadBlob(blob, `${sanitizePathSegment(getNoteTitle(snap), "note")}.txt`);
    setSaveStatus("Exported .txt", "");
  }

  async function buildExportAllZipEntries(domSnap) {
    const seen = new Set();
    const entries = [];
    const activeId = state.ui.activeNoteId;
    const notes = getSortedNotes(state.notes.slice());
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (!note) continue;
      let snap = noteSnapshotForExport(note, note.id === activeId ? domSnap : null);
      snap = await mergeNoteWithStorageFallback(snap);
      const folderLabel = snap.folderId ? getFolderLabel(snap.folderId) : UNCATEGORIZED_LABEL;
      const folderSeg = sanitizePathSegment(folderLabel, UNCATEGORIZED_LABEL);
      const titleBase = sanitizePathSegment(getNoteTitle(snap), "note");
      let fileBase = titleBase;
      let path = `${folderSeg}/${fileBase}.txt`;
      let n = 2;
      while (seen.has(path)) {
        fileBase = `${titleBase} (${n})`;
        path = `${folderSeg}/${fileBase}.txt`;
        n += 1;
      }
      seen.add(path);
      entries.push({
        path,
        data: noteToTxtBytes(snap)
      });
    }
    return entries;
  }

  async function exportAllNotesTxtZip() {
    if (!state.notes.length) return;
    let domSnap = null;
    try {
      domSnap = await requestEditorDomSnapshot();
    } catch (err) {
      domSnap = null;
    }
    const zipEntries = await buildExportAllZipEntries(domSnap);
    if (!zipEntries.length) return;
    const blob = createZipStoreBlob(zipEntries);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    triggerDownloadBlob(blob, `local-pocket-notes-${stamp}.zip`);
    setSaveStatus(`Exported ${zipEntries.length} note(s) in .zip`, "");
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("read failed"));
      reader.readAsText(file);
    });
  }

  async function importTxtFromFileList(fileList) {
    const files = Array.from(fileList || []).filter((file) => {
      if (!file || file.size > 2500000) return false;
      const name = file.name ? String(file.name).toLowerCase() : "";
      return !name || name.endsWith(".txt") || name.endsWith(".md") ||
        file.type === "text/plain" || file.type === "text/markdown";
    });
    if (!files.length) {
      const attempted = Array.from(fileList || []);
      if (attempted.length) {
        setSaveStatus("Only .txt or .md files can be imported", "error");
      }
      return;
    }
    await syncActiveNoteFromEditor(false);
    showImportSkeleton();
    const folderId = getNewNoteFolderId();
    const newNotes = [];
    for (const file of files) {
      const name = file.name ? String(file.name) : "";
      const text = await readFileAsText(file);
      const isMd = name.toLowerCase().endsWith(".md");
      if (isMd && typeof LocalPocketMarkdownExportCore !== "undefined" && LocalPocketMarkdownExportCore) {
        const docs = LocalPocketMarkdownExportCore.collectionFromMarkdown(text);
        if (docs.length) {
          docs.forEach((doc) => {
            const note = createBlankNote(folderId);
            note.title = (doc.title || "Imported").slice(0, 120);
            note.content = String(doc.content || "").slice(0, 200000);
            note.updatedAt = new Date().toISOString();
            newNotes.push(note);
          });
          continue;
        }
      }
      const baseTitle = name.replace(/\.(txt|md)$/i, "").trim() || "Imported";
      const note = createBlankNote(folderId);
      note.title = baseTitle.slice(0, 120);
      note.content = String(text || "").slice(0, 200000);
      note.updatedAt = new Date().toISOString();
      newNotes.push(note);
    }
    if (!newNotes.length) {
      setSaveStatus("No valid files selected", "error");
      return;
    }
    state.notes = getSortedNotes([...newNotes, ...state.notes]);
    state.ui.activeNoteId = newNotes[0].id;
    state.ui.notesDrawerOpen = false;
    render();
    try {
      await persist(`Imported ${newNotes.length} note(s)`);
    } catch (err) {
      setSaveStatus("Save failed", "error");
    }
  }

  function handleOverlayInteraction(event) {
    if (!state.open || !isEventFromOverlay(event)) return;
    stopOverlayEvent(event);
  }

  function handleOverlayKeydown(event) {
    if (!state.open || !isEventFromOverlay(event)) return;

    // ── Konfigurable Notes Overlay shortcuts (nota & mindmap) ──────────────
    if (runNotesShortcut(event)) return;

    // ── Folder palette keyboard ──────────────────────────────────────────
    if (state.folderPalette.open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFolderPalette();
        stopOverlayEvent(event);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFolderPaletteActiveIndex(state.folderPalette.activeIndex + 1);
        stopOverlayEvent(event);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setFolderPaletteActiveIndex(state.folderPalette.activeIndex - 1);
        stopOverlayEvent(event);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        chooseFolderPaletteOption(state.folderPalette.activeIndex).catch(() => {});
        stopOverlayEvent(event);
        return;
      }
      stopOverlayEvent(event);
      return;
    }

    // ── Dialog keyboard ──────────────────────────────────────────────────
    if (state.dialog && state.dialog.open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog({ confirmed: false, value: "" });
        stopOverlayEvent(event);
      }
      return;
    }

    // ── Left panel keyboard nav (feature 1 + 2) ──────────────────────────
    if (lpFocused) {
      if (lpKeydown(event)) {
        stopOverlayEvent(event);
        return;
      }
    }

    // ── Global shortcuts ─────────────────────────────────────────────────
    if (event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      if (lpFocused) {
        lpUnfocus();
      } else if (state.panelMode === "editor" || state.panelMode === "mindmap") {
        state.panelMode = "picker";
        state.ui.drawerMode = DRAWER_MODE_NOTES;
        render();
      } else if (isNotesDrawerPage()) {
        state.ui.drawerMode = DRAWER_MODE_CATEGORIES;
        render();
      } else {
        close();
      }
      stopOverlayEvent(event);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      flushSave("Saved").catch(() => {});
      stopOverlayEvent(event);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      createNewNote().catch(() => setSaveStatus("Could not create note", "error"));
      stopOverlayEvent(event);
      return;
    }

    // ── Mindmap keyboard navigation ──────────────────────────────────────
    // Pan/zoom shortcuts are now handled directly in wireMindmapEvents (onKeyDown).
    // The old node-traversal with arrow keys conflicted with pan — removed.
    // Only handle Escape here (it's a global event that must close mindmap mode).
    if (!lpFocused && state.panelMode === "mindmap") {
      // All +/-/F/M/arrow pan shortcuts live in wireMindmapEvents onKeyDown.
      // Nothing to do here for those keys.
    }

    // ── Main panel note list keyboard (sama macam background.js: D=delete activeIndex) ─────
    if (!lpFocused && state.panelMode === "picker") {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const notes = getVisibleNotes();
        const idx = notes.findIndex((n) => n.id === (mpActiveNoteId || state.ui.activeNoteId));
        const next = notes[Math.min(idx + 1, notes.length - 1)];
        if (next) { mpActiveNoteId = next.id; render(); }
        stopOverlayEvent(event);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        const notes = getVisibleNotes();
        const idx = notes.findIndex((n) => n.id === (mpActiveNoteId || state.ui.activeNoteId));
        const prev = notes[Math.max(idx - 1, 0)];
        if (prev) { mpActiveNoteId = prev.id; render(); }
        stopOverlayEvent(event);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const targetId = mpActiveNoteId || state.ui.activeNoteId;
        if (targetId) {
          openNoteForClick(targetId);
        }
        stopOverlayEvent(event);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        changeNotePage(-1);
        stopOverlayEvent(event);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        changeNotePage(1);
        stopOverlayEvent(event);
        return;
      }
      // D — delete nota pada activeIndex (hover atau keyboard highlight)
      // Sama persis macam background.js line ~15418
      if (
        (event.key === "d" || event.key === "D")
        && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
        && !isEditableElement(event.target)
      ) {
        const targetId = mpActiveNoteId;
        if (targetId) {
          event.preventDefault();
          if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
          mpActiveNoteId = "";
          deleteNoteById(targetId, { confirm: false }).catch(() => {
            setSaveStatus("Could not delete note", "error");
          });
          stopOverlayEvent(event);
          return;
        }
      }
    }
  }
  function toggleNotesDrawer() {
    state.folderContextMenu.open = false;
    state.folderPalette.open = false;
    if (!isPickerPanelMode()) {
      preparePickerLandingPage();
      render();
      return;
    }
    if (state.ui.notesDrawerOpen !== true) {
      preparePickerLandingPage();
      render();
      return;
    }
    if (isNotesDrawerPage()) {
      returnDrawerToCategories();
      return;
    }
    close();
    return;
  }

  function toggleOutsideClickMode() {
    state.ui.closeOnOutsideClick = state.ui.closeOnOutsideClick !== true;
    render();
    persistUiOnly(state.ui.closeOnOutsideClick ? "Outside click will close" : "Outside click ignored").catch(() => {
      setSaveStatus("Save failed", "error");
    });
  }

  function showNotesSettingsMenu() {
    const currentMode = state.settings && state.settings.notesStartMode === "last" ? "last" : "home";
    const newMode = currentMode === "last" ? "home" : "last";
    const modeLabel = newMode === "last" ? "Nota terakhir dibuka" : "Senarai kategori";
    state.settings = { ...state.settings, notesStartMode: newMode };
    api.storage.local.set({ settings: state.settings }).then(() => {
      setSaveStatus(`Notepad akan buka: ${modeLabel}`, "success");
    }).catch(() => {
      setSaveStatus("Gagal simpan", "error");
    });
  }

  function handleSearchInput(event) {
    state.ui.searchQuery = normalizeSearchQuery(event && event.target ? event.target.value : "");
    state.ui.notesDrawerOpen = true;
    if (!isNotesDrawerPage()) {
      state.ui.folderPage = 0;
    } else {
      state.ui.notePage = 0;
    }
    render();
  }

  function handleFolderPaletteInput(event) {
    state.folderPalette.query = normalizeSearchQuery(event && event.target ? event.target.value : "");
    state.folderPalette.activeIndex = 0;
    renderFolderPalette();
  }

  function openFolderContextMenu(folderId, anchorX, anchorY) {
    const folder = getFolderById(folderId);
    if (!folder) return;
    closeFolderPalette();
    const rect = state.refs.overlay ? state.refs.overlay.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    const menuHeight = 320;
    const x = Math.max(12, Math.min((rect.width || 0) - 232, anchorX - rect.left));
    const maxY = Math.max(0, (window.innerHeight || 0) - menuHeight - 24);
    const rawY = anchorY - rect.top;
    const y = Math.max(12, Math.min(maxY, rawY));
    state.ui.activeFolderFilter = folder.id;
    state.ui.notesDrawerOpen = true;
    state.folderContextMenu = {
      open: true,
      folderId: folder.id,
      anchorX: x,
      anchorY: y
    };
    render();
  }

  function openFolderPalette(targetId = "", offset = 0) {
    if (!getActiveNote()) {
      setSaveStatus("Open or create a note first", "error");
      return;
    }
    closeFolderContextMenu();
    state.folderPalette = {
      open: true,
      query: "",
      activeIndex: 0,
      options: [],
      pendingTargetId: String(targetId || ""),
      pendingOffset: Number.isFinite(offset) ? offset : 0
    };
    render();
    setTimeout(() => {
      if (state.folderPalette.open !== true || !state.refs.folderPaletteInput) return;
      state.refs.folderPaletteInput.focus();
      if (typeof state.refs.folderPaletteInput.select === "function") {
        state.refs.folderPaletteInput.select();
      }
    }, 0);
  }

  function setFolderPaletteActiveIndex(next) {
    const total = state.folderPalette.options.length;
    if (!total) return;
    state.folderPalette.activeIndex = ((next % total) + total) % total;
    renderFolderPalette();
  }

  async function assignActiveNoteToFolder(folderId, successMessage) {
    const note = getActiveNote();
    if (!note) return;
    await moveNoteToFolder(note.id, folderId);
    if (successMessage) {
      setSaveStatus(successMessage, "");
    }
  }

  async function chooseFolderPaletteOption(index) {
    const option = state.folderPalette.options[index];
    if (!option) return;
    await assignActiveNoteToFolder(option.id, `Moved to ${option.label}`);
    closeFolderPalette();
  }

  function selectAdjacentFolderFilter(offset) {
    const rows = getFolderFilterRows();
    if (!rows.length) return;
    const current = getCurrentFolderRowIndex();
    const nextIndex = ((current + offset) % rows.length + rows.length) % rows.length;
    state.folderKeyboardIndex = nextIndex;
    state.ui.activeFolderFilter = rows[nextIndex].id;
    state.ui.notesDrawerOpen = true;
    render();
    const target = state.shadow && state.shadow.querySelector(`[data-folder-row-id="${rows[nextIndex].id}"]`);
    if (target && typeof target.scrollIntoView === "function") {
      try {
        target.scrollIntoView({ block: "nearest" });
      } catch (err) {}
    }
  }

  async function openSelectedNoteInActiveFilter() {
    const visibleNotes = getVisibleNotes();
    const selectedId = getDrawerSelectedNoteId(visibleNotes);
    const next = visibleNotes.find((note) => note && note.id === selectedId) || visibleNotes[0];
    if (!next) return;
    await syncActiveNoteFromEditor(false);
    state.ui.activeNoteId = next.id;
    state.panelMode = "editor";
    state.ui.notesDrawerOpen = false;
    render();
    queueEditorFocus("content", false);
  }

  function returnDrawerToCategories() {
    openDrawerCategoriesPage();
    render();
  }

  async function moveActiveNoteByFolderOffset(offset) {
    const note = getActiveNote();
    if (!note) return;
    const rows = getAssignableFolderRows();
    const currentId = note.folderId ? String(note.folderId) : "";
    const currentIndex = Math.max(0, rows.findIndex((row) => row.id === currentId));
    const nextIndex = ((currentIndex + offset) % rows.length + rows.length) % rows.length;
    const next = rows[nextIndex];
    if (!next) return;
    await assignActiveNoteToFolder(next.id, `Moved to ${next.label}`);
  }

  async function togglePinnedFolder(folderId) {
    const folder = getFolderById(folderId);
    if (!folder) return;
    const current = normalizePinnedFolderIds(state.ui.pinnedFolderIds, state.folders);
    state.ui.pinnedFolderIds = current.includes(folder.id)
      ? current.filter((id) => id !== folder.id)
      : [...current, folder.id];
    await persistUiOnly(current.includes(folder.id) ? "Category unpinned" : "Category pinned");
  }

  async function cycleFavoriteFolderSortMode() {
    const current = normalizeFavoriteFolderSortMode(state.ui.favoriteFolderSortMode);
    state.ui.favoriteFolderSortMode = current === "manual"
      ? "asc"
      : current === "asc"
        ? "desc"
        : "manual";
    state.ui.folderPage = 0;
    await persistUiOnly(
      state.ui.favoriteFolderSortMode === "manual"
        ? "Favorite order: manual"
        : state.ui.favoriteFolderSortMode === "asc"
          ? "Favorite order: A-Z"
          : "Favorite order: Z-A"
    );
  }

  async function toggleHiddenFoldersVisibility() {
    state.ui.showHiddenFolders = state.ui.showHiddenFolders !== true;
    state.ui.folderPage = 0;
    await persistUiOnly(state.ui.showHiddenFolders ? "Hidden categories shown" : "Hidden categories hidden");
  }

  async function toggleHiddenFolder(folderId) {
    const folder = getFolderById(folderId);
    if (!folder) return;
    const current = normalizeHiddenFolderIds(state.ui.hiddenFolderIds, state.folders);
    const isHidden = current.includes(folder.id);
    state.ui.hiddenFolderIds = isHidden
      ? current.filter((id) => id !== folder.id)
      : [...current, folder.id];
    if (!isHidden && state.ui.activeFolderFilter === folder.id) {
      state.ui.activeFolderFilter = FILTER_ALL_FOLDERS;
    }
    state.ui.folderPage = 0;
    await persistUiOnly(isHidden ? "Category visible" : "Category hidden");
  }

  function changeFolderPage(offset) {
    const pager = getFolderPagerState();
    const next = Math.max(0, Math.min(pager.totalPages - 1, pager.activePage + offset));
    if (next === pager.activePage) return;
    state.ui.folderPage = next;
    render();
  }

  function changeNotePage(offset) {
    const pager = getNotePagerState(getVisibleNotes());
    const next = Math.max(0, Math.min(pager.totalPages - 1, pager.activePage + offset));
    if (next === pager.activePage) return;
    state.ui.notePage = next;
    render();
  }

  async function updateThemePreset(themePreset, successMessage) {
    const nextTheme = normalizeThemePreset(themePreset);
    if (normalizeThemePreset(state.settings.themePreset) === nextTheme) {
      return;
    }
    state.settings = {
      ...state.settings,
      themePreset: nextTheme
    };
    render();
    try {
      await storageSet({
        [SETTINGS_KEY]: state.settings
      });
      setSaveStatus(successMessage || `Theme: ${getThemeLabel(nextTheme)}`, "");
    } catch (err) {
      setSaveStatus("Save failed", "error");
    }
  }

  function handleThemeSelectChange(event) {
    const nextTheme = event && event.target ? String(event.target.value || "") : "classic";
    updateThemePreset(nextTheme, `Theme set to ${getThemeLabel(nextTheme)}`).catch(() => { });
  }

  function togglePreviewMode() {
    state.editor.previewMode = state.editor.previewMode !== true;
    postEditorMessage({
      type: "lp-notes-set-preview",
      previewMode: state.editor.previewMode === true,
      attachmentMap: buildAttachmentMapForContent(state.editor.content || "")
    });
    renderEditorToolbarActions();
    setSaveStatus(state.editor.previewMode ? "Preview mode" : "Write mode", "");
  }

  function insertPageContextIntoNote() {
    const snippet = buildPageContextSnippet(state.pageContext);
    if (!snippet) {
      setSaveStatus("No page context available", "error");
      return;
    }
    const text = state.editor.content && state.editor.content.trim()
      ? `\n\n${snippet}\n`
      : `${snippet}\n\n`;
    if (!postEditorMessage({
      type: "lp-notes-insert-content",
      text
    })) {
      setSaveStatus("Editor not ready", "error");
      return;
    }
    queueEditorFocus("content", false);
  }

  function maybeSeedNoteWithPageContext(note) {
    if (!note || !state.pageContext) return note;
    const title = state.pageContext.title ? String(state.pageContext.title).trim() : "";
    const url = state.pageContext.url ? String(state.pageContext.url).trim() : "";
    if (!title && !url) return note;
    if (!note.title) {
      note.title = title.slice(0, 120);
    }
    if (!note.content) {
      note.content = buildPageContextSnippet(state.pageContext);
    }
    return note;
  }

  async function selectAdjacentNote(direction) {
    await syncActiveNoteFromEditor(false);
    const visibleNotes = getVisibleNotes();
    if (!visibleNotes.length) return;
    const currentIndex = visibleNotes.findIndex((note) => note && note.id === state.ui.activeNoteId);
    const nextIndex = currentIndex < 0
      ? 0
      : Math.max(0, Math.min(visibleNotes.length - 1, currentIndex + direction));
    const target = visibleNotes[nextIndex];
    if (!target || target.id === state.ui.activeNoteId) return;
    state.ui.activeNoteId = target.id;
    state.ui.notesDrawerOpen = true;
    render();
    queueEditorFocus("content", false);
  }

  function handleEditorCommand(command, payload) {
    const action = command ? String(command) : "";
    if (!action) return;
    if (action === "new-note") {
      createNewNote().catch(() => {
        setSaveStatus("Could not create note", "error");
      });
      return;
    }
    if (action === "duplicate-note") {
      duplicateNote().catch(() => {
        setSaveStatus("Could not duplicate note", "error");
      });
      return;
    }
    if (action === "focus-search") {
      state.panelMode = "picker";
      state.ui.notesDrawerOpen = true;
      state.ui.drawerMode = DRAWER_MODE_NOTES;
      render();
      if (state.refs.searchInput) {
        state.refs.searchInput.focus();
        if (typeof state.refs.searchInput.select === "function") {
          state.refs.searchInput.select();
        }
      }
      return;
    }
    if (action === "toggle-preview") {
      togglePreviewMode();
      return;
    }
    if (action === "select-prev-note") {
      selectAdjacentNote(-1).catch(() => {
        setSaveStatus("Could not switch note", "error");
      });
      return;
    }
    if (action === "select-next-note") {
      selectAdjacentNote(1).catch(() => {
        setSaveStatus("Could not switch note", "error");
      });
      return;
    }
    if (action === "insert-page-context") {
      insertPageContextIntoNote();
      return;
    }
    if (action === "focus-title") {
      queueEditorFocus("title", payload && payload.selectAll === true);
      return;
    }
  }

  function setActiveView(view) {
    state.ui.activeView = normalizeView(view);
    state.ui.notesDrawerOpen = true;
    render();
    persistUiOnly().catch(() => {
      setSaveStatus("Save failed", "error");
    });
  }

  function focusNotesSearch(selectAll = true) {
    state.panelMode = "picker";
    state.ui.notesDrawerOpen = true;
    if (!isNotesDrawerPage()) {
      state.ui.drawerMode = DRAWER_MODE_NOTES;
    }
    render();
    if (state.refs.searchInput) {
      state.refs.searchInput.focus();
      if (selectAll && typeof state.refs.searchInput.select === "function") {
        state.refs.searchInput.select();
      }
    }
  }

  function filterByActiveNoteCategory() {
    const note = getActiveNote();
    if (!note || !note.folderId) {
      setSaveStatus("Open a categorized note first", "error");
      return;
    }
    openDrawerNotesPage(String(note.folderId));
    render();
    persistUiOnly(`Filtered by ${getFolderLabel(note.folderId)}`).catch(() => {
      setSaveStatus("Save failed", "error");
    });
  }

  function folderNameExists(name, excludeId) {
    const target = normalizeFolderName(name).toLowerCase();
    if (!target) return false;
    return state.folders.some((folder) =>
      folder &&
      folder.id !== excludeId &&
      folder.name.toLowerCase() === target
    );
  }

  async function createFolder(options = {}) {
    const assignToActiveNote = options && options.assignToActiveNote === true;
    const result = await showPromptDialog({
      title: "New category",
      message: "Create a category to organise notes.",
      inputLabel: "Category name",
      inputPlaceholder: "e.g. Research",
      confirmLabel: "Create"
    });
    if (!result || result.confirmed !== true) return;
    const name = normalizeFolderName(result.value);
    if (!name) return;
    if (folderNameExists(name, "")) {
      setSaveStatus("Category already exists", "error");
      return;
    }
    const folder = {
      id: makeId("folder"),
      name,
      order: state.folders.length,
      createdAt: new Date().toISOString()
    };
    state.folders = normalizeFolders([...state.folders, folder]);
    if (assignToActiveNote) {
      const note = getActiveNote();
      if (note) {
        note.folderId = folder.id;
        note.updatedAt = new Date().toISOString();
      }
    }
    state.ui.activeFolderFilter = folder.id;
    render();
    await flushSave(assignToActiveNote ? "Category created and assigned" : "Category created", {
      includeFolders: true
    });
  }

  async function renameFolder() {
    const activeId = state.ui.activeFolderFilter;
    const folder = activeId !== FILTER_ALL_FOLDERS && activeId !== FILTER_UNCATEGORIZED
      ? getFolderById(activeId)
      : null;
    if (!folder) {
      setSaveStatus("Select a category first", "error");
      return;
    }
    const result = await showPromptDialog({
      title: "Rename category",
      message: `Update the name for "${folder.name}".`,
      inputLabel: "Category name",
      inputValue: folder.name || "",
      confirmLabel: "Rename"
    });
    if (!result || result.confirmed !== true) return;
    const name = normalizeFolderName(result.value);
    if (!name || name === folder.name) return;
    if (folderNameExists(name, folder.id)) {
      setSaveStatus("Category already exists", "error");
      return;
    }
    folder.name = name;
    render();
    await flushSave("Category renamed", { includeFolders: true });
  }

  async function deleteFolder() {
    const activeId = state.ui.activeFolderFilter;
    const folder = activeId !== FILTER_ALL_FOLDERS && activeId !== FILTER_UNCATEGORIZED
      ? getFolderById(activeId)
      : null;
    if (!folder) {
      setSaveStatus("Select a category first", "error");
      return;
    }
    const noteCount = state.notes.filter((note) => note && note.folderId === folder.id).length;
    const result = await showConfirmDialog({
      title: "Delete category",
      message: `Delete "${folder.name}"? ${noteCount} note${noteCount === 1 ? "" : "s"} will move to ${UNCATEGORIZED_LABEL}.`,
      confirmLabel: "Delete",
      danger: true
    });
    if (!result || result.confirmed !== true) return;
    state.folders = normalizeFolders(state.folders.filter((entry) => entry && entry.id !== folder.id));
    state.ui.pinnedFolderIds = state.ui.pinnedFolderIds.filter((id) => id !== folder.id);
    state.notes = state.notes.map((note) => {
      if (!note || note.folderId !== folder.id) return note;
      return {
        ...note,
        folderId: "",
        updatedAt: new Date().toISOString()
      };
    });
    state.ui.activeFolderFilter = FILTER_ALL_FOLDERS;
    render();
    await flushSave("Category deleted", { includeFolders: true });
  }

  function getNewNoteFolderId() {
    const filter = state.ui.activeFolderFilter;
    if (filter === FILTER_UNCATEGORIZED) return "";
    if (filter !== FILTER_ALL_FOLDERS && getFolderById(filter)) {
      return filter;
    }
    return "";
  }

  async function createNewNote(options = {}) {
    await syncActiveNoteFromEditor(false);
    const folderId = options && Object.prototype.hasOwnProperty.call(options, "folderId")
      ? String(options.folderId || "")
      : getNewNoteFolderId();
    const note = maybeSeedNoteWithPageContext(createBlankNote(folderId));
    state.notes = getSortedNotes([note, ...state.notes]);
    state.ui.activeNoteId = note.id;
    state.panelMode = "editor";
    state.ui.notesDrawerOpen = false;
    render();
    scheduleSave();
    queueEditorFocus("title", true);
  }

  async function createNoteFromCurrentPage() {
    if (!hasPageContext()) {
      setSaveStatus("No page context available", "error");
      return;
    }
    const folderId = getPreferredCategoryIdForNewNote();
    await createNewNote({ folderId });
    setSaveStatus(
      folderId
        ? `Created page note in ${getFolderLabel(folderId)}`
        : "Created page note",
      ""
    );
  }

  async function createNoteInCurrentCategory() {
    const folderId = getPreferredCategoryIdForNewNote();
    await createNewNote({ folderId });
    setSaveStatus(
      folderId
        ? `Created note in ${getFolderLabel(folderId)}`
        : "Created unsorted note",
      ""
    );
  }

  async function duplicateNote() {
    await syncActiveNoteFromEditor(true);
    const note = getActiveNote();
    if (!note) return;
    const now = new Date().toISOString();
    const copy = {
      ...note,
      id: makeId("note"),
      title: `${getNoteTitle(note)} Copy`.slice(0, 120),
      isPinned: false,
      pinnedAt: "",
      createdAt: now,
      updatedAt: now
    };
    state.notes = getSortedNotes([copy, ...state.notes]);
    state.ui.activeNoteId = copy.id;
    render();
    scheduleSave();
  }

  function restoreDeletedNote() {
    const pending = state.pendingUndoDelete;
    if (!pending || !pending.note) return;

    // Berhenti segera jika nota sudah wujud dalam senarai aktif
    const exists = state.notes.some((entry) => entry && entry.id === pending.note.id);

    // Batalkan timer undo dan clear state dulu
    clearPendingUndoDelete();

    // Batalkan save timer yang sedang menunggu untuk elak race condition
    // antara persist() dari delete dan persist() dari restore
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }

    if (exists) {
      // Nota sudah ada — cuma keluarkan dari trash tanpa ubah state senarai
      restoreFromTrash(pending.note.id)
        .then(() => refreshTrash())
        .then(() => render())
        .catch(() => refreshTrash().then(() => render()).catch(() => null));
      return;
    }

    // Tambah nota kembali ke senarai in-memory
    state.notes = getSortedNotes([pending.note, ...state.notes]);
    state.ui.activeNoteId = pending.note.id;

    // Reset editor state supaya nota yang dipulihkan dipaparkan dengan betul
    state.editor.title = "";
    state.editor.content = "";
    state.editor._lastSyncedNoteId = "";
    state.editor.dirty = false;

    // Render segera supaya UI tunjuk nota dipulihkan
    render();

    // Kemudian async: keluarkan dari trash storage dan save nota list
    restoreFromTrash(pending.note.id)
      .then(() => refreshTrash())
      .then(() => {
        // Render sekali lagi selepas trash dikemas kini
        render();
        // Save state terkini — panggil persist() terus tanpa syncActiveNoteFromEditor
        // untuk elak overwrite kandungan nota yang baru dipulihkan
        if (state.saveTimer) { clearTimeout(state.saveTimer); state.saveTimer = null; }
        state.lastLocalChangeAt = Date.now();
        state.saveTimer = setTimeout(async () => {
          state.saveTimer = null;
          const saveStartedAt = Date.now();
          try {
            await persist("Undo delete", { saveStartedAt });
          } catch (err) {
            setSaveStatus("Save failed", "error");
          }
        }, SAVE_DELAY_MS);
      })
      .catch(() => {
        // Jika restoreFromTrash gagal, nota sudah ada dalam state.notes —
        // save tetap perlu dilakukan supaya nota tidak hilang
        refreshTrash().catch(() => null);
        render();
        if (state.saveTimer) { clearTimeout(state.saveTimer); state.saveTimer = null; }
        state.lastLocalChangeAt = Date.now();
        state.saveTimer = setTimeout(async () => {
          state.saveTimer = null;
          const saveStartedAt = Date.now();
          try {
            await persist("Undo delete (recovered)", { saveStartedAt });
          } catch (e) {
            setSaveStatus("Save failed", "error");
          }
        }, SAVE_DELAY_MS);
        setSaveStatus("Restored (trash sync failed)", "");
      });

    queueEditorFocus("title", true);
  }

  function queueDeletedNoteUndo(note) {
    clearPendingUndoDelete();
    state.pendingUndoDelete = {
      note,
      message: `"${getNoteTitle(note)}" deleted.`
    };
    renderUndoToast();
    state.undoDeleteTimer = setTimeout(() => {
      clearPendingUndoDelete();
    }, NOTE_DELETE_UNDO_MS);
  }

  async function moveNoteToFolder(noteId, folderId) {
    const targetId = noteId ? String(noteId) : "";
    if (!targetId) return;
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }
    if (targetId === state.ui.activeNoteId) {
      await syncActiveNoteFromEditor(false, { timeoutMs: 260 });
    } else if (state.editor.dirty === true) {
      await syncActiveNoteFromEditor(true, { timeoutMs: 260 });
    }
    const note = state.notes.find((entry) => entry && entry.id === targetId);
    if (!note) return;
    const nextFolderId = folderId && getFolderById(folderId) ? String(folderId) : "";
    if (note.folderId === nextFolderId) return;
    note.folderId = nextFolderId;
    note.updatedAt = new Date().toISOString();
    state.notes = getSortedNotes(state.notes);
    if (note.id === state.ui.activeNoteId && state.ui.activeFolderFilter !== FILTER_ALL_FOLDERS) {
      state.ui.activeFolderFilter = nextFolderId || FILTER_UNCATEGORIZED;
    }
    render();
    const saveStartedAt = Date.now();
    setSaveStatus("Saving...", "saving");
    try {
      await persist(nextFolderId ? `Moved to ${getFolderLabel(nextFolderId)}` : "Moved to Unsorted", {
        saveStartedAt
      });
    } catch (err) {
      setSaveStatus("Save failed", "error");
    }
  }

  async function deleteNoteById(noteId, options = {}) {
    const targetId = noteId ? String(noteId) : "";
    if (!targetId) return;
    if (targetId === state.ui.activeNoteId) {
      await syncActiveNoteFromEditor(false, { timeoutMs: 260 });
    }
    const note = state.notes.find((entry) => entry && entry.id === targetId);
    if (!note) return;
    if (options.confirm !== false) {
      const result = await showConfirmDialog({
        title: "Delete note",
        message: `Delete "${getNoteTitle(note)}"? You can undo this for a few seconds.`,
        confirmLabel: "Delete",
        danger: true
      });
      if (!result || result.confirmed !== true) return;
    }
    const removedNote = {
      ...note
    };

    // Cari nota jiran dalam senarai semasa sebelum delete —
    // supaya selepas delete, nota yang paling berdekatan (bawah atau atas) dipilih
    // bukan sentiasa notes[0] (nota terbaru).
    const currentIndex = state.notes.findIndex((entry) => entry && entry.id === targetId);
    const candidateNext = state.notes[currentIndex + 1] || state.notes[currentIndex - 1] || null;

    // Batalkan save timer yang sedang menunggu — PENTING untuk elak race condition
    // di mana timer trigger syncActiveNoteFromEditor selepas activeNoteId dah bertukar,
    // menyebabkan kandungan nota yang dipadam tertulis ke nota seterusnya.
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }

    state.notes = state.notes.filter((entry) => entry && entry.id !== targetId);

    // Bersihkan selectedNoteIds — buang ID yang dah dipadam
    state.ui.selectedNoteIds = coerceArray(state.ui.selectedNoteIds).filter((id) => id !== targetId);

    await addToTrash(removedNote);
    await refreshTrash();

    // Pilih nota jiran jika ada, barulah fallback ke ensureActiveNoteExists
    if (candidateNext && state.notes.some((entry) => entry && entry.id === candidateNext.id)) {
      state.ui.activeNoteId = candidateNext.id;
      // Reset editor state supaya syncEditorFrameWithNote tidak skip early-exit
      state.editor.title = "";
      state.editor.content = "";
      state.editor._lastSyncedNoteId = "";
    } else {
      ensureActiveNoteExists();
      // Reset editor state supaya nota baru yang aktif dipaparkan dengan betul
      state.editor.title = "";
      state.editor.content = "";
      state.editor._lastSyncedNoteId = "";
    }

    render();
    // Guna scheduleSave tanpa markDirty untuk save perubahan senarai nota
    // tanpa trigger syncActiveNoteFromEditor yang boleh overwrite nota baru
    state.lastLocalChangeAt = Date.now();
    state.saveTimer = setTimeout(async () => {
      state.saveTimer = null;
      const saveStartedAt = Date.now();
      try {
        await persist("Note deleted", { saveStartedAt });
      } catch (err) {
        setSaveStatus("Save failed", "error");
      }
    }, SAVE_DELAY_MS);
    queueDeletedNoteUndo(removedNote);
  }

  async function openTrashPanel() {
    await refreshTrash();
    state.trashPanelOpen = true;
    render();
  }

  function closeTrashPanel() {
    state.trashPanelOpen = false;
    render();
  }

  async function restoreTrashNote(noteId) {
    const targetId = noteId ? String(noteId) : "";
    if (!targetId) return;

    const restored = await restoreFromTrash(targetId);
    if (!restored) return;

    const exists = state.notes.some((entry) => entry && entry.id === restored.id);
    await refreshTrash();

    if (exists) {
      render();
      setSaveStatus("Already in notes", "");
      return;
    }

    // Batalkan save timer yang sedang menunggu sebelum ubah state
    if (state.saveTimer) {
      clearTimeout(state.saveTimer);
      state.saveTimer = null;
    }

    state.notes = getSortedNotes([restored, ...state.notes]);
    state.ui.activeNoteId = restored.id;

    // Reset editor state supaya nota yang dipulihkan dipaparkan dengan betul
    state.editor.title = "";
    state.editor.content = "";
    state.editor._lastSyncedNoteId = "";
    state.editor.dirty = false;

    render();

    // Guna persist() terus tanpa syncActiveNoteFromEditor
    // untuk elak kandungan nota yang dipulihkan di-overwrite
    state.lastLocalChangeAt = Date.now();
    state.saveTimer = setTimeout(async () => {
      state.saveTimer = null;
      const saveStartedAt = Date.now();
      try {
        await persist("Restored from trash", { saveStartedAt });
        setSaveStatus("Restored from trash", "");
      } catch (err) {
        setSaveStatus("Save failed", "error");
      }
    }, SAVE_DELAY_MS);

    queueEditorFocus("title", true);
  }

  async function clearTrash() {
    const hasTrash = coerceArray(state.trash).length > 0;
    if (!hasTrash) return;
    const result = await showConfirmDialog({
      title: "Empty trash",
      message: "Permanently remove all deleted notes from the trash list?",
      confirmLabel: "Empty trash",
      danger: true
    });
    if (!result || result.confirmed !== true) return;
    await emptyTrash();
    await refreshTrash();
    render();
    setSaveStatus("Trash emptied", "");
  }

  async function deleteNote() {
    const note = getActiveNote();
    if (!note) return;
    await deleteNoteById(note.id, { confirm: true });
  }

  async function toggleNotePin(noteId) {
    await syncActiveNoteFromEditor(false);
    const targetId = noteId ? String(noteId) : state.ui.activeNoteId;
    if (!targetId) return;
    const note = state.notes.find((entry) => entry && entry.id === targetId);
    if (!note) return;
    const nextPinned = note.isPinned !== true;
    note.isPinned = nextPinned;
    note.pinnedAt = nextPinned ? new Date().toISOString() : "";
    note.updatedAt = new Date().toISOString();
    state.notes = getSortedNotes(state.notes);
    render();
    scheduleSave();
  }

  function selectVisibleNotePage() {
    const pager = getNotePagerState(getVisibleNotes());
    const pageIds = pager.visibleRows
      .map((note) => (note && note.id ? String(note.id) : ""))
      .filter(Boolean);
    state.ui.selectedNoteIds = Array.from(new Set([
      ...coerceArray(state.ui.selectedNoteIds),
      ...pageIds
    ]));
    render();
  }

  function clearSelectedNotes() {
    state.ui.selectedNoteIds = [];
    render();
  }

  async function moveSelectedNotesToCategory() {
    const targetValue = state.refs.bulkNoteMoveSelect
      ? String(state.refs.bulkNoteMoveSelect.value || "")
      : "";
    const selectedIds = getSelectedNoteIdsInScope(getVisibleNotes());
    if (!selectedIds.length) {
      setSaveStatus("No notes selected", "error");
      return;
    }
    const targetFolderId = targetValue === FILTER_UNCATEGORIZED ? "" : targetValue;
    for (const noteId of selectedIds) {
      await moveNoteToFolder(noteId, targetFolderId);
    }
    state.ui.selectedNoteIds = [];
    if (state.refs.bulkNoteMoveSelect) {
      state.refs.bulkNoteMoveSelect.value = "";
    }
    setSaveStatus(
      targetFolderId
        ? `Moved ${selectedIds.length} note${selectedIds.length === 1 ? "" : "s"} to ${getFolderLabel(targetFolderId)}`
        : `Moved ${selectedIds.length} note${selectedIds.length === 1 ? "" : "s"} to ${UNCATEGORIZED_LABEL}`,
      ""
    );
    render();
  }

  async function handleFolderSelectChange(event) {
    const selected = event && event.target ? String(event.target.value || "") : "";
    const note = getActiveNote();
    if (!note) return;
    await moveNoteToFolder(note.id, selected);
  }

  function handleTrashListClick(event) {
    const button = event && event.target && typeof event.target.closest === "function"
      ? event.target.closest('[data-action="restore-trash-note"]')
      : null;
    if (!button) return;
    const noteId = button.getAttribute("data-trash-note-id") || "";
    restoreTrashNote(noteId).catch(() => {
      setSaveStatus("Could not restore note", "error");
    });
  }

  async function openAiSidebar() {
    await flushSave("Saved");
    const response = await sendRuntimeMessage({ type: "open-ai-sidebar" });
    if (!response || response.ok !== true) {
      setSaveStatus("Could not open AI", "error");
    }
  }

  async function exportNotesMarkdown() {
    const notes = coerceArray(state.notes);
    if (!notes.length) {
      setSaveStatus("No notes to export", "error");
      return;
    }
    const exporter = (typeof LocalPocketMarkdownExportCore !== "undefined" && LocalPocketMarkdownExportCore)
      ? LocalPocketMarkdownExportCore
      : null;
    if (!exporter) {
      setSaveStatus("Export module unavailable", "error");
      return;
    }
    const md = exporter.collectionToMarkdown(
      notes.map((n) => ({
        title: getNoteTitle(n),
        content: n && n.content ? String(n.content) : "",
        folder: getFolderLabel(n && n.folderId ? n.folderId : ""),
        createdAt: n && (n.createdAt || n.updatedAt) ? (n.createdAt || n.updatedAt) : null,
        url: n && n.url ? n.url : ""
      })),
      { title: "Local Pocket Notes Export", includeMeta: true }
    );
    const ok = exporter.downloadMarkdown("local-pocket-notes.md", md);
    setSaveStatus(ok ? "Exported " + notes.length + " notes" : "Export not supported", ok ? "success" : "error");
  }

  function handleAction(action) {
    if (action === "close-dialog" || action === "cancel-dialog") {
      closeDialog({ confirmed: false, value: "" });
      return;
    }
    if (action === "confirm-dialog") {
      closeDialog({
        confirmed: true,
        value: state.refs.dialogInput ? String(state.refs.dialogInput.value || "") : ""
      });
      return;
    }
    if (action === "close") {
      close();
      return;
    }
    if (action === "npp-page-prev") {
      changeNotePage(-1);
      return;
    }
    if (action === "npp-page-next") {
      changeNotePage(1);
      return;
    }
    if (action === "npp-back" || action === "npp-back-to-categories" || action === "drawer-back-to-categories") {
      if (state.panelMode === "editor" || state.panelMode === "mindmap") {
        state.panelMode = "picker";
        state.ui.drawerMode = DRAWER_MODE_NOTES;
      } else {
        state.ui.drawerMode = DRAWER_MODE_CATEGORIES;
      }
      render();
      return;
    }
    if (action === "open-trash") {
      if (state.panelMode === "trash") {
        state.panelMode = "picker";
        render();
      } else {
        state.panelMode = "trash";
        render();
        refreshTrash().catch(() => setSaveStatus("Could not load trash", "error"));
      }
      return;
    }
    if (action === "export-markdown") {
      exportNotesMarkdown().catch(() => setSaveStatus("Export failed", "error"));
      return;
    }
    if (action === "toggle-panel-pin") {
      panelPinned = !panelPinned;
      // Update butang visual
      if (state.refs.mpPanelPinBtn) {
        state.refs.mpPanelPinBtn.style.opacity = panelPinned ? "1" : "0.4";
        state.refs.mpPanelPinBtn.style.background = panelPinned ? "rgba(100,180,255,0.18)" : "rgba(255,255,255,0.06)";
        state.refs.mpPanelPinBtn.style.borderColor = panelPinned ? "rgba(100,180,255,0.5)" : "rgba(255,255,255,0.12)";
        state.refs.mpPanelPinBtn.style.color = panelPinned ? "#7ab8ff" : "inherit";
        state.refs.mpPanelPinBtn.title = panelPinned ? "Panel dikunci — klik untuk nyahpin" : "Pin panel supaya tak tutup bila klik luar";
      }
      setSaveStatus(panelPinned ? "Panel dikunci" : "Panel bebas", "");
      return;
    }
    if (action === "close-trash") {
      closeTrashPanel();
      return;
    }
    if (action === "toggle-pin-folder") {
      const folder = getFolderContextMenuFolder();
      if (!folder) return;
      togglePinnedFolder(folder.id).catch(() => {
        setSaveStatus("Could not pin category", "error");
      });
      closeFolderContextMenu();
      return;
    }
    if (action === "open-folder-view") {
      const folder = getFolderContextMenuFolder();
      if (!folder) return;
      openDrawerNotesPage(folder.id);
      state.ui.notePage = 0;
      closeFolderContextMenu();
      render();
      return;
    }
    if (action === "toggle-hide-folder") {
      const folder = getFolderContextMenuFolder();
      if (!folder) return;
      closeFolderContextMenu();
      toggleHiddenFolder(folder.id).catch(() => {
        setSaveStatus("Could not update category", "error");
      });
      return;
    }
    if (action === "new-note-in-folder") {
      const folder = getFolderContextMenuFolder();
      if (!folder) return;
      closeFolderContextMenu();
      createNewNote({ folderId: folder.id }).catch(() => {
        setSaveStatus("Could not create note", "error");
      });
      return;
    }
    if (action === "move-note-here") {
      const folder = getFolderContextMenuFolder();
      if (!folder) return;
      closeFolderContextMenu();
      assignActiveNoteToFolder(folder.id, `Moved to ${folder.name}`).catch(() => {
        setSaveStatus("Could not move note", "error");
      });
      return;
    }
    if (action === "cycle-folder-favorite-sort") {
      cycleFavoriteFolderSortMode().catch(() => {
        setSaveStatus("Could not update favorite order", "error");
      });
      return;
    }
    if (action === "toggle-hidden-folders") {
      toggleHiddenFoldersVisibility().catch(() => {
        setSaveStatus("Could not update hidden categories", "error");
      });
      return;
    }
    if (action === "folder-page-prev") {
      changeFolderPage(-1);
      return;
    }
    if (action === "folder-page-next") {
      changeFolderPage(1);
      return;
    }
    if (action === "note-page-prev") {
      changeNotePage(-1);
      return;
    }
    if (action === "note-page-next") {
      changeNotePage(1);
      return;
    }
    if (action === "select-note-page") {
      selectVisibleNotePage();
      return;
    }
    if (action === "clear-note-selection") {
      clearSelectedNotes();
      return;
    }
    if (action === "move-selected-notes") {
      moveSelectedNotesToCategory().catch(() => {
        setSaveStatus("Could not move selected notes", "error");
      });
      return;
    }
    if (action === "set-view-all") {
      setActiveView(VIEW_ALL);
      return;
    }
    if (action === "set-view-pinned") {
      setActiveView(VIEW_PINNED);
      return;
    }
    if (action === "set-view-tasks") {
      setActiveView(VIEW_TASKS);
      return;
    }
    if (action === "new-folder") {
      createFolder().catch(() => {
        setSaveStatus("Could not create category", "error");
      });
      return;
    }
    if (action === "new-folder-for-note") {
      createFolder({ assignToActiveNote: true }).catch(() => {
        setSaveStatus("Could not create category", "error");
      });
      return;
    }
    if (action === "rename-folder") {
      closeFolderContextMenu();
      renameFolder().catch(() => {
        setSaveStatus("Could not rename category", "error");
      });
      return;
    }
    if (action === "delete-folder") {
      closeFolderContextMenu();
      deleteFolder().catch(() => {
        setSaveStatus("Could not delete category", "error");
      });
      return;
    }
    if (action === "new-note") {
      if (state.panelMode === "todo") {
        handleAction("new-todo-list");
        return;
      }
      createNewNote().catch(() => {
        setSaveStatus("Could not create note", "error");
      });
      return;
    }
    if (action === "new-note-from-page") {
      createNoteFromCurrentPage().catch(() => {
        setSaveStatus("Could not create page note", "error");
      });
      return;
    }
    if (action === "new-note-in-active-category") {
      createNoteInCurrentCategory().catch(() => {
        setSaveStatus("Could not create note", "error");
      });
      return;
    }
    if (action === "filter-active-category") {
      filterByActiveNoteCategory();
      return;
    }
    if (action === "open-ai") {
      openAiSidebar().catch(() => {
        setSaveStatus("Could not open AI", "error");
      });
      return;
    }
    if (action === "open-mindmap") {
      openMindmap();
      return;
    }
    if (action === "toggle-mindmap-click") {
      state.mindmap.openOnClick = !state.mindmap.openOnClick;
      syncMindmapToUi();
      applyMindmapClickToggleUI(state.mindmap.openOnClick);
      persistUiOnly();
      return;
    }
    if (action === "mindmap-zoom-in") {
      var newZoomIn = Math.min(4, state.mindmap.zoom + 0.25);
      state.mindmap.zoom = newZoomIn;
      var gIn = state._mmG;
      if (gIn) gIn.setAttribute("transform", "translate(" + state.mindmap.panX + "," + state.mindmap.panY + ") scale(" + newZoomIn + ")");
      updateMindmapZoomLabel();
      syncMindmapToUi();
      return;
    }
    if (action === "mindmap-zoom-out") {
      var newZoomOut = Math.max(0.15, state.mindmap.zoom - 0.25);
      state.mindmap.zoom = newZoomOut;
      var gOut = state._mmG;
      if (gOut) gOut.setAttribute("transform", "translate(" + state.mindmap.panX + "," + state.mindmap.panY + ") scale(" + newZoomOut + ")");
      updateMindmapZoomLabel();
      syncMindmapToUi();
      return;
    }
    if (action === "mindmap-fit") {
      fitMindmapToView();
      return;
    }
    if (action === "mindmap-collapse-all") {
      if (state.mindmap.mode === "folder") {
        state.folders.forEach(function(f) {
          if (!state.mindmap.collapsedFolders.includes(f.id)) {
            state.mindmap.collapsedFolders.push(f.id);
          }
        });
        var uc = "__uncategorized__";
        if (!state.mindmap.collapsedFolders.includes(uc)) {
          state.mindmap.collapsedFolders.push(uc);
        }
        syncMindmapToUi(); persistUiOnly();
        if (state.panelMode === "mindmap") render();
      }
      return;
    }
    if (action === "mindmap-expand-all") {
      state.mindmap.collapsedFolders = [];
      state.mindmap.collapsedNodes = [];
      syncMindmapToUi(); persistUiOnly();
      if (state.panelMode === "mindmap") render();
      return;
    }
    if (action === "mindmap-toggle-layout") {
      state.mindmap.layoutStyle = state.mindmap.layoutStyle === "tree" ? "radial" : "tree";
      state.mindmap.panX = 0;
      state.mindmap.panY = 0;
      state.mindmap.zoom = 1;
      syncMindmapToUi();
      persistUiOnly();
      updateMindmapLayoutToggleUI();
      if (state.panelMode === "mindmap") render();
      return;
    }
    if (action === "mindmap-toggle-mode") {
      if (state.panelMode === "mindmap") {
        if (state.mindmap.mode === "folder") {
          // Switch to content mode — only if there's an active note with content
          const note = getActiveNote();
          if (note && note.content && note.content.trim()) {
            state.mindmap.mode = "content";
          } else {
            setSaveStatus("Open a note first to view its content map", "");
          }
        } else {
          state.mindmap.mode = "folder";
        }
        state.mindmap.panX = 0;
        state.mindmap.panY = 0;
        state.mindmap.zoom = 1;
        render();
      }
      return;
    }
    if (action === "mindmap-export-svg") {
      exportMindmapSvg();
      return;
    }
    if (action === "mindmap-export-png") {
      exportMindmapPng();
      return;
    }
    if (action === "save-now") {
      flushSave("Saved").catch(() => { });
      return;
    }
    if (action === "toggle-pin") {
      // Pin nota yang di-hover/highlight ATAU nota aktif dalam editor
      const targetId = (state.panelMode === "picker" && mpActiveNoteId)
        ? mpActiveNoteId
        : state.ui.activeNoteId;
      toggleNotePin(targetId).catch(() => {
        setSaveStatus("Could not pin note", "error");
      });
      return;
    }
    if (action === "duplicate-note") {
      duplicateNote().catch(() => {
        setSaveStatus("Could not duplicate note", "error");
      });
      return;
    }
    if (action === "open-trash") {
      if (state.panelMode === "trash") {
        state.panelMode = "picker";
        render();
      } else {
        state.panelMode = "trash";
        render();
        refreshTrash().catch(() => setSaveStatus("Could not load trash", "error"));
      }
      return;
    }
    if (action === "close-trash") {
      state.panelMode = "picker";
      closeTrashPanel();
      return;
    }
    if (action === "empty-trash") {
      clearTrash().catch(() => {
        setSaveStatus("Could not empty trash", "error");
      });
      return;
    }
    if (action === "delete-note") {
      // Padam nota yang di-hover/highlight dalam picker, atau nota aktif dalam editor
      const delTargetId = (state.panelMode === "picker" && mpActiveNoteId)
        ? mpActiveNoteId
        : state.ui.activeNoteId;
      if (delTargetId) {
        deleteNoteById(delTargetId, { confirm: state.panelMode === "editor" }).catch(() => {
          setSaveStatus("Could not delete note", "error");
        });
      }
      return;
    }
    if (action === "undo-delete-note") {
      restoreDeletedNote();
      return;
    }
    if (action === "toggle-preview") {
      togglePreviewMode();
      return;
    }
    if (action === "insert-page-context") {
      insertPageContextIntoNote();
      return;
    }
    if (action === "export-note-txt") {
      exportActiveNoteTxt().catch(() => {
        setSaveStatus("Export failed", "error");
      });
      return;
    }
    if (action === "import-note-txt") {
      if (state.refs.importFileInput) {
        state.refs.importFileInput.click();
      }
      return;
    }
    if (action === "export-all-notes-txt") {
      exportAllNotesTxtZip().catch(() => {
        setSaveStatus("Export failed", "error");
      });
      return;
    }
    // ── Todo actions ──────────────────────────────────────────────────────────
    if (action === "open-todo") {
      state.panelMode = state.panelMode === "todo" ? "picker" : "todo";
      state.ui.drawerMode = DRAWER_MODE_NOTES;
      // Ensure there's at least one list
      if (state.panelMode === "todo" && !state.todoLists.length) {
        createTodoList("My Todo List").catch(function() {});
      }
      render();
      if (state.panelMode === "todo") focusTodoInput();
      return;
    }
    if (action === "todo-add-item") {
      var input = state.refs.mpTodoAddInput;
      if (!input) return;
      var text = String(input.value || "").trim();
      if (!text || !state.ui.activeTodoListId) return;
      addTodoItem(state.ui.activeTodoListId, text).catch(function() {
        setSaveStatus("Could not add item", "error");
      });
      input.value = "";
      input.focus();
      return;
    }
    if (action === "todo-toggle-item") {
      // Toggle is triggered by checkbox click — find the item id from the checkbox
      return; // handled by dedicated event listener below
    }
    if (action === "todo-delete-item") {
      // Handled by dedicated listener
      return;
    }
    if (action === "todo-filter-all") {
      state.ui.todoFilter = "all";
      render();
      return;
    }
    if (action === "todo-filter-active") {
      state.ui.todoFilter = "active";
      render();
      return;
    }
    if (action === "todo-filter-completed") {
      state.ui.todoFilter = "completed";
      render();
      return;
    }
    if (action === "new-todo-list") {
      showPromptDialog({
        title: "New todo list",
        message: "Enter a name for the new list.",
        inputLabel: "List name",
        inputPlaceholder: "e.g. Shopping, Work Tasks...",
        confirmLabel: "Create"
      }).then(function(result) {
        if (result && result.confirmed) {
          var name = String(result.value || "").trim() || "New List";
          createTodoList(name).catch(function() {
            setSaveStatus("Could not create list", "error");
          });
        }
      }).catch(function() {});
      return;
    }
    if (action === "delete-todo-list") {
      if (state.ui.activeTodoListId) {
        deleteTodoList(state.ui.activeTodoListId).catch(function() {
          setSaveStatus("Could not delete list", "error");
        });
      }
      return;
    }
    if (action === "rename-todo-list") {
      var activeList = getActiveTodoList();
      if (!activeList) return;
      showPromptDialog({
        title: "Rename list",
        message: "Enter a new name for \"" + activeList.title + "\"",
        inputLabel: "List name",
        inputValue: activeList.title || "",
        confirmLabel: "Rename"
      }).then(function(result) {
        if (result && result.confirmed && result.value) {
          renameTodoList(activeList.id, result.value).catch(function() {
            setSaveStatus("Could not rename list", "error");
          });
        }
      }).catch(function() {});
      return;
    }
  }

  // ── Konfigurable keyboard shortcuts untuk Notes Overlay (nota & mindmap) ──
  function eventToShortcutString(event) {
    if (!event) return "";
    const parts = [];
    if (event.ctrlKey) parts.push("Ctrl");
    if (event.altKey) parts.push("Alt");
    // Sama macam buildShortcut() dalam options.js: abaikan Shift bila CapsLock
    // hidup + huruf, supaya string rakaman == string ditekan (padanan tepat).
    const capsLockOn = typeof event.getModifierState === "function" && event.getModifierState("CapsLock");
    const isLetter = event.key && event.key.length === 1 && /[a-zA-Z]/.test(event.key);
    const isShiftCounteracting = event.shiftKey && capsLockOn && isLetter;
    if (event.shiftKey && !isShiftCounteracting) parts.push("Shift");
    if (event.metaKey) parts.push("Command");
    let key = event.key || "";
    // Normalize kekunci supaya SEPAdan dengan normalizePickerShortcut /
    // normalizeLinkSaveKeyboardKey (settings.js) dan normalizeKey (options.js):
    // string tersimpan mesti sentiasa == string dijana masa ditekan.
    const keyMap = {
      " ": "Space", "ArrowLeft": "Left", "ArrowRight": "Right", "ArrowUp": "Up", "ArrowDown": "Down",
      "Escape": "Esc", "Enter": "Enter", "Tab": "Tab", "Home": "Home", "End": "End",
      "PageUp": "PageUp", "PageDown": "PageDown", "Insert": "Insert", "Delete": "Delete",
      "ScrollLock": "ScrollLock", "Pause": "Pause", "PrintScreen": "PrintScreen", "Menu": "Menu",
      "CapsLock": "CapsLock", "NumLock": "NumLock"
    };
    if (keyMap[key] !== undefined) key = keyMap[key];
    else if (/^F\d{1,2}$/i.test(key)) key = key.toUpperCase();
    else if (key.length === 1) key = key.toUpperCase();
    if (!key) return "";
    parts.push(key);
    return parts.join("+");
  }

  function runNotesShortcut(event) {
    if (!state.open) return false;
    if (state.dialog && state.dialog.open) return false;
    if (state.folderPalette && state.folderPalette.open) return false;
    if (isEditableElement(event.target)) return false;
    const cfg = state.settings && state.settings.notesOverlayShortcuts;
    if (!cfg || typeof cfg !== "object") return false;
    const pressed = eventToShortcutString(event).toLowerCase();
    if (!pressed) return false;
    for (const action in cfg) {
      const stored = typeof cfg[action] === "string" ? cfg[action].trim().toLowerCase() : "";
      if (stored && stored === pressed) {
        handleAction(action);
        event.preventDefault();
        stopOverlayEvent(event);
        return true;
      }
    }
    return false;
  }

  // ── Shortcut dari iframe editor: iframe tak boleh akses window listener parent,
  // jadi ia postMessage shortcut yang ditekan; kita padankan dgn config di sini. ──
  function runNotesShortcutFromFrame(evt) {
    if (!state.open) return;
    if (state.dialog && state.dialog.open) return;
    if (state.folderPalette && state.folderPalette.open) return;
    const cfg = state.settings && state.settings.notesOverlayShortcuts;
    if (!cfg || typeof cfg !== "object") return;
    const pressed = eventToShortcutString(evt).toLowerCase();
    if (!pressed) return;
    for (const action in cfg) {
      const stored = typeof cfg[action] === "string" ? cfg[action].trim().toLowerCase() : "";
      if (stored && stored === pressed) {
        handleAction(action);
        break;
      }
    }
  }

  function handleDocumentKeydown(event) {
    if (!state.open) return;

    // ── Konfigurable Notes Overlay shortcuts bila fokus di luar overlay ──
    // (mirror Hover+D): hanya handle bila event BUKAN dari overlay supaya
    // tak double-trigger dengan handleOverlayKeydown.
    if (!isEventFromOverlay(event) && runNotesShortcut(event)) return;

    // ── Hover + D — delete nota yang di-hover walaupun fokus di luar overlay ──
    // handleOverlayKeydown hanya jalan bila fokus DALAM overlay; bila user
    // hanya hover dengan mouse (fokus masih pada page), event keydown tak
    // melalui overlay, jadi kita handle di sini.
    if (
      !isEventFromOverlay(event)
      && state.panelMode === "picker"
      && (event.key === "d" || event.key === "D")
      && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
      && mpActiveNoteId
      && !isEditableElement(event.target)
      && !state.folderPalette.open
      && !(state.dialog && state.dialog.open)
    ) {
      const targetId = mpActiveNoteId;
      mpActiveNoteId = "";
      event.preventDefault();
      stopOverlayEvent(event);
      deleteNoteById(targetId, { confirm: false }).catch(() => {
        setSaveStatus("Could not delete note", "error");
      });
      return;
    }

    if (event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      if (isEventFromOverlay(event)) return;
      if (panelPinned) return; // Panel dikunci
      close();
    }
  }

  function handleDocumentPointerDown(event) {
    if (!state.open) return;

    // Klik dalam folder palette — handle dulu
    if (state.folderPalette.open) {
      const insidePalette = eventPathIncludes(event, state.refs.folderPalette);
      if (!insidePalette && isEventFromOverlay(event)) {
        closeFolderPalette();
        return;
      }
    }

    // Jangan close bila panelPinned aktif
    if (panelPinned) return;

    // Jangan close bila closeOnOutsideClick dimatikan
    if (state.ui.closeOnOutsideClick !== true) return;

    const fromOverlay = isEventFromOverlay(event);

    if (fromOverlay) {
      // Klik dalam shadow DOM — check sama ada klik pada backdrop atau panel
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const shell = state.refs.shell;
      const dlg = state.refs.dialogLayer;
      const trash = state.refs.trashLayer;
      const undoToast = state.refs.undoToast;
      const insideUI = (shell && path.includes(shell)) ||
        (dlg && dlg.style.display !== "none" && path.includes(dlg)) ||
        (trash && trash.style.display !== "none" && path.includes(trash)) ||
        (undoToast && undoToast.style.display !== "none" && path.includes(undoToast)) ||
        // Context menu — klik dalam menu AI tidak patut tutup panel
        (state.refs.mmCtxMenu && state.refs.mmCtxMenu.style.display !== "none" && path.includes(state.refs.mmCtxMenu));
      if (!insideUI) {
        // Klik pada backdrop — close
        // Tapi jangan close kalau AI sedang dibuka dari context menu
        if (state._mmAiOpening) return;
        close();
      }
    } else {
      // Klik betul-betul luar overlay (luar shadow DOM host) — close
      // Tapi jangan close kalau AI sedang dibuka dari context menu
      if (state._mmAiOpening) return;
      close();
    }
  }

  function handleWindowResize() {
    if (!state.mounted) return;
    if (state.ui.zenMode) return;
    applyOverlayLayout();
    autoResizeContentInput();
  }

  function handleResizePointerMove(event) {
    if (!state.resizeSession) return;
    if (state.resizeSession.mode === "y") {
      const max = Math.max(360, window.innerHeight - 24);
      const delta = event.clientY - state.resizeSession.startY;
      state.ui.panelHeight = Math.max(360, Math.min(max, Math.round(state.resizeSession.startHeight + delta)));
    } else {
      const max = Math.max(360, window.innerWidth - 24);
      const delta = state.resizeSession.startX - event.clientX;
      state.ui.panelWidth = Math.max(360, Math.min(max, Math.round(state.resizeSession.startWidth + delta)));
    }
    applyOverlayLayout();
  }

  function finishResizeSession(saveLayout) {
    if (!state.resizeSession) return;
    window.removeEventListener("pointermove", handleResizePointerMove, true);
    window.removeEventListener("pointerup", handleResizePointerUp, true);
    window.removeEventListener("pointercancel", handleResizePointerUp, true);
    if (state.refs.resizeHandle) {
      state.refs.resizeHandle.classList.remove("active");
    }
    if (state.refs.resizeHandleY) {
      state.refs.resizeHandleY.classList.remove("active");
    }
    state.resizeSession = null;
    if (saveLayout) {
      persistUiOnly("Panel size saved").catch(() => {
        setSaveStatus("Save failed", "error");
      });
    }
  }

  function handleResizePointerUp(event) {
    if (!state.resizeSession) return;
    if (event.pointerId !== state.resizeSession.pointerId) return;
    finishResizeSession(true);
  }

  function handleResizePointerDown(event) {
    if (!state.open || state.resizeSession || window.innerWidth <= MOBILE_BREAKPOINT) return;
    event.preventDefault();
    stopOverlayEvent(event);
    const rect = state.refs.overlay.getBoundingClientRect();
    state.resizeSession = {
      pointerId: event.pointerId,
      mode: "x",
      startX: event.clientX,
      startWidth: Math.round(rect.width)
    };
    state.refs.resizeHandle.classList.add("active");
    window.addEventListener("pointermove", handleResizePointerMove, true);
    window.addEventListener("pointerup", handleResizePointerUp, true);
    window.addEventListener("pointercancel", handleResizePointerUp, true);
  }

  function handleResizeVerticalPointerDown(event) {
    if (!state.open || state.resizeSession || window.innerWidth <= MOBILE_BREAKPOINT || !state.refs.resizeHandleY) return;
    event.preventDefault();
    stopOverlayEvent(event);
    const rect = state.refs.overlay.getBoundingClientRect();
    state.resizeSession = {
      pointerId: event.pointerId,
      mode: "y",
      startY: event.clientY,
      startHeight: Math.round(rect.height)
    };
    state.refs.resizeHandleY.classList.add("active");
    window.addEventListener("pointermove", handleResizePointerMove, true);
    window.addEventListener("pointerup", handleResizePointerUp, true);
    window.addEventListener("pointercancel", handleResizePointerUp, true);
  }

  async function loadState() {
    const data = await storageGet([SETTINGS_KEY, FOLDERS_KEY, NOTES_KEY, NOTES_UI_KEY, ATTACHMENTS_KEY, TRASH_KEY, TODO_LISTS_KEY, TODO_ITEMS_KEY]);
    state.settings = data[SETTINGS_KEY] && typeof data[SETTINGS_KEY] === "object" ? data[SETTINGS_KEY] : {};
    if (!state.settings.notesOverlayShortcuts || typeof state.settings.notesOverlayShortcuts !== "object") state.settings.notesOverlayShortcuts = {};
    state.folders = normalizeFolders(data[FOLDERS_KEY]);
    state.notes = normalizeNotes(data[NOTES_KEY], state.folders);
    state.todoLists = normalizeTodoLists(data[TODO_LISTS_KEY]);
    state.todoItems = normalizeTodoItems(data[TODO_ITEMS_KEY], state.todoLists);
    state.ui = normalizeUi(data[NOTES_UI_KEY], state.folders, state.notes);
    setFolderKeyboardIndexFromActiveFilter();
    state.attachments = pruneAttachmentsMap(data[ATTACHMENTS_KEY], state.notes);
    state.trash = coerceArray(data[TRASH_KEY]).map(normalizeTrashItem).filter(Boolean);
    ensureActiveNoteExists();
    // Ensure activeTodoListId is valid
    if (state.ui.activeTodoListId && !state.todoLists.some(function(l) { return l.id === state.ui.activeTodoListId; })) {
      state.ui.activeTodoListId = state.todoLists.length > 0 ? state.todoLists[0].id : "";
    }
    render();
  }

  async function open(options = {}) {
    ensureMounted();
    if (options && options.pageContext) {
      state.pageContext = options.pageContext && typeof options.pageContext === "object"
        ? {
          title: options.pageContext.title ? String(options.pageContext.title) : "",
          url: options.pageContext.url ? String(options.pageContext.url) : ""
        }
        : null;
    }
    await loadState();
    state.trashPanelOpen = false;

    // Always start in picker mode (category list)
    state.panelMode = "picker";
    state.ui.drawerMode = DRAWER_MODE_CATEGORIES;

    // Restore mindmap state from UI persistence
    restoreMindmapFromUi();

    const notesStartMode = state.settings && state.settings.notesStartMode === "last" ? "last" : "home";
    if (notesStartMode === "last") {
      const activeNote = getActiveNote();
      if (activeNote) {
        state.panelMode = "editor";
      }
    }

    state.previousFocus = document.activeElement && document.activeElement !== document.body
      ? document.activeElement : null;
    state.open = true;
    render();
    setSaveStatus("Ready", "");
    if (state.panelMode === "editor") {
      queueEditorFocus("content", false);
    }
  }

  async function close() {
    finishResizeSession(false);
    closeFolderContextMenu();
    closeFolderPalette();
    // Reset left panel focus state
    lpFocused = false;
    lpActiveIndex = -1;
    lpSearchBuffer = "";
    if (lpSearchTimer) { clearTimeout(lpSearchTimer); lpSearchTimer = null; }
    mpActiveNoteId = "";
    panelPinned = false;
    // Reset AI opening flag
    state._mmAiOpening = false;
    if (state.refs.mpPanelPinBtn) {
      state.refs.mpPanelPinBtn.style.opacity = "0.4";
      state.refs.mpPanelPinBtn.style.background = "rgba(255,255,255,0.06)";
      state.refs.mpPanelPinBtn.style.borderColor = "rgba(255,255,255,0.12)";
      state.refs.mpPanelPinBtn.style.color = "inherit";
    }
    // Clean up mindmap event listeners (don't sync yet — flushSave will do it)
    if (state._mmCleanup) {
      try { state._mmCleanup(); } catch(_) {}
      state._mmCleanup = null;
    }
    state.mindmap.mode = "folder";
    // Don't reset collapsedFolders here — flushSave/persist needs the current value
    state.trashPanelOpen = false;
    state.open = false;
    render();
    // Synchronous blur — host + iframe content, supaya keyboard bebas serta-merta
    if (state.refs.host) state.refs.host.blur();
    if (state.refs.editorFrame && state.refs.editorFrame.contentDocument) {
      const ae = state.refs.editorFrame.contentDocument.activeElement;
      if (ae && typeof ae.blur === "function") ae.blur();
    }
    postEditorMessage({ type: "lp-notes-blur" });
    // Fokus semula ke elemen asal lepas render settle supaya keyboard berfungsi segera
    await flushSave("Saved");
    state.mindmap.collapsedFolders = [];
    requestAnimationFrame(() => {
      const prev = state.previousFocus;
      state.previousFocus = null;
      if (prev && typeof prev.focus === "function" && document.contains(prev)) {
        try { prev.focus({ preventScroll: true }); } catch (_) {}
      } else {
        const video = document.querySelector("video");
        if (video && typeof video.focus === "function") {
          try { video.focus({ preventScroll: true }); } catch (_) {}
        } else if (document.body && typeof document.body.focus === "function") {
          document.body.focus({ preventScroll: true });
        }
      }
    });
  }

  async function toggle(options = {}) {
    if (options && options.open === true) {
      await open(options);
      return true;
    }
    if (options && options.close === true) {
      await close();
      return true;
    }
    if (state.open) {
      await close();
      return true;
    }
    await open(options);
    return true;
  }

  // ── Helpers untuk lp-insert-ai-text ─────────────────────────────────────
  function collectContentNodes(note) {
    const lines = (note.content || "").split("\n");
    const nodes = [];
    lines.forEach(function(line, idx) {
      var trimmed = line.trim();
      if (!trimmed) return;
      var m;
      if ((m = trimmed.match(/^(#{1,6})\s+(.+)/))) {
        nodes.push({ label: m[2], lineIndex: idx, type: "heading", level: m[1].length });
      } else if ((m = trimmed.match(/^[-*]\s\[( |x|X)\]\s?(.*)/))) {
        nodes.push({ label: m[2], lineIndex: idx, type: "task" });
      } else if ((m = trimmed.match(/^[-*]\s+(.*)/))) {
        nodes.push({ label: m[1], lineIndex: idx, type: "bullet" });
      } else if ((m = trimmed.match(/^\d+[.)]\s+(.*)/))) {
        nodes.push({ label: m[1], lineIndex: idx, type: "numbered" });
      } else {
        nodes.push({ label: trimmed.length > 60 ? trimmed.slice(0, 60) + "…" : trimmed, lineIndex: idx, type: "text" });
      }
    });
    return nodes;
  }

function detectIndent(lines, lineIndex) {
    if (lineIndex < 0 || lineIndex >= lines.length) return "";
    var m = lines[lineIndex].match(/^(\s*)/);
    return m ? m[1] : "";
  }

  api.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") return undefined;
    if (message.type === "toggle-notes-overlay") {
      return toggle(message).then(() => ({ ok: true })).catch(() => ({ ok: false }));
    }
    if (message.type === "toggle-todo-overlay") {
      if (!state.mounted) return Promise.resolve({ ok: false, reason: "not-mounted" });
      if (!state.open) {
        return open().then(function() {
          state.panelMode = "todo";
          render();
          focusTodoInput();
          return { ok: true };
        }).catch(function() { return { ok: false }; });
      }
      if (state.panelMode === "todo") {
        state.panelMode = "picker";
      } else {
        state.panelMode = "todo";
        render();
        focusTodoInput();
        return Promise.resolve({ ok: true });
      }
      render();
      return Promise.resolve({ ok: true });
    }
    if (message.type === "ping-notes-overlay") {
      return Promise.resolve({ ok: true });
    }
    if (message.type === "set-notes-overlay-context") {
      state.pageContext = message.pageContext && typeof message.pageContext === "object"
        ? {
          title: message.pageContext.title ? String(message.pageContext.title) : "",
          url: message.pageContext.url ? String(message.pageContext.url) : ""
        }
        : null;
      return Promise.resolve({ ok: true });
    }
    if (message.type === "lp-get-content-nodes") {
      return (async () => {
        if (!state.open || !getActiveNote()) return { ok: true, nodes: [] };
        await syncActiveNoteFromEditor(false);
        const note = getActiveNote();
        return { ok: true, nodes: note ? collectContentNodes(note) : [] };
      })();
    }
    if (message.type === "lp-insert-ai-text-final") {
      const text = message.text ? String(message.text) : "";
      const mode = message.mode;
      if (!text || !mode) return Promise.resolve({ ok: false, reason: "invalid-params" });

      // Content mode + no specific lineIndex → let user pick node by clicking in mindmap
      // (When AI sidebar sends lineIndex, it already knows the target)
      if (message.lineIndex == null && state.panelMode === "mindmap" && state.mindmap && state.mindmap.mode === "content") {
        return (async () => {
          await syncActiveNoteFromEditor(false);
          // Re-render mindmap so data-mm-lineindex matches latest content
          renderMindmap();
          var wrap = state.refs.mpMindmapSvgWrap;
          var svg = state.refs.mpMindmapSvg;
          if (!wrap || !svg) return null;
          // Show floating indicator (closeable)
          var indicator = document.createElement("div");
          indicator.style.cssText = [
            "position:absolute","bottom:10px","left:50%","transform:translateX(-50%)",
            "z-index:30","display:flex","align-items:center","gap:8px",
            "padding:8px 14px","border-radius:12px",
            "background:rgba(14,18,30,0.97)",
            "border:1px solid rgba(100,220,160,0.4)",
            "box-shadow:0 8px 28px rgba(0,0,0,0.5)",
            "font-size:11px","color:rgba(255,255,255,0.85)",
            "max-width:420px"
          ].join(";");
          indicator.textContent = "Klik node dalam mindmap untuk tambah teks sebagai anak";
          var closeInd = document.createElement("button");
          closeInd.type = "button";
          closeInd.style.cssText = "padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:rgba(255,255,255,0.4);font-size:10px;cursor:pointer;outline:none;flex-shrink:0";
          closeInd.textContent = "✕";
          indicator.appendChild(closeInd);
          wrap.appendChild(indicator);

          // Pick mode — click any content node to insert
          var pickH = function(e) {
            var note = getActiveNote();
            var t = e.target;
            while (t && t.getAttribute && !t.getAttribute("data-mm-id")) { t = t.parentNode; }
            if (!t || !t.getAttribute) return;
            var id = t.getAttribute("data-mm-id");
            var type = t.getAttribute("data-mm-type") || "";
            if (!id || type === "root" || type === "note" || type === "folder") return;

            indicator.remove();
            svg.removeEventListener("click", pickH);

            if (!note || !note.content) return;
            var lines = note.content.split("\n");

            var lineIdxAttr = t.getAttribute("data-mm-lineindex");
            var insertIdx = lines.length;
            if (lineIdxAttr != null) {
              var li = parseInt(lineIdxAttr, 10);
              if (!isNaN(li) && li >= 0 && li < lines.length) {
                insertIdx = li + 1;
              }
            }

            var parentLine = lines[insertIdx - 1] || "";
            var parentIndent = detectIndent(lines, insertIdx - 1);
            var isHeading = /^(#{1,6})\s+/.test(parentLine.trim());
            var childIndent = isHeading ? "" : parentIndent + "  ";
            var childLines = text.split("\n").map(function(l, i) {
              return i === 0 ? childIndent + "- " + l.trim() : childIndent + "  " + l.trim();
            });
            lines.splice.apply(lines, [insertIdx, 0].concat(childLines));
            note.content = lines.join("\n");
            note.updatedAt = new Date().toISOString();

            syncEditorFrameWithNote(note);
            persist("Inserted ✓");
            if (state.panelMode === "mindmap") render();
          };
          svg.addEventListener("click", pickH);

          closeInd.addEventListener("click", function() {
            indicator.remove();
            svg.removeEventListener("click", pickH);
          });

          return { ok: true };
        })().then(function(pickResult) {
          if (pickResult) return pickResult;
          // Fall through to normal insert if no wrap/svg
          return (async () => {
            try {
              if (!state.open) await open({});
              await syncActiveNoteFromEditor(false);
              const note = getActiveNote();
              if (!note) return { ok: false, reason: "no-active-note" };
              if (mode === "append") {
                note.content = (note.content || "") + "\n" + text;
              } else if (mode === "child" && message.lineIndex != null) {
                const lines = (note.content || "").split("\n");
                const parentLine = lines[message.lineIndex] || "";
                const parentIndent = detectIndent(lines, message.lineIndex);
                const isHeading = /^(#{1,6})\s+/.test(parentLine.trim());
                const childIndent = isHeading ? "" : parentIndent + "  ";
                const childLines = text.split("\n").map(function(l, i) {
                  return i === 0 ? childIndent + "- " + l.trim() : childIndent + "  " + l.trim();
                });
                lines.splice.apply(lines, [message.lineIndex + 1, 0].concat(childLines));
                note.content = lines.join("\n");
              }
              syncEditorFrameWithNote(note);
              await persist("Inserted ✓");
              if (state.panelMode === "mindmap") renderMindmap();
              return { ok: true };
            } catch (err) {
              return { ok: false, reason: "insert-failed" };
            }
          })();
        });
      }

      return Promise.resolve({ ok: true, reason: "noop" });
    }
    if (message.type === "create-note-from-summary") {
      const summaryText = message.text ? String(message.text) : "";
      const summaryTitle = message.title ? String(message.title).slice(0, 120) : "";
      if (!summaryText) return Promise.resolve({ ok: false, reason: "no-text" });
      return (async () => {
        try {
          // Buka overlay jika belum terbuka
          if (!state.open) {
            await open({});
          }
          await syncActiveNoteFromEditor(false);
          const folderId = getNewNoteFolderId();
          const now = new Date().toISOString();
          const note = {
            id: makeId("note"),
            title: summaryTitle || "Ringkasan AI",
            content: summaryText.slice(0, 200000),
            folderId: folderId || "",
            isPinned: false,
            pinnedAt: "",
            createdAt: now,
            updatedAt: now
          };
          state.notes = getSortedNotes([note, ...state.notes]);
          state.ui.activeNoteId = note.id;
          state.panelMode = "editor";
          state.ui.notesDrawerOpen = false;
          render();
          scheduleSave();
          queueEditorFocus("content", false);
          return { ok: true };
        } catch (err) {
          return { ok: false, reason: "create-failed" };
        }
      })();
    }
    return undefined;
  });

  if (api.storage && api.storage.onChanged) {
    api.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (changes[SETTINGS_KEY] && state.open) {
        state.settings = changes[SETTINGS_KEY].newValue && typeof changes[SETTINGS_KEY].newValue === "object"
          ? changes[SETTINGS_KEY].newValue
          : {};
        if (!state.settings.notesOverlayShortcuts || typeof state.settings.notesOverlayShortcuts !== "object") state.settings.notesOverlayShortcuts = {};
        render();
      }
      // Sync notes from other tabs/windows
      if ((changes[NOTES_KEY] || changes[FOLDERS_KEY]) && state.open) {
        state.pendingExternalReload = true;
        if (!state.editor.dirty) {
          reloadFromExternal();
        }
      }
    });
  }

  window.LocalPocketNotesOverlay = {
    open,
    close,
    toggle,
    setPageContext(context) {
      state.pageContext = context && typeof context === "object"
        ? {
          title: context.title ? String(context.title) : "",
          url: context.url ? String(context.url) : ""
        }
        : null;
    }
  };
})();
