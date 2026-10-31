// Testes dos dicionários de tradução — executar com: node --test "test/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N = new Function(fs.readFileSync(path.join(ROOT, 'js/i18n.js'), 'utf8') + ';return I18N;')();
const LANGS = ['pt', 'en', 'es', 'fr'];

test('os 4 idiomas têm exatamente as mesmas chaves', () => {
  const base = Object.keys(I18N.pt).sort();
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(I18N[lang]).sort(), base, `chaves diferentes em ${lang}`);
  }
});

test('nenhuma tradução está vazia', () => {
  for (const lang of LANGS) {
    for (const [k, v] of Object.entries(I18N[lang])) {
      assert.ok(typeof v === 'string' && v.trim(), `${lang}.${k} vazio`);
    }
  }
});

test('os marcadores {x} são os mesmos em todos os idiomas', () => {
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  for (const k of Object.keys(I18N.pt)) {
    for (const lang of LANGS) {
      assert.equal(vars(I18N[lang][k]), vars(I18N.pt[k]), `${lang}.${k}`);
    }
  }
});

test('todas as chaves usadas no código existem no dicionário', () => {
  const sources = ['js/app.js', 'index.html'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  const used = new Set([
    ...[...sources.matchAll(/\bt\('(\w+)'/g)].map((m) => m[1]),
    ...[...sources.matchAll(/data-i18n="(\w+)"/g)].map((m) => m[1]),
  ]);
  const missing = [...used].filter((k) => !(k in I18N.pt));
  assert.deepEqual(missing, []);
});
