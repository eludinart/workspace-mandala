'use client'

import { AppErrorScreen } from '@/components/AppErrorScreen'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <AppErrorScreen error={error} reset={reset} />
}
