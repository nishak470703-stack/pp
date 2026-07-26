/**
 * Browser detection and feature support utilities for Local Pocket Reader
 * All polyfills removed — Firefox 140+ natively supports Array.includes/find/findIndex,
 * String.includes/startsWith/endsWith, Object.assign, Promise, IntersectionObserver,
 * and requestIdleCallback.
 */

(function attachLocalPocketPolyfillsCore(globalScope) {
  'use strict';

  /**
   * Detect browser
   * @returns {Object} Browser info
   */
  function detectBrowser() {
    const ua = navigator.userAgent;

    if (ua.includes('Firefox')) {
      return { name: 'Firefox', isFirefox: true, isChrome: false, isEdge: false, isSafari: false };
    }
    if (ua.includes('Edg/')) {
      return { name: 'Edge', isFirefox: false, isChrome: false, isEdge: true, isSafari: false };
    }
    if (ua.includes('Chrome') && !ua.includes('Edg/')) {
      return { name: 'Chrome', isFirefox: false, isChrome: true, isEdge: false, isSafari: false };
    }
    if (ua.includes('Safari') && !ua.includes('Chrome')) {
      return { name: 'Safari', isFirefox: false, isChrome: false, isEdge: false, isSafari: true };
    }
    return { name: 'Unknown', isFirefox: false, isChrome: false, isEdge: false, isSafari: false };
  }

  /**
   * Check if browser supports a feature
   * @param {string} feature - Feature name
   * @returns {boolean} True if supported
   */
  function supportsFeature(feature) {
    const features = {
      webExtensions: typeof browser !== 'undefined' || typeof chrome !== 'undefined',
      promises: typeof Promise !== 'undefined',
      asyncAwait: (async function() {})() instanceof Promise,
      arrowFunctions: (() => {}) !== undefined,
      templateLiterals: `test` === 'test',
      destructuring: (() => { const {a} = {a: 1}; return a === 1; })(),
      spread: [...[1, 2, 3]].length === 3,
      classes: typeof class {} !== 'undefined',
      modules: typeof module !== 'undefined'
    };
    return features[feature] || false;
  }

  const api = {
    applyPolyfills: function() {}, // No-op: polyfills removed for Firefox 140+
    detectBrowser,
    supportsFeature
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (globalScope && typeof globalScope === 'object') {
    globalScope.LocalPocketPolyfillsCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
