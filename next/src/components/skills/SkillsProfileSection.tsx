'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

declare global {
  interface Window {
    __mdlSkillsDirty?: boolean
  }
}

export const ACCOUNT_SKILLS_ANCHOR = 'mandala_account_anchor'
import { skillsApi, type SkillProfile, type SkillTag } from '@/api/skills'
import { useCommunity } from '@/contexts/CommunityContext'
import { ApiError } from '@/lib/api-client'
import {
  MAX_SKILL_TAGS,
  MAX_SKILL_TEXT,
  MAX_SKILL_TRAITS,
  SKILL_REGISTER_LABELS,
  SKILL_REGISTERS,
  SKILL_TRAITS,
  type SkillRegister,
  type SkillScope,
  type SkillTraitCode,
} from '@/lib/skill-constants'

const EMPTY: SkillProfile = {
  user_id: 0,
  scope: 'hidden',
  offer_text: '',
  seek_text: '',
  updated_at: null,
  place_ids: [],
  places: [],
  tags: [],
  traits: [],
}

export function SkillsProfileSection() {
  const { communities } = useCommunity()
  const [profile, setProfile] = useState<SkillProfile>(EMPTY)
  const [draftLabel, setDraftLabel] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const savedRef = useRef('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await skillsApi.getMine()
      setProfile(res.profile)
      savedRef.current = JSON.stringify(res.profile)
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Impossible de charger la fiche')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = useMemo(() => {
    if (!savedRef.current) return false
    return JSON.stringify(profile) !== savedRef.current
  }, [profile])

  useEffect(() => {
    window.__mdlSkillsDirty = dirty
    if (!dirty) return
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.removeEventListener('beforeunload', onLeave)
      if (!dirty) window.__mdlSkillsDirty = false
    }
  }, [dirty])

  useEffect(() => {
    return () => {
      window.__mdlSkillsDirty = false
    }
  }, [])

  const save = async () => {
    setSaving(true)
    setMsg(null)
    setErr(null)
    try {
      const res = await skillsApi.saveMine({
        scope: profile.scope,
        offer_text: profile.offer_text,
        seek_text: profile.seek_text,
        place_ids: profile.place_ids,
        tags: profile.tags,
        traits: profile.traits,
      })
      setProfile(res.profile)
      savedRef.current = JSON.stringify(res.profile)
      setMsg('Fiche enregistrée')
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const addTag = () => {
    const label = draftLabel.trim().replace(/\s+/g, ' ')
    if (!label) return
    if (profile.tags.length >= MAX_SKILL_TAGS) return
    const key = label.toLocaleLowerCase('fr')
    if (profile.tags.some((t) => t.label.toLocaleLowerCase('fr') === key)) {
      setDraftLabel('')
      return
    }
    const tag: SkillTag = { label: label.slice(0, 40), register: 'share' }
    setProfile((p) => ({ ...p, tags: [...p.tags, tag] }))
    setDraftLabel('')
  }

  const toggleTrait = (code: SkillTraitCode) => {
    setProfile((p) => {
      if (p.traits.includes(code)) return { ...p, traits: p.traits.filter((c) => c !== code) }
      if (p.traits.length >= MAX_SKILL_TRAITS) return p
      return { ...p, traits: [...p.traits, code] }
    })
  }

  const setTagRegister = (label: string, register: SkillRegister) => {
    setProfile((p) => ({
      ...p,
      tags: p.tags.map((t) => (t.label === label ? { ...t, register } : t)),
    }))
  }

  const placeNames = communities
    .filter((c) => profile.place_ids.includes(c.id))
    .map((c) => c.name)
  const visibilityPreview =
    profile.scope === 'hidden'
      ? 'Seuls vous la voyez.'
      : profile.scope === 'mandala'
        ? 'Toute personne sur Mandala verra votre fiche, y compris sur la page d’accueil.'
        : placeNames.length
          ? `Les membres de ${placeNames.join(', ')} verront votre fiche.`
          : 'Cochez au moins un lieu, sinon personne d’autre ne la voit.'

  const togglePlace = (id: number) => {
    setProfile((p) => ({
      ...p,
      place_ids: p.place_ids.includes(id) ? p.place_ids.filter((x) => x !== id) : [...p.place_ids, id],
    }))
  }

  const publish = async () => {
    setPublishing(true)
    setMsg(null)
    setErr(null)
    try {
      await skillsApi.createNote(note)
      setNote('')
      setMsg('Brève publiée sur le fil Personnes')
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Publication impossible')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Chargement de la fiche…</p>

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-5">
      <p className="text-sm text-slate-400">
        Décrivez ce que vous pouvez apporter. La fiche reste cachée tant que vous ne choisissez pas qui peut la voir.
      </p>

      <fieldset className="space-y-2">
        <legend className="text-sm text-slate-200">Qui peut me trouver ?</legend>
        {(
          [
            ['hidden', 'Personne'],
            ['places', 'Les membres de mes lieux'],
            ['mandala', 'Tout Mandala'],
          ] as const
        ).map(([id, label]) => (
          <label key={id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="skill-scope"
              checked={profile.scope === id}
              onChange={() => setProfile((p) => ({ ...p, scope: id as SkillScope }))}
            />
            <span className="text-slate-100">{label}</span>
          </label>
        ))}
        <p className="text-sm text-violet-200/90">{visibilityPreview}</p>
      </fieldset>

      {profile.scope === 'places' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-300">Lieux où la fiche est visible</p>
          {communities.length === 0 && (
            <p className="text-xs text-slate-500">Rejoignez un lieu pour limiter la fiche à celui-ci.</p>
          )}
          <ul className="space-y-1">
            {communities.map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profile.place_ids.includes(c.id)}
                    onChange={() => togglePlace(c.id)}
                  />
                  <span>
                    {c.logo_emoji ? `${c.logo_emoji} ` : ''}
                    {c.name}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-slate-300">Savoir-faire</p>
        <div className="flex flex-wrap gap-2">
          {profile.tags.map((tag) => (
            <span
              key={`${tag.label}-${tag.register}`}
              className="inline-flex flex-wrap items-center gap-2 rounded-full border border-violet-800/50 bg-violet-950/40 px-2.5 py-1 text-xs"
            >
              <span>{tag.label}</span>
              <select
                value={tag.register}
                aria-label={`Registre de ${tag.label}`}
                onChange={(e) => setTagRegister(tag.label, e.target.value as SkillRegister)}
                className="rounded bg-slate-950 border border-slate-700 text-[11px] text-violet-100"
              >
                {SKILL_REGISTERS.map((id) => (
                  <option key={id} value={id}>
                    {SKILL_REGISTER_LABELS[id]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="text-slate-400 hover:text-white"
                aria-label={`Retirer ${tag.label}`}
                onClick={() =>
                  setProfile((p) => ({ ...p, tags: p.tags.filter((t) => t.label !== tag.label) }))
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex-1 min-w-[140px] text-xs text-slate-500">
            Ajouter un savoir-faire
            <input
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
              maxLength={40}
              placeholder="Entrée pour ajouter"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-2 text-sm text-slate-100"
            />
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-slate-300">Savoir-être · {profile.traits.length}/{MAX_SKILL_TRAITS}</p>
        <div className="flex flex-wrap gap-2">
          {SKILL_TRAITS.map((trait) => {
            const on = profile.traits.includes(trait.code)
            return (
              <button
                key={trait.code}
                type="button"
                onClick={() => toggleTrait(trait.code)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  on
                    ? 'border-violet-500 bg-violet-600/30 text-violet-100'
                    : 'border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {trait.label}
              </button>
            )
          })}
        </div>
      </div>

      <label className="block text-sm">
        <span className="text-slate-300">Ce que je peux apporter</span>
        <textarea
          value={profile.offer_text}
          maxLength={MAX_SKILL_TEXT}
          rows={8}
          onChange={(e) => setProfile((p) => ({ ...p, offer_text: e.target.value }))}
          className="mt-1 w-full min-h-40 resize-y rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 leading-relaxed"
        />
        <span className="mt-1 block text-xs text-slate-500">
          {profile.offer_text.length}/{MAX_SKILL_TEXT}
        </span>
      </label>
      <label className="block text-sm">
        <span className="text-slate-300">Ce que je cherche</span>
        <textarea
          value={profile.seek_text}
          maxLength={MAX_SKILL_TEXT}
          rows={6}
          onChange={(e) => setProfile((p) => ({ ...p, seek_text: e.target.value }))}
          className="mt-1 w-full min-h-32 resize-y rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 leading-relaxed"
        />
        <span className="mt-1 block text-xs text-slate-500">
          {profile.seek_text.length}/{MAX_SKILL_TEXT}
        </span>
      </label>

      {msg && <p className="text-emerald-400 text-sm">{msg}</p>}
      {err && <p className="text-red-400 text-sm">{err}</p>}
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="w-full py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
      >
        {saving ? 'Enregistrement…' : dirty ? 'Enregistrer les modifications' : 'Enregistrer la fiche'}
      </button>

      {profile.scope !== 'hidden' && !dirty && (
      <div className="border-t border-slate-800 pt-4 space-y-2">
        <p className="text-sm text-slate-300">Brève sur le fil Personnes</p>
        <p className="text-xs text-slate-500">
          La brève reprend la portée actuelle de la fiche. La modifier ensuite ne change pas les brèves déjà publiées.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Une nouvelle sur ce que vous savez faire…"
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={publishing || !note.trim()}
          onClick={() => void publish()}
          className="text-sm px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-800 disabled:opacity-40"
        >
          {publishing ? 'Publication…' : 'Publier'}
        </button>
      </div>
      )}
    </div>
  )
}
