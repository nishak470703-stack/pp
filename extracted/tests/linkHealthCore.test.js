// Unit tests untuk Link Health Monitor core (core/linkHealthCore.js)
const linkHealthCore = require("../core/linkHealthCore");

// Helper: pasang mock fetch untuk satu test
function mockFetchOnce(impl) {
  global.fetch = jest.fn(impl);
}
function mockAbortController() {
  global.AbortController = class {
    constructor() { this.signal = { aborted: false }; }
    abort() { this.signal.aborted = true; }
  };
}

describe("linkHealthCore.checkUrlHealth", () => {
  beforeEach(() => {
    mockAbortController();
  });

  test("URL 200 => ok", async () => {
    mockFetchOnce(async () => ({ status: 200, url: "https://example.com/a" }));
    const r = await linkHealthCore.checkUrlHealth("https://example.com/a");
    expect(r.status).toBe("ok");
    expect(r.statusCode).toBe(200);
    expect(r.finalUrl).toBeNull();
    expect(r.error).toBeNull();
  });

  test("URL 404 => broken", async () => {
    mockFetchOnce(async () => ({ status: 404, url: "https://example.com/missing" }));
    const r = await linkHealthCore.checkUrlHealth("https://example.com/missing");
    expect(r.status).toBe("broken");
    expect(r.statusCode).toBe(404);
  });

  test("URL 410 => broken", async () => {
    mockFetchOnce(async () => ({ status: 410, url: "https://example.com/gone" }));
    const r = await linkHealthCore.checkUrlHealth("https://example.com/gone");
    expect(r.status).toBe("broken");
  });

  test("server 500 => error", async () => {
    mockFetchOnce(async () => ({ status: 503, url: "https://example.com/x" }));
    const r = await linkHealthCore.checkUrlHealth("https://example.com/x");
    expect(r.status).toBe("error");
  });

  test("redirect dikesan via response.url berbeza => redirect", async () => {
    mockFetchOnce(async () => ({ status: 200, url: "https://example.com/final" }));
    const r = await linkHealthCore.checkUrlHealth("https://example.com/old");
    expect(r.status).toBe("redirect");
    expect(r.finalUrl).toBe("https://example.com/final");
  });

  test("206 (Range) masih ok", async () => {
    mockFetchOnce(async () => ({ status: 206, url: "https://example.com/a" }));
    const r = await linkHealthCore.checkUrlHealth("https://example.com/a");
    expect(r.status).toBe("ok");
  });

  test("network error => error / network-error", async () => {
    mockFetchOnce(async () => { throw new Error("failed to fetch"); });
    const r = await linkHealthCore.checkUrlHealth("https://example.com/a");
    expect(r.status).toBe("error");
    expect(r.error).toBe("network-error");
  });

  test("timeout (AbortError) => error / timeout", async () => {
    mockFetchOnce(async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    });
    const r = await linkHealthCore.checkUrlHealth("https://example.com/a", { timeoutMs: 1 });
    expect(r.status).toBe("error");
    expect(r.error).toBe("timeout");
  });

  test("invalid url => error / invalid-url", async () => {
    const r = await linkHealthCore.checkUrlHealth("");
    expect(r.status).toBe("error");
    expect(r.error).toBe("invalid-url");
  });

  test("id diteruskan ke hasil", async () => {
    mockFetchOnce(async () => ({ status: 200, url: "https://example.com/a" }));
    const r = await linkHealthCore.checkUrlHealth("https://example.com/a", { id: "item-1" });
    expect(r.id).toBe("item-1");
  });
});

describe("linkHealthCore.checkUrlsBatch", () => {
  beforeEach(() => { mockAbortController(); });

  test("array kosong => terus selesai", async () => {
    const onProgress = jest.fn();
    const res = await linkHealthCore.checkUrlsBatch([], { onProgress });
    expect(res).toEqual([]);
    expect(onProgress).toHaveBeenCalledWith(0, 0, null);
  });

  test("periksa beberapa URL, kekalkan urutan", async () => {
    global.fetch = jest.fn(async (url) => {
      if (url === "https://a.test") return { status: 200, url };
      if (url === "https://b.test") return { status: 404, url };
      if (url === "https://c.test") return { status: 200, url: "https://c.final" };
      return { status: 200, url };
    });
    const onProgress = jest.fn();
    const urls = [
      { id: "1", url: "https://a.test" },
      { id: "2", url: "https://b.test" },
      { id: "3", url: "https://c.test" }
    ];
    const res = await linkHealthCore.checkUrlsBatch(urls, { concurrency: 2, onProgress });
    expect(res[0].status).toBe("ok");
    expect(res[1].status).toBe("broken");
    expect(res[2].status).toBe("redirect");
    expect(res[2].finalUrl).toBe("https://c.final");
    expect(onProgress).toHaveBeenCalledTimes(3);
  });

  test("concurrency terhad tak buka lebih dari N serentak", async () => {
    let active = 0;
    let maxActive = 0;
    global.fetch = jest.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return { status: 200, url: "https://x" };
    });
    const urls = Array.from({ length: 10 }, (_, i) => ({ id: String(i), url: "https://x" + i }));
    await linkHealthCore.checkUrlsBatch(urls, { concurrency: 3 });
    expect(maxActive).toBeLessThanOrEqual(3);
  });
});

describe("linkHealthCore HEAD-first + hard timeout", () => {
  beforeEach(() => {
    global.AbortController = class {
      constructor() { this.signal = { aborted: false }; }
      abort() { this.signal.aborted = true; }
    };
  });

  test("HEAD 404 => broken tanpa GET fallback", async () => {
    let calls = [];
    global.fetch = jest.fn(async (url, opts) => {
      calls.push(opts && opts.method);
      return { status: 404, url };
    });
    const r = await linkHealthCore.checkUrlHealth("https://x.test");
    expect(r.status).toBe("broken");
    expect(calls).toEqual(["HEAD"]);
  });

  test("HEAD 405 => fallback GET", async () => {
    let calls = [];
    global.fetch = jest.fn(async (url, opts) => {
      calls.push(opts && opts.method);
      if (calls.length === 1) return { status: 405, url: "https://x.test" }; // HEAD ditolak
      return { status: 200, url: "https://x.test" }; // GET ok
    });
    const r = await linkHealthCore.checkUrlHealth("https://x.test");
    expect(r.status).toBe("ok");
    expect(calls).toEqual(["HEAD", "GET"]);
  });

  test("fetch gantung (promise tak resolve, abort diabaikan) tetap tamat pada hard timeout", async () => {
    // fetch return promise yang TAK PERNAH resolve; abort() buat takde apa2
    global.fetch = jest.fn(() => new Promise(() => {}));
    const start = Date.now();
    const r = await linkHealthCore.checkUrlHealth("https://hang.test", { timeoutMs: 60 });
    const elapsed = Date.now() - start;
    expect(r.status).toBe("error");
    expect(r.error).toBe("timeout");
    expect(elapsed).toBeLessThan(1000); // tamat dekat hard timeout, bukan forever
  });

  test("HEAD tiada response (network) => retry GET x2, masih network-error", async () => {
    let calls = [];
    global.fetch = jest.fn(async (url, opts) => {
      calls.push(opts && opts.method);
      throw new Error("failed to fetch");
    });
    const r = await linkHealthCore.checkUrlHealth("https://x.test");
    expect(r.status).toBe("error");
    expect(r.error).toBe("network-error");
    expect(calls).toEqual(["HEAD", "GET", "GET"]);
  });
});
