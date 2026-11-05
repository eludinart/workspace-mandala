'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { MAX_CITY_LEN, MAX_PRACTICE_LOCATIONS } from '@/lib/practice-locations'
import type { PostalCityOption } from '@/components/geo/CityFromPostalField'

type Props = {
  value: string[]
  onChange: (cities: string[]) => void
  disabled?: boolean
  label?: string
  hint?: string
}

export function PracticeCitiesFromPostal({
  value,
  onChange,
  disabled,
  label = 'Lieux d’exercice',
  hint = 'Code postal, puis choisissez la commune. Plusieurs possibles.',
}: Props) {
  const [postal, setPostal] = useState('')
  const [options, setOptions] = useState<PostalCityOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const addCity = (city: string) => {
    const labelCity = city.trim().slice(0, MAX_CITY_LEN)
    if (!labelCity) return
    const key = labelCity.toLocaleLowerCase('fr')
    if (value.some((c) => c.toLocaleLowerCase('fr') === key)) return
    if (value.length >= MAX_PRACTICE_LOCATIONS) return
    onChange([...value, labelCity])
    setPostal('')
    setOptions([])
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm text-slate-300">{label}</p>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((city) => (
          <span
            key={city}
            className="inline-flex items-center gap-1 rounded-full border border-sky-800/50 bg-sky-950/40 px-2.5 py-1 text-xs text-sky-100"
          >
            {city}
            <button
              type="button"
              disabled={disabled}
              className="text-sky-400 hover:text-white disabled:opacity-40"
              aria-label={`Retirer ${city}`}
              onClick={() => onChange(value.filter((c) => c !== city))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {value.length < MAX_PRACTICE_LOCATIONS && (
        <>
          <input
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            value={postal}
            disabled={disabled}
            onChange={(e) => setPostal(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="Ajouter · code postal"
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
                    onClick={() => addCity(opt.city)}
                    className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900"
                  >
                    {opt.city}
                    <span className="ml-2 text-xs text-slate-500">{opt.postal_code}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {value.length >= MAX_PRACTICE_LOCATIONS && (
        <p className="text-xs text-slate-500">Maximum {MAX_PRACTICE_LOCATIONS} lieux.</p>
      )}
    </div>
  )
}
