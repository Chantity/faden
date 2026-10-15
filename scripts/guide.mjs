// Rendert docs/USER-GUIDE.md und CHANGELOG.md für die App:
// public/guide/guide.html und public/guide/changelog.html (HTML-Fragmente, die
// die App per [innerHTML] zeigt) plus die Bilder aus docs/images/. Läuft vor
// `ng build` und `ng serve`; die Ausgabe ist nicht eingecheckt und landet über
// den Build im Precache (offline verfügbar).

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownToHtml } from './lib/markdown.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'guide');
const images = join(root, 'docs', 'images');

const render = (file) =>
  markdownToHtml(readFileSync(join(root, file), 'utf8'), {
    // Anker und Webadressen bleiben; Verweise auf andere Repo-Dateien gibt es in der App nicht.
    link: (url) => (url.startsWith('#') || /^https?:/.test(url) ? url : null),
    // Bildpfade relativ zur App (die Anleitung wird in die Seite eingesetzt).
    image: (url) => `guide/${url}`,
  });

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const [source, target] of [
  ['docs/USER-GUIDE.md', 'guide.html'],
  ['CHANGELOG.md', 'changelog.html'],
]) {
  const html = render(source);
  writeFileSync(join(outDir, target), html + '\n');
  console.log(`guide: ${source} → public/guide/${target} (${Math.round(html.length / 1024)} KB)`);
}
if (existsSync(images)) cpSync(images, join(outDir, 'images'), { recursive: true });
