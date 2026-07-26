/**
 * Local Pocket Reader — JARVIS Proactive Indicator (#3.2 Smart Badge/Indicator)
 *
 * UI lencana/titik terapung kecil yang muncul bila JARVIS ada cadangan proaktif
 * (dijana oleh core/proactiveEngine.js). Ia TIDAK mengganggu: hanya titik kecil
 * berdenyut di penjuru. Pengguna klik untuk lihat cadangan, kemudian pilih
 * terima / tolak / abai.
 *
 * Modul UI tulen. Attach ke `window.LocalPocketProactiveIndicator`.
 * Guna style sedia ada (var / function expressions).
 */
(function (globalScope) {
  "use strict";

  if (typeof document === "undefined") return;

  var DOT_ID = "lp-jarvis-proactive-dot";
  var POP_ID = "lp-jarvis-proactive-pop";

  var mounted = false;
  var container = null;
  var dotEl = null;
  var popEl = null;
  var popMsgEl = null;
  var popAcceptEl = null;
  var popRejectEl = null;
  var current = null;      // cadangan semasa
  var handlers = {};       // { onAccept, onReject, onDismiss }
  var popOpen = false;

  function el(tag, props, children) {
    var e = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === "text") e.textContent = props[k];
        else if (k === "className") e.className = props[k];
        else if (k === "style") e.style.cssText = props[k];
        else e.setAttribute(k, props[k]);
      });
    }
    if (children) children.forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  // Gaya kritikal ditetapkan secara inline supaya lencana kekal kelihatan walau
  // stylesheet JARVIS tidak dimuat pada halaman tertentu.
  function baseDotStyle() {
    return [
      "position:fixed",
      "right:18px",
      "bottom:18px",
      "width:44px",
      "height:44px",
      "border-radius:999px",
      "background:linear-gradient(135deg,#4a90ff,#8a5cff)",
      "box-shadow:0 4px 16px rgba(60,90,220,0.5)",
      "cursor:pointer",
      "z-index:2147483646",
      "display:none",
      "align-items:center",
      "justify-content:center",
      "font:18px/1 system-ui,sans-serif",
      "color:#fff",
      "border:2px solid rgba(255,255,255,0.25)",
      "user-select:none"
    ].join(";");
  }

  function basePopStyle() {
    return [
      "position:fixed",
      "right:18px",
      "bottom:70px",
      "width:280px",
      "max-width:calc(100vw - 36px)",
      "background:#1e2440",
      "color:#e6ecff",
      "border:1px solid rgba(120,170,255,0.35)",
      "border-radius:12px",
      "box-shadow:0 8px 28px rgba(0,0,0,0.45)",
      "padding:14px",
      "z-index:2147483647",
      "display:none",
      "font:13px/1.5 system-ui,sans-serif"
    ].join(";");
  }

  function build() {
    dotEl = el("div", {
      id: DOT_ID,
      className: "lp-jarvis-proactive-dot",
      style: baseDotStyle(),
      title: "JARVIS ada cadangan — klik untuk lihat",
      "role": "button",
      "aria-label": "Cadangan JARVIS"
    }, [ el("span", { text: "💡" }) ]);

    popMsgEl = el("div", { className: "lp-jarvis-proactive-msg", style: "margin-bottom:12px;" });

    popAcceptEl = el("button", {
      className: "lp-jarvis-proactive-accept",
      text: "Ya",
      style: "border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-weight:700;" +
             "background:linear-gradient(135deg,#4a90ff,#8a5cff);color:#fff;font-size:12px;"
    });
    popRejectEl = el("button", {
      className: "lp-jarvis-proactive-reject",
      text: "Tak payah",
      style: "border:none;border-radius:8px;padding:6px 12px;cursor:pointer;" +
             "background:rgba(255,255,255,0.1);color:#c7d2f0;font-size:12px;"
    });
    var closeEl = el("button", {
      className: "lp-jarvis-proactive-close",
      text: "×",
      title: "Abai (jangan tunjuk sekarang)",
      style: "position:absolute;top:6px;right:8px;border:none;background:transparent;" +
             "color:#8b96bf;cursor:pointer;font-size:16px;line-height:1;"
    });
    var actions = el("div", {
      className: "lp-jarvis-proactive-actions",
      style: "display:flex;gap:8px;justify-content:flex-end;"
    }, [ popRejectEl, popAcceptEl ]);

    popEl = el("div", {
      id: POP_ID,
      className: "lp-jarvis-proactive-pop",
      style: basePopStyle()
    }, [ closeEl, popMsgEl, actions ]);

    dotEl.addEventListener("click", function (e) {
      e.stopPropagation();
      togglePop();
    });
    popAcceptEl.addEventListener("click", function (e) {
      e.stopPropagation();
      accept();
    });
    popRejectEl.addEventListener("click", function (e) {
      e.stopPropagation();
      reject();
    });
    closeEl.addEventListener("click", function (e) {
      e.stopPropagation();
      dismiss();
    });

    (container || document.body || document.documentElement).appendChild(dotEl);
    (container || document.body || document.documentElement).appendChild(popEl);
  }

  function mount(opts) {
    opts = opts || {};
    handlers = {
      onAccept: opts.onAccept || null,
      onReject: opts.onReject || null,
      onDismiss: opts.onDismiss || null
    };
    if (opts.container) container = opts.container;
    if (mounted) return;
    try { build(); mounted = true; } catch (e) { mounted = false; }
  }

  function openPop() {
    if (!popEl) return;
    popEl.style.display = "block";
    popOpen = true;
  }
  function closePop() {
    if (!popEl) return;
    popEl.style.display = "none";
    popOpen = false;
  }
  function togglePop() {
    if (popOpen) closePop(); else openPop();
  }

  function show(suggestion) {
    if (!mounted) return;
    if (!suggestion) return;
    current = suggestion;
    if (popMsgEl) popMsgEl.textContent = suggestion.message || "JARVIS ada cadangan untuk halaman ini.";
    if (popAcceptEl) popAcceptEl.textContent = suggestion.acceptLabel || "Ya";
    if (dotEl) {
      dotEl.style.display = "flex";
      dotEl.classList.add("lp-jarvis-proactive-pulse");
    }
    // Titik sahaja pada mulanya (tidak mengganggu). Popover dibuka bila diklik.
    closePop();
  }

  function hide() {
    current = null;
    if (dotEl) {
      dotEl.style.display = "none";
      dotEl.classList.remove("lp-jarvis-proactive-pulse");
    }
    closePop();
  }

  function accept() {
    var s = current;
    hide();
    if (s && handlers.onAccept) { try { handlers.onAccept(s); } catch (e) {} }
  }
  function reject() {
    var s = current;
    hide();
    if (s && handlers.onReject) { try { handlers.onReject(s); } catch (e) {} }
  }
  function dismiss() {
    var s = current;
    hide();
    if (s && handlers.onDismiss) { try { handlers.onDismiss(s); } catch (e) {} }
  }

  var api_export = {
    mount: mount,
    show: show,
    hide: hide,
    isMounted: function () { return mounted; },
    isVisible: function () { return !!(dotEl && dotEl.style.display !== "none"); }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api_export;
  if (globalScope && typeof globalScope === "object") globalScope.LocalPocketProactiveIndicator = api_export;

})(typeof globalThis !== "undefined" ? globalThis : this);
