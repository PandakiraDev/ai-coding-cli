// executor.js - Bezpieczne wykonywanie komend PowerShell

import { exec } from 'child_process';
import { resolve as resolvePath } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { CONFIG } from './config.js';
import { extractCodeBlocks } from './parser.js';
import { readConfirm } from './input.js';
import { logger } from './logger.js';

// Śledzenie katalogu roboczego między komendami
let currentWorkingDir = process.cwd();

const EXEC_TIMEOUT = 30_000;        // 30s - zwykłe komendy
const LONG_EXEC_TIMEOUT = 300_000;  // 5min - npm/npx/instalacje

// Komendy wymagające dłuższego timeout (instalują paczki, budują projekty)
const LONG_RUNNING_PATTERNS = [
  'npm ', 'npx ', 'yarn ', 'pnpm ',
  'pip ', 'pip3 ',
  'dotnet ', 'cargo ',
  'git clone', 'git pull',
  'docker ', 'docker-compose',
  'Install-Module', 'Install-Package',
  'choco ', 'winget ', 'scoop ',
];

/**
 * Dobiera timeout do komendy.
 */
function getTimeout(cmd) {
  const lower = cmd.toLowerCase();
  if (LONG_RUNNING_PATTERNS.some(p => lower.includes(p.toLowerCase()))) {
    return LONG_EXEC_TIMEOUT;
  }
  return EXEC_TIMEOUT;
}

/**
 * Wykrywa komendy cd/Set-Location i aktualizuje katalog roboczy.
 * @param {string} cmd
 */
function detectAndUpdateCwd(cmd) {
  // Rozpoznaj cd / Set-Location / Push-Location na początku lub jako jedyną komendę
  const cdPatterns = [
    /^\s*cd\s+["']?([^"'\n;|]+)["']?\s*$/im,
    /^\s*Set-Location\s+(?:-Path\s+)?["']?([^"'\n;|]+)["']?\s*$/im,
    /^\s*Push-Location\s+(?:-Path\s+)?["']?([^"'\n;|]+)["']?\s*$/im,
    /^\s*sl\s+["']?([^"'\n;|]+)["']?\s*$/im,
  ];

  for (const pattern of cdPatterns) {
    const match = cmd.match(pattern);
    if (match) {
      const target = match[1].trim();
      const newDir = resolvePath(currentWorkingDir, target);

      if (existsSync(newDir)) {
        currentWorkingDir = newDir;
        logger.info('EXEC', `Katalog roboczy: ${currentWorkingDir}`);
        console.log(chalk.gray(`📂 Katalog roboczy: ${currentWorkingDir}\n`));
      }
      return;
    }
  }
}

/**
 * Pobiera aktualny katalog roboczy.
 */
export function getWorkingDir() {
  return currentWorkingDir;
}

/**
 * Ustawia katalog roboczy (np. przy rescan kontekstu).
 */
export function setWorkingDir(dir) {
  if (existsSync(dir)) {
    currentWorkingDir = dir;
  }
}

/**
 * Wyświetla blok kodu w czytelnym formacie (box).
 * @param {string} cmd - komenda do wyświetlenia
 * @param {boolean} dangerous - czy komenda jest niebezpieczna
 */
function displayCommandBlock(cmd, dangerous = false) {
  const lines = cmd.split('\n');
  const maxLen = Math.min(Math.max(...lines.map(l => l.length), 40), 80);
  const border = '─'.repeat(maxLen + 2);

  const headerColor = dangerous ? chalk.red : chalk.cyan;
  const headerText = dangerous ? ' ⚠️  KOMENDA (NIEBEZPIECZNA) ' : ' 📋 KOMENDA ';

  console.log(headerColor(`\n┌${headerText}${'─'.repeat(Math.max(0, maxLen - headerText.length + 2))}┐`));

  for (const line of lines) {
    const padding = ' '.repeat(Math.max(0, maxLen - line.length));
    console.log(headerColor('│ ') + chalk.white(line) + padding + headerColor(' │'));
  }

  console.log(headerColor(`└${border}┘\n`));
}

/**
 * Sprawdza czy komenda zawiera niebezpieczne wzorce.
 */
export function isDangerousCommand(cmd) {
  const lower = cmd.toLowerCase();
  return CONFIG.DANGEROUS_COMMANDS.some(
    (pattern) => lower.includes(pattern.toLowerCase())
  );
}

/**
 * Wykonuje pojedynczą komendę po potwierdzeniu użytkownika.
 * Niebezpieczne komendy wymagają podwójnego potwierdzenia.
 *
 * 3 ścieżki:
 * 1. autoExecute && !dangerous → auto-wykonaj
 * 2. autoExecute && dangerous → jedno potwierdzenie (nie podwójne)
 * 3. !autoExecute → obecna logika (potwierdzenie + podwójne dla dangerous)
 *
 * @param {string} cmd
 * @param {boolean} [autoExecute=false]
 */
export async function executeCommand(cmd, autoExecute = false) {
  const dangerous = isDangerousCommand(cmd);

  logger.command(cmd, { autoExecute, dangerous });
  logger.trace('EXEC', 'Pełna komenda:', cmd);

  if (autoExecute && !dangerous) {
    // Ścieżka 1: auto-execute bezpiecznych komend
    displayCommandBlock(cmd, false);
    console.log(chalk.yellow('⚡ Auto-wykonuję...\n'));
    logger.debug('EXEC', 'Tryb: auto-execute (bezpieczna)');
  } else if (autoExecute && dangerous) {
    // Ścieżka 2: jedno potwierdzenie dla niebezpiecznych w trybie auto
    displayCommandBlock(cmd, true);

    const confirm = await readConfirm(
      chalk.red('Czy NA PEWNO chcesz wykonać tę niebezpieczną komendę?'),
      false
    );

    if (!confirm) {
      console.log(chalk.gray('Komenda pominięta.\n'));
      return { command: cmd, skipped: true };
    }
  } else {
    // Ścieżka 3: normalna logika (bez auto-execute)
    displayCommandBlock(cmd, dangerous);

    // Pierwsze potwierdzenie
    const confirm = await readConfirm(
      dangerous
        ? chalk.red('Czy NA PEWNO chcesz wykonać tę niebezpieczną komendę?')
        : chalk.yellow('Wykonać tę komendę w PowerShell?'),
      !dangerous
    );

    if (!confirm) {
      console.log(chalk.gray('Komenda pominięta.\n'));
      return { command: cmd, skipped: true };
    }

    // Podwójne potwierdzenie dla niebezpiecznych komend
    if (dangerous) {
      const doubleConfirm = await readConfirm(
        chalk.red.bold('OSTATNIE OSTRZEŻENIE: Potwierdź ponownie'),
        false
      );
      if (!doubleConfirm) {
        console.log(chalk.gray('Komenda pominięta.\n'));
        return { command: cmd, skipped: true };
      }
    }
  }

  // Wykonanie
  const result = { command: cmd, success: false, stdout: '', stderr: '', error: null };
  const timeout = getTimeout(cmd);

  // Info o dłuższym timeout
  if (timeout > EXEC_TIMEOUT) {
    console.log(chalk.gray(`⏳ Wykryto komendę instalacyjną — timeout: ${timeout / 1000}s\n`));
  }

  // Wykryj cd/Set-Location i zaktualizuj katalog
  detectAndUpdateCwd(cmd);

  // Wrapper PowerShell z poprawnym kodowaniem UTF-8
  const utf8Wrapper = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
${cmd}
`;

  logger.debug('EXEC', `cwd: ${currentWorkingDir}`);
  const startTime = Date.now();

  console.log(chalk.gray('─'.repeat(60)));

  try {
    await new Promise((resolve, reject) => {
      const child = exec(utf8Wrapper, {
        shell: 'powershell.exe',
        timeout,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        cwd: currentWorkingDir,
      });

      // Real-time stdout streaming
      child.stdout.on('data', (data) => {
        const text = data.toString();
        result.stdout += text;
        process.stdout.write(chalk.white(text));
      });

      // Real-time stderr streaming
      child.stderr.on('data', (data) => {
        const text = data.toString();
        result.stderr += text;
        process.stdout.write(chalk.yellow(text));
      });

      child.on('close', (code) => {
        if (code === 0) {
          result.success = true;
          resolve();
        } else {
          result.error = `Proces zakończony z kodem ${code}`;
          reject(new Error(result.error));
        }
      });

      child.on('error', (err) => {
        result.error = err.message;
        reject(err);
      });
    });

    const duration = Date.now() - startTime;

    logger.commandResult(cmd.slice(0, 50), true, result.stdout?.slice(0, 200));
    logger.debug('EXEC', `Czas wykonania: ${duration}ms`);

    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.green('✔ Komenda wykonana'));

    if (result.stderr?.trim()) {
      logger.warn('EXEC', 'Ostrzeżenia stderr:', result.stderr.slice(0, 200));
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    if (!result.error) result.error = error.message;

    logger.commandResult(cmd.slice(0, 50), false, result.error);
    logger.debug('EXEC', `Błąd po ${duration}ms`);

    console.log(chalk.gray('─'.repeat(60)));

    if (error.killed) {
      console.log(chalk.red(`✖ Komenda przerwana - przekroczono timeout (${timeout / 1000}s)`));
      result.error = `Timeout po ${timeout / 1000}s`;
      logger.error('EXEC', 'Timeout!', { timeout });
    } else {
      console.log(chalk.red('✖ Błąd wykonania komendy'));
      if (!result.stdout && !result.stderr) {
        // Pokaż błąd tylko jeśli nie było streaming output
        console.log(chalk.red(result.error));
      }
    }
  }
  console.log();
  return result;
}

/**
 * Znajduje bloki PowerShell w odpowiedzi i oferuje ich wykonanie.
 * Zwraca tablicę wyników wykonania.
 * @param {string} response
 * @param {boolean} [autoExecute=false]
 * @returns {Promise<Array<{command: string, success?: boolean, stdout?: string, stderr?: string, error?: string, skipped?: boolean}>>}
 */
export async function handlePowerShellCommands(response, autoExecute = false) {
  const blocks = extractCodeBlocks(response);
  const psBlocks = blocks.filter(
    (b) => b.language === 'powershell' || b.language === 'ps1'
  );

  logger.info('EXEC', `Znaleziono ${psBlocks.length} bloków PowerShell (z ${blocks.length} wszystkich)`);

  const results = [];
  for (const block of psBlocks) {
    if (block.code.trim()) {
      logger.debug('EXEC', `Przetwarzam blok ${results.length + 1}/${psBlocks.length}`);
      const result = await executeCommand(block.code.trim(), autoExecute);
      if (result) {
        results.push(result);

        // Zatrzymaj po pierwszym błędzie - niech model naprawi
        if (!result.skipped && !result.success) {
          const remaining = psBlocks.length - results.length;
          if (remaining > 0) {
            logger.warn('EXEC', `Błąd w komendzie - pomijam ${remaining} pozostałych bloków`);
            console.log(chalk.yellow(`⚠ Błąd w komendzie — pomijam ${remaining} pozostałych komend, aby model mógł naprawić błąd.\n`));
          }
          break;
        }
      }
    }
  }

  const executed = results.filter(r => !r.skipped);
  const successful = executed.filter(r => r.success);
  logger.info('EXEC', `Podsumowanie: ${executed.length} wykonanych, ${successful.length} udanych`);

  return results;
}

// Wzorce komend modyfikujących pliki
const FILE_MODIFYING_PATTERNS = [
  'Out-File', 'Set-Content', 'Add-Content',
  'New-Item', 'Copy-Item', 'Move-Item', 'Rename-Item',
  'mkdir', 'md ',
  'npm init', 'npx create-', 'npm install', 'npm i ',
  'yarn add', 'yarn init', 'pnpm add', 'pnpm init',
  'git clone', 'git init', 'git checkout',
  'dotnet new', 'cargo init', 'cargo new',
  'Expand-Archive', 'Compress-Archive',
];

/**
 * Sprawdza czy komenda modyfikuje pliki/strukturę projektu.
 * @param {string} cmd
 * @returns {boolean}
 */
export function isFileModifyingCommand(cmd) {
  const lower = cmd.toLowerCase();
  return FILE_MODIFYING_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

/**
 * Klasyfikuje błąd na podstawie stderr, komunikatu i komendy.
 * Zwraca typ błędu i podpowiedź naprawczą w języku polskim.
 *
 * @param {string} stderr - wyjście stderr
 * @param {string} error - komunikat błędu
 * @param {string} cmd - oryginalna komenda
 * @returns {{ type: string, hint: string }}
 */
export function classifyError(stderr, error, cmd) {
  const combined = `${stderr || ''} ${error || ''}`.toLowerCase();

  if (combined.includes('cannot find path') || combined.includes('could not find') ||
      combined.includes('does not exist') || combined.includes('itemnotfoundexception') ||
      combined.includes('no such file')) {
    return {
      type: 'PATH_NOT_FOUND',
      hint: 'Ścieżka nie istnieje. Sprawdź: Get-Location i Test-Path przed ponowną próbą.',
    };
  }

  if (combined.includes('is not recognized') || combined.includes('commandnotfoundexception') ||
      combined.includes('the term') && combined.includes('is not recognized')) {
    return {
      type: 'COMMAND_NOT_FOUND',
      hint: 'Komenda nie istnieje. Sprawdź pisownię lub zainstaluj brakujące narzędzie.',
    };
  }

  if (combined.includes('access') && combined.includes('denied') ||
      combined.includes('unauthorized') || combined.includes('permissiondenied')) {
    return {
      type: 'PERMISSION_DENIED',
      hint: 'Brak uprawnień. Spróbuj uruchomić jako administrator lub zmień uprawnienia.',
    };
  }

  if (combined.includes('syntax error') || combined.includes('parsing') ||
      combined.includes('unexpected token') || combined.includes('missing closing') ||
      combined.includes('missing expression') || combined.includes('expressionparserexception')) {
    return {
      type: 'SYNTAX_ERROR',
      hint: 'Błąd składni. Sprawdź cudzysłowy, nawiasy i operatory w komendzie.',
    };
  }

  if (combined.includes('timeout') || combined.includes('timed out')) {
    return {
      type: 'TIMEOUT',
      hint: 'Komenda przekroczyła limit czasu. Rozważ uproszczenie lub podział na mniejsze kroki.',
    };
  }

  if (combined.includes('invalid parameter') || combined.includes('cannot validate argument') ||
      combined.includes('parameterargumentvalidation') || combined.includes('a parameter cannot be found')) {
    return {
      type: 'INVALID_PARAMETER',
      hint: 'Nieprawidłowy parametr. Sprawdź dokumentację: Get-Help <komenda>.',
    };
  }

  return {
    type: 'UNKNOWN',
    hint: 'Przeanalizuj komunikat błędu i kontekst, aby ustalić przyczynę.',
  };
}

/**
 * Obcina długi tekst do maxLines linii.
 * Zachowuje 60% z początku i 40% z końca.
 *
 * @param {string} text
 * @param {number} [maxLines=50]
 * @returns {string}
 */
export function truncateOutput(text, maxLines = 50) {
  if (!text) return '';
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;

  const headCount = Math.ceil(maxLines * 0.6);
  const tailCount = maxLines - headCount;
  const omitted = lines.length - headCount - tailCount;

  return [
    ...lines.slice(0, headCount),
    `\n... (pominięto ${omitted} linii) ...\n`,
    ...lines.slice(-tailCount),
  ].join('\n');
}

/**
 * Formatuje wyniki wykonania komend do feedbacku dla modelu.
 * @param {Array} results
 * @returns {string|null}
 */
export function formatResultsForFeedback(results) {
  if (!results || results.length === 0) return null;

  const executed = results.filter(r => !r.skipped);
  if (executed.length === 0) return null;

  const hasErrors = executed.some(r => !r.success);

  // Silny sygnał STOP na początku przy błędach
  let feedback = '';
  if (hasErrors) {
    feedback += `\n⛔ STOP — BŁĄD W KOMENDZIE. PRZERWIJ AKTUALNY PLAN.\nSkoncentruj się WYŁĄCZNIE na naprawie tego błędu. NIE kontynuuj planu dopóki błąd nie zostanie naprawiony.\n`;
  }

  feedback += `\n[WYNIKI WYKONANIA KOMEND]\nKatalog roboczy: ${currentWorkingDir}\n`;

  for (const r of executed) {
    feedback += `\n--- Komenda: ${r.command} ---\n`;

    if (r.success) {
      feedback += `Status: SUKCES\n`;
      if (r.stdout?.trim()) {
        feedback += `Wynik:\n${truncateOutput(r.stdout.trim())}\n`;
      }
      if (r.stderr?.trim()) {
        feedback += `Ostrzeżenia:\n${truncateOutput(r.stderr.trim())}\n`;
      }
    } else {
      const { type, hint } = classifyError(r.stderr, r.error, r.command);

      feedback += `Status: BŁĄD\n`;
      feedback += `Typ błędu: ${type}\n`;

      if (r.stderr?.trim()) {
        feedback += `stderr:\n${truncateOutput(r.stderr.trim())}\n`;
      }
      if (r.stdout?.trim()) {
        feedback += `stdout:\n${truncateOutput(r.stdout.trim())}\n`;
      }
      if (r.error) {
        feedback += `Komunikat: ${r.error}\n`;
      }

      feedback += `\nDiagnostyka: ${hint}\n`;
      feedback += `WYMAGANE DZIAŁANIE: 1) Zbadaj kontekst (Get-Location, Test-Path, Get-ChildItem) 2) Napraw PRZYCZYNĘ, nie symptom 3) NIE powtarzaj tej samej komendy — zmień podejście\n`;
    }
  }

  return feedback;
}
