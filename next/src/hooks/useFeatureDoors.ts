'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { FeatureDoorKey } from '@/lib/feature-door-constants'
import { FEATURE_DOOR_KEYS } from '@/lib/feature-door-constants'

type AccessMap = Record<FeatureDoorKey, boolean>

const empty = (): AccessMap =>
  Object.fromEntries(FEATURE_DOOR_KEYS.map((k) => [k, false])) as AccessMap

export function useFeatureDoors() {
  const [access, setAccess] = useState<AccessMap>(empty)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.get('/api/feature-doors/access')) as { access?: AccessMap }
      setAccess({ ...empty(), ...(res.access ?? {}) })
    } catch {
      setAccess(empty())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const can = useCallback((key: FeatureDoorKey) => Boolean(access[key]), [access])

  return { access, loading, can, reload }
}
