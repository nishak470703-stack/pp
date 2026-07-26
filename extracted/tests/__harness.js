const fs = require("fs");
const { JSDOM } = require("jsdom");

const code = fs.readFileSync("notesOverlay.js", "utf8");

const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
  runScripts: "outside-only",
  pretendToBeVisual: true,
});

const { window } = dom;

// mock chrome/browser API
const store = {};
window.browser = {
  storage: {
    local: {
      get: (keys) => Promise.resolve(keys.reduce((acc, k) => { acc[k] = store[k]; return acc; }, {})),
      set: (obj) => { Object.assign(store, obj); return Promise.resolve(); },
    },
    onChanged: { addListener: () => {} },
  },
  runtime: {
    getURL: (p) => "https://example.com/" + p,
    onMessage: { addListener: (fn) => { window.__msgHandler = fn; } },
  },
};
window.chrome = window.browser;

// shims
window.Element.prototype.scrollIntoView = function () {};
window.Element.prototype.focus = window.Element.prototype.focus || function () {};
window.cancelAnimationFrame = (id) => clearTimeout(id);
if (!window.Element.prototype.attachShadow) {
  window.Element.prototype.attachShadow = function () { return this; };
}

const errors = [];
window.addEventListener("error", (e) => errors.push(e.error || e.message));

try {
  const fn = new window.Function(code);
  fn.call(window);
  console.log("IIFE executed without top-level throw");
} catch (e) {
  console.log("TOP-LEVEL THROW:", e && e.stack ? e.stack : e);
  process.exit(0);
}

// Now trigger open via the message handler
setTimeout(() => {
  const api = window.LocalPocketNotesOverlay;
  if (!api || typeof api.open !== "function") {
    console.log("LocalPocketNotesOverlay.open not exposed; msgHandler:", !!window.__msgHandler);
    return;
  }
  api.open({}).then((res) => {
    console.log("open resolved:", JSON.stringify(res));
    reportOverlay();
  }).catch((e) => {
    console.log("OPEN THREW:", e && e.stack ? e.stack : e);
    reportOverlay();
  });
}, 100);

function reportOverlay() {
  const host = window.document.getElementById("__lp_notes_overlay_root");
  if (!host) { console.log("host root NOT found"); return; }
  const overlay = host.shadowRoot ? host.shadowRoot.querySelector(".lp-overlay") : null;
  console.log("overlay found:", !!overlay);
  if (overlay) {
    console.log("overlay opacity style:", overlay.style.opacity);
    console.log("overlay dataset.open:", overlay.dataset.open);
  }
}
