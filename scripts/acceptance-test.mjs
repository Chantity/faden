// Abnahmetests im echten Browser: Tastatur-Szenario
// „Geschirrspüler" (1), Responsive 360/768/1280 px + Querformat (8) und
// reizarme Darstellung bei prefers-reduced-motion (12).
//
//   npm run build && npm run test:acceptance
//
// Browser-Pfad überschreibbar mit der Umgebungsvariable BROWSER.

import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, createRunner, findBrowser, launchBrowser, serveFile } from './lib/browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist', 'faden', 'browser');

const server = createServer((req, res) =>
  serveFile(decodeURIComponent(new URL(req.url, 'http://x').pathname), res, distDir),
);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const profile = mkdtempSync(join(tmpdir(), 'faden-accept-'));
const browser = await launchBrowser(findBrowser(), profile);
const { test, finish } = createRunner();
let page = await browser.newPage();
// Einmalige Erst-Start-Hinweise sind nicht Gegenstand dieser Tests: Ihre Merker
// vorab setzen, damit sie nicht mitten in einem Tab-Durchlauf auftauchen.
await page.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try { localStorage.setItem('faden.installBannerDismissed', '1'); } catch {}`,
});

async function viewport(width, height) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
}

const APP_READY = `document.querySelector('app-root h1') !== null`;

// ------------------------------------------- 1: Tastatur „Geschirrspüler" ---

/**
 * Drückt Tab, bis das fokussierte Element `predicate` erfüllt. Prüft dabei an
 * jedem erreichten Ziel, dass ein Fokusrahmen sichtbar ist.
 */
async function tabTo(predicate, label, max = 60) {
  const visited = [];
  for (let i = 0; i < max; i++) {
    await page.press('Tab');
    const state = await page.eval(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { match: false, ring: true };
      const style = getComputedStyle(el);
      const ring = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0
        || style.boxShadow !== 'none';
      const match = (() => { try { return !!(${predicate}); } catch { return false; } })();
      return { match, ring, what: el.tagName + '.' + el.className + ' ' + (el.textContent || '').trim().slice(0, 30) };
    })()`);
    assert(state.ring, `Kein sichtbarer Fokusrahmen auf ${state.what}`);
    if (state.match) return i + 1;
    visited.push(state.what ?? 'body');
  }
  const titles = await page.eval(availableTitles);
  throw new Error(
    `Per Tab nicht erreichbar: ${label}. Jetzt dran: ${JSON.stringify(titles)}. ` +
      `Fokus besuchte: ${[...new Set(visited)].join(' | ')}`,
  );
}

const activeText = `(document.activeElement.textContent || '').trim()`;
const availableTitles = `[...document.querySelectorAll('.task-card__title')].map((e) => e.textContent.trim())`;

await test('1 Geschirrspüler-Szenario nur mit Tastatur', async () => {
  await viewport(1280, 900);
  await page.goto(BASE);
  await page.waitFor(APP_READY, 'App rendert');

  // Zettel anlegen
  await tabTo(`${activeText} === 'Create your first list'`, 'Ersten Zettel anlegen');
  await page.press('Enter');
  await page.waitFor(`document.activeElement?.name === 'title'`, 'Titelfeld fokussiert');
  await page.type('Küche');
  await page.press('Enter');
  await page.waitFor(`document.querySelector('.list-card__title')?.textContent.trim() === 'Küche'`, 'Zettel angelegt');

  // Zettel öffnen
  await tabTo(`document.activeElement.classList.contains('list-card__main')`, 'Zettel-Karte');
  await page.press('Enter');
  await page.waitFor(`location.hash.startsWith('#/zettel/')`, 'Zettel geöffnet');

  // Erstes ToDo
  await page.waitFor(`document.querySelector('.empty .btn--large')`, 'Leerer Zettel');
  await tabTo(`document.activeElement.matches('.empty .btn--large')`, 'Erstes ToDo anlegen');
  await page.press('Enter');
  await page.waitFor(`document.activeElement?.matches('form.chain input')`, 'Eingabefeld fokussiert');
  await page.type('Geschirrspüler einräumen');
  await page.press('Enter');
  await page.press('Escape');
  await page.waitFor(`${availableTitles}.join() === 'Geschirrspüler einräumen'`, 'Erstes ToDo da');

  // Vorarbeiten: „V" = Erst noch etwas anderes nötig …, dann Enter-Kette.
  // Wie ein Mensch: erst drücken, wenn der Fokus sichtbar auf der Karte liegt
  // (er springt nach dem Rendern dorthin), sonst selbst hintabben.
  const onCard = `!!document.activeElement?.closest('[data-task-id]')`;
  if (!(await page.waitFor(onCard, 'Fokus auf der Karte', 1000).then(() => true, () => false))) {
    await tabTo(`document.activeElement.closest('[data-task-id]')`, 'Karte „Jetzt dran"');
  }
  await page.press('v');
  await page.waitFor(`document.activeElement?.matches('form.chain input')`, 'Vorarbeit-Feld fokussiert');
  for (const title of [
    'Geschirr einsammeln',
    'Bioabfall in die Tonne',
    'Müll mitnehmen',
    'Herumliegenden Müll einsammeln',
  ]) {
    // Wie ein Mensch: erst tippen, wenn das (neue) leere Feld den Fokus hat.
    await page.waitFor(
      `document.activeElement?.matches('form.chain input') && document.activeElement.value === ''`,
      `leeres, fokussiertes Feld vor „${title}"`,
      3000,
    );
    await page.type(title);
    await page.press('Enter');
  }
  await page.press('Escape');
  await page
    .waitFor(`${availableTitles}.join() === 'Herumliegenden Müll einsammeln'`, 'Nur letzte Vorarbeit dran')
    .catch(async (err) => {
      throw new Error(`${err.message} – „Jetzt dran": ${JSON.stringify(await page.eval(availableTitles))}`);
    });

  // Abhaken per Tastatur: genau das nächste ToDo rückt nach
  const expected = [
    'Herumliegenden Müll einsammeln',
    'Müll mitnehmen',
    'Bioabfall in die Tonne',
    'Geschirr einsammeln',
    'Geschirrspüler einräumen',
  ];
  for (let i = 0; i < expected.length; i++) {
    await page.waitFor(`${availableTitles}.join() === ${JSON.stringify(expected[i])}`, `„${expected[i]}" ist dran`);
    if (!(await page.eval(`document.activeElement?.matches('.task-card__done')`))) {
      await tabTo(`document.activeElement.matches('.task-card__done')`, '„Erledigt"');
    }
    await page.press(i % 2 === 0 ? 'Enter' : ' ');
  }
  await page.waitFor(`document.body.innerText.includes('All done.')`, '„Alles erledigt."');
  return 'Zettel + 5 ToDos per Tastatur, Reihenfolge stimmt, Fokusrahmen überall sichtbar';
});

// ---------------------------------------------------- 8: Responsive ---

/** Testdaten direkt in IndexedDB (gleiche Herkunft), danach neu laden. */
async function seed() {
  const now = new Date().toISOString();
  const task = (id, title, extra = {}) => ({ id, title, done: false, ...extra });
  const edge = (from, to) => ({ id: `${from}->${to}`, from, to });
  const list = (id, title, sortOrder, more) => ({
    id,
    title,
    timeboxMode: 'none',
    tasks: [],
    edges: [],
    archived: false,
    createdAt: now,
    updatedAt: now,
    sortOrder,
    ...more,
  });
  const lists = [
    list('wohnung', 'Wohnung aufräumen, bevor der Besuch kommt', 10, {
      timeboxMode: 'estimate',
      tasks: [
        task('a', 'Fenster öffnen', { estimateMinutes: 5 }),
        task('b', 'Wäsche zusammenlegen und in den Schrank räumen', { estimateMinutes: 20 }),
        task('c', 'Staubsaugen', { estimateMinutes: 15 }),
        task('d', 'Fenster schließen', { estimateMinutes: 5 }),
        task('e', 'Blumen gießen'),
      ],
      edges: [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')],
    }),
    list('bad', 'Bad', 11, {
      tasks: [task('x', 'Spiegel putzen'), task('y', 'Handtücher wechseln')],
      edges: [edge('x', 'y')],
    }),
    list('alt', 'Archivierter Zettel', 12, {
      archived: true,
      timeboxMode: 'estimate',
      tasks: [task('z', 'Altes ToDo', { done: true, estimateMinutes: 10 })],
    }),
  ];
  const templates = [
    {
      id: 't1',
      title: 'Wocheneinkauf',
      tasks: [{ id: 'p', title: 'Liste schreiben' }, { id: 'q', title: 'Einkaufen' }],
      edges: [edge('p', 'q')],
      timeboxMode: 'none',
      createdAt: now,
    },
  ];
  await page.goto(BASE);
  await page.waitFor(APP_READY, 'App rendert');
  await page.eval(`new Promise((resolve, reject) => {
    const req = indexedDB.open('faden');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['lists', 'templates'], 'readwrite');
      for (const l of ${JSON.stringify(lists)}) tx.objectStore('lists').put(l);
      for (const t of ${JSON.stringify(templates)}) tx.objectStore('templates').put(t);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);
  await page.reload();
  await page.waitFor(`document.body.innerText.includes('Wohnung aufräumen')`, 'Testdaten geladen');
}

/**
 * Prüft die aktuelle Seite: kein horizontales Scrollen (außer im Diagramm),
 * Tippflächen ≥ 48 px (die „+" im Diagramm ≥ 44 px). Gemessen
 * wird die tatsächlich treffbare Fläche (elementFromPoint um die Mitte), damit
 * unsichtbar vergrößerte Trefferflächen zählen.
 */
const CHECK_PAGE = `(() => {
  const problems = [];
  const vw = window.innerWidth;
  if (document.documentElement.scrollWidth > vw + 1) {
    problems.push('horizontal scroll: ' + document.documentElement.scrollWidth + ' > ' + vw);
  }
  const fontSize = parseFloat(getComputedStyle(document.body).fontSize);
  if (fontSize < 17) problems.push('Basis-Schrift ' + fontSize + ' px < 17 px');

  const floating = (node) => {
    for (let n = node; n && n !== document.body; n = n.parentElement) {
      const position = getComputedStyle(n).position;
      if (position === 'fixed' || position === 'sticky') return true;
    }
    return false;
  };
  const canvas = document.querySelector('.flow__canvas');
  const canvasScale = canvas ? new DOMMatrix(getComputedStyle(canvas).transform).a : 1;
  const selector = 'a[href], button, summary, select, textarea, input:not([type=hidden]), [role=button], [tabindex]:not([tabindex="-1"])';
  const modal = document.querySelector('dialog[open]');
  for (const el of (modal ?? document).querySelectorAll(selector)) {
    if (el.closest('svg')) continue; // Pfeile: eigene Trefferlinie, Alternative im Bearbeiten-Sheet
    if (el.closest('dialog:not([open])')) continue;
    // Inhalt geschlossener Aufklapper/Menüs ist nicht bedienbar (nur deren Zusammenfassung).
    const closed = el.closest('details:not([open])');
    if (closed && el.closest('summary')?.parentElement !== closed) continue;
    if (el.disabled) continue;
    if (canvas && canvas.contains(el) && canvasScale < 1) continue; // gezoomtes Diagramm
    let target = el;
    if ((el.type === 'radio' || el.type === 'checkbox') && el.closest('label')) target = el.closest('label');
    const r = target.getBoundingClientRect();
    const style = getComputedStyle(target);
    if (r.width === 0 || r.height === 0 || style.visibility === 'hidden') continue;
    if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > vw) continue;
    const need = el.classList.contains('plus') ? 44 : 48;
    // Größe = Rahmen des Elements, erweitert um eine unsichtbare ::after-Trefferfläche.
    const after = getComputedStyle(el, '::after');
    const grow = (v) => (after.content !== 'none' && after.position === 'absolute' ? Math.max(0, -parseFloat(v) || 0) : 0);
    const w = r.width + grow(after.left) + grow(after.right);
    const h = r.height + grow(after.top) + grow(after.bottom);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx >= vw || cy >= window.innerHeight) continue;
    const hit = document.elementFromPoint(cx, cy);
    // Trifft die Mitte einen Vorfahren, ist das Element nur aus einem
    // scrollbaren Bereich (z. B. Dialog im Querformat) herausgescrollt.
    if (hit && hit !== target && hit.contains(target) && !target.contains(hit)) continue;
    // Liegt die Mitte unter einem schwebenden Element (FAB, Hinweisband), ist das
    // Ziel nur darunter gescrollt und durch Weiterscrollen erreichbar.
    if (hit && !target.contains(hit) && floating(hit)) continue;
    const covered = !hit || !(hit === target || target.contains(hit) || el.contains(hit));
    if (w < need - 0.5 || h < need - 0.5 || covered) {
      const name = (el.getAttribute('aria-label') || el.textContent || el.name || '').trim().slice(0, 30);
      const why = covered ? 'verdeckt von ' + (hit ? hit.tagName.toLowerCase() + '.' + [...hit.classList].join('.') : 'nichts') : Math.round(w) + '×' + Math.round(h);
      problems.push('Tippfläche < ' + need + ' px: ' + el.tagName.toLowerCase() + '.' + [...el.classList].join('.') + ' „' + name + '" (' + why + ')');
    }
  }
  return [...new Set(problems)];
})()`;

const VIEWPORTS = [
  { name: 'Handy 360', width: 360, height: 740 },
  { name: 'Handy quer', width: 740, height: 360 },
  { name: 'Tablet 768', width: 768, height: 1024 },
  { name: 'PC 1280', width: 1280, height: 800 },
];

const PAGES = [
  { name: 'Übersicht', hash: '#/' },
  { name: 'Jetzt dran', hash: '#/zettel/wohnung', view: 'focus' },
  { name: 'Ablauf', hash: '#/zettel/wohnung', view: 'flow' },
  { name: 'Vorlagen', hash: '#/vorlagen' },
  { name: 'Einstellungen', hash: '#/einstellungen' },
];

async function openPage(p) {
  await page.goto(BASE + p.hash);
  await page.waitFor(APP_READY, 'App rendert');
  if (p.view) {
    const label = p.view === 'flow' ? 'Flow' : 'Now';
    await page.waitFor(`document.querySelector('.view-toggle')`, 'Umschalter');
    await page.eval(`[...document.querySelectorAll('.view-toggle button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})?.click()`);
    await page.waitFor(
      p.view === 'flow' ? `document.querySelector('.flow__canvas .node')` : `document.querySelector('.task-card')`,
      p.name,
    );
  }
  await new Promise((r) => setTimeout(r, 150));
}

await test('8a Testdaten anlegen', async () => {
  await viewport(1280, 800);
  await seed();
  return '2 Zettel (Verzweigung, 2 Stränge, Schätzungen), 1 archiviert, 1 Vorlage';
});

for (const vp of VIEWPORTS.filter((v) => !process.env.VIEWPORT || v.name.includes(process.env.VIEWPORT))) {
  await test(`8 Responsive ${vp.name} (${vp.width}×${vp.height})`, async () => {
    await viewport(vp.width, vp.height);
    const problems = [];
    for (const p of PAGES) {
      await openPage(p);
      for (const issue of await page.eval(CHECK_PAGE)) problems.push(`${p.name}: ${issue}`);
    }
    // Archiv aufgeklappt (Chip, „Enthaltene ToDos", ⋯-Menü)
    await openPage(PAGES[0]);
    await page.eval(`document.querySelectorAll('details.archived, details.archived__tasks').forEach((d) => (d.open = true))`);
    await page.eval(`document.querySelector('details.archived').scrollIntoView()`);
    for (const issue of await page.eval(CHECK_PAGE)) problems.push(`Archiv: ${issue}`);
    // Dialog öffnen (Neuer Zettel) und prüfen
    await openPage(PAGES[0]);
    await page.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '+ New list').click()`);
    await page.waitFor(`document.querySelector('dialog[open]')`, 'Dialog offen');
    for (const issue of await page.eval(CHECK_PAGE)) problems.push(`Dialog: ${issue}`);
    const sheet = await page.eval(`(() => {
      const r = document.querySelector('dialog[open]').getBoundingClientRect();
      return { left: r.left, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight };
    })()`);
    if (vp.width < 600) {
      // Dialoge als Bottom-Sheet
      if (Math.abs(sheet.bottom - sheet.height) > 1 || sheet.left > 1 || Math.abs(sheet.right - sheet.width) > 1) {
        problems.push(`Dialog ist kein Bottom-Sheet (${JSON.stringify(sheet)})`);
      }
    }
    await page.press('Escape');

    if (vp.width < 600) {
      // Floating-Action-Button für „+"
      const fab = await page.eval(`(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '+ New list');
        const r = b.getBoundingClientRect();
        return { fixed: getComputedStyle(b).position === 'fixed', bottom: innerHeight - r.bottom, right: innerWidth - r.right, h: r.height };
      })()`);
      if (!fab.fixed || fab.bottom > 48 || fab.right > 48 || fab.h < 56) {
        problems.push(`Kein Floating-Action-Button für „+" (${JSON.stringify(fab)})`);
      }
    }

    // > 1024 px zweispaltig (links Zettel-Liste, einklappbar)
    await openPage(PAGES[1]);
    const side = await page.eval(`(() => {
      const aside = document.querySelector('.lists-side');
      if (!aside || getComputedStyle(aside).display === 'none') return null;
      const main = document.querySelector('.detail-main');
      return {
        links: aside.querySelectorAll('a[href*="zettel"]').length,
        leftOfMain: aside.getBoundingClientRect().right <= main.getBoundingClientRect().left + 1,
        toggle: !!aside.querySelector('button[aria-expanded]'),
      };
    })()`);
    if (vp.width > 1024) {
      if (!side || side.links < 2 || !side.leftOfMain || !side.toggle) {
        problems.push(`Keine einklappbare Zettel-Spalte links (${JSON.stringify(side)})`);
      }
    } else if (side) {
      problems.push('Zettel-Spalte erscheint unter 1025 px');
    }

    assert(problems.length === 0, '\n    - ' + problems.join('\n    - '));
    return `${PAGES.length} Seiten + Dialog ohne Befund`;
  });
}

// ---------------------------------------------- M: ⋯-Menüs schließen ---

const OPEN_MENUS = `document.querySelectorAll('details.menu[open], .popover').length`;

await test('M Jedes ⋯-Menü schließt per Klick außerhalb und mit Esc', async () => {
  await viewport(1280, 800);
  const cases = [
    { name: 'Übersicht: Zettel-Karte', page: PAGES[0], open: `document.querySelector('.cards details.menu summary').click()` },
    {
      name: 'Übersicht: archivierter Zettel',
      page: PAGES[0],
      open: `document.querySelector('details.archived').open = true;
             document.querySelector('.archived details.menu summary').click()`,
    },
    { name: 'Jetzt dran: Karte', page: PAGES[1], open: `document.querySelector('.task-card details.menu summary').click()` },
    { name: 'Zettel-Kopf', page: PAGES[1], open: `document.querySelector('.detail-head details.menu summary').click()` },
    { name: 'Ablauf: Karte', page: PAGES[2], open: `document.querySelector('.node__menu-btn').click()` },
  ];
  const problems = [];
  for (const c of cases) {
    for (const how of ['Klick', 'Esc']) {
      await openPage(c.page);
      await page.eval(c.open);
      if ((await page.eval(OPEN_MENUS)) === 0) {
        problems.push(`${c.name}: Menü ging nicht auf`);
        continue;
      }
      if (how === 'Klick') await page.eval(`document.querySelector('h1').click()`);
      else await page.press('Escape');
      await new Promise((r) => setTimeout(r, 50));
      if ((await page.eval(OPEN_MENUS)) !== 0) problems.push(`${c.name}: bleibt nach ${how} offen`);
    }
  }
  assert(problems.length === 0, problems.join('; '));
  return `${cases.length} Menüs, je per Klick außerhalb und per Esc geschlossen`;
});

// ------------------------------------------------- 12: Reizarm ---

await test('12 prefers-reduced-motion: keine Übergänge/Animationen', async () => {
  await viewport(1280, 800);
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  const problems = [];
  for (const p of PAGES) {
    await openPage(p);
    const moving = await page.eval(`[...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      // Werte unter 1 ms gelten als „keine Bewegung" (übliches reduce-Muster).
      const ms = (d) => (d.trim().endsWith('ms') ? parseFloat(d) : parseFloat(d) * 1000);
      const t = s.transitionDuration.split(',').some((d) => ms(d) >= 1);
      const a = s.animationName !== 'none' && s.animationDuration.split(',').some((d) => ms(d) >= 1);
      return t || a;
    }).map((el) => el.tagName.toLowerCase() + '.' + [...el.classList].join('.')).slice(0, 5)`);
    if (moving.length) problems.push(`${p.name}: ${moving.join(', ')}`);
  }
  await page.send('Emulation.setEmulatedMedia', { features: [] });
  assert(problems.length === 0, problems.join('; '));
  return 'auf allen Seiten keine laufenden Übergänge';
});

await browser.close();
server.close();
try {
  rmSync(profile, { recursive: true, force: true });
} catch {
  // Windows hält Profil-Dateien manchmal noch kurz fest.
}
process.exit(finish());
