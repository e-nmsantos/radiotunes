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
    '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });

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

test('dependências CDN carregam (versão fixa + SRI)', { skip }, async () => {
  assert.equal(await evaluate('typeof Hls'), 'function');
  assert.equal(await evaluate('typeof L.markerClusterGroup'), 'function');
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
    const handlers = [...document.querySelectorAll('button[onclick*="spotify"], button[onclick*="youtube"]')].map(b => b.getAttribute('onclick'));
    trackHistory = saved;
    renderTrackHistoryList();
    return { pwned: window.__pwned, handlers };
  })()`);
  assert.equal(out.pwned, false);
  assert.ok(out.handlers.length >= 2, 'botões Spotify/YouTube deviam existir');
  for (const h of out.handlers) assert.ok(!h.includes("x')"), 'o título não pode sair da string JS: ' + h);
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
