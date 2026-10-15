// Rendert docs/USER-GUIDE.md für die App: public/guide/guide.html (ein
// HTML-Fragment, das die App per [innerHTML] zeigt) plus die Bilder aus
// docs/images/. Läuft vor `ng build` und `ng serve`; die Ausgabe ist nicht
// eingecheckt und landet über den Build im Precache (offline verfügbar).

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownToHtml } from './lib/markdown.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'guide');
const images = join(root, 'docs', 'images');

const html = markdownToHtml(readFileSync(join(root, 'docs', 'USER-GUIDE.md'), 'utf8'), {
  // Anker und Webadressen bleiben; Verweise auf andere Repo-Dateien gibt es in der App nicht.
  link: (url) => (url.startsWith('#') || /^https?:/.test(url) ? url : null),
  // Bildpfade relativ zur App (die Anleitung wird in die Seite eingesetzt).
  image: (url) => `guide/${url}`,
});

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'guide.html'), html + '\n');
if (existsSync(images)) cpSync(images, join(outDir, 'images'), { recursive: true });
console.log(`guide: ${Math.round(html.length / 1024)} KB → public/guide/guide.html`);
