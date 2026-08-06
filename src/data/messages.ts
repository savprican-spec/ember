export type ChatMessage = {
  id: string
  from: 'them' | 'me'
  text: string
  time: string
}

export type Conversation = {
  id: string
  name: string
  avatar: string
  preview: string
  time: string
  unread: number
  online: boolean
  messages: ChatMessage[]
}

export const conversations: Conversation[] = [
  {
    id: 'c1',
    name: 'Kai',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop',
    preview: 'Room 1408. Text when you’re downstairs.',
    time: '2m',
    unread: 2,
    online: true,
    messages: [
      { id: 'm1', from: 'them', text: 'Saw your clip. You free?', time: '11:02' },
      { id: 'm2', from: 'me', text: 'Depends. Where?', time: '11:04' },
      { id: 'm3', from: 'them', text: 'Hotel near Market. Discrete.', time: '11:05' },
      { id: 'm4', from: 'them', text: 'Room 1408. Text when you’re downstairs.', time: '11:06' },
    ],
  },
  {
    id: 'c2',
    name: 'Nova',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop',
    preview: 'Bring whatever you’re drinking.',
    time: '18m',
    unread: 0,
    online: true,
    messages: [
      { id: 'm1', from: 'me', text: 'Your feed is dangerous.', time: '10:20' },
      { id: 'm2', from: 'them', text: 'Good. Come over then.', time: '10:22' },
      { id: 'm3', from: 'them', text: 'Bring whatever you’re drinking.', time: '10:23' },
    ],
  },
  {
    id: 'c3',
    name: 'Rae',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop',
    preview: 'Still parked by the pier.',
    time: '1h',
    unread: 1,
    online: false,
    messages: [
      { id: 'm1', from: 'them', text: 'Car meets only tonight.', time: '9:40' },
      { id: 'm2', from: 'me', text: 'I’m close.', time: '9:41' },
      { id: 'm3', from: 'them', text: 'Still parked by the pier.', time: '9:42' },
    ],
  },
  {
    id: 'c4',
    name: 'Dex',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop',
    preview: 'Locker room empty in 10.',
    time: '3h',
    unread: 0,
    online: true,
    messages: [
      { id: 'm1', from: 'them', text: 'You at the gym?', time: '7:10' },
      { id: 'm2', from: 'me', text: 'Heading there.', time: '7:12' },
      { id: 'm3', from: 'them', text: 'Locker room empty in 10.', time: '7:15' },
    ],
  },
]
