// Erzeugt nach `ng build` die Precache-Liste für den Service Worker
// (SPEC 9.2, Variante B): `dist/faden/browser/precache-manifest.json`.
//
// Alle Dateien im Build-Output werden mit Inhalts-Hash aufgeführt; der
// Gesamt-Hash (`build`) benennt den Cache. `sw.js` selbst und die Liste
// werden nicht vorab gecacht (der Browser verwaltet sw.js eigenständig).

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist', 'faden', 'browser');
const MANIFEST = 'precache-manifest.json';
const EXCLUDE = new Set(['sw.js', MANIFEST, '3rdpartylicenses.txt']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sha = (data) => createHash('sha256').update(data).digest('hex');

const files = walk(outDir)
  .map((full) => ({ full, url: relative(outDir, full).split(sep).join('/') }))
  .filter(({ url }) => !EXCLUDE.has(url) && !url.endsWith('.map'))
  .sort((a, b) => a.url.localeCompare(b.url))
  .map(({ full, url }) => ({ url, rev: sha(readFileSync(full)).slice(0, 16) }));

if (!files.some((f) => f.url === 'index.html')) {
  console.error(`precache: index.html fehlt in ${outDir} – zuerst "ng build" ausführen.`);
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const build = sha(files.map((f) => `${f.url}:${f.rev}`).join('\n')).slice(0, 16);

writeFileSync(
  join(outDir, MANIFEST),
  JSON.stringify({ app: 'faden', version, build, files }, null, 2) + '\n',
);
console.log(`precache: ${files.length} Dateien, Version ${version}, Build ${build}`);
