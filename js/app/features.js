//! Roc Waves — features: EQ, sleep timer, alarme, DVR, histórico, gravação, backup, temas, rádios pelo link do site, gestos e atalhos.
// Script clássico carregado por ordem no index.html (partilha o âmbito global
// com os outros módulos de js/app/). Ver ordem em index.html.

// 10-Band EQ & 3D Spatial Audio Engine
function openEqualizerModal() {
  document.getElementById('eq-modal').classList.remove('hidden');
  sync10BandSliders();
}
function closeEqualizerModal() {
  document.getElementById('eq-modal').classList.add('hidden');
}

function sync10BandSliders() {
  const keys = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
  keys.forEach(k => {
    const val = eq10Bands[k] || 0;
    const el = document.getElementById(`eq-b-${k}`);
    const txt = document.getElementById(`eq-v-${k}`);
    if (el) el.value = val;
    if (txt) txt.textContent = `${val > 0 ? '+' : ''}${val}`;
  });
  document.getElementById('spatial-slider').value = spatialValue;
  document.getElementById('spatial-val').textContent = `${spatialValue}%`;
  document.getElementById('reverb-slider').value = reverbValue;
  document.getElementById('reverb-val').textContent = reverbValue > 0 ? `${reverbValue}%` : 'Off';
}

function update10BandEQ() {
  initAudioContext();
  const keys = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
  keys.forEach(k => {
    const val = parseInt(document.getElementById(`eq-b-${k}`).value, 10);
    eq10Bands[k] = val;
    document.getElementById(`eq-v-${k}`).textContent = `${val > 0 ? '+' : ''}${val}`;
    if (filters10[k]) {
      filters10[k].gain.value = val;
    }
  });
  saveState();
}

function updateSpatialAudio(val) {
  initAudioContext();
  spatialValue = parseInt(val, 10);
  document.getElementById('spatial-val').textContent = `${spatialValue}%`;
  if (pannerNode) {
    pannerNode.pan.value = spatialValue / 100;
  }
  saveState();
}

function updateReverb(val) {
  initAudioContext();
  reverbValue = parseInt(val, 10);
  document.getElementById('reverb-val').textContent = reverbValue > 0 ? `${reverbValue}%` : 'Off';
  if (reverbGain) {
    reverbGain.gain.value = reverbValue / 100;
  }
  saveState();
}

function applyEQPreset(presetKey) {
  initAudioContext();
  const presets = {
    flat: { "32":0, "64":0, "125":0, "250":0, "500":0, "1k":0, "2k":0, "4k":0, "8k":0, "16k":0 },
    bass: { "32":8, "64":7, "125":5, "250":2, "500":0, "1k":0, "2k":1, "4k":2, "8k":3, "16k":2 },
    rock: { "32":5, "64":4, "125":2, "250":-1, "500":-2, "1k":0, "2k":2, "4k":4, "8k":5, "16k":4 },
    pop:  { "32":2, "64":3, "125":4, "250":2, "500":0, "1k":2, "2k":3, "4k":2, "8k":1, "16k":0 },
    vocal:{ "32":-4, "64":-3, "125":-1, "250":2, "500":5, "1k":6, "2k":4, "4k":2, "8k":0, "16k":-2 },
    jazz: { "32":3, "64":3, "125":2, "250":2, "500":1, "1k":1, "2k":2, "4k":3, "8k":3, "16k":2 },
    lofi: { "32":4, "64":3, "125":2, "250":0, "500":-2, "1k":-3, "2k":-2, "4k":-3, "8k":-5, "16k":-8 }
  };

  eq10Bands = presets[presetKey] || presets.flat;
  const keys = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
  keys.forEach(k => {
    if (filters10[k]) filters10[k].gain.value = eq10Bands[k];
  });
  sync10BandSliders();
  saveState();
}

function resetEQ() {
  applyEQPreset('flat');
  updateSpatialAudio(0);
  updateReverb(0);
}

// Sleep Timer System
function openSleepModal() { document.getElementById('sleep-modal').classList.remove('hidden'); }
function closeSleepModal() { document.getElementById('sleep-modal').classList.add('hidden'); }

function setSleepTimer(minutes) {
  clearInterval(sleepInterval);
  if (minutes <= 0) {
    sleepSecondsLeft = 0;
    document.getElementById('side-sleep-badge').textContent = 'Off';
    document.getElementById('player-sleep-txt').textContent = '⏳';
  } else {
    sleepSecondsLeft = minutes * 60;
    updateSleepDisplay();
    sleepInterval = setInterval(() => {
      sleepSecondsLeft--;
      if (sleepSecondsLeft <= 0) {
        clearInterval(sleepInterval);
        sleepSecondsLeft = 0;
        audio.pause();
        isPlaying = false;
        updatePlayState();
        document.getElementById('side-sleep-badge').textContent = 'Off';
        document.getElementById('player-sleep-txt').textContent = '⏳';
      } else {
        if (sleepSecondsLeft <= 10 && volume > 10) {
          audio.volume = (volume / 100) * (sleepSecondsLeft / 10);
        }
        updateSleepDisplay();
      }
    }, 1000);
  }
  closeSleepModal();
  renderRocPreview();
}

function updateSleepDisplay() {
  const mins = Math.floor(sleepSecondsLeft / 60);
  const secs = sleepSecondsLeft % 60;
  const str = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  document.getElementById('side-sleep-badge').textContent = str;
  document.getElementById('player-sleep-txt').textContent = str;
}

// Alarm Clock System
function openAlarmModal() {
  const select = document.getElementById('alarm-station-select');
  const all = getAllStations();
  select.innerHTML = all.map(s => `<option value="${escapeHtml(s.id)}" ${s.id === alarmSettings.stationId ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.country || 'Global')})</option>`).join('');
  document.getElementById('alarm-time-input').value = alarmSettings.time || '07:30';
  document.getElementById('alarm-toggle').checked = !!alarmSettings.enabled;
  document.getElementById('alarm-modal').classList.remove('hidden');
}
function closeAlarmModal() { document.getElementById('alarm-modal').classList.add('hidden'); }

function saveAlarmSettings() {
  alarmSettings.time = document.getElementById('alarm-time-input').value;
  alarmSettings.stationId = document.getElementById('alarm-station-select').value;
  alarmSettings.enabled = document.getElementById('alarm-toggle').checked;
  saveState();
  closeAlarmModal();
  initAlarmChecker();
}

function initAlarmChecker() {
  clearInterval(alarmCheckInterval);
  alarmCheckInterval = setInterval(() => {
    if (!alarmSettings.enabled) return;
    const now = new Date();
    const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (curTime === alarmSettings.time && now.getSeconds() === 0) {
      triggerAlarm();
    }
  }, 1000);
}

function triggerAlarm() {
  document.getElementById('alarm-ringing-banner').classList.remove('hidden');
  selectStation(alarmSettings.stationId, true);
  let rampVol = 10;
  setVolume(rampVol);
  const rampInterval = setInterval(() => {
    rampVol += 5;
    if (rampVol >= 90) clearInterval(rampInterval);
    setVolume(rampVol);
  }, 2000);
}

function snoozeAlarm() {
  document.getElementById('alarm-ringing-banner').classList.add('hidden');
  audio.pause();
  isPlaying = false;
  updatePlayState();
  setTimeout(() => {
    triggerAlarm();
  }, 5 * 60 * 1000);
}

function dismissAlarm() {
  document.getElementById('alarm-ringing-banner').classList.add('hidden');
}

// Radio DVR / Scheduled Recording Engine
function openDVRModal() {
  const select = document.getElementById('dvr-station-select');
  const all = getAllStations();
  select.innerHTML = all.map(s => `<option value="${escapeHtml(s.id)}" ${s.id === dvrSettings.stationId ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.country || 'Global')})</option>`).join('');
  document.getElementById('dvr-start-time').value = dvrSettings.time || '08:00';
  document.getElementById('dvr-duration').value = dvrSettings.duration || 30;
  document.getElementById('dvr-toggle').checked = !!dvrSettings.enabled;
  document.getElementById('dvr-modal').classList.remove('hidden');
}
function closeDVRModal() { document.getElementById('dvr-modal').classList.add('hidden'); }

function saveDVRSettings() {
  dvrSettings.time = document.getElementById('dvr-start-time').value;
  dvrSettings.duration = parseInt(document.getElementById('dvr-duration').value, 10);
  dvrSettings.stationId = document.getElementById('dvr-station-select').value;
  dvrSettings.enabled = document.getElementById('dvr-toggle').checked;
  saveState();
  closeDVRModal();
  initDVRChecker();
}

function initDVRChecker() {
  clearInterval(dvrCheckInterval);
  dvrCheckInterval = setInterval(() => {
    if (!dvrSettings.enabled) return;
    const now = new Date();
    const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (curTime === dvrSettings.time && now.getSeconds() === 0 && !isRecording) {
      triggerScheduledRecording();
    }
  }, 1000);
}

function triggerScheduledRecording() {
  selectStation(dvrSettings.stationId, true);
  startRecording();
  document.getElementById('dvr-active-banner').classList.remove('hidden');
  document.getElementById('dvr-status-msg').textContent = `A gravar ${dvrSettings.duration} minutos automaticamente.`;

  setTimeout(() => {
    stopRecording();
    document.getElementById('dvr-active-banner').classList.add('hidden');
  }, dvrSettings.duration * 60 * 1000);
}

// Track History & Lyrics Modal
function openTrackHistoryModal() {
  document.getElementById('history-modal').classList.remove('hidden');
  renderTrackHistoryList();
}
function closeTrackHistoryModal() { document.getElementById('history-modal').classList.add('hidden'); }

function renderTrackHistoryList() {
  const container = document.getElementById('history-tracks-list');
  if (trackHistory.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 py-4 text-center">${t('noTrackHistory')}</p>`;
    return;
  }
  container.innerHTML = trackHistory.map(item => `
    <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
      <div class="min-w-0 flex-1 pr-2">
        <h5 class="font-bold text-white truncate">${escapeHtml(item.title)}</h5>
        <p class="text-[10px] text-slate-400">${escapeHtml(item.artist)} • ${escapeHtml(item.time)}</p>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button ${uiAction('openTrackSearch', 'spotify', item.title)} class="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 text-[10px] font-bold">
          Spotify
        </button>
        <button ${uiAction('openTrackSearch', 'youtube', item.title)} class="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[10px] font-bold">
          YouTube
        </button>
      </div>
    </div>
  `).join('');
}

function clearTrackHistory() {
  trackHistory = [];
  saveState();
  renderTrackHistoryList();
}

function searchLyricsOnGoogle() {
  const curr = getCurrentStation();
  window.open(`https://www.google.com/search?q=${encodeURIComponent(curr.name + ' lyrics letra')}`, '_blank');
}

// Soundscapes Modal
function openSoundscapesModal() { document.getElementById('soundscapes-modal').classList.remove('hidden'); }
function closeSoundscapesModal() { document.getElementById('soundscapes-modal').classList.add('hidden'); }

// TV Mode
function openTVMode() {
  document.getElementById('tv-ambient-modal').classList.remove('hidden');
  startTVClock();
  resizeTVCanvas();
}
function closeTVMode() {
  document.getElementById('tv-ambient-modal').classList.add('hidden');
}

function setVisualizerStyle(style) {
  visualizerStyle = style;
  document.getElementById('viz-bars-btn').className = style === 'bars' ? 'px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold' : 'px-3 py-1.5 rounded-xl text-slate-400 hover:text-white font-medium';
  document.getElementById('viz-halo-btn').className = style === 'halo' ? 'px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold' : 'px-3 py-1.5 rounded-xl text-slate-400 hover:text-white font-medium';
}

function startTVClock() {
  function update() {
    const now = new Date();
    const str = now.toTimeString().split(' ')[0];
    document.getElementById('tv-digital-clock').textContent = str;
  }
  update();
  setInterval(update, 1000);
}

// Stream Recording
function toggleStreamRecording() {
  if (isRecording) stopRecording();
  else startRecording();
}

function startRecording() {
  try {
    let stream = null;
    if (audio.captureStream) stream = audio.captureStream();
    else if (audio.mozCaptureStream) stream = audio.mozCaptureStream();

    if (!stream || stream.getAudioTracks().length === 0) {
      showToast(t('recordCorsBlocked'), '⏺️', 'warning');
      return;
    }

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = saveRecordedAudio;
    mediaRecorder.start(500);

    isRecording = true;
    recordSeconds = 0;
    document.getElementById('record-dot').classList.add('recording-pulse');
    recordInterval = setInterval(() => {
      recordSeconds++;
      const mins = Math.floor(recordSeconds / 60);
      const secs = recordSeconds % 60;
      document.getElementById('record-btn').title = t('recordingTimer', { time: `${mins}:${secs < 10 ? '0' : ''}${secs}` });
    }, 1000);
  } catch (err) {
    showToast(t('recordUnsupported'), '⏺️', 'warning');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  isRecording = false;
  clearInterval(recordInterval);
  document.getElementById('record-dot').classList.remove('recording-pulse');
  document.getElementById('record-btn').title = 'Gravar Transmissão';
}

function saveRecordedAudio() {
  const blob = new Blob(recordedChunks, { type: 'audio/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const curr = getCurrentStation();
  const safeName = (curr.name || 'Radio').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `Gravacao_${safeName}_${Date.now()}.webm`;
  a.click();
  URL.revokeObjectURL(url);
}

// External Search & Share
function searchCurrentOnSpotify() {
  const curr = getCurrentStation();
  const query = encodeURIComponent(`${curr.name}`);
  window.open(`https://open.spotify.com/search/${query}`, '_blank');
}

function shareCurrentStation() {
  const curr = getCurrentStation();
  const shareUrl = `${window.location.origin}${window.location.pathname}?station=${encodeURIComponent(curr.id)}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    showToast(t('shareCopied', { name: curr.name }), '🔗', 'success');
  }).catch(() => showToast(t('shareFailed'), '🔗', 'warning'));
}

// Backup & M3U Export
function openBackupModal() { document.getElementById('backup-modal').classList.remove('hidden'); }
function closeBackupModal() { document.getElementById('backup-modal').classList.add('hidden'); }

function exportJSONBackup() {
  const backupData = {
    favorites: userFavorites,
    library: userLibrary,
    playlists: userPlaylists,
    customStations: userCustomStations,
    recents: recentIds,
    trackHistory: trackHistory,
    eq10: eq10Bands,
    spatial: spatialValue,
    reverb: reverbValue,
    alarm: alarmSettings,
    dvr: dvrSettings,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RadioTunes_Full_Backup_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSONBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (data.favorites) userFavorites = data.favorites;
      if (data.library) userLibrary = data.library;
      if (data.playlists) userPlaylists = data.playlists;
      if (data.customStations) userCustomStations = data.customStations;
      if (data.recents) recentIds = data.recents;
      if (data.trackHistory) trackHistory = data.trackHistory;
      if (data.eq10) eq10Bands = data.eq10;
      if (data.spatial !== undefined) spatialValue = data.spatial;
      if (data.reverb !== undefined) reverbValue = data.reverb;
      if (data.alarm) alarmSettings = data.alarm;
      if (data.dvr) dvrSettings = data.dvr;
      saveState();
      closeBackupModal();
      showToast(t('backupRestored'), '💾', 'success');
    } catch (err) {
      showToast(t('backupInvalid'), '⚠️', 'warning');
    }
  };
  reader.readAsText(file);
}

function downloadM3UPlaylist() {
  // Formato M3U gerado pela regra de negócio do Radio.roc (RocCore.exportM3U)
  const m3u = RocCore.exportM3U(getAllStations());
  const blob = new Blob([m3u], { type: 'audio/x-mpegurl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RadioTunes_Global_Playlist.m3u`;
  a.click();
  URL.revokeObjectURL(url);
}

// Theme Management
function setTheme(t) {
  currentTheme = t;
  document.documentElement.className = `theme-${t}`;
  saveState();
}
setTheme(currentTheme);

// Custom Station Modal
function openAddModal() {
  const catSelect = document.getElementById('cust-cat');
  if (catSelect) {
    catSelect.innerHTML = userCategories.filter(c => c.id !== 'Todas').map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
  }
  document.getElementById('add-modal').classList.remove('hidden');
}
function closeAddModal() { document.getElementById('add-modal').classList.add('hidden'); }

// ---- Descoberta de rádio pelo link do site ----
// Se o URL colado não for um stream direto: com proxy ativo, extraímos o
// stream do próprio site (HTML + bundles JS + padrão Supabase, via
// /extract); em paralelo tentamos a radio-browser por domínio.
function domainOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return null; }
}

// Base de nome a partir do domínio registável: app.mytopfm.pt → mytopfm
function baseNameFromDomain(u) {
  const host = domainOf(u);
  if (!host) return null;
  const labels = host.split('.');
  // subdomínios comuns de app/player não identificam a rádio
  const drop = new Set(['www', 'app', 'player', 'listen', 'live', 'stream', 'streaming', 'm', 'mobile', 'web', 'radio']);
  while (labels.length > 2 && drop.has(labels[0])) labels.shift();
  return labels.length >= 2 ? labels[labels.length - 2] : labels[0];
}

function looksLikeStreamUrl(u) {
  if (/\.(mp3|m3u8|aac|ogg|opus|flac|pls)(\?|#|$)/i.test(u)) return true;
  if (/:\d{2,5}(\/|$)/.test(u)) return true; // porta típica de icecast/shoutcast
  try {
    const p = new URL(u).pathname.toLowerCase();
    if (/(stream|listen|live|direct|audio)(\/|$)/.test(p)) return true;
  } catch (e) {}
  return false;
}

async function discoverStationFromSite(siteUrl) {
  // Com proxy ativo: extração direta do site (supera CORS e apps React)
  if (proxyAvailable) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(AUDIO_PROXY_BASE + '/extract?url=' + encodeURIComponent(siteUrl), { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        if (data && data.found && data.stream) {
          return {
            name: (data.title || '').split(/[|–—-]/)[0].trim() || null,
            url_resolved: data.stream,
            favicon: null,
            country: null,
            bitrate: data.bitrate || null,
            via: 'site-extract',
          };
        }
      }
    } catch (e) {}
  }

  // radio-browser: URL exato, depois nome derivado do domínio
  const domain = domainOf(siteUrl);
  if (!domain) return null;
  const srv = 'https://de1.api.radio-browser.info';
  try {
    const s = await RocStorage.cachedFetchJson(`${srv}/json/url/${encodeURIComponent(siteUrl)}`).catch(() => null);
    if (s && s.url_resolved) return { ...s, via: 'url-exact' };
  } catch (e) {}
  const base = baseNameFromDomain(siteUrl);
  if (!base || base.length < 3) return null;
  try {
    const list = await RocStorage.cachedFetchJson(`${srv}/json/stations/search?name=${encodeURIComponent(base)}&limit=50&order=clickcount&reverse=true`).catch(() => []);
    if (!Array.isArray(list)) return null;
    const sameHomepage = list.find(s => domainOf(s.homepage || '') === domain);
    if (sameHomepage) return { ...sameHomepage, via: 'homepage-match' };
    const sameStreamDomain = list.find(s => domainOf(s.url_resolved || '') === domain);
    if (sameStreamDomain) return { ...sameStreamDomain, via: 'stream-domain-match' };
  } catch (e) {}
  return null;
}

document.getElementById('custom-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  let name = document.getElementById('cust-name').value.trim();
  let url = document.getElementById('cust-url').value.trim();
  let image = document.getElementById('cust-image').value.trim() || null;
  const cat = document.getElementById('cust-cat').value;
  let country = document.getElementById('cust-country').value.trim() || 'Portugal';
  let bitRate = 128;

  // Link de site (não de stream): descobrir automaticamente a rádio
  if (!looksLikeStreamUrl(url)) {
    const submitBtn = e.submitter || document.querySelector('#custom-form button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '🔎 A descobrir o stream...'; }
    const found = await discoverStationFromSite(url);
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar'; }
    if (found && found.url_resolved) {
      if (!name) name = found.name;
      url = found.url_resolved;
      if (!image && found.favicon && found.favicon.startsWith('http')) image = found.favicon;
      if (found.country) country = found.country;
      if (found.bitrate) bitRate = found.bitrate;
      showToast(found.name ? t('siteDiscoveredNamed', { name: found.name }) : t('siteDiscovered'), '🔎', 'success');
    } else {
      showToast(t('siteNotFound'), '🔍', 'warning');
      return;
    }
  }
  if (!name) name = 'Rádio Personalizada';
  if (!url) return;

  const newId = `custom_${Date.now()}`;
  const newStation = {
    id: newId,
    name,
    stream_url: url,
    category: cat,
    genre: cat,
    country,
    flag: "📍",
    bit_rate: bitRate,
    favorite: true,
    inLibrary: true,
    image,
    favicon: image,
    color: "from-cyan-600 to-blue-700",
    desc: "Stream próprio adicionado"
  };

  userCustomStations.unshift(newStation);
  userFavorites.push(newId);
  userLibrary.push(newId);
  saveState();
  closeAddModal();
  selectStation(newId, true);
  showToast(t('stationAdded', { name, cat }), '📻', 'success');
});

// Gestos de swipe no mini-player mobile: ← estação anterior, → seguinte
(function initSheetGestures() {
  const sheet = document.getElementById('mobile-player-sheet');
  if (!sheet) return;
  let startX = 0, startY = 0, startTime = 0;
  sheet.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });
  sheet.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const dt = Date.now() - startTime;
    if (dt > 600) return;                       // gesto rápido, não arrasto
    if (Math.abs(dx) < 60) return;              // amplitude mínima
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return; // horizontal nítido
    if (dx < 0) playNext(); else playPrev();
  }, { passive: true });
})();

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  // Atalhos globais só quando o foco não está num controlo (Espaço/setas têm de
  // continuar a ativar botões e sliders) e nenhum diálogo está aberto
  // (o Escape dos diálogos é tratado em core.js).
  const el = document.activeElement;
  if (el && el.closest('input, select, textarea, button, a[href], [contenteditable], [role="dialog"]')) return;
  if (topOpenDialog()) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight') { e.preventDefault(); playNext(); }
  if (e.code === 'ArrowLeft') { e.preventDefault(); playPrev(); }
  if (e.code === 'KeyM') { toggleMute(); }
  if (e.code === 'KeyP') { togglePictureInPicture(); }
  if (e.code === 'KeyF') { openTVMode(); }
  if (e.code === 'ArrowUp') {
    e.preventDefault();
    setVolume(Math.min(100, volume + 5));
    document.getElementById('p-volume-slider').value = volume;
  }
  if (e.code === 'ArrowDown') {
    e.preventDefault();
    setVolume(Math.max(0, volume - 5));
    document.getElementById('p-volume-slider').value = volume;
  }
});
