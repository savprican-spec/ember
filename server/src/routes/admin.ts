import { Router } from 'express'
import { db, isPremium, PREMIUM_PRICE_CENTS } from '../db.js'
import { requireAdmin } from '../auth.js'

export const adminRouter = Router()
adminRouter.use(requireAdmin)

function mapUser(row: Record<string, unknown>) {
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
  const premiumUsers = (
    db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role != 'admin' AND premium = 1`).get() as { c: number }
  ).c
  const mapVisibleUsers = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM users WHERE role != 'admin' AND premium = 1 AND map_visible = 1`)
      .get() as { c: number }
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
  const openReports = (db.prepare(`SELECT COUNT(*) AS c FROM reports WHERE status = 'open'`).get() as { c: number }).c
  const messages = (db.prepare(`SELECT COUNT(*) AS c FROM messages`).get() as { c: number }).c
  const conversations = (db.prepare(`SELECT COUNT(*) AS c FROM conversations`).get() as { c: number }).c
  const follows = (db.prepare(`SELECT COUNT(*) AS c FROM follows`).get() as { c: number }).c

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

  const recentReports = db
    .prepare(
      `SELECT r.*, us.display_name AS reporter_name, us.handle AS reporter_handle
       FROM reports r JOIN users us ON us.id = r.reporter_id
       ORDER BY r.created_at DESC LIMIT 8`,
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
    stats: {
      users,
      premiumUsers,
      mapVisibleUsers,
      uploads,
      privateUploads,
      events24h,
      premiumMrrCents: premiumUsers * PREMIUM_PRICE_CENTS,
      openReports,
      messages,
      conversations,
      follows,
    },
    recentUsers: recentUsers.map(mapUser),
    recentUploads: recentUploads.map(mapUpload),
    recentReports: recentReports.map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      targetType: r.target_type,
      targetId: r.target_id,
      reporterName: r.reporter_name,
      reporterHandle: r.reporter_handle,
      createdAt: r.created_at,
    })),
    topEvents,
    note: 'Admin hub sees everything: private uploads, inbox messages, and reports. Feed is free; map appearance is Premium.',
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
    conversations: db
      .prepare(
        `SELECT c.id, c.updated_at,
           (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
           (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS preview
         FROM conversations c
         JOIN conversation_members cm ON cm.conversation_id = c.id
         WHERE cm.user_id = ?
         ORDER BY c.updated_at DESC`,
      )
      .all(row.id)
      .map((c) => ({
        id: (c as Record<string, unknown>).id,
        updatedAt: (c as Record<string, unknown>).updated_at,
        messageCount: (c as Record<string, unknown>).message_count,
        preview: (c as Record<string, unknown>).preview,
      })),
    reportsAbout: db
      .prepare(
        `SELECT r.*, us.display_name AS reporter_name, us.handle AS reporter_handle
         FROM reports r JOIN users us ON us.id = r.reporter_id
         WHERE r.target_type = 'user' AND r.target_id = ?
         ORDER BY r.created_at DESC`,
      )
      .all(row.id)
      .map((r) => ({
        id: (r as Record<string, unknown>).id,
        reason: (r as Record<string, unknown>).reason,
        status: (r as Record<string, unknown>).status,
        reporterName: (r as Record<string, unknown>).reporter_name,
        reporterHandle: (r as Record<string, unknown>).reporter_handle,
        createdAt: (r as Record<string, unknown>).created_at,
      })),
    followingCount: (
      db.prepare(`SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?`).get(row.id) as { c: number }
    ).c,
    followerCount: (
      db.prepare(`SELECT COUNT(*) AS c FROM follows WHERE following_id = ?`).get(row.id) as { c: number }
    ).c,
    note: 'Admin view includes private albums, inbox threads, reports, follows, and Premium status.',
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

adminRouter.get('/reports', (req, res) => {
  const status = String(req.query.status ?? 'open')
  let rows: Record<string, unknown>[]
  if (status === 'all') {
    rows = db
      .prepare(
        `SELECT r.*, us.display_name AS reporter_name, us.handle AS reporter_handle, us.email AS reporter_email
         FROM reports r JOIN users us ON us.id = r.reporter_id
         ORDER BY r.created_at DESC LIMIT 400`,
      )
      .all() as Record<string, unknown>[]
  } else {
    rows = db
      .prepare(
        `SELECT r.*, us.display_name AS reporter_name, us.handle AS reporter_handle, us.email AS reporter_email
         FROM reports r JOIN users us ON us.id = r.reporter_id
         WHERE r.status = ?
         ORDER BY r.created_at DESC LIMIT 400`,
      )
      .all(status) as Record<string, unknown>[]
  }

  res.json({
    reports: rows.map((r) => ({
      id: r.id,
      reporterId: r.reporter_id,
      reporterName: r.reporter_name,
      reporterHandle: r.reporter_handle,
      reporterEmail: r.reporter_email,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      resolvedBy: r.resolved_by,
    })),
  })
})

adminRouter.patch('/reports/:id', (req, res) => {
  const status = String(req.body?.status || '')
  if (!['open', 'reviewing', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  const now = new Date().toISOString()
  const resolvedAt = status === 'resolved' || status === 'dismissed' ? now : null
  const result = db
    .prepare(
      `UPDATE reports SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?`,
    )
    .run(status, resolvedAt, req.user!.id, req.params.id)
  if (!result.changes) return res.status(404).json({ error: 'Report not found' })
  res.json({ ok: true })
})

adminRouter.get('/messages', (_req, res) => {
  const conversations = db
    .prepare(`SELECT id, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 300`)
    .all() as Array<{ id: string; created_at: string; updated_at: string }>

  const list = conversations.map((c) => {
    const members = db
      .prepare(
        `SELECT u.id, u.display_name, u.handle, u.email, u.avatar_url
         FROM conversation_members cm JOIN users u ON u.id = cm.user_id
         WHERE cm.conversation_id = ?`,
      )
      .all(c.id) as Record<string, unknown>[]
    const last = db
      .prepare(
        `SELECT body, created_at, sender_id FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(c.id) as { body: string; created_at: string; sender_id: string } | undefined
    const count = (
      db.prepare(`SELECT COUNT(*) AS c FROM messages WHERE conversation_id = ?`).get(c.id) as { c: number }
    ).c
    return {
      id: c.id,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      messageCount: count,
      preview: last?.body || '',
      lastMessageAt: last?.created_at || c.updated_at,
      members: members.map((m) => ({
        id: m.id,
        displayName: m.display_name,
        handle: m.handle,
        email: m.email,
        avatarUrl: m.avatar_url,
      })),
    }
  })

  res.json({ conversations: list, note: 'Full inbox visibility for operator review.' })
})

adminRouter.get('/messages/:conversationId', (req, res) => {
  const conversationId = req.params.conversationId
  const conversation = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(conversationId)
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' })

  const members = db
    .prepare(
      `SELECT u.id, u.display_name, u.handle, u.email, u.avatar_url
       FROM conversation_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = ?`,
    )
    .all(conversationId) as Record<string, unknown>[]

  const messages = db
    .prepare(
      `SELECT m.*, u.display_name, u.handle, u.email
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC
       LIMIT 1000`,
    )
    .all(conversationId) as Record<string, unknown>[]

  res.json({
    id: conversationId,
    members: members.map((m) => ({
      id: m.id,
      displayName: m.display_name,
      handle: m.handle,
      email: m.email,
      avatarUrl: m.avatar_url,
    })),
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      senderId: m.sender_id,
      senderName: m.display_name,
      senderHandle: m.handle,
      senderEmail: m.email,
    })),
  })
})
