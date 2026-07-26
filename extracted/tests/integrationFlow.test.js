/**
 * Integration test: storage manager + validation + markdown round-trip.
 * Uses an injected mock storage API so it runs without a browser.
 * @jest-environment node
 */

const StorageManagerCore = require('../core/storageManagerCore');
const ValidationCore = require('../core/validationCore');
const MarkdownCore = require('../core/markdownExportCore');

// Build a chrome-like storage mock backed by an in-memory Map.
function makeMockApi() {
  const store = new Map();
  return {
    runtime: { lastError: null },
    storage: {
      local: {
        get(keys, cb) {
          const result = {};
          const keyArr = Array.isArray(keys)
            ? keys
            : typeof keys === 'string'
              ? [keys]
              : Array.from(store.keys());
          keyArr.forEach((k) => {
            if (store.has(k)) result[k] = store.get(k);
          });
          cb(result);
        },
        set(data, cb) {
          Object.entries(data).forEach(([k, v]) => store.set(k, v));
          if (cb) cb();
        },
        remove(keys, cb) {
          const arr = Array.isArray(keys) ? keys : [keys];
          arr.forEach((k) => store.delete(k));
          if (cb) cb();
        },
        clear(cb) {
          store.clear();
          if (cb) cb();
        }
      }
    }
  };
}

describe('Integration: save -> validate -> markdown round-trip', () => {
  test('persists validated items and survives markdown export/import', async () => {
    const api = makeMockApi();
    const sm = new StorageManagerCore.StorageManager({
      api,
      batchEnabled: false,
      cacheEnabled: true
    });

    // 1. Validate note URLs (mixed valid/invalid)
    const urls = ['https://example.com/a', 'not-a-url', 'https://news.site/b'];
    const validUrls = urls.filter((u) => ValidationCore.validateUrl(u).valid);
    expect(validUrls.length).toBe(2);

    // 2. Build items and persist through the storage manager
    const items = validUrls.map((u, i) => ({
      id: 'n' + i,
      url: u,
      title: 'Note ' + i,
      content: 'Body ' + i
    }));
    await sm.set('items', items);

    // 3. Read back and confirm persistence
    const read = await sm.get('items');
    expect(Array.isArray(read.items)).toBe(true);
    expect(read.items.length).toBe(2);

    // 4. Export to Markdown, then re-import, and confirm fidelity
    const md = MarkdownCore.collectionToMarkdown(read.items, { title: 'Export' });
    const docs = MarkdownCore.collectionFromMarkdown(md, { collectionTitle: 'Export' });
    expect(docs.length).toBe(2);
    expect(docs[0].title).toBe('Note 0');
    expect(docs[0].content).toContain('Body 0');

    // 5. Persist the re-imported docs and confirm the round-trip
    const reItems = docs.map((d, i) => ({ id: 'r' + i, title: d.title, content: d.content }));
    await sm.set('items_roundtrip', reItems);
    const back = await sm.get('items_roundtrip');
    expect(back.items_roundtrip[0].content).toContain('Body 0');
    expect(back.items_roundtrip.length).toBe(2);
  });

  test('batching coalesces a multi-key set into a single storage write', async () => {
    const api = makeMockApi();
    const writes = [];
    const origSet = api.storage.local.set;
    api.storage.local.set = (data, cb) => {
      writes.push(data);
      origSet(data, cb);
    };
    const sm = new StorageManagerCore.StorageManager({
      api,
      batchEnabled: true,
      batchDelay: 20,
      cacheEnabled: false
    });

    // Immediately after set() the batch should NOT have flushed yet
    const setPromise = sm.set({ a: 1, b: 2, c: 3 });
    expect(writes.length).toBe(0);

    await setPromise;
    await new Promise((r) => setTimeout(r, 40)); // allow flush

    expect(writes.length).toBe(1); // coalesced into one write
    expect(writes[0]).toEqual({ a: 1, b: 2, c: 3 });

    const read = await sm.get(['a', 'b', 'c']);
    expect(read.a).toBe(1);
    expect(read.b).toBe(2);
    expect(read.c).toBe(3);
  });

  test('cache serves repeated reads without hitting storage', async () => {
    const api = makeMockApi();
    let getCalls = 0;
    const origGet = api.storage.local.get;
    api.storage.local.get = (keys, cb) => {
      getCalls++;
      origGet(keys, cb);
    };
    const sm = new StorageManagerCore.StorageManager({
      api,
      batchEnabled: false,
      cacheEnabled: true,
      cacheTTL: 60000
    });

    // Seed storage directly (bypassing the manager cache)
    api.storage.local.set({ cached: { v: 42 } });

    const first = await sm.get('cached');
    const second = await sm.get('cached');
    expect(first.cached.v).toBe(42);
    expect(second.cached.v).toBe(42);
    // First read hits storage; second is served from cache (1 storage call total)
    expect(getCalls).toBe(1);
  });
});
