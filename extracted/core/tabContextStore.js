/**
 * JARVIS Cross-tab Context Store (#4 Cross-tab Context Awareness).
 *
 * Modul ini hidup di background page. Ia menyimpan metadata ringan setiap
 * tab yang dibuka/dikunjungi pengguna (tajuk, URL, preview teks, group tab)
 * supaya JARVIS boleh memahami & menjawab arahan yang merentas tab
 * (cth. "apa yang ada dalam tab 2?", "bandingkan dengan tab sebelah",
 * "tutup semua tab kecuali ini").
 *
 * Pengumpulan konteks:
 *   - Pada tab diaktifkan / dimuat selesai, background minta content script
 *     hantar snapshot via mesej `jarvis-collect-context` -> `jarvis-context-update`.
 *   - Fallback: metadata dari lpApi.tabs.get() (tajuk/url/favicon/groupId)
 *     sentiasa disegar walaupun tiada content script.
 */
(function () {
  'use strict';

  var lpApi = (typeof browser !== 'undefined') ? browser : chrome;
  var USE_PROMISE_TABS = (typeof browser !== 'undefined') && lpApi === browser;

  // tabId -> { tabId, title, url, textPreview, faviconUrl, groupId, timestamp }
  var store = new Map();
  // Susunan tab mengikut kebarangkalian (paling baru di hujung).
  var order = [];
  var listenersRegistered = false;

  function now() { return Date.now(); }

  function safeTabsGet(tabId) {
    if (!lpApi.tabs || !lpApi.tabs.get) return Promise.resolve(null);
    if (USE_PROMISE_TABS) return lpApi.tabs.get(tabId).catch(function () { return null; });
    return new Promise(function (resolve) {
      try {
        lpApi.tabs.get(tabId, function (tab) {
          var err = lpApi.runtime && lpApi.runtime.lastError;
          if (err) return resolve(null);
          resolve(tab);
        });
      } catch (e) { resolve(null); }
    });
  }

  function safeTabsQuery(queryInfo) {
    if (!lpApi.tabs || !lpApi.tabs.query) return Promise.resolve([]);
    if (USE_PROMISE_TABS) return lpApi.tabs.query(queryInfo).catch(function () { return []; });
    return new Promise(function (resolve) {
      try {
        lpApi.tabs.query(queryInfo, function (tabs) {
          var err = lpApi.runtime && lpApi.runtime.lastError;
          if (err) return resolve([]);
          resolve(tabs || []);
        });
      } catch (e) { resolve([]); }
    });
  }

  function closeTabs(ids) {
    if (!Array.isArray(ids) || !ids.length) return Promise.resolve(0);
    if (!lpApi.tabs || !lpApi.tabs.remove) return Promise.resolve(0);
    var seq = Promise.resolve(0);
    ids.forEach(function (id) {
      seq = seq.then(function (n) {
        return new Promise(function (resolve) {
          try {
            var r = lpApi.tabs.remove(id);
            if (r && typeof r.then === 'function') r.then(function () { resolve(n + 1); }).catch(function () { resolve(n); });
            else resolve(n + 1);
          } catch (e) { resolve(n); }
        });
      });
    });
    return seq;
  }

  function touchOrder(tabId) {
    var i = order.indexOf(tabId);
    if (i !== -1) order.splice(i, 1);
    order.push(tabId);
  }

  function removeFromOrder(tabId) {
    var i = order.indexOf(tabId);
    if (i !== -1) order.splice(i, 1);
  }

  function assignContext(prev, next) {
    prev = prev || {};
    return {
      tabId: (typeof next.tabId === 'number') ? next.tabId : (prev.tabId || null),
      title: next.title || prev.title || '',
      url: next.url || prev.url || '',
      textPreview: (typeof next.textPreview === 'string') ? next.textPreview : (prev.textPreview || ''),
      faviconUrl: next.faviconUrl || prev.faviconUrl || '',
      groupId: (typeof next.groupId === 'number') ? next.groupId : (prev.groupId || null),
      index: (typeof next.index === 'number') ? next.index : (prev.index != null ? prev.index : null),
      timestamp: (typeof next.timestamp === 'number') ? next.timestamp : (prev.timestamp || now())
    };
  }

  function coerceContext(entry) {
    if (!entry) return null;
    return {
      tabId: entry.tabId,
      title: entry.title || '',
      url: entry.url || '',
      textPreview: entry.textPreview || '',
      faviconUrl: entry.faviconUrl || '',
      groupId: entry.groupId || null,
      index: (entry.index != null) ? entry.index : null,
      timestamp: entry.timestamp || 0
    };
  }

  // Kumpul konteks untuk satu tab: segarkan metadata dari API, DAN minta
  // content script hantar preview teks (best-effort).
  function collectContextForTab(tabId) {
    if (tabId == null) return;
    safeTabsGet(tabId).then(function (tab) {
      if (!tab) return;
      var urlOk = (tab.url && /^https?:|^file:/.test(tab.url)) ? tab.url : '';
      var prev = store.get(tabId) || {};
      store.set(tabId, assignContext(prev, {
        tabId: tabId,
        title: tab.title || prev.title || '',
        url: urlOk || prev.url || '',
        faviconUrl: tab.favIconUrl || prev.faviconUrl || '',
        groupId: (typeof tab.groupId === 'number') ? tab.groupId : (prev.groupId || null),
        index: (typeof tab.index === 'number') ? tab.index : (prev.index != null ? prev.index : null),
        timestamp: now()
      }));
      touchOrder(tabId);
    }).catch(function () {});

    if (lpApi.tabs && lpApi.tabs.sendMessage) {
      try {
        var p = lpApi.tabs.sendMessage(tabId, { type: 'jarvis-collect-context' });
        if (p && typeof p.then === 'function') p.catch(function () {});
      } catch (e) {}
    }
  }

  function getRecentContexts(excludeTabId, limit) {
    var all = [];
    store.forEach(function (c) {
      if (!c) return;
      if (excludeTabId != null && c.tabId === excludeTabId) return;
      if (!c.url && !c.title) return;
      all.push(coerceContext(c));
    });
    // Susun ikut posisi sebenar tab di bar pelayar (index menaik) supaya
    // "tab N" konsisten antara senarai dan blok injection.
    all.sort(function (a, b) {
      var ia = (a && a.index != null) ? a.index : 1e9;
      var ib = (b && b.index != null) ? b.index : 1e9;
      return ia - ib;
    });
    return all.slice(0, (limit || 12));
  }

  function handleCrossTabCommand(message, sender, sendResponse) {
    var action = String(message.action || '').toLowerCase();
    if (action === 'close-others') {
      var keepId = (typeof message.tabId === 'number')
        ? message.tabId
        : (sender && sender.tab && sender.tab.id);
      safeTabsQuery({}).then(function (tabs) {
        if (!Array.isArray(tabs)) { if (sendResponse) sendResponse({ ok: false }); return; }
        var aiRe = /^https?:\/\/[^\/]*\/(?:chatgpt|claude|gemini|perplexity|grok|copilot|deepseek|poe|mistral|notebooklm)/i;
        var toClose = tabs.filter(function (t) {
          if (!t || t.id == null) return false;
          if (t.id === keepId) return false;
          if (t.url && aiRe.test(t.url)) return false; // jangan tutup tab AI provider
          return true;
        }).map(function (t) { return t.id; });
        closeTabs(toClose).then(function (n) {
          if (sendResponse) sendResponse({ ok: true, closed: n });
        }).catch(function (e) {
          if (sendResponse) sendResponse({ ok: false, error: String((e && e.message) || e) });
        });
      }).catch(function () { if (sendResponse) sendResponse({ ok: false }); });
      return;
    }
    // Tutup tab nombor tertentu (posisi di bar). `ordinals` = [N, ...].
    if (action === 'close-tab') {
      var ords = Array.isArray(message.ordinals) ? message.ordinals : [];
      var senderId = (sender && sender.tab && sender.tab.id);
      var all = getRecentContexts(null, 200); // susun ikut index, semua tab
      var closeIds = [];
      ords.forEach(function (n) {
        var c = all[n - 1];
        if (c && c.tabId != null && c.tabId !== senderId) closeIds.push(c.tabId);
      });
      closeTabs(closeIds).then(function (n) {
        if (sendResponse) sendResponse({ ok: true, closed: n });
      }).catch(function (e) {
        if (sendResponse) sendResponse({ ok: false, error: String((e && e.message) || e) });
      });
      return;
    }
    if (sendResponse) sendResponse({ ok: false, error: 'unknown-action' });
  }

  // Dipanggil dari background.js (lpApi.runtime.onMessage). Kembalikan true
  // jika mesej dikendalikan (supaya background boleh `return true`).
  function handleMessage(message, sender, sendResponse) {
    if (!message || typeof message !== 'object') return false;

    if (message.type === 'jarvis-context-update') {
      var sid = (sender && sender.tab && typeof sender.tab.id === 'number') ? sender.tab.id : null;
      var tabId = (typeof message.tabId === 'number') ? message.tabId : sid;
      if (tabId == null) { if (sendResponse) sendResponse({ ok: false }); return true; }
      var data = message.data || {};
      var prev = store.get(tabId) || {};
      store.set(tabId, assignContext(prev, {
        tabId: tabId,
        title: data.title || prev.title || '',
        url: data.url || prev.url || '',
        textPreview: data.textPreview || '',
        faviconUrl: data.faviconUrl || prev.faviconUrl || '',
        groupId: prev.groupId || null,
        timestamp: now()
      }));
      touchOrder(tabId);
      if (sendResponse) sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'jarvis-get-recent-contexts') {
      var exclude = (typeof message.excludeTabId === 'number') ? message.excludeTabId : null;
      var limit = (typeof message.limit === 'number' && message.limit > 0) ? message.limit : 12;
      var list = getRecentContexts(exclude, limit);
      if (sendResponse) sendResponse({ ok: true, contexts: list });
      return true;
    }

    if (message.type === 'jarvis-crosstab-command') {
      handleCrossTabCommand(message, sender, sendResponse);
      return true;
    }

    return false;
  }

  function init() {
    if (listenersRegistered) return;
    listenersRegistered = true;

    if (lpApi.tabs && lpApi.tabs.onActivated && lpApi.tabs.onActivated.addListener) {
      lpApi.tabs.onActivated.addListener(function (activeInfo) {
        if (activeInfo && activeInfo.tabId != null) collectContextForTab(activeInfo.tabId);
      });
    }

    if (lpApi.tabs && lpApi.tabs.onRemoved && lpApi.tabs.onRemoved.addListener) {
      lpApi.tabs.onRemoved.addListener(function (tabId) {
        store.delete(tabId);
        removeFromOrder(tabId);
      });
    }

    if (lpApi.tabs && lpApi.tabs.onUpdated && lpApi.tabs.onUpdated.addListener) {
      lpApi.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
        if (changeInfo && changeInfo.status === 'complete' && tab) {
          var urlOk = (tab.url && /^https?:|^file:/.test(tab.url)) ? tab.url : '';
          var prev = store.get(tabId) || {};
          store.set(tabId, assignContext(prev, {
            tabId: tabId,
            title: tab.title || '',
            url: urlOk || prev.url || '',
            faviconUrl: tab.favIconUrl || '',
            groupId: (typeof tab.groupId === 'number') ? tab.groupId : (prev.groupId || null),
            index: (typeof tab.index === 'number') ? tab.index : (prev.index != null ? prev.index : null),
            timestamp: now()
          }));
          touchOrder(tabId);
          collectContextForTab(tabId);
        }
      });
    }

    // Seed: kumpul konteks semua tab yang sedang dibuka.
    safeTabsQuery({}).then(function (tabs) {
      if (!Array.isArray(tabs)) return;
      tabs.forEach(function (t) { if (t && t.id != null) collectContextForTab(t.id); });
    }).catch(function () {});
  }

  // API awam (gaya modul sedia ada: Global `LocalPocket*`Core`).
  if (typeof window !== 'undefined') {
    window.LocalPocketTabContextStore = {
      init: init,
      handleMessage: handleMessage,
      collectContextForTab: collectContextForTab,
      getRecentContexts: getRecentContexts
    };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      init: init,
      handleMessage: handleMessage,
      collectContextForTab: collectContextForTab,
      getRecentContexts: getRecentContexts
    };
  }
})();
