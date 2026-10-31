// Testes da estrutura dos módulos — executar com: node --test "test/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const modules = fs.readdirSync(path.join(ROOT, 'js/app')).filter((f) => f.endsWith('.js'));

const inHtml = [...read('index.html').matchAll(/<script src="js\/app\/([\w-]+\.js)"( defer)?><\/script>/g)].map((m) => m[1]);
const inSw = [...read('sw.js').matchAll(/'\.\/js\/app\/([\w-]+\.js)'/g)].map((m) => m[1]);

test('todos os módulos de js/app/ são carregados pelo index.html', () => {
  assert.deepEqual([...inHtml].sort(), [...modules].sort());
});

test('o service worker guarda os mesmos módulos, pela mesma ordem (app offline)', () => {
  assert.deepEqual(inSw, inHtml);
});

test('core.js carrega primeiro e init.js por último', () => {
  assert.equal(inHtml[0], 'core.js');
  assert.equal(inHtml.at(-1), 'init.js');
});

test('nenhum modal/sheet fica aninhado dentro de outro (ficaria invisível)', () => {
  // Um </div> em falta já escondeu 5 modais dentro do "Adicionar Rádio".
  const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
  const stack = [];
  const nested = [];
  for (const m of html.matchAll(/<(\/?)div\b([^>]*)>/g)) {
    if (m[1]) { stack.pop(); continue; }
    const id = (/\bid="([^"]+)"/.exec(m[2]) || [])[1] || '';
    const isOverlay = /(modal|sheet)$/.test(id);
    if (isOverlay) {
      const parent = stack.filter(Boolean).at(-1);
      if (parent) nested.push(`${id} dentro de ${parent}`);
    }
    stack.push(isOverlay ? id : null);
  }
  assert.deepEqual(nested, []);
  assert.equal(stack.length, 0, 'há <div> por fechar');
});

test('os scripts locais são pré-carregados no <head> e executados no fim do <body>', () => {
  const [head, body] = read('index.html').split('</head>');
  const scripts = [...body.matchAll(/<script src="(js\/[^"]+)"/g)].map((m) => m[1]);
  const preloads = [...head.matchAll(/<link rel="preload" href="(js\/[^"]+)" as="script">/g)].map((m) => m[1]);
  assert.ok(scripts.length >= 14);
  assert.deepEqual(preloads, scripts, 'cada script tem preload, pela mesma ordem');
  assert.doesNotMatch(head, /<script src="js\//, 'nenhum script local no <head>');
  assert.ok(body.lastIndexOf('<script src="js/') > body.lastIndexOf('<audio'), 'scripts depois do conteúdo');
});
