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
    { id: user.id, email: user.email, display_name: user.display_name, handle: user.handle, role: user.role },
    JWT_SECRET,
    { expiresIn: '14d' },
  )
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in required' })
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser
    const row = db.prepare(`SELECT id, email, display_name, handle, role FROM users WHERE id = ?`).get(payload.id) as
      | AuthUser
      | undefined
    if (!row) return res.status(401).json({ error: 'Account not found' })
    req.user = row
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }
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
      const row = db.prepare(`SELECT id, email, display_name, handle, role FROM users WHERE id = ?`).get(payload.id) as
        | AuthUser
        | undefined
      if (row) req.user = row
    } catch {
      /* ignore */
    }
  }
  next()
}
