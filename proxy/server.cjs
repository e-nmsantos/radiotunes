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
 *   node proxy/server.cjs            (porta 8787)
 *   PORT=9000 node proxy/server.cjs
 */
'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 8787;
const MAX_REDIRECTS = 5;
const ICY_READ_TIMEOUT_MS = 8000;
const UA = 'RocWaves/1.0 (radio proxy)';

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
  }, (res) => {
    // Seguir redirecionamentos manualmente (http não segue sozinho)
    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
      res.resume();
      try {
        const next = new URL(res.headers.location, target);
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

const server = http.createServer((req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/ping') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('pong'); }
  if (path === '/stream') return handleStream(req, res);
  if (path === '/icy') return handleIcy(req, res);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Roc Waves proxy: usar /ping, /stream?url=..., /icy?url=...');
});

server.listen(PORT, () => {
  console.log(`🎧 Roc Waves proxy ativo em http://localhost:${PORT}`);
  console.log('   Endpoints: /ping | /stream?url=<stream> | /icy?url=<stream>');
});
