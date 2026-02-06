// git.js - Integracja z Git

import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 * Wykonuje komendę git i zwraca wynik.
 * @param {string} args - argumenty dla git
 * @returns {Promise<{success: boolean, output: string, error: string}>}
 */
async function runGit(args) {
  try {
    const { stdout, stderr } = await execAsync(`git ${args}`, {
      encoding: 'utf8',
      timeout: 30000,
    });
    return { success: true, output: stdout, error: stderr };
  } catch (err) {
    return { success: false, output: '', error: err.message };
  }
}

/**
 * Wyświetla status repozytorium.
 */
export async function gitStatus() {
  console.log(chalk.cyan('\n📊 Git Status:\n'));

  const { success, output, error } = await runGit('status --short --branch');

  if (!success) {
    console.log(chalk.red(`✖ Błąd: ${error}`));
    return;
  }

  const lines = output.trim().split('\n');
  const branchLine = lines[0] || '';
  const files = lines.slice(1);

  // Branch info
  const branchMatch = branchLine.match(/^## (.+?)(?:\.\.\.(.+))?$/);
  if (branchMatch) {
    console.log(chalk.white(`  Gałąź: ${chalk.green(branchMatch[1])}`));
    if (branchMatch[2]) {
      console.log(chalk.gray(`  Tracking: ${branchMatch[2]}`));
    }
  }

  if (files.length === 0) {
    console.log(chalk.green('\n  ✔ Brak zmian\n'));
    return;
  }

  console.log(chalk.white('\n  Zmiany:'));
  for (const file of files) {
    const status = file.substring(0, 2);
    const filename = file.substring(3);

    let icon = '  ';
    let color = chalk.white;

    if (status.includes('M')) { icon = '📝'; color = chalk.yellow; }
    else if (status.includes('A')) { icon = '➕'; color = chalk.green; }
    else if (status.includes('D')) { icon = '➖'; color = chalk.red; }
    else if (status.includes('?')) { icon = '❓'; color = chalk.gray; }
    else if (status.includes('R')) { icon = '🔄'; color = chalk.blue; }

    console.log(color(`    ${icon} ${status} ${filename}`));
  }
  console.log();
}

/**
 * Wyświetla diff zmian.
 * @param {string} [file] - opcjonalny plik do diff
 */
export async function gitDiff(file) {
  const args = file ? `diff ${file}` : 'diff';
  console.log(chalk.cyan(`\n📄 Git Diff${file ? ` (${file})` : ''}:\n`));

  const { success, output, error } = await runGit(args);

  if (!success) {
    console.log(chalk.red(`✖ Błąd: ${error}`));
    return;
  }

  if (!output.trim()) {
    console.log(chalk.gray('  Brak zmian do wyświetlenia\n'));
    return;
  }

  // Koloruj output diff
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      console.log(chalk.green(line));
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      console.log(chalk.red(line));
    } else if (line.startsWith('@@')) {
      console.log(chalk.cyan(line));
    } else if (line.startsWith('diff') || line.startsWith('index')) {
      console.log(chalk.blue(line));
    } else {
      console.log(line);
    }
  }
  console.log();
}

/**
 * Commituje zmiany.
 * @param {string} message - wiadomość commit
 */
export async function gitCommit(message) {
  if (!message) {
    console.log(chalk.yellow('\n⚠ Podaj wiadomość commit: /git commit "wiadomość"\n'));
    return;
  }

  console.log(chalk.cyan('\n📦 Git Commit:\n'));

  // Najpierw dodaj wszystkie zmiany
  const addResult = await runGit('add -A');
  if (!addResult.success) {
    console.log(chalk.red(`✖ Błąd git add: ${addResult.error}`));
    return;
  }

  // Commit
  const { success, output, error } = await runGit(`commit -m "${message.replace(/"/g, '\\"')}"`);

  if (!success) {
    if (error.includes('nothing to commit')) {
      console.log(chalk.yellow('  ⚠ Brak zmian do zacommitowania\n'));
    } else {
      console.log(chalk.red(`✖ Błąd: ${error}`));
    }
    return;
  }

  console.log(chalk.green('  ✔ Commit utworzony'));
  console.log(chalk.gray(output));
}

/**
 * Wyświetla log commitów.
 * @param {number} [count=10] - liczba commitów
 */
export async function gitLog(count = 10) {
  console.log(chalk.cyan(`\n📜 Git Log (ostatnie ${count}):\n`));

  const format = '--pretty=format:%C(yellow)%h%C(reset) %C(blue)%ad%C(reset) %C(white)%s%C(reset) %C(dim)(%an)%C(reset)';
  const { success, output, error } = await runGit(`log -${count} --date=short ${format}`);

  if (!success) {
    console.log(chalk.red(`✖ Błąd: ${error}`));
    return;
  }

  console.log(output);
  console.log();
}

/**
 * Wyświetla listę gałęzi.
 */
export async function gitBranch() {
  console.log(chalk.cyan('\n🌿 Git Branches:\n'));

  const { success, output, error } = await runGit('branch -a');

  if (!success) {
    console.log(chalk.red(`✖ Błąd: ${error}`));
    return;
  }

  const lines = output.trim().split('\n');
  for (const line of lines) {
    if (line.startsWith('*')) {
      console.log(chalk.green(`  ${line}`));
    } else if (line.includes('remotes/')) {
      console.log(chalk.gray(`  ${line}`));
    } else {
      console.log(chalk.white(`  ${line}`));
    }
  }
  console.log();
}

/**
 * Obsługuje komendę /git.
 * @param {string} subcommand - podkomenda (status, diff, commit, log, branch)
 * @param {string} args - dodatkowe argumenty
 */
export async function handleGitCommand(subcommand, args) {
  switch (subcommand) {
    case 'status':
    case 's':
      await gitStatus();
      break;
    case 'diff':
    case 'd':
      await gitDiff(args);
      break;
    case 'commit':
    case 'c':
      await gitCommit(args);
      break;
    case 'log':
    case 'l':
      await gitLog(parseInt(args) || 10);
      break;
    case 'branch':
    case 'b':
      await gitBranch();
      break;
    case 'push':
      const pushResult = await runGit('push');
      if (pushResult.success) {
        console.log(chalk.green('\n✔ Push zakończony\n'));
      } else {
        console.log(chalk.red(`\n✖ Błąd push: ${pushResult.error}\n`));
      }
      break;
    case 'pull':
      const pullResult = await runGit('pull');
      if (pullResult.success) {
        console.log(chalk.green('\n✔ Pull zakończony'));
        console.log(chalk.gray(pullResult.output));
      } else {
        console.log(chalk.red(`\n✖ Błąd pull: ${pullResult.error}\n`));
      }
      break;
    default:
      console.log(chalk.cyan('\n🔧 Komendy Git:\n'));
      console.log(chalk.white('  /git status (s)   ') + chalk.gray('- pokaż status'));
      console.log(chalk.white('  /git diff (d)     ') + chalk.gray('- pokaż zmiany'));
      console.log(chalk.white('  /git commit (c)   ') + chalk.gray('- commituj zmiany'));
      console.log(chalk.white('  /git log (l)      ') + chalk.gray('- historia commitów'));
      console.log(chalk.white('  /git branch (b)   ') + chalk.gray('- lista gałęzi'));
      console.log(chalk.white('  /git push         ') + chalk.gray('- wypchnij zmiany'));
      console.log(chalk.white('  /git pull         ') + chalk.gray('- pobierz zmiany\n'));
      break;
  }
}
