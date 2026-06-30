'use client'

import { useCallback, useEffect, useState } from 'react'
import { managerApi } from '@/api/manager'
import type { CommunityAdmin } from '@/api/admin'
import { useAuth } from '@/contexts/AuthContext'
import { useCommunity } from '@/contexts/CommunityContext'

/** Lieux dont l'utilisateur est gestionnaire (rôle organizer/admin sur le lieu). */
export function useManagedPlaces() {
  const { user } = useAuth()
  const { communities } = useCommunity()
  const [managedPlaces, setManagedPlaces] = useState<CommunityAdmin[]>([])
  const [loading, setLoading] = useState(true)

  const refreshManagedPlaces = useCallback(async () => {
    if (!user) {
      setManagedPlaces([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await managerApi.communities.list()
      setManagedPlaces(data.items ?? [])
    } catch {
      setManagedPlaces([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refreshManagedPlaces()
  }, [refreshManagedPlaces, communities])

  return { managedPlaces, loadingManagedPlaces: loading, refreshManagedPlaces }
}
