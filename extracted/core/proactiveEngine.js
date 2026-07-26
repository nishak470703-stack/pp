/**
 * Local Pocket Reader — JARVIS Proactive Engine (#3 Proactive Agent)
 *
 * Enjin pencetus cadangan proaktif: JARVIS memerhati konteks halaman dan
 * MENAWARKAN bantuan sebelum diminta — tanpa mengganggu (dipaparkan melalui
 * lencana kecil, lihat proactiveIndicator.js).
 *
 * Ciri:
 *   • Senarai pencetus (triggers) terbina-dalam: artikel panjang, halaman ralat,
 *     borang panjang, YouTube, topik dalam library.
 *   • Cooldown per-trigger + jurang minimum global supaya tidak menyampah.
 *   • proactiveLevel (0–5) dari Memory (#6) mengawal kekerapan/ambang keyakinan.
 *   • Pembelajaran corak: jejak terima/tolak setiap trigger; jika kerap ditolak,
 *     trigger itu disenyapkan (self-suppress). Disimpan ke Memory Layers.
 *
 * Modul TULEN (tiada UI, tiada DOM). Attach ke `window.LocalPocketProactiveEngine`.
 * Guna style sedia ada (var / function expressions) untuk konsisten.
 */
(function (globalScope) {
  "use strict";

  // ── Ambang boleh laras ───────────────────────────────────────────────────────
  // Artikel dianggap "panjang" bila ~5 minit bacaan (plan #3.1). Guna
  // readingMinutes (dikira dari wordCount) supaya konsisten merentas bahasa.
  var LONG_ARTICLE_MINUTES = 5;      // >= 5 min baca
  var LONG_ARTICLE_WORDS = 700;      // sekurang-kurangnya ~700 patah perkataan
  var FORM_MIN_FIELDS = 6;           // borang "panjang" = >= 6 medan input
  var WORDS_PER_MINUTE = 200;        // anggaran kelajuan bacaan
  var GLOBAL_MIN_GAP = 45000;        // jurang minimum antara MANA-MANA cadangan (ms)
  var SUPPRESS_MIN_SAMPLES = 3;      // sampel minimum sebelum boleh senyap
  var SUPPRESS_REJECT_RATE = 0.7;    // >=70% tolak → senyapkan trigger

  var STATS_KEY = "proactiveStats";  // disimpan dalam profil Memory Layers

  // ── Keadaan runtime (dalam-memori) ───────────────────────────────────────────
  var lastFired = {};   // id -> timestamp cadangan terakhir dipapar
  var lastAnyShown = 0;  // timestamp mana-mana cadangan terakhir (jurang global)
  var statsCache = null; // { id: { shown, accepted, rejected } }

  function memory() {
    return (globalScope && globalScope.LocalPocketMemoryLayers) || null;
  }

  // proactiveLevel: 0 (mati) hingga 5 (sangat proaktif). Lalai 3.
  function proactiveLevel() {
    var ml = memory();
    var lvl = 3;
    try {
      if (ml && typeof ml.getPreference === "function") {
        var v = ml.getPreference("proactiveLevel");
        if (typeof v === "number") lvl = v;
      }
    } catch (e) {}
    if (lvl < 0) lvl = 0;
    if (lvl > 5) lvl = 5;
    return lvl;
  }

  // Ambang keyakinan mengikut tahap: makin proaktif, makin rendah ambang.
  function minConfidenceForLevel(level) {
    if (level <= 0) return 999;      // mati
    if (level >= 4) return 0.5;      // sangat proaktif
    if (level === 3) return 0.7;     // lalai
    return 0.85;                     // 1–2: hanya cadangan yakin-tinggi
  }

  // Cooldown didarab bila tahap rendah (kurang kerap) & dibahagi bila tinggi.
  function cooldownFactor(level) {
    if (level >= 5) return 0.5;
    if (level >= 4) return 0.75;
    if (level === 3) return 1;
    if (level === 2) return 1.5;
    return 2;
  }

  // ── Statistik pembelajaran ───────────────────────────────────────────────────
  function ensureStats() {
    if (statsCache) return statsCache;
    var ml = memory();
    var loaded = null;
    try {
      if (ml && typeof ml.getPreference === "function") loaded = ml.getPreference(STATS_KEY);
    } catch (e) {}
    statsCache = (loaded && typeof loaded === "object") ? loaded : {};
    return statsCache;
  }

  function statFor(id) {
    var s = ensureStats();
    if (!s[id]) s[id] = { shown: 0, accepted: 0, rejected: 0 };
    return s[id];
  }

  function persistStats() {
    var ml = memory();
    try {
      if (ml && typeof ml.setPreference === "function") ml.setPreference(STATS_KEY, ensureStats());
    } catch (e) {}
  }

  // Trigger disenyapkan bila kadar tolak melepasi ambang selepas cukup sampel.
  function isSuppressed(id) {
    var s = statFor(id);
    var total = s.accepted + s.rejected;
    if (total < SUPPRESS_MIN_SAMPLES) return false;
    return (s.rejected / total) >= SUPPRESS_REJECT_RATE;
  }

  // ── Normalisasi konteks halaman ──────────────────────────────────────────────
  function hostOf(url) {
    try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ""; }
  }

  function isYoutubeWatch(url) {
    var h = hostOf(url);
    if (!h) return false;
    if (h === "youtu.be" || h.indexOf("youtu.be") >= 0) return true;
    if (h.indexOf("youtube.com") >= 0) {
      try { return new URL(url).pathname.indexOf("/watch") === 0; } catch (e) { return false; }
    }
    return false;
  }

  // Kesan halaman ralat: guna status HTTP jika diberi, atau heuristik teks/tajuk.
  function looksLikeErrorPage(raw) {
    if (raw && typeof raw.status === "number" && (raw.status >= 400)) return true;
    var title = String((raw && raw.title) || "").toLowerCase();
    var text = String((raw && raw.text) || "");
    // Corak kuat pada tajuk (elak positif palsu pada artikel biasa).
    if (/\b(404|500|502|503)\b/.test(title)) return true;
    if (/page not found|not found|tidak dijumpai|halaman tidak ditemui|server error|ralat pelayan/.test(title)) {
      // Halaman ralat biasanya pendek — elak artikel yg kebetulan sebut "not found".
      if (text.length < 1500) return true;
    }
    return false;
  }

  // Bina objek konteks berstruktur dari data mentah + petunjuk pemanggil.
  function buildContext(raw, opts) {
    raw = raw || {};
    opts = opts || {};
    var text = String(raw.text || "");
    var words = text ? (text.trim().match(/\S+/g) || []).length : 0;
    var readingMinutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
    return {
      url: raw.url || "",
      title: raw.title || "",
      text: text,
      host: hostOf(raw.url || ""),
      wordCount: words,
      readingMinutes: readingMinutes,
      isYoutube: isYoutubeWatch(raw.url || ""),
      isErrorPage: looksLikeErrorPage(raw),
      formFieldCount: (typeof opts.formFieldCount === "number") ? opts.formFieldCount : 0,
      libraryMatches: (typeof opts.libraryMatches === "number") ? opts.libraryMatches : 0
    };
  }

  // ── Pencetus terbina-dalam ───────────────────────────────────────────────────
  var TRIGGERS = [
    {
      id: "summarize_long",
      action: "suggest_summarize",
      confidence: 0.8,
      cooldown: 60000,
      match: function (ctx) {
        return !ctx.isYoutube && !ctx.isErrorPage &&
          ctx.wordCount >= LONG_ARTICLE_WORDS &&
          ctx.readingMinutes >= LONG_ARTICLE_MINUTES;
      },
      message: function (ctx) {
        return "Artikel ni agak panjang (~" + ctx.readingMinutes +
          " min baca). Nak saya ringkaskan atau simpan ke library?";
      },
      acceptLabel: "Ringkaskan"
    },
    {
      id: "youtube_offer",
      action: "suggest_youtube",
      confidence: 0.75,
      cooldown: 60000,
      match: function (ctx) { return ctx.isYoutube; },
      message: function () {
        return "Video YouTube dikesan. Nak saya salin transkrip atau ringkaskan kandungannya?";
      },
      acceptLabel: "Ringkaskan video"
    },
    {
      id: "error_page",
      action: "suggest_wayback",
      confidence: 0.9,
      cooldown: 30000,
      match: function (ctx) { return ctx.isErrorPage; },
      message: function () {
        return "Halaman ni nampak macam ralat. Nak saya cuba buka versi arkib (Wayback Machine)?";
      },
      acceptLabel: "Buka arkib"
    },
    {
      id: "form_autofill",
      action: "suggest_autofill",
      confidence: 0.6,
      cooldown: 90000,
      match: function (ctx) {
        return !ctx.isErrorPage && ctx.formFieldCount >= FORM_MIN_FIELDS;
      },
      message: function (ctx) {
        return "Borang panjang dikesan (" + ctx.formFieldCount +
          " medan). Nak saya bantu isi maklumat tersimpan?";
      },
      acceptLabel: "Bantu isi"
    },
    {
      id: "library_related",
      action: "suggest_library",
      confidence: 0.65,
      cooldown: 120000,
      match: function (ctx) { return ctx.libraryMatches >= 2; },
      message: function (ctx) {
        return "Ada " + ctx.libraryMatches +
          " simpanan berkaitan topik ni dalam library. Nak tengok?";
      },
      acceptLabel: "Tengok simpanan"
    }
  ];

  function findTrigger(id) {
    for (var i = 0; i < TRIGGERS.length; i++) if (TRIGGERS[i].id === id) return TRIGGERS[i];
    return null;
  }

  function registerTrigger(t) {
    if (!t || !t.id || typeof t.match !== "function") return false;
    var existing = findTrigger(t.id);
    if (existing) {
      for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k)) existing[k] = t[k];
    } else {
      TRIGGERS.push(t);
    }
    return true;
  }

  // ── Penilaian utama ──────────────────────────────────────────────────────────
  // Pulangkan cadangan terbaik (objek) atau null. TIDAK menandakan "shown" —
  // pemanggil mesti panggil noteShown() bila cadangan benar-benar dipaparkan.
  function evaluate(raw, opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    var level = proactiveLevel();
    if (level <= 0) return null;

    // Jurang global: jangan tunjuk cadangan lain terlalu rapat.
    if (now - lastAnyShown < GLOBAL_MIN_GAP) return null;

    var ctx = buildContext(raw, opts);
    var minConf = minConfidenceForLevel(level);
    var factor = cooldownFactor(level);

    var best = null;
    for (var i = 0; i < TRIGGERS.length; i++) {
      var t = TRIGGERS[i];
      if (t.confidence < minConf) continue;
      if (isSuppressed(t.id)) continue;
      var cd = (t.cooldown || 60000) * factor;
      if (lastFired[t.id] && (now - lastFired[t.id]) < cd) continue;
      var ok = false;
      try { ok = !!t.match(ctx); } catch (e) { ok = false; }
      if (!ok) continue;
      if (!best || t.confidence > best.trigger.confidence) {
        best = { trigger: t, ctx: ctx };
      }
    }
    if (!best) return null;

    var msg = "";
    try { msg = best.trigger.message(best.ctx); } catch (e) { msg = ""; }
    return {
      id: best.trigger.id,
      action: best.trigger.action,
      message: msg,
      acceptLabel: best.trigger.acceptLabel || "Ya",
      confidence: best.trigger.confidence,
      ctx: best.ctx
    };
  }

  // Tandakan cadangan telah dipaparkan (mula cooldown + kira 'shown').
  function noteShown(id, now) {
    now = now || Date.now();
    lastFired[id] = now;
    lastAnyShown = now;
    var s = statFor(id);
    s.shown += 1;
    persistStats();
  }

  // Rekod maklum balas pengguna untuk pembelajaran corak (#3.3).
  function recordFeedback(id, accepted) {
    var s = statFor(id);
    if (accepted) s.accepted += 1; else s.rejected += 1;
    persistStats();
    return s;
  }

  // Ringkasan statistik untuk papan pemuka / debug.
  function getStats() {
    var s = ensureStats();
    try { return JSON.parse(JSON.stringify(s)); } catch (e) { return {}; }
  }

  function resetStats() {
    statsCache = {};
    lastFired = {};
    lastAnyShown = 0;
    persistStats();
  }

  var api_export = {
    // pemalar
    LONG_ARTICLE_MINUTES: LONG_ARTICLE_MINUTES,
    FORM_MIN_FIELDS: FORM_MIN_FIELDS,
    GLOBAL_MIN_GAP: GLOBAL_MIN_GAP,
    TRIGGERS: TRIGGERS,
    // API
    buildContext: buildContext,
    evaluate: evaluate,
    noteShown: noteShown,
    recordFeedback: recordFeedback,
    registerTrigger: registerTrigger,
    isSuppressed: isSuppressed,
    proactiveLevel: proactiveLevel,
    getStats: getStats,
    resetStats: resetStats
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api_export;
  if (globalScope && typeof globalScope === "object") globalScope.LocalPocketProactiveEngine = api_export;

})(typeof globalThis !== "undefined" ? globalThis : this);
