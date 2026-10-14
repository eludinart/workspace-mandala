'use client'

import { useCallback, useEffect, useState } from 'react'
import { returnsApi, type AdminAlert, type AdminReport } from '@/api/returns'
import { ApiError } from '@/lib/api-client'

export function AdminEvaluationsTab() {
  const [reports, setReports] = useState<AdminReport[]>([])
  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await returnsApi.adminList()
      setReports(data.reports ?? [])
      setAlerts(data.alerts ?? [])
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Impossible de charger les évaluations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function act(body: Record<string, unknown>) {
    setError(null)
    try {
      await returnsApi.adminAct(body)
      await load()
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.detail : 'Action impossible')
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Chargement…</p>

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Signalements de retours</h3>
        {reports.length === 0 && <p className="text-sm text-slate-500">Aucun signalement en attente.</p>}
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="rounded-xl border border-slate-800 p-4 space-y-2 text-sm">
              <p className="text-slate-400">
                {report.reporter_name} · {report.occasion_label} · {report.created_at}
              </p>
              <p className="text-slate-200">{report.reason}</p>
              <p className="text-slate-400 whitespace-pre-wrap">{report.body}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void act({ action: 'remove_return', return_id: report.return_id })}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-900/70 text-red-100"
                >
                  Retirer le retour
                </button>
                <button
                  type="button"
                  onClick={() => void act({ action: 'dismiss_report', report_id: report.id })}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-600"
                >
                  Garder le retour
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Alertes de cadre</h3>
        <p className="text-xs text-slate-500">Ces messages ne sont pas des retours et ne sont pas publics.</p>
        {alerts.length === 0 && <p className="text-sm text-slate-500">Aucune alerte.</p>}
        <ul className="space-y-3">
          {alerts.map((alert) => (
            <li key={alert.id} className="rounded-xl border border-slate-800 p-4 space-y-2 text-sm">
              <p className="text-slate-400">
                {alert.author_name} · {alert.place_name}
                {alert.about_name ? ` · au sujet de ${alert.about_name}` : ''} · {alert.created_at}
              </p>
              <p className="text-slate-200 whitespace-pre-wrap">{alert.message}</p>
              <div className="flex gap-2">
                {alert.status === 'new' && (
                  <button
                    type="button"
                    onClick={() => void act({ action: 'alert_status', alert_id: alert.id, status: 'read' })}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-600"
                  >
                    Marquer lu
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void act({ action: 'alert_status', alert_id: alert.id, status: 'done' })}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-600"
                >
                  Traité
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
