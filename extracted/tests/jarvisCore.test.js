const JarvisCore = require("../core/jarvisCore.js");

const TOOLS = [
  { action: "click", params: ["target"], desc: "Klik elemen." },
  { action: "fill", params: ["field", "value"], desc: "Isi medan." },
  { action: "chat", params: ["question"], desc: "Soalan bebas." },
];

describe("JarvisCore.buildPlanPrompt page context", () => {
  test("includes page text in planner context when ctx.text is present", () => {
    const ctx = {
      title: "Berita Hari Ini",
      url: "https://example.com/berita",
      text: "Artikel tentang langgan surat berita. Butang Langgan ada di atas. Email anda untuk borang.",
    };
    const prompt = JarvisCore.buildPlanPrompt("klik butang langgan", ctx, [], TOOLS);
    expect(prompt).toContain("Kandungan halaman");
    expect(prompt).toContain("Butang Langgan");
    expect(prompt).toContain("Tajuk: Berita Hari Ini");
    expect(prompt).toContain("URL: https://example.com/berita");
    // Rule telling the brain to use page content for targets
    expect(prompt).toContain("GUNAKAN kandungan halaman");
  });

  test("truncates long page text to MAX_PLAN_CONTEXT_CHARS", () => {
    const longText = "x".repeat(5000);
    const ctx = { title: "T", url: "https://e.com", text: longText };
    const prompt = JarvisCore.buildPlanPrompt("cari sesuatu", ctx, [], TOOLS);
    const idx = prompt.indexOf("Kandungan halaman");
    const after = prompt.slice(idx);
    expect(after.length).toBeLessThan(5000);
    expect(after).toContain("…(dipotong)");
  });

  test("does not throw when ctx is empty/undefined", () => {
    expect(() => JarvisCore.buildPlanPrompt("hello", {}, [], TOOLS)).not.toThrow();
    expect(() => JarvisCore.buildPlanPrompt("hello", null, [], TOOLS)).not.toThrow();
    const p = JarvisCore.buildPlanPrompt("hello", { title: "T" }, [], TOOLS);
    expect(p).toContain("Arahan pengguna: hello");
  });

  test("still includes conversation history", () => {
    const ctx = { title: "T", url: "u", text: "abc" };
    const history = [{ role: "user", text: "satu" }, { role: "jarvis", text: "dua" }];
    const prompt = JarvisCore.buildPlanPrompt("tiga", ctx, history, TOOLS);
    expect(prompt).toContain("satu");
    expect(prompt).toContain("dua");
  });
});

describe("JarvisCore.parseIntent pomodoro + settings", () => {
  test("'buka pomodoro dan set ke 10 minit' -> toggle_pomodoro minutes 10", () => {
    const i = JarvisCore.parseIntent("buka pomodoro dan set ke 10 minit");
    expect(i.type).toBe("toggle_pomodoro");
    expect(i.minutes).toBe(10);
  });

  test("'buka setting' -> open_settings (not pomodoro)", () => {
    const i = JarvisCore.parseIntent("buka setting");
    expect(i.type).toBe("open_settings");
  });

  test("'timer 15' -> pomodoro minutes 15", () => {
    const i = JarvisCore.parseIntent("timer 15");
    expect(i.type).toBe("pomodoro");
    expect(i.minutes).toBe(15);
  });

  test("'fokus 2 jam' -> pomodoro minutes 120", () => {
    const i = JarvisCore.parseIntent("fokus 2 jam");
    expect(i.type).toBe("pomodoro");
    expect(i.minutes).toBe(120);
  });

  test("'pomodoro' without number defaults to 25", () => {
    const i = JarvisCore.parseIntent("buka pomodoro");
    expect(i.type).toBe("toggle_pomodoro");
    expect(i.minutes).toBe(25);
  });

  test("help phrases -> help (BM + EN)", () => {
    ["apa yang kau boleh buat jarvis?", "apakah yang anda boleh buat?", "what can you do?", "bantuan", "help", "senarai arahan"].forEach((q) => {
      expect(JarvisCore.parseIntent(q).type).toBe("help");
    });
  });

  test("non-help commands are not classified as help", () => {
    ["cari ai", "buka github.com", "simpan halaman ini", "klik butang Langgan"].forEach((q) => {
      expect(JarvisCore.parseIntent(q).type).not.toBe("help");
    });
  });
});

describe("JarvisCore learning helpers (auto-learn)", () => {
  test("normalizeCommand lowercases, strips punctuation, collapses spaces", () => {
    expect(JarvisCore.normalizeCommand("  Buka  Github.com!!  ")).toBe("buka github com");
  });

  test("commandSimilarity is 1 for identical and lower for disjoint", () => {
    expect(JarvisCore.commandSimilarity("buka github", "buka github")).toBe(1);
    const s = JarvisCore.commandSimilarity("buka youtube laura", "buka github langgan");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(1);
  });

  test("matchLearnedCommand returns exact match", () => {
    const learned = [{ phrase: "buka yt laura", plan: [{ action: "search_youtube", query: "laura" }], hits: 1 }];
    const hit = JarvisCore.matchLearnedCommand("Buka YT Laura!", learned);
    expect(hit).not.toBeNull();
    expect(hit.plan[0].action).toBe("search_youtube");
  });

  test("matchLearnedCommand returns null when nothing is close enough", () => {
    const learned = [{ phrase: "buka github", plan: [{ action: "navigate", target: "github.com" }], hits: 1 }];
    expect(JarvisCore.matchLearnedCommand("ringkaskan halaman ini sekarang", learned)).toBeNull();
  });

  test("matchLearnedCommand requires >= 0.6 overlap for fuzzy matches", () => {
    const learned = [{ phrase: "buka carian youtube untuk laura podcast", plan: [{ action: "search_youtube", query: "laura podcast" }], hits: 1 }];
    // Same meaning, mostly overlapping tokens -> match.
    const hit = JarvisCore.matchLearnedCommand("buka carian youtube untuk laura podcast deddy", learned);
    expect(hit).not.toBeNull();
  });
});

describe("JarvisCore.parseMemoryCommand (export/import)", () => {
  test("detects export", () => {
    expect(JarvisCore.parseMemoryCommand("eksport ingatan")).toBe("export");
    expect(JarvisCore.parseMemoryCommand("export jarvis memory")).toBe("export");
  });
  test("detects import", () => {
    expect(JarvisCore.parseMemoryCommand("import ingatan")).toBe("import");
    expect(JarvisCore.parseMemoryCommand("muat naik memory")).toBe("import");
  });
  test("returns null for normal commands", () => {
    expect(JarvisCore.parseMemoryCommand("buka github.com")).toBeNull();
    expect(JarvisCore.parseMemoryCommand("ringkaskan halaman")).toBeNull();
  });
});

describe("JarvisCore.buildFollowupSuggestions (offline, feature #3)", () => {
  test("derives topic from the user's last question", () => {
    const ctx = { title: "Laman X", url: "https://x.com", text: "isi" };
    const history = [
      { role: "user", text: "Apakah itu pembelajaran mesin?" },
      { role: "jarvis", text: "Pembelajaran mesin ialah..." }
    ];
    const sugg = JarvisCore.buildFollowupSuggestions(ctx, history, "Pembelajaran mesin ialah satu kaedah.");
    expect(Array.isArray(sugg)).toBe(true);
    expect(sugg.length).toBe(3);
    // Question words stripped, topic "pembelajaran mesin" should appear.
    expect(sugg[0]).toContain("pembelajaran mesin");
    sugg.forEach((s) => expect(typeof s).toBe("string"));
  });

  test("falls back to page title when no user question", () => {
    const ctx = { title: "Berita Hari Ini - Sumber", url: "https://e.com", text: "x" };
    const sugg = JarvisCore.buildFollowupSuggestions(ctx, [], "Sesuatu tentang berita.");
    expect(sugg[0]).toContain("Berita Hari Ini");
  });

  test("returns empty-safe array and never throws on empty input", () => {
    expect(() => JarvisCore.buildFollowupSuggestions({}, [], "")).not.toThrow();
    // Empty answer + empty title -> falls back to a generic topic phrase.
    const sugg = JarvisCore.buildFollowupSuggestions({}, [], "");
    expect(Array.isArray(sugg)).toBe(true);
    expect(sugg.length).toBe(3);
    sugg.forEach((s) => expect(s).toContain("topik ini"));
    // Still returns 3 suggestions (with a derived word) for a short answer.
    const sugg2 = JarvisCore.buildFollowupSuggestions({}, [], "tiada apa");
    expect(sugg2.length).toBe(3);
  });
});
