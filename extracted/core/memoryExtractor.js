/**
 * Local Pocket Reader — JARVIS Memory Extractor (#5 Memori Jangka Panjang)
 *
 * Mengekstrak "fakta pengguna" daripada sejarah perbualan JARVIS dan menyimpannya
 * ke dalam graf pengetahuan berstruktur di LocalPocketMemoryLayers (field `facts`).
 *
 * Extractor berfungsi OFFLINE (heuristik berasaskan corak) supaya ia selalu
 * berfungsi tanpa bergantung kepada panggilan provider. Ia hanya memproses
 * mesej daripada pengguna (role === "user") supaya fakta AI sendiri tidak
 * tersalah-ekstrak.
 *
 * Modul ini attach ke `window.LocalPocketMemoryExtractor` dan boleh dipanggil
 * dari mana-mana konteks JARVIS (overlay / sidebar host). Ia menggunakan
 * `window.LocalPocketMemoryLayers` (core/memoryLayers.js) sebagai stor.
 */
(function (globalScope) {
  'use strict';

  var ML = (typeof globalScope !== 'undefined') ? globalScope.LocalPocketMemoryLayers : null;

  // Bahasa yang dikenali (untuk fakta "bahasa" yang lebih tepat).
  var KNOWN_LANGS = {
    melayu: 'Melayu', inggeris: 'Inggeris', english: 'Inggeris', indonesia: 'Indonesia',
    'bm': 'Melayu', 'bi': 'Indonesia', 'en': 'Inggeris', mandarin: 'Cina',
    cina: 'Cina', jepun: 'Jepun', korea: 'Korea'
  };
  // Bahasa pengaturcaraan yang dikenali.
  var KNOWN_CODE_LANGS = [
    'python', 'javascript', 'js', 'typescript', 'ts', 'java', 'c\\+\\+', 'cpp',
    'c#', 'csharp', 'go', 'golang', 'rust', 'php', 'ruby', 'swift', 'kotlin',
    'sql', 'html', 'css', 'bash', 'shell'
  ];
  var CODE_RE = new RegExp('\\b(' + KNOWN_CODE_LANGS.join('|') + ')\\b', 'i');
  // Alat/perisian yang dikenali.
  var KNOWN_TOOLS = [
    'vscode', 'visual studio code', 'visual studio', 'intellij', 'pycharm',
    'windows', 'mac', 'macos', 'linux', 'chrome', 'firefox', 'edge', 'safari',
    'vim', 'neovim', 'android studio', 'xcode', 'terminal', 'powershell'
  ];

  // ── Pembantu ────────────────────────────────────────────────────────────────
  function cleanText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  // Ekstrak satu fakta bahasa dari teks pengguna, atau null.
  function tryLanguage(text) {
    var m = text.match(/saya\s+(?:suka|mahu|nak|lebih\s+suka|biasa\s+(?:guna|pakai)|selalu\s+(?:guna|pakai))\s+(?:bercakap|berkomunikasi|jawab|balas|tulis|code|menggunakan|guna|pakai)\s+(?:dalam\s+)?(?:bahasa\s+)?([a-z]{2,})\b/i);
    if (m && KNOWN_LANGS[m[1].toLowerCase()]) {
      return { statement: 'Pengguna suka berkomunikasi dalam bahasa ' + KNOWN_LANGS[m[1].toLowerCase()] + '.', category: 'bahasa', confidence: 0.85 };
    }
    // "saya guna bahasa Melayu"
    var m2 = text.match(/bahasa\s+(melayu|inggeris|indonesia|cina|jepun|korea)/i);
    if (m2 && KNOWN_LANGS[m2[1].toLowerCase()]) {
      return { statement: 'Pengguna suka berkomunikasi dalam bahasa ' + KNOWN_LANGS[m2[1].toLowerCase()] + '.', category: 'bahasa', confidence: 0.85 };
    }
    return null;
  }

  function tryCode(text) {
    var m = text.match(CODE_RE);
    if (!m) return null;
    var lang = m[1].toLowerCase();
    var pretty = lang === 'js' ? 'JavaScript' : lang === 'ts' ? 'TypeScript'
      : lang === 'cpp' || lang === 'c\\+\\+' ? 'C++' : lang === 'csharp' ? 'C#'
      : lang === 'golang' ? 'Go' : lang.charAt(0).toUpperCase() + lang.slice(1);
    return { statement: 'Pengguna suka menulis kod dalam ' + pretty + '.', category: 'pengaturcaraan', confidence: 0.8 };
  }

  function tryTool(text) {
    for (var i = 0; i < KNOWN_TOOLS.length; i++) {
      var t = KNOWN_TOOLS[i];
      var re = new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (re.test(text)) {
        var pretty = t === 'vscode' ? 'VS Code' : t === 'macos' ? 'macOS'
          : t.charAt(0).toUpperCase() + t.slice(1);
        return { statement: 'Pengguna menggunakan ' + pretty + '.', category: 'alat', confidence: 0.75 };
      }
    }
    return null;
  }

  function tryTone(text) {
    var m = text.match(/(?:jawab|balas|nada|tone|style)\s+(?:secara\s+)?(formal|casual|santai|mesra|pendidikan|professional)/i);
    if (m) {
      var tone = m[1].toLowerCase();
      var label = tone === 'professional' ? 'formal' : tone;
      return { statement: 'Pengguna lebih suka jawapan bernada ' + label + '.', category: 'preferensi', confidence: 0.7 };
    }
    return null;
  }

  function tryGeneralPreference(text) {
    // "saya suka X", "saya benci X", "saya prefer X", "X kegemaran saya"
    var m = text.match(/^saya\s+(suka|benci|tak\s+suka|jarang|selalu|lebih\s+suka|prefer)\s+(.+)$/i);
    if (m) {
      var obj = cleanText(m[2]);
      if (obj.length >= 3 && obj.length <= 80) {
        var verb = m[1].toLowerCase().indexOf('benci') >= 0 || m[1].toLowerCase().indexOf('tak suka') >= 0
          ? 'tidak suka' : 'suka';
        return { statement: 'Pengguna ' + verb + ' ' + obj + '.', category: 'preferensi', confidence: 0.55 };
      }
    }
    return null;
  }

  // Senarai extractor yang cuba satu persatu pada setiap mesej pengguna.
  var EXTRACTORS = [tryLanguage, tryCode, tryTool, tryTone, tryGeneralPreference];

  /**
   * Ekstrak fakta calon dari SATU mesej pengguna.
   * @param {string} text
   * @returns {Array<{statement:string,category:string,confidence:number}>}
   */
  function extractFromMessage(text) {
    var t = cleanText(text);
    if (!t) return [];
    var out = [];
    for (var i = 0; i < EXTRACTORS.length; i++) {
      try {
        var f = EXTRACTORS[i](t);
        if (f && f.statement) out.push(f);
      } catch (e) {}
    }
    return out;
  }

  /**
   * Ekstrak fakta dari SELURUH sejarah perbualan (hanya mesej pengguna).
   * @param {Array<{role:string,text:string}>} history
   * @returns {Array<{statement:string,category:string,confidence:number}>}
   */
  function extractFactsFromHistory(history) {
    var found = [];
    if (!Array.isArray(history)) return found;
    for (var i = 0; i < history.length; i++) {
      var turn = history[i];
      if (!turn || turn.role !== 'user') continue;
      var fs = extractFromMessage(turn.text);
      for (var j = 0; j < fs.length; j++) found.push(fs[j]);
    }
    return found;
  }

  // ── Throttle ───────────────────────────────────────────────────────────────
  // Simpan masa ekstraksi terakhir supaya ia tak berlari setiap mesej.
  var _lastRunAt = 0;
  var MIN_INTERVAL_MS = 5 * 60 * 1000; // sekurang-kurangnya 5 minit antara larian
  var _lastHistoryLen = 0;
  var MIN_NEW_TURNS = 4;               // atau bila ada >=4 mesej pengguna baru

  function maybeRun(history, opts) {
    opts = opts || {};
    var now = Date.now();
    var userTurns = (Array.isArray(history) ? history : []).filter(function (t) { return t && t.role === 'user'; }).length;
    if (!opts.force) {
      if (now - _lastRunAt < MIN_INTERVAL_MS && (userTurns - _lastHistoryLen) < MIN_NEW_TURNS) {
        return Promise.resolve({ ran: false, reason: 'throttled', added: 0 });
      }
    }
    _lastRunAt = now;
    _lastHistoryLen = userTurns;
    return runExtraction(history, opts);
  }

  /**
   * Lari ekstraksi dan gabungkan fakta ke dalam memoryLayers.
   * @returns {Promise<{ran:boolean, added:number, facts:Array}>}
   */
  function runExtraction(history, opts) {
    opts = opts || {};
    var ml = (typeof globalScope !== 'undefined') ? globalScope.LocalPocketMemoryLayers : ML;
    if (!ml) return Promise.resolve({ ran: false, reason: 'no-memory-layers', added: 0 });
    var ensure = ml.ensureLoaded ? ml.ensureLoaded() : Promise.resolve();
    return Promise.resolve(ensure).then(function () {
      var candidates = extractFactsFromHistory(history);
      var added = 0;
      candidates.forEach(function (c) {
        try {
          var f = ml.addFact(c.statement, { category: c.category, confidence: c.confidence, source: 'chat' });
          if (f) added++;
        } catch (e) {}
      });
      return { ran: true, added: added, facts: ml.getFacts ? ml.getFacts({ limit: 50 }) : [] };
    });
  }

  /**
   * Bina prompt untuk ekstraksi BERASASKAN PROVIDER (otak JARVIS) — dipanggil
   * jika pengguna mahu ekstraksi yang lebih pintar. Fungsi ini hanya menyediakan
   * teks prompt; pemanggil bertanggungjawab menghantarnya ke provider dan
   * menghuraikan JSON yang dikembalikan, kemudian memanggil addFact().
   */
  function buildExtractionPrompt(history) {
    var lines = (Array.isArray(history) ? history : []).map(function (t) {
      return (t.role === 'user' ? 'Pengguna' : 'JARVIS') + ': ' + cleanText(t.text);
    }).slice(-20);
    return (
      'Anda ialah pembantu ekstrak fakta. Baca perbualan di bawah dan ekstrak ' +
      'FAKTA PENTING tentang pengguna (preferensi, bahasa, alat, bahasa ' +
      'pengaturcaraan, tabiat). Balas HANYA dengan array JSON: ' +
      '[{"statement":"<fakta pendek & boleh bertindak>","category":"<bahasa|pengaturcaraan|alat|preferensi|umum>","confidence":0.0-1.0}]. ' +
      'Jika tiada fakta, balas [].\n\nPerbualan:\n' + lines.join('\n')
    );
  }

  var api_export = {
    extractFromMessage: extractFromMessage,
    extractFactsFromHistory: extractFactsFromHistory,
    runExtraction: runExtraction,
    maybeRun: maybeRun,
    buildExtractionPrompt: buildExtractionPrompt,
    KNOWN_LANGS: KNOWN_LANGS,
    KNOWN_CODE_LANGS: KNOWN_CODE_LANGS,
    KNOWN_TOOLS: KNOWN_TOOLS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api_export;
  if (globalScope && typeof globalScope === 'object') globalScope.LocalPocketMemoryExtractor = api_export;

})(typeof globalThis !== 'undefined' ? globalThis : this);
