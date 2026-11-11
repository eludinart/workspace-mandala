'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PublicCommunityCard } from '@/api/communities'
import { placeLinksApi } from '@/api/place-links'
import { shouldShowPlacesMapPanel } from '@/lib/places-map-panel'

const FRANCE_CENTER: [number, number] = [46.6, 2.5]
const DEFAULT_ZOOM = 5.5
/** Traits lieux amis : contraste fort sur fond OSM (évite verts / marrons du relief). */
const LINK_LINE_HALO = '#0f172a'
const LINK_LINE_COLOR = '#e879f9'

type MappablePlace = PublicCommunityCard & { latitude: number; longitude: number }
type LeafletNS = typeof import('leaflet')

function isMappable(p: PublicCommunityCard): p is MappablePlace {
  return p.latitude != null && p.longitude != null && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function placeTooltipHtml(place: MappablePlace): string {
  const cityLine = [place.postal_code, place.city]
    .map((v) => (v ? String(v).trim() : ''))
    .filter(Boolean)
    .join(' ')
  const members =
    place.member_count != null && Number.isFinite(place.member_count)
      ? `${place.member_count} membre${place.member_count > 1 ? 's' : ''}`
      : ''
  const bits = [
    `<strong>${escapeHtml(place.name)}</strong>`,
    cityLine ? `<span style="opacity:0.85">${escapeHtml(cityLine)}</span>` : '',
    members ? `<span style="opacity:0.75">${escapeHtml(members)}</span>` : '',
  ].filter(Boolean)
  return `<div class="m-map-tooltip">${bits.join('<br/>')}</div>`
}

function syncPlaceMarkers(
  L: LeafletNS,
  map: import('leaflet').Map,
  layer: import('leaflet').LayerGroup,
  markersBySlug: Map<string, import('leaflet').Marker>,
  mappable: MappablePlace[],
  selectedSlug: string | null | undefined,
  handlers: {
    onSelect?: (slug: string) => void
    onHoverEnter?: (slug: string, communityId: number) => void
    onHoverLeave?: (slug: string) => void
  },
  refitBounds: boolean
) {
  layer.clearLayers()
  markersBySlug.clear()
  const bounds = L.latLngBounds([])

  for (const place of mappable) {
    const accent = place.accent_color ?? '#7c3aed'
    const selected = place.slug === selectedSlug
    const icon = L.divIcon({
      className: 'm-map-marker-wrap',
      html: `<div class="m-map-marker${selected ? ' m-map-marker--selected' : ''}" style="background:${accent}">${place.logo_emoji ?? '🏛️'}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    })
    const marker = L.marker([place.latitude, place.longitude], { icon })
    marker.bindTooltip(placeTooltipHtml(place), {
      direction: 'top',
      offset: [0, -14],
      opacity: 0.95,
      className: 'm-map-leaflet-tooltip',
    })
    marker.on('click', () => {
      handlers.onSelect?.(place.slug)
    })
    marker.on('mouseover', () => {
      handlers.onHoverEnter?.(place.slug, place.id)
    })
    marker.on('mouseout', () => {
      handlers.onHoverLeave?.(place.slug)
    })
    marker.addTo(layer)
    markersBySlug.set(place.slug, marker)
    bounds.extend([place.latitude, place.longitude])
  }

  if (refitBounds) {
    if (mappable.length === 1) {
      map.setView([mappable[0].latitude, mappable[0].longitude], 8, { animate: true })
    } else if (mappable.length > 1) {
      map.fitBounds(bounds.pad(0.25), { animate: true, maxZoom: 8 })
    } else {
      map.setView(FRANCE_CENTER, DEFAULT_ZOOM, { animate: false })
    }
  }
}

type Props = {
  places: PublicCommunityCard[]
  selectedSlug?: string | null
  /** Ids des lieux amis du lieu sélectionné (traits au clic). */
  friendCommunityIds?: number[]
  /** Mise en surbrillance sur la carte (sans défilement de page). */
  onSelect?: (slug: string) => void
  /** Hauteur du conteneur carte (classe Tailwind). Défaut : grande carte. */
  heightClassName?: string
  /** Masque la légende du bas (utile en mini-carte). */
  hideCaption?: boolean
  /** Masque le panneau détail (utile en mini-carte profil : le lieu est déjà sélectionné). */
  hideSelectionPanel?: boolean
  /** Change quand le conteneur change de taille (plein écran, etc.) → invalidateSize. */
  sizeToken?: string | number | boolean
  /** Classes du cadre extérieur (ex. plein écran sans coins). */
  frameClassName?: string
}

export function PlacesMap({
  places,
  selectedSlug,
  friendCommunityIds = [],
  onSelect,
  heightClassName = 'h-[min(48vh,22rem)] md:h-[min(58vh,34rem)] lg:h-[min(62vh,38rem)]',
  hideCaption = false,
  hideSelectionPanel = false,
  sizeToken,
  frameClassName = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markersLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const linksLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const markersBySlugRef = useRef<Map<string, import('leaflet').Marker>>(new Map())
  const leafletRef = useRef<LeafletNS | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const friendsCacheRef = useRef<Map<number, number[]>>(new Map())
  const [mapReady, setMapReady] = useState(false)
  const [hoverSlug, setHoverSlug] = useState<string | null>(null)
  const [hoverFriendIds, setHoverFriendIds] = useState<number[]>([])
  const [friendsVersion, setFriendsVersion] = useState(0)
  const hoverSlugRef = useRef<string | null>(null)
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mappableKeyRef = useRef('')

  const mappable = useMemo(() => places.filter(isMappable), [places])
  const mappableRef = useRef(mappable)
  mappableRef.current = mappable
  const selectedSlugRef = useRef(selectedSlug)
  selectedSlugRef.current = selectedSlug

  const selectedPlace = useMemo(
    () => (selectedSlug ? mappable.find((p) => p.slug === selectedSlug) ?? null : null),
    [mappable, selectedSlug]
  )

  const ensureFriends = useCallback(async (communityId: number): Promise<number[]> => {
    if (friendsCacheRef.current.has(communityId)) {
      return friendsCacheRef.current.get(communityId) ?? []
    }
    try {
      const res = await placeLinksApi.friendsOf(communityId)
      const ids = res.can_view ? res.friend_ids ?? [] : []
      friendsCacheRef.current.set(communityId, ids)
      setFriendsVersion((v) => v + 1)
      return ids
    } catch {
      friendsCacheRef.current.set(communityId, [])
      setFriendsVersion((v) => v + 1)
      return []
    }
  }, [])

  // Amis du lieu sélectionné : prop parent si déjà connus, sinon fetch (y compris visiteurs)
  useEffect(() => {
    if (!selectedPlace?.id) return
    if (friendCommunityIds.length > 0) {
      friendsCacheRef.current.set(selectedPlace.id, friendCommunityIds)
      setFriendsVersion((v) => v + 1)
      return
    }
    void ensureFriends(selectedPlace.id)
  }, [selectedPlace?.id, friendCommunityIds, ensureFriends])

  const onHoverEnter = useCallback(
    (slug: string, communityId: number) => {
      if (hoverLeaveTimerRef.current) {
        clearTimeout(hoverLeaveTimerRef.current)
        hoverLeaveTimerRef.current = null
      }
      hoverSlugRef.current = slug
      setHoverSlug(slug)
      if (friendsCacheRef.current.has(communityId)) {
        setHoverFriendIds(friendsCacheRef.current.get(communityId) ?? [])
        return
      }
      setHoverFriendIds([])
      void ensureFriends(communityId).then((ids) => {
        if (hoverSlugRef.current === slug) setHoverFriendIds(ids)
      })
    },
    [ensureFriends]
  )

  const onHoverLeave = useCallback((slug: string) => {
    if (hoverLeaveTimerRef.current) clearTimeout(hoverLeaveTimerRef.current)
    hoverLeaveTimerRef.current = setTimeout(() => {
      if (hoverSlugRef.current !== slug) return
      hoverSlugRef.current = null
      setHoverSlug(null)
      setHoverFriendIds([])
    }, 120)
  }, [])

  const hoverEnterRef = useRef(onHoverEnter)
  hoverEnterRef.current = onHoverEnter
  const hoverLeaveRef = useRef(onHoverLeave)
  hoverLeaveRef.current = onHoverLeave

  const linkFocusSlug = hoverSlug ?? selectedSlug ?? null
  const linkFocusPlace = useMemo(
    () => (linkFocusSlug ? mappable.find((p) => p.slug === linkFocusSlug) ?? null : null),
    [mappable, linkFocusSlug]
  )
  const activeFriendIds = useMemo(() => {
    if (!linkFocusPlace) return []
    if (hoverSlug && hoverSlug === linkFocusPlace.slug) {
      return hoverFriendIds.length
        ? hoverFriendIds
        : friendsCacheRef.current.get(linkFocusPlace.id) ?? []
    }
    return friendsCacheRef.current.get(linkFocusPlace.id) ?? friendCommunityIds
    // friendsVersion force le recalcul après cache
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkFocusPlace, hoverSlug, hoverFriendIds, friendCommunityIds, friendsVersion])

  const friendCount = useMemo(() => {
    if (!linkFocusPlace || activeFriendIds.length === 0) return 0
    const set = new Set(activeFriendIds)
    return mappable.filter((p) => p.id !== linkFocusPlace.id && set.has(p.id)).length
  }, [linkFocusPlace, activeFriendIds, mappable])

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
      const links = L.layerGroup().addTo(map)
      leafletRef.current = L
      mapRef.current = map
      markersLayerRef.current = layer
      linksLayerRef.current = links
      const key = mappableRef.current.map((p) => p.slug).join('|')
      mappableKeyRef.current = key
      syncPlaceMarkers(
        L,
        map,
        layer,
        markersBySlugRef.current,
        mappableRef.current,
        selectedSlugRef.current,
        {
          onSelect: (slug) => onSelectRef.current?.(slug),
          onHoverEnter: (slug, id) => hoverEnterRef.current(slug, id),
          onHoverLeave: (slug) => hoverLeaveRef.current(slug),
        },
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
      linksLayerRef.current = null
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
    const key = mappable.map((p) => `${p.slug}:${p.member_count ?? ''}`).join('|')
    const refit = key !== mappableKeyRef.current
    mappableKeyRef.current = key
    syncPlaceMarkers(
      L,
      map,
      layer,
      markersBySlugRef.current,
      mappable,
      selectedSlug,
      {
        onSelect: (slug) => onSelectRef.current?.(slug),
        onHoverEnter: (slug, id) => hoverEnterRef.current(slug, id),
        onHoverLeave: (slug) => hoverLeaveRef.current(slug),
      },
      refit
    )
  }, [mapReady, mappable, selectedSlug])

  // Traits : survol prioritaire, sinon sélection
  useEffect(() => {
    if (!mapReady) return
    const L = leafletRef.current
    const linksLayer = linksLayerRef.current
    if (!L || !linksLayer) return
    linksLayer.clearLayers()
    if (!linkFocusPlace || activeFriendIds.length === 0) return
    const friendSet = new Set(activeFriendIds)
    const weight = hoverSlug ? 2 : 1.75
    for (const place of mappable) {
      if (place.id === linkFocusPlace.id) continue
      if (!friendSet.has(place.id)) continue
      const latlngs: [number, number][] = [
        [linkFocusPlace.latitude, linkFocusPlace.longitude],
        [place.latitude, place.longitude],
      ]
      // Halo sombre pour lisibilité sur tuiles claires / vertes
      L.polyline(latlngs, {
        color: LINK_LINE_HALO,
        weight: weight + 1.5,
        opacity: 0.85,
        lineCap: 'round',
        interactive: false,
      }).addTo(linksLayer)
      L.polyline(latlngs, {
        color: LINK_LINE_COLOR,
        weight,
        opacity: 1,
        dashArray: '7 9',
        lineCap: 'round',
        interactive: false,
      }).addTo(linksLayer)
    }
  }, [mapReady, linkFocusPlace, activeFriendIds, mappable, hoverSlug])

  // Au clic : garder le zoom utilisateur, sauf si un lieu ami est hors cadre → élargir seulement.
  useEffect(() => {
    const map = mapRef.current
    const L = leafletRef.current
    if (!map || !L || !selectedSlug) return
    const selected = mappable.find((p) => p.slug === selectedSlug)
    if (!selected) return

    const ids = friendsCacheRef.current.get(selected.id) ?? friendCommunityIds
    const friendSet = new Set(ids)
    const friends = mappable.filter((p) => p.id !== selected.id && friendSet.has(p.id))
    if (friends.length === 0) return

    const view = map.getBounds()
    const friendOutside = friends.some((f) => !view.contains(L.latLng(f.latitude, f.longitude)))
    if (!friendOutside) return

    const bounds = L.latLngBounds([[selected.latitude, selected.longitude]])
    for (const f of friends) bounds.extend([f.latitude, f.longitude])
    map.fitBounds(bounds.pad(0.2), {
      animate: true,
      // Ne jamais zoomer plus près que le réglage actuel — seulement élargir / recentrer.
      maxZoom: map.getZoom(),
      paddingTopLeft: [24, 24],
      paddingBottomRight: [24, 88],
    })
  }, [selectedSlug, friendCommunityIds, mappable, friendsVersion])

  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return
    const t = window.setTimeout(() => {
      map.invalidateSize()
    }, 80)
    return () => window.clearTimeout(t)
  }, [mapReady, sizeToken, heightClassName])

  useEffect(() => {
    if (!mapReady || !containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [mapReady])

  const panelPlace = shouldShowPlacesMapPanel({
    hasSelectedPlace: Boolean(selectedPlace),
    hideSelectionPanel,
  })
    ? selectedPlace
    : null
  const cityLine = panelPlace
    ? [panelPlace.postal_code, panelPlace.city]
        .map((v) => (v ? String(v).trim() : ''))
        .filter(Boolean)
        .join(' ')
    : ''
  const panelFriendCount =
    panelPlace && !hoverSlug
      ? friendCount
      : panelPlace
        ? (() => {
            const ids = friendsCacheRef.current.get(panelPlace.id) ?? friendCommunityIds
            const set = new Set(ids)
            return mappable.filter((p) => p.id !== panelPlace.id && set.has(p.id)).length
          })()
        : 0

  return (
    <div
      className={`m-public-map relative overflow-hidden border border-slate-800 bg-slate-950 shadow-inner ${
        frameClassName || 'rounded-2xl'
      }`}
    >
      <div ref={containerRef} className={`${heightClassName} w-full z-0`} aria-label="Carte des lieux" />
      {mappable.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-[400] pointer-events-none">
          <p className="text-sm text-slate-400 px-6 text-center">
            Aucune position GPS renseignée pour l&apos;instant.
          </p>
        </div>
      )}
      {panelPlace && (
        <div
          className="absolute left-2 right-2 bottom-2 z-[450] rounded-xl border border-slate-300/90 px-3 py-2.5 shadow-xl shadow-black/25"
          style={{ backgroundColor: 'rgba(241, 245, 249, 0.96)' }}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-semibold leading-snug truncate"
                style={{ color: '#0f172a' }}
              >
                {panelPlace.name}
              </p>
              {panelPlace.tagline?.trim() && (
                <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#6d28d9' }}>
                  {panelPlace.tagline.trim()}
                </p>
              )}
              <p
                className="text-xs mt-0.5 truncate"
                style={{ color: '#475569' }}
              >
                {[cityLine, panelPlace.country].filter(Boolean).join(', ') ||
                  panelPlace.location ||
                  '—'}
                {panelPlace.member_count != null
                  ? ` · ${panelPlace.member_count} membre${panelPlace.member_count > 1 ? 's' : ''}`
                  : ''}
              </p>
              {panelPlace.description?.trim() && (
                <p className="text-xs mt-1.5 leading-relaxed line-clamp-2" style={{ color: '#334155' }}>
                  {panelPlace.description.trim()}
                </p>
              )}
              {panelFriendCount > 0 && (
                <p className="text-[11px] mt-1" style={{ color: '#6d28d9' }}>
                  {panelFriendCount} lieu{panelFriendCount > 1 ? 'x' : ''} ami
                  {panelFriendCount > 1 ? 's' : ''} relié{panelFriendCount > 1 ? 's' : ''} sur la carte
                </p>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              {panelPlace.profile_public !== false && (
                <a
                  href={`/lieux/${encodeURIComponent(panelPlace.slug)}`}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500"
                >
                  Profil
                </a>
              )}
              {onSelect && (
                <button
                  type="button"
                  onClick={() => onSelect('')}
                  className="text-xs px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {!hideCaption && !panelPlace && (
        <p className="absolute bottom-2 left-2 right-2 z-[400] text-[10px] text-slate-500 text-center pointer-events-none">
          Survolez un lieu pour voir ses liens · France · Belgique · Suisse
        </p>
      )}
    </div>
  )
}
