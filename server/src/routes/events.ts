import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from '../db.js'
import { optionalAuth } from '../auth.js'

export const eventsRouter = Router()

eventsRouter.post('/', optionalAuth, (req, res) => {
  const { eventType, targetType, targetId, meta, sessionId } = req.body ?? {}
  if (!eventType) return res.status(400).json({ error: 'eventType required' })

  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    req.user?.id ?? null,
    sessionId ?? req.headers['x-session-id'] ?? null,
    String(eventType).slice(0, 64),
    targetType ? String(targetType).slice(0, 64) : null,
    targetId ? String(targetId).slice(0, 128) : null,
    JSON.stringify(meta ?? {}),
    now,
  )

  res.status(201).json({ ok: true, id })
})
