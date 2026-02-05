// demo-responses.js - Silnik odpowiedzi demo symulujący zachowanie prawdziwego AI
//
// Kategorie odpowiedzi pokrywają wszystkie funkcje CLI:
// - generowanie kodu (JS, TS, Python, SQL, PS)
// - analiza/review kodu
// - refaktoryzacja
// - pisanie testów
// - wykrywanie błędów
// - PowerShell (testuje executor)
// - architektura/struktura projektu
// - bezpieczeństwo
// - git
// - odpowiedzi follow-up
// - reakcja na kontekst /analyze

// ─── Baza odpowiedzi ────────────────────────────────────────────────

const RESPONSES = {

  // ── API / Express ──────────────────────────────────────────────
  api: `Oto kompletny endpoint CRUD w Express.js z walidacją:

\`\`\`javascript
import express from 'express';
import { body, param, validationResult } from 'express-validator';

const router = express.Router();

// Middleware walidacji
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/users — lista z paginacją
router.get('/api/users', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find().skip(skip).limit(limit).lean(),
    User.countDocuments(),
  ]);

  res.json({ data: users, page, limit, total });
});

// POST /api/users — tworzenie
router.post('/api/users', [
  body('email').isEmail().normalizeEmail(),
  body('name').trim().isLength({ min: 2, max: 100 }),
], validate, async (req, res) => {
  const user = await User.create(req.body);
  res.status(201).json({ data: user });
});

// DELETE /api/users/:id
router.delete('/api/users/:id', [
  param('id').isMongoId(),
], validate, async (req, res) => {
  const deleted = await User.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Nie znaleziono' });
  res.json({ message: 'Usunięto', data: deleted });
});

export default router;
\`\`\`

Kluczowe elementy:
- **Paginacja** z \`page\`/\`limit\` (max 100 na stronę)
- **Walidacja** przez \`express-validator\`
- **Lean queries** — szybsze, zwraca POJO zamiast dokumentów Mongoose`,

  // ── PowerShell (testuje executor) ──────────────────────────────
  powershell: `Oto zestaw komend PowerShell do zarządzania projektem:

\`\`\`powershell
# Sprawdzenie wolnego miejsca na dysku
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='Free(GB)';E={[math]::Round($_.Free/1GB,2)}}, @{N='Used(GB)';E={[math]::Round($_.Used/1GB,2)}}
\`\`\`

A jeśli chcesz utworzyć strukturę nowego projektu:

\`\`\`powershell
# Utworzenie struktury katalogów projektu
$projectName = "MyNewApp"
$dirs = @("src", "src/components", "src/utils", "tests", "docs", "config")

foreach ($dir in $dirs) {
    New-Item -Path "$projectName/$dir" -ItemType Directory -Force | Out-Null
}

# Utworzenie plików startowych
@("src/index.js", "src/app.js", "tests/app.test.js", "README.md", ".gitignore") | ForEach-Object {
    New-Item -Path "$projectName/$_" -ItemType File -Force | Out-Null
}

Write-Host "Projekt $projectName utworzony!" -ForegroundColor Green
\`\`\`

Pierwsza komenda pokaże dyski, druga stworzy pełną strukturę katalogów.`,

  // ── Struktura / Architektura ───────────────────────────────────
  architecture: `# Rekomendowana architektura projektu

## Wzorzec: Feature-based structure

\`\`\`
src/
├── features/
│   ├── auth/
│   │   ├── auth.controller.js
│   │   ├── auth.service.js
│   │   ├── auth.middleware.js
│   │   ├── auth.routes.js
│   │   ├── auth.validator.js
│   │   └── auth.test.js
│   ├── users/
│   │   ├── users.controller.js
│   │   ├── users.service.js
│   │   ├── users.routes.js
│   │   └── users.test.js
│   └── posts/
│       └── ...
├── shared/
│   ├── database.js
│   ├── logger.js
│   ├── errors.js
│   └── middleware/
│       ├── error-handler.js
│       └── rate-limiter.js
├── config/
│   ├── index.js
│   └── env.js
└── app.js
\`\`\`

## Zasady

1. **Każdy feature jest samowystarczalny** — własny controller, service, routes, testy
2. **Shared** zawiera tylko kod współdzielony przez ≥2 features
3. **Brak cyklicznych zależności** — feature nie importuje z innego feature
4. **Config** wyłącznie w \`config/\` — nigdy hardcodowane wartości

## Przykład service z dependency injection

\`\`\`javascript
// features/users/users.service.js
export class UsersService {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  async findAll({ page = 1, limit = 20 } = {}) {
    this.logger.info('Fetching users', { page, limit });
    return this.db.collection('users')
      .find()
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
  }

  async findById(id) {
    const user = await this.db.collection('users').findOne({ _id: id });
    if (!user) throw new NotFoundError(\`User \${id} not found\`);
    return user;
  }
}
\`\`\`

Taka struktura skaluje się dobrze od małych do dużych projektów.`,

  // ── SQL / Bazy danych ──────────────────────────────────────────
  sql: `Oto zoptymalizowane zapytania SQL z indeksami i CTE:

\`\`\`sql
-- Migracja: tworzenie tabel z relacjami
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    username    VARCHAR(100) NOT NULL,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(500) NOT NULL,
    content     TEXT,
    status      VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indeksy
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status_created ON posts(status, created_at DESC);

-- CTE: raport aktywności użytkowników
WITH user_stats AS (
    SELECT
        u.id,
        u.username,
        COUNT(p.id) AS post_count,
        MAX(p.created_at) AS last_post_at
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id AND p.status = 'published'
    GROUP BY u.id, u.username
)
SELECT
    username,
    post_count,
    last_post_at,
    CASE
        WHEN last_post_at > NOW() - INTERVAL '7 days' THEN 'aktywny'
        WHEN last_post_at > NOW() - INTERVAL '30 days' THEN 'okazjonalny'
        ELSE 'nieaktywny'
    END AS activity_level
FROM user_stats
ORDER BY post_count DESC
LIMIT 20;
\`\`\`

Kluczowe:
- **ON DELETE CASCADE** — usunięcie usera kasuje jego posty
- **CHECK constraints** — walidacja na poziomie DB
- **Composite index** — \`(status, created_at)\` przyspiesza filtrowanie opublikowanych`,

  // ── Testy / Testing ────────────────────────────────────────────
  testing: `<think>Analizuję interfejs modułu, identyfikuję edge case'y i granice. Planuję mocki dla zależności zewnętrznych.</think>Oto przykład dobrze napisanych testów z mockami i edge case'ami:

\`\`\`javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from '../src/features/users/users.service.js';

describe('UsersService', () => {
  let service;
  let mockDb;
  let mockLogger;

  beforeEach(() => {
    mockDb = {
      collection: vi.fn().mockReturnThis(),
      find: vi.fn().mockReturnThis(),
      findOne: vi.fn(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
    };
    mockLogger = { info: vi.fn(), error: vi.fn() };
    service = new UsersService(mockDb, mockLogger);
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const mockUsers = [{ id: 1, name: 'Jan' }, { id: 2, name: 'Anna' }];
      mockDb.toArray.mockResolvedValue(mockUsers);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(mockDb.collection).toHaveBeenCalledWith('users');
      expect(mockDb.skip).toHaveBeenCalledWith(10); // (2-1)*10
      expect(mockDb.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockUsers);
    });

    it('should use defaults when no params', async () => {
      mockDb.toArray.mockResolvedValue([]);

      await service.findAll();

      expect(mockDb.skip).toHaveBeenCalledWith(0);
      expect(mockDb.limit).toHaveBeenCalledWith(20);
    });

    it('should log the operation', async () => {
      mockDb.toArray.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 5 });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Fetching users',
        { page: 1, limit: 5 }
      );
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockDb.findOne.mockResolvedValue({ id: 1, name: 'Jan' });
      const user = await service.findById(1);
      expect(user).toEqual({ id: 1, name: 'Jan' });
    });

    it('should throw NotFoundError when user missing', async () => {
      mockDb.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow('not found');
    });
  });
});
\`\`\`

Wzorce testowe:
- **AAA** (Arrange, Act, Assert) w każdym teście
- **beforeEach** resetuje mocki — testy są izolowane
- **Edge case'y**: pusta odpowiedź, brak parametrów, nieistniejący rekord
- **Mockowanie na granicy** — mockujemy DB, nie wewnętrzne metody`,

  // ── Wykrywanie błędów / Code review ────────────────────────────
  bugs: `<think>Analizuję kod pod kątem typowych problemów... Sprawdzam race conditions, memory leaks, brak sanityzacji inputów. Priorytetyzuję według severity.</think># Analiza kodu — wykryte problemy

Znalazłem kilka potencjalnych problemów:

## 1. Race condition w cache'u

\`\`\`javascript
// ❌ PROBLEM: check-then-act bez synchronizacji
async function getUser(id) {
  if (!cache.has(id)) {
    const user = await db.findUser(id);  // dwa requesty mogą tu wejść jednocześnie
    cache.set(id, user);
  }
  return cache.get(id);
}

// ✅ POPRAWKA: deduplikacja requestów
const pending = new Map();

async function getUser(id) {
  if (cache.has(id)) return cache.get(id);

  if (!pending.has(id)) {
    pending.set(id, db.findUser(id).then(user => {
      cache.set(id, user);
      pending.delete(id);
      return user;
    }));
  }
  return pending.get(id);
}
\`\`\`

## 2. Memory leak — brak cleanup event listenera

\`\`\`javascript
// ❌ PROBLEM: listener nigdy nie jest usuwany
function setupConnection(emitter) {
  emitter.on('data', (chunk) => {
    processChunk(chunk);  // referencja trzyma cały scope
  });
}

// ✅ POPRAWKA: AbortController / cleanup
function setupConnection(emitter, signal) {
  const handler = (chunk) => processChunk(chunk);
  emitter.on('data', handler);
  signal.addEventListener('abort', () => emitter.off('data', handler));
}
\`\`\`

## 3. Brak sanityzacji w query SQL

\`\`\`javascript
// ❌ SQL Injection!
const query = \`SELECT * FROM users WHERE name = '\${name}'\`;

// ✅ Parametryzowane zapytanie
const query = 'SELECT * FROM users WHERE name = $1';
const result = await pool.query(query, [name]);
\`\`\`

**Priorytet naprawy:** SQL injection > race condition > memory leak`,

  // ── Refaktoryzacja ─────────────────────────────────────────────
  refactoring: `<think>Przeglądam strukturę kodu, szukam powtórzeń i złamań zasad SOLID. Identyfikuję długie funkcje z wieloma odpowiedzialnościami.</think># Propozycja refaktoryzacji

## Problem: długa funkcja z wieloma odpowiedzialnościami

\`\`\`javascript
// ❌ PRZED — 60+ linii, mieszanie logiki biznesowej z I/O
async function processOrder(orderId) {
  const order = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!order) throw new Error('Not found');

  let total = 0;
  for (const item of order.items) {
    const product = await db.query('SELECT price FROM products WHERE id = $1', [item.productId]);
    total += product.price * item.quantity;
    if (product.stock < item.quantity) {
      await sendEmail(order.userEmail, 'Brak towaru');
      throw new Error('Insufficient stock');
    }
    await db.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.productId]);
  }

  await db.query('UPDATE orders SET total = $1, status = $2 WHERE id = $3', [total, 'completed', orderId]);
  await sendEmail(order.userEmail, 'Zamówienie zrealizowane');
  return { orderId, total };
}
\`\`\`

## Refaktoryzacja: Single Responsibility + Extract Method

\`\`\`javascript
// ✅ PO — czytelne, testowalne, rozszerzalne

class OrderProcessor {
  constructor(orderRepo, productRepo, notifier) {
    this.orders = orderRepo;
    this.products = productRepo;
    this.notifier = notifier;
  }

  async process(orderId) {
    const order = await this.orders.findById(orderId);
    this.validateStock(order);
    const total = this.calculateTotal(order);
    await this.fulfillOrder(order, total);
    await this.notifier.send(order.userEmail, 'Zamówienie zrealizowane');
    return { orderId, total };
  }

  calculateTotal(order) {
    return order.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity, 0
    );
  }

  validateStock(order) {
    for (const item of order.items) {
      if (item.product.stock < item.quantity) {
        throw new InsufficientStockError(item.productId);
      }
    }
  }

  async fulfillOrder(order, total) {
    await this.products.decrementStock(order.items);
    await this.orders.complete(order.id, total);
  }
}
\`\`\`

**Korzyści:**
- Każda metoda ma jedną odpowiedzialność
- \`calculateTotal\` jest pure function — łatwa do testowania
- Dependency injection — mockowanie w testach
- Łatwe rozszerzanie (np. rabaty, podatki)`,

  // ── Python ─────────────────────────────────────────────────────
  python: `Oto przykład w Pythonie z typowaniem i obsługą błędów:

\`\`\`python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from pathlib import Path
import json


@dataclass
class Task:
    title: str
    description: str = ""
    done: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    tags: list[str] = field(default_factory=list)

    def complete(self) -> None:
        self.done = True

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "description": self.description,
            "done": self.done,
            "created_at": self.created_at.isoformat(),
            "tags": self.tags,
        }


class TaskManager:
    def __init__(self, storage_path: Path):
        self.storage_path = storage_path
        self.tasks: list[Task] = []
        self._load()

    def add(self, title: str, description: str = "", tags: Optional[list[str]] = None) -> Task:
        task = Task(title=title, description=description, tags=tags or [])
        self.tasks.append(task)
        self._save()
        return task

    def find(self, query: str) -> list[Task]:
        q = query.lower()
        return [t for t in self.tasks if q in t.title.lower() or q in t.description.lower()]

    def complete(self, index: int) -> Task:
        if not 0 <= index < len(self.tasks):
            raise IndexError(f"Brak zadania o indeksie {index}")
        self.tasks[index].complete()
        self._save()
        return self.tasks[index]

    def stats(self) -> dict:
        total = len(self.tasks)
        done = sum(1 for t in self.tasks if t.done)
        return {"total": total, "done": done, "pending": total - done}

    def _save(self) -> None:
        data = [t.to_dict() for t in self.tasks]
        self.storage_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    def _load(self) -> None:
        if self.storage_path.exists():
            data = json.loads(self.storage_path.read_text())
            self.tasks = [Task(**{**d, "created_at": datetime.fromisoformat(d["created_at"])}) for d in data]
\`\`\`

Używa:
- **dataclass** z \`field(default_factory=...)\` — bezpieczne domyślne wartości
- **Path** zamiast stringów do ścieżek
- **Type hints** wszędzie — lepsze IDE support i dokumentacja`,

  // ── TypeScript ─────────────────────────────────────────────────
  typescript: `Oto przykład w TypeScript z generics i utility types:

\`\`\`typescript
// types.ts
interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface User extends BaseEntity {
  email: string;
  name: string;
  role: 'admin' | 'user' | 'moderator';
}

// Generic repository pattern
interface Repository<T extends BaseEntity> {
  findAll(options?: PaginationOptions): Promise<PaginatedResult<T>>;
  findById(id: string): Promise<T | null>;
  create(data: Omit<T, keyof BaseEntity>): Promise<T>;
  update(id: string, data: Partial<Omit<T, keyof BaseEntity>>): Promise<T>;
  delete(id: string): Promise<void>;
}

interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

// Implementacja
class UserRepository implements Repository<User> {
  constructor(private db: Database) {}

  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<User>> {
    const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = options;
    const offset = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.query<User>('SELECT * FROM users ORDER BY ?? ? LIMIT ? OFFSET ?',
        [sortBy, order, limit, offset]),
      this.db.count('users'),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<User | null> {
    return this.db.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
  }

  async create(data: Omit<User, keyof BaseEntity>): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date();
    const user: User = { ...data, id, createdAt: now, updatedAt: now };
    await this.db.insert('users', user);
    return user;
  }

  async update(id: string, data: Partial<Omit<User, keyof BaseEntity>>): Promise<User> {
    await this.db.update('users', id, { ...data, updatedAt: new Date() });
    const user = await this.findById(id);
    if (!user) throw new Error(\`User \${id} not found\`);
    return user;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete('users', id);
  }
}
\`\`\`

Kluczowe wzorce:
- **\`Omit<T, keyof BaseEntity>\`** — \`create\` nie wymaga id/dat
- **\`Partial<...>\`** — \`update\` przyjmuje dowolny podzbiór pól
- **Generic constraint** — \`T extends BaseEntity\` gwarantuje wspólny interfejs`,

  // ── Git ────────────────────────────────────────────────────────
  git: `Oto przydatne komendy Git do codziennej pracy:

\`\`\`powershell
# Interaktywny rebase — porządkowanie commitów przed merge
git rebase -i HEAD~5

# Stash z nazwą — zapisanie zmian na później
git stash push -m "wip: nowa feature login"

# Cherry-pick konkretnego commita z innego brancha
git cherry-pick abc123f

# Wyświetlenie zmian w pliku między branchami
git diff main..feature-branch -- src/app.js

# Reset ostatniego commita (zachowuje zmiany w working dir)
git reset --soft HEAD~1

# Wyszukanie commita który wprowadził buga (bisect)
git bisect start
git bisect bad HEAD
git bisect good v1.0.0
\`\`\`

## Workflow: Feature branch

\`\`\`powershell
# 1. Nowy branch z aktualnego main
git checkout main
git pull origin main
git checkout -b feature/user-auth

# 2. Praca na branchu...
git add -A
git commit -m "feat: dodaj logowanie JWT"

# 3. Rebase na aktualny main przed merge
git fetch origin
git rebase origin/main

# 4. Push i PR
git push -u origin feature/user-auth
\`\`\`

**Tip:** Używaj \`git commit --fixup=<hash>\` + \`git rebase -i --autosquash\` do czystej historii.`,

  // ── Bezpieczeństwo ─────────────────────────────────────────────
  security: `<think>Sprawdzam typowe luki bezpieczeństwa: brak rate limitingu, brakujące nagłówki, niezabezpieczone zmienne środowiskowe.</think># Audyt bezpieczeństwa — najczęstsze problemy

## 1. Brak rate limitingu

\`\`\`javascript
import rateLimit from 'express-rate-limit';

// Globalny limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minut
  max: 100,                    // max 100 requestów na IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele zapytań, spróbuj za 15 minut' },
});

// Agresywny limit na login
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Zbyt wiele prób logowania' },
});

app.use(limiter);
app.post('/api/auth/login', loginLimiter, loginHandler);
\`\`\`

## 2. Helmet — nagłówki bezpieczeństwa

\`\`\`javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
\`\`\`

## 3. Walidacja env / secrets

\`\`\`javascript
// config/env.js — fail fast jeśli brakuje zmiennych
const required = ['DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('Brakujące zmienne środowiskowe:', missing.join(', '));
  process.exit(1);
}
\`\`\`

**Checklist bezpieczeństwa:**
- [ ] HTTPS wymuszony (redirect HTTP → HTTPS)
- [ ] CORS skonfigurowany (nie \`*\` na produkcji)
- [ ] Cookies: \`httpOnly\`, \`secure\`, \`sameSite\`
- [ ] SQL injection — parametryzowane zapytania
- [ ] XSS — escape HTML w output
- [ ] CSRF token na formularzach`,

  // ── Performance ────────────────────────────────────────────────
  performance: `# Optymalizacja wydajności

## 1. N+1 Query Problem

\`\`\`javascript
// ❌ N+1 — osobne zapytanie dla każdego usera
const posts = await Post.find();
for (const post of posts) {
  post.author = await User.findById(post.userId);  // N zapytań!
}

// ✅ Eager loading — jedno zapytanie z JOIN / populate
const posts = await Post.find().populate('userId', 'name email');

// ✅ Alternatywa: batch fetch
const posts = await Post.find();
const userIds = [...new Set(posts.map(p => p.userId))];
const users = await User.find({ _id: { $in: userIds } });
const userMap = new Map(users.map(u => [u._id.toString(), u]));
posts.forEach(p => p.author = userMap.get(p.userId.toString()));
\`\`\`

## 2. Memoizacja kosztownych obliczeń

\`\`\`javascript
function memoize(fn, { maxSize = 100, ttl = 60000 } = {}) {
  const cache = new Map();

  return function (...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      const entry = cache.get(key);
      if (Date.now() - entry.time < ttl) return entry.value;
      cache.delete(key);
    }

    const value = fn.apply(this, args);
    if (cache.size >= maxSize) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    cache.set(key, { value, time: Date.now() });
    return value;
  };
}

// Użycie
const expensiveCalc = memoize((data) => {
  return data.reduce((acc, item) => acc + heavyTransform(item), 0);
}, { maxSize: 50, ttl: 30000 });
\`\`\`

## 3. Connection pooling

\`\`\`javascript
import pg from 'pg';
const pool = new pg.Pool({
  max: 20,              // max połączeń
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
\`\`\`

**Quick wins:**
- \`.lean()\` w Mongoose (2-5x szybsze odczyty)
- Indeksy na polach w WHERE / ORDER BY
- Kompresja odpowiedzi (\`compression\` middleware)
- HTTP/2 + keep-alive`,

  // ── Projekt /analyze context ───────────────────────────────────
  projectAnalysis: `Na podstawie analizy projektu mogę powiedzieć:

## Struktura
Projekt wygląda na dobrze zorganizowany. Widzę podział na moduły w \`src/\`, co jest zgodne z dobrymi praktykami.

## Rekomendacje

1. **Brakuje testów** — dodaj testy jednostkowe (Vitest lub Jest)

\`\`\`javascript
// tests/example.test.js
import { describe, it, expect } from 'vitest';

describe('Twój moduł', () => {
  it('powinien działać poprawnie', () => {
    // Arrange
    const input = 'test';
    // Act
    const result = process(input);
    // Assert
    expect(result).toBeDefined();
  });
});
\`\`\`

2. **Dodaj linting** — ESLint z konfiguracją

\`\`\`powershell
npm install -D eslint @eslint/js
npx eslint --init
\`\`\`

3. **Zmienne środowiskowe** — przenieś konfigurację do \`.env\`

\`\`\`javascript
// config/env.js
import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  dbUrl: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV || 'development',
};
\`\`\`

Czy chcesz, żebym przeanalizował konkretny plik bardziej szczegółowo?`,

  // ── Greeting / Help ────────────────────────────────────────────
  greeting: `Cześć! Jestem AI Coding Assistant. Mogę pomóc Ci z:

- **Generowanie kodu** — napisz mi co potrzebujesz, wygeneruję kod w JS, TS, Python, SQL i innych
- **Analiza projektu** — użyj \`/analyze\` żeby załadować kontekst projektu
- **Wykrywanie błędów** — wklej kod, a wskażę potencjalne problemy
- **Refaktoryzacja** — zaproponuję ulepszenia struktury i czytelności kodu
- **Testy** — wygeneruję testy jednostkowe do Twojego kodu
- **PowerShell** — wygeneruję komendy do zarządzania plikami i systemem
- **Architektura** — doradztwo w sprawie struktury projektu
- **Code review** — przegląd kodu z uwagami o bezpieczeństwie i wydajności

Przykłady zapytań:
- \`Napisz REST API endpoint do zarządzania produktami\`
- \`Znajdź błędy w tym kodzie: ...\`
- \`Zrefaktoruj tę funkcję\`
- \`Napisz testy do klasy UserService\`
- \`Jak utworzyć strukturę folderów w PowerShell?\`

Dostępne komendy: \`/info\`, \`/clear\`, \`/save\`, \`/history\`, \`/load\`, \`/analyze\`, \`/exit\``,

  // ── Follow-up / kontynuacja ────────────────────────────────────
  followUp: `Rozumiem, kontynuuję temat.

Rozszerzam poprzedni przykład o obsługę błędów i walidację:

\`\`\`javascript
// error-handler.js — centralny middleware do obsługi błędów
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(\`\${resource} nie znaleziony\`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(errors) {
    super('Błąd walidacji', 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

// Middleware
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
  }

  // Nieznany błąd — loguj pełny stack, zwróć generic
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Wystąpił nieoczekiwany błąd',
  });
}
\`\`\`

Możesz teraz użyć tych klas w dowolnym miejscu:

\`\`\`javascript
async function getUser(id) {
  const user = await db.findById(id);
  if (!user) throw new NotFoundError('Użytkownik');
  return user;
}
\`\`\`

Chcesz żebym dodał coś jeszcze?`,

  // ── CSS / Frontend ─────────────────────────────────────────────
  css: `Oto nowoczesne rozwiązanie CSS z Grid i Custom Properties:

\`\`\`css
/* Design tokens */
:root {
  --color-primary: #3b82f6;
  --color-primary-dark: #1d4ed8;
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-text: #e2e8f0;
  --color-muted: #94a3b8;
  --radius: 8px;
  --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
  --transition: 200ms ease;
}

/* Responsive dashboard layout */
.dashboard {
  display: grid;
  grid-template-columns: 250px 1fr;
  grid-template-rows: 64px 1fr;
  grid-template-areas:
    "sidebar header"
    "sidebar main";
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
}

.sidebar  { grid-area: sidebar; background: var(--color-surface); }
.header   { grid-area: header; border-bottom: 1px solid var(--color-surface); }
.main     { grid-area: main; padding: 2rem; }

/* Card grid z auto-fill */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.card {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: 1.5rem;
  box-shadow: var(--shadow);
  transition: transform var(--transition);
}

.card:hover {
  transform: translateY(-2px);
}

/* Responsywność */
@media (max-width: 768px) {
  .dashboard {
    grid-template-columns: 1fr;
    grid-template-areas: "header" "main";
  }
  .sidebar { display: none; }
}
\`\`\`

Kluczowe techniki:
- **CSS Custom Properties** — łatwy dark/light mode switch
- **Grid \`auto-fill\` + \`minmax\`** — responsywna siatka bez media queries
- **Named grid areas** — czytelny layout`,

  // ── Docker / DevOps ────────────────────────────────────────────
  docker: `Oto Dockerfile z multi-stage build i docker-compose:

\`\`\`dockerfile
# --- Build stage ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && \\
    cp -R node_modules /prod_modules && \\
    npm ci
COPY . .
RUN npm run build

# --- Production stage ---
FROM node:20-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /prod_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json .
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
\`\`\`

\`\`\`yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:secret@db:5432/myapp
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s

volumes:
  pgdata:
\`\`\`

Best practices:
- **Multi-stage** — obraz produkcyjny jest mniejszy (brak devDependencies, source)
- **Non-root user** — bezpieczeństwo
- **HEALTHCHECK** — Docker wie czy kontener działa
- **\`npm ci\`** zamiast \`npm install\` — deterministyczne buildy`,
};

// ─── Reguły dopasowania ─────────────────────────────────────────

/**
 * @typedef {Object} Rule
 * @property {string} category — klucz w RESPONSES
 * @property {string[]} keywords — słowa kluczowe (OR)
 * @property {RegExp[]} [patterns] — dodatkowe regexy (OR)
 * @property {number} [boost] — dodatkowy bonus do score (domyślnie 0)
 */

/** @type {Rule[]} */
const RULES = [
  {
    category: 'greeting',
    keywords: ['cześć', 'hej', 'witaj', 'hello', 'hi ', 'pomoc', 'help', 'co potrafisz', 'co umiesz'],
    patterns: [/^(cześć|hej|witaj|hello|hi|siema)/i],
    boost: 2,
  },
  {
    category: 'api',
    keywords: ['endpoint', 'api', 'express', 'rest', 'router', 'crud', 'route', 'get ', 'post '],
  },
  {
    category: 'powershell',
    keywords: ['powershell', 'folder', 'plik', 'katalog', 'stwórz plik', 'ps1', 'new-item', 'get-process', 'dysk', 'skrypt ps'],
    patterns: [/\bps\b/, /komend[aęy]\s+(?:system|power)/i],
  },
  {
    category: 'architecture',
    keywords: ['struktura', 'architektura', 'middleware', 'wzorzec', 'pattern', 'moduł', 'organizacja', 'katalogi', 'layout projektu'],
  },
  {
    category: 'sql',
    keywords: ['sql', 'baza', 'database', 'query', 'zapytanie', 'tabela', 'select', 'insert', 'postgres', 'mysql', 'migracja'],
  },
  {
    category: 'testing',
    keywords: ['test', 'testy', 'testow', 'vitest', 'jest', 'mock', 'assert', 'expect', 'coverage', 'spec'],
    patterns: [/napisz\s+test/i, /unit\s*test/i],
  },
  {
    category: 'bugs',
    keywords: ['błąd', 'bug', 'problem', 'review', 'przegląd', 'sprawdź', 'issue', 'fix', 'napraw', 'debug', 'nie działa', 'error'],
    patterns: [/znajdź\s+(błęd|problem)/i, /co\s+jest\s+nie\s+tak/i],
  },
  {
    category: 'refactoring',
    keywords: ['refaktor', 'refactoring', 'uprość', 'popraw', 'ulepsz', 'clean code', 'solid', 'wydziel', 'extract', 'przebuduj'],
    patterns: [/jak\s+(ulepszyć|poprawić|uprościć)/i],
  },
  {
    category: 'python',
    keywords: ['python', 'pip', 'django', 'flask', 'fastapi', 'dataclass', 'pandas', '.py'],
    patterns: [/\bpy\b/],
  },
  {
    category: 'typescript',
    keywords: ['typescript', 'ts ', 'interface', 'generic', 'type ', 'types', 'zod', 'typowany'],
    patterns: [/\bts\b/],
  },
  {
    category: 'git',
    keywords: ['git', 'commit', 'branch', 'merge', 'rebase', 'stash', 'cherry-pick', 'push', 'pull request', 'pr '],
  },
  {
    category: 'security',
    keywords: ['bezpieczeństwo', 'security', 'xss', 'injection', 'csrf', 'auth', 'token', 'jwt', 'helmet', 'cors', 'rate limit'],
    patterns: [/sql\s*injection/i],
  },
  {
    category: 'performance',
    keywords: ['wydajność', 'performance', 'optymalizacja', 'szybkość', 'cache', 'slow', 'wolne', 'n+1', 'lazy', 'memoiz'],
    patterns: [/jak\s+przyspieszyć/i],
  },
  {
    category: 'css',
    keywords: ['css', 'styl', 'layout', 'grid', 'flexbox', 'responsive', 'animacja', 'design', 'tailwind', 'sass'],
  },
  {
    category: 'docker',
    keywords: ['docker', 'kontener', 'container', 'dockerfile', 'compose', 'kubernetes', 'k8s', 'deploy', 'ci/cd', 'devops'],
  },
];

// ─── Scoring ─────────────────────────────────────────────────────

/**
 * Oblicza score dopasowania dla kategorii na podstawie inputu.
 * Uwzględnia: słowa kluczowe, regexy, boost, historię konwersacji.
 */
function scoreCategory(rule, input) {
  let score = 0;
  const lower = input.toLowerCase();

  for (const kw of rule.keywords) {
    if (lower.includes(kw.toLowerCase())) score += 1;
  }

  if (rule.patterns) {
    for (const re of rule.patterns) {
      if (re.test(input)) score += 1.5;
    }
  }

  score += (rule.boost || 0) * (score > 0 ? 1 : 0);

  return score;
}

// ─── Publiczne API ───────────────────────────────────────────────

/**
 * Wybiera najlepszą odpowiedź demo na podstawie:
 * 1. inputu użytkownika (scoring słów kluczowych + regex)
 * 2. historii konwersacji (unika powtórzeń, rozpoznaje follow-up)
 * 3. kontekstu projektu (jeśli /analyze aktywne)
 *
 * @param {string} userInput — ostatni input użytkownika
 * @param {Array<{role:string, content:string}>} [messages=[]] — historia konwersacji
 * @param {boolean} [hasProjectContext=false] — czy /analyze jest aktywne
 * @returns {string} — treść odpowiedzi
 */
export function getContextualDemoResponse(userInput, messages = [], hasProjectContext = false) {
  const input = userInput || '';

  // Jeśli /analyze aktywne i pytanie dotyczy projektu
  if (hasProjectContext && /projekt|analiz|struktur|plik|moduł|zależnoś|code\s*review/i.test(input)) {
    return RESPONSES.projectAnalysis;
  }

  // Score każdej kategorii
  const scores = RULES.map((rule) => ({
    category: rule.category,
    score: scoreCategory(rule, input),
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Historia — ostatnio użyte kategorie (unikanie powtórzeń)
  const recentlyUsed = getRecentCategories(messages);

  // Wybierz najlepszą kategorię, która nie była ostatnio użyta
  let chosen = null;
  for (const s of scores) {
    if (!recentlyUsed.has(s.category)) {
      chosen = s.category;
      break;
    }
  }

  // Fallback: najwyższy score nawet jeśli był niedawno użyty
  if (!chosen && scores.length > 0) {
    chosen = scores[0].category;
  }

  // Jeśli brak match + jest historia — to follow-up
  if (!chosen && messages.length >= 2) {
    return RESPONSES.followUp;
  }

  // Ostateczny fallback — greeting
  if (!chosen) {
    return RESPONSES.greeting;
  }

  return RESPONSES[chosen];
}

/**
 * Zwraca set kategorii użytych w ostatnich N odpowiedziach asystenta.
 */
function getRecentCategories(messages, n = 3) {
  const recent = new Set();
  const assistantMsgs = messages
    .filter((m) => m.role === 'assistant')
    .slice(-n);

  for (const msg of assistantMsgs) {
    for (const rule of RULES) {
      // Sprawdź czy odpowiedź zawiera charakterystyczne fragmenty
      const response = RESPONSES[rule.category];
      if (response && msg.content === response) {
        recent.add(rule.category);
      }
    }
  }
  return recent;
}

/**
 * Zwraca losową odpowiedź (legacy API, zachowane dla kompatybilności).
 */
export function getRandomDemoResponse() {
  const keys = Object.keys(RESPONSES);
  const key = keys[Math.floor(Math.random() * keys.length)];
  return RESPONSES[key];
}

// Export do testów
export { RESPONSES, RULES, scoreCategory };
