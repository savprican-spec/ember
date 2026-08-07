# EMBER launch checklist

GitHub Pages can only host the static demo. A public launch with registration, uploads, and an admin hub needs a real server.

## What’s already built

- User registration / login (18+)
- Clip uploads with **public** or **private** visibility
- Interaction events (page views, likes, logins, uploads)
- **Admin hub** at `/#/admin`
  - New users
  - Profiles
  - All uploads including private albums
  - Activity feed

Default admin (change immediately in production):

- Email: `admin@ember.app`
- Password: `ember-admin-change-me`

Override with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and set a strong `JWT_SECRET`.

## Run locally (full stack)

```bash
npm install
npm run dev
```

- App: http://127.0.0.1:5173/
- API: http://127.0.0.1:8787/api/health
- Admin: http://127.0.0.1:5173/#/admin

## To launch publicly

1. **Host on an adult-friendly VPS** (Railway / Fly.io / Render / DigitalOcean / Hetzner). Many “app platforms” restrict NSFW.
2. **Put Postgres + object storage behind the API** before real traffic (SQLite + local disk is fine for a private beta only). Prefer Cloudflare R2 or S3 for media.
3. **Custom domain + HTTPS**, env secrets for `JWT_SECRET`, admin credentials, DB URL, storage keys.
4. **Stronger age assurance** than a checkbox if you operate in strict regions (vendor KYC / ID age checks).
5. **Legal pages**: Terms, Privacy, Community Guidelines, and US **2257** compliance process if you host sexual content involving performers.
6. **Moderation**: report button, ban/suspend in admin, malware scanning on uploads, rate limits.
7. **Observability**: keep using `/api/events` + add product analytics (PostHog/Mixpanel) if you want funnels.
8. **Backups** for DB + media.

## Can you launch on Cloudflare?

**Partially — not the whole app on Cloudflare alone.**

| Piece | Cloudflare fit |
| --- | --- |
| DNS + CDN + DDoS in front of your server | Yes — good idea |
| **R2** media storage | Yes — recommended for uploads |
| **Pages** (static site only) | Only the demo UI — **no** registration/uploads/admin API |
| **Workers** as the full backend | Not with this code as-is (needs rewrite; no native SQLite/disk uploads) |

**Recommended Cloudflare-friendly launch shape:**

1. Run this Node API on a small VPS (Hetzner, DigitalOcean, Fly.io, Railway).
2. Point your domain through **Cloudflare DNS/proxy**.
3. Store clips in **Cloudflare R2** (next upgrade from local disk).
4. Keep legal adult content only (Cloudflare focuses enforcement on illegal/harmful content; still read their current AUP).

GitHub Pages remains fine for the static marketing/demo build, not for the live product.
