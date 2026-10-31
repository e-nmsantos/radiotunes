//! Roc Waves — browse: Categorias, filtros, grelha de estações, pesquisa global e Top 50.
// Script clássico carregado por ordem no index.html (partilha o âmbito global
// com os outros módulos de js/app/). Ver ordem em index.html.

function selectCategory(cat) {
  selectedCategory = cat;
  currentView = 'home';
  renderCategories();
  setView('home');
  if (cat !== 'all') {
    updateExplainerBanner('🏷️', t('exGenreTitle', { cat }), t('exGenreDesc', { cat }));
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
        return mapRadioBrowserStation(item, idx);
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
      const safeName = escapeHtml(s.name || 'Rádio');
      const safeGenre = escapeHtml(s.genre || s.desc || 'Música & Rádio');
      const safeCountry = escapeHtml(s.country || 'Mundo');
      const isUnhealthy = unhealthyStationIds.has(String(s.id));

      return `
        <div
          draggable="true"
          data-drag-station="${escapeHtml(s.id)}"
          ondragend="handleDragEnd(event)"
          ${uiAction('selectStation', s.id, true)}
          class="station-card group cursor-pointer rounded-2xl p-3 md:p-4 border flex flex-row items-center gap-3 md:flex-col md:items-stretch md:justify-between md:gap-0 select-none ${isCurrent ? 'bg-cyan-500/15 border-cyan-500/60 shadow-xl shadow-cyan-500/15' : 'bg-slate-900 border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800/80'}"
        >

          <!-- Cover Header (no telemóvel: só o logo, em linha) -->
          <div class="flex items-start justify-between gap-3 md:mb-3 flex-shrink-0">
            <div class="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition shadow-md relative">
              ${safeImageUrl(s.image) ? `<img src="${safeImageUrl(s.image)}" data-roc-station="${escapeHtml(s.id)}" alt="${safeName}" loading="lazy" decoding="async" class="w-full h-full object-cover" onerror="rocCardLogoFallback(this)" />` : `<img src="${stationMonogram(s)}" alt="${safeName}" loading="lazy" decoding="async" class="w-full h-full object-cover" />`}
            </div>
            <div class="hidden md:flex items-center gap-1">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                ${s.flag || '🌐'} ${safeCountry}
              </span>
              ${isUnhealthy ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30" title="Stream em falha na última verificação automática">⚠</span>` : ''}
              <button ${uiAction('handleCardCategoryClick', s.id)} class="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition text-sm active:scale-90" title="Mover para Categoria">
                🏷️
              </button>
              <button ${uiAction('handleCardLibraryClick', s.id)} class="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition text-sm active:scale-90" title="${isInLib ? 'Remover da Biblioteca' : 'Incluir na Biblioteca'}">
                ${isInLib ? '📌' : '➕'}
              </button>
              <button ${uiAction('handleCardFavClick', s.id)} class="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition text-sm active:scale-90" title="Favorito">
                ${isFav ? '⭐' : '☆'}
              </button>
              <button ${uiAction('handleCardDeleteClick', s.id)} class="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition text-sm active:scale-90" title="Eliminar / Remover Rádio">
                🗑️
              </button>
            </div>
          </div>

          <!-- Info -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-extrabold text-white truncate ${isCurrent ? 'text-cyan-400' : ''}">
                ${safeName}
              </h3>
              ${isCurrent && isPlaying ? '<span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping flex-shrink-0"></span>' : ''}
              ${isUnhealthy ? `<span class="md:hidden text-[10px] text-red-400 flex-shrink-0" title="Stream em falha na última verificação automática">⚠</span>` : ''}
            </div>
            <p class="text-xs text-slate-400 truncate mt-0.5">${safeGenre}<span class="md:hidden"> · ${s.flag || '🌐'} ${safeCountry}</span></p>
          </div>

          <!-- Ações no telemóvel: favorito + menu ⋯ (o resto vive no menu) -->
          <div class="flex md:hidden items-center flex-shrink-0 -mr-1">
            <button ${uiAction('handleCardFavClick', s.id)} class="w-10 h-10 rounded-xl text-lg flex items-center justify-center text-slate-400 active:scale-90 transition" title="Favorito">
              ${isFav ? '⭐' : '☆'}
            </button>
            <button ${uiAction('openStationActions', s.id)} class="w-10 h-10 rounded-xl text-xl leading-none flex items-center justify-center text-slate-400 active:scale-90 transition" title="${escapeHtml(t('moreActions'))}">
              ⋯
            </button>
          </div>

          <!-- Footer info with Category Tag -->
          <div class="hidden md:flex mt-3 pt-2.5 border-t border-slate-800/50 items-center justify-between text-[11px] text-slate-500">
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
  showToast(t('rocCopied'), '📋', 'success');
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
      return mapRadioBrowserStation(item, idx);
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
      apiSearchResults = data.map((item, idx) => mapRadioBrowserStation(item, idx, {
        id: `top_${safeId(item.stationuuid) || idx}`,
        extra: {
          category: getCategoryFromTags(item.tags || ""),
          genre: item.tags ? item.tags.split(',').slice(0, 2).join(' / ') : "Top Mundial",
          country: item.country || "Mundo",
          color: "from-purple-600 to-indigo-700",
          desc: `Top #${idx+1} Mundial (${item.clickcount || 0} cliques)`
        }
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

/**
 * Converte uma estação da API radio-browser no formato interno da app.
 * opts.id           — ID (por omissão rb_<uuid>)
 * opts.fallbackName — nome quando a API não o traz
 * opts.cityFallback — cidade quando item.state não existe
 * opts.extra        — campos que substituem os calculados (ex.: lat/lon numéricos)
 */
function mapRadioBrowserStation(item, idx, opts = {}) {
  const cat = getCategoryFromTags(item.tags || item.name || "");
  const safeCountry = item.country || (item.countrycode ? item.countrycode.toUpperCase() : "Global");
  return Object.assign({
    id: opts.id || `rb_${safeId(item.stationuuid) || idx}`,
    name: (item.name || opts.fallbackName || 'Rádio Sem Nome').trim(),
    stream_url: item.url_resolved || item.url,
    category: cat,
    tags: item.tags || "",
    genre: item.tags ? item.tags.split(',').slice(0, 2).map(t => t.trim()).join(' / ') : cat,
    country: safeCountry,
    city: item.state || opts.cityFallback || safeCountry,
    flag: getFlagEmoji(item.countrycode || ""),
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
  }, opts.extra);
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
