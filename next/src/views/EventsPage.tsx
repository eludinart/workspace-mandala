'use client'

import { useCommunity } from '@/contexts/CommunityContext'

const DEMO_EVENTS = [
  { title: 'Accueil & méditation', phase: 'Préparation', date: '12 juin' },
  { title: 'Journée portes ouvertes', phase: 'Jour J', date: '15 juin' },
  { title: 'Bilan & rangement', phase: 'Après', date: '16 juin' },
]

export function EventsPage() {
  const { active } = useCommunity()

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Événements — {active?.name}</h1>
      <p className="text-sm text-slate-400">
        Module événements (phases, tâches, volontaires) : prochaine itération. Aperçu démo ci-dessous.
      </p>
      <ul className="space-y-3">
        {DEMO_EVENTS.map((ev) => (
          <li
            key={ev.title}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 flex justify-between gap-4"
          >
            <div>
              <p className="font-medium">{ev.title}</p>
              <p className="text-xs text-slate-500 mt-1">{ev.phase}</p>
            </div>
            <span className="text-sm text-violet-300 whitespace-nowrap">{ev.date}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
