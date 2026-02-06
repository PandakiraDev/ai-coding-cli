# AI Coding Assistant - Local CLI v2.0

Lokalny autonomiczny asystent AI do programowania. Streaming odpowiedzi, diagnostyka błędów, analiza projektów, pamięć między sesjami — wszystko przez Ollama na lokalnym/zdalnym serwerze.

## Funkcje

- **Streaming odpowiedzi** — tekst pojawia się stopniowo (Ollama `/api/chat`)
- **Inteligentna diagnostyka błędów** — klasyfikacja 7 typów błędów (PATH_NOT_FOUND, SYNTAX_ERROR, COMMAND_NOT_FOUND, PERMISSION_DENIED, TIMEOUT, INVALID_PARAMETER, UNKNOWN) z podpowiedziami naprawczymi
- **Auto-retry z feedbackiem** — do 3 automatycznych prób naprawy błędnych komend
- **Analiza projektu** — skanowanie struktury, kluczowe pliki (README, entry point), kontekst dla AI
- **Odświeżanie kontekstu** — po komendach modyfikujących pliki kontekst projektu aktualizuje się automatycznie
- **Pamięć między sesjami** — preferencje użytkownika, notatki o projekcie, nauczone wzorce
- **Historia konwersacji** — auto-save, zapis/odczyt rozmów, sliding window z zachowaniem oryginalnego zadania
- **Kompresja historii** — stare feedbacki komend są kompresowane, pierwsza wiadomość zawsze zachowana
- **ThinkParser** — parsowanie bloków `<think>` z metrykami myślenia
- **StreamStats** — statystyki: czas, tokeny, tok/s
- **Multiline input** — kontynuacja linii backslashem `\`
- **@mentions** — `@plik.js` ładuje zawartość pliku do kontekstu
- **Diff display** — kolorowe wyświetlanie zmian w plikach
- **Auto-execute** — tryb automatycznego wykonywania bezpiecznych komend
- **Walidacja inputu** — limity, sanityzacja, detekcja prompt injection
- **Bezpieczne PowerShell** — potwierdzenie przed wykonaniem, podwójne ostrzeżenie dla niebezpiecznych komend
- **Tryb demo** — testowanie bez połączenia z Ollama
- **Logger** — konfigurowalne logowanie z poziomami (trace/debug/info/warn/error)

## Instalacja

```bash
npm install
```

## Konfiguracja

Edytuj `src/config.js`:
- `DEMO_MODE` — `true` dla trybu demo, `false` dla połączenia z Ollama
- `OLLAMA_HOST` — adres IP serwera z Ollama
- `MODEL_NAME` — nazwa modelu (np. `qwen2.5-coder:32b`, `qwen3-coder`)

## Uruchomienie

```bash
npm start
```

Opcjonalnie jako globalna komenda:
```bash
npm link
ai
```

## Komendy

| Komenda | Opis |
|---------|------|
| `/exit` | Zapisz rozmowę i wyjdź |
| `/clear` | Wyczyść historię i kontekst projektu |
| `/info` | Wyświetl konfigurację |
| `/save` | Ręcznie zapisz rozmowę |
| `/history` | Lista zapisanych rozmów |
| `/load <id>` | Wczytaj zapisaną rozmowę |
| `/analyze [ścieżka]` | Analizuj projekt (domyślnie CWD) |
| `/autorun` | Przełącz auto-wykonywanie komend |
| `/memory` | Zarządzanie pamięcią (show/set/note/clear) |
| `/debug` | Włącz/wyłącz logowanie |
| `/help` | Pełna pomoc |

## Testy

```bash
npm test
```

230 testów w 13 plikach testowych.

## Struktura projektu

```
src/
├── index.js          # Entry point
├── config.js         # Konfiguracja + system prompt
├── chat.js           # Główna pętla konwersacji
├── ollama.js         # Komunikacja z API (streaming)
├── history.js        # Persystencja + sliding window + kompresja
├── parser.js         # Parser bloków kodu
├── analyzer.js       # Analiza projektu + kluczowe pliki
├── commands.js       # Obsługa komend
├── validator.js      # Walidacja inputu
├── executor.js       # Wykonywanie PowerShell + diagnostyka błędów
├── input.js          # Multiline input + historia komend
├── stats.js          # StreamStats (metryki streamingu)
├── think-parser.js   # Parser bloków <think>
├── diff-display.js   # Wyświetlanie diffów
├── mentions.js       # Obsługa @mentions
├── memory.js         # Pamięć między sesjami
├── logger.js         # System logowania
├── config-editor.js  # Edycja konfiguracji
├── git.js            # Integracja z Git
├── web.js            # Funkcje webowe
├── progress.js       # Wskaźniki postępu
├── snippets.js       # Zarządzanie snippetami
├── test-runner.js    # Runner testów
└── demo-responses.js # Odpowiedzi demo

tests/
├── config.test.js
├── parser.test.js
├── validator.test.js
├── history.test.js
├── executor.test.js
├── analyzer.test.js
├── ollama.test.js
├── commands.test.js
├── input.test.js
├── think-parser.test.js
├── stats.test.js
├── logger.test.js
└── demo-responses.test.js
```

## Licencja

MIT
