// ── Background Pomodoro Timer Engine ──
const _POMO_DEFAULT_TIMES = {
  focus: 25, shortBreak: 5, longBreak: 15
};

let _pomoState = null;
const _POMO_ALARM_NAME = "pomodoro-timer";
let _pomoInterval = null;
const _pomoSubscribers = new Set();
let _pomoHistory = null;
let _pomoHistoryLoaded = false;

function _pomoDefaultState() {
  return {
    mode: "focus",
    timeLeft: _POMO_DEFAULT_TIMES.focus * 60,
    totalTime: _POMO_DEFAULT_TIMES.focus * 60,
    running: false,
    sessions: 0,
    totalFocusTime: 0,
    lastTickTime: null,
    currentTask: null,
    currentNotes: null,
    distractions: [],
    settings: {
      focusTime: _POMO_DEFAULT_TIMES.focus,
      shortBreakTime: _POMO_DEFAULT_TIMES.shortBreak,
      longBreakTime: _POMO_DEFAULT_TIMES.longBreak,
      autoStartTimer: false,
      autoStartBreaks: false,
      soundNotifications: true,
      notificationSound: "chime",
      soundVolume: 0.3,
      customSound: null,
      theme: "default",
      darkMode: true,
      dailyGoal: 0,
      showBgIndicator: true
    },
    minimized: false
  };
}

async function _pomoGetStorage() {
  try {
    const data = await lpApi.storage.local.get("pomodoroState");
    return data && data.pomodoroState ? data.pomodoroState : null;
  } catch (e) {
    return null;
  }
}

function _pomoSaveStorage() {
  if (!_pomoState) return;
  try {
    lpApi.storage.local.set({ pomodoroState: _pomoState }).catch(() => {});
  } catch (e) {}
}

async function _pomoSyncSettingsToStorage() {
  if (!_pomoState || !_pomoState.settings) return;
  try {
    await lpApi.storage.sync.set({ pomodoroSettings: _pomoState.settings });
  } catch (e) {}
}

async function _pomoLoadSyncedSettings() {
  try {
    const data = await lpApi.storage.sync.get("pomodoroSettings");
    if (data && data.pomodoroSettings && _pomoState) {
      for (var k in data.pomodoroSettings) {
        if (data.pomodoroSettings.hasOwnProperty(k)) {
          _pomoState.settings[k] = data.pomodoroSettings[k];
        }
      }
    }
  } catch (e) {}
}

async function _pomoEnsureHistory() {
  if (_pomoHistoryLoaded) return;
  try {
    const data = await lpApi.storage.local.get("pomodoroHistory");
    _pomoHistory = data && data.pomodoroHistory ? data.pomodoroHistory : [];
  } catch (e) {
    _pomoHistory = [];
  }
  _pomoHistoryLoaded = true;
}

function _pomoSaveHistory() {
  if (!_pomoHistory) return;
  try {
    lpApi.storage.local.set({ pomodoroHistory: _pomoHistory }).catch(() => {});
  } catch (e) {}
}

async function _pomoEnsureState() {
  if (_pomoState) return;
  const stored = await _pomoGetStorage();
  if (stored) {
    _pomoState = stored;
    if (!_pomoState.currentTask) _pomoState.currentTask = null;
    if (!_pomoState.currentNotes) _pomoState.currentNotes = null;
    if (!_pomoState.distractions) _pomoState.distractions = [];
    if (_pomoState.settings.soundVolume == null) _pomoState.settings.soundVolume = 0.3;
    if (!_pomoState.settings.customSound) _pomoState.settings.customSound = null;
    if (!_pomoState.settings.theme) _pomoState.settings.theme = "default";
    if (_pomoState.settings.darkMode == null) _pomoState.settings.darkMode = true;
    if (!_pomoState.settings.dailyGoal) _pomoState.settings.dailyGoal = 0;
    if (_pomoState.settings.showBgIndicator == null) _pomoState.settings.showBgIndicator = true;
    if (_pomoState.timeLeft <= 0) {
      var _mode = _pomoState.mode;
      switch (_mode) {
        case "focus": _pomoState.totalTime = (_pomoState.settings.focusTime || _POMO_DEFAULT_TIMES.focus) * 60; break;
        case "shortBreak": _pomoState.totalTime = (_pomoState.settings.shortBreakTime || _POMO_DEFAULT_TIMES.shortBreak) * 60; break;
        case "longBreak": _pomoState.totalTime = (_pomoState.settings.longBreakTime || _POMO_DEFAULT_TIMES.longBreak) * 60; break;
      }
      _pomoState.timeLeft = _pomoState.totalTime;
    }
    _pomoLoadSyncedSettings();
  } else {
    _pomoState = _pomoDefaultState();
    _pomoSyncSettingsToStorage();
  }
}

function _pomoStateForUI() {
  if (!_pomoState) return null;
  return {
    mode: _pomoState.mode,
    timeLeft: _pomoState.timeLeft,
    totalTime: _pomoState.totalTime,
    running: _pomoState.running,
    sessions: _pomoState.sessions,
    totalFocusTime: _pomoState.totalFocusTime,
    currentTask: _pomoState.currentTask,
    settings: {
      focusTime: _pomoState.settings.focusTime,
      shortBreakTime: _pomoState.settings.shortBreakTime,
      longBreakTime: _pomoState.settings.longBreakTime,
      autoStartTimer: _pomoState.settings.autoStartTimer,
      autoStartBreaks: _pomoState.settings.autoStartBreaks,
      soundNotifications: _pomoState.settings.soundNotifications,
      notificationSound: _pomoState.settings.notificationSound,
      soundVolume: _pomoState.settings.soundVolume,
      customSound: _pomoState.settings.customSound,
      theme: _pomoState.settings.theme,
      darkMode: _pomoState.settings.darkMode,
      dailyGoal: _pomoState.settings.dailyGoal,
      showBgIndicator: _pomoState.settings.showBgIndicator
    },
    minimized: _pomoState.minimized
  };
}

function _pomoBroadcast(extra) {
  var s = _pomoStateForUI();
  if (!s) return;
  var msg = { type: "pomodoro-state", state: s };
  if (extra) { for (var k in extra) { if (extra.hasOwnProperty(k)) msg[k] = extra[k]; } }
  var dead = [];
  _pomoSubscribers.forEach(function(tabId) {
    try {
      lpApi.tabs.sendMessage(tabId, msg).catch(function() { dead.push(tabId); });
    } catch (e) { dead.push(tabId); }
  });
  dead.forEach(function(id) { _pomoSubscribers.delete(id); });
}

function _pomoTick() {
  if (!_pomoState || !_pomoState.running) return;

  var now = Date.now();
  var lastTick = _pomoState.lastTickTime || now;
  var elapsedMs = now - lastTick;
  var elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds < 1) elapsedSeconds = 1;

  // Prevent negative timeLeft and cap focus time inflation on catch-up
  var decrement = Math.min(elapsedSeconds, Math.max(0, _pomoState.timeLeft));

  _pomoState.timeLeft -= decrement;
  // Cap focus time to 60s per tick to prevent inflation after sleep/idle
  if (_pomoState.mode === "focus" && decrement > 0) {
    _pomoState.totalFocusTime += Math.min(decrement, 60);
  }

  _pomoState.lastTickTime = now;
  _pomoSaveStorage();

  if (_pomoState.timeLeft <= 0) {
    _pomoComplete();
  } else {
    _pomoBroadcast();
  }
}

function _pomoStart() {
  if (!_pomoState) return;
  _pomoState.running = true;
  _pomoState.lastTickTime = Date.now();
  _pomoSaveStorage();
  if (_pomoInterval) clearInterval(_pomoInterval);
  _pomoInterval = setInterval(_pomoTick, 1000);
  lpApi.alarms.create(_POMO_ALARM_NAME, { delayInMinutes: 1, periodInMinutes: 1 });
  _pomoBroadcast();
}

function _pomoPause() {
  if (!_pomoState) return;
  _pomoState.running = false;
  if (_pomoInterval) { clearInterval(_pomoInterval); _pomoInterval = null; }
  lpApi.alarms.clear(_POMO_ALARM_NAME);
  _pomoSaveStorage();
  _pomoBroadcast();
}

function _pomoReset() {
  if (!_pomoState) return;
  _pomoPause();
  _pomoState.timeLeft = _pomoState.totalTime;
  _pomoSaveStorage();
  _pomoBroadcast();
}

function _pomoSwitchMode(mode) {
  _pomoPause();
  if (!_pomoState) return;
  _pomoState.mode = mode;
  switch (mode) {
    case "focus": _pomoState.totalTime = (_pomoState.settings.focusTime || _POMO_DEFAULT_TIMES.focus) * 60; break;
    case "shortBreak": _pomoState.totalTime = (_pomoState.settings.shortBreakTime || _POMO_DEFAULT_TIMES.shortBreak) * 60; break;
    case "longBreak": _pomoState.totalTime = (_pomoState.settings.longBreakTime || _POMO_DEFAULT_TIMES.longBreak) * 60; break;
  }
  _pomoState.timeLeft = _pomoState.totalTime;
  _pomoSaveStorage();
  _pomoBroadcast();
}

function _pomoRecordHistoryEntry(mode, duration, completed) {
  if (!_pomoHistory) return;
  var entry = {
    id: Date.now(),
    date: new Date().toISOString(),
    mode: mode,
    duration: duration,
    task: _pomoState ? _pomoState.currentTask || null : null,
    notes: _pomoState ? _pomoState.currentNotes || null : null,
    distractions: _pomoState ? (_pomoState.distractions || []).slice() : [],
    completed: !!completed
  };
  _pomoHistory.unshift(entry);
  if (_pomoHistory.length > 500) _pomoHistory.length = 500;
  _pomoSaveHistory();
}

function _pomoSkip() {
  if (!_pomoState) return;
  if (_pomoState.mode === "focus") {
    _pomoRecordHistoryEntry("focus", _pomoState.totalTime - _pomoState.timeLeft, false);
    _pomoState.sessions++;
    var nextMode = _pomoState.sessions % 4 === 0 ? "longBreak" : "shortBreak";
    _pomoSwitchMode(nextMode);
    if (_pomoState.settings.autoStartBreaks) setTimeout(_pomoStart, 1000);
  } else {
    _pomoSwitchMode("focus");
    if (_pomoState.settings.autoStartTimer) setTimeout(_pomoStart, 1000);
  }
  _pomoState.currentNotes = null;
  _pomoState.distractions = [];
}

function _pomoComplete() {
  _pomoPause();
  if (!_pomoState) return;
  _pomoState.timeLeft = 0;
  if (_pomoState.mode === "focus") {
    _pomoState.sessions++;
    _pomoRecordHistoryEntry("focus", _pomoState.totalTime, true);
    _pomoSaveStorage();
    _pomoBroadcast({ completed: "focus" });
    try {
      lpApi.notifications.create({
        type: "basic", iconUrl: lpApi.runtime.getURL("icons/icon48.png"),
        title: "Pomodoro Complete!", message: "Great job! Time for a well-deserved break."
      });
    } catch (e) {}
    if (_pomoState.settings.autoStartBreaks) {
      var nextMode = _pomoState.sessions % 4 === 0 ? "longBreak" : "shortBreak";
      _pomoSwitchMode(nextMode);
      setTimeout(_pomoStart, 1000);
    }
  } else {
    _pomoRecordHistoryEntry(_pomoState.mode, _pomoState.totalTime, true);
    _pomoSaveStorage();
    _pomoBroadcast({ completed: "break" });
    try {
      lpApi.notifications.create({
        type: "basic", iconUrl: lpApi.runtime.getURL("icons/icon48.png"),
        title: "Break Complete!", message: "Ready to get back to work?"
      });
    } catch (e) {}
    if (_pomoState.settings.autoStartTimer) {
      _pomoSwitchMode("focus");
      setTimeout(_pomoStart, 1000);
    }
  }
  _pomoState.currentNotes = null;
  _pomoState.distractions = [];
  _pomoState.currentTask = null;
}

function _pomoUpdateSettings(settings) {
  if (!_pomoState || !settings) return;
  var shouldSync = false;
  for (var k in settings) {
    if (settings.hasOwnProperty(k)) {
      _pomoState.settings[k] = settings[k];
      if (k !== "minimized") shouldSync = true;
    }
  }
  _pomoSaveStorage();
  if (shouldSync) _pomoSyncSettingsToStorage();
}

function _pomoHandleMessage(message, sender, sendResponse) {
  if (message.type === "pomodoro-subscribe") {
    _pomoEnsureState().then(function() {
      if (sender.tab && sender.tab.id) _pomoSubscribers.add(sender.tab.id);
      if (sendResponse) sendResponse({ state: _pomoStateForUI() });
    });
    return true;
  }
  if (message.type === "pomodoro-unsubscribe") {
    if (sender.tab && sender.tab.id) _pomoSubscribers.delete(sender.tab.id);
    if (sendResponse) sendResponse({ ok: true });
    return true;
  }
  if (message.type === "pomodoro-get-history") {
    _pomoEnsureHistory().then(function() {
      if (sendResponse) sendResponse({ history: _pomoHistory || [] });
    });
    return true;
  }
  if (message.type === "pomodoro-update-task") {
    _pomoEnsureState().then(function() {
      if (_pomoState) _pomoState.currentTask = message.task || null;
      _pomoSaveStorage();
      if (sendResponse) sendResponse({ ok: true });
    });
    return true;
  }
  if (message.type === "pomodoro-update-notes") {
    _pomoEnsureState().then(function() {
      if (_pomoState) _pomoState.currentNotes = message.notes || null;
      if (sendResponse) sendResponse({ ok: true });
    });
    return true;
  }
  if (message.type === "pomodoro-add-distraction") {
    _pomoEnsureState().then(function() {
      if (_pomoState) {
        if (!_pomoState.distractions) _pomoState.distractions = [];
        _pomoState.distractions.push({ timestamp: Date.now(), note: message.note || "" });
      }
      if (sendResponse) sendResponse({ ok: true });
    });
    return true;
  }
  _pomoEnsureState().then(function() {
    var resp = null;
    switch (message.type) {
      case "pomodoro-start": _pomoStart(); resp = { state: _pomoStateForUI() }; break;
      case "pomodoro-pause": _pomoPause(); resp = { state: _pomoStateForUI() }; break;
      case "pomodoro-reset": _pomoReset(); resp = { state: _pomoStateForUI() }; break;
      case "pomodoro-skip": _pomoSkip(); resp = { state: _pomoStateForUI() }; break;
      case "pomodoro-switch-mode": _pomoSwitchMode(message.mode); resp = { state: _pomoStateForUI() }; break;
      case "pomodoro-update-settings": _pomoUpdateSettings(message.settings); resp = { state: _pomoStateForUI() }; break;
    }
    if (resp && sendResponse) sendResponse(resp);
  });
  return true;
}

_pomoGetStorage().then(function(data) {
  if (data) {
    _pomoState = data;
    if (!_pomoState.currentTask) _pomoState.currentTask = null;
    if (!_pomoState.currentNotes) _pomoState.currentNotes = null;
    if (!_pomoState.distractions) _pomoState.distractions = [];
    if (_pomoState.settings.soundVolume == null) _pomoState.settings.soundVolume = 0.3;
    if (!_pomoState.settings.customSound) _pomoState.settings.customSound = null;
    if (!_pomoState.settings.theme) _pomoState.settings.theme = "default";
    if (_pomoState.settings.darkMode == null) _pomoState.settings.darkMode = true;
    if (!_pomoState.settings.dailyGoal) _pomoState.settings.dailyGoal = 0;
    if (_pomoState.settings.showBgIndicator == null) _pomoState.settings.showBgIndicator = true;
    if (_pomoState.timeLeft <= 0) {
      var mode = _pomoState.mode;
      switch (mode) {
        case "focus": _pomoState.totalTime = (_pomoState.settings.focusTime || _POMO_DEFAULT_TIMES.focus) * 60; break;
        case "shortBreak": _pomoState.totalTime = (_pomoState.settings.shortBreakTime || _POMO_DEFAULT_TIMES.shortBreak) * 60; break;
        case "longBreak": _pomoState.totalTime = (_pomoState.settings.longBreakTime || _POMO_DEFAULT_TIMES.longBreak) * 60; break;
      }
      _pomoState.timeLeft = _pomoState.totalTime;
    }
    if (_pomoState.running) {
      _pomoInterval = setInterval(_pomoTick, 1000);
    }
    _pomoLoadSyncedSettings();
    _pomoEnsureHistory();
  }
}).catch(function() {});

// Export selected pure helpers for unit tests (Node/CommonJS only).
// In the extension runtime `module` is undefined, so this block is skipped.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    _POMO_DEFAULT_TIMES,
    _pomoDefaultState,
  };
}