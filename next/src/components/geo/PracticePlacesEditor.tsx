'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import {
  MAX_CITY_LEN,
  MAX_PRACTICE_LOCATIONS,
  type PracticePlace,
} from '@/lib/practice-locations'
import type { PostalCityOption } from '@/components/geo/CityFromPostalField'

type Props = {
  value: PracticePlace[]
  onChange: (places: PracticePlace[]) => void
  disabled?: boolean
  label?: string
  hint?: string
}

function emptyDraft(): PracticePlace {
  return {
    city: '',
    mode: 'city',
    address: '',
    postal_code: '',
    latitude: null,
    longitude: null,
  }
}

export function PracticePlacesEditor({
  value,
  onChange,
  disabled,
  label = 'Lieux d’exercice',
  hint = 'Villes où vous exercez. Option adresse exacte pour un pin GPS précis sur la carte.',
}: Props) {
  const [postal, setPostal] = useState('')
  const [options, setOptions] = useState<PostalCityOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<PracticePlace>(emptyDraft())

  const lookup = useCallback(async (code: string) => {
    if (!/^\d{5}$/.test(code)) {
      setOptions([])
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = (await api.get(
        `/api/geo/postal-cities?code=${encodeURIComponent(code)}`
      )) as { cities?: PostalCityOption[]; error?: string }
      const cities = res.cities ?? []
      setOptions(cities)
      if (cities.length === 0) setError(res.error || 'Aucune commune pour ce code postal')
    } catch {
      setOptions([])
      setError('Impossible de charger les communes')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (postal.length !== 5) {
      setOptions([])
      setError(null)
      return
    }
    const t = window.setTimeout(() => void lookup(postal), 280)
    return () => window.clearTimeout(t)
  }, [postal, lookup])

  const addCity = (city: string, postalCode?: string) => {
    const labelCity = city.trim().slice(0, MAX_CITY_LEN)
    if (!labelCity) return
    const key = labelCity.toLocaleLowerCase('fr')
    if (value.some((c) => c.city.toLocaleLowerCase('fr') === key)) return
    if (value.length >= MAX_PRACTICE_LOCATIONS) return
    onChange([
      ...value,
      {
        ...draft,
        city: labelCity,
        postal_code: (postalCode || draft.postal_code || postal).replace(/\D/g, '').slice(0, 10),
        latitude: draft.mode === 'address' ? draft.latitude : null,
        longitude: draft.mode === 'address' ? draft.longitude : null,
      },
    ])
    setPostal('')
    setOptions([])
    setDraft(emptyDraft())
  }

  const updatePlace = (index: number, partial: Partial<PracticePlace>) => {
    onChange(
      value.map((p, i) => {
        if (i !== index) return p
        const next = { ...p, ...partial }
        if (next.mode === 'city') {
          next.latitude = null
          next.longitude = null
        }
        return next
      })
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div>
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {hint && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{hint}</p>}
      </div>

      <ul className="space-y-3">
        {value.map((place, index) => (
          <li
            key={`${place.city}-${index}`}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-sky-100">{place.city}</p>
              <button
                type="button"
                disabled={disabled}
                className="text-xs text-red-400 hover:underline disabled:opacity-40"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                Retirer
              </button>
            </div>
            <div
              className="inline-flex rounded-full border border-slate-700 bg-slate-950/60 p-0.5"
              role="tablist"
            >
              {(
                [
                  ['city', 'Ville seule'],
                  ['address', 'Adresse exacte'],
                ] as const
              ).map(([id, tabLabel]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={place.mode === id}
                  disabled={disabled}
                  onClick={() => updatePlace(index, { mode: id })}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                    place.mode === id
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tabLabel}
                </button>
              ))}
            </div>
            {place.mode === 'address' && (
              <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
                <label className="block text-xs text-slate-400">
                  Adresse (rue, n°)
                  <input
                    value={place.address}
                    disabled={disabled}
                    maxLength={255}
                    onChange={(e) => updatePlace(index, { address: e.target.value })}
                    placeholder="12 rue des Oliviers"
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                  />
                </label>
                <label className="block text-xs text-slate-400">
                  Code postal
                  <input
                    value={place.postal_code}
                    disabled={disabled}
                    inputMode="numeric"
                    maxLength={5}
                    onChange={(e) =>
                      updatePlace(index, {
                        postal_code: e.target.value.replace(/\D/g, '').slice(0, 5),
                      })
                    }
                    placeholder="83000"
                    className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                  />
                </label>
                {place.latitude != null && place.longitude != null && (
                  <p className="sm:col-span-2 text-[11px] text-emerald-400/90">
                    GPS : {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)} — recalculé à
                    l’enregistrement
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {value.length < MAX_PRACTICE_LOCATIONS && (
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <p className="text-xs text-slate-400">Ajouter un lieu</p>
          <div
            className="inline-flex rounded-full border border-slate-700 bg-slate-950/60 p-0.5"
            role="tablist"
          >
            {(
              [
                ['city', 'Ville seule'],
                ['address', 'Adresse exacte'],
              ] as const
            ).map(([id, tabLabel]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={draft.mode === id}
                disabled={disabled}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    mode: id,
                    latitude: id === 'city' ? null : d.latitude,
                    longitude: id === 'city' ? null : d.longitude,
                  }))
                }
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                  draft.mode === id
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tabLabel}
              </button>
            ))}
          </div>
          {draft.mode === 'address' && (
            <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
              <input
                value={draft.address}
                disabled={disabled}
                maxLength={255}
                onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
                placeholder="Adresse (rue, n°)"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
              />
              <input
                value={draft.postal_code || postal}
                disabled={disabled}
                inputMode="numeric"
                maxLength={5}
                onChange={(e) => {
                  const code = e.target.value.replace(/\D/g, '').slice(0, 5)
                  setDraft((d) => ({ ...d, postal_code: code }))
                  setPostal(code)
                }}
                placeholder="CP"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
              />
            </div>
          )}
          <input
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            value={postal}
            disabled={disabled}
            onChange={(e) => {
              const code = e.target.value.replace(/\D/g, '').slice(0, 5)
              setPostal(code)
              if (draft.mode === 'address') {
                setDraft((d) => ({ ...d, postal_code: code }))
              }
            }}
            placeholder="Code postal → choisir la commune"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
          />
          {busy && <p className="text-xs text-slate-500">Recherche…</p>}
          {error && <p className="text-xs text-amber-400">{error}</p>}
          {options.length > 0 && (
            <ul className="max-h-36 overflow-auto rounded-lg border border-slate-800 bg-slate-950/80 divide-y divide-slate-800">
              {options.map((opt) => (
                <li key={`${opt.postal_code}-${opt.city}`}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => addCity(opt.city, opt.postal_code)}
                    className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900"
                  >
                    {opt.city}
                    <span className="ml-2 text-xs text-slate-500">{opt.postal_code}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
