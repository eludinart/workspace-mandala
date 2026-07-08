'use client'

/** Case à cocher : publier sur le mur public (landing). */

export function WallPublicToggle({
  checked,
  onChange,
  disabled,
  id = 'wall-public',
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  id?: string
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
        checked
          ? 'border-sky-500/40 bg-sky-950/30'
          : 'border-slate-700 bg-slate-950/40 hover:border-slate-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-slate-600"
      />
      <span className="min-w-0">
        <span className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
          <span aria-hidden>🌐</span>
          Afficher sur le mur public
        </span>
        <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
          Visible sur la page d&apos;accueil Mandala (landing), pour les visiteurs non connectés.
        </span>
      </span>
    </label>
  )
}

export function WallPublicBadge({ public: isPublic }: { public: boolean }) {
  if (!isPublic) return null
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-sky-500/35 bg-sky-950/40 text-sky-200">
      <span aria-hidden>🌐</span>
      Mur public
    </span>
  )
}
