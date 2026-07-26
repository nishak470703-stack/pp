const fs = require('fs');
let content = fs.readFileSync('c:/Users/L/Desktop/e2dbecab6b534d638039-2.7.3/background.js', 'utf8');

// The corrupted section: the jarvis-capture-screenshot handler was placed
// inside the canvas resize function, replacing the drawImage/toDataURL code.
// We need to restore the missing canvas lines AND update jarvis-capture-screenshot
// with deliverCapture support + add jarvis-reopen-sidebar handler.

const broken = `              cnv.width = tw; cnv.height = th;
              if (message.type === "jarvis-capture-screenshot") {
      // Capture the visible area of the (sender) tab as a PNG data URL so JARVIS
      // can attach a screenshot to a question (feature #6 / vision).
      (async () => {
        try {
          if (!lpApi || !lpApi.tabs || typeof lpApi.tabs.captureVisibleTab !== "function") {
            if (sendResponse) sendResponse({ ok: false, reason: "unsupported" });
            return;
          }
          // Match the proven Firefox pattern (cf. search_by_image): call
          // captureVisibleTab with ONLY the options object \u2014 NO windowId. The API
          // then captures the active tab of the current window. Passing a window
          // id (or a tab id) is what triggered "Invalid window ID" errors.
          const dataUrl = await lpApi.tabs.captureVisibleTab({ format: "png" });
          if (sendResponse) sendResponse({ ok: true, dataUrl: dataUrl });
        } catch (err) {
          if (sendResponse) sendResponse({ ok: false, reason: getErrorMessage(err) });
        }
      })();
      return true;
    }`;

const fixed = `              cnv.width = tw; cnv.height = th;
              var ctx = cnv.getContext("2d");
              ctx.drawImage(img, 0, 0, tw, th);
              var out = cnv.toDataURL("image/jpeg", quality);
              // If JPEG didn't actually shrink it, keep the original.
              if (!out || out.length >= dataUrl.length) out = dataUrl;
              resolve(out);
            } catch (e) { resolve(dataUrl); }
          };
          img.onerror = function () { resolve(dataUrl); };
          img.src = dataUrl;
        } catch (e) { resolve(dataUrl); }
      });
    }

    if (message.type === "jarvis-capture-screenshot") {
      // Capture the visible area of the (sender) tab as a PNG data URL so JARVIS
      // can attach a screenshot to a question (feature #6 / vision).
      // When deliverCapture is true, stash the image in storage and reopen the
      // sidebar so it picks up the capture on reload.
      (async () => {
        try {
          if (!lpApi || !lpApi.tabs || typeof lpApi.tabs.captureVisibleTab !== "function") {
            if (sendResponse) sendResponse({ ok: false, reason: "unsupported" });
            return;
          }
          const dataUrl = await lpApi.tabs.captureVisibleTab({ format: "png" });
          if (message.deliverCapture) {
            try {
              if (lpApi.storage && lpApi.storage.local && lpApi.storage.local.set) {
                await lpApi.storage.local.set({ pendingJarvisCapture: { dataUrl: dataUrl, ts: Date.now() } });
              }
            } catch (eStore) {}
            if (typeof openLocalPocketSidebar === "function") {
              openLocalPocketSidebar();
            }
          }
          if (sendResponse) sendResponse({ ok: true, dataUrl: dataUrl });
        } catch (err) {
          if (sendResponse) sendResponse({ ok: false, reason: getErrorMessage(err) });
        }
      })();
      return true;
    }

    if (message.type === "jarvis-reopen-sidebar") {
      if (typeof openLocalPocketSidebar === "function") {
        openLocalPocketSidebar();
      }
      if (sendResponse) sendResponse({ ok: true });
      return true;
    }`;

if (content.includes(broken)) {
    content = content.replace(broken, fixed);
    fs.writeFileSync('c:/Users/L/Desktop/e2dbecab6b534d638039-2.7.3/background.js', content);
    console.log('SUCCESS: background.js fixed and updated with deliverCapture support');
} else {
    console.log('ERROR: broken anchor not found');
    // Debug: show what's around "cnv.width = tw; cnv.height = th;"
    const idx = content.indexOf('cnv.width = tw; cnv.height = th;');
    if (idx !== -1) {
        console.log('Found cnv.width at index', idx);
        console.log('Context:', JSON.stringify(content.substring(idx, idx + 200)));
    } else {
        console.log('cnv.width line not found at all');
    }
}
