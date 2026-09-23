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
      <body className="min-h-svh flex flex-col items-center justify-center gap-4 px-8 pt-8 pb-[max(2rem,env(safe-area-inset-bottom,0px))] bg-slate-950 text-slate-100 font-sans">
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
