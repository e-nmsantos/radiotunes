#!/usr/bin/env node
/**
 * Roc Waves — Servidor para teste no telemóvel (zero dependências)
 * Serve a app em http://0.0.0.0:8080 — acessível a partir de qualquer
 * aparelho na mesma rede Wi-Fi (telemóvel, tablet, TV).
 *   node tools/serve.cjs            (porta 8080)
 *   PORT=9000 node tools/serve.cjs
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webm': 'video/webm',
  '.m3u': 'audio/x-mpegurl; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end(); }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('404'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === 'IPv4' && !i.internal) lan.push(i.address);
    }
  }
  console.log('🎧 Roc Waves — servidor para telemóvel ativo\n');
  console.log('  No PC:        http://localhost:' + PORT);
  for (const ip of lan) console.log('  No telemóvel:  http://' + ip + ':' + PORT + '   ← abre isto no telemóvel (mesma Wi-Fi)');
  console.log('\n  Se não abrir: deixa o Node passar na firewall do Windows ("Permitir acesso").');
  console.log('  Para DSP total no telemóvel, corre também proxy.bat no PC.');
  console.log('  Ctrl + C para parar.\n');
});
