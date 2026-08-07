import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { ageFromBirthdate, db, markUserVerified, VERIFY_CURRENCY, VERIFY_PRICE_CENTS } from '../db.js'
import { requireAuth } from '../auth.js'

export const verifyRouter = Router()

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key)
}

function appOrigin(req: { headers: Record<string, unknown> }) {
  return (
    process.env.APP_ORIGIN ||
    (typeof req.headers.origin === 'string' ? req.headers.origin : null) ||
    'http://127.0.0.1:5173'
  )
}

function successUrl(origin: string) {
  // HashRouter paths
  return `${origin}/#/verify?status=success&session_id={CHECKOUT_SESSION_ID}`
}

function cancelUrl(origin: string) {
  return `${origin}/#/verify?status=cancel`
}

verifyRouter.get('/config', (_req, res) => {
  res.json({
    priceCents: VERIFY_PRICE_CENTS,
    currency: VERIFY_CURRENCY,
    stripeEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
    allowDevBypass: process.env.VERIFY_ALLOW_DEV === '1' || !process.env.STRIPE_SECRET_KEY,
    label: 'Age verification',
    description:
      'One-time fee confirms you are 18+ via cardholder payment and date-of-birth attestation. Unlocks EMBER.',
  })
})

verifyRouter.post('/checkout', requireAuth, async (req, res) => {
  if (req.user!.role === 'admin') {
    return res.json({ alreadyVerified: true })
  }

  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as Record<string, unknown>
  if (row.age_verified) return res.json({ alreadyVerified: true })

  const birthdate = String(req.body?.birthdate || '')
  const age = ageFromBirthdate(birthdate)
  if (age === null) return res.status(400).json({ error: 'Valid birthdate required (YYYY-MM-DD)' })
  if (age < 18) return res.status(400).json({ error: 'You must be 18 or older to verify' })

  const verificationId = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO verifications (id, user_id, status, birthdate, amount_cents, currency, provider, created_at)
     VALUES (?, ?, 'pending', ?, ?, ?, 'stripe', ?)`,
  ).run(verificationId, req.user!.id, birthdate, VERIFY_PRICE_CENTS, VERIFY_CURRENCY, now)
  db.prepare(`UPDATE users SET birthdate = ? WHERE id = ?`).run(birthdate, req.user!.id)

  const stripe = stripeClient()
  if (!stripe) {
    return res.json({
      mode: 'dev',
      verificationId,
      message: 'Stripe is not configured. Use dev confirm to complete paid verification locally.',
    })
  }

  const origin = appOrigin(req)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: String(row.email),
    client_reference_id: req.user!.id,
    metadata: {
      userId: req.user!.id,
      verificationId,
      birthdate,
      purpose: 'ember_age_verification',
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: VERIFY_CURRENCY,
          unit_amount: VERIFY_PRICE_CENTS,
          product_data: {
            name: 'EMBER Age Verification',
            description: 'One-time 18+ verification fee. Confirms adult access to EMBER.',
          },
        },
      },
    ],
    success_url: successUrl(origin),
    cancel_url: cancelUrl(origin),
  })

  db.prepare(`UPDATE verifications SET stripe_session_id = ? WHERE id = ?`).run(session.id, verificationId)
  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, ?, 'verify_checkout_start', 'verification', ?, ?, ?)`,
  ).run(
    randomUUID(),
    req.user!.id,
    req.headers['x-session-id'] ?? null,
    verificationId,
    JSON.stringify({ amountCents: VERIFY_PRICE_CENTS }),
    now,
  )

  res.json({ mode: 'stripe', url: session.url, sessionId: session.id, verificationId })
})

verifyRouter.post('/confirm', requireAuth, async (req, res) => {
  const sessionId = String(req.body?.sessionId || '')
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

  const stripe = stripeClient()
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured' })

  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.metadata?.userId && session.metadata.userId !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Session does not belong to this user' })
  }
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return res.status(402).json({ error: 'Payment not completed' })
  }

  const userId = session.metadata?.userId || req.user!.id
  const verificationId = session.metadata?.verificationId
  const birthdate = session.metadata?.birthdate
  completeVerification({
    userId,
    verificationId,
    birthdate,
    stripeSessionId: session.id,
    paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
  })

  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as Record<string, unknown>
  res.json({
    verified: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      handle: user.handle,
      age: user.age,
      bio: user.bio,
      avatarUrl: user.avatar_url,
      lookingFor: user.looking_for,
      mapVisible: Boolean(user.map_visible),
      role: user.role,
      ageVerified: Boolean(user.age_verified),
      ageVerifiedAt: user.age_verified_at,
      birthdate: user.birthdate,
      createdAt: user.created_at,
      lastSeenAt: user.last_seen_at,
    },
  })
})

verifyRouter.post('/dev-complete', requireAuth, (req, res) => {
  const allow = process.env.VERIFY_ALLOW_DEV === '1' || !process.env.STRIPE_SECRET_KEY
  if (!allow) return res.status(403).json({ error: 'Dev verification bypass disabled' })

  const birthdate = String(req.body?.birthdate || '')
  const age = ageFromBirthdate(birthdate)
  if (age === null) return res.status(400).json({ error: 'Valid birthdate required (YYYY-MM-DD)' })
  if (age < 18) return res.status(400).json({ error: 'You must be 18 or older to verify' })

  const verificationId = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO verifications (id, user_id, status, birthdate, amount_cents, currency, provider, created_at, completed_at)
     VALUES (?, ?, 'paid', ?, ?, ?, 'dev', ?, ?)`,
  ).run(verificationId, req.user!.id, birthdate, VERIFY_PRICE_CENTS, VERIFY_CURRENCY, now, now)
  markUserVerified(req.user!.id, birthdate)
  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, ?, 'verify_paid_dev', 'verification', ?, ?, ?)`,
  ).run(
    randomUUID(),
    req.user!.id,
    req.headers['x-session-id'] ?? null,
    verificationId,
    JSON.stringify({ amountCents: VERIFY_PRICE_CENTS, mode: 'dev' }),
    now,
  )

  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as Record<string, unknown>
  res.json({
    verified: true,
    mode: 'dev',
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      handle: user.handle,
      age: user.age,
      bio: user.bio,
      avatarUrl: user.avatar_url,
      lookingFor: user.looking_for,
      mapVisible: Boolean(user.map_visible),
      role: user.role,
      ageVerified: Boolean(user.age_verified),
      ageVerifiedAt: user.age_verified_at,
      birthdate: user.birthdate,
      createdAt: user.created_at,
      lastSeenAt: user.last_seen_at,
    },
  })
})

export function completeVerification(input: {
  userId: string
  verificationId?: string | null
  birthdate?: string | null
  stripeSessionId?: string | null
  paymentIntent?: string | null
}) {
  const now = new Date().toISOString()
  if (input.verificationId) {
    db.prepare(
      `UPDATE verifications
       SET status = 'paid', completed_at = ?, stripe_session_id = COALESCE(?, stripe_session_id),
           stripe_payment_intent = COALESCE(?, stripe_payment_intent)
       WHERE id = ?`,
    ).run(now, input.stripeSessionId ?? null, input.paymentIntent ?? null, input.verificationId)
  } else if (input.stripeSessionId) {
    db.prepare(
      `UPDATE verifications
       SET status = 'paid', completed_at = ?, stripe_payment_intent = COALESCE(?, stripe_payment_intent)
       WHERE stripe_session_id = ?`,
    ).run(now, input.paymentIntent ?? null, input.stripeSessionId)
  }
  markUserVerified(input.userId, input.birthdate)
  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, NULL, 'verify_paid', 'user', ?, ?, ?)`,
  ).run(
    randomUUID(),
    input.userId,
    input.userId,
    JSON.stringify({ verificationId: input.verificationId, sessionId: input.stripeSessionId }),
    now,
  )
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
  const stripe = stripeClient()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) throw new Error('Stripe webhook not configured')
  const event = stripe.webhooks.constructEvent(rawBody, signature || '', secret)
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.metadata?.purpose === 'ember_age_verification' && session.metadata.userId) {
      completeVerification({
        userId: session.metadata.userId,
        verificationId: session.metadata.verificationId,
        birthdate: session.metadata.birthdate,
        stripeSessionId: session.id,
        paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      })
    }
  }
  return event
}
