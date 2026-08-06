import { useEffect, useRef, useState } from 'react'
import { Heart, MessageCircle, Share2, Volume2, VolumeX, MapPin } from 'lucide-react'
import type { VideoClip } from '../data/videos'
import { formatCount } from '../data/videos'

type VideoCardProps = {
  clip: VideoClip
  active: boolean
  muted: boolean
  onToggleMute: () => void
}

export function VideoCard({ clip, active, muted, onToggleMute }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(clip.likes)
  const [failed, setFailed] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.muted = muted
    if (active && !paused) {
      const play = el.play()
      if (play) play.catch(() => undefined)
    } else {
      el.pause()
      if (!active) {
        el.currentTime = 0
        setPaused(false)
      }
    }
  }, [active, muted, paused])

function toggleLike() {
  setLiked((wasLiked) => {
    const next = !wasLiked
    setLikes((n) => n + (next ? 1 : -1))
    return next
  })
}

  function togglePause() {
    setPaused((p) => !p)
  }

  return (
    <article className={`video-card ${active ? 'is-active' : ''}`}>
      {!failed ? (
        <video
          ref={videoRef}
          className="video-card__media"
          src={clip.videoUrl}
          poster={clip.poster}
          playsInline
          loop
          muted={muted}
          preload={active ? 'auto' : 'metadata'}
          onClick={togglePause}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="video-card__fallback"
          style={{ backgroundImage: `url(${clip.poster})` }}
          role="img"
          aria-label={`${clip.username} clip poster`}
          onClick={togglePause}
        />
      )}
      {paused && active && <div className="video-card__paused">Paused</div>}

      <div className="video-card__scrim" aria-hidden />

      <header className="video-card__top">
        <span className="badge badge--nsfw">18+</span>
        {clip.online && <span className="badge badge--live">Live nearby</span>}
      </header>

      <aside className="video-card__rail" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="rail-btn"
          onClick={(e) => {
            e.stopPropagation()
            toggleLike()
          }}
          aria-label="Like"
        >
          <Heart size={28} fill={liked ? 'currentColor' : 'none'} className={liked ? 'is-liked' : ''} />
          <span>{formatCount(likes)}</span>
        </button>
        <button type="button" className="rail-btn" aria-label="Comments" onClick={(e) => e.stopPropagation()}>
          <MessageCircle size={28} />
          <span>{formatCount(clip.comments)}</span>
        </button>
        <button type="button" className="rail-btn" aria-label="Share" onClick={(e) => e.stopPropagation()}>
          <Share2 size={26} />
          <span>Share</span>
        </button>
        <button
          type="button"
          className="rail-btn"
          onClick={(e) => {
            e.stopPropagation()
            onToggleMute()
          }}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </button>
      </aside>

      <footer className="video-card__meta">
        <div className="video-card__user">
          <img src={clip.avatar} alt="" className="avatar" />
          <div>
            <p className="video-card__name">
              {clip.username} <span>{clip.handle}</span>
            </p>
            <p className="video-card__looking">
              <MapPin size={12} /> {clip.distance} · {clip.looking}
            </p>
          </div>
        </div>
        <p className="video-card__caption">{clip.caption}</p>
        <div className="tag-row">
          {clip.tags.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
            </span>
          ))}
        </div>
      </footer>
    </article>
  )
}
