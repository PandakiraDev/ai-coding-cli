// demo-responses.js - Przykładowe odpowiedzi AI do testowania interfejsu

export const DEMO_RESPONSES = [
  // Odpowiedź 1 - prosty kod
  `Oto przykładowy endpoint w Express.js:

\`\`\`javascript
const express = require('express');
const router = express.Router();

// GET endpoint - pobieranie użytkowników
router.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST endpoint - tworzenie użytkownika
router.post('/api/users', async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    res.status(201).json({
      success: true,
      data: newUser
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
\`\`\`

Ten kod tworzy dwa endpointy REST API do zarządzania użytkownikami.`,

  // Odpowiedź 2 - z PowerShell
  `Aby utworzyć folder i plik w PowerShell, użyj następujących komend:

\`\`\`powershell
# Tworzenie folderu
New-Item -Path "C:\\Projects\\MyApp" -ItemType Directory -Force

# Tworzenie pliku
New-Item -Path "C:\\Projects\\MyApp\\index.js" -ItemType File

# Dodanie zawartości do pliku
Set-Content -Path "C:\\Projects\\MyApp\\index.js" -Value "console.log('Hello World');"
\`\`\`

Parametr \`-Force\` sprawia, że komenda nie zwróci błędu jeśli folder już istnieje.`,

  // Odpowiedź 3 - markdown z różnymi elementami
  `# Kompleksowy przykład REST API

## Struktura projektu

\`\`\`
project/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   └── middleware/
├── config/
└── package.json
\`\`\`

## Middleware do autoryzacji

\`\`\`javascript
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'Brak tokenu' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Nieprawidłowy token' });
  }
}

module.exports = authMiddleware;
\`\`\`

**Ważne:** Pamiętaj aby przechowywać JWT_SECRET w zmiennych środowiskowych, **nigdy** w kodzie!

## Testowanie API

Możesz użyć \`curl\` lub Postman:

\`\`\`bash
curl -X GET http://localhost:3000/api/users \\
  -H "Authorization: Bearer YOUR_TOKEN"
\`\`\``,

  // Odpowiedź 4 - SQL
  `Oto optymalne zapytanie SQL z indeksami:

\`\`\`sql
-- Tworzenie tabeli
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Dodanie indeksów dla lepszej wydajności
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Przykładowe zapytanie
SELECT 
    u.id,
    u.username,
    u.email,
    COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, u.username, u.email
ORDER BY post_count DESC
LIMIT 10;
\`\`\`

To zapytanie znajduje 10 najbardziej aktywnych użytkowników z ostatnich 30 dni.`,
];

// Funkcja zwracająca losową odpowiedź
export function getRandomDemoResponse() {
  const randomIndex = Math.floor(Math.random() * DEMO_RESPONSES.length);
  return DEMO_RESPONSES[randomIndex];
}

// Funkcja zwracająca odpowiedź na podstawie słów kluczowych
export function getContextualDemoResponse(userInput) {
  const input = userInput.toLowerCase();
  
  if (input.includes('endpoint') || input.includes('api') || input.includes('express')) {
    return DEMO_RESPONSES[0];
  }
  
  if (input.includes('powershell') || input.includes('folder') || input.includes('plik')) {
    return DEMO_RESPONSES[1];
  }
  
  if (input.includes('struktura') || input.includes('middleware') || input.includes('auth')) {
    return DEMO_RESPONSES[2];
  }
  
  if (input.includes('sql') || input.includes('baza') || input.includes('database')) {
    return DEMO_RESPONSES[3];
  }
  
  // Domyślnie zwróć losową
  return getRandomDemoResponse();
}