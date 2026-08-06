# EMBER

Adults-only web app: TikTok-style vertical clip feed + Sniffies-style map for casual meetups.

## Features

- **18+ age gate** before entry
- **For You feed** — full-bleed vertical swipe clips with likes, captions, distance, and looking-for status
- **Nearby map** — dark map with live-style pins, filters (Right now / Hosting / Car / Tonight), and nearby sheet
- **Inbox** — direct threads for arranging meetups
- **Profile** — map visibility, looking-for status, clip grid

Demo media is atmospheric stock footage (not real NSFW). Swap `videoUrl` values in `src/data/videos.ts` for your hosted clips.

## Run

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

Built with Vite, React, TypeScript, React Router, Leaflet.
