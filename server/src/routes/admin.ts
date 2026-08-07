import { Router } from 'express'
import { db } from '../db.js'
import { requireAdmin } from '../auth.js'

export const adminRouter = Router()
adminRouter.use(requireAdmin)

function mapUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    handle: row.handle,
    age: row.age,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    lookingFor: row.looking_for,
    mapVisible: Boolean(row.map_visible),
    role: row.role,
    ageVerified: Boolean(row.age_verified) || row.role === 'admin',
    ageVerifiedAt: row.age_verified_at,
    birthdate: row.birthdate,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  }
}

function mapUpload(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    caption: row.caption,
    visibility: row.visibility,
    mediaType: row.media_type,
    url: `/api/media/${row.file_path}`,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    displayName: row.display_name,
    handle: row.handle,
    email: row.email,
  }
}

adminRouter.get('/overview', (_req, res) => {
  const users = (db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role != 'admin'`).get() as { c: number }).c
  const verifiedUsers = (
    db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role != 'admin' AND age_verified = 1`).get() as { c: number }
  ).c
  const uploads = (db.prepare(`SELECT COUNT(*) AS c FROM uploads`).get() as { c: number }).c
  const privateUploads = (
    db.prepare(`SELECT COUNT(*) AS c FROM uploads WHERE visibility = 'private'`).get() as { c: number }
  ).c
  const events24h = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM events WHERE created_at >= datetime('now', '-1 day')`)
      .get() as { c: number }
  ).c
  const verifyRevenue = (
    db
      .prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS c FROM verifications WHERE status = 'paid'`)
      .get() as { c: number }
  ).c

  const recentUsers = db
    .prepare(`SELECT * FROM users WHERE role != 'admin' ORDER BY created_at DESC LIMIT 8`)
    .all() as Record<string, unknown>[]

  const recentUploads = db
    .prepare(
      `SELECT u.*, us.display_name, us.handle, us.email
       FROM uploads u JOIN users us ON us.id = u.user_id
       ORDER BY u.created_at DESC LIMIT 8`,
    )
    .all() as Record<string, unknown>[]

  const topEvents = db
    .prepare(
      `SELECT event_type AS type, COUNT(*) AS count
       FROM events
       WHERE created_at >= datetime('now', '-7 day')
       GROUP BY event_type
       ORDER BY count DESC
       LIMIT 12`,
    )
    .all()

  res.json({
    stats: { users, verifiedUsers, uploads, privateUploads, events24h, verifyRevenueCents: verifyRevenue },
    recentUsers: recentUsers.map(mapUser),
    recentUploads: recentUploads.map(mapUpload),
    topEvents,
  })
})

adminRouter.get('/users', (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase()
  let rows: Record<string, unknown>[]
  if (q) {
    rows = db
      .prepare(
        `SELECT * FROM users
         WHERE role != 'admin' AND (
           lower(email) LIKE ? OR lower(handle) LIKE ? OR lower(display_name) LIKE ?
         )
         ORDER BY created_at DESC LIMIT 200`,
      )
      .all(`%${q}%`, `%${q}%`, `%${q}%`) as Record<string, unknown>[]
  } else {
    rows = db
      .prepare(`SELECT * FROM users WHERE role != 'admin' ORDER BY created_at DESC LIMIT 200`)
      .all() as Record<string, unknown>[]
  }

  const withCounts = rows.map((row) => {
    const counts = db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN visibility = 'private' THEN 1 ELSE 0 END) AS private_count,
           SUM(CASE WHEN visibility = 'public' THEN 1 ELSE 0 END) AS public_count
         FROM uploads WHERE user_id = ?`,
      )
      .get(row.id) as { total: number; private_count: number; public_count: number }
    return {
      ...mapUser(row),
      uploadCount: counts.total ?? 0,
      privateCount: counts.private_count ?? 0,
      publicCount: counts.public_count ?? 0,
    }
  })

  res.json({ users: withCounts })
})

adminRouter.get('/users/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id) as Record<string, unknown> | undefined
  if (!row) return res.status(404).json({ error: 'User not found' })

  const uploads = db
    .prepare(`SELECT * FROM uploads WHERE user_id = ? ORDER BY created_at DESC`)
    .all(row.id) as Record<string, unknown>[]

  const events = db
    .prepare(`SELECT * FROM events WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`)
    .all(row.id) as Record<string, unknown>[]

  const verifications = db
    .prepare(`SELECT * FROM verifications WHERE user_id = ? ORDER BY created_at DESC`)
    .all(row.id) as Record<string, unknown>[]

  res.json({
    user: mapUser(row),
    uploads: uploads.map((u) => mapUpload({ ...u, display_name: row.display_name, handle: row.handle, email: row.email })),
    events: events.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      targetType: e.target_type,
      targetId: e.target_id,
      meta: JSON.parse(String(e.meta_json || '{}')),
      createdAt: e.created_at,
    })),
    verifications: verifications.map((v) => ({
      id: v.id,
      status: v.status,
      birthdate: v.birthdate,
      amountCents: v.amount_cents,
      currency: v.currency,
      provider: v.provider,
      createdAt: v.created_at,
      completedAt: v.completed_at,
    })),
    note: 'Admin view includes private album uploads and age-verification payments.',
  })
})

adminRouter.get('/uploads', (req, res) => {
  const visibility = String(req.query.visibility ?? 'all')
  let rows: Record<string, unknown>[]
  if (visibility === 'private' || visibility === 'public' || visibility === 'followers') {
    rows = db
      .prepare(
        `SELECT u.*, us.display_name, us.handle, us.email
         FROM uploads u JOIN users us ON us.id = u.user_id
         WHERE u.visibility = ?
         ORDER BY u.created_at DESC LIMIT 300`,
      )
      .all(visibility) as Record<string, unknown>[]
  } else {
    rows = db
      .prepare(
        `SELECT u.*, us.display_name, us.handle, us.email
         FROM uploads u JOIN users us ON us.id = u.user_id
         ORDER BY u.created_at DESC LIMIT 300`,
      )
      .all() as Record<string, unknown>[]
  }

  res.json({ uploads: rows.map(mapUpload), includesPrivate: true })
})

adminRouter.get('/events', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 150), 500)
  const rows = db
    .prepare(
      `SELECT e.*, us.display_name, us.handle, us.email
       FROM events e
       LEFT JOIN users us ON us.id = e.user_id
       ORDER BY e.created_at DESC
       LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[]

  res.json({
    events: rows.map((e) => ({
      id: e.id,
      userId: e.user_id,
      displayName: e.display_name,
      handle: e.handle,
      email: e.email,
      sessionId: e.session_id,
      eventType: e.event_type,
      targetType: e.target_type,
      targetId: e.target_id,
      meta: JSON.parse(String(e.meta_json || '{}')),
      createdAt: e.created_at,
    })),
  })
})
