import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { db } from './db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'ember-dev-secret-change-in-production'

export type AuthUser = {
  id: string
  email: string
  display_name: string
  handle: string
  role: 'user' | 'admin'
  age_verified?: boolean
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      handle: user.handle,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '14d' },
  )
}

function loadUser(id: string): AuthUser | undefined {
  const row = db
    .prepare(`SELECT id, email, display_name, handle, role, age_verified FROM users WHERE id = ?`)
    .get(id) as (AuthUser & { age_verified: number }) | undefined
  if (!row) return undefined
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    handle: row.handle,
    role: row.role,
    age_verified: Boolean(row.age_verified) || row.role === 'admin',
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in required' })
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser
    const row = loadUser(payload.id)
    if (!row) return res.status(401).json({ error: 'Account not found' })
    req.user = row
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }
}

export function requireVerified(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role === 'admin' || req.user?.age_verified) return next()
    return res.status(402).json({
      error: 'Age verification payment required',
      code: 'AGE_VERIFY_REQUIRED',
    })
  })
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' })
    }
    next()
  })
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser
      const row = loadUser(payload.id)
      if (row) req.user = row
    } catch {
      /* ignore */
    }
  }
  next()
}
