'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { ThemePicker } from '@/components/theme/ThemePicker'

function authModeFromUrl(): 'login' | 'register' {
  if (typeof window === 'undefined') return 'login'
  return new URLSearchParams(window.location.search).get('mode') === 'register'
    ? 'register'
    : 'login'
}

function replaceAuthModeUrl(next: 'login' | 'register') {
  if (typeof window === 'undefined') return
  const url = next === 'register' ? '/app?mode=register' : '/app'
  window.history.replaceState(null, '', url)
}

export function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>(authModeFromUrl)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') await login(email.trim(), password)
      else await register(email.trim(), password, firstName.trim(), lastName.trim())
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900/90 to-slate-950 relative">
      <div className="absolute top-3 right-3 z-10">
        <ThemePicker />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <p className="text-3xl font-bold text-center mb-1">Mandala</p>
        <p className="text-center text-sm text-slate-400 mb-6">Lieux, communautés & événements</p>
        {mode === 'register' && (
          <p className="text-xs text-slate-500 text-center mb-4 -mt-2">
            Après la création du compte, vous choisirez votre lieu puis lirez sa charte.
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
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-sm"
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Mot de passe"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 pr-12 text-sm"
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
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-500 py-3 font-semibold disabled:opacity-50"
          >
            {loading ? '…' : mode === 'login' ? 'Connexion' : 'Créer un compte'}
          </button>
        </form>
        <button
          type="button"
          className="mt-4 w-full text-sm text-slate-400 hover:text-violet-300"
          onClick={() => {
            const next = mode === 'login' ? 'register' : 'login'
            setMode(next)
            replaceAuthModeUrl(next)
            setError(null)
          }}
        >
          {mode === 'login' ? "Pas encore de compte ? S'inscrire" : 'Déjà inscrit ? Se connecter'}
        </button>
      </div>
    </div>
  )
}
