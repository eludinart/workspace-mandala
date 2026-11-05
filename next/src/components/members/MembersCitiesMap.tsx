'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import { useFeatureDoors } from '@/hooks/useFeatureDoors'
import { isAvatarImageUrl } from '@/lib/user-avatar'

type Pin = {
  user_id: number
  display_name: string
  avatar?: string | null
  avatar_emoji?: string | null
  pro_verified?: boolean
  city: string
  latitude: number
  longitude: number
}

const FRANCE_CENTER: [number, number] = [46.6, 2.5]

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

function pinIconHtml(pin: Pin): string {
  const title = escapeHtml(pin.display_name || '')
  const pro = pin.pro_verified ? ' m-map-marker--pro' : ''
  const base = `m-map-marker m-map-marker--practice${pro}`
  if (isAvatarImageUrl(pin.avatar)) {
    return `<div class="${base} m-map-marker--photo" title="${title}"><img src="${escapeAttr(String(pin.avatar))}" alt="" class="m-map-marker-photo" /></div>`
  }
  const emoji = String(pin.avatar_emoji ?? '').trim()
  if (emoji) {
    return `<div class="${base} m-map-marker--emoji" title="${title}">${escapeHtml(emoji)}</div>`
  }
  const initial = (pin.display_name || '?').trim().slice(0, 1).toUpperCase() || '·'
  return `<div class="${base}" title="${title}">${escapeHtml(initial)}</div>`
}

export function MembersCitiesMap({ communitySlug }: { communitySlug?: string }) {
  const { can, loading: doorsLoading } = useFeatureDoors()
  const [pins, setPins] = useState<Pin[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)

  useEffect(() => {
    if (doorsLoading || !can('carte_membres') || !communitySlug) {
      setPins([])
      return
    }
    let cancelled = false
    const loadPins = () => {
      void api
        .get(`/api/members/city?community_slug=${encodeURIComponent(communitySlug)}`)
        .then((raw) => {
          if (!cancelled) setPins((raw as { pins?: Pin[] }).pins ?? [])
        })
        .catch(() => {
          if (!cancelled) setPins([])
        })
    }
    loadPins()
    const onChanged = () => loadPins()
    window.addEventListener('mandala-member-city-changed', onChanged)
    return () => {
      cancelled = true
      window.removeEventListener('mandala-member-city-changed', onChanged)
    }
  }, [can, doorsLoading, communitySlug])

  useEffect(() => {
    if (!can('carte_membres') || !containerRef.current || mapRef.current) return
    let cancelled = false
    void import('leaflet').then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return
      const map = L.map(containerRef.current, { scrollWheelZoom: false, zoomControl: true }).setView(
        FRANCE_CENTER,
        5.5
      )
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map)
      mapRef.current = map
      requestAnimationFrame(() => map.invalidateSize())
    })
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [can])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !can('carte_membres')) return
    let cancelled = false
    void import('leaflet').then((L) => {
      if (cancelled || mapRef.current !== map) return
      const group = (map as unknown as { __pins?: import('leaflet').LayerGroup }).__pins
      if (group) map.removeLayer(group)
      const layer = L.layerGroup().addTo(map)
      ;(map as unknown as { __pins?: import('leaflet').LayerGroup }).__pins = layer
      const bounds = L.latLngBounds([])
      for (const pin of pins) {
        const marker = L.marker([pin.latitude, pin.longitude], {
          icon: L.divIcon({
            className: 'm-map-marker-wrap',
            html: pinIconHtml(pin),
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
        })
        marker.bindTooltip(
          `<div class="m-map-tooltip"><strong>${escapeHtml(pin.display_name)}</strong>${
            pin.pro_verified ? '<br/><span style="opacity:0.85">Mandala Pro</span>' : ''
          }<br/>${escapeHtml(pin.city)}</div>`,
          { className: 'm-map-leaflet-tooltip', direction: 'top', offset: [0, -12] }
        )
        marker.addTo(layer)
        bounds.extend([pin.latitude, pin.longitude])
      }
      if (pins.length === 1) {
        map.setView([pins[0].latitude, pins[0].longitude], 8)
      } else if (pins.length > 1) {
        map.fitBounds(bounds.pad(0.3), { maxZoom: 9 })
      }
    })
    return () => {
      cancelled = true
    }
  }, [pins, can])

  if (doorsLoading || !can('carte_membres') || !communitySlug) return null

  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">Carte des membres</h3>
        <p className="text-xs text-slate-500">
          Villes des personnes qui ont accepté d’apparaître ({pins.length}).
        </p>
      </div>
      <div className="m-public-map overflow-hidden rounded-2xl border border-slate-800">
        <div ref={containerRef} className="h-[min(40vh,16rem)] w-full" />
      </div>
    </section>
  )
}
