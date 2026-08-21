'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PublicCommunityCard } from '@/api/communities'

const FRANCE_CENTER: [number, number] = [46.6, 2.5]
const DEFAULT_ZOOM = 5.5

type MappablePlace = PublicCommunityCard & { latitude: number; longitude: number }
type LeafletNS = typeof import('leaflet')

function isMappable(p: PublicCommunityCard): p is MappablePlace {
  return p.latitude != null && p.longitude != null && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
}

function syncPlaceMarkers(
  L: LeafletNS,
  map: import('leaflet').Map,
  layer: import('leaflet').LayerGroup,
  markersBySlug: Map<string, import('leaflet').Marker>,
  mappable: MappablePlace[],
  selectedSlug: string | null | undefined,
  onSelect: ((slug: string) => void) | undefined
) {
  layer.clearLayers()
  markersBySlug.clear()
  const bounds = L.latLngBounds([])

  for (const place of mappable) {
    const accent = place.accent_color ?? '#7c3aed'
    const selected = place.slug === selectedSlug
    const icon = L.divIcon({
      className: 'm-map-marker-wrap',
      html: `<div class="m-map-marker${selected ? ' m-map-marker--selected' : ''}" style="background:${accent}" title="${place.name.replace(/"/g, '&quot;')}">${place.logo_emoji ?? '🏛️'}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    })
    const marker = L.marker([place.latitude, place.longitude], { icon })
    const line2 = [place.postal_code, place.city].filter((v) => v && String(v).trim()).join(' ')
    const popupAddr =
      [place.address, line2, place.country]
        .map((v) => (v ? String(v).trim() : ''))
        .filter(Boolean)
        .join(', ') || place.location || ''
    const profileHref = `/lieux/${encodeURIComponent(place.slug)}`
    const profileLink =
      place.profile_public !== false
        ? `<br/><a href="${profileHref}" style="display:inline-block;margin-top:6px;color:#7c3aed;font-weight:600">Voir le profil →</a>`
        : `<br/><span style="display:inline-block;margin-top:6px;opacity:0.6;font-size:12px">Profil privé</span>`
    marker.bindPopup(
      `<strong>${place.name}</strong>` +
        (popupAddr ? `<br/><span style="opacity:0.8">${popupAddr}</span>` : '') +
        profileLink
    )
    marker.on('click', () => {
      onSelect?.(place.slug)
      marker.openPopup()
    })
    marker.addTo(layer)
    markersBySlug.set(place.slug, marker)
    bounds.extend([place.latitude, place.longitude])
  }

  if (mappable.length === 1) {
    map.setView([mappable[0].latitude, mappable[0].longitude], 8, { animate: true })
  } else if (mappable.length > 1) {
    map.fitBounds(bounds.pad(0.25), { animate: true, maxZoom: 8 })
  } else {
    map.setView(FRANCE_CENTER, DEFAULT_ZOOM, { animate: false })
  }

  if (selectedSlug) {
    markersBySlug.get(selectedSlug)?.openPopup()
  }
}

type Props = {
  places: PublicCommunityCard[]
  selectedSlug?: string | null
  /** Mise en surbrillance sur la carte (sans défilement de page). */
  onSelect?: (slug: string) => void
  /** Hauteur du conteneur carte (classe Tailwind). Défaut : grande carte. */
  heightClassName?: string
  /** Masque la légende du bas (utile en mini-carte). */
  hideCaption?: boolean
}

export function PlacesMap({
  places,
  selectedSlug,
  onSelect,
  heightClassName = 'h-[min(40vh,16rem)] sm:h-[min(52vh,28rem)]',
  hideCaption = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markersLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const markersBySlugRef = useRef<Map<string, import('leaflet').Marker>>(new Map())
  const leafletRef = useRef<LeafletNS | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const [mapReady, setMapReady] = useState(false)

  const mappable = useMemo(() => places.filter(isMappable), [places])
  const mappableRef = useRef(mappable)
  mappableRef.current = mappable
  const selectedSlugRef = useRef(selectedSlug)
  selectedSlugRef.current = selectedSlug

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
      leafletRef.current = L
      mapRef.current = map
      markersLayerRef.current = layer
      // Les lieux peuvent déjà être chargés avant la fin de l'import Leaflet.
      syncPlaceMarkers(
        L,
        map,
        layer,
        markersBySlugRef.current,
        mappableRef.current,
        selectedSlugRef.current,
        onSelectRef.current
      )
      setMapReady(true)
      requestAnimationFrame(() => {
        if (!cancelled) map.invalidateSize()
      })
    })

    return () => {
      cancelled = true
      setMapReady(false)
      mapRef.current?.remove()
      mapRef.current = null
      markersLayerRef.current = null
      leafletRef.current = null
      markersBySlugRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    const layer = markersLayerRef.current
    const L = leafletRef.current
    if (!map || !layer || !L) return
    syncPlaceMarkers(L, map, layer, markersBySlugRef.current, mappable, selectedSlug, onSelectRef.current)
  }, [mapReady, mappable, selectedSlug])

  // Centrage sur le lieu sélectionné (sans quitter la carte)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedSlug) return
    const place = mappable.find((p) => p.slug === selectedSlug)
    if (!place) return
    map.flyTo([place.latitude, place.longitude], Math.max(map.getZoom(), 7), { duration: 0.8 })
    const marker = markersBySlugRef.current.get(selectedSlug)
    marker?.openPopup()
  }, [selectedSlug, mappable])

  return (
    <div className="m-public-map relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
      <div ref={containerRef} className={`${heightClassName} w-full z-0`} aria-label="Carte des lieux" />
      {mappable.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-[400] pointer-events-none">
          <p className="text-sm text-slate-400 px-6 text-center">
            Aucune position GPS renseignée pour l&apos;instant.
          </p>
        </div>
      )}
      {!hideCaption && (
        <p className="absolute bottom-2 left-2 right-2 z-[400] text-[10px] text-slate-500 text-center pointer-events-none">
          France · Belgique · Suisse — lieux francophones
        </p>
      )}
    </div>
  )
}
