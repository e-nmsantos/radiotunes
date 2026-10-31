// Testes do RocCore — espelham os 14 testes de Radio.roc
// Executar com: node --test "test/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Roc = require('../js/roc-core.js');

const mk = (id, name, url, genre, country, bit_rate) => ({
  id, name, stream_url: url, genre, country, bit_rate,
  favorite: false, in_library: true,
});

test('1: criação de estações e contagem', () => {
  const list = [
    mk(1, 'Rádio Comercial', 'https://stream.comercial.pt', 'Pop', 'Portugal', 128),
    mk(2, 'Antena 3', 'https://stream.antena3.pt', 'Alternativa', 'Portugal', 128),
    mk(3, 'Jazz Radio', 'https://stream.jazz.fr', 'Jazz', 'França', 192),
  ];
  assert.equal(list.length, 3);
});

test('2: favoritos', () => {
  const stations = [mk(1, 'RFM', 'u1', 'Pop', 'Portugal', 128), mk(2, 'TSF', 'u2', 'Notícias', 'Portugal', 96)];
  const withFav = Roc.toggleFavorite(stations, 1);
  assert.equal(Roc.getFavorites(withFav).length, 1);
});

test('3: filtro por género', () => {
  const stations = [
    mk(1, 'RFM', 'u1', 'Pop', 'Portugal', 128),
    mk(2, 'M80', 'u2', 'Rock 80s', 'Portugal', 128),
    mk(3, 'Smooth FM', 'u3', 'Jazz', 'Portugal', 128),
  ];
  assert.equal(Roc.filterByGenre(stations, 'Jazz').length, 1);
});

test('4: pesquisa por texto', () => {
  const stations = [
    mk(1, 'Antena 1', 'u1', 'Notícias', 'Portugal', 128),
    mk(2, 'BBC Radio 1', 'u2', 'Pop', 'Reino Unido', 192),
  ];
  assert.equal(Roc.searchStations(stations, 'BBC').length, 1);
});

test('5: navegação cíclica (next / prev)', () => {
  const stations = [mk(1, 'E1', 'u1', 'Pop', 'PT', 128), mk(2, 'E2', 'u2', 'Rock', 'PT', 128), mk(3, 'E3', 'u3', 'Jazz', 'PT', 128)];
  assert.equal(Roc.nextStationId(stations, 1), 2);
  assert.equal(Roc.nextStationId(stations, 3), 1);
  assert.equal(Roc.prevStationId(stations, 1), 3);
  // id inexistente: primeira/última, como no Radio.roc
  assert.equal(Roc.nextStationId(stations, 99), 1);
  assert.equal(Roc.prevStationId(stations, 99), 3);
  assert.equal(Roc.nextStationId([], 1), null);
});

test('6: presets de equalizador', () => {
  const bassBoost = Roc.createEqPreset('Bass Boost', 8, -1, 3);
  const vocalBoost = Roc.createEqPreset('Voz', -3, 6, 2);
  assert.equal(bassBoost.bass, 8);
  assert.equal(bassBoost.name, 'Bass Boost');
  assert.equal(vocalBoost.mid, 6);
});

test('7: sleep timer', () => {
  const timer30 = Roc.startSleepTimer(30);
  const ticked = Roc.tickSleepTimer(timer30);
  assert.equal(timer30.seconds_left, 1800);
  assert.equal(timer30.is_active, true);
  assert.equal(ticked.seconds_left, 1799);
  assert.equal(Roc.startSleepTimer(0).is_active, false);
  // desligar no último segundo
  let t = { seconds_left: 1, is_active: true };
  t = Roc.tickSleepTimer(t);
  assert.equal(t.is_active, false);
  assert.equal(t.seconds_left, 0);
});

test('8: exportação M3U', () => {
  const stations = [
    mk(1, 'RFM', 'https://stream.rfm.pt', 'Pop', 'Portugal', 128),
    mk(2, 'BBC 1', 'https://stream.bbc.co.uk', 'Pop', 'UK', 192),
  ];
  const m3u = Roc.exportM3U(stations);
  assert.ok(m3u.includes('#EXTM3U'));
  assert.ok(m3u.includes('#EXTINF:-1,RFM (Portugal)'));
  assert.ok(m3u.includes('https://stream.rfm.pt'));
});

test('9: alarme / despertador', () => {
  const alarm7 = Roc.createAlarm(7, 30, 101, true);
  const alarmOff = Roc.createAlarm(8, 0, 102, false);
  assert.equal(Roc.shouldTriggerAlarm(alarm7, 7, 30), true);
  assert.equal(Roc.shouldTriggerAlarm(alarm7, 7, 31), false);
  assert.equal(Roc.shouldTriggerAlarm(alarmOff, 8, 0), false);
});

test('10: filtro avançado e biblioteca', () => {
  const stations = [
    mk(1, 'Mega Hits Lisboa', 'u1', 'Pop Hits', 'Portugal', 192),
    mk(2, 'Rock Antena', 'u2', 'Classic Rock', 'Portugal', 96),
    mk(3, 'Jazz Paris', 'u3', 'Smooth Jazz', 'França', 256),
  ];
  const filtered = Roc.applyAdvancedFilter(stations, {
    query: '', country: 'Portugal', city: '', genre: 'Pop',
    min_bitrate: 128, only_favorites: false, only_in_library: true,
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 1);
  // toggle de biblioteca exclui a estação
  const withoutLib = Roc.toggleLibraryInclusion(stations, 1);
  assert.equal(Roc.applyAdvancedFilter(withoutLib, {
    query: '', country: '', city: '', genre: '', min_bitrate: 0,
    only_favorites: false, only_in_library: true,
  }).length, 2);
});

test('11: playlists personalizadas', () => {
  const p1 = Roc.createPlaylist(1, 'Foco no Trabalho', '💼');
  const p2 = Roc.addToPlaylist(p1, 101);
  const p3 = Roc.addToPlaylist(p2, 201);
  const p4 = Roc.removeFromPlaylist(p3, 101);
  assert.equal(p3.stationIds.length, 2);
  assert.equal(p4.stationIds.length, 1);
  assert.ok(p4.stationIds.includes(201));
  // adicionar duplicado é no-op
  const p5 = Roc.addToPlaylist(p3, 101);
  assert.equal(p5.stationIds.length, 2);
});

test('12: gravação agendada (DVR)', () => {
  const rec = Roc.createScheduledRecording(101, '08:00', 30);
  assert.equal(rec.stationId, 101);
  assert.equal(rec.duration_mins, 30);
  assert.equal(rec.is_active, true);
});

test('13: categorias personalizadas e reatribuição', () => {
  const s1 = mk(1, 'Rádio Comercial', 'u1', 'Música', 'Portugal', 128);
  const updated = Roc.assignStationCategory([s1], 1, 'Anos 90');
  assert.equal(Roc.filterByGenre(updated, 'Anos 90').length, 1);
});

test('14: eliminar estação', () => {
  const stations = [mk(1, 'Rádio 1', 'u1', 'Música', 'Portugal', 128), mk(2, 'Rádio 2', 'u2', 'Rock', 'Portugal', 128)];
  const remaining = Roc.deleteStation(stations, 1);
  assert.equal(remaining.length, 1);
  assert.equal(String(remaining[0].id), '2');
});
