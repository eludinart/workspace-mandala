'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 bg-slate-950 text-slate-100 font-sans">
        <h1 className="text-xl font-bold">Erreur critique</h1>
        <p className="text-sm text-slate-400 text-center max-w-md">{error.message}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-500"
        >
          Réessayer
        </button>
      </body>
    </html>
  )
}
