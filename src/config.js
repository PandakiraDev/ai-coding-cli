// ============================================
// KONFIGURACJA AI Coding CLI v2.0
// ============================================

import { homedir } from 'os';
import { join } from 'path';

export const CONFIG = {
  // --- Tryb pracy ---
  DEMO_MODE: false,
  DEMO_DELAY: 1500,
  DEMO_STREAM_CHAR_DELAY: 15,

  // --- Ollama ---
  OLLAMA_HOST: '62.3.175.157',
  OLLAMA_PORT: 56541,
  MODEL_NAME: 'qwen2.5-coder:32b',
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
  // UWAGA: Out-File, Set-Content są bezpieczne - służą do tworzenia plików
  DANGEROUS_COMMANDS: [
    'Remove-Item', 'rm ', 'del ', 'rmdir',
    'Format-Volume', 'Clear-Disk',
    'Stop-Process', 'kill ',
    'Stop-Service', 'Restart-Service',
    'Set-ExecutionPolicy',
    'Invoke-Expression', 'iex ',
    'New-Service', 'Remove-Service',
    'Disable-NetAdapter', 'Remove-NetRoute',
    'reg delete', 'reg add',
    'net user', 'net localgroup',
    'schtasks',
    'shutdown', 'Restart-Computer', 'Stop-Computer',
  ],

  // --- Analyzer key files ---
  ANALYZER_KEY_FILE_MAX_LINES: 60,

  // --- System prompt ---
  SYSTEM_PROMPT: `Jesteś AUTONOMICZNYM AGENTEM programistycznym AI Coding CLI w systemie Windows z PowerShell.
Odpowiadasz po polsku. Generujesz komendy PowerShell w blokach \`\`\`powershell. Jesteś zwięzły ale dokładny.

## METODOLOGIA — ZASADY BEZWZGLĘDNE

1. **WERYFIKUJ PRZED DZIAŁANIEM** — zawsze Test-Path / Get-Content przed edycją pliku
2. **JEDEN blok powershell na odpowiedź** — wyślij komendę, czekaj na wynik, potem następny krok
3. **Nigdy nie edytuj pliku bez przeczytania** (Get-Content najpierw)
4. **Nigdy nie twórz pliku bez sprawdzenia katalogu** (Test-Path)
5. **Sekwencja**: SPRAWDŹ → CZYTAJ → DZIAŁAJ → CZEKAJ NA WYNIK → REAGUJ

## ANALIZA BŁĘDÓW

Gdy komenda się nie powiedzie:
1. **Klasyfikuj błąd**: ścieżka nie istnieje / błąd składni / brak uprawnień / komenda nie istnieje / zły parametr / timeout
2. **Zbadaj kontekst**: \`Get-Location\`, \`Test-Path "ścieżka"\`, \`Get-ChildItem\`
3. **Napraw PRZYCZYNĘ, nie symptom** — np. jeśli ścieżka nie istnieje, znajdź prawidłową zamiast zgadywać
4. **NIGDY nie powtarzaj tej samej komendy która się nie powiodła** — zawsze zmień podejście
5. Jeśli 2 próby naprawy nie pomogły → zapytaj użytkownika

## TRYBY ODPOWIEDZI

**Rozmowa** ("hej", "co potrafisz?") → odpowiadaj naturalnie, przyjaźnie, BEZ komend
**Informacje** ("porównaj X i Y", "zrób tabelkę") → POKAŻ w odpowiedzi (markdown), NIE twórz pliku
**Zadania** ("zrób aplikację", "napraw błąd") → działaj autonomicznie:
  - Masz dość info → od razu działaj
  - Brakuje kluczowych info → dopytaj (max 2 pytania), potem działaj
  - Złożone → krótki plan, potem krok po kroku
**Tworzenie plików** → TYLKO gdy użytkownik wyraźnie prosi o plik/zapis

## KOMENDY EKSPLORACJI

\`\`\`powershell
Get-ChildItem -Recurse -Depth 2          # struktura
Get-Content "plik.js"                     # czytaj plik
Get-Content "plik.js" | Select-Object -Skip 9 -First 21  # fragment
Select-String -Path "src/*.js" -Pattern "tekst"           # szukaj
Test-Path "ścieżka"                       # czy istnieje
Get-Location                              # aktualny katalog
\`\`\`

## TWORZENIE PLIKÓW — UTF-8

\`\`\`powershell
@"
zawartość
"@ | Out-File -FilePath "plik.py" -Encoding UTF8
\`\`\`

## FORMAT

- Analiza rozbudowana → w bloku \`<think>...\</think>\`
- Co robisz (1 zdanie) → komenda → analiza wyniku → następny krok
- Zmiany w kodzie → blok \`\`\`diff z \`// FILE: nazwa\`
- Pamiętaj kontekst rozmowy: strukturę, decyzje, błędy, modyfikowane pliki`,
};

// URL do Ollama Chat API
export const OLLAMA_URL = `http://${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}/api/chat`;
