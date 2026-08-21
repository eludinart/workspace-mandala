'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { accountApi } from '@/api/account'
import { authApi } from '@/api/auth'
import { communitiesApi } from '@/api/communities'
import { useAuth } from '@/contexts/AuthContext'
import { useCommunity } from '@/contexts/CommunityContext'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { ApiError } from '@/lib/api-client'
import { compressAvatarImage } from '@/lib/compress-avatar-image'
import { formatPublicDisplayName } from '@/lib/mandala-display-name'
import { formatCommunityRoleLabel } from '@/lib/community-role-labels'
import { HeartWeatherPicker } from '@/components/community/HeartWeatherPicker'
import { RemoveMemberConfirmDialog } from '@/components/admin/RemoveMemberConfirmDialog'
import { DeleteAccountConfirmDialog } from '@/components/account/DeleteAccountConfirmDialog'
import { notificationsApi } from '@/api/notifications'
import { enablePushNotifications, isPushClientSupported } from '@/lib/push-client'

const EMOJI_PRESETS = ['🌸', '🕉️', '🌿', '✨', '🌻', '🦋', '🔥', '💜']

const SECTIONS = [
  { id: 'profil', label: 'Profil' },
  { id: 'communautes', label: 'Mes communautés' },
  { id: 'alertes', label: 'Préférences alertes' },
  { id: 'danger', label: 'Zone sensible' },
] as const

export function AccountPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
  const { user, refreshUser, isRealAdmin, logout } = useAuth()
  const { communities, refresh: refreshCommunities, setActiveSlug } = useCommunity()
  const u = user as {
    email?: string
    name?: string
    first_name?: string
    last_name?: string
    show_full_last_name?: boolean
    pseudo?: string
    profile_public?: boolean
    bio?: string
    avatar?: string
    avatar_emoji?: string
  } | null
  const fileRef = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [showFullLastName, setShowFullLastName] = useState(false)
  const [bio, setBio] = useState('')
  const [avatarEmoji, setAvatarEmoji] = useState('🌸')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [profilePublic, setProfilePublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [leaveSlug, setLeaveSlug] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [pushBusy, setPushBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const p = (await accountApi.getProfile()) as {
        name?: string
        first_name?: string
        last_name?: string
        show_full_last_name?: boolean
        pseudo?: string
        profile_public?: boolean
        bio?: string
        avatar?: string
        avatar_emoji?: string
      }
      setFirstName(p.first_name ?? '')
      setLastName(p.last_name ?? '')
      setShowFullLastName(!!p.show_full_last_name)
      setBio(p.bio ?? '')
      setAvatarEmoji(p.avatar_emoji ?? '🌸')
      setAvatarPreview(p.avatar ?? null)
      setProfilePublic(p.profile_public !== false)
    } catch {
      setFirstName(u?.first_name ?? '')
      setLastName(u?.last_name ?? '')
      setShowFullLastName(!!u?.show_full_last_name)
    }
  }, [u?.first_name, u?.last_name, u?.show_full_last_name])

  useEffect(() => {
    void load()
  }, [load])

  const onPhoto = async (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    setErr(null)
    try {
      const { dataUrl, error } = await compressAvatarImage(file)
      if (error || !dataUrl) {
        setErr(error ?? 'Impossible de traiter cette image')
        return
      }
      setAvatarPreview(dataUrl)
    } catch {
      setErr('Impossible de traiter cette image')
    }
  }

  const save = async () => {
    setSaving(true)
    setMsg(null)
    setErr(null)
    try {
      if (avatarPreview) {
        const b64 = avatarPreview.replace(/^data:image\/\w+;base64,/, '')
        const approxBytes = Math.ceil((b64.length * 3) / 4)
        if (approxBytes > 150_000) {
          setErr(
            'Photo encore trop lourde. Cliquez sur « Choisir une photo » pour la recompresser automatiquement.'
          )
          setSaving(false)
          return
        }
      }
      await accountApi.updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        show_full_last_name: showFullLastName,
        bio: bio.trim(),
        avatar_emoji: avatarEmoji,
        profile_public: profilePublic,
        ...(avatarPreview ? { avatar: avatarPreview } : { avatar: '' }),
      })
      await refreshUser()
      setMsg('Profil enregistré')
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const leaveCommunity = async () => {
    if (!leaveSlug) return
    setLeaving(true)
    setErr(null)
    try {
      await communitiesApi.leave(leaveSlug)
      setLeaveSlug(null)
      setMsg('Vous avez quitté ce lieu')
      await refreshCommunities()
      const remaining = communities.filter((c) => c.slug !== leaveSlug)
      if (remaining[0]) setActiveSlug(remaining[0].slug)
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Impossible de quitter ce lieu')
      setLeaveSlug(null)
    } finally {
      setLeaving(false)
    }
  }

  const deleteAccount = async () => {
    setDeletingAccount(true)
    setErr(null)
    try {
      await authApi.deleteMyAccount()
      setShowDeleteAccount(false)
      logout()
    } catch (e: unknown) {
      setErr(e instanceof ApiError ? e.detail : 'Suppression du compte impossible')
      setShowDeleteAccount(false)
    } finally {
      setDeletingAccount(false)
    }
  }

  const leavePlaceName = communities.find((c) => c.slug === leaveSlug)?.name ?? leaveSlug ?? ''

  const handleEnablePush = async () => {
    setPushBusy(true)
    setPushMsg(null)
    try {
      const result = await enablePushNotifications()
      if (result.ok) setPushMsg('Notifications activées sur cet appareil.')
      else if (result.reason === 'denied') setPushMsg('Permission refusée dans le navigateur.')
      else if (result.reason === 'no_vapid_key')
        setPushMsg('Clés VAPID manquantes côté serveur — contactez l’admin.')
      else if (result.reason === 'unsupported')
        setPushMsg('Cet appareil / navigateur ne prend pas en charge les push web.')
      else setPushMsg('Impossible d’activer les notifications.')
    } catch (e: unknown) {
      setPushMsg(e instanceof ApiError ? e.detail : 'Erreur lors de l’activation')
    } finally {
      setPushBusy(false)
    }
  }

  const handleTestPush = async () => {
    setPushBusy(true)
    setPushMsg(null)
    try {
      const res = (await notificationsApi.testPush()) as {
        ok?: boolean
        error?: string
        sent?: number
        devices?: number
      }
      if (res.ok) setPushMsg(`Test envoyé (${res.sent ?? 0} appareil(s)). Mettez l’app en arrière-plan pour vérifier.`)
      else setPushMsg(res.error ?? 'Échec du test push')
    } catch (e: unknown) {
      setPushMsg(e instanceof ApiError ? e.detail : 'Erreur lors du test')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Mon compte</h1>
        <nav className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Sections du compte">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:border-violet-500/50 hover:text-violet-200"
            >
              {s.label}
            </a>
          ))}
          {isRealAdmin && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className="px-2.5 py-1 rounded-lg border border-violet-700/50 text-violet-200 hover:bg-violet-950/40"
            >
              Administration
            </button>
          )}
        </nav>
      </header>

      <section id="profil" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-semibold text-slate-200">Profil</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-4">
          <p className="text-sm text-slate-500">Email : {u?.email ?? '—'}</p>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <HeartWeatherPicker />
          </div>

          <div className="flex items-center gap-4">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt=""
                className="w-20 h-20 rounded-full object-cover border border-slate-700"
              />
            ) : (
              <span className="text-5xl w-20 h-20 flex items-center justify-center">{avatarEmoji}</span>
            )}
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-600 hover:bg-slate-800"
              >
                Choisir une photo
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={() => setAvatarPreview(null)}
                  className="text-xs text-slate-500 block"
                >
                  Retirer la photo
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {EMOJI_PRESETS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setAvatarEmoji(e)}
                className={`text-xl p-1 rounded ${avatarEmoji === e ? 'bg-violet-600/30' : ''}`}
              >
                {e}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-500">Prénom</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">Nom de famille</span>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
                className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showFullLastName}
              onChange={(e) => setShowFullLastName(e.target.checked)}
              className="rounded"
            />
            <span>Afficher mon nom de famille en entier dans les listes</span>
          </label>
          {(firstName.trim() || lastName.trim()) && (
            <p className="text-xs text-slate-500">
              Nom visible dans les listes :{' '}
              <span className="text-slate-300">
                {formatPublicDisplayName(firstName, lastName, showFullLastName) || '—'}
              </span>
            </p>
          )}
          <label className="block text-sm">
            <span className="text-slate-500">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={profilePublic}
              onChange={(e) => setProfilePublic(e.target.checked)}
              className="rounded"
            />
            <span>Profil visible dans Membres</span>
          </label>
          {msg && <p className="text-emerald-400 text-sm">{msg}</p>}
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="w-full py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </section>

      <section id="communautes" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">Mes communautés</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          {communities.length === 0 && (
            <p className="text-sm text-slate-500 italic">Aucune communauté pour le moment.</p>
          )}
          <ul className="space-y-2">
            {communities.map((c) => (
              <li
                key={c.slug}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm"
              >
                <span>
                  {c.logo_emoji ? `${c.logo_emoji} ` : ''}
                  {c.name}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {c.role && (
                    <span className="text-[10px] text-slate-500">
                      {formatCommunityRoleLabel(c.role)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setLeaveSlug(c.slug)}
                    className="text-[10px] px-2 py-1 rounded border border-red-900/50 text-red-300 hover:bg-red-950/30"
                  >
                    Quitter…
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Pour changer de communauté active, utilisez le sélecteur de communauté dans l&apos;en-tête
            de l&apos;application.
          </p>
        </div>
      </section>

      <section id="alertes" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold text-slate-200">Préférences alertes</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <p className="text-sm text-slate-400 leading-relaxed">
            Activez les notifications push pour recevoir les messages même lorsque Mandala est en
            arrière-plan. Sur iPhone, ajoutez d&apos;abord le site à l&apos;écran d&apos;accueil.
          </p>
          {isPushClientSupported() ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={pushBusy}
                onClick={() => void handleEnablePush()}
                className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
              >
                Activer sur cet appareil
              </button>
              <button
                type="button"
                disabled={pushBusy}
                onClick={() => void handleTestPush()}
                className="px-3 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm hover:bg-slate-800 disabled:opacity-50"
              >
                Envoyer un test push
              </button>
            </div>
          ) : (
            <p className="text-xs text-amber-400/90">
              Ce navigateur ne prend pas en charge les notifications push web.
            </p>
          )}
          {pushMsg && <p className="text-xs text-slate-300">{pushMsg}</p>}
          <p className="text-xs text-slate-500">
            Le centre de notifications in-app reste disponible depuis l&apos;en-tête.
          </p>
        </div>
      </section>

      <section id="danger" className="scroll-mt-20 space-y-3">
        <h2 className="text-lg font-semibold text-red-300">Zone sensible</h2>
        <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-4 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-200">Quitter un lieu</p>
            <p className="text-xs text-slate-500">
              Retire votre appartenance et efface vos données sur ce lieu (calendrier, Agora, météo…).
              Votre compte Mandala reste actif pour les autres lieux.
            </p>
          </div>
          <div className="border-t border-red-900/20 pt-4 space-y-2">
            <p className="text-sm font-medium text-red-200">Supprimer mon compte</p>
            <p className="text-xs text-slate-500">
              Suppression définitive de votre profil et de toutes vos données dans l&apos;application.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteAccount(true)}
              className="w-full py-2 rounded-lg border border-red-700/60 text-red-200 text-sm hover:bg-red-950/40"
            >
              Supprimer mon compte Mandala…
            </button>
          </div>
        </div>
      </section>

      {isRealAdmin && onNavigate && (
        <section id="admin" className="scroll-mt-20">
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="text-sm text-violet-300 hover:text-violet-200 underline"
          >
            Ouvrir l&apos;administration →
          </button>
        </section>
      )}

      {leaveSlug && (
        <RemoveMemberConfirmDialog
          memberLabel="Vous"
          placeName={leavePlaceName}
          loading={leaving}
          onCancel={() => setLeaveSlug(null)}
          onConfirm={() => void leaveCommunity()}
        />
      )}

      {showDeleteAccount && u?.email && (
        <DeleteAccountConfirmDialog
          email={u.email}
          loading={deletingAccount}
          onCancel={() => setShowDeleteAccount(false)}
          onConfirm={() => void deleteAccount()}
        />
      )}
    </div>
  )
}
