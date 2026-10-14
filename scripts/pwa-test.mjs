// PWA-/Offline-Pflichttests (SPEC 9.4), automatisiert und wiederholbar.
//
// Startet einen lokalen Static-Server für `dist/faden/browser`, dessen
// Verhalten umschaltbar ist (normal / aus / 404 / 500 / Captive-Portal-HTML),
// und steuert einen echten Chromium-Browser (Edge oder Chrome, headless) über
// das DevTools-Protokoll. Keine Fremdpakete; benötigt Node ≥ 22 (WebSocket).
//
//   npm run build && npm run test:pwa
//
// Browser-Pfad überschreibbar mit der Umgebungsvariable BROWSER.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist', 'faden', 'browser');
const manifest = JSON.parse(readFileSync(join(distDir, 'precache-manifest.json'), 'utf8'));

// ---------------------------------------------------------------- Server ---

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

let mode = 'normal';
const server = createServer((req, res) => {
  if (mode === '404') return void res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  if (mode === '500') return void res.writeHead(500, { 'content-type': 'text/plain' }).end('Error');
  if (mode === 'html') {
    return void res
      .writeHead(200, { 'content-type': 'text/html' })
      .end('<!doctype html><title>Login</title><h1>Captive portal – please log in</h1>');
  }
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (mode === 'newer' && path === '/precache-manifest.json') {
    // Simuliert eine neu hochgeladene Version auf dem Host.
    const next = { ...manifest, version: '99.0.0', build: 'f'.repeat(16) };
    return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(next));
  }
  const rel = path.endsWith('/') ? path + 'index.html' : path;
  const file = normalize(join(distDir, rel));
  if (!file.startsWith(distDir + sep) || !existsSync(file)) {
    return void res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
  res
    .writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    .end(readFileSync(file));
});

const listen = (port) => new Promise((r) => server.listen(port, '127.0.0.1', () => r(server.address().port)));
const port = await listen(0);
const BASE = `http://127.0.0.1:${port}/`;

async function setMode(next) {
  if (next === 'down') {
    server.closeAllConnections();
    await new Promise((r) => server.close(() => r()));
  } else if (!server.listening) {
    await listen(port);
  }
  mode = next;
}

// --------------------------------------------------------------- Browser ---

const candidates = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/microsoft-edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const browserPath = candidates.find((p) => existsSync(p));
if (!browserPath) throw new Error('Kein Chromium-Browser gefunden (BROWSER=… setzen).');

const profile = mkdtempSync(join(tmpdir(), 'faden-pwa-'));
const downloads = mkdtempSync(join(tmpdir(), 'faden-dl-'));

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, method } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
        else resolve(msg.result);
      } else {
        for (const l of this.listeners) l(msg);
      }
    };
  }
  open() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }
  waitEvent(method, sessionId, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(l);
        reject(new Error(`Zeitüberschreitung: ${method}`));
      }, timeout);
      const l = (msg) => {
        if (msg.method === method && (!sessionId || msg.sessionId === sessionId)) {
          clearTimeout(timer);
          this.listeners.delete(l);
          resolve(msg.params);
        }
      };
      this.listeners.add(l);
    });
  }
}

const requests = [];
let browser;
let cdp;

async function launch() {
  const portFile = join(profile, 'DevToolsActivePort');
  rmSync(portFile, { force: true });
  browser = spawn(
    browserPath,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-sync',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const until = Date.now() + 20000;
  while (!existsSync(portFile) || readFileSync(portFile, 'utf8').split('\n').length < 2) {
    if (Date.now() > until) throw new Error('Browser startet nicht.');
    await sleep(100);
  }
  const [devPort, path] = readFileSync(portFile, 'utf8').split('\n');
  cdp = new Cdp(`ws://127.0.0.1:${devPort.trim()}${path.trim()}`);
  await cdp.open();
  await cdp.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloads,
    eventsEnabled: true,
  });
  // Auch Anfragen des Service Workers mitschneiden (Test 7).
  cdp.listeners.add(async (msg) => {
    if (msg.method === 'Target.targetCreated' && msg.params.targetInfo.type === 'service_worker') {
      try {
        const { sessionId } = await cdp.send('Target.attachToTarget', {
          targetId: msg.params.targetInfo.targetId,
          flatten: true,
        });
        await cdp.send('Network.enable', {}, sessionId);
      } catch {
        // Worker kann schon wieder beendet sein.
      }
    }
    if (msg.method === 'Network.requestWillBeSent') requests.push(msg.params.request.url);
  });
  await cdp.send('Target.setDiscoverTargets', { discover: true });
}

async function closeBrowser() {
  const exited = new Promise((r) => browser.once('exit', r));
  try {
    await cdp.send('Browser.close');
  } catch {
    // Verbindung kann beim Schließen abreißen.
  }
  await Promise.race([exited, sleep(10000)]);
  if (browser.exitCode === null) browser.kill();
  await sleep(500);
}

async function newPage() {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  const page = {
    sessionId,
    async goto(url) {
      const loaded = cdp.waitEvent('Page.loadEventFired', sessionId);
      const nav = await cdp.send('Page.navigate', { url }, sessionId);
      if (nav.errorText) throw new Error(`Navigation fehlgeschlagen: ${nav.errorText}`);
      // Reine Hash-Wechsel lösen kein load aus.
      if (nav.loaderId) await loaded;
      else await Promise.race([loaded, sleep(300)]);
    },
    async reload() {
      const loaded = cdp.waitEvent('Page.loadEventFired', sessionId);
      await cdp.send('Page.reload', { ignoreCache: false }, sessionId);
      await loaded;
    },
    async eval(expression) {
      const r = await cdp.send(
        'Runtime.evaluate',
        { expression, awaitPromise: true, returnByValue: true },
        sessionId,
      );
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      }
      return r.result.value;
    },
    /** Wartet, bis `predicate` (JS-Ausdruck) im Browser wahr ist. */
    async waitFor(predicate, label = predicate, timeout = 10000) {
      return page.eval(`(async () => {
        const until = Date.now() + ${timeout};
        while (Date.now() < until) {
          try { const v = await (async () => (${predicate}))(); if (v) return v; } catch {}
          await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error(${JSON.stringify('Zeitüberschreitung: ' + label)});
      })()`);
    },
    text: () => page.eval('document.body.innerText'),
    close: () => cdp.send('Target.closeTarget', { targetId }),
  };
  return page;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ Hilfsmittel ---

const APP_READY = `document.querySelector('app-root h1') !== null`;
const LIST_TITLE = 'Offline-Zettel';
const TASK_TITLE = 'Offline-ToDo';

/** Zustand von Registrierung und Caches aus Sicht der Seite. */
const SW_STATE = `(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  const keys = await caches.keys();
  const meta = await caches.open('faden-meta');
  const res = await meta.match(new URL('active', document.baseURI).href);
  const active = res ? await res.json() : null;
  const entries = active ? (await (await caches.open(active.cache)).keys()).length : 0;
  return {
    registered: !!reg,
    activeWorker: !!reg?.active,
    controlled: !!navigator.serviceWorker.controller,
    keys,
    active,
    entries,
  };
})()`;

/** Löst die Update-Prüfung des Browsers aus (wie beim Neuladen nach 24 h). */
const FORCE_UPDATE = `(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  try { await reg.update(); return 'ok'; } catch (e) { return 'rejected: ' + e.name; }
})()`;

const results = [];
async function test(name, fn) {
  const started = Date.now();
  try {
    const note = await fn();
    results.push({ name, ok: true, note: note ?? '' });
    console.log(`✔ ${name}${note ? ` – ${note}` : ''} (${Date.now() - started} ms)`);
  } catch (err) {
    results.push({ name, ok: false, note: err.message });
    console.log(`✘ ${name} – ${err.message}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

let baseline;
async function assertSwIntact(page) {
  const s = await page.eval(SW_STATE);
  assert(s.registered && s.activeWorker, 'Service Worker nicht mehr registriert');
  assert(s.active, 'Kein aktiver Precache mehr');
  assert(s.active.build === baseline.active.build, 'Precache-Version hat sich geändert');
  assert(s.entries === baseline.entries, `Cache unvollständig (${s.entries}/${baseline.entries})`);
  return s;
}

async function assertAppWithData(page) {
  await page.waitFor(APP_READY, 'App rendert');
  await page.waitFor(`document.body.innerText.includes(${JSON.stringify(LIST_TITLE)})`, 'Daten sichtbar');
}

// ----------------------------------------------------------------- Tests ---

console.log(`Browser: ${browserPath}\nServer:  ${BASE}\nBuild:   ${manifest.version} / ${manifest.build}\n`);
await launch();
let page = await newPage();
let listId = '';

await test('1 Installierbarkeit / Precache', async () => {
  await page.goto(BASE);
  await page.waitFor(APP_READY, 'App rendert');
  await page.waitFor('navigator.serviceWorker.controller', 'Service Worker übernimmt', 20000);
  baseline = await page.eval(SW_STATE);
  assert(baseline.active, 'Kein aktiver Precache');
  assert(baseline.entries === manifest.files.length, `Precache ${baseline.entries}/${manifest.files.length}`);
  const app = await cdp.send('Page.getAppManifest', {}, page.sessionId);
  assert(app.errors.length === 0, `Manifest-Fehler: ${JSON.stringify(app.errors)}`);
  const inst = await cdp.send('Page.getInstallabilityErrors', {}, page.sessionId);
  assert(
    inst.installabilityErrors.length === 0,
    `Nicht installierbar: ${inst.installabilityErrors.map((e) => e.errorId).join(', ')}`,
  );
  await page.goto(BASE + '#/einstellungen');
  await page.waitFor(`document.body.innerText.includes('Offline ready')`, '„Offline ready" sichtbar');
  return `${baseline.entries} Dateien in ${baseline.active.cache}, installierbar, „Offline ready"`;
});

await test('2 Server aus: App startet, anlegen, abhaken, Export', async () => {
  await setMode('down');
  await page.goto(BASE);
  await page.reload();
  await page.waitFor(APP_READY, 'App rendert offline');

  // Zettel anlegen
  await page.eval(`document.querySelector('.page-head__actions .btn--primary').click()`);
  await page.waitFor(`document.querySelector('dialog[open] input[name=title]')`, 'Dialog');
  await page.eval(`(() => {
    const input = document.querySelector('dialog[open] input[name=title]');
    input.value = ${JSON.stringify(LIST_TITLE)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('dialog[open] button[type=submit]').click();
  })()`);
  await page.waitFor(`[...document.querySelectorAll('.list-card__title')].some((e) => e.textContent.trim() === ${JSON.stringify(LIST_TITLE)})`, 'Zettel angelegt');

  // Zettel öffnen, ToDo anlegen
  await page.eval(`document.querySelector('.list-card__main').click()`);
  await page.waitFor(`document.querySelector('.empty .btn--large')`, 'Leerer Zettel');
  listId = await page.eval(`location.hash.split('/').pop()`);
  await page.eval(`document.querySelector('.empty .btn--large').click()`);
  await page.waitFor(`document.querySelector('form.chain input')`, 'Eingabefeld');
  await page.eval(`(() => {
    const input = document.querySelector('form.chain input');
    input.value = ${JSON.stringify(TASK_TITLE)};
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  })()`);
  await page.eval(`document.querySelector('.chain__actions .btn--primary')?.click()`);
  await page.waitFor(`document.querySelector('.task-card__done')`, 'ToDo angelegt');

  // Abhaken
  await page.eval(`document.querySelector('.task-card__done').click()`);
  await page.waitFor(`!document.querySelector('.task-card__done')`, 'ToDo abgehakt');

  // Export
  await page.goto(BASE + '#/einstellungen');
  await page.waitFor(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Download backup')`, 'Export-Button');
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Download kam nicht an')), 15000);
    const l = (msg) => {
      if (msg.method === 'Browser.downloadProgress' && msg.params.state === 'completed') {
        clearTimeout(timer);
        cdp.listeners.delete(l);
        resolve();
      }
    };
    cdp.listeners.add(l);
  });
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Download backup').click()`);
  await done;
  const file = readdirSync(downloads).find((f) => f.startsWith('faden-backup-') && f.endsWith('.json'));
  assert(file, 'Backup-Datei fehlt');
  const backup = JSON.parse(readFileSync(join(downloads, file), 'utf8'));
  const list = backup.lists.find((l) => l.title === LIST_TITLE);
  assert(list?.tasks[0]?.title === TASK_TITLE && list.tasks[0].done, 'Backup enthält Änderungen nicht');
  await assertSwIntact(page);
  return `Zettel + ToDo offline angelegt und abgehakt, ${file} exportiert`;
});

for (const [name, m] of [
  ['3 Server liefert überall 404', '404'],
  ['4a Server liefert 500', '500'],
  ['4b Server liefert Captive-Portal-HTML (200)', 'html'],
]) {
  await test(name, async () => {
    await setMode(m);
    const updates = [];
    for (let i = 0; i < 3; i++) {
      await page.goto(BASE);
      await assertAppWithData(page);
      updates.push(await page.eval(FORCE_UPDATE));
      await assertSwIntact(page);
    }
    assert(updates.every((u) => u.startsWith('rejected')), `Update-Prüfung: ${updates.join(', ')}`);
    return `3× neu geladen + Update-Prüfung erzwungen (${updates[0]}); SW + Cache intakt`;
  });
}

await test('4c Keine Auto-Updates (Host bietet neuere Version an)', async () => {
  await setMode('newer');
  for (let i = 0; i < 2; i++) {
    await page.goto(BASE);
    await assertAppWithData(page);
    await page.eval(FORCE_UPDATE);
    await sleep(500);
    await assertSwIntact(page);
  }
  return 'sw.js unverändert → kein neuer Worker, Precache bleibt auf der installierten Version';
});

await test('5 Direkte Hash-Route offline (neuer Tab)', async () => {
  await setMode('down');
  const tab = await newPage();
  await tab.goto(`${BASE}index.html#/zettel/${listId}`);
  await tab.waitFor(APP_READY, 'App rendert');
  // Das ToDo ist seit Test 2 abgehakt → „Jetzt dran" zeigt Titel + „All done.".
  await tab.waitFor(
    `document.body.innerText.includes(${JSON.stringify(LIST_TITLE)}) && document.body.innerText.includes('All done.')`,
    'Zettel-Ansicht sichtbar',
  );
  await tab.close();
  return `index.html#/zettel/${listId.slice(0, 8)}… geöffnet`;
});

await test('6 Daten und App überleben Browser-Neustart (Server 404, dann aus)', async () => {
  await closeBrowser();
  await setMode('404');
  await launch();
  page = await newPage();
  await page.goto(BASE);
  await assertAppWithData(page);
  await page.eval(FORCE_UPDATE);
  await assertSwIntact(page);
  await closeBrowser();
  await setMode('down');
  await launch();
  page = await newPage();
  await page.goto(BASE);
  await assertAppWithData(page);
  await assertSwIntact(page);
  return '2 Neustarts, Daten und Precache unverändert';
});

await test('7 Keine externen Requests', async () => {
  const external = requests.filter((u) => !u.startsWith(BASE) && !/^(data|blob|about):/.test(u));
  assert(external.length === 0, `Externe Requests: ${[...new Set(external)].join(', ')}`);
  return `${requests.length} Requests geprüft, alle an ${new URL(BASE).host}`;
});

await closeBrowser();
if (server.listening) {
  server.closeAllConnections();
  server.close();
}
for (const dir of [profile, downloads]) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Windows hält Profil-Dateien manchmal noch kurz fest.
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} Tests bestanden.`);
process.exit(failed.length === 0 ? 0 : 1);
