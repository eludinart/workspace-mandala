'use client'

import { AppErrorScreen } from '@/components/AppErrorScreen'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fr">
      <body>
        <AppErrorScreen error={error} reset={reset} title="Erreur critique" fullPage />
      </body>
    </html>
  )
}
