// Testes da estrutura dos módulos — executar com: node --test "test/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const modules = fs.readdirSync(path.join(ROOT, 'js/app')).filter((f) => f.endsWith('.js'));

const inHtml = [...read('index.html').matchAll(/<script src="js\/app\/([\w-]+\.js)"><\/script>/g)].map((m) => m[1]);
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
