/**
 * JARVIS Memory Dashboard controller (memoryDashboard.js)
 * Menggunakan window.LocalPocketMemoryLayers (core/memoryLayers.js).
 */
(function () {
  'use strict';

  var ML = (typeof window !== 'undefined' && window.LocalPocketMemoryLayers) || null;
  if (!ML) {
    document.body.innerHTML = '<p class="err">Modul ingatan JARVIS gagal dimuat.</p>';
    return;
  }

  function $(id) { return document.getElementById(id); }
  function setStatus(msg, isError) {
    var el = $('status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = isError ? 'err' : '';
  }

  var fields = ['defaultLanguage', 'defaultTone', 'defaultSummaryMode', 'defaultCategory', 'proactiveLevel', 'autoSaveOnSummarize', 'voiceOutput'];

  function render() {
    var p = ML.getCachedProfile();
    $('defaultLanguage').value = p.defaultLanguage || 'ms';
    $('defaultTone').value = p.defaultTone || 'neutral';
    $('defaultSummaryMode').value = p.defaultSummaryMode || 'auto';
    $('defaultCategory').value = p.defaultCategory || '';
    $('proactiveLevel').value = (typeof p.proactiveLevel === 'number') ? p.proactiveLevel : 3;
    $('autoSaveOnSummarize').checked = !!p.autoSaveOnSummarize;
    $('voiceOutput').checked = !!p.voiceOutput;

    var sites = ML.summarizeProfile().learnedSites || [];
    var sitesEl = $('learnedSites');
    sitesEl.textContent = '';
    if (!sites.length) {
      var emptySite = document.createElement('li');
      var emptyHint = document.createElement('span');
      emptyHint.className = 'hint';
      emptyHint.textContent = 'Tiada lagi.';
      emptySite.appendChild(emptyHint);
      sitesEl.appendChild(emptySite);
    } else {
      sites.forEach(function (s) {
        var label = s.scope.replace(/^site:/, '');
        var li = document.createElement('li');
        var nameSpan = document.createElement('span');
        nameSpan.textContent = label;
        var tagSpan = document.createElement('span');
        tagSpan.className = 'tag';
        tagSpan.textContent = s.action + ' ×' + s.times;
        li.appendChild(nameSpan);
        li.appendChild(tagSpan);
        sitesEl.appendChild(li);
      });
    }

    var habits = ML.summarizeProfile().timeHabits || [];
    var habitsEl = $('timeHabits');
    habitsEl.textContent = '';
    if (!habits.length) {
      var emptyHabit = document.createElement('li');
      var emptyHint2 = document.createElement('span');
      emptyHint2.className = 'hint';
      emptyHint2.textContent = 'Tiada lagi.';
      emptyHabit.appendChild(emptyHint2);
      habitsEl.appendChild(emptyHabit);
    } else {
      habits.forEach(function (h) {
        var li = document.createElement('li');
        var periodSpan = document.createElement('span');
        periodSpan.textContent = h.period;
        var tagSpan = document.createElement('span');
        tagSpan.className = 'tag';
        tagSpan.textContent = (h.tone || '-') + ' / ' + (h.summaryMode || '-') + ' ×' + (h.count || 0);
        li.appendChild(periodSpan);
        li.appendChild(tagSpan);
        habitsEl.appendChild(li);
      });
    }
  }

  fields.forEach(function (f) {
    var el = $(f);
    if (!el) return;
    var evt = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evt, function () {
      var val;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'number') val = parseInt(el.value, 10);
      else val = el.value;
      try { ML.setPreference(f, val); setStatus('Disimpan.'); }
      catch (e) { setStatus('Gagal simpan: ' + e.message, true); }
    });
  });

  $('resetBtn').addEventListener('click', function () {
    if (!confirm('Lupakan SEMUA ingatan JARVIS? Tindakan ini tidak boleh dibuat asal.')) return;
    ML.resetMemory().then(function () {
      render();
      setStatus('Ingatan direset.');
    }).catch(function (e) { setStatus('Gagal reset: ' + e.message, true); });
  });

  $('exportBtn').addEventListener('click', function () {
    var json = ML.exportProfile();
    try {
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'jarvis-memory-' + Date.now() + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
      setStatus('Profil dieksport.');
    } catch (e) { setStatus('Gagal eksport: ' + e.message, true); }
  });

  $('importBtn').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var res = ML.importProfile(reader.result);
      if (res.ok) { render(); setStatus('Profil diimport.'); }
      else setStatus('Import gagal: ' + res.error, true);
    };
    reader.readAsText(file);
  });

  $('syncNow').addEventListener('click', function () {
    var state = $('syncState');
    if (!window.LocalPocketPreferenceSync) { state.textContent = 'Modul sync tidak tersedia.'; return; }
    state.textContent = 'Menyinkron…';
    window.LocalPocketPreferenceSync.pull().then(function (res) {
      if (!res.ok || !res.profile) { state.textContent = 'Tiada data awan (atau belum log masuk).'; return; }
      var imp = ML.importProfile(res.profile);
      if (imp.ok) { render(); state.textContent = 'Berjaya ditarik dari awan.'; }
      else state.textContent = 'Gagal guna data awan: ' + imp.error;
    }).catch(function (err) { state.textContent = 'Ralat sync: ' + (err && err.message || err); });
  });

  // Muat profil dari storage, kemudian papar.
  ML.ensureLoaded().then(render).catch(function () { render(); });
})();
