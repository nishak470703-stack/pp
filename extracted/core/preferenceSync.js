/**
 * Local Pocket Reader — JARVIS Preference Sync (#6.5 Sync via Supabase)
 *
 * Sync profil ingatan JARVIS merentas peranti menggunakan infrastruktur
 * Supabase sedia ada. Strategi: "last-write-wins" yang ringkas & mantap.
 * Disimpan dalam table `user_preferences` (user_id, key) — satu row untuk
 * profil JARVIS.
 *
 * SEMUA operasi di-guard: jika Supabase tidak dikonfigurasi / pengguna tidak
 * log masuk, fungsi kembalikan {ok:false} tanpa melemparkan error (no-op).
 * Attach ke `window.LocalPocketPreferenceSync`.
 */
(function (globalScope) {
  'use strict';

  var TABLE = 'user_preferences';
  var ROW_KEY = 'jarvis_prefs';

  function getAuthCore() {
    return globalScope && (globalScope.LocalPocketSupabaseAuthCore || globalScope.LocalPocketFirebaseAuthCore);
  }

  function getClient() {
    var auth = getAuthCore();
    if (auth && typeof auth.getSupabaseClient === 'function') {
      try { return auth.getSupabaseClient(); } catch (e) { return null; }
    }
    return null;
  }

  function currentUserId() {
    var auth = getAuthCore();
    try {
      if (auth && typeof auth.getUserId === 'function') return auth.getUserId();
      if (auth && typeof auth.getSession === 'function') {
        var s = auth.getSession();
        if (s && s.user && s.user.id) return s.user.id;
        if (s && typeof s.then === 'function') { s.then(function (ss) { return (ss && ss.user && ss.user.id) || null; }); }
      }
    } catch (e) {}
    return null;
  }

  function isReady() {
    var client = getClient();
    if (!client) return false;
    var auth = getAuthCore();
    if (auth && typeof auth.isSignedIn === 'function') {
      try { return !!auth.isSignedIn(); } catch (e) { return false; }
    }
    return !!currentUserId();
  }

  function push(profile) {
    return new Promise(function (resolve) {
      if (!isReady()) { resolve({ ok: false, reason: 'unavailable' }); return; }
      var client = getClient();
      var uid = currentUserId();
      if (!uid) { resolve({ ok: false, reason: 'no-user' }); return; }
      var row = {
        user_id: uid,
        key: ROW_KEY,
        value: profile,
        updated_at: new Date().toISOString()
      };
      try {
        var p = client.from(TABLE).upsert(row, { onConflict: 'user_id,key' });
        if (p && typeof p.then === 'function') {
          p.then(function (res) {
            if (res && res.error) resolve({ ok: false, error: res.error.message });
            else resolve({ ok: true });
          }).catch(function (err) { resolve({ ok: false, error: String(err && err.message || err) }); });
        } else {
          resolve({ ok: true });
        }
      } catch (e) { resolve({ ok: false, error: String(e && e.message || e) }); }
    });
  }

  function pull() {
    return new Promise(function (resolve) {
      if (!isReady()) { resolve({ ok: false, reason: 'unavailable' }); return; }
      var client = getClient();
      var uid = currentUserId();
      if (!uid) { resolve({ ok: false, reason: 'no-user' }); return; }
      try {
        var q = client.from(TABLE).select('value').eq('user_id', uid).eq('key', ROW_KEY).limit(1);
        var p = q && typeof q.then === 'function' ? q : (q && q.single ? q.single() : null);
        if (!p || typeof p.then !== 'function') { resolve({ ok: false, reason: 'unsupported' }); return; }
        p.then(function (res) {
          if (res && res.error) { resolve({ ok: false, error: res.error.message }); return; }
          var data = res && res.data;
          // .single() returns data directly; .select() returns { data: [...] }
          var value = (data && data.value) ? data.value : (Array.isArray(data) && data[0] ? data[0].value : null);
          if (value) resolve({ ok: true, profile: value });
          else resolve({ ok: false, reason: 'empty' });
        }).catch(function (err) { resolve({ ok: false, error: String(err && err.message || err) }); });
      } catch (e) { resolve({ ok: false, error: String(e && e.message || e) }); }
    });
  }

  function clear() {
    return new Promise(function (resolve) {
      if (!isReady()) { resolve({ ok: false, reason: 'unavailable' }); return; }
      var client = getClient();
      var uid = currentUserId();
      if (!uid) { resolve({ ok: false, reason: 'no-user' }); return; }
      try {
        var p = client.from(TABLE).delete().eq('user_id', uid).eq('key', ROW_KEY);
        if (p && typeof p.then === 'function') p.then(function () { resolve({ ok: true }); }).catch(function () { resolve({ ok: false }); });
        else resolve({ ok: true });
      } catch (e) { resolve({ ok: false }); }
    });
  }

  var api_export = {
    TABLE: TABLE,
    ROW_KEY: ROW_KEY,
    isReady: isReady,
    push: push,
    pull: pull,
    clear: clear
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api_export;
  if (globalScope && typeof globalScope === 'object') globalScope.LocalPocketPreferenceSync = api_export;

})(typeof globalThis !== 'undefined' ? globalThis : this);
