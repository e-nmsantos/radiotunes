#!/usr/bin/env node
/**
 * Roc Waves — Proxy de Áudio (zero dependências)
 * ------------------------------------------------
 * Resolve as duas limitações dos browsers com streams de rádio:
 *   1. CORS: adiciona Access-Control-Allow-Origin: * a qualquer stream.
 *   2. Mixed content: permite ouvir streams http:// numa página https://.
 * Endpoint extra:
 *   /icy?url=...  → lê os metadados ICY (StreamTitle) e devolve JSON
 *                   { "title": "Artista - Faixa" } para o "Now Playing" real.
 *
 * Utilização:
 *   node proxy/server.cjs            (porta 8787, só neste PC)
 *   node proxy/server.cjs --lan      (acessível na rede Wi-Fi — teste no telemóvel)
 *   PORT=9000 node proxy/server.cjs
 *
 * Segurança: o proxy recusa destinos em redes privadas/loopback (router,
 * NAS, serviços locais), incluindo depois de redirecionamentos, para não
 * poder ser usado por terceiros para aceder à tua rede.
 */
'use strict';

const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 8787;
const MAX_REDIRECTS = 5;
const ICY_READ_TIMEOUT_MS = 8000;
const UA = 'RocWaves/1.0 (radio proxy)';
const LAN_MODE = process.argv.includes('--lan') || process.env.ROC_PROXY_LAN === '1';

/** true para endereços que não são internet pública (loopback, LAN, link-local, CGNAT, multicast...). */
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(low);
    if (mapped) return isPrivateAddress(mapped[1]);
    return low === '::' || low === '::1' || low.startsWith('fc') || low.startsWith('fd') ||
      low.startsWith('fe8') || low.startsWith('fe9') || low.startsWith('fea') || low.startsWith('feb') ||
      low.startsWith('ff');
  }
  return true;
}

/** dns.lookup que recusa IPs privados — aplicado à ligação real (imune a DNS rebinding). */
function safeLookup(hostname, options, cb) {
  dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return cb(err);
    const bad = addrs.find((a) => isPrivateAddress(a.address));
    if (bad) return cb(new Error('destino em rede privada bloqueado'));
    if (options && options.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}

/** Verifica se o host de um URL resolve só para IPs públicos. */
async function assertPublicHost(u) {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('destino em rede privada bloqueado');
    return;
  }
  const addrs = await dns.promises.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new Error('destino em rede privada bloqueado');
  }
}

/** fetch() com redirecionamentos manuais, validando cada salto contra redes privadas. */
async function safeFetch(url, opts, redirectsLeft = MAX_REDIRECTS) {
  const u = new URL(url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocolo inválido');
  await assertPublicHost(u);
  const res = await fetch(u, { ...opts, redirect: 'manual' });
  if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get('location')) {
    if (redirectsLeft <= 0) throw new Error('demasiados redirecionamentos');
    return safeFetch(new URL(res.headers.get('location'), u).href, opts, redirectsLeft - 1);
  }
  return res;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length, Icy-Name, Icy-Genre, Icy-Metaint');
}

function parseTarget(reqUrl) {
  const raw = new URL(reqUrl, 'http://localhost').searchParams.get('url');
  if (!raw) return null;
  let target;
  try { target = new URL(raw); } catch (e) { return null; }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;
  const host = target.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isPrivateAddress(host)) return null;
  return target;
}

function fetchStream(target, extraHeaders, redirectsLeft, cb) {
  const lib = target.protocol === 'https:' ? https : http;
  const req = lib.get(target, {
    headers: {
      'User-Agent': UA,
      'Accept': '*/*',
      'Icy-MetaData': '1',
      ...extraHeaders,
    },
    timeout: 10000,
    lookup: safeLookup,
  }, (res) => {
    // Seguir redirecionamentos manualmente (http não segue sozinho)
    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
      res.resume();
      try {
        const next = new URL(res.headers.location, target);
        if (next.protocol !== 'http:' && next.protocol !== 'https:') return cb(new Error('redirect inválido'));
        return fetchStream(next, extraHeaders, redirectsLeft - 1, cb);
      } catch (e) {
        return cb(new Error('redirect inválido'));
      }
    }
    cb(null, res, target);
  });
  req.on('timeout', () => req.destroy(new Error('timeout ao ligar ao stream')));
  req.on('error', (err) => cb(err));
}

/** /stream?url=... — tunel do stream com CORS. */
function handleStream(req, res) {
  const target = parseTarget(req.url);
  if (!target) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('url= inválida'); }

  fetchStream(target, {}, MAX_REDIRECTS, (err, upstream, finalUrl) => {
    if (err) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      return res.end('proxy: falha ao aceder ao stream (' + err.message + ')');
    }
    if (!upstream || (upstream.statusCode >= 400)) {
      if (upstream) upstream.resume();
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      return res.end('proxy: stream respondeu ' + (upstream && upstream.statusCode));
    }
    const headers = {
      'Content-Type': upstream.headers['content-type'] || 'audio/mpeg',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    };
    if (upstream.headers['icy-name']) headers['Icy-Name'] = upstream.headers['icy-name'];
    if (upstream.headers['icy-genre']) headers['Icy-Genre'] = upstream.headers['icy-genre'];
    res.writeHead(200, headers);
    upstream.pipe(res);
    res.on('close', () => upstream.destroy());
  });
}

/**
 * /icy?url=... — lê metadados ICY do stream e devolve { title }.
 * Estrutura ICY: [metaint bytes de áudio][1 byte n][n*16 bytes de metadados]
 * Metadados: StreamTitle='Artista - Faixa';StreamUrl='...';
 */
function extractStreamTitle(meta) {
  const m = /StreamTitle=([^;]*);/.exec(meta);
  if (!m) return null;
  let title = m[1].trim();
  if (title.startsWith("'") || title.startsWith('"')) title = title.slice(1);
  if (title.endsWith("'") || title.endsWith('"')) title = title.slice(0, -1);
  title = title.trim();
  if (!title) return null;

  // Algumas rádios (ex.: Bauermedia) enviam XML dentro do StreamTitle:
  // extrair artista + faixa dos campos daletsong em vez de devolver o XML cru.
  if (title.startsWith('<?xml') || title.includes('<RadioInfo>')) {
    const pick = (tag) => {
      const mm = new RegExp(`<${tag}>(.*?)</${tag}>`).exec(title);
      return mm ? mm[1].trim() : '';
    };
    const artist = pick('DB_DALET_ARTIST_NAME') || pick('DB_LEAD_ARTIST_NAME');
    const song = pick('DB_DALET_TITLE_NAME') || pick('DB_SONG_NAME');
    if (artist || song) return [artist, song].filter(Boolean).join(' - ');
    return null;
  }
  return title;
}

/** Os metadados ICY podem vir em latin1 ou UTF-8: preferir UTF-8 quando válido. */
function decodeMeta(buf) {
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;
  return buf.toString('latin1');
}

function handleIcy(req, res) {
  const target = parseTarget(req.url);
  if (!target) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('url= inválida'); }

  fetchStream(target, {}, MAX_REDIRECTS, (err, upstream) => {
    if (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
    if (!upstream || upstream.statusCode >= 400 || !upstream.headers['icy-metaint']) {
      if (upstream) upstream.resume();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ title: null, reason: upstream && upstream.headers['icy-metaint'] === undefined ? 'sem icy-metaint' : 'stream indisponível' }));
    }

    const metaint = parseInt(upstream.headers['icy-metaint'], 10);
    let audioBytes = 0;
    let readingMetaLen = false;
    let metaLen = 0;
    let metaBuf = Buffer.alloc(0);
    let done = false;

    const finish = (title) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      upstream.destroy();
      setCors(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ title }));
    };

    const timer = setTimeout(() => finish(null), ICY_READ_TIMEOUT_MS);

    upstream.on('data', (chunk) => {
      if (done) return;
      let buf = chunk;
      while (buf.length > 0) {
        if (!readingMetaLen) {
          const need = metaint - audioBytes;
          if (buf.length < need) { audioBytes += buf.length; return; }
          buf = buf.slice(need);
          audioBytes = 0;
          readingMetaLen = true;
        } else if (metaLen === 0) {
          metaLen = buf[0] * 16;
          buf = buf.slice(1);
          if (metaLen === 0) {
            // bloco vazio: recomeça o ciclo de áudio
            readingMetaLen = false;
            continue;
          }
        } else {
          const need = metaLen - metaBuf.length;
          metaBuf = Buffer.concat([metaBuf, buf.slice(0, Math.min(need, buf.length))]);
          buf = buf.slice(Math.min(need, buf.length));
          if (metaBuf.length >= metaLen) {
            const meta = decodeMeta(metaBuf);
            const title = extractStreamTitle(meta);
            finish(title);
            return;
          }
        }
      }
    });

    upstream.on('error', () => finish(null));
    upstream.on('end', () => finish(null));
  });
}

/**
 * /extract?url=... — extrai o URL do stream de um site de rádio.
 * Estratégias:
 *   1. URLs "stream-ish" no HTML e nos bundles JS (script src).
 *   2. Padrão Supabase (apps Lovable/React): projeto + anon key no bundle →
 *      tabelas de configuração comuns (site_settings, settings, ...).
 *   3. Subdomínios clássicos de streaming (stream./radio./live./listen.).
 * Os candidatos são testados com GET Range; devolve o primeiro que responde
 * áudio: { found, stream, title, tested }.
 */
const STREAMISH = /(stream|listen|live|direct|audio|\.mp3|\.m3u8|\.aac|\.pls|\.ogg|icecast|shoutcast|radioca|azuracast|zeno\.fm|iono\.fm|fastcast|streamguys|securenetsystems|radiojar|samcloud)/i;
const NOT_STREAM_EXT = /\.(png|jpe?g|gif|webp|svg|css|js|json|woff2?|ttf|ico|txt|xml|mp4|webm)(\?|#|$)/i;

function isStreamishUrl(u) {
  if (!/^https?:\/\//i.test(u)) return false;
  if (NOT_STREAM_EXT.test(u)) return false;
  return STREAMISH.test(u);
}

function collectUrls(text, into) {
  const re = /https?:\/\/[^\s"'<>`\\)\]]+/g;
  let m;
  while ((m = re.exec(text))) {
    const u = m[0].replace(/[.,;]+$/, '');
    if (isStreamishUrl(u)) into.add(u);
  }
}

async function fetchText(url, timeoutMs) {
  const res = await safeFetch(url, {
    headers: { 'User-Agent': UA, 'Accept': '*/*' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return null;
  return res.text();
}

async function quickStreamProbe(url) {
  try {
    const res = await safeFetch(url, {
      headers: { 'User-Agent': UA, 'Range': 'bytes=0-1024', 'Accept': '*/*', 'Icy-MetaData': '1' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.status !== 200 && res.status !== 206) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const hasIcy = !!res.headers.get('icy-name') || !!res.headers.get('icy-br');
    if (ct.startsWith('audio/') || ct.includes('ogg') || ct.includes('mpegurl') || ct.includes('octet-stream') || hasIcy || ct === '') {
      return {
        icyName: res.headers.get('icy-name') || null,
        icyBr: res.headers.get('icy-br') ? parseInt(res.headers.get('icy-br'), 10) : null,
      };
    }
    return null;
  } catch (e) { return null; }
}

async function supabaseCandidates(jsText, into) {
  const proj = /https?:\/\/([a-z0-9]+)\.supabase\.co/i.exec(jsText);
  const key = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.exec(jsText);
  if (!proj || !key) return;
  const headers = { apikey: key[0], Authorization: 'Bearer ' + key[0] };
  for (const table of ['site_settings', 'settings', 'config', 'streams', 'stations', 'radio_settings', 'radio']) {
    try {
      const res = await safeFetch(`https://${proj[1]}.supabase.co/rest/v1/${table}?select=*&limit=50`, {
        headers, signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const rows = await res.json();
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        for (const v of Object.values(row)) {
          if (typeof v === 'string' && isStreamishUrl(v)) into.add(v);
        }
      }
    } catch (e) { /* tabela inexistente ou sem permissões */ }
  }
}

function handleExtract(req, res) {
  const target = parseTarget(req.url);
  if (!target) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'url= inválida' })); }

  (async () => {
    const candidates = new Set();
    let title = null;
    let pageUrl = target.href;
    try {
      const html = await fetchText(pageUrl, 7000);
      if (html) {
        collectUrls(html, candidates);
        const tm = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
        if (tm) title = tm[1].trim();
        const srcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
          .map((mm) => { try { return new URL(mm[1], pageUrl).href; } catch (e) { return null; } })
          .filter(Boolean).slice(0, 5);
        for (const s of srcs) {
          try {
            const js = await fetchText(s, 7000);
            if (js) {
              collectUrls(js, candidates);
              await supabaseCandidates(js, candidates);
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    // subdomínios clássicos de streaming do próprio domínio
    try {
      const host = new URL(pageUrl).hostname.replace(/^www\./, '');
      const parts = host.split('.');
      const reg = parts.length >= 2 ? parts.slice(-2).join('.') : host;
      for (const sub of ['stream', 'radio', 'listen', 'live', 'streaming', 'player']) {
        candidates.add(`https://${sub}.${reg}/stream`);
        candidates.add(`https://${sub}.${reg}/live`);
      }
    } catch (e) {}

    for (const u of candidates) {
      const probe = await quickStreamProbe(u);
      if (probe) {
        setCors(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          found: true, stream: u, title: title || probe.icyName,
          bitrate: probe.icyBr || null, tested: candidates.size,
        }));
      }
    }
    setCors(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ found: false, stream: null, title, tested: candidates.size }));
  })().catch(() => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ found: false, error: 'falha ao aceder ao site' }));
  });
}

const server = http.createServer((req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/ping') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('pong'); }
  if (path === '/stream') return handleStream(req, res);
  if (path === '/icy') return handleIcy(req, res);
  if (path === '/extract') return handleExtract(req, res);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Roc Waves proxy: usar /ping, /stream?url=..., /icy?url=..., /extract?url=...');
});

// Por omissão só aceita ligações deste PC. Com --lan escuta em 0.0.0.0 para
// testar no telemóvel na mesma rede Wi-Fi (a app deteta http://<ip-do-pc>:8787).
const HOST = LAN_MODE ? '0.0.0.0' : '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`🎧 Roc Waves proxy ativo em http://localhost:${PORT}${LAN_MODE ? ' (modo rede local: acessível na Wi-Fi)' : ''}`);
  console.log('   Endpoints: /ping | /stream?url= | /icy?url= | /extract?url=<site>');
});
