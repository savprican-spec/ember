import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import { nearbyPeople, type NearbyPerson } from '../data/people'
import { LOOKING_FILTERS, LOOKING_HINTS, LOOKING_OPTIONS, type LookingOption } from '../data/looking'
import { Flame, MessageCircle, UserPlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api, track, type EmberUser } from '../lib/api'

function avatarIcon(url: string, online: boolean, rightNow?: boolean) {
  return L.divIcon({
    className: 'ember-marker',
    html: `<div class="ember-marker__wrap ${online ? 'is-online' : ''} ${rightNow ? 'is-right-now' : ''}"><img src="${url}" alt="" /></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24],
  })
}

type MapPerson = NearbyPerson & {
  premium?: boolean
  isLive?: boolean
  rightNow?: boolean
  lookingPostedAt?: string | null
}

export function MapPage() {
  const { user, refresh } = useAuth()
  const [filter, setFilter] = useState<(typeof LOOKING_FILTERS)[number]>('All')
  const [livePeople, setLivePeople] = useState<MapPerson[]>([])
  const [selected, setSelected] = useState<MapPerson | null>(null)
  const [followBusy, setFollowBusy] = useState<string | null>(null)
  const [looking, setLooking] = useState<LookingOption>('Right now')
  const [note, setNote] = useState('')
  const [pulseBusy, setPulseBusy] = useState(false)
  const [pulseMsg, setPulseMsg] = useState('')

  async function loadNearby() {
    try {
      const d = await api<{ people: Array<Record<string, unknown>> }>('/api/map/nearby')
      const mapped: MapPerson[] = (d.people || []).map((p) => ({
        id: String(p.id),
        name: String(p.name),
        age: Number(p.age) || 21,
        looking: String(p.looking || 'Right now'),
        note: String(p.note || ''),
        avatar: String(p.avatar),
        lat: Number(p.lat),
        lng: Number(p.lng),
        status: (p.status === 'online' || p.status === 'just-now' ? p.status : 'away') as NearbyPerson['status'],
        distance: String(p.distance || 'nearby'),
        tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
        premium: Boolean(p.premium),
        isLive: true,
        rightNow: Boolean(p.rightNow),
        lookingPostedAt: (p.lookingPostedAt as string | null) || null,
      }))
      setLivePeople(mapped)
      if (mapped[0]) setSelected(mapped[0])
    } catch {
      setLivePeople([])
      setSelected(nearbyPeople[0])
    }
  }

  useEffect(() => {
    void loadNearby()
    track('map_view')
  }, [])

  useEffect(() => {
    if (!user?.premium) return
    setLooking((user.lookingFor as LookingOption) || 'Right now')
    setNote(user.lookingNote || '')
  }, [user])

  const people = useMemo((): MapPerson[] => {
    const source: MapPerson[] =
      livePeople.length > 0 ? livePeople : nearbyPeople.map((p) => ({ ...p, isLive: false, rightNow: p.looking === 'Right now' }))
    if (filter === 'All') return source
    return source.filter((p) => p.looking === filter)
  }, [filter, livePeople])

  const center: [number, number] = [37.7849, -122.4094]

  async function followPerson(id: string) {
    if (!user) return
    setFollowBusy(id)
    try {
      await api(`/api/follows/${id}`, { method: 'POST' })
      track('follow', 'user', id)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Follow failed')
    } finally {
      setFollowBusy(null)
    }
  }

  async function postPulse() {
    if (!user?.premium) return
    setPulseBusy(true)
    setPulseMsg('')
    try {
      const data = await api<{ user: EmberUser }>('/api/map/pulse', {
        method: 'POST',
        body: JSON.stringify({ lookingFor: looking, lookingNote: note, mapVisible: true }),
      })
      await refresh()
      setPulseMsg(data.user.mapVisible ? 'You’re live for casual encounters nearby.' : 'Posted.')
      track('encounter_pulse', 'user', user.id, { lookingFor: looking })
      await loadNearby()
    } catch (err) {
      setPulseMsg(err instanceof Error ? err.message : 'Could not post')
    } finally {
      setPulseBusy(false)
    }
  }

  return (
    <div className="map-page">
      <header className="map-page__header">
        <div>
          <p className="brand brand--sm">EMBER</p>
          <h1>Nearby now</h1>
        </div>
        {user?.premium ? (
          <span className="ghost-chip">
            <Flame size={16} />
            {user.mapVisible ? 'Live' : 'Hidden'}
          </span>
        ) : (
          <Link to={user ? '/premium' : '/auth'} className="ghost-chip">
            Go live — $9.99/mo
          </Link>
        )}
      </header>

      <p className="map-encounter-tagline">
        Casual encounters only — not dating. Pins are approximate for safety. Exact location is shared only
        if both of you agree to meet in chat. Browse free; go live with Premium.
      </p>

      {user?.premium ? (
        <section className="pulse-composer">
          <div className="pulse-composer__top">
            <strong>Post right now</strong>
            <span>{LOOKING_HINTS[looking]}</span>
          </div>
          <div className="filter-row pulse-composer__intents" role="tablist" aria-label="What you want">
            {LOOKING_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={looking === f}
                className={`filter-chip ${looking === f ? 'is-active' : ''}`}
                onClick={() => setLooking(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <label className="field">
            <span>What you’re looking for</span>
            <textarea
              rows={2}
              maxLength={140}
              value={note}
              placeholder="Be direct — e.g. discreet car meet, hosting now, oral only…"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn--primary" disabled={pulseBusy} onClick={() => void postPulse()}>
            {pulseBusy ? 'Posting…' : 'Go live on map'}
          </button>
          <p className="form-hint">
            Your pin shows a nearby area only. Exact GPS can be shared later in chat if both agree to meet.
          </p>
          {pulseMsg && <p className="form-hint">{pulseMsg}</p>}
        </section>
      ) : (
        <p className="form-hint map-upsell">
          Want to post “right now” and show up for a meet?{' '}
          <Link to={user ? '/premium' : '/auth'}>Unlock Premium encounters</Link>
        </p>
      )}

      <div className="filter-row" role="tablist" aria-label="Filter nearby">
        {LOOKING_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`filter-chip ${filter === f ? 'is-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="map-shell">
        <MapContainer center={center} zoom={13} className="map-canvas" zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <CircleMarker
            center={center}
            radius={10}
            pathOptions={{ color: '#FF4D2E', fillColor: '#FF4D2E', fillOpacity: 0.35, weight: 2 }}
          />
          {people.map((person) => (
            <Marker
              key={person.id}
              position={[person.lat, person.lng]}
              icon={avatarIcon(person.avatar, person.status === 'online', person.rightNow)}
              eventHandlers={{ click: () => setSelected(person) }}
            >
              <Popup>
                <strong>{person.name}</strong>, {person.age}
                <br />
                {person.looking}
                <br />
                {person.note}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="nearby-sheet">
        <div className="nearby-sheet__handle" aria-hidden />
        <p className="nearby-sheet__count">
          {people.length} nearby
          {livePeople.length === 0 ? ' · demo until people go live' : ' · live encounter posts'}
        </p>
        <div className="nearby-list">
          {people.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`nearby-card ${selected?.id === person.id ? 'is-selected' : ''}`}
              onClick={() => setSelected(person)}
            >
              <img src={person.avatar} alt="" className="avatar avatar--lg" />
              <div className="nearby-card__body">
                <div className="nearby-card__top">
                  <strong>
                    {person.name}, {person.age}
                  </strong>
                  <span className={`status status--${person.status}`}>
                    {person.rightNow || person.looking === 'Right now' ? 'right now' : person.status.replace('-', ' ')}
                  </span>
                </div>
                <p>{person.note}</p>
                <div className="tag-row">
                  <span className="tag">{person.looking}</span>
                  <span className="tag muted">{person.distance}</span>
                </div>
                {person.isLive && user && (
                  <span
                    className="ghost-chip"
                    style={{ marginTop: 6, display: 'inline-flex', gap: 4 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      void followPerson(person.id)
                    }}
                  >
                    <UserPlus size={14} />
                    {followBusy === person.id ? '…' : 'Add'}
                  </span>
                )}
              </div>
              <Link
                to={user ? '/messages' : '/auth'}
                className="nearby-card__msg"
                aria-label="Message"
                onClick={(e) => e.stopPropagation()}
              >
                <MessageCircle size={18} />
              </Link>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
