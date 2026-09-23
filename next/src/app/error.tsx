'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex-1 h-full min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-4 px-8 pt-8 pb-[max(2rem,env(safe-area-inset-bottom,0px))] bg-slate-950 text-slate-100">
      <h1 className="text-xl font-bold">Une erreur est survenue</h1>
      <p className="text-sm text-slate-400 text-center max-w-md">{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-500"
      >
        Réessayer
      </button>
    </div>
  )
}
