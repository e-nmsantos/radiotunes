//! Roc Waves — health: Cadeia de fallback de logos e auditor de saúde dos streams em background.
// Script clássico carregado por ordem no index.html (partilha o âmbito global
// com os outros módulos de js/app/). Ver ordem em index.html.

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

/** Janitor: procura stream substituto para uma estação morta.
 * Só aceita candidatos da radio-browser com país igual, nome
 * compatível e stream verificado pela própria sonda. */
async function findReplacementStream(st) {
  const q = (st.name || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (!q || q.length < 3) return null;
  try {
    const list = await RocStorage.cachedFetchJson(
      `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(q)}&limit=15&order=clickcount&reverse=true&hidebroken=true&lastcheckok=1`
    ).catch(() => []);
    if (!Array.isArray(list)) return null;
    const sameCountry = list.filter(s => (s.country || '').toLowerCase() === (st.country || '').toLowerCase());
    const pool = sameCountry.length ? sameCountry : [];
    for (const c of pool) {
      const u = c.url_resolved || c.url;
      if (!u || !u.startsWith('http')) continue;
      // o nome do candidato tem de bater com o da estação (guarda editorial)
      const a = (st.name || '').toLowerCase();
      const b = (c.name || '').toLowerCase();
      const shared = a.split(/[^a-z0-9]+/).filter(t => t.length > 3 && b.includes(t)).length;
      if (shared === 0) continue;
      const probe = await probeStreamHealth(u);
      if (probe.healthy) return { url: u, bitrate: c.bitrate || null };
      await new Promise(r => setTimeout(r, 300));
    }
  } catch (e) {}
  return null;
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
        // Janitor: morte PERMANENTE (404/410/redirect-falso/DNS)?
        // Outages 5xx e falhas transitórias ficam só com badge.
        const permanentlyDead =
          res.reason === 'HTTP 404' || res.reason === 'HTTP 410' ||
          res.reason === 'redireciona para página web' || res.reason === 'inacessível';
        if (permanentlyDead) {
          const repl = await findReplacementStream(st);
          if (repl) {
            // Reparar em memória: o stream novo já funciona nesta sessão
            st.stream_url = repl.url;
            if (repl.bitrate) st.bit_rate = repl.bitrate;
            unhealthyStationIds.delete(String(st.id));
            await RocStorage.set(cacheKey, { healthy: true, repaired: true, url: repl.url, at: Date.now() });
            console.info(`Saúde: ${st.name} reparada automaticamente → ${repl.url}`);
          } else {
            // Sem stream disponível → eliminar silenciosamente
            // (restaurável na opção "restaurar estações eliminadas")
            deletedStationIds.push(String(st.id));
            persist('roc_user_deleted_stations', JSON.stringify(deletedStationIds));
            await RocStorage.set(cacheKey, { healthy: false, reason: res.reason, pruned: true, at: Date.now() });
            console.warn(`Saúde: ${st.name} eliminada (${res.reason}) — sem stream conhecido`);
          }
          flagged = true;
        } else {
          if (!unhealthyStationIds.has(String(st.id))) flagged = true;
          unhealthyStationIds.add(String(st.id));
        }
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
