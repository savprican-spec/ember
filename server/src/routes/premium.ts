import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { clearUserPremium, db, isPremium, markUserPremium, PREMIUM_CURRENCY, PREMIUM_PRICE_CENTS } from '../db.js'
import { requireAuth } from '../auth.js'

export const premiumRouter = Router()

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

function publicUser(row: Record<string, unknown>) {
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
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  }
}

premiumRouter.get('/config', (_req, res) => {
  res.json({
    priceCents: PREMIUM_PRICE_CENTS,
    currency: PREMIUM_CURRENCY,
    interval: 'month',
    stripeEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
    allowDevBypass: process.env.PREMIUM_ALLOW_DEV === '1' || !process.env.STRIPE_SECRET_KEY,
    label: 'Ember Premium',
    description:
      'Free members get the XXX feed, messaging, follows, and can browse the map. Premium ($9.99/mo) lets you appear on the map for meetups and casual encounters.',
  })
})

premiumRouter.post('/checkout', requireAuth, async (req, res) => {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as Record<string, unknown>
  if (isPremium(row)) return res.json({ alreadyPremium: true })

  const stripe = stripeClient()
  const origin = appOrigin(req)

  if (!stripe) {
    return res.json({
      mode: 'dev',
      message: 'Stripe is not configured. Use dev activate for local Premium testing.',
    })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: String(row.email),
    client_reference_id: req.user!.id,
    metadata: {
      userId: req.user!.id,
      purpose: 'ember_premium_map',
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: PREMIUM_CURRENCY,
          unit_amount: PREMIUM_PRICE_CENTS,
          recurring: { interval: 'month' },
          product_data: {
            name: 'EMBER Premium — Map Meetups',
            description: 'Appear on the nearby map for casual meetups. Feed & messaging stay free.',
          },
        },
      },
    ],
    success_url: `${origin}/#/premium?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#/premium?status=cancel`,
  })

  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, ?, 'premium_checkout_start', 'user', ?, ?, ?)`,
  ).run(
    randomUUID(),
    req.user!.id,
    req.headers['x-session-id'] ?? null,
    req.user!.id,
    JSON.stringify({ amountCents: PREMIUM_PRICE_CENTS, interval: 'month' }),
    now,
  )

  res.json({ mode: 'stripe', url: session.url, sessionId: session.id })
})

premiumRouter.post('/confirm', requireAuth, async (req, res) => {
  const sessionId = String(req.body?.sessionId || '')
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
  const stripe = stripeClient()
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured' })

  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })
  if (session.metadata?.userId && session.metadata.userId !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Session does not belong to this user' })
  }
  if (session.status !== 'complete' && session.payment_status !== 'paid') {
    return res.status(402).json({ error: 'Payment not completed' })
  }

  const userId = session.metadata?.userId || req.user!.id
  const sub = session.subscription
  const subId = typeof sub === 'string' ? sub : sub?.id
  const periodEnd =
    typeof sub === 'object' && sub && 'current_period_end' in sub && sub.current_period_end
      ? new Date(Number(sub.current_period_end) * 1000).toISOString()
      : new Date(Date.now() + 1000 * 60 * 60 * 24 * 31).toISOString()

  markUserPremium(userId, periodEnd, subId)
  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, NULL, 'premium_activated', 'user', ?, ?, ?)`,
  ).run(randomUUID(), userId, userId, JSON.stringify({ sessionId, subscriptionId: subId }), new Date().toISOString())

  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as Record<string, unknown>
  res.json({ premium: true, user: publicUser(user) })
})

premiumRouter.post('/dev-activate', requireAuth, (req, res) => {
  const allow = process.env.PREMIUM_ALLOW_DEV === '1' || !process.env.STRIPE_SECRET_KEY
  if (!allow) return res.status(403).json({ error: 'Dev premium bypass disabled' })

  const until = new Date(Date.now() + 1000 * 60 * 60 * 24 * 31).toISOString()
  markUserPremium(req.user!.id, until, 'dev_sub')
  db.prepare(
    `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
     VALUES (?, ?, ?, 'premium_activated_dev', 'user', ?, ?, ?)`,
  ).run(
    randomUUID(),
    req.user!.id,
    req.headers['x-session-id'] ?? null,
    req.user!.id,
    JSON.stringify({ mode: 'dev', until }),
    new Date().toISOString(),
  )

  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as Record<string, unknown>
  res.json({ premium: true, mode: 'dev', user: publicUser(user) })
})

export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
  const stripe = stripeClient()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) throw new Error('Stripe webhook not configured')
  const event = stripe.webhooks.constructEvent(rawBody, signature || '', secret)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.metadata?.purpose === 'ember_premium_map' && session.metadata.userId) {
      const until = new Date(Date.now() + 1000 * 60 * 60 * 24 * 31).toISOString()
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      markUserPremium(session.metadata.userId, until, subId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const row = db
      .prepare(`SELECT id FROM users WHERE stripe_subscription_id = ?`)
      .get(sub.id) as { id: string } | undefined
    if (row) clearUserPremium(row.id)
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const row = db
      .prepare(`SELECT id FROM users WHERE stripe_subscription_id = ?`)
      .get(sub.id) as { id: string } | undefined
    if (row) {
      if (sub.status === 'active' || sub.status === 'trialing') {
        markUserPremium(row.id, new Date(sub.current_period_end * 1000).toISOString(), sub.id)
      } else if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
        clearUserPremium(row.id)
      }
    }
  }

  return event
}
