'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { notificationsApi } from '@/api/notifications'
import { ACCOUNT_SKILLS_ANCHOR, SkillsProfileSection } from '@/components/skills/SkillsProfileSection'
import { SkillFicheShare } from '@/components/skills/SkillFicheShare'
import { skillsApi } from '@/api/skills'
import type { SkillScope } from '@/lib/skill-constants'
import { MyResourcesSection } from '@/components/resources/MyResourcesSection'
import { accountApi } from '@/api/account'
import { authApi } from '@/api/auth'
import { billingApi } from '@/api/billing'
import { ProAccountStatus } from '@/components/billing/ProAccountStatus'
import { communitiesApi } from '@/api/communities'
import { useAuth } from '@/contexts/AuthContext'
import { useCommunity } from '@/contexts/CommunityContext'
import type { MandalaNavigate } from '@/components/MandalaApp'
import {
  PersonLocationFields,
  type PersonLocationValue,
} from '@/components/geo/PersonLocationFields'
import { PracticePlacesEditor } from '@/components/geo/PracticePlacesEditor'
import type { PracticePlace } from '@/lib/practice-locations'
import { ExplainCard } from '@/components/help/ExplainCard'
import { ApiError, api } from '@/lib/api-client'
import {
  paymentSurfaceAllowsStripe,
  resolvePaymentSurface,
  type PaymentSurface,
} from '@/lib/play-distribution-context'
import { compressAvatarImage } from '@/lib/compress-avatar-image'
import { USER_GALLERY_MAX_IMAGES } from '@/lib/user-gallery-images'
import { formatPublicDisplayName } from '@/lib/mandala-display-name'
import { formatPlaceMembershipLabel, isCommunityManagerRole } from '@/lib/community-role-labels'
import { RemoveMemberConfirmDialog } from '@/components/admin/RemoveMemberConfirmDialog'
import { DeleteAccountConfirmDialog } from '@/components/account/DeleteAccountConfirmDialog'
import { MyEvaluationsSection } from '@/components/returns/MyEvaluationsSection'
import {
  enablePushNotifications,
  IOS_PUSH_HOME_SCREEN_HINT,
  isPushClientSupported,
  needsIosHomeScreenForPush,
} from '@/lib/push-client'
import { emitMandalaMapChanged } from '@/lib/map-changed'
import { useFeatureDoors } from '@/hooks/useFeatureDoors'

const EMOJI_PRESETS = ['🌸', '🕉️', '🌿', '✨', '🌻', '🦋', '🔥', '💜']

const SECTIONS = [
  { id: 'profil', label: 'Profil' },
  { id: 'evaluations', label: 'Évaluations' },
  { id: 'competences', label: 'Compétences' },
  { id: 'ressources', label: 'Ressources' },
  { id: 'communautes', label: 'Mes communautés' },
  { id: 'abonnements', label: 'Abonnements' },
  { id: 'alertes', label: 'Préférences alertes' },
  { id: 'danger', label: 'Supprimer mon compte définitivement' },
] as const

type AccountSectionId = (typeof SECTIONS)[number]['id']

const SECTION_IDS = new Set<string>(SECTIONS.map((s) => s.id))

function resolveAccountSection(raw: string | null | undefined): AccountSectionId {
  const h = (raw || '').replace(/^#/, '').trim().toLowerCase()
  if (h === 'mandala-pro' || h === 'billing') return 'abonnements'
  if (h === 'legal') return 'danger'
  if (SECTION_IDS.has(h)) return h as AccountSectionId
  return 'profil'
}

export function AccountPage({ onNavigate }: { onNavigate?: MandalaNavigate }) {
  const { user, refreshUser, logout } = useAuth()
  const { communities, refresh: refreshCommunities, setActiveSlug } = useCommunity()
  const { can: canDoor, loading: doorsLoading } = useFeatureDoors()
  const [showOnMembersMap, setShowOnMembersMap] = useState(false)
  /** Évite qu’un `load()` tardif écrase un décochage / coches en cours. */
  const mapOptInTouchedRef = useRef(false)
  const [mapOptInSaving, setMapOptInSaving] = useState(false)
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
  const galleryFileRef = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [showFullLastName, setShowFullLastName] = useState(false)
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState<PersonLocationValue>({
    location_mode: 'city',
    residence_city: '',
    residence_address: '',
    residence_postal_code: '',
    latitude: null,
    longitude: null,
    residence_public: true,
  })
  const [practicePlaces, setPracticePlaces] = useState<PracticePlace[]>([])
  const [avatarEmoji, setAvatarEmoji] = useState('🌸')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [profilePublic, setProfilePublic] = useState(true)
  const [skillsUserId, setSkillsUserId] = useState(0)
  const [skillsScope, setSkillsScope] = useState<SkillScope>('hidden')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [leaveSlug, setLeaveSlug] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [iosHomeScreen, setIosHomeScreen] = useState(false)
  const [pushUiReady, setPushUiReady] = useState(false)
  const [paymentSurface, setPaymentSurface] = useState<PaymentSurface>('web')
  const [activeSection, setActiveSection] = useState<AccountSectionId>('profil')

  const allowStripePortal = paymentSurfaceAllowsStripe(paymentSurface)

  const selectSection = useCallback((id: AccountSectionId) => {
    setActiveSection(id)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${id}`)
      const main = document.querySelector('main')
      if (main instanceof HTMLElement) main.scrollTo({ top: 0, behavior: 'smooth' })
      else window.scrollTo({ top: 0, behavior: 'smooth' })
      // Pastille active visible dans la rangée scrollable (évite qu’elle reste hors écran).
      requestAnimationFrame(() => {
        const pill = document.querySelector(
          `nav[aria-label="Sections du compte"] button[aria-current="page"]`
        )
        if (pill instanceof HTMLElement) {
          pill.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
        }
      })
    }
  }, [])

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
        gallery_images?: string[]
      }
      setFirstName(p.first_name ?? '')
      setLastName(p.last_name ?? '')
      setShowFullLastName(!!p.show_full_last_name)
      setBio(p.bio ?? '')
      setAvatarEmoji(p.avatar_emoji ?? '🌸')
      setAvatarPreview(p.avatar ?? null)
      setGalleryImages(
        Array.isArray(p.gallery_images)
          ? p.gallery_images.filter(Boolean).slice(0, USER_GALLERY_MAX_IMAGES)
          : []
      )
      setProfilePublic(p.profile_public !== false)
      try {
        const skills = await skillsApi.getMine()
        setSkillsUserId(skills.profile.user_id)
        setSkillsScope(skills.profile.scope)
        setLocation({
          location_mode: skills.profile.location_mode === 'address' ? 'address' : 'city',
          residence_city: skills.profile.residence_city ?? '',
          residence_address: skills.profile.residence_address ?? '',
          residence_postal_code: skills.profile.residence_postal_code ?? '',
          latitude: skills.profile.latitude ?? null,
          longitude: skills.profile.longitude ?? null,
          residence_public: skills.profile.residence_public !== false,
        })
        setPracticePlaces(skills.profile.practice_locations ?? [])
      } catch {
        /* fiche compétences optionnelle */
      }
      try {
        const cityRes = (await api.get('/api/members/city')) as {
          profile?: { show_on_map?: boolean }
        }
        if (!mapOptInTouchedRef.current) {
          setShowOnMembersMap(cityRes.profile?.show_on_map === true)
        }
      } catch {
        if (!mapOptInTouchedRef.current) setShowOnMembersMap(false)
      }
    } catch {
      setFirstName(u?.first_name ?? '')
      setLastName(u?.last_name ?? '')
      setShowFullLastName(!!u?.show_full_last_name)
    }
  }, [u?.first_name, u?.last_name, u?.show_full_last_name])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setIosHomeScreen(needsIosHomeScreenForPush())
    setPushUiReady(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void resolvePaymentSurface().then((surface) => {
      if (!cancelled) setPaymentSurface(surface)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(ACCOUNT_SKILLS_ANCHOR) === 'competences') {
      sessionStorage.removeItem(ACCOUNT_SKILLS_ANCHOR)
      setActiveSection('competences')
      window.history.replaceState(null, '', '#competences')
    } else {
      setActiveSection(resolveAccountSection(window.location.hash))
    }
    const onHash = () => setActiveSection(resolveAccountSection(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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

  const onGalleryPhoto = async (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    if (galleryImages.length >= USER_GALLERY_MAX_IMAGES) {
      setErr(`Maximum ${USER_GALLERY_MAX_IMAGES} photos d'ambiance.`)
      return
    }
    setErr(null)
    try {
      const { dataUrl, error } = await compressAvatarImage(file)
      if (error || !dataUrl) {
        setErr(error ?? 'Impossible de traiter cette image')
        return
      }
      setGalleryImages((prev) => [...prev, dataUrl].slice(0, USER_GALLERY_MAX_IMAGES))
    } catch {
      setErr('Impossible de traiter cette image')
    }
  }

  const removeGalleryAt = (index: number) => {
    setGalleryImages((prev) => prev.filter((_, i) => i !== index))
  }

  const moveGallery = (index: number, dir: -1 | 1) => {
    setGalleryImages((prev) => {
      const next = [...prev]
      const j = index + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  const clearPortrait = () => {
    if (skillsScope === 'mandala' || skillsScope === 'places') {
      setErr(
        'Photo de profil requise pour une fiche compétences visible (Mandala ou lieux).'
      )
      return
    }
    setAvatarPreview(null)
  }

  const persistMapOptIn = useCallback(
    async (next: boolean, opts?: { city?: string }) => {
      const cityPayload: { city?: string; show_on_map: boolean } = {
        show_on_map: next,
      }
      const city = (opts?.city ?? location.residence_city).trim()
      if (city) cityPayload.city = city
      await api.put('/api/members/city', cityPayload)
      emitMandalaMapChanged()
    },
    [location.residence_city]
  )

  const onToggleMapOptIn = async (next: boolean) => {
    mapOptInTouchedRef.current = true
    setShowOnMembersMap(next)
    setMapOptInSaving(true)
    setErr(null)
    try {
      await persistMapOptIn(next)
      setMsg(next ? 'Visible sur la carte des membres' : 'Retiré de la carte des membres')
    } catch (e: unknown) {
      setShowOnMembersMap(!next)
      setErr(
        e instanceof ApiError
          ? e.detail
          : 'Impossible de mettre à jour la visibilité sur la carte'
      )
    } finally {
      setMapOptInSaving(false)
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
      if (!avatarPreview && (skillsScope === 'mandala' || skillsScope === 'places')) {
        setErr(
          'Photo de profil requise pour une fiche compétences visible (Mandala ou lieux).'
        )
        setSaving(false)
        return
      }
      await accountApi.updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        show_full_last_name: showFullLastName,
        bio: bio.trim(),
        avatar_emoji: avatarEmoji,
        profile_public: profilePublic,
        gallery_images: galleryImages,
        ...(avatarPreview ? { avatar: avatarPreview } : { avatar: '' }),
      })
      try {
        const skills = await skillsApi.getMine()
        const nextScope =
          skills.profile.scope === 'hidden' &&
          (location.residence_city.trim() || practicePlaces.length > 0)
            ? 'mandala'
            : skills.profile.scope
        if (
          (nextScope === 'mandala' || nextScope === 'places') &&
          !avatarPreview
        ) {
          setErr(
            'Photo de profil requise pour une fiche compétences visible (Mandala ou lieux).'
          )
          setSaving(false)
          return
        }
        setSkillsScope(nextScope)
        await skillsApi.saveMine({
          scope: nextScope,
          offer_text: skills.profile.offer_text,
          seek_text: skills.profile.seek_text,
          frame_text: skills.profile.frame_text,
          place_ids: skills.profile.place_ids,
          tags: skills.profile.tags,
          residence_city: location.residence_city.trim(),
          residence_public: location.residence_public,
          location_mode: location.location_mode,
          residence_address: location.residence_address,
          residence_postal_code: location.residence_postal_code,
          latitude: location.latitude,
          longitude: location.longitude,
          geocode:
            location.location_mode === 'address' ||
            practicePlaces.some((p) => p.mode === 'address'),
          practice_locations: practicePlaces,
        })
        setSkillsUserId(skills.profile.user_id)
        setSkillsScope(nextScope)
        emitMandalaMapChanged()
      } catch {
        /* profil identité déjà sauvé */
      }
      // Opt-in carte : indépendant de la fiche compétences (sinon un échec skills
      // empêchait de décocher « Apparaître sur la carte des membres »).
      let mapSaved = true
      try {
        await persistMapOptIn(showOnMembersMap)
        mapOptInTouchedRef.current = false
      } catch (e: unknown) {
        mapSaved = false
        setErr(
          e instanceof ApiError
            ? e.detail
            : 'Profil enregistré, mais la visibilité carte n’a pas pu être mise à jour'
        )
      }
      await refreshUser()
      if (mapSaved) setMsg('Profil enregistré')
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
      await refreshCommunities({ background: true })
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
        setPushMsg(
          needsIosHomeScreenForPush()
            ? IOS_PUSH_HOME_SCREEN_HINT
            : 'Cet appareil / navigateur ne prend pas en charge les push web.'
        )
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
      if (res.ok)
        setPushMsg(
          `Test envoyé (${res.sent ?? 0} appareil(s)). Une alerte doit apparaître même si Mandala reste ouvert.`
        )
      else setPushMsg(res.error ?? 'Échec du test push')
    } catch (e: unknown) {
      setPushMsg(e instanceof ApiError ? e.detail : 'Erreur lors du test')
    } finally {
      setPushBusy(false)
    }
  }

  const navPillClass = (active: boolean) =>
    [
      'px-2.5 py-1 rounded-full border text-xs sm:text-sm transition-colors',
      active
        ? 'border-violet-500/70 bg-violet-600/20 text-violet-100'
        : 'border-slate-700 text-slate-300 hover:border-violet-500/50 hover:text-violet-200',
    ].join(' ')

  const authUserId = typeof user?.id === 'number' ? user.id : Number(user?.id) || 0
  const shareUserId = skillsUserId || authUserId

  return (
    <div className="m-user-form w-full space-y-6">
      <ExplainCard screen="account" />
      <header className="-mx-1 space-y-2 border-b border-slate-800/70 px-1 pb-2 pt-1">
        <div>
          <p className="m-user-eyebrow mb-0.5">Espace personnel</p>
          <h1 className="m-user-title text-2xl sm:text-3xl">Mon compte</h1>
        </div>
        <nav
          className="flex flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Sections du compte"
        >
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={activeSection === s.id ? 'page' : undefined}
              onClick={() => selectSection(s.id)}
              className={`shrink-0 whitespace-nowrap ${navPillClass(activeSection === s.id)}`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </header>

      {activeSection === 'profil' && (
      <section id="profil" className="space-y-4" aria-labelledby="account-section-title">
        <h2 id="account-section-title" className="text-lg font-semibold text-slate-200">
          Profil
        </h2>
        {shareUserId > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <SkillFicheShare
              userId={shareUserId}
              displayName={
                formatPublicDisplayName(firstName, lastName, showFullLastName) ||
                u?.pseudo ||
                ''
              }
              heading="Partager ma fiche"
              shareTitle="Ma fiche Mandala"
              canSharePublic={skillsScope === 'mandala'}
              alwaysShow
            />
          </div>
        )}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-4">
          <p className="text-sm text-slate-500">Email : {u?.email ?? '—'}</p>

          <div className="space-y-2">
            <p className="text-sm text-slate-400">Photo de toi (profil)</p>
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt=""
                  className="w-20 h-20 rounded-full object-cover border border-slate-700"
                />
              ) : (
                <span className="text-5xl w-20 h-20 flex items-center justify-center">
                  {avatarEmoji}
                </span>
              )}
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void onPhoto(e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
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
                    onClick={clearPortrait}
                    className="text-xs text-slate-500 block"
                  >
                    Retirer la photo
                  </button>
                )}
              </div>
            </div>
            {(skillsScope === 'mandala' || skillsScope === 'places') && (
              <p className="text-xs text-amber-300/90">
                Requise tant que ta fiche compétences est visible (Mandala ou lieux).
              </p>
            )}
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

          <div className="space-y-2 border-t border-slate-800 pt-4">
            <p className="text-sm text-slate-400">Ambiance / activité (optionnel, max 2)</p>
            <p className="text-xs text-slate-500">
              Visibles avec ta fiche compétences, selon la même portée.
            </p>
            <input
              ref={galleryFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void onGalleryPhoto(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
            <ul className="flex flex-wrap gap-3">
              {galleryImages.map((src, i) => (
                <li
                  key={`${i}-${src.slice(0, 32)}`}
                  className="w-28 space-y-1 rounded-xl border border-slate-700 bg-slate-950/50 p-1.5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-20 w-full rounded-lg object-cover" />
                  <div className="flex justify-between gap-1">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveGallery(i, -1)}
                      className="text-[10px] text-slate-400 disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGalleryAt(i)}
                      className="text-[10px] text-rose-400"
                    >
                      Retirer
                    </button>
                    <button
                      type="button"
                      disabled={i === galleryImages.length - 1}
                      onClick={() => moveGallery(i, 1)}
                      className="text-[10px] text-slate-400 disabled:opacity-30"
                    >
                      →
                    </button>
                  </div>
                </li>
              ))}
              {galleryImages.length < USER_GALLERY_MAX_IMAGES && (
                <li>
                  <button
                    type="button"
                    onClick={() => galleryFileRef.current?.click()}
                    className="flex h-[7.25rem] w-28 items-center justify-center rounded-xl border border-dashed border-slate-600 text-xs text-slate-400 hover:border-violet-500 hover:text-violet-200"
                  >
                    + Ajouter
                  </button>
                </li>
              )}
            </ul>
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
          <PersonLocationFields
            idPrefix="account-loc"
            value={location}
            onChange={setLocation}
            disabled={saving}
          />
          <PracticePlacesEditor
            value={practicePlaces}
            onChange={setPracticePlaces}
            disabled={saving}
          />
          {!doorsLoading && canDoor('carte_membres') && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showOnMembersMap}
                onChange={(e) => void onToggleMapOptIn(e.target.checked)}
                className="rounded"
                disabled={saving || mapOptInSaving}
              />
              <span>
                Apparaître sur la carte des membres
                {mapOptInSaving ? (
                  <span className="ml-2 text-xs text-slate-500">Enregistrement…</span>
                ) : null}
              </span>
            </label>
          )}
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
      )}

      {activeSection === 'abonnements' && (
        <section id="abonnements" className="space-y-3" aria-labelledby="account-section-title">
          <h2 id="account-section-title" className="text-lg font-semibold text-slate-200">
            Abonnements
          </h2>
          <div className="rounded-xl border border-violet-800/50 bg-slate-900/50 p-4 space-y-2">
            <p className="text-sm text-slate-400">
              Fais rayonner ton lieu ou ta pratique. Les membres restent en gratuité.
            </p>
            <ProAccountStatus onNavigate={onNavigate} />
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('billing-offers')}
                className="w-full py-2 rounded-lg bg-violet-600/90 text-white text-sm font-medium hover:bg-violet-500"
              >
                Voir les offres
              </button>
            )}
            {allowStripePortal ? (
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    try {
                      const { url } = await billingApi.openPortal()
                      if (url) window.location.href = url
                    } catch (e: unknown) {
                      setErr(
                        e instanceof ApiError
                          ? e.detail
                          : 'Portail de facturation indisponible'
                      )
                    }
                  })()
                }}
                className="w-full py-2 rounded-lg border border-slate-600 text-slate-200 text-sm hover:bg-slate-800"
              >
                Gérer un abonnement Stripe (résilier / carte)
              </button>
            ) : (
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Depuis l’app Play, la gestion / résiliation d’un abonnement Google Play se fait dans
                les réglages Google Play de l’appareil. Pour un abonnement Stripe, ouvrez Mandala
                dans un navigateur web.
              </p>
            )}
            {allowStripePortal && (
              <p className="text-[11px] text-slate-500">
                Abonnement souscrit via Google Play : résiliation dans les réglages Google Play de
                l’appareil.
              </p>
            )}
            {err && activeSection === 'abonnements' && (
              <p className="text-red-400 text-sm">{err}</p>
            )}
          </div>
        </section>
      )}

      {activeSection === 'evaluations' && (
      <section id="evaluations" className="space-y-3" aria-labelledby="account-section-title">
        <h2 id="account-section-title" className="text-lg font-semibold text-slate-200">
          Évaluations
        </h2>
        <MyEvaluationsSection />
      </section>
      )}

      {activeSection === 'competences' && (
      <section id="competences" className="space-y-3" aria-labelledby="account-section-title">
        <h2 id="account-section-title" className="text-lg font-semibold text-slate-200">
          Compétences
        </h2>
        <SkillsProfileSection />
      </section>
      )}

      {activeSection === 'ressources' && (
      <section id="ressources" className="space-y-3" aria-labelledby="account-section-title">
        <h2 id="account-section-title" className="text-lg font-semibold text-slate-200">
          Mes ressources
        </h2>
        <MyResourcesSection />
      </section>
      )}

      {activeSection === 'communautes' && (
      <section id="communautes" className="space-y-3" aria-labelledby="account-section-title">
        <h2 id="account-section-title" className="text-lg font-semibold text-slate-200">
          Mes communautés
        </h2>
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
                      {formatPlaceMembershipLabel(c.role, c.circle)}
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
                {isCommunityManagerRole(c.role) && (
                  <p className="basis-full text-[10px] text-slate-500">
                    Si vous êtes le seul gestionnaire, désignez un successeur avant de quitter.
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Pour changer de communauté active, utilisez le sélecteur de communauté dans l&apos;en-tête
            de l&apos;application.
          </p>
        </div>
      </section>
      )}

      {activeSection === 'alertes' && (
      <section id="alertes" className="space-y-3" aria-labelledby="account-section-title">
        <h2 id="account-section-title" className="text-lg font-semibold text-slate-200">
          Préférences alertes
        </h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <p className="text-sm text-slate-400 leading-relaxed">
            Activez les notifications push pour recevoir les messages — app ouverte ou en
            arrière-plan, sur poste comme sur smartphone.
          </p>
          {iosHomeScreen ? (
            <p className="text-sm text-amber-200/90 leading-relaxed">
              Sur iPhone, les notifications passent seulement depuis l’icône d’accueil.{' '}
              {IOS_PUSH_HOME_SCREEN_HINT}
            </p>
          ) : !pushUiReady ? null : isPushClientSupported() ? (
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
      )}

      {activeSection === 'danger' && (
      <section id="danger" className="space-y-4" aria-labelledby="account-section-title">
        <h2 id="account-section-title" className="text-lg font-semibold text-red-300">
          Supprimer mon compte définitivement
        </h2>
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400 space-y-2">
          <p className="text-sm font-medium text-slate-200">Documents légaux</p>
          <p>
            <a href="/cgu" className="text-violet-300 hover:underline" target="_blank" rel="noreferrer">
              Conditions générales d’utilisation
            </a>
          </p>
          <p>
            <a href="/cgv" className="text-violet-300 hover:underline" target="_blank" rel="noreferrer">
              Conditions générales de vente
            </a>
          </p>
          <p>
            <a
              href="/confidentialite"
              className="text-violet-300 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Politique de confidentialité
            </a>
          </p>
        </div>
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
