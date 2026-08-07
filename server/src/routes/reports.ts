import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'

export const reportsRouter = Router()
reportsRouter.use(requireAuth)

const REASONS = ['spam', 'harassment', 'underage_suspicion', 'nonconsensual', 'scam', 'illegal', 'other'] as const
const TARGETS = ['user', 'upload', 'message', 'conversation'] as const

reportsRouter.post('/', (req, res) => {
  const { targetType, targetId, reason, details = '' } = req.body ?? {}
  if (!TARGETS.includes(targetType)) return res.status(400).json({ error: 'Invalid targetType' })
  if (!REASONS.includes(reason)) return res.status(400).json({ error: 'Invalid reason' })
  if (!targetId) return res.status(400).json({ error: 'targetId required' })

  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, details, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
  ).run(id, req.user!.id, targetType, String(targetId), reason, String(details).slice(0, 1000), now)

  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, ?, 'report_create', ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    req.user!.id,
    req.headers['x-session-id'] ?? null,
    targetType,
    String(targetId),
    JSON.stringify({ reason, reportId: id }),
    now,
  )

  res.status(201).json({ report: { id, status: 'open', createdAt: now } })
})
