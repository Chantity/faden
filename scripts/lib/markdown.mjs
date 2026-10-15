// Kleiner Markdown → HTML-Konverter für die Anleitung (keine Abhängigkeit).
// Kann nur, was docs/USER-GUIDE.md nutzt: Überschriften mit Ankern, Absätze,
// Trennlinien, Zitate (Hinweis-Kästen), Listen (auch verschachtelt und
// nummeriert, mit Folgezeilen), Tabellen, fett/kursiv/Code, Links und Bilder.

const LIST_ITEM = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const TABLE_SEPARATOR = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (text) => escapeHtml(text).replace(/"/g, '&quot;');

/** Anker wie bei GitHub: klein, ohne Satzzeichen, Leerzeichen → „-“. */
export function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

/**
 * @param {string} markdown
 * @param {{ link?: (url: string) => string | null, image?: (url: string) => string }} [options]
 *   `link` darf eine URL umschreiben oder mit `null` nur den Text behalten.
 */
export function markdownToHtml(markdown, options = {}) {
  const link = options.link ?? ((url) => url);
  const image = options.image ?? ((url) => url);

  function inline(text) {
    const codes = [];
    let out = escapeHtml(text).replace(/`([^`]+)`/g, (_, code) => {
      codes.push(`<code>${code}</code>`);
      return `\u0000${codes.length - 1}\u0000`;
    });
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => `<img src="${escapeAttr(image(url))}" alt="${alt.replace(/"/g, '&quot;')}" loading="lazy">`);
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      const target = link(url);
      if (target === null) return label;
      const external = /^https?:/.test(target) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${escapeAttr(target)}"${external}>${label}</a>`;
    });
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?![\w*])/g, '$1<em>$2</em>');
    return out.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  }

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length > 0) html.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const indentOf = (line) => line.match(/^\s*/)[0].length;
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => inline(c.trim()));

  /** Liest eine Liste ab `start` mit Einrückung `indent`; liefert HTML und die nächste Zeile. */
  function list(start, indent) {
    const ordered = /\d/.test(LIST_ITEM.exec(lines[start])[2]);
    const items = [];
    let i = start;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') {
        // Leerzeile: Liste geht nur weiter, wenn danach wieder ein Punkt kommt.
        let next = i + 1;
        while (next < lines.length && lines[next].trim() === '') next++;
        const match = LIST_ITEM.exec(lines[next] ?? '');
        if (match && match[1].length >= indent) {
          i = next;
          continue;
        }
        break;
      }
      const match = LIST_ITEM.exec(line);
      const depth = indentOf(line);
      if (match && depth === indent && /\d/.test(match[2]) !== ordered) break; // anderer Listentyp
      if (match && depth === indent) {
        items.push({ text: [match[3]], children: '' });
        i++;
      } else if (match && depth > indent && items.length > 0) {
        const nested = list(i, depth);
        items[items.length - 1].children += nested.html;
        i = nested.next;
      } else if (!match && depth > indent && items.length > 0) {
        items[items.length - 1].text.push(line.trim());
        i++;
      } else {
        break;
      }
    }
    const tag = ordered ? 'ol' : 'ul';
    const body = items.map((item) => `<li>${inline(item.text.join(' '))}${item.children}</li>`).join('');
    return { html: `<${tag}>${body}</${tag}>`, next: i };
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (line.trim() === '') {
      flush();
      i++;
    } else if (line.startsWith('>')) {
      // Zitat = Hinweis-Kasten („Am PC“ / „Auf dem Handy“); Inhalt wie ein eigenes Dokument.
      flush();
      const quoted = [];
      while (i < lines.length && lines[i].startsWith('>')) quoted.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote>${markdownToHtml(quoted.join('\n'), options)}</blockquote>`);
    } else if (/^-{3,}\s*$/.test(line)) {
      flush();
      html.push('<hr>');
      i++;
    } else if (heading) {
      flush();
      const level = heading[1].length;
      html.push(`<h${level} id="${slug(heading[2])}">${inline(heading[2])}</h${level}>`);
      i++;
    } else if (line.trim().startsWith('|') && TABLE_SEPARATOR.test(lines[i + 1] ?? '')) {
      flush();
      const head = cells(line).map((c) => `<th>${c}</th>`).join('');
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(`<tr>${cells(lines[i]).map((c) => `<td>${c}</td>`).join('')}</tr>`);
        i++;
      }
      html.push(`<table><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`);
    } else if (LIST_ITEM.test(line)) {
      flush();
      const result = list(i, indentOf(line));
      html.push(result.html);
      i = result.next;
    } else {
      paragraph.push(line.trim());
      i++;
    }
  }
  flush();
  return html.join('\n');
}

/**
 * Teilt ein zweisprachiges Dokument (`## English` … `---` … `## Deutsch` …) in
 * je einen Teil pro Sprache – ohne Kopf, Sprach-Links und Sprach-Überschrift.
 */
export function splitLanguages(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = (heading) => {
    const index = lines.indexOf(heading);
    if (index < 0) throw new Error(`Abschnitt „${heading}“ fehlt`);
    return index;
  };
  const en = start('## English');
  const de = start('## Deutsch');
  const trim = (part) => {
    const body = [...part];
    // Trennlinie vor dem nächsten Sprachabschnitt fällt weg.
    while (body.length && /^(---)?\s*$/.test(body[body.length - 1])) body.pop();
    while (body.length && body[0].trim() === '') body.shift();
    return body.join('\n') + '\n';
  };
  return {
    en: trim(lines.slice(en + 1, de > en ? de : undefined)),
    de: trim(lines.slice(de + 1, en > de ? en : undefined)),
  };
}
