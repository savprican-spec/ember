import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from '../db.js'
import { mapsLink } from '../geoPrivacy.js'
import { requireAuth } from '../auth.js'

export const meetupsRouter = Router()
meetupsRouter.use(requireAuth)

function isMember(conversationId: string, userId: string) {
  return Boolean(
    db
      .prepare(`SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?`)
      .get(conversationId, userId),
  )
}

function otherMemberId(conversationId: string, me: string) {
  const row = db
    .prepare(
      `SELECT user_id AS id FROM conversation_members WHERE conversation_id = ? AND user_id != ? LIMIT 1`,
    )
    .get(conversationId, me) as { id: string } | undefined
  return row?.id
}

function resolveExact(userId: string, bodyLat?: unknown, bodyLng?: unknown) {
  const lat = Number(bodyLat)
  const lng = Number(bodyLng)
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng }
  }
  const row = db.prepare(`SELECT exact_lat, exact_lng FROM users WHERE id = ?`).get(userId) as
    | { exact_lat: number | null; exact_lng: number | null }
    | undefined
  if (row && typeof row.exact_lat === 'number' && typeof row.exact_lng === 'number') {
    return { lat: row.exact_lat, lng: row.exact_lng }
  }
  return null
}

function mapMeetup(row: Record<string, unknown>, me: string) {
  const status = String(row.status)
  const accepted = status === 'accepted'
  const iAmProposer = row.proposer_id === me
  const myLat = iAmProposer ? row.proposer_lat : row.recipient_lat
  const myLng = iAmProposer ? row.proposer_lng : row.recipient_lng
  const theirLat = iAmProposer ? row.recipient_lat : row.proposer_lat
  const theirLng = iAmProposer ? row.recipient_lng : row.proposer_lng

  return {
    id: row.id,
    conversationId: row.conversation_id,
    status,
    role: iAmProposer ? 'proposer' : 'recipient',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    acceptedAt: row.accepted_at,
    expiresAt: row.expires_at,
    // Exact coords only after both agreed
    exactShared: accepted,
    myExact:
      accepted && typeof myLat === 'number' && typeof myLng === 'number'
        ? { lat: myLat, lng: myLng, mapsUrl: mapsLink(Number(myLat), Number(myLng)) }
        : null,
    theirExact:
      accepted && typeof theirLat === 'number' && typeof theirLng === 'number'
        ? { lat: theirLat, lng: theirLng, mapsUrl: mapsLink(Number(theirLat), Number(theirLng)) }
        : null,
    waitingOnYou: status === 'pending' && row.recipient_id === me,
    waitingOnThem: status === 'pending' && row.proposer_id === me,
  }
}

meetupsRouter.get('/conversation/:conversationId', (req, res) => {
  const me = req.user!.id
  const conversationId = req.params.conversationId
  if (!isMember(conversationId, me)) return res.status(404).json({ error: 'Conversation not found' })

  const row = db
    .prepare(
      `SELECT * FROM meetups
       WHERE conversation_id = ? AND status IN ('pending', 'accepted')
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(conversationId) as Record<string, unknown> | undefined

  res.json({
    meetup: row ? mapMeetup(row, me) : null,
    note: 'Exact location stays private until both of you agree to meet.',
  })
})

meetupsRouter.post('/propose', (req, res) => {
  const me = req.user!.id
  const conversationId = String(req.body?.conversationId || '')
  if (!conversationId || !isMember(conversationId, me)) {
    return res.status(404).json({ error: 'Conversation not found' })
  }

  const peerId = otherMemberId(conversationId, me)
  if (!peerId) return res.status(400).json({ error: 'No peer in conversation' })

  const exact = resolveExact(me, req.body?.lat, req.body?.lng)
  if (!exact) {
    return res.status(400).json({
      error: 'Share your current location to propose a meetup',
      code: 'LOCATION_REQUIRED',
    })
  }

  // One active meetup at a time per conversation
  db.prepare(
    `UPDATE meetups SET status = 'cancelled', updated_at = ? WHERE conversation_id = ? AND status = 'pending'`,
  ).run(new Date().toISOString(), conversationId)

  const id = randomUUID()
  const now = new Date().toISOString()
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString()

  db.prepare(
    `INSERT INTO meetups (
      id, conversation_id, proposer_id, recipient_id, status,
      proposer_lat, proposer_lng, created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
  ).run(id, conversationId, me, peerId, exact.lat, exact.lng, now, now, expires)

  // Persist private exact for future meetups
  db.prepare(`UPDATE users SET exact_lat = ?, exact_lng = ?, last_seen_at = ? WHERE id = ?`).run(
    exact.lat,
    exact.lng,
    now,
    me,
  )

  const systemBody = '📍 Proposed a meetup — exact location unlocks if they accept.'
  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(randomUUID(), conversationId, me, systemBody, now)
  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, conversationId)

  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, ?, 'meetup_propose', 'meetup', ?, '{}', ?)`,
  ).run(randomUUID(), me, req.headers['x-session-id'] ?? null, id, now)

  const row = db.prepare(`SELECT * FROM meetups WHERE id = ?`).get(id) as Record<string, unknown>
  res.status(201).json({ meetup: mapMeetup(row, me) })
})

meetupsRouter.post('/:id/accept', (req, res) => {
  const me = req.user!.id
  const row = db.prepare(`SELECT * FROM meetups WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Meetup not found' })
  if (row.status !== 'pending') return res.status(400).json({ error: 'Meetup is not pending' })
  if (row.recipient_id !== me) return res.status(403).json({ error: 'Only the other person can accept' })
  if (row.expires_at && new Date(String(row.expires_at)).getTime() < Date.now()) {
    db.prepare(`UPDATE meetups SET status = 'expired', updated_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      row.id,
    )
    return res.status(410).json({ error: 'Meetup request expired' })
  }

  const exact = resolveExact(me, req.body?.lat, req.body?.lng)
  if (!exact) {
    return res.status(400).json({
      error: 'Share your current location to accept and unlock exact pins',
      code: 'LOCATION_REQUIRED',
    })
  }

  const now = new Date().toISOString()
  db.prepare(
    `UPDATE meetups SET
      status = 'accepted',
      recipient_lat = ?,
      recipient_lng = ?,
      accepted_at = ?,
      updated_at = ?
     WHERE id = ?`,
  ).run(exact.lat, exact.lng, now, now, row.id)

  db.prepare(`UPDATE users SET exact_lat = ?, exact_lng = ?, last_seen_at = ? WHERE id = ?`).run(
    exact.lat,
    exact.lng,
    now,
    me,
  )

  const systemBody = '✅ Meetup agreed — exact locations are unlocked for both of you.'
  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(randomUUID(), row.conversation_id, me, systemBody, now)
  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, row.conversation_id)

  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, ?, 'meetup_accept', 'meetup', ?, '{}', ?)`,
  ).run(randomUUID(), me, req.headers['x-session-id'] ?? null, row.id, now)

  const updated = db.prepare(`SELECT * FROM meetups WHERE id = ?`).get(row.id) as Record<string, unknown>
  res.json({ meetup: mapMeetup(updated, me) })
})

meetupsRouter.post('/:id/decline', (req, res) => {
  const me = req.user!.id
  const row = db.prepare(`SELECT * FROM meetups WHERE id = ?`).get(req.params.id) as
    | Record<string, unknown>
    | undefined
  if (!row) return res.status(404).json({ error: 'Meetup not found' })
  if (row.status !== 'pending') return res.status(400).json({ error: 'Meetup is not pending' })
  if (row.recipient_id !== me && row.proposer_id !== me) {
    return res.status(403).json({ error: 'Not part of this meetup' })
  }

  const now = new Date().toISOString()
  const status = row.proposer_id === me ? 'cancelled' : 'declined'
  db.prepare(`UPDATE meetups SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, row.id)

  const systemBody =
    status === 'cancelled' ? 'Meetup request cancelled.' : 'Meetup declined — exact location stays private.'
  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(randomUUID(), row.conversation_id, me, systemBody, now)
  db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, row.conversation_id)

  const updated = db.prepare(`SELECT * FROM meetups WHERE id = ?`).get(row.id) as Record<string, unknown>
  res.json({ meetup: mapMeetup(updated, me) })
})
