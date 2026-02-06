// web.js - Pobieranie dokumentacji z URL

import https from 'https';
import http from 'http';
import chalk from 'chalk';

/**
 * Pobiera zawartość URL i konwertuje HTML na tekst.
 * @param {string} url - URL do pobrania
 * @returns {Promise<{success: boolean, content: string, error?: string}>}
 */
export async function fetchUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;

    const request = client.get(url, {
      headers: {
        'User-Agent': 'AI-Coding-CLI/2.0',
        'Accept': 'text/html,application/xhtml+xml,text/plain,*/*',
      },
      timeout: 15000,
    }, (res) => {
      // Obsługa przekierowań
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve);
        return;
      }

      if (res.statusCode !== 200) {
        resolve({ success: false, content: '', error: `HTTP ${res.statusCode}` });
        return;
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const text = htmlToText(data);
        resolve({ success: true, content: text });
      });
    });

    request.on('error', (err) => {
      resolve({ success: false, content: '', error: err.message });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({ success: false, content: '', error: 'Timeout' });
    });
  });
}

/**
 * Konwertuje HTML na czysty tekst.
 * @param {string} html
 * @returns {string}
 */
function htmlToText(html) {
  // Usuń skrypty i style
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Zamień nagłówki na markdown
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');

  // Zamień listy
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n');
  text = text.replace(/<ul[^>]*>|<\/ul>|<ol[^>]*>|<\/ol>/gi, '\n');

  // Zamień paragrafy i div na nowe linie
  text = text.replace(/<\/p>|<\/div>|<br\s*\/?>/gi, '\n');
  text = text.replace(/<p[^>]*>|<div[^>]*>/gi, '\n');

  // Zachowaj bloki kodu
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Usuń pozostałe tagi
  text = text.replace(/<[^>]+>/g, '');

  // Dekoduj encje HTML
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');

  // Wyczyść białe znaki
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * Obsługuje komendę /web.
 * @param {string} url - URL do pobrania
 * @returns {Promise<string|null>} - kontekst do dodania lub null
 */
export async function handleWebCommand(url) {
  if (!url) {
    console.log(chalk.cyan('\n🌐 Użycie: /web <URL>\n'));
    console.log(chalk.gray('  Przykład: /web https://docs.python.org/3/library/json.html\n'));
    return null;
  }

  // Walidacja URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  console.log(chalk.cyan(`\n🌐 Pobieranie: ${url}...\n`));

  const { success, content, error } = await fetchUrl(url);

  if (!success) {
    console.log(chalk.red(`✖ Błąd pobierania: ${error}\n`));
    return null;
  }

  // Ogranicz rozmiar
  const maxChars = 10000;
  const truncated = content.length > maxChars
    ? content.substring(0, maxChars) + '\n\n[... obcięto]'
    : content;

  console.log(chalk.green(`✔ Pobrano ${content.length} znaków\n`));

  // Pokaż podgląd
  const preview = truncated.substring(0, 500);
  console.log(chalk.gray('Podgląd:'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.gray(preview + '...'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log();

  // Zwróć jako kontekst
  return `\n[DOKUMENTACJA Z: ${url}]\n${truncated}\n[KONIEC DOKUMENTACJI]\n`;
}
