const SUMMARY_AI_PROVIDER_CONFIGS = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    baseUrl: "https://chatgpt.com/",
    promptParam: "q",
  },
  claude: {
    id: "claude",
    label: "Claude",
    baseUrl: "https://claude.ai/new",
    promptParam: "q",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    baseUrl: "https://gemini.google.com/app",
    promptParam: "q",
  },
  perplexity: {
    id: "perplexity",
    label: "Perplexity",
    baseUrl: "https://www.perplexity.ai/",
    promptParam: "q",
  },
  copilot: {
    id: "copilot",
    label: "Copilot",
    baseUrl: "https://copilot.microsoft.com/",
    promptParam: "q",
  },
  grok: {
    id: "grok",
    label: "Grok",
    baseUrl: "https://grok.com/",
    promptParam: "q",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://chat.deepseek.com/",
    promptParam: "q",
  },
  poe: {
    id: "poe",
    label: "Poe",
    baseUrl: "https://poe.com/",
    promptParam: "q",
  },
  mistral: {
    id: "mistral",
    label: "Mistral",
    baseUrl: "https://chat.mistral.ai/chat",
    promptParam: "q",
  },
  google: {
    id: "google",
    label: "Google",
    baseUrl: "https://www.google.com/",
    promptParam: "q",
  },
  notebooklm: {
    id: "notebooklm",
    label: "NotebookLM",
    baseUrl: "https://notebooklm.google.com/",
    promptParam: "q",
  },
};

function normalizeSummaryAiProvider(value) {
  const key = value ? String(value).trim().toLowerCase() : "";
  return Object.prototype.hasOwnProperty.call(SUMMARY_AI_PROVIDER_CONFIGS, key)
    ? key
    : "chatgpt";
}

function getProviderUrl(provider) {
  const key = normalizeSummaryAiProvider(provider);
  const config = SUMMARY_AI_PROVIDER_CONFIGS[key];
  return config ? config.baseUrl : "https://chatgpt.com/";
}

function setPendingSidebarProviderOverride(providerId) {
  pendingSidebarProviderOverride = normalizeSummaryAiProvider(
    providerId || "chatgpt",
  );
  pendingSidebarProviderOverrideSetAt = Date.now();
}

function clearPendingSidebarProviderOverride() {
  pendingSidebarProviderOverride = "";
  pendingSidebarProviderOverrideSetAt = 0;
}

function getPendingSidebarProviderOverride() {
  if (!pendingSidebarProviderOverride) return "";
  const now = Date.now();
  if (
    !pendingSidebarProviderOverrideSetAt ||
    now - pendingSidebarProviderOverrideSetAt >
    PENDING_SIDEBAR_PROVIDER_OVERRIDE_TTL_MS
  ) {
    clearPendingSidebarProviderOverride();
    return "";
  }
  return normalizeSummaryAiProvider(pendingSidebarProviderOverride);
}

function getSummaryAiProviderConfig(providerId) {
  const key = normalizeSummaryAiProvider(providerId);
  return (
    SUMMARY_AI_PROVIDER_CONFIGS[key] || SUMMARY_AI_PROVIDER_CONFIGS.chatgpt
  );
}

function getSummaryAiProviderLabel(providerId) {
  const config = getSummaryAiProviderConfig(providerId);
  return config && config.label ? String(config.label) : "ChatGPT";
}

/**
 * inferSummaryProviderFromChatUrl – kenalpasti provider berdasarkan URL chat.
 * Digunakan untuk log summary history dan match session ke provider yang betul.
 * @param {string} url
 * @returns {string} provider id, atau "" jika tidak dikenali
 */
function inferSummaryProviderFromChatUrl(url) {
  if (!url) return "";
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch (e) {
    return "";
  }
  const domainMap = {
    "chatgpt.com": "chatgpt",
    "chat.openai.com": "chatgpt",
    "claude.ai": "claude",
    "gemini.google.com": "gemini",
    "perplexity.ai": "perplexity",
    "copilot.microsoft.com": "copilot",
    "grok.com": "grok",
    "chat.deepseek.com": "deepseek",
    "deepseek.com": "deepseek",
    "poe.com": "poe",
    "chat.mistral.ai": "mistral",
    "mistral.ai": "mistral",
    "google.com": "google",
    "notebooklm.google.com": "notebooklm",
  };
  // Cuba exact match dahulu
  if (domainMap[hostname]) return domainMap[hostname];
  // Cuba suffix match untuk subdomain (contoh: *.chatgpt.com)
  for (const [domain, provider] of Object.entries(domainMap)) {
    if (hostname === domain || hostname.endsWith("." + domain)) return provider;
  }
  return "";
}



async function getSummaryAiProvider() {
  try {
    const settings = await getSettings();
    return normalizeSummaryAiProvider(
      settings && settings.sidebarAiProvider
        ? settings.sidebarAiProvider
        : "chatgpt",
    );
  } catch (err) {
    return "chatgpt";
  }
}

async function getSummaryCustomPrompt() {
  try {
    const settings = await getSettings();
    return typeof settings.summaryCustomPrompt === "string" ? settings.summaryCustomPrompt : "";
  } catch (err) {
    return "";
  }
}

async function getSummaryOutputLanguage() {
  try {
    const settings = await getSettings();
    const lang = String(settings.summaryOutputLanguage || "").trim().toLowerCase();
    return lang || "ms";
  } catch (err) {
    return "ms";
  }
}

async function getSummaryTone() {
  try {
    // Cuba baca dari key berasingan "summaryTonePreference" dahulu (disimpan oleh sidebar butang tone)
    const prefData = await lpApi.storage.local.get("summaryTonePreference");
    if (prefData && prefData.summaryTonePreference) {
      const prefTone = String(prefData.summaryTonePreference).trim().toLowerCase();
      if (["neutral", "formal", "casual", "educational"].includes(prefTone)) return prefTone;
    }
    // Fallback ke settings.summaryTone (disimpan dari options page)
    const settings = await getSettings();
    const tone = String(settings.summaryTone || "").trim().toLowerCase();
    return ["neutral", "formal", "casual", "educational"].includes(tone) ? tone : "neutral";
  } catch (err) {
    return "neutral";
  }
}

async function getSummaryMaxWords() {
  try {
    const settings = await getSettings();
    const n = Number(settings.summaryMaxWords);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, 5000) : 0;
  } catch (err) {
    return 0;
  }
}

async function getSummaryYoutubeUrlOnlyForGemini() {
  try {
    const settings = await getSettings();
    return settings && settings.summaryYoutubeUrlOnlyForGemini === true;
  } catch (err) {
    return false;
  }
}

function buildSummaryAiPromptUrl(providerId, promptText, options = {}) {
  const config = getSummaryAiProviderConfig(providerId);
  const prompt = promptText ? String(promptText) : "";
  const includeSidebarFlag = !(options && options.includeSidebarFlag === false);
  try {
    const url = new URL(config.baseUrl);
    if (includeSidebarFlag) {
      url.searchParams.set("lp_sidebar", "1");
    }
    if (prompt) {
      const paramName = config.promptParam || "q";
      url.searchParams.set(paramName, prompt);
    }
    return url.toString();
  } catch (err) {
    let next = String(config.baseUrl || "https://chatgpt.com/");
    if (prompt) {
      const sep = next.includes("?") ? "&" : "?";
      const paramName = config.promptParam || "q";
      next +=
        sep + encodeURIComponent(paramName) + "=" + encodeURIComponent(prompt);
    }
    if (includeSidebarFlag) {
      const sep = next.includes("?") ? "&" : "?";
      next += sep + "lp_sidebar=1";
    }
    return next;
  }
}

function buildChatGptSubmitScript(prompt, sessionId) {
  const safePrompt = JSON.stringify(prompt || "");
  const safeSessionId = JSON.stringify(sessionId || "");
  return `(function () {
    const prompt = ${safePrompt};
    const sessionId = ${safeSessionId};
    if (!prompt) return;
    const maxAttempts = ${SUMMARY_BACKGROUND_SUBMIT_MAX_ATTEMPTS};
    const attemptIntervalMs = ${SUMMARY_BACKGROUND_SUBMIT_INTERVAL_MS};

    function setPromptValue(target, value) {
      if (!target) return false;
      const tag = target.tagName ? target.tagName.toLowerCase() : "";
      if (tag === "textarea" || typeof target.value === "string") {
        target.focus();
        try {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
          if (setter && typeof setter.set === "function") {
            setter.set.call(target, value);
          } else {
            target.value = value;
          }
        } catch (err) {
          target.value = value;
        }
        target.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
      if (target.isContentEditable) {
        target.focus();
        target.textContent = value;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
      return false;
    }

    function findPromptInput() {
      const selectors = [
        "#prompt-textarea",
        "textarea#prompt-textarea",
        "textarea[data-testid='prompt-textarea']",
        "textarea",
        "div#prompt-textarea[contenteditable='true']",
        "div[contenteditable='true'][role='textbox']"
      ];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) return el;
      }
      return null;
    }

    function clickSendButton() {
      const selectors = [
        "button[data-testid='send-button']",
        "button[data-testid='composer-send-button']",
        "button[data-testid*='send' i]",
        "button[aria-label='Send prompt']",
        "button[aria-label='Send message']",
        "button[aria-label*='send' i]"
      ];
      for (const selector of selectors) {
        const button = document.querySelector(selector);
        if (button && !button.disabled) {
          button.click();
          return true;
        }
      }
      return false;
    }

    function submitViaEnter(target) {
      if (!target) return false;
      const down = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      target.dispatchEvent(down);
      return true;
    }

    let submitSignalSent = false;
    function sendSubmittedSignal() {
      if (submitSignalSent || !sessionId) return;
      submitSignalSent = true;
      try {
        const extensionApi = typeof browser !== "undefined" ? browser : chrome;
        const maybe = extensionApi.runtime.sendMessage({
          type: "summary-session-submitted",
          payload: { sessionId, chatUrl: window.location.href }
        });
        if (maybe && typeof maybe.then === "function") maybe.catch(() => {});
      } catch (err) {
        // ignore
      }
    }

    let attempts = 0;
    let timer = null;
    let submitLock = false;
    function finalizeSubmit(sent) {
      if (submitLock) return;
      submitLock = true;
      if (sent) sendSubmittedSignal();
      if (timer) clearInterval(timer);
    }
    function runAttempt() {
      attempts += 1;
      const input = findPromptInput();
      if (!input) {
        if (attempts >= maxAttempts && timer) clearInterval(timer);
        return;
      }
      const filled = setPromptValue(input, prompt);
      if (!filled) {
        if (attempts >= maxAttempts && timer) clearInterval(timer);
        return;
      }
      setTimeout(function trySubmit() {
        if (submitLock) return;
        const sent = clickSendButton();
        if (sent) {
          setTimeout(function verifySubmit() {
            if (submitLock) return;
            try {
              var afterText = (input.isContentEditable ? input.textContent : input.value || "").replace(/\\s+/g, " ").trim();
              if (!afterText || afterText.length < 10) {
                finalizeSubmit(true);
                return;
              }
            } catch (e) {}
            submitLock = false;
          }, 150);
        }
      }, 200);
    }
    runAttempt();
    if (attempts < maxAttempts) {
      timer = setInterval(runAttempt, attemptIntervalMs);
    }

    // Stream messages to extension for sidebar
    try {
      if (!sessionId) return;
      const lpApi = typeof browser !== "undefined" ? browser : chrome;
      const root = document.querySelector('[data-testid="conversation-turns"]') || document.body;
      const seen = new WeakSet();
      const stopButtonSelectors = [
        "button[data-testid='stop-button']",
        "button[data-testid='composer-stop-button']",
        "button[data-testid*='stop' i]",
        "button[aria-label='Stop generating']",
        "button[aria-label*='stop' i]",
        "button[aria-label*='henti' i]",
        "button[aria-label*='berhenti' i]"
      ];
      const hasActiveStopButton = () => {
        return stopButtonSelectors.some((selector) => {
          const btn = document.querySelector(selector);
          return !!(btn && !btn.disabled);
        });
      };
      let sawAssistantMessage = false;
      let sawStopButton = false;
      let stopButtonLastSeenAt = 0;
      let completionSent = false;
      let assistantLastSeenAt = 0;
      let completionTimer = null;
      const sendCompletion = () => {
        if (completionSent || !sessionId) return;
        completionSent = true;
        if (completionTimer) {
          clearTimeout(completionTimer);
          completionTimer = null;
        }
        try {
          const maybe = lpApi.runtime.sendMessage({
            type: "summary-session-complete",
            payload: { sessionId, chatUrl: window.location.href }
          });
          if (maybe && typeof maybe.then === "function") maybe.catch(() => {});
        } catch (err) {}
      };
      const scheduleCompletionCheck = (delayMs) => {
        if (completionSent || (!sawAssistantMessage && !sawStopButton)) return;
        if (completionTimer) clearTimeout(completionTimer);
        completionTimer = setTimeout(() => {
          if (completionSent) return;
          const hasStop = hasActiveStopButton();
          if (hasStop) {
            sawStopButton = true;
            stopButtonLastSeenAt = Date.now();
            sendSubmittedSignal();
            scheduleCompletionCheck(1800);
            return;
          }
          if (sawStopButton && (Date.now() - stopButtonLastSeenAt) > 1400) {
            sendCompletion();
            return;
          }
          if (sawStopButton || (Date.now() - assistantLastSeenAt) > 2600) {
            sendCompletion();
          } else {
            scheduleCompletionCheck(1200);
          }
        }, Number.isFinite(delayMs) ? delayMs : 1600);
      };
      const roleFromNode = (el) => {
        const roleAttr = el.getAttribute("data-message-author-role");
        if (roleAttr) return roleAttr;
        const label = el.querySelector('[data-message-author-name]');
        if (label && label.textContent) {
          const name = label.textContent.toLowerCase();
          if (name.includes("assistant") || name.includes("chatgpt")) return "assistant";
          if (name.includes("you") || name.includes("user")) return "user";
        }
        return "assistant";
      };
      const extractText = (el) => {
        const target = el.querySelector('[data-message-author-role="assistant"], [data-message-author-role="user"]') || el;
        return (target.innerText || target.textContent || "").trim();
      };
      const nodeState = new Map();
      const sendNode = (node) => {
        if (!node) return;
        seen.add(node);
        const role = roleFromNode(node);
        const text = extractText(node);
        const html = (() => {
          const target = node.querySelector('[data-message-author-role="assistant"], [data-message-author-role="user"]') || node;
          return target.innerHTML || "";
        })();
        if (!text && !html) return;
        
        const stateKey = text + "|||" + html;
        if (nodeState.get(node) === stateKey) return;
        nodeState.set(node, stateKey);

        let turnId = node.dataset.lpSummaryTurnId;
        if (!turnId) {
          turnId = "turn-" + Math.random().toString(36).slice(2, 9);
          node.dataset.lpSummaryTurnId = turnId;
        }

        const payload = {
          type: "summary-sidebar-chat",
          payload: {
            sessionId,
            role,
            text,
            html,
            turnId,
            chatUrl: window.location.href
          }
        };
        try {
          const maybe = lpApi.runtime.sendMessage(payload);
          if (maybe && typeof maybe.then === "function") maybe.catch(() => {});
        } catch (err) {}
        if (role === "assistant") {
          sawAssistantMessage = true;
          assistantLastSeenAt = Date.now();
          scheduleCompletionCheck(1800);
        }
      };
      const obs = new MutationObserver((mutations) => {
        let touched = false;
        mutations.forEach((m) => {
          m.addedNodes && m.addedNodes.forEach((n) => {
            if (!(n instanceof Element)) return;
            if (n.matches('[data-testid="conversation-turn"]')) {
              sendNode(n);
              touched = true;
            } else if (n.querySelectorAll) {
              n.querySelectorAll('[data-testid="conversation-turn"]').forEach((node) => {
                sendNode(node);
                touched = true;
              });
            }
          });
          if (m.target && m.target instanceof Element) {
            const turn = m.target.closest('[data-testid="conversation-turn"]');
            if (turn) {
              sendNode(turn);
              touched = true;
            }
          } else if (m.target && m.target.parentNode && m.target.parentNode instanceof Element) {
            const turn = m.target.parentNode.closest('[data-testid="conversation-turn"]');
            if (turn) {
              sendNode(turn);
              touched = true;
            }
          }
        });
        if (hasActiveStopButton()) {
          sawStopButton = true;
          stopButtonLastSeenAt = Date.now();
          sendSubmittedSignal();
          return;
        }
        if (touched && sawAssistantMessage) {
          assistantLastSeenAt = Date.now();
          scheduleCompletionCheck(1200);
        }
      });
      obs.observe(root, { childList: true, subtree: true });
      const completionWatchTimer = setInterval(() => {
        if (completionSent) {
          clearInterval(completionWatchTimer);
          return;
        }
        const hasStop = hasActiveStopButton();
        if (hasStop) {
          sawStopButton = true;
          stopButtonLastSeenAt = Date.now();
          sendSubmittedSignal();
          return;
        }
        if (sawStopButton && (Date.now() - stopButtonLastSeenAt) > 1400) {
          clearInterval(completionWatchTimer);
          sendCompletion();
          return;
        }
        if (sawAssistantMessage) {
          if (sawStopButton || (Date.now() - assistantLastSeenAt) > 2600) {
            clearInterval(completionWatchTimer);
            sendCompletion();
          }
        }
      }, 900);
      setTimeout(() => {
        if (!completionSent) {
          clearInterval(completionWatchTimer);
          sendCompletion();
        }
      }, 180000);
    } catch (err) {
      // ignore observer errors
    }
  })();`;
}

async function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let done = false;
    let timer = null;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (lpApi.tabs && lpApi.tabs.onUpdated && onUpdated) {
        try {
          lpApi.tabs.onUpdated.removeListener(onUpdated);
        } catch (err) {
          // ignore
        }
      }
    };
    const finish = (value) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(value);
    };
    const onUpdated = (updatedTabId, changeInfo) => {
      if (
        updatedTabId === tabId &&
        changeInfo &&
        changeInfo.status === "complete"
      ) {
        finish(true);
      }
    };
    try {
      if (lpApi.tabs && lpApi.tabs.onUpdated) {
        lpApi.tabs.onUpdated.addListener(onUpdated);
      }
    } catch (err) {
      // ignore
    }
    timer = setTimeout(() => finish(false), timeoutMs);
    Promise.resolve(lpApi.tabs.get(tabId))
      .then((tab) => {
        if (tab && tab.status === "complete") {
          finish(true);
        }
      })
      .catch(() => {
        // wait by listener/timeout
      });
  });
}

function resetChatGptPopupRefs() {
  chatGptPopupWindowId = null;
  chatGptPopupTabId = null;
}

async function findOrCreateChatGptPopupTab(options = {}) {
  if (!lpApi.windows || !lpApi.windows.create) {
    return null;
  }

  const sideWidth = options && options.side ? 420 : 440;
  const availW =
    typeof screen !== "undefined" && screen && screen.availWidth
      ? screen.availWidth
      : 1440;
  const availH =
    typeof screen !== "undefined" && screen && screen.availHeight
      ? screen.availHeight
      : 900;
  const left =
    options && options.side ? Math.max(0, availW - sideWidth - 12) : null;
  const top = options && options.side ? 10 : null;

  if (chatGptPopupWindowId && chatGptPopupTabId && lpApi.tabs && lpApi.tabs.get) {
    try {
      const tab = await lpApi.tabs.get(chatGptPopupTabId);
      if (tab && tab.id) {
        if (lpApi.windows && lpApi.windows.update && tab.windowId) {
          const updateOptions = {
            focused: false,
            width: sideWidth,
            height: Math.max(720, Math.min(960, availH - 20)),
          };
          if (left !== null) updateOptions.left = left;
          if (top !== null) updateOptions.top = top;
          try {
            await lpApi.windows.update(tab.windowId, updateOptions);
          } catch (err) {
            debugWarn("ensureChatGptPopupTab window resize failed", err);
          }
        }
        try {
          await lpApi.tabs.update(tab.id, { active: false });
        } catch (err) {
          debugWarn("ensureChatGptPopupTab deactivate tab failed", err);
        }
        return tab.id;
      }
    } catch (err) {
      resetChatGptPopupRefs();
    }
  }

  try {
    const created = await lpApi.windows.create({
      url: "https://chatgpt.com/?lp_sidebar=1",
      type: "popup",
      focused: false,
      width: sideWidth,
      height: Math.max(720, Math.min(960, availH - 20)),
      left: left !== null ? left : undefined,
      top: top !== null ? top : undefined,
    });
    if (
      created &&
      created.id &&
      created.tabs &&
      created.tabs[0] &&
      created.tabs[0].id
    ) {
      chatGptPopupWindowId = created.id;
      chatGptPopupTabId = created.tabs[0].id;
      return chatGptPopupTabId;
    }
    if (
      created &&
      created.id &&
      (!created.tabs || !created.tabs.length) &&
      lpApi.tabs &&
      lpApi.tabs.query
    ) {
      const tabs = await lpApi.tabs.query({ windowId: created.id });
      if (tabs && tabs[0] && tabs[0].id) {
        chatGptPopupWindowId = created.id;
        chatGptPopupTabId = tabs[0].id;
        return chatGptPopupTabId;
      }
    }
  } catch (err) {
    resetChatGptPopupRefs();
    return null;
  }
  resetChatGptPopupRefs();
  return null;
}

async function findOrCreateHiddenChatGptTab() {
  if (!lpApi.tabs || !lpApi.tabs.create || !lpApi.tabs.query) return null;
  if (hiddenChatGptTabId) {
    try {
      const tab = await lpApi.tabs.get(hiddenChatGptTabId);
      if (tab && tab.id) return tab.id;
    } catch (err) {
      hiddenChatGptTabId = null;
    }
  }
  try {
    const existing = await lpApi.tabs.query({
      url: ["*://chatgpt.com/*", "*://chat.openai.com/*"],
      active: false,
    });
    if (existing && existing.length) {
      hiddenChatGptTabId = existing[0].id;
      return hiddenChatGptTabId;
    }
  } catch (err) {
    // ignore
  }
  try {
      const created = await lpApi.tabs.create({
        url: "https://chatgpt.com/?lp_sidebar=1",
        active: false,
      });
      hiddenChatGptTabId = created && created.id ? created.id : null;
      return hiddenChatGptTabId;
  } catch (err) {
    hiddenChatGptTabId = null;
    return null;
  }
}

async function submitPromptViaTempTab(promptText, sessionId) {
  if (!lpApi.tabs || !lpApi.tabs.create || !lpApi.tabs.remove) return false;
  let created = null;
  try {
    created = await lpApi.tabs.create({
      url: "https://chatgpt.com/?lp_sidebar=1",
      active: false,
    });
    tempChatGptTabId = created && created.id ? created.id : null;
  } catch (err) {
    tempChatGptTabId = null;
    return false;
  }
  const tabId = tempChatGptTabId;
  if (!tabId) return false;
  const code = buildChatGptSubmitScript(promptText, sessionId);
  try {
    await executeScriptWithRetries(tabId, { code });
  } catch (err) {
    // ignore injection failure
  }
  // Close the temp tab shortly after to keep UX clean
  setTimeout(() => {
    try {
      lpApi.tabs.remove(tabId);
    } catch (err) {
      // ignore close error
    }
    if (tempChatGptTabId === tabId) {
      tempChatGptTabId = null;
    }
  }, 1500);
  return true;
}

async function submitPromptViaTempWindow(promptText, sessionId) {
  if (
    !lpApi.windows ||
    !lpApi.windows.create ||
    !lpApi.tabs ||
    !lpApi.tabs.remove ||
    !lpApi.windows.remove
  ) {
    return false;
  }
  const availH =
    typeof screen !== "undefined" && screen && screen.availHeight
      ? screen.availHeight
      : 900;
  const availW =
    typeof screen !== "undefined" && screen && screen.availWidth
      ? screen.availWidth
      : 1440;
  const width = 420;
  const height = Math.max(720, Math.min(960, availH - 20));
  const left = Math.max(0, availW - width - 12);
  const top = 10;
  let tabId = null;
  let windowId = null;
  try {
    const created = await lpApi.windows.create({
      url: "https://chatgpt.com/",
      type: "popup",
      focused: false,
      width,
      height,
      left,
      top,
    });
    windowId = created && created.id ? created.id : null;
    tempChatGptWindowId = windowId;
    if (created && created.tabs && created.tabs[0]) {
      tabId = created.tabs[0].id;
      tempChatGptTabId = tabId;
    } else if (windowId && lpApi.tabs && lpApi.tabs.query) {
      const tabs = await lpApi.tabs.query({ windowId });
      if (tabs && tabs[0]) {
        tabId = tabs[0].id;
        tempChatGptTabId = tabId;
      }
    }
  } catch (err) {
    tempChatGptWindowId = null;
    tempChatGptTabId = null;
    return false;
  }
  if (!tabId) {
    try {
      if (windowId !== null) await lpApi.windows.remove(windowId);
    } catch (err) {
      // ignore
    }
    tempChatGptWindowId = null;
    tempChatGptTabId = null;
    return false;
  }
  const code = buildChatGptSubmitScript(promptText, sessionId);
  let injected = false;
  try {
    await executeScriptWithRetries(tabId, { code });
    injected = true;
  } catch (err) {
    injected = false;
  }
  if (!injected) {
    try {
      if (windowId !== null) await lpApi.windows.remove(windowId);
    } catch (err) {
      // ignore
    }
    tempChatGptWindowId = null;
    tempChatGptTabId = null;
    return false;
  }
  if (sessionId) {
    trackSummaryTempWindowSession(sessionId, windowId, tabId);
  } else {
    setTimeout(() => {
      try {
        if (tempChatGptWindowId) lpApi.windows.remove(tempChatGptWindowId);
      } catch (err) {
        debugWarn("submitPromptViaTempWindow delayed close failed", err);
      }
      tempChatGptWindowId = null;
      tempChatGptTabId = null;
    }, 2000);
  }
  return true;
}

async function submitPromptViaHiddenTab(promptText, sessionId) {
  const code = buildChatGptSubmitScript(promptText, sessionId);
  const trySubmitOnTab = async (tabId) => {
    if (!tabId) return false;
    try {
      await executeScriptWithRetries(tabId, { code });
      return true;
    } catch (err) {
      return false;
    }
  };

  const existingTabId = await findOrCreateHiddenChatGptTab();
  if (await trySubmitOnTab(existingTabId)) {
    return true;
  }

  if (existingTabId && hiddenChatGptTabId === existingTabId) {
    hiddenChatGptTabId = null;
  }

  let freshTabId = null;
  try {
    const created = await lpApi.tabs.create({
      url: "https://chatgpt.com/",
      active: false,
    });
    freshTabId = created && created.id ? created.id : null;
  } catch (err) {
    freshTabId = null;
  }
  if (!freshTabId) return false;
  hiddenChatGptTabId = freshTabId;
  return trySubmitOnTab(freshTabId);
}

async function findOrCreateChatGptSurface(options = {}) {
  const popupTabId = await findOrCreateChatGptPopupTab(options);
  if (popupTabId) return popupTabId;
  return findOrCreateChatGptTab();
}

async function findOrCreateAiProviderTab(provider, preferredUrl) {
  const config = SUMMARY_AI_PROVIDER_CONFIGS[provider];
  if (!config || !config.baseUrl) {
    const created = await lpApi.tabs.create({ url: preferredUrl, active: true });
    return created && created.id ? created.id : null;
  }
  try {
    const baseHost = new URL(config.baseUrl).hostname;
    const tabs = await lpApi.tabs.query({});
    for (const tab of tabs) {
      if (!tab || !tab.url || !tab.id) continue;
      try {
        const tabHost = new URL(tab.url).hostname;
        if (tabHost === baseHost || tabHost.endsWith("." + baseHost)) {
          if (preferredUrl && String(tab.url) !== String(preferredUrl)) {
            try {
              await lpApi.tabs.update(tab.id, { url: preferredUrl, active: false });
            } catch (err) {
              // keep existing tab if navigation fails
            }
          }
          return tab.id;
        }
      } catch (e) {}
    }
  } catch (e) {}
  const created = await lpApi.tabs.create({ url: preferredUrl, active: true });
  return created && created.id ? created.id : null;
}

async function prepareSummarySubmitSurface(providerId) {
  const provider = normalizeSummaryAiProvider(providerId || "chatgpt");
  const aiLabel = getSummaryAiProviderLabel(provider);

  if (IS_FIREFOX && lpApi.sidebarAction && lpApi.sidebarAction.open) {
    try {
      if (lpApi.sidebarAction.setPanel) {
        // Jika sidebar sudah terbuka dengan provider yang betul, SKIP setPanel
        // supaya sesi AI sedia ada tidak diganggu semasa prewarm
        const alreadyOnCorrectProvider = sidebarPanelOpen === true
          && sidebarCurrentMode === "ai"
          && (sidebarCurrentProvider === provider
            || (provider === "chatgpt" && (!sidebarCurrentProvider || sidebarCurrentProvider === "chatgpt")));

        if (!alreadyOnCorrectProvider) {
          let panelUrl = lpApi.runtime.getURL("sidebar.html");
          try {
            const panel = new URL(panelUrl);
            panel.searchParams.set("provider", provider);
            panel.searchParams.set("reload", Date.now().toString(36));
            panelUrl = panel.toString();
          } catch (err) { }
          await lpApi.sidebarAction.setPanel({ panel: panelUrl });
          sidebarCurrentMode = "ai";
        }
      }
    } catch (err) {
      // ignore prewarm failures; submission path will retry
    }
    return {
      ok: true,
      provider,
      aiLabel,
      sidebarOnly: true,
      readyPromise: Promise.resolve(true),
    };
  }

  const targetUrl = buildSummaryAiPromptUrl(provider, "", {
    includeSidebarFlag: true,
  });
  const existingTabId =
    provider === "chatgpt"
      ? await findOrCreateChatGptSurface({ side: true })
      : await findOrCreateAiProviderTab(provider, targetUrl);
  if (existingTabId) {
    return {
      ok: true,
      provider,
      aiLabel,
      tabId: existingTabId,
      readyPromise: waitForTabComplete(existingTabId, 6000),
    };
  }

  if (!lpApi.tabs || !lpApi.tabs.create) {
    return {
      ok: false,
      provider,
      aiLabel,
      reason: "ai-tab-unavailable",
    };
  }
  try {
    const created = await lpApi.tabs.create({ url: targetUrl, active: false });
    const tabId = created && created.id ? created.id : null;
    if (!tabId) {
      return {
        ok: false,
        provider,
        aiLabel,
        reason: "ai-tab-unavailable",
      };
    }
    return {
      ok: true,
      provider,
      aiLabel,
      tabId,
      readyPromise: waitForTabComplete(tabId, 6000),
    };
  } catch (err) {
    return {
      ok: false,
      provider,
      aiLabel,
      reason: "ai-tab-unavailable",
    };
  }
}

async function findOrCreateChatGptTab() {
  try {
    const existing = await lpApi.tabs.query({
      url: ["*://chatgpt.com/*", "*://chat.openai.com/*"],
    });
    if (existing && existing.length) {
      const candidate =
        existing.find((tab) => tab && tab.active) || existing[0];
      if (candidate && candidate.id) {
        return candidate.id;
      }
    }
  } catch (err) {
    // fall through to create tab
  }
  const created = await lpApi.tabs.create({
    url: "https://chatgpt.com/?lp_sidebar=1",
    active: true,
  });
  return created && created.id ? created.id : null;
}

async function openChatGptAndSubmitPrompt(prompt) {
  const sessionId =
    typeof prompt === "object" && prompt && prompt.sessionId
      ? String(prompt.sessionId)
      : "";
  const finalPrompt =
    typeof prompt === "string"
      ? prompt
      : prompt && prompt.text
        ? String(prompt.text)
        : "";
  const providerOverride =
    typeof prompt === "object" && prompt && prompt.provider
      ? normalizeSummaryAiProvider(prompt.provider)
      : "";
  const preparedSurface =
    typeof prompt === "object" && prompt && prompt.preparedSurface
      ? prompt.preparedSurface
      : null;
  const provider = providerOverride || (await getSummaryAiProvider());
  const aiLabel = getSummaryAiProviderLabel(provider);

  if (provider !== "chatgpt") {
    await setPendingSidebarPromptData({
      text: finalPrompt,
      sessionId,
      provider,
    });
    setPendingSidebarProviderOverride(provider);
    if (IS_FIREFOX && lpApi.sidebarAction && lpApi.sidebarAction.open) {
      // Firefox: use setPanel() to force the sidebar to (re)load with the
      // correct provider.  setPanel() does NOT require user gesture context.
      // The sidebar was already opened by the early sidebarAction.open()
      // in the command handler.  Changing the panel URL causes Firefox to
      // navigate the already-open sidebar to the new page.
      try {
        // Jika sidebar sudah terbuka dengan provider yang sama, skip setPanel
        // supaya sesi AI sedia ada tidak terganggu — hantar prompt terus
        const alreadyOnCorrectProvider = sidebarPanelOpen === true
          && sidebarCurrentMode === "ai"
          && sidebarCurrentProvider === provider;

        if (!alreadyOnCorrectProvider && lpApi.sidebarAction.setPanel) {
          let panelUrl = lpApi.runtime.getURL("sidebar.html");
          try {
            const panel = new URL(panelUrl);
            panel.searchParams.set("provider", provider);
            panel.searchParams.set("reload", Date.now().toString(36));
            panelUrl = panel.toString();
          } catch (err) { }
          await lpApi.sidebarAction.setPanel({ panel: panelUrl });
          sidebarCurrentMode = "ai";
        }
      } catch (err) {
        // ignore
      }
      requestFocusOnSidebarAiInputTabs(null).catch(() => {});
      requestPendingPromptCheckOnSidebarAiTabs(null, provider === "gemini" ? 16 : 8).catch(() => {});
      return {
        ok: true,
        sidebarOnly: true,
        provider,
        aiLabel,
      };
    }
    if (!lpApi.tabs || !lpApi.tabs.create) {
      return {
        ok: false,
        sidebarOnly: false,
        reason: "ai-tab-unavailable",
        provider,
        aiLabel,
      };
    }
    try {
      if (
        preparedSurface &&
        preparedSurface.ok &&
        preparedSurface.provider === provider &&
        (preparedSurface.sidebarOnly === true || !!preparedSurface.tabId)
      ) {
        requestPendingPromptCheckOnSidebarAiTabs(null, provider === "gemini" ? 16 : 8).catch(() => {});
        return {
          ok: true,
          provider,
          aiLabel,
          tabId: preparedSurface.tabId || null,
          sidebarOnly: preparedSurface.sidebarOnly === true,
        };
      }
      const targetUrl = buildSummaryAiPromptUrl(provider, "", {
        includeSidebarFlag: true,
      });
      const created = await lpApi.tabs.create({ url: targetUrl, active: false });
      requestPendingPromptCheckOnSidebarAiTabs(null, provider === "gemini" ? 16 : 8).catch(() => {});
      return {
        ok: true,
        provider,
        aiLabel,
        tabId: created && created.id ? created.id : null,
      };
    } catch (err) {
      return {
        ok: false,
        sidebarOnly: false,
        reason: "ai-tab-unavailable",
        provider,
        aiLabel,
      };
    }
  }

  // Firefox: guna popup ChatGPT untuk auto-paste, kemudian tutup selepas selesai.
  if (IS_FIREFOX && lpApi.sidebarAction && lpApi.sidebarAction.open) {
    // Store prompt in memory for the sidebar content script (contentScriptGpt.js) to pull
    await setPendingSidebarPromptData({
      text: finalPrompt,
      sessionId,
      provider: "chatgpt",
    });
    setPendingSidebarProviderOverride("chatgpt");
    // Jika sidebar sudah terbuka dengan ChatGPT, skip setPanel — hantar prompt terus
    const alreadyOnChatGpt = sidebarPanelOpen === true
      && sidebarCurrentMode === "ai"
      && (!sidebarCurrentProvider || sidebarCurrentProvider === "chatgpt");

    if (!alreadyOnChatGpt) {
      try {
        if (lpApi.sidebarAction.setPanel) {
          let panelUrl = lpApi.runtime.getURL("sidebar.html");
          try {
            const panel = new URL(panelUrl);
            panel.searchParams.set("provider", "chatgpt");
            panel.searchParams.set("reload", Date.now().toString(36));
            panelUrl = panel.toString();
          } catch (err) { }
          await lpApi.sidebarAction.setPanel({ panel: panelUrl });
          sidebarCurrentMode = "ai";
        }
      } catch (err) {
        // ignore
      }
    }
    requestPendingPromptCheckOnSidebarAiTabs(null, 8).catch(() => {});
    return {
      ok: true,
      popupOnly: true,
      provider: "chatgpt",
      aiLabel: "ChatGPT",
    };
  }

  // Chrome/Edge: fallback popup
  const tabId =
    preparedSurface &&
      preparedSurface.ok &&
      preparedSurface.provider === "chatgpt" &&
      preparedSurface.tabId
      ? preparedSurface.tabId
      : await findOrCreateChatGptSurface({ side: true });
  if (!tabId) {
    return {
      ok: false,
      sidebarOnly: false,
      reason: "chatgpt-tab-unavailable",
      provider: "chatgpt",
      aiLabel: "ChatGPT",
    };
  }
  if (
    preparedSurface &&
    preparedSurface.ok &&
    preparedSurface.provider === "chatgpt" &&
    preparedSurface.readyPromise
  ) {
    await waitForAsyncResultWithTimeout(preparedSurface.readyPromise, 1200, false);
  }
  const code = buildChatGptSubmitScript(finalPrompt, sessionId);
  try {
    await executeScriptWithRetries(tabId, { code });
    try {
      const tab = await lpApi.tabs.get(tabId);
      if (tab && tab.windowId && lpApi.windows && lpApi.windows.update) {
        lpApi.windows.update(tab.windowId, { focused: true }).catch(() => {});
      }
    } catch (_) {}
    return { ok: true, tabId, provider: "chatgpt", aiLabel: "ChatGPT" };
  } catch (err) {
    return {
      ok: false,
      sidebarOnly: false,
      reason: "chatgpt-submit-failed",
      provider: "chatgpt",
      aiLabel: "ChatGPT",
    };
  }
}

function getChatGptOpenFailureMessage(reason, options = {}) {
  const provider = normalizeSummaryAiProvider(
    options && options.provider ? options.provider : "chatgpt",
  );
  const aiLabel = getSummaryAiProviderLabel(provider);
  const sidebarShown = !!(options && options.sidebarShown);
  switch (String(reason || "")) {
    case "sidebar-open-failed":
      return "Sidebar Local Pocket Reader gagal dibuka automatik. Buka sidebar manual (Alt+Shift+O), kemudian cuba lagi.";
    case "chatgpt-submit-failed":
      if (sidebarShown)
        return (
          "Sidebar sudah dibuka, tetapi auto-isi prompt ke " +
          aiLabel +
          " gagal. Pastikan boleh diakses/login, kemudian cuba lagi."
        );
      return (
        "Auto-isi prompt ke " +
        aiLabel +
        " gagal. Pastikan boleh diakses/login, kemudian cuba lagi."
      );
    case "chatgpt-tab-unavailable":
    case "ai-tab-unavailable":
      return "Tab " + aiLabel + " tidak dapat diwujudkan secara automatik.";
    case "sidebar-open-and-submit-failed":
      return (
        "Sidebar gagal dibuka dan prompt juga gagal dihantar ke " +
        aiLabel +
        "."
      );
    default:
      return "Ralat automasi: " + aiLabel + " gagal dibuka (sebab: " + (reason || "tidak diketahui") + "). Cuba buka manual dan hantar semula.";
  }
}

function getSummaryAutofillFallbackCauseMessage(reason) {
  const key = String(reason || "")
    .trim()
    .toLowerCase();
  switch (key) {
    case "input-not-found":
      return "kotak input chat tidak dijumpai";
    case "input-not-usable":
      return "kotak input dijumpai tetapi tidak boleh digunakan";
    case "input-low-confidence":
      return "struktur halaman AI berubah (input dikesan dengan keyakinan rendah)";
    case "submit-path-not-found":
      return "butang/laluan hantar mesej tidak dijumpai";
    case "composer-not-ready":
      return "composer belum siap dimuat";
    case "set-prompt-failed":
      return "teks prompt gagal dipaste ke kotak input";
    case "prompt-verify-failed":
      return "semakan semula mendapati prompt tidak masuk dengan lengkap";
    case "submit-trigger-failed":
      return "trigger hantar mesej tidak berjaya";
    case "unknown":
    default:
      return "ralat automasi tidak diketahui";
  }
}

function buildSummaryAutofillFallbackNotificationMessage(options = {}) {
  const aiLabel = options.aiLabel ? String(options.aiLabel) : "AI";
  const copied = options.copied === true;
  const reason =
    options && Object.prototype.hasOwnProperty.call(options, "reason")
      ? options.reason
      : "";
  const adapterId =
    options && options.adapterId ? String(options.adapterId).trim() : "";
  const attempts = Number.isFinite(options && options.attempts)
    ? Number(options.attempts)
    : 0;
  const cause = getSummaryAutofillFallbackCauseMessage(reason);
  const base = copied
    ? "Prompt sudah disalin. Tampal ke " + aiLabel + " dan hantar manual."
    : "Auto-submit ke " + aiLabel + " gagal. Sila salin prompt dan hantar manual.";
  const detailParts = [];
  if (cause) detailParts.push("Punca: " + cause);
  if (adapterId) detailParts.push("Adapter: " + adapterId);
  if (attempts > 0) detailParts.push("Cubaan: " + attempts);
  return detailParts.length ? base + " " + detailParts.join(" | ") + "." : base;
}

async function openGeneralSummaryInChatGpt(message, sender) {
  const sessionId =
    "sess-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8);
  const rawUrl =
    message && message.url
      ? String(message.url)
      : sender && sender.tab && sender.tab.url
        ? String(sender.tab.url)
        : "";
  const title =
    message && message.title
      ? String(message.title)
      : sender && sender.tab && sender.tab.title
        ? String(sender.tab.title)
        : "";
  const preferredCategoryId =
    message && message.categoryId ? String(message.categoryId) : "";
  const requestedProvider =
    message && message.provider
      ? normalizeSummaryAiProvider(message.provider)
      : "";
  const hasRequestedMode = !!(
    message && Object.prototype.hasOwnProperty.call(message, "summaryMode")
  );
  let requestedMode = hasRequestedMode
    ? normalizeSummaryMode(
      message && message.summaryMode ? message.summaryMode : "",
    )
    : "";
  if (hasRequestedMode) {
    await setSummaryModePreference(requestedMode);
  } else {
    requestedMode = await getSummaryModePreference();
  }
  if (!isSummarizableUrl(rawUrl)) {
    return { ok: false, message: "Buka link web dahulu." };
  }
  // Parallelkan category context lookup dengan settings loading untuk kurangkan latency
  const [categoryContext, targetProvider, customPromptPromise, summaryOutputLanguagePromise, summaryTonePromise, summaryMaxWordsPromise] =
    await Promise.all([
      resolveYouTubeSummaryCategoryContext(rawUrl, preferredCategoryId),
      requestedProvider ? Promise.resolve(requestedProvider) : getSummaryAiProvider(),
      getSummaryCustomPrompt(),
      getSummaryOutputLanguage(),
      getSummaryTone(),
      getSummaryMaxWords(),
    ]);
  // Simpan metadata sumber untuk lookup oleh summary-session-submitted/complete
  storeSummarySessionSourceMeta(sessionId, {
    sourceUrl: rawUrl,
    title,
    provider: targetProvider || requestedProvider || ""
  });
  const preset = resolveCategorySummaryPreset(
    categoryContext.categoryName,
    requestedMode || "auto",
  );
  const preparedSurfacePromise = prepareSummarySubmitSurface(targetProvider);

  // Keep the prompt-building pipeline identical across providers; only the
  // autofill/submit layer is provider-specific.
  // Jalankan tab extraction & surface prep secara selari — jimat ~200-800ms
  const tabContentPromise = extractWebPageContentFromTab(sender, rawUrl).catch(() => ({ ok: false, reason: "tab-extract-exception" }));
  const tabContentResult = await tabContentPromise;
  const contentResult = tabContentResult && tabContentResult.ok
    ? tabContentResult
    : await waitForAsyncResultWithTimeout(
        fetchWebPageContent(rawUrl),
        SUMMARY_WEB_CONTENT_TIME_BUDGET_MS,
        { ok: false, reason: "content-time-budget-exceeded" },
      );

  const prompt = buildMalayWebSummaryPrompt({
    url: rawUrl,
    title,
    customPrompt: customPromptPromise,
    outputLanguage: summaryOutputLanguagePromise,
    tone: summaryTonePromise,
    maxWords: summaryMaxWordsPromise,
    categoryName:
      categoryContext && categoryContext.categoryName
        ? categoryContext.categoryName
        : "",
    summaryMode: preset.mode,
    presetLabel: preset.presetLabel,
    presetFocus: preset.presetFocus,
    source:
      contentResult && contentResult.ok && contentResult.source
        ? contentResult.source
        : "",
    pageTitle:
      contentResult && contentResult.ok && contentResult.title
        ? contentResult.title
        : "",
    pageDescription:
      contentResult && contentResult.ok && contentResult.description
        ? contentResult.description
        : "",
    pageText:
      contentResult && contentResult.ok && contentResult.text
        ? contentResult.text
        : "",
  });

  const submitResult = await openChatGptAndSubmitPrompt({
    text: prompt,
    sessionId,
    provider: targetProvider || undefined,
    preparedSurface: await preparedSurfacePromise,
  });
  const sidebarShownAfterSubmit = !!(submitResult && submitResult.sidebarOnly);
  if (
    submitResult &&
    submitResult.ok &&
    sessionId &&
    submitResult.provider === "chatgpt"
  ) {
    armSummaryAutoToggleSession(sessionId);
  }
  if (submitResult && submitResult.ok && submitResult.sidebarOnly) {
    return {
      ok: true,
      summaryType: "sidebar",
      sidebarOnly: true,
      aiProvider:
        submitResult && submitResult.provider
          ? submitResult.provider
          : "chatgpt",
      aiLabel:
        submitResult && submitResult.aiLabel ? submitResult.aiLabel : "ChatGPT",
    };
  }
  if (!submitResult || !submitResult.ok) {
    return {
      ok: false,
      message: getChatGptOpenFailureMessage(
        submitResult && submitResult.reason ? submitResult.reason : "",
        {
          sidebarShown: sidebarShownAfterSubmit,
          provider:
            submitResult && submitResult.provider
              ? submitResult.provider
              : "chatgpt",
        },
      ),
    };
  }
  return {
    ok: true,
    aiProvider:
      submitResult && submitResult.provider ? submitResult.provider : "chatgpt",
    aiLabel:
      submitResult && submitResult.aiLabel ? submitResult.aiLabel : "ChatGPT",
    sidebarOnly: submitResult.sidebarOnly === true,
    sessionId,
    sidebarShown: sidebarShownAfterSubmit,
    summaryType: "web",
    hasPageText: !!(contentResult && contentResult.ok && contentResult.text),
    contentSource:
      contentResult && contentResult.ok && contentResult.source
        ? contentResult.source
        : "",
    contentReason:
      contentResult && !contentResult.ok && contentResult.reason
        ? contentResult.reason
        : "",
  };
}

async function openYouTubeSummaryInChatGpt(message, sender) {
  const sessionId =
    "sess-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8);
  const rawUrl =
    message && message.url
      ? String(message.url)
      : sender && sender.tab && sender.tab.url
        ? String(sender.tab.url)
        : "";
  const title =
    message && message.title
      ? String(message.title)
      : sender && sender.tab && sender.tab.title
        ? String(sender.tab.title)
        : "";
  const preferredCategoryId =
    message && message.categoryId ? String(message.categoryId) : "";
  const requestedProvider =
    message && message.provider
      ? normalizeSummaryAiProvider(message.provider)
      : "";
  const hasRequestedMode = !!(
    message && Object.prototype.hasOwnProperty.call(message, "summaryMode")
  );
  let requestedMode = hasRequestedMode
    ? normalizeSummaryMode(
      message && message.summaryMode ? message.summaryMode : "",
    )
    : "";
  if (hasRequestedMode) {
    await setSummaryModePreference(requestedMode);
  } else {
    requestedMode = await getSummaryModePreference();
  }
  if (!isSummarizableUrl(rawUrl)) {
    return { ok: false, message: "Buka link web dahulu." };
  }
  const videoId = extractYouTubeVideoId(rawUrl);
  if (!videoId) {
    return openGeneralSummaryInChatGpt(message, sender);
  }
  // Parallelkan category context lookup dengan settings loading untuk kurangkan latency
  const [categoryContext, targetProvider, customPromptPromise, summaryOutputLanguagePromise, summaryTonePromise, summaryMaxWordsPromise] =
    await Promise.all([
      resolveYouTubeSummaryCategoryContext(rawUrl, preferredCategoryId),
      requestedProvider ? Promise.resolve(requestedProvider) : getSummaryAiProvider(),
      getSummaryCustomPrompt(),
      getSummaryOutputLanguage(),
      getSummaryTone(),
      getSummaryMaxWords(),
    ]);
  // Simpan metadata sumber untuk lookup oleh summary-session-submitted/complete
  storeSummarySessionSourceMeta(sessionId, {
    sourceUrl: rawUrl,
    title,
    provider: targetProvider || requestedProvider || ""
  });
  const preset = resolveCategorySummaryPreset(
    categoryContext.categoryName,
    requestedMode || "auto",
  );
  const preparedSurfacePromise = prepareSummarySubmitSurface(targetProvider);

  // Mod "URL sahaja" untuk Gemini: langkau extract transcript dan biar Gemini
  // ambil transkrip sendiri terus dari URL YouTube.
  const urlOnlyForGemini =
    targetProvider === "gemini" && (await getSummaryYoutubeUrlOnlyForGemini());

  let youtubeSummaryPrompt = "";
  let transcript = "";
  let timestampedTranscript = "";
  let transcriptResult = null;
  let summarySignals = {
    confidenceScore: 0,
    confidenceLabel: "Sederhana",
    coveragePercent: 0,
    timestampCoveragePercent: 0,
  };

  if (!urlOnlyForGemini) {
  const cachedTranscriptResult = getCachedYouTubeTranscript(videoId);

  // Keep the prompt-building pipeline identical across providers; only the
  // autofill/submit layer is provider-specific.
  transcriptResult = {
    ok: false,
    reason: "not-attempted",
    transcript: "",
    timestampedTranscript: "",


    totalSegments: 0,
    timestampedSegments: 0,
    source: "",
  };
  const senderTabId =
    sender && sender.tab && sender.tab.id ? sender.tab.id : null;
  const senderVideoId =
    sender && sender.tab && sender.tab.url
      ? extractYouTubeVideoId(sender.tab.url)
      : "";
  let watchTranscriptPromise = null;
  const transcriptStartedAt = Date.now();

  if (cachedTranscriptResult && cachedTranscriptResult.ok) {
    transcriptResult = cachedTranscriptResult;
  } else {
    const senderTranscriptPromise =
      senderTabId && senderVideoId && senderVideoId === videoId
        ? fetchYouTubeTranscriptFromTab(senderTabId, videoId, {
          allowDomFallback: false,
        })
        : Promise.resolve({ ok: false, reason: "sender-tab-unavailable" });
    watchTranscriptPromise = loadYouTubeTranscriptWithCache(
      videoId,
      () => fetchYouTubeTranscript(videoId),
    );
    transcriptResult = await waitForAsyncResultWithTimeout(
      resolveFirstSuccessfulAsyncResult(
        senderTabId && senderVideoId && senderVideoId === videoId
          ? [senderTranscriptPromise, watchTranscriptPromise]
          : [watchTranscriptPromise],
        "transcript-unavailable",
      ),
      SUMMARY_YOUTUBE_TRANSCRIPT_PRIMARY_BUDGET_MS,
      {
        ok: false,
        reason: "transcript-time-budget-exceeded",
        transcript: "",
        timestampedTranscript: "",
        totalSegments: 0,
        timestampedSegments: 0,
        source: "",
      },
    );
  }
  const transcriptElapsedMs = Date.now() - transcriptStartedAt;
  const remainingTranscriptBudgetMs =
    SUMMARY_YOUTUBE_TRANSCRIPT_TOTAL_BUDGET_MS - transcriptElapsedMs;
  if (
    SUMMARY_YOUTUBE_ENABLE_TEMP_TAB_TRANSCRIPT_FALLBACK &&
    !transcriptResult.ok &&
    remainingTranscriptBudgetMs > 600
  ) {
    transcriptResult =
      await waitForAsyncResultWithTimeout(
        fetchYouTubeTranscriptViaTemporaryTab(rawUrl, videoId),
        remainingTranscriptBudgetMs,
        transcriptResult,
      );
  }
  if (transcriptResult && transcriptResult.ok && transcriptResult.transcript) {
    transcriptResult = setCachedYouTubeTranscript(videoId, transcriptResult);
  }
  if (
    transcriptResult.ok &&
    (!transcriptResult.timestampedTranscript ||
      !transcriptResult.timestampedTranscript.trim())
  ) {
    const enriched = watchTranscriptPromise
      ? await waitForAsyncResultWithTimeout(
        watchTranscriptPromise,
        700,
        null,
      )
      : null;
    if (enriched && enriched.ok) {
      transcriptResult = {
        ...transcriptResult,
        languageCode:
          transcriptResult.languageCode || enriched.languageCode || "",
        autoGenerated:
          transcriptResult.autoGenerated === true ||
          enriched.autoGenerated === true,
        source: transcriptResult.source
          ? transcriptResult.source +
          "+" +
          (enriched.source || "caption-track-watch")
          : enriched.source || "caption-track-watch",
        timestampedTranscript: enriched.timestampedTranscript
          ? String(enriched.timestampedTranscript)
          : "",
        totalSegments: Number.isFinite(enriched.totalSegments)
          ? enriched.totalSegments
          : transcriptResult.totalSegments || 0,
        timestampedSegments: Number.isFinite(enriched.timestampedSegments)
          ? enriched.timestampedSegments
          : transcriptResult.timestampedSegments || 0,
        transcript:
          transcriptResult.transcript &&
            String(transcriptResult.transcript).trim()
            ? String(transcriptResult.transcript)
            : enriched.transcript
              ? String(enriched.transcript)
              : "",
      };
    }
  }

  transcript =
    transcriptResult && transcriptResult.ok && transcriptResult.transcript
      ? transcriptResult.transcript
      : "";
  timestampedTranscript =
    transcriptResult &&
      transcriptResult.ok &&
      transcriptResult.timestampedTranscript
      ? transcriptResult.timestampedTranscript
      : "";
  summarySignals = computeSummarySignals({
    transcript,
    timestampedTranscript,
    source:
      transcriptResult && transcriptResult.source
        ? transcriptResult.source
        : "",
    autoGenerated: transcriptResult && transcriptResult.autoGenerated === true,
    totalSegments:
      transcriptResult && Number.isFinite(transcriptResult.totalSegments)
        ? transcriptResult.totalSegments
        : 0,
    timestampedSegments:
      transcriptResult && Number.isFinite(transcriptResult.timestampedSegments)
        ? transcriptResult.timestampedSegments
        : 0,
  });
  youtubeSummaryPrompt = buildMalayYouTubeSummaryPrompt({
    url: rawUrl,
    title,
    transcript,
    timestampedTranscript,
    customPrompt: customPromptPromise,
    outputLanguage: summaryOutputLanguagePromise,
    tone: summaryTonePromise,
    maxWords: summaryMaxWordsPromise,
    languageCode:
      transcriptResult && transcriptResult.ok
        ? transcriptResult.languageCode
        : "",
    categoryName:
      categoryContext && categoryContext.categoryName
        ? categoryContext.categoryName
        : "",
    summaryMode: preset.mode,
    presetLabel: preset.presetLabel,
    presetFocus: preset.presetFocus,
    source:
      transcriptResult && transcriptResult.source
        ? transcriptResult.source
        : "",
    autoGenerated: transcriptResult && transcriptResult.autoGenerated === true,
    confidenceScore: summarySignals.confidenceScore,
    confidenceLabel: summarySignals.confidenceLabel,
    coveragePercent: summarySignals.coveragePercent,
    timestampCoveragePercent: summarySignals.timestampCoveragePercent,
  });
  } else {
    // URL sahaja: biar Gemini ambil transkrip sendiri, tiada transcript di-embed.
    transcriptResult = { ok: false, reason: "url-only-gemini" };
    youtubeSummaryPrompt = buildMalayYouTubeUrlOnlyPrompt({
      url: rawUrl,
      title,
      customPrompt: customPromptPromise,
      outputLanguage: summaryOutputLanguagePromise,
      tone: summaryTonePromise,
      maxWords: summaryMaxWordsPromise,
      categoryName:
        categoryContext && categoryContext.categoryName
          ? categoryContext.categoryName
          : "",
      summaryMode: preset.mode,
      presetLabel: preset.presetLabel,
      presetFocus: preset.presetFocus,
    });
  }

  const submitResult = await openChatGptAndSubmitPrompt({
    text: youtubeSummaryPrompt,
    sessionId,
    provider: targetProvider || undefined,
    preparedSurface: await preparedSurfacePromise,
  });
  const sidebarShownAfterSubmit = !!(submitResult && submitResult.sidebarOnly);
  if (
    submitResult &&
    submitResult.ok &&
    sessionId &&
    submitResult.provider === "chatgpt"
  ) {
    armSummaryAutoToggleSession(sessionId);
  }
  if (submitResult && submitResult.ok && submitResult.sidebarOnly) {
    return {
      ok: true,
      summaryType: "sidebar",
      sidebarOnly: true,
      aiProvider:
        submitResult && submitResult.provider
          ? submitResult.provider
          : "chatgpt",
      aiLabel:
        submitResult && submitResult.aiLabel ? submitResult.aiLabel : "ChatGPT",
    };
  }
  if (!submitResult || !submitResult.ok) {
    return {
      ok: false,
      message: getChatGptOpenFailureMessage(
        submitResult && submitResult.reason ? submitResult.reason : "",
        {
          sidebarShown: sidebarShownAfterSubmit,
          provider:
            submitResult && submitResult.provider
              ? submitResult.provider
              : "chatgpt",
        },
      ),
    };
  }
  return {
    ok: true,
    aiProvider:
      submitResult && submitResult.provider ? submitResult.provider : "chatgpt",
    aiLabel:
      submitResult && submitResult.aiLabel ? submitResult.aiLabel : "ChatGPT",
    sidebarOnly: submitResult.sidebarOnly === true,
    sessionId,
    sidebarShown: sidebarShownAfterSubmit,
    summaryType: "youtube",
    hasTranscript: !!transcript,
    hasTimestampedTranscript: !!timestampedTranscript,
    summaryMode: preset.mode,
    summaryPreset: preset.presetId,
    summaryConfidence: summarySignals.confidenceScore,
    summaryCoverage: summarySignals.coveragePercent,
    transcriptReason: transcript
      ? ""
      : transcriptResult && transcriptResult.reason
        ? String(transcriptResult.reason)
        : "no-transcript",
    fallback: submitResult.fallback === true,
  };
}

function siteNameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (err) {
    return "";
  }
}

function buildFallbackItemTitle(url) {
  const host = siteNameFromUrl(url);
  return host ? "Link from " + host : "Saved link";
}

async function refreshStoredItemTitle(rawUrl, options = {}) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized || !/^https?:/i.test(normalized)) {
    return { ok: false, reason: "invalid-url" };
  }
  const itemId = options && options.itemId ? String(options.itemId) : "";
  const forceRemote = !!(options && options.forceRemote);
  const key = normalizeUrlForCompare(normalized) || normalized;
  const existingPromise = inFlightTitleRefreshByUrl.get(key);
  if (existingPromise) {
    return existingPromise;
  }
  const refreshPromise = (async () => {
    const items = await getItems();
    let index = -1;
    if (itemId) {
      index = items.findIndex((item) => item && item.id === itemId);
    }
    if (index < 0) {
      index = items.findIndex((item) =>
        urlsMatchForSave(normalized, item && item.url ? item.url : ""),
      );
    }
    if (index < 0) {
      return { ok: false, reason: "not-found" };
    }
    const existing = items[index];
    const currentUrl =
      existing && existing.url ? String(existing.url) : normalized;
    const currentTitle =
      existing && existing.title ? normalizeExtractedTitle(existing.title) : "";
    if (
      currentTitle &&
      !looksLikeUrlText(currentTitle, currentUrl) &&
      !isGenericFallbackTitleText(currentTitle) &&
      !forceRemote
    ) {
      return { ok: true, title: currentTitle, updated: false };
    }
    const resolved = await resolveSavedItemTitle(currentUrl, currentTitle, {
      forceRemote: true,
    });
    const resolvedTitle = normalizeExtractedTitle(resolved);
    if (
      !resolvedTitle ||
      looksLikeUrlText(resolvedTitle, currentUrl) ||
      isGenericFallbackTitleText(resolvedTitle)
    ) {
      return { ok: false, reason: "unresolved" };
    }
    if (resolvedTitle === currentTitle) {
      return { ok: true, title: resolvedTitle, updated: false };
    }
    const updateResult = await updateStoredItemByIdentity(
      existing && existing.id ? String(existing.id) : itemId,
      currentUrl,
      (currentItem) => {
        const liveTitle =
          currentItem && currentItem.title
            ? normalizeExtractedTitle(currentItem.title)
            : "";
        if (liveTitle === resolvedTitle) {
          return currentItem;
        }
        return { ...currentItem, title: resolvedTitle };
      },
    );
    return {
      ok: updateResult && updateResult.ok === true,
      title: resolvedTitle,
      updated: !!(updateResult && updateResult.changed),
    };
  })();
  inFlightTitleRefreshByUrl.set(key, refreshPromise);
  try {
    return await refreshPromise;
  } finally {
    inFlightTitleRefreshByUrl.delete(key);
  }
}

// Export selected pure helpers for unit tests (Node/CommonJS only).
// In the extension runtime `module` is undefined, so this block is skipped.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SUMMARY_AI_PROVIDER_CONFIGS,
    normalizeSummaryAiProvider,
    getProviderUrl,
    getSummaryAiProviderConfig,
    getSummaryAiProviderLabel,
    inferSummaryProviderFromChatUrl,
  };
}