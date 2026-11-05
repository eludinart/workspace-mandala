/** Badge Mandala Pro — à utiliser partout où une personne Pro apparaît. */

type Props = {
  /** `verified` = badge complet ; `boost` = abo sans endosso encore. */
  variant?: 'verified' | 'boost'
  className?: string
  /** Affiche « Endossé par … » sous le badge si fourni. */
  endorsementPlace?: string | null
}

export function MandalaProBadge({
  variant = 'verified',
  className = '',
  endorsementPlace,
}: Props) {
  if (variant === 'boost') {
    return (
      <span
        className={`inline-flex shrink-0 items-center rounded-full border border-slate-600 bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-200 ${className}`}
      >
        Pro
      </span>
    )
  }

  return (
    <span className={`inline-flex min-w-0 max-w-full flex-col gap-0.5 ${className}`}>
      <span className="m-pro-badge">Mandala Pro</span>
      {endorsementPlace ? (
        <span className="truncate text-[10px] text-violet-300/90">
          Endossé par {endorsementPlace}
        </span>
      ) : null}
    </span>
  )
}
