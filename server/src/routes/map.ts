import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db, isPremium } from '../db.js'
import { optionalAuth, requireAuth, requirePremium } from '../auth.js'
import { publicUser } from './auth.js'

export const mapRouter = Router()

const LOOKING = new Set(['Right now', 'Hosting', 'Cruising', 'Car', 'Hotel', 'Tonight'])

/** Anyone can browse. Only premium + map_visible pins appear. */
mapRouter.get('/nearby', optionalAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, display_name, handle, age, bio, avatar_url, looking_for, looking_note, looking_posted_at,
              last_seen_at, lat, lng, premium, premium_until, role, map_visible
       FROM users
       WHERE role != 'admin' AND map_visible = 1 AND premium = 1
       ORDER BY COALESCE(looking_posted_at, last_seen_at) DESC
       LIMIT 200`,
    )
    .all() as Record<string, unknown>[]

  const people = rows
    .filter((r) => isPremium(r))
    .map((r, i) => {
      const baseLat = 37.7849
      const baseLng = -122.4094
      const lat = typeof r.lat === 'number' ? r.lat : baseLat + ((i % 7) - 3) * 0.008
      const lng = typeof r.lng === 'number' ? r.lng : baseLng + ((i % 5) - 2) * 0.01
      const postedAt = r.looking_posted_at ? new Date(String(r.looking_posted_at)).getTime() : 0
      const lastSeen = r.last_seen_at ? new Date(String(r.last_seen_at)).getTime() : 0
      const fresh = postedAt > 0 && Date.now() - postedAt < 1000 * 60 * 90
      const online = Date.now() - Math.max(lastSeen, postedAt) < 1000 * 60 * 15
      const note =
        String(r.looking_note || '').trim() ||
        String(r.bio || '').trim() ||
        'Open to a casual meet.'
      return {
        id: r.id,
        name: r.display_name,
        handle: r.handle,
        age: r.age,
        note,
        looking: r.looking_for || 'Right now',
        lookingPostedAt: r.looking_posted_at || null,
        rightNow: fresh || String(r.looking_for) === 'Right now',
        avatar: r.avatar_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop',
        lat,
        lng,
        status: online ? 'online' : fresh ? 'just-now' : 'away',
        distance: 'nearby',
        tags: [String(r.looking_for || 'Right now').toLowerCase()],
        premium: true,
      }
    })

  res.json({
    people,
    note: 'Casual encounters only — Premium members posting what they want right now. Browse free; go live with Premium.',
  })
})

/** Premium: post looking-for + optional note and go live on the map */
mapRouter.post('/pulse', requirePremium, (req, res) => {
  const lookingRaw = String(req.body?.lookingFor || 'Right now').trim()
  const lookingFor = LOOKING.has(lookingRaw) ? lookingRaw : 'Right now'
  const lookingNote = String(req.body?.lookingNote ?? '').trim().slice(0, 140)
  const mapVisible = req.body?.mapVisible === false ? 0 : 1
  const now = new Date().toISOString()

  db.prepare(
    `UPDATE users SET
      looking_for = ?,
      looking_note = ?,
      looking_posted_at = ?,
      map_visible = ?,
      last_seen_at = ?
     WHERE id = ?`,
  ).run(lookingFor, lookingNote, now, mapVisible, now, req.user!.id)

  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, ?, 'encounter_pulse', 'user', ?, ?, ?)`,
  ).run(
    randomUUID(),
    req.user!.id,
    req.headers['x-session-id'] ?? null,
    req.user!.id,
    JSON.stringify({ lookingFor, mapVisible: Boolean(mapVisible) }),
    now,
  )

  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as Record<string, unknown>
  res.json({ ok: true, user: publicUser(user) })
})

mapRouter.post('/location', requireAuth, (req, res) => {
  const lat = Number(req.body?.lat)
  const lng = Number(req.body?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng required' })
  }
  db.prepare(`UPDATE users SET lat = ?, lng = ?, last_seen_at = ? WHERE id = ?`).run(
    lat,
    lng,
    new Date().toISOString(),
    req.user!.id,
  )
  res.json({ ok: true })
})
