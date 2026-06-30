'use client'

import { useEffect, useRef } from 'react'
import type { PublicCommunityCard } from '@/api/communities'

const FRANCE_CENTER: [number, number] = [46.6, 2.5]
const DEFAULT_ZOOM = 5.5

type MappablePlace = PublicCommunityCard & { latitude: number; longitude: number }

function isMappable(p: PublicCommunityCard): p is MappablePlace {
  return p.latitude != null && p.longitude != null && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
}

type Props = {
  places: PublicCommunityCard[]
  selectedSlug?: string | null
  onSelect?: (slug: string) => void
}

export function PlacesMap({ places, selectedSlug, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markersLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const mappable = places.filter(isMappable)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    void import('leaflet').then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, {
        scrollWheelZoom: true,
        zoomControl: true,
      }).setView(FRANCE_CENTER, DEFAULT_ZOOM)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map)

      const layer = L.layerGroup().addTo(map)
      mapRef.current = map
      markersLayerRef.current = layer
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markersLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = markersLayerRef.current
    if (!map || !layer) return

    let cancelled = false

    void import('leaflet').then((L) => {
      if (cancelled) return
      layer.clearLayers()
      const bounds = L.latLngBounds([])

      for (const place of mappable) {
        const accent = place.accent_color ?? '#7c3aed'
        const selected = place.slug === selectedSlug
        const icon = L.divIcon({
          className: '',
          html: `<div class="m-map-marker${selected ? ' m-map-marker--selected' : ''}" style="background:${accent}" title="${place.name.replace(/"/g, '&quot;')}">${place.logo_emoji ?? '🏛️'}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })
        const marker = L.marker([place.latitude, place.longitude], { icon })
        marker.on('click', () => onSelectRef.current?.(place.slug))
        marker.bindPopup(
          `<strong>${place.name}</strong>${place.location ? `<br/><span style="opacity:0.8">${place.location}</span>` : ''}`
        )
        marker.addTo(layer)
        bounds.extend([place.latitude, place.longitude])
      }

      if (mappable.length === 1) {
        map.setView([mappable[0].latitude, mappable[0].longitude], 8, { animate: true })
      } else if (mappable.length > 1) {
        map.fitBounds(bounds.pad(0.25), { animate: true, maxZoom: 8 })
      } else {
        map.setView(FRANCE_CENTER, DEFAULT_ZOOM, { animate: false })
      }
    })

    return () => {
      cancelled = true
    }
  }, [mappable, selectedSlug])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedSlug) return
    const place = mappable.find((p) => p.slug === selectedSlug)
    if (!place) return
    map.flyTo([place.latitude, place.longitude], Math.max(map.getZoom(), 7), { duration: 0.8 })
  }, [selectedSlug, mappable])

  return (
    <div className="m-public-map relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
      <div ref={containerRef} className="h-[min(52vh,28rem)] w-full z-0" aria-label="Carte des lieux" />
      {mappable.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-[400] pointer-events-none">
          <p className="text-sm text-slate-400 px-6 text-center">
            Aucune position GPS renseignée pour l&apos;instant.
          </p>
        </div>
      )}
      <p className="absolute bottom-2 left-2 right-2 z-[400] text-[10px] text-slate-500 text-center pointer-events-none">
        France · Belgique · Suisse — lieux francophones
      </p>
    </div>
  )
}
