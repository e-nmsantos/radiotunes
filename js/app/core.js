//! Roc Waves — core: Base: escape/XSS, delegação de eventos, i18n, estado, backup, proxy de áudio, ICY e persistência.
// Script clássico carregado por ordem no index.html (partilha o âmbito global
// com os outros módulos de js/app/). Ver ordem em index.html.

// Escapa texto externo (radio-browser, metadados ICY, nomes do utilizador)
// antes de o inserir em HTML — impede injeção de código via nomes/títulos.
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// IDs de fontes externas: só caracteres seguros (vão para atributos e seletores).
function safeId(value) {
  return String(value == null ? '' : value).replace(/[^\w-]/g, '');
}

// URLs de imagem: apenas http(s)/data, escapados para atributo.
function safeImageUrl(url) {
  const u = String(url || '').trim();
  return /^(https?:|data:image\/)/i.test(u) ? escapeHtml(u) : '';
}

// ===================== Delegação de eventos =====================
// Os templates dinâmicos não usam onclick="fn('valor')": declaram
// ${uiAction('fn', valor)} → data-action="fn" data-args="[json]".
// Os argumentos são DADOS (JSON), nunca código: um nome de rádio ou
// título malicioso não tem como executar nada. Só as ações desta lista
// podem ser chamadas; o valor indica se recebem o evento no fim.
const UI_ACTIONS = {
  selectCategory: false, assignCategoryToStation: false,
  deletePlaylist: false, playPlaylistFirstStation: false,
  selectStation: false, flyToStationOnMap: false, openTrackSearch: false,
  openStationActions: false,
  handleCardCategoryClick: true, handleCardLibraryClick: true,
  handleCardFavClick: true, handleCardDeleteClick: true,
};

function uiAction(name, ...args) {
  return `data-action="${name}" data-args="${escapeHtml(JSON.stringify(args))}"`;
}

function runUiAction(e) {
  if (e.__rocHandled) return;
  const el = e.target.closest && e.target.closest('[data-action]');
  if (!el || !Object.prototype.hasOwnProperty.call(UI_ACTIONS, el.dataset.action)) return;
  const fn = window[el.dataset.action];
  if (typeof fn !== 'function') return;
  let args;
  try { args = JSON.parse(el.dataset.args || '[]'); } catch (err) { return; }
  if (!Array.isArray(args)) return;
  e.__rocHandled = true;
  if (UI_ACTIONS[el.dataset.action]) args.push(e);
  fn(...args);
}
document.addEventListener('click', runUiAction);

// Arrastar cartões para categorias (os IDs vêm de data-*, não de código).
document.addEventListener('dragstart', (e) => {
  const el = e.target.closest && e.target.closest('[data-drag-station]');
  if (el) handleDragStart(e, el.dataset.dragStation);
});
document.addEventListener('drop', (e) => {
  const el = e.target.closest && e.target.closest('[data-drop-category]');
  if (el) handleDropCategory(e, el.dataset.dropCategory, el);
});

// ===================== Diálogos acessíveis =====================
// Todos os modais/sheets têm role="dialog". Ao abrir, o foco entra no diálogo;
// Tab fica preso lá dentro; Escape fecha (com a função própria de cada um, que
// faz a limpeza necessária); ao fechar, o foco volta a quem o abriu.
const DIALOG_CLOSERS = {
  'history-modal': 'closeTrackHistoryModal', 'dvr-modal': 'closeDVRModal',
  'playlist-create-modal': 'closeCreatePlaylistModal', 'eq-modal': 'closeEqualizerModal',
  'soundscapes-modal': 'closeSoundscapesModal', 'sleep-modal': 'closeSleepModal',
  'alarm-modal': 'closeAlarmModal', 'tv-ambient-modal': 'closeTVMode',
  'backup-modal': 'closeBackupModal', 'add-modal': 'closeAddModal',
  'category-create-modal': 'closeCreateCategoryModal', 'station-category-modal': 'closeStationCategoryModal',
  'mobile-player-sheet': 'closeMobileSheetPlayer', 'mobile-tools-modal': 'closeMobileToolsDrawer',
  'delete-confirm-modal': 'closeDeleteStationModal', 'station-actions-sheet': 'closeStationActions',
};
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const isDialogOpen = (el) => !el.classList.contains('hidden') && el.getClientRects().length > 0;
function topOpenDialog() {
  // o último na ordem do DOM é o que está por cima (todos partilham z-50)
  return [...document.querySelectorAll('[role="dialog"]')].filter(isDialogOpen).pop() || null;
}
function focusablesIn(el) {
  return [...el.querySelectorAll(FOCUSABLE)].filter(f => f.getClientRects().length > 0);
}

function onDialogVisibilityChange(el) {
  const open = !el.classList.contains('hidden');
  if (open && !el.__rocOpen) {
    el.__rocOpen = true;
    el.__rocReturnFocus = document.activeElement;
    requestAnimationFrame(() => {
      const first = focusablesIn(el)[0];
      if (first) first.focus({ preventScroll: true });
      else { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
    });
  } else if (!open && el.__rocOpen) {
    el.__rocOpen = false;
    const back = el.__rocReturnFocus;
    if (back && document.contains(back) && back.getClientRects().length) back.focus({ preventScroll: true });
  }
}
new MutationObserver((muts) => {
  for (const m of muts) {
    if (m.type === 'attributes' && m.target.getAttribute('role') === 'dialog') onDialogVisibilityChange(m.target);
  }
}).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

document.addEventListener('keydown', (e) => {
  const dlg = topOpenDialog();
  if (!dlg) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    const closer = window[DIALOG_CLOSERS[dlg.id]];
    if (typeof closer === 'function') closer(); else dlg.classList.add('hidden');
    return;
  }
  if (e.key === 'Tab') {
    const items = focusablesIn(dlg);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// ===================== Bibliotecas a pedido =====================
// hls.js e Leaflet só são descarregados quando são precisos (stream .m3u8 /
// abrir o mapa): o arranque fica muito mais leve, sobretudo no telemóvel.
// Versões fixas + SRI, como antes no <head>.
const LAZY_LIBS = {
  hls: [
    ['js', 'https://cdn.jsdelivr.net/npm/hls.js@1.7.4/dist/hls.min.js', 'sha384-p9vgU/7IYJWd3I4STrtqxqR/2cAQlhIX7D/HrTnIMEjjcUox165b7se7sxmm3zDg'],
  ],
  leaflet: [
    ['css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H'],
    ['css', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css', 'sha384-pmjIAcz2bAn0xukfxADbZIb3t8oRT9Sv0rvO+BR5Csr6Dhqq+nZs59P0pPKQJkEV'],
    ['css', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css', 'sha384-wgw+aLYNQ7dlhK47ZPK7FRACiq7ROZwgFNg0m04avm4CaXS+Z9Y7nMu8yNjBKYC+'],
    ['js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH'],
    ['js', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js', 'sha384-eXVCORTRlv4FUUgS/xmOyr66XBVraen8ATNLMESp92FKXLAMiKkerixTiBvXriZr'],
  ],
};
const lazyLibPromises = {};

function loadAsset(kind, url, integrity) {
  return new Promise((resolve, reject) => {
    const el = document.createElement(kind === 'js' ? 'script' : 'link');
    if (kind === 'js') el.src = url; else { el.rel = 'stylesheet'; el.href = url; }
    el.integrity = integrity;
    el.crossOrigin = 'anonymous';
    el.onload = resolve;
    el.onerror = () => reject(new Error('falha ao carregar ' + url));
    document.head.appendChild(el);
  });
}

/** Carrega uma biblioteca uma única vez (CSS em paralelo, scripts por ordem). */
function ensureLib(name) {
  if (!lazyLibPromises[name]) {
    const assets = LAZY_LIBS[name];
    lazyLibPromises[name] = (async () => {
      await Promise.all(assets.filter(a => a[0] === 'css').map(a => loadAsset(...a)));
      for (const a of assets.filter(a => a[0] === 'js')) await loadAsset(...a);
    })().catch(err => { delete lazyLibPromises[name]; throw err; });
  }
  return lazyLibPromises[name];
}

function openTrackSearch(service, title) {
  const q = encodeURIComponent(title || '');
  const url = service === 'youtube'
    ? `https://www.youtube.com/results?search_query=${q}`
    : `https://open.spotify.com/search/${q}`;
  window.open(url, '_blank', 'noopener');
}

let currentLang = localStorage.getItem('roc_user_lang') || 'pt';

// Tradução com interpolação: t('loadingCity', { city }) → "A carregar ... {city}".
function t(key, vars) {
  const dict = I18N[currentLang] || I18N.pt;
  let str = dict[key] != null ? dict[key] : (I18N.pt[key] != null ? I18N.pt[key] : key);
  if (vars) for (const k in vars) str = str.split('{' + k + '}').join(vars[k]);
  return str;
}

function changeLanguage(lang) {
  currentLang = lang;
  persist('roc_user_lang', lang);
  document.getElementById('lang-select').value = lang;
  
  const dict = I18N[lang] || I18N.pt;
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    if (dict[key]) el.setAttribute('aria-label', dict[key]);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) el.setAttribute('placeholder', dict[key]);
  });
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });
  refreshViewHeader(currentView);
  render();
}

// State Variables
let userFavorites = JSON.parse(localStorage.getItem('roc_user_favorites') || '["m_101", "m_201", "m_301", "m_1", "m_2"]');
let userLibrary = JSON.parse(localStorage.getItem('roc_user_library') || '["m_101", "m_102", "m_103", "m_104", "m_105", "m_106", "m_201", "m_202", "m_301", "m_1", "m_2", "m_3", "m_4", "m_5", "m_6", "m_11", "m_13", "m_24", "m_25"]');
let userPlaylists = JSON.parse(localStorage.getItem('roc_user_playlists') || '[{"id":"pl_1","name":"Foco no Trabalho","icon":"💼","stationIds":["m_101","m_304","m_25"]},{"id":"pl_2","name":"Treino & Energia","icon":"🏃‍♂️","stationIds":["m_103","m_106","m_7"]}]');
let userCategories = JSON.parse(localStorage.getItem('roc_user_categories') || JSON.stringify([
  { id: "Todas", name: "Todas as Rádios", icon: "🌐" },
  { id: "Música", name: "Música & Pop", icon: "🎵" },
  { id: "Rock", name: "Rock & Anos 80", icon: "🎸" },
  { id: "Notícias", name: "Notícias & Debates", icon: "📰" },
  { id: "Desporto", name: "Desporto & Futebol", icon: "⚽" },
  { id: "Eletrónica", name: "Eletrónica & Dance", icon: "🎧" },
  { id: "Relax", name: "Lo-Fi, Jazz & Relax", icon: "☕" }
]));
let stationCategoryOverrides = JSON.parse(localStorage.getItem('roc_user_station_cats') || '{}');
let deletedStationIds = JSON.parse(localStorage.getItem('roc_user_deleted_stations') || '[]');
let userCustomStations = JSON.parse(localStorage.getItem('roc_user_custom_stations') || '[]');
let recentIds = JSON.parse(localStorage.getItem('roc_user_recents') || '["m_101", "m_201", "m_301", "m_1", "m_2"]');
let trackHistory = JSON.parse(localStorage.getItem('roc_user_track_history') || '[]');
let currentTheme = localStorage.getItem('roc_user_theme') || 'cyan';

let draggedStationId = null;
let targetStationForCategory = null;
let stationToDeleteId = null;

let eq10Bands = JSON.parse(localStorage.getItem('roc_user_eq10') || '{"32":0,"64":0,"125":0,"250":0,"500":0,"1k":0,"2k":0,"4k":0,"8k":0,"16k":0}');
let spatialValue = parseInt(localStorage.getItem('roc_user_spatial') || '0', 10);
let reverbValue = parseInt(localStorage.getItem('roc_user_reverb') || '0', 10);

let alarmSettings = JSON.parse(localStorage.getItem('roc_user_alarm') || '{"enabled":false,"time":"07:30","stationId":"m_101"}');
let dvrSettings = JSON.parse(localStorage.getItem('roc_user_dvr') || '{"enabled":false,"time":"08:00","duration":30,"stationId":"m_101"}');

let sleepSecondsLeft = 0;
let sleepInterval = null;
let alarmCheckInterval = null;

// ---- Backup automático (IndexedDB) + restauro da coleção ----
// Cada saveState escreve um snapshot (debounced); se o localStorage for
// limpo, a app restaura sozinha favoritos, playlists, categorias, etc.
let backupTimer = null;
function writeAutoBackup() {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    if (typeof RocStorage === 'undefined') return;
    RocStorage.set('backup:auto', {
      t: Date.now(),
      favorites: userFavorites, library: userLibrary, playlists: userPlaylists,
      categories: userCategories, stationCats: stationCategoryOverrides,
      deleted: deletedStationIds, custom: userCustomStations, recents: recentIds,
      history: trackHistory, alarm: alarmSettings, dvr: dvrSettings,
      eq: eq10Bands, theme: currentTheme, lang: currentLang,
    });
  }, 1500);
}

// Restaura a coleção do backup IndexedDB quando o localStorage está vazio.
async function restoreFromAutoBackup() {
  try {
    // Só restaurar quando o localStorage está vazio (nova máquina/cache limpa)
    if (localStorage.getItem('roc_user_favorites')) return;
    const bk = await RocStorage.get('backup:auto');
    if (!bk || !Array.isArray(bk.favorites) || bk.favorites.length === 0) return;
    userFavorites = bk.favorites;
    userLibrary = Array.isArray(bk.library) ? bk.library : [];
    userPlaylists = Array.isArray(bk.playlists) ? bk.playlists : [];
    if (Array.isArray(bk.categories) && bk.categories.length) userCategories = bk.categories;
    stationCategoryOverrides = bk.stationCats || {};
    deletedStationIds = Array.isArray(bk.deleted) ? bk.deleted : [];
    userCustomStations = Array.isArray(bk.custom) ? bk.custom : [];
    if (Array.isArray(bk.recents) && bk.recents.length) recentIds = bk.recents;
    if (Array.isArray(bk.history)) trackHistory = bk.history;
    if (bk.alarm) alarmSettings = bk.alarm;
    if (bk.dvr) dvrSettings = bk.dvr;
    if (bk.eq) eq10Bands = bk.eq;
    persist('roc_user_favorites', JSON.stringify(userFavorites));
    persist('roc_user_library', JSON.stringify(userLibrary));
    persist('roc_user_playlists', JSON.stringify(userPlaylists));
    persist('roc_user_categories', JSON.stringify(userCategories));
    persist('roc_user_station_cats', JSON.stringify(stationCategoryOverrides));
    persist('roc_user_deleted_stations', JSON.stringify(deletedStationIds));
    persist('roc_user_custom_stations', JSON.stringify(userCustomStations));
    persist('roc_user_recents', JSON.stringify(recentIds));
    persist('roc_user_track_history', JSON.stringify(trackHistory));
    persist('roc_user_alarm', JSON.stringify(alarmSettings));
    persist('roc_user_dvr', JSON.stringify(dvrSettings));
    persist('roc_user_eq10', JSON.stringify(eq10Bands));
    showToast(t('autoBackupRestored'), '💾', 'success');
  } catch (e) { console.warn('Restauro do backup falhou:', e); }
}
let dvrCheckInterval = null;
let visualizerStyle = 'bars';

let apiSearchResults = [];
let currentStationId = "m_101";
let isPlaying = false;
let isMuted = false;
let volume = 80;
let currentView = 'home';
let selectedCategory = 'Todas';
let selectedCountry = 'Todos';
let selectedPlaylistId = null;
let searchQuery = '';
let hlsInstance = null;
let searchTimer = null;
let leafletMap = null;
let mapMarkers = [];
let deferredPWAInstallPrompt = null;

// Recording State
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordInterval = null;
let recordSeconds = 0;

// Audio Engine & Web Audio DSP Nodes
let audio = document.getElementById('audio-player');
audio.volume = volume / 100;

let audioCtx = null;
let sourceNode = null;
let analyserNode = null;
let filters10 = {};
let pannerNode = null;
let convolverNode = null;
let reverbGain = null;
let dryGain = null;
let isAudioContextReady = false;
let dspConnected = false;
let lastPlayIntent = false;
let corsBlockedStreamUrls = [];
try {
  corsBlockedStreamUrls = JSON.parse(localStorage.getItem('roc_user_cors_blocked') || '[]');
} catch (e) { corsBlockedStreamUrls = []; }

// --- Proxy de Áudio (opcional, zero dependências: proxy/server.cjs) ---
// Auto-detectado no arranque. Quando ativo: streams http:// e sem CORS
// são tunelados com CORS *, o DSP funciona em todas as estações e os
// metadados ICY alimentam o "Now Playing" real.
// Base dinâmica: no PC usa localhost; num telemóvel (via mobile.bat)
// usa o IP do PC que está a servir a app — zero configuração.
const AUDIO_PROXY_BASE = localStorage.getItem('roc_user_proxy_base') ||
  (location.hostname ? `http://${location.hostname}:8787` : 'http://localhost:8787');
let proxyAvailable = false;
(async function detectAudioProxy() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(AUDIO_PROXY_BASE + '/ping', { signal: ctrl.signal });
    clearTimeout(t);
    proxyAvailable = res.ok;
    if (proxyAvailable) console.info('Roc Waves: proxy de áudio ativo em', AUDIO_PROXY_BASE);
  } catch (e) { proxyAvailable = false; }
})();

// HLS (.m3u8) não é proxyado (os segmentos usam URLs relativos).
function resolveStreamUrl(streamUrl) {
  if (!proxyAvailable || !streamUrl || streamUrl.includes('.m3u8')) return streamUrl;
  const insecure = streamUrl.startsWith('http://');
  const blocked = corsBlockedStreamUrls.includes(streamUrl);
  if (insecure || blocked) {
    return AUDIO_PROXY_BASE + '/stream?url=' + encodeURIComponent(streamUrl);
  }
  return streamUrl;
}

// --- Now Playing real via metadados ICY (requer proxy ativo) ---
let icyPollInterval = null;
let icyAbortCtrl = null;
let lastIcyTitle = '';

function stopNowPlayingPolling() {
  if (icyPollInterval) clearInterval(icyPollInterval);
  icyPollInterval = null;
  if (icyAbortCtrl) { try { icyAbortCtrl.abort(); } catch (e) {} icyAbortCtrl = null; }
}

function applyNowPlaying(rawTitle) {
  const clean = String(rawTitle || '').replace(/\s+/g, ' ').trim();
  if (!clean || clean === lastIcyTitle) return;
  lastIcyTitle = clean;
  const npEl = document.getElementById('player-now-playing');
  if (npEl) npEl.textContent = clean;
  const tvSub = document.getElementById('tv-station-sub');
  if (tvSub) tvSub.textContent = clean;
  // "Artista - Faixa" → histórico de faixas e Media Session
  let artist = '', title = clean;
  const parts = clean.split(' - ');
  if (parts.length >= 2) { artist = parts[0].trim(); title = parts.slice(1).join(' - ').trim(); }
  addTrackToHistory(title, artist);
  try {
    const s = getCurrentStation();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: artist || (s.name || ''),
        album: 'Roc Waves Global Radio',
        artwork: [{ src: firstStationLogo(s), sizes: '512x512' }]
      });
    }
  } catch (e) {}
}

async function pollIcyMetadata() {
  if (!proxyAvailable || !isPlaying) return;
  const s = getCurrentStation();
  const originalUrl = s && s.stream_url;
  if (!originalUrl || originalUrl.includes('.m3u8')) return;
  try {
    icyAbortCtrl = new AbortController();
    const t = setTimeout(() => icyAbortCtrl.abort(), 9000);
    const res = await fetch(AUDIO_PROXY_BASE + '/icy?url=' + encodeURIComponent(originalUrl), { signal: icyAbortCtrl.signal });
    clearTimeout(t);
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.title) applyNowPlaying(data.title);
  } catch (e) { /* silencioso: metadados são best-effort */ }
}

function startNowPlayingPolling() {
  stopNowPlayingPolling();
  lastIcyTitle = '';
  if (!proxyAvailable) return;
  pollIcyMetadata();
  icyPollInterval = setInterval(pollIcyMetadata, 20000);
}

// Persistência segura: nunca rebenta com QuotaExceededError
let quotaWarned = false;
function persist(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn('Persistência falhou (quota?):', key, e);
    if (!quotaWarned) {
      quotaWarned = true;
      showToast(t('storageFull'), '💾', 'warning');
    }
    return false;
  }
}
