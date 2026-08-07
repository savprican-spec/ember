import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { db, UPLOAD_DIR } from '../db.js'
import { requireAuth } from '../auth.js'

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin'
    cb(null, `${randomUUID()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 120 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^(video|image)\//.test(file.mimetype)) cb(null, true)
    else cb(new Error('Only image or video uploads allowed'))
  },
})

export const uploadsRouter = Router()

uploadsRouter.post('/', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' })
    if (!req.file) return res.status(400).json({ error: 'file required' })
    const { title = '', caption = '', visibility = 'public' } = req.body ?? {}
    const vis = ['public', 'private', 'followers'].includes(visibility) ? visibility : 'public'
    const id = randomUUID()
    const now = new Date().toISOString()
    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image'

    db.prepare(
      `INSERT INTO uploads (id, user_id, title, caption, visibility, media_type, file_path, mime_type, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      req.user!.id,
      String(title).slice(0, 120),
      String(caption).slice(0, 500),
      vis,
      mediaType,
      req.file.filename,
      req.file.mimetype,
      req.file.size,
      now,
    )

    db.prepare(
      `INSERT INTO events (id, user_id, session_id, event_type, target_type, target_id, meta_json, created_at)
       VALUES (?, ?, ?, 'upload', 'upload', ?, ?, ?)`,
    ).run(
      randomUUID(),
      req.user!.id,
      req.headers['x-session-id'] ?? null,
      id,
      JSON.stringify({ visibility: vis, mediaType }),
      now,
    )

    res.status(201).json({
      upload: {
        id,
        title,
        caption,
        visibility: vis,
        mediaType,
        url: `/api/media/${req.file.filename}`,
        createdAt: now,
      },
    })
  })
})

uploadsRouter.get('/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM uploads WHERE user_id = ? ORDER BY created_at DESC`)
    .all(req.user!.id) as Record<string, unknown>[]

  res.json({
    uploads: rows.map((r) => ({
      id: r.id,
      title: r.title,
      caption: r.caption,
      visibility: r.visibility,
      mediaType: r.media_type,
      url: `/api/media/${r.file_path}`,
      createdAt: r.created_at,
    })),
  })
})

uploadsRouter.get('/feed', (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.*, us.display_name, us.handle, us.avatar_url, us.looking_for
       FROM uploads u
       JOIN users us ON us.id = u.user_id
       WHERE u.visibility = 'public'
       ORDER BY u.created_at DESC
       LIMIT 50`,
    )
    .all() as Record<string, unknown>[]

  res.json({
    uploads: rows.map((r) => ({
      id: r.id,
      title: r.title,
      caption: r.caption,
      visibility: r.visibility,
      mediaType: r.media_type,
      url: `/api/media/${r.file_path}`,
      createdAt: r.created_at,
      user: {
        id: r.user_id,
        displayName: r.display_name,
        handle: r.handle,
        avatarUrl: r.avatar_url,
        lookingFor: r.looking_for,
      },
    })),
  })
})
