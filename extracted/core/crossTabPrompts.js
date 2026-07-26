/**
 * JARVIS Cross-tab Prompts (#4 Cross-tab Context Awareness).
 *
 * Menyediakan:
 *   - buildContextBlock(contexts, currentUrl): hasilkan blok teks yang disuntik
 *     ke dalam prompt JARVIS supaya ia "sedar" tab lain yang dibuka.
 *   - formatTabList / formatTabGroups: paparan berangka untuk arahan rentas tab
 *     (senaraikan tab / kumpulan tab).
 *
 * Dimuat di background DAN kumpulan content script JARVIS supaya
 * window.LocalPocketCrossTabPrompts tersedia di mana-mana buildConversationPrompt
 * dijalankan.
 */
(function () {
  'use strict';

  function escapeLine(s) {
    return String(s == null ? '' : s).replace(/\r?\n/g, ' ').trim();
  }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function truncate(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  // Blok yang disuntik ke prompt apabila pengguna merujuk tab lain.
  function buildContextBlock(contexts, currentUrl) {
    if (!Array.isArray(contexts) || !contexts.length) return '';
    var lines = ['Tab lain yang sedang dibuka oleh pengguna (konteks rentas tab):'];
    contexts.forEach(function (c, i) {
      var line = '[' + (i + 1) + '] ' + escapeLine(c.title || c.url || '(tiada tajuk)');
      var host = hostOf(c.url);
      if (host) line += ' (' + host + ')';
      if (c.url) line += ' — ' + escapeLine(c.url);
      if (c.textPreview) line += ' | Ringkasan: ' + truncate(escapeLine(c.textPreview), 220);
      lines.push(line);
    });
    lines.push('Guna maklumat di atas HANYA jika soalan merujuk tab lain. Jika tidak, abaikan.');
    return lines.join('\n');
  }

  function formatTabList(contexts, currentTabId) {
    if (!Array.isArray(contexts) || !contexts.length) {
      return 'Tiada tab lain yang dibuka (atau belum dijejak).';
    }
    var lines = ['Tab yang sedang dibuka (nombor = posisi di bar, kiri ke kanan):'];
    contexts.forEach(function (c, i) {
      var host = hostOf(c.url);
      var line = (i + 1) + '. ' + escapeLine(c.title || c.url || '(tiada tajuk)');
      if (c.tabId === currentTabId) line += ' (tab ini)';
      if (host) line += ' (' + host + ')';
      if (c.url) line += '\n   ' + escapeLine(c.url);
      lines.push(line);
    });
    lines.push('\nGunakan "tab N" (cth. "apa dalam tab 2?") untuk merujuk satu tab.');
    return lines.join('\n');
  }

  function formatTabGroups(contexts, currentTabId) {
    if (!Array.isArray(contexts) || !contexts.length) {
      return 'Tiada tab lain yang dibuka (atau belum dijejak).';
    }
    var groups = {};
    var ungrouped = [];
    contexts.forEach(function (c, i) {
      var entry = { i: i, c: c, isCurrent: (c.tabId === currentTabId) };
      if (c.groupId != null) {
        (groups[c.groupId] = groups[c.groupId] || []).push(entry);
      } else {
        ungrouped.push(entry);
      }
    });
    var lines = ['Kumpulan tab:'];
    var keys = Object.keys(groups);
    if (!keys.length && !ungrouped.length) return 'Tiada kumpulan tab dikesan.';
    keys.forEach(function (k) {
      lines.push('• Kumpulan #' + k + ':');
      groups[k].forEach(function (e) {
        var host = hostOf(e.c.url);
        lines.push('   ' + (e.i + 1) + '. ' + escapeLine(e.c.title || '') + (host ? ' (' + host + ')' : '') + (e.isCurrent ? ' (tab ini)' : ''));
      });
    });
    if (ungrouped.length) {
      lines.push('• Tab tidak berkumpulan:');
      ungrouped.forEach(function (e) {
        var host = hostOf(e.c.url);
        lines.push('   ' + (e.i + 1) + '. ' + escapeLine(e.c.title || '') + (host ? ' (' + host + ')' : '') + (e.isCurrent ? ' (tab ini)' : ''));
      });
    }
    return lines.join('\n');
  }

  var api = {
    buildContextBlock: buildContextBlock,
    formatTabList: formatTabList,
    formatTabGroups: formatTabGroups,
    hostOf: hostOf,
    truncate: truncate
  };

  if (typeof window !== 'undefined') window.LocalPocketCrossTabPrompts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
