'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnnuaireMapMarker } from '@/api/skills'

const FRANCE_CENTER: [number, number] = [46.6, 2.5]
const DEFAULT_ZOOM = 5.5

type LeafletNS = typeof import('leaflet')

type Props = {
  markers: AnnuaireMapMarker[]
  selectedId?: string | null
  onSelectMarker?: (marker: AnnuaireMapMarker) => void
  heightClassName?: string
  sizeToken?: string | number | boolean
  frameClassName?: string
  hideCaption?: boolean
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function markerTooltipHtml(m: AnnuaireMapMarker): string {
  if (m.kind === 'mandala_place') {
    return `<div class="m-map-tooltip"><strong>${escapeHtml(m.label)}</strong><br/><span style="opacity:0.85">Lieu Mandala</span></div>`
  }
  const bits = [
    `<strong>${escapeHtml(m.display_name || 'Personne')}</strong>`,
    `<span style="opacity:0.85">Exerce · ${escapeHtml(m.label)}</span>`,
  ]
  if (m.pro_verified) bits.push(`<span style="opacity:0.75">Mandala Pro</span>`)
  if (m.place_names?.length) {
    bits.push(
      `<span style="opacity:0.9">Rattaché · ${escapeHtml(m.place_names.join(' · '))}</span>`
    )
  }
  return `<div class="m-map-tooltip">${bits.join('<br/>')}</div>`
}

function practiceIconHtml(m: AnnuaireMapMarker, selected: boolean): string {
  const initial = (m.display_name || '?').trim().slice(0, 1).toUpperCase() || '·'
  const pro = m.pro_verified ? ' m-map-marker--pro' : ''
  const attached = m.place_names?.length ? ' m-map-marker--attached' : ''
  const sel = selected ? ' m-map-marker--selected' : ''
  return `<div class="m-map-marker m-map-marker--practice${pro}${attached}${sel}" title="${escapeHtml(m.display_name || '')}">${escapeHtml(initial)}</div>`
}

function placeIconHtml(m: AnnuaireMapMarker, selected: boolean): string {
  const sel = selected ? ' m-map-marker--selected' : ''
  const emoji = escapeHtml(m.community_emoji || '🏛️')
  return `<div class="m-map-marker m-map-marker--mandala${sel}">${emoji}</div>`
}

function syncMarkers(
  L: LeafletNS,
  map: import('leaflet').Map,
  layer: import('leaflet').LayerGroup,
  markersById: Map<string, import('leaflet').Marker>,
  markers: AnnuaireMapMarker[],
  selectedId: string | null | undefined,
  onSelect: ((m: AnnuaireMapMarker) => void) | undefined,
  refitBounds: boolean
) {
  layer.clearLayers()
  markersById.clear()
  const bounds = L.latLngBounds([])

  for (const m of markers) {
    const selected = m.id === selectedId
    const html =
      m.kind === 'mandala_place' ? placeIconHtml(m, selected) : practiceIconHtml(m, selected)
    const icon = L.divIcon({
      className: 'm-map-marker-wrap',
      html,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    })
    const marker = L.marker([m.latitude, m.longitude], {
      icon,
      zIndexOffset: m.kind === 'mandala_place' ? 200 : 100,
    })
    marker.bindTooltip(markerTooltipHtml(m), {
      direction: 'top',
      offset: [0, -14],
      opacity: 0.95,
      className: 'm-map-leaflet-tooltip',
    })
    marker.on('click', () => onSelect?.(m))
    marker.addTo(layer)
    markersById.set(m.id, marker)
    bounds.extend([m.latitude, m.longitude])
  }

  if (!refitBounds) return
  if (markers.length === 1) {
    map.setView([markers[0].latitude, markers[0].longitude], 8, { animate: true })
  } else if (markers.length > 1) {
    map.fitBounds(bounds.pad(0.25), { animate: true, maxZoom: 9 })
  } else {
    map.setView(FRANCE_CENTER, DEFAULT_ZOOM, { animate: false })
  }
}

export function AnnuaireCitiesMap({
  markers,
  selectedId,
  onSelectMarker,
  heightClassName = 'h-[min(48vh,22rem)] md:h-[min(58vh,34rem)]',
  sizeToken,
  frameClassName = '',
  hideCaption = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markersLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const markersByIdRef = useRef<Map<string, import('leaflet').Marker>>(new Map())
  const leafletRef = useRef<LeafletNS | null>(null)
  const onSelectRef = useRef(onSelectMarker)
  onSelectRef.current = onSelectMarker
  const markersRef = useRef(markers)
  markersRef.current = markers
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const markersKeyRef = useRef('')
  const [mapReady, setMapReady] = useState(false)

  const mappable = useMemo(
    () =>
      markers.filter(
        (m) => Number.isFinite(m.latitude) && Number.isFinite(m.longitude)
      ),
    [markers]
  )

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
      const key = markersRef.current.map((m) => m.id).join('|')
      markersKeyRef.current = key
      syncMarkers(
        L,
        map,
        layer,
        markersByIdRef.current,
        markersRef.current,
        selectedIdRef.current,
        (m) => onSelectRef.current?.(m),
        true
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
      markersByIdRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    const layer = markersLayerRef.current
    const L = leafletRef.current
    if (!map || !layer || !L) return
    const key = mappable.map((m) => m.id).join('|')
    const refit = key !== markersKeyRef.current
    markersKeyRef.current = key
    syncMarkers(
      L,
      map,
      layer,
      markersByIdRef.current,
      mappable,
      selectedId,
      (m) => onSelectRef.current?.(m),
      refit
    )
  }, [mapReady, mappable, selectedId])

  useEffect(() => {
    if (!mapReady || sizeToken === undefined) return
    mapRef.current?.invalidateSize()
  }, [mapReady, sizeToken])

  const practiceCount = mappable.filter((m) => m.kind === 'practice').length
  const placeCount = mappable.filter((m) => m.kind === 'mandala_place').length

  return (
    <div
      className={`m-public-map overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 ${frameClassName}`}
    >
      <div ref={containerRef} className={`w-full ${heightClassName}`} />
      {!hideCaption && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 px-3 py-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="m-map-legend m-map-legend--practice" aria-hidden />
            Ville d’exercice ({practiceCount})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="m-map-legend m-map-legend--mandala" aria-hidden />
            Lieu Mandala ({placeCount})
          </span>
        </div>
      )}
    </div>
  )
}
