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

/**
 * Szybkie skanowanie struktury projektu (bez zawartości plików).
 * Używane do auto-kontekstu przy starcie.
 *
 * @param {string} targetPath - ścieżka do katalogu
 * @param {number} [maxDepth=3] - maksymalna głębokość skanowania
 * @returns {Promise<{rootPath: string, files: string[], dirs: string[], packageJson: object|null}>}
 */
export async function quickScanProject(targetPath, maxDepth = 3) {
  const result = {
    rootPath: targetPath,
    files: [],
    dirs: [],
    packageJson: null,
    gitIgnore: false,
  };

  await quickScanDir(targetPath, targetPath, result, 0, maxDepth);

  // Próbuj załadować package.json dla kontekstu
  try {
    const pkgPath = join(targetPath, 'package.json');
    const pkgContent = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);
    result.packageJson = {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      main: pkg.main,
      scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
      dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
      devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies) : [],
    };
  } catch {
    // Brak package.json - to OK
  }

  // Sprawdź czy jest .gitignore
  try {
    await stat(join(targetPath, '.gitignore'));
    result.gitIgnore = true;
  } catch {
    // Brak .gitignore
  }

  // Załaduj kluczowe pliki (README, entry point)
  try {
    result.keyFiles = await loadKeyFiles(targetPath, result.files, result.packageJson);
  } catch {
    result.keyFiles = {};
  }

  return result;
}

async function quickScanDir(dir, rootPath, result, depth, maxDepth) {
  if (depth > maxDepth) return;
  if (result.files.length > 200) return; // Limit bezpieczeństwa

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (result.files.length > 200) break;

    const fullPath = join(dir, entry.name);
    const relPath = relative(rootPath, fullPath);

    if (entry.isDirectory()) {
      if (CONFIG.ANALYZER_EXCLUDED_DIRS.includes(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;

      result.dirs.push(relPath);
      await quickScanDir(fullPath, rootPath, result, depth + 1, maxDepth);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      // Tylko pliki z rozpoznawalnymi rozszerzeniami lub kluczowe pliki
      if (CONFIG.ANALYZER_EXTENSIONS.includes(ext) ||
          ['package.json', 'tsconfig.json', 'README.md', '.env.example', 'Dockerfile', 'Makefile'].includes(entry.name)) {
        result.files.push(relPath);
      }
    }
  }
}

/**
 * Ładuje treść kluczowych plików projektu (README.md, entry point).
 * Zwraca obiekt { nazwa: treść (obcięta do maxLines) }.
 *
 * @param {string} rootPath - ścieżka do katalogu projektu
 * @param {string[]} fileList - lista plików ze skanu
 * @param {object|null} packageJson - dane z package.json
 * @returns {Promise<Object<string, string>>}
 */
export async function loadKeyFiles(rootPath, fileList, packageJson) {
  const maxLines = CONFIG.ANALYZER_KEY_FILE_MAX_LINES || 60;
  const keyFiles = {};

  // README.md — pierwsze 60 linii
  const readmeName = fileList.find(f => f.toLowerCase() === 'readme.md');
  if (readmeName) {
    try {
      const content = await readFile(join(rootPath, readmeName), 'utf-8');
      const lines = content.split('\n').slice(0, maxLines);
      keyFiles[readmeName] = lines.join('\n');
    } catch {
      // pomiń — plik niedostępny
    }
  }

  // Main entry point z package.json — pierwsze 40 linii
  const entryFile = packageJson?.main;
  if (entryFile && fileList.includes(entryFile)) {
    try {
      const content = await readFile(join(rootPath, entryFile), 'utf-8');
      const lines = content.split('\n').slice(0, 40);
      keyFiles[entryFile] = lines.join('\n');
    } catch {
      // pomiń
    }
  }

  return keyFiles;
}

/**
 * Buduje zwięzły kontekst struktury projektu (bez zawartości).
 */
export function buildQuickContext(scan) {
  if (!scan) return '';

  let ctx = `\n\n--- STRUKTURA PROJEKTU (${scan.rootPath}) ---\n`;

  if (scan.packageJson) {
    ctx += `\n📦 Projekt: ${scan.packageJson.name || 'nieznany'} v${scan.packageJson.version || '?'}\n`;
    if (scan.packageJson.description) {
      ctx += `   ${scan.packageJson.description}\n`;
    }
    if (scan.packageJson.main) {
      ctx += `   Entry: ${scan.packageJson.main}\n`;
    }
    if (scan.packageJson.scripts.length > 0) {
      ctx += `   Skrypty: ${scan.packageJson.scripts.join(', ')}\n`;
    }
    if (scan.packageJson.dependencies.length > 0) {
      ctx += `   Deps: ${scan.packageJson.dependencies.slice(0, 10).join(', ')}${scan.packageJson.dependencies.length > 10 ? '...' : ''}\n`;
    }
  }

  ctx += `\n📁 Pliki (${scan.files.length}):\n`;
  ctx += buildFileTree(scan.files);

  // Kluczowe pliki — treść
  if (scan.keyFiles && Object.keys(scan.keyFiles).length > 0) {
    ctx += '\n\n--- KLUCZOWE PLIKI ---\n';
    for (const [name, content] of Object.entries(scan.keyFiles)) {
      ctx += `\n### ${name}\n${content}\n`;
    }
  }

  ctx += '\n\n💡 Użyj @plik.js aby załadować zawartość konkretnego pliku.\n';
  ctx += '--- KONIEC STRUKTURY ---\n';

  return ctx;
}
