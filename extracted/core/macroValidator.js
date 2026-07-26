/*
 * JARVIS Automation Studio — Macro Validator (#5.4)
 *
 * Modul pengesahan rantai makro (JSON block format). Bertanggungjawab:
 *   - Validasi struktur makro sebelum disimpan / dijalankan.
 *   - Pengesanan kitaran (cycle detection) merentas makro yang saling panggil
 *     (action "call" -> makro lain).
 *   - Klasifikasi langkah (step classification) supaya enjin & UI tahu jenis
 *     setiap blok (action/wait/condition/loop/call/chat).
 *
 * Gaya: ES5 (var, function expression) supaya serasi dengan baki kod JARVIS
 * dan boleh dimuatkan di kedua-dua konteks content script (sidebar) dan
 * background. Tiada dependencies luar; hanya guna `window`.
 */
(function () {
  "use strict";

  var api = (typeof browser !== "undefined") ? browser
    : (typeof chrome !== "undefined" ? chrome : null);

  // Senarai blok sah (selain "action" yang disahkan oleh katalog enjin).
  var STRUCTURAL_TYPES = ["action", "wait", "condition", "loop", "call"];

  // Operasi "when" yang disokong untuk condition (selamat, tiada eval()).
  var CONDITION_OPS = ["contains", "equals", "startsWith", "endsWith", "matches", "notContains"];

  function isObject(v) { return v && typeof v === "object" && !Array.isArray(v); }
  function isNonEmptyString(v) { return typeof v === "string" && v.length > 0; }

  // Klasifikasi satu blok kepada "kind" mesra-manusia.
  function classify(block) {
    if (!isObject(block)) return { kind: "invalid", reason: "bukan objek blok" };
    var t = block.type;
    if (t === "wait") return { kind: "wait", label: "Tunggu " + (block.ms || 0) + "ms" };
    if (t === "condition") return { kind: "condition", label: "Jika " + describeWhen(block.when) };
    if (t === "loop") return { kind: "loop", label: "Ulang " + (block.times || 0) + "×" };
    if (t === "call") return { kind: "call", label: "Panggil makro \"" + (block.macro || "") + "\"" };
    if (t === "action") {
      var a = block.action || "?";
      if (a === "ask" || a === "chat") return { kind: "chat", label: "Tanya AI: " + summarizeParams(block.params) };
      return { kind: "action", label: a + " " + summarizeParams(block.params) };
    }
    return { kind: "unknown", label: String(t || "?" ) };
  }

  function summarizeParams(params) {
    if (!isObject(params)) return "";
    var parts = [];
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      if (typeof v === "string" && v.length > 40) v = v.slice(0, 37) + "…";
      parts.push(k + "=" + v);
    });
    return parts.length ? "(" + parts.join(", ") + ")" : "";
  }

  function describeWhen(when) {
    if (!isObject(when)) return "?";
    var field = when.field || "url";
    var op = when.op || "contains";
    var val = when.value != null ? String(when.value) : "";
    return field + " " + op + " \"" + val + "\"";
  }

  // Sahkan satu blok tunggal. `catalog` = set id action yang sah
  // (daripada LocalPocketMacroEngine.ACTION_CATALOG).
  function validateBlock(block, catalog, path) {
    path = path || "blocks";
    var errors = [];
    var warnings = [];
    if (!isObject(block)) {
      errors.push(path + ": blok bukan objek.");
      return { ok: false, errors: errors, warnings: warnings };
    }
    var t = block.type;
    if (STRUCTURAL_TYPES.indexOf(t) === -1) {
      errors.push(path + ": jenis blok tidak dikenali \"" + t + "\".");
      return { ok: false, errors: errors, warnings: warnings };
    }
    if (t === "action") {
      var act = block.action;
      if (!isNonEmptyString(act)) {
        errors.push(path + ": action memerlukan \"action\" (id tindakan).");
      } else if (catalog && catalog[act] === undefined) {
        // Bukan action berdaftar — layan sebagai "chat" (soalan AI) supaya tak
        // pecah rantai, tetapi amarkan.
        warnings.push(path + ": action \"" + act + "\" tiada dalam katalog — akan dihantar sebagai soalan AI.");
      }
      if (!isObject(block.params)) block.params = {};
    } else if (t === "wait") {
      var ms = Number(block.ms);
      if (!isFinite(ms) || ms < 0) {
        errors.push(path + ": wait.ms mesti nombor ≥ 0.");
      } else if (ms > 600000) {
        warnings.push(path + ": wait.ms sangat panjang (" + ms + "ms).");
      }
    } else if (t === "condition") {
      if (!isObject(block.when) || !block.when.field || CONDITION_OPS.indexOf(block.when.op) === -1) {
        errors.push(path + ": condition.when mesti { field, op, value } dengan op sah.");
      }
      if (!Array.isArray(block.then)) {
        warnings.push(path + ": condition.then bukan array — tiada langkah dijalankan bila benar.");
      }
      if (block.else != null && !Array.isArray(block.else)) {
        warnings.push(path + ": condition.else bukan array.");
      }
    } else if (t === "loop") {
      var n = Number(block.times);
      if (!isFinite(n) || n < 1) {
        errors.push(path + ": loop.times mesti integer ≥ 1.");
      } else if (n > 100) {
        warnings.push(path + ": loop.times besar (" + n + ") — risiko berat.");
      }
      if (!Array.isArray(block.do)) {
        errors.push(path + ": loop.do mesti array blok.");
      }
    } else if (t === "call") {
      if (!isNonEmptyString(block.macro)) {
        errors.push(path + ": call.macro memerlukan nama makro.");
      }
    }
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  // Sahkan keseluruhan makro. `allMacros` (optional) = array makro lain untuk
  // pengesanan kitaran merentas-makro (call).
  function validate(macro, opts) {
    opts = opts || {};
    var catalog = opts.catalog || (window.LocalPocketMacroEngine && window.LocalPocketMacroEngine.ACTION_INDEX) || {};
    var errors = [];
    var warnings = [];
    var steps = [];

    if (!isObject(macro)) {
      return { ok: false, errors: ["Makro bukan objek."], warnings: [], steps: [], cyclic: false, cyclePath: null };
    }
    if (!isNonEmptyString(macro.name)) {
      errors.push("Makro memerlukan \"name\" (string tidak kosong).");
    }
    if (macro.enabled != null && typeof macro.enabled !== "boolean") {
      warnings.push("\"enabled\" bukan boolean — akan dianggap true.");
    }
    if (!Array.isArray(macro.blocks) || macro.blocks.length === 0) {
      errors.push("Makro memerlukan \"blocks\" (array ≥ 1 blok).");
    }

    // Kumpul langkah (dengan nested) untuk laporan & klasifikasi.
    var flatIndex = 0;
    function walk(blocks, path) {
      if (!Array.isArray(blocks)) return;
      blocks.forEach(function (b, i) {
        var p = path + "[" + i + "]";
        var cls = classify(b);
        steps.push({ index: flatIndex++, path: p, block: b, kind: cls.kind, label: cls.label });
        var r = validateBlock(b, catalog, p);
        r.errors.forEach(function (e) { errors.push(e); });
        r.warnings.forEach(function (w) { warnings.push(w); });
        if (b.type === "condition") {
          walk(b.then, p + ".then");
          walk(b.else, p + ".else");
        } else if (b.type === "loop") {
          walk(b.do, p + ".do");
        }
      });
    }
    if (Array.isArray(macro.blocks)) walk(macro.blocks, "blocks");

    // Pengesanan kitaran (call -> makro lain).
    var cycle = detectCycle(macro, opts.allMacros);
    if (cycle.cyclic) {
      errors.push("Dikesan kitaran makro: " + cycle.path.join(" → "));
    }

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      steps: steps,
      cyclic: cycle.cyclic,
      cyclePath: cycle.path
    };
  }

  // Bina graf panggilan: makro ini -> setiap makro dirujuk oleh blok "call".
  // `allMacros` = array makro (termasuk makro ini) untuk selesaikan nama->id.
  function detectCycle(macro, allMacros) {
    if (!isObject(macro)) return { cyclic: false, path: null };
    var byName = {};
    if (Array.isArray(allMacros)) {
      allMacros.forEach(function (m) { if (m && m.name) byName[m.name] = m; });
    }
    var selfName = macro.name;

    // Kumpul nama makro yang dipanggil terus oleh `macro`.
    function calledNames(m) {
      var names = [];
      function walk(blocks) {
        if (!Array.isArray(blocks)) return;
        blocks.forEach(function (b) {
          if (b && b.type === "call" && isNonEmptyString(b.macro)) names.push(b.macro);
          if (b && b.type === "condition") { walk(b.then); walk(b.else); }
          if (b && b.type === "loop") walk(b.do);
        });
      }
      walk(m && m.blocks);
      return names;
    }

    // DFS untuk kitaran.
    var visiting = {};
    var visited = {};
    var stack = [];
    function dfs(name) {
      if (visited[name]) return false;
      if (visiting[name]) {
        stack.push(name);
        return true;
      }
      visiting[name] = true;
      stack.push(name);
      var m = byName[name];
      if (m) {
        var next = calledNames(m);
        for (var i = 0; i < next.length; i++) {
          if (dfs(next[i])) return true;
        }
      }
      stack.pop();
      visiting[name] = false;
      visited[name] = true;
      return false;
    }

    if (dfs(selfName)) {
      // Potong kitaran pada titik berulang.
      var path = stack.slice();
      var firstIdx = path.indexOf(path[path.length - 1]);
      if (firstIdx > 0) path = path.slice(firstIdx);
      return { cyclic: true, path: path };
    }
    return { cyclic: false, path: null };
  }

  // Bina senarai "runnable" (blok action "chat" tetap dikekalkan, cuma
  // diklasifikasikan). Fungsi pembantu untuk UI (tunjukkan amaran).
  function classifySteps(macro) {
    var steps = [];
    function walk(blocks, depth) {
      if (!Array.isArray(blocks)) return;
      blocks.forEach(function (b) {
        var cls = classify(b);
        steps.push({ depth: depth, kind: cls.kind, label: cls.label, block: b });
        if (b.type === "condition") { walk(b.then, depth + 1); walk(b.else, depth + 1); }
        else if (b.type === "loop") walk(b.do, depth + 1);
      });
    }
    walk(macro && macro.blocks, 0);
    return steps;
  }

  window.LocalPocketMacroValidator = {
    validate: validate,
    validateBlock: validateBlock,
    classify: classify,
    classifySteps: classifySteps,
    detectCycle: detectCycle,
    CONDITION_OPS: CONDITION_OPS,
    STRUCTURAL_TYPES: STRUCTURAL_TYPES
  };
})();
