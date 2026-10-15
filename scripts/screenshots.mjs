// Erzeugt die Screenshots der Anleitung: docs/images/{en,de}/*.webp.
// Handyformat 360 px, vom Desktop (1280 px) nur, wo es anders aussieht.
// Je Sprache eigene Testdaten, damit Text und Bild zusammenpassen.
//
//   npm run build && npm run screenshots

import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIRST_RUN_KEYS, findBrowser, launchBrowser, serveFile } from './lib/browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist', 'faden', 'browser');
const imagesDir = join(root, 'docs', 'images');

const server = createServer((req, res) => serveFile(decodeURIComponent(new URL(req.url, 'http://x').pathname), res, distDir));
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const profile = mkdtempSync(join(tmpdir(), 'faden-shots-'));
const browser = await launchBrowser(findBrowser(), profile);

/** Texte der Testdaten und der Knöpfe, die das Skript anklickt. */
const TEXT = {
  en: {
    kitchen: 'Kitchen',
    organic: 'Empty the organic waste',
    collect: 'Collect the dishes',
    load: 'Load the dishwasher',
    shop: 'Weekly shop',
    items: ['Milk', 'Bread', 'Apples', 'Coffee'],
    morning: 'Saturday morning',
    up: 'Get up',
    shower: 'Shower',
    breakfast: 'Make breakfast',
    coffee: 'Make coffee',
    eat: 'Have breakfast',
    move: 'Moving house',
    boxes: 'Get boxes',
    pack: 'Pack books',
    van: 'Book a van',
    keys: 'Hand over keys',
    tax: 'Tax return 2025',
    receipts: 'Collect receipts',
    submit: 'Submit',
    template: 'Weekly shop (template)',
    list: 'Write the list',
    buy: 'Go shopping',
    newTodo: 'Pack a towel',
    shiftStrand: 'Shift strand …',
    merge: 'Merge',
    checklist: 'Checklist',
  },
  de: {
    kitchen: 'Küche',
    organic: 'Biomüll rausbringen',
    collect: 'Geschirr einsammeln',
    load: 'Spülmaschine einräumen',
    shop: 'Wocheneinkauf',
    items: ['Milch', 'Brot', 'Äpfel', 'Kaffee'],
    morning: 'Samstagmorgen',
    up: 'Aufstehen',
    shower: 'Duschen',
    breakfast: 'Frühstück machen',
    coffee: 'Kaffee kochen',
    eat: 'Frühstücken',
    move: 'Umzug',
    boxes: 'Kartons besorgen',
    pack: 'Bücher packen',
    van: 'Transporter mieten',
    keys: 'Schlüssel übergeben',
    tax: 'Steuererklärung 2025',
    receipts: 'Belege sammeln',
    submit: 'Abschicken',
    template: 'Wocheneinkauf (Vorlage)',
    list: 'Einkaufszettel schreiben',
    buy: 'Einkaufen',
    newTodo: 'Handtuch einpacken',
    shiftStrand: 'Strang verschieben …',
    merge: 'Zusammenführen',
    checklist: 'Checkliste',
  },
};

function data(lang) {
  const t = TEXT[lang];
  const now = new Date().toISOString();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const task = (id, title, extra = {}) => ({ id, title, done: false, ...extra });
  const edge = (from, to) => ({ id: `${from}__${to}`, from, to });
  const list = (id, title, sortOrder, more) => ({
    id, title, timeboxMode: 'none', tasks: [], edges: [], archived: false, createdAt: now, updatedAt: now, sortOrder, ...more,
  });
  const lists = [
    list('kitchen', t.kitchen, 0, {
      tasks: [
        task('k1', t.organic),
        task('k2', t.collect),
        task('k3', t.load),
        task('k4', t.shop, {
          checklist: t.items.map((text, i) => ({ id: `c${i}`, text, done: i < 2 })),
        }),
      ],
      edges: [edge('k1', 'k2'), edge('k2', 'k3')],
    }),
    list('morning', t.morning, 1, {
      timeboxMode: 'dayPlan',
      dayPlanReferenceDate: tomorrow,
      tasks: [
        task('m1', t.up, { dayStart: '07:00', estimateMinutes: 15 }),
        task('m2', t.shower, { dayStart: '07:30', estimateMinutes: 15 }),
        task('m3', t.breakfast, { dayStart: '08:00', estimateMinutes: 20 }),
        task('m4', t.coffee, { dayStart: '08:00', estimateMinutes: 10 }),
        task('m5', t.eat, { dayStart: '08:30', estimateMinutes: 30 }),
      ],
      edges: [edge('m1', 'm2'), edge('m2', 'm3'), edge('m2', 'm4'), edge('m3', 'm5'), edge('m4', 'm5')],
    }),
    list('move', t.move, 2, {
      timeboxMode: 'estimate',
      tasks: [
        task('v1', t.boxes, { estimateMinutes: 30, done: true }),
        task('v2', t.pack, { estimateMinutes: 90 }),
        task('v3', t.van, { estimateMinutes: 15 }),
        task('v4', t.keys),
      ],
      edges: [edge('v1', 'v2'), edge('v3', 'v4')],
    }),
    list('tax', t.tax, 3, {
      archived: true,
      timeboxMode: 'estimate',
      tasks: [
        task('x1', t.receipts, { done: true, estimateMinutes: 60 }),
        task('x2', t.submit, { done: true, estimateMinutes: 30 }),
      ],
      edges: [edge('x1', 'x2')],
    }),
  ];
  const templates = [
    {
      id: 'tpl',
      title: t.template,
      timeboxMode: 'none',
      createdAt: now,
      tasks: [{ id: 'p1', title: t.list }, { id: 'p2', title: t.buy }],
      edges: [edge('p1', 'p2')],
    },
  ];
  return { lists, templates };
}

let page;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (selector) => page.eval(`document.querySelector(${JSON.stringify(selector)}).click()`);
const clickText = (selector, text) =>
  page.eval(`[...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.textContent.trim() === ${JSON.stringify(text)}).click()`);
const setValue = (selector, value) =>
  page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);

// Einfache Pixeldichte: Bilder erscheinen auf GitHub und in der App so groß wie auf dem Gerät.
async function viewport(width, height, scale = 1) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: width < 600 });
}

async function open(hash, ready, view) {
  await page.goto(BASE + hash);
  await page.waitFor(ready, hash);
  if (view !== undefined) {
    await page.eval(`document.querySelectorAll('.view-toggle button')[${view}].click()`);
    await page.waitFor(view === 1 ? `document.querySelector('.flow__canvas .node') !== null` : `document.querySelector('.task-card') !== null`, 'Ansicht');
  }
  await sleep(250);
}

const box = (selector) =>
  page.eval(`(() => {
    const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: r.left, y: r.top + scrollY, width: r.width, height: r.height };
  })()`);

/**
 * Speichert den Bereich von `selector` (höchstens `maxHeight` CSS-Pixel hoch).
 * `tall`: Das Fenster wird so hoch wie die Seite, damit schwebende Knöpfe im
 * Platz unter dem Inhalt stehen statt mittendrin; sonst gilt das aktuelle
 * Fenster (Dialoge).
 */
async function shoot(lang, name, selector, { maxHeight = 1400, tall = false, beyond = false } = {}) {
  // Ohne Fokusrahmen und Textcursor im Bild.
  await page.eval('window.scrollTo(0, 0); document.activeElement?.blur()');
  let area = await box(selector);
  if (tall) {
    await viewport(360, Math.min(3000, await page.eval('document.documentElement.scrollHeight')));
    await sleep(150);
    area = await box(selector);
  }
  const clip = { ...area, height: Math.min(area.height, maxHeight), scale: 1 };
  const { data: image } = await page.send('Page.captureScreenshot', {
    format: 'webp',
    quality: 80,
    clip,
    captureBeyondViewport: beyond,
  });
  writeFileSync(join(imagesDir, lang, `${name}.webp`), Buffer.from(image, 'base64'));
  if (tall) await viewport(360, 740);
  console.log(`  ${lang}/${name}.webp`);
}

for (const lang of ['en', 'de']) {
  console.log(lang);
  mkdirSync(join(imagesDir, lang), { recursive: true });
  page = await browser.newPage();
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await viewport(360, 740);

  // Testdaten, Sprache, helles Design; Erst-Start-Hinweise zunächst offen lassen.
  await page.goto(BASE);
  await page.waitFor(`document.querySelector('app-root h1') !== null`, 'App');
  const { lists, templates } = data(lang);
  await page.eval(`new Promise((resolve, reject) => {
    const req = indexedDB.open('faden');
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['lists', 'templates', 'settings'], 'readwrite');
      tx.objectStore('lists').clear();
      tx.objectStore('templates').clear();
      for (const l of ${JSON.stringify(lists)}) tx.objectStore('lists').put(l);
      for (const t of ${JSON.stringify(templates)}) tx.objectStore('templates').put(t);
      // lastBackupAt: kein Backup-Hinweisband in den Bildern.
      tx.objectStore('settings').put({
        key: 'app',
        // Volle Oberfläche (ohne einfachen Modus) – die Bilder zeigen alle Funktionen.
        value: { theme: 'light', language: '${lang}', schemaVersion: 3, lastBackupAt: new Date().toISOString(), simpleMode: { enabled: false } },
      });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);
  await page.eval(`${JSON.stringify(FIRST_RUN_KEYS)}.forEach((k) => localStorage.removeItem(k))`);
  await page.reload();

  // Erst-Start
  await page.waitFor(`document.querySelector('dialog[open]') !== null`, 'Speicher-Hinweis');
  await sleep(200);
  await shoot(lang, 'first-run', 'dialog[open]');
  await page.eval(`${JSON.stringify(FIRST_RUN_KEYS)}.forEach((k) => localStorage.setItem(k, '1'))`);
  await page.reload();

  // Übersicht und Archiv
  await open('#/', `document.querySelector('.cards') !== null`);
  await shoot(lang, 'overview', 'main', { maxHeight: 900, tall: true });
  await page.eval(`document.querySelectorAll('details.archived, details.archived__tasks').forEach((d) => (d.open = true))`);
  await sleep(100);
  await shoot(lang, 'archive', 'details.archived', { tall: true });

  // Jetzt dran, mit Checkliste auf der Karte
  await open('#/zettel/kitchen', `document.querySelector('.view-toggle') !== null`, 0);
  await shoot(lang, 'focus', 'main', { maxHeight: 1100, tall: true });

  // ToDo-Sheet mit Checkliste
  await click('.focus__bar button');
  await page.waitFor(`document.querySelector('dialog[open] input[name=title]') !== null`, 'Sheet');
  await setValue('dialog[open] input[name=title]', TEXT[lang].newTodo);
  await clickText('dialog[open] .segmented button', TEXT[lang].checklist);
  for (let i = 0; i < 2; i++) {
    await click('dialog[open] .checklist-edit__add');
    await sleep(50);
    await page.eval(`(() => {
      const inputs = document.querySelectorAll('dialog[open] .checklist-edit__text');
      const input = inputs[inputs.length - 1];
      input.value = ${JSON.stringify(TEXT[lang].items)}[${i}];
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
  }
  await page.eval(`document.activeElement.blur()`);
  await sleep(100);
  await shoot(lang, 'sheet', 'dialog[open]');
  await page.press('Escape');

  // Ablauf im Tagesplan: Verzweigung, Pausen am Pfeil
  await open('#/zettel/morning', `document.querySelector('.view-toggle') !== null`, 1);
  // Ganz über den sichtbaren Bereich hinaus (keine schwebenden Knöpfe auf dieser Seite).
  await shoot(lang, 'flow', 'app-flow-view .flow', { beyond: true });

  // Relatives Einfügen auf dem Pfeil Aufstehen → Duschen
  await click('.plus--edge');
  await page.waitFor(`document.querySelector('dialog[open] details.time[open]') !== null`, 'Zeit offen');
  await setValue('dialog[open] input[name=title]', TEXT[lang].newTodo);
  await clickText('dialog[open] .time .chip--button', `5 ${lang === 'de' ? 'Min' : 'min'}`);
  await setValue('dialog[open] input[name=pause]', '5');
  await page.waitFor(`document.querySelector('dialog[open] .placement') !== null`, 'Optionen');
  await page.eval(`document.querySelector('dialog[open] details.time').scrollIntoView()`);
  await sleep(100);
  await shoot(lang, 'sheet-relative', 'dialog[open] details.time');
  await page.press('Escape');

  // Strang verschieben
  await open('#/zettel/morning', `document.querySelector('.flow__canvas .node') !== null`);
  await click('.node__menu-btn');
  await clickText('.popover button', TEXT[lang].shiftStrand);
  await page.waitFor(`document.querySelector('dialog[open] [data-action=shift]') !== null`, 'Strang verschieben');
  await sleep(100);
  await shoot(lang, 'shift-strand', 'dialog[open]');
  await page.press('Escape');

  // Vorlagen und Einstellungen
  await open('#/vorlagen', `document.querySelector('main h1') !== null`);
  await shoot(lang, 'templates', 'main', { maxHeight: 360 });
  await open('#/einstellungen', `document.querySelector('main h1') !== null`);
  await shoot(lang, 'settings', 'main', { maxHeight: 1400, tall: true });
  await open('#/ueber', `document.querySelector('main h1') !== null`);
  await shoot(lang, 'about', 'main', { maxHeight: 900, tall: true });
  await open('#/einstellungen/fortgeschritten', `document.querySelector('.keys') !== null`);
  await page.eval(`document.querySelector('#shortcuts-heading').scrollIntoView()`);
  await shoot(lang, 'advanced', 'section[aria-labelledby=shortcuts-heading]', { maxHeight: 760, tall: true });

  // Farbschema: Standard duplizieren, Hauptfarbe ändern (nicht speichern)
  await click('app-scheme-section .scheme:first-child .scheme__actions button');
  await page.waitFor(`document.querySelector('.picker__hex') !== null`, 'Farbschema-Editor');
  await page.eval(`(() => {
    const hex = document.querySelector('.picker__hex');
    hex.value = '#2f5d7c';
    hex.dispatchEvent(new Event('change'));
  })()`);
  await sleep(100);
  await shoot(lang, 'scheme-editor', 'main', { maxHeight: 1500, tall: true });

  // Geführte Tour: erster Hinweis, gestartet aus „Über“
  await open('#/ueber', `document.querySelector('main h1') !== null`);
  await click('main .btn--primary');
  await page.waitFor(`document.querySelector('.tour .tour__title') !== null && document.querySelector('.tour-target') !== null`, 'Tour');
  await sleep(150);
  await shoot(lang, 'tour', 'body', { maxHeight: 740 });
  await click('.tour .btn--ghost');
  await open('#/einstellungen', `document.querySelector('main h1') !== null`);

  // Import mit gleichnamigem Zettel
  const backupFile = join(profile, `conflict-${lang}.json`);
  writeFileSync(backupFile, JSON.stringify({
    app: 'faden',
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    settings: { theme: 'light', language: lang, schemaVersion: 3 },
    lists: [data(lang).lists[0]],
    templates: [],
  }));
  const { root: doc } = await page.send('DOM.getDocument', {});
  const { nodeId } = await page.send('DOM.querySelector', { nodeId: doc.nodeId, selector: 'input[type=file]' });
  await page.send('DOM.setFileInputFiles', { nodeId, files: [backupFile] });
  await page.waitFor(`document.querySelector('dialog[open]') !== null`, 'Import-Dialog');
  await clickText('dialog[open] button', TEXT[lang].merge);
  await page.waitFor(`document.querySelector('dialog[open] .conflicts') !== null`, 'Konflikte');
  await sleep(100);
  await shoot(lang, 'import-conflicts', 'dialog[open]');
  await page.press('Escape');

  // Desktop: Seitenleiste und Diagramm
  await viewport(1280, 800);
  await open('#/zettel/morning', `document.querySelector('.flow__canvas .node') !== null`);
  await shoot(lang, 'flow-desktop', 'body', { maxHeight: 800 });
}

await browser.close();
server.close();
rmSync(profile, { recursive: true, force: true });

const sizes = ['en', 'de'].flatMap((lang) =>
  readdirSync(join(imagesDir, lang)).map((file) => statSync(join(imagesDir, lang, file)).size),
);
const total = sizes.reduce((a, b) => a + b, 0);
console.log(`${sizes.length} Bilder, zusammen ${Math.round(total / 1024)} KB (Richtwert < 1536 KB)`);
if (total > 1536 * 1024) process.exitCode = 1;
