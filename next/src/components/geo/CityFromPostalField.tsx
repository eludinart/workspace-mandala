'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { MAX_CITY_LEN } from '@/lib/practice-locations'

export type PostalCityOption = {
  city: string
  postal_code: string
  insee_code?: string
  latitude?: number
  longitude?: number
}

type Props = {
  label: string
  hint?: string
  value: string
  onChange: (city: string) => void
  disabled?: boolean
  id?: string
}

export function CityFromPostalField({
  label,
  hint,
  value,
  onChange,
  disabled,
  id = 'city-from-postal',
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
      if (cities.length === 0) {
        setError(res.error || 'Aucune commune pour ce code postal')
      }
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

  return (
    <div className="space-y-2">
      <label className="block text-sm" htmlFor={`${id}-postal`}>
        <span className="text-slate-300">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      </label>
      {value ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800/50 bg-emerald-950/40 px-2.5 py-1 text-xs text-emerald-100">
            {value}
            <button
              type="button"
              disabled={disabled}
              aria-label={`Retirer ${value}`}
              onClick={() => onChange('')}
              className="text-emerald-400 hover:text-white disabled:opacity-40"
            >
              ×
            </button>
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange('')
              setPostal('')
              setOptions([])
            }}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Changer
          </button>
        </div>
      ) : (
        <>
          <input
            id={`${id}-postal`}
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            value={postal}
            disabled={disabled}
            onChange={(e) => setPostal(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="Code postal (5 chiffres)"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100"
          />
          {busy && <p className="text-xs text-slate-500">Recherche des communes…</p>}
          {error && <p className="text-xs text-amber-400">{error}</p>}
          {options.length > 0 && (
            <ul className="max-h-40 overflow-auto rounded-lg border border-slate-800 bg-slate-950/80 divide-y divide-slate-800">
              {options.map((opt) => (
                <li key={`${opt.postal_code}-${opt.city}`}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(opt.city.slice(0, MAX_CITY_LEN))
                      setPostal('')
                      setOptions([])
                    }}
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
    </div>
  )
}
