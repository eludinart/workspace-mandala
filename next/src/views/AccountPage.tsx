'use client'

import { useAuth } from '@/contexts/AuthContext'

export function AccountPage() {
  const { user } = useAuth()
  const u = user as { email?: string; name?: string; pseudo?: string } | null
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Mon compte</h1>
      <dl className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2 text-sm">
        <div>
          <dt className="text-slate-500">Email</dt>
          <dd>{u?.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Nom</dt>
          <dd>{u?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Pseudo</dt>
          <dd>{u?.pseudo ?? '—'}</dd>
        </div>
      </dl>
    </div>
  )
}
