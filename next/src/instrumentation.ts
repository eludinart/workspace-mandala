/**
 * Point d’entrée Next instrumentation — le patch HTTP vit dans un .cjs
 * chargé avec webpackIgnore pour ne pas casser le build Docker.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { recordApiRequest } = await import('@/lib/request-metrics')
    // Chargement CJS hors graphe Webpack (sinon « Can't resolve 'http' »).
    const mod = await import(
      /* webpackIgnore: true */ './lib/http-metrics-bootstrap.cjs'
    )
    const bootstrap =
      (mod as { bootstrapHttpMetrics?: (fn: typeof recordApiRequest) => void })
        .bootstrapHttpMetrics ??
      (mod as { default?: { bootstrapHttpMetrics?: (fn: typeof recordApiRequest) => void } })
        .default?.bootstrapHttpMetrics
    if (typeof bootstrap === 'function') bootstrap(recordApiRequest)
  } catch (err) {
    console.warn('[instrumentation] http metrics bootstrap skipped', err)
  }
}
