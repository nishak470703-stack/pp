(() => {
  const api = typeof browser !== "undefined" ? browser : chrome;

  const MAX_IMAGES_SCAN = 20; // Kurangkan dari 40 — meta tag biasanya cukup untuk thumbnail
  const CANDIDATE_SELECTORS_PRIORITY = [
    'article', 'main', '[role="main"]', '.content', '.post', '.entry-content',
    '.article-body', '.blog-post', '.story', '#content', '#main', '.main-content'
  ];

function getMeta(name) {
  const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
  const value = el ? el.getAttribute("content") : "";
  return value ? value.trim() : "";
}

function getSiteName() {
  const og = getMeta("og:site_name");
  if (og) return og;
  const tw = getMeta("twitter:site");
  if (tw) return tw;
  return window.location.hostname.replace(/^www\./, "");
}

function getTitle() {
  const metaTitle = getMeta("og:title") ? getMeta("og:title") : getMeta("twitter:title");
  if (metaTitle) return metaTitle;
  const h1 = document.querySelector("h1");
  const h1Text = h1 ? h1.innerText.trim() : "";
  if (h1Text) return h1Text;
  if (document.title) return document.title;
  return window.location.hostname;
}

function getByline() {
  const metaAuthor = getMeta("author");
  if (metaAuthor) return metaAuthor;
  const authorEl = document.querySelector("[rel='author'], .byline, .author, [itemprop='author']");
  if (authorEl) return authorEl.innerText.trim();
  return "";
}

function getTextLength(el) {
  const text = el?.innerText ?? "";
  return text.trim().length;
}

function getLinkDensity(el) {
  const textLength = getTextLength(el);
  if (!textLength) return 0;
  const linkText = Array.from(el.querySelectorAll("a")).reduce((sum, a) => {
    const text = a?.innerText ?? "";
    return sum + text.trim().length;
  }, 0);
  return linkText / textLength;
}

function scoreNode(el) {
  let score = getTextLength(el);
  if (el.tagName === "ARTICLE" || el.tagName === "MAIN") score += 500;
  if (el.tagName === "SECTION") score += 150;
  score = score * (1 - getLinkDensity(el));
  return score;
}

function isHidden(el) {
  // Semak attribute inline sahaja — getComputedStyle terlalu mahal bila dipanggil
  // untuk setiap img dalam scan thumbnail (boleh jadi 20-40 kali per save)
  const style = el.style;
  if (style && (style.display === "none" || style.visibility === "hidden")) return true;
  // Semak atribut HTML5 hidden dan aria-hidden — murah, tanpa reflow
  if (el.hasAttribute("hidden")) return true;
  if (el.getAttribute("aria-hidden") === "true") return true;
  return false;
}

function pickBestCandidate() {
  for (const selector of CANDIDATE_SELECTORS_PRIORITY) {
    try {
      const el = document.querySelector(selector);
      if (el && !isHidden(el) && !el.closest("nav, footer, aside, header, form")) {
        const length = getTextLength(el);
        if (length >= 200) {
          const score = scoreNode(el);
          if (score > 0) return el;
        }
      }
    } catch (e) {}
  }
  const candidates = document.querySelectorAll("article, main, section");
  let best = null;
  let bestScore = 0;
  for (const el of candidates) {
    if (!el) continue;
    if (isHidden(el)) continue;
    if (el.closest("nav, footer, aside, header, form")) continue;
    const length = getTextLength(el);
    if (length < 200) continue;
    const score = scoreNode(el);
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) return best;
  const article = document.querySelector("article");
  if (article) return article;
  return document.body;
}

function shouldRemoveByClass(el) {
  const className = typeof el.className === "string" ? el.className : "";
  const idName = typeof el.id === "string" ? el.id : "";
  const combined = `${className} ${idName}`.toLowerCase();
  const padded = ` ${combined.replace(/[_-]+/g, " ")} `;
  const tokens = [
    "ad",
    "ads",
    "promo",
    "sponsor",
    "subscribe",
    "newsletter",
    "cookie",
    "banner",
    "sidebar",
    "share",
    "social",
    "comment",
    "related"
  ];
  for (const token of tokens) {
    if (padded.indexOf(` ${token} `) >= 0) return true;
  }
  return false;
}

function stripAttributes(el) {
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith("on") || attr.name === "style") {
      el.removeAttribute(attr.name);
    }
  }
}

function absolutizeUrl(value) {
  if (!value || typeof value !== "string") return "";
  try {
    const url = new URL(value, document.baseURI);
    // Only allow http/https protocols
    if (!["http:", "https:"].includes(url.protocol)) {
      console.warn("[ContentScript] Blocked non-http URL:", value);
      return "";
    }
    return url.toString();
  } catch (err) {
    console.warn("[ContentScript] Failed to absolutize URL:", value, err);
    return "";
  }
}

function getFaviconUrl() {
  const links = Array.from(
    document.querySelectorAll(
      "link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon'], link[rel='apple-touch-icon-precomposed']"
    )
  );
  for (const link of links) {
    const href = link.getAttribute("href");
    if (href) return absolutizeUrl(href);
  }
  try {
    return new URL("/favicon.ico", window.location.origin).toString();
  } catch (err) {
    return "";
  }
}

const SKIP_URL_PATTERNS = ['icon', 'logo', 'favicon', 'avatar', 'badge', 'sprite', 'pixel', 'tracker', 'advert', 'banner', 'ad-', 'ads', 'flag', 'button', 'btn'];
  const GOOD_CLASS_PATTERNS = ['thumb', 'featured', 'post', 'content', 'media', 'preview', 'snapshot', 'video', 'cover'];

  function extractBgUrl(el) {
    const bg = el.style.backgroundImage;
    if (!bg) return "";
    const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
    return m ? m[1] : "";
  }

  function getInstagramProfilePicUrl() {
    try {
      function unesc(t) { return (t || '').replace(/\\"/g, '"'); }
      function extractPic(text) {
        if (!text || text.indexOf('profile_pic') === -1) return null;
        var t = unesc(text);
        var m = t.match(/"profile_pic_url_hd"\s*:\s*"([^"]+)"/)
              || t.match(/"profile_pic_url"\s*:\s*"([^"]+)"/);
        if (!m) return null;
        var s = m[1];
        s = s.replace(/\\u0026/g, '&').replace(/&amp;/gi, '&')
             .replace(/\\\//g, '/').replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
        return s;
      }
      function urlId(u) { try { var p = (u || '').split('?')[0]; var m = p.match(/\/([0-9_]+)_n\.jpg/); return m ? m[1] : p; } catch (e) { return u || ''; } }

      var SECTIONS = ["p","reel","tv","stories","explore","about","accounts","developer","legal","press","jobs","blog","business","api","embed","direct","activity","settings","edit","challenge","fbsr","locations","hashtag","tags","www","guide"];
      var pathUser = null;
      try { var pu = location.pathname.split('/').filter(Boolean); if (pu[0] && !SECTIONS.includes(pu[0].toLowerCase())) pathUser = pu[0]; } catch (e) {}

      var texts = [].slice.call(document.querySelectorAll('script')).map(function (s) { return s.textContent || ''; });

      // 0. PALING TEPAT: <img> header profil dengan alt "{username}'s profile picture".
      //    Gambar tepat di sebelah nama profil — padan dgn username dlm URL,
      //    jadi elak tersalah ambil avatar akaun login / akaun cadangan.
      if (pathUser) {
        var unameLc = pathUser.toLowerCase();
        var imgs0 = [].slice.call(document.querySelectorAll('img'));
        for (var ai = 0; ai < imgs0.length; ai++) {
          var alt0 = (imgs0[ai].getAttribute('alt') || '').toLowerCase();
          if (!alt0) continue;
          if (alt0.indexOf('profile picture') === -1 && alt0.indexOf('profile photo') === -1) continue;
          if (alt0.indexOf(unameLc) === -1) continue;
          var asrc0 = imgs0[ai].getAttribute('src') || imgs0[ai].getAttribute('data-src') || '';
          if (/scontent|fbcdn|cdninstagram/i.test(asrc0)) return asrc0;
        }
      }

      // 1. Data page owner: script __additionalDataLoaded('/user/...')
      if (pathUser) {
        var route = '/' + pathUser + '/';
        for (var i = 0; i < texts.length; i++) {
          var t = texts[i];
          if (t.indexOf('__additionalDataLoaded') === -1) continue;
          if (t.indexOf(route) === -1 && t.indexOf('"' + pathUser + '"') === -1) continue;
          var p = extractPic(t);
          if (p) return p;
        }
      }

      // 2. Tapis avatar VIEWER (akaun login) ikut id, buang dari senarai
      var viewerId = null;
      for (var v = 0; v < texts.length; v++) {
        var cv = unesc(texts[v]);
        var vi = cv.indexOf('"viewer"');
        if (vi >= 0) { var vp = extractPic(cv.slice(vi)); if (vp) { viewerId = urlId(vp); break; } }
      }

      var all = [];
      for (var k = 0; k < texts.length; k++) {
        var pk = extractPic(texts[k]);
        if (pk && all.indexOf(pk) === -1) all.push(pk);
      }
      var filtered = all.filter(function (p) { return !(viewerId && urlId(p) === viewerId); });
      try { console.log('[IGSAVE]', JSON.stringify({ pathUser: pathUser, viewerId: viewerId, allIds: all.map(urlId), filteredIds: filtered.map(urlId) })); } catch (e) {}
      if (filtered.length) return filtered[0];
      if (all.length) return all[0];

      // 3. og:image (profile page sahaja)
      if (pathUser) {
        var og = document.querySelector('meta[property="og:image"]');
        if (og && og.getAttribute('content')) return og.getAttribute('content');
      }
      return null;
    } catch (e) { return null; }
  }

  function getThumbnailUrl() {
    const url = window.location.href;
    const isInstagramUrl = /instagram\.com/i.test(url);

    if (isInstagramUrl) {
      // Guna ekstrak profile pic OWNER page (bukan avatar akaun login).
      const ig = getInstagramProfilePicUrl();
      if (ig) return ig;
    }

    // Redgifs: utamakan gambar profil (userpic.redgifs.com), JANGAN guna apple-touch-icon
    if (/redgifs\.com/i.test(url)) {
      try {
        const userpicImg = document.querySelector('img[src*="userpic.redgifs.com"], img[srcset*="userpic.redgifs.com"]');
        if (userpicImg) {
          if (userpicImg.srcset) {
            const parts = userpicImg.srcset.split(',').map(p => p.trim());
            let bestUrl = userpicImg.src;
            let highest = 0;
            for (const part of parts) {
              const [u, d] = part.split(/\s+/);
              if (!u) continue;
              const res = d && d.endsWith('w') ? parseInt(d.slice(0, -1), 10) : 0;
              if (res > highest) { highest = res; bestUrl = u; }
            }
            if (/userpic\.redgifs\.com/i.test(bestUrl)) return absolutizeUrl(bestUrl);
          }
          if (/userpic\.redgifs\.com/i.test(userpicImg.src)) return absolutizeUrl(userpicImg.src);
        }
        // Img pertama dengan src userpic.redgifs.com
        const allImgs = document.querySelectorAll('img');
        for (const img of allImgs) {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
          if (/userpic\.redgifs\.com/i.test(src)) return absolutizeUrl(src);
        }
        // og:image / JSON-LD yang menunjuk ke userpic.redgifs.com
        const metaImg = document.querySelector('meta[property="og:image"], meta[name="twitter:image"]');
        if (metaImg) {
          const content = metaImg.getAttribute('content');
          if (content && /userpic\.redgifs\.com/i.test(content)) return absolutizeUrl(content);
        }
      } catch (e) { /* silent */ }
    }

    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const videoIdMatch = url.match(/(?:v=|\/embed\/|\/watch\?v=|\/\d\/|\/vi\/|youtu\.be\/|v\/|e\/|u\/\w+\/|embed\/|v=|\/shorts\/)([^#\&\?]*).*/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;
      if (videoId && videoId.length === 11) {
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }

    if (/jav|video|tube|porn|adult|xvideos|nymph|supjav|javneon/i.test(url)) {
      const videoEl = document.querySelector("video");
      if (videoEl && videoEl.getAttribute("poster")) {
        return absolutizeUrl(videoEl.getAttribute("poster"));
      }
      const playerSelectors = [".fp-engine", ".vjs-poster", "#player_html5_api", ".fluid_video_wrapper", ".player-poster", ".poster-image", ".video-js", ".player-container img", ".video-thumb img", ".jw-preview", ".player-wrap", "#player-wrap"];
      for (const selector of playerSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const poster = el.getAttribute("poster") || el.getAttribute("src") || extractBgUrl(el);
          if (poster && poster.startsWith("http")) return absolutizeUrl(poster);
        }
      }
      const videoMeta = getMeta("og:image") || getMeta("twitter:image") || getMeta("image_src") || getMeta("thumbnailUrl");
      // Tolak favicon/logo/icon (cth: redgifs letak apple-touch-icon.png sebagai og:image)
      if (videoMeta && !/(favicon|logo|icon|apple-touch)/i.test(videoMeta)) {
        return absolutizeUrl(videoMeta);
      }
      const javImages = document.querySelectorAll("img");
      for (const img of javImages) {
        const src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("data-original");
        if (src && !/(flag|logo|icon|button|btn|avatar|badge)/i.test(src)) {
          if (src.includes("/thumbs/") || src.includes("/snapshots/") || src.includes("poster") || src.includes("preview") || src.includes("thumb")) {
            return absolutizeUrl(src);
          }
        }
      }
    }

    const metaSelectors = ['meta[property="og:image"]', 'meta[name="twitter:image"]', 'meta[name="image"]', 'meta[property="image"]', 'link[rel="image_src"]'];
    for (const sel of metaSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const content = el.getAttribute("content") || el.getAttribute("href");
        if (content) return absolutizeUrl(content);
      }
    }

    try {
      const ldJson = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of ldJson) {
        try {
          const data = JSON.parse(script.innerText);
          if (data && data.thumbnailUrl) return absolutizeUrl(data.thumbnailUrl);
          if (data && data.image) {
            if (typeof data.image === "string") return absolutizeUrl(data.image);
            if (Array.isArray(data.image) && data.image[0]) return absolutizeUrl(data.image[0]);
            if (data.image.url) return absolutizeUrl(data.image.url);
          }
        } catch (e) {}
      }
    } catch (e) {}

    const videoFallbackEl = document.querySelector("video");
    if (videoFallbackEl && videoFallbackEl.getAttribute("poster")) {
      return absolutizeUrl(videoFallbackEl.getAttribute("poster"));
    }
    const genericPlayerSelectors = [".vjs-poster", "#player_html5_api", ".fluid_video_wrapper", ".player-poster", ".poster-image", ".video-js", ".player-container img", ".video-thumb img", ".jw-preview", ".player-wrap", "#player-wrap"];
    for (const selector of genericPlayerSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const poster = el.getAttribute("poster") || el.getAttribute("src") || extractBgUrl(el);
        if (poster && poster.startsWith("http")) return absolutizeUrl(poster);
      }
    }

    try {
      const allImages = document.querySelectorAll("img");
      const images = allImages.length > MAX_IMAGES_SCAN ? Array.from(allImages).slice(0, MAX_IMAGES_SCAN) : Array.from(allImages);
      let bestImg = null;
      let bestScore = 0;
      const minWidth = 200;
      const minHeight = 150;

      for (const img of images) {
        if (bestScore >= 18) break;

        if (isHidden(img)) continue;

        const src = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || img.getAttribute("data-original") || "";
        if (!src || src.startsWith("data:")) continue;

        const lowerSrc = src.toLowerCase();
        let skip = false;
        for (let i = 0; i < SKIP_URL_PATTERNS.length; i++) {
          const pattern = SKIP_URL_PATTERNS[i];
          // Don't skip 'avatar' for Instagram URLs
          if (pattern === 'avatar' && isInstagramUrl) continue;
          if (lowerSrc.includes(pattern)) { skip = true; break; }
        }
        if (skip) continue;

        const w = img.naturalWidth || parseInt(img.getAttribute("width") || "0", 10);
        const h = img.naturalHeight || parseInt(img.getAttribute("height") || "0", 10);
        
        const isStrongCandidate = /(thumb|poster|preview|cover|snapshot|hqdefault|profile_pic|profilepic|avatar)/i.test(src);
        if (!isStrongCandidate && (w < minWidth || h < minHeight)) continue;

        let score = Math.min((w * h) / 100000, 10);

        const classId = (img.className || "") + " " + (img.id || "");
        const lowerClassId = classId.toLowerCase();
        for (let i = 0; i < GOOD_CLASS_PATTERNS.length; i++) {
          if (lowerClassId.includes(GOOD_CLASS_PATTERNS[i])) { score += 5; break; }
        }
        for (let i = 0; i < SKIP_URL_PATTERNS.length; i++) {
          const pattern = SKIP_URL_PATTERNS[i];
          // Don't skip 'avatar' for Instagram URLs
          if (pattern === 'avatar' && isInstagramUrl) continue;
          if (lowerClassId.includes(pattern)) { skip = true; break; }
        }
        if (skip) continue;

        if (img.style.backgroundImage) score += 3;

        let parent = img.parentElement;
        while (parent && parent.tagName !== 'BODY') {
          const parentTag = parent.tagName;
          if (parentTag === 'ARTICLE' || parentTag === 'MAIN') { score += 8; break; }
          const parentClass = (parent.className || "").toLowerCase();
          if (parentClass.includes('article') || parentClass.includes('post') || parentClass.includes('content')) { score += 8; break; }
          parent = parent.parentElement;
        }

        const prevHeading = img.previousElementSibling;
        if (prevHeading && (prevHeading.tagName === 'H1' || prevHeading.tagName === 'H2' || prevHeading.tagName === 'H3')) score += 3;

        if (score > bestScore) {
          bestScore = score;
          bestImg = img;
        }
      }

      if (bestImg) {
        const finalSrc = bestImg.getAttribute("src") || bestImg.getAttribute("data-src") || bestImg.getAttribute("data-lazy-src") || bestImg.getAttribute("data-original");
        return absolutizeUrl(finalSrc);
      }
    } catch (e) {}

    return "";
  }

  function absolutizeUrls(root, anchors, mediaWithSrc, srcsetEls) {
    const base = document.baseURI;
    const isAbsoluteUrl = url => /^([a-z]+:)?\/\//i.test(url) || url.startsWith('data:');

    if (!anchors) anchors = root.querySelectorAll("a[href]");
    for (let i = 0; i < anchors.length; i++) {
      const el = anchors[i];
      const href = el.getAttribute("href");
      if (href && !isAbsoluteUrl(href)) {
        try { el.setAttribute("href", new URL(href, base).toString()); } catch (e) {}
      }
    }

    if (!mediaWithSrc) mediaWithSrc = root.querySelectorAll("img[src], source[src], video[src], audio[src]");
    for (let i = 0; i < mediaWithSrc.length; i++) {
      const el = mediaWithSrc[i];
      const src = el.getAttribute("src");
      if (src && !isAbsoluteUrl(src)) {
        try { el.setAttribute("src", new URL(src, base).toString()); } catch (e) {}
      }
    }

    if (!srcsetEls) srcsetEls = root.querySelectorAll("img[srcset], source[srcset]");
    for (let i = 0; i < srcsetEls.length; i++) {
      const el = srcsetEls[i];
      const srcset = el.getAttribute("srcset");
      if (!srcset) continue;
      const parts = srcset.split(",");
      let updated = "";
      for (let j = 0; j < parts.length; j++) {
        const part = parts[j].trim();
        const spaceIndex = part.indexOf(" ");
        if (spaceIndex === -1) {
          updated += (updated ? ", " : "") + (isAbsoluteUrl(part) ? part : tryAbsolutize(part, base));
        } else {
          const urlPart = part.slice(0, spaceIndex);
          const sizePart = part.slice(spaceIndex + 1);
          updated += (updated ? ", " : "") + (isAbsoluteUrl(urlPart) ? urlPart : tryAbsolutize(urlPart, base)) + " " + sizePart;
        }
      }
      el.setAttribute("srcset", updated);
    }
  }

  function tryAbsolutize(url, base) {
    try { return new URL(url, base).toString(); } catch (e) { return url; }
  }

  // Tag types that must be stripped from the cloned reader content.
  const BLACKLIST_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "FORM", "BUTTON", "INPUT",
    "TEXTAREA", "SELECT", "NAV", "FOOTER", "ASIDE", "HEADER", "SVG",
    "CANVAS", "VIDEO", "AUDIO"
  ]);

  // Single-pass clean + clone: remove blacklisted/irrelevant nodes, strip unsafe
  // attributes, mark images for lazy loading, and collect URL-bearing nodes for
  // absolutization — replacing the previous 3 separate querySelectorAll sweeps
  // over the (often very large) cloned article subtree (#4, #5).
  function cleanAndClone(root) {
    const clone = root.cloneNode(true);

    const anchors = [];
    const mediaWithSrc = [];
    const srcsetEls = [];

    const allElements = clone.querySelectorAll("*");
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      if (!el.parentNode) continue; // already removed by an earlier pass
      const tag = el.tagName;
      if (BLACKLIST_TAGS.has(tag)) { el.remove(); continue; }
      if (shouldRemoveByClass(el)) { el.remove(); continue; }

      if (tag === "IMG") {
        // Reader-view images load lazily to avoid blocking on long articles (#5)
        el.setAttribute("loading", "lazy");
        el.setAttribute("decoding", "async");
      }

      const attrs = el.attributes;
      if (attrs && attrs.length > 0) {
        for (let j = attrs.length - 1; j >= 0; j--) {
          const name = attrs[j].name;
          if (name.startsWith("on") || name === "style") {
            el.removeAttribute(name);
          }
        }
      }

      if (el.hasAttribute("href")) anchors.push(el);
      if (tag === "IMG" || tag === "SOURCE" || tag === "VIDEO" || tag === "AUDIO") {
        if (el.hasAttribute("src")) mediaWithSrc.push(el);
      }
      if (el.hasAttribute("srcset")) srcsetEls.push(el);
    }

    absolutizeUrls(clone, anchors, mediaWithSrc, srcsetEls);
    return clone;
  }

function extract(capturedUrl) {
  const best = pickBestCandidate();
  const cleaned = cleanAndClone(best);
  const text = cleaned.innerText ? cleaned.innerText : "";
  const textContent = text.trim();
  const words = textContent ? textContent.split(/\s+/) : [];
  const wordCount = words.length;
  const readingTime = wordCount ? Math.max(1, Math.round(wordCount / 200)) : 0;
  const excerpt = words.slice(0, 50).join(" ");

  const payload = {
    url: capturedUrl || window.location.href,
    title: getTitle(),
    byline: getByline(),
    siteName: getSiteName(),
    faviconUrl: getFaviconUrl(),
    thumbnailUrl: getThumbnailUrl(),
    excerpt,
    content: cleaned.innerHTML,
    textContent,
    wordCount,
    readingTime,
    lang: document.documentElement?.lang ?? ""
  };

  return payload;
}

// Handler untuk permintaan ekstraksi manual
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "request-extraction") {
    try {
      const payload = extract(message.capturedUrl);
      api.runtime.sendMessage({ type: "extracted", payload }).catch(err => console.error("[ContentScript] Failed to send extracted payload:", err));
      if (sendResponse) sendResponse({ ok: true });
    } catch (err) {
      if (sendResponse) sendResponse({ ok: false, error: err.message });
    }
    return true;
  }
});

// Extraction is triggered explicitly via the "request-extraction" message from
// the background script (sent on save), so we no longer auto-extract on every
// injection — this avoids running the (heavy) full-page extraction when no save
// is actually requested (#1).

// Hanya update extraction jika URL sudah disimpan (update konten, bukan save baru)
// Jika tidak, SPA navigation akan auto-save link yang diklik.
const _reExtractIfSaved = async () => {
  try {
    const currentUrl = window.location.href;
    const resp = await api.runtime.sendMessage({ type: "check-url-saved", url: currentUrl });
    if (resp && resp.saved) {
      const payload = extract();
      api.runtime.sendMessage({ type: "extracted", payload }).catch(err => console.error("[ContentScript] Failed to send extracted payload:", err));
    }
  } catch (_) {}
};

// Debounce SPA re-extraction so rapid navigations (YouTube/next-page) don't
// trigger multiple full extractions back-to-back (#6).
function debounce(fn, wait) {
  let timer = null;
  return function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(); }, wait);
  };
}
const debouncedReExtract = debounce(() => { _reExtractIfSaved().catch(() => {}); }, 600);

const handlePopstate = () => debouncedReExtract();
const handleYtNavigate = () => debouncedReExtract();

window.addEventListener("popstate", handlePopstate);
window.addEventListener("yt-navigate-finish", handleYtNavigate);

// Cleanup function to prevent memory leaks
const cleanupEventListeners = () => {
  window.removeEventListener("popstate", handlePopstate);
  window.removeEventListener("yt-navigate-finish", handleYtNavigate);
};

// Call cleanup on page unload
window.addEventListener("beforeunload", cleanupEventListeners);



})();