//! Roc Waves — map: Mapa mundial (Leaflet), descoberta geográfica, pesquisa de cidades e GPS.
// Script clássico carregado por ordem no index.html (partilha o âmbito global
// com os outros módulos de js/app/). Ver ordem em index.html.

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
  // O Leaflet só é descarregado quando o mapa é aberto pela primeira vez.
  if (typeof L === 'undefined') {
    ensureLib('leaflet')
      .then(() => { if (currentView === 'map') initWorldMap(); })
      .catch(() => showToast(t('mapLoadFailed'), '🗺️', 'warning'));
    return;
  }
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
      <div class="radio-garden-dot ${isCurrent ? 'is-active' : ''}" title="${escapeHtml(st.name)} (${escapeHtml(st.city || st.country)})">
        <div class="dot-ring"></div>
        <div class="dot-core"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });

  // title/alt dão nome acessível ao marcador (o Leaflet torna-o focável por teclado)
  const marker = L.marker([st.lat, st.lon], { icon: customIcon, title: st.name || '', alt: st.name || '', keyboard: true });
  marker.stationId = String(st.id);
  marker.stationData = st;

  const safeName = escapeHtml(st.name || 'Rádio');
  const safeCity = escapeHtml((st.city ? st.city + ', ' : '') + (st.country || 'Mundo'));
  const safeGenre = escapeHtml(st.genre || st.category || 'Música');

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
        <span>🏷️ ${escapeHtml(st.category || 'Música')}</span>
        <span class="font-mono text-cyan-400 font-bold">${st.bit_rate || 128} kbps</span>
      </div>
      <button ${uiAction('selectStation', st.id, true)} class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs shadow-lg transition active:scale-95 flex items-center justify-center gap-1.5">
        <span>▶️</span> <span>${t('listenLive')}</span>
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
      const sid = `geo_${safeId(item.stationuuid || item.changeuuid) || (Date.now() + '_' + idx)}`;
      if (!seenIds.has(sid)) {
        seenIds.add(sid);
        const newSt = mapRadioBrowserStation(item, idx, { id: sid, fallbackName: 'Rádio Local', extra: { lat: lat, lon: lon } });

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
    countEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> ${t('loadingLocal')}`;
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
    countEl.innerHTML = `<span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span> ${escapeHtml(t('loadingCity', { city: cleanCity }))}`;
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
      showToast(t('mapDiscovered', { count: deduplicated.length, city: cleanCity }), '📻', 'success');
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
      const sid = `geo_${safeId(item.stationuuid || item.changeuuid) || (Date.now() + '_' + idx)}`;
      if (!seenIds.has(sid)) {
        seenIds.add(sid);
        const newSt = mapRadioBrowserStation(item, idx, { id: sid, fallbackName: 'Rádio Local', cityFallback: cityName, extra: { lat: lat, lon: lon } });

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
    const safeName = escapeHtml(s.name || 'Rádio');
    const safeCity = escapeHtml(s.city || s.country || 'Global');
    const safeGenre = escapeHtml(s.genre || s.category || 'Música');

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

        <button ${uiAction('flyToStationOnMap', s.id)} class="w-full py-1.5 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 font-bold text-[11px] transition active:scale-95 flex items-center justify-center gap-1.5">
          <span>✈️</span> <span>${escapeHtml(t('tuneAndFly'))}</span>
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
    const safeName = escapeHtml(s.name || 'Rádio');
    const safeCity = escapeHtml(s.city || s.country || 'Global');
    const safeGenre = escapeHtml(s.genre || s.category || 'Música');

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

        <button ${uiAction('flyToStationOnMap', s.id)} class="w-full py-1.5 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 font-bold text-[11px] transition active:scale-95 flex items-center justify-center gap-1.5">
          <span>✈️</span> <span>${escapeHtml(t('tuneAndFly'))}</span>
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

  showToast(t('mapSearching', { q }), '🔍', 'info');

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
        showToast(t('flyingTo', { place: v[3] }), '✈️', 'success');
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
          showToast(t('flyingTo', { place: cityName }), '✈️', 'success');
          fetchCityAndStateRadios(cityName, lat, lon);
          return;
        }
      }
    }
  } catch (err) {
    console.warn('Geocoding search failed:', err);
  }

  showToast(t('placeNotFound', { q }), '⚠️', 'warning');
}

function locateUserGPSOnMap() {
  if (!navigator.geolocation) {
    showToast(t('geoUnsupported'), '⚠️', 'warning');
    return;
  }

  showToast(t('gpsLocating'), '🎯', 'info');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      if (leafletMap) {
        leafletMap.flyTo([lat, lon], 10, { duration: 1.5 });
        const areaTitle = document.getElementById('map-area-title');
        if (areaTitle) areaTitle.textContent = '📍 A Tua Localização Atual';
        showToast(t('gpsFound'), '🎯', 'success');
      }
    },
    (err) => {
      console.warn('GPS error:', err);
      showToast(t('gpsDenied'), '⚠️', 'warning');
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

    showToast(t('flyingToStation', { place: station.city || station.country, name: station.name }), station.flag || '✈️', 'success');

    // Scroll to map if user is further down on mobile
    const mapEl = document.getElementById('world-map');
    if (mapEl && window.innerWidth < 768) {
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } else {
    showToast(t('nowPlayingToast', { name: station.name }), '📻', 'info');
  }
}

function zoomMapToFit() {
  if (leafletMap) {
    leafletMap.flyTo([20, 0], 2, { duration: 1.2 });
  }
  filterMapByRegion('all');
}
