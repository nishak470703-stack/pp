/**
 * Local Pocket Reader — JARVIS Memory Layers (#6 Memory That Grows)
 *
 * Pengurus ingatan berbilang-lapis untuk JARVIS:
 *   Layer 1: Session        — sejarah perbualan (diurus pemanggil, bukan sini)
 *   Layer 2: Site-specific   — learnedPreferences["site:..."] (separuh sedia ada)
 *   Layer 3: User global     — tone / bahasa / summaryMode / kategori (BARU)
 *   Layer 4: Time-based      — tabiat pagi/malam (BARU)
 *   Layer 5: Cross-device    — sync via Supabase (BARU, lihat preferenceSync.js)
 *
 * Modul ini TIDAK bergantung pada ES module. Ia attach ke
 * `window.LocalPocketMemoryLayers` dan berfungsi di mana-mana konteks
 * (content script, sidebar page, dashboard page) kerana semua konteks
 * berkongsi `browser.storage.local` yang sama.
 *
 * Guna style sedia ada (var / function expressions) supaya konsisten dengan
 * jarvisCore.js. Simpan ke storage key berasingan `jarvisPrefs` (cadangan C4).
 */
(function (globalScope) {
  'use strict';

  var STORAGE_KEY = 'jarvisPrefs';
  var SCHEMA_VERSION = 1;

  var api = (typeof browser !== 'undefined')
    ? browser
    : (typeof chrome !== 'undefined' ? chrome : null);

  // ── Profil lalai ────────────────────────────────────────────────────────────
  function defaultProfile() {
    return {
      schemaVersion: SCHEMA_VERSION,
      // Layer 3 — preferensi global pengguna
      defaultLanguage: 'ms',      // ms / en / id / ...
      defaultTone: 'neutral',     // neutral / formal / casual / educational
      defaultSummaryMode: 'auto', // auto / quick / deep / action_items / ...
      autoSaveOnSummarize: true,
      defaultCategory: 'Baca Nanti',
      proactiveLevel: 3,          // 0 (off) - 5 (very proactive)
      voiceOutput: false,
      // Layer 2 — pembelajaran khusus laman & masa (counters)
      learnedPreferences: {},     // { "site:youtube.com": {action, times}, ... }
      timeHabits: {},             // { "pagi": {tone, summaryMode, count}, ... }
      // Layer 6 — Graf pengetahuan fakta pengguna (JSON terstruktur). Setiap
      // fakta: { id, statement, category, confidence, source, createdAt,
      //          lastSeen, timesSeen }. Diekstrak dari sejarah sembang oleh
      //          memoryExtractor.js.
      facts: [],
      usage: {                    // kiraan penggunaan utk auto-promote default
        tone: {},
        summaryMode: {},
        language: {}
      },
      // Flag migrasi sekali sahaja dari `settings` sedia ada
      migratedFromSettings: false,
      updatedAt: 0
    };
  }

  function clone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); }
    catch (e) { return {}; }
  }

  function deepMerge(base, over) {
    var out = clone(base);
    if (!over || typeof over !== 'object') return out;
    Object.keys(over).forEach(function (k) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') {
        out[k] = deepMerge(base[k], over[k]);
      } else if (over[k] !== undefined) {
        out[k] = over[k];
      }
    });
    return out;
  }

  // ── State dalam-memori (cache) ──────────────────────────────────────────────
  var cache = null;
  var initPromise = null;
  var saveTimer = null;

  // ── Storage helpers (callback + promise safe) ───────────────────────────────
  function storeGet(key) {
    return new Promise(function (resolve) {
      if (!api || !api.storage || !api.storage.local) { resolve(null); return; }
      try {
        var p = api.storage.local.get(key, function (v) {
          resolve((v && v[key] !== undefined) ? v[key] : null);
        });
        if (p && typeof p.then === 'function') {
          p.then(function (v) { resolve((v && v[key] !== undefined) ? v[key] : null); }).catch(function () { resolve(null); });
        }
      } catch (e) { resolve(null); }
    });
  }

  function storeSet(obj) {
    return new Promise(function (resolve) {
      if (!api || !api.storage || !api.storage.local) { resolve(false); return; }
      try {
        var p = api.storage.local.set(obj, function () { resolve(true); });
        if (p && typeof p.then === 'function') p.then(function () { resolve(true); }).catch(function () { resolve(false); });
      } catch (e) { resolve(false); }
    });
  }

  function storeRemove(key) {
    return new Promise(function (resolve) {
      if (!api || !api.storage || !api.storage.local) { resolve(false); return; }
      try {
        var p = api.storage.local.remove(key, function () { resolve(true); });
        if (p && typeof p.then === 'function') p.then(function () { resolve(true); }).catch(function () { resolve(false); });
      } catch (e) { resolve(false); }
    });
  }

  // ── Save (debounced supaya tidak penuhkan storage) ──────────────────────────
  function scheduleSave() {
    if (!cache) return;
    cache.updatedAt = Date.now();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      storeSet((function () { var o = {}; o[STORAGE_KEY] = cache; return o; })()).then(function () {
        // Layer 5 — sync silang-peranti (jika dikonfigurasi)
        try {
          if (globalScope.LocalPocketPreferenceSync) {
            globalScope.LocalPocketPreferenceSync.push(clone(cache));
          }
        } catch (e) {}
      });
    }, 600);
  }

  // ── Init / load ──────────────────────────────────────────────────────────────
  function loadProfile() {
    if (initPromise) return initPromise;
    initPromise = storeGet(STORAGE_KEY).then(function (stored) {
      var base = defaultProfile();
      if (stored && typeof stored === 'object') {
        cache = deepMerge(base, stored);
        cache.schemaVersion = SCHEMA_VERSION;
        return cache;
      }
      // Tiada profil tersimpan — cuba migrasi dari `settings` sedia ada (sekali).
      return storeGet('settings').then(function (s) {
        if (s && typeof s === 'object') {
          if (typeof s.summaryTone === 'string' && /^(neutral|formal|casual|educational)$/.test(s.summaryTone)) {
            base.defaultTone = s.summaryTone;
          }
          if (typeof s.summaryOutputLanguage === 'string' && s.summaryOutputLanguage.trim()) {
            base.defaultLanguage = s.summaryOutputLanguage.trim();
          }
          if (typeof s.summaryMode === 'string' && s.summaryMode.trim()) {
            base.defaultSummaryMode = s.summaryMode.trim();
          }
          base.migratedFromSettings = true;
        }
        cache = base;
        scheduleSave();
        return cache;
      });
    }).catch(function () {
      cache = defaultProfile();
      return cache;
    });
    return initPromise;
  }

  function ensureLoaded() {
    return cache ? Promise.resolve(cache) : loadProfile();
  }

  function getCachedProfile() {
    return cache || defaultProfile();
  }

  // ── Getters / setters ────────────────────────────────────────────────────────
  function getPreference(key) {
    var p = getCachedProfile();
    return (p && p[key] !== undefined) ? p[key] : undefined;
  }

  function setPreference(key, value) {
    var p = getCachedProfile();
    p[key] = value;
    cache = p;
    scheduleSave();
    return getCachedProfile();
  }

  // Layer 2 — learned preference khusus laman (penyimpanan counter)
  function recordSiteAction(url, action) {
    if (!url || !action) return;
    var host;
    try { host = new URL(url).hostname; } catch (e) { return; }
    if (!host) return;
    var p = getCachedProfile();
    var key = 'site:' + host;
    var rec = p.learnedPreferences[key] || { action: action, times: 0 };
    if (rec.action === action) rec.times += 1;
    else { rec.action = action; rec.times = 1; }
    p.learnedPreferences[key] = rec;
    cache = p;
    scheduleSave();
  }

  // Layer 4 — time-based habit
  function timePeriodForDate(date) {
    var h = (date ? new Date(date).getHours() : new Date().getHours());
    if (h >= 5 && h < 12) return 'pagi';
    if (h >= 12 && h < 19) return 'tengahari';
    return 'malam';
  }

  function recordTimeHabit(period, field, value) {
    if (!period || !field || !value) return;
    var p = getCachedProfile();
    var rec = p.timeHabits[period] || { tone: null, summaryMode: null, count: 0 };
    if (rec[field] === value) rec.count += 1;
    else { rec[field] = value; rec.count = 1; }
    p.timeHabits[period] = rec;
    cache = p;
    scheduleSave();
  }

  // ── Layer 6 — Graf pengetahuan fakta pengguna (JSON terstruktur) ────────────
  // Setiap fakta ialah pernyataan pendek & boleh bertindak tentang pengguna.
  var FACT_CATEGORIES = ['bahasa', 'pengaturcaraan', 'alat', 'preferensi', 'umum'];

  function _normalizeFactStatement(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function _factId() {
    return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // Tambah / gabung satu fakta. Jika pernyataan serupa (normalize) sudah wujud,
  // naikkan timesSeen + segar semula lastSeen (dan cadangkan confidence lebih tinggi).
  function addFact(statement, opts) {
    opts = opts || {};
    var norm = _normalizeFactStatement(statement);
    if (!norm || norm.length < 3) return null;
    var p = getCachedProfile();
    p.facts = Array.isArray(p.facts) ? p.facts : [];
    var cat = FACT_CATEGORIES.indexOf(opts.category) >= 0 ? opts.category : 'umum';
    var conf = (typeof opts.confidence === 'number' && opts.confidence > 0 && opts.confidence <= 1)
      ? opts.confidence : 0.6;
    var existing = null;
    for (var i = 0; i < p.facts.length; i++) {
      if (_normalizeFactStatement(p.facts[i].statement) === norm) { existing = p.facts[i]; break; }
    }
    var now = Date.now();
    if (existing) {
      existing.timesSeen = (existing.timesSeen || 0) + 1;
      existing.lastSeen = now;
      if (conf > (existing.confidence || 0)) existing.confidence = conf;
      if (opts.source) existing.source = opts.source;
    } else {
      existing = {
        id: _factId(),
        statement: String(statement).trim(),
        category: cat,
        confidence: conf,
        source: opts.source || 'chat',
        createdAt: now,
        lastSeen: now,
        timesSeen: 1
      };
      p.facts.push(existing);
    }
    cache = p;
    scheduleSave();
    return existing;
  }

  function getFacts(opts) {
    var p = getCachedProfile();
    var list = Array.isArray(p.facts) ? p.facts.slice() : [];
    if (opts && opts.category) {
      list = list.filter(function (f) { return f.category === opts.category; });
    }
    if (opts && opts.limit && opts.limit > 0) {
      list.sort(function (a, b) {
        return ((b.confidence || 0) * (b.timesSeen || 1)) - ((a.confidence || 0) * (a.timesSeen || 1));
      });
      list = list.slice(0, opts.limit);
    }
    return list;
  }

  function recordFactSeen(id) {
    if (!id) return;
    var p = getCachedProfile();
    if (!Array.isArray(p.facts)) return;
    for (var i = 0; i < p.facts.length; i++) {
      if (p.facts[i].id === id) {
        p.facts[i].lastSeen = Date.now();
        p.facts[i].timesSeen = (p.facts[i].timesSeen || 0) + 1;
        cache = p;
        scheduleSave();
        return;
      }
    }
  }

  function removeFact(id) {
    if (!id) return false;
    var p = getCachedProfile();
    if (!Array.isArray(p.facts)) return false;
    var before = p.facts.length;
    p.facts = p.facts.filter(function (f) { return f.id !== id; });
    if (p.facts.length !== before) { cache = p; scheduleSave(); return true; }
    return false;
  }

  // ── Layer 3 auto-learning (dipanggil dari jarvisCore setiap kali buat prompt)
  // Hanya promote default bila sesuatu nilai konsisten melepasi ambang.
  function recordUsage(opts) {
    if (!opts) return;
    var p = getCachedProfile();
    var changed = false;
    var period = timePeriodForDate();
    ['tone', 'summaryMode', 'outputLanguage'].forEach(function (field) {
      var mapKey = field === 'outputLanguage' ? 'language' : field;
      var val = opts[field];
      if (!val) return;
      var counts = p.usage[mapKey] || {};
      counts = (globalScope.LocalPocketPreferenceLearner)
        ? globalScope.LocalPocketPreferenceLearner.bump(counts, val)
        : (function () { counts[val] = (counts[val] || 0) + 1; return counts; })();
      p.usage[mapKey] = counts;
      // Auto-promote: nilai teratas konsisten >= ambang DAN berbeza dari default
      var defaultKey = 'default' + mapKey.charAt(0).toUpperCase() + mapKey.slice(1);
      var current = p[defaultKey];
      var promoted = (globalScope.LocalPocketPreferenceLearner)
        ? globalScope.LocalPocketPreferenceLearner.promoteDefault(counts, current)
        : null;
      if (promoted && promoted !== current) {
        p[defaultKey] = promoted;
        changed = true;
      }
      // Layer 4 — tabiat masa: rekod nada/mod ikut waktu (contoh: "malam = casual").
      if (field === 'tone' || field === 'summaryMode') {
        try { recordTimeHabit(period, field, val); } catch (e) {}
      }
    });
    if (changed) { cache = p; scheduleSave(); }
  }

  // ── Apply memory profile to prompt options (synchronous, guna cache) ────────
  // Mengembalikan { opts, instructions } di mana instructions ialah baris teks
  // BM yang disuntik ke dalam prompt JARVIS.
  var LANG_NAMES = {
    ms: 'Bahasa Melayu', en: 'English', id: 'Bahasa Indonesia',
    ar: 'Arabic', zh: 'Chinese', es: 'Spanish', fr: 'French',
    pt: 'Portuguese', hi: 'Hindi', ja: 'Japanese', ko: 'Korean',
    ru: 'Russian', de: 'German', it: 'Italian', vi: 'Vietnamese', th: 'Thai'
  };

  function applyToPrompt(opts, ctx) {
    var p = getCachedProfile();
    opts = opts || {};
    var instructions = [];

    // Layer 3 — default global
    if (!opts.outputLanguage && p.defaultLanguage) {
      opts.outputLanguage = p.defaultLanguage;
      instructions.push('Guna bahasa: ' + (LANG_NAMES[p.defaultLanguage] || p.defaultLanguage) + '.');
    } else if (opts.outputLanguage && LANG_NAMES[opts.outputLanguage]) {
      instructions.push('Guna bahasa: ' + LANG_NAMES[opts.outputLanguage] + '.');
    }
    if (!opts.tone && p.defaultTone) opts.tone = p.defaultTone;
    if (!opts.summaryMode && p.defaultSummaryMode && p.defaultSummaryMode !== 'auto') {
      opts.summaryMode = p.defaultSummaryMode;
    }

    // Layer 2 — learned site-specific action hints
    if (ctx && ctx.url) {
      var host = null;
      try { host = new URL(ctx.url).hostname; } catch (e) {}
      if (host) {
        var rec = p.learnedPreferences['site:' + host];
        if (rec && rec.times >= 3 && rec.action) {
          instructions.push(
            'INGATAN LAMAN: Pengguna selalu mahukan tindakan "' + rec.action +
            '" di laman ini (' + host + '). Tawarkan secara proaktif bila sesuai.'
          );
        }
      }
    }

    // Layer 4 — time-based habit
    var period = timePeriodForDate();
    var habit = p.timeHabits[period];
    if (habit && habit.count >= 3) {
      if (habit.tone && (!opts.tone || opts.tone === p.defaultTone)) {
        opts.tone = habit.tone;
      }
      if (habit.summaryMode && habit.summaryMode !== 'auto') {
        opts.summaryMode = habit.summaryMode;
      }
      instructions.push(
        'Tabiat masa (' + period + '): pengguna biasanya suka nada "' + habit.tone +
        '" dan mod ringkasan "' + habit.summaryMode + '".'
      );
    }

    // Layer 6 — Graf pengetahuan fakta pengguna (disuntik ke system prompt JARVIS)
    var facts = (p.facts && Array.isArray(p.facts)) ? p.facts : [];
    if (facts.length) {
      var topFacts = facts.slice().sort(function (a, b) {
        return ((b.confidence || 0) * (b.timesSeen || 1)) - ((a.confidence || 0) * (a.timesSeen || 1));
      }).slice(0, 8);
      var factLines = topFacts.map(function (f) { return '• ' + f.statement; });
      instructions.push(
        'FAKTA PENGGUNA (ingat & gunakan bila relevan, jangan ulang semula sebagai pengenalan):\n' +
        factLines.join('\n')
      );
    }

    return { opts: opts, instructions: instructions };
  }

  // ── Dashboard helpers ────────────────────────────────────────────────────────
  function summarizeProfile() {
    var p = getCachedProfile();
    var sites = Object.keys(p.learnedPreferences || {}).map(function (k) {
      return { scope: k, action: p.learnedPreferences[k].action, times: p.learnedPreferences[k].times };
    }).sort(function (a, b) { return b.times - a.times; });
    var habits = Object.keys(p.timeHabits || {}).map(function (k) {
      return { period: k, tone: p.timeHabits[k].tone, summaryMode: p.timeHabits[k].summaryMode, count: p.timeHabits[k].count };
    });
    return {
      defaultLanguage: p.defaultLanguage,
      defaultTone: p.defaultTone,
      defaultSummaryMode: p.defaultSummaryMode,
      autoSaveOnSummarize: p.autoSaveOnSummarize,
      defaultCategory: p.defaultCategory,
      proactiveLevel: p.proactiveLevel,
      voiceOutput: p.voiceOutput,
      learnedSites: sites,
      timeHabits: habits,
      factCount: (p.facts && Array.isArray(p.facts)) ? p.facts.length : 0,
      updatedAt: p.updatedAt
    };
  }

  function exportProfile() {
    return JSON.stringify(getCachedProfile(), null, 2);
  }

  function importProfile(json) {
    var parsed;
    try { parsed = typeof json === 'string' ? JSON.parse(json) : json; }
    catch (e) { return { ok: false, error: 'JSON tidak sah' }; }
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'Format tidak dikenali' };
    cache = deepMerge(defaultProfile(), parsed);
    cache.schemaVersion = SCHEMA_VERSION;
    scheduleSave();
    return { ok: true };
  }

  function resetMemory() {
    cache = defaultProfile();
    initPromise = null;
    return storeRemove(STORAGE_KEY).then(function () {
      // juga reset bayangan sync (jika ada)
      try { if (globalScope.LocalPocketPreferenceSync) globalScope.LocalPocketPreferenceSync.clear(); } catch (e) {}
      return true;
    });
  }

  var api_export = {
    STORAGE_KEY: STORAGE_KEY,
    defaultProfile: defaultProfile,
    init: loadProfile,
    ensureLoaded: ensureLoaded,
    getCachedProfile: getCachedProfile,
    getPreference: getPreference,
    setPreference: setPreference,
    recordSiteAction: recordSiteAction,
    recordTimeHabit: recordTimeHabit,
    addFact: addFact,
    getFacts: getFacts,
    recordFactSeen: recordFactSeen,
    removeFact: removeFact,
    recordUsage: recordUsage,
    timePeriodForDate: timePeriodForDate,
    applyToPrompt: applyToPrompt,
    summarizeProfile: summarizeProfile,
    exportProfile: exportProfile,
    importProfile: importProfile,
    resetMemory: resetMemory
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api_export;
  if (globalScope && typeof globalScope === 'object') globalScope.LocalPocketMemoryLayers = api_export;

})(typeof globalThis !== 'undefined' ? globalThis : this);
