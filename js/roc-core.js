/*!
 * RocCore — porto JS fiel das regras de negócio de Radio.roc
 * Fonte de verdade partilhada entre a UI e os testes (test/roc-core.test.mjs),
 * espelhando 1:1 as funções e a semântica do módulo Roc.
 * Compatível com browser (window.RocCore) e Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RocCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Estações usam ids string na UI ("m_1", "rb_123") e U64 no Roc:
  // normalizamos sempre via String() para comparação.
  const sameId = (a, b) => String(a) === String(b);

  const contains = (haystack, needle) => {
    if (!needle) return true;
    return String(haystack || '').toLowerCase().includes(String(needle).toLowerCase());
  };

  /** Alterna o estado de favorito de uma estação (toggle_favorite em Radio.roc) */
  function toggleFavorite(stations, targetId) {
    return stations.map(s => sameId(s.id, targetId) ? { ...s, favorite: !s.favorite } : s);
  }

  /** Alterna a inclusão na biblioteca pessoal (toggle_library_inclusion) */
  function toggleLibraryInclusion(stations, targetId) {
    return stations.map(s => sameId(s.id, targetId) ? { ...s, in_library: !s.in_library } : s);
  }

  /** Reatribui a categoria/género de uma estação (assign_station_category) */
  function assignStationCategory(stations, targetId, newCategory) {
    return stations.map(s => sameId(s.id, targetId) ? { ...s, genre: newCategory, category: newCategory } : s);
  }

  /** Elimina uma estação da lista ativa (delete_station) */
  function deleteStation(stations, targetId) {
    return stations.filter(s => !sameId(s.id, targetId));
  }

  /** Filtro avançado multi-critério (apply_advanced_filter).
   * filter: { query, country, genre, min_bitrate, only_favorites, only_in_library }
   * Valores "" / "Todos" / "Todas" desativam o critério respetivo. */
  function applyAdvancedFilter(stations, filter) {
    const f = filter || {};
    const query = f.query || '';
    const country = f.country || '';
    const genre = f.genre || '';
    const minBitrate = Number(f.min_bitrate) || 0;
    return stations.filter(s => {
      const matchesQuery =
        query === '' || contains(s.name, query) || contains(s.country, query) || contains(s.genre, query);
      const matchesCountry =
        country === '' || country === 'Todos' || contains(s.country, country);
      const matchesGenre =
        genre === '' || genre === 'Todas' || contains(s.genre, genre);
      const matchesBitrate = Number(s.bit_rate) >= minBitrate;
      const matchesFav = !f.only_favorites || s.favorite === true;
      const matchesLib = !f.only_in_library || s.in_library === true;
      return matchesQuery && matchesCountry && matchesGenre && matchesBitrate && matchesFav && matchesLib;
    });
  }

  /** Filtra por género exato (filter_by_genre) */
  function filterByGenre(stations, targetGenre) {
    if (targetGenre === 'Todos' || targetGenre === 'Todas') return stations;
    return stations.filter(s => s.genre === targetGenre);
  }

  /** Pesquisa por nome/país/género (search_stations) */
  function searchStations(stations, query) {
    if (!query) return stations;
    return stations.filter(s =>
      contains(s.name, query) || contains(s.country, query) || contains(s.genre, query)
    );
  }

  /** Apenas favoritas (get_favorites) */
  function getFavorites(stations) {
    return stations.filter(s => s.favorite === true);
  }

  /** Apenas estações na biblioteca (get_library_stations) */
  function getLibraryStations(stations) {
    return stations.filter(s => s.in_library === true);
  }

  /** Navegação cíclica: id da estação seguinte (next_station_id) */
  function nextStationId(stations, currentId) {
    const total = stations.length;
    if (total === 0) return null;
    const idx = stations.findIndex(s => sameId(s.id, currentId));
    if (idx === -1) return stations[0].id;
    return stations[(idx + 1) % total].id;
  }

  /** Navegação cíclica: id da estação anterior (prev_station_id) */
  function prevStationId(stations, currentId) {
    const total = stations.length;
    if (total === 0) return null;
    const idx = stations.findIndex(s => sameId(s.id, currentId));
    if (idx === -1) return stations[total - 1].id;
    const prevIdx = idx === 0 ? total - 1 : idx - 1;
    return stations[prevIdx].id;
  }

  /** Playlists (create_playlist / add_to_playlist / remove_from_playlist) */
  function createPlaylist(id, name, icon) {
    return { id, name, icon, stationIds: [] };
  }

  function addToPlaylist(playlist, stationId) {
    if (playlist.stationIds.some(sid => sameId(sid, stationId))) return playlist;
    return { ...playlist, stationIds: [...playlist.stationIds, stationId] };
  }

  function removeFromPlaylist(playlist, stationId) {
    return { ...playlist, stationIds: playlist.stationIds.filter(sid => !sameId(sid, stationId)) };
  }

  /** Gravação agendada (create_scheduled_recording) */
  function createScheduledRecording(stationId, startTime, durationMins) {
    return { stationId, start_time: startTime, duration_mins: durationMins, is_active: true };
  }

  /** Preset de equalizador (create_eq_preset) */
  function createEqPreset(name, bass, mid, treble) {
    return { name, bass, mid, treble };
  }

  /** Sleep timer (start_sleep_timer / tick_sleep_timer) */
  function startSleepTimer(minutes) {
    if (!minutes || minutes <= 0) return { seconds_left: 0, is_active: false };
    return { seconds_left: minutes * 60, is_active: true };
  }

  function tickSleepTimer(timer) {
    if (!timer || !timer.is_active || timer.seconds_left <= 1) {
      return { seconds_left: 0, is_active: false };
    }
    return { seconds_left: timer.seconds_left - 1, is_active: true };
  }

  /** Alarme (create_alarm / should_trigger_alarm) */
  function createAlarm(hour, minute, stationId, isEnabled) {
    return { hour, minute, stationId, is_enabled: isEnabled };
  }

  function shouldTriggerAlarm(alarm, currentHour, currentMinute) {
    return !!alarm && alarm.is_enabled === true
      && alarm.hour === currentHour
      && alarm.minute === currentMinute;
  }

  /** Exportação M3U (export_m3u) */
  function exportM3U(stations) {
    const body = stations
      .map(s => `#EXTINF:-1,${s.name} (${s.country || 'Global'})\n${s.stream_url}`)
      .join('\n');
    return `#EXTM3U\n${body}`;
  }

  /** Formatação de estação para texto (format_station) */
  function formatStation(station) {
    const favIcon = station.favorite ? '⭐' : '☆';
    return `${favIcon} #${station.id} [${station.genre}] ${station.name} (${station.country || 'Global'} - ${station.bit_rate || 128} kbps)`;
  }

  return {
    toggleFavorite,
    toggleLibraryInclusion,
    assignStationCategory,
    deleteStation,
    applyAdvancedFilter,
    filterByGenre,
    searchStations,
    getFavorites,
    getLibraryStations,
    nextStationId,
    prevStationId,
    createPlaylist,
    addToPlaylist,
    removeFromPlaylist,
    createScheduledRecording,
    createEqPreset,
    startSleepTimer,
    tickSleepTimer,
    createAlarm,
    shouldTriggerAlarm,
    exportM3U,
    formatStation,
  };
});
