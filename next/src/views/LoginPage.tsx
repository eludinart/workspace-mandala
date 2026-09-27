'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ThemePicker } from '@/components/theme/ThemePicker'
import {
  capturePlaceInviteFromUrl,
  readPendingPlaceInvite,
  type PendingPlaceInvite,
} from '@/lib/place-invite'

type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

function authModeFromUrl(): 'login' | 'register' {
  if (typeof window === 'undefined') return 'login'
  const params = new URLSearchParams(window.location.search)
  if (params.get('mode') === 'register' || (params.get('join') && params.get('invite'))) {
    return 'register'
  }
  return 'login'
}

function resetTokenFromUrl(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('reset')?.trim() ?? ''
}

function replaceAuthModeUrl(next: 'login' | 'register', invite: PendingPlaceInvite | null) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  if (next === 'register') params.set('mode', 'register')
  if (invite?.slug) params.set('join', invite.slug)
  if (invite?.code) params.set('invite', invite.code)
  const qs = params.toString()
  window.history.replaceState(null, '', qs ? `/app?${qs}` : '/app')
}

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  showPassword,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoComplete: string
  showPassword: boolean
}) {
  return (
    <input
      type={showPassword ? 'text' : 'password'}
      placeholder={placeholder}
      required
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 pr-12 text-sm"
    />
  )
}

export function LoginPage() {
  const { login, register, requestPasswordReset, completePasswordReset } = useAuth()
  const [pendingInvite, setPendingInvite] = useState<PendingPlaceInvite | null>(null)
  const [mode, setMode] = useState<AuthMode>('login')
  const [resetToken, setResetToken] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const invite = capturePlaceInviteFromUrl()
    setPendingInvite(invite)
    const token = resetTokenFromUrl()
    if (token) {
      setResetToken(token)
      setMode('reset')
      return
    }
    setMode(authModeFromUrl())
  }, [])

  function goToLogin() {
    setMode('login')
    setResetToken('')
    setPassword('')
    setPasswordConfirm('')
    setError(null)
    setInfo(null)
    replaceAuthModeUrl('login', pendingInvite)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'forgot') {
        const message = await requestPasswordReset(email.trim())
        setInfo(message)
        return
      }
      if (mode === 'reset') {
        if (password.length < 6) {
          setError('Le mot de passe doit contenir au moins 6 caractères')
          return
        }
        if (password !== passwordConfirm) {
          setError('Les deux mots de passe ne correspondent pas')
          return
        }
        if (!resetToken) {
          setError('Ce lien est invalide ou a expiré. Demandez un nouveau lien.')
          return
        }
        await completePasswordReset(resetToken, password)
        return
      }
      if (mode === 'login') await login(email.trim(), password)
      else {
        const invite = pendingInvite ?? readPendingPlaceInvite()
        await register(
          email.trim(),
          password,
          firstName.trim(),
          lastName.trim(),
          invite?.code,
          invite?.slug
        )
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const title =
    mode === 'forgot'
      ? 'Mot de passe oublié'
      : mode === 'reset'
        ? 'Nouveau mot de passe'
        : null

  return (
    <div className="relative flex-1 h-full min-h-0 bg-gradient-to-br from-slate-950 via-slate-900/90 to-slate-950">
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="relative min-h-full flex items-center justify-center px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
        <div className="absolute top-3 right-3 z-10">
          <ThemePicker />
        </div>
        <div className="m-user-form w-full max-w-md rounded-[1.75rem] border border-slate-800/70 bg-slate-900/75 p-8 sm:p-10 shadow-xl">
        <p className="m-user-title text-4xl sm:text-[2.75rem] text-center mb-2">Mandala</p>
        <p className="m-user-eyebrow text-center mb-8">Lieux · communautés · événements</p>
        {title && <p className="text-center text-sm font-medium text-slate-200 mb-4 -mt-4">{title}</p>}
        {pendingInvite && mode !== 'forgot' && mode !== 'reset' && (
          <p className="text-xs text-violet-200/90 text-center mb-6 -mt-4 leading-relaxed rounded-lg border border-violet-800/40 bg-violet-950/30 px-3 py-2">
            Invitation pour rejoindre le lieu <span className="font-mono">{pendingInvite.slug}</span>.
            {mode === 'login'
              ? ' Connectez-vous pour y accéder.'
              : ' Créez votre compte pour y accéder directement.'}
          </p>
        )}
        {mode === 'register' && !pendingInvite && (
          <p className="text-xs text-slate-500 text-center mb-6 -mt-4 leading-relaxed">
            Après la création du compte, vous choisirez votre lieu puis lirez sa charte.
          </p>
        )}
        {mode === 'forgot' && !info && (
          <p className="text-xs text-slate-400 text-center mb-6 -mt-2 leading-relaxed">
            Indiquez l’adresse du compte. Nous vous enverrons un lien pour choisir un nouveau mot de passe.
          </p>
        )}
        {mode === 'reset' && (
          <p className="text-xs text-slate-400 text-center mb-6 -mt-2 leading-relaxed">
            Choisissez un mot de passe d’au moins 6 caractères. Vous serez connecté ensuite.
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Prénom *"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-sm"
              />
              <input
                type="text"
                placeholder="Nom *"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-sm"
              />
            </div>
          )}
          {mode !== 'reset' && !(mode === 'forgot' && info) && (
            <input
              type="email"
              placeholder="Email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-sm"
            />
          )}
          {mode !== 'forgot' && (
            <div className="relative">
              <PasswordField
                value={password}
                onChange={setPassword}
                placeholder={mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                showPassword={showPassword}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <path d="M1 1l22 22" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          )}
          {mode === 'login' && (
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-violet-300"
                onClick={() => {
                  setMode('forgot')
                  setError(null)
                  setInfo(null)
                }}
              >
                Mot de passe oublié ?
              </button>
            </div>
          )}
          {mode === 'reset' && (
            <div className="relative">
              <PasswordField
                value={passwordConfirm}
                onChange={setPasswordConfirm}
                placeholder="Confirmer le mot de passe"
                autoComplete="new-password"
                showPassword={showPassword}
              />
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {info && <p className="text-sm text-emerald-300/90 leading-relaxed">{info}</p>}
          {!(mode === 'forgot' && info) && (
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3.5 font-semibold disabled:opacity-50"
            >
              {loading
                ? '…'
                : mode === 'login'
                  ? 'Connexion'
                  : mode === 'register'
                    ? 'Créer un compte'
                    : mode === 'forgot'
                      ? 'Envoyer le lien'
                      : 'Enregistrer et se connecter'}
            </button>
          )}
        </form>
        {mode === 'login' || mode === 'register' ? (
          <button
            type="button"
            className="mt-5 w-full text-[11px] uppercase tracking-[0.16em] text-slate-400 hover:text-violet-300"
            onClick={() => {
              const next = mode === 'login' ? 'register' : 'login'
              setMode(next)
              replaceAuthModeUrl(next, pendingInvite)
              setError(null)
              setInfo(null)
            }}
          >
            {mode === 'login' ? "Pas encore de compte ? S'inscrire" : 'Déjà inscrit ? Se connecter'}
          </button>
        ) : (
          <button
            type="button"
            className="mt-5 w-full text-[11px] uppercase tracking-[0.16em] text-slate-400 hover:text-violet-300"
            onClick={goToLogin}
          >
            Retour à la connexion
          </button>
        )}
        </div>
      </div>
      </div>
    </div>
  )
}
