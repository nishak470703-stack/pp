/*
 * JARVIS Automation Studio — Visual Builder & Dashboard (#5.1, #5.2, #5.4)
 *
 * UI modal di dalam panel JARVIS untuk:
 *   - Senarai makro (Automation) dengan jalankan/edit/padam/eksport/pendua.
 *   - Pembina visual: susun blok (action/wait/condition/loop/call) secara
 *     berkaedah (tambah, alih atas/bawah, padam, edit parameter inline).
 *   - Pemicu (trigger): manual / masa / tab / pintasan JARVIS.
 *   - Templat siap guna (#5.2) & kongsi JSON (eksport/import) (#5.4).
 *
 * Bergantung kepada: LocalPocketMacroEngine, LocalPocketMacroValidator,
 * LocalPocketMacroScheduler, dan (untuk jalankan) window.LocalPocketJarvisActions
 * yang didedahkan oleh jarvisSidebar.js.
 *
 * Gaya ES5. Dimuatkan sebagai content script di panel JARVIS (sidebar).
 */
(function () {
  "use strict";

  var api = (typeof browser !== "undefined") ? browser
    : (typeof chrome !== "undefined" ? chrome : null);
  var STORE_KEY = "jarvisAutomations";

  var Engine = null, Validator = null, Scheduler = null;
  var macros = [];          // senarai tersimpan
  var editing = null;       // working copy makro sedang diedit
  var isNew = false;
  var root = null;          // nod modal
  var listEl = null, editorEl = null, logEl = null, statusEl = null;
  var uidCounter = 0;

  /* ---------- helpers DOM ---------- */
  function el(tag, props, children) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (k === "className") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (v != null) n.setAttribute(k, v);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function uid() { uidCounter++; return "m" + Date.now().toString(36) + uidCounter.toString(36); }

  function ensureRefs() {
    Engine = window.LocalPocketMacroEngine;
    Validator = window.LocalPocketMacroValidator;
    Scheduler = window.LocalPocketMacroScheduler;
  }

  function load(cb) {
    if (!Scheduler) { cb && cb(); return; }
    Scheduler.storeGet(function (arr) { macros = arr || []; cb && cb(); });
  }
  function persist(cb) {
    if (!Scheduler) { cb && cb(); return; }
    Scheduler.storeSet(macros, function () { cb && cb(); });
  }

  /* ---------- trigger label ---------- */
  function triggerLabel(m) {
    var t = (m.trigger && m.trigger.type) || "manual";
    if (t === "time") {
      if (m.trigger.kind === "interval") return "⏰ Setiap " + (m.trigger.minutes || 0) + " min";
      return "⏰ " + (m.trigger.time || "08:00") + (m.trigger.days && m.trigger.days.length < 7 ? " (" + m.trigger.days.length + "h)" : "");
    }
    if (t === "tab") return "🌐 " + (m.trigger.urlMatch || "*");
    if (t === "shortcut") return "🗣 sebut nama";
    return "✋ manual";
  }

  /* ---------- build handlers from sidebar actions ---------- */
  function buildHandlers() {
    var A = window.LocalPocketJarvisActions || {};
    return {
      open_url: function (p) { A.openUrl && A.openUrl(p.target); },
      navigate: function (p) { A.navigate && A.navigate(p.target); },
      new_tab: function () { A.newTab && A.newTab(); },
      close_tab: function () { A.closeTab && A.closeTab(); },
      close_all_tabs: function () { A.closeAllTabs && A.closeAllTabs(); },
      reload: function () { A.reload && A.reload(); },
      back: function () { A.back && A.back(); },
      forward: function () { A.forward && A.forward(); },
      duplicate_tab: function () { A.duplicateTab && A.duplicateTab(); },
      bookmark: function () { A.bookmark && A.bookmark(); },
      print_page: function () { A.printPage && A.printPage(); },
      zoom: function (p) { A.zoom && A.zoom(p.direction); },
      save: function () { A.save && A.save(); },
      summarize: function () { A.summarize && A.summarize(); },
      ask: function (p) { A.ask && A.ask(p.text || ""); },
      summarize_selection: function (p) { A.summarizeSelection && A.summarizeSelection(p.query); },
      translate_selection: function (p) { A.translateSelection && A.translateSelection(p.query); },
      copy_url: function () { A.copyUrl && A.copyUrl(); },
      copy_answer: function () { A.copyAnswer && A.copyAnswer(); },
      click: function (p) { A.click && A.click(p.target, p.index); },
      click_first_link: function () { A.clickFirstLink && A.clickFirstLink(); },
      fill: function (p) { A.fill && A.fill(p.field, p.value, p.index); },
      scroll: function (p) { A.scroll && A.scroll(p.direction); }
    };
  }
  function buildContext() {
    var A = window.LocalPocketJarvisActions;
    if (A && typeof A.getContext === "function") {
      try { return A.getContext() || {}; } catch (e) {}
    }
    return { url: location.href, title: document.title, host: location.hostname, text: "" };
  }
  function resolveMacro(name) {
    for (var i = 0; i < macros.length; i++) if (macros[i].name === name) return macros[i];
    if (editing && editing.name === name) return editing;
    return null;
  }

  function runMacroNow(macro, where) {
    if (!Engine) { logMsg("⚠ Enjin makro tiada."); return; }
    var h = buildHandlers();
    logMsg("▶▶ Jalankan \"" + (macro.name || "?") + "\"" + (where ? " (" + where + ")" : ""));
    Engine.runMacro(macro, {
      handlers: h,
      getContext: buildContext,
      resolveMacro: resolveMacro,
      log: logMsg
    });
  }

  function logMsg(s) {
    if (!logEl) return;
    var line = el("div", { className: "lp-as-log-line", text: s });
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  /* ---------- modal shell ---------- */
  function injectCss() {
    if (document.getElementById("lp-as-style")) return;
    var css = [
      ".lp-as-overlay{position:fixed;inset:0;z-index:2147483600;background:rgba(10,12,28,.72);",
      "  display:flex;align-items:stretch;justify-content:center;font:13px/1.5 system-ui,sans-serif;}",
      ".lp-as-modal{width:100%;max-width:920px;height:100%;background:#16182e;color:#e6ebff;",
      "  display:flex;flex-direction:column;box-shadow:0 0 40px rgba(0,0,0,.6);}",
      ".lp-as-head{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#1f2240;",
      "  border-bottom:1px solid #2c3057;font-weight:600;}",
      ".lp-as-head .lp-as-title{flex:1;}",
      ".lp-as-body{flex:1;display:flex;min-height:0;}",
      ".lp-as-list{width:300px;max-width:42%;overflow:auto;padding:8px;border-right:1px solid #2c3057;}",
      ".lp-as-editor{flex:1;overflow:auto;padding:12px;}",
      ".lp-as-row{display:flex;gap:6px;align-items:center;padding:6px 8px;border:1px solid #2c3057;",
      "  border-radius:6px;margin-bottom:6px;background:#1b1e38;}",
      ".lp-as-row .lp-as-name{flex:1;cursor:pointer;}",
      ".lp-as-btn{background:#2c3057;color:#e6ebff;border:1px solid #3a3f6e;border-radius:5px;",
      "  padding:3px 8px;cursor:pointer;font-size:12px;}",
      ".lp-as-btn:hover{background:#3a3f6e;}",
      ".lp-as-btn.primary{background:#3b6ef5;border-color:#3b6ef5;}",
      ".lp-as-btn.danger{background:#7a2b3a;border-color:#9a3b4a;}",
      ".lp-as-input,.lp-as-select{background:#0f1124;color:#e6ebff;border:1px solid #3a3f6e;",
      "  border-radius:5px;padding:4px 6px;font-size:12px;}",
      ".lp-as-input{flex:1;width:100%;}",
      ".lp-as-sub{margin:6px 0 6px 18px;padding-left:10px;border-left:2px solid #3a3f6e;}",
      ".lp-as-block{display:flex;gap:6px;align-items:flex-start;padding:5px 6px;border:1px solid #2c3057;",
      "  border-radius:6px;margin-bottom:5px;background:#181b34;}",
      ".lp-as-block .lp-as-bctrl{display:flex;flex-direction:column;gap:2px;}",
      ".lp-as-block .lp-as-bmain{flex:1;}",
      ".lp-as-params{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;}",
      ".lp-as-params label{display:flex;flex-direction:column;font-size:11px;color:#aab4d4;gap:2px;}",
      ".lp-as-mini{font-size:11px;padding:1px 5px;}",
      ".lp-as-log{height:120px;overflow:auto;background:#0f1124;border:1px solid #2c3057;",
      "  border-radius:6px;padding:6px;margin-top:10px;font:11px/1.4 monospace;color:#9fe6b0;}",
      ".lp-as-log-line{white-space:pre-wrap;}",
      ".lp-as-status{margin-top:8px;font-size:12px;color:#f5c66b;}",
      ".lp-as-chk{display:flex;gap:4px;align-items:center;font-size:11px;}",
      ".lp-as-pal{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;}",
      ".lp-as-hidden{display:none!important;}"
    ].join("\n");
    var s = el("style", { id: "lp-as-style", text: css });
    (document.head || document.documentElement).appendChild(s);
  }

  function buildShell() {
    if (root) return;
    injectCss();
    listEl = el("div", { className: "lp-as-list" });
    editorEl = el("div", { className: "lp-as-editor" });
    logEl = el("div", { className: "lp-as-log" });
    statusEl = el("div", { className: "lp-as-status" });
    var closeBtn = el("button", { className: "lp-as-btn", text: "✕ Tutup", onclick: close });
    var head = el("div", { className: "lp-as-head" }, [
      el("span", { className: "lp-as-title", text: "⚙ JARVIS Automation Studio" }),
      closeBtn
    ]);
    var body = el("div", { className: "lp-as-body" }, [listEl, editorEl]);
    var modal = el("div", { className: "lp-as-modal" }, [head, body]);
    root = el("div", { className: "lp-as-overlay lp-as-hidden", id: "lp-jarvis-automation-studio" }, [modal]);
    (document.body || document.documentElement).appendChild(root);
  }

  /* ---------- list view ---------- */
  function renderList() {
    clear(listEl);
    var newBtn = el("button", { className: "lp-as-btn primary", text: "＋ Makro Baharu",
      onclick: function () { startEdit(blankMacro(), true); } });
    var tplBtn = el("button", { className: "lp-as-btn", text: "📚 Templat",
      onclick: showTemplates });
    var impBtn = el("button", { className: "lp-as-btn", text: "⬆ Import",
      onclick: importJson });
    listEl.appendChild(el("div", { className: "lp-as-pal" }, [newBtn, tplBtn, impBtn]));
    if (!macros.length) {
      listEl.appendChild(el("div", { className: "lp-as-status", text: "Tiada automasi lagi. Cipta atau import." }));
    }
    macros.forEach(function (m) {
      var row = el("div", { className: "lp-as-row" });
      var name = el("span", { className: "lp-as-name", text: m.name + "  ", title: "Edit",
        onclick: function () { startEdit(clone(m), false); } });
      row.appendChild(name);
      row.appendChild(el("span", { className: "lp-as-status", text: triggerLabel(m), style: "font-size:11px;" }));
      row.appendChild(el("button", { className: "lp-as-btn lp-as-mini", text: "▶", title: "Jalankan",
        onclick: function () { runMacroNow(m, "senarai"); } }));
      row.appendChild(el("button", { className: "lp-as-btn lp-as-mini", text: "⧉", title: "Pendua",
        onclick: function () { var c = clone(m); c.name = m.name + " (salinan)"; c.id = uid(); macros.push(c); persist(renderList); } }));
      row.appendChild(el("button", { className: "lp-as-btn lp-as-mini", text: "⤓", title: "Eksport",
        onclick: function () { exportJson([m]); } }));
      row.appendChild(el("button", { className: "lp-as-btn lp-as-mini danger", text: "🗑", title: "Padam",
        onclick: function () { if (confirm("Padam automasi \"" + m.name + "\"?")) { removeMacro(m.id); } } }));
      listEl.appendChild(row);
    });
  }

  function removeMacro(id) {
    macros = macros.filter(function (m) { return m.id !== id; });
    if (Scheduler && Scheduler.unschedule) Scheduler.unschedule(id);
    persist(renderList);
  }

  /* ---------- editor ---------- */
  function blankMacro() {
    return {
      id: uid(), name: "Makro Baharu", enabled: true,
      trigger: { type: "manual" }, blocks: [{ type: "action", action: "ask", params: { text: "" } }]
    };
  }
  function clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return {}; } }

  function startEdit(macro, isNewFlag) {
    editing = macro; isNew = !!isNewFlag;
    renderEditor();
  }

  // Tukar ayat arahan biasa kepada blok (pisah dengan ; atau baris baru).
  function parseCommandToBlocks(text) {
    var steps = String(text || "").split(/[\n;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var blocks = [];
    steps.forEach(function (step) {
      var low = step.toLowerCase();
      var m;
      if (/(ringkas|summary|summarize|tldr)/.test(low)) blocks.push({ type: "action", action: "summarize", params: {} });
      else if (/^(simpan|save|arkib|archive)/.test(low)) blocks.push({ type: "action", action: "save", params: {} });
      else if (m = low.match(/^(buka|pergi|navigate|open)\s+(\S+)/)) {
        var url = m[2];
        if (!/^https?:\/\//.test(url)) url = "https://" + url;
        blocks.push({ type: "action", action: "open_url", params: { target: url } });
      }
      else if (m = low.match(/^tunggu\s+(\d+)/)) blocks.push({ type: "wait", ms: Number(m[1]) });
      else if (m = low.match(/^(tanya|ask|chat|soal)\s+(.+)/)) blocks.push({ type: "action", action: "ask", params: { text: m[2].trim() } });
      else if (m = low.match(/^klik\s+(.+)/)) blocks.push({ type: "action", action: "click", params: { target: m[1].trim(), index: 0 } });

      else if (m = low.match(/^(translasi|terjemah)\s+(.+)/)) blocks.push({ type: "action", action: "translate_selection", params: { query: m[1].trim() } });
      else if (/salin url|copy url/.test(low)) blocks.push({ type: "action", action: "copy_url", params: {} });
      else blocks.push({ type: "action", action: "ask", params: { text: step } });
    });
    return blocks;
  }

  // Gunakan Gemini sebagai "otak" — terangkan matlamat, dia hasilkan JSON makro.
  function planWithGemini(description, cb) {
    var A = window.LocalPocketJarvisActions;
    if (!A || typeof A.askGemini !== "function") { cb({ ok: false, error: "askGemini tiada (JARVIS/Gemini?)" }); return; }
    var prompt = [
      "Awak perancang automasi untuk JARVIS. Tukar permintaan pengguna kepada SATU objek JSON makro sahaja.",
      "Jangan tulis teks lain atau markdown. Format:",
      '{"name":"...","enabled":true,"trigger":{"type":"manual"},"blocks":[]}',
      "Action dibenarkan: open_url(target), navigate(target), save, summarize, ask(text), click(target,index),",
      "click_first_link, fill(field,value,index), scroll(direction), wait(ms), copy_url,",
      'copy_answer, translate_selection(query). Blok: {"type":"action","action":"...","params":{...}} atau {"type":"wait","ms":N}.',
      'Trigger: manual {}, time {kind:"daily",time:"HH:MM",days:[0-6]} / {kind:"interval",minutes:N}, tab {urlMatch:"..."}, shortcut {}.',
      "Permintaan pengguna: " + description,
      "JSON:"
    ].join("\n");
    A.askGemini(prompt).then(function (ans) {
      if (!ans) { cb({ ok: false, error: "Gemini tak jawab." }); return; }
      var s = ans.indexOf("{"); var e = ans.lastIndexOf("}");
      if (s === -1 || e === -1 || e <= s) { cb({ ok: false, error: "Tiada JSON di jawapan Gemini." }); return; }
      try {
        var m = JSON.parse(ans.slice(s, e + 1));
        if (!m.blocks) m.blocks = [];
        if (!m.name) m.name = "Makro Gemini";
        m.id = uid();
        if (!m.trigger) m.trigger = { type: "manual" };
        cb({ ok: true, macro: m });
      } catch (ex) { cb({ ok: false, error: "JSON tak sah: " + (ex && ex.message ? ex.message : ex) }); }
    }).catch(function (ex) { cb({ ok: false, error: String(ex && ex.message ? ex.message : ex) }); });
  }

  function renderEditor() {
    if (!editing) { clear(editorEl); editorEl.appendChild(el("div", { className: "lp-as-status", text: "Pilih atau cipta makro." })); return; }
    clear(editorEl);
    var m = editing;

    // Nama + enabled
    var nameInput = el("input", { className: "lp-as-input", value: m.name || "",
      oninput: function () { m.name = nameInput.value; } });
    var enChk = el("input", { type: "checkbox" });
    enChk.checked = (m.enabled !== false);
    enChk.addEventListener("change", function () { m.enabled = enChk.checked; });
    editorEl.appendChild(el("div", { className: "lp-as-row" }, [
      el("label", { className: "lp-as-chk", text: "Nama:" }),
      nameInput,
      el("label", { className: "lp-as-chk" }, [enChk, document.createTextNode("Aktif")])
    ]));

    // Trigger
    var trigSel = el("select", { className: "lp-as-select", onchange: function () {
      m.trigger = m.trigger || {}; m.trigger.type = trigSel.value; renderEditor();
    } });
    ["manual", "time", "tab", "shortcut"].forEach(function (t) {
      var o = el("option", { value: t, text: ({ manual: "Manual", time: "Mengikut masa", tab: "Buka halaman", shortcut: "Pintasan JARVIS" })[t] });
      if ((m.trigger && m.trigger.type || "manual") === t) o.selected = true;
      trigSel.appendChild(o);
    });
    var trigBox = el("div", { className: "lp-as-sub" });
    renderTriggerFields(m, trigBox);
    editorEl.appendChild(el("div", { className: "lp-as-row" }, [el("label", { className: "lp-as-chk", text: "Pemicu:" }), trigSel]));
    editorEl.appendChild(trigBox);

    // Gemini brain
    var brainArea = el("textarea", { className: "lp-as-input", rows: "3",
      placeholder: "Terangkan matlamat, cth: Setiap pagi buka berita, ringkaskan, simpan ke Berita Pagi" });
    var brainBtn = el("button", { className: "lp-as-btn primary", text: "🧠 Biar Gemini rancang", onclick: function () {
      var desc = brainArea.value.trim();
      if (!desc) { statusEl.textContent = "✗ Taip penerangan dulu."; return; }
      statusEl.textContent = "🧠 Gemini merancang… (tunggu jawapan)";
      planWithGemini(desc, function (r) {
        if (!r.ok) { statusEl.textContent = "✗ " + r.error; return; }
        editing = r.macro; renderEditor();
        statusEl.textContent = "✅ Gemini hasilkan makro \"" + r.macro.name + "\" — semak & Simpan.";
      });
    } });
    editorEl.appendChild(el("div", { className: "lp-as-sub" }, [
      el("div", { text: "🧠 Biar Gemini jadi otak — terangkan matlamat:" }),
      brainArea,
      brainBtn
    ]));

    // Quick text -> blocks
    var cmdArea = el("textarea", { className: "lp-as-input", rows: "3",
      placeholder: "Taip arahan biasa, pisah dengan ;  cth: buka github.com; ringkas; simpan" });
    var toBlkBtn = el("button", { className: "lp-as-btn primary", text: "✨ Jadi Blok", onclick: function () {
      var b = parseCommandToBlocks(cmdArea.value);
      if (!b.length) { statusEl.textContent = "✗ Tiada arahan dikenali."; return; }
      m.blocks = b; renderEditor();
    } });
    editorEl.appendChild(el("div", { className: "lp-as-sub" }, [
      el("div", { text: "Atau taip arahan biasa (pisah dengan ; ):" }),
      cmdArea,
      toBlkBtn
    ]));

    // Blocks
    editorEl.appendChild(el("div", { style: "margin-top:10px;font-weight:600;", text: "Blok tindakan" }));
    editorEl.appendChild(renderBlocks(m.blocks || (m.blocks = []), 0));

    // Actions
    var validateBtn = el("button", { className: "lp-as-btn", text: "✓ Sahkan", onclick: doValidate });
    var runBtn = el("button", { className: "lp-as-btn", text: "▶ Jalankan", onclick: function () { runMacroNow(m, "editor"); } });
    var saveBtn = el("button", { className: "lp-as-btn primary", text: "💾 Simpan", onclick: doSave });
    var delBtn = el("button", { className: "lp-as-btn danger", text: "🗑 Buang", onclick: function () {
      if (confirm("Padam automasi \"" + (m.name || "?") + "\"?")) { removeMacro(m.id); editing = null; renderEditor(); }
    } });
    editorEl.appendChild(el("div", { className: "lp-as-pal" }, [validateBtn, runBtn, saveBtn, delBtn]));
    editorEl.appendChild(statusEl);
    editorEl.appendChild(logEl);
  }

  function renderTriggerFields(m, box) {
    clear(box);
    var t = (m.trigger && m.trigger.type) || "manual";
    if (t === "time") {
      m.trigger.kind = m.trigger.kind || "daily";
      var kindSel = el("select", { className: "lp-as-select", onchange: function () { m.trigger.kind = kindSel.value; renderEditor(); } });
      [["daily", "Setiap hari"], ["interval", "Selang"]].forEach(function (kv) {
        var o = el("option", { value: kv[0], text: kv[1] }); if (m.trigger.kind === kv[0]) o.selected = true; kindSel.appendChild(o);
      });
      box.appendChild(el("div", { className: "lp-as-row" }, [el("label", { className: "lp-as-chk", text: "Jenis:" }), kindSel]));
      if (m.trigger.kind === "interval") {
        var minI = el("input", { className: "lp-as-input", type: "number", value: m.trigger.minutes || 60,
          oninput: function () { m.trigger.minutes = Number(minI.value) || 0; } });
        box.appendChild(el("div", { className: "lp-as-row" }, [el("label", { className: "lp-as-chk", text: "Minit:" }), minI]));
      } else {
        var timeI = el("input", { className: "lp-as-input", type: "time", value: m.trigger.time || "08:00",
          oninput: function () { m.trigger.time = timeI.value; } });
        box.appendChild(el("div", { className: "lp-as-row" }, [el("label", { className: "lp-as-chk", text: "Masa:" }), timeI]));
        var days = m.trigger.days || [1, 2, 3, 4, 5];
        m.trigger.days = days;
        var dayNames = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
        var dayRow = el("div", { className: "lp-as-pal" });
        dayNames.forEach(function (dn, i) {
          var c = el("input", { type: "checkbox" }); c.checked = days.indexOf(i) !== -1;
          c.addEventListener("change", function () {
            if (c.checked) { if (days.indexOf(i) === -1) days.push(i); }
            else { days = days.filter(function (d) { return d !== i; }); }
            m.trigger.days = days;
          });
          dayRow.appendChild(el("label", { className: "lp-as-chk" }, [c, document.createTextNode(dn[0])]));
        });
        box.appendChild(el("div", { className: "lp-as-row" }, [el("label", { className: "lp-as-chk", text: "Hari:" }), dayRow]));
      }
    } else if (t === "tab") {
      var urlI = el("input", { className: "lp-as-input", value: (m.trigger.urlMatch) || "", placeholder: "contoh: youtube.com",
        oninput: function () { m.trigger.urlMatch = urlI.value; } });
      box.appendChild(el("div", { className: "lp-as-row" }, [el("label", { className: "lp-as-chk", text: "URL mengandungi:" }), urlI]));
    } else if (t === "shortcut") {
      box.appendChild(el("div", { className: "lp-as-status", text: "Sebut nama makro ini kepada JARVIS, cth. \"jalankan " + (m.name || "makro") + "\"." }));
    } else {
      box.appendChild(el("div", { className: "lp-as-status", text: "Jalankan dari studio atau arahan JARVIS \"buka automation\"." }));
    }
  }

  /* ---------- block editor (rekursif) ---------- */
  function renderBlocks(arr, depth) {
    var wrap = el("div", {});
    (arr || []).forEach(function (block, idx) {
      wrap.appendChild(blockRow(block, arr, idx, depth));
    });
    wrap.appendChild(addBlockControl(arr, depth));
    return wrap;
  }

  function blockRow(block, parentArr, idx, depth) {
    var ctrl = el("div", { className: "lp-as-bctrl" });
    if (idx > 0) ctrl.appendChild(el("button", { className: "lp-as-btn lp-as-mini", text: "↑", title: "Naik",
      onclick: function () { parentArr.splice(idx, 1); parentArr.splice(idx - 1, 0, block); renderEditor(); } }));
    if (idx < parentArr.length - 1) ctrl.appendChild(el("button", { className: "lp-as-btn lp-as-mini", text: "↓", title: "Turun",
      onclick: function () { parentArr.splice(idx, 1); parentArr.splice(idx + 1, 0, block); renderEditor(); } }));
    ctrl.appendChild(el("button", { className: "lp-as-btn lp-as-mini danger", text: "✕", title: "Padam",
      onclick: function () { parentArr.splice(idx, 1); renderEditor(); } }));

    var main = el("div", { className: "lp-as-bmain" });
    if (block.type === "action") {
      var sel = el("select", { className: "lp-as-select", onchange: function () { block.action = sel.value; block.params = {}; renderEditor(); } });
      if (Engine) Engine.ACTION_CATALOG.forEach(function (a) {
        var o = el("option", { value: a.id, text: a.label }); if (block.action === a.id) o.selected = true; sel.appendChild(o);
      });
      main.appendChild(el("div", { className: "lp-as-row" }, [el("span", { text: "▶ " }), sel]));
      main.appendChild(renderParams(block));
    } else if (block.type === "wait") {
      var msI = el("input", { className: "lp-as-input", type: "number", value: block.ms || 1000,
        oninput: function () { block.ms = Number(msI.value) || 0; } });
      main.appendChild(el("div", { className: "lp-as-row" }, [el("span", { text: "⏱ Tunggu (ms):" }), msI]));
    } else if (block.type === "condition") {
      block.when = block.when || { field: "url", op: "contains", value: "" };
      block.then = block.then || []; block.else = block.else || [];
      var fieldSel = el("select", { className: "lp-as-select", onchange: function () { block.when.field = fieldSel.value; } });
      ["url", "title", "text", "host"].forEach(function (f) { var o = el("option", { value: f, text: f }); if (block.when.field === f) o.selected = true; fieldSel.appendChild(o); });
      var opSel = el("select", { className: "lp-as-select", onchange: function () { block.when.op = opSel.value; } });
      (Validator ? Validator.CONDITION_OPS : ["contains", "equals", "startsWith", "endsWith", "matches", "notContains"]).forEach(function (op) {
        var o = el("option", { value: op, text: op }); if (block.when.op === op) o.selected = true; opSel.appendChild(o);
      });
      var valI = el("input", { className: "lp-as-input", value: block.when.value || "", oninput: function () { block.when.value = valI.value; } });
      main.appendChild(el("div", { className: "lp-as-row" }, [el("span", { text: "❓ Jika" }), fieldSel, opSel, valI]));
      main.appendChild(el("div", { className: "lp-as-sub" }, [el("div", { text: "Jika YA:" }), renderBlocks(block.then, depth + 1)]));
      main.appendChild(el("div", { className: "lp-as-sub" }, [el("div", { text: "Jika TIDAK:" }), renderBlocks(block.else, depth + 1)]));
    } else if (block.type === "loop") {
      block.do = block.do || [];
      var nI = el("input", { className: "lp-as-input", type: "number", value: block.times || 3, oninput: function () { block.times = Number(nI.value) || 1; } });
      main.appendChild(el("div", { className: "lp-as-row" }, [el("span", { text: "🔁 Ulang ×" }), nI]));
      main.appendChild(el("div", { className: "lp-as-sub" }, [el("div", { text: "Blok:" }), renderBlocks(block.do, depth + 1)]));
    } else if (block.type === "call") {
      var mSel = el("select", { className: "lp-as-select", onchange: function () { block.macro = mSel.value; } });
      mSel.appendChild(el("option", { value: "", text: "— pilih makro —" }));
      macros.forEach(function (mm) { var o = el("option", { value: mm.name, text: mm.name }); if (block.macro === mm.name) o.selected = true; mSel.appendChild(o); });
      main.appendChild(el("div", { className: "lp-as-row" }, [el("span", { text: "📞 Panggil:" }), mSel]));
    }
    return el("div", { className: "lp-as-block" }, [ctrl, main]);
  }

  function renderParams(block) {
    var box = el("div", { className: "lp-as-params" });
    if (!Engine) return box;
    var def = Engine.ACTION_INDEX[block.action];
    if (!def || !def.params || !def.params.length) return box;
    block.params = block.params || {};
    def.params.forEach(function (p) {
      var input;
      if (p.type === "select") {
        input = el("select", { className: "lp-as-select", onchange: function () { block.params[p.name] = input.value; } });
        (p.options || []).forEach(function (o) { var oo = el("option", { value: o.value, text: o.label }); if (block.params[p.name] === o.value) oo.selected = true; input.appendChild(oo); });
        if (block.params[p.name] == null && p.default != null) block.params[p.name] = p.default;
      } else {
        input = el("input", { className: "lp-as-input", type: p.type === "number" ? "number" : "text", value: block.params[p.name] != null ? block.params[p.name] : (p.default != null ? p.default : "") });
        input.addEventListener("input", function () { block.params[p.name] = p.type === "number" ? Number(input.value) : input.value; });
      }
      box.appendChild(el("label", {}, [document.createTextNode(p.label), input]));
    });
    return box;
  }

  function addBlockControl(arr, depth) {
    var sel = el("select", { className: "lp-as-select" });
    sel.appendChild(el("option", { value: "", text: "＋ Tambah blok…" }));
    if (Engine) Engine.ACTION_CATALOG.forEach(function (a) { sel.appendChild(el("option", { value: "action:" + a.id, text: "▶ " + a.label })); });
    sel.appendChild(el("option", { value: "wait", text: "⏱ Tunggu" }));
    sel.appendChild(el("option", { value: "condition", text: "❓ Jika (condition)" }));
    sel.appendChild(el("option", { value: "loop", text: "🔁 Ulang (loop)" }));
    sel.appendChild(el("option", { value: "call", text: "📞 Panggil makro" }));
    var addBtn = el("button", { className: "lp-as-btn", text: "Tambah", onclick: function () {
      var v = sel.value; if (!v) return;
      if (v.indexOf("action:") === 0) arr.push({ type: "action", action: v.slice(7), params: {} });
      else if (v === "wait") arr.push({ type: "wait", ms: 1000 });
      else if (v === "condition") arr.push({ type: "condition", when: { field: "url", op: "contains", value: "" }, then: [], else: [] });
      else if (v === "loop") arr.push({ type: "loop", times: 3, do: [] });
      else if (v === "call") arr.push({ type: "call", macro: "" });
      renderEditor();
    } });
    return el("div", { className: "lp-as-row", style: "background:#12152c;" }, [sel, addBtn]);
  }

  /* ---------- validate / save ---------- */
  function doValidate() {
    if (!Validator) { statusEl.textContent = "⚠ Validator tiada."; return; }
    var v = Validator.validate(editing, { allMacros: macros.concat([editing]) });
    var msg = v.ok ? "✓ Sah — " + v.steps.length + " langkah." : "✗ " + v.errors.length + " ralat.";
    if (v.warnings.length) msg += "  ⚠ " + v.warnings.length + " amaran.";
    statusEl.textContent = msg;
    logMsg(msg);
    v.errors.forEach(function (e) { logMsg("  ✗ " + e); });
    v.warnings.forEach(function (w) { logMsg("  ⚠ " + w); });
  }

  function doSave() {
    if (!editing) return;
    if (!editing.name) { statusEl.textContent = "✗ Nama makro kosong."; return; }
    if (Validator) {
      var v = Validator.validate(editing, { allMacros: macros.concat([editing]) });
      if (!v.ok) { statusEl.textContent = "✗ Tak boleh simpan: " + v.errors.length + " ralat."; v.errors.forEach(function (e) { logMsg("✗ " + e); }); return; }
    }
    // Kemas kini senarai.
    var existing = macros.filter(function (m) { return m.id === editing.id; })[0];
    if (existing) {
      var i = macros.indexOf(existing); macros[i] = editing;
    } else {
      macros.push(editing);
    }
    persist(function () {
      if (Scheduler && Scheduler.scheduleMacro) {
        if (editing.trigger && editing.trigger.type === "time") Scheduler.scheduleMacro(editing);
        else Scheduler.unschedule(editing.id);
      }
      statusEl.textContent = "✓ Disimpan.";
      renderList();
      renderEditor();
    });
  }

  /* ---------- templates (#5.2) ---------- */
  function templates() {
    return [
      { name: "Daily News Digest", enabled: true, trigger: { type: "time", kind: "daily", time: "08:00", days: [1, 2, 3, 4, 5] },
        blocks: [
          { type: "action", action: "open_url", params: { target: "https://news.google.com" } },
          { type: "wait", ms: 2500 },
          { type: "action", action: "summarize" },
          { type: "action", action: "save" }
        ] },
      { name: "Research Deep Dive", enabled: true, trigger: { type: "manual" },
        blocks: [
          { type: "action", action: "ask", params: { text: "Cari 3 sumber terpercaya tentang topik ini dan bandingkan." } },
          { type: "action", action: "save" }
        ] },
      { name: "Shopping Comparator", enabled: true, trigger: { type: "tab", urlMatch: "shopee|lazada|amazon" },
        blocks: [
          { type: "action", action: "summarize" },
          { type: "action", action: "ask", params: { text: "Ekstrak nama produk, harga, dan ciri utama." } },
          { type: "action", action: "save" }
        ] }
    ];
  }
  function showTemplates() {
    clear(editorEl);
    editorEl.appendChild(el("div", { style: "font-weight:600;margin-bottom:8px;", text: "📚 Templat siap guna" }));
    templates().forEach(function (t) {
      var row = el("div", { className: "lp-as-row" });
      row.appendChild(el("span", { className: "lp-as-name", text: t.name }));
      row.appendChild(el("span", { className: "lp-as-status", text: triggerLabel(t) }));
      row.appendChild(el("button", { className: "lp-as-btn primary", text: "Tambah", onclick: function () {
        var c = clone(t); c.id = uid(); macros.push(c); persist(function () { renderList(); startEdit(c, false); });
      } }));
      editorEl.appendChild(row);
    });
    editorEl.appendChild(el("button", { className: "lp-as-btn", text: "← Kembali", onclick: renderEditor }));
  }

  /* ---------- export / import (#5.4) ---------- */
  function exportJson(list) {
    var data = JSON.stringify(list, null, 2);
    try {
      var blob = new Blob([data], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = el("a", { href: url, download: "jarvis-automations.json" });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);
    } catch (e) {}
    // Sandarkan ke clipboard juga.
    try { if (navigator.clipboard) navigator.clipboard.writeText(data); } catch (e2) {}
    statusEl.textContent = "⤓ Dieksport " + list.length + " makro (muat turun + salin ke clipboard).";
  }
  function importJson() {
    var input = el("input", { type: "file", accept: "application/json,.json", style: "display:none" });
    input.addEventListener("change", function () {
      var f = input.files && input.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(reader.result);
          var arr = Array.isArray(parsed) ? parsed : [parsed];
          arr.forEach(function (m) { if (m && m.name) { m.id = uid(); macros.push(m); } });
          persist(function () {
            if (Scheduler) macros.forEach(function (m) { if (m.trigger && m.trigger.type === "time") Scheduler.scheduleMacro(m); });
            renderList();
            statusEl.textContent = "⬆ Diimport " + arr.length + " makro.";
          });
        } catch (e) { statusEl.textContent = "✗ Fail JSON tidak sah."; }
      };
      reader.readAsText(f);
    });
    document.body.appendChild(input); input.click(); document.body.removeChild(input);
  }

  /* ---------- public ---------- */
  function open() {
    ensureRefs();
    buildShell();
    root.classList.remove("lp-as-hidden");
    load(function () { renderList(); renderEditor(); });
  }
  function close() { if (root) root.classList.add("lp-as-hidden"); }
  function isOpen() { return !!root && !root.classList.contains("lp-as-hidden"); }
  function init(opts) { opts = opts || {}; ensureRefs(); }

  window.LocalPocketAutomationStudio = {
    open: open, close: close, isOpen: isOpen, init: init,
    runMacroNow: runMacroNow, STORE_KEY: STORE_KEY
  };
})();
