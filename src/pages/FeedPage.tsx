import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clips, type VideoClip } from '../data/videos'
import { VideoCard } from '../components/VideoCard'
import { api, mediaUrl } from '../lib/api'

export function FeedPage() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const [liveClips, setLiveClips] = useState<VideoClip[]>([])

  useEffect(() => {
    api<{
      uploads: Array<{
        id: string
        caption: string
        title: string
        mediaType: string
        url: string
        user: { id: string; displayName: string; handle: string; avatarUrl: string; lookingFor: string }
      }>
    }>('/api/uploads/feed')
      .then((d) => {
        const mapped: VideoClip[] = (d.uploads || []).map((u) => ({
          id: u.id,
          userId: u.user.id,
          username: u.user.displayName,
          handle: `@${u.user.handle}`,
          caption: u.caption || u.title || 'Uploaded to Ember',
          tags: ['upload', 'nsfw'],
          likes: 0,
          comments: 0,
          distance: 'near you',
          online: true,
          looking: u.user.lookingFor || 'Tonight',
          videoUrl: mediaUrl(u.url),
          poster: mediaUrl(u.url),
          avatar:
            u.user.avatarUrl ||
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop',
        }))
        setLiveClips(mapped)
      })
      .catch(() => undefined)
  }, [])

  const feed = useMemo(() => [...liveClips, ...clips], [liveClips])

  const syncActive = useCallback(() => {
    const root = scrollerRef.current
    if (!root) return
    const h = root.clientHeight || 1
    const idx = Math.round(root.scrollTop / h)
    setActiveIndex(Math.min(Math.max(idx, 0), Math.max(feed.length - 1, 0)))
  }, [feed.length])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    syncActive()
    root.addEventListener('scroll', syncActive, { passive: true })
    return () => root.removeEventListener('scroll', syncActive)
  }, [syncActive])

  return (
    <div className="feed-page">
      <div className="feed-page__brand">
        <span className="brand">EMBER</span>
        <span className="feed-page__mode">For You · free</span>
      </div>
      <div className="feed-scroller" ref={scrollerRef}>
        {feed.map((clip, i) => (
          <div className="feed-slide" key={clip.id}>
            <VideoCard
              clip={clip}
              active={i === activeIndex}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
