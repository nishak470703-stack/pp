/**
 * Markdown export/import for Local Pocket Reader
 * Converts notes and saved articles to/from Markdown for portable backup.
 */

(function attachLocalPocketMarkdownExportCore(globalScope) {
  'use strict';

  /**
   * Escape a string so it cannot break out of a fenced code block.
   * @param {string} text
   * @returns {string}
   */
  function escapeForFence(text) {
    return String(text == null ? '' : text);
  }

  /**
   * Pick a fence delimiter that does not appear in the content.
   * @param {string} text
   * @returns {string}
   */
  function pickFence(text) {
    const base = '```';
    let fence = base;
    while (text.indexOf(fence) !== -1) {
      fence += '`';
    }
    return fence;
  }

  /**
   * Normalize a value into a plain string.
   * @param {*} value
   * @returns {string}
   */
  function asText(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '';
    }
  }

  /**
   * Format a timestamp (ms or Date) into an ISO-ish date string.
   * @param {number|string|Date} ts
   * @returns {string}
   */
  function formatDate(ts) {
    if (!ts) return '';
    let d;
    if (ts instanceof Date) d = ts;
    else if (typeof ts === 'number') d = new Date(ts);
    else if (typeof ts === 'string') d = new Date(ts);
    else return '';
    if (isNaN(d.getTime())) return asText(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return (
      d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
    );
  }

  /**
   * Convert a single document (note or article) to a Markdown string.
   * @param {Object} doc
   * @param {Object} [opts]
   * @returns {string}
   */
  function documentToMarkdown(doc, opts) {
    opts = opts || {};
    const d = doc || {};
    const title = asText(d.title || d.name || 'Untitled').trim() || 'Untitled';
    const body = asText(d.content != null ? d.content : d.textContent != null ? d.textContent : d.body);
    const folder = asText(d.folder || d.folderName || d.category);
    const url = asText(d.url);
    const createdAt = formatDate(d.createdAt || d.time_added || d.dateCreated);
    const updatedAt = formatDate(d.updatedAt || d.time_updated || d.dateUpdated);

    const lines = [];
    lines.push('# ' + title);
    lines.push('');

    const meta = [];
    if (folder) meta.push(['Category', folder]);
    if (url) meta.push(['URL', url]);
    if (createdAt) meta.push(['Created', createdAt]);
    if (updatedAt) meta.push(['Updated', updatedAt]);

    if (meta.length && opts.includeMeta !== false) {
      meta.forEach(([k, v]) => lines.push('> **' + k + ':** ' + v));
      lines.push('');
    }

    if (body) {
      const fence = pickFence(body);
      lines.push(fence);
      lines.push(escapeForFence(body));
      lines.push(fence);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Convert a collection of documents to a single Markdown document.
   * @param {Array<Object>} docs
   * @param {Object} [opts]
   * @returns {string}
   */
  function collectionToMarkdown(docs, opts) {
    opts = opts || {};
    const list = Array.isArray(docs) ? docs : [];
    const header = opts.title ? '# ' + asText(opts.title) + '\n\n' : '';
    const intro = opts.intro ? asText(opts.intro) + '\n\n' : '';
    const sep = opts.separator || ('\n\n---\n\n');
    const parts = list.map((doc, i) => documentToMarkdown(doc, opts) + (i < list.length - 1 ? sep : ''));
    return header + intro + parts.join('');
  }

  /**
   * Basic parser: extract { title, content } from a Markdown document.
   * The first level-1 heading becomes the title; the rest (outside the
   * optional blockquote metadata) becomes the content.
   * @param {string} md
   * @returns {Object}
   */
  function parseMarkdown(md) {
    const text = asText(md);
    const lines = text.split(/\r?\n/);
    let title = '';
    const contentLines = [];
    let inFence = false;
    let started = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^```/.test(line.trim())) {
        inFence = !inFence;
        if (started) contentLines.push(line);
        continue;
      }
      if (!started && !inFence && /^#\s+/.test(line)) {
        title = line.replace(/^#\s+/, '').trim();
        started = true;
        continue;
      }
      if (/^>\s*\*\*/.test(line)) {
        // skip blockquote metadata lines on first pass
        if (!started) started = true;
        continue;
      }
      if (started || line.trim() !== '') {
        started = true;
        contentLines.push(line);
      }
    }

    return {
      title: title,
      content: contentLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    };
  }

  /**
   * Trigger a browser download of a Markdown file (no-op outside extension).
   * @param {string} filename
   * @param {string} markdown
   */
  function downloadMarkdown(filename, markdown) {
    if (typeof document === 'undefined' || !document.createElement) return false;
    try {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'local-pocket-export.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Parse a Markdown collection (as produced by collectionToMarkdown) back
   * into an array of document objects. Splits on top-level `---` separators
   * and parses each chunk. A leading collection-title chunk with no body is
   * ignored.
   * @param {string} md
   * @param {Object} [opts]
   * @returns {Array<Object>}
   */
  function collectionFromMarkdown(md, opts) {
    opts = opts || {};
    const lines = asText(md).split(/\r?\n/);
    const chunks = [];
    let cur = [];
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (/^```/.test(trimmed)) {
        inFence = !inFence;
      }
      // A top-level H1 (outside a fenced block) starts a new document,
      // unless it is the very first line of the file.
      if (!inFence && /^#\s+/.test(line) && cur.length) {
        chunks.push(cur.join('\n'));
        cur = [];
      }
      // Drop standalone `---` separator lines (used between documents).
      if (!inFence && /^-{3,}$/.test(trimmed)) {
        continue;
      }
      cur.push(line);
    }
    if (cur.length) chunks.push(cur.join('\n'));

    const docs = [];
    chunks.forEach((chunk) => {
      const parsed = parseMarkdown(chunk);
      if (!parsed.title && !parsed.content) return;
      // Skip the collection header (a lone H1 with no body)
      if (opts.collectionTitle && parsed.title === asText(opts.collectionTitle) && !parsed.content) {
        return;
      }
      docs.push(parsed);
    });
    return docs;
  }

  const api = {
    documentToMarkdown,
    collectionToMarkdown,
    parseMarkdown,
    collectionFromMarkdown,
    downloadMarkdown,
    formatDate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (globalScope && typeof globalScope === 'object') {
    globalScope.LocalPocketMarkdownExportCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
