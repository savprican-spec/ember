export type NearbyPerson = {
  id: string
  name: string
  age: number
  distance: string
  looking: string
  status: 'online' | 'away' | 'just-now'
  note: string
  lat: number
  lng: number
  avatar: string
  tags: string[]
}

/** Demo pins around downtown SF — swap for live geolocation in production */
export const nearbyPeople: NearbyPerson[] = [
  {
    id: 'p1',
    name: 'Kai',
    age: 28,
    distance: '0.4 mi',
    looking: 'Right now',
    status: 'online',
    note: 'Hotel near Market. Discrete.',
    lat: 37.7892,
    lng: -122.409,
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop',
    tags: ['hosting', 'tonight'],
  },
  {
    id: 'p2',
    name: 'Nova',
    age: 26,
    distance: '1.2 mi',
    looking: 'Hosting',
    status: 'online',
    note: 'Bring wine. No drama.',
    lat: 37.7765,
    lng: -122.424,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop',
    tags: ['hosting', 'nsfw'],
  },
  {
    id: 'p3',
    name: 'Ash',
    age: 31,
    distance: '2.1 mi',
    looking: 'Traveling',
    status: 'away',
    note: 'Passing through till 2am.',
    lat: 37.802,
    lng: -122.419,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop',
    tags: ['cruising'],
  },
  {
    id: 'p4',
    name: 'Rae',
    age: 24,
    distance: '0.8 mi',
    looking: 'Car',
    status: 'just-now',
    note: 'Parked by the pier.',
    lat: 37.808,
    lng: -122.41,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop',
    tags: ['car', 'quick'],
  },
  {
    id: 'p5',
    name: 'Jules',
    age: 29,
    distance: '3.4 mi',
    looking: 'Tonight',
    status: 'online',
    note: 'Studio open after 11.',
    lat: 37.76,
    lng: -122.435,
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&h=120&fit=crop',
    tags: ['private'],
  },
  {
    id: 'p6',
    name: 'Dex',
    age: 33,
    distance: '0.6 mi',
    looking: 'Right now',
    status: 'online',
    note: 'Gym baths. Now.',
    lat: 37.784,
    lng: -122.401,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop',
    tags: ['gym', 'now'],
  },
  {
    id: 'p7',
    name: 'Mila',
    age: 27,
    distance: '1.7 mi',
    looking: 'Traveling',
    status: 'just-now',
    note: 'Bar crawl ending soon.',
    lat: 37.771,
    lng: -122.412,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop',
    tags: ['bars', 'tonight'],
  },
]

export const lookingFilters = ['All', 'Right now', 'Hosting', 'Traveling', 'Car', 'Tonight'] as const
