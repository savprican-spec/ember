# EMBER

Adults-only web app: TikTok-style vertical clip feed + Sniffies-style map for casual meetups.

**Repo:** https://github.com/savprican-spec/ember  
**Static demo:** https://savprican-spec.github.io/ember/  
**Launch guide:** see [LAUNCH.md](./LAUNCH.md)

## Features

- **18+ age gate** before entry
- **For You feed** — full-bleed vertical swipe clips
- **Nearby map** — dark map with meetup-style pins
- **Inbox** — direct threads
- **Auth + uploads** — register, public/private albums
- **Admin hub** (`/#/admin`) — new users, profiles, all uploads (including private), activity

## Run full stack (API + web)

```bash
npm install
npm run dev
```

- App: http://127.0.0.1:5173/
- Admin: http://127.0.0.1:5173/#/admin  
  Default: `admin@ember.app` / `ember-admin-change-me`

```bash
npm run build
npm start
```

Demo media in the feed is atmospheric stock footage. User uploads are stored by the API.
