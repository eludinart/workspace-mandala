'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { communitiesApi } from '@/api/communities'
import { useAuth } from '@/contexts/AuthContext'
export type Community = {
  id: number
  slug: string
  name: string
  tagline?: string | null
  description?: string | null
  location?: string | null
  website?: string | null
  contact_email?: string | null
  accent_color?: string | null
  logo_emoji?: string | null
  avatar?: string | null
  role?: string
}

type PlaceSwitchNotice = {
  placeName: string
  reason?: 'notification'
}

type CommunityContextValue = {
  communities: Community[]
  active: Community | null
  setActiveSlug: (slug: string, opts?: { notify?: boolean; reason?: 'notification' }) => void
  placeSwitchNotice: PlaceSwitchNotice | null
  dismissPlaceSwitch: () => void
  loading: boolean
  refresh: () => Promise<void>
  joinCommunity: (slug: string, inviteCode?: string | null) => Promise<void>
}

const STORAGE_KEY = 'mandala_active_community'

const CommunityContext = createContext<CommunityContextValue | null>(null)

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [communities, setCommunities] = useState<Community[]>([])
  const [activeSlug, setActiveSlugState] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [placeSwitchNotice, setPlaceSwitchNotice] = useState<PlaceSwitchNotice | null>(null)
  const communitiesRef = useRef<Community[]>([])
  const activeSlugRef = useRef<string | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismissPlaceSwitch = useCallback(() => {
    setPlaceSwitchNotice(null)
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!user) {
      setCommunities([])
      return
    }
    setLoading(true)
    try {
      const res = (await communitiesApi.mine()) as { items?: Community[] }
      const items = res?.items ?? []
      setCommunities(items)
      communitiesRef.current = items
      const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      const pick =
        items.find((c) => c.slug === stored)?.slug ??
        items.find((c) => c.slug === 'shambhala')?.slug ??
        items[0]?.slug ??
        null
      setActiveSlugState(pick)
      activeSlugRef.current = pick
      if (pick && typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, pick)
    } catch {
      setCommunities([])
      communitiesRef.current = []
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setActiveSlug = useCallback(
    (slug: string, opts?: { notify?: boolean; reason?: 'notification' }) => {
      const prev = activeSlugRef.current
      setActiveSlugState(slug)
      activeSlugRef.current = slug
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, slug)
      if (opts?.notify && slug && slug !== prev) {
        const name = communitiesRef.current.find((c) => c.slug === slug)?.name ?? slug
        setPlaceSwitchNotice({ placeName: name, reason: opts.reason })
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
        dismissTimerRef.current = setTimeout(() => setPlaceSwitchNotice(null), 6000)
      }
    },
    []
  )

  useEffect(
    () => () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    },
    []
  )

  useEffect(() => {
    communitiesRef.current = communities
  }, [communities])

  useEffect(() => {
    activeSlugRef.current = activeSlug
  }, [activeSlug])

  const joinCommunity = useCallback(
    async (slug: string, inviteCode?: string | null) => {
      await communitiesApi.join(slug, inviteCode)
      await refresh()
      setActiveSlug(slug)
    },
    [refresh, setActiveSlug]
  )

  const active = useMemo(
    () => communities.find((c) => c.slug === activeSlug) ?? communities[0] ?? null,
    [communities, activeSlug]
  )

  const value = useMemo(
    () => ({
      communities,
      active,
      setActiveSlug,
      placeSwitchNotice,
      dismissPlaceSwitch,
      loading,
      refresh,
      joinCommunity,
    }),
    [communities, active, setActiveSlug, placeSwitchNotice, dismissPlaceSwitch, loading, refresh, joinCommunity]
  )

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>
}

export function useCommunity() {
  const ctx = useContext(CommunityContext)
  if (!ctx) throw new Error('useCommunity hors CommunityProvider')
  return ctx
}
