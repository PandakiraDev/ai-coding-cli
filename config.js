// ============================================
// KONFIGURACJA - ZMIEŃ TE WARTOŚCI
// ============================================

export const CONFIG = {
  // TRYB DEMO - ustaw na true aby testować bez połączenia z Ollamą
  DEMO_MODE: true,  // ← ZMIEŃ NA false gdy będziesz gotowy do połączenia z prawdziwym AI
  
  // Opóźnienie odpowiedzi w trybie demo (ms) - symuluje "myślenie" AI
  DEMO_DELAY: 1500,
  
  // Adres IP serwera z Ollamą (przez VPN)
  // Przykład: '10.8.0.1' lub '192.168.1.100'
  OLLAMA_HOST: 'TWOJ_IP_SERWERA',
  
  // Port Ollamy (domyślnie 11434)
  OLLAMA_PORT: 11434,
  
  // Nazwa modelu z Ollamy
  // Dostępne: 'qwen2.5-coder:7b', 'qwen2.5-coder:14b', 'qwen2.5-coder:32b', 
  //           'deepseek-coder:6.7b', 'codestral:22b'
  MODEL_NAME: 'qwen2.5-coder:14b',
  
  // Timeout dla requestów (w ms)
  REQUEST_TIMEOUT: 300000, // 5 minut
  
  // Czy automatycznie wykonywać komendy PowerShell? (true/false)
  // UWAGA: jeśli true, będzie pytać o potwierdzenie przed wykonaniem
  AUTO_EXECUTE_COMMANDS: false,
};

// Pełny URL do API (nie zmieniaj tego)
export const OLLAMA_URL = `http://${CONFIG.OLLAMA_HOST}:${CONFIG.OLLAMA_PORT}/api/generate`;