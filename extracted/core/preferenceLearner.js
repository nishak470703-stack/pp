/**
 * Local Pocket Reader — JARVIS Preference Learner (#6.3 Automatic Preference Learning)
 *
 * Enjin pembelajaran preferensi tanpa AI: tracking counters + threshold.
 * Apabila pengguna konsisten memilih sesuatu nilai (cth. nada "casual")
 * melepasi ambang, JARVIS auto-promote nilai itu sebagai default baru.
 *
 * Modul tulen (pure helpers) — tiada storage. Dipanggil oleh memoryLayers.js.
 * Attach ke `window.LocalPocketPreferenceLearner`.
 */
(function (globalScope) {
  'use strict';

  // Ambang: berapa kali nilai mesti konsisten sebelum jadi default.
  var THRESHOLD = 4;

  /**
   * Tentukan sama ada satu nilai patut dipromote jadi default.
   * @param {Object} counts  { nilai: kiraan }
   * @param {string} currentDefault  default sekarang
   * @param {number} [threshold]
   * @returns {string|null} nilai teratas yg melepasi ambang (berbeza dari default), atau null
   */
  function promoteDefault(counts, currentDefault, threshold) {
    threshold = threshold || THRESHOLD;
    if (!counts || typeof counts !== 'object') return null;
    var topVal = null, topCount = 0;
    Object.keys(counts).forEach(function (k) {
      var c = Number(counts[k]) || 0;
      if (c > topCount) { topCount = c; topVal = k; }
    });
    if (topVal && topVal !== currentDefault && topCount >= threshold) return topVal;
    return null;
  }

  /**
   * Tambah 1 ke kiraan untuk satu nilai & kembalikan kiraan terkini.
   */
  function bump(counts, value) {
    counts = counts || {};
    counts[value] = (Number(counts[value]) || 0) + 1;
    return counts;
  }

  var api_export = {
    THRESHOLD: THRESHOLD,
    promoteDefault: promoteDefault,
    bump: bump
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api_export;
  if (globalScope && typeof globalScope === 'object') globalScope.LocalPocketPreferenceLearner = api_export;

})(typeof globalThis !== 'undefined' ? globalThis : this);
