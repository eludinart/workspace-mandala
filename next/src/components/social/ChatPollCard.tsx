'use client'

import { useState } from 'react'
import type { ChatPollView } from '@/lib/db-chat-polls'
import { socialApi } from '@/api/social'

export function ChatPollCard({
  poll: initial,
  onUpdated,
}: {
  poll: ChatPollView
  onUpdated?: (poll: ChatPollView) => void
}) {
  const [poll, setPoll] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const hasVoted = poll.my_option_id != null
  const total = Math.max(poll.total_votes, 0)

  async function vote(optionId: number) {
    setBusy(true)
    setErr(null)
    try {
      const res = await socialApi.votePoll(poll.id, optionId)
      setPoll(res.poll)
      onUpdated?.(res.poll)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Vote impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-1 rounded-2xl border border-violet-800/40 bg-violet-950/20 px-3 py-3 space-y-2 min-w-[14rem] max-w-sm">
      <p className="text-[11px] uppercase tracking-wider text-violet-300/80">Sondage</p>
      <p className="text-sm font-medium text-slate-100 leading-snug">{poll.question}</p>
      <ul className="space-y-1.5">
        {poll.options.map((opt) => {
          const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0
          const mine = poll.my_option_id === opt.id
          return (
            <li key={opt.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void vote(opt.id)}
                className={`relative w-full overflow-hidden rounded-xl border text-left px-3 py-2 text-sm transition-colors disabled:opacity-60 ${
                  mine
                    ? 'border-violet-500 bg-violet-600/25 text-slate-50'
                    : 'border-slate-700 bg-slate-950/50 text-slate-200 hover:border-violet-700/60'
                }`}
              >
                {hasVoted && (
                  <span
                    className="absolute inset-y-0 left-0 bg-violet-600/20"
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                )}
                <span className="relative z-[1] flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{opt.label}</span>
                  {hasVoted && (
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {opt.votes} · {pct}%
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-[11px] text-slate-500">
        {hasVoted
          ? `${total} vote${total > 1 ? 's' : ''} · vous pouvez changer d’avis`
          : 'Choisissez une option pour voir les résultats'}
      </p>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  )
}
