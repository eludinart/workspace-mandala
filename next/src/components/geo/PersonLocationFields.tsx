'use client'

import { CityFromPostalField } from '@/components/geo/CityFromPostalField'

export type PersonLocationValue = {
  location_mode: 'city' | 'address'
  residence_city: string
  residence_address: string
  residence_postal_code: string
  latitude: number | null
  longitude: number | null
  residence_public: boolean
}

type Props = {
  value: PersonLocationValue
  onChange: (next: PersonLocationValue) => void
  disabled?: boolean
  idPrefix?: string
}

export function PersonLocationFields({
  value,
  onChange,
  disabled,
  idPrefix = 'person-loc',
}: Props) {
  const patch = (partial: Partial<PersonLocationValue>) => onChange({ ...value, ...partial })

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-sm font-medium text-slate-200">Où vous habitez</p>
      <p className="text-xs text-slate-500 leading-relaxed">
        Ville seule (pin au centre) ou adresse complète (GPS précis, comme pour un lieu).
      </p>
      <div
        className="inline-flex rounded-full border border-slate-700 bg-slate-950/60 p-0.5"
        role="tablist"
        aria-label="Précision de position"
      >
        {(
          [
            ['city', 'Ville seule'],
            ['address', 'Adresse exacte'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={value.location_mode === id}
            disabled={disabled}
            onClick={() =>
              patch({
                location_mode: id,
                latitude: id === 'city' ? null : value.latitude,
                longitude: id === 'city' ? null : value.longitude,
              })
            }
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              value.location_mode === id
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <CityFromPostalField
        id={`${idPrefix}-city`}
        label="Commune"
        hint="Code postal, puis sélection de la ville."
        value={value.residence_city}
        onChange={(residence_city) => patch({ residence_city })}
        disabled={disabled}
      />

      {value.location_mode === 'address' && (
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="text-slate-300">Adresse (rue, n°)</span>
            <input
              value={value.residence_address}
              disabled={disabled}
              onChange={(e) => patch({ residence_address: e.target.value })}
              maxLength={255}
              placeholder="12 rue des Oliviers"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Code postal</span>
            <input
              value={value.residence_postal_code}
              disabled={disabled}
              inputMode="numeric"
              maxLength={5}
              onChange={(e) =>
                patch({ residence_postal_code: e.target.value.replace(/\D/g, '').slice(0, 5) })
              }
              placeholder="83000"
              className="mt-1 w-full max-w-[10rem] rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
            />
          </label>
          {value.latitude != null && value.longitude != null && (
            <p className="text-xs text-emerald-400/90">
              GPS : {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
              <span className="text-slate-500"> — recalculé à l’enregistrement</span>
            </p>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={value.residence_public}
          disabled={disabled}
          onChange={(e) => patch({ residence_public: e.target.checked })}
          className="rounded"
        />
        <span className="text-slate-300">
          Afficher ma position sur mon profil public et la carte
        </span>
      </label>
    </div>
  )
}
