#!/usr/bin/env node
/**
 * Roc Waves — Agente de Saúde do Catálogo 🩺
 * ------------------------------------------------
 * Audita constantemente os 88 streams + logos do MASTER_CATALOG:
 *   • classificação: OK | MORTO (4xx/5xx) | INACESSÍVEL (rede/TLS/geo)
 *   • deteta se o stream suporta CORS (→ DSP no browser sem proxy)
 *   • para streams mortos, sugere substitutos da radio-browser com
 *     validação: país igual + semelhança de nome + stream acessível
 *
 * Utilização:
 *   node tools/health-check.cjs            → relatório (tools/reports/)
 *   node tools/health-check.cjs --fix      → + aplica substituições SEGURAS
 *                                            (só 4xx/5xx confirmados)
 *   node tools/health-check.cjs --json    → só imprime o JSON
 *
 * CI: .github/workflows/health-check.yml corre semanalmente e abre um
 * issue no GitHub com as estações em falha (detenção contínua sem servidor).
 *
 * Saída: exit 0 = catálogo saudável; exit 1 = há falhas.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_PATH = path.join(ROOT, 'js', 'catalog.js'); // MASTER_CATALOG vive aqui desde a modularização
const REPORT_DIR = path.join(__dirname, 'reports');
const FIX = process.argv.includes('--fix');
const PRUNE = process.argv.includes('--prune');
const JSON_ONLY = process.argv.includes('--json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const ORIGIN = 'https://e-nmsantos.github.io';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Catálogo ----------

function parseCatalog() {
  const src = fs.readFileSync(APP_PATH, 'utf-8');
  const m = /const MASTER_CATALOG = \[(.*?)\n    \];/s.exec(src);
  if (!m) throw new Error('MASTER_CATALOG não encontrado em js/catalog.js');
  const parts = src.slice(m.index, m.index + m[0].length).split(/(id:\s*"(?:m_[\w]+)")/);
  const stations = [];
  for (let i = 1; i < parts.length; i += 2) {
    const ch = parts[i + 1] || '';
    const get = (key) => {
      const mm = new RegExp(key + ':\\s*"([^"]*)"').exec(ch);
      return mm ? mm[1] : null;
    };
    const getNum = (key) => {
      const mm = new RegExp(key + ':\\s*(\\d+)').exec(ch);
      return mm ? Number(mm[1]) : null;
    };
    stations.push({
      id: /"(m_[\w]+)"/.exec(parts[i])[1],
      name: get('name') || '?',
      country: get('country') || '',
      stream_url: get('stream_url'),
      image: get('image'),
      bit_rate: getNum('bit_rate'),
    });
  }
  return stations;
}

// ---------- Sondas ----------

async function probeStream(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Range': 'bytes=0-1024', 'Accept': '*/*', 'Origin': ORIGIN },
      signal: AbortSignal.timeout(7000),
      redirect: 'follow',
    });
    const acao = res.headers.get('access-control-allow-origin');
    const cors = acao === '*' || (acao || '').includes('e-nmsantos.github.io');
    if (res.status === 200 || res.status === 206) {
      // 200 não basta: streams "desligados" que redirecionam para a
      // homepage (ex.: BBC) respondem 200 text/html — exigir áudio real.
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const hasIcy = !!res.headers.get('icy-name') || !!res.headers.get('icy-br');
      const audioish = ct.startsWith('audio/') || ct.includes('mpegurl') ||
        ct.includes('ogg') || ct.includes('octet-stream') || ct === '' || hasIcy;
      const reader = res.body && res.body.getReader ? res.body.getReader() : null;
      if (reader) {
        await Promise.race([reader.read(), sleep(2000)]);
        try { await reader.cancel(); } catch (e) {}
      }
      if (!audioish) return { status: res.status, ok: false, cors, html: true };
      return { status: res.status, ok: true, cors };
    }
    return { status: res.status, ok: false, cors };
  } catch (e) {
    // Distinguir DNS morto (permanente) de falhas TLS/rede (transitórias)
    let dnsDead = false;
    try {
      const { lookup } = require('dns').promises;
      await lookup(new URL(url).hostname);
    } catch (dnsErr) { dnsDead = true; }
    return { status: 0, ok: false, cors: false, dnsDead };
  }
}

async function probeLogo(url) {
  if (!url) return { ok: true, skipped: true };
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Range': 'bytes=0-0', 'Accept': 'image/*,*/*' },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    });
    if (res.status < 400) {
      const reader = res.body && res.body.getReader ? res.body.getReader() : null;
      if (reader) { try { await reader.cancel(); } catch (e) {} }
      return { ok: true };
    }
    return { ok: false, status: res.status };
  } catch (e) {
    return { ok: false, status: 0 };
  }
}

// ---------- Sugestões (radio-browser) com guardas ----------

const deaccent = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const tokens = (s) => deaccent(s).split(/[^a-z0-9]+/).filter((t) => t.length > 3);

function nameMatches(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return false;
  const shared = ta.filter((t) => tb.includes(t)).length;
  return shared >= Math.min(2, Math.min(ta.length, tb.length));
}

async function suggestReplacement(st) {
  const q = st.name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  for (const srv of ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info']) {
    try {
      const res = await fetch(
        `${srv}/json/stations/search?name=${encodeURIComponent(q)}&limit=15&order=clickcount&reverse=true`,
        { signal: AbortSignal.timeout(9000) }
      );
      if (!res.ok) continue;
      const list = await res.json();
      const pool = list.filter((s) => (s.country || '').toLowerCase() === st.country.toLowerCase());
      for (const s of (pool.length ? pool : [])) {
        const url = s.url_resolved || s.url;
        if (!url || !url.startsWith('http')) continue;
        if (!nameMatches(st.name, s.name)) continue;
        const probe = await probeStream(url);
        if (probe.ok) {
          return { url, bitrate: s.bitrate || null, source: s.name, via: srv.replace('https://', '') };
        }
        await sleep(200);
      }
    } catch (e) { /* servidor indisponível */ }
  }
  return null;
}

async function suggestLogoReplacement(st) {
  const q = st.name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (!q || q.length < 3) return null;
  for (const srv of ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info']) {
    try {
      const res = await fetch(
        `${srv}/json/stations/search?name=${encodeURIComponent(q)}&limit=15&order=clickcount&reverse=true&hidebroken=true&lastcheckok=1`,
        { signal: AbortSignal.timeout(9000) }
      );
      if (!res.ok) continue;
      const list = await res.json();
      const pool = list.filter((s) => (s.country || '').toLowerCase() === st.country.toLowerCase());
      for (const s of (pool.length ? pool : [])) {
        const fav = s.favicon;
        if (!fav || !fav.startsWith('http')) continue;
        // o nome tem de bater (guarda editorial contra logos trocados)
        const a = deaccent(st.name), b = deaccent(s.name || '');
        const shared = a.split(/[^a-z0-9]+/).filter((t) => t.length > 3 && b.includes(t)).length;
        if (shared === 0) continue;
        try {
          const check = await fetch(fav, { method: 'HEAD', signal: AbortSignal.timeout(6000) });
          if (check.ok) return fav;
        } catch (e) {}
      }
    } catch (e) { /* servidor indisponível */ }
  }
  return null;
}

// ---------- Main ----------

(async () => {
  const catalog = parseCatalog();
  const results = [];
  let checked = 0;

  for (const st of catalog) {
    const stream = await probeStream(st.stream_url);
    const logo = st.image ? await probeLogo(st.image) : { ok: true, skipped: true };
    const row = {
      id: st.id, name: st.name, country: st.country,
      stream_status: stream.ok ? 'OK'
        : (stream.html ? 'MORTO(página web)'
        : (stream.dnsDead ? 'MORTO(DNS)'
        : (stream.status >= 400 ? `MORTO(${stream.status})` : 'INACESSÍVEL'))),
      cors_dsp: stream.cors,
      logo_status: logo.skipped ? 'SEM LOGO (monograma)' : (logo.ok ? 'OK' : `MORTO(${logo.status})`),
    };
    // Só streams confirmadamente mortos (4xx/5xx ou redirect para página)
    // recebem sugestão automática; falhas de rede ficam para revisão humana.
    if (!stream.ok && (stream.status >= 400 || stream.html)) {
      const sug = await suggestReplacement(st);
      if (sug) {
        row.suggestion = sug.url;
        row.suggestion_source = sug.source;
        row.suggestion_bitrate = sug.bitrate;
        results.push(row);
        checked++;
        process.stdout.write('!');
        continue;
      }
    }
    // Logos mortos (HTTP >= 400) também recebem sugestão automática de favicon
    if (!logo.ok && !logo.skipped) {
      const logoSug = await suggestLogoReplacement(st);
      if (logoSug) row.logo_suggestion = logoSug;
    }
    results.push(row);
    checked++;
    process.stdout.write(stream.ok && (logo.ok || logo.skipped) ? '.' : 'X');
    await sleep(350);
  }

  const deadStreams = results.filter((r) => r.stream_status !== 'OK');
  const deadLogos = results.filter((r) => r.logo_status.startsWith('MORTO'));
  const dspOk = results.filter((r) => r.cors_dsp).length;

  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      total: results.length,
      streams_ok: results.length - deadStreams.length,
      streams_dead: deadStreams.length,
      logos_dead: deadLogos.length,
      streams_with_cors_dsp: dspOk,
    },
    stations: results,
  };

  // ---------- --fix: aplicar substituições seguras ----------
  if (FIX) {
    const fixes = results.filter((r) => r.suggestion && r.stream_status.startsWith('MORTO'));
    if (fixes.length) {
      let src = fs.readFileSync(APP_PATH, 'utf-8');
      for (const f of fixes) {
        const esc = f.id.replace(/[$()*+.?[^\\]|]/g, '\\$&');
        const re = new RegExp(`(id:\\s*"${esc}",[\\s\\S]*?stream_url:\\s*)"[^"]*"`);
        if (re.test(src)) {
          src = src.replace(re, `$1"${f.suggestion}"`);
          console.log(`\n✔ ${f.name} (${f.id}) → ${f.suggestion} [fonte: ${f.suggestion_source}]`);
        }
        if (f.suggestion_bitrate) {
          const reBr = new RegExp(`(id:\\s*"${esc}",[\\s\\S]*?bit_rate:\\s*)\\d+`);
          src = src.replace(reBr, `$1${f.suggestion_bitrate}`);
        }
      }
      // ---------- logos mortos: aplicar favicons substitutos ----------
      const logoFixes = results.filter((r) => r.logo_suggestion && r.logo_status.startsWith('MORTO'));
      for (const f of logoFixes) {
        const esc = f.id.replace(/[$()*+.?[^\\]|]/g, '\\$&');
        const reImg = new RegExp(`(id:\\s*"${esc}",[\\s\\S]*?image:\\s*)"[^"]*"`);
        if (reImg.test(src)) {
          src = src.replace(reImg, `$1"${f.logo_suggestion}"`);
          console.log(`\n🖼️ ${f.name} (${f.id}) logo → ${f.logo_suggestion}`);
        }
      }
      fs.writeFileSync(APP_PATH, src, 'utf-8');
      console.log(`\n🔧 ${fixes.length} streams + ${logoFixes.length} logos reparados e gravados em js/catalog.js`);
    } else {
      // mesmo sem streams mortos, pode haver logos mortos para reparar
      const logoFixes = results.filter((r) => r.logo_suggestion && r.logo_status.startsWith('MORTO'));
      if (logoFixes.length) {
        let src = fs.readFileSync(APP_PATH, 'utf-8');
        for (const f of logoFixes) {
          const esc = f.id.replace(/[$()*+.?[^\\]|]/g, '\\$&');
          const reImg = new RegExp(`(id:\\s*"${esc}",[\\s\\S]*?image:\\s*)"[^"]*"`);
          if (reImg.test(src)) {
            src = src.replace(reImg, `$1"${f.logo_suggestion}"`);
            console.log(`\n🖼️ ${f.name} (${f.id}) logo → ${f.logo_suggestion}`);
          }
        }
        fs.writeFileSync(APP_PATH, src, 'utf-8');
        console.log(`\n🔧 ${logoFixes.length} logos reparados e gravados em js/catalog.js`);
      } else {
        console.log('\n🔧 --fix: nenhuma substituição segura a aplicar');
      }
    }
  }

  // ---------- --prune: eliminar estações irrecoveráveis ----------
  // Critérios de morte PERMANENTE (nunca eliminamos outages transitórios):
  // HTTP 404/410, redirect para página web, ou DNS inexistente — sempre
  // sem substituto verificado. Falhas 5xx/TLS ficam com badge para revisão.
  if (PRUNE) {
    const prunable = results.filter(r =>
      !r.suggestion &&
      (r.stream_status === 'MORTO(404)' || r.stream_status === 'MORTO(410)' ||
       r.stream_status === 'MORTO(página web)' || r.stream_status === 'MORTO(DNS)'));
    if (prunable.length) {
      let src = fs.readFileSync(APP_PATH, 'utf-8');
      for (const st of prunable) {
        const esc = st.id.replace(/[$()*+.?[^\]\\|]/g, '\\$&');
        const reBlock = new RegExp('\\n\\s*\\{\\s*\\n\\s*id:\\s*"' + esc + '",[\\s\\S]*?\\n\\s*\\},?');
        const before = src.length;
        src = src.replace(reBlock, '');
        if (src.length < before) {
          console.log(`🗑️ ${st.name} (${st.id}) eliminada — ${st.stream_status}, sem substituto conhecido`);
        }
      }
      fs.writeFileSync(APP_PATH, src, 'utf-8');
      console.log(`\n🗑️ ${prunable.length} estações removidas do catálogo`);
    } else {
      console.log('\n🗑️ --prune: nenhuma estação irrecoverável');
    }
  }

  // ---------- Relatórios ----------
  if (!JSON_ONLY) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(path.join(REPORT_DIR, 'health-report.json'), JSON.stringify(report, null, 2));

    const md = [];
    md.push('# 🩺 Relatório de Saúde do Catálogo — Roc Waves');
    md.push('');
    md.push(`Gerado: **${report.generated_at}**`);
    md.push('');
    md.push(`| Métrica | Valor |`);
    md.push(`|---|---|`);
    md.push(`| Estações auditadas | ${report.summary.total} |`);
    md.push(`| Streams OK | ${report.summary.streams_ok} |`);
    md.push(`| Streams em falha | ${report.summary.streams_dead} |`);
    md.push(`| Logos em falha | ${report.summary.logos_dead} |`);
    md.push(`| Streams com CORS (DSP direto) | ${report.summary.streams_with_cors_dsp} |`);
    md.push('');
    if (deadStreams.length || deadLogos.length) {
      md.push('## ⚠️ Falhas detetadas');
      md.push('');
      md.push('| Estação | Stream | Logo | Sugestão stream | Sugestão logo |');
      md.push('|---|---|---|---|---|');
      for (const r of [...new Set([...deadStreams, ...deadLogos])]) {
        md.push(`| ${r.name} (${r.country}) | ${r.stream_status} | ${r.logo_status} | ${r.suggestion ? `${r.suggestion} ← _${r.suggestion_source}_` : '—'} | ${r.logo_suggestion ? r.logo_suggestion : '—'} |`);
      }
      md.push('');
      md.push('_Para reparar automaticamente os casos confirmados: `node tools/health-check.cjs --fix`_');
    } else {
      md.push('## ✅ Catálogo 100% saudável');
      md.push('');
      md.push('Todos os streams e logos responderam corretamente.');
    }
    fs.writeFileSync(path.join(REPORT_DIR, 'summary.md'), md.join('\n') + '\n');
  }

  console.log(`\n\nEstações: ${report.summary.total} | Streams OK: ${report.summary.streams_ok} | Falhas: ${report.summary.streams_dead} | Logos falha: ${report.summary.logos_dead} | DSP direto: ${dspOk}`);
  if (!JSON_ONLY) console.log(`Relatórios: tools/reports/health-report.json + summary.md`);

  process.exitCode = (deadStreams.length || deadLogos.length) ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 2; });
