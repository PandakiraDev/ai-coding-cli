# AI Coding Assistant - Local CLI v2.0

Lokalny asystent AI do programowania z obsługą streamingu, analizy projektów i historii konwersacji.

## Funkcje

- **Streaming odpowiedzi** — tekst pojawia się stopniowo (Ollama `/api/chat`)
- **Analiza projektu** — skanuje pliki, buduje kontekst dla AI
- **Historia konwersacji** — auto-save, zapis/odczyt rozmów
- **Sliding window** — ostatnie 20 wiadomości jako kontekst
- **Walidacja inputu** — limity, sanityzacja, detekcja prompt injection
- **Bezpieczne PowerShell** — potwierdzenie przed wykonaniem, podwójne ostrzeżenie dla niebezpiecznych komend
- **Tryb demo** — testowanie bez połączenia z Ollama

## Instalacja

```bash
npm install
```

## Konfiguracja

Edytuj `src/config.js`:
- `DEMO_MODE` — `true` dla trybu demo, `false` dla połączenia z Ollama
- `OLLAMA_HOST` — adres IP serwera z Ollama
- `MODEL_NAME` — nazwa modelu (np. `qwen2.5-coder:14b`)

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

## Testy

```bash
npm test
```

## Struktura projektu

```
src/
├── index.js          # Entry point
├── config.js         # Konfiguracja
├── chat.js           # Główna pętla konwersacji
├── ollama.js         # Komunikacja z API (streaming)
├── history.js        # Persystencja + sliding window
├── parser.js         # Parser bloków kodu
├── analyzer.js       # Analiza projektu
├── commands.js       # Obsługa komend
├── validator.js      # Walidacja inputu
├── executor.js       # Wykonywanie PowerShell
└── demo-responses.js # Odpowiedzi demo

tests/
├── config.test.js
├── parser.test.js
├── validator.test.js
├── history.test.js
├── executor.test.js
├── analyzer.test.js
└── ollama.test.js
```

## Licencja

MIT
