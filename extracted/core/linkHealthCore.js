/**
 * Link Health Monitor core
 *
 * Memeriksa status "sihat" sesuatu URL: ok / broken (404, 410) /
 * redirect / error (timeout, network, 5xx). Direka supaya ringan & tak gantung:
 *   - checkUrlHealth: HEAD dulu (pantas, tiada body), fallback GET bila perlu
 *   - HARD timeout via Promise.race — garantikan setiap check tamat walaupun
 *     fetch tak reject bila abort() dipanggil (punca scan tak pernah habis)
 *   - checkUrlsBatch: worker-pool dengan concurrency terhad (default 16)
 *
 * Dimuat sebagai background script — expose global `linkHealthCore`.
 */
(function (global) {
  "use strict";

  var DEFAULT_TIMEOUT_MS = 6000;
  var DEFAULT_CONCURRENCY = 16;

  function classify(statusCode, finalUrl, url) {
    if (statusCode === 404 || statusCode === 410) return "broken";
    if (statusCode >= 500) return "error";
    if (finalUrl) return "redirect";
    if (statusCode >= 200 && statusCode < 400) return "ok";
    return "error";
  }

  function makeResult(status, statusCode, finalUrl, url, id) {
    return {
      status: status,
      statusCode: statusCode,
      finalUrl: finalUrl,
      error: null,
      checkedAt: Date.now(),
      id: id != null ? id : null,
      url: url || null
    };
  }

  function makeError(errorType, url, id) {
    return {
      status: "error",
      statusCode: null,
      finalUrl: null,
      error: errorType,
      checkedAt: Date.now(),
      id: id != null ? id : null,
      url: url || null
    };
  }

  function errorNameToType(err) {
    var name = err && err.name ? err.name : (err && err.message ? err.message : "");
    if (name === "hard-timeout" || name === "AbortError" || name === "timeout") return "timeout";
    return "network-error";
  }

  /**
   * Satu fetch dengan HARD timeout. Promise.race dengan timer yang SENTIASA
   * reject pada timeoutMs — tak bergantung pada fetch menghormati abort().
   * @returns {Promise<{statusCode:?number,finalUrl:?string,error:?*}>}
   */
  function doFetch(url, method, timeoutMs) {
    var controller = null;
    var abortTimer = null;
    var hardTimer = null;
    try {
      controller = new AbortController();
      abortTimer = setTimeout(function () {
        try { controller.abort(); } catch (e) {}
      }, timeoutMs);
      var hardTimeout = new Promise(function (_, reject) {
        hardTimer = setTimeout(function () {
          var e = new Error("hard-timeout");
          e.name = "hard-timeout";
          reject(e);
        }, timeoutMs);
      });
      var opts = {
        method: method,
        redirect: "follow",
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal
      };
      if (method === "GET") opts.headers = { "Range": "bytes=0-0" };
      var fetchPromise = fetch(url, opts);
      if (fetchPromise && typeof fetchPromise.catch === "function") {
        // Elak unhandled rejection bila fetch masih pending selepas race tamat
        fetchPromise.catch(function () {});
      }
      var response = Promise.race([fetchPromise, hardTimeout]);
      return response.then(function (resp) {
        if (abortTimer) clearTimeout(abortTimer);
        if (hardTimer) clearTimeout(hardTimer);
        var statusCode = resp.status;
        var finalUrl = (resp.url && resp.url !== url) ? resp.url : null;
        return { statusCode: statusCode, finalUrl: finalUrl, error: null };
      }, function (err) {
        if (abortTimer) clearTimeout(abortTimer);
        if (hardTimer) clearTimeout(hardTimer);
        if (controller) { try { controller.abort(); } catch (e) {} }
        return { statusCode: null, finalUrl: null, error: err };
      });
    } catch (err) {
      if (abortTimer) clearTimeout(abortTimer);
      if (hardTimer) clearTimeout(hardTimer);
      return Promise.resolve({ statusCode: null, finalUrl: null, error: err });
    }
  }

  /**
   * Periksa satu URL.
   * @returns {Promise<{status:string,statusCode:?number,finalUrl:?string,error:?string,checkedAt:number,id:?,url:?string}>}
   *   status: "ok" | "broken" | "redirect" | "error"
   */
  async function checkUrlHealth(url, options) {
    options = options || {};
    var timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
    var id = options && options.id != null ? options.id : null;

    if (!url || typeof url !== "string") {
      return makeError("invalid-url", url, id);
    }

    function attempt(method) {
      return doFetch(url, method, timeoutMs);
    }
    // Hanya retry kegagalan NETWORK PANTAS (DNS/connection refuse), BUKAN timeout
    // yang lambat — supaya host mati tak bagi 3x masa (scan kekal pantas).
    function shouldRetry(err) {
      return errorNameToType(err) === "network-error";
    }

    // HEAD dulu — pantas, tiada body.
    var head = await attempt("HEAD");
    if (head.error || head.statusCode == null) {
      if (shouldRetry(head.error)) {
        var g1 = await attempt("GET");
        if (g1.error || g1.statusCode == null) {
          if (shouldRetry(g1.error)) {
            var g2 = await attempt("GET");
            if (g2.error || g2.statusCode == null) return makeError(errorNameToType(g2.error), url, id);
            return makeResult(classify(g2.statusCode, g2.finalUrl, url), g2.statusCode, g2.finalUrl, url, id);
          }
          return makeResult(classify(g1.statusCode, g1.finalUrl, url), g1.statusCode, g1.finalUrl, url, id);
        }
        return makeResult(classify(g1.statusCode, g1.finalUrl, url), g1.statusCode, g1.finalUrl, url, id);
      }
      return makeError(errorNameToType(head.error), url, id);
    }
    // Server tolak HEAD (method not allowed / forbidden / not implemented) -> fallback GET.
    if (head.statusCode === 405 || head.statusCode === 403 ||
        head.statusCode === 501 || head.statusCode === 400) {
      var get = await attempt("GET");
      if (get.error || get.statusCode == null) {
        if (shouldRetry(get.error)) {
          var g2b = await attempt("GET");
          if (g2b.error || g2b.statusCode == null) return makeError(errorNameToType(g2b.error), url, id);
          return makeResult(classify(g2b.statusCode, g2b.finalUrl, url), g2b.statusCode, g2b.finalUrl, url, id);
        }
        return makeError(errorNameToType(get.error), url, id);
      }
      return makeResult(classify(get.statusCode, get.finalUrl, url), get.statusCode, get.finalUrl, url, id);
    }
    return makeResult(classify(head.statusCode, head.finalUrl, url), head.statusCode, head.finalUrl, url, id);
  }

  /**
   * Periksa senarai URL dengan worker-pool (concurrency terhad).
   * @param {Array<{id?:string,url:string}>|string[]} urls
   * @param {{concurrency?:number,timeoutMs?:number,onProgress?:Function}} [options]
   *   onProgress(done, total, result) — dipanggil setiap selesai.
   * @returns {Promise<Array>} array hasil sepadan urutan input
   */
  async function checkUrlsBatch(urls, options) {
    options = options || {};
    var concurrency = (typeof options.concurrency === "number" && options.concurrency > 0)
      ? options.concurrency
      : DEFAULT_CONCURRENCY;
    var timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
    var onProgress = (typeof options.onProgress === "function") ? options.onProgress : null;

    var list = Array.isArray(urls) ? urls : [];
    var total = list.length;
    var done = 0;
    var results = new Array(total);

    if (total === 0) {
      if (onProgress) {
        try { onProgress(0, 0, null); } catch (e) {}
      }
      return results;
    }

    var nextIndex = 0;

    async function worker() {
      while (true) {
        var i = nextIndex;
        if (i >= total) break;
        nextIndex = nextIndex + 1;

        var entry = list[i];
        var url = entry && entry.url ? entry.url : (typeof entry === "string" ? entry : "");
        var id = entry && entry.id != null ? entry.id : (typeof entry === "string" ? url : null);

        var res = await checkUrlHealth(url, { timeoutMs: timeoutMs, id: id });
        results[i] = res;

        done = done + 1;
        if (onProgress) {
          try { onProgress(done, total, res); } catch (e) {}
        }
      }
    }

    var poolSize = Math.min(concurrency, total);
    var workers = [];
    for (var w = 0; w < poolSize; w++) workers.push(worker());
    await Promise.all(workers);

    return results;
  }

  var api = {
    checkUrlHealth: checkUrlHealth,
    checkUrlsBatch: checkUrlsBatch,
    DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
    DEFAULT_CONCURRENCY: DEFAULT_CONCURRENCY
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.linkHealthCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
