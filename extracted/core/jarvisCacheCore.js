(function () {
  "use strict";

  var CACHE_TTL = 3600000;
  var MAX_ENTRIES = 50;

  var cache = new Map();
  var lru = [];

  function touch(key) {
    var idx = lru.indexOf(key);
    if (idx >= 0) lru.splice(idx, 1);
    lru.push(key);
  }

  function evict() {
    while (lru.length > MAX_ENTRIES) {
      var oldest = lru.shift();
      cache.delete(oldest);
    }
  }

  function getCacheKey(prompt) {
    if (!prompt || typeof prompt !== "string") return null;
    var normalized = prompt.trim().toLowerCase();
    if (normalized.length < 10) return null;
    var h = 0;
    for (var i = 0; i < normalized.length; i++) {
      h = ((h << 5) - h) + normalized.charCodeAt(i);
      h |= 0;
    }
    return "c" + Math.abs(h).toString(36);
  }

  var api = {
    get: function (prompt) {
      var key = getCacheKey(prompt);
      if (!key) return null;
      var entry = cache.get(key);
      if (!entry) return null;
      if (Date.now() - entry.ts > CACHE_TTL) {
        cache.delete(key);
        var idx = lru.indexOf(key);
        if (idx >= 0) lru.splice(idx, 1);
        return null;
      }
      touch(key);
      return entry;
    },

    set: function (prompt, responseHtml, responseText) {
      var key = getCacheKey(prompt);
      if (!key) return;
      cache.set(key, {
        responseHtml: responseHtml || null,
        responseText: responseText || "",
        ts: Date.now()
      });
      touch(key);
      evict();
    },

    clear: function () {
      cache.clear();
      lru.length = 0;
    }
  };

  if (typeof window !== "undefined") {
    window.LocalPocketJarvisCache = api;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
