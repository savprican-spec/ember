import { useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import L from 'leaflet'
import { lookingFilters, nearbyPeople, type NearbyPerson } from '../data/people'
import { MessageCircle, Navigation } from 'lucide-react'

function avatarIcon(url: string, online: boolean) {
  return L.divIcon({
    className: 'ember-marker',
    html: `<div class="ember-marker__wrap ${online ? 'is-online' : ''}"><img src="${url}" alt="" /></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24],
  })
}

export function MapPage() {
  const [filter, setFilter] = useState<(typeof lookingFilters)[number]>('All')
  const [selected, setSelected] = useState<NearbyPerson | null>(nearbyPeople[0])

  const people = useMemo(() => {
    if (filter === 'All') return nearbyPeople
    return nearbyPeople.filter((p) => p.looking === filter)
  }, [filter])

  const center: [number, number] = [37.7849, -122.4094]

  return (
    <div className="map-page">
      <header className="map-page__header">
        <div>
          <p className="brand brand--sm">EMBER</p>
          <h1>Nearby heat</h1>
        </div>
        <button type="button" className="ghost-chip" aria-label="Recenter">
          <Navigation size={16} />
          SF
        </button>
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
        <p className="nearby-sheet__count">{people.length} people nearby</p>
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
              </div>
              <span className="nearby-card__msg" aria-hidden>
                <MessageCircle size={18} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
