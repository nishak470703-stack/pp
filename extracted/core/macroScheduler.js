/*
 * JARVIS Automation Studio — Macro Scheduler (#5.3)
 *
 * Penjadual berasaskan browser.alarms API. Berjalan di background:
 *   - Mendaftar alarm untuk setiap makro ber-trigger "time".
 *   - Pada alarm berbunyi, cari makro & jalankan via enjin dengan handler
 *     background (disediakan oleh background.js melalui registerBackground).
 *   - Menyediakan storeGet/storeSet untuk bacaan/tulisan senarai automasi.
 *
 * Gaya ES5. Dimuatkan di background scripts (dan boleh di sidebar untuk UI
 * menjadual/membatalkan).
 */
(function () {
  "use strict";

  var api = (typeof browser !== "undefined") ? browser
    : (typeof chrome !== "undefined" ? chrome : null);

  var STORE_KEY = "jarvisAutomations";
  var ALARM_PREFIX = "jarvis-macro-";

  var cfg = null; // { runMacro(macro), getContext(), resolveMacro(name) }

  function storeGet(cb) {
    if (!api || !api.storage) { cb([]); return; }
    try {
      api.storage.local.get(STORE_KEY, function (r) {
        cb((r && r[STORE_KEY]) || []);
      });
    } catch (e) { cb([]); }
  }

  function storeSet(arr, cb) {
    if (!api || !api.storage) { cb && cb(); return; }
    var o = {}; o[STORE_KEY] = arr;
    try { api.storage.local.set(o, function () { cb && cb(); }); } catch (e) { cb && cb(); }
  }

  function alarmName(id) { return ALARM_PREFIX + id; }

  // Kira masa larian harian seterusnya (timeStr "HH:MM", days [0..6]).
  function nextDailyTime(timeStr, days) {
    days = days && days.length ? days : [0, 1, 2, 3, 4, 5, 6];
    var parts = (timeStr || "08:00").split(":");
    var h = parseInt(parts[0], 10) || 0, m = parseInt(parts[1], 10) || 0;
    if (h < 0 || h > 23 || m < 0 || m > 59) { h = 8; m = 0; }
    var now = new Date();
    for (var d = 0; d < 14; d++) {
      var cand = new Date(now.getTime() + d * 86400000);
      cand.setHours(h, m, 0, 0);
      if (cand.getTime() <= now.getTime()) continue;
      if (days.indexOf(cand.getDay()) === -1) continue;
      return cand;
    }
    return new Date(now.getTime() + 86400000);
  }

  function scheduleMacro(macro) {
    if (!api || !api.alarms) return;
    if (!macro || !macro.enabled) return;
    var tr = macro.trigger || {};
    if (tr.type !== "time") return;
    var name = alarmName(macro.id);
    try { api.alarms.clear(name); } catch (e) {}
    if (tr.kind === "interval" && tr.minutes && tr.minutes > 0) {
      api.alarms.create(name, { periodInMinutes: Math.max(1, tr.minutes) });
      return;
    }
    var when = nextDailyTime(tr.time, tr.days);
    try {
      api.alarms.create(name, { when: when.getTime(), periodInMinutes: 1440 });
    } catch (e) {}
  }

  function unschedule(id) {
    if (!api || !api.alarms) return;
    try { api.alarms.clear(alarmName(id)); } catch (e) {}
  }

  // Jadual SEMUA makro time-trigger (dipanggil pada startup / install).
  function scheduleAll() {
    storeGet(function (arr) {
      (arr || []).forEach(function (m) { scheduleMacro(m); });
    });
  }

  function onAlarm(alarm) {
    if (!alarm || typeof alarm.name !== "string") return;
    if (alarm.name.indexOf(ALARM_PREFIX) !== 0) return;
    var id = alarm.name.slice(ALARM_PREFIX.length);
    storeGet(function (arr) {
      var list = arr || [];
      var macro = null;
      for (var i = 0; i < list.length; i++) { if (list[i].id === id) { macro = list[i]; break; } }
      if (!macro || !macro.enabled) return;
      var tr = macro.trigger || {};
      if (tr.type === "time" && tr.kind !== "interval" && Array.isArray(tr.days)) {
        var day = new Date().getDay();
        if (tr.days.indexOf(day) === -1) return;
      }
      if (cfg && typeof cfg.runMacro === "function") cfg.runMacro(macro);
    });
  }

  // Dipanggil dari background.js untuk menyuntik kebergantungan & mendaftar
  // pendengar alarm + jadual semula yang sedia ada.
  function registerBackground(config) {
    cfg = config || {};
    if (!api || !api.alarms || !api.alarms.onAlarm) return;
    try { api.alarms.onAlarm.addListener(onAlarm); } catch (e) {}
    scheduleAll();
  }

  window.LocalPocketMacroScheduler = {
    STORE_KEY: STORE_KEY,
    ALARM_PREFIX: ALARM_PREFIX,
    scheduleAll: scheduleAll,
    scheduleMacro: scheduleMacro,
    unschedule: unschedule,
    onAlarm: onAlarm,
    registerBackground: registerBackground,
    nextDailyTime: nextDailyTime,
    storeGet: storeGet,
    storeSet: storeSet,
    alarmName: alarmName
  };
})();
