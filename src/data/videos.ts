export type VideoClip = {
  id: string
  userId?: string
  username: string
  handle: string
  caption: string
  tags: string[]
  likes: number
  comments: number
  distance: string
  online: boolean
  looking: string
  /** Demo footage — replace with hosted NSFW clips in production */
  videoUrl: string
  poster: string
  avatar: string
}

export const clips: VideoClip[] = [
  {
    id: '1',
    username: 'Kai',
    handle: '@kai.after',
    caption: 'Hotel lobby energy. Who’s free in the next hour?',
    tags: ['tonight', 'hotel', 'discreet'],
    likes: 842,
    comments: 312,
    distance: '0.4 mi',
    online: true,
    looking: 'Right now',
    videoUrl: '/clips/clip1.mp4',
    poster: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80&auto=format',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop',
  },
  {
    id: '2',
    username: 'Nova',
    handle: '@nova.heat',
    caption: 'Late shift ended. Looking for something loud and careless.',
    tags: ['nsfw', 'now', 'hosting'],
    likes: 9021,
    comments: 188,
    distance: '1.2 mi',
    online: true,
    looking: 'Hosting',
    videoUrl: '/clips/clip2.mp4',
    poster: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80&auto=format',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop',
  },
  {
    id: '3',
    username: 'Ash',
    handle: '@ash.cruz',
    caption: 'Rooftop after midnight. Bring your worst ideas.',
    tags: ['cruising', 'rooftop', '18+'],
    likes: 15402,
    comments: 421,
    distance: '2.1 mi',
    online: false,
    looking: 'Traveling',
    videoUrl: '/clips/clip3.mp4',
    poster: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80&auto=format',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop',
  },
  {
    id: '4',
    username: 'Rae',
    handle: '@rae.pulse',
    caption: 'Car meets only. No small talk. Just heat.',
    tags: ['car', 'quick', 'discrete'],
    likes: 6733,
    comments: 97,
    distance: '0.8 mi',
    online: true,
    looking: 'Car',
    videoUrl: '/clips/clip4.mp4',
    poster: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80&auto=format',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop',
  },
  {
    id: '5',
    username: 'Jules',
    handle: '@jules.ember',
    caption: 'Studio lights still warm. Who wants a private screening?',
    tags: ['private', 'clips', 'meetup'],
    likes: 22109,
    comments: 640,
    distance: '3.4 mi',
    online: true,
    looking: 'Tonight',
    videoUrl: '/clips/clip5.mp4',
    poster: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80&auto=format',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&h=120&fit=crop',
  },
  {
    id: '6',
    username: 'Dex',
    handle: '@dex.night',
    caption: 'Gym locker vibes. Sweaty, quiet, available.',
    tags: ['gym', 'now', 'nsfw'],
    likes: 11002,
    comments: 256,
    distance: '0.6 mi',
    online: true,
    looking: 'Right now',
    videoUrl: '/clips/clip6.mp4',
    poster: 'https://images.unsplash.com/photo-1583454110551-21c2be3449f1?w=800&q=80&auto=format',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop',
  },
]

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.floor(n / 100) / 10}K`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
