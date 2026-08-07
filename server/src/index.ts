import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import jwt from 'jsonwebtoken'
import { isPremium, seedAdmin, UPLOAD_DIR } from './db.js'
import { authRouter, publicUser } from './routes/auth.js'
import { uploadsRouter } from './routes/uploads.js'
import { eventsRouter } from './routes/events.js'
import { adminRouter } from './routes/admin.js'
import { premiumRouter, handleStripeWebhook } from './routes/premium.js'
import { messagesRouter } from './routes/messages.js'
import { reportsRouter } from './routes/reports.js'
import { followsRouter } from './routes/follows.js'
import { mapRouter } from './routes/map.js'
import { requireAuth, requireAdmin, type AuthUser } from './auth.js'
import { db } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8787)
const JWT_SECRET = process.env.JWT_SECRET || 'ember-dev-secret-change-in-production'

seedAdmin()

const app = express()
app.use(cors({ origin: true, credentials: true }))

// Stripe webhook needs raw body
app.post('/api/premium/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    await handleStripeWebhook(req.body as Buffer, req.headers['stripe-signature'] as string | undefined)
    res.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook error'
    res.status(400).send(`Webhook Error: ${message}`)
  }
})

app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ember-api', time: new Date().toISOString() })
})

app.use('/api/auth', authRouter)
app.use('/api/premium', premiumRouter)
app.use('/api/uploads', uploadsRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/follows', followsRouter)
app.use('/api/map', mapRouter)
app.use('/api/events', eventsRouter)
app.use('/api/admin', adminRouter)

function resolveMediaAccess(req: express.Request, row: Record<string, unknown>) {
  if (row.visibility === 'public') return true
  const header = req.headers.authorization
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null
  const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken
  if (!token) return false
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser
    return payload.role === 'admin' || payload.id === row.user_id
  } catch {
    return false
  }
}

app.get('/api/media/:filename', (req, res) => {
  const filename = path.basename(req.params.filename)
  const row = db.prepare(`SELECT * FROM uploads WHERE file_path = ?`).get(filename) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (!resolveMediaAccess(req, row)) return res.status(403).json({ error: 'Private media' })
  res.sendFile(path.join(UPLOAD_DIR, filename))
})

app.patch('/api/me', requireAuth, (req, res) => {
  const { displayName, bio, lookingFor, lookingNote, mapVisible, avatarUrl, lat, lng } = req.body ?? {}
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as Record<string, unknown>
  const premium = isPremium(row)

  const wantsEncounterPost =
    lookingFor !== undefined || lookingNote !== undefined || mapVisible === true
  if (wantsEncounterPost && !premium) {
    return res.status(402).json({
      error: 'Premium ($9.99/mo) unlocks “right now” posts and appearing for casual encounters',
      code: 'PREMIUM_REQUIRED',
    })
  }

  const nextLat =
    lat === null ? null : typeof lat === 'number' && Number.isFinite(lat) ? lat : row.lat
  const nextLng =
    lng === null ? null : typeof lng === 'number' && Number.isFinite(lng) ? lng : row.lng

  const nextLooking = lookingFor === undefined ? row.looking_for : String(lookingFor).slice(0, 40)
  const nextNote =
    lookingNote === undefined ? row.looking_note || '' : String(lookingNote).slice(0, 140)
  const lookingChanged =
    lookingFor !== undefined || lookingNote !== undefined || mapVisible === true
  const postedAt = lookingChanged ? new Date().toISOString() : row.looking_posted_at

  db.prepare(
    `UPDATE users SET
      display_name = ?,
      bio = ?,
      looking_for = ?,
      looking_note = ?,
      looking_posted_at = ?,
      map_visible = ?,
      avatar_url = ?,
      lat = ?,
      lng = ?,
      last_seen_at = ?
     WHERE id = ?`,
  ).run(
    displayName ?? row.display_name,
    bio ?? row.bio,
    nextLooking,
    nextNote,
    postedAt,
    mapVisible === undefined ? row.map_visible : mapVisible ? 1 : 0,
    avatarUrl ?? row.avatar_url,
    nextLat,
    nextLng,
    new Date().toISOString(),
    req.user!.id,
  )
  const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as Record<string, unknown>
  res.json({ user: publicUser(updated) })
})

app.get('/api/admin/media/:filename', requireAdmin, (req, res) => {
  const filename = path.basename(req.params.filename)
  res.sendFile(path.join(UPLOAD_DIR, filename))
})

const distDir = path.resolve(__dirname, '../../dist')
app.use(express.static(distDir))
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Frontend not built yet. Run npm run build.' })
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ember] API listening on http://0.0.0.0:${PORT}`)
})
