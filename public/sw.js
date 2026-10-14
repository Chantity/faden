/*
 * Faden – eigener, minimaler Service Worker (SPEC 9.2, Variante B;
 * Begründung in docs/DECISIONS.md, Kap. 3).
 *
 * Grundsätze:
 * - Diese Datei ist zwischen Builds BYTE-IDENTISCH. Der Browser findet deshalb
 *   nie eine „neue Version" von sw.js und aktualisiert nicht von selbst
 *   (SPEC 9.3: keine Auto-Updates). Was zu cachen ist, steht in der beim Build
 *   erzeugten `precache-manifest.json` (scripts/precache.mjs).
 * - Cache-first, immer. Navigationen bekommen die gecachte index.html.
 * - Caches werden NIE gelöscht, weil der Server 404/5xx/HTML/Weiterleitungen
 *   liefert oder nicht erreichbar ist. Kein Selbst-Deregistrieren.
 * - Ein alter Precache wird erst gelöscht, wenn ein neuer vollständig und
 *   fehlerfrei geladen ist (nur über ein ausdrückliches Update).
 */

const PREFIX = 'faden-v1-';
const META_CACHE = 'faden-meta';
const ACTIVE_KEY = 'active';
const MANIFEST_URL = 'precache-manifest.json';
const INDEX_URL = 'index.html';

/** Gemerkter offener Precache (wird nach einem Update zurückgesetzt). */
let activeCache = null;

const scopeUrl = (path) => new URL(path, self.registration.scope).href;

/** Liest, welcher Precache gerade gilt: { cache, version, build, files } oder null. */
async function readActive() {
  const meta = await caches.open(META_CACHE);
  const res = await meta.match(scopeUrl(ACTIVE_KEY));
  if (!res) return null;
  try {
    const info = await res.json();
    return (await caches.has(info.cache)) ? info : null;
  } catch {
    return null;
  }
}

async function writeActive(info) {
  const meta = await caches.open(META_CACHE);
  await meta.put(
    scopeUrl(ACTIVE_KEY),
    new Response(JSON.stringify(info), { headers: { 'content-type': 'application/json' } }),
  );
}

function isValidManifest(m) {
  return (
    m !== null &&
    typeof m === 'object' &&
    m.app === 'faden' &&
    typeof m.version === 'string' &&
    typeof m.build === 'string' &&
    /^[0-9a-f]+$/.test(m.build) &&
    Array.isArray(m.files) &&
    m.files.length > 0 &&
    m.files.every((f) => f && typeof f.url === 'string' && !/^[a-z]+:|^\/\//i.test(f.url)) &&
    m.files.some((f) => f.url === INDEX_URL)
  );
}

/** Holt die Precache-Liste vom Server. Wirft bei allem, was nicht eindeutig gültig ist. */
async function fetchManifest() {
  const res = await fetch(scopeUrl(MANIFEST_URL), { cache: 'no-store' });
  if (!res.ok || res.redirected) throw new Error(`manifest: HTTP ${res.status}`);
  const manifest = await res.json();
  if (!isValidManifest(manifest)) throw new Error('manifest: invalid');
  return manifest;
}

/**
 * Lädt alle Dateien einer Precache-Liste in einen NEUEN Cache. Erst wenn jede
 * Datei mit HTTP 200 da ist, wird er aktiv; danach (und nur dann) wird der
 * vorherige Precache entfernt. Schlägt etwas fehl, bleibt alles beim Alten.
 */
async function installManifest(manifest) {
  const name = PREFIX + manifest.build;
  const previous = await readActive();
  if (previous && previous.cache === name) return previous;

  const cache = await caches.open(name);
  try {
    for (const file of manifest.files) {
      const url = scopeUrl(file.url);
      const res = await fetch(new Request(url, { cache: 'reload' }));
      if (!res.ok || res.redirected || res.type !== 'basic') {
        throw new Error(`precache: ${file.url} HTTP ${res.status}`);
      }
      await cache.put(url, res);
    }
  } catch (err) {
    // Nur den eigenen, unvollständigen NEUEN Cache verwerfen.
    if (!previous || previous.cache !== name) await caches.delete(name);
    throw err;
  }

  const info = {
    cache: name,
    version: manifest.version,
    build: manifest.build,
    files: manifest.files.length,
    installedAt: new Date().toISOString(),
  };
  await writeActive(info);
  activeCache = null;
  if (previous && previous.cache !== name) await caches.delete(previous.cache);
  return info;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Ist schon eine vollständige Version da, bleibt sie (kein stilles Update).
      if (await readActive()) return;
      await installManifest(await fetchManifest());
    })(),
  );
});

self.addEventListener('activate', (event) => {
  // Bewusst KEIN Löschen von Caches hier.
  event.waitUntil(self.clients.claim());
});


async function openActiveCache() {
  if (!activeCache) {
    const info = await readActive();
    activeCache = info ? await caches.open(info.cache) : null;
  }
  return activeCache;
}

async function respond(request) {
  const cache = await openActiveCache();
  if (cache) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const index = await cache.match(scopeUrl(INDEX_URL));
      if (index) return index;
    }
  }
  // Notlösung bei Cache-Miss (z. B. vor dem ersten vollständigen Precache).
  return fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(respond(request));
});

/**
 * Nachrichten der Seite:
 * - { type: 'status' }       → { active }
 * - { type: 'check-update' } → { status: 'current' | 'available' | 'unreachable', version? }
 * - { type: 'apply-update' } → { status: 'updated' | 'failed', version? }
 * Antworten gehen über den mitgegebenen MessagePort.
 */
self.addEventListener('message', (event) => {
  const port = event.ports[0];
  const data = event.data || {};
  const reply = (value) => port && port.postMessage(value);

  event.waitUntil(
    (async () => {
      if (data.type === 'status') {
        reply({ active: await readActive() });
      } else if (data.type === 'check-update') {
        try {
          const [manifest, active] = await Promise.all([fetchManifest(), readActive()]);
          const newer = !active || isNewerVersion(manifest.version, active.version);
          reply(newer ? { status: 'available', version: manifest.version } : { status: 'current' });
        } catch {
          reply({ status: 'unreachable' });
        }
      } else if (data.type === 'apply-update') {
        try {
          const manifest = await fetchManifest();
          const active = await readActive();
          if (active && !isNewerVersion(manifest.version, active.version)) {
            reply({ status: 'failed' });
            return;
          }
          const info = await installManifest(manifest);
          reply({ status: 'updated', version: info.version });
        } catch {
          reply({ status: 'failed' });
        }
      }
    })(),
  );
});

/** Vergleicht „1.2.3"-Versionen numerisch. */
function isNewerVersion(candidate, current) {
  const a = String(candidate).split('.').map((n) => parseInt(n, 10) || 0);
  const b = String(current).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d > 0;
  }
  return false;
}
