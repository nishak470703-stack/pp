/**
 * Local Pocket Reader - JARVIS Core
 *
 * Pure intent-parsing and page-context helpers for the JARVIS assistant.
 * Runs in the content-script (page) world and is consumed by jarvisOverlay.js.
 * Attaches itself to `window.LocalPocketJarvisCore`.
 *
 * Intent families:
 *   - Local addon actions : save, pomodoro, open-category, summarize, search
 *   - Browser control     : open_url, new_tab, close_tab, close_all_tabs,
 *                           reload, back, forward, bookmark
 *   - Page control        : scroll (local, page-scoped)
 *   - DOM control         : click, fill (local, element-scoped)
 *   - Addon control       : open_sidebar, open_library, toggle_notes,
 *                           toggle_pomodoro, open_settings, toggle_ai_overlay
 *   - AI chat             : chat (send free-form question to the provider)
 *
 * Risky intents (destructive / irreversible) carry `risk: "confirm"` so the
 * overlay can ask the user before executing.
 */
(function () {
  "use strict";

  var JarvisCore = (function () {
    /** Trim and normalize a string. */
    function normalize(value) {
      return value ? String(value).trim() : "";
    }

    /** True if the text looks like a URL (http(s) or domain.tld). */
    function isUrl(value) {
      if (!value) return false;
      if (/^https?:\/\//i.test(value)) return true;
      // domain.tld with no spaces and a dot, e.g. facebook.com
      return !/\s/.test(value) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(value);
    }

    // How much of the page text to feed the planner (the "brain"). Large
    // enough to resolve click/fill/find targets, small enough to keep the
    // JSON-only reply tight. The full text still goes to chat/summarize.
    var MAX_PLAN_CONTEXT_CHARS = 4000;

    /** Normalize a free-form target into a navigable URL or null. */
    function toUrl(target) {
      var t = normalize(target);
      if (!t) return null;
      if (/^https?:\/\//i.test(t)) return t;
      if (isUrl(t)) return "https://" + t;
      // Bare word — return null instead of guessing .com so "buka ini"
      // doesn't silently open "ini.com". JARVIS will treat it as a search/chat.
      return null;
    }

    /**
     * P1 kecekapan: cache hasil `extractPageContext` supaya `document.body.innerText`
     * (bacaan DOM yang mahal) tak dibaca berulang kali. Cache di-invalidate bila
     * URL tukar atau TTL (2s) tamat, ATAU bila dipanggil dengan `{ force: true }`
     * (cth. selepas tindakan DOM berubah). Kembalikan SALINAN objek supaya
     * pemanggil yang mutate `ctx.text` (cth. doSummarizeSelection) tak rosakkan cache.
     */
    var _ctxCache = null;     // { title, url, text, ts }
    var _ctxCacheTTL = 2000;  // ms

    /**
     * P2 kecekapan: kumpul teks halaman dengan melangkau subtrees boilerplate
     * (nav, footer, header, aside, cookie/consent, iklan, menu, social, modal)
     * supaya teks yang dihantar ke provider lebih bersih & kecil. Berjalan
     * berpagar masa (90ms) + had elemen supaya halaman besar tak membeku.
     * @returns {string}
     */
    function collectPageText() {
      try {
        if (!document || !document.body) return "";
        var BLOCKED_TAG = /^(nav|footer|header|aside|script|style|noscript|svg|template)$/i;
        var BLOCKED_ROLE = /^(navigation|banner|contentinfo|complementary)$/i;
        var BLOCKED_CLASS = /(cookie|consent|advert|ad-|ads-|promo|sidebar|menu|breadcrumb|social|related-posts|newsletter|popup|modal|banner|share)/i;
        var out = [];
        var started = Date.now();
        var visited = 0;
        var stack = [document.body];
        while (stack.length) {
          if (Date.now() - started > 90) break;
          if (visited++ > 6000) break;
          var node = stack.pop();
          try {
            if (!node) continue;
            if (node.nodeType === 3) { // text node
              var t = (node.nodeValue || "").replace(/\s+/g, " ").trim();
              if (t) out.push(t);
              continue;
            }
            if (node.nodeType !== 1) continue; // abaikan comment/etc.
            var tag = node.tagName ? node.tagName.toLowerCase() : "";
            if (BLOCKED_TAG.test(tag)) continue;
            var role = node.getAttribute ? node.getAttribute("role") : "";
            if (role && BLOCKED_ROLE.test(role)) continue;
            var cls = (node.className && node.className.toString) ? node.className.toString() : "";
            if (cls && BLOCKED_CLASS.test(cls)) continue;
            if (node.childNodes && node.childNodes.length) {
              for (var c = node.childNodes.length - 1; c >= 0; c--) stack.push(node.childNodes[c]);
            }
          } catch (e) { continue; }
        }
        return out.join(" ");
      } catch (e) {
        return "";
      }
    }

    function _readPageContext() {
      var title = document.title || "";
      var url = location.href || "";
      var text = "";
      try {
        // P2: guna pengumpul boilerplate-skip; fallback ke innerText kalau
        // hasil terlalu sedikit (cth. SPA dengan teks dalam node tersembunyi).
        text = collectPageText();
        if (!text || text.length < 200) {
          text = document.body ? (document.body.innerText || "") : "";
        }
      } catch (e) {
        text = "";
      }
      text = text.replace(/\s+/g, " ").trim();
      // P2: kecilkan siling (chat ~4000, bukannya 6000).
      var MAX = 4000;
      if (text.length > MAX) text = text.slice(0, MAX);
      return { title: title, url: url, text: text };
    }

    /**
     * Extract lightweight context from the current page (cached).
     * @param {{force?:boolean}} [opts]  force=true baca semula & invalidasi cache.
     * @returns {{title:string, url:string, text:string}}
     */
    function extractPageContext(opts) {
      try {
        opts = opts || {};
        var url = location.href || "";
        // P4: kongsi cache merentas content-script worlds pada page yang SAMA
        // (overlay + sidebar mungkin muat instans jarvisCore berbeza) guna
        // window global — elak ekstrak DOM dua kali. Background tak boleh baca
        // DOM page cross-origin, jadi ini cara "kongsi cache" yang selamat.
        var shared = null;
        try { if (typeof window !== "undefined") shared = window.__lpJarvisCtxCache; } catch (e) {}
        var cache = shared || _ctxCache;
        var fresh = cache && cache.url === url &&
          (Date.now() - cache.ts) < _ctxCacheTTL;
        if (!opts.force && fresh) {
          return { title: cache.title, url: cache.url, text: cache.text };
        }
        _ctxCache = _readPageContext();
        _ctxCache.ts = Date.now();
        try { if (typeof window !== "undefined") window.__lpJarvisCtxCache = _ctxCache; } catch (e) {}
        return { title: _ctxCache.title, url: _ctxCache.url, text: _ctxCache.text };
      } catch (e) {
        return { title: "", url: "", text: "" };
      }
    }

    /** Paksa baca semula konteks halaman (invalidasi cache). */
    function refreshPageContext() {
      _ctxCache = null;
      try { if (typeof window !== "undefined") window.__lpJarvisCtxCache = null; } catch (e) {}
      return extractPageContext({ force: true });
    }

    /**
     * Strip null bytes, control characters, and cap length so the AI provider
     * never receives raw page text that could contain prompt-injection payloads.
     */
    function sanitizeForPrompt(text, maxLen) {
      if (!text) return "";
      maxLen = maxLen || 4000;
      return String(text)
        .replace(/\0/g, "")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
        .slice(0, maxLen)
        .trim();
    }

    /** Build a context-aware prompt for the AI provider (single turn). */
    function buildContextPrompt(userText, ctx) {
      if (!ctx || !ctx.text) return userText || "";
      return (
        "Konteks halaman semasa yang sedang dibuka oleh pengguna:\n" +
        "Tajuk: " + sanitizeForPrompt(ctx.title) + "\n" +
        "URL: " + sanitizeForPrompt(ctx.url) + "\n" +
        "Kandungan halaman:\n" + sanitizeForPrompt(ctx.text) + "\n\n" +
        "Soalan/arahan pengguna: " + sanitizeForPrompt(userText)
      );
    }

    /**
     * Selectable summary "modes" (copied concept from the LP Sidebar AI). The
     * "auto" mode keeps JARVIS's existing default behaviour; the others ask the
     * provider to shape the output differently.
     * @type {Array<{id:string,label:string}>}
     */
    var SUMMARY_MODES = [
      { id: "auto", label: "Auto" },
      { id: "quick", label: "Quick" },
      { id: "deep", label: "Deep" },
      { id: "action_items", label: "Action Items" },
      { id: "study_notes", label: "Study Notes" },
      { id: "research", label: "Research" },
      { id: "custom", label: "Custom" }
    ];

    /**
     * Selectable writing "tones" applied to chat + summarize output.
     * @type {Array<{id:string,label:string}>}
     */
    var TONE_OPTIONS = [
      { id: "neutral", label: "Neutral" },
      { id: "formal", label: "Formal" },
      { id: "casual", label: "Casual" },
      { id: "educational", label: "Educational" }
    ];

    /** Map a tone id to a Malay instruction line for the provider. */
    function toneInstruction(tone) {
      switch ((tone || "").toLowerCase()) {
        case "formal": return "Guna nada formal dan profesional.";
        case "casual": return "Guna nada santai dan mesra.";
        case "educational": return "Guna nada pendidikan — terang langkah demi langkah seperti mengajar.";
        case "neutral":
        default: return "Guna nada neutral dan objektif.";
      }
    }

    /** Map a summary mode id to a Malay instruction line for the provider. */
    function summaryModeInstruction(mode, customPrompt) {
      switch ((mode || "").toLowerCase()) {
        case "quick":
          return "ARAHAN RINGKASAN: Berikan ringkasan SANGAT PENDEK (2-3 ayat atau maksimum 5 mata sahaja).";
        case "deep":
          return "ARAHAN RINGKASAN: Berikan ringkasan MENDELA dan komprehensif dengan subtajuk (perkara utama, butiran, kesimpulan).";
        case "action_items":
          return "ARAHAN RINGKASAN: Ekstrak dan senaraikan TINDAKAN / PERKARA PERLU DIBUAT (action items) dalam bentuk senarai.";
        case "study_notes":
          return "ARAHAN RINGKASAN: Hasilkan NOTA BELAJAR — konsep utama, definisi, dan poin penting dengan struktur yang kemas untuk disemak.";
        case "research":
          return "ARAHAN RINGKASAN: Hasilkan ringkasan gaya PENYELIDIKAN — latar belakang, dapatan utama, dan soalan/rujukan lanjut.";
        case "custom":
          return customPrompt ? ("ARAHAN RINGKASAN (custom): " + customPrompt) : "";
        case "auto":
        default:
          return "";
      }
    }

    /**
     * Build a multi-turn prompt that includes recent conversation history and
     * the current page context, so the provider "remembers" prior turns.
     * @param {string} currentText
     * @param {{title:string,url:string,text:string}} ctx
     * @param {Array<{role:string,text:string}>} history
     * @returns {string}
     */
    /**
     * Build the "RAG context" block from documents returned by the local
     * semantic search (Fasa 5). Pure/synchronous — the caller is responsible
     * for fetching `ragDocs` (async, via the background) beforehand.
     * @param {Array<{kind:string,category:string,title:string,text:string}>} ragDocs
     * @returns {string} formatted block, or "" when there is nothing to inject.
     */
    function buildRagBlock(ragDocs) {
      if (!Array.isArray(ragDocs) || !ragDocs.length) return "";
      var MAX_DOC = 500; // aksara per dokumen (kawal saiz prompt)
      var lines = [];
      ragDocs.forEach(function (d, i) {
        if (!d) return;
        var label = d.kind === "item" ? "ARTIKEL" : "NOTA";
        if (d.category) label += " \u00b7 " + d.category; // "·"
        var title = d.title ? String(d.title) : "";
        var body = d.text ? String(d.text).replace(/\s+/g, " ").trim() : "";
        if (body.length > MAX_DOC) body = body.slice(0, MAX_DOC) + "\u2026";
        var head = title ? (title + " \u2014 ") : "";
        lines.push("[" + (i + 1) + "] (" + label + ") " + head + body);
      });
      if (!lines.length) return "";
      return (
        "Nota & artikel simpanan pengguna yang mungkin berkaitan " +
        "(rujuk jika relevan, abaikan jika tidak):\n" + lines.join("\n")
      );
    }

    /**
     * Build a compact "page digest" for follow-up turns so the full page body
     * (up to 6000 chars) is NOT re-sent on every message. Keeps the lede
     * (first few sentences) as a cheap grounding anchor — the provider already
     * holds the full page from the first turn in its own conversation.
     * @param {{title:string,url:string,text:string}} ctx
     * @returns {string} digest (may be "" when ctx has no text)
     */
    function buildPageDigest(ctx) {
      if (!ctx || !ctx.text) return "";
      var text = String(ctx.text).replace(/\s+/g, " ").trim();
      if (!text) return "";
      var sentences = text.split(/(?:\.\s|\!\s|\?\s|\.\n|\!\n|\?\n)/);
      var out = [];
      var total = 0;
      var MAX = 700;
      for (var i = 0; i < sentences.length && out.length < 4; i++) {
        var s = (sentences[i] || "").trim();
        if (s.length < 4) continue;
        if (total + s.length > MAX) {
          var room = MAX - total;
          if (room > 20) out.push(s.slice(0, room) + "…");
          break;
        }
        out.push(s);
        total += s.length;
      }
      if (!out.length) return sanitizeForPrompt(ctx.text, 700);
      return out.join(". ") + ".";
    }

    function buildConversationPrompt(currentText, ctx, history, opts) {
      opts = opts || {};
      // ── #6 Memory That Grows: suntik preferensi pengguna dari ingatan JARVIS ──
      // applyToPrompt mengembalikan opts yang digabung (tone/bahasa/summaryMode
      // lalai) + senarai arahan BM (Layer 2 site-specific, Layer 4 time-based).
      // recordUsage memakan balik opts berkesan utk pembelajaran automatik.
      var memoryInstructions = [];
      try {
        if (typeof window !== "undefined" && window.LocalPocketMemoryLayers) {
          var ml = window.LocalPocketMemoryLayers;
          var mres = ml.applyToPrompt(opts, ctx);
          if (mres) {
            if (mres.opts) opts = mres.opts;
            if (mres.instructions && mres.instructions.length) memoryInstructions = mres.instructions;
            ml.recordUsage(opts);
          }
        }
      } catch (e) {}
      var parts = [];
      // P3 kecekapan: kekang saiz history. Kekal KEEP_LAST turn terakhir penuh;
      // turn lebih lama diringkaskan (≤160 char/sebaris) dan turn tertua
      // (lepas OLDER_MAX) dibuang terus supaya saiz request terbatas.
      if (Array.isArray(history) && history.length) {
        var KEEP_LAST = 3;
        var OLDER_MAX = 12;
        var _start = Math.max(0, history.length - KEEP_LAST - OLDER_MAX);
        var _recent = history.slice(-KEEP_LAST);
        var _older = history.slice(_start, history.length - KEEP_LAST);
        if (_older.length) {
          var _oldLines = _older.map(function (t) {
            var who = t.role === "user" ? "Pengguna" : "JARVIS";
            return who + ": " + sanitizeForPrompt(t.text, 160);
          });
          parts.push("Perbualan awal (" + _older.length + " mesej, diringkaskan):\n" + _oldLines.join("\n"));
        }
        var _convo = _recent.map(function (t) {
          var who = t.role === "user" ? "Pengguna" : "JARVIS";
          return who + ": " + sanitizeForPrompt(t.text, 2000);
        }).join("\n");
        parts.push((_older.length ? "Perbualan terkini:\n" : "Perbualan sebelum ini:\n") + _convo);
      }
      // P0 kecekapan: hantar badan penuh halaman HANYA pada turn pertama
      // (history kosong) atau bila opts.fullPageContext dipaksa. Turn
      // seterusnya guna "page digest" padat — provider (Gemini) sudah pegang
      // konteks penuh dari turn pertama dalam perbualannya sendiri.
      if (ctx && (ctx.text || ctx.title || ctx.url)) {
        var isFirstTurn = !(history && history.length);
        var includeFull = isFirstTurn || (opts && opts.fullPageContext);
        var ctxLabel = isFirstTurn
          ? "Konteks halaman semasa yang sedang dibuka oleh pengguna:"
          : "Rujukan halaman semasa (konteks penuh sudah diberi pada awal perbualan):";
        var pageBody = includeFull
          ? sanitizeForPrompt(ctx.text)
          : (buildPageDigest(ctx) || sanitizeForPrompt(ctx.text, 800));
        parts.push(
          ctxLabel + "\n" +
          "Tajuk: " + sanitizeForPrompt(ctx.title) + "\n" +
          "URL: " + sanitizeForPrompt(ctx.url) + "\n" +
          "Kandungan halaman:\n" + pageBody
        );
      }
      // Fasa 5 (RAG): suntik nota/artikel relevan dari carian semantik lokal.
      var ragBlock = buildRagBlock(opts.ragDocs);
      if (ragBlock) {
        parts.push(ragBlock);
        parts.push("Jika maklumat dalam nota/artikel simpanan di atas berkaitan dengan soalan, utamakan dan rujuk ia dalam jawapan. Jika tidak berkaitan, jawab seperti biasa.");
      }
      parts.push("Soalan/arahan pengguna: " + sanitizeForPrompt(currentText));
      parts.push("Jawab soalan di atas secara langsung dan padat dalam bahasa yang sama. JANGAN perkenalkan diri, JANGAN beri pengenalan umum (cth. \"Saya ialah JARVIS…\"), dan JANGAN ulang semula konteks halaman.");
      parts.push("Jika awak mencadangkan pautan/carian (cth. di Shopee, Google, YouTube), BERIKAN URL PENUH yang boleh dibuka terus (contoh: https://shopee.com.my/search?keyword=minyak%20urut%20gerd), bukan sekadar teks seperti \"klik link ini\" atau \"Cari Minyak Urut di Shopee\" tanpa URL. JARVIS boleh buka pautan itu bila pengguna kemudian minta \"buka link tu\".");
      // Output shaping options copied from the LP Sidebar AI (mode + tone).
      if (opts.tone) parts.push(toneInstruction(opts.tone));
      if (opts.summaryMode && opts.summaryMode !== "auto") {
        var sLine = summaryModeInstruction(opts.summaryMode, opts.customPrompt);
        if (sLine) parts.push(sLine);
      }
      // #6 — arahan ingatan (bahasa, tabiat laman, tabiat masa) disuntik di sini.
      if (memoryInstructions.length) parts.push(memoryInstructions.join("\n\n"));
      // #4 Cross-tab Context Awareness: suntik ringkasan tab lain yang relevan
      // supaya JARVIS faham arahan merentas tab (cth. "bandingkan dengan tab 2").
      if (opts && opts.crossTabContexts && opts.crossTabContexts.length) {
        try {
          var ctp = (typeof window !== "undefined" && window.LocalPocketCrossTabPrompts);
          if (ctp && typeof ctp.buildContextBlock === "function") {
            var ctBlock = ctp.buildContextBlock(opts.crossTabContexts, (ctx && ctx.url) || "");
            if (ctBlock) parts.push(ctBlock);
          }
        } catch (e) {}
      }
      // #3 Vision: jika pengguna memuat naik imej/skrin, suruh provider
      // (Gemini) analisis kandungan visual tersebut dalam jawapan.
      if (opts && opts.hasImage) {
        parts.push(
          "PENGGUNA TELAH MEMUAT NAIK SATU IMEJ/SKRIN bersama soalan ini. " +
          "ANALISIS dan terangkan KANDUNGAN VISUAL tersebut (gambar/rajah/carta/jadual/teks dalam imej) dalam jawapan awak, selain menjawab teks soalan."
        );
      }
      return parts.join("\n\n");
    }

    /**
     * Build a summarize-specific prompt that applies the chosen summary mode
     * and tone. Thin wrapper over buildConversationPrompt so callers can keep
     * using a single, consistent builder.
     * @param {string} text  The summarize instruction (e.g. "Ringkaskan halaman ini…").
     * @param {{title:string,url:string,text:string}} ctx
     * @param {Array<{role:string,text:string}>} history
     * @param {Object} [opts]  { summaryMode, tone, customPrompt }
     * @returns {string}
     */
    function buildSummaryPrompt(text, ctx, history, opts) {
      return buildConversationPrompt(text, ctx, history, opts || {});
    }

    /**
     * Build a summary prompt using the Sidebar AI's prompt engine (summaryPromptCore.js).
     * Detects YouTube vs regular web pages and calls the appropriate builder.
     * Falls back to the old simple builder if summaryPromptCore is unavailable.
     * @param {{title:string,url:string,text:string}} ctx  Page context
     * @param {{summaryMode:string,tone:string,customPrompt:string,outputLanguage:string,maxWords:number}} opts
     * @returns {string}
     */
    function buildSidebarSummaryPrompt(ctx, opts) {
      opts = opts || {};
      var core = typeof window !== "undefined" && window.LocalPocketSummaryPromptCore;
      if (!core) {
        return buildConversationPrompt("Ringkaskan halaman ini dalam bahasa Melayu yang mudah.", ctx, [], opts);
      }
      var url = ctx && ctx.url ? ctx.url : "";
      var title = ctx && ctx.title ? ctx.title : "";
      var pageText = ctx && ctx.text ? ctx.text : "";
      var rawMode = String(opts.summaryMode || "auto").toLowerCase();
      var mode = rawMode === "action_items" ? "action" : rawMode === "study_notes" ? "study" : rawMode;
      var isYouTube = /youtube\.com\/watch\b|youtu\.be\//i.test(url);
      var input = {
        url: url,
        title: title,
        summaryMode: mode,
        customPrompt: opts.customPrompt || "",
        outputLanguage: opts.outputLanguage || "ms",
        tone: opts.tone || "neutral",
        maxWords: typeof opts.maxWords === "number" ? opts.maxWords : 0,
        pageText: pageText,
        source: "jarvis"
      };
      if (isYouTube) {
        return core.buildMalayYouTubeUrlOnlyPrompt(input);
      }
      return core.buildMalayWebSummaryPrompt(input);
    }

    /**
     * Build a compact, stable snapshot of the interactive elements on the
     * current page. Each element gets a 1-based index so the planner ("brain")
     * can refer to a precise target via `index` instead of fuzzy text matching.
     * The JARVIS panel's own subtree is skipped so its buttons are never
     * mistaken for page targets.
     *
     * @param {Object} [opts]
     * @param {number} [opts.max]  Max number of elements to include.
     * @returns {Array<{i:number,tag:string,role:string,text:string,aria:string,
     *   placeholder:string,type:string,name:string,value:string,input:boolean}>}
     */
    function collectInteractiveNodes(MAX) {
      var out = [];
      try {
        if (!document || !document.documentElement) return out;
        var _panelRoot = document.getElementById("lp-jarvis-root");
        var _selBtns = document.getElementById("lp-jarvis-sel-buttons");
        function inPanel(node) {
          try {
            return (_panelRoot && _panelRoot.contains(node)) || (_selBtns && _selBtns.contains(node));
          } catch (e) { return false; }
        }
        function visible(node) {
          try {
            if (node.offsetWidth > 0 && node.offsetHeight > 0) return true;
            var r = node.getBoundingClientRect();
            return !!(r && r.width > 0 && r.height > 0);
          } catch (e) { return true; }
        }
        var stack = [document.documentElement];
        var COLLECT_TIMEOUT = 50;
        var collectStarted = Date.now();
        while (stack.length && out.length < MAX) {
          if (Date.now() - collectStarted > COLLECT_TIMEOUT) break;
          var node = stack.pop();
          // A single protected/cross-origin node (e.g. inside a third-party
          // iframe) can throw on property access ("Permission denied to access
          // property nodeType"). Skip just that node and keep scanning instead
          // of aborting the whole snapshot, so one bad node never truncates the
          // element hints / interactive-element map (which would otherwise look
          // like a silent scrape failure).
          try {
            if (!node || !node.tagName) continue;
            if (inPanel(node)) continue;
            var t = node.tagName.toLowerCase();
            var role = (node.getAttribute && node.getAttribute("role")) || "";
            var type = (node.getAttribute && node.getAttribute("type")) || "";
            var isInput = t === "input" || t === "textarea" || t === "select";
            var isInteractive =
              t === "a" || t === "button" || t === "summary" ||
              (t === "input" && (!type || /^(submit|button|reset|text|email|search|password|tel|url|number|checkbox|radio)$/i.test(type))) ||
              t === "textarea" || t === "select" ||
              role === "button" || role === "link" || role === "menuitem" ||
              node.getAttribute && node.getAttribute("contenteditable") === "true";
            if (!isInteractive) {
              // Descend (collect children, shadow DOM, same-origin iframes).
              // Push children in reverse so the LIFO stack yields pre-order
              // (document/top-to-bottom) traversal, matching intuitive indices.
              if (node.children && node.children.length) {
                for (var c = node.children.length - 1; c >= 0; c--) stack.push(node.children[c]);
              }
              if (node.shadowRoot) stack.push(node.shadowRoot);
              if (node.tagName === "IFRAME" && node.contentDocument) {
                try { stack.push(node.contentDocument); } catch (e2) {}
              }
              continue;
            }
            if (!visible(node)) continue;
            out.push(node);
            // Descend so nested actionable elements still get indexed.
            if (node.children && node.children.length) {
              for (var k = node.children.length - 1; k >= 0; k--) stack.push(node.children[k]);
            }
            if (node.shadowRoot) stack.push(node.shadowRoot);
          } catch (e) {
            continue;
          }
        }
      } catch (e) {}
      return out;
    }

    /**
     * Return the live interactive DOM nodes in the same order used by
     * buildDomSnapshot, so a snapshot `index` can be resolved back to a node.
     * @param {Object} [opts]
     * @returns {Array<Element>}
     */
    function getInteractiveNodes(opts) {
      opts = opts || {};
      var MAX = opts.max || 80;
      return collectInteractiveNodes(MAX);
    }

    function buildDomSnapshot(opts) {
      opts = opts || {};
      var MAX = opts.max || 80;
      var nodes = collectInteractiveNodes(MAX);
      function clean(s, n) {
        s = (s || "").replace(/\s+/g, " ").trim();
        n = n || 40;
        return s.length > n ? s.slice(0, n) + "…" : s;
      }
      return nodes.map(function (node, idx) {
        var t = node.tagName.toLowerCase();
        var role = (node.getAttribute && node.getAttribute("role")) || "";
        var type = (node.getAttribute && node.getAttribute("type")) || "";
        var isInput = t === "input" || t === "textarea" || t === "select";
        return {
          i: idx + 1,
          tag: t,
          role: role,
          text: clean(node.textContent),
          aria: clean(node.getAttribute && node.getAttribute("aria-label")),
          placeholder: clean(node.getAttribute && node.getAttribute("placeholder")),
          type: type,
          name: clean(node.getAttribute && node.getAttribute("name")),
          value: isInput ? clean(node.value || node.getAttribute("value"), 30) : "",
          input: isInput
        };
      });
    }

    /**
     * Build a short "observation" of the current page state. Used by the
     * ReAct loop to tell the planner what the page looks like AFTER an action
     * has run, so it can verify success or re-plan a failed step.
     * @returns {{url:string,title:string,text:string,elementCount:number}}
     */
    function buildObservation() {
      try {
        // P1: tindakan DOM (click/fill/scroll) baru sahaja berjalan — baca
        // semula konteks, jangan guna cache yang mungkin sudah lapuk.
        var ctx = extractPageContext({ force: true });
        var snap = buildDomSnapshot({ max: 200 });
        return {
          url: ctx.url || "",
          title: ctx.title || "",
          text: (ctx.text || "").slice(0, 1200),
          elementCount: snap.length
        };
      } catch (e) {
        return { url: "", title: "", text: "", elementCount: 0 };
      }
    }

    /**
     * Build the "brain" prompt sent to the AI provider. The provider acts as
     * the planner: it reads the user command + available tools + page context
     * and must reply with a single JSON action object (no extra text).
     * @param {string} command
     * @param {{title:string,url:string,text:string}} ctx
     * @param {Array<{role:string,text:string}>} history
     * @param {Array<{action:string,desc:string,params?:string[]}>} tools
     * @returns {string}
     */
    function buildPlanPrompt(command, ctx, history, tools, elementHints) {
      var lines = [];
      // PERATURAN WAJIB di atas: paksa model balas JSON sahaja. Tanpa ini, bila
      // arahan kabur model cenderung "berbual" (cth. "Sistem sedia berfungsi…")
      // lalu gagal di-parse sebagai pelan.
      lines.push("PERATURAN WAJIB: Balas HANYA dengan satu objek JSON atau array JSON. JANGAN tulis apa-apa ayat lain, JANGAN gunakan markdown, JANGAN sahut sebagai pembantu, JANGAN kata 'sistem sedia'/'system ready'/'saya boleh'. Jika tidak pasti, balas {\"action\":\"chat\",\"question\":\"<teks asal>\"}.");
      lines.push("");
      lines.push("Anda ialah JARVIS, otak pembantu di dalam ekstensi pelayar 'Local Pocket Reader'. Tugas anda: tentukan tindakan paling sesuai untuk arahan pengguna, KEMUDIAN balas HANYA dengan objek JSON (tiada teks lain, tiada markdown).");
      lines.push("");
      lines.push("Bentuk JSON: {\"action\": \"<nama>\", ...parameter}. Parameter pilihan: query, target, name, field, value, direction (\"up\"/\"down\"), minutes (nombor), question, index.");
      lines.push("- Jika arahan melibatkan BANYAK langkah (cth. 'cari X dan buka N tab berbeza'), balas dengan ARRAY JSON: [{\"action\":\"...\"}, {...}, ...] — satu objek setiap langkah, dilaksanakan secara berurutan. Untuk langkah tunggal, balas objek JSON tunggal.");
      lines.push("- Untuk 'buka N tab', hasilkan N action {\"action\":\"open_url\",\"target\":\"<url berbeza>\"} dengan URL yang berbeza (cth. URL carian YouTube yang berbeza untuk sub-topik berbeza). Jangan buka tab yang sama berulang kali.");
      lines.push("- CONTOH: arahan \"klik butang Langgan\" -> {\"action\":\"click\",\"target\":\"Langgan\"} . Arahan \"ringkaskan halaman\" -> {\"action\":\"summarize\"} . Arahan \"apa itu AI\" -> {\"action\":\"chat\",\"question\":\"apa itu AI\"} .");
      lines.push("");
      lines.push("Senarai tindakan tersedia (action):");
      (tools || []).forEach(function (t) {
        var p = (t.params && t.params.length) ? " [" + t.params.join(", ") + "]" : "";
        lines.push("- " + t.action + p + ": " + t.desc);
      });
      lines.push("");
      lines.push("Peraturan:");
      lines.push("- Jika arahan ialah soalan atau perbualan bebas, balas {\"action\":\"chat\",\"question\":\"<soalan asal>\"}. JANGAN jawab soalan itu; hanya label sebagai chat.");
      lines.push("- 'open_settings' = tetapan add-on ini (BUKAN tetapan Firefox). 'open_url' untuk buka laman web.");
      lines.push("- 'search_library' cari dalam simpanan artikel; 'search_web' cari di internet (buka tab). Untuk 'cari di youtube', GUNA 'search_youtube' dengan query topik, ATAU 'open_youtube_tabs' dengan query dan count=N untuk buka N tab YouTube berbeza. JANGAN guna 'search_web' untuk carian YouTube.");
      lines.push("- 'close_all_tabs' PERLU disahkan pengguna (risky) — pilih hanya jika pengguna minta tutup banyak/all tab.");
       lines.push("- 'click' target = teks yang kelihatan pada butang/pautan. 'fill' field = label medan input, value = teks nak diisi.");
       lines.push("- GROUNDING: Senarai elemen interaktif halaman (snapshot) disediakan di bawah sebagai senarai bernombor [1], [2], … . Untuk 'click' dan 'fill', GUNAKAN 'index' (nombor dari snapshot) apabila ada — ia LEBIH TEPAT daripada teks. Contoh: {\"action\":\"click\",\"index\":7} atau {\"action\":\"fill\",\"index\":3,\"value\":\"a@b.com\"}. Jika tiada snapshot atau index tidak sesuai, barulah guna 'target'/'field' teks. JANGAN teka nombor index yang tiada dalam snapshot.");
      lines.push("- Jika arahan kabur antara web dan library, pilih 'search_web'.");
      lines.push("- Pilih action yang paling hampir dengan niat pengguna walaupun phrasing tidak tepat.");
      lines.push("- GUNAKAN kandungan halaman di bawah untuk tentukan target yang tepat: untuk 'click' pilih label butang/pautan yang BENAR-BENAR wujud dalam halaman (cth. 'Subscribe' / 'Langgan' / 'Follow'), untuk 'fill' padankan medan dengan label borang sebenar. JANGAN teka label yang tidak kelihatan dalam konteks.");
       lines.push("- 'cari <topik> DI YOUTUBE / dalam youtube' = GUNA 'search_youtube' dengan query topik. 'cari <topik> di internet/web' = 'search_web'. 'cari dalam simpanan/library' = 'search_library'.");
      lines.push("- 'cari <topik> dan buka video [itu] di youtube' / 'buka video berkaitan di youtube' = cadangkan BUKA VIDEO YOUTUBE yang berkaitan: JIKA awak tahu URL video spesifik, GUNA 'open_url' dengan 'target':'https://www.youtube.com/watch?v=<id>', 'thumbnail':'https://img.youtube.com/vi/<id>/0.jpg' (gambar kekunci video). JIKA TIDAK tahu video spesifik, GUNA 'search_youtube' dengan query topik. SENTIASA sertakan field 'thumbnail' (https://img.youtube.com/vi/<id>/0.jpg) bila 'target' ialah URL YouTube — ia akan dipaparkan sebagai pratonton. Biarkan pengguna CONFIRM cadangan sebelum membuka (jangan buka terus tanpa kebenaran).");
      lines.push("- 'buka pomodoro' / 'timer' / 'fokus' / 'buka timer' = 'toggle_pomodoro' (mula pemasa fokus), BUKAN 'open_settings'. Jika arahan menyebut tempoh seperti 'N minit' / 'N min' / 'N jam', isikan minutes=N (1 jam = 60). Contoh: 'buka pomodoro dan set ke 10 minit' -> {\"action\":\"toggle_pomodoro\",\"minutes\":10}.");
      lines.push("- 'open_settings' HANYA untuk 'buka tetapan' / 'buka settings' / 'tetapan'. JANGAN pilih open_settings untuk arahan pomodoro/timer.");
      lines.push("- 'open_url' = buka laman web dalam TAB BAHARU. 'navigate' = pergi ke laman web DALAM tab semasa (tukar halaman ini). GUNA 'navigate' bila arahan menyebut 'di halaman ini' / 'kat sini' / 'ganti halaman', atau bila arahan disambung dengan langkah lain yang mesti berlaku PADA halaman tersebut (cth. 'buka youtube dan klik link pertama').");
      lines.push("- Untuk arahan berantai 'buka <X> dan <aksi>' (cth. 'buka github dan klik butang Star', 'buka X dan isi Y', 'buka youtube dan klik link pertama', 'cari youtube <topik> dan klik link pertama'), hasilkan DUA langkah berasingan: [{\"action\":\"navigate\" (atau \"open_url\"), \"target\":\"<url X>\"}, <langkah kedua>]. Langkah kedua (click / fill / scroll / click_first_link) akan dijalankan OLEH JARVIS dalam halaman yang dimuat — JANGAN cuba gabungkan ke dalam satu langkah.");
      lines.push("- 'click_first_link' klik pautan pertama dalam halaman SELEPAS navigasi. 'click' hanya untuk butang/pautan yang ada TEKS kelihatan (cth. 'Langgan', 'Subscribe', 'Star').");
      if (ctx && (ctx.text || ctx.title || ctx.url)) {
        lines.push("");
        lines.push("Konteks halaman semasa yang dibuka pengguna:");
        if (ctx.title) lines.push("Tajuk: " + ctx.title);
        if (ctx.url) lines.push("URL: " + ctx.url);
        if (ctx.text) {
          var planText = ctx.text;
          if (planText.length > MAX_PLAN_CONTEXT_CHARS) {
            planText = planText.slice(0, MAX_PLAN_CONTEXT_CHARS) + " …(dipotong)";
          }
           lines.push("Kandungan halaman (teks, untuk rujukan target/butang/medan):");
           lines.push(planText);
         }
         // Grounded DOM snapshot: a numbered list of interactive elements so
         // the planner can reference precise targets by `index`.
          try {
            var snap = buildDomSnapshot({ max: 40 });
            if (snap && snap.length) {
              lines.push("");
              lines.push("(Ingat: anda MASIH mesti balas HANYA JSON di bawah, bukan terangkan senarai ini.)");
              lines.push("SENARAI ELEMEN INTERAKTIF halaman (guna 'index' untuk click/fill, [input=1] bermaksud boleh diisi):");
              snap.forEach(function (el) {
                var bits = [];
                if (el.text) bits.push("teks:" + el.text);
                if (el.aria) bits.push("aria:" + el.aria);
                if (el.placeholder) bits.push("ph:" + el.placeholder);
                if (el.name) bits.push("name:" + el.name);
                if (el.input) bits.push("[input:" + (el.type || "text") + (el.value ? "=" + el.value : "") + "]");
                lines.push("[" + el.i + "] <" + el.tag + (el.role ? " role=" + el.role : "") + "> " + bits.join(" "));
              });
              lines.push("");
              lines.push("(Jumlah elemen interaktif: " + snap.length + ". Jika target tidak ada dalam senarai, halaman mungkin belum dimuat sepenuhnya — pilih 'navigate'/'open_url' atau 'click_first_link'.)");
            }
          } catch (e) {}
       }
      if (Array.isArray(history) && history.length) {
        lines.push("");
        lines.push("Perbualan lepas (konteks):");
        history.slice(-4).forEach(function (t) {
          lines.push((t.role === "user" ? "Pengguna" : "JARVIS") + ": " + t.text);
        });
      }
      lines.push("");
      lines.push("Arahan pengguna: " + command);
      lines.push("");
      // Learned element memory: hints from previous ReAct corrections on this
      // site, so the planner prefers a known-good `index` for a labelled target.
      if (Array.isArray(elementHints) && elementHints.length) {
        lines.push("INGATAN ELEMEN (dari pembelajaran lalu di laman ini):");
        elementHints.forEach(function (h) {
          lines.push("- butang/medan bernama \"" + h.target + "\" = index " + h.index);
        });
        lines.push("(Guna 'index' di atas untuk click/fill jika sepadan.)");
        lines.push("");
      }
       lines.push("Balas HANYA JSON (objek tunggal ATAU array objek untuk arahan berbilang langkah):");
       return lines.join("\n");
      }

    /**
     * Build the "re-plan" prompt used by the ReAct self-correction loop. When a
     * local DOM action (click/fill) fails, we send the planner the post-action
     * observation plus a fresh DOM snapshot so it can pick a corrected target
     * (by `index`) or fall back to a different action.
     * @param {Object} failedAction  The action object that failed.
     * @param {{url:string,title:string,text:string,elementCount:number}} observation
     * @param {Array<Object>} snapshot  Output of buildDomSnapshot().
     * @returns {string}
     */
    function buildReplanPrompt(failedAction, observation, snapshot) {
      var lines = [];
      lines.push("Anda ialah JARVIS. Satu langkah automasi GAGAL dilaksanakan. Betulkan langkah tersebut berdasarkan pemerhatian halaman SEMASA.");
      lines.push("");
      lines.push("Langkah yang GAGAL: " + JSON.stringify(failedAction));
      lines.push("");
      lines.push("PEMERHATIAN halaman SELEPAS tindakan (ReAct observation):");
      lines.push("URL: " + (observation && observation.url ? observation.url : "(tiada)"));
      lines.push("Tajuk: " + (observation && observation.title ? observation.title : "(tiada)"));
      lines.push("Teks halaman (potongan): " + (observation && observation.text ? observation.text : "(tiada)"));
      lines.push("Bilangan elemen interaktif: " + (observation && observation.elementCount ? observation.elementCount : 0));
      lines.push("");
      if (snapshot && snapshot.length) {
        lines.push("SENARAI ELEMEN INTERAKTIF SEMASA (guna 'index' untuk click/fill):");
        snapshot.forEach(function (el) {
          var bits = [];
          if (el.text) bits.push("teks:" + el.text);
          if (el.aria) bits.push("aria:" + el.aria);
          if (el.placeholder) bits.push("ph:" + el.placeholder);
          if (el.name) bits.push("name:" + el.name);
          if (el.input) bits.push("[input:" + (el.type || "text") + (el.value ? "=" + el.value : "") + "]");
          lines.push("[" + el.i + "] <" + el.tag + (el.role ? " role=" + el.role : "") + "> " + bits.join(" "));
        });
      } else {
        lines.push("Tiada snapshot elemen (halaman mungkin belum dimuat).");
      }
      lines.push("");
      lines.push("Balas HANYA satu objek JSON action yang BETUL. Pilihan:");
      lines.push("- {\"action\":\"click\",\"index\":N} atau {\"action\":\"click\",\"target\":\"<teks butang/pautan>\"}");
      lines.push("- {\"action\":\"fill\",\"index\":N,\"value\":\"<teks>\"} atau {\"action\":\"fill\",\"field\":\"<label>\",\"value\":\"<teks>\"}");
      lines.push("- {\"action\":\"navigate\",\"target\":\"<url>\"} / {\"action\":\"open_url\",\"target\":\"<url>\"} jika halaman salah");
      lines.push("- {\"action\":\"chat\",\"question\":\"<terangkan kenapa gagal>\"} jika tiada elemen sesuai");
      lines.push("JANGAN ulang langkah yang sama jika ia tetap tidak akan berfungsi. Pilih 'index' yang WAJAR wujud dalam senarai di atas.");
      return lines.join("\n");
    }

    /**
     * Build 2-3 offline "follow-up question" suggestions shown under a JARVIS
     * answer. Pure / no network: derives a topic from the user's last question,
     * the page title, or a salient word in the answer, then scaffolds short
     * Malay questions around it. Returns an array of strings (may be empty).
     * @param {{title:string,url:string,text:string}} ctx
     * @param {Array<{role:string,text:string}>} history
     * @param {string} lastAnswer
     * @returns {Array<string>}
     */
    function buildFollowupSuggestions(ctx, history, lastAnswer) {
      var topic = pickFollowupTopic(ctx, history, lastAnswer);
      if (!topic) topic = "topik ini";
      return [
        "Terangkan lebih lanjut tentang " + topic + ".",
        "Berikan contoh berkaitan " + topic + ".",
        "Apakah perkara utama tentang " + topic + "?"
      ];
    }

    // Pick the most relevant topic phrase for follow-up questions, trying (in
    // order): the user's last question (minus question words), the page title,
    // then a salient word from the answer.
    function pickFollowupTopic(ctx, history, lastAnswer) {
      function lastUserQuestion(hist) {
        if (!Array.isArray(hist) || !hist.length) return "";
        for (var i = hist.length - 1; i >= 0; i--) {
          if (hist[i].role === "user") return hist[i].text || "";
        }
        return "";
      }
      function stripQuestionWords(s) {
        s = (s || "").replace(/\?/g, " ").replace(/[^\p{L}\p{N}\s]/gu, " ");
        s = s.replace(/^(apa|apakah|bagaimanakah|bagaimana|mengapakah|mengapa|kenapakah|kenapa|siapakah|siapa|bilakah|bila|di manakah|di mana|dimanakah)\b/i, " ");
        s = s.replace(/^(what|how|why|when|where|who|which|can you|could you|bolehkah|boleh|apakah maksud|maksud)\b/i, " ");
        s = s.replace(/^(saya nak|saya mahu|tolong|terangkan|jelaskan|nak|mahu)\b/i, " ");
        s = s.replace(/\b(ini|tu|tersebut|tentang|pasar|berkenaan|mengenai)\b/gi, " ");
        return s.replace(/\s+/g, " ").trim();
      }
      var q = stripQuestionWords(lastUserQuestion(history));
      if (q && q.length > 2) return q.length > 60 ? q.slice(0, 60) : q;

      var title = (ctx && ctx.title) || "";
      title = title.split(/\s*[\|\-–—:]\s*/)[0].trim();
      if (title && title.length > 2 && title.length <= 60) return title;

      // Fallback: longest alphabetic word (length > 4) in the answer.
      var words = String(lastAnswer || "").split(/\s+/);
      var best = "";
      for (var w = 0; w < words.length; w++) {
        var t = words[w].replace(/[^\p{L}]/gu, "");
        if (t.length > 4 && t.length > best.length) best = t;
      }
      return best;
    }

     /**
      * Parse a raw user message into a structured intent.
     * @param {string} raw
     * @returns {Object}
     */
    /**
     * Extract a duration in minutes from free-form text. Recognises
     * "10 minit", "10 min", "10 m", "10 minute", "2 jam" (×60). Defaults to 25.
     * @param {string} value
     * @returns {number}
     */
    function extractMinutes(value) {
      var t = normalize(value).toLowerCase();
      var m = t.match(/(\d+)\s*(minit|min|minute|m|jam|j)\b/);
      if (m) {
        var n = parseInt(m[1], 10);
        if (/jam|j\b/.test(m[2])) n = n * 60;
        return n > 0 ? n : 25;
      }
      var bare = t.match(/(\d+)/);
      if (bare) {
        var b = parseInt(bare[1], 10);
        return b > 0 ? b : 25;
      }
      return 25;
    }

    function isHelpIntent(raw) {
      var t = normalize(raw).toLowerCase();
      if (!t) return false;
      if (/\b(bantuan|help|tolong|bantu|capabilities|kebolehan|fungsi|kemampuan|senarai arahan|list command|list of command)\b/.test(t)) return true;
      if (/(apa|apakah|what|bagaimana)\b[\s\S]{0,25}\b(boleh|can|kemas|lakukan)\b/.test(t)) return true;
      if (/(boleh|can|able|bisa)\b[\s\S]{0,25}\b(kemas|lakukan)\b/.test(t) && /(kau|anda|you|jarvis|engine|bot|ai|saya|awak)/.test(t)) return true;
      return false;
    }

    function parseIntent(raw) {
      var text = normalize(raw);
      if (!text) return { type: "unknown", raw: text };

      // ---- Slash command: /auto <description> -> cipta automasi (tanpa buka studio) ----
      var autoSlash = String(text).match(/^\s*\/\/auto(?:mation)?\b\s*([\s\S]*)$/i);
      if (autoSlash) {
        return { type: "create_automation", raw: (autoSlash[1] || "").trim() || text };
      }

      var lower = text.toLowerCase();

      // ---- Help / capabilities ----
      if (isHelpIntent(text)) {
        return { type: "help", raw: text };
      }

      // ---- #4 Cross-tab Context Awareness ----
      // Semua cabang di bawah MEMPUNYAI perkataan "tab" secara eksplisit supaya
      // soalan biasa tak terperangkap ke sini.
      var lowerTab = text.toLowerCase();
      var hasTab = /\btab\b/i.test(lowerTab);
      if (hasTab) {
        // Senaraikan semua tab / kumpulan tab.
        if (/(senaraikan|senarai|list|tunjuk\s+(semua\s+)?|show\s+(all\s+)?|apa\s+tab|tab\s+apa|tab\s+yang|berapa\s+tab|kumpulan\s+tab|tab\s+group|group\s+tab)/.test(lowerTab)) {
          if (/(kumpulan|group)/.test(lowerTab)) {
            return { type: "crosstab", action: "list-groups", raw: text };
          }
          return { type: "crosstab", action: "list-tabs", raw: text };
        }
        // Tutup semua tab kecuali ini.
        if (/(tutup\s+(semua\s+)?tab\s+(kecuali|selain)|tutup\s+tab\s+lain|close\s+(all\s+)?(other\s+)?tabs)/.test(lowerTab)) {
          return { type: "crosstab", action: "close-others", raw: text };
        }
        // Tutup tab nombor tertentu (posisi di bar pelayar).
        if (/(tutup|close|matikan)\s+tab\s+\d+/.test(lowerTab) && !/(semua|all|lain|kecuali|selain)/.test(lowerTab)) {
          var cm = lowerTab.match(/(?:tutup|close|matikan)\s+tab\s+(\d+)/);
          return { type: "crosstab", action: "close-tab", ordinal: cm ? Number(cm[1]) : null, raw: text };
        }
        // Bandingkan dengan tab lain.
        if (/(bandingkan|banding|compare|beza(?:kan)?)\b/.test(lowerTab) && /\btab\b/.test(lowerTab)) {
          var compA = text.match(/tab\s+(\d+)/i);
          var compB = text.match(/dengan\s+tab\s+(\d+)|and\s+tab\s+(\d+)|tab\s+(\d+)\s+(?:pula|tu|tersebut)?$/i);
          return {
            type: "crosstab", action: "compare-tabs",
            ordinalA: compA ? Number(compA[1]) : 1,
            ordinalB: compB ? Number(compB[1] || compB[2] || compB[3]) : 2,
            raw: text
          };
        }
        // Huraikan / apa dalam tab N (atau "tadi"/"sebelum"/"kiri").
        if (/(apa|apakah|ceritakan|isi|kandungan|dalam|tentang|pasai|pasal|about|what(?:'s| is)?\s+in)\b/.test(lowerTab)) {
          var tabNum = text.match(/tab\s+(\d+)/i);
          var ref = "prev";
          if (tabNum) ref = Number(tabNum[1]);
          else if (/(kiri|left)/.test(lowerTab)) ref = "left";
          else if (/(kanan|right)/.test(lowerTab)) ref = "right";
          else if (/(tadi|sebelum|lepas|previous|last)/.test(lowerTab)) ref = "prev";
          else if (/(ini|current|sekarang|semasa)/.test(lowerTab)) ref = "current";
          var urlM = text.match(/https?:\/\/\S+/i);
          return { type: "crosstab", action: "describe-tab", ordinal: (typeof ref === "number" ? ref : null), ref: ref, url: urlM ? urlM[0] : null, raw: text };
        }
      }
      // ---- JARVIS self-diagnostic (audit its own faults/weaknesses) ----
      if (/^(jarvis\s+)?(semak|periksa|diagnos|diagnose|audit|scan|check|laporan|report|cari)\b/i.test(lower) &&
          /(diri|sendiri|jarvis|diagnos|self|kesehatan|kesihatan|kelemahan|kerosakan|health|weakness|fault|error|report|audit)/.test(lower)) {
        return { type: "self_check", raw: text };
      }

      // ---- Export JARVIS diagnostic as JSON (for sharing with the developer) ----
      if (/^(eksport|export)\s+(diagnostik|diagnostic|laporan|report)/i.test(lower) ||
          /diagnostik\s+jarvis/.test(lower)) {
        return { type: "export_diagnostic", raw: text };
      }

      // ---- Addon control (checked early to avoid clashing with browser "buka") ----
      if (/(buka|toggle|togol|papar)\s+(ai\s+)?(overlay|overlay ai)/.test(lower) ||
          /toggle\s+ai\s+overlay/.test(lower)) {
        return { type: "toggle_ai_overlay", raw: text };
      }
      if (/(buka|papar|show)\s+(sidebar|ai\s+sidebar)/.test(lower) ||
          /buka\s+panel\s+ai/.test(lower)) {
        return { type: "open_sidebar", raw: text };
      }
      if (/(buka|papar|show)\s+(reader|baca\s+artikel|baca\s+mod|mod\s+baca)/.test(lower) ||
          /buka\s+(library|simpanan|senarai)/.test(lower)) {
        return { type: "open_library", raw: text };
      }
      if (/(buka|toggle|togol|papar)\s*(notes|nota|overlay\s+nota)/.test(lower)) {
        return { type: "toggle_notes", raw: text };
      }
      if (/(buka|toggle|togol|papar)\s*(pomodoro|timer\s+fokus)/.test(lower)) {
        return { type: "toggle_pomodoro", minutes: extractMinutes(text), raw: text };
      }
      if (/(buka|papar|show)\s+(settings?|tetapan|preferences)/.test(lower)) {
        return { type: "open_settings", raw: text };
      }

      // ---- Create automation from natural language (chat, no studio) (#5) ----
      if (/(cipta|buat|hasilkan|wujudkan|setup|setkan|jadualkan|otomasikan)\s+(automasi|otomasi|makro|routine|rutin|workflow)/i.test(lower)) {
        return { type: "create_automation", raw: text };
      }
      // ---- Run / delete a saved automation by name (chat, no studio) (#5) ----
      var runAuto = text.match(/^(?:jalankan|run|laksana|eksekusi)\s+(?:automasi|otomasi|makro|routine|rutin)?\s*[:\-]?\s*(.+)$/i);
      if (runAuto && /(automasi|otomasi|routine|rutin)/i.test(lower)) {
        return { type: "run_automation", name: runAuto[1].trim(), raw: text };
      }
      var delAuto = text.match(/^(?:padam|buang|delete|hapus)\s+(?:automasi|otomasi|makro|routine|rutin)?\s*[:\-]?\s*(.+)$/i);
      if (delAuto && /(automasi|otomasi|routine|rutin)/i.test(lower)) {
        return { type: "delete_automation", name: delAuto[1].trim(), raw: text };
      }

      // ---- Open Automation Studio (#5) ----
      // "buka automation", "studio otomasi", "makro" + (bina/cipta/papar), dsb.
      if (/(automation|otomasi|workflow|studio)/.test(lower) ||
          (/(makro|macro)/.test(lower) && /(buka|papar|bina|cipta|show|open|urus|senarai)/.test(lower))) {
        return { type: "open_automation", raw: text };
      }

      // ---- Save answer to note (before generic "save") ----
      if (/(simpan|save|export|eksport).*(jawapan|answer|terakhir|last).*(ke\s+)?(nota|note)/.test(lower) ||
          /(jawapan|answer).*(ke\s+)?(nota|note)/.test(lower)) {
        return { type: "save_answer_note", raw: text };
      }

      // ---- Save current page ----
      if (/^(simpan|save|arkib|archive|simpankan|simpanlah)\b/.test(lower) ||
          /simpan halaman/.test(lower)) {
        return { type: "save", raw: text };
      }

      // ---- Pomodoro / focus timer ----
      var pomodoroMatch = lower.match(/(?:timer|pomodoro|fokus)\s*(\d+)?/);
      if (pomodoroMatch) {
        var minutes = extractMinutes(text);
        return { type: "pomodoro", minutes: minutes, raw: text };
      }

      // ---- Open category picker ----
      // Jangan tangkap arahan "cari ..." (carian simpanan) walaupun ada
      // perkataan "kategori" (cth. "cari X di kategori picker") — biar ia
      // jatuh ke cabang search di bawah.
      if (/kategori/.test(lower) && !/^\s*cari(?:kan)?\b/i.test(lower)) {
        // Reklasifikasi: pindah/susun semula link antara kategori
        // (cth. "pindahkan link tak sesuai di kategori B ke kategori A").
        if (/(pindah|alih|susun\s+semula|reklasifikasi|reclassify|tukar\s+kategori|kategori\s+yang\s+tak\s+sesuai|link\s+tak\s+sesuai|tidak\s+sesuai\s+di\s+kategori)/.test(lower)) {
          return { type: "reclassify_category", raw: text };
        }
        // Soalan tentang kategori (ada berapa / senaraikan / apa kategori) —
        // jangan buka picker, biar dijawab sebagai category_query.
        if (/(ada\s+berapa|berapa|bilangan|kira|count|how\s+many|senaraikan|senarai\s+kategori|list\s+(the\s+)?categor|nama\s+kategori|kategori\s+apa|kategori\s+mana|apa\s+kategori|what\s+categor|tunjuk\s+kategori|papar\s+kategori|kategori\s+saya)/.test(lower)) {
          return { type: "category_query", raw: text };
        }
        var catMatch = text.match(/buka\s+kategori\s+(.+)/i) || text.match(/kategori\s+(.+)/i);
        return { type: "open-category", query: normalize(catMatch ? catMatch[1] : ""), raw: text };
      }

      // ---- Summarize current page ----
      if (/(ringkaskan|ringkas|summary|summarize|tldr|pendekkan|buatkan ringkasan|buang ringkasan)/.test(lower)) {
        return { type: "summarize", raw: text };
      }

      // ---- Page + DOM control (local) ----
      if (/scroll\s+(ke\s+)?(bawah|down)|tatal\s+(ke\s+)?bawah|tatal\s+bawah/.test(lower)) {
        return { type: "scroll", direction: "down", raw: text };
      }
      if (/scroll\s+(ke\s+)?(atas|up)|tatal\s+(ke\s+)?atas|tatal\s+atas/.test(lower)) {
        return { type: "scroll", direction: "up", raw: text };
      }
      var clickMatch = text.match(/klik\s+(.+)/i) || text.match(/click\s+(.+)/i) ||
                       text.match(/tekan\s+(?:butang\s+)?(.+)/i);
      if (clickMatch && /(klik|click|tekan)/.test(lower)) {
        return { type: "click", target: normalize(clickMatch[1]), raw: text };
      }
      var fillMatch = text.match(/isi\s+(.+?)\s+(?:dengan|with)\s+(.+)/i) ||
                      text.match(/fill\s+(.+?)\s+(?:with|dengan)\s+(.+)/i) ||
                      text.match(/taip\s+(.+?)\s+(?:ke\s+dalam|into)\s+(.+)/i);
      if (fillMatch) {
        // field = first capture, value = second capture
        var field = normalize(fillMatch[1]);
        var value = normalize(fillMatch[2]);
        // For "taip X ke dalam Y" the order is value then field; normalize:
        if (/^taip\b/i.test(text)) {
          var tmp = field; field = value; value = tmp;
        }
        return { type: "fill", field: field, value: value, raw: text };
      }
      // "isi <medan>" TANPA nilai -> minta nilai kemudian (bukan senyap jadi chat)
      var fillBare = text.match(/^(?:isi|fill)\s+(.+)/i);
      if (fillBare && !/dengan|with|ke\s+dalam|into/i.test(lower)) {
        var bf = normalize(fillBare[1]);
        if (bf) return { type: "fill", field: bf, value: "", raw: text };
      }

      // ---- Browser control ----
      if (/tab\s+(baharu|baru|new)|tab\s+baru|new\s+tab|buat\s+tab/.test(lower)) {
        return { type: "new_tab", raw: text };
      }
      if (/tutup\s+(semua|all)\s+tab/.test(lower) || /close\s+all\s+tab/.test(lower)) {
        return { type: "close_all_tabs", risk: "confirm", raw: text };
      }
      if (/tutup\s+tab\s+ini|tutup\s+tab|close\s+this\s+tab|close\s+tab/.test(lower)) {
        return { type: "close_tab", raw: text };
      }
      if (/^(muat\s+semula|reload|refresh|segar\s+semula)\b/.test(lower)) {
        return { type: "reload", raw: text };
      }
      if (/^(ke\s+belakang|undur|back)\b/.test(lower)) {
        return { type: "back", raw: text };
      }
      if (/^(ke\s+hadapan|maju|forward)\b/.test(lower)) {
        return { type: "forward", raw: text };
      }
      if (/^(bookmark|tandakan|penanda|simpan\s+penanda)/.test(lower)) {
        return { type: "bookmark", raw: text };
      }
      // ---- Buka link/artikel dari simpanan (library), bukan carian web ----
      // "buka link berkenaan ai dalam simpanan" -> cari "ai" dlm simpanan,
      // buka URL teratas. Mesti didahulukan sebelum cabang open_url biasa
      // (yang akan buka carian web bila target bukan URL).
      var openLibMatch = text.match(/^buka\s+(?:link|artikel|laman|url|item|simpan)?\s*(?:berkenaan|tentang|pasal|mengenai|berkaitan)?\s*(.+?)\s+(?:di|dalam)\s+(simpanan|library|arkib|save)(?:\s+saya)?\s*$/i);
      if (openLibMatch) {
        var olq = normalize((openLibMatch[1] || "").trim());
        if (olq) return { type: "open_library_link", query: olq, raw: text };
      }

      var openMatch = text.match(/buka\s+(?:laman\s+|tapak\s+|website\s+|url\s+)?(.+)/i) ||
                      text.match(/pergi\s+ke\s+(.+)/i) ||
                      text.match(/navigasi\s+ke\s+(.+)/i) ||
                      text.match(/open\s+(?:page\s+)?(.+)/i);
      // A "cari ..." command must be handled by the search branch below, not as
      // an open_url — otherwise "cari X dan buka Y di youtube" gets misparsed as
      // open_url with a garbage target and opens a web search directly.
      if (openMatch && !/^cari\b/i.test(lower)) {
        return { type: "open_url", target: normalize(openMatch[1]), raw: text };
      }

      // ---- Search (library and/or web) ----
      var searchMatch = text.match(/cari(?:kan)?\s+(.+)/i);
      if (searchMatch) {
        var q = normalize(searchMatch[1]);
        // "ini/ni/sini" ialah rujukan DEIKTIS kepada halaman SEMASA — JANGAN
        // bawa masuk ke dalam query carian (cth. "cari anime ini" -> "anime",
        // bukan buka Google dengan "anime ini").
        function stripDeictic(s) {
          return s
            .replace(/\b(?:di|kat|dalam)\s*sini\b/gi, " ")
            .replace(/dalam\s*page\s*ini|page\s*ini|halaman\s*ini|laman\s*ini|sini\s*ni/gi, " ")
            .replace(/\b(?:ini|ni|sini)\b/gi, " ")
            .replace(/\s{2,}/g, " ")
            .trim();
        }
        q = stripDeictic(q);
        var inLibrary = /(dalam simpanan|dalam library|dalam arkib|dalam save|simpanan saya|library saya|arkib saya|tersimpan|kategori picker|category picker|dalam kategori|di kategori|dalam picker|di picker)/.test(lower);
        var inWeb = /(di web|internet|google|dalam talian|online|dalaman)/.test(lower);
        var inYouTube = /youtube/i.test(lower);
        // Buang frasa skop library + kata hubung ("berkenaan/tentang/pasal") supaya
        // query jadi topik bersih (cth. "berkenaan ai di kategori picker" -> "ai").
        if (inLibrary) {
          q = q
            .replace(/\b(?:di|dalam)\s+(?:kategori\s+picker|category\s+picker|kategori|picker|simpanan(?:\s+saya)?|library(?:\s+saya)?|arkib(?:\s+saya)?|save)\b/gi, " ")
            .replace(/\b(?:kategori\s+picker|category\s+picker|tersimpan)\b/gi, " ")
            .replace(/^\s*(?:berkenaan|tentang|pasal|mengenai|berkaitan)\s+/i, "")
            .replace(/\s{2,}/g, " ")
            .trim();
        }
        // Explicit YouTube scope: "cari X di youtube" / "buka di youtube" / "dan
        // buka di youtube". Strip the youtube phrase so the query is just the
        // topic (e.g. "abdul hadi"), and keep it ambiguous so the overlay thinks
        // (AI brain) + confirms before opening the YouTube search.
        if (inYouTube) {
          // Strip the whole "buka ... di/dalam youtube" tail (any words between,
          // e.g. "buka video itu di youtube") so the query is just the topic.
          var ytQuery = q
            .replace(/\b(?:dan\s+)?buka(?:kan)?\b[\s\S]*?\b(?:di|dalam)\s+youtube\b/gi, " ")
            .replace(/\b(?:dan\s+)?buka\s+youtube\b/gi, " ")
            .replace(/\b(?:di|dalam)\s+youtube\b/gi, " ")
            .replace(/\byoutube\b/gi, " ")
            .replace(/\s{2,}/g, " ")
            .trim();
          return { type: "search", query: ytQuery || q, mode: "youtube", ambiguous: true, raw: text };
        }
        var mode = "both";
        if (inLibrary && !inWeb) mode = "library";
        else if (inWeb && !inLibrary) mode = "web";
        // `ambiguous` = plain "cari X" with no explicit scope (web/library/halaman).
        // The overlay uses it to think (AI brain) + confirm before acting.
        return { type: "search", query: q, mode: mode, ambiguous: mode === "both", raw: text };
      }

      // ---- Clipboard (local, no network) ----
      if (/(salin|copy)\s+(jawapan|terakhir|last|answer)/.test(lower)) {
        return { type: "copy_answer", raw: text };
      }
      if (/(salin|copy)\s*(url|pautan\s+halaman)/.test(lower)) {
        return { type: "copy_url", raw: text };
      }
      if (/(salin|copy)\s*(sebagai\s+)?markdown/.test(lower)) {
        return { type: "copy_markdown", raw: text };
      }

      // ---- Selection-based AI (needs provider, but still a distinct action) ----
      if (/terjemah\s*(pilihan|selection|highlight|teks\s+dipilih)/.test(lower) ||
          /translate\s*(selection|pilihan)/.test(lower)) {
        return { type: "translate_selection", query: "", raw: text };
      }
      if (/ringkas(?:kan)?\s*(pilihan|selection|highlight|teks\s+dipilih)/.test(lower) ||
          /summari[sz]e\s*(selection|pilihan)/.test(lower)) {
        return { type: "summarize_selection", query: "", raw: text };
      }

      // ---- Browser extras (local) ----
      if (/^(cetak|print)\b/.test(lower) || /cetak\s+halaman/.test(lower)) {
        return { type: "print_page", raw: text };
      }
      if (/(hasilkan|salina|duplicate|buat)\s+(tab|salina)/.test(lower) || /duplicate\s+tab/.test(lower)) {
        return { type: "duplicate_tab", raw: text };
      }
      var zoomMatch = lower.match(/zum\s*(masuk|keluar|in|out)/) || lower.match(/(zoom)\s*(in|out)/);
      if (zoomMatch) {
        var dir = /(keluar|out)/.test(zoomMatch[1] || zoomMatch[2] || "") ? "out" : "in";
        return { type: "zoom", direction: dir, raw: text };
      }

      // ---- Click the first link (local, no network) ----
      if (/klik\s+(link|pautan)\s+pertama/.test(lower) || /click\s+first\s+link/.test(lower)) {
        return { type: "click_first_link", raw: text };
      }

      // ---- Default: free-form AI chat ----
      return { type: "chat", raw: text };
    }

    /**
     * Normalize a command phrase for learned-command matching: lowercase, strip
     * punctuation, collapse whitespace.
     * @param {string} text
     * @returns {string}
     */
    function normalizeCommand(text) {
      var t = (text || "").toLowerCase();
      try {
        t = t.replace(/[^\p{L}\p{N}\s]/gu, " ");
      } catch (e) {
        // Fallback for engines without Unicode property escapes.
        t = t.replace(/[^a-z0-9\s]/g, " ");
      }
      return t.replace(/\s+/g, " ").trim();
    }

    /**
     * Normalize a command PHRASE for learned-command matching/learning. Like
     * normalizeCommand but also collapses common Malay slang so near-duplicate
     * commands merge (e.g. "buka youtube d page ni" == "buka youtube di page ini").
     * Intentionally separate from normalizeCommand so element-target keys (which
     * can be a single letter like "d") are NOT altered.
     * @param {string} text
     * @returns {string}
     */
     function normalizeCommandPhrase(text) {
       var t = normalizeCommand(text);
       if (!t) return t;
       t = t.replace(/\bni\b/g, "ini");
       t = t.replace(/\bd\b/g, "di");
       // Collapse common Malay slang/dialect tokens so near-duplicate commands
       // merge and short chat-style variants resolve to the right capability.
       // Applied as whole-word replacements only so embedded substrings in
       // longer words are never touched.
       t = t.replace(/\bx\b/g, "tidak");
       t = t.replace(/\btk\b/g, "tidak");
       t = t.replace(/\bjgk\b/g, "juga");
       t = t.replace(/\bskali\b/g, "sekali");
       t = t.replace(/\btlg\b/g, "tolong");
       return t.replace(/\s+/g, " ").trim();
     }

    /**
     * Token-overlap (Jaccard) similarity between two normalized phrases, 0..1.
     * @param {string} a
     * @param {string} b
     * @returns {number}
     */
    function commandSimilarity(a, b) {
      var sa = (a || "").split(" ").filter(Boolean);
      var sb = (b || "").split(" ").filter(Boolean);
      if (!sa.length || !sb.length) return 0;
      var setA = {};
      var setB = {};
      sa.forEach(function (w) { setA[w] = 1; });
      sb.forEach(function (w) { setB[w] = 1; });
      var inter = 0;
      sa.forEach(function (w) { if (setB[w]) inter++; });
      var union = 0;
      var seen = {};
      sa.concat(sb).forEach(function (w) { if (!seen[w]) { seen[w] = 1; union++; } });
      return union ? inter / union : 0;
    }

    /**
     * Find the best matching learned command for `text`. Returns the learned
     * entry (with its `plan`) or null. Exact normalized match scores 1; otherwise
     * a token-overlap >= 0.6 is required (scaled down so exact always wins ties).
     * @param {string} text
     * @param {Array<{phrase:string,plan:*,site:?string,hits:number}>} learned
     * @returns {Object|null}
     */
    function matchLearnedCommand(text, learned) {
      var q = normalizeCommandPhrase(text);
      if (!q || !Array.isArray(learned) || !learned.length) return null;
      var best = null, bestScore = 0;
      learned.forEach(function (e) {
        var key = normalizeCommandPhrase(e.phrase);
        if (!key) return;
        var score = 0;
        if (key === q) score = 1;
        else {
          var sim = commandSimilarity(q, key);
          score = sim >= 0.6 ? sim * 0.9 : 0;
        }
        if (score > bestScore) { bestScore = score; best = e; }
      });
      return bestScore >= 0.6 ? best : null;
    }

    /**
     * Detect an explicit memory export/import command (works offline, no AI).
     * @param {string} text
     * @returns {"export"|"import"|null}
     */
    function parseMemoryCommand(text) {
      var t = normalize(text).toLowerCase();
      if (/(eksport|export)/.test(t) && /(ingatan|memory|memori)/.test(t)) return "export";
      if (/(import|muat\s*(masuk|naik)|load)/.test(t) && /(ingatan|memory|memori)/.test(t)) return "import";
      return null;
    }

    /* ---------- Macro Validation Engine ---------- */
    // Resolve a single macro step to the name of another macro it would run,
    // mirroring the overlay's matchMacro: strip a leading "jalankan/run/execute/
    // laksana [makro]" verb, normalize, and look the name up in the macros map.
    // Returns the normalized macro name or null when the step is not a macro
    // reference.
    function resolveMacroRef(cmd, macros) {
      var lower = String(cmd || "").toLowerCase().trim();
      var m = lower.match(/^(?:jalankan|run|execute|laksana)\s+(?:makro\s+)?(.+)$/);
      var nm = normalizeCommand(m ? m[1] : cmd);
      if (nm && macros && Object.prototype.hasOwnProperty.call(macros, nm) &&
          Array.isArray(macros[nm]) && macros[nm].length) {
        return nm;
      }
      return null;
    }

    // Validate a macro's command chain BEFORE it is enqueued/run. Pure logic
    // (never throws, produces no user-facing text — the caller composes any
    // message). It does two things:
    //   1. Cycle detection: walks the macro reference graph (a step that runs
    //      another macro) with DFS and reports self-reference / mutual cycles,
    //      which would otherwise cause an infinite run loop.
    //   2. Step classification: labels each DIRECT step as
    //      empty | macro | recognized | chat, so the caller can warn about
    //      steps that will silently fall back to the AI ("chat").
    // Params:
    //   name      - the macro name being validated (its stored chain is walked).
    //   commands  - the direct chain to classify; also used as the start node's
    //               children so an unsaved/preview chain can be validated.
    //   macros    - the full { name: [cmd,...] } map, for graph traversal.
    //   options   - { isRecognized(cmd) } optional predicate; the overlay knows
    //               about learned/management commands this core does not, so it
    //               supplies the "is this a non-chat command" test. Falls back
    //               to parseIntent(cmd).type !== "chat".
    function validateMacroChain(name, commands, macros, options) {
      options = options || {};
      var startName = normalizeCommand(name);
      var isRecognized = typeof options.isRecognized === "function" ? options.isRecognized : null;
      var MAX_DEPTH = options.maxDepth || 100;
      macros = macros || {};

      function childrenOf(nm) {
        if (nm === startName && Array.isArray(commands)) return commands;
        return Array.isArray(macros[nm]) ? macros[nm] : [];
      }

      // Depth-first search over the macro reference graph; a back-edge to any
      // name already on the current stack is a cycle.
      var cyclePath = null;
      function dfs(nm, stack) {
        if (stack.indexOf(nm) !== -1) { cyclePath = stack.concat(nm); return true; }
        if (stack.length > MAX_DEPTH) { cyclePath = stack.concat(nm); return true; }
        var kids = childrenOf(nm);
        var next = stack.concat(nm);
        for (var i = 0; i < kids.length; i++) {
          var ref = resolveMacroRef(kids[i], macros);
          if (ref && dfs(ref, next)) return true;
        }
        return false;
      }
      var cyclic = dfs(startName, []);

      // Classify the start macro's direct steps.
      var direct = Array.isArray(commands) ? commands : childrenOf(startName);
      var counts = { total: 0, empty: 0, macro: 0, recognized: 0, chat: 0 };
      var steps = direct.map(function (cmd) {
        counts.total++;
        var trimmed = String(cmd || "").trim();
        if (!trimmed) { counts.empty++; return { cmd: cmd, kind: "empty" }; }
        var ref = resolveMacroRef(trimmed, macros);
        if (ref) { counts.macro++; return { cmd: trimmed, kind: "macro", ref: ref }; }
        var recognised = isRecognized ? !!isRecognized(trimmed) : (parseIntent(trimmed).type !== "chat");
        if (recognised) { counts.recognized++; return { cmd: trimmed, kind: "recognized" }; }
        counts.chat++;
        return { cmd: trimmed, kind: "chat" };
      });
      var runnable = steps.filter(function (s) { return s.kind !== "empty"; })
                          .map(function (s) { return s.cmd; });

      return {
        ok: !cyclic && runnable.length > 0,
        name: startName,
        cyclic: cyclic,
        cyclePath: cyclePath,
        steps: steps,
        runnable: runnable,
        counts: counts
      };
    }

    // ──────────────────────────────────────────────────────────────────
    // Conflict Detection — Fasa 1: Resolution Mode
    // ──────────────────────────────────────────────────────────────────

    var CONFLICT_TYPES = {
      SEARCH_SCOPE: "search_scope",
      OPEN_LOCATION: "open_location",
      ACTION_AMBIGUOUS: "action_ambiguous",
      MULTI_TARGET: "multi_target",
      RISKY_CONFIRM: "risky_confirm",
      PLAN_ALTERNATIVES: "plan_alternatives"
    };

    function detectConflicts(command, intent, ctx) {
      var conflicts = [];
      if (!intent) return conflicts;
      var text = (command || "").trim();
      var lower = text.toLowerCase();
      if (intent.type === "search" && intent.ambiguous) {
        conflicts.push(buildSearchScopeConflict(intent.query || text));
      }
      if (intent.type === "open_url") {
        var cue = extractOpenCue(text);
        if (cue === "ask") {
          conflicts.push(buildOpenLocationConflict(intent.target || text));
        }
      }
      var actionAmb = detectActionAmbiguity(text, intent);
      if (actionAmb) conflicts.push(actionAmb);
      if (intent.risk === "confirm") {
        conflicts.push(buildRiskyConfirmConflict(intent.type));
      }
      return conflicts;
    }

    function buildSearchScopeConflict(query) {
      var q = query || "";
      return {
        id: "search_scope_" + Date.now().toString(36),
        type: CONFLICT_TYPES.SEARCH_SCOPE,
        label: "Carian: nak cari di mana?",
        description: "Arahan '" + q.slice(0, 60) + "' boleh ditafsir dalam beberapa cara.",
        alternatives: [
          { id: "web", label: "Web", description: "Cari di internet (Google)", preview: "Buka tab baru dengan carian Google", plan: { action: "search_web", query: q } },
          { id: "youtube", label: "YouTube", description: "Cari video di YouTube", preview: "Buka YouTube dengan carian", plan: { action: "search_youtube", query: q } },
          { id: "library", label: "Simpanan", description: "Cari dalam artikel/library tersimpan", preview: "Cari dalam koleksi artikel tersimpan", plan: { action: "search_library", query: q } }
        ],
        timeout_seconds: 30, allow_edit: true, allow_custom: true
      };
    }

    function buildOpenLocationConflict(target) {
      var t = (target || "").slice(0, 50);
      return {
        id: "open_loc_" + Date.now().toString(36),
        type: CONFLICT_TYPES.OPEN_LOCATION,
        label: "Buka '" + t + "' di mana?",
        description: "Pilih lokasi untuk buka pautan ini.",
        alternatives: [
          { id: "this", label: "Halaman ini", description: "Gantikan halaman semasa", preview: "Navigasi dalam tab ini", plan: { action: "navigate", target: target } },
          { id: "new", label: "Tab baru", description: "Buka dalam tab baharu", preview: "Buka dalam tab baharu", plan: { action: "open_url", target: target } }
        ],
        timeout_seconds: 30, allow_edit: true, allow_custom: false
      };
    }

    function buildRiskyConfirmConflict(intentType) {
      var desc = describeRiskyAction(intentType);
      return {
        id: "risky_" + Date.now().toString(36),
        type: CONFLICT_TYPES.RISKY_CONFIRM,
        label: "Tindakan berisiko",
        description: desc,
        alternatives: [
          { id: "proceed", label: "Ya, teruskan", description: desc, preview: desc, plan: { action: intentType } },
          { id: "cancel", label: "Batal", description: "Batalkan tindakan ini", preview: "Tiada tindakan", plan: null }
        ],
        timeout_seconds: 20, allow_edit: false, allow_custom: false
      };
    }

    function detectActionAmbiguity(text, intent) {
      var lower = (text || "").toLowerCase();
      if (/^padam\b/.test(lower) || /^delete\b/.test(lower) || /^buang\b/.test(lower)) {
        return {
          id: "action_amb_" + Date.now().toString(36),
          type: CONFLICT_TYPES.ACTION_AMBIGUOUS,
          label: "Arahan kabur: 'padam' apa?",
          description: "Tindakan 'padam' boleh merujuk kepada beberapa perkara.",
          alternatives: [
            { id: "close_tab", label: "Tutup tab", description: "Tutup tab semasa", preview: "Menutup tab semasa", plan: { action: "close_tab" } },
            { id: "bookmark", label: "Padam penanda buku", description: "Buang penanda buku", preview: "Membuang penanda buku", plan: { action: "bookmark", remove: true } }
          ],
          timeout_seconds: 25, allow_edit: false, allow_custom: false
        };
      }
      return null;
    }

    function extractOpenCue(text) {
      var lower = (text || "").toLowerCase();
      if (/(di sini|dalam tab ini|halaman ini|kat sini)\b/.test(lower)) return "this";
      if (/(tab baharu|tab baru|new tab)\b/.test(lower)) return "new";
      if (/^(buka|open)\b/.test(lower)) return "ask";
      return null;
    }

    function describeRiskyAction(intentType) {
      var map = {
        close_tab: "Tutup tab semasa.",
        close_all_tabs: "Tutup SEMUA tab.",
        back: "Kembali ke halaman sebelumnya.",
        forward: "Pergi ke halaman seterusnya.",
        bookmark: "Tambah / buang penanda buku.",
        print_page: "Cetak halaman semasa.",
        duplicate_tab: "Buat salinan tab semasa.",
        zoom: "Ubah saiz zum halaman."
      };
      return map[intentType] || "Tindakan ini tidak boleh dibatalkan.";
    }

    return {
      parseIntent: parseIntent,
      isHelpIntent: isHelpIntent,
      extractPageContext: extractPageContext,
      refreshPageContext: refreshPageContext,
      buildContextPrompt: buildContextPrompt,
      buildRagBlock: buildRagBlock,
      buildPageDigest: buildPageDigest,
      buildConversationPrompt: buildConversationPrompt,
      buildSummaryPrompt: buildSummaryPrompt,
      buildSidebarSummaryPrompt: buildSidebarSummaryPrompt,
      buildPlanPrompt: buildPlanPrompt,
      buildDomSnapshot: buildDomSnapshot,
      getInteractiveNodes: getInteractiveNodes,
      buildObservation: buildObservation,
      buildReplanPrompt: buildReplanPrompt,
      buildFollowupSuggestions: buildFollowupSuggestions,
      normalizeCommand: normalizeCommand,
      normalizeCommandPhrase: normalizeCommandPhrase,
      commandSimilarity: commandSimilarity,
      matchLearnedCommand: matchLearnedCommand,
      parseMemoryCommand: parseMemoryCommand,
      validateMacroChain: validateMacroChain,
      isUrl: isUrl,
      toUrl: toUrl,
      sanitizeForPrompt: sanitizeForPrompt,
      SUMMARY_MODES: SUMMARY_MODES,
      TONE_OPTIONS: TONE_OPTIONS,
      summaryModeInstruction: summaryModeInstruction,
      toneInstruction: toneInstruction,
      CONFLICT_TYPES: CONFLICT_TYPES,
      detectConflicts: detectConflicts,
      buildSearchScopeConflict: buildSearchScopeConflict,
      buildOpenLocationConflict: buildOpenLocationConflict,
      buildRiskyConfirmConflict: buildRiskyConfirmConflict,
      detectActionAmbiguity: detectActionAmbiguity,
      extractOpenCue: extractOpenCue,
      describeRiskyAction: describeRiskyAction
    };
  })();

  if (typeof window !== "undefined") {
    window.LocalPocketJarvisCore = JarvisCore;
    // #6 — mula muat profil ingatan JARVIS ke cache (background, tidak sekat).
    try {
      if (window.LocalPocketMemoryLayers && typeof window.LocalPocketMemoryLayers.init === "function") {
        window.LocalPocketMemoryLayers.init();
      }
    } catch (e) {}
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = JarvisCore;
  }
})();
