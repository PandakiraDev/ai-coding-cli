// test-runner.js - Automatyczne wykrywanie i uruchamianie testów

import { promises as fs } from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

/**
 * Wykrywa framework testowy na podstawie plików w projekcie.
 * @param {string} [dir='.'] - katalog projektu
 * @returns {Promise<{framework: string, command: string}|null>}
 */
export async function detectTestFramework(dir = '.') {
  try {
    // Sprawdź package.json
    const pkgPath = `${dir}/package.json`;
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));

      // Sprawdź skrypt test
      if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
        // Wykryj framework ze skryptu
        const testScript = pkg.scripts.test;

        if (testScript.includes('vitest')) {
          return { framework: 'Vitest', command: 'npm test' };
        }
        if (testScript.includes('jest')) {
          return { framework: 'Jest', command: 'npm test' };
        }
        if (testScript.includes('mocha')) {
          return { framework: 'Mocha', command: 'npm test' };
        }
        if (testScript.includes('ava')) {
          return { framework: 'AVA', command: 'npm test' };
        }
        if (testScript.includes('tap')) {
          return { framework: 'TAP', command: 'npm test' };
        }

        // Ogólny npm test
        return { framework: 'npm', command: 'npm test' };
      }

      // Sprawdź devDependencies
      const devDeps = { ...pkg.devDependencies, ...pkg.dependencies };

      if (devDeps.vitest) {
        return { framework: 'Vitest', command: 'npx vitest run' };
      }
      if (devDeps.jest) {
        return { framework: 'Jest', command: 'npx jest' };
      }
      if (devDeps.mocha) {
        return { framework: 'Mocha', command: 'npx mocha' };
      }
    } catch {
      // Brak package.json
    }

    // Sprawdź pytest (Python)
    try {
      await fs.access(`${dir}/pytest.ini`);
      return { framework: 'pytest', command: 'pytest' };
    } catch {}

    try {
      await fs.access(`${dir}/setup.py`);
      return { framework: 'pytest', command: 'python -m pytest' };
    } catch {}

    // Sprawdź Go
    const files = await fs.readdir(dir);
    if (files.some(f => f.endsWith('_test.go'))) {
      return { framework: 'Go', command: 'go test ./...' };
    }

    // Sprawdź Rust
    if (files.includes('Cargo.toml')) {
      return { framework: 'Cargo', command: 'cargo test' };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Uruchamia testy z kolorowym outputem.
 * @param {string} command - komenda do uruchomienia
 * @param {string} framework - nazwa frameworka
 */
export async function runTests(command, framework) {
  console.log(chalk.cyan(`\n🧪 Uruchamiam testy (${framework})...\n`));
  console.log(chalk.gray(`$ ${command}\n`));
  console.log(chalk.gray('─'.repeat(60)));

  return new Promise((resolve) => {
    const [cmd, ...args] = command.split(/\s+/);

    const child = spawn(cmd, args, {
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        FORCE_COLOR: '1',
      },
    });

    child.on('close', (code) => {
      console.log(chalk.gray('─'.repeat(60)));

      if (code === 0) {
        console.log(chalk.green('\n✔ Testy zakończone pomyślnie\n'));
      } else {
        console.log(chalk.red(`\n✖ Testy zakończone z kodem: ${code}\n`));
      }

      resolve(code);
    });

    child.on('error', (err) => {
      console.log(chalk.red(`\n✖ Błąd uruchomienia testów: ${err.message}\n`));
      resolve(1);
    });
  });
}

/**
 * Obsługuje komendę /test.
 * @param {string} [args] - dodatkowe argumenty
 */
export async function handleTestCommand(args) {
  const detected = await detectTestFramework();

  if (!detected) {
    console.log(chalk.yellow('\n⚠ Nie wykryto frameworka testowego.\n'));
    console.log(chalk.gray('Obsługiwane frameworki:'));
    console.log(chalk.gray('  • Node.js: Vitest, Jest, Mocha, AVA'));
    console.log(chalk.gray('  • Python: pytest'));
    console.log(chalk.gray('  • Go: go test'));
    console.log(chalk.gray('  • Rust: cargo test\n'));
    console.log(chalk.gray('Możesz też podać własną komendę: /test <komenda>\n'));
    return;
  }

  // Jeśli podano argumenty, użyj ich jako komendy
  const command = args || detected.command;
  const framework = args ? 'custom' : detected.framework;

  await runTests(command, framework);
}

/**
 * Uruchamia testy dla konkretnego pliku.
 * @param {string} file - plik do testowania
 */
export async function runTestFile(file) {
  const detected = await detectTestFramework();

  if (!detected) {
    console.log(chalk.yellow('\n⚠ Nie wykryto frameworka testowego.\n'));
    return;
  }

  let command;

  switch (detected.framework) {
    case 'Vitest':
      command = `npx vitest run ${file}`;
      break;
    case 'Jest':
      command = `npx jest ${file}`;
      break;
    case 'Mocha':
      command = `npx mocha ${file}`;
      break;
    case 'pytest':
      command = `pytest ${file}`;
      break;
    default:
      command = `${detected.command} ${file}`;
  }

  await runTests(command, detected.framework);
}
