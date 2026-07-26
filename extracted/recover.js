const fs = require('fs');
let content = fs.readFileSync('c:/Users/L/Desktop/e2dbecab6b534d638039-2.7.3/jarvisSidebar.js', 'utf8');

const restoreText = `
            if (bubble) {
              var yes = el("button", { className: "lp-jarvis-cap-opt", text: "✅ Ya, pindah", type: "button" });
              var no = el("button", { className: "lp-jarvis-cap-opt", text: "❌ Batal", type: "button" });
              yes.style.marginRight = "6px";
              yes.addEventListener("click", function () {
                yes.disabled = true; no.disabled = true;
                api.runtime.sendMessage({ type: "jarvis-set-item-category", ids: capped, categoryId: tgtCat.id }).then(function (w) {
                  if (w && w.ok) addBubble("jarvis", "✅ " + (w.updated || 0) + " link dipindah ke \\"" + tgtCat.name + "\\"");
                  else addBubble("jarvis", "❌ Gagal pindah: " + ((w && w.message) || "ralat"));
                  finishReclassify(onComplete);
                }).catch(function () {
                  addBubble("jarvis", "❌ Gagal pindah (ralat komunikasi).");
                  finishReclassify(onComplete);
                });
              });
              no.addEventListener("click", function () {
                addBubble("jarvis", "Batal — tiada link dipindah.");
                finishReclassify(onComplete);
              });
              try {
                var ctr = el("div", { className: "lp-jarvis-reclassify-actions" }, [yes, no]);
                bubble.appendChild(ctr);
              } catch (e) {}
            }
          });
        }).catch(function () {
          addBubble("jarvis", "Gagal akses simpanan untuk penilaian kategori.");
          finishReclassify(onComplete);
        });
      }).catch(function () {
        addBubble("jarvis", "Gagal dapatkan senarai kategori.");
        finishReclassify(onComplete);
      });
      function finishReclassify(cb) { if (cb) cb(); }
    }

    // ---- Region capture (feature #6b): let the user snap a chosen area ----
    function openCapturePopup() {
      ensureCapturePopup();
      if (capturePopup) capturePopup.classList.toggle("lp-jarvis-show");
    }
    function closeCapturePopup() {
      if (capturePopup) capturePopup.classList.remove("lp-jarvis-show");
    }
    function hidePanelForCapture() {
      if (root) root.style.display = "none";
      if (typeof SIDEBAR_HOST !== "undefined" && SIDEBAR_HOST) {
        try { if (api.sidebarAction && typeof api.sidebarAction.close === "function") api.sidebarAction.close(); } catch (e) {}
      } else if (root) {
        root.classList.remove("lp-jarvis-open");
      }
      suppressCloseUntil = Date.now() + 600000;
    }
    function showPanelAfterCapture() {
      if (root) root.style.display = "";
      if (typeof SIDEBAR_HOST !== "undefined" && !SIDEBAR_HOST && root) {
        root.classList.add("lp-jarvis-open");
      }
      suppressCloseUntil = 0;
    }
    function ensureCapturePopup() {
      if (capturePopup) return;
      var capOpts = [el("button", { id: "lp-jarvis-cap-full", className: "lp-jarvis-cap-opt", text: "📸 Seluruh tab" })];
      capOpts.push(el("button", { id: "lp-jarvis-cap-region", className: "lp-jarvis-cap-opt", text: "✂ Pilih kawasan" }));
      capOpts.push(el("button", { id: "lp-jarvis-cap-image", className: "lp-jarvis-cap-opt", text: "🖼 Pilih imej" }));
      capOpts.push(el("button", { id: "lp-jarvis-cap-file", className: "lp-jarvis-cap-opt", text: "📁 Muat naik gambar" }));
      capturePopup = el("div", { id: "lp-jarvis-capture-popup", className: "lp-jarvis-capture-popup" }, capOpts);
      if (root) root.appendChild(capturePopup);
      capturePopup.querySelector("#lp-jarvis-cap-full").addEventListener("click", function (e) {
        e.stopPropagation(); closeCapturePopup();
        try { hidePanelForCapture(); } catch (eHide) {}
        if (typeof SIDEBAR_HOST !== "undefined" && SIDEBAR_HOST) {
          api.runtime.sendMessage({ type: "jarvis-capture-screenshot", deliverCapture: true }).catch(function(){});
          return;
        }
        captureScreenshot();
      });
      var regionBtn = capturePopup.querySelector("#lp-jarvis-cap-region");
      if (regionBtn) regionBtn.addEventListener("click", function (e) {
        e.stopPropagation(); closeCapturePopup();
        if (typeof SIDEBAR_HOST !== "undefined" && SIDEBAR_HOST) {
          try { hidePanelForCapture(); } catch (eHide) {}
          hostRelay({ type: "jarvis-host-capture-region", deliverCapture: true }).then(function (res) {
            if (res && res.dataUrl) {
              pendingImage = res.dataUrl;
              showPendingImageThumb();
            } else if (res === null) {
              addBubble("jarvis", "Gagal tangkap kawasan.");
            }
          });
        } else {
          startRegionCapture();
        }
      });
      var imageBtn = capturePopup.querySelector("#lp-jarvis-cap-image");
      if (imageBtn) imageBtn.addEventListener("click", function (e) {
        e.stopPropagation(); closeCapturePopup();
        if (typeof SIDEBAR_HOST !== "undefined" && SIDEBAR_HOST) {
          try { hidePanelForCapture(); } catch (eHide) {}
          hostRelay({ type: "jarvis-host-capture-image", deliverCapture: true }).then(function (res) {
            if (res && res.dataUrl) {
              pendingImage = res.dataUrl;
              showPendingImageThumb();
            } else if (res === null) {
              addBubble("jarvis", "Gagal pilih imej.");
            }
          });
        } else {
          startImageSelect();
        }
      });
      var fileBtn = capturePopup.querySelector("#lp-jarvis-cap-file");
      if (fileBtn) fileBtn.addEventListener("click", function (e) {
        e.stopPropagation(); closeCapturePopup(); openFilePicker();
      });
      document.addEventListener("click", function (e) {
        if (capturePopup && capturePopup.classList.contains("lp-jarvis-show") &&
            !capturePopup.contains(e.target) && e.target !== imgAttachBtn) {
          closeCapturePopup();
        }
      });
    }

    function ensureSelectEls() {
      if (selectOverlay) return;
      selectOverlay = el("div", { id: "lp-jarvis-select-overlay", className: "lp-jarvis-select-overlay" });
      selectBox = el("div", { id: "lp-jarvis-select-box", className: "lp-jarvis-select-box" });
      ["nw", "ne", "sw", "se"].forEach(function (h) {
        var hd = el("div", { className: "lp-jarvis-select-handle lp-jarvis-select-handle-" + h, "data-h": h });
        selectBox.appendChild(hd);
      });
      selectBar = el("div", { id: "lp-jarvis-select-bar", className: "lp-jarvis-select-bar" }, [
        el("button", { id: "lp-jarvis-select-save", className: "lp-jarvis-cap-opt", text: "✓ Simpan" }),
        el("button", { id: "lp-jarvis-select-cancel", className: "lp-jarvis-cap-opt", text: "✕ Batal" })
      ]);
      selectOverlay.appendChild(selectBox);
      selectOverlay.appendChild(selectBar);
      (document.body || document.documentElement).appendChild(selectOverlay);
      wireSelectEvents();
    }

    function pt(e) { return { x: e.clientX, y: e.clientY }; }
    function setBox(x, y, w, h) {
      regionRect = { left: x, top: y, width: w, height: h };
      if (!selectBox) return;
      selectBox.style.left = x + "px";
      selectBox.style.top = y + "px";
      selectBox.style.width = w + "px";
      selectBox.style.height = h + "px";
    }
    function wireSelectEvents() {
      if (!selectOverlay) return;
      selectOverlay.addEventListener("mousedown", function (e) {
        if (!regionMode || e.button !== 0) return;
        if (e.target === selectBar || (selectBar && selectBar.contains(e.target))) return;
        var p = pt(e);
        if (e.target === selectBox) {
          regionMoving = true; regionStartMouse = p; regionStartRect = Object.assign({}, regionRect);
          e.preventDefault(); return;
        }
        if (e.target && e.target.classList && e.target.classList.contains("lp-jarvis-select-handle")) {
          regionResizing = true; regionHandle = e.target.getAttribute("data-h");
          regionStartMouse = p; regionStartRect = Object.assign({}, regionRect);
          e.preventDefault(); return;
        }
        regionDrawing = true; regionStart = p; setBox(p.x, p.y, 0, 0);
        selectBox.style.display = "block"; e.preventDefault();
      });
      window.addEventListener("mousemove", function (e) {
        if (!regionMode) return;
        var p = pt(e);
        if (regionDrawing) {
          setBox(Math.min(regionStart.x, p.x), Math.min(regionStart.y, p.y),
                 Math.abs(p.x - regionStart.x), Math.abs(p.y - regionStart.y));
        } else if (regionMoving && regionStartRect) {
          setBox(regionStartRect.left + (p.x - regionStartMouse.x), regionStartRect.top + (p.y - regionStartMouse.y),
                 regionStartRect.width, regionStartRect.height);
        } else if (regionResizing && regionStartRect) {
          var r = Object.assign({}, regionStartRect);
          var dx = p.x - regionStartMouse.x, dy = p.y - regionStartMouse.y;
          if (regionHandle.indexOf("e") >= 0) r.width = Math.max(5, r.width + dx);
          if (regionHandle.indexOf("s") >= 0) r.height = Math.max(5, r.height + dy);
          if (regionHandle.indexOf("w") >= 0) { r.left += dx; r.width = Math.max(5, r.width - dx); }
          if (regionHandle.indexOf("n") >= 0) { r.top += dy; r.height = Math.max(5, r.height - dy); }
          setBox(r.left, r.top, r.width, r.height);
        }
      });
      window.addEventListener("mouseup", function () {
        regionDrawing = false; regionMoving = false; regionResizing = false;
      });
      selectBar.querySelector("#lp-jarvis-select-save").addEventListener("click", function (e) {
        e.stopPropagation(); confirmRegion();
      });
      selectBar.querySelector("#lp-jarvis-select-cancel").addEventListener("click", function (e) {
        e.stopPropagation(); cancelRegion(); showPanelAfterCapture();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && regionMode) { cancelRegion(); showPanelAfterCapture(); }
      });
    }
    function startRegionCapture() {
      ensureSelectEls();
      regionMode = true; regionRect = null; regionDrawing = false;
      regionMoving = false; regionResizing = false;
      hidePanelForCapture();
      if (selectBox) selectBox.style.display = "none";
      if (selectOverlay) selectOverlay.style.display = "block";
    }
    function cancelRegion() {
      regionMode = false;
      if (selectOverlay) selectOverlay.style.display = "none";
      if (selectBox) selectBox.style.display = "none";
      regionRect = null;
    }
    function confirmRegion() {
      if (!regionRect || regionRect.width < 5 || regionRect.height < 5) { cancelRegion(); showPanelAfterCapture(); return; }
      var rect = regionRect;
      cancelRegion();
      pendingCapturePromise = api.runtime.sendMessage({ type: "jarvis-capture-screenshot" }).then(function (res) {
        showPanelAfterCapture();
        if (!res || !res.ok || !res.dataUrl) {
          addBubble("jarvis", "Gagal tangkap: " + ((res && res.reason) || "tidak diketahui"));
          return null;
        }
        return cropDataUrl(res.dataUrl, rect).then(function (outUrl) {
          if (outUrl) { pendingImage = outUrl; showPendingImageThumb(); }
          else { addBubble("jarvis", "Gagal potong gambar."); }
          return outUrl;
        });
      }).catch(function () {
        showPanelAfterCapture();
        addBubble("jarvis", "Gagal tangkap.");
        return null;
      });
    }
    function cropDataUrl(dataUrl, rect) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          try {
            var vw = window.innerWidth || img.naturalWidth;
            var scale = img.naturalWidth / vw;
            var sx = rect.left * scale, sy = rect.top * scale;
            var sw = rect.width * scale, sh = rect.height * scale;
            var cnv = document.createElement("canvas");
            cnv.width = Math.max(1, Math.round(sw));
            cnv.height = Math.max(1, Math.round(sh));
            var ctx = cnv.getContext("2d");
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cnv.width, cnv.height);
            resolve(cnv.toDataURL("image/png"));
          } catch (e) { resolve(null); }
        };
        img.onerror = function () { resolve(null); };
        img.src = dataUrl;
      });
    }

    // ---- "Pilih imej" (feature #6c): hover to highlight, click to snap the
    // picture you want. Clicking an <img> grabs its REAL source (high quality,
    // via a background fetch that bypasses CORS — like search_by_image's "select"
    // view); clicking any other element crops the visible-tab screenshot to that
    // element's box. Either way the result is attached to the next question. ----
    function ensureImageSelectEls() {
      if (imageSelectHL) return;
      imageSelectHL = el("div", { id: "lp-jarvis-img-select-hl", className: "lp-jarvis-img-select-hl" });
      imageSelectLabel = el("span", { className: "lp-jarvis-img-select-label" });
      imageSelectHL.appendChild(imageSelectLabel);
      imageSelectHint = el("div", { id: "lp-jarvis-img-select-hint", className: "lp-jarvis-img-select-hint" }, [
        el("span", { text: "Klik imej atau elemen untuk snap · Esc untuk batal" }),
        el("button", { id: "lp-jarvis-img-select-cancel", className: "lp-jarvis-cap-opt", text: "✕ Batal" })
      ]);
      (document.body || document.documentElement).appendChild(imageSelectHL);
      (document.body || document.documentElement).appendChild(imageSelectHint);
      imageSelectHint.querySelector("#lp-jarvis-img-select-cancel").addEventListener("click", function (e) {
        e.stopPropagation(); cancelImageSelect();
      });
    }
    function showImgSelHL(r, isImg) {
      if (!imageSelectHL) return;
      imageSelectHL.style.display = "block";
      imageSelectHL.style.left = Math.round(r.left) + "px";
      imageSelectHL.style.top = Math.round(r.top) + "px";
      imageSelectHL.style.width = Math.round(r.width) + "px";
      imageSelectHL.style.height = Math.round(r.height) + "px";
      imageSelectHL.style.borderColor = isImg ? "#5fff9d" : "#5fd0ff";
      imageSelectHL.style.background = isImg ? "rgba(95,255,157,0.14)" : "rgba(95,208,255,0.12)";
      if (imageSelectLabel) imageSelectLabel.textContent = isImg ? "🖼 Imej" : "▦ Elemen";
    }
    function hideImgSelHL() { if (imageSelectHL) imageSelectHL.style.display = "none"; }
    function imgSelTargetAt(x, y) {
      var t = document.elementFromPoint(x, y);
      if (!t || !t.getBoundingClientRect) return null;
      if (root && root.contains(t)) return null; // ignore our own panel
      if (imageSelectHint && imageSelectHint.contains(t)) return null; // ignore hint bar
      var img = (t.closest && t.closest("img")) || (t.tagName === "IMG" ? t : null);
      var node = img || t;
      var r = node.getBoundingClientRect();
      if (r.width < 3 || r.height < 3) return null;
      return { node: node, img: img, rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
    }
    function imgSelOnMove(e) {
      if (!imageSelectMode) return;
      var hit = imgSelTargetAt(e.clientX, e.clientY);
      if (!hit) { hideImgSelHL(); return; }
      showImgSelHL(hit.rect, !!hit.img);
    }
    function imgSelOnClick(e) {
      if (!imageSelectMode) return;
      var hit = imgSelTargetAt(e.clientX, e.clientY);
      if (!hit) return; // click on our own panel etc. — ignore, stay in mode
      e.preventDefault(); e.stopPropagation();
      var rect = hit.rect, img = hit.img;
      cleanupImageSelect();
      if (img) captureImageBySrc(img, rect);
      else captureElementByCrop(rect);
    }
    function startImageSelect() {
      ensureImageSelectEls();
      imageSelectMode = true;
      if (imageSelectHL) imageSelectHL.style.display = "none";
      if (imageSelectHint) imageSelectHint.style.display = "flex";
      hidePanelForCapture();
      document.body.style.cursor = "crosshair";
      document.body.style.userSelect = "none";
      _imgSelMove = function (e) { imgSelOnMove(e); };
      _imgSelClick = function (e) { imgSelOnClick(e); };
      _imgSelKey = function (e) { if (e.key === "Escape") cancelImageSelect(); };
      document.addEventListener("mousemove", _imgSelMove, true);
      document.addEventListener("click", _imgSelClick, true);
      document.addEventListener("keydown", _imgSelKey, true);
    }
    function cleanupImageSelect() {
      imageSelectMode = false;
      hideImgSelHL();
      if (imageSelectHint) imageSelectHint.style.display = "none";
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (_imgSelMove) document.removeEventListener("mousemove", _imgSelMove, true);
      if (_imgSelClick) document.removeEventListener("click", _imgSelClick, true);
      if (_imgSelKey) document.removeEventListener("keydown", _imgSelKey, true);
      _imgSelMove = _imgSelClick = _imgSelKey = null;
    }
    // Cancel = abort the selection AND bring the panel back.
    function cancelImageSelect() {
      cleanupImageSelect();
      showPanelAfterCapture();
    }
    // Grab the actual image source (best quality). Data URLs are used directly;
    // http(s) URLs are fetched in the background to dodge CORS. On any failure we
    // fall back to cropping the visible-tab screenshot around the element.
    function captureImageBySrc(img, rect) {
      var src = img.currentSrc || img.src;
      if (!src) { captureElementByCrop(rect); return; }
      if (src.indexOf("data:") === 0) { pendingImage = src; showPendingImageThumb(); showPanelAfterCapture(); return; }
      pendingCapturePromise = api.runtime.sendMessage({ type: "jarvis-fetch-image", url: src }).then(function (res) {
        if (res && res.ok && res.dataUrl) { pendingImage = res.dataUrl; showPendingImageThumb(); }
        else { captureElementByCrop(rect); return null; }
        showPanelAfterCapture();
      }).catch(function () { captureElementByCrop(rect); });
    }
    function captureElementByCrop(rect) {
      pendingCapturePromise = api.runtime.sendMessage({ type: "jarvis-capture-screenshot" }).then(function (res) {
        showPanelAfterCapture();
        if (!res || !res.ok || !res.dataUrl) {
          addBubble("jarvis", "Gagal tangkap: " + ((res && res.reason) || "tidak diketahui"));
          return null;
        }
        return cropDataUrl(res.dataUrl, rect).then(function (outUrl) {
          if (outUrl) { pendingImage = outUrl; showPendingImageThumb(); }
          else { addBubble("jarvis", "Gagal potong gambar."); }
          return outUrl;
        });
      }).catch(function () {
        showPanelAfterCapture();
        addBubble("jarvis", "Gagal tangkap.");
        return null;
      });
    }

    // Drag-and-drop fallback for a web-page image delivered as a URL (not a file).
    // The background fetch (jarvis-fetch-image) can still fail on CORS/network for
    // some hosts, so mirror the "Pilih imej" path: find the source <img> in the DOM
    // (matched by its resolved src), then capture the visible-tab screenshot and
    // crop to that element's box. This is a browser-level capture — NO CORS.
    var _lastDropCaptureTs = 0;
    function captureDroppedWebImage(url) {
      // Debounce: both the input-level and root-level drop handlers may fire for
      // the same drop, so only run one screenshot capture per ~1.5s window.
      var _now = Date.now();
      if (_now - _lastDropCaptureTs < 1500) return;
      _lastDropCaptureTs = _now;
      // Don't clobber an image that a parallel handler already captured.
      if (pendingImage) return;
      try {
        var img = null;
        var imgs = document.images || [];
        for (var i = 0; i < imgs.length; i++) {
          var s = imgs[i].currentSrc || imgs[i].src || "";
          if (s === url) { img = imgs[i]; break; }
        }
        if (!img) {
          for (var j = 0; j < imgs.length; j++) {
            var s2 = imgs[j].currentSrc || imgs[j].src || "";
            if (s2 && (s2.indexOf(url) === 0 || url.indexOf(s2) === 0)) { img = imgs[j]; break; }
          }
        }
        if (img) {
          var r = img.getBoundingClientRect();
          if (r.width >= 3 && r.height >= 3) {
            var rect = { left: r.left, top: r.top, width: r.width, height: r.height };
            try { hidePanelForCapture(); } catch (e) {}
            captureElementByCrop(rect);
            return;
          }
`;

const anchor = 'var bubble = addBubble("jarvis", msg);';
const idx = content.indexOf(anchor);

if (idx !== -1) {
    const startIdx = idx + anchor.length;
    const endAnchor = '        } catch (e) {}';
    const endIdx = content.indexOf(endAnchor, startIdx);
    
    if (endIdx !== -1) {
        // We will replace the space between startIdx and endIdx with our restoreText
        const newContent = content.substring(0, startIdx) + restoreText + '\n          }\n' + content.substring(endIdx);
        fs.writeFileSync('c:/Users/L/Desktop/e2dbecab6b534d638039-2.7.3/jarvisSidebar.js', newContent);
        console.log('Successfully injected restored text!');
    } else {
        console.log('Could not find end anchor');
    }
} else {
    console.log('Could not find start anchor');
}
