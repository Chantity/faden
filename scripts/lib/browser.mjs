// Gemeinsame Werkzeuge für die Browser-Tests (scripts/pwa-test.mjs,
// scripts/acceptance-test.mjs): statischer Server, Chromium über das
// DevTools-Protokoll (CDP) steuern, kleiner Test-Runner. Keine Fremdpakete;
// benötigt Node ≥ 22 (eingebautes WebSocket).

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/** Liefert eine Datei aus `distDir` aus (404, wenn es sie nicht gibt). */
export function serveFile(path, res, distDir) {
  const rel = path.endsWith('/') ? path + 'index.html' : path;
  const file = normalize(join(distDir, rel));
  if (!file.startsWith(distDir + sep) || !existsSync(file)) {
    return void res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
  res
    .writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    .end(readFileSync(file));
}

// --------------------------------------------------------------- Browser ---

export function findBrowser() {
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
  const path = candidates.find((p) => existsSync(p));
  if (!path) throw new Error('Kein Chromium-Browser gefunden (BROWSER=… setzen).');
  return path;
}

export class Cdp {
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

/** Startet Chromium headless mit dem Profil `profile` und verbindet sich per CDP. */
export async function launchBrowser(browserPath, profile) {
  const portFile = join(profile, 'DevToolsActivePort');
  rmSync(portFile, { force: true });
  const proc = spawn(
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
  const cdp = new Cdp(`ws://127.0.0.1:${devPort.trim()}${path.trim()}`);
  await cdp.open();

  async function close() {
    const exited = new Promise((r) => proc.once('exit', r));
    try {
      await cdp.send('Browser.close');
    } catch {
      // Verbindung kann beim Schließen abreißen.
    }
    await Promise.race([exited, sleep(10000)]);
    if (proc.exitCode === null) proc.kill();
    await sleep(500);
  }

  return { cdp, close, newPage: () => newPage(cdp) };
}

/** localStorage-Merker der einmaligen Erst-Start-Hinweise (Speicher, Anleitung, Installation). */
export const FIRST_RUN_KEYS = ['faden.storageNoticeAck', 'faden.guideOffered', 'faden.installBannerDismissed'];

/**
 * Markiert in diesem Tab vor jedem Laden die Erst-Start-Hinweise als erledigt,
 * damit sie nicht mitten in andere Tests fallen (sie haben eigene Tests).
 */
export async function skipFirstRunNotices(page) {
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { for (const k of ${JSON.stringify(FIRST_RUN_KEYS)}) localStorage.setItem(k, '1'); } catch {}`,
  });
}

/** Öffnet einen neuen Tab und liefert kleine Helfer zum Steuern. */
export async function newPage(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  const page = {
    sessionId,
    send: (method, params = {}) => cdp.send(method, params, sessionId),
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
    /** Echter Tastendruck (keyDown + keyUp), z. B. 'Tab', 'Enter', 'Escape', 'v'. */
    async press(key, { shift = false } = {}) {
      const named = {
        Tab: { code: 'Tab', keyCode: 9 },
        Enter: { code: 'Enter', keyCode: 13, text: '\r' },
        Escape: { code: 'Escape', keyCode: 27 },
        ' ': { code: 'Space', keyCode: 32, text: ' ' },
      };
      const info = named[key] ?? {
        code: `Key${key.toUpperCase()}`,
        keyCode: key.toUpperCase().charCodeAt(0),
        text: key,
      };
      const base = {
        key,
        code: info.code,
        windowsVirtualKeyCode: info.keyCode,
        nativeVirtualKeyCode: info.keyCode,
        modifiers: shift ? 8 : 0,
      };
      await page.send('Input.dispatchKeyEvent', {
        type: info.text ? 'keyDown' : 'rawKeyDown',
        ...base,
        ...(info.text ? { text: info.text, unmodifiedText: info.text } : {}),
      });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    },
    /**
     * Tippt Text Zeichen für Zeichen als echte Tastendrücke (nicht über
     * `Input.insertText`, das eine IME-Eingabe nachahmt).
     */
    async type(text) {
      for (const ch of text) {
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch });
        await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
      }
    },
    close: () => cdp.send('Target.closeTarget', { targetId }),
  };
  return page;
}

// ------------------------------------------------------------- Test-Runner ---

export function createRunner() {
  const results = [];
  return {
    async test(name, fn) {
      const started = Date.now();
      try {
        const note = await fn();
        results.push({ name, ok: true, note: note ?? '' });
        console.log(`✔ ${name}${note ? ` – ${note}` : ''} (${Date.now() - started} ms)`);
      } catch (err) {
        results.push({ name, ok: false, note: err.message });
        console.log(`✘ ${name} – ${err.message}`);
      }
    },
    /** Gibt die Zusammenfassung aus und liefert den Exit-Code. */
    finish() {
      const failed = results.filter((r) => !r.ok);
      console.log(`\n${results.length - failed.length}/${results.length} Tests bestanden.`);
      return failed.length === 0 ? 0 : 1;
    },
  };
}

export function assert(cond, message) {
  if (!cond) throw new Error(message);
}
