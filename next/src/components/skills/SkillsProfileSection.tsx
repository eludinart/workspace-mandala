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
  SKILL_REGISTER_LABELS,
  SKILL_REGISTERS,
  type SkillRegister,
  type SkillScope,
} from '@/lib/skill-constants'

const EMPTY: SkillProfile = {
  user_id: 0,
  scope: 'hidden',
  offer_text: '',
  seek_text: '',
  frame_text: '',
  updated_at: null,
  place_ids: [],
  places: [],
  tags: [],
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
    if (draftLabel.trim()) return true
    return JSON.stringify(profile) !== savedRef.current
  }, [profile, draftLabel])

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

  /** Intègre le brouillon dans la liste (mobile : souvent pas d’Entrée avant Enregistrer). */
  const commitDraftTag = (
    tags: SkillTag[],
    raw: string,
  ): { tags: SkillTag[]; draft: string; error: string | null } => {
    const label = raw.trim().replace(/\s+/g, ' ')
    if (!label) return { tags, draft: '', error: null }
    if (tags.length >= MAX_SKILL_TAGS) {
      return { tags, draft: raw, error: `Maximum ${MAX_SKILL_TAGS} savoir-faire` }
    }
    const key = label.toLocaleLowerCase('fr')
    if (tags.some((t) => t.label.toLocaleLowerCase('fr') === key)) {
      return { tags, draft: '', error: null }
    }
    return {
      tags: [...tags, { label: label.slice(0, 40), register: 'share' }],
      draft: '',
      error: null,
    }
  }

  const save = async () => {
    setSaving(true)
    setMsg(null)
    setErr(null)
    const committed = commitDraftTag(profile.tags, draftLabel)
    if (committed.error) {
      setErr(committed.error)
      setSaving(false)
      return
    }
    const tagsToSave = committed.tags
    if (tagsToSave !== profile.tags) {
      setProfile((p) => ({ ...p, tags: tagsToSave }))
      setDraftLabel(committed.draft)
    }
    try {
      const res = await skillsApi.saveMine({
        scope: profile.scope,
        offer_text: profile.offer_text,
        seek_text: profile.seek_text,
        frame_text: profile.frame_text,
        place_ids: profile.place_ids,
        tags: tagsToSave,
      })
      setProfile(res.profile)
      setDraftLabel('')
      savedRef.current = JSON.stringify(res.profile)
      setMsg('Fiche enregistrée')
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const addTag = () => {
    const committed = commitDraftTag(profile.tags, draftLabel)
    if (committed.error) {
      setErr(committed.error)
      return
    }
    setErr(null)
    setProfile((p) => ({ ...p, tags: committed.tags }))
    setDraftLabel(committed.draft)
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
  const visibilityChoices =
    communities.length === 0
      ? ([
          ['hidden', 'Personne'],
          ['mandala', 'Tout Mandala'],
        ] as const)
      : ([
          ['hidden', 'Personne'],
          ['places', 'Les membres de mes lieux'],
          ['mandala', 'Tout Mandala'],
        ] as const)
  const visibilityPreview =
    communities.length === 0 && profile.scope === 'places'
      ? 'Cette visibilité dépendait d’un lieu. Choisissez Personne ou Tout Mandala.'
      : profile.scope === 'hidden'
        ? 'Seuls vous la voyez.'
        : profile.scope === 'mandala'
          ? 'Toute personne sur Mandala verra votre fiche, y compris dans l’annuaire.'
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
        Dites ce que vous savez faire, ce que vous proposez au collectif, et ce que vous cherchez. La fiche reste cachée tant que vous ne choisissez pas qui peut la voir.
      </p>

      <fieldset className="space-y-2">
        <legend className="text-sm text-slate-200">Qui peut me trouver ?</legend>
        {visibilityChoices.map(([id, label]) => (
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
        <p className="text-xs text-slate-500">
          Outils et tâches concrètes : rédaction, logistique, artisanat, montage. Pas de posture ici.
        </p>
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
              enterKeyHint="done"
              maxLength={40}
              placeholder="ex. logistique, rédaction…"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-2 text-sm text-slate-100"
            />
          </label>
          <button
            type="button"
            onClick={addTag}
            disabled={!draftLabel.trim() || profile.tags.length >= MAX_SKILL_TAGS}
            className="shrink-0 rounded-lg border border-violet-700/70 bg-violet-950/50 px-3 py-2 text-sm text-violet-100 hover:bg-violet-900/50 disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Tapez un savoir-faire, puis Ajouter — ou Enregistrer : le texte en cours est inclus.
        </p>
      </div>

      <label className="block text-sm">
        <span className="text-slate-300">Ce que je peux apporter</span>
        <span className="mt-1 block text-xs text-slate-500">
          Missions et rôles dans la vie du collectif, pas une liste de qualités.
        </span>
        <textarea
          value={profile.offer_text}
          maxLength={MAX_SKILL_TEXT}
          rows={8}
          placeholder="Faciliter une réunion de cadrage, relire un document d’accords, un coup de main logistique ponctuel…"
          onChange={(e) => setProfile((p) => ({ ...p, offer_text: e.target.value }))}
          className="mt-1 w-full min-h-40 resize-y rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 leading-relaxed"
        />
        <span className="mt-1 block text-xs text-slate-500">
          {profile.offer_text.length}/{MAX_SKILL_TEXT}
        </span>
      </label>
      <label className="block text-sm">
        <span className="text-slate-300">Ce que je cherche</span>
        <span className="mt-1 block text-xs text-slate-500">
          Besoins matériels et relationnels : cadre, rythme, ce que vous aimeriez partager ou recevoir.
        </span>
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
      <label className="block text-sm">
        <span className="text-slate-300">Mon cadre</span>
        <span className="mt-1 block text-xs text-slate-500">
          Optionnel. Disponibilité, rythme, et ce que vous ne faites pas.
        </span>
        <textarea
          value={profile.frame_text}
          maxLength={MAX_SKILL_TEXT}
          rows={4}
          onChange={(e) => setProfile((p) => ({ ...p, frame_text: e.target.value }))}
          className="mt-1 w-full min-h-24 resize-y rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 leading-relaxed"
        />
        <span className="mt-1 block text-xs text-slate-500">
          {profile.frame_text.length}/{MAX_SKILL_TEXT}
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
