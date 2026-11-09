'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { skillsApi } from '@/api/skills'
import { CityFromPostalField } from '@/components/geo/CityFromPostalField'
import { useFeatureDoors } from '@/hooks/useFeatureDoors'
import { emitMandalaMapChanged } from '@/lib/map-changed'

type Profile = { city: string; show_on_map: boolean; prompt_done: boolean }

export function MemberCityPrompt() {
  const { can, loading: doorsLoading } = useFeatureDoors()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [city, setCity] = useState('')
  const [showOnMap, setShowOnMap] = useState(true)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    if (!can('carte_membres')) {
      setOpen(false)
      return
    }
    try {
      const res = (await api.get('/api/members/city')) as {
        profile?: Profile
        door_open?: boolean
      }
      const p = res.profile ?? { city: '', show_on_map: false, prompt_done: false }
      setProfile(p)
      setCity(p.city)
      setShowOnMap(p.prompt_done ? p.show_on_map : true)
      setOpen(Boolean(res.door_open) && !p.prompt_done)
    } catch {
      setOpen(false)
    }
  }, [can])

  useEffect(() => {
    if (doorsLoading) return
    void load()
  }, [doorsLoading, load])

  async function syncResidence(nextCity: string) {
    try {
      const skills = await skillsApi.getMine()
      await skillsApi.saveMine({
        scope: skills.profile.scope,
        offer_text: skills.profile.offer_text,
        seek_text: skills.profile.seek_text,
        frame_text: skills.profile.frame_text,
        place_ids: skills.profile.place_ids,
        tags: skills.profile.tags,
        residence_city: nextCity,
        residence_public: skills.profile.residence_public !== false,
        practice_locations: skills.profile.practice_locations,
      })
    } catch {
      /* box membres ok même si fiche compétences échoue */
    }
  }

  async function save(skip = false) {
    setBusy(true)
    try {
      const nextCity = skip ? '' : city.trim()
      await api.put(
        '/api/members/city',
        skip ? { skip_prompt: true } : { city: nextCity, show_on_map: showOnMap }
      )
      if (!skip && nextCity) {
        await syncResidence(nextCity)
      }
      setOpen(false)
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              city: skip ? prev.city : nextCity,
              show_on_map: skip ? prev.show_on_map : showOnMap,
              prompt_done: true,
            }
          : null
      )
      emitMandalaMapChanged()
    } finally {
      setBusy(false)
    }
  }

  if (!open || !profile) return null

  return (
    <section className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-4 space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80">Une fois</p>
        <h3 className="text-sm font-semibold text-slate-100 mt-1">Vous venez de quelle ville ?</h3>
        <p className="text-xs text-slate-400 mt-1">
          Indiquez le code postal, puis choisissez la commune. Elle alimente aussi votre fiche
          (ville de résidence).
        </p>
      </div>
      <CityFromPostalField
        id="member-city-prompt"
        label="Ville de résidence"
        value={city}
        onChange={setCity}
        disabled={busy}
      />
      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={showOnMap}
          onChange={(e) => setShowOnMap(e.target.checked)}
          className="rounded"
        />
        Montrer ma ville sur la carte des membres
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !city.trim()}
          onClick={() => void save(false)}
          className="text-xs px-3 py-1.5 rounded-full bg-emerald-700 text-white disabled:opacity-50"
        >
          Enregistrer
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(true)}
          className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-300"
        >
          Plus tard
        </button>
      </div>
    </section>
  )
}
