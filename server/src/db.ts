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

  CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id);
  CREATE INDEX IF NOT EXISTS idx_uploads_created ON uploads(created_at);
  CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
  CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
`)

export function seedAdmin() {
  const existing = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get()
  if (existing) return

  const id = 'admin-ember-1'
  const now = new Date().toISOString()
  const password = process.env.ADMIN_PASSWORD || 'ember-admin-change-me'
  const hash = bcrypt.hashSync(password, 10)

  db.prepare(
    `INSERT INTO users (
      id, email, password_hash, display_name, handle, age, bio, avatar_url,
      looking_for, map_visible, role, created_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?)`,
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
  )

  console.log(`[ember] Seeded admin ${process.env.ADMIN_EMAIL || 'admin@ember.app'} / ${password}`)
}
