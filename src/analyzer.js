// analyzer.js - Analiza projektu (skanowanie plików, budowanie kontekstu)

import { readdir, readFile, stat } from 'fs/promises';
import { join, extname, relative, sep } from 'path';
import { CONFIG } from './config.js';

/**
 * @typedef {Object} ProjectAnalysis
 * @property {string} rootPath
 * @property {string[]} files - ścieżki względne
 * @property {Object<string,string>} contents - path → zawartość
 * @property {number} totalSize
 * @property {string[]} skipped - powody pominięcia
 */

/**
 * Rekurencyjne skanowanie katalogu z limitami.
 *
 * @param {string} targetPath - ścieżka do katalogu
 * @returns {Promise<ProjectAnalysis>}
 */
export async function analyzeProject(targetPath) {
  const result = {
    rootPath: targetPath,
    files: [],
    contents: {},
    totalSize: 0,
    skipped: [],
  };

  await scanDir(targetPath, targetPath, result, 0);
  return result;
}

async function scanDir(dir, rootPath, result, depth) {
  if (depth > CONFIG.ANALYZER_MAX_DEPTH) {
    result.skipped.push(`Pominięto ${dir} — przekroczono max głębokość (${CONFIG.ANALYZER_MAX_DEPTH})`);
    return;
  }

  if (result.files.length >= CONFIG.ANALYZER_MAX_FILES) {
    return;
  }

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    result.skipped.push(`Nie można odczytać: ${dir}`);
    return;
  }

  for (const entry of entries) {
    if (result.files.length >= CONFIG.ANALYZER_MAX_FILES) break;
    if (result.totalSize >= CONFIG.ANALYZER_MAX_TOTAL_SIZE) break;

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (CONFIG.ANALYZER_EXCLUDED_DIRS.includes(entry.name)) continue;
      await scanDir(fullPath, rootPath, result, depth + 1);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (!CONFIG.ANALYZER_EXTENSIONS.includes(ext)) continue;

      let fileStat;
      try {
        fileStat = await stat(fullPath);
      } catch {
        result.skipped.push(`Nie można odczytać metadanych: ${fullPath}`);
        continue;
      }

      if (fileStat.size > CONFIG.ANALYZER_MAX_FILE_SIZE) {
        result.skipped.push(`Za duży plik (${(fileStat.size / 1024).toFixed(1)}KB): ${fullPath}`);
        continue;
      }

      if (result.totalSize + fileStat.size > CONFIG.ANALYZER_MAX_TOTAL_SIZE) {
        result.skipped.push(`Limit łącznego rozmiaru — pominięto resztę`);
        break;
      }

      try {
        const content = await readFile(fullPath, 'utf-8');
        const relPath = relative(rootPath, fullPath);
        result.files.push(relPath);
        result.contents[relPath] = content;
        result.totalSize += fileStat.size;
      } catch {
        result.skipped.push(`Nie można odczytać: ${fullPath}`);
      }
    }
  }
}

/**
 * Buduje wizualne drzewo plików jako string.
 */
export function buildFileTree(filePaths) {
  if (!filePaths || filePaths.length === 0) return '(brak plików)';

  const tree = {};

  for (const fp of filePaths) {
    const parts = fp.split(/[/\\]/);
    let node = tree;
    for (const part of parts) {
      if (!node[part]) node[part] = {};
      node = node[part];
    }
  }

  const lines = [];
  renderTree(tree, '', lines, true);
  return lines.join('\n');
}

function renderTree(node, prefix, lines, isRoot) {
  const keys = Object.keys(node).sort();
  keys.forEach((key, idx) => {
    const isLast = idx === keys.length - 1;
    const connector = isRoot ? '' : (isLast ? '└── ' : '├── ');
    const newPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
    const children = Object.keys(node[key]);

    if (children.length > 0) {
      lines.push(`${isRoot ? '' : prefix}${connector}${key}/`);
      renderTree(node[key], newPrefix, lines, false);
    } else {
      lines.push(`${isRoot ? '' : prefix}${connector}${key}`);
    }
  });
}

/**
 * Formatuje analizę projektu jako kontekst do wstrzyknięcia w system prompt.
 */
export function buildProjectContext(analysis) {
  if (!analysis || analysis.files.length === 0) {
    return '';
  }

  let ctx = `\n\n--- KONTEKST PROJEKTU (${analysis.rootPath}) ---\n`;
  ctx += `Pliki (${analysis.files.length}):\n`;
  ctx += buildFileTree(analysis.files);
  ctx += '\n\n';

  for (const [path, content] of Object.entries(analysis.contents)) {
    const ext = extname(path).replace('.', '') || 'plaintext';
    ctx += `--- ${path} ---\n\`\`\`${ext}\n${content}\n\`\`\`\n\n`;
  }

  if (analysis.skipped.length > 0) {
    ctx += `Pominięte: ${analysis.skipped.length} elementów\n`;
  }

  ctx += '--- KONIEC KONTEKSTU ---\n';
  return ctx;
}
