import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = path.resolve(__dirname, '../data')
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')
const DB_PATH = path.join(DATA_DIR, 'ember.db')

fs.mkdirSync(UPLOAD_DIR, { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    handle TEXT NOT NULL UNIQUE,
    age INTEGER NOT NULL,
    bio TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    looking_for TEXT DEFAULT 'Tonight',
    map_visible INTEGER DEFAULT 1,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT DEFAULT '',
    caption TEXT DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'public',
    media_type TEXT NOT NULL DEFAULT 'video',
    file_path TEXT NOT NULL,
    mime_type TEXT DEFAULT '',
    size_bytes INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_id TEXT,
    event_type TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    meta_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    birthdate TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    stripe_session_id TEXT,
    stripe_payment_intent TEXT,
    provider TEXT NOT NULL DEFAULT 'stripe',
    created_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id);
  CREATE INDEX IF NOT EXISTS idx_uploads_created ON uploads(created_at);
  CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
  CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
  CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id);
`)

function ensureColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

ensureColumn('users', 'age_verified', 'INTEGER NOT NULL DEFAULT 0')
ensureColumn('users', 'age_verified_at', 'TEXT')
ensureColumn('users', 'birthdate', 'TEXT')
ensureColumn('users', 'stripe_customer_id', 'TEXT')

export const VERIFY_PRICE_CENTS = Number(process.env.VERIFY_PRICE_CENTS || 699)
export const VERIFY_CURRENCY = (process.env.VERIFY_CURRENCY || 'usd').toLowerCase()

export function seedAdmin() {
  const existing = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get() as
    | { id: string }
    | undefined
  if (existing) {
    db.prepare(
      `UPDATE users SET age_verified = 1, age_verified_at = COALESCE(age_verified_at, ?) WHERE id = ?`,
    ).run(new Date().toISOString(), existing.id)
    return
  }

  const id = 'admin-ember-1'
  const now = new Date().toISOString()
  const password = process.env.ADMIN_PASSWORD || 'ember-admin-change-me'
  const hash = bcrypt.hashSync(password, 10)

  db.prepare(
    `INSERT INTO users (
      id, email, password_hash, display_name, handle, age, bio, avatar_url,
      looking_for, map_visible, role, created_at, last_seen_at, age_verified, age_verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?, 1, ?)`,
  ).run(
    id,
    process.env.ADMIN_EMAIL || 'admin@ember.app',
    hash,
    'Ember Admin',
    'ember.admin',
    30,
    'Operator account — sees all uploads including private albums.',
    '',
    'Tonight',
    0,
    now,
    now,
    now,
  )

  console.log(`[ember] Seeded admin ${process.env.ADMIN_EMAIL || 'admin@ember.app'} / ${password}`)
}

export function ageFromBirthdate(birthdate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate)
  if (!m) return null
  const born = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(born.getTime())) return null
  const now = new Date()
  let age = now.getUTCFullYear() - born.getUTCFullYear()
  const month = now.getUTCMonth() - born.getUTCMonth()
  if (month < 0 || (month === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1
  return age
}

export function markUserVerified(userId: string, birthdate?: string | null) {
  const now = new Date().toISOString()
  db.prepare(
    `UPDATE users SET age_verified = 1, age_verified_at = ?, birthdate = COALESCE(?, birthdate), last_seen_at = ? WHERE id = ?`,
  ).run(now, birthdate ?? null, now, userId)
}
