'use client'

import { useCommunity } from '@/contexts/CommunityContext'

export function MessagesPage() {
  const { active } = useCommunity()
  return (
    <div className="max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">Messages</h1>
      <p className="text-slate-400 text-sm">
        Messagerie membre-à-membre pour <strong className="text-slate-200">{active?.name}</strong> — le
        socle Clairière de Fleur est déjà porté dans ce projet ; branchement UI complet à la prochaine
        étape.
      </p>
      <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-500 text-sm">
        💬 Ouvrez un canal depuis la liste des membres (bientôt).
      </p>
    </div>
  )
}
