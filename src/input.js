// input.js - Multiline input z kontynuacją `\`

import inquirer from 'inquirer';

/**
 * Czyta input użytkownika z obsługą multiline.
 * Jeśli linia kończy się `\`, kontynuuje zbieranie w kolejnych liniach.
 *
 * @param {string} promptMessage - komunikat prompta
 * @param {string} [prefix=''] - prefix przed promptem
 * @returns {Promise<string>} - pełny input (linie połączone \n)
 */
export async function readInput(promptMessage, prefix = '') {
  const lines = [];

  // Pierwsza linia
  const { userInput } = await inquirer.prompt([
    {
      type: 'input',
      name: 'userInput',
      message: promptMessage,
      prefix,
    },
  ]);

  let current = userInput;

  while (current.endsWith('\\')) {
    lines.push(current.slice(0, -1));

    const { nextLine } = await inquirer.prompt([
      {
        type: 'input',
        name: 'nextLine',
        message: '... ',
        prefix: '',
      },
    ]);

    current = nextLine;
  }

  lines.push(current);
  return lines.join('\n');
}
