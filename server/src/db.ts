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
    map_visible INTEGER DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TEXT,
    PRIMARY KEY (conversation_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    resolved_by TEXT
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (follower_id, following_id)
  );

  CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id);
  CREATE INDEX IF NOT EXISTS idx_uploads_created ON uploads(created_at);
  CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
  CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
  CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
  CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
`)

function ensureColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

ensureColumn('users', 'age_verified', 'INTEGER NOT NULL DEFAULT 1')
ensureColumn('users', 'age_verified_at', 'TEXT')
ensureColumn('users', 'birthdate', 'TEXT')
ensureColumn('users', 'stripe_customer_id', 'TEXT')
ensureColumn('users', 'premium', 'INTEGER NOT NULL DEFAULT 0')
ensureColumn('users', 'premium_until', 'TEXT')
ensureColumn('users', 'stripe_subscription_id', 'TEXT')
ensureColumn('users', 'lat', 'REAL')
ensureColumn('users', 'lng', 'REAL')
ensureColumn('users', 'looking_note', "TEXT DEFAULT ''")
ensureColumn('users', 'looking_posted_at', 'TEXT')

// Meetup map visibility is premium-only; default off for free basic profiles
db.prepare(`UPDATE users SET map_visible = 0 WHERE premium = 0 AND role != 'admin'`).run()

export const PREMIUM_PRICE_CENTS = Number(process.env.PREMIUM_PRICE_CENTS || 999)
export const PREMIUM_CURRENCY = (process.env.PREMIUM_CURRENCY || 'usd').toLowerCase()

export function isPremium(row: { premium?: unknown; premium_until?: unknown; role?: unknown }) {
  if (row.role === 'admin') return true
  if (!row.premium) return false
  if (!row.premium_until) return Boolean(row.premium)
  return new Date(String(row.premium_until)).getTime() > Date.now()
}

export function seedAdmin() {
  const existing = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get() as
    | { id: string }
    | undefined
  const now = new Date().toISOString()
  if (existing) {
    db.prepare(
      `UPDATE users SET age_verified = 1, premium = 1, premium_until = COALESCE(premium_until, ?), age_verified_at = COALESCE(age_verified_at, ?) WHERE id = ?`,
    ).run(new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString(), now, existing.id)
    return
  }

  const id = 'admin-ember-1'
  const password = process.env.ADMIN_PASSWORD || 'ember-admin-change-me'
  const hash = bcrypt.hashSync(password, 10)

  db.prepare(
    `INSERT INTO users (
      id, email, password_hash, display_name, handle, age, bio, avatar_url,
      looking_for, map_visible, role, created_at, last_seen_at, age_verified, age_verified_at, premium, premium_until
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?, 1, ?, 1, ?)`,
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
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10).toISOString(),
  )

  console.log(`[ember] Seeded admin ${process.env.ADMIN_EMAIL || 'admin@ember.app'} / ${password}`)
}

export function markUserPremium(userId: string, untilIso: string, subscriptionId?: string | null) {
  const now = new Date().toISOString()
  db.prepare(
    `UPDATE users SET premium = 1, premium_until = ?, stripe_subscription_id = COALESCE(?, stripe_subscription_id), last_seen_at = ? WHERE id = ?`,
  ).run(untilIso, subscriptionId ?? null, now, userId)
}

export function clearUserPremium(userId: string) {
  db.prepare(
    `UPDATE users SET
      premium = 0,
      premium_until = NULL,
      map_visible = 0,
      looking_note = '',
      looking_posted_at = NULL,
      stripe_subscription_id = NULL
     WHERE id = ?`,
  ).run(userId)
}
