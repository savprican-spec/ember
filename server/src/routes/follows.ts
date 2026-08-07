import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from '../db.js'
import { requireAuth } from '../auth.js'

export const followsRouter = Router()

followsRouter.post('/:userId', requireAuth, (req, res) => {
  const followingId = req.params.userId
  if (followingId === req.user!.id) return res.status(400).json({ error: 'Cannot follow yourself' })
  const target = db.prepare(`SELECT id FROM users WHERE id = ? AND role != 'admin'`).get(followingId)
  if (!target) return res.status(404).json({ error: 'User not found' })

  const now = new Date().toISOString()
  try {
    db.prepare(`INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)`).run(
      req.user!.id,
      followingId,
      now,
    )
  } catch {
    return res.json({ ok: true, following: true })
  }

  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, ?, 'follow', 'user', ?, '{}', ?)`,
  ).run(randomUUID(), req.user!.id, req.headers['x-session-id'] ?? null, followingId, now)

  res.status(201).json({ ok: true, following: true })
})

followsRouter.delete('/:userId', requireAuth, (req, res) => {
  db.prepare(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?`).run(req.user!.id, req.params.userId)
  res.json({ ok: true, following: false })
})

followsRouter.get('/me', requireAuth, (req, res) => {
  const following = db
    .prepare(
      `SELECT u.id, u.display_name, u.handle, u.avatar_url, f.created_at
       FROM follows f JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = ?
       ORDER BY f.created_at DESC`,
    )
    .all(req.user!.id) as Record<string, unknown>[]
  const followers = db
    .prepare(
      `SELECT u.id, u.display_name, u.handle, u.avatar_url, f.created_at
       FROM follows f JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ?
       ORDER BY f.created_at DESC`,
    )
    .all(req.user!.id) as Record<string, unknown>[]

  res.json({
    following: following.map((u) => ({
      id: u.id,
      displayName: u.display_name,
      handle: u.handle,
      avatarUrl: u.avatar_url,
      createdAt: u.created_at,
    })),
    followers: followers.map((u) => ({
      id: u.id,
      displayName: u.display_name,
      handle: u.handle,
      avatarUrl: u.avatar_url,
      createdAt: u.created_at,
    })),
  })
})

followsRouter.get('/status/:userId', requireAuth, (req, res) => {
  const row = db
    .prepare(`SELECT 1 AS ok FROM follows WHERE follower_id = ? AND following_id = ?`)
    .get(req.user!.id, req.params.userId)
  res.json({ following: Boolean(row) })
})
