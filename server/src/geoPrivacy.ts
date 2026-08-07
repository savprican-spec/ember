/**
 * Location privacy helpers.
 * - Map pins are always approximate.
 * - Exact GPS is stored privately and only revealed after both users accept a meetup.
 */

function hashToUnit(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

/** ~250–650m sticky offset, deterministic per user so pins don't jump every refresh */
export function fuzzyCoords(
  lat: number,
  lng: number,
  userId: string,
  minMeters = 250,
  maxMeters = 650,
): { lat: number; lng: number; approximate: true; accuracyMeters: number } {
  const a = hashToUnit(`${userId}:ember-geo-a`)
  const b = hashToUnit(`${userId}:ember-geo-b`)
  const angle = a * Math.PI * 2
  const dist = minMeters + b * (maxMeters - minMeters)
  const metersPerLat = 111_320
  const metersPerLng = Math.max(metersPerLat * Math.cos((lat * Math.PI) / 180), 1)
  const fuzzyLat = lat + (dist * Math.cos(angle)) / metersPerLat
  const fuzzyLng = lng + (dist * Math.sin(angle)) / metersPerLng
  return {
    lat: Math.round(fuzzyLat * 1e4) / 1e4,
    lng: Math.round(fuzzyLng * 1e4) / 1e4,
    approximate: true,
    accuracyMeters: Math.round((minMeters + maxMeters) / 2),
  }
}

/** Public/map-safe coords derived from a precise point */
export function privacySafeLocation(lat: number, lng: number, userId: string) {
  return fuzzyCoords(lat, lng, userId)
}

export function mapsLink(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat},${lng}`
}
