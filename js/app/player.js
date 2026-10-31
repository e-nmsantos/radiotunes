//! Roc Waves — player: Estações, estado, reprodução, eventos de áudio, PiP, vistas e playlists.
// Script clássico carregado por ordem no index.html (partilha o âmbito global
// com os outros módulos de js/app/). Ver ordem em index.html.

function getAllStations() {
  const deletedSet = new Set(deletedStationIds.map(String));
  const mapDiscovered = typeof mapDiscoveredStations !== 'undefined' && Array.isArray(mapDiscoveredStations) ? mapDiscoveredStations : [];
  const mapStationsList = typeof MAP_STATIONS !== 'undefined' && Array.isArray(MAP_STATIONS) ? MAP_STATIONS : [];
  const combined = searchQuery.trim() !== ''
    ? [...apiSearchResults, ...mapDiscovered, ...mapStationsList, ...userCustomStations, ...MASTER_CATALOG]
    : [...userCustomStations, ...MASTER_CATALOG, ...mapStationsList, ...mapDiscovered, ...apiSearchResults];

  const seen = new Set();
  return combined.filter(s => {
    if (!s || !s.id) return false;
    const sid = String(s.id);
    if (seen.has(sid) || deletedSet.has(sid)) return false;
    seen.add(sid);
    s.favorite = userFavorites.map(String).includes(sid);
    s.inLibrary = userLibrary.map(String).includes(sid);
    if (stationCategoryOverrides[sid]) {
      s.category = stationCategoryOverrides[sid];
    }
    return true;
  });
}

function saveState() {
  try {
    persist('roc_user_favorites', JSON.stringify(userFavorites));
    persist('roc_user_library', JSON.stringify(userLibrary));
    persist('roc_user_playlists', JSON.stringify(userPlaylists));
    persist('roc_user_categories', JSON.stringify(userCategories));
    persist('roc_user_station_cats', JSON.stringify(stationCategoryOverrides));
    persist('roc_user_deleted_stations', JSON.stringify(deletedStationIds));
    persist('roc_user_custom_stations', JSON.stringify(userCustomStations));
    persist('roc_user_recents', JSON.stringify(recentIds));
    persist('roc_user_track_history', JSON.stringify(trackHistory));
    persist('roc_user_eq10', JSON.stringify(eq10Bands));
    persist('roc_user_spatial', String(spatialValue));
    persist('roc_user_reverb', String(reverbValue));
    persist('roc_user_alarm', JSON.stringify(alarmSettings));
    persist('roc_user_dvr', JSON.stringify(dvrSettings));
    persist('roc_user_theme', currentTheme);
  } catch(e) {
    console.warn('localStorage save warning:', e);
  }
  writeAutoBackup();
  updateCounts();
  render();
}

function updateCounts() {
  const all = getAllStations();
  const favEl = document.getElementById('fav-count');
  if (favEl) favEl.textContent = userFavorites.length;
  const libEl = document.getElementById('lib-count');
  if (libEl) libEl.textContent = userLibrary.length;
  const delEl = document.getElementById('deleted-count-badge');
  if (delEl) delEl.textContent = deletedStationIds.length;
  renderCategories();
  const histEl = document.getElementById('side-history-badge');
  if (histEl) histEl.textContent = trackHistory.length;
  const alarmEl = document.getElementById('side-alarm-badge');
  if (alarmEl) alarmEl.textContent = alarmSettings.enabled ? alarmSettings.time : 'Off';
  const dvrEl = document.getElementById('side-dvr-badge');
  if (dvrEl) dvrEl.textContent = dvrSettings.enabled ? dvrSettings.time : 'Off';
}

function getCurrentStation() {
  const targetId = String(currentStationId);
  
  // 1. Direct search in discovered map stations
  if (typeof mapDiscoveredStations !== 'undefined' && Array.isArray(mapDiscoveredStations)) {
    const foundMap = mapDiscoveredStations.find(s => String(s.id) === targetId);
    if (foundMap) return foundMap;
  }

  // 2. Direct search in MAP_STATIONS
  if (typeof MAP_STATIONS !== 'undefined' && Array.isArray(MAP_STATIONS)) {
    const foundMapBuiltin = MAP_STATIONS.find(s => String(s.id) === targetId);
    if (foundMapBuiltin) return foundMapBuiltin;
  }

  // 3. Search in all stations
  const all = getAllStations();
  const foundAll = all.find(s => String(s.id) === targetId);
  if (foundAll) return foundAll;

  return all[0] || MASTER_CATALOG[0];
}

function selectStation(id, autoplay = true) {
  currentStationId = String(id);
  recentIds = [String(id), ...recentIds.filter(i => String(i) !== String(id))].slice(0, 30);
  
  const s = getCurrentStation();
  const stNameEl = document.getElementById('player-station-name');
  if (stNameEl) stNameEl.textContent = s.name;
  
  const nowPlayingEl = document.getElementById('player-now-playing');
  if (nowPlayingEl) nowPlayingEl.textContent = `${s.country || 'Global'} • ${s.genre || s.category}`;
  
  const bitrateEl = document.getElementById('player-bitrate');
  if (bitrateEl) bitrateEl.textContent = `${s.bit_rate || 128} kbps`;
  
  const countryEl = document.getElementById('player-country');
  if (countryEl) countryEl.textContent = s.country || 'Global';
  
  const favBtn = document.getElementById('player-fav-btn');
  if (favBtn) favBtn.textContent = userFavorites.includes(String(s.id)) ? '⭐' : '☆';
  
  const libBtn = document.getElementById('player-lib-btn');
  if (libBtn) libBtn.textContent = userLibrary.includes(String(s.id)) ? '📌' : '➕';

  const tvName = document.getElementById('tv-station-name');
  if (tvName) tvName.textContent = s.name;
  const tvSub = document.getElementById('tv-station-sub');
  if (tvSub) tvSub.textContent = `${s.country || 'Global'} • ${s.genre || s.category}`;

  // Add to session track history
  addTrackToHistory(s.name, `${s.country || 'Global'} • ${s.genre || s.category}`);

  updateMediaSession(s);
  const errBanner = document.getElementById('stream-error-banner');
  if (errBanner) errBanner.classList.add('hidden');

  const imgEl = document.getElementById('player-cover-img');
  const fallbackEl = document.getElementById('player-cover-fallback');
  const tvImgEl = document.getElementById('tv-cover-img');
  const tvFallbackEl = document.getElementById('tv-cover-fallback');

  // Capa via cadeia de logos: image → favicon → homepage → monograma SVG
  if (imgEl) {
    imgEl.classList.remove('hidden');
    setImgWithLogoChain(imgEl, s);
  }
  if (fallbackEl) fallbackEl.classList.add('hidden');
  if (tvImgEl) {
    tvImgEl.classList.remove('hidden');
    setImgWithLogoChain(tvImgEl, s);
  }
  if (tvFallbackEl) tvFallbackEl.classList.add('hidden');

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  const streamUrl = s.stream_url;
  lastPlayIntent = autoplay;
  if (streamUrl && streamUrl.includes('.m3u8') && Hls.isSupported()) {
    // HLS via MSE é same-origin: DSP sempre disponível
    ensureDspMode(true);
    hlsInstance = new Hls();
    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(audio);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      if (autoplay) startAudio();
    });
    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        showStreamError();
        isPlaying = false;
        updatePlayState();
      }
    });
  } else {
    // Streams sem CORS não podem passar pelo grafo Web Audio (saída silenciada):
    // com proxy ativo são tunelados (CORS *, DSP sempre ligado); sem proxy,
    // tentamos CORS primeiro e o error handler repete em modo direto.
    const effectiveUrl = resolveStreamUrl(streamUrl);
    const viaProxy = effectiveUrl !== streamUrl;
    const bypass = !viaProxy && corsBlockedStreamUrls.includes(streamUrl);
    ensureDspMode(!!effectiveUrl && !bypass);
    audio.crossOrigin = bypass ? null : 'anonymous';
    audio.src = effectiveUrl || '';
    if (autoplay && streamUrl) {
      startAudio();
    }
  }

  startNowPlayingPolling();

  saveState();
  updatePiPCanvas();
}

function addTrackToHistory(title, artist) {
  const item = {
    title,
    artist,
    time: new Date().toLocaleTimeString(),
    id: Date.now()
  };
  trackHistory = [item, ...trackHistory.filter(t => t.title !== title)].slice(0, 25);
  const hTitle = document.getElementById('history-now-title');
  if (hTitle) hTitle.textContent = title;
  const hStation = document.getElementById('history-now-station');
  if (hStation) hStation.textContent = artist;
  updateCounts();
}

function updateMediaSession(station) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: `${station.country || 'Global'} • ${station.genre || station.category}`,
      album: 'Roc Waves Global Radio',
      artwork: [
        { src: firstStationLogo(station), sizes: '512x512' }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    navigator.mediaSession.setActionHandler('stop', () => {
      audio.pause();
      isPlaying = false;
      updatePlayState();
    });
  }
}

// Native Audio Element Event Listeners
// Ligados via attachAudioEvents porque o elemento pode ser recriado
// quando o motor alterna entre modo DSP (grafo Web Audio) e modo direto.
function attachAudioEvents(el) {
  el.addEventListener('play', () => {
    isPlaying = true;
    updatePlayState();
  });
  el.addEventListener('playing', () => {
    isPlaying = true;
    document.getElementById('stream-error-banner')?.classList.add('hidden');
    updatePlayState();
  });
  el.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayState();
  });
  el.addEventListener('ended', () => {
    isPlaying = false;
    updatePlayState();
  });
  el.addEventListener('error', handleAudioError);
}

function currentStationStreamUrl() {
  try {
    const s = getCurrentStation();
    return s && s.stream_url ? s.stream_url : null;
  } catch (e) { return null; }
}

// Destrói o motor DSP e recria o elemento <audio> limpo (reprodução direta).
// Necessário: depois de createMediaElementSource o elemento só emite som
// através do grafo, e streams sem CORS ficam silenciados dentro do grafo.
function resetAudioEngine() {
  try { if (audioCtx) audioCtx.close(); } catch (e) {}
  audioCtx = null; sourceNode = null; analyserNode = null; filters10 = {};
  pannerNode = null; convolverNode = null; reverbGain = null; dryGain = null;
  isAudioContextReady = false; dspConnected = false;
  const el = document.createElement('audio');
  el.id = 'audio-player';
  el.preload = 'none';
  el.volume = volume / 100;
  el.muted = isMuted;
  attachAudioEvents(el);
  audio.replaceWith(el);
  audio = el;
  // Recriar sons ambiente ativos no novo contexto (os nós antigos morrem com o ctx fechado)
  Object.keys(soundscapeNodes).forEach(t => {
    if (soundscapeNodes[t].vol > 0) {
      soundscapeNodes[t].node = null;
      soundscapeNodes[t].gain = null;
      initSoundscapeNode(t);
      if (soundscapeNodes[t].gain) {
        soundscapeNodes[t].gain.gain.value = (soundscapeNodes[t].vol / 100) * 0.4;
      }
    }
  });
}

// Liga (ou desliga) o DSP conforme o stream atual suportar CORS.
function ensureDspMode(wantDsp) {
  if (wantDsp && !dspConnected) {
    initAudioContext();
    if (audioCtx && isAudioContextReady && !sourceNode && filters10["32"]) {
      try {
        sourceNode = audioCtx.createMediaElementSource(audio);
        sourceNode.connect(filters10["32"]);
        dspConnected = true;
      } catch (err) {
        console.warn('DSP não pôde ser ligado a este elemento de áudio:', err);
        dspConnected = false;
      }
    }
  } else if (!wantDsp && dspConnected) {
    resetAudioEngine();
  }
}

// Distingue a causa da falha: fetch sem CORS lança TypeError (bloqueio CORS);
// se responder, o status HTTP diz se o stream está morto (4xx/5xx).
async function classifyStreamFailure(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1' }, signal: ctrl.signal });
    clearTimeout(t);
    return { reachable: true, status: res.status };
  } catch (e) {
    return { reachable: false, status: 0 };
  }
}

async function handleAudioError() {
  console.warn('Erro de reprodução no stream atual');
  const failedUrl = currentStationStreamUrl();
  // Só há ambiguidade na 1ª tentativa (com crossOrigin anónimo).
  if (audio.crossOrigin === 'anonymous' && failedUrl && !corsBlockedStreamUrls.includes(failedUrl)) {
    const probe = await classifyStreamFailure(failedUrl);

    if (!probe.reachable) {
      // Falha de CORS: repetir via proxy (DSP mantém-se) ou em modo direto.
      corsBlockedStreamUrls = [failedUrl, ...corsBlockedStreamUrls.filter(u => u !== failedUrl)].slice(0, 300);
      persist('roc_user_cors_blocked', JSON.stringify(corsBlockedStreamUrls));
      const autoplayRetry = lastPlayIntent;
      if (proxyAvailable) {
        showToast(t('proxyDsp'), '🎛️');
        audio.src = AUDIO_PROXY_BASE + '/stream?url=' + encodeURIComponent(failedUrl);
      } else {
        showToast(t('directMode'), '🎛️');
        resetAudioEngine();
        audio.crossOrigin = null;
        audio.src = failedUrl;
      }
      audio.load();
      if (autoplayRetry) startAudio();
      return;
    }

    if (probe.status >= 400) {
      // Stream morto no servidor da rádio (ex.: 404) — não é problema de CORS/DSP.
      showToast(t('streamDown', { status: probe.status }), '📡', 'warning');
      showStreamError(t('streamHttpError', { status: probe.status }));
    } else {
      // URL acessível, mas a reprodução falhou (falha transitória, codec, etc.)
      showToast(t('streamGlitch'), '📡', 'warning');
      showStreamError(t('streamPlaybackFailed'));
    }
    isPlaying = false;
    updatePlayState();
    return;
  }
  if (audio.src && audio.src !== window.location.href) {
    showStreamError();
  }
  isPlaying = false;
  updatePlayState();
}


function startAudio() {
  initAudioContext();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  lastPlayIntent = true;
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      isPlaying = true;
      document.getElementById('stream-error-banner')?.classList.add('hidden');
      updatePlayState();
    }).catch(err => {
      console.warn("Autoplay/play info:", err);
      if (err.name !== 'AbortError') {
        showStreamError();
        isPlaying = false;
        updatePlayState();
      }
    });
  }
}

function showStreamError(reason) {
  const el = document.getElementById('stream-error-banner');
  if (el) el.classList.remove('hidden');
  const txt = document.getElementById('stream-error-text');
  if (txt) txt.textContent = reason || t('streamOffline');
}

function retryCurrentStream() {
  selectStation(currentStationId, true);
}

function togglePlay() {
  initAudioContext();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  if (!audio.src && !hlsInstance) {
    selectStation(currentStationId, true);
    return;
  }
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    lastPlayIntent = false;
    updatePlayState();
  } else {
    startAudio();
  }
}

function updatePlayState() {
  const playIcon = document.getElementById('p-play-icon');
  const pauseIcon = document.getElementById('p-pause-icon');
  const tvPlayIcon = document.getElementById('tv-play-icon');
  const tvPauseIcon = document.getElementById('tv-pause-icon');
  const liveBadge = document.getElementById('player-live-badge');
  const cover = document.getElementById('player-cover-wrap');

  if (isPlaying) {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    tvPlayIcon.classList.add('hidden');
    tvPauseIcon.classList.remove('hidden');
    liveBadge.classList.remove('hidden');
    liveBadge.classList.add('inline-block');
    cover.classList.add('scale-105', 'ring-2', 'ring-cyan-400');
  } else {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    tvPlayIcon.classList.remove('hidden');
    tvPauseIcon.classList.add('hidden');
    liveBadge.classList.add('hidden');
    cover.classList.remove('scale-105', 'ring-2', 'ring-cyan-400');
  }
  const sheetPlayBtn = document.getElementById('sheet-play-btn');
  if (sheetPlayBtn) sheetPlayBtn.textContent = isPlaying ? '⏸️' : '▶️';
  renderRocPreview();
  updatePiPCanvas();
}

function playNext() {
  const list = getFilteredStations();
  if (list.length === 0) return;
  // Navegação cíclica garantida pela regra de negócio do Radio.roc (RocCore)
  const nextId = RocCore.nextStationId(list, currentStationId);
  if (nextId !== null) selectStation(nextId, isPlaying);
}

function playPrev() {
  const list = getFilteredStations();
  if (list.length === 0) return;
  const prevId = RocCore.prevStationId(list, currentStationId);
  if (prevId !== null) selectStation(prevId, isPlaying);
}

function toggleMute() {
  isMuted = !isMuted;
  audio.muted = isMuted;
  document.getElementById('p-vol-icon').classList.toggle('hidden', isMuted);
  document.getElementById('p-mute-icon').classList.toggle('hidden', !isMuted);
  renderRocPreview();
}

function setVolume(v) {
  volume = v;
  audio.volume = v / 100;
  if (isMuted && v > 0) toggleMute();
  renderRocPreview();
}

function toggleFavorite(id, event) {
  if (event) event.stopPropagation();
  const strId = String(id);
  if (userFavorites.includes(strId)) {
    userFavorites = userFavorites.filter(i => String(i) !== strId);
  } else {
    userFavorites.push(strId);
  }
  const curr = getCurrentStation();
  document.getElementById('player-fav-btn').textContent = userFavorites.includes(String(curr.id)) ? '⭐' : '☆';
  saveState();
}

function toggleCurrentFav() {
  toggleFavorite(currentStationId);
}

function toggleLibraryInclusion(id, event) {
  if (event) event.stopPropagation();
  const strId = String(id);
  if (userLibrary.includes(strId)) {
    userLibrary = userLibrary.filter(i => String(i) !== strId);
  } else {
    userLibrary.push(strId);
  }
  const curr = getCurrentStation();
  document.getElementById('player-lib-btn').textContent = userLibrary.includes(String(curr.id)) ? '📌' : '➕';
  saveState();
}

function toggleCurrentLib() {
  toggleLibraryInclusion(currentStationId);
}

// Picture-in-Picture Mini-Player Engine
async function togglePictureInPicture() {
  const video = document.getElementById('pip-video');
  const canvas = document.getElementById('pip-canvas');
  
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      updatePiPCanvas();
      const stream = canvas.captureStream(30);
      video.srcObject = stream;
      await video.play();
      await video.requestPictureInPicture();
    }
  } catch (err) {
    showToast(t('pipUnsupported'), '🖼️', 'warning');
  }
}

function updatePiPCanvas() {
  const canvas = document.getElementById('pip-canvas');
  const ctx = canvas.getContext('2d');
  const s = getCurrentStation();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#06b6d4';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(s.name.slice(0, 24), 30, 80);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`${s.country || 'Global'} • ${s.genre || s.category}`, 30, 115);

  ctx.fillStyle = isPlaying ? '#22c55e' : '#ef4444';
  ctx.beginPath();
  ctx.arc(40, 160, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(isPlaying ? 'A TOCAR EM DIRETO' : 'PAUSA', 60, 166);
}

function setView(view) {
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.className = 'nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition';
  });
  const activeNav = document.getElementById(`nav-${view}`);
  if (activeNav) {
    activeNav.className = 'nav-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition bg-cyan-500/20 text-cyan-400';
  }

  document.querySelectorAll('.mob-nav-btn').forEach(b => {
    b.className = 'mob-nav-btn flex flex-col items-center justify-center flex-1 py-1 text-slate-400 hover:text-white transition';
  });
  const activeMobNav = document.getElementById(`mob-nav-${view}`);
  if (activeMobNav) {
    activeMobNav.className = 'mob-nav-btn flex flex-col items-center justify-center flex-1 py-1 text-cyan-400 font-bold transition';
  }

  const mapContainer = document.getElementById('map-view-container');
  const playlistsContainer = document.getElementById('playlists-view-container');
  const gridSection = document.getElementById('stations-grid-section');
  const countrySection = document.getElementById('country-filter-section');

  mapContainer.classList.add('hidden');
  playlistsContainer.classList.add('hidden');
  gridSection.classList.remove('hidden');
  countrySection.classList.remove('hidden');

  if (view === 'map') {
    mapContainer.classList.remove('hidden');
    gridSection.classList.add('hidden');
    countrySection.classList.add('hidden');
    initWorldMap();
  } else if (view === 'playlists') {
    playlistsContainer.classList.remove('hidden');
    renderPlaylistsView();
  }

  refreshViewHeader(view);
  render();
}

// Título da secção + banner explicativo da vista atual (no idioma ativo).
function refreshViewHeader(view) {
  const titleEl = document.getElementById('section-title');
  if (!titleEl) return;
  const dict = I18N[currentLang] || I18N.pt;
  if (view === 'favorites') {
    titleEl.innerHTML = `<span>⭐</span> ${dict.myFavorites}`;
    updateExplainerBanner('⭐', t('exFavTitle'), t('exFavDesc'));
  } else if (view === 'library') {
    titleEl.innerHTML = `<span>📌</span> ${dict.myLibrary}`;
    updateExplainerBanner('📌', t('exLibTitle'), t('exLibDesc'));
  } else if (view === 'recents') {
    titleEl.innerHTML = `<span>🕒</span> ${dict.recentlyPlayed}`;
    updateExplainerBanner('🕒', t('exRecTitle'), t('exRecDesc'));
  } else if (view === 'topworld') {
    titleEl.innerHTML = `<span>🌍</span> ${dict.top50World}`;
    updateExplainerBanner('🌍', t('exTopTitle'), t('exTopDesc'));
  } else if (view === 'playlists') {
    titleEl.innerHTML = `<span>📂</span> ${t('viewPlaylistsTitle')}`;
    updateExplainerBanner('📂', t('exPlTitle'), t('exPlDesc'));
  } else if (view === 'map') {
    titleEl.innerHTML = `<span>🗺️</span> ${t('viewMapTitle')}`;
    updateExplainerBanner('🗺️', t('exMapTitle'), t('exMapDesc'));
  } else {
    titleEl.innerHTML = `<span>🔥</span> ${dict.popularStations}`;
    if (selectedCategory && selectedCategory !== 'all' && selectedCategory !== 'Todas') {
      updateExplainerBanner('🏷️', t('exGenreTitle', { cat: selectedCategory }), t('exGenreDesc', { cat: selectedCategory }));
    } else {
      updateExplainerBanner('📻', t('exAllTitle'), t('exAllDesc'));
    }
  }
}

// Playlists Feature Engine
function renderPlaylistsView() {
  const grid = document.getElementById('playlists-grid');
  const all = getAllStations();

  grid.innerHTML = userPlaylists.map(pl => {
    const count = pl.stationIds.length;
    return `
      <div class="p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-3xl">${pl.icon || '📂'}</span>
          <button ${uiAction('deletePlaylist', pl.id)} class="text-slate-500 hover:text-red-400 text-xs" title="${escapeHtml(t('deletePlaylist'))}">🗑️</button>
        </div>
        <div>
          <h3 class="text-base font-black text-white">${escapeHtml(pl.name)}</h3>
          <p class="text-xs text-slate-400">${escapeHtml(t('playlistCount', { count }))}</p>
        </div>
        <div class="flex gap-2 pt-2">
          <button ${uiAction('playPlaylistFirstStation', pl.id)} class="flex-1 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition">
            ▶️ ${escapeHtml(t('playPlaylist'))}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openCreatePlaylistModal() { document.getElementById('playlist-create-modal').classList.remove('hidden'); }
function closeCreatePlaylistModal() { document.getElementById('playlist-create-modal').classList.add('hidden'); }

document.getElementById('playlist-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('pl-name').value.trim();
  const icon = document.getElementById('pl-icon').value;
  const newPl = {
    id: `pl_${Date.now()}`,
    name,
    icon,
    stationIds: [currentStationId]
  };
  userPlaylists.push(newPl);
  saveState();
  closeCreatePlaylistModal();
  renderPlaylistsView();
});

function deletePlaylist(id) {
  userPlaylists = userPlaylists.filter(p => p.id !== id);
  saveState();
  renderPlaylistsView();
}

function playPlaylistFirstStation(id) {
  const pl = userPlaylists.find(p => p.id === id);
  if (pl && pl.stationIds.length > 0) {
    selectStation(pl.stationIds[0], true);
  }
}
