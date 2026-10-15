// Tests für den Anleitungs-Konverter:  node --test scripts/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markdownToHtml, slug } from './markdown.mjs';

test('Überschriften mit GitHub-Ankern, Trennlinie', () => {
  assert.equal(
    markdownToHtml('## English\n\n---\n\n### 6.5 The todo sheet (create and edit)'),
    '<h2 id="english">English</h2>\n<hr>\n<h3 id="65-the-todo-sheet-create-and-edit">6.5 The todo sheet (create and edit)</h3>',
  );
  assert.equal(slug('Zettel-Übersicht & Archiv'), 'zettel-übersicht--archiv');
});

test('Absätze über mehrere Zeilen; fett, kursiv, Code, HTML wird maskiert', () => {
  assert.equal(
    markdownToHtml('Tap **“Create”** and\n*then* `Enter` <b>'),
    '<p>Tap <strong>“Create”</strong> and <em>then</em> <code>Enter</code> &lt;b&gt;</p>',
  );
});

test('Links: Anker bleiben, externe öffnen neu, umgeschriebene/entfernte', () => {
  const html = markdownToHtml('[A](#english) [B](https://x.org) [C](../README.md#english)', {
    link: (url) => (url.startsWith('../') ? null : url),
  });
  assert.equal(html, '<p><a href="#english">A</a> <a href="https://x.org" target="_blank" rel="noopener">B</a> C</p>');
});

test('Bilder mit umgeschriebenem Pfad', () => {
  assert.equal(
    markdownToHtml('![Die Übersicht](images/de/overview.png)', { image: (url) => `guide/${url}` }),
    '<p><img src="guide/images/de/overview.png" alt="Die Übersicht" loading="lazy"></p>',
  );
});

test('Listen: nummeriert mit Folgezeilen, verschachtelt, direkt nach einem Absatz', () => {
  const md = [
    'Via the menu:',
    '- **Rename** – change',
    '  the title.',
    '- Description:',
    '  - *Text*: notes.',
    '  - *Checklist*: items.',
    '',
    '1. Open the app.',
    '2. Choose a mode. The default is',
    '   “None”.',
  ].join('\n');
  assert.equal(
    markdownToHtml(md),
    [
      '<p>Via the menu:</p>',
      '<ul><li><strong>Rename</strong> – change the title.</li><li>Description:<ul><li><em>Text</em>: notes.</li><li><em>Checklist</em>: items.</li></ul></li></ul>',
      '<ol><li>Open the app.</li><li>Choose a mode. The default is “None”.</li></ol>',
    ].join('\n'),
  );
});

test('Leerzeile zwischen Punkten setzt die Liste fort, ein Absatz beendet sie', () => {
  assert.equal(markdownToHtml('- a\n\n- b\n\nText'), '<ul><li>a</li><li>b</li></ul>\n<p>Text</p>');
});

test('Zitate als Hinweis-Kasten, mit Liste darin', () => {
  assert.equal(
    markdownToHtml('> **On a phone:** tap\n> - one\n> - two\n\nAfter'),
    '<blockquote><p><strong>On a phone:</strong> tap</p>\n<ul><li>one</li><li>two</li></ul></blockquote>\n<p>After</p>',
  );
});

test('Tabellen', () => {
  assert.equal(
    markdownToHtml('| Term | Meaning |\n|---|---|\n| **List** | A list. |'),
    '<table><thead><tr><th>Term</th><th>Meaning</th></tr></thead><tbody><tr><td><strong>List</strong></td><td>A list.</td></tr></tbody></table>',
  );
});
