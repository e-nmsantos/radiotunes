/*!
 * RocStorage — camada de persistência IndexedDB com cache TTL
 * Substitui o localStorage para dados volumosos (catálogos descobertos,
 * respostas da API radio-browser) que excedem a quota de ~5 MB.
 * API: RocStorage.get/set (loja "kv"), RocStorage.cachedFetchJson(url, ttlMs)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RocStorage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DB_NAME = 'rocwaves-db';
  const DB_VERSION = 1;
  const STORE_KV = 'kv';        // valores genéricos { t, v }
  const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB indisponível'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(store, mode, fn) {
    return openDb().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  /** Guarda um valor com timestamp. Devolve false se o IndexedDB falhar. */
  async function set(key, value) {
    try {
      await tx(STORE_KV, 'readwrite', store => store.put({ t: Date.now(), v: value }, key));
      return true;
    } catch (e) {
      console.warn('RocStorage.set falhou:', e);
      return false;
    }
  }

  /** Lê um valor ainda válido (ttlMs opcional). null se ausente/expirado. */
  async function get(key, ttlMs) {
    try {
      const row = await tx(STORE_KV, 'readonly', store => store.get(key));
      if (!row) return null;
      if (ttlMs !== undefined && Date.now() - row.t > ttlMs) return null;
      return row.v;
    } catch (e) {
      return null;
    }
  }

  async function remove(key) {
    try {
      await tx(STORE_KV, 'readwrite', store => store.delete(key));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * fetch JSON com cache IndexedDB por TTL (evita bater em cada zoom do mapa
   * nos servidores da radio-browser, que aplicam rate-limiting).
   * Fallback transparento para fetch normal sem cache.
   */
  async function cachedFetchJson(url, ttlMs = DEFAULT_TTL_MS, fetchOpts) {
    const cacheKey = 'cache:' + url;
    const cached = await get(cacheKey, ttlMs);
    if (cached !== null) return cached;

    const res = await fetch(url, fetchOpts);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' em ' + url);
    const data = await res.json();
    set(cacheKey, data); // best-effort
    return data;
  }

  return { set, get, remove, cachedFetchJson, DEFAULT_TTL_MS };
});
