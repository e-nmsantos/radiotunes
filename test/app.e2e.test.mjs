// Testes end-to-end da app num Chrome headless real (sem dependências:
// fala o Chrome DevTools Protocol pelo WebSocket nativo do Node 22+).
// Executar com: node --test "test/*.test.mjs"
// Chrome: deteta a instalação local; CHROME_PATH=/caminho/chrome para forçar.
// Sem Chrome disponível, os testes são marcados como "skipped".
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_PORT = 8093 + Math.floor(Math.random() * 500);
const CDP_PORT = 9333 + Math.floor(Math.random() * 500);
const APP_URL = `http://127.0.0.1:${APP_PORT}/index.html`;

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

const CHROME = findChrome();
const skip = CHROME ? false : 'Chrome não encontrado (definir CHROME_PATH)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server, chrome, profile, ws;
let msgId = 0;
const pending = new Map();
const consoleProblems = [];

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

/** Avalia uma expressão na página e devolve o valor (lança se a expressão lançar). */
async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.result && res.result.exceptionDetails) {
    throw new Error('Exceção na página: ' + (res.result.exceptionDetails.exception?.description || res.result.exceptionDetails.text));
  }
  return res.result?.result?.value;
}

async function waitFor(expression, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { if (await evaluate(expression)) return; } catch { /* página ainda a carregar */ }
    await sleep(200);
  }
  throw new Error('Timeout à espera de: ' + expression);
}

async function loadApp() {
  await send('Page.navigate', { url: APP_URL });
  await waitFor(`document.readyState === 'complete' && typeof refreshViewHeader === 'function' && document.querySelectorAll('.station-card').length > 0`);
}

before(async () => {
  if (skip) return;
  server = spawn(process.execPath, [path.join(ROOT, 'tools/serve.cjs')], { env: { ...process.env, PORT: String(APP_PORT) }, stdio: 'ignore' });
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'roc-e2e-'));
  chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
    // Runners de CI (Ubuntu 24.04) bloqueiam o sandbox do Chrome via AppArmor
    ...(process.env.CI ? ['--no-sandbox'] : []),
    'about:blank'], { stdio: 'ignore' });

  let page;
  for (let i = 0; i < 50 && !page; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json()).find((t) => t.type === 'page'); } catch { await sleep(200); }
  }
  assert.ok(page, 'Chrome não expôs o DevTools Protocol');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleProblems.push('EXCEÇÃO: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
      consoleProblems.push(msg.params.type + ': ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });
  await send('Runtime.enable');
  await send('Page.enable');
  // Conta os carregamentos de documento (deteta recarregamentos inesperados).
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `sessionStorage.__rocLoads = String((+sessionStorage.__rocLoads || 0) + 1);`,
  });
  await loadApp();
});

after(async () => {
  if (skip) return;
  try { ws?.close(); } catch {}
  chrome?.kill();
  server?.kill();
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
});

test('arranca sem exceções nem avisos na consola', { skip }, async () => {
  await sleep(1500); // deixa correr o arranque assíncrono (proxy, auditoria, SW)
  assert.deepEqual(consoleProblems, []);
});

test('PWA: a 1.ª instalação do service worker não recarrega a página', { skip }, async () => {
  // Perfil novo: o SW instala e passa a controlar a página (controllerchange).
  // Isso não pode recarregar a app — cortaria a rádio a quem a abre pela 1.ª vez.
  await waitFor(`!!navigator.serviceWorker.controller`, 20000);
  await sleep(1000);
  assert.equal(await evaluate(`sessionStorage.__rocLoads`), '1', 'a página foi recarregada');
});

test('hls.js e Leaflet não carregam no arranque e carregam a pedido (versão fixa + SRI)', { skip }, async () => {
  assert.equal(await evaluate('typeof Hls'), 'undefined', 'hls.js não devia carregar no arranque');
  assert.equal(await evaluate('typeof L'), 'undefined', 'Leaflet não devia carregar no arranque');
  await evaluate(`ensureLib('hls')`);
  assert.equal(await evaluate('typeof Hls'), 'function');
  await evaluate(`ensureLib('leaflet')`);
  assert.equal(await evaluate('typeof L.markerClusterGroup'), 'function');
  // integridade verificada pelo browser: todos os assets dinâmicos levam SRI
  const sri = await evaluate(`[...document.querySelectorAll('head script[src^="https"], head link[href^="https"][rel=stylesheet]')].every(e => e.integrity.startsWith('sha384-'))`);
  assert.equal(sri, true);
});

test('persistência: favoritos e idioma sobrevivem a um reload', { skip }, async () => {
  const id = await evaluate(`(() => {
    const s = getAllStations()[0];
    if (!userFavorites.includes(String(s.id))) toggleFavorite(s.id);
    changeLanguage('en');
    return String(s.id);
  })()`);
  await loadApp();
  assert.equal(await evaluate(`userFavorites.includes(${JSON.stringify(id)})`), true);
  assert.equal(await evaluate(`document.getElementById('lang-select').value`), 'en');
  await evaluate(`toggleFavorite(${JSON.stringify(id)}); changeLanguage('pt')`);
});

test('XSS: nome de rádio e logo maliciosos não executam código', { skip }, async () => {
  const out = await evaluate(`(async () => {
    window.__pwned = false;
    userCustomStations.unshift({
      id: 'custom_xss', name: '<img src=x onerror="window.__pwned=true">',
      stream_url: 'https://example.invalid/live.mp3', category: 'Música', country: '<b>X</b>',
      image: 'javascript:window.__pwned=true',
    });
    setView('home');
    await new Promise(r => setTimeout(r, 400));
    const card = [...document.querySelectorAll('.station-card')].find(c => c.textContent.includes('onerror'));
    const img = card && card.querySelector('img');
    userCustomStations.shift();
    render();
    return { pwned: window.__pwned, rendered: !!card, imgSrc: img ? img.getAttribute('src') : null };
  })()`);
  assert.equal(out.rendered, true, 'o cartão com o nome literal devia aparecer');
  assert.equal(out.pwned, false);
  assert.ok(!String(out.imgSrc).startsWith('javascript:'), 'URL javascript: não pode chegar ao src');
});

test('XSS: título ICY malicioso no histórico não executa código', { skip }, async () => {
  const out = await evaluate(`(async () => {
    window.__pwned = false;
    const saved = trackHistory;
    trackHistory = [{ title: "x'); window.__pwned=true; ('<img src=x onerror=\\"window.__pwned=true\\">", artist: '<i>a</i>', time: '1' }];
    renderTrackHistoryList();
    await new Promise(r => setTimeout(r, 300));
    const opened = [];
    const realOpen = window.open;
    window.open = (url) => { opened.push(url); return null; };
    document.querySelectorAll('[data-action="openTrackSearch"]').forEach(b => b.click());
    window.open = realOpen;
    trackHistory = saved;
    renderTrackHistoryList();
    return { pwned: window.__pwned, opened };
  })()`);
  assert.equal(out.pwned, false);
  assert.equal(out.opened.length, 2, 'botões Spotify/YouTube deviam abrir a pesquisa');
  // o título chega ao URL só como dado codificado
  assert.ok(out.opened[0].startsWith("https://open.spotify.com/search/x')%3B%20window"), out.opened[0]);
  assert.ok(out.opened[1].startsWith("https://www.youtube.com/results?search_query=x')%3B%20window"), out.opened[1]);
});

test('nenhum template injeta dados em handlers inline (onclick="...${...}")', async () => {
  const dir = path.join(ROOT, 'js/app');
  const src = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const offenders = src.match(/\bon[a-z]+="[^"]*\$\{[^"]*"/g) || [];
  assert.deepEqual(offenders, []);
});

test('delegação: cartão, botões do cartão e popup do mapa funcionam', { skip }, async () => {
  const out = await evaluate(`(async () => {
    setView('home');
    await new Promise(r => setTimeout(r, 300));
    const card = document.querySelectorAll('.station-card')[1];
    const id = JSON.parse(card.dataset.args)[0];
    const favBefore = userFavorites.includes(String(id));
    card.querySelector('[data-action="handleCardFavClick"]').click();
    const favAfter = userFavorites.includes(String(id));
    const stationBefore = currentStationId;
    card.querySelector('[data-action="handleCardFavClick"]').click(); // repõe
    const stillSame = String(currentStationId) === String(stationBefore); // o botão não pode tocar a rádio
    lastPlayIntent = false;
    const realPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    // o clique na estrela redesenha a grelha: voltar a obter o cartão
    const freshCard = [...document.querySelectorAll('.station-card')].find(c => JSON.parse(c.dataset.args)[0] === id);
    freshCard.click();
    const selected = String(currentStationId) === String(id);
    // popup do mapa (Leaflet trava a propagação de cliques nos popups)
    const st = getAllStations().find(s => s.lat != null && s.lon != null && String(s.id) !== String(id));
    const holder = document.createElement('div');
    holder.innerHTML = '<button ' + uiAction('selectStation', st.id, true) + '>x</button>';
    document.body.appendChild(holder);
    holder.querySelector('button').click();
    holder.remove();
    const viaPopup = String(currentStationId) === String(st.id);
    HTMLMediaElement.prototype.play = realPlay;
    return { toggled: favBefore !== favAfter, stillSame, selected, viaPopup };
  })()`);
  assert.deepEqual(out, { toggled: true, stillSame: true, selected: true, viaPopup: true });
});

test('delegação: botão "Ouvir" num popup real do mapa (Leaflet) sintoniza a rádio', { skip }, async () => {
  await evaluate(`setView('map')`);
  await waitFor(`typeof leafletMap !== 'undefined' && leafletMap && mapMarkers.length > 0`);
  const out = await evaluate(`(async () => {
    const marker = mapMarkers.find(m => String(m.stationId) !== String(currentStationId));
    leafletMap.addLayer(marker); // fora do cluster, para o popup poder abrir
    marker.openPopup();
    await new Promise(r => setTimeout(r, 300));
    const btn = document.querySelector('.leaflet-popup [data-action="selectStation"]');
    const realPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    btn.click();
    HTMLMediaElement.prototype.play = realPlay;
    const ok = String(currentStationId) === String(marker.stationId);
    leafletMap.closePopup();
    leafletMap.removeLayer(marker);
    setView('home');
    return { hasButton: !!btn, ok };
  })()`);
  assert.deepEqual(out, { hasButton: true, ok: true });
});

test('delegação: largar um cartão numa categoria muda a categoria da rádio', { skip }, async () => {
  const out = await evaluate(`(() => {
    const card = document.querySelectorAll('.station-card')[0];
    const id = JSON.parse(card.dataset.args)[0];
    const target = document.querySelector('[data-drop-category="Rock"]');
    const dt = new DataTransfer();
    card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const st = getAllStations().find(s => String(s.id) === String(id));
    return st && st.category;
  })()`);
  assert.equal(out, 'Rock');
});

test('toasts escapam o texto', { skip }, async () => {
  const html = await evaluate(`(() => { showToast('<b>negrito</b>'); return [...document.querySelectorAll('.toast-slide')].pop().innerHTML; })()`);
  assert.ok(html.includes('&lt;b&gt;negrito&lt;/b&gt;'));
});

test('categorias com apóstrofo funcionam ao clicar', { skip }, async () => {
  const out = await evaluate(`(() => {
    userCategories.push({ id: "Rock d'Ouro", name: "Rock d'Ouro", icon: '🎸' });
    renderCategories();
    document.getElementById("cat-Rock d'Ouro").click();
    const sel = selectedCategory;
    userCategories = userCategories.filter(c => c.id !== "Rock d'Ouro");
    selectCategory('Todas');
    return sel;
  })()`);
  assert.equal(out, "Rock d'Ouro");
});

test('i18n: mudar de idioma traduz o banner e os toasts', { skip }, async () => {
  const out = await evaluate(`(() => {
    changeLanguage('fr');
    const banner = document.getElementById('explainer-title').textContent;
    const undo = t('undo');
    changeLanguage('pt');
    return { banner, undo };
  })()`);
  assert.equal(out.banner, 'Catalogue Général des Stations');
  assert.equal(out.undo, 'Annuler');
});

test('acessibilidade: todos os botões com title têm aria-label', { skip }, async () => {
  assert.equal(await evaluate(`document.querySelectorAll('button[title]:not([aria-label])').length`), 0);
});

test('PWA: ícones do manifest existem e o service worker ativa', { skip }, async () => {
  const icons = await evaluate(`fetch('manifest.json').then(r => r.json()).then(m => Promise.all(m.icons.map(i => fetch(i.src).then(r => r.status + ' ' + r.headers.get('content-type')))))`);
  assert.ok(icons.length >= 3);
  for (const i of icons) assert.equal(i, '200 image/png');
  await waitFor(`navigator.serviceWorker.getRegistration().then(r => !!(r && r.active))`);
});

test('telemóvel: mini-player, menu "Mais" e menu ⋯ dos cartões abrem e ficam visíveis', { skip }, async () => {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  try {
    await sleep(400);
    const out = await evaluate(`(async () => {
      const visible = (id) => { const el = document.getElementById(id); return !!el && el.getClientRects().length > 0; };
      const wait = () => new Promise(r => setTimeout(r, 250));
      setView('home'); await wait();
      document.querySelector('footer [onclick="handlePlayerClick()"]').click(); await wait();
      const sheet = visible('mobile-player-sheet'); closeMobileSheetPlayer();
      document.getElementById('mob-nav-tools').click(); await wait();
      const tools = visible('mobile-tools-modal'); closeMobileToolsDrawer();
      document.querySelector('.station-card [data-action="openStationActions"]').click(); await wait();
      const actions = visible('station-actions-sheet');
      document.querySelector('#station-actions-sheet [data-action="handleCardCategoryClick"]').click(); await wait();
      const category = visible('station-category-modal'); closeStationCategoryModal();
      const navOneLine = [...document.querySelectorAll('#mobile-bottom-nav [data-i18n]')].every(s => s.getClientRects().length === 1);
      return { sheet, tools, actions, category, navOneLine };
    })()`);
    assert.deepEqual(out, { sheet: true, tools: true, actions: true, category: true, navOneLine: true });
  } finally {
    await send('Emulation.clearDeviceMetricsOverride');
  }
});

test('teclado: diálogos recebem o foco, prendem o Tab, fecham com Escape e devolvem o foco', { skip }, async () => {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  try {
  const key = async (k, code, shift = false) => {
    for (const type of ['keyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: { Escape: 27, Tab: 9, ' ': 32 }[k], modifiers: shift ? 8 : 0 });
    }
    await sleep(120);
  };
  await evaluate(`(() => { const b = [...document.querySelectorAll('button[onclick*="openEqualizerModal"]')].find(x => x.getClientRects().length); b.focus(); window.__opener = b; b.click(); })()`);
  await sleep(300);
  assert.equal(await evaluate(`document.getElementById('eq-modal').contains(document.activeElement)`), true, 'o foco devia entrar no diálogo');
  for (let i = 0; i < 40; i++) await key('Tab', 'Tab');
  assert.equal(await evaluate(`document.getElementById('eq-modal').contains(document.activeElement)`), true, 'o Tab devia ficar preso no diálogo');
  await key('Escape', 'Escape');
  assert.equal(await evaluate(`document.getElementById('eq-modal').classList.contains('hidden')`), true, 'Escape devia fechar');
  assert.equal(await evaluate(`document.activeElement === window.__opener`), true, 'o foco devia voltar ao botão que abriu');
  // Espaço num botão focado ativa o botão (não faz play/pausa)
  const out = await evaluate(`(async () => {
    const wasPlaying = isPlaying;
    const btn = [...document.querySelectorAll('button[onclick*="openSleepModal"]')].find(x => x.getClientRects().length);
    btn.focus();
    return { wasPlaying };
  })()`);
  await key(' ', 'Space');
  assert.equal(await evaluate(`!document.getElementById('sleep-modal').classList.contains('hidden')`), true, 'Espaço devia ativar o botão');
  assert.equal(await evaluate(`isPlaying`), out.wasPlaying, 'Espaço num botão não pode alterar a reprodução');
  await key('Escape', 'Escape');  } finally {
    await send('Emulation.clearDeviceMetricsOverride');
  }
});

test('teclado: cada rádio é alcançável por Tab e anunciada com nome', { skip }, async () => {
  const out = await evaluate(`(() => {
    const b = document.querySelector('.station-card .station-name-btn');
    return { focusable: b && b.tabIndex >= 0, label: b && b.getAttribute('aria-label') };
  })()`);
  assert.equal(out.focusable, true);
  assert.match(out.label, /^Ouvir /);
});

test('acessibilidade: auditoria axe-core (WCAG 2.1 AA) sem violações — página e diálogo', { skip }, async () => {
  const axeSrc = await (await fetch('https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js')).text();
  await evaluate(axeSrc + ';0');
  // Espera pelo fim das animações finitas (entrada dos cartões: opacity 0→1) — senão o
  // axe mede o contraste a meio do fade e o resultado depende do tempo.
  const audit = () => evaluate(`Promise.all(document.getAnimations()
      .filter(a => isFinite(a.effect && a.effect.getComputedTiming().endTime))
      .map(a => a.finished.catch(() => {})))
    .then(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations'] }))
    .then(r => r.violations.map(v => v.id + ' (' + v.nodes.length + '): ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')))`);
  await evaluate(`setView('home')`);
  await sleep(300);
  assert.deepEqual(await audit(), [], 'página inicial');
  await evaluate(`openEqualizerModal()`);
  await sleep(300);
  const withDialog = await audit();
  await evaluate(`closeEqualizerModal()`);
  assert.deepEqual(withDialog, [], 'com o equalizador aberto');
});
