import { Router } from 'express'
import { db, isPremium } from '../db.js'
import { optionalAuth, requireAuth } from '../auth.js'

export const mapRouter = Router()

/** Anyone signed in (basic) can browse the map. Only premium + map_visible users appear as pins. */
mapRouter.get('/nearby', optionalAuth, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, display_name, handle, age, bio, avatar_url, looking_for, last_seen_at, lat, lng, premium, premium_until, role, map_visible
       FROM users
       WHERE role != 'admin' AND map_visible = 1 AND premium = 1
       ORDER BY last_seen_at DESC
       LIMIT 200`,
    )
    .all() as Record<string, unknown>[]

  const people = rows
    .filter((r) => isPremium(r))
    .map((r, i) => {
      // Fallback demo coords around SF if user has no GPS yet
      const baseLat = 37.7849
      const baseLng = -122.4094
      const lat = typeof r.lat === 'number' ? r.lat : baseLat + ((i % 7) - 3) * 0.008
      const lng = typeof r.lng === 'number' ? r.lng : baseLng + ((i % 5) - 2) * 0.01
      const lastSeen = r.last_seen_at ? new Date(String(r.last_seen_at)).getTime() : 0
      const online = Date.now() - lastSeen < 1000 * 60 * 15
      return {
        id: r.id,
        name: r.display_name,
        handle: r.handle,
        age: r.age,
        note: r.bio || 'Looking to meet.',
        looking: r.looking_for,
        avatar: r.avatar_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop',
        lat,
        lng,
        status: online ? 'online' : 'away',
        distance: 'nearby',
        tags: [String(r.looking_for || 'Tonight').toLowerCase()],
        premium: true,
      }
    })

  res.json({
    people,
    note: 'Only Premium members who opted into map visibility appear here. Basic members can browse for free.',
  })
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
