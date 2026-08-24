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
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('France')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoMsg, setGeoMsg] = useState<string | null>(null)
  const [website, setWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [emoji, setEmoji] = useState('🏛️')
  const [color, setColor] = useState('#7c3aed')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [loadedAvatar, setLoadedAvatar] = useState<string | null>(null)
  const [charter, setCharter] = useState<CharterBlock[]>([])
  const [listedPublic, setListedPublic] = useState(true)
  const [profilePublic, setProfilePublic] = useState(true)
  const [joinMode, setJoinMode] = useState<'open' | 'invite' | 'closed'>('open')
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    if (lockedSection) setTab(lockedSection)
  }, [lockedSection])

  const activeTab = lockedSection ?? tab

  const applySettings = useCallback((s: CommunityManagerSettings) => {
    setName(s.name)
    setTagline(s.tagline ?? '')
    setDescription(s.description ?? '')
    setAddress(s.address ?? '')
    setPostalCode(s.postal_code ?? '')
    setCity(s.city ?? '')
    setCountry(s.country ?? 'France')
    setLatitude(s.latitude != null ? String(s.latitude) : '')
    setLongitude(s.longitude != null ? String(s.longitude) : '')
    setGeoMsg(null)
    setWebsite(s.website ?? '')
    setEmail(s.contact_email ?? '')
    setEmoji(s.logo_emoji ?? '🏛️')
    setColor(s.accent_color ?? '#7c3aed')
    setLoadedAvatar(isAvatarImageUrl(s.avatar) ? s.avatar : null)
    setAvatar(null)
    setCharter(s.charter ?? [])
    setListedPublic(s.listed_public !== false)
    setProfilePublic(s.profile_public !== false)
    setJoinMode(s.join_mode === 'invite' || s.join_mode === 'closed' ? s.join_mode : 'open')
    setInviteCode(s.invite_code ?? null)
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
        address: address || null,
        postal_code: postalCode || null,
        city: city || null,
        country: country || null,
        location: [city, country].filter(Boolean).join(', ') || null,
        latitude: latitude.trim() ? Number(latitude) : null,
        longitude: longitude.trim() ? Number(longitude) : null,
        website: website || null,
        contact_email: email || null,
        logo_emoji: emoji,
        accent_color: color,
        charter,
        listed_public: listedPublic,
        profile_public: profilePublic,
        join_mode: joinMode,
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

  const locate = async () => {
    if (!active?.slug) return
    setGeoBusy(true)
    setGeoMsg(null)
    try {
      const { result } = await communitiesApi.geocode(active.slug, {
        address: address || null,
        postal_code: postalCode || null,
        city: city || null,
        country: country || null,
      })
      setLatitude(String(result.latitude))
      setLongitude(String(result.longitude))
      setGeoMsg(`Position trouvée : ${result.display_name}`)
    } catch (e: unknown) {
      const err = e instanceof ApiError ? e.detail : 'Adresse introuvable'
      setGeoMsg(typeof err === 'string' ? err : 'Adresse introuvable')
    } finally {
      setGeoBusy(false)
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
          <fieldset className="space-y-3 rounded-xl border border-slate-800 p-3">
            <legend className="px-1 text-xs uppercase tracking-widest text-slate-400">
              Adresse du lieu
            </legend>
            <label className="block">
              <span className="text-slate-500 text-xs">Adresse (n° et rue)</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="ex. 12 rue de la Paix"
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
              />
            </label>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-slate-500 text-xs">Code postal</span>
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="ex. 31000"
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-slate-500 text-xs">Ville</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="ex. Toulouse"
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-slate-500 text-xs">Pays</span>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="ex. France"
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => void locate()}
                disabled={geoBusy || (!address && !postalCode && !city)}
                className="text-sm px-3 py-2 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white disabled:opacity-50"
              >
                {geoBusy ? 'Localisation…' : '📍 Localiser sur la carte'}
              </button>
              {latitude && longitude && (
                <span className="text-xs text-slate-400">
                  {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
                </span>
              )}
            </div>
            {geoMsg && <p className="text-xs text-slate-400">{geoMsg}</p>}

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-slate-500 text-xs">Latitude</span>
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
                <span className="text-slate-500 text-xs">Longitude</span>
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
            <p className="text-xs text-slate-500">
              Renseignez l&apos;adresse puis cliquez sur « Localiser » pour positionner
              automatiquement le lieu. Les coordonnées peuvent être ajustées manuellement. À
              l&apos;enregistrement, si aucune coordonnée n&apos;est saisie, elles sont calculées à
              partir de l&apos;adresse.
            </p>
          </fieldset>
          <fieldset className="space-y-3 rounded-xl border border-slate-800 p-3">
            <legend className="px-1 text-xs uppercase tracking-widest text-slate-400">
              Visibilité publique
            </legend>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={listedPublic}
                onChange={(e) => setListedPublic(e.target.checked)}
                className="mt-1 rounded border-slate-600 text-sky-600 focus:ring-sky-500"
              />
              <span>
                <span className="block text-sm text-slate-200 font-medium">
                  Afficher sur la page d&apos;accueil et la carte
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Le lieu apparaît dans le catalogue public Mandala et sur la carte des lieux
                  (si des coordonnées GPS sont renseignées).
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={profilePublic}
                onChange={(e) => setProfilePublic(e.target.checked)}
                className="mt-1 rounded border-slate-600 text-sky-600 focus:ring-sky-500"
              />
              <span>
                <span className="block text-sm text-slate-200 font-medium">
                  Profil du lieu public
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Une page publique /lieux/{active.slug} est accessible sans compte. Si désactivé,
                  seuls les membres connectés voient le lieu depuis l&apos;application.
                </span>
              </span>
            </label>
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-slate-800 p-3">
            <legend className="px-1 text-xs uppercase tracking-widest text-slate-400">
              Adhésion au lieu
            </legend>
            <p className="text-xs text-slate-500">
              Par défaut le lieu est ouvert. Activez l’invitation seulement si vous voulez
              contrôler qui entre (le code se génère automatiquement).
            </p>
            <label className="block space-y-1">
              <span className="text-xs text-slate-500">Qui peut rejoindre ?</span>
              <select
                value={joinMode}
                onChange={(e) =>
                  setJoinMode(e.target.value as 'open' | 'invite' | 'closed')
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="open">Ouvert — libre (recommandé)</option>
                <option value="invite">Sur invitation — code requis</option>
                <option value="closed">Fermé — gestionnaires seulement</option>
              </select>
            </label>
            {joinMode === 'invite' && (
              <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2.5 space-y-2">
                <p className="text-xs text-amber-200/90">
                  Partagez ce code aux personnes que vous invitez. Il apparaît aussi après
                  enregistrement des paramètres.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-slate-200">
                    Code :{' '}
                    <span className="font-mono tracking-widest text-lg text-slate-50">
                      {inviteCode || '(généré à l’enregistrement)'}
                    </span>
                  </p>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      void (async () => {
                        if (!active?.slug) return
                        setSaving(true)
                        try {
                          const data = await communitiesApi.updateSettings(active.slug, {
                            join_mode: 'invite',
                            rotate_invite_code: true,
                          })
                          applySettings(data.settings)
                          setMsg('Code d’invitation généré — à partager avec les nouveaux membres.')
                          setMsgOk(true)
                        } catch (e: unknown) {
                          setMsg(e instanceof ApiError ? e.detail : 'Erreur')
                          setMsgOk(false)
                        } finally {
                          setSaving(false)
                        }
                      })()
                    }}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-700/80 text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {inviteCode ? 'Régénérer le code' : 'Générer le code'}
                  </button>
                </div>
              </div>
            )}
          </fieldset>

          <label className="block">
            <span className="text-slate-500 text-xs">Site web</span>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
            />
          </label>
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
