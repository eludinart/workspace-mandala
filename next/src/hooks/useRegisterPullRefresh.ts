'use client'

import { useEffect } from 'react'
import type { MandalaPage } from '@/components/MandalaApp'
import { registerPullRefreshHandler } from '@/lib/pull-refresh'

export function useRegisterPullRefresh(
  page: MandalaPage,
  handler: () => Promise<void>,
): void {
  useEffect(() => registerPullRefreshHandler(page, handler), [page, handler])
}
