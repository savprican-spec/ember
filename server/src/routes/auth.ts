import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { db, isPremium } from '../db.js'
import { requireAuth, signToken } from '../auth.js'

export const authRouter = Router()

export function publicUser(row: Record<string, unknown>) {
  const premium = isPremium(row)
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    handle: row.handle,
    age: row.age,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    lookingFor: row.looking_for,
    mapVisible: Boolean(row.map_visible) && premium,
    role: row.role,
    premium,
    premiumUntil: row.premium_until,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  }
}

authRouter.post('/register', (req, res) => {
  const { email, password, displayName, handle, age } = req.body ?? {}
  if (!email || !password || !displayName || !handle || !age) {
    return res.status(400).json({ error: 'email, password, displayName, handle, and age are required' })
  }
  if (Number(age) < 18) {
    return res.status(400).json({ error: 'You must be 18 or older' })
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const cleanHandle = String(handle).replace(/^@/, '').toLowerCase().replace(/[^a-z0-9._]/g, '')
  if (cleanHandle.length < 3) {
    return res.status(400).json({ error: 'Handle must be at least 3 characters' })
  }

  const id = randomUUID()
  const now = new Date().toISOString()
  const hash = bcrypt.hashSync(String(password), 10)

  try {
    db.prepare(
      `INSERT INTO users (
        id, email, password_hash, display_name, handle, age, bio, avatar_url,
        looking_for, map_visible, role, created_at, last_seen_at, age_verified, age_verified_at, premium
      ) VALUES (?, ?, ?, ?, ?, ?, '', '', 'Tonight', 0, 'user', ?, ?, 1, ?, 0)`,
    ).run(id, String(email).toLowerCase().trim(), hash, String(displayName).trim(), cleanHandle, Number(age), now, now, now)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email or handle already taken' })
    }
    throw err
  }

  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, ?, 'register', 'user', ?, '{}', ?)`,
  ).run(randomUUID(), id, req.headers['x-session-id'] ?? null, id, now)

  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as Record<string, unknown>
  const token = signToken({
    id: String(row.id),
    email: String(row.email),
    display_name: String(row.display_name),
    handle: String(row.handle),
    role: row.role as 'user' | 'admin',
  })

  res.status(201).json({ token, user: publicUser(row) })
})

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body ?? {}
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })

  const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(String(email).toLowerCase().trim()) as
    | Record<string, unknown>
    | undefined
  if (!row || !bcrypt.compareSync(String(password), String(row.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const now = new Date().toISOString()
  db.prepare(`UPDATE users SET last_seen_at = ? WHERE id = ?`).run(now, row.id)
  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, ?, 'login', 'user', ?, '{}', ?)`,
  ).run(randomUUID(), row.id, req.headers['x-session-id'] ?? null, row.id, now)

  const token = signToken({
    id: String(row.id),
    email: String(row.email),
    display_name: String(row.display_name),
    handle: String(row.handle),
    role: row.role as 'user' | 'admin',
  })

  res.json({ token, user: publicUser({ ...row, last_seen_at: now }) })
})

authRouter.get('/me', requireAuth, (req, res) => {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as Record<string, unknown>
  res.json({ user: publicUser(row) })
})
