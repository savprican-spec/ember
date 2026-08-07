import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'

export const messagesRouter = Router()
messagesRouter.use(requireAuth)

function otherMember(conversationId: string, me: string) {
  return db
    .prepare(
      `SELECT u.id, u.display_name, u.handle, u.avatar_url, u.last_seen_at
       FROM conversation_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.conversation_id = ? AND cm.user_id != ?`,
    )
    .get(conversationId, me) as Record<string, unknown> | undefined
}

function mapPeer(row: Record<string, unknown>) {
  const lastSeen = row.last_seen_at ? new Date(String(row.last_seen_at)).getTime() : 0
  const online = Date.now() - lastSeen < 1000 * 60 * 15
  return {
    id: row.id,
    displayName: row.display_name,
    handle: row.handle,
    avatarUrl: row.avatar_url || '',
    online,
  }
}

messagesRouter.get('/inbox', (req, res) => {
  const me = req.user!.id
  const rows = db
    .prepare(
      `SELECT c.id, c.updated_at
       FROM conversations c
       JOIN conversation_members cm ON cm.conversation_id = c.id
       WHERE cm.user_id = ?
       ORDER BY c.updated_at DESC
       LIMIT 200`,
    )
    .all(me) as Array<{ id: string; updated_at: string }>

  const conversations = rows.map((c) => {
    const peer = otherMember(c.id, me)
    const last = db
      .prepare(
        `SELECT body, created_at, sender_id FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(c.id) as { body: string; created_at: string; sender_id: string } | undefined
    const membership = db
      .prepare(`SELECT last_read_at FROM conversation_members WHERE conversation_id = ? AND user_id = ?`)
      .get(c.id, me) as { last_read_at: string | null }
    const unread = db
      .prepare(
        `SELECT COUNT(*) AS c FROM messages
         WHERE conversation_id = ? AND sender_id != ?
         AND (? IS NULL OR created_at > ?)`,
      )
      .get(c.id, me, membership.last_read_at, membership.last_read_at) as { c: number }

    return {
      id: c.id,
      updatedAt: c.updated_at,
      peer: peer ? mapPeer(peer) : null,
      preview: last?.body || '',
      lastMessageAt: last?.created_at || c.updated_at,
      unread: unread.c,
    }
  })

  res.json({ conversations })
})

messagesRouter.post('/start', (req, res) => {
  const me = req.user!.id
  const handle = String(req.body?.handle || '')
    .replace(/^@/, '')
    .toLowerCase()
    .trim()
  const userId = String(req.body?.userId || '').trim()

  const peer = userId
    ? (db.prepare(`SELECT * FROM users WHERE id = ? AND role != 'admin'`).get(userId) as Record<string, unknown> | undefined)
    : (db.prepare(`SELECT * FROM users WHERE handle = ? AND role != 'admin'`).get(handle) as
        | Record<string, unknown>
        | undefined)

  if (!peer) return res.status(404).json({ error: 'User not found' })
  if (peer.id === me) return res.status(400).json({ error: 'Cannot message yourself' })

  const existing = db
    .prepare(
      `SELECT cm1.conversation_id AS id
       FROM conversation_members cm1
       JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
       WHERE cm1.user_id = ? AND cm2.user_id = ?
       LIMIT 1`,
    )
    .get(me, peer.id) as { id: string } | undefined

  if (existing) return res.json({ conversationId: existing.id })

  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO conversations (id, created_at, updated_at) VALUES (?, ?, ?)`).run(id, now, now)
  db.prepare(`INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, ?)`).run(
    id,
    me,
    now,
  )
  db.prepare(`INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, NULL)`).run(
    id,
    peer.id,
  )

  res.status(201).json({ conversationId: id })
})

messagesRouter.get('/:conversationId', (req, res) => {
  const me = req.user!.id
  const conversationId = req.params.conversationId
  const member = db
    .prepare(`SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?`)
    .get(conversationId, me)
  if (!member) return res.status(404).json({ error: 'Conversation not found' })

  const peer = otherMember(conversationId, me)
  const messages = db
    .prepare(
      `SELECT m.id, m.body, m.created_at, m.sender_id, u.display_name, u.handle
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC
       LIMIT 500`,
    )
    .all(conversationId) as Record<string, unknown>[]

  const now = new Date().toISOString()
  db.prepare(`UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?`).run(
    now,
    conversationId,
    me,
  )

  res.json({
    id: conversationId,
    peer: peer ? mapPeer(peer) : null,
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      senderId: m.sender_id,
      fromMe: m.sender_id === me,
      senderName: m.display_name,
      senderHandle: m.handle,
    })),
  })
})

messagesRouter.post('/:conversationId', (req, res) => {
  const me = req.user!.id
  const conversationId = req.params.conversationId
  const body = String(req.body?.body || '').trim()
  if (!body) return res.status(400).json({ error: 'Message body required' })
  if (body.length > 2000) return res.status(400).json({ error: 'Message too long' })

  const member = db
    .prepare(`SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?`)
    .get(conversationId, me)
  if (!member) return res.status(404).json({ error: 'Conversation not found' })

  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    conversationId,
    me,
    body,
    now,
  )
  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, conversationId)
  db.prepare(`UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?`).run(
    now,
    conversationId,
    me,
  )
  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, ?, 'message_send', 'conversation', ?, '{}', ?)`,
  ).run(randomUUID(), me, req.headers['x-session-id'] ?? null, conversationId, now)

  res.status(201).json({
    message: {
      id,
      body,
      createdAt: now,
      senderId: me,
      fromMe: true,
    },
  })
})
