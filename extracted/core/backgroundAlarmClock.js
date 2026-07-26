// ── Background Alarm Clock Engine ──
// Multiple daily alarms with per-alarm day-of-week selection and a distinct,
// louder alarm sound (separate from the Pomodoro notification chimes).
const _AC_STORAGE_KEY = "alarmClocks";
const _AC_ALARM_PREFIX = "alarm-clock-";

let _acAlarms = null;
let _acAudioContext = null;

// Distinct alarm sounds. Square-wave based so they cut through ambient noise,
// and noticeably louder than the Pomodoro chimes.
const _AC_SOUNDS = {
  klaxon: [
    { freq: 880, duration: 0.28 },
    { freq: 660, duration: 0.28 },
    { freq: 880, duration: 0.28 },
    { freq: 660, duration: 0.28 }
  ],
  beep: [
    { freq: 1040, duration: 0.16 },
    { freq: 0, duration: 0.1 },
    { freq: 1040, duration: 0.16 },
    { freq: 0, duration: 0.1 },
    { freq: 1040, duration: 0.16 }
  ],
  digital: [
    { freq: 1568, duration: 0.12 },
    { freq: 1318, duration: 0.12 },
    { freq: 2093, duration: 0.28 }
  ],
  chime: [
    { freq: 523.25, duration: 0.3 },
    { freq: 659.25, duration: 0.3 },
    { freq: 783.99, duration: 0.5 }
  ]
};

function _acDefaultSound() {
  return "klaxon";
}

async function _acLoad() {
  if (_acAlarms) return _acAlarms;
  try {
    const data = await lpStoreGet(_AC_STORAGE_KEY);
    _acAlarms = (data && Array.isArray(data[_AC_STORAGE_KEY])) ? data[_AC_STORAGE_KEY] : [];
  } catch (e) {
    _acAlarms = [];
  }
  return _acAlarms;
}

function _acSave() {
  if (!_acAlarms) return;
  try {
    lpApi.storage.local.set({ [_AC_STORAGE_KEY]: _acAlarms }).catch(() => {});
  } catch (e) {}
}

// An alarm with no `days` (or empty array) fires every day.
function _acIsDaily(alarm) {
  return !alarm.days || !Array.isArray(alarm.days) || alarm.days.length === 0;
}

// Returns the next epoch-ms when this alarm should fire, or null if none
// within the next 8 days (only possible with a restrictive day selection).
function _acNextFireTime(alarm, fromDate) {
  const now = Date.now();
  const base = fromDate ? new Date(fromDate) : new Date();

  if (_acIsDaily(alarm)) {
    const d = new Date(base);
    d.setSeconds(0, 0);
    d.setHours(alarm.hour, alarm.minute, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  const wanted = alarm.days.slice().sort((a, b) => a - b);
  for (let i = 0; i < 8; i++) {
    const d = new Date(base);
    d.setSeconds(0, 0);
    d.setDate(d.getDate() + i);
    d.setHours(alarm.hour, alarm.minute, 0, 0);
    if (d.getTime() > now && wanted.indexOf(d.getDay()) !== -1) {
      return d.getTime();
    }
  }
  return null;
}

function _acClearAlarm(id) {
  if (lpApi.alarms && lpApi.alarms.clear) {
    lpApi.alarms.clear(_AC_ALARM_PREFIX + id).catch(() => {});
  }
}

function _acScheduleOne(alarm) {
  if (!lpApi.alarms || !alarm || !alarm.enabled) return;
  const when = _acNextFireTime(alarm);
  if (!when) return;
  lpApi.alarms.create(_AC_ALARM_PREFIX + alarm.id, { when: when }).catch(() => {});
}

async function _acScheduleAll() {
  await _acLoad();
  if (!_acAlarms || !lpApi.alarms) return;
  _acAlarms.forEach((a) => _acClearAlarm(a.id));
  _acAlarms.forEach(_acScheduleOne);
}

function _acGetAudioContext() {
  if (_acAudioContext) return _acAudioContext;
  try {
    const Ctx = (typeof AudioContext !== "undefined")
      ? AudioContext
      : (typeof webkitAudioContext !== "undefined" ? webkitAudioContext : null);
    if (Ctx) _acAudioContext = new Ctx();
  } catch (e) {}
  return _acAudioContext;
}

// Plays the alarm pattern. Best-effort: background pages may be subject to
// autoplay policies, so the content-script overlay also plays on the focused
// tab (see pomodoroOverlay.js).
function _acPlaySound(sound, volume) {
  const pattern = _AC_SOUNDS[sound] || _AC_SOUNDS[_acDefaultSound()];
  const ctx = _acGetAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const start = ctx.currentTime;
    let t = start;
    const vol = Math.max(0.05, Math.min(1, volume == null ? 0.7 : volume));
    pattern.forEach((note) => {
      if (note.freq === 0) { t += note.duration; return; }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(note.freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + note.duration);
      osc.start(t);
      osc.stop(t + note.duration);
      t += note.duration;
    });
  } catch (e) {}
}

function _acBroadcast(message) {
  if (!lpApi.tabs || !lpApi.tabs.query) return;
  try {
    lpApi.tabs.query({}, (tabs) => {
      if (!Array.isArray(tabs)) return;
      tabs.forEach((tab) => {
        if (tab && tab.id) lpApi.tabs.sendMessage(tab.id, message).catch(() => {});
      });
    });
  } catch (e) {}
}

function _acFire(alarm) {
  const sound = alarm.sound || _acDefaultSound();
  const volume = alarm.volume == null ? 0.7 : alarm.volume;
  _acPlaySound(sound, volume);
  try {
    lpApi.notifications.create({
      type: "basic",
      iconUrl: lpApi.runtime.getURL("icons/icon48.png"),
      title: alarm.label ? ("⏰ " + alarm.label) : "Alarm",
      message: "Waktu alarm telah tiba."
    });
  } catch (e) {}
  _acBroadcast({
    type: "alarm-clock-fire",
    alarm: { id: alarm.id, label: alarm.label || "", sound: sound, volume: volume }
  });
  // Re-arm for the next occurrence.
  _acScheduleOne(alarm);
}

function _acFindIndex(id) {
  if (!_acAlarms) return -1;
  for (let i = 0; i < _acAlarms.length; i++) {
    if (_acAlarms[i].id === id) return i;
  }
  return -1;
}

async function _acHandleMessage(message, sender, sendResponse) {
  const type = message.type;
  if (type === "alarm-clock-get-all") {
    await _acLoad();
    if (sendResponse) sendResponse({ alarms: _acAlarms || [] });
    return true;
  }
  if (type === "alarm-clock-add") {
    await _acLoad();
    const a = message.alarm;
    if (a && typeof a.hour === "number" && typeof a.minute === "number") {
      a.id = "ac_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      a.enabled = a.enabled !== false;
      if (!a.sound) a.sound = _acDefaultSound();
      if (a.volume == null) a.volume = 0.7;
      if (typeof a.hour !== "number") a.hour = 7;
      if (typeof a.minute !== "number") a.minute = 0;
      _acAlarms.push(a);
      _acSave();
      _acScheduleOne(a);
    }
    if (sendResponse) sendResponse({ ok: true, alarms: _acAlarms });
    return true;
  }
  if (type === "alarm-clock-update") {
    await _acLoad();
    const a = message.alarm;
    if (a && a.id) {
      const idx = _acFindIndex(a.id);
      if (idx !== -1) {
        _acAlarms[idx] = Object.assign({}, _acAlarms[idx], a);
        _acSave();
        _acScheduleOne(_acAlarms[idx]);
      }
    }
    if (sendResponse) sendResponse({ ok: true, alarms: _acAlarms });
    return true;
  }
  if (type === "alarm-clock-delete") {
    await _acLoad();
    const id = message.id;
    if (id) {
      _acAlarms = _acAlarms.filter((x) => x.id !== id);
      _acSave();
      _acClearAlarm(id);
    }
    if (sendResponse) sendResponse({ ok: true, alarms: _acAlarms });
    return true;
  }
  if (type === "alarm-clock-toggle") {
    await _acLoad();
    const id = message.id;
    const idx = _acFindIndex(id);
    if (idx !== -1) {
      _acAlarms[idx].enabled = !_acAlarms[idx].enabled;
      _acSave();
      if (_acAlarms[idx].enabled) _acScheduleOne(_acAlarms[idx]);
      else _acClearAlarm(id);
    }
    if (sendResponse) sendResponse({ ok: true, alarms: _acAlarms });
    return true;
  }
  if (type === "alarm-clock-test") {
    const sound = message.sound || _acDefaultSound();
    const volume = message.volume == null ? 0.7 : message.volume;
    _acPlaySound(sound, volume);
    if (sendResponse) sendResponse({ ok: true });
    return true;
  }
  return false;
}

_acScheduleAll().catch(() => {});
