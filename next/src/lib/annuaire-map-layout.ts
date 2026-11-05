/**
 * Disposition des pins annuaire : éventail si plusieurs personnes
 * sur la même ville ; regroupement avec compteur au-delà du seuil.
 */
import type { AnnuaireMapMarker } from '@/api/skills'

/** Au-delà : un pin regroupé + liste au clic (sinon éventail). */
export const ANNUAIRE_FAN_MAX = 5

/** Rayon d’éventail autour du centre-ville (~600–700 m). */
const FAN_RADIUS_DEG = 0.006

export type AnnuaireLaidPin =
  | {
      type: 'single'
      id: string
      marker: AnnuaireMapMarker
      latitude: number
      longitude: number
    }
  | {
      type: 'cluster'
      id: string
      label: string
      items: AnnuaireMapMarker[]
      latitude: number
      longitude: number
    }

function cityGroupKey(m: AnnuaireMapMarker): string {
  const city = String(m.label ?? '')
    .trim()
    .toLocaleLowerCase('fr')
  if (city) return `city:${city}`
  return `coord:${m.latitude.toFixed(4)},${m.longitude.toFixed(4)}`
}

function fanOffset(index: number, total: number): { dLat: number; dLng: number } {
  if (total <= 1) return { dLat: 0, dLng: 0 }
  const angle = (2 * Math.PI * index) / total - Math.PI / 2
  return {
    dLat: Math.cos(angle) * FAN_RADIUS_DEG,
    dLng: Math.sin(angle) * FAN_RADIUS_DEG,
  }
}

/**
 * Place les pins : lieux Mandala inchangés ; personnes groupées par ville.
 */
export function layoutAnnuairePins(markers: AnnuaireMapMarker[]): AnnuaireLaidPin[] {
  const places: AnnuaireLaidPin[] = []
  const byCity = new Map<string, AnnuaireMapMarker[]>()

  for (const m of markers) {
    if (m.kind === 'mandala_place') {
      places.push({
        type: 'single',
        id: m.id,
        marker: m,
        latitude: m.latitude,
        longitude: m.longitude,
      })
      continue
    }
    const key = cityGroupKey(m)
    const list = byCity.get(key) ?? []
    list.push(m)
    byCity.set(key, list)
  }

  const people: AnnuaireLaidPin[] = []
  for (const [key, items] of byCity) {
    const baseLat = items[0].latitude
    const baseLng = items[0].longitude
    const cityLabel = items[0].label || 'Ville'

    if (items.length > ANNUAIRE_FAN_MAX) {
      people.push({
        type: 'cluster',
        id: `cluster:${key}`,
        label: cityLabel,
        items,
        latitude: baseLat,
        longitude: baseLng,
      })
      continue
    }

    items.forEach((marker, index) => {
      const { dLat, dLng } = fanOffset(index, items.length)
      people.push({
        type: 'single',
        id: marker.id,
        marker,
        latitude: baseLat + dLat,
        longitude: baseLng + dLng,
      })
    })
  }

  return [...places, ...people]
}
