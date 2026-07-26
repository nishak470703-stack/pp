/*
 * JARVIS Automation Studio — Macro Engine (#5.1)
 *
 * Enjin pelaksanaan makro (format JSON block). Enjin INI TIDAK TAHU cara
 * melaksanakan setiap tindakan secara konkrit — ia memanggil `handlers`
 * yang disediakan oleh konteks pemanggil (sidebar / background). Ini menjadikan
 * enjin boleh diuji & boleh digunakan semula merentas konteks.
 *
 * Schema makro:
 * {
 *   id, name, enabled,
 *   trigger: { type: "manual"|"time"|"tab"|"shortcut", ... },
 *   blocks: [
 *     { type:"action", action:"open_url", params:{ target:"https://..." } },
 *     { type:"wait", ms:3000 },
 *     { type:"condition", when:{ field:"url", op:"contains", value:"youtube" },
 *        then:[...], else:[...] },
 *     { type:"loop", times:5, do:[...] },
 *     { type:"call", macro:"Nama Lain" }
 *   ]
 * }
 *
 * Gaya ES5 (var, function expression) — serasi content script & background.
 */
(function () {
  "use strict";

  var api = (typeof browser !== "undefined") ? browser
    : (typeof chrome !== "undefined" ? chrome : null);

  // Katalog tindakan JARVIS yang boleh disusun dalam studio.
  // `params`: [{ name, label, type:"text"|"number"|"select", options?, default? }]
  // type "select" memerlukan `options` = [{ value, label }].
  var ACTION_CATALOG = [
    { id: "open_url", label: "Buka URL (tab baru)", category: "Navigation",
      desc: "Buka pautan dalam tab baharu.",
      params: [{ name: "target", label: "URL", type: "text", default: "https://" }] },
    { id: "navigate", label: "Pergi ke URL (tab ini)", category: "Navigation",
      desc: "Navigasi tab semasa ke URL.",
      params: [{ name: "target", label: "URL", type: "text", default: "https://" }] },
    { id: "new_tab", label: "Tab baharu kosong", category: "Navigation", desc: "Buka tab baharu.",
      params: [] },
    { id: "close_tab", label: "Tutup tab", category: "Navigation", desc: "Tutup tab aktif.",
      params: [] },
    { id: "close_all_tabs", label: "Tutup semua tab lain", category: "Navigation",
      desc: "Tutup semua tab kecuali semasa.", params: [],
      risk: "confirm" },
    { id: "reload", label: "Muat semula", category: "Navigation", desc: "Reload tab.",
      params: [] },
    { id: "back", label: "Undur", category: "Navigation", desc: "History back.", params: [] },
    { id: "forward", label: "Maju", category: "Navigation", desc: "History forward.", params: [] },
    { id: "duplicate_tab", label: "Pendua tab", category: "Navigation", desc: "Duplicate tab.",
      params: [] },
    { id: "bookmark", label: "Penanda buku", category: "Navigation", desc: "Bookmark page.",
      params: [] },
    { id: "print_page", label: "Cetak halaman", category: "Navigation", desc: "Print page.",
      params: [] },
    { id: "zoom", label: "Zum", category: "Navigation",
      desc: "Zum masuk/keluar.",
      params: [{ name: "direction", label: "Arah", type: "select",
        options: [{ value: "in", label: "Masuk" }, { value: "out", label: "Keluar" }], default: "in" }] },

    { id: "save", label: "Simpan halaman", category: "JARVIS",
      desc: "Simpan halaman semasa ke Local Pocket.", params: [] },
    { id: "summarize", label: "Ringkaskan halaman", category: "JARVIS",
      desc: "Minta JARVIS ringkaskan halaman.", params: [] },
    { id: "ask", label: "Tanya JARVIS (teks)", category: "JARVIS",
      desc: "Hantar soalan/arahan kepada JARVIS.",
      params: [{ name: "text", label: "Teks", type: "text", default: "" }] },
    { id: "summarize_selection", label: "Ringkas pilihan", category: "JARVIS",
      desc: "Ringkaskan teks terpilih.",
      params: [{ name: "query", label: "Soalan (pilihan)", type: "text", default: "" }] },
    { id: "translate_selection", label: "Terjemah pilihan", category: "JARVIS",
      desc: "Terjemah teks terpilih.",
      params: [{ name: "query", label: "Bahasa sasaran", type: "text", default: "English" }] },
    { id: "copy_url", label: "Salin URL", category: "JARVIS", desc: "Salin URL halaman.",
      params: [] },
    { id: "copy_answer", label: "Salin jawapan", category: "JARVIS",
      desc: "Salin jawapan JARVIS terakhir.", params: [] },

    { id: "click", label: "Klik elemen", category: "Halaman",
      desc: "Klik butang/pautan mengikut teks.",
      params: [
        { name: "target", label: "Teks / pemilih", type: "text", default: "" },
        { name: "index", label: "Indeks (0=pertama)", type: "number", default: 0 }
      ] },
    { id: "click_first_link", label: "Klik pautan pertama", category: "Halaman",
      desc: "Buka pautan pertama di halaman.", params: [] },
    { id: "fill", label: "Isi borang", category: "Halaman",
      desc: "Isi medan borang mengikut label.",
      params: [
        { name: "field", label: "Label medan", type: "text", default: "" },
        { name: "value", label: "Nilai", type: "text", default: "" },
        { name: "index", label: "Indeks", type: "number", default: 0 }
      ] },
    { id: "scroll", label: "Skrol", category: "Halaman",
      desc: "Skrol ke atas/bawah.",
      params: [{ name: "direction", label: "Arah", type: "select",
        options: [{ value: "down", label: "Bawah" }, { value: "up", label: "Atas" }], default: "down" }] }
  ];

  var ACTION_INDEX = {};
  ACTION_CATALOG.forEach(function (a) { ACTION_INDEX[a.id] = a; });

  var TRIGGER_TYPES = [
    { id: "manual", label: "Manual (buka dari studio / arahan)" },
    { id: "time", label: "Mengikut masa (jadual)" },
    { id: "tab", label: "Bila buka halaman (URL sepadan)" },
    { id: "shortcut", label: "Pintasan JARVIS (sebut nama makro)" }
  ];

  // Penjelasan "when" untuk log.
  function describeWhen(when) {
    if (!when || !when.field) return "?";
    return when.field + " " + (when.op || "contains") + " \"" + (when.value != null ? when.value : "") + "\"";
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, Math.max(0, Math.min(ms || 0, 600000))); });
  }

  // Nilaikan condition.when terhadap konteks halaman (url/title/text/host).
  function evalWhen(when, ctx) {
    if (!when || !when.field) return false;
    var page = (ctx && ctx.page) || {};
    var val = String(page[when.field] != null ? page[when.field] : "");
    var target = when.value != null ? String(when.value) : "";
    var op = when.op || "contains";
    switch (op) {
      case "equals": return val === target;
      case "startsWith": return target.length > 0 && val.indexOf(target) === 0;
      case "endsWith": return target.length > 0 && val.length >= target.length &&
        val.lastIndexOf(target) === val.length - target.length;
      case "notContains": return val.indexOf(target) === -1;
      case "matches":
        try { return new RegExp(target).test(val); } catch (e) { return false; }
      case "contains":
      default: return val.indexOf(target) !== -1;
    }
  }

  // Jalankan senarai blok secara berurutan (satu demi satu, async).
  function runBlocks(blocks, runOne) {
    return new Promise(function (resolve, reject) {
      var i = 0;
      function next() {
        if (i >= blocks.length) { resolve(); return; }
        var block = blocks[i++];
        Promise.resolve()
          .then(function () { return runOne(block); })
          .then(next)
          .catch(function (err) {
            // Abort isenginesan: biarkan naik tanpa log ralat.
            if (err && err.__abort) { reject(err); return; }
            // Ralat langkah tunggal TAK menghentikan rantai (berdaya tahan).
            runOne.__log && runOne.__log("⚠ Ralat langkah: " + (err && err.message ? err.message : err));
            next();
          });
      }
      next();
    });
  }

  /*
   * runMacro(macro, opts)
   * opts:
   *   handlers   — { actionId: fn(params, ctx) } dipanggil untuk setiap action.
   *                Handler boleh return Promise atau nilai; nilai "ask"/"chat"
   *                dikendalikan oleh handler "ask" jika ada.
   *   getContext — fn() -> { url, title, text, host }  (konteks halaman semasa)
   *   log        — fn(string) untuk makluman kemajuan.
   *   resolveMacro — fn(name) -> makro (untuk blok "call").
   *   signal     — { aborted:bool } untuk batalkan.
   * Returns: Promise.
   */
  function runMacro(macro, opts) {
    opts = opts || {};
    var handlers = opts.handlers || {};
    var getContext = opts.getContext || function () { return {}; };
    var log = opts.log || function () {};
    var signal = opts.signal || null;

    var ctx = { page: {}, vars: {}, loopIndex: 0, macro: macro };
    try { ctx.page = getContext() || {}; } catch (e) { ctx.page = {}; }

    function checkAbort() {
      if (signal && signal.aborted) throw { __abort: true, message: "Dibatalkan" };
    }

    function resolveActionHandler(block) {
      var act = block.action;
      if (handlers[act]) return { fn: handlers[act], chat: false };
      if ((act === "ask" || act === "chat") && handlers.ask) return { fn: handlers.ask, chat: true };
      return null;
    }

    function runOne(block) {
      if (!block || !block.type) { log("⚠ Langkah diabaikan (tiada jenis)."); return; }
      if (block.type === "wait") {
        var ms = Number(block.ms) || 0;
        log("⏱ Tunggu " + ms + "ms");
        return delay(ms);
      }
      if (block.type === "action") {
        var h = resolveActionHandler(block);
        var params = block.params || {};
        if (!h) {
          log("⚠ Tiada handler untuk tindakan \"" + block.action + "\" — dilangkau.");
          return;
        }
        var label = block.action + (params && (params.target || params.text || params.query)
          ? ": " + (params.target || params.text || params.query) : "");
        log("▶ " + label);
        var r = h.fn(params, ctx, block);
        return (r && typeof r.then === "function") ? r : Promise.resolve(r);
      }
      if (block.type === "condition") {
        var met = evalWhen(block.when || {}, ctx);
        log("❓ Jika " + describeWhen(block.when) + " → " + (met ? "YA" : "TIDAK"));
        return runBlocks((met ? block.then : block.else) || [], runOne);
      }
      if (block.type === "loop") {
        var n = Math.max(1, Math.min(Number(block.times) || 1, 1000));
        log("🔁 Ulang " + n + "×");
        var seq = Promise.resolve();
        for (var k = 0; k < n; k++) {
          (function (ki) {
            seq = seq.then(function () {
              checkAbort();
              ctx.loopIndex = ki;
              ctx.vars.loopIndex = ki;
              return runBlocks(block.do || [], runOne);
            });
          })(k);
        }
        return seq;
      }
      if (block.type === "call") {
        if (typeof opts.resolveMacro !== "function") {
          log("⚠ call memerlukan resolveMacro — dilangkau.");
          return;
        }
        var sub = opts.resolveMacro(block.macro);
        if (!sub) { log("⚠ Makro \"" + block.macro + "\" tak dijumpai."); return; }
        log("📞 Panggil makro \"" + block.macro + "\"");
        return runMacro(sub, opts);
      }
      log("⚠ Jenis blok tidak dikenali: " + block.type);
    }
    runOne.__log = log;

    var blocks = (macro && macro.blocks) || [];
    log("▶▶ Mula makro \"" + (macro && macro.name || "?") + "\" (" + blocks.length + " blok)");
    return runBlocks(blocks, runOne).then(function () {
      log("✅ Selesai makro \"" + (macro && macro.name || "?") + "\"");
    });
  }

  window.LocalPocketMacroEngine = {
    runMacro: runMacro,
    ACTION_CATALOG: ACTION_CATALOG,
    ACTION_INDEX: ACTION_INDEX,
    TRIGGER_TYPES: TRIGGER_TYPES,
    evalWhen: evalWhen,
    describeWhen: describeWhen
  };
})();
