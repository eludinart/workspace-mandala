'use client'

/** Case : ouvrir l’événement / ressource aux lieux amis. */

export function OpenToFriendPlacesToggle({
  checked,
  onChange,
  disabled,
  id = 'open-to-friend-places',
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
          ? 'border-amber-500/40 bg-amber-950/30'
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
        <span className="text-sm font-medium text-slate-200">
          Les lieux amis peuvent s’inscrire
        </span>
        <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
          Les membres des lieux reliés à celui-ci voient l’offre et peuvent y participer.
        </span>
      </span>
    </label>
  )
}
