'use client'

import React from 'react'

type Props = { children: React.ReactNode }
type State = { error: Error | null }

/**
 * Attrape les erreurs React côté client (navigation SPA) que error.tsx ne couvre pas toujours.
 * Évite l'écran blanc : affiche un message et un bouton recharger.
 */
export class ClientErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Mandala] Erreur interface:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div className="flex-1 h-full min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-4 px-8 pt-8 pb-[max(2rem,env(safe-area-inset-bottom,0px))] bg-slate-950 text-slate-100">
          <h1 className="text-xl font-bold">L&apos;application a rencontré une erreur</h1>
          <p className="text-sm text-slate-400 text-center max-w-md font-mono break-all">
            {error.message}
          </p>
          <p className="text-xs text-slate-500 text-center max-w-md">
            Si le problème persiste, arrêtez le serveur, supprimez le dossier{' '}
            <code className="text-violet-400">next/.next</code>, puis relancez{' '}
            <code className="text-violet-400">npm run dev.vps</code>.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-500"
          >
            Recharger la page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
