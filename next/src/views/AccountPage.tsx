'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { accountApi } from '@/api/account'
import { useAuth } from '@/contexts/AuthContext'
import { useCommunity } from '@/contexts/CommunityContext'
import type { MandalaNavigate } from '@/components/MandalaApp'
import { ApiError } from '@/lib/api-client'
import { compressAvatarImage } from '@/lib/compress-avatar-image'

const EMOJI_PRESETS = ['🌸', '🕉️', '🌿', '✨', '🌻', '🦋', '🔥', '💜']

const SECTIONS = [
  { id: 'profil', label: 'Profil' },
  { id: 'communautes', label: 'Mes communautés' },
  { id: 'alertes', label: 'Préférences alertes' },
] as const

export function AccountPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
  const { user, refreshUser, isRealAdmin } = useAuth()
  const { communities } = useCommunity()
  const u = user as {
    email?: string
    name?: string
    pseudo?: string
    profile_public?: boolean
    bio?: string
    avatar?: string
    avatar_emoji?: string
  } | null
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [bio, setBio] = useState('')
  const [avatarEmoji, setAvatarEmoji] = useState('🌸')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [profilePublic, setProfilePublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const p = (await accountApi.getProfile()) as {
        name?: string
        pseudo?: string
        profile_public?: boolean
        bio?: string
        avatar?: string
        avatar_emoji?: string
      }
      setName(p.name ?? '')
      setPseudo(p.pseudo ?? '')
      setBio(p.bio ?? '')
      setAvatarEmoji(p.avatar_emoji ?? '🌸')
      setAvatarPreview(p.avatar ?? null)
      setProfilePublic(p.profile_public !== false)
    } catch {
      setName(u?.name ?? '')
      setPseudo(u?.pseudo ?? '')
    }
  }, [u?.name, u?.pseudo])

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
      const normalizedPseudo = pseudo
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
      await accountApi.updateProfile({
        name: name.trim(),
        pseudo: normalizedPseudo,
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

          <label className="block text-sm">
            <span className="text-slate-500">Nom affiché</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Pseudo (unique)</span>
            <input
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2"
            />
            <span className="text-[10px] text-slate-500">Sans espaces — ex. ludinard</span>
          </label>
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
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm"
              >
                <span>
                  {c.logo_emoji ? `${c.logo_emoji} ` : ''}
                  {c.name}
                </span>
                {c.role && <span className="text-[10px] text-slate-500 uppercase">{c.role}</span>}
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-sm text-slate-400 leading-relaxed">
            Les préférences de notifications push et e-mail seront configurables ici prochainement.
            En attendant, consultez le centre de notifications depuis l&apos;en-tête.
          </p>
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
    </div>
  )
}
