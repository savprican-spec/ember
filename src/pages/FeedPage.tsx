import { useCallback, useEffect, useRef, useState } from 'react'
import { clips } from '../data/videos'
import { VideoCard } from '../components/VideoCard'

export function FeedPage() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)

  const syncActive = useCallback(() => {
    const root = scrollerRef.current
    if (!root) return
    const h = root.clientHeight || 1
    const idx = Math.round(root.scrollTop / h)
    setActiveIndex(Math.min(Math.max(idx, 0), clips.length - 1))
  }, [])

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
        <span className="feed-page__mode">For You</span>
      </div>
      <div className="feed-scroller" ref={scrollerRef}>
        {clips.map((clip, i) => (
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
