// ── Background Context Menu Engine ──

let selectionSearchContextMenuMap = new Map();

function normalizeSelectionSearchMenuId(id) {
  const raw = typeof id === "string" ? id.trim() : "";
  const cleaned = raw.replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
  return cleaned || String(Date.now());
}

function buildSelectionSearchUrl(entry, selectionText) {
  const query = String(selectionText || "").trim();
  if (!query) return "";
  if (!entry || !entry.type) return "";
  if (entry.type === "open-link") {
    try {
      if (/^https?:\/\//i.test(query)) {
        return new URL(query).toString();
      }
      return new URL(`https://${query}`).toString();
    } catch (_err) {
      return "";
    }
  }
  if (entry.type === "engine") {
    const rawUrl = entry.url ? String(entry.url) : "";
    if (!rawUrl) return "";
    const encoded = encodeURIComponent(query);
    if (/%s/i.test(rawUrl)) return rawUrl.replace(/%s/gi, encoded);
    if (/\{searchTerms\}/i.test(rawUrl)) return rawUrl.replace(/\{searchTerms\}/gi, encoded);
    return rawUrl + encoded;
  }
  return "";
}

window.createContextMenu = async function createContextMenu() {
  if (!lpApi.contextMenus) return;
  try {
    if (lpApi.contextMenus.removeAll) {
      await lpApi.contextMenus.removeAll();
    }
  } catch (err) {
    lpWarn("Failed to clear old context menus", err);
  }
  try {
    lpApi.contextMenus.create({
      id: CONTEXT_MENU_ID_FLOATING_ROOT,
      title: "Floating button",
      contexts: CONTEXT_MENU_WEB_CONTEXTS,
    });
    lpApi.contextMenus.create({
      id: CONTEXT_MENU_ID_FLOATING_ADD_DOMAIN,
      parentId: CONTEXT_MENU_ID_FLOATING_ROOT,
      title: "Hide on this domain",
      contexts: CONTEXT_MENU_WEB_CONTEXTS,
    });
    lpApi.contextMenus.create({
      id: CONTEXT_MENU_ID_FLOATING_REMOVE_DOMAIN,
      parentId: CONTEXT_MENU_ID_FLOATING_ROOT,
      title: "Remove domain exception",
      contexts: CONTEXT_MENU_WEB_CONTEXTS,
    });
    lpApi.contextMenus.create({
      id: CONTEXT_MENU_ID_SET_THUMBNAIL,
      title: "Set as thumbnail for saved page",
      contexts: ["image"],
    });
    lpApi.contextMenus.create({
      id: CONTEXT_MENU_ID_SET_CATEGORY_ICON,
      title: "Set as category icon",
      contexts: ["image"],
    });
    const settings = await getSettings();
    selectionSearchContextMenuMap = new Map();
    const selectionMenu = settings && settings.selectionSearchContextMenu
      ? settings.selectionSearchContextMenu
      : { enabled: false };
    if (selectionMenu && selectionMenu.enabled === true) {
      const rootTitle = selectionMenu.title && String(selectionMenu.title).trim()
        ? String(selectionMenu.title).trim()
        : "Search for \"%s\"";
      lpApi.contextMenus.create({
        id: CONTEXT_MENU_ID_SELECTION_ROOT,
        title: rootTitle,
        contexts: ["selection"],
      });
      const engines = Array.isArray(settings.selectionSearchEnginesList)
        ? settings.selectionSearchEnginesList
        : [];
      engines.forEach((entry) => {
        if (!entry || entry.showContextMenu !== true) return;
        if (entry.type === "separator") {
          lpApi.contextMenus.create({
            id: `${CONTEXT_MENU_ID_SELECTION_PREFIX}sep-${normalizeSelectionSearchMenuId(entry.id || "")}`,
            type: "separator",
            parentId: CONTEXT_MENU_ID_SELECTION_ROOT,
            contexts: ["selection"],
          });
          return;
        }
        if (entry.type === "group") {
          lpApi.contextMenus.create({
            id: `${CONTEXT_MENU_ID_SELECTION_PREFIX}grp-${normalizeSelectionSearchMenuId(entry.id || "")}`,
            title: entry.name ? String(entry.name) : "Group",
            parentId: CONTEXT_MENU_ID_SELECTION_ROOT,
            contexts: ["selection"],
            enabled: false,
          });
          return;
        }
        const id = normalizeSelectionSearchMenuId(entry.id || "");
        const menuId = `${CONTEXT_MENU_ID_SELECTION_PREFIX}${id}`;
        selectionSearchContextMenuMap.set(menuId, entry);
        lpApi.contextMenus.create({
          id: menuId,
          title: entry.name ? String(entry.name) : "Search",
          parentId: CONTEXT_MENU_ID_SELECTION_ROOT,
          contexts: ["selection"],
        });
      });
    }
  } catch (err) {
    lpErr("Failed to create context menu", err);
  }
}

window.setupContextMenuListeners = function setupContextMenuListeners() {
  if (lpApi.contextMenus && lpApi.contextMenus.onClicked) {
    lpApi.contextMenus.onClicked.addListener(async (info, tab) => {
      if (info.menuItemId === CONTEXT_MENU_ID_SAVE_TO_POCKET) {
        const categoryIdForContextMenu = await getContextMenuSaveCategoryId();
        if (info.linkUrl) {
          const resolvedTitle = await resolveSavedLinkTitle(info.linkUrl);
          await upsertMinimalItemFromUrl(
            info.linkUrl,
            resolvedTitle,
            categoryIdForContextMenu,
          );
          const cats = await getCachedCategories();
          const catName = getCategoryLabel(categoryIdForContextMenu || "", cats || []);
          showSavedToast(catName, categoryIdForContextMenu).catch(() => {});
          return;
        }
        await saveFromTab(tab, { forcedCategoryId: categoryIdForContextMenu });
        const cats = await getCachedCategories();
        const catName = getCategoryLabel(categoryIdForContextMenu || "", cats || []);
        showSavedToast(catName, categoryIdForContextMenu).catch(() => {});
      }
      if (info.menuItemId === CONTEXT_MENU_ID_FLOATING_ADD_DOMAIN) {
        await handleFloatingDomainExceptionContextMenu(info, tab, "add");
        return;
      }
      if (info.menuItemId === CONTEXT_MENU_ID_FLOATING_REMOVE_DOMAIN) {
        await handleFloatingDomainExceptionContextMenu(info, tab, "remove");
        return;
      }
      if (info.menuItemId === CONTEXT_MENU_ID_SET_THUMBNAIL) {
        (async () => {
          try {
            const imageUrl = info.srcUrl ? String(info.srcUrl) : "";
            const pageUrl = info.pageUrl || (tab && tab.url) || "";
            if (!imageUrl || !pageUrl) return;
            const items = await getItems();
            const idx = getExistingIndexFromUrl(pageUrl, items);
            if (idx < 0) {
              if (lpApi.notifications) {
                const iconUrl = lpApi.runtime && lpApi.runtime.getURL ? lpApi.runtime.getURL("icons/icon-default-32.png") : "";
                lpApi.notifications.create("lp-set-thumbnail-no-item", {
                  type: "basic",
                  iconUrl,
                  title: "Local Pocket Reader",
                  message: "No saved item found for this page."
                });
              }
              return;
            }
            const updated = { ...items[idx] };
            updated.thumbnailUrl = imageUrl;
            updated.thumbnailFetchFailed = false;
            updated.thumbnailManual = true;
            items[idx] = updated;
            await setItems(items, { previousItems: items.slice(), skipDedupe: true });
            if (lpApi.runtime && lpApi.runtime.sendMessage) {
              lpApi.runtime.sendMessage({ type: "refresh-picker-ui" }).catch(() => {});
            }
            if (lpApi.notifications) {
              const iconUrl = lpApi.runtime && lpApi.runtime.getURL ? lpApi.runtime.getURL("icons/icon-default-32.png") : "";
              lpApi.notifications.create("lp-set-thumbnail-ok", {
                type: "basic",
                iconUrl,
                title: "Local Pocket Reader",
                message: "Thumbnail updated."
              });
            }
          } catch (e) {
            lpWarn("Set thumbnail from context menu failed", e);
          }
        })();
        return;
      }
      if (info.menuItemId === CONTEXT_MENU_ID_SET_CATEGORY_ICON) {
        (async () => {
          try {
            const imageUrl = info.srcUrl ? String(info.srcUrl) : "";
            if (!imageUrl) return;
            const selectedCategoryId = await getSelectedCategoryId();
            if (!selectedCategoryId || selectedCategoryId === "all" || selectedCategoryId === "none") {
              if (lpApi.notifications) {
                const iconUrl = lpApi.runtime && lpApi.runtime.getURL ? lpApi.runtime.getURL("icons/icon-default-32.png") : "";
                lpApi.notifications.create("lp-set-icon-no-cat", {
                  type: "basic",
                  iconUrl,
                  title: "Local Pocket Reader",
                  message: "Sila pilih kategori terlebih dahulu (bukan 'All' atau 'Uncategorized')."
                });
              }
              return;
            }
            const data = await lpStoreGet([CATEGORY_KEY]);
            const categories = data && data[CATEGORY_KEY] ? data[CATEGORY_KEY] : [];
            const next = categories.map(c => {
              if (String(c.id) === String(selectedCategoryId)) {
                return { ...c, icon: imageUrl };
              }
              return c;
            });
            await lpStoreSet({ [CATEGORY_KEY]: next });
            if (lpApi.runtime && lpApi.runtime.sendMessage) {
              lpApi.runtime.sendMessage({ type: "refresh-picker-ui" }).catch(() => {});
            }
            const cats = next;
            const catEntry = cats.find(c => String(c.id) === String(selectedCategoryId));
            const catName = catEntry && catEntry.name ? catEntry.name : selectedCategoryId;
            if (lpApi.notifications) {
              const iconUrl = lpApi.runtime && lpApi.runtime.getURL ? lpApi.runtime.getURL("icons/icon-default-32.png") : "";
              lpApi.notifications.create("lp-set-icon-ok", {
                type: "basic",
                iconUrl,
                title: "Local Pocket Reader",
                message: `Icon "${catName}" ditukar!`
              });
            }
          } catch (e) {
            lpWarn("Set category icon from context menu failed", e);
          }
        })();
        return;
      }
      if (String(info.menuItemId || "").startsWith(CONTEXT_MENU_ID_SELECTION_PREFIX)) {
        const entry = selectionSearchContextMenuMap.get(info.menuItemId);
        if (!entry) return;
        const selectionText = info.selectionText ? String(info.selectionText) : "";
        const settings = currentSettings && currentSettings.selectionSearchContextMenu
          ? currentSettings.selectionSearchContextMenu
          : { leftClickAction: "new-tab", rightClickAction: "new-tab", middleClickAction: "new-background-tab" };
        const button = typeof info.button === "number" ? info.button : 0;
        const action = button === 1
          ? settings.middleClickAction
          : (button === 2 ? settings.rightClickAction : settings.leftClickAction);
        if (entry.type === "copy") {
          if (tab && tab.id && lpApi.tabs && lpApi.tabs.sendMessage) {
            lpApi.tabs.sendMessage(tab.id, { type: "selection-search-copy-selection", text: selectionText }).catch(() => { });
          }
          return;
        }
        const url = buildSelectionSearchUrl(entry, selectionText);
        if (!url) return;
        if (action === "same-tab") {
          if (tab && tab.id && lpApi.tabs && lpApi.tabs.update) {
            lpApi.tabs.update(tab.id, { url }).catch(() => { });
          }
          return;
        }
        if (lpApi.tabs && lpApi.tabs.create) {
          lpApi.tabs.create({ url, active: action !== "new-background-tab" }).catch(() => { });
        }
        return;
      }
    });
  }
}
