import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import { lookingFilters, nearbyPeople, type NearbyPerson } from '../data/people'
import { MessageCircle, Navigation, UserPlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api, track } from '../lib/api'

function avatarIcon(url: string, online: boolean) {
  return L.divIcon({
    className: 'ember-marker',
    html: `<div class="ember-marker__wrap ${online ? 'is-online' : ''}"><img src="${url}" alt="" /></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24],
  })
}

type MapPerson = NearbyPerson & { premium?: boolean; isLive?: boolean }

export function MapPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<(typeof lookingFilters)[number]>('All')
  const [livePeople, setLivePeople] = useState<MapPerson[]>([])
  const [selected, setSelected] = useState<MapPerson | null>(null)
  const [followBusy, setFollowBusy] = useState<string | null>(null)

  useEffect(() => {
    api<{ people: Array<Record<string, unknown>> }>('/api/map/nearby')
      .then((d) => {
        const mapped: MapPerson[] = (d.people || []).map((p) => ({
          id: String(p.id),
          name: String(p.name),
          age: Number(p.age) || 21,
          looking: String(p.looking || 'Tonight'),
          note: String(p.note || ''),
          avatar: String(p.avatar),
          lat: Number(p.lat),
          lng: Number(p.lng),
          status: (p.status === 'online' ? 'online' : 'away') as NearbyPerson['status'],
          distance: String(p.distance || 'nearby'),
          tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
          premium: Boolean(p.premium),
          isLive: true,
        }))
        setLivePeople(mapped)
        if (mapped[0]) setSelected(mapped[0])
      })
      .catch(() => {
        setLivePeople([])
        setSelected(nearbyPeople[0])
      })
    track('map_view')
  }, [])

  const people = useMemo(() => {
    const source = livePeople.length > 0 ? livePeople : nearbyPeople.map((p) => ({ ...p, isLive: false }))
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

  return (
    <div className="map-page">
      <header className="map-page__header">
        <div>
          <p className="brand brand--sm">EMBER</p>
          <h1>Nearby heat</h1>
        </div>
        {user?.premium ? (
          <Link to="/profile" className="ghost-chip">
            <Navigation size={16} />
            {user.mapVisible ? 'Visible' : 'Hidden'}
          </Link>
        ) : (
          <Link to={user ? '/premium' : '/auth'} className="ghost-chip">
            Appear — $9.99/mo
          </Link>
        )}
      </header>

      <div className="filter-row" role="tablist" aria-label="Looking for">
        {lookingFilters.map((f) => (
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

      {!user?.premium && (
        <p className="form-hint" style={{ margin: '0 1rem 0.5rem' }}>
          Browse free. Pins are Premium members who chose to appear. Want to show up for meetups?{' '}
          <Link to={user ? '/premium' : '/auth'}>Go Premium</Link>
        </p>
      )}

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
              icon={avatarIcon(person.avatar, person.status === 'online')}
              eventHandlers={{ click: () => setSelected(person) }}
            >
              <Popup>
                <strong>{person.name}</strong>, {person.age}
                <br />
                {person.looking}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="nearby-sheet">
        <div className="nearby-sheet__handle" aria-hidden />
        <p className="nearby-sheet__count">
          {people.length} people nearby
          {livePeople.length === 0 ? ' · demo pins until Premium members go live' : ''}
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
                  <span className={`status status--${person.status}`}>{person.status.replace('-', ' ')}</span>
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
                    {followBusy === person.id ? '…' : 'Follow'}
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
