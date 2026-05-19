'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'

export type Community = {
  id: number
  slug: string
  name: string
  tagline?: string | null
  accent_color?: string | null
  logo_emoji?: string | null
  role?: string
}

type CommunityContextValue = {
  communities: Community[]
  active: Community | null
  setActiveSlug: (slug: string) => void
  loading: boolean
  refresh: () => Promise<void>
}

const STORAGE_KEY = 'mandala_active_community'

const CommunityContext = createContext<CommunityContextValue | null>(null)

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [communities, setCommunities] = useState<Community[]>([])
  const [activeSlug, setActiveSlugState] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setCommunities([])
      return
    }
    setLoading(true)
    try {
      const res = (await api.get('/api/communities/mine')) as { items?: Community[] }
      const items = res?.items ?? []
      setCommunities(items)
      const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      const pick =
        items.find((c) => c.slug === stored)?.slug ??
        items.find((c) => c.slug === 'shambhala')?.slug ??
        items[0]?.slug ??
        null
      setActiveSlugState(pick)
      if (pick && typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, pick)
    } catch {
      setCommunities([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setActiveSlug = useCallback((slug: string) => {
    setActiveSlugState(slug)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, slug)
  }, [])

  const active = useMemo(
    () => communities.find((c) => c.slug === activeSlug) ?? communities[0] ?? null,
    [communities, activeSlug]
  )

  const value = useMemo(
    () => ({ communities, active, setActiveSlug, loading, refresh }),
    [communities, active, setActiveSlug, loading, refresh]
  )

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>
}

export function useCommunity() {
  const ctx = useContext(CommunityContext)
  if (!ctx) throw new Error('useCommunity hors CommunityProvider')
  return ctx
}
