'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnnuaireMapMarker } from '@/api/skills'
import {
  ANNUAIRE_FAN_MAX,
  layoutAnnuairePins,
  type AnnuaireLaidPin,
} from '@/lib/annuaire-map-layout'
import { isAvatarImageUrl } from '@/lib/user-avatar'

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

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function markerTooltipHtml(m: AnnuaireMapMarker): string {
  if (m.kind === 'mandala_place') {
    return `<div class="m-map-tooltip"><strong>${escapeHtml(m.label)}</strong><br/><span style="opacity:0.85">Lieu Mandala</span></div>`
  }
  const kindLabel = m.kind === 'residence' ? 'Habite' : 'Exerce'
  const bits = [
    `<strong>${escapeHtml(m.display_name || 'Personne')}</strong>`,
    `<span style="opacity:0.85">${kindLabel} · ${escapeHtml(m.label)}</span>`,
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
  const pro = m.pro_verified ? ' m-map-marker--pro' : ''
  const attached = m.place_names?.length ? ' m-map-marker--attached' : ''
  const sel = selected ? ' m-map-marker--selected' : ''
  const title = escapeHtml(m.display_name || '')
  const base = `m-map-marker m-map-marker--practice${pro}${attached}${sel}`

  if (isAvatarImageUrl(m.avatar)) {
    return `<div class="${base} m-map-marker--photo" title="${title}"><img src="${escapeAttr(String(m.avatar))}" alt="" class="m-map-marker-photo" /></div>`
  }

  const emoji = String(m.avatar_emoji ?? '').trim()
  if (emoji) {
    return `<div class="${base} m-map-marker--emoji" title="${title}">${escapeHtml(emoji)}</div>`
  }

  const initial = (m.display_name || '?').trim().slice(0, 1).toUpperCase() || '·'
  return `<div class="${base}" title="${title}">${escapeHtml(initial)}</div>`
}

function placeIconHtml(m: AnnuaireMapMarker, selected: boolean): string {
  const sel = selected ? ' m-map-marker--selected' : ''
  const emoji = escapeHtml(m.community_emoji || '🏛️')
  return `<div class="m-map-marker m-map-marker--mandala${sel}">${emoji}</div>`
}

function clusterIconHtml(count: number, selected: boolean): string {
  const sel = selected ? ' m-map-marker--selected' : ''
  const label = count > 99 ? '99+' : String(count)
  return `<div class="m-map-marker m-map-marker--cluster${sel}" title="${escapeHtml(`${count} personnes`)}">${escapeHtml(label)}</div>`
}

/** Souris fine : tooltips au survol. Tactile : pas de bulle sur les pins (ça masque la carte). */
function canUseHoverTooltips(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function syncMarkers(
  L: LeafletNS,
  map: import('leaflet').Map,
  layer: import('leaflet').LayerGroup,
  markersById: Map<string, import('leaflet').Marker>,
  laid: AnnuaireLaidPin[],
  selectedId: string | null | undefined,
  onSelectSingle: ((m: AnnuaireMapMarker) => void) | undefined,
  onSelectCluster: ((pin: Extract<AnnuaireLaidPin, { type: 'cluster' }>) => void) | undefined,
  refitBounds: boolean,
  withTooltips: boolean
) {
  layer.clearLayers()
  markersById.clear()
  const bounds = L.latLngBounds([])

  for (const pin of laid) {
    if (pin.type === 'cluster') {
      const selected = pin.id === selectedId || pin.items.some((i) => i.id === selectedId)
      const icon = L.divIcon({
        className: 'm-map-marker-wrap',
        html: clusterIconHtml(pin.items.length, selected),
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      })
      const marker = L.marker([pin.latitude, pin.longitude], {
        icon,
        zIndexOffset: 150,
      })
      if (withTooltips) {
        marker.bindTooltip(
          `<div class="m-map-tooltip"><strong>${escapeHtml(pin.label)}</strong><br/><span style="opacity:0.85">${pin.items.length} personnes · cliquer pour la liste</span></div>`,
          {
            direction: 'top',
            offset: [0, -14],
            opacity: 0.95,
            className: 'm-map-leaflet-tooltip',
          }
        )
      }
      marker.on('click', () => onSelectCluster?.(pin))
      marker.addTo(layer)
      markersById.set(pin.id, marker)
      bounds.extend([pin.latitude, pin.longitude])
      continue
    }

    const m = pin.marker
    const selected = m.id === selectedId
    const html =
      m.kind === 'mandala_place' ? placeIconHtml(m, selected) : practiceIconHtml(m, selected)
    const icon = L.divIcon({
      className: 'm-map-marker-wrap',
      html,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    })
    const marker = L.marker([pin.latitude, pin.longitude], {
      icon,
      zIndexOffset: m.kind === 'mandala_place' ? 200 : 100,
    })
    if (withTooltips) {
      marker.bindTooltip(markerTooltipHtml(m), {
        direction: 'top',
        offset: [0, -14],
        opacity: 0.95,
        className: 'm-map-leaflet-tooltip',
      })
    }
    marker.on('click', () => onSelectSingle?.(m))
    marker.addTo(layer)
    markersById.set(pin.id, marker)
    bounds.extend([pin.latitude, pin.longitude])
  }

  if (!refitBounds) return
  if (laid.length === 1) {
    map.setView([laid[0].latitude, laid[0].longitude], 8, { animate: true })
  } else if (laid.length > 1) {
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
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const markersKeyRef = useRef('')
  const withTooltipsRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [peek, setPeek] = useState<AnnuaireMapMarker | null>(null)
  const [clusterOpen, setClusterOpen] = useState<Extract<
    AnnuaireLaidPin,
    { type: 'cluster' }
  > | null>(null)

  const mappable = useMemo(
    () =>
      markers.filter((m) => Number.isFinite(m.latitude) && Number.isFinite(m.longitude)),
    [markers]
  )

  const laid = useMemo(() => layoutAnnuairePins(mappable), [mappable])
  const laidRef = useRef(laid)
  laidRef.current = laid

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    withTooltipsRef.current = canUseHoverTooltips()

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

      map.on('click', () => {
        setClusterOpen(null)
        setPeek(null)
      })

      const layer = L.layerGroup().addTo(map)
      leafletRef.current = L
      mapRef.current = map
      markersLayerRef.current = layer
      const key = laidRef.current.map((p) => p.id).join('|')
      markersKeyRef.current = key
      syncMarkers(
        L,
        map,
        layer,
        markersByIdRef.current,
        laidRef.current,
        selectedIdRef.current,
        (m) => {
          setClusterOpen(null)
          setPeek(m)
          onSelectRef.current?.(m)
        },
        (c) => {
          setPeek(null)
          setClusterOpen(c)
        },
        true,
        withTooltipsRef.current
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
    const key = laid.map((p) => p.id).join('|')
    const refit = key !== markersKeyRef.current
    markersKeyRef.current = key
    syncMarkers(
      L,
      map,
      layer,
      markersByIdRef.current,
      laid,
      selectedId,
      (m) => {
        setClusterOpen(null)
        setPeek(m)
        onSelectRef.current?.(m)
      },
      (c) => {
        setPeek(null)
        setClusterOpen(c)
      },
      refit,
      withTooltipsRef.current
    )
  }, [mapReady, laid, selectedId])

  useEffect(() => {
    if (!selectedId) return
    const match = mappable.find((m) => m.id === selectedId)
    if (match) setPeek(match)
  }, [selectedId, mappable])

  useEffect(() => {
    if (!mapReady || sizeToken === undefined) return
    mapRef.current?.invalidateSize()
  }, [mapReady, sizeToken])

  const practiceCount = mappable.filter(
    (m) => m.kind === 'practice' || m.kind === 'residence'
  ).length

  return (
    <div
      className={`m-public-map overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 ${frameClassName}`}
    >
      <div ref={containerRef} className={`w-full ${heightClassName}`} />
      {peek && !clusterOpen && (
        <div className="border-t border-slate-800 bg-slate-950 px-3 py-2.5">
          <div className="flex items-start gap-2.5">
            {peek.kind === 'mandala_place' ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-950/60 text-lg">
                {peek.community_emoji || '🏛️'}
              </span>
            ) : isAvatarImageUrl(peek.avatar) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={String(peek.avatar)}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-base">
                {peek.avatar_emoji?.trim() ||
                  (peek.display_name || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-100">
                {peek.kind === 'mandala_place'
                  ? peek.label
                  : peek.display_name || 'Personne'}
              </p>
              <p className="text-[11px] text-slate-400">
                {peek.kind === 'mandala_place'
                  ? 'Lieu Mandala'
                  : `${peek.kind === 'residence' ? 'Habite' : 'Exerce'} · ${peek.label}`}
                {peek.pro_verified ? ' · Mandala Pro' : ''}
              </p>
              {peek.place_names && peek.place_names.length > 0 && (
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  Rattaché · {peek.place_names.join(' · ')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPeek(null)}
              className="shrink-0 text-xs text-slate-400 hover:text-slate-200"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
      {clusterOpen && (
        <div className="max-h-36 sm:max-h-44 overflow-auto border-t border-slate-800 bg-slate-950 px-3 py-2.5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.16em] text-sky-300/80">
                {clusterOpen.label}
              </p>
              <p className="text-sm font-semibold text-slate-100">
                {clusterOpen.items.length} personnes — choisissez-en une
              </p>
            </div>
            <button
              type="button"
              onClick={() => setClusterOpen(null)}
              className="shrink-0 text-xs text-slate-400 hover:text-slate-200"
            >
              Fermer
            </button>
          </div>
          <ul className="space-y-1">
            {clusterOpen.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setClusterOpen(null)
                    setPeek(item)
                    onSelectMarker?.(item)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1.5 text-left hover:border-violet-500/50"
                >
                  {isAvatarImageUrl(item.avatar) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={String(item.avatar)}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-sm">
                      {item.avatar_emoji?.trim() ||
                        (item.display_name || '?').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-100">
                      {item.display_name || 'Personne'}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {item.kind === 'residence' ? 'Habite' : 'Exerce'} · {item.label}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!hideCaption && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 px-3 py-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="m-map-legend m-map-legend--practice" aria-hidden />
            Membres · villes ({practiceCount})
          </span>
          <span className="text-slate-600">
            Jusqu’à {ANNUAIRE_FAN_MAX} pins en éventail · au-delà, regroupement
          </span>
        </div>
      )}
    </div>
  )
}
