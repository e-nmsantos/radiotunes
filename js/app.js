

    let currentLang = localStorage.getItem('roc_user_lang') || 'pt';

    function changeLanguage(lang) {
      currentLang = lang;
      persist('roc_user_lang', lang);
      document.getElementById('lang-select').value = lang;
      
      const dict = I18N[lang] || I18N.pt;
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
          el.textContent = dict[key];
        }
      });
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

    (async function restoreFromAutoBackup() {
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
        showToast('Coleção restaurada do backup automático.', '💾', 'success');
      } catch (e) { console.warn('Restauro do backup falhou:', e); }
    })();
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
        persist(key, value);
        return true;
      } catch (e) {
        console.warn('Persistência falhou (quota?):', key, e);
        if (!quotaWarned) {
          quotaWarned = true;
          showToast('Armazenamento local cheio — alguns dados podem não ser guardados.', '💾');
        }
        return false;
      }
    }

    // Soundscapes Nodes
    const soundscapeNodes = {
      rain: { gain: null, node: null, vol: 0 },
      ocean: { gain: null, node: null, vol: 0 },
      fire: { gain: null, node: null, vol: 0 },
      noise: { gain: null, node: null, vol: 0 }
    };

    // PWA Service Worker Registration & Cache Auto-Update
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          reg.update();
        }).catch(err => {
          console.warn('SW register fail:', err);
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPWAInstallPrompt = e;
      document.getElementById('pwa-install-banner').classList.remove('hidden');
    });

    function installPWA() {
      if (deferredPWAInstallPrompt) {
        deferredPWAInstallPrompt.prompt();
        deferredPWAInstallPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            document.getElementById('pwa-install-banner').classList.add('hidden');
          }
          deferredPWAInstallPrompt = null;
        });
      }
    }

    function initAudioContext() {
      if (audioCtx) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();

        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 128;

        // 10-Band Graphic Equalizer Filter Nodes
        const freqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        const keys = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];

        freqs.forEach((f, idx) => {
          const filter = audioCtx.createBiquadFilter();
          filter.type = idx === 0 ? 'lowshelf' : (idx === freqs.length - 1 ? 'highshelf' : 'peaking');
          filter.frequency.value = f;
          filter.Q.value = 1.4;
          filter.gain.value = eq10Bands[keys[idx]] || 0;
          filters10[keys[idx]] = filter;
        });

        // Stereo Panner (Spatial Audio)
        if (audioCtx.createStereoPanner) {
          pannerNode = audioCtx.createStereoPanner();
          pannerNode.pan.value = spatialValue / 100;
        }

        // Reverb Convolver
        convolverNode = audioCtx.createConvolver();
        createSyntheticImpulseResponse();
        
        reverbGain = audioCtx.createGain();
        dryGain = audioCtx.createGain();
        reverbGain.gain.value = reverbValue / 100;
        dryGain.gain.value = 1.0;

        // Fiação da cadeia DSP: source -> EQ 10 bandas -> panner -> dry/wet -> analyser -> destination
        const eqKeys = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
        for (let i = 0; i < eqKeys.length - 1; i++) {
          filters10[eqKeys[i]].connect(filters10[eqKeys[i + 1]]);
        }
        let chainTail = filters10[eqKeys[eqKeys.length - 1]];
        if (pannerNode) {
          chainTail.connect(pannerNode);
          chainTail = pannerNode;
        }
        chainTail.connect(dryGain);
        if (convolverNode) {
          chainTail.connect(convolverNode);
          convolverNode.connect(reverbGain);
          reverbGain.connect(analyserNode);
        }
        dryGain.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);

        isAudioContextReady = true;
      } catch (err) {
        console.warn("Web Audio API inicializada em modo fallback:", err);
      }
    }

    function createSyntheticImpulseResponse() {
      if (!audioCtx || !convolverNode) return;
      const rate = audioCtx.sampleRate;
      const length = rate * 2.0;
      const decay = 2.0;
      const impulse = audioCtx.createBuffer(2, length, rate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const n = i;
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
      }
      convolverNode.buffer = impulse;
    }

    // Soundscapes Synthesizer Engine
    function initSoundscapeNode(type) {
      if (!audioCtx) initAudioContext();
      if (soundscapeNodes[type].node) return;

      const bufferSize = audioCtx.sampleRate * 2;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);

      if (type === 'rain') {
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5;
        }
      } else if (type === 'ocean') {
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.sin(i / 10000);
        }
      } else if (type === 'fire') {
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() > 0.985 ? (Math.random() * 2 - 1) : (Math.random() * 0.05 - 0.025);
        }
      } else {
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      }

      const noiseSrc = audioCtx.createBufferSource();
      noiseSrc.buffer = buffer;
      noiseSrc.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = type === 'rain' ? 'lowpass' : (type === 'ocean' ? 'bandpass' : 'highpass');
      filter.frequency.value = type === 'rain' ? 800 : (type === 'ocean' ? 400 : 1200);

      const gain = audioCtx.createGain();
      gain.gain.value = 0;

      noiseSrc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      noiseSrc.start();

      soundscapeNodes[type].node = noiseSrc;
      soundscapeNodes[type].gain = gain;
    }

    function updateSoundscape(type, val) {
      initAudioContext();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      initSoundscapeNode(type);

      const num = parseInt(val, 10);
      soundscapeNodes[type].vol = num;
      if (soundscapeNodes[type].gain) {
        soundscapeNodes[type].gain.gain.value = (num / 100) * 0.4;
      }
      document.getElementById(`val-${type}`).textContent = `${num}%`;

      const activeCount = Object.values(soundscapeNodes).filter(s => s.vol > 0).length;
      document.getElementById('side-soundscapes-badge').textContent = activeCount > 0 ? `${activeCount} On` : 'Off';
    }

    function stopAllSoundscapes() {
      ['rain', 'ocean', 'fire', 'noise'].forEach(t => {
        document.getElementById(`sound-${t}`).value = 0;
        updateSoundscape(t, 0);
      });
    }

    // Toast Notification Engine
    function showToast(msg, icon = '✨', type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      const bgClass = type === 'success' ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100' : 'bg-slate-900/95 border-cyan-500/50 text-slate-100';
      toast.className = `toast-slide p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs pointer-events-auto transition-all ${bgClass}`;
      toast.innerHTML = `
        <span class="text-xl flex-shrink-0">${icon}</span>
        <span class="flex-1 font-medium leading-tight">${msg}</span>
      `;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    // Category Creation & Management Engine
    function renderCategories() {
      const sidebarList = document.getElementById('sidebar-categories-list');
      const carousel = document.getElementById('categories-carousel');
      const all = getAllStations();

      if (sidebarList) {
        sidebarList.innerHTML = userCategories.map(cat => {
          const isSelected = selectedCategory === cat.id;
          const count = cat.id === 'Todas' ? all.length : all.filter(s => s.category === cat.id).length;
          return `
            <button 
              onclick="selectCategory('${cat.id}')" 
              id="cat-${cat.id}" 
              ondragover="handleDragOver(event)" 
              ondragleave="handleDragLeave(event)" 
              ondrop="handleDropCategory(event, '${cat.id}')" 
              class="cat-btn w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium transition ${isSelected ? 'bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}"
            >
              <span class="flex items-center gap-2 truncate">
                <span>${cat.icon || '📁'}</span> 
                <span class="truncate">${cat.name}</span>
              </span>
              <span class="text-[10px] ${isSelected ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-800 text-slate-400'} px-2 py-0.5 rounded-full flex-shrink-0">${count}</span>
            </button>
          `;
        }).join('');
      }

      if (carousel) {
        carousel.innerHTML = userCategories.map(cat => {
          const isSelected = selectedCategory === cat.id;
          return `
            <button 
              onclick="selectCategory('${cat.id}')" 
              id="car-cat-${cat.id}" 
              ondragover="handleDragOver(event)" 
              ondragleave="handleDragLeave(event)" 
              ondrop="handleDropCategory(event, '${cat.id}')" 
              class="cat-pill-btn px-3.5 py-1.5 rounded-xl font-medium border flex-shrink-0 transition flex items-center gap-1.5 ${isSelected ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-md shadow-cyan-500/20' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'}"
            >
              <span>${cat.icon || '📁'}</span>
              <span>${cat.name}</span>
            </button>
          `;
        }).join('');
      }
    }

    function openCreateCategoryModal() {
      document.getElementById('category-create-modal').classList.remove('hidden');
      document.getElementById('cat-create-name').value = '';
    }
    function closeCreateCategoryModal() {
      document.getElementById('category-create-modal').classList.add('hidden');
    }

    function selectCategoryEmoji(emoji, btn) {
      document.getElementById('cat-create-icon').value = emoji;
      document.querySelectorAll('#emoji-picker-grid button').forEach(b => {
        b.className = 'emoji-opt-btn p-2 rounded-xl bg-slate-950 hover:bg-cyan-500/20 text-xl border border-slate-800 text-center';
      });
      if (btn) {
        btn.className = 'emoji-opt-btn p-2 rounded-xl bg-slate-950 ring-2 ring-cyan-400 text-xl border border-slate-800 text-center';
      }
    }

    document.getElementById('category-create-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('cat-create-name').value.trim();
      const icon = document.getElementById('cat-create-icon').value || '🎵';
      if (!name) return;

      const newCat = {
        id: name,
        name: name,
        icon: icon
      };

      if (!userCategories.some(c => c.id.toLowerCase() === name.toLowerCase())) {
        userCategories.push(newCat);
        persist('roc_user_categories', JSON.stringify(userCategories));
        showToast(`Categoria "${name}" criada com sucesso!`, icon, 'success');
      }
      closeCreateCategoryModal();
      selectCategory(newCat.id);
    });

    // Drag & Drop Handlers
    function handleDragStart(e, stationId) {
      draggedStationId = String(stationId);
      e.dataTransfer.setData('text/plain', stationId);
      e.dataTransfer.effectAllowed = 'move';
      const card = e.target.closest('.station-card');
      if (card) card.classList.add('card-dragging');
    }

    function handleDragEnd(e) {
      draggedStationId = null;
      document.querySelectorAll('.station-card').forEach(c => c.classList.remove('card-dragging'));
    }

    function handleDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.currentTarget;
      target.classList.add('drag-target-active');
    }

    function handleDragLeave(e) {
      const target = e.currentTarget;
      target.classList.remove('drag-target-active');
    }

    function handleDropCategory(e, catId) {
      e.preventDefault();
      const target = e.currentTarget;
      target.classList.remove('drag-target-active');
      const stationId = e.dataTransfer.getData('text/plain') || draggedStationId;
      if (!stationId || catId === 'Todas') return;

      assignCategoryToStation(stationId, catId);
    }

    // Touch Category Assignment Modal
    function openStationCategoryModal(stationId, event) {
      if (event) event.stopPropagation();
      targetStationForCategory = String(stationId);
      const all = getAllStations();
      const station = all.find(s => String(s.id) === targetStationForCategory) || getCurrentStation();

      const infoEl = document.getElementById('station-category-target-info');
      if (infoEl) {
        infoEl.innerHTML = `
          <span class="text-2xl">${station.flag || '📻'}</span>
          <div class="min-w-0 flex-1">
            <h4 class="text-xs font-bold text-white truncate">${station.name}</h4>
            <p class="text-[11px] text-slate-400">Categoria atual: <span class="text-cyan-400 font-semibold">${station.category || 'Música'}</span></p>
          </div>
        `;
      }

      const listEl = document.getElementById('station-category-options-list');
      if (listEl) {
        listEl.innerHTML = userCategories.filter(c => c.id !== 'Todas').map(cat => `
          <button onclick="assignCategoryToStation('${targetStationForCategory}', '${cat.id}')" class="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-xs transition">
            <span class="flex items-center gap-2 font-medium text-white"><span>${cat.icon || '📁'}</span> <span>${cat.name}</span></span>
            <span class="text-cyan-400 font-bold text-xs">Mover ➔</span>
          </button>
        `).join('');
      }

      document.getElementById('station-category-modal').classList.remove('hidden');
    }

    function closeStationCategoryModal() {
      document.getElementById('station-category-modal').classList.add('hidden');
      targetStationForCategory = null;
    }

    function assignCategoryToStation(stationId, catId) {
      const strId = String(stationId);
      stationCategoryOverrides[strId] = catId;
      persist('roc_user_station_cats', JSON.stringify(stationCategoryOverrides));

      // Also update userCustomStations if present
      const custStation = userCustomStations.find(s => String(s.id) === strId);
      if (custStation) {
        custStation.category = catId;
        custStation.genre = catId;
        persist('roc_user_custom_stations', JSON.stringify(userCustomStations));
      }

      // Automatically pin to library
      if (!userLibrary.includes(strId)) {
        userLibrary.push(strId);
        persist('roc_user_library', JSON.stringify(userLibrary));
      }

      const all = getAllStations();
      const station = all.find(s => String(s.id) === strId);
      const catObj = userCategories.find(c => c.id === catId);
      const stName = station ? station.name : 'Rádio';
      const catName = catObj ? catObj.name : catId;
      const catIcon = catObj ? catObj.icon : '🏷️';

      showToast(`Rádio "${stName}" associada à categoria "${catName}" e guardada na Biblioteca!`, catIcon, 'success');

      closeStationCategoryModal();
      saveState();
    }

    // Mobile Sheet Player & Tools
    function handlePlayerClick() {
      if (window.innerWidth < 768) {
        openMobileSheetPlayer();
      } else {
        openTVMode();
      }
    }

    function openMobileSheetPlayer() {
      const s = getCurrentStation();
      document.getElementById('sheet-station-name').textContent = s.name;
      document.getElementById('sheet-now-playing').textContent = `${s.country || 'Global'} • ${s.genre || s.category}`;
      document.getElementById('sheet-volume-slider').value = volume;
      
      const imgEl = document.getElementById('sheet-cover-img');
      const fallbackEl = document.getElementById('sheet-cover-fallback');
      // Capa via cadeia de logos (image → favicon → homepage → monograma)
      if (imgEl) {
        imgEl.classList.remove('hidden');
        setImgWithLogoChain(imgEl, s);
      }
      if (fallbackEl) fallbackEl.classList.add('hidden');
      document.getElementById('sheet-fav-btn').textContent = userFavorites.includes(String(s.id)) ? '⭐ Favorito' : '☆ Favorito';
      document.getElementById('sheet-lib-btn').textContent = userLibrary.includes(String(s.id)) ? '📌 Na Biblioteca' : '➕ Biblioteca';
      document.getElementById('sheet-play-btn').textContent = isPlaying ? '⏸️' : '▶️';
      document.getElementById('mobile-player-sheet').classList.remove('hidden');
    }

    function closeMobileSheetPlayer() {
      document.getElementById('mobile-player-sheet').classList.add('hidden');
    }

    function openMobileToolsDrawer() {
      document.getElementById('mobile-tools-modal').classList.remove('hidden');
    }
    function closeMobileToolsDrawer() {
      document.getElementById('mobile-tools-modal').classList.add('hidden');
    }

    // Explicit Card Action Handlers
    let lastDeletedStation = null;

    function handleCardDeleteClick(stationId, event) {
      if (event) {
        try {
          if (event.stopPropagation) event.stopPropagation();
          if (event.preventDefault) event.preventDefault();
        } catch(e) {}
      }
      deleteStationDirect(stationId);
    }

    function handleCardCategoryClick(stationId, event) {
      if (event) {
        try {
          if (event.stopPropagation) event.stopPropagation();
          if (event.preventDefault) event.preventDefault();
        } catch(e) {}
      }
      openStationCategoryModal(stationId, event);
    }

    function handleCardLibraryClick(stationId, event) {
      if (event) {
        try {
          if (event.stopPropagation) event.stopPropagation();
          if (event.preventDefault) event.preventDefault();
        } catch(e) {}
      }
      toggleLibraryInclusion(stationId, event);
    }

    function handleCardFavClick(stationId, event) {
      if (event) {
        try {
          if (event.stopPropagation) event.stopPropagation();
          if (event.preventDefault) event.preventDefault();
        } catch(e) {}
      }
      toggleFavorite(stationId, event);
    }

    // Delete / Hide Station Engine (Instant with Undo Toast)
    function deleteStationDirect(stationId) {
      const strId = String(stationId || currentStationId);
      const all = getAllStations();
      const station = all.find(s => String(s.id) === strId) || 
                      userCustomStations.find(s => String(s.id) === strId) ||
                      MASTER_CATALOG.find(s => String(s.id) === strId) ||
                      apiSearchResults.find(s => String(s.id) === strId);
      
      const stName = station ? station.name : 'Rádio';
      const wasFav = userFavorites.map(String).includes(strId);
      const wasLib = userLibrary.map(String).includes(strId);
      const wasRec = recentIds.map(String).includes(strId);
      const savedCats = stationCategoryOverrides[strId];
      const customObj = userCustomStations.find(s => String(s.id) === strId);

      // Save for Undo
      lastDeletedStation = {
        id: strId,
        name: stName,
        wasFav,
        wasLib,
        wasRec,
        savedCats,
        customObj: customObj ? JSON.parse(JSON.stringify(customObj)) : null
      };

      // 1. Remove permanently from custom stations if it was custom
      userCustomStations = userCustomStations.filter(s => String(s.id) !== strId);

      // 2. Remove from favorites, library, recents, playlists
      userFavorites = userFavorites.filter(id => String(id) !== strId);
      userLibrary = userLibrary.filter(id => String(id) !== strId);
      recentIds = recentIds.filter(id => String(id) !== strId);
      userPlaylists.forEach(pl => {
        if (pl && pl.stationIds) {
          pl.stationIds = pl.stationIds.filter(id => String(id) !== strId);
        }
      });

      // 3. Remove from search results
      apiSearchResults = apiSearchResults.filter(s => String(s.id) !== strId);

      // 4. Mark as deleted/hidden
      if (!deletedStationIds.map(String).includes(strId)) {
        deletedStationIds.push(strId);
      }
      persist('roc_user_deleted_stations', JSON.stringify(deletedStationIds));

      // 5. Delete category override
      delete stationCategoryOverrides[strId];
      persist('roc_user_station_cats', JSON.stringify(stationCategoryOverrides));

      // 6. Close modals if any
      closeDeleteStationModal();
      closeStationCategoryModal();
      closeMobileSheetPlayer();

      // 7. Save state and re-render grid immediately
      saveState();

      // 8. Show interactive Toast with Undo button!
      showDeleteUndoToast(stName, strId);

      // 9. If deleted station was currently playing, switch to next
      if (String(currentStationId) === strId) {
        const remaining = getAllStations();
        if (remaining.length > 0) {
          selectStation(remaining[0].id, isPlaying);
        } else {
          stopAudio();
        }
      }
    }

    function showDeleteUndoToast(stationName, stationId) {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = 'toast-slide p-4 rounded-2xl border border-red-500/40 bg-slate-900/98 shadow-2xl backdrop-blur-lg flex items-center justify-between gap-3 text-xs pointer-events-auto transition-all text-white z-[99999]';
      toast.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="text-xl flex-shrink-0">🗑️</span>
          <span class="font-bold truncate text-slate-200">Rádio <span class="text-white font-extrabold">"${stationName}"</span> eliminada!</span>
        </div>
        <button onclick="undoLastDelete(this)" class="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition active:scale-95 flex-shrink-0 shadow-md shadow-cyan-500/20">
          ↩️ Desfazer
        </button>
      `;
      container.appendChild(toast);

      setTimeout(() => {
        if (toast && toast.parentElement) {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(-10px)';
          setTimeout(() => toast.remove(), 300);
        }
      }, 5000);
    }

    function undoLastDelete(btnEl) {
      if (!lastDeletedStation) return;
      const d = lastDeletedStation;

      // 1. Remove from deletedStationIds
      deletedStationIds = deletedStationIds.filter(id => String(id) !== String(d.id));
      persist('roc_user_deleted_stations', JSON.stringify(deletedStationIds));

      // 2. Restore custom station if it was custom
      if (d.customObj && !userCustomStations.some(s => String(s.id) === String(d.id))) {
        userCustomStations.push(d.customObj);
      }

      // 3. Restore favorites, library, recents
      if (d.wasFav && !userFavorites.includes(d.id)) userFavorites.push(d.id);
      if (d.wasLib && !userLibrary.includes(d.id)) userLibrary.push(d.id);
      if (d.wasRec && !recentIds.includes(d.id)) recentIds.unshift(d.id);
      if (d.savedCats) stationCategoryOverrides[d.id] = d.savedCats;

      lastDeletedStation = null;
      saveState();

      if (btnEl && btnEl.closest('.toast-slide')) {
        btnEl.closest('.toast-slide').remove();
      }

      showToast(`Rádio "${d.name}" restaurada com sucesso!`, '🔄', 'success');
    }

    function openDeleteStationModal(stationId, event) {
      if (event) {
        try {
          if (event.stopPropagation) event.stopPropagation();
          if (event.preventDefault) event.preventDefault();
        } catch(e) {}
      }
      deleteStationDirect(stationId);
    }

    function closeDeleteStationModal() {
      const modal = document.getElementById('delete-confirm-modal');
      if (modal) {
        modal.classList.add('hidden');
      }
      stationToDeleteId = null;
    }

    function confirmDeleteStation() {
      if (!stationToDeleteId) return;
      deleteStationDirect(stationToDeleteId);
    }

    function restoreAllDeletedStations() {
      if (!deletedStationIds || deletedStationIds.length === 0) {
        showToast('Não existem rádios eliminadas para restaurar.', 'ℹ️', 'info');
        return;
      }
      const count = deletedStationIds.length;
      deletedStationIds = [];
      persist('roc_user_deleted_stations', JSON.stringify([]));
      saveState();
      showToast(`${count} rádio(s) restaurada(s) com sucesso no catálogo!`, '🔄', 'success');
      closeBackupModal();
    }

    // View Explainer Banner Helper
    function updateExplainerBanner(icon, title, desc) {
      const iconEl = document.getElementById('explainer-icon');
      const titleEl = document.getElementById('explainer-title');
      const descEl = document.getElementById('explainer-desc');
      if (iconEl) iconEl.textContent = icon;
      if (titleEl) titleEl.textContent = title;
      if (descEl) descEl.textContent = desc;
    }

    // ===================== Motor de Logos (cadeia de fallback) =====================
    // Ordem: image → favicon → apple-touch-icon/favicon do homepage → monograma SVG.
    // URLs que falham são memorizadas por sessão para não repetir tentativas.
    const failedLogoUrls = new Set();

    /** Monograma SVG (data URI) com as iniciais — último recurso decente. */
    function stationMonogram(s) {
      const words = (s.name || 'R').trim().split(/\s+/);
      const initials = ((words[0] || 'R')[0] + (words[1] ? words[1][0] : '')).toUpperCase();
      let h = 0;
      const key = String(s.id || '') + (s.name || '');
      for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
      const h1 = h % 360, h2 = (h1 + 40) % 360;
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${h1},70%,45%)'/><stop offset='1' stop-color='hsl(${h2},75%,55%)'/></linearGradient></defs><rect width='100' height='100' fill='url(#g)'/><text x='50' y='54' font-family='system-ui,sans-serif' font-size='38' font-weight='800' fill='white' text-anchor='middle' dominant-baseline='central'>${initials}</text></svg>`;
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    /** Candidatos a logo por ordem de preferência (último = monograma). */
    function stationLogoCandidates(s) {
      const out = [];
      const push = u => {
        if (u && typeof u === 'string' && u.startsWith('http') && !failedLogoUrls.has(u) && !out.includes(u)) out.push(u);
      };
      push(s.image);
      push(s.favicon);
      if (s.homepage && s.homepage.startsWith('http')) {
        const home = s.homepage.replace(/\/+$/, '');
        push(home + '/apple-touch-icon.png');
        push(home + '/apple-touch-icon-precomposed.png');
        push(home + '/favicon.ico');
      }
      out.push(stationMonogram(s));
      return out;
    }

    /** Primeiro candidato (para atribuir a src / artwork). */
    function firstStationLogo(s) {
      return stationLogoCandidates(s)[0];
    }

    /** <img> do player/TV: tenta candidatos por ordem até um carregar. */
    function setImgWithLogoChain(img, s) {
      const candidates = stationLogoCandidates(s);
      let i = 0;
      img.onerror = () => {
        if (candidates[i] && candidates[i].startsWith('http')) failedLogoUrls.add(candidates[i]);
        i++;
        if (i < candidates.length) {
          img.src = candidates[i];
        } else {
          img.onerror = null;
          img.src = stationMonogram(s);
        }
      };
      img.src = candidates[0];
    }

    /** Fallback inline dos cartões da grelha (onerror nos templates). */
    window.rocCardLogoFallback = function (img) {
      try {
        if (img.src && img.src.startsWith('http')) failedLogoUrls.add(img.src);
        const sid = img.dataset.rocStation;
        const s = getAllStations().find(x => String(x.id) === String(sid));
        if (!s) { img.onerror = null; return; }
        const next = stationLogoCandidates(s).find(u => u.startsWith('http'));
        img.src = next || stationMonogram(s);
      } catch (e) { img.onerror = null; }
    };

    // ============ Auditor de Saúde em Background ============
    // Arranca imediatamente com a app (em fundo, cadência suave — nunca
    // bloqueia a UI) e verifica os streams do catálogo: o browser é a
    // sonda mais fiel (TLS real, headers reais). Resultados em cache
    // IndexedDB 24h e badge ⚠ nos cartões. Só MARCA — a reparação
    // fica para o CI/humano.
    const unhealthyStationIds = new Set();
    let healthAuditRunning = false;

    async function probeStreamHealth(url) {
      // 1) Tentativa CORS: quando o servidor a permite, dá o status real.
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(url, {
          headers: { 'Range': 'bytes=0-1024', 'Accept': '*/*' },
          signal: ctrl.signal,
          redirect: 'follow',
        });
        clearTimeout(t);
        // CRÍTICO: fechar SEMPRE a ligação — um stream infinito deixado
        // aberto continuaria a descarregar para sempre em background,
        // saturando a rede e impedindo a reprodução real das rádios.
        if (res.body) { try { await res.body.cancel(); } catch (e) {} }
        if (res.ok) {
          // 200 não basta: a BBC (e outros) "desligam" streams com um
          // redirect para a homepage (200 text/html). Exigir áudio real.
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          const hasIcy = !!res.headers.get('icy-name') || !!res.headers.get('icy-br');
          const audioish = ct.startsWith('audio/') || ct.includes('mpegurl') ||
            ct.includes('ogg') || ct.includes('octet-stream') || ct === '' || hasIcy;
          if (audioish) return { healthy: true };
          return { healthy: false, reason: 'redireciona para página web' };
        }
        if (res.status >= 400) return { healthy: false, reason: 'HTTP ' + res.status };
        return { healthy: true };
      } catch (e) { /* sem CORS ou falha de rede — testar no-cors */ }
      // 2) Sem CORS: fetch no-cors deteta falhas de rede reais (DNS morto,
      //    ligação recusada). A resposta é opaca (não tem .body cancelável),
      //    por isso abortamos o controlador LOGO após receber os headers:
      //    sem isto, o stream infinito continuaria a descarregar para sempre.
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        await fetch(url, { mode: 'no-cors', signal: ctrl.signal });
        clearTimeout(t);
        ctrl.abort(); // fecha a ligação imediatamente (headers já recebidos)
        return { healthy: true, limited: true };
      } catch (e) {
        return { healthy: false, reason: 'inacessível' };
      }
    }

    async function runBackgroundHealthAudit() {
      if (healthAuditRunning) return;
      healthAuditRunning = true;
      try {
        const targets = [...MASTER_CATALOG, ...userCustomStations]
          .filter(s => s && s.id && s.stream_url && !s.stream_url.includes('.m3u8'));
        let flagged = false;
        for (const st of targets) {
          // Nunca sondar a estação em reprodução: não competir com a
          // ligação ativa do <audio> — a auditoria é 100% passiva.
          if (isPlaying && String(st.id) === String(currentStationId)) continue;
          const cacheKey = 'health:' + st.id;
          const cached = await RocStorage.get(cacheKey, 24 * 60 * 60 * 1000);
          if (cached) {
            if (cached.healthy === false) {
              if (!unhealthyStationIds.has(String(st.id))) flagged = true;
              unhealthyStationIds.add(String(st.id));
            }
            continue;
          }
          const res = await probeStreamHealth(st.stream_url);
          await RocStorage.set(cacheKey, { healthy: res.healthy, reason: res.reason || null, at: Date.now() });
          if (res.healthy === false) {
            console.warn(`Saúde: ${st.name} — ${res.reason}`);
            if (!unhealthyStationIds.has(String(st.id))) flagged = true;
            unhealthyStationIds.add(String(st.id));
          }
          await new Promise(r => setTimeout(r, 1200)); // cadência suave
        }
        if (flagged) {
          render(); // atualiza os badges ⚠ (o agente é silencioso: sem toasts)
        }
      } finally {
        healthAuditRunning = false;
      }
    }

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
            showToast('A ligar via proxy de áudio para ativar o DSP neste stream.', '🎛️');
            audio.src = AUDIO_PROXY_BASE + '/stream?url=' + encodeURIComponent(failedUrl);
          } else {
            showToast('Este stream não suporta DSP (CORS) — modo de áudio direto ativado.', '🎛️');
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
          showToast('Este stream está indisponível no servidor da rádio (HTTP ' + probe.status + ').', '📡');
          showStreamError(`O servidor da rádio respondeu HTTP ${probe.status} — stream inativo ou mudado de endereço.`);
        } else {
          // URL acessível, mas a reprodução falhou (falha transitória, codec, etc.)
          showToast('Falha transitória no stream — tenta reconectar ou escolhe outra estação.', '📡');
          showStreamError('O stream está acessível mas a reprodução falhou. Tenta reconectar.');
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

    attachAudioEvents(audio);

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
      if (reason) {
        const txt = document.getElementById('stream-error-text');
        if (txt) txt.textContent = reason;
      }
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
        alert('Picture-in-Picture não suportado ou bloqueado no teu navegador.');
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
      
      const titleEl = document.getElementById('section-title');
      const dict = I18N[currentLang] || I18N.pt;
      if (view === 'favorites') {
        titleEl.innerHTML = `<span>⭐</span> ${dict.myFavorites}`;
        updateExplainerBanner('⭐', 'Os Teus Favoritos Rápidos', 'As tuas rádios de eleição marcadas com estrela para acesso imediato.');
      } else if (view === 'library') {
        titleEl.innerHTML = `<span>📌</span> ${dict.myLibrary}`;
        updateExplainerBanner('📌', 'A Tua Biblioteca Pessoal', 'O teu acervo completo de rádios guardadas, personalizadas e organizadas por ti.');
      } else if (view === 'recents') {
        titleEl.innerHTML = `<span>🕒</span> ${dict.recentlyPlayed}`;
        updateExplainerBanner('🕒', 'Histórico de Reprodução Recente', 'As últimas estações que sintonizaste para retomares de onde paraste.');
      } else if (view === 'topworld') {
        titleEl.innerHTML = `<span>🌍</span> ${dict.top50World}`;
        updateExplainerBanner('🌍', 'Top 50 Rádios Mundiais', 'As estações mais populares e icónicas de todos os continentes.');
      } else if (view === 'playlists') {
        titleEl.innerHTML = `<span>📂</span> Playlists Temáticas`;
        updateExplainerBanner('📂', 'As Tuas Pastas & Playlists', 'Cria agrupamentos personalizados de rádios para momentos específicos.');
      } else if (view === 'map') {
        titleEl.innerHTML = `<span>🗺️</span> Mapa Interativo Mundial`;
        updateExplainerBanner('🗺️', 'Exploração Geográfica Global', 'Navega pelo globo e clica nas cidades para ouvir as emissões locais.');
      } else {
        titleEl.innerHTML = `<span>🔥</span> ${dict.popularStations}`;
        if (selectedCategory && selectedCategory !== 'all') {
          updateExplainerBanner('🏷️', `Género: ${selectedCategory}`, `Estações classificadas no género musical ou tema "${selectedCategory}".`);
        } else {
          updateExplainerBanner('📻', 'Catálogo Geral de Estações', 'Explora todas as rádios disponíveis por país, género musical ou pesquisa.');
        }
      }
      
      render();
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
              <button onclick="deletePlaylist('${pl.id}')" class="text-slate-500 hover:text-red-400 text-xs">🗑️</button>
            </div>
            <div>
              <h3 class="text-base font-black text-white">${pl.name}</h3>
              <p class="text-xs text-slate-400">${count} estações adicionadas</p>
            </div>
            <div class="flex gap-2 pt-2">
              <button onclick="playPlaylistFirstStation('${pl.id}')" class="flex-1 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition">
                ▶️ Tocar Playlist
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

    // World Interactive Radio Map (Leaflet & MarkerCluster) with Massive Live Geo-Discovery
    let currentMapRegion = 'all';
    let mapDiscoveredStations = [];
    // Persistência das estações descobertas no mapa em IndexedDB
    // (quota generosa vs ~5MB do localStorage), com gravação debounce.
    let mapStationsSaveTimer = null;
    function scheduleMapStationsSave() {
      if (mapStationsSaveTimer) clearTimeout(mapStationsSaveTimer);
      mapStationsSaveTimer = setTimeout(() => {
        RocStorage.set('mapDiscoveredStations', mapDiscoveredStations.slice(-4000));
      }, 2500);
    }
    RocStorage.get('mapDiscoveredStations').then(saved => {
      if (Array.isArray(saved) && saved.length) {
        saved.forEach(s => { if (s && s.id) mapDiscoveredStations.push(s); });
      }
    }).catch(() => {});
    let mapViewportTimer = null;
    let isFetchingGeoRadios = false;
    let mapClusterGroup = null;
    let hasStartedMassiveDiscovery = false;

    function initWorldMap() {
      if (!leafletMap) {
        leafletMap = L.map('world-map', {
          center: [20, 0],
          zoom: 2,
          minZoom: 2,
          maxZoom: 16,
          zoomControl: false
        });

        // Zoom no canto inferior direito: o superior esquerdo está ocupado
        // pelo HUD "Rede Global" e o zoom nativo ficava escondido por baixo.
        L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          maxZoom: 16
        }).addTo(leafletMap);

        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri',
          maxZoom: 16
        }).addTo(leafletMap);

        if (typeof L.markerClusterGroup === 'function') {
          mapClusterGroup = L.markerClusterGroup({
            maxClusterRadius: 40,
            disableClusteringAtZoom: 11,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false
          });
          leafletMap.addLayer(mapClusterGroup);
        }

        // Dynamic discovery as user zooms or pans into countries & cities
        leafletMap.on('moveend zoomend', () => {
          onMapViewportChanged();
        });
      }

      renderAllMapMarkers();

      const totalCountEl = document.getElementById('map-total-count');
      const allMappable = getAllMappableStations();
      if (totalCountEl) totalCountEl.textContent = allMappable.length > 0 ? allMappable.length.toLocaleString('pt-PT') : '...';

      filterMapByRegion(currentMapRegion);

      setTimeout(() => {
        if (leafletMap) leafletMap.invalidateSize();
      }, 250);

      // Start massive background discovery of thousands of stations across the globe
      if (!hasStartedMassiveDiscovery) {
        startMassiveRadioDiscovery();
      }
    }

    function getAllMappableStations() {
      const all = [...getAllStations(), ...mapDiscoveredStations];
      const seen = new Set();
      const deletedSet = new Set(deletedStationIds.map(String));

      return all.filter(s => {
        if (!s || !s.id || s.lat == null || s.lon == null) return false;
        const sid = String(s.id);
        if (seen.has(sid) || deletedSet.has(sid)) return false;
        seen.add(sid);
        return true;
      });
    }

    function renderAllMapMarkers() {
      if (!leafletMap) return;

      if (mapClusterGroup) {
        mapClusterGroup.clearLayers();
      } else {
        mapMarkers.forEach(m => leafletMap.removeLayer(m));
      }
      mapMarkers = [];

      const mappableStations = getAllMappableStations();
      const newLayers = [];

      mappableStations.forEach(st => {
        const marker = createMarkerObject(st);
        if (marker) {
          mapMarkers.push(marker);
          newLayers.push(marker);
        }
      });

      if (mapClusterGroup) {
        mapClusterGroup.addLayers(newLayers);
      }
    }

    function createMarkerObject(st) {
      if (!st || st.lat == null || st.lon == null) return null;

      const isCurrent = String(st.id) === String(currentStationId);
      const customIcon = L.divIcon({
        className: 'custom-radio-pin',
        html: `
          <div class="radio-garden-dot ${isCurrent ? 'is-active' : ''}" title="${st.name} (${st.city || st.country})">
            <div class="dot-ring"></div>
            <div class="dot-core"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });

      const marker = L.marker([st.lat, st.lon], { icon: customIcon });
      marker.stationId = String(st.id);
      marker.stationData = st;

      const safeName = (st.name || 'Rádio').replace(/"/g, '&quot;');
      const safeCity = (st.city ? st.city + ', ' : '') + (st.country || 'Mundo');
      const safeGenre = (st.genre || st.category || 'Música').replace(/"/g, '&quot;');

      marker.bindPopup(`
        <div class="p-2 space-y-2.5 text-slate-100 min-w-[220px]">
          <div class="flex items-center gap-2.5 border-b border-slate-700/80 pb-2">
            <span class="text-2xl flex-shrink-0">${st.flag || '🌐'}</span>
            <div class="min-w-0">
              <h4 class="font-black text-sm text-cyan-400 leading-tight truncate">${safeName}</h4>
              <p class="text-[11px] text-slate-300 font-semibold truncate">${safeCity}</p>
              <p class="text-[10px] text-slate-400 truncate">${safeGenre}</p>
            </div>
          </div>
          <div class="flex items-center justify-between text-[10px] text-slate-400">
            <span>🏷️ ${st.category || 'Música'}</span>
            <span class="font-mono text-cyan-400 font-bold">${st.bit_rate || 128} kbps</span>
          </div>
          <button onclick="selectStation('${st.id}', true)" class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs shadow-lg transition active:scale-95 flex items-center justify-center gap-1.5">
            <span>▶️</span> <span>Ouvir em Direto</span>
          </button>
        </div>
      `);

      return marker;
    }

    function addMarkerForStation(st) {
      if (!leafletMap || st.lat == null || st.lon == null) return null;

      const existing = mapMarkers.find(m => String(m.stationId) === String(st.id));
      if (existing) return existing;

      const marker = createMarkerObject(st);
      if (!marker) return null;

      if (mapClusterGroup) {
        mapClusterGroup.addLayer(marker);
      } else {
        marker.addTo(leafletMap);
      }

      mapMarkers.push(marker);
      return marker;
    }

    // Massive global radio discovery: streams thousands of stations across the globe in progressive chunks
    async function startMassiveRadioDiscovery() {
      if (hasStartedMassiveDiscovery) return;
      hasStartedMassiveDiscovery = true;

      const servers = [
        'https://de1.api.radio-browser.info',
        'https://nl1.api.radio-browser.info',
        'https://at1.api.radio-browser.info',
        'https://all.api.radio-browser.info'
      ];

      const batches = [
        { limit: 3500, offset: 0 },
        { limit: 4000, offset: 3500 },
        { limit: 4500, offset: 7500 },
        { limit: 3000, offset: 12000 }
      ];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        let success = false;

        for (const srv of servers) {
          try {
            const url = `${srv}/json/stations/search?has_geo_info=true&lastcheckok=1&hidebroken=true&limit=${batch.limit}&offset=${batch.offset}&order=clickcount&reverse=true`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6500);
            // Cache IndexedDB 24h: zoom repetido não volta a bater na API
            const list = await RocStorage.cachedFetchJson(url, RocStorage.DEFAULT_TTL_MS, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (Array.isArray(list) && list.length > 0) {
              processAndAddGeoStations(list);
              success = true;
              break;
            }
          } catch (err) {
            console.warn(`Server ${srv} error on batch ${i}:`, err.message);
          }
        }

        // Brief delay between batches to keep UI super smooth
        await new Promise(r => setTimeout(r, 400));
      }
    }

    function processAndAddGeoStations(list) {
      const newStations = [];
      const newMarkers = [];
      const seenIds = new Set(mapDiscoveredStations.map(s => String(s.id)));

      list.forEach((item, idx) => {
        const lat = parseFloat(item.geo_lat);
        const lon = parseFloat(item.geo_long);

        if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0 && (item.url_resolved || item.url)) {
          const sid = `geo_${item.stationuuid || item.changeuuid || (Date.now() + '_' + idx)}`;
          if (!seenIds.has(sid)) {
            seenIds.add(sid);
            const cat = getCategoryFromTags(item.tags || item.name || "");
            const flag = getFlagEmoji(item.countrycode || "");
            const safeCountry = item.country || (item.countrycode ? item.countrycode.toUpperCase() : "Global");

            const newSt = {
              id: sid,
              name: (item.name || 'Rádio Local').trim(),
              stream_url: item.url_resolved || item.url,
              category: cat,
              tags: item.tags || "",
              genre: item.tags ? item.tags.split(',').slice(0, 2).map(t => t.trim()).join(' / ') : cat,
              country: safeCountry,
              city: item.state || safeCountry,
              flag: flag,
              lat: lat,
              lon: lon,
              bit_rate: item.bitrate || 128,
              favorite: false,
              inLibrary: false,
              image: item.favicon && item.favicon.startsWith('http') ? item.favicon : null,
            favicon: item.favicon || null,
            homepage: item.homepage || null,
              favicon: item.favicon || null,
              homepage: item.homepage || null,
              color: getRandomGradient(item.stationuuid || String(idx)),
              desc: item.state ? `${item.state}, ${safeCountry}` : safeCountry
            };

            newStations.push(newSt);
            mapDiscoveredStations.push(newSt);

            const marker = createMarkerObject(newSt);
            if (marker) {
              mapMarkers.push(marker);
              newMarkers.push(marker);
            }
          }
        }
      });

      if (mapClusterGroup && newMarkers.length > 0) {
        mapClusterGroup.addLayers(newMarkers);
      }

      const totalMappable = getAllMappableStations();
      const totalCountEl = document.getElementById('map-total-count');
      if (totalCountEl) {
        totalCountEl.textContent = totalMappable.length.toLocaleString('pt-PT');
      }

      if (leafletMap) {
        populateMapPickerForBounds(leafletMap.getBounds(), leafletMap.getZoom());
      }
      scheduleMapStationsSave();
    }

    function onMapViewportChanged() {
      if (!leafletMap) return;

      clearTimeout(mapViewportTimer);
      mapViewportTimer = setTimeout(() => {
        const bounds = leafletMap.getBounds();
        const zoom = leafletMap.getZoom();

        // 1. Update station picker with radios inside current visible viewport
        populateMapPickerForBounds(bounds, zoom);

        // 2. If zoom >= 5, dynamically fetch any additional regional radios in this visible area
        if (zoom >= 5 && !isFetchingGeoRadios) {
          fetchDynamicGeoStations(bounds, zoom);
        }
      }, 300);
    }

    async function fetchDynamicGeoStations(bounds, zoom) {
      if (!bounds) return;
      isFetchingGeoRadios = true;

      const countEl = document.getElementById('map-visible-count');
      if (countEl) {
        countEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> A sintonizar rádios locais nesta área...`;
      }

      const center = bounds.getCenter();
      const lat = center.lat;
      const lon = center.lng;

      // Identify nearest major city or query OSM Nominatim reverse geocode
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.state || data.address.country;
            if (city) {
              const areaTitle = document.getElementById('map-area-title');
              if (areaTitle) areaTitle.textContent = `📍 ${city}, ${data.address.country || ''}`;
              await fetchCityAndStateRadios(city, lat, lon, data.address.country_code);
            }
          }
        }
      } catch (err) {
        console.warn('Reverse geocode error:', err);
      } finally {
        isFetchingGeoRadios = false;
      }
    }

    async function fetchCityAndStateRadios(cityName, centerLat, centerLon, countryCode) {
      if (!cityName) return;
      const cleanCity = cityName.trim();

      const servers = [
        'https://de1.api.radio-browser.info',
        'https://nl1.api.radio-browser.info',
        'https://all.api.radio-browser.info'
      ];

      const countEl = document.getElementById('map-visible-count');
      if (countEl) {
        countEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span> A carregar todas as rádios de ${cleanCity}...`;
      }

      try {
        const srv = servers[0];
        // Cache IndexedDB (24h) evita repetir pesquisas iguais ao navegar no mapa
        const [byState, byName, byTag] = await Promise.all([
          RocStorage.cachedFetchJson(`${srv}/json/stations/search?state=${encodeURIComponent(cleanCity)}&lastcheckok=1&hidebroken=true&limit=100&order=clickcount&reverse=true`).catch(() => []),
          RocStorage.cachedFetchJson(`${srv}/json/stations/search?name=${encodeURIComponent(cleanCity)}&lastcheckok=1&hidebroken=true&limit=100&order=clickcount&reverse=true`).catch(() => []),
          RocStorage.cachedFetchJson(`${srv}/json/stations/search?tag=${encodeURIComponent(cleanCity)}&lastcheckok=1&hidebroken=true&limit=100&order=clickcount&reverse=true`).catch(() => [])
        ]);

        const combined = [...byState, ...byName, ...byTag];
        const uniqueSet = new Set();
        const deduplicated = [];

        combined.forEach(item => {
          if (item && item.stationuuid && !uniqueSet.has(item.stationuuid)) {
            uniqueSet.add(item.stationuuid);
            deduplicated.push(item);
          }
        });

        if (deduplicated.length > 0) {
          processAndAddGeoStationsWithCenter(deduplicated, centerLat, centerLon, cleanCity);
          showToast(`${deduplicated.length} rádios descobertas em ${cleanCity}!`, '📻', 'success');
        }
      } catch (err) {
        console.warn('Error fetching city radios:', err);
      }
    }

    function processAndAddGeoStationsWithCenter(list, centerLat, centerLon, cityName) {
      const newStations = [];
      const newMarkers = [];
      const seenIds = new Set(mapDiscoveredStations.map(s => String(s.id)));

      list.forEach((item, idx) => {
        let lat = parseFloat(item.geo_lat);
        let lon = parseFloat(item.geo_long);

        // If coordinates missing or zero, distribute around city center in natural scatter radius
        if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0) || (centerLat && Math.abs(lat - centerLat) < 0.0001 && Math.abs(lon - centerLon) < 0.0001)) {
          if (centerLat != null && centerLon != null) {
            const idStr = item.stationuuid || item.name || String(idx);
            let hash = 0;
            for (let i = 0; i < idStr.length; i++) hash = ((hash << 5) - hash) + idStr.charCodeAt(i);
            const angle = (Math.abs(hash * (idx + 1)) % 360) * (Math.PI / 180);
            const radius = 0.012 + ((Math.abs(hash * 37) % 100) / 100) * 0.065; // ~1.2km to 7.5km
            lat = centerLat + (radius * Math.cos(angle));
            lon = centerLon + (radius * Math.sin(angle));
          }
        }

        if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0 && (item.url_resolved || item.url)) {
          const sid = `geo_${item.stationuuid || item.changeuuid || (Date.now() + '_' + idx)}`;
          if (!seenIds.has(sid)) {
            seenIds.add(sid);
            const cat = getCategoryFromTags(item.tags || item.name || "");
            const flag = getFlagEmoji(item.countrycode || "");
            const safeCountry = item.country || (item.countrycode ? item.countrycode.toUpperCase() : "Global");

            const newSt = {
              id: sid,
              name: (item.name || 'Rádio Local').trim(),
              stream_url: item.url_resolved || item.url,
              category: cat,
              tags: item.tags || "",
              genre: item.tags ? item.tags.split(',').slice(0, 2).map(t => t.trim()).join(' / ') : cat,
              country: safeCountry,
              city: item.state || cityName || safeCountry,
              flag: flag,
              lat: lat,
              lon: lon,
              bit_rate: item.bitrate || 128,
              favorite: false,
              inLibrary: false,
              image: item.favicon && item.favicon.startsWith('http') ? item.favicon : null,
            favicon: item.favicon || null,
            homepage: item.homepage || null,
              favicon: item.favicon || null,
              homepage: item.homepage || null,
              color: getRandomGradient(item.stationuuid || String(idx)),
              desc: item.state ? `${item.state}, ${safeCountry}` : safeCountry
            };

            newStations.push(newSt);
            mapDiscoveredStations.push(newSt);

            const marker = createMarkerObject(newSt);
            if (marker) {
              mapMarkers.push(marker);
              newMarkers.push(marker);
            }
          }
        }
      });

      if (mapClusterGroup && newMarkers.length > 0) {
        mapClusterGroup.addLayers(newMarkers);
      }

      const totalMappable = getAllMappableStations();
      const totalCountEl = document.getElementById('map-total-count');
      if (totalCountEl) {
        totalCountEl.textContent = totalMappable.length.toLocaleString('pt-PT');
      }

      if (leafletMap) {
        populateMapPickerForBounds(leafletMap.getBounds(), leafletMap.getZoom());
      }
      scheduleMapStationsSave();
    }

    function populateMapPickerForBounds(bounds, zoom) {
      const container = document.getElementById('map-stations-picker');
      const countEl = document.getElementById('map-visible-count');
      if (!container) return;

      const all = getAllMappableStations();
      const inViewport = all.filter(st => bounds.contains([st.lat, st.lon]));

      if (countEl) {
        countEl.textContent = `${inViewport.length} rádios visíveis nesta área (Zoom ${zoom})`;
      }

      if (inViewport.length === 0) {
        container.innerHTML = `
          <div class="col-span-full py-8 text-center space-y-2">
            <span class="text-3xl">🔍</span>
            <p class="text-xs text-slate-400">Nenhuma rádio localizada no enquadramento atual.</p>
            <p class="text-[11px] text-cyan-400 font-semibold">Faz zoom ou arrasta o mapa para explorar mais cidades e países!</p>
          </div>
        `;
        return;
      }

      container.innerHTML = inViewport.map(s => {
        const isCurrent = String(s.id) === String(currentStationId);
        const safeName = (s.name || 'Rádio').replace(/"/g, '&quot;');
        const safeCity = (s.city || s.country || 'Global').replace(/"/g, '&quot;');
        const safeGenre = (s.genre || s.category || 'Música').replace(/"/g, '&quot;');

        return `
          <div class="p-3 rounded-2xl bg-slate-950/80 border ${isCurrent ? 'border-cyan-400 shadow-md shadow-cyan-500/20' : 'border-slate-800 hover:border-slate-700'} flex flex-col justify-between gap-2.5 transition">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-2xl flex-shrink-0">${s.flag || '📻'}</span>
                <div class="min-w-0">
                  <h4 class="text-xs font-black text-white truncate ${isCurrent ? 'text-cyan-400' : ''}">${safeName}</h4>
                  <p class="text-[10px] text-cyan-400/90 font-semibold truncate">📍 ${safeCity}</p>
                </div>
              </div>
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 flex-shrink-0 border border-slate-700">
                ${s.bit_rate || 128}k
              </span>
            </div>

            <p class="text-[10px] text-slate-400 truncate">${safeGenre}</p>

            <button onclick="flyToStationOnMap('${s.id}')" class="w-full py-1.5 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 font-bold text-[11px] transition active:scale-95 flex items-center justify-center gap-1.5">
              <span>✈️</span> <span>Sintonizar & Voar</span>
            </button>
          </div>
        `;
      }).join('');
    }

    function filterMapPickerList(filterText) {
      const container = document.getElementById('map-stations-picker');
      const countEl = document.getElementById('map-visible-count');
      if (!container) return;

      const all = getAllMappableStations();
      const bounds = leafletMap ? leafletMap.getBounds() : null;
      const inViewport = bounds ? all.filter(st => bounds.contains([st.lat, st.lon])) : all;

      const query = (filterText || '').trim().toLowerCase();
      const filtered = query
        ? inViewport.filter(s => 
            (s.name && s.name.toLowerCase().includes(query)) ||
            (s.city && s.city.toLowerCase().includes(query)) ||
            (s.country && s.country.toLowerCase().includes(query)) ||
            (s.genre && s.genre.toLowerCase().includes(query)) ||
            (s.category && s.category.toLowerCase().includes(query))
          )
        : inViewport;

      if (countEl) {
        countEl.textContent = `${filtered.length} rádios filtradas nesta área`;
      }

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="col-span-full py-8 text-center space-y-2">
            <span class="text-3xl">🔍</span>
            <p class="text-xs text-slate-400">Nenhuma rádio encontrada para "${filterText}".</p>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(s => {
        const isCurrent = String(s.id) === String(currentStationId);
        const safeName = (s.name || 'Rádio').replace(/"/g, '&quot;');
        const safeCity = (s.city || s.country || 'Global').replace(/"/g, '&quot;');
        const safeGenre = (s.genre || s.category || 'Música').replace(/"/g, '&quot;');

        return `
          <div class="p-3 rounded-2xl bg-slate-950/80 border ${isCurrent ? 'border-cyan-400 shadow-md shadow-cyan-500/20' : 'border-slate-800 hover:border-slate-700'} flex flex-col justify-between gap-2.5 transition">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-2xl flex-shrink-0">${s.flag || '📻'}</span>
                <div class="min-w-0">
                  <h4 class="text-xs font-black text-white truncate ${isCurrent ? 'text-cyan-400' : ''}">${safeName}</h4>
                  <p class="text-[10px] text-cyan-400/90 font-semibold truncate">📍 ${safeCity}</p>
                </div>
              </div>
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 flex-shrink-0 border border-slate-700">
                ${s.bit_rate || 128}k
              </span>
            </div>

            <p class="text-[10px] text-slate-400 truncate">${safeGenre}</p>

            <button onclick="flyToStationOnMap('${s.id}')" class="w-full py-1.5 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 font-bold text-[11px] transition active:scale-95 flex items-center justify-center gap-1.5">
              <span>✈️</span> <span>Sintonizar & Voar</span>
            </button>
          </div>
        `;
      }).join('');
    }

    async function searchCityOnMap(query) {
      if (!query || !query.trim()) return;
      const q = query.trim();
      const searchInput = document.getElementById('map-city-search-input');
      if (searchInput) searchInput.blur();

      showToast(`A pesquisar "${q}" no mapa mundial...`, '🔍', 'info');

      const knownPlaces = {
        'lisboa': [38.7223, -9.1393, 11, '🇵🇹 Lisboa, Portugal', 'Lisboa'],
        'porto': [41.1579, -8.6291, 11, '🇵🇹 Porto, Portugal', 'Porto'],
        'madrid': [40.4168, -3.7038, 11, '🇪🇸 Madrid, Espanha', 'Madrid'],
        'barcelona': [41.3851, 2.1734, 11, '🇪🇸 Barcelona, Espanha', 'Barcelona'],
        'paris': [48.8566, 2.3522, 11, '🇫🇷 Paris, França', 'Paris'],
        'londres': [51.5074, -0.1278, 11, '🇬🇧 Londres, Reino Unido', 'London'],
        'london': [51.5074, -0.1278, 11, '🇬🇧 London, UK', 'London'],
        'roma': [41.9028, 12.4964, 11, '🇮🇹 Roma, Itália', 'Roma'],
        'rome': [41.9028, 12.4964, 11, '🇮🇹 Roma, Itália', 'Rome'],
        'berlim': [52.5200, 13.4050, 11, '🇩🇪 Berlim, Alemanha', 'Berlin'],
        'berlin': [52.5200, 13.4050, 11, '🇩🇪 Berlim, Alemanha', 'Berlin'],
        'são paulo': [-23.5505, -46.6333, 11, '🇧🇷 São Paulo, Brasil', 'São Paulo'],
        'sao paulo': [-23.5505, -46.6333, 11, '🇧🇷 São Paulo, Brasil', 'São Paulo'],
        'rio de janeiro': [-22.9068, -43.1729, 11, '🇧🇷 Rio de Janeiro, Brasil', 'Rio de Janeiro'],
        'rio': [-22.9068, -43.1729, 11, '🇧🇷 Rio de Janeiro, Brasil', 'Rio de Janeiro'],
        'belo horizonte': [-19.9167, -43.9345, 11, '🇧🇷 Belo Horizonte, Brasil', 'Minas Gerais'],
        'brasilia': [-15.7975, -47.8919, 11, '🇧🇷 Brasília, Brasil', 'Distrito Federal'],
        'salvador': [-12.9777, -38.5016, 11, '🇧🇷 Salvador, Brasil', 'Bahia'],
        'porto alegre': [-30.0346, -51.2177, 11, '🇧🇷 Porto Alegre, Brasil', 'Rio Grande do Sul'],
        'buenos aires': [-34.6037, -58.3816, 11, '🇦🇷 Buenos Aires, Argentina', 'Buenos Aires'],
        'bogotá': [4.7110, -74.0721, 11, '🇨🇴 Bogotá, Colômbia', 'Bogotá'],
        'bogota': [4.7110, -74.0721, 11, '🇨🇴 Bogotá, Colômbia', 'Bogotá'],
        'santiago': [-33.4489, -70.6693, 11, '🇨🇱 Santiago, Chile', 'Santiago'],
        'lima': [-12.0464, -77.0428, 11, '🇵🇪 Lima, Peru', 'Lima'],
        'cidade do méxico': [19.4326, -99.1332, 11, '🇲🇽 Cidade do México, México', 'Mexico City'],
        'mexico': [19.4326, -99.1332, 7, '🇲🇽 México', 'Mexico'],
        'nova iorque': [40.7128, -74.0060, 11, '🇺🇸 Nova Iorque, EUA', 'New York'],
        'new york': [40.7128, -74.0060, 11, '🇺🇸 New York, USA', 'New York'],
        'los angeles': [34.0522, -118.2437, 11, '🇺🇸 Los Angeles, EUA', 'Los Angeles'],
        'miami': [25.7617, -80.1918, 11, '🇺🇸 Miami, EUA', 'Miami'],
        'toquio': [35.6762, 139.6503, 11, '🇯🇵 Tóquio, Japão', 'Tokyo'],
        'tokyo': [35.6762, 139.6503, 11, '🇯🇵 Tokyo, Japan', 'Tokyo'],
        'luanda': [-8.8390, 13.2894, 11, '🇦🇴 Luanda, Angola', 'Luanda'],
        'maputo': [-25.9692, 32.5732, 11, '🇲🇿 Maputo, Moçambique', 'Maputo'],
        'praia': [14.9330, -23.5133, 11, '🇨🇻 Praia, Cabo Verde', 'Praia'],
        'sydney': [-33.8688, 151.2093, 11, '🇦🇺 Sydney, Austrália', 'Sydney'],
        'brasil': [-14.2350, -51.9253, 5, '🇧🇷 Brasil', 'Brazil'],
        'portugal': [39.3999, -8.2245, 7, '🇵🇹 Portugal', 'Portugal'],
        'espanha': [40.4637, -3.7492, 6, '🇪🇸 Espanha', 'Spain'],
        'spain': [40.4637, -3.7492, 6, '🇪🇸 Espanha', 'Spain'],
        'angola': [-11.2027, 17.8739, 6, '🇦🇴 Angola', 'Angola'],
        'argentina': [-38.4161, -63.6167, 5, '🇦🇷 Argentina', 'Argentina'],
        'colombia': [4.5709, -74.2973, 6, '🇨🇴 Colômbia', 'Colombia'],
        'chile': [-35.6751, -71.5430, 5, '🇨🇱 Chile', 'Chile'],
      };

      const key = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      for (const [k, v] of Object.entries(knownPlaces)) {
        const normK = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normK === key || normK.includes(key) || key.includes(normK)) {
          if (leafletMap) {
            leafletMap.flyTo([v[0], v[1]], v[2], { duration: 1.5 });
            const areaTitle = document.getElementById('map-area-title');
            if (areaTitle) areaTitle.textContent = v[3];
            showToast(`A voar para ${v[3]}!`, '✈️', 'success');
            fetchCityAndStateRadios(v[4] || k, v[0], v[1]);
          }
          return;
        }
      }

      // Query OpenStreetMap Nominatim for any location
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const item = data[0];
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            if (!isNaN(lat) && !isNaN(lon) && leafletMap) {
              leafletMap.flyTo([lat, lon], 10, { duration: 1.5 });
              const areaTitle = document.getElementById('map-area-title');
              const cityName = item.display_name.split(',')[0];
              if (areaTitle) areaTitle.textContent = item.display_name.split(',').slice(0, 2).join(',');
              showToast(`A voar para ${cityName}!`, '✈️', 'success');
              fetchCityAndStateRadios(cityName, lat, lon);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Geocoding search failed:', err);
      }

      showToast(`Local "${q}" não encontrado. Tenta outra cidade.`, '⚠️', 'info');
    }

    function locateUserGPSOnMap() {
      if (!navigator.geolocation) {
        showToast('Geolocalização não é suportada pelo teu navegador.', '⚠️', 'info');
        return;
      }

      showToast('A obter a tua localização GPS...', '🎯', 'info');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          if (leafletMap) {
            leafletMap.flyTo([lat, lon], 10, { duration: 1.5 });
            const areaTitle = document.getElementById('map-area-title');
            if (areaTitle) areaTitle.textContent = '📍 A Tua Localização Atual';
            showToast('Localização GPS detetada com sucesso!', '🎯', 'success');
          }
        },
        (err) => {
          console.warn('GPS error:', err);
          showToast('Permissão de GPS recusada ou indisponível.', '⚠️', 'info');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    function filterMapByRegion(region) {
      currentMapRegion = region;

      // Update filter buttons styling
      document.querySelectorAll('.map-reg-btn').forEach(b => {
        b.className = 'map-reg-btn px-3.5 py-2 rounded-2xl font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex-shrink-0 transition';
      });
      const activeBtn = document.getElementById(`map-reg-${region}`);
      if (activeBtn) {
        activeBtn.className = 'map-reg-btn px-3.5 py-2 rounded-2xl font-bold bg-cyan-500 text-slate-950 flex-shrink-0 shadow-lg shadow-cyan-500/20 transition';
      }

      // Region Viewports
      const regionCoords = {
        'all': { center: [20, 0], zoom: 2 },
        'Portugal': { center: [39.5, -8.0], zoom: 7 },
        'Espanha': { center: [40.4, -3.7], zoom: 6 },
        'Europa': { center: [49.0, 10.0], zoom: 4 },
        'Reino Unido': { center: [54.0, -2.5], zoom: 6 },
        'Brasil': { center: [-15.0, -51.0], zoom: 4 },
        'Estados Unidos': { center: [38.5, -96.5], zoom: 4 },
        'América Latina': { center: [-12.0, -65.0], zoom: 3 },
        'Ásia': { center: [28.0, 95.0], zoom: 3 },
        'África': { center: [2.0, 20.0], zoom: 3 },
        'Oceania': { center: [-28.0, 140.0], zoom: 4 }
      };

      if (leafletMap && regionCoords[region]) {
        const view = regionCoords[region];
        leafletMap.flyTo(view.center, view.zoom, { duration: 1.2 });
      }
    }

    function flyToStationOnMap(stationId) {
      const all = getAllMappableStations();
      const station = all.find(s => String(s.id) === String(stationId));
      if (!station) return;

      // Start unique audio playback
      selectStation(stationId, true);

      if (station.lat != null && station.lon != null && leafletMap) {
        leafletMap.flyTo([station.lat, station.lon], 9, {
          duration: 1.4,
          easeLinearity: 0.25
        });

        // Open popup
        setTimeout(() => {
          let marker = mapMarkers.find(m => String(m.stationId) === String(stationId));
          if (!marker) {
            marker = addMarkerForStation(station);
          }
          if (marker) {
            marker.openPopup();
          }
        }, 1450);

        showToast(`A voar no mapa para ${station.city || station.country}: ${station.name}!`, station.flag || '✈️', 'success');

        // Scroll to map if user is further down on mobile
        const mapEl = document.getElementById('world-map');
        if (mapEl && window.innerWidth < 768) {
          mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        showToast(`A tocar ${station.name}`, '📻', 'info');
      }
    }

    function zoomMapToFit() {
      if (leafletMap) {
        leafletMap.flyTo([20, 0], 2, { duration: 1.2 });
      }
      filterMapByRegion('all');
    }

    function selectCategory(cat) {
      selectedCategory = cat;
      currentView = 'home';
      renderCategories();
      setView('home');
      if (cat !== 'all') {
        updateExplainerBanner('🏷️', `Género: ${cat}`, `Estações classificadas no género musical ou tema "${cat}".`);
      }
      render();
    }

    function selectCountry(country) {
      selectedCountry = country;
      document.querySelectorAll('.country-btn').forEach(b => {
        b.className = 'country-btn px-4 py-2 rounded-xl font-medium bg-slate-900 border border-slate-800 hover:text-white flex-shrink-0 transition';
      });
      const activeBtn = document.getElementById(`country-${country}`);
      if (activeBtn) {
        activeBtn.className = 'country-btn px-4 py-2 rounded-xl font-bold bg-cyan-500 text-slate-950 flex-shrink-0 transition';
      }
      render();
    }

    function toggleAdvancedFilters() {
      const p = document.getElementById('advanced-filters-panel');
      p.classList.toggle('hidden');
    }

    function resetAdvancedFilters() {
      document.getElementById('adv-country').value = '';
      document.getElementById('adv-city').value = '';
      document.getElementById('adv-genre').value = '';
      document.getElementById('adv-only-hd').checked = false;
      document.getElementById('adv-only-logos').checked = true;
      document.getElementById('adv-sort').value = 'clickcount';
      clearSearch();
    }

    function applyAdvancedDiscoverySearch() {
      const country = document.getElementById('adv-country').value.trim();
      const city = document.getElementById('adv-city').value.trim();
      const genre = document.getElementById('adv-genre').value.trim();
      const sort = document.getElementById('adv-sort').value;
      const onlyHD = document.getElementById('adv-only-hd').checked;
      const onlyLogos = document.getElementById('adv-only-logos').checked;

      executeAdvancedDiscoverySearch({ country, city, genre, sort, onlyHD, onlyLogos });
    }

    async function executeAdvancedDiscoverySearch({ country, city, genre, sort, onlyHD, onlyLogos }) {
      const spinner = document.getElementById('search-spinner');
      const statusBanner = document.getElementById('search-status');
      const statusText = document.getElementById('search-status-text');
      const statusIcon = document.getElementById('search-status-icon');

      spinner.classList.remove('hidden');
      statusBanner.classList.remove('hidden');
      statusIcon.textContent = "🔍";
      statusText.textContent = `A pesquisar com filtros avançados no catálogo global...`;
      showGridSkeletons(8);

      let url = `https://de1.api.radio-browser.info/json/stations/search?limit=80&order=${sort}&reverse=true&hidebroken=true&lastcheckok=1`;
      if (country) url += `&country=${encodeURIComponent(country)}`;
      if (city) url += `&state=${encodeURIComponent(city)}`;
      if (genre) url += `&tag=${encodeURIComponent(genre)}`;

      try {
        const rawData = await RocStorage.cachedFetchJson(url);
        {
          let filtered = Array.isArray(rawData) ? rawData : [];

          if (onlyHD) {
            filtered = filtered.filter(item => (item.bitrate || 0) >= 128);
          }
          if (onlyLogos) {
            filtered = filtered.filter(item => item.favicon && item.favicon.startsWith('http'));
          }

          apiSearchResults = filtered.map((item, idx) => {
            const cat = getCategoryFromTags(item.tags || item.name || "");
            const flag = getFlagEmoji(item.countrycode || "");
            const safeCountry = item.country || (item.countrycode ? item.countrycode.toUpperCase() : "Global");
            return {
              id: `rb_${item.stationuuid || idx}`,
              name: (item.name || 'Rádio Sem Nome').trim(),
              stream_url: item.url_resolved || item.url,
              category: cat,
              tags: item.tags || "",
              genre: item.tags ? item.tags.split(',').slice(0, 2).map(t => t.trim()).join(' / ') : cat,
              country: safeCountry,
              flag: flag,
              lat: item.geo_lat || null,
              lon: item.geo_long || null,
              bit_rate: item.bitrate || 128,
              favorite: false,
              inLibrary: false,
              image: item.favicon && item.favicon.startsWith('http') ? item.favicon : null,
            favicon: item.favicon || null,
            homepage: item.homepage || null,
              favicon: item.favicon || null,
              homepage: item.homepage || null,
              color: getRandomGradient(item.stationuuid || String(idx)),
              desc: item.state ? `${item.state}, ${safeCountry}` : safeCountry
            };
          });

          statusIcon.textContent = "✅";
          statusText.textContent = `Encontradas ${apiSearchResults.length} rádios com os filtros aplicados.`;
        }
      } catch (err) {
        statusIcon.textContent = "⚠️";
        statusText.textContent = "Erro na pesquisa externa. A exibir catálogo local.";
      } finally {
        spinner.classList.add('hidden');
        render();
      }
    }

    function getFilteredStations() {
      let list = getAllStations();

      if (currentView === 'favorites') {
        list = list.filter(s => userFavorites.includes(String(s.id)));
      } else if (currentView === 'library') {
        list = list.filter(s => userLibrary.includes(String(s.id)));
      } else if (currentView === 'recents') {
        list = recentIds.map(id => list.find(s => String(s.id) === String(id))).filter(Boolean);
      }

      if (searchQuery.trim() === '') {
        if (selectedCategory !== 'Todas') {
          list = list.filter(s => s.category === selectedCategory);
        }
        if (selectedCountry !== 'Todos') {
          list = list.filter(s => s.country && s.country.toLowerCase() === selectedCountry.toLowerCase());
        }
      } else {
        const q = searchQuery.toLowerCase().replace(/[\s-_]+/g, '');
        list = list.filter(s => {
          const nameNorm = (s.name || '').toLowerCase().replace(/[\s-_]+/g, '');
          const genreNorm = (s.genre || '').toLowerCase().replace(/[\s-_]+/g, '');
          const countryNorm = (s.country || '').toLowerCase().replace(/[\s-_]+/g, '');
          const tagsNorm = (s.tags || '').toLowerCase().replace(/[\s-_]+/g, '');
          
          return nameNorm.includes(q) || genreNorm.includes(q) || countryNorm.includes(q) || tagsNorm.includes(q) || 
                 (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase()));
        });
      }

      return list;
    }

    // Paginação da grelha: mantém o render instantâneo mesmo com milhares
    // de estações descobertas no mapa carregadas em memória.
    const GRID_PAGE_SIZE = 120;
    let gridRenderLimit = GRID_PAGE_SIZE;
    let lastGridSig = '';

    /** Cartões-skeleton com shimmer enquanto uma pesquisa decorre. */
    function showGridSkeletons(n) {
      const grid = document.getElementById('stations-grid');
      if (!grid) return;
      const empty = document.getElementById('empty-state');
      if (empty) empty.classList.add('hidden');
      grid.innerHTML = Array.from({ length: n }, () => `
        <div class="station-card rounded-2xl p-4 border border-slate-800 bg-slate-900 animate-pulse">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="w-14 h-14 rounded-2xl bg-slate-800"></div>
            <div class="flex-1 space-y-2 pt-1">
              <div class="h-2.5 bg-slate-800 rounded-lg w-3/4"></div>
              <div class="h-2 bg-slate-800 rounded-lg w-1/2"></div>
            </div>
          </div>
          <div class="mt-3 pt-2.5 border-t border-slate-800/50 flex items-center justify-between">
            <div class="h-2 bg-slate-800 rounded-lg w-16"></div>
            <div class="h-2 bg-slate-800 rounded-lg w-10"></div>
          </div>
        </div>
      `).join('');
    }

    function render() {
      const grid = document.getElementById('stations-grid');
      const empty = document.getElementById('empty-state');
      const count = document.getElementById('results-count');
      const list = getFilteredStations();

      // Paginação da grelha: com milhares de estações descobertas no mapa,
      // renderizar tudo de uma vez congelava a UI. Renderizamos por páginas.
      const gridSig = `${currentView}|${selectedCategory}|${selectedCountry}|${searchQuery}`;
      if (gridSig !== lastGridSig) {
        lastGridSig = gridSig;
        gridRenderLimit = GRID_PAGE_SIZE;
      }
      const visibleList = list.slice(0, gridRenderLimit);

      count.textContent = `${list.length} estações disponíveis`;

      if (list.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
      } else {
        empty.classList.add('hidden');
        grid.innerHTML = visibleList.map(s => {
          const isCurrent = String(s.id) === String(currentStationId);
          const isFav = userFavorites.includes(String(s.id));
          const isInLib = userLibrary.includes(String(s.id));
          const safeName = (s.name || 'Rádio').replace(/"/g, '&quot;');
          const safeGenre = (s.genre || s.desc || 'Música & Rádio').replace(/"/g, '&quot;');
          const safeCountry = (s.country || 'Mundo').replace(/"/g, '&quot;');
          const isUnhealthy = unhealthyStationIds.has(String(s.id));

          return `
            <div
              draggable="true"
              ondragstart="handleDragStart(event, '${s.id}')"
              ondragend="handleDragEnd(event)"
              onclick="selectStation('${s.id}', true)"
              class="station-card group cursor-pointer rounded-2xl p-4 border flex flex-col justify-between select-none ${isCurrent ? 'bg-cyan-500/15 border-cyan-500/60 shadow-xl shadow-cyan-500/15' : 'bg-slate-900 border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800/80'}"
            >

              <!-- Cover Header -->
              <div class="flex items-start justify-between gap-3 mb-3">
                <div class="w-14 h-14 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition shadow-md relative">
                  ${s.image ? `<img src="${s.image}" data-roc-station="${s.id}" alt="${safeName}" loading="lazy" decoding="async" class="w-full h-full object-cover" onerror="rocCardLogoFallback(this)" />` : `<img src="${stationMonogram(s)}" alt="${safeName}" loading="lazy" decoding="async" class="w-full h-full object-cover" />`}
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    ${s.flag || '🌐'} ${safeCountry}
                  </span>
                  ${isUnhealthy ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30" title="Stream em falha na última verificação automática">⚠</span>` : ''}
                  <button onclick="handleCardCategoryClick('${s.id}', event)" class="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition text-sm active:scale-90" title="Mover para Categoria">
                    🏷️
                  </button>
                  <button onclick="handleCardLibraryClick('${s.id}', event)" class="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition text-sm active:scale-90" title="${isInLib ? 'Remover da Biblioteca' : 'Incluir na Biblioteca'}">
                    ${isInLib ? '📌' : '➕'}
                  </button>
                  <button onclick="handleCardFavClick('${s.id}', event)" class="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition text-sm active:scale-90" title="Favorito">
                    ${isFav ? '⭐' : '☆'}
                  </button>
                  <button onclick="handleCardDeleteClick('${s.id}', event)" class="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition text-sm active:scale-90" title="Eliminar / Remover Rádio">
                    🗑️
                  </button>
                </div>
              </div>

              <!-- Info -->
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-extrabold text-white truncate ${isCurrent ? 'text-cyan-400' : ''}">
                    ${safeName}
                  </h3>
                  ${isCurrent && isPlaying ? '<span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping flex-shrink-0"></span>' : ''}
                </div>
                <p class="text-xs text-slate-400 truncate mt-0.5">${safeGenre}</p>
              </div>

              <!-- Footer info with Category Tag -->
              <div class="mt-3 pt-2.5 border-t border-slate-800/50 flex items-center justify-between text-[11px] text-slate-500">
                <span class="px-2 py-0.5 rounded-lg bg-slate-950 text-cyan-400 border border-slate-800/80 font-semibold flex items-center gap-1">
                  <span class="text-xs">🏷️</span> <span class="truncate max-w-[90px]">${s.category || 'Música'}</span>
                </span>
                <span class="font-mono text-cyan-400 font-bold">${s.bit_rate || 128} kbps</span>
              </div>
            </div>
          `;
        }).join('');

        // Botão "Ver mais": as restantes da lista só entram a pedido,
        // mantendo o render sempre instantâneo.
        if (list.length > visibleList.length) {
          const moreBtn = document.createElement('button');
          moreBtn.className = 'col-span-full py-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800 text-cyan-400 text-xs font-bold transition';
          moreBtn.textContent = `⬇️ Ver mais — ${visibleList.length} de ${list.length} estações`;
          moreBtn.onclick = () => {
            gridRenderLimit += GRID_PAGE_SIZE;
            render();
            moreBtn.scrollIntoView({ block: 'center' });
          };
          grid.appendChild(moreBtn);
        }
      }

      renderRocPreview();
    }

    function renderRocPreview() {
      const curr = getCurrentStation();
      const code = 
`# --- Estado Funcional em Roc (Radio.roc) ---

current_playback : PlaybackState
current_playback = {
    current_station_id: "${curr.id}",
    is_playing: Bool.${isPlaying ? 'True' : 'False'},
    volume: ${volume},
    is_muted: Bool.${isMuted ? 'True' : 'False'},
    sleep_timer: {
        seconds_left: ${sleepSecondsLeft},
        is_active: Bool.${sleepSecondsLeft > 0 ? 'True' : 'False'},
    },
    alarm: {
        hour: ${parseInt(alarmSettings.time.split(':')[0], 10)},
        minute: ${parseInt(alarmSettings.time.split(':')[1], 10)},
        station_id: "${alarmSettings.stationId}",
        is_enabled: Bool.${alarmSettings.enabled ? 'True' : 'False'},
    },
}

active_stations : StationList
active_stations = [
` + getFilteredStations().slice(0, 5).map(s => `    { id: "${s.id}", name: "${(s.name || '').replace(/"/g, '')}", country: "${s.country || 'Global'}", genre: "${(s.genre || '').replace(/"/g, '')}", favorite: Bool.${userFavorites.includes(String(s.id)) ? 'True' : 'False'}, in_library: Bool.${userLibrary.includes(String(s.id)) ? 'True' : 'False'} }`).join(',\n') +
`
]`;
      document.getElementById('roc-preview').textContent = code;
    }

    function copyRocState() {
      navigator.clipboard.writeText(document.getElementById('roc-preview').textContent);
      alert('Estrutura de dados Roc copiada!');
    }

    // Direct Global Search with multi-server discovery
    async function executeGlobalSearch(term) {
      const trimmed = (term || '').trim();
      if (trimmed.length < 2) {
        apiSearchResults = [];
        hideSearchStatus();
        render();
        return;
      }

      const spinner = document.getElementById('search-spinner');
      const statusBanner = document.getElementById('search-status');
      const statusText = document.getElementById('search-status-text');
      const statusIcon = document.getElementById('search-status-icon');
      
      spinner.classList.remove('hidden');
      statusBanner.classList.remove('hidden');
      statusIcon.textContent = "🔍";
      statusText.textContent = `A pesquisar em +45.000 rádios mundiais por "${trimmed}"...`;
      showGridSkeletons(8);

      const servers = [
        'https://de1.api.radio-browser.info',
        'https://all.api.radio-browser.info'
      ];

      let rawData = [];
      for (const server of servers) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4500);

          const nameUrl = `${server}/json/stations/search?name=${encodeURIComponent(trimmed)}&limit=60&order=clickcount&reverse=true&hidebroken=true&lastcheckok=1`;
          const data = await RocStorage.cachedFetchJson(nameUrl, RocStorage.DEFAULT_TTL_MS, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (Array.isArray(data) && data.length > 0) {
            rawData = data;
            break;
          }
        } catch (err) {
          console.warn(`Tentativa em ${server} falhou:`, err);
        }
      }

      if (rawData.length < 10) {
        try {
          const tagUrl = `https://de1.api.radio-browser.info/json/stations/search?tag=${encodeURIComponent(trimmed)}&limit=30&order=clickcount&reverse=true&hidebroken=true&lastcheckok=1`;
          const tagRes = await fetch(tagUrl);
          if (tagRes.ok) {
            const tagData = await tagRes.json();
            if (Array.isArray(tagData)) {
              const existingUuids = new Set(rawData.map(x => x.stationuuid));
              tagData.forEach(item => {
                if (!existingUuids.has(item.stationuuid)) {
                  rawData.push(item);
                }
              });
            }
          }
        } catch (e) {}
      }

      if (rawData && rawData.length > 0) {
        apiSearchResults = rawData.map((item, idx) => {
          const cat = getCategoryFromTags(item.tags || item.name || "");
          const flag = getFlagEmoji(item.countrycode || "");
          const safeCountry = item.country || (item.countrycode ? item.countrycode.toUpperCase() : "Global");
          return {
            id: `rb_${item.stationuuid || idx}`,
            name: (item.name || 'Rádio Sem Nome').trim(),
            stream_url: item.url_resolved || item.url,
            category: cat,
            tags: item.tags || "",
            genre: item.tags ? item.tags.split(',').slice(0, 2).map(t => t.trim()).join(' / ') : cat,
            country: safeCountry,
            flag: flag,
            lat: item.geo_lat || null,
            lon: item.geo_long || null,
            bit_rate: item.bitrate || 128,
            favorite: false,
            inLibrary: false,
            image: item.favicon && item.favicon.startsWith('http') ? item.favicon : null,
            favicon: item.favicon || null,
            homepage: item.homepage || null,
            color: getRandomGradient(item.stationuuid || String(idx)),
            desc: item.state ? `${item.state}, ${safeCountry}` : safeCountry
          };
        });

        statusIcon.textContent = "✅";
        statusText.textContent = `Encontradas ${apiSearchResults.length} rádios globais para "${trimmed}"`;
      } else {
        apiSearchResults = [];
        statusIcon.textContent = "ℹ️";
        statusText.textContent = `Nenhum resultado externo encontrado para "${trimmed}". A mostrar catálogo local.`;
      }

      spinner.classList.add('hidden');
      render();
    }

    async function loadTopWorldStations() {
      setView('topworld');
      const spinner = document.getElementById('search-spinner');
      const statusBanner = document.getElementById('search-status');
      const statusText = document.getElementById('search-status-text');
      const statusIcon = document.getElementById('search-status-icon');

      spinner.classList.remove('hidden');
      statusBanner.classList.remove('hidden');
      statusIcon.textContent = "🌍";
      statusText.textContent = "A carregar as 50 rádios mais ouvidas no mundo...";

      try {
        const data = await RocStorage.cachedFetchJson('https://de1.api.radio-browser.info/json/stations/topclick/50');
        if (data && data.length > 0) {
          apiSearchResults = data.map((item, idx) => ({
            id: `top_${item.stationuuid || idx}`,
            name: item.name.trim(),
            stream_url: item.url_resolved || item.url,
            category: getCategoryFromTags(item.tags || ""),
            tags: item.tags || "",
            genre: item.tags ? item.tags.split(',').slice(0, 2).join(' / ') : "Top Mundial",
            country: item.country || "Mundo",
            flag: getFlagEmoji(item.countrycode || ""),
            bit_rate: item.bitrate || 128,
            favorite: false,
            inLibrary: false,
            image: item.favicon && item.favicon.startsWith('http') ? item.favicon : null,
            favicon: item.favicon || null,
            homepage: item.homepage || null,
            color: "from-purple-600 to-indigo-700",
            desc: `Top #${idx+1} Mundial (${item.clickcount || 0} cliques)`
          }));
          statusIcon.textContent = "✅";
          statusText.textContent = "50 Rádios Mundiais mais populares carregadas!";
        }
      } catch (e) {
        statusIcon.textContent = "ℹ️";
        statusText.textContent = "A exibir catálogo principal.";
      } finally {
        spinner.classList.add('hidden');
        render();
      }
    }

    function getCategoryFromTags(tags) {
      const t = (tags || '').toLowerCase();
      if (t.includes('news') || t.includes('noticias') || t.includes('notícia') || t.includes('talk') || t.includes('info')) return 'Notícias';
      if (t.includes('sport') || t.includes('football') || t.includes('futebol') || t.includes('esporte')) return 'Desporto';
      if (t.includes('rock') || t.includes('metal') || t.includes('classic rock') || t.includes('indie')) return 'Rock';
      if (t.includes('electro') || t.includes('dance') || t.includes('house') || t.includes('techno') || t.includes('edm') || t.includes('club')) return 'Eletrónica';
      if (t.includes('chill') || t.includes('lofi') || t.includes('jazz') || t.includes('relax') || t.includes('ambient') || t.includes('bossa')) return 'Relax';
      return 'Música';
    }

    function getFlagEmoji(countryCode) {
      if (!countryCode || countryCode.length !== 2) return '🌐';
      const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    }

    function getRandomGradient(seed) {
      const gradients = [
        'from-cyan-600 to-blue-700',
        'from-purple-600 to-pink-600',
        'from-emerald-600 to-teal-700',
        'from-amber-500 to-rose-600',
        'from-blue-600 to-indigo-800',
        'from-red-600 to-amber-700'
      ];
      let hash = 0;
      for (let i = 0; i < (seed || '').length; i++) {
        hash = (hash + seed.charCodeAt(i)) % gradients.length;
      }
      return gradients[hash] || gradients[0];
    }

    function triggerGlobalSearch() {
      const q = document.getElementById('search-input').value.trim();
      executeGlobalSearch(q);
    }

    function quickSearch(term) {
      document.getElementById('search-input').value = term;
      searchQuery = term;
      render();
      executeGlobalSearch(term);
    }

    function clearSearch() {
      document.getElementById('search-input').value = '';
      searchQuery = '';
      apiSearchResults = [];
      hideSearchStatus();
      render();
    }

    function hideSearchStatus() {
      document.getElementById('search-status').classList.add('hidden');
    }

    document.getElementById('search-input').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();

      clearTimeout(searchTimer);
      if (searchQuery.trim().length >= 2) {
        searchTimer = setTimeout(() => {
          executeGlobalSearch(searchQuery.trim());
        }, 250);
      } else {
        apiSearchResults = [];
        hideSearchStatus();
      }
    });

    document.getElementById('search-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimer);
        executeGlobalSearch(searchQuery.trim());
      }
    });

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
      select.innerHTML = all.map(s => `<option value="${s.id}" ${s.id === alarmSettings.stationId ? 'selected' : ''}>${s.name} (${s.country || 'Global'})</option>`).join('');
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
    initAlarmChecker();

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
      select.innerHTML = all.map(s => `<option value="${s.id}" ${s.id === dvrSettings.stationId ? 'selected' : ''}>${s.name} (${s.country || 'Global'})</option>`).join('');
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
    initDVRChecker();

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
        container.innerHTML = `<p class="text-xs text-slate-500 py-4 text-center">Nenhuma música no histórico ainda.</p>`;
        return;
      }
      container.innerHTML = trackHistory.map(item => `
        <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
          <div class="min-w-0 flex-1 pr-2">
            <h5 class="font-bold text-white truncate">${item.title}</h5>
            <p class="text-[10px] text-slate-400">${item.artist} • ${item.time}</p>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button onclick="window.open('https://open.spotify.com/search/${encodeURIComponent(item.title)}', '_blank')" class="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 text-[10px] font-bold">
              Spotify
            </button>
            <button onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(item.title)}', '_blank')" class="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[10px] font-bold">
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
          alert('Aviso: O navegador restringe a gravação direta de áudio CORS desta rádio específica.');
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
          document.getElementById('record-btn').title = `A gravar: ${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }, 1000);
      } catch (err) {
        alert('Gravação não suportada neste stream pelo navegador.');
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
        alert(`Link de partilha copiado para a estação: ${curr.name}`);
      });
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
          alert('Backup restaurado com sucesso!');
        } catch (err) {
          alert('Ficheiro JSON inválido.');
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
        catSelect.innerHTML = userCategories.filter(c => c.id !== 'Todas').map(c => `<option value="${c.id}">${c.name}</option>`).join('');
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
          showToast(`Rádio descoberta pelo link do site${found.name ? `: ${found.name}` : ''}!`, '🔎', 'success');
        } else {
          showToast('Não encontrámos o stream deste site. Cola o URL direto do stream (ex: .../live.mp3) ou tenta o site oficial.', '🔍');
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
      showToast(`Rádio "${name}" adicionada com sucesso à categoria "${cat}" e à Biblioteca!`, '📻', 'success');
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
      if (['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowRight') { e.preventDefault(); playNext(); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); playPrev(); }
      if (e.code === 'KeyM') { toggleMute(); }
      if (e.code === 'KeyP') { togglePictureInPicture(); }
      if (e.code === 'KeyF') { openTVMode(); }
      if (e.code === 'Escape') { closeTVMode(); }
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

    // Audio Visualizers
    const miniCanvas = document.getElementById('mini-visualizer');
    const miniCtx = miniCanvas.getContext('2d');
    const tvCanvas = document.getElementById('tv-visualizer');
    const tvCtx = tvCanvas.getContext('2d');

    function resizeCanvas() {
      miniCanvas.width = miniCanvas.parentElement.clientWidth * window.devicePixelRatio;
      miniCanvas.height = miniCanvas.parentElement.clientHeight * window.devicePixelRatio;
    }
    function resizeTVCanvas() {
      if (tvCanvas.parentElement) {
        tvCanvas.width = tvCanvas.parentElement.clientWidth * window.devicePixelRatio;
        tvCanvas.height = tvCanvas.parentElement.clientHeight * window.devicePixelRatio;
      }
    }
    window.addEventListener('resize', () => {
      resizeCanvas();
      resizeTVCanvas();
    });
    resizeCanvas();

    let visualizerStep = 0;
    const freqData = new Uint8Array(64);

    function drawSpectrum() {
      miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
      tvCtx.clearRect(0, 0, tvCanvas.width, tvCanvas.height);

      let hasRealData = false;
      if (isAudioContextReady && analyserNode && isPlaying) {
        try {
          analyserNode.getByteFrequencyData(freqData);
          for (let val of freqData) {
            if (val > 0) { hasRealData = true; break; }
          }
        } catch (e) {}
      }

      const brandColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-500').trim() || '#06b6d4';
      const bars = 24;
      const w = miniCanvas.width / bars;

      for (let i = 0; i < bars; i++) {
        let h = 2;
        if (isPlaying) {
          if (hasRealData) {
            const raw = freqData[i % freqData.length] / 255;
            h = Math.max(2, raw * miniCanvas.height * 0.95);
          } else {
            const wave = (Math.sin(visualizerStep * 0.15 + i * 0.45) * 0.5 + 0.5);
            h = Math.max(2, wave * miniCanvas.height * 0.85);
          }
        }
        miniCtx.fillStyle = brandColor;
        miniCtx.fillRect(i * w + 1, miniCanvas.height - h, w - 2, h);
      }

      if (visualizerStyle === 'bars') {
        const tvW = tvCanvas.width / bars;
        for (let i = 0; i < bars; i++) {
          let tvH = 4;
          if (isPlaying) {
            if (hasRealData) {
              const raw = freqData[i % freqData.length] / 255;
              tvH = Math.max(4, raw * tvCanvas.height * 0.95);
            } else {
              const wave = (Math.sin(visualizerStep * 0.15 + i * 0.45) * 0.5 + 0.5);
              tvH = Math.max(4, wave * tvCanvas.height * 0.85);
            }
          }
          tvCtx.fillStyle = brandColor;
          tvCtx.fillRect(i * tvW + 2, tvCanvas.height - tvH, tvW - 4, tvH);
        }
      } else {
        const centerX = tvCanvas.width / 2;
        const centerY = tvCanvas.height / 2;
        const radius = Math.min(centerX, centerY) * 0.6;
        const points = 36;
        
        tvCtx.beginPath();
        tvCtx.strokeStyle = brandColor;
        tvCtx.lineWidth = 3;
        tvCtx.shadowBlur = 15;
        tvCtx.shadowColor = brandColor;

        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          let amp = 0;
          if (isPlaying) {
            amp = hasRealData ? (freqData[i % freqData.length] / 255) * 25 : Math.sin(visualizerStep * 0.2 + i * 0.8) * 12;
          }
          const r = radius + amp;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          if (i === 0) tvCtx.moveTo(x, y);
          else tvCtx.lineTo(x, y);
        }
        tvCtx.closePath();
        tvCtx.stroke();
        tvCtx.shadowBlur = 0;
      }

      visualizerStep++;
      requestAnimationFrame(drawSpectrum);
    }
    drawSpectrum();

    // Check Deep Link Query Param on Load (?station=...)
    const urlParams = new URLSearchParams(window.location.search);
    const stationParam = urlParams.get('station');
    if (stationParam) {
      currentStationId = stationParam;
    }

    // Initial load
    changeLanguage(currentLang);
    updateCounts();
    sync10BandSliders();
    selectStation(currentStationId, false);

    // Auditoria de saúde em background: arranca imediatamente com a app,
    // em fundo e com cadência suave — nunca bloqueia a UI.
    runBackgroundHealthAudit().catch(() => {});
