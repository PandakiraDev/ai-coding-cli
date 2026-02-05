// executor.js - Bezpieczne wykonywanie komend PowerShell

import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { CONFIG } from './config.js';
import { extractCodeBlocks } from './parser.js';

const execAsync = promisify(exec);
const EXEC_TIMEOUT = 30_000;

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

  if (autoExecute && !dangerous) {
    // Ścieżka 1: auto-execute bezpiecznych komend
    console.log(chalk.yellow(`\n⚡ Auto-wykonuję: ${chalk.cyan(cmd)}`));
  } else if (autoExecute && dangerous) {
    // Ścieżka 2: jedno potwierdzenie dla niebezpiecznych w trybie auto
    console.log(chalk.red.bold('\n⚠️  UWAGA: Ta komenda zawiera potencjalnie niebezpieczne operacje!'));
    console.log(chalk.red(`   Komenda: ${cmd}\n`));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red('Czy NA PEWNO chcesz wykonać tę niebezpieczną komendę?'),
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.gray('Komenda pominięta.\n'));
      return;
    }
  } else {
    // Ścieżka 3: normalna logika (bez auto-execute)
    if (dangerous) {
      console.log(chalk.red.bold('\n⚠️  UWAGA: Ta komenda zawiera potencjalnie niebezpieczne operacje!'));
      console.log(chalk.red(`   Komenda: ${cmd}\n`));
    }

    // Pierwsze potwierdzenie
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: dangerous
          ? chalk.red('Czy NA PEWNO chcesz wykonać tę niebezpieczną komendę?')
          : chalk.yellow(`Wykonać komendę w PowerShell?\n${chalk.cyan(cmd)}`),
        default: false,
      },
    ]);

    if (!confirm) {
      console.log(chalk.gray('Komenda pominięta.\n'));
      return;
    }

    // Podwójne potwierdzenie dla niebezpiecznych komend
    if (dangerous) {
      const { doubleConfirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'doubleConfirm',
          message: chalk.red.bold('OSTATNIE OSTRZEŻENIE: Potwierdź ponownie wykonanie niebezpiecznej komendy'),
          default: false,
        },
      ]);
      if (!doubleConfirm) {
        console.log(chalk.gray('Komenda pominięta.\n'));
        return;
      }
    }
  }

  // Wykonanie
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      shell: 'powershell.exe',
      timeout: EXEC_TIMEOUT,
    });

    console.log(chalk.green('✔ Komenda wykonana'));
    if (stdout) {
      console.log(chalk.green('\nWynik:'));
      console.log(stdout);
    }
    if (stderr) {
      console.log(chalk.yellow('\nOstrzeżenia:'));
      console.log(stderr);
    }
  } catch (error) {
    if (error.killed) {
      console.log(chalk.red(`✖ Komenda przerwana - przekroczono timeout (${EXEC_TIMEOUT / 1000}s)`));
    } else {
      console.log(chalk.red('✖ Błąd wykonania komendy'));
      console.log(chalk.red(error.message));
    }
  }
  console.log();
}

/**
 * Znajduje bloki PowerShell w odpowiedzi i oferuje ich wykonanie.
 * @param {string} response
 * @param {boolean} [autoExecute=false]
 */
export async function handlePowerShellCommands(response, autoExecute = false) {
  const blocks = extractCodeBlocks(response);
  const psBlocks = blocks.filter(
    (b) => b.language === 'powershell' || b.language === 'ps1'
  );

  for (const block of psBlocks) {
    if (block.code.trim()) {
      await executeCommand(block.code.trim(), autoExecute);
    }
  }
}
