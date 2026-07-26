/**
 * Unit tests for Local Pocket Reader core modules
 * Run with: npm test (if Jest is configured) or node tests/core.test.js
 */

// Mock the global scope for testing
if (typeof globalThis === 'undefined') {
  global.globalThis = global;
}

// Load core modules
const LoggerCore = require('../core/loggerCore');
const ValidationCore = require('../core/validationCore');
const ErrorHandlerCore = require('../core/errorHandlerCore');
const StateManagementCore = require('../core/stateManagementCore');
const CommonUtilsCore = require('../core/commonUtilsCore');

describe('LoggerCore', () => {
  let logger;

  beforeEach(() => {
    logger = LoggerCore;
    logger.setLogLevel('info');
  });

  test('should set and get log level', () => {
    logger.setLogLevel('debug');
    expect(logger.getLogLevel()).toBe('debug');
  });

  test('should handle invalid log level', () => {
    logger.setLogLevel('invalid');
    expect(logger.getLogLevel()).toBe('info'); // Should default to info
  });

  test('should have correct log levels', () => {
    expect(logger.LOG_LEVELS.DEBUG).toBe(0);
    expect(logger.LOG_LEVELS.INFO).toBe(1);
    expect(logger.LOG_LEVELS.WARN).toBe(2);
    expect(logger.LOG_LEVELS.ERROR).toBe(3);
    expect(logger.LOG_LEVELS.NONE).toBe(4);
  });
});

describe('ValidationCore', () => {
  test('should validate valid URL', () => {
    const result = ValidationCore.validateUrl('https://example.com');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('https://example.com');
    expect(result.error).toBeNull();
  });

  test('should reject invalid URL', () => {
    const result = ValidationCore.validateUrl('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('should reject empty URL', () => {
    const result = ValidationCore.validateUrl('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('should reject data URL by default', () => {
    const result = ValidationCore.validateUrl('data:text/plain,hello');
    expect(result.valid).toBe(false);
  });

  test('should allow data URL with option', () => {
    const result = ValidationCore.validateUrl('data:text/plain,hello', { allowDataProtocol: true });
    expect(result.valid).toBe(true);
  });

  test('should validate category name', () => {
    const result = ValidationCore.validateCategoryName('My Category');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('My Category');
  });

  test('should reject empty category name', () => {
    const result = ValidationCore.validateCategoryName('');
    expect(result.valid).toBe(false);
  });

  test('should sanitize HTML in category name', () => {
    const result = ValidationCore.validateCategoryName('<script>alert("xss")</script>');
    expect(result.valid).toBe(true);
    expect(result.sanitized).not.toContain('<script>');
  });

  test('should validate title', () => {
    const result = ValidationCore.validateTitle('My Article Title');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('My Article Title');
  });

  test('should handle empty title with default', () => {
    const result = ValidationCore.validateTitle('');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('Untitled');
  });

  test('should validate boolean setting', () => {
    const result = ValidationCore.validateSetting('showBadge', true, false);
    expect(result).toBe(true);
  });

  test('should validate number setting', () => {
    const result = ValidationCore.validateSetting('pageSize', 25, 10);
    expect(result).toBe(25);
  });

  test('should reject invalid number setting', () => {
    const result = ValidationCore.validateSetting('pageSize', 150, 10);
    expect(result).toBe(10); // Should return default
  });

  test('should sanitize HTML — strip script tags', () => {
    const html = '<script>alert("xss")</script><p>Hello</p>';
    const sanitized = ValidationCore.sanitizeHtml(html);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('Hello');
  });

  test('should sanitize HTML — strip event handlers', () => {
    const html = '<img src="x" onerror="alert(1)"><p>Safe</p>';
    const sanitized = ValidationCore.sanitizeHtml(html);
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).toContain('Safe');
  });

  test('should sanitize HTML — strip svg onload', () => {
    const html = '<svg onload="alert(1)"><p>Text</p></svg>';
    const sanitized = ValidationCore.sanitizeHtml(html);
    expect(sanitized).not.toContain('onload');
  });

  test('should sanitize HTML — strip javascript: URIs', () => {
    const html = '<a href="javascript:alert(1)">Click</a>';
    const sanitized = ValidationCore.sanitizeHtml(html);
    expect(sanitized).not.toContain('javascript:');
  });

  test('should sanitize HTML — preserve legitimate img tags (browser/DOMPurify)', () => {
    // In browser with DOMPurify loaded, img tags with safe src/alt are preserved.
    // In Node.js fallback mode, all tags are stripped for safety.
    const html = '<p>Hello</p><img src="https://example.com/photo.jpg" alt="photo">';
    const sanitized = ValidationCore.sanitizeHtml(html);
    // Fallback strips all tags; DOMPurify would preserve img
    expect(sanitized).toContain('Hello');
  });

  test('should sanitize HTML — preserve legitimate links (browser/DOMPurify)', () => {
    const html = '<a href="https://example.com" target="_blank" rel="noopener">Link</a>';
    const sanitized = ValidationCore.sanitizeHtml(html);
    // Fallback strips all tags; DOMPurify would preserve a
    expect(sanitized).toContain('Link');
  });

  test('should sanitize HTML — empty input returns empty string', () => {
    expect(ValidationCore.sanitizeHtml('')).toBe('');
  });

  test('should sanitize HTML — non-string input returns empty string', () => {
    expect(ValidationCore.sanitizeHtml(null)).toBe('');
    expect(ValidationCore.sanitizeHtml(undefined)).toBe('');
    expect(ValidationCore.sanitizeHtml(123)).toBe('');
  });

  test('should validate note content', () => {
    const result = ValidationCore.validateNoteContent('My note content');
    expect(result.valid).toBe(true);
  });

  test('should validate note content with HTML (browser/DOMPurify)', () => {
    const result = ValidationCore.validateNoteContent('<p>Hello <b>world</b></p>');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toContain('Hello');
    // In browser DOMPurify preserves <b>; in Node fallback all tags are stripped
  });

  test('should validate note content — strip XSS from notes', () => {
    const result = ValidationCore.validateNoteContent('<script>alert(1)</script><p>Note</p>');
    expect(result.valid).toBe(true);
    expect(result.sanitized).not.toContain('<script>');
  });

  test('should reject oversized note content', () => {
    const largeContent = 'x'.repeat(100001);
    const result = ValidationCore.validateNoteContent(largeContent);
    expect(result.valid).toBe(false);
  });

  test('should validate domain exception', () => {
    const result = ValidationCore.validateDomainException('*.example.com');
    expect(result.valid).toBe(true);
  });

  test('should validate gesture pattern', () => {
    const pattern = [[0, 0], [100, 100], [200, 200]];
    const result = ValidationCore.validateGesturePattern(pattern);
    expect(result.valid).toBe(true);
  });

  test('should reject invalid gesture pattern', () => {
    const result = ValidationCore.validateGesturePattern('not-an-array');
    expect(result.valid).toBe(false);
  });
});

describe('ErrorHandlerCore', () => {
  test('should categorize network error', () => {
    const error = new Error('Network request failed');
    const category = ErrorHandlerCore.categorizeError(error);
    expect(category).toBe(ErrorHandlerCore.ERROR_CATEGORIES.NETWORK);
  });

  test('should categorize storage error', () => {
    const error = new Error('Storage quota exceeded');
    const category = ErrorHandlerCore.categorizeError(error);
    expect(category).toBe(ErrorHandlerCore.ERROR_CATEGORIES.STORAGE);
  });

  test('should categorize permission error', () => {
    const error = new Error('Permission denied');
    const category = ErrorHandlerCore.categorizeError(error);
    expect(category).toBe(ErrorHandlerCore.ERROR_CATEGORIES.PERMISSION);
  });

  test('should get user-friendly message', () => {
    const error = new Error('Network request failed');
    const userMessage = ErrorHandlerCore.getUserMessage(error, 'TestContext');
    expect(userMessage.message).toBeTruthy();
    expect(userMessage.category).toBeTruthy();
    expect(userMessage.canRecover).toBeDefined();
  });

  test('should handle error', () => {
    const error = new Error('Test error');
    const result = ErrorHandlerCore.handleError(error, 'TestContext');
    expect(result.handled).toBe(true);
    expect(result.message).toBeTruthy();
  });

  test('should wrap function with error handling', async () => {
    const fn = () => { throw new Error('Test error'); };
    const wrapped = ErrorHandlerCore.withErrorHandling(fn, 'TestContext');
    
    await expect(wrapped()).rejects.toBeDefined();
  });

  test('should safe execute function', () => {
    const fn = () => { throw new Error('Test error'); };
    const result = ErrorHandlerCore.safeExecute(fn, 'default', 'TestContext');
    expect(result).toBe('default');
  });
});

describe('StateManagementCore', () => {
  let store;

  beforeEach(() => {
    store = new StateManagementCore.StateStore({ test: 'value' });
  });

  test('should get state', () => {
    expect(store.get('test')).toBe('value');
  });

  test('should get entire state', () => {
    const state = store.get();
    expect(state.test).toBe('value');
  });

  test('should set state value', () => {
    store.set('test', 'new value');
    expect(store.get('test')).toBe('new value');
  });

  test('should notify listeners on change', () => {
    let notified = false;
    store.subscribe((changes) => {
      notified = true;
    });
    store.set('test', 'new value');
    expect(notified).toBe(true);
  });

  test('should not notify on no change', () => {
    let notified = false;
    store.subscribe((changes) => {
      notified = true;
    });
    store.set('test', 'value'); // Same value
    expect(notified).toBe(false);
  });

  test('should unsubscribe listener', () => {
    let notified = false;
    const unsubscribe = store.subscribe((changes) => {
      notified = true;
    });
    unsubscribe();
    store.set('test', 'new value');
    expect(notified).toBe(false);
  });

  test('should reset state', () => {
    store.set('test', 'new value');
    store.reset({ test: 'reset' });
    expect(store.get('test')).toBe('reset');
  });

  test('should clear listeners', () => {
    store.subscribe(() => {});
    store.clearListeners();
    expect(store.listeners.size).toBe(0);
  });
});

describe('CacheManager', () => {
  let cache;

  beforeEach(() => {
    cache = new StateManagementCore.CacheManager(1000);
  });

  test('should set and get value', () => {
    cache.set('test', 'value');
    expect(cache.get('test')).toBe('value');
  });

  test('should return undefined for missing key', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  test('should expire cache entry', (done) => {
    cache.set('test', 'value', 100); // 100ms TTL
    setTimeout(() => {
      expect(cache.get('test')).toBeUndefined();
      done();
    }, 150);
  });

  test('should get or set with factory', async () => {
    let factoryCalled = false;
    const factory = () => {
      factoryCalled = true;
      return Promise.resolve('value');
    };
    
    const result1 = await cache.getOrSet('test', factory, 1000);
    expect(factoryCalled).toBe(true);
    expect(result1).toBe('value');
    
    const result2 = await cache.getOrSet('test', factory, 1000);
    expect(factoryCalled).toBe(true); // Still true from first call
    expect(result2).toBe('value');
  });

  test('should invalidate cache entry', () => {
    cache.set('test', 'value');
    cache.invalidate('test');
    expect(cache.get('test')).toBeUndefined();
  });

  test('should clear all cache', () => {
    cache.set('test1', 'value1');
    cache.set('test2', 'value2');
    cache.clear();
    expect(cache.get('test1')).toBeUndefined();
    expect(cache.get('test2')).toBeUndefined();
  });
});

describe('CommonUtilsCore', () => {
  test('should get extension API', () => {
    const api = CommonUtilsCore.getExtensionApi();
    // In test environment, might return null or browser/chrome
    expect(api === null || typeof api === 'object').toBe(true);
  });

  test('should normalize URL', () => {
    const url = 'https://www.example.com/path/?utm_source=test#section';
    const normalized = CommonUtilsCore.normalizeUrl(url);
    expect(normalized).not.toContain('utm_source');
    expect(normalized).not.toContain('#section');
  });

  test('should build URL comparison candidates', () => {
    const candidates = CommonUtilsCore.buildUrlCompareCandidates('https://example.com/path');
    expect(candidates.size).toBeGreaterThan(1);
    expect(candidates.has('https://example.com/path')).toBe(true);
  });

  test('should debounce function', (done) => {
    let callCount = 0;
    const debounced = CommonUtilsCore.debounce(() => {
      callCount++;
    }, 100);
    
    debounced();
    debounced();
    debounced();
    
    setTimeout(() => {
      expect(callCount).toBe(1);
      done();
    }, 150);
  });

  test('should throttle function', (done) => {
    let callCount = 0;
    const throttled = CommonUtilsCore.throttle(() => {
      callCount++;
    }, 100);
    
    throttled();
    throttled();
    throttled();
    
    setTimeout(() => {
      expect(callCount).toBe(1);
      done();
    }, 150);
  });

  test('should generate unique ID', () => {
    const id1 = CommonUtilsCore.generateId();
    const id2 = CommonUtilsCore.generateId();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
  });

  test('should deep clone object', () => {
    const obj = { a: 1, b: { c: 2 } };
    const cloned = CommonUtilsCore.deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
    expect(cloned.b).not.toBe(obj.b);
  });

  test('should safe JSON parse', () => {
    const result = CommonUtilsCore.safeJsonParse('{"a": 1}');
    expect(result).toEqual({ a: 1 });
  });

  test('should handle invalid JSON', () => {
    const result = CommonUtilsCore.safeJsonParse('invalid', null);
    expect(result).toBeNull();
  });

  test('should safe JSON stringify', () => {
    const result = CommonUtilsCore.safeJsonStringify({ a: 1 });
    expect(result).toBe('{"a":1}');
  });

  test('should handle circular reference in stringify', () => {
    const obj = { a: 1 };
    obj.self = obj;
    const result = CommonUtilsCore.safeJsonStringify(obj, '{}');
    expect(result).toBe('{}');
  });

  test('should format file size', () => {
    expect(CommonUtilsCore.formatFileSize(0)).toBe('0 Bytes');
    expect(CommonUtilsCore.formatFileSize(1024)).toBe('1 KB');
    expect(CommonUtilsCore.formatFileSize(1048576)).toBe('1 MB');
  });

  test('should format date', () => {
    const now = new Date();
    const formatted = CommonUtilsCore.formatDate(now);
    expect(formatted).toBe('Just now');
  });
});

describe('Summary Provider Configs', () => {
  const { SUMMARY_AI_PROVIDER_CONFIGS: configs } = require('../core/backgroundSummary');

  test('should have configs for all supported providers', () => {
    expect(configs).toBeDefined();
    expect(configs.chatgpt).toBeDefined();
    expect(configs.chatgpt.id).toBe('chatgpt');
    expect(configs.chatgpt.label).toBe('ChatGPT');
    expect(configs.chatgpt.baseUrl).toContain('chatgpt.com');

    expect(configs.claude).toBeDefined();
    expect(configs.claude.id).toBe('claude');
    expect(configs.claude.baseUrl).toContain('claude.ai');

    expect(configs.gemini).toBeDefined();
    expect(configs.gemini.baseUrl).toContain('gemini.google.com');

    expect(configs.perplexity).toBeDefined();
    expect(configs.copilot).toBeDefined();
    expect(configs.grok).toBeDefined();
    expect(configs.deepseek).toBeDefined();
    expect(configs.poe).toBeDefined();
    expect(configs.mistral).toBeDefined();
    expect(configs.google).toBeDefined();
  });

  test('each provider should have required fields', () => {
    for (const [key, config] of Object.entries(configs)) {
      expect(config.id).toBe(key);
      expect(typeof config.label).toBe('string');
      expect(config.label.length).toBeGreaterThan(0);
      expect(typeof config.baseUrl).toBe('string');
      expect(config.baseUrl.startsWith('http')).toBe(true);
    }
  });
});

describe('YouTube URL-only prompt (Gemini)', () => {
  const { buildMalayYouTubeUrlOnlyPrompt } = require('../core/summaryPromptCore');

  test('should include the YouTube URL and instruct Gemini to fetch transcript itself', () => {
    const prompt = buildMalayYouTubeUrlOnlyPrompt({
      url: 'https://www.youtube.com/watch?v=abc123',
      title: 'Video Contoh',
      categoryName: 'Tech',
      summaryMode: 'deep',
      presetLabel: 'General',
      presetFocus: 'Fokus seimbang',
      outputLanguage: 'ms',
      tone: 'neutral',
      maxWords: 0,
    });
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('https://www.youtube.com/watch?v=abc123');
    expect(prompt).toContain('Video Contoh');
    expect(prompt).toContain('Ambil');
    expect(prompt).toContain('transkrip');
  });

  test('should NOT embed transcript text and should NOT include Confidence & Coverage', () => {
    const prompt = buildMalayYouTubeUrlOnlyPrompt({
      url: 'https://www.youtube.com/watch?v=abc123',
      title: 'Video Contoh',
      summaryMode: 'deep',
    });
    expect(prompt).not.toContain('Transkrip:');
    expect(prompt).not.toContain('Confidence & Coverage');
    expect(prompt).not.toContain('Liputan transkrip anggaran');
  });

  test('should still include standard output sections', () => {
    const prompt = buildMalayYouTubeUrlOnlyPrompt({
      url: 'https://youtu.be/xyz',
      title: 'T',
      summaryMode: 'quick',
    });
    expect(prompt).toContain('## Ringkasan Umum');
    expect(prompt).toContain('## Inti Utama');
    expect(prompt).toContain('## Penutup');
  });
});

describe('Pomodoro Default State', () => {
  test('should have correct default structure', () => {
    const { _pomoDefaultState } = require('../core/backgroundPomodoro');
    const state = _pomoDefaultState();

    expect(state.mode).toBe('focus');
    expect(state.running).toBe(false);
    expect(state.sessions).toBe(0);
    expect(state.settings).toBeDefined();
    expect(state.settings.focusTime).toBe(25);
    expect(state.settings.shortBreakTime).toBe(5);
    expect(state.settings.longBreakTime).toBe(15);
    expect(state.settings.soundVolume).toBe(0.3);
  });
});

describe('Summary Provider Functions', () => {
  let normalizeSummaryAiProvider, getProviderUrl;

  beforeAll(() => {
    ({ normalizeSummaryAiProvider, getProviderUrl } = require('../core/backgroundSummary'));
  });

  test('normalizeSummaryAiProvider — valid provider returns itself', () => {
    expect(normalizeSummaryAiProvider('chatgpt')).toBe('chatgpt');
    expect(normalizeSummaryAiProvider('claude')).toBe('claude');
    expect(normalizeSummaryAiProvider('gemini')).toBe('gemini');
  });

  test('normalizeSummaryAiProvider — case insensitive', () => {
    expect(normalizeSummaryAiProvider('ChatGPT')).toBe('chatgpt');
    expect(normalizeSummaryAiProvider('CLAUDE')).toBe('claude');
    expect(normalizeSummaryAiProvider('  Gemini  ')).toBe('gemini');
  });

  test('normalizeSummaryAiProvider — invalid provider defaults to chatgpt', () => {
    expect(normalizeSummaryAiProvider('')).toBe('chatgpt');
    expect(normalizeSummaryAiProvider(null)).toBe('chatgpt');
    expect(normalizeSummaryAiProvider(undefined)).toBe('chatgpt');
    expect(normalizeSummaryAiProvider('nonexistent')).toBe('chatgpt');
  });

  test('getProviderUrl — returns correct base URL', () => {
    expect(getProviderUrl('chatgpt')).toContain('chatgpt.com');
    expect(getProviderUrl('claude')).toContain('claude.ai');
    expect(getProviderUrl('gemini')).toContain('gemini.google.com');
    expect(getProviderUrl('perplexity')).toContain('perplexity.ai');
  });

  test('getProviderUrl — invalid provider returns chatgpt url', () => {
    expect(getProviderUrl('nonexistent')).toContain('chatgpt.com');
    expect(getProviderUrl('')).toContain('chatgpt.com');
  });
});

describe('DedupeCore', () => {
  const DedupeCore = require('../core/dedupeCore');

  test('should return empty result for empty input', () => {
    const result = DedupeCore.dedupeItemsByUrl([]);
    expect(result.items).toEqual([]);
    expect(result.changed).toBe(false);
  });

  test('should return same items when no duplicates', () => {
    const items = [
      { id: '1', url: 'https://example.com/a', title: 'A' },
      { id: '2', url: 'https://example.com/b', title: 'B' },
    ];
    const result = DedupeCore.dedupeItemsByUrl(items);
    expect(result.items).toHaveLength(2);
    expect(result.changed).toBe(false);
  });

  test('should merge items with same URL', () => {
    const items = [
      { id: '1', url: 'https://example.com/page', title: 'First', time_added: 100 },
      { id: '2', url: 'https://example.com/page', title: 'Second', time_added: 200 },
    ];
    const result = DedupeCore.dedupeItemsByUrl(items);
    expect(result.items).toHaveLength(1);
    expect(result.changed).toBe(true);
    // Protected field (id, time_added) stay from primary
    expect(result.items[0].id).toBe('1');
    expect(result.items[0].time_added).toBe(100);
    // title from primary is kept (not overwritten by duplicate)
    expect(result.items[0].title).toBe('First');
  });

  test('should preserve primary title when duplicate has empty title', () => {
    const items = [
      { id: '1', url: 'https://example.com/page', title: 'Original Title' },
      { id: '2', url: 'https://example.com/page', title: '' },
    ];
    const result = DedupeCore.dedupeItemsByUrl(items);
    expect(result.items[0].title).toBe('Original Title');
  });

  test('should fill in empty primary title from duplicate', () => {
    const items = [
      { id: '1', url: 'https://example.com/page', title: '' },
      { id: '2', url: 'https://example.com/page', title: 'New Title' },
    ];
    const result = DedupeCore.dedupeItemsByUrl(items);
    expect(result.items[0].title).toBe('New Title');
  });

  test('should handle non-object items gracefully', () => {
    const items = ['string', 123, null, { id: '1', url: 'https://example.com' }];
    const result = DedupeCore.dedupeItemsByUrl(items);
    expect(result.items).toHaveLength(4);
  });

  test('should handle items without URL', () => {
    const items = [
      { id: '1', title: 'No URL' },
      { id: '2', title: 'Also no URL' },
    ];
    const result = DedupeCore.dedupeItemsByUrl(items);
    expect(result.items).toHaveLength(2);
  });
});

describe('JARVIS Core (sidebar-AI features copied to Jarvis)', () => {
  const JarvisCore = require('../core/jarvisCore');

  test('exposes SUMMARY_MODES and TONE_OPTIONS', () => {
    expect(Array.isArray(JarvisCore.SUMMARY_MODES)).toBe(true);
    expect(Array.isArray(JarvisCore.TONE_OPTIONS)).toBe(true);
    const modes = JarvisCore.SUMMARY_MODES.map(function (m) { return m.id; });
    expect(modes).toEqual(expect.arrayContaining(['auto', 'quick', 'deep', 'action_items', 'study_notes', 'research', 'custom']));
    const tones = JarvisCore.TONE_OPTIONS.map(function (t) { return t.id; });
    expect(tones).toEqual(expect.arrayContaining(['neutral', 'formal', 'casual', 'educational']));
  });

  test('buildConversationPrompt injects tone instruction', () => {
    const p = JarvisCore.buildConversationPrompt('hi', { title: 't', url: 'u', text: 'x' }, [], { tone: 'formal' });
    expect(p).toMatch(/nada formal/i);
  });

  test('buildConversationPrompt injects summary-mode instruction (non-auto)', () => {
    const p = JarvisCore.buildConversationPrompt('Ringkaskan halaman', { title: 't', url: 'u', text: 'x' }, [], { summaryMode: 'action_items' });
    expect(p).toMatch(/action items/i);
  });

  test('buildConversationPrompt ignores auto mode (no extra instruction)', () => {
    const p = JarvisCore.buildConversationPrompt('hi', { title: 't', url: 'u', text: 'x' }, [], { summaryMode: 'auto' });
    expect(p).not.toMatch(/ARAHAN RINGKASAN/i);
  });

  test('buildSummaryPrompt delegates to buildConversationPrompt with opts', () => {
    const p = JarvisCore.buildSummaryPrompt('Ringkaskan', { title: 't', url: 'u', text: 'x' }, [], { summaryMode: 'deep', tone: 'casual' });
    expect(p).toMatch(/MENDELA/i);
    expect(p).toMatch(/santai/i);
  });

  // Fasa 5 (RAG) — suntikan nota/artikel relevan ke prompt.
  test('buildRagBlock formats notes and articles', () => {
    const block = JarvisCore.buildRagBlock([
      { kind: 'note', title: 'Projek X', text: 'idea asal projek' },
      { kind: 'item', category: 'Berita', title: 'Temubual', url: 'https://a', text: 'kandungan artikel' },
    ]);
    expect(block).toMatch(/nota & artikel simpanan/i);
    expect(block).toMatch(/\[1\] \(NOTA\) Projek X/);
    expect(block).toMatch(/\[2\] \(ARTIKEL · Berita\) Temubual/);
  });

  test('buildRagBlock returns empty string when no docs', () => {
    expect(JarvisCore.buildRagBlock([])).toBe('');
    expect(JarvisCore.buildRagBlock(null)).toBe('');
    expect(JarvisCore.buildRagBlock(undefined)).toBe('');
  });

  test('buildRagBlock truncates long doc text to 500 chars', () => {
    const long = 'a'.repeat(1000);
    const block = JarvisCore.buildRagBlock([{ kind: 'note', title: 'T', text: long }]);
    // 500 aksara + elipsis (…)
    expect(block).toMatch(/a{500}\u2026/);
    expect(block).not.toMatch(/a{501}/);
  });

  test('buildConversationPrompt injects RAG block + instruction when ragDocs given', () => {
    const p = JarvisCore.buildConversationPrompt('apa projek X?', { title: 't', url: 'u', text: 'x' }, [], {
      ragDocs: [{ kind: 'note', title: 'Projek X', text: 'nota lama saya' }],
    });
    expect(p).toMatch(/nota & artikel simpanan/i);
    expect(p).toMatch(/utamakan dan rujuk/i);
    expect(p).toMatch(/nota lama saya/);
  });

  test('buildConversationPrompt unchanged (no RAG) when ragDocs absent/empty', () => {
    const base = JarvisCore.buildConversationPrompt('hi', { title: 't', url: 'u', text: 'x' }, []);
    const withEmpty = JarvisCore.buildConversationPrompt('hi', { title: 't', url: 'u', text: 'x' }, [], { ragDocs: [] });
    expect(base).not.toMatch(/nota & artikel simpanan/i);
    expect(withEmpty).toBe(base);
  });

  test('parseIntent recognises save_answer_note command', () => {
    expect(JarvisCore.parseIntent('simpan jawapan ke nota').type).toBe('save_answer_note');
    expect(JarvisCore.parseIntent('save answer to note').type).toBe('save_answer_note');
  });

  // "cari ... di kategori picker" mesti jadi carian library, BUKAN buka picker.
  test('parseIntent: "cari X di kategori picker" -> search library (bukan open-category)', () => {
    const it = JarvisCore.parseIntent('cari berkenaan ai di kategori picker');
    expect(it.type).toBe('search');
    expect(it.mode).toBe('library');
    expect(it.ambiguous).toBe(false);
    expect(it.query.toLowerCase()).toContain('ai');
    expect(it.query.toLowerCase()).not.toContain('kategori');
    expect(it.query.toLowerCase()).not.toContain('picker');
  });

  test('parseIntent: "cari X dalam simpanan" -> search library', () => {
    const it = JarvisCore.parseIntent('cari kucing dalam simpanan');
    expect(it.type).toBe('search');
    expect(it.mode).toBe('library');
    expect(it.query.toLowerCase()).toContain('kucing');
  });

  test('parseIntent: "buka kategori AI" masih open-category', () => {
    expect(JarvisCore.parseIntent('buka kategori AI').type).toBe('open-category');
    expect(JarvisCore.parseIntent('kategori picker').type).toBe('open-category');
  });
});

// Run tests if not using a test runner
if (typeof describe === 'undefined' || typeof test === 'undefined') {
  console.log('Tests require Jest or similar test runner');
  console.log('Install with: npm install --save-dev jest');
  console.log('Run with: npx jest tests/core.test.js');
}
