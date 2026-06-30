'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { PlaceOrgBackLink } from '@/components/place/PlaceOrgBackLink'
import { communitiesApi, type CommunityManagerSettings } from '@/api/communities'
import { CharterEditor, CharterPreview } from '@/components/place/CharterEditor'
import { CommunityAvatar } from '@/components/CommunityAvatar'
import { useCommunity } from '@/contexts/CommunityContext'
import { useNavAccess } from '@/hooks/useNavAccess'
import { ApiError } from '@/lib/api-client'
import type { CharterBlock } from '@/lib/community-charter'
import { compressAvatarImage } from '@/lib/compress-avatar-image'
import { isAvatarImageUrl } from '@/lib/user-avatar'

type Tab = 'profile' | 'charter'

export function PlaceSettingsPage({
  section,
  onNavigate,
}: {
  section?: Tab
  onNavigate?: MandalaNavigate
}) {
  const { active, refresh } = useCommunity()
  const { canManageActiveCommunity } = useNavAccess()
  const lockedSection = section ?? null
  const [tab, setTab] = useState<Tab>(lockedSection ?? 'profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [msgOk, setMsgOk] = useState(true)

  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [website, setWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [emoji, setEmoji] = useState('🏛️')
  const [color, setColor] = useState('#7c3aed')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [loadedAvatar, setLoadedAvatar] = useState<string | null>(null)
  const [charter, setCharter] = useState<CharterBlock[]>([])
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    if (lockedSection) setTab(lockedSection)
  }, [lockedSection])

  const activeTab = lockedSection ?? tab

  const applySettings = useCallback((s: CommunityManagerSettings) => {
    setName(s.name)
    setTagline(s.tagline ?? '')
    setDescription(s.description ?? '')
    setLocation(s.location ?? '')
    setLatitude(s.latitude != null ? String(s.latitude) : '')
    setLongitude(s.longitude != null ? String(s.longitude) : '')
    setWebsite(s.website ?? '')
    setEmail(s.contact_email ?? '')
    setEmoji(s.logo_emoji ?? '🏛️')
    setColor(s.accent_color ?? '#7c3aed')
    setLoadedAvatar(isAvatarImageUrl(s.avatar) ? s.avatar : null)
    setAvatar(null)
    setCharter(s.charter ?? [])
  }, [])

  const load = useCallback(async () => {
    if (!active?.slug) return
    setLoading(true)
    setMsg(null)
    try {
      const data = await communitiesApi.getSettings(active.slug)
      applySettings(data.settings)
    } catch (e: unknown) {
      const err = e instanceof ApiError ? e.detail : 'Impossible de charger les paramètres'
      setMsg(err)
      setMsgOk(false)
    } finally {
      setLoading(false)
    }
  }, [active?.slug, applySettings])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!active?.slug) return
    setSaving(true)
    setMsg(null)
    try {
      const body: Record<string, unknown> = {
        name,
        tagline: tagline || null,
        description: description || null,
        location: location || null,
        latitude: latitude.trim() ? Number(latitude) : null,
        longitude: longitude.trim() ? Number(longitude) : null,
        website: website || null,
        contact_email: email || null,
        logo_emoji: emoji,
        accent_color: color,
        charter,
      }
      if (avatar !== null) body.avatar = avatar
      const data = await communitiesApi.updateSettings(active.slug, body)
      applySettings(data.settings)
      await refresh()
      setMsg('Paramètres enregistrés.')
      setMsgOk(true)
    } catch (e: unknown) {
      const err = e instanceof ApiError ? e.detail : 'Erreur à l’enregistrement'
      setMsg(err)
      setMsgOk(false)
    } finally {
      setSaving(false)
    }
  }

  if (!active) {
    return (
      <p className="text-slate-500 p-4">
        Ouvrez un lieu depuis <strong className="text-slate-300">Mes lieux</strong> pour modifier son
        profil ou sa charte.
      </p>
    )
  }

  if (!canManageActiveCommunity) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center space-y-2">
        <p className="text-lg font-semibold">Accès réservé</p>
        <p className="text-sm text-slate-400">
          Seuls les gestionnaires du lieu ({active.name}) peuvent modifier ces paramètres.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {onNavigate && active?.slug && (
        <PlaceOrgBackLink onNavigate={onNavigate} hubSlug={active.slug} />
      )}
      <header className="space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-sky-400/90 font-semibold">Organisation</p>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span aria-hidden>{emoji}</span>
          {activeTab === 'charter' ? 'Charte du lieu' : 'Profil du lieu'}
        </h1>
        <p className="text-sm text-slate-400">
          {active.name}
          {activeTab === 'charter'
            ? ' — règles, valeurs et informations pour les membres.'
            : ' — identité publique, contact et présentation.'}
        </p>
      </header>

      {msg && (
        <p className={`text-sm rounded-lg px-3 py-2 ${msgOk ? 'bg-emerald-950/50 text-emerald-200' : 'bg-red-950/50 text-red-200'}`}>
          {msg}
        </p>
      )}

      {!lockedSection && (
        <div className="flex gap-2 border-b border-slate-800 pb-1">
          {(
            [
              ['profile', 'Profil du lieu'],
              ['charter', 'Charte'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-2 text-sm rounded-t-lg border-b-2 -mb-px ${
                activeTab === id ? 'border-sky-500 text-slate-100 font-medium' : 'border-transparent text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Chargement…</p>
      ) : activeTab === 'profile' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <CommunityAvatar
              logoEmoji={emoji}
              avatar={avatar ?? loadedAvatar}
              accentColor={color}
              size="lg"
              alt={name}
            />
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  const { dataUrl, error } = await compressAvatarImage(file)
                  if (error || !dataUrl) {
                    setMsg(error ?? 'Image invalide')
                    setMsgOk(false)
                    return
                  }
                  setAvatar(dataUrl)
                }}
                className="text-xs text-slate-400"
              />
              {(avatar || loadedAvatar) && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatar('')
                    setLoadedAvatar(null)
                  }}
                  className="text-xs text-red-400"
                >
                  Retirer la photo
                </button>
              )}
            </div>
          </div>

          <label className="block">
            <span className="text-slate-500 text-xs">Nom du lieu</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-slate-500 text-xs">Accroche</span>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-slate-500 text-xs">Présentation</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 resize-y"
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-slate-500 text-xs">Localisation (ville, pays)</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ex. Toulouse, France"
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-slate-500 text-xs">Site web</span>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
              />
            </label>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-slate-500 text-xs">Latitude (carte publique)</span>
              <input
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                type="number"
                step="any"
                min={-90}
                max={90}
                placeholder="ex. 43.6047"
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-slate-500 text-xs">Longitude (carte publique)</span>
              <input
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                type="number"
                step="any"
                min={-180}
                max={180}
                placeholder="ex. 1.4442"
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
              />
            </label>
          </div>
          <p className="text-xs text-slate-500 -mt-1">
            Les coordonnées GPS positionnent le lieu sur la carte de la page d&apos;accueil publique.
          </p>
          <label className="block">
            <span className="text-slate-500 text-xs">Contact</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-slate-500 text-xs">Emoji</span>
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={4}
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-slate-500 text-xs">Couleur</span>
              <input
                type="color"
                value={color.startsWith('#') ? color : '#7c3aed'}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 w-full h-10 rounded-lg bg-slate-950 border border-slate-700"
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-400">
              Règles, valeurs et informations importantes pour les membres.
            </p>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className="text-xs px-2 py-1 rounded border border-slate-700 text-slate-400"
            >
              {preview ? 'Éditer' : 'Aperçu'}
            </button>
          </div>
          {preview ? (
            <CharterPreview blocks={charter} />
          ) : (
            <CharterEditor blocks={charter} onChange={setCharter} disabled={saving} />
          )}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          disabled={saving || loading}
          onClick={() => void save()}
          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
