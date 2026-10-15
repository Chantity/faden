// Rendert docs/USER-GUIDE.md und CHANGELOG.md für die App, je Sprache eine Datei:
// public/guide/{guide,changelog}.{en,de}.html (HTML-Fragmente, die die App per
// [innerHTML] zeigt) plus die Bilder aus docs/images/. Läuft vor
// `ng build` und `ng serve`; die Ausgabe ist nicht eingecheckt und landet über
// den Build im Precache (offline verfügbar).

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownToHtml, splitLanguages } from './lib/markdown.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'guide');
const images = join(root, 'docs', 'images');

const render = (markdown) =>
  markdownToHtml(markdown, {
    // Anker und Webadressen bleiben; Verweise auf andere Repo-Dateien gibt es in der App nicht.
    link: (url) => (url.startsWith('#') || /^https?:/.test(url) ? url : null),
    // Bildpfade relativ zur App (die Anleitung wird in die Seite eingesetzt).
    image: (url) => `guide/${url}`,
  });

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const [source, name] of [
  ['docs/USER-GUIDE.md', 'guide'],
  ['CHANGELOG.md', 'changelog'],
]) {
  const parts = splitLanguages(readFileSync(join(root, source), 'utf8'));
  for (const [lang, markdown] of Object.entries(parts)) {
    const target = `${name}.${lang}.html`;
    const html = render(markdown);
    writeFileSync(join(outDir, target), html + '\n');
    console.log(`guide: ${source} → public/guide/${target} (${Math.round(html.length / 1024)} KB)`);
  }
}
if (existsSync(images)) cpSync(images, join(outDir, 'images'), { recursive: true });
