// ============================================
// KONFIGURACJA AI Coding CLI v2.0
// ============================================

import { homedir } from 'os';
import { join } from 'path';

export const CONFIG = {
  // --- Tryb pracy ---
  DEMO_MODE: true,
  DEMO_DELAY: 1500,
  DEMO_STREAM_CHAR_DELAY: 15,

  // --- Ollama ---
  OLLAMA_HOST: 'TWOJ_IP_SERWERA',
  OLLAMA_PORT: 11434,
  MODEL_NAME: 'qwen2.5-coder:14b',
  REQUEST_TIMEOUT: 300000,

  // --- Historia / sliding window ---
  MAX_HISTORY_MESSAGES: 20,
  HISTORY_DIR: join(homedir(), '.ai-coding-cli', 'history'),
  AUTO_SAVE_INTERVAL: 60000,

  // --- Walidacja inputu ---
  MAX_INPUT_LENGTH: 10000,
  WARN_INPUT_LENGTH: 5000,

  // --- Analyzer ---
  ANALYZER_MAX_FILES: 100,
  ANALYZER_MAX_FILE_SIZE: 50 * 1024,
  ANALYZER_MAX_TOTAL_SIZE: 500 * 1024,
  ANALYZER_MAX_DEPTH: 10,
  ANALYZER_EXCLUDED_DIRS: [
    'node_modules', '.git', 'dist', 'build', 'coverage',
    '__pycache__', '.next', '.nuxt', 'vendor', '.venv',
  ],
  ANALYZER_EXTENSIONS: [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.md',
    '.yaml', '.yml', '.css', '.html', '.sql', '.ps1',
    '.sh', '.bat', '.cmd',
  ],

  // --- Niebezpieczne komendy PowerShell ---
  DANGEROUS_COMMANDS: [
    'Remove-Item', 'rm ', 'del ', 'rmdir',
    'Format-Volume', 'Clear-Disk',
    'Stop-Process', 'kill ',
    'Stop-Service', 'Restart-Service',
    'Set-ExecutionPolicy',
    'Invoke-Expression', 'iex ',
    'Start-Process', 'Invoke-WebRequest', 'iwr ',
    'Invoke-RestMethod', 'irm ',
    'New-Service', 'Remove-Service',
    'Disable-NetAdapter', 'Remove-NetRoute',
    'Clear-Content', 'Set-Content',
    'Out-File',
    'reg delete', 'reg add',
    'net user', 'net localgroup',
    'schtasks',
    'shutdown', 'Restart-Computer', 'Stop-Computer',
  ],

  // --- System prompt ---
  SYSTEM_PROMPT: `Jesteś zaawansowanym asystentem programistycznym AI Coding CLI.
Twoje główne zadania:
- Analiza kodu, wykrywanie błędów, refaktoryzacja
- Generowanie kodu na podstawie opisu
- Wyjaśnianie działania kodu
- Pomoc z PowerShell - gdy użytkownik potrzebuje wykonać operacje na systemie plików lub inne zadania systemowe, generuj komendy PowerShell w blokach \`\`\`powershell

Zasady:
1. Odpowiadaj po polsku, chyba że użytkownik pisze po angielsku
2. Kod zawsze umieszczaj w blokach markdown z odpowiednim językiem
3. Komendy PowerShell umieszczaj w blokach \`\`\`powershell
4. Bądź zwięzły ale dokładny
5. Jeśli analizujesz projekt, odnoś się do konkretnych plików i linii kodu
6. Ostrzegaj przed potencjalnymi problemami z bezpieczeństwem`,
};

// URL do Ollama Chat API
export const OLLAMA_URL = `http://${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}/api/chat`;
