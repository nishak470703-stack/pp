/**
 * @jest-environment jsdom
 *
 * Tests for JARVIS DOM grounding (buildDomSnapshot / getInteractiveNodes) and
 * the ReAct self-correction prompt builder (buildReplanPrompt).
 */
const JarvisCore = require("../core/jarvisCore.js");

// jsdom does no layout, so getBoundingClientRect returns zeros and our
// visibility check would skip everything. Stub it to a non-zero box so visible
// elements are indexed. display:none elements still report zeros, so they stay
// correctly excluded.
beforeAll(() => {
  window.Element.prototype.getBoundingClientRect = function () {
    if (window.getComputedStyle(this).display === "none") {
      return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0 };
    }
    return { width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 10, x: 0, y: 0 };
  };
});

describe("buildDomSnapshot grounding", () => {
  test("indexes interactive elements in document order", () => {
    document.body.innerHTML =
      '<button id="a">One</button>' +
      '<a href="/x">Link</a>' +
      '<input placeholder="Email">';
    const snap = JarvisCore.buildDomSnapshot({ max: 50 });
    expect(snap.length).toBe(3);
    expect(snap[0].tag).toBe("button");
    expect(snap[0].text).toContain("One");
    expect(snap[1].tag).toBe("a");
    expect(snap[1].text).toContain("Link");
    expect(snap[2].input).toBe(true);
    expect(snap[2].placeholder).toContain("Email");
  });

  test("default-type <input> is indexed (not dropped)", () => {
    document.body.innerHTML = '<input name="q">';
    const snap = JarvisCore.buildDomSnapshot({ max: 50 });
    expect(snap.length).toBe(1);
    expect(snap[0].tag).toBe("input");
  });

  test("getInteractiveNodes resolves the same index back to a live node", () => {
    document.body.innerHTML = '<button id="b1">First</button><button id="b2">Second</button>';
    const snap = JarvisCore.buildDomSnapshot({ max: 50 });
    const nodes = JarvisCore.getInteractiveNodes({ max: 50 });
    expect(snap.length).toBe(2);
    expect(nodes[1].id).toBe("b2");
  });

  test("skips the JARVIS panel and hidden elements", () => {
    document.body.innerHTML =
      '<div id="lp-jarvis-root"><button>JarvisBtn</button></div>' +
      '<button style="display:none">Hidden</button>' +
      '<a href="/y">Visible</a>';
    const snap = JarvisCore.buildDomSnapshot({ max: 50 });
    expect(snap.length).toBe(1);
    expect(snap[0].text).toContain("Visible");
  });

  test("respects the max limit", () => {
    document.body.innerHTML = "";
    for (let i = 0; i < 10; i++) {
      const b = document.createElement("button");
      b.textContent = "B" + i;
      document.body.appendChild(b);
    }
    const snap = JarvisCore.buildDomSnapshot({ max: 4 });
    expect(snap.length).toBe(4);
  });
});

describe("buildReplanPrompt (ReAct self-correction)", () => {
  test("embeds the failed action, observation and a fresh snapshot", () => {
    const prompt = JarvisCore.buildReplanPrompt(
      { action: "click", target: "X" },
      { url: "https://e.com", title: "T", text: "some page text", elementCount: 2 },
      [{ i: 1, tag: "button", text: "OK", input: false }]
    );
    expect(prompt).toContain('"action":"click"');
    expect(prompt).toContain("https://e.com");
    expect(prompt).toContain("[1] <button>");
    expect(prompt).toContain("index");
    expect(prompt).toContain("GAGAL");
  });
});

describe("buildPlanPrompt grounding section", () => {
  test("includes the interactive-element snapshot when document has nodes", () => {
    document.body.innerHTML = '<button>Langgan</button><a href="/s">Share</a>';
    const ctx = { title: "T", url: "https://e.com", text: "kandungan" };
    const TOOLS = [
      { action: "click", params: ["target", "index"], desc: "Klik." }
    ];
    const prompt = JarvisCore.buildPlanPrompt("klik langgan", ctx, [], TOOLS);
    expect(prompt).toContain("SENARAI ELEMEN INTERAKTIF");
    expect(prompt).toContain("[1] <button>");
    expect(prompt).toContain("nombor dari snapshot");
  });
});
