/**
 * Supabase Backup Core Module
 * Handles backup and restore of full extension states to Supabase DB.
 */

(function attachLocalPocketSupabaseBackupCore(globalScope) {
  'use strict';

  const BACKUP_TABLE = 'backup_data';

  let supabaseClient = null;

  function initializeCloudSync() {
    if (supabaseClient) return true;
    try {
      // Reuse the already-initialised Supabase client from the auth core.
      // NOTE: the public accessor is `getSupabaseClient` (no leading underscore).
      const authCore = globalScope.LocalPocketSupabaseAuthCore;
      if (authCore && typeof authCore.getSupabaseClient === 'function') {
        const shared = authCore.getSupabaseClient();
        if (shared) {
          supabaseClient = shared;
          return true;
        }
      }

      // Fallback: build directly from the globally loaded supabaseConfig.
      // The config object uses `url` / `anonKey` (see supabase-config.js).
      if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
        const config = (typeof supabaseConfig !== 'undefined' && supabaseConfig) || null;
        if (config && config.url && config.anonKey) {
          supabaseClient = supabase.createClient(config.url, config.anonKey);
          return true;
        }
      }

      console.error('Supabase client not available for backup initialization');
      return false;
    } catch (err) {
      console.error('Backup init error:', err);
      return false;
    }
  }

  async function gatherBackupData() {
    // Delegate to supabaseSyncCore to avoid duplication
    if (typeof LocalPocketSupabaseSyncCore !== 'undefined' && LocalPocketSupabaseSyncCore.gatherBackupData) {
      return LocalPocketSupabaseSyncCore.gatherBackupData();
    }
    // Fallback: local implementation (kept for standalone use)
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const [allData, commands] = await Promise.all([
      api.storage.local.get(),
      api.commands ? api.commands.getAll() : Promise.resolve([])
    ]);

    const settings = allData.settings || {};
    // Keep floatingButtonCustomIcons so user-added icons survive a restore.
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
      notesUi: allData.sidebarNotesUi && typeof allData.sidebarNotesUi === 'object' ? allData.sidebarNotesUi : null,
      trash: Array.isArray(allData.trashItems) ? allData.trashItems : [],
      notesTrash: Array.isArray(allData.sidebarNotesTrash) ? allData.sidebarNotesTrash : [],
      promptTemplates: Array.isArray(allData.summaryPromptTemplates) ? allData.summaryPromptTemplates : null,
      categoryPickerLastLocation: allData.categoryPickerLastLocation || null,
      summaryModePreference: allData.summaryModePreference || null,
      summaryHistoryIndex: allData.summaryHistoryIndex || null,
      summaryHistory: summaryHistoryData,
      summaryHistoryFlat: Array.isArray(allData.summaryHistory) ? allData.summaryHistory : [],
      attachments: allData.sidebarNoteAttachments || null,
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
      // ── Additional storage keys (import/export gaps; mirrored from sync core) ─
      jarvisPrefs: (allData.jarvisPrefs && typeof allData.jarvisPrefs === "object") ? allData.jarvisPrefs : null,
      alarmClocks: Array.isArray(allData.alarmClocks) ? allData.alarmClocks : null,
      domainThumbnailPatterns: (allData.domainThumbnailPatternsV1 && typeof allData.domainThumbnailPatternsV1 === "object") ? allData.domainThumbnailPatternsV1 : null,
      jarvisCariSuffix: (allData.lp_jarvis_cari_suffix !== undefined) ? allData.lp_jarvis_cari_suffix : null,
      jarvisPanelLayout: (allData.jarvisPanelLayoutV1 && typeof allData.jarvisPanelLayoutV1 === "object") ? allData.jarvisPanelLayoutV1 : null,
      logLevel: (allData.logLevel !== undefined) ? allData.logLevel : null,
      // summaryCustomPrompt is carried inside the `settings` blob above.
      meta: { exportedAt: new Date().toISOString(), version: 3 }
    };
  }

  function estimateBytes(str) {
    try {
      return new Blob([str]).size;
    } catch (e) {
      return str.length;
    }
  }

  // Gzip-compress the backup JSON to a base64 string wrapped in valid JSON so the
  // payload stays small (avoids Postgres `statement timeout` on large blobs). No DB
  // schema change needed. Falls back to raw JSON when CompressionStream is missing.
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
      return parsed;
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
      return parsed;
    }
  }

  /**
   * Upload Backup to Supabase
   */
  async function uploadBackup(uid, progressCallback) {
    // Delegate to supabaseSyncCore (single source of truth — handles chunked upload)
    if (typeof LocalPocketSupabaseSyncCore !== 'undefined' && LocalPocketSupabaseSyncCore.uploadBackup) {
      return LocalPocketSupabaseSyncCore.uploadBackup(uid, progressCallback);
    }
    throw new Error('Supabase sync core not available for backup upload');
  }

  /**
   * Check if backup exists in Supabase
   */
  async function backupExists(uid) {
    // Delegate to supabaseSyncCore (single source of truth)
    if (typeof LocalPocketSupabaseSyncCore !== 'undefined' && LocalPocketSupabaseSyncCore.backupExists) {
      return LocalPocketSupabaseSyncCore.backupExists(uid);
    }
    return false;
  }

  /**
   * Download Backup from Supabase
   */
  async function downloadBackup(uid) {
    // Delegate to supabaseSyncCore (single source of truth — handles chunked download)
    if (typeof LocalPocketSupabaseSyncCore !== 'undefined' && LocalPocketSupabaseSyncCore.downloadBackup) {
      return LocalPocketSupabaseSyncCore.downloadBackup(uid);
    }
    throw new Error('Supabase sync core not available for backup download');
  }

  const exportApi = {
    initializeCloudSync,
    gatherBackupData,
    uploadBackup,
    backupExists,
    downloadBackup
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = exportApi;
  if (globalScope && typeof globalScope === 'object') {
    // NOTE: do NOT overwrite LocalPocketCloudSyncCore here. That alias must stay
    // pointing at the working sync core (supabaseSyncCore.js, loaded first); this
    // backup module only registers under its own name.
    globalScope.LocalPocketSupabaseBackupCore = exportApi;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
