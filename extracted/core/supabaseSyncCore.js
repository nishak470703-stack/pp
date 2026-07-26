/**
 * Supabase Sync Core Module
 * Drop-in replacement for firestoreSyncCore.js + cloudSyncCore.js
 *
 * Architecture:
 *   - sync_data table: one row per (user_id, key) — incremental sync
 *   - backup_data table: chunked across rows (user_id, part) — full JSON backup
 *
 * Limits (Supabase free tier):
 *   - Unlimited reads & writes (no daily quota like Firestore)
 *   - 500MB database storage
 *   - 2GB bandwidth/month
 */

(function attachLocalPocketSupabaseSyncCore(globalScope) {
  'use strict';

  const STORAGE_KEYS = {
    SYNCED_TIMESTAMPS: 'synced_item_timestamps',
    LAST_SYNC_TIME:    'last_sync_time',
    SYNC_ENABLED:      'sync_enabled',
    PENDING_QUEUE:     'pending_sync_queue'
  };

  const SCHEMA_VERSION = 1;
  const MAX_DOCUMENT_BYTES = 900000; // 900KB safety cap per value

  // ── State ───────────────────────────────────────────────────────────────────
  let _supabase = null;
  let _initialized = false;
  let _currentDeviceId = null;
  let _debounceMap = new Map(); // docKey → { timer, settler }
  const DEBOUNCE_MS = 500;

  // Daily write budget (soft cap — Supabase has no hard daily limit but
  // keeps things sane for devices with many rapid changes)
  let _dailyWrites = 0;
  let _dailyResetAt = Date.now();
  const DAILY_WRITE_BUDGET = 50000; // very generous for Supabase free tier

  // Per-cycle write cap for syncAllData
  // Generous per-cycle cap. The real guard is the daily budget (DAILY_WRITE_BUDGET).
  // Large enough that a comprehensive sync (items + notes + all small types) completes
  // in a cycle or two; if items alone exceeds this, the remaining small types still
  // sync first (see SYNC_MAPPINGS ordering + per-cycle skip below).
  const MAX_WRITES_PER_CYCLE = 20000;

  const api_local = typeof browser !== 'undefined' ? browser : chrome;

  // ── Init ────────────────────────────────────────────────────────────────────

  function initializeSync(supabaseClientOrConfig) {
    if (_initialized) return true;
    try {
      // Accept either a pre-built client or a config object
      if (supabaseClientOrConfig && typeof supabaseClientOrConfig.from === 'function') {
        _supabase = supabaseClientOrConfig;
      } else {
        // Get from auth core
        const authCore = globalScope.LocalPocketSupabaseAuthCore || globalScope.LocalPocketFirebaseAuthCore;
        if (authCore && typeof authCore.getSupabaseClient === 'function') {
          _supabase = authCore.getSupabaseClient();
        }
      }
      if (!_supabase) {
        console.error('[SupabaseSync] No Supabase client available');
        return false;
      }
      _initialized = true;
      return true;
    } catch (err) {
      console.error('[SupabaseSync] init error:', err);
      return false;
    }
  }

  function _ensureClient() {
    if (_supabase) return true;
    const authCore = globalScope.LocalPocketSupabaseAuthCore || globalScope.LocalPocketFirebaseAuthCore;
    if (authCore && typeof authCore.getSupabaseClient === 'function') {
      _supabase = authCore.getSupabaseClient();
    }
    return !!_supabase;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function _createSettler() {
    let res, rej;
    const promise = new Promise((r, j) => { res = r; rej = j; });
    return { promise, resolve: res, reject: rej };
  }

  function _trackWrite(n) {
    const now = Date.now();
    if (now - _dailyResetAt >= 86400000) { _dailyWrites = 0; _dailyResetAt = now; }
    _dailyWrites += (n || 1);
  }

  function _budgetExceeded() {
    const now = Date.now();
    if (now - _dailyResetAt >= 86400000) { _dailyWrites = 0; _dailyResetAt = now; return false; }
    return _dailyWrites >= DAILY_WRITE_BUDGET;
  }

  function _serialize(value) {
    try {
      const str = JSON.stringify(value);
      let bytes;
      try { bytes = new Blob([str]).size; } catch { bytes = str.length; }
      return { value: JSON.parse(str), str, bytes };
    } catch { return null; }
  }

  function _safeJson(value) {
    const s = _serialize(value);
    return s ? s.value : null;
  }

  function _estimateBytes(v) {
    try { return new Blob([JSON.stringify(v)]).size; } catch { return Infinity; }
  }

  function _hashStr(str) {
    if (!str) return 0;
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
      hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
    }
    return hash === 0 ? 1 : hash;
  }

  async function _getUid() {
    const authCore = globalScope.LocalPocketSupabaseAuthCore || globalScope.LocalPocketFirebaseAuthCore;
    if (!authCore) return null;
    try {
      await authCore.waitForAuthReady();
    } catch {}
    const stored = await authCore.getStoredAuthData();
    const uid = stored[authCore.STORAGE_KEYS.USER_UID];
    return uid && uid !== 'undefined' ? uid : null;
  }

  async function _getDeviceId() {
    if (_currentDeviceId) return _currentDeviceId;
    const authCore = globalScope.LocalPocketSupabaseAuthCore || globalScope.LocalPocketFirebaseAuthCore;
    if (authCore && typeof authCore.getDeviceId === 'function') {
      _currentDeviceId = await authCore.getDeviceId();
    }
    return _currentDeviceId || 'unknown';
  }

  function _updateLastSyncTime() {
    api_local.storage.local.set({ [STORAGE_KEYS.LAST_SYNC_TIME]: Date.now() }, () => {});
  }

  // ── Core: upsert one key ─────────────────────────────────────────────────────

  async function _upsertKey(uid, dataType, docId, value) {
    // retryable=true → transient failure worth queueing for a later retry.
    // retryable=false → permanent failure (queueing would loop forever).
    if (!_ensureClient()) return { success: false, error: 'No client', retryable: true };
    if (!uid) return { success: false, error: 'No UID', retryable: false };
    if (_budgetExceeded()) return { success: false, error: 'daily_budget_exceeded', retryable: true };

    // A null/undefined value maps to SQL NULL, which the NOT-NULL `value` column
    // rejects. Treat it as "unset" and skip the write (the full backup blob already
    // carries the authoritative settings) instead of failing the whole sync cycle.
    if (value === null || typeof value === 'undefined') {
      return { success: true };
    }

    const serialized = _serialize(value);
    if (!serialized) return { success: false, error: 'Serialization failed', retryable: false };
    if (serialized.bytes > MAX_DOCUMENT_BYTES) return { success: false, error: 'Value too large', retryable: false };
    const safe = serialized.value;

    const key = `${dataType}:${docId}`;
    const payload = {
      user_id: uid,
      key,
      value: safe,
      updated_at: new Date().toISOString(),
      device_id: await _getDeviceId(),
      schema_version: SCHEMA_VERSION
    };

    try {
      const { error } = await _supabase
        .from('sync_data')
        .upsert(payload, { onConflict: 'user_id,key' });
      if (error) throw error;
      _trackWrite(1);
      _updateLastSyncTime();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message, retryable: true };
    }
  }

  // ── Pending queue enqueue ────────────────────────────────────────────────────
  // Persist a failed per-doc write so it can be retried later (on next sync
  // cycle, when the network comes back online, or at startup). Without this the
  // pending-queue / retryPendingSync machinery never receives any work.
  const MAX_PENDING_QUEUE = 200;

  async function _enqueuePending(dataType, documentId, data) {
    try {
      const queue = await new Promise(resolve =>
        api_local.storage.local.get([STORAGE_KEYS.PENDING_QUEUE], r =>
          resolve(r[STORAGE_KEYS.PENDING_QUEUE] || [])
        )
      );
      const key = `${dataType}:${documentId}`;
      // Drop any stale op for the same key so we keep only the latest payload.
      const filtered = (Array.isArray(queue) ? queue : []).filter(
        op => op && `${op.dataType}:${op.documentId}` !== key
      );
      filtered.push({
        dataType,
        documentId,
        data,
        retryCount: 0,
        timestamp: Date.now()
      });
      // Cap size to avoid unbounded storage growth.
      const capped = filtered.slice(-MAX_PENDING_QUEUE);
      await new Promise(resolve =>
        api_local.storage.local.set({ [STORAGE_KEYS.PENDING_QUEUE]: capped }, resolve)
      );
    } catch (_) { /* best-effort */ }
  }

  // ── syncData (per-doc debounced, replaces firestoreSyncCore.syncData) ────────

  async function syncData(dataType, data, documentId = null) {
    if (!_initialized && !_ensureClient()) {
      return { success: false, error: 'Not initialized' };
    }

    const uid = await _getUid();
    if (!uid) return { success: false, error: 'Not authenticated' };
    if (!_currentDeviceId) _currentDeviceId = await _getDeviceId();

    const resolvedDocId = documentId
      || (data && typeof data === 'object' && data.id ? String(data.id).replace(/\//g, '_') : null)
      || ('_' + dataType);
    const docKey = `${dataType}:${resolvedDocId}`;

    const existing = _debounceMap.get(docKey);
    if (existing) clearTimeout(existing.timer);

    const settler = (existing && existing.settler) || _createSettler();

    const timer = setTimeout(async () => {
      _debounceMap.delete(docKey);
      try {
        const result = await _upsertKey(uid, dataType, resolvedDocId, data);
        if (result && !result.success && result.retryable) {
          await _enqueuePending(dataType, resolvedDocId, data);
        }
        settler.resolve(result);
      } catch (err) {
        // Unexpected throw — treat as retryable and queue it.
        try { await _enqueuePending(dataType, resolvedDocId, data); } catch (_) {}
        settler.reject(err);
      }
    }, DEBOUNCE_MS);

    _debounceMap.set(docKey, { timer, settler });
    return settler.promise;
  }

  // ── syncAllData (batch upsert, replaces firestoreSyncCore.syncAllData) ────────

  async function syncAllData(progressCallback) {
    // Comprehensive list of every storage key that should be kept in sync.
    // `type` becomes the sync_data `key` prefix; `key` is the local storage key.
    // Order matters: small types first so they always sync even if a large array
    // (items/notes) later exhausts the per-cycle write cap. `items` is last (biggest).
    const SYNC_MAPPINGS = [
      { type: 'selectedCategory', key: 'selectedCategory' },
      { type: 'settings', key: 'settings' },
      { type: 'notesUi', key: 'sidebarNotesUi' },
      { type: 'promptTemplates', key: 'summaryPromptTemplates' },
      { type: 'promptHistory', key: 'summaryPromptHistory' },
      { type: 'categoryPickerLastLocation', key: 'categoryPickerLastLocation' },
      { type: 'summaryModePreference', key: 'summaryModePreference' },
      { type: 'summaryHistoryIndex', key: 'summaryHistoryIndex' },
      { type: 'summaryTonePreference', key: 'summaryTonePreference' },
      { type: 'attachments', key: 'sidebarNoteAttachments' },
      { type: 'notesTrash', key: 'sidebarNotesTrash' },
      { type: 'pomodoroState', key: 'pomodoroState' },
      { type: 'pomodoroHistory', key: 'pomodoroHistory' },
      { type: 'lpPickerWidth', key: 'lpPickerWidth' },
      { type: 'lpPickerHeight', key: 'lpPickerHeight' },
      { type: 'lpPickerOpacity', key: 'lpPickerOpacity' },
      { type: 'floatingSizeOverride', key: 'floatingSizeOverride' },
      { type: 'selectionPopupPosition', key: '__lpSelectionSearchPopupPosition' },
      { type: 'sidebarAiEnabled', key: 'sidebarAiEnabled' },
      { type: 'cloud_auto_sync', key: 'cloud_auto_sync' },
      { type: 'cloud_sync_notification', key: 'cloud_sync_notification' },
      { type: 'jarvisSessions', key: 'jarvisSessions' },
      { type: 'jarvisConversations', key: 'jarvisConversations' },
      { type: 'jarvisLearnedCommands', key: 'jarvisLearnedCommands' },
      { type: 'jarvisElementMemory', key: 'jarvisElementMemory' },
      { type: 'jarvisElementHintsCache', key: 'jarvisElementHintsCache' },
      { type: 'jarvisMacros', key: 'jarvisMacros' },
      { type: 'jarvisBottomHidden', key: 'jarvisBottomHidden' },
      { type: 'jarvisFontPrefs', key: 'jarvisFontPrefs' },
      { type: 'jarvisPromptTemplates', key: 'jarvisPromptTemplates' },
      { type: 'jarvisPrefs', key: 'jarvisPrefs' },
      { type: 'alarmClocks', key: 'alarmClocks' },
      { type: 'domainThumbnailPatterns', key: 'domainThumbnailPatternsV1' },
      { type: 'jarvisCariSuffix', key: 'lp_jarvis_cari_suffix' },
      { type: 'jarvisPanelLayout', key: 'jarvisPanelLayoutV1' },
      { type: 'logLevel', key: 'logLevel' },
      { type: 'categories', key: 'categories' },
      { type: 'todoLists', key: 'todoLists' },
      { type: 'todoItems', key: 'todoItems' },
      { type: 'trash', key: 'trashItems' },
      { type: 'noteFolders', key: 'sidebarNoteFolders' },
      { type: 'notes', key: 'sidebarNotes' },
      { type: 'items', key: 'items' }
    ];

    const results = {};

    const uid = await _getUid();
    if (!uid) {
      if (progressCallback) progressCallback({ error: 'Invalid user UID' });
      return { success: false, error: 'Invalid user UID', results };
    }
    if (!_ensureClient()) return { success: false, error: 'No client', results };
    if (_budgetExceeded()) {
      if (progressCallback) progressCallback({ status: 'complete', synced: 0, failed: 0, budgetExceeded: true });
      return { success: false, error: 'daily_budget_exceeded', results };
    }

    const syncedTimestamps = await new Promise(resolve => {
      api_local.storage.local.get([STORAGE_KEYS.SYNCED_TIMESTAMPS], r =>
        resolve(r[STORAGE_KEYS.SYNCED_TIMESTAMPS] || {})
      );
    });

    const counters = { synced: 0, failed: 0, skipped: 0, oversized: 0, writes: 0 };
    const oversizedKeys = [];
    let capReached = false;

    // Reusable chunked upsert for a batch of { docId, item, stampKey, itemTime }.
    async function _flushEntries(entries, type) {
      if (!entries.length) return;
      // Collapse duplicate keys within a type. Postgres aborts the whole
      // upsert statement ("cannot affect row a second time") if the same
      // ON CONFLICT target appears twice in one batch, failing every row.
      const _seen = new Map();
      for (const e of entries) _seen.set(e.stampKey, e);
      entries = [..._seen.values()];
      if (progressCallback) progressCallback({ dataType: type, status: 'start', total: entries.length, synced: counters.synced, failed: counters.failed });
      const CHUNK = 100;
      const deviceId = await _getDeviceId();
      const now = new Date().toISOString();
      for (let i = 0; i < entries.length; i += CHUNK) {
        if (counters.writes >= MAX_WRITES_PER_CYCLE) { console.warn('[SupabaseSync] Per-cycle cap reached, deferring remaining'); break; }
        if (_budgetExceeded()) break;
        const chunk = entries.slice(i, i + CHUNK);
        const rows = [];
        const rowMeta = [];
        for (const { docId, item, stampKey, itemTime } of chunk) {
          const serialized = _serialize(item);
          if (!serialized || serialized.bytes > MAX_DOCUMENT_BYTES) {
            counters.oversized++;
            oversizedKeys.push(`${type}:${docId}`);
            syncedTimestamps[stampKey] = itemTime;
            continue;
          }
          const safe = serialized.value;
          if (safe === null) {
            counters.skipped++;
            syncedTimestamps[stampKey] = itemTime;
            continue;
          }
          rows.push({
            user_id: uid,
            key: `${type}:${docId}`,
            value: safe,
            updated_at: now,
            device_id: deviceId,
            schema_version: SCHEMA_VERSION
          });
          rowMeta.push({ stampKey, itemTime });
        }
        if (rows.length === 0) continue;
        try {
          const { error } = await _supabase
            .from('sync_data')
            .upsert(rows, { onConflict: 'user_id,key' });
          if (error) {
            console.error('[SupabaseSync] Batch upsert error:', error.message);
            counters.failed += rows.length;
          } else {
            counters.synced += rows.length;
            counters.writes += rows.length;
            _trackWrite(rows.length);
            for (const m of rowMeta) syncedTimestamps[m.stampKey] = m.itemTime;
          }
        } catch (err) {
          console.error('[SupabaseSync] Batch error:', err.message);
          counters.failed += rows.length;
        }
        if (progressCallback) progressCallback({ dataType: type, status: 'progress', total: entries.length, synced: counters.synced, failed: counters.failed });
      }
      if (progressCallback) progressCallback({ dataType: type, status: 'done', total: entries.length, synced: counters.synced, failed: counters.failed });
    }

    // ── Static key → sync type mappings ──
    for (const { type, key } of SYNC_MAPPINGS) {
      if (counters.writes >= MAX_WRITES_PER_CYCLE) {
        if (!capReached) { console.warn('[SupabaseSync] Per-cycle cap reached, deferring remaining types this cycle'); capReached = true; }
        continue;
      }
      let storageData;
      try { storageData = await new Promise(resolve => api_local.storage.local.get([key], resolve)); }
      catch (_) { continue; }
      if (!storageData || storageData[key] === undefined) continue;
      const data = storageData[key];
      const entries = [];
      if (Array.isArray(data)) {
        let arr = data;
        // One-time cleanup: collapse duplicate ids (e.g. duplicate trash items)
        // so the stored array no longer triggers the upsert conflict.
        if (type === 'trash') {
          const _seen = new Map();
          const _deduped = [];
          for (const item of data) {
            if (!item) continue;
            const _id = item.id !== undefined ? String(item.id) : null;
            if (_id === null || _seen.has(_id)) continue;
            _seen.set(_id, true);
            _deduped.push(item);
          }
          if (_deduped.length !== data.length) {
            arr = _deduped;
            api_local.storage.local.set({ [key]: _deduped }, () => {});
          }
        }
        for (const item of arr) {
          if (!item) continue;
          const docId = (item.id !== undefined ? String(item.id) : ('_' + entries.length)).replace(/\//g, '_');
          const itemTime = item.savedAt || item.updatedAt || item.time_added || item.time_updated || _hashStr(JSON.stringify(item));
          entries.push({ docId, item, stampKey: `${type}:${docId}`, itemTime });
        }
      } else if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
          const docId = String(k).replace(/\//g, '_');
          const itemTime = (v && (v.savedAt || v.updatedAt || v.time_added || v.time_updated)) || _hashStr(JSON.stringify(v));
          entries.push({ docId, item: v, stampKey: `${type}:${docId}`, itemTime });
        }
      } else {
        // Scalar (string / number / boolean) — hash so we only re-sync on change.
        const docId = '_';
        const itemTime = _hashStr(JSON.stringify(data));
        entries.push({ docId, item: data, stampKey: `${type}:_`, itemTime });
      }
      const _failedBefore = counters.failed;
      await _flushEntries(entries, type);
      results[type] = { success: counters.failed === _failedBefore, count: entries.length };
    }

    // ── Dynamic summary_history_* keys ──
    try {
      let histKeys = [];
      if (api_local.storage.local.getKeys) {
        const gk = api_local.storage.local.getKeys();
        if (gk && typeof gk.then === 'function') histKeys = (await gk) || [];
        else histKeys = await new Promise(resolve => api_local.storage.local.getKeys(ks => resolve(ks || [])));
      } else {
        const all = await new Promise(resolve => api_local.storage.local.get(null, resolve));
        histKeys = Object.keys(all || {});
      }
      const prefixKeys = (histKeys || []).filter(k => k.indexOf('summary_history_') === 0);
      const histEntries = [];
      for (const k of prefixKeys) {
        if (counters.writes >= MAX_WRITES_PER_CYCLE) { console.warn('[SupabaseSync] Per-cycle cap reached, deferring remaining'); continue; }
        const val = await new Promise(resolve => api_local.storage.local.get([k], resolve));
        const v = val && val[k];
        if (v === undefined) continue;
        const docId = k.replace('summary_history_', '') || k;
        histEntries.push({ docId, item: v, stampKey: `summaryHistory:${docId}`, itemTime: _hashStr(JSON.stringify(v)) });
      }
      const _histFailedBefore = counters.failed;
      await _flushEntries(histEntries, 'summaryHistory');
      results['summaryHistory'] = { success: counters.failed === _histFailedBefore, count: histEntries.length };
    } catch (err) {
      console.error('[SupabaseSync] Sync summaryHistory error:', err);
      results['summaryHistory'] = { success: false, error: err.message };
    }

    // ── Keyboard shortcuts (from commands API, not a storage key) ──
    try {
      if (api_local.commands && api_local.commands.getAll) {
        const cmds = await new Promise(resolve => {
          const p = api_local.commands.getAll();
          if (p && typeof p.then === 'function') p.then(resolve).catch(() => resolve([]));
          else resolve([]);
        });
        if (Array.isArray(cmds) && cmds.length) {
          const docs = cmds.map(c => ({ name: c.name, shortcut: c.shortcut }));
          const itemTime = _hashStr(JSON.stringify(docs));
          const _scFailedBefore = counters.failed;
          await _flushEntries([{ docId: 'all-items', item: docs, stampKey: 'shortcuts:all-items', itemTime }], 'shortcuts');
          results['shortcuts'] = { success: counters.failed === _scFailedBefore, count: docs.length };
        }
      }
    } catch (err) {
      console.error('[SupabaseSync] Sync shortcuts error:', err);
      results['shortcuts'] = { success: false, error: err.message };
    }

    await new Promise(resolve => {
      api_local.storage.local.set({ [STORAGE_KEYS.SYNCED_TIMESTAMPS]: syncedTimestamps }, resolve);
    });

    _updateLastSyncTime();
    if (oversizedKeys.length) {
      console.warn('[SupabaseSync] Skipped oversized items (>' + MAX_DOCUMENT_BYTES + ' bytes):', oversizedKeys);
    }
    if (progressCallback) progressCallback({ status: 'complete', synced: counters.synced, failed: counters.failed, skipped: counters.skipped, oversized: counters.oversized });
    return {
      success: counters.failed === 0,
      results,
      totalSynced: counters.synced,
      totalFailed: counters.failed,
      totalSkipped: counters.skipped,
      totalOversized: counters.oversized,
      oversizedKeys: oversizedKeys
    };
  }

  async function manualSync(progressCallback) {
    // Retry pending queue first
    await retryPendingSync().catch(() => {});
    return syncAllData(progressCallback);
  }

  // ── loadSyncedData ───────────────────────────────────────────────────────────

  async function loadSyncedData(dataType) {
    if (!_ensureClient()) return { success: false, error: 'No client', data: [] };
    const uid = await _getUid();
    if (!uid) return { success: false, error: 'Not authenticated', data: [] };

    try {
      const prefix = `${dataType}:`;
      const { data, error } = await _supabase
        .from('sync_data')
        .select('key, value, updated_at, device_id')
        .eq('user_id', uid)
        .like('key', `${prefix}%`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const items = (data || []).map(row => ({
        id: row.key.slice(prefix.length),
        value: row.value,
        meta: { updatedAt: row.updated_at, updatedByDeviceId: row.device_id }
      }));

      return { success: true, data: items };
    } catch (err) {
      return { success: false, error: err.message, data: [] };
    }
  }

  // ── Pending queue retry ─────────────────────────────────────────────────────

  async function retryPendingSync() {
    const result = await new Promise(resolve =>
      api_local.storage.local.get([STORAGE_KEYS.PENDING_QUEUE], r =>
        resolve(r[STORAGE_KEYS.PENDING_QUEUE] || [])
      )
    );
    if (!result.length) return { success: true, message: 'No pending operations' };

    const uid = await _getUid();
    if (!uid) return { success: false, error: 'Not authenticated' };

    const failed = [];
    let processed = 0;
    let dropped = 0;
    const MAX_RETRIES = 10;

    for (const op of result) {
      const delay = Math.min(Math.pow(2, op.retryCount || 0) * 1000, 60000);
      if (Date.now() - (op.timestamp || 0) < delay) { failed.push(op); continue; }

      const r = await _upsertKey(uid, op.dataType, op.documentId, op.data);
      if (r.success) {
        processed++;
      } else if (r.retryable === false || (op.retryCount || 0) >= MAX_RETRIES) {
        // Permanent failure or exhausted retries — drop it so the queue can't
        // grow forever on data that will never succeed.
        dropped++;
      } else {
        op.retryCount = (op.retryCount || 0) + 1;
        op.timestamp = Date.now();
        failed.push(op);
      }
    }

    await new Promise(resolve =>
      api_local.storage.local.set({ [STORAGE_KEYS.PENDING_QUEUE]: failed }, resolve)
    );

    return { success: true, processed, dropped, failed: failed.length };
  }

  // ── Full backup (replaces cloudSyncCore) ────────────────────────────────────

  async function _gatherBackupData() {
    // Pomodoro config lives in storage.sync (browser-synced), not storage.local.
    const _syncGet = (api_local.storage && api_local.storage.sync && typeof api_local.storage.sync.get === 'function')
      ? api_local.storage.sync.get(['pomodoroSettings']).catch(() => ({}))
      : Promise.resolve({});
    const [allData, commands, syncedData] = await Promise.all([
      api_local.storage.local.get(),
      api_local.commands ? api_local.commands.getAll() : Promise.resolve([]),
      _syncGet
    ]);

    const settings = allData.settings || {};
    // Keep floatingButtonCustomIcons in the backup so user-added icons survive a
    // restore (matches the manual export in background.js buildBackupPayload).
    const settingsClean = { ...settings };

    const summaryHistoryKeys = Object.keys(allData).filter(k => k.startsWith('summary_history_'));
    const summaryHistoryData = {};
    for (const key of summaryHistoryKeys) {
      summaryHistoryData[key] = allData[key];
    }

    return {
      items: Array.isArray(allData.items) ? allData.items : [],
      categories: Array.isArray(allData.categories) ? allData.categories : [],
      selectedCategory: allData.selectedCategory || 'none',
      notes: Array.isArray(allData.sidebarNotes) ? allData.sidebarNotes : [],
      noteFolders: Array.isArray(allData.sidebarNoteFolders) ? allData.sidebarNoteFolders : [],
      notesUi: allData.sidebarNotesUi || null,
      trash: Array.isArray(allData.trashItems) ? allData.trashItems : [],
      notesTrash: Array.isArray(allData.sidebarNotesTrash) ? allData.sidebarNotesTrash : [],
      promptTemplates: Array.isArray(allData.summaryPromptTemplates) ? allData.summaryPromptTemplates : null,
      promptHistory: Array.isArray(allData.summaryPromptHistory) ? allData.summaryPromptHistory : [],
      categoryPickerLastLocation: allData.categoryPickerLastLocation || null,
      summaryModePreference: allData.summaryModePreference || null,
      summaryHistoryIndex: allData.summaryHistoryIndex || null,
      summaryHistory: summaryHistoryData,
      summaryHistoryFlat: Array.isArray(allData.summaryHistory) ? allData.summaryHistory : [],
      attachments: allData.sidebarNoteAttachments || null,
      todoLists: Array.isArray(allData.todoLists) ? allData.todoLists : [],
      todoItems: Array.isArray(allData.todoItems) ? allData.todoItems : [],
      settings: settingsClean,
      shortcuts: commands.map(c => ({ name: c.name, shortcut: c.shortcut })),
      pomodoroState: allData.pomodoroState || null,
      pomodoroHistory: Array.isArray(allData.pomodoroHistory) ? allData.pomodoroHistory : [],
      uiPrefs: {
        lpPickerWidth: allData.lpPickerWidth || null,
        lpPickerHeight: allData.lpPickerHeight || null,
        lpPickerOpacity: allData.lpPickerOpacity !== undefined ? allData.lpPickerOpacity : null,
        floatingSizeOverride: allData.floatingSizeOverride || null,
        selectionPopupPosition: allData['__lpSelectionSearchPopupPosition'] || null
      },
      sidebarAiEnabled: allData.sidebarAiEnabled || false,
      cloudAutoSync: allData.cloud_auto_sync !== undefined ? allData.cloud_auto_sync : true,
      cloudSyncNotification: allData.cloud_sync_notification !== undefined ? allData.cloud_sync_notification : true,
      summaryTonePreference: allData.summaryTonePreference || null,
      jarvis: {
        sessions: allData.jarvisSessions && typeof allData.jarvisSessions === "object" ? allData.jarvisSessions : null,
        conversations: Array.isArray(allData.jarvisConversations) ? allData.jarvisConversations : null,
        learnedCommands: Array.isArray(allData.jarvisLearnedCommands) ? allData.jarvisLearnedCommands : null,
        elementMemory: allData.jarvisElementMemory && typeof allData.jarvisElementMemory === "object" ? allData.jarvisElementMemory : null,
        elementHintsCache: allData.jarvisElementHintsCache && typeof allData.jarvisElementHintsCache === "object" ? allData.jarvisElementHintsCache : null,
        macros: allData.jarvisMacros && typeof allData.jarvisMacros === "object" ? allData.jarvisMacros : null,
        // ── Fields previously missing from JARVIS backup (Bug: jarvis export gaps) ─
        bottomHidden: allData.jarvisBottomHidden !== undefined ? allData.jarvisBottomHidden : null,
        fontPrefs: allData.jarvisFontPrefs && typeof allData.jarvisFontPrefs === "object" ? allData.jarvisFontPrefs : null,
        promptTemplates: Array.isArray(allData.jarvisPromptTemplates) ? allData.jarvisPromptTemplates : null
      },
      // ── Additional storage keys previously not captured by backup (import/export gaps) ─
      jarvisPrefs: (allData.jarvisPrefs && typeof allData.jarvisPrefs === "object") ? allData.jarvisPrefs : null,
      alarmClocks: Array.isArray(allData.alarmClocks) ? allData.alarmClocks : null,
      domainThumbnailPatterns: (allData.domainThumbnailPatternsV1 && typeof allData.domainThumbnailPatternsV1 === "object") ? allData.domainThumbnailPatternsV1 : null,
      jarvisCariSuffix: (allData.lp_jarvis_cari_suffix !== undefined) ? allData.lp_jarvis_cari_suffix : null,
      jarvisPanelLayout: (allData.jarvisPanelLayoutV1 && typeof allData.jarvisPanelLayoutV1 === "object") ? allData.jarvisPanelLayoutV1 : null,
      logLevel: (allData.logLevel !== undefined) ? allData.logLevel : null,
      pomodoroSettings: (syncedData && syncedData.pomodoroSettings && typeof syncedData.pomodoroSettings === "object") ? syncedData.pomodoroSettings : null,
      // summaryCustomPrompt lives inside `settings` (settings.summaryCustomPrompt)
      // and is carried by the settings blob above — no standalone field needed.
      meta: { exportedAt: new Date().toISOString(), version: 3 }
    };
  }

  // ── Backup blob compression ────────────────────────────────────────────────
  // The full backup JSON can be very large (items + saved page content). Uploading
  // it as raw JSON risks a Postgres `statement timeout`. Gzip-compress to a base64
  // string and wrap it so the payload stays valid JSON (no DB schema change needed).
  // Falls back to raw JSON when CompressionStream is unavailable.

  async function _compressBackupJson(json) {
    if (typeof CompressionStream === 'undefined' || typeof Response === 'undefined'
        || typeof ReadableStream === 'undefined' || typeof btoa === 'undefined') {
      return { payload: json, compressed: false };
    }
    try {
      const bytes = new TextEncoder().encode(json);
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      const view = new Uint8Array(buf);
      let bin = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < view.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, view.subarray(i, i + CHUNK));
      }
      return { payload: JSON.stringify({ __c: 1, b: btoa(bin) }), compressed: true, rawBytes: json.length };
    } catch (e) {
      return { payload: json, compressed: false };
    }
  }

  async function _decompressBackupJson(parsed) {
    if (!parsed || typeof parsed !== 'object' || parsed.__c !== 1 || typeof parsed.b !== 'string') {
      return parsed; // legacy / uncompressed backup
    }
    try {
      const bin = atob(parsed.b);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const cs = new DecompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      return JSON.parse(new TextDecoder().decode(buf));
    } catch (e) {
      return parsed; // fall back to raw (best effort)
    }
  }

  async function uploadBackup(uid, progressCallback) {
    if (!_ensureClient()) throw new Error('Supabase not initialised');
    if (!uid) throw new Error('Invalid UID');

    if (typeof progressCallback === 'function') progressCallback({ phase: 'gather', progress: 0 });
    const backupData = await _gatherBackupData();
    let json;
    try { json = JSON.stringify(backupData); } catch (e) {
      // Strip heavy fields on failure and retry once (circular ref / too large).
      backupData.items = []; backupData.notes = []; backupData.summaryHistoryData = {};
      try { json = JSON.stringify(backupData); } catch (e2) { throw new Error('Backup data too large to serialise'); }
    }
    const { payload, compressed, rawBytes } = await _compressBackupJson(json);
    const bytes = rawBytes || json.length;

    if (typeof progressCallback === 'function') progressCallback({ phase: 'upload', progress: 0.1 });

    // Split the (gzipped+base64) payload into small chunks so each upsert is a
    // tiny statement. A single multi-MB row trips Postgres `statement_timeout`.
    const CHUNK = 200000; // ~150 KB binary per row
    const parts = [];
    for (let i = 0; i < payload.length; i += CHUNK) parts.push(payload.slice(i, i + CHUNK));
    const totalParts = parts.length;
    const exportedAt = new Date().toISOString();

    // Drop any previous backup rows for this user before writing the new parts.
    const { error: delErr } = await _supabase.from('backup_data').delete().eq('user_id', uid);
    if (delErr) throw new Error(delErr.message);

    for (let p = 0; p < totalParts; p++) {
      const { error } = await _supabase
        .from('backup_data')
        .upsert({
          user_id: uid,
          part: p + 1,
          payload: parts[p],
          total_parts: totalParts,
          size_bytes: bytes,
          exported_at: exportedAt
        }, { onConflict: 'user_id,part' });
      if (error) throw new Error(error.message);
      if (typeof progressCallback === 'function') {
        progressCallback({ phase: 'upload', progress: 0.1 + 0.9 * (p + 1) / totalParts });
      }
    }

    if (typeof progressCallback === 'function') progressCallback({ phase: 'upload', progress: 1 });
    _trackWrite(totalParts);
    return { success: true, size: bytes, compressed: !!compressed, parts: totalParts };
  }

  async function downloadBackup(uid) {
    if (!_ensureClient()) throw new Error('Supabase not initialised');
    if (!uid) throw new Error('Invalid UID');

    const { data, error } = await _supabase
      .from('backup_data')
      .select('part, payload')
      .eq('user_id', uid)
      .order('part', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return { success: false, error: 'no_backup' };

    const joined = data.map((r) => r.payload || '').join('');
    try {
      const parsed = await _decompressBackupJson(JSON.parse(joined));
      return { success: true, data: parsed };
    } catch {
      return { success: false, error: 'parse_failed' };
    }
  }

  async function backupExists(uid) {
    if (!_ensureClient()) return false;
    try {
      const { data } = await _supabase
        .from('backup_data')
        .select('user_id')
        .eq('user_id', uid)
        .limit(1);
      return !!data && data.length > 0;
    } catch { return false; }
  }

  // ── Misc ─────────────────────────────────────────────────────────────────────

  async function isSyncEnabled() {
    return new Promise(resolve =>
      api_local.storage.local.get([STORAGE_KEYS.SYNC_ENABLED], r =>
        resolve(r[STORAGE_KEYS.SYNC_ENABLED] !== false)
      )
    );
  }

  async function setSyncEnabled(enabled) {
    return new Promise(resolve =>
      api_local.storage.local.set({ [STORAGE_KEYS.SYNC_ENABLED]: enabled }, resolve)
    );
  }

  async function getLastSyncTime() {
    return new Promise(resolve =>
      api_local.storage.local.get([STORAGE_KEYS.LAST_SYNC_TIME], r =>
        resolve(r[STORAGE_KEYS.LAST_SYNC_TIME] || 0)
      )
    );
  }

  function checkFirestoreAccess() {
    // Compatibility shim — Supabase doesn't need a separate access check
    return Promise.resolve({ accessible: true });
  }

  const moduleApi = {
    // Init
    initializeSync,
    initializeFirestore: initializeSync,         // backward compat
    initializeCloudSync: () => _ensureClient(),  // backward compat
    // Sync
    syncData, syncAllData, manualSync, loadSyncedData, retryPendingSync,
    checkFirestoreAccess,
    // Backup (cloudSyncCore compat)
    gatherBackupData: _gatherBackupData,
    uploadBackup, downloadBackup, backupExists,
    // Utils
    isSyncEnabled, setSyncEnabled, getLastSyncTime,
    SCHEMA_VERSION,
    _getFirestoreInstance: () => null  // compat shim
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = moduleApi;
  if (globalScope && typeof globalScope === 'object') {
    globalScope.LocalPocketFirestoreSyncCore = moduleApi;  // backward compat
    globalScope.LocalPocketCloudSyncCore = moduleApi;       // backward compat
    globalScope.LocalPocketSupabaseSyncCore = moduleApi;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
