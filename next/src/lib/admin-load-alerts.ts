/**
 * Agrège les alertes admin pour l’onglet Charge (push + pool + endpoints).
 */
import { getPushOverview } from '@/lib/db-push-receipts'
import { getDbPoolInfo } from '@/lib/db'
import { getLoadSnapshot, type LoadSnapshot } from '@/lib/request-metrics'

export type AdminAlertLevel = 'info' | 'warning' | 'critical'

export type AdminAlert = {
  id: string
  level: AdminAlertLevel
  source: 'push' | 'pool' | 'http' | 'system'
  title: string
  detail: string
  href?: string
}

const PUSH_DELIVERY_WARN = Number(process.env.PUSH_DELIVERY_ALERT_THRESHOLD ?? 0.6)
const PUSH_MIN_ACCEPTED = Number(process.env.PUSH_DELIVERY_ALERT_MIN ?? 5)

export async function buildAdminLoadDashboard(): Promise<{
  load: LoadSnapshot
  pool: ReturnType<typeof getDbPoolInfo>
  alerts: AdminAlert[]
  push: Awaited<ReturnType<typeof getPushOverview>> | null
}> {
  const load = getLoadSnapshot()
  const pool = getDbPoolInfo()
  const alerts: AdminAlert[] = []

  let push: Awaited<ReturnType<typeof getPushOverview>> | null = null
  try {
    push = await getPushOverview('24h')
  } catch {
    alerts.push({
      id: 'push-overview-failed',
      level: 'warning',
      source: 'push',
      title: 'Suivi push indisponible',
      detail: 'Impossible de lire les accusés push (base ou tables).',
      href: '/app?page=admin&adminTab=push',
    })
  }

  if (push) {
    if (push.accepted >= PUSH_MIN_ACCEPTED && push.delivery_rate != null && push.delivery_rate < PUSH_DELIVERY_WARN) {
      alerts.push({
        id: 'push-low-delivery',
        level: 'critical',
        source: 'push',
        title: 'Taux de livraison push bas',
        detail: `${Math.round(push.delivery_rate * 100)} % delivered sur ${push.accepted} accepted (seuil ${Math.round(PUSH_DELIVERY_WARN * 100)} %).`,
        href: '/app?page=admin&adminTab=push',
      })
    }
    if (push.error + push.gone > 0) {
      alerts.push({
        id: 'push-send-failures',
        level: push.error + push.gone >= 5 ? 'warning' : 'info',
        source: 'push',
        title: 'Échecs d’envoi push',
        detail: `${push.gone} gone, ${push.error} error, ${push.recent_failures.length} récents listés.`,
        href: '/app?page=admin&adminTab=push',
      })
    }
    if (push.pending_accepted > 0) {
      alerts.push({
        id: 'push-pending-ack',
        level: push.pending_accepted >= 10 ? 'warning' : 'info',
        source: 'push',
        title: 'Push sans accusé delivered',
        detail: `${push.pending_accepted} accepted depuis >1 h sans delivered (appareil endormi ou non reçu).`,
        href: '/app?page=admin&adminTab=push',
      })
    }
    if (push.users_never_delivered.length > 0) {
      alerts.push({
        id: 'push-users-never',
        level: 'warning',
        source: 'push',
        title: 'Utilisateurs sans réception',
        detail: `${push.users_never_delivered.length} compte(s) avec accepted mais aucun delivered sur la fenêtre.`,
        href: '/app?page=admin&adminTab=push',
      })
    }
  }

  if (load.poolEnqueueRecent > 0) {
    alerts.push({
      id: 'pool-enqueue',
      level: load.poolEnqueueRecent >= 5 ? 'critical' : 'warning',
      source: 'pool',
      title: 'Pool MariaDB saturé (file d’attente)',
      detail: `${load.poolEnqueueRecent} enqueue sur ~${load.windowSec}s (total process ${load.poolEnqueueTotal}). Limit=${pool.connectionLimit}, maxIdle=${pool.maxIdle}.`,
    })
  }

  if (load.errorRate >= 0.05 && load.requests >= 10) {
    alerts.push({
      id: 'http-error-rate',
      level: load.errorRate >= 0.15 ? 'critical' : 'warning',
      source: 'http',
      title: 'Taux d’erreurs HTTP élevé',
      detail: `${Math.round(load.errorRate * 100)} % de 5xx sur ${load.requests} requêtes (~${load.windowSec}s).`,
    })
  }

  for (const p of load.topErrors.slice(0, 3)) {
    if (p.errors < 2) continue
    alerts.push({
      id: `http-path-${p.path}`,
      level: p.errors >= 5 ? 'critical' : 'warning',
      source: 'http',
      title: `Endpoint en erreur : ${p.path}`,
      detail: `${p.errors} × 5xx / ${p.count} appels · p95 ${p.p95Ms} ms`,
    })
  }

  for (const p of load.topSlow.slice(0, 2)) {
    if (p.p95Ms < 800 || p.count < 3) continue
    alerts.push({
      id: `http-slow-${p.path}`,
      level: 'info',
      source: 'http',
      title: `Endpoint lent : ${p.path}`,
      detail: `p95 ${p.p95Ms} ms · moy ${p.avgMs} ms · ${p.count} appels`,
    })
  }

  const levelRank: Record<AdminAlertLevel, number> = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => levelRank[a.level] - levelRank[b.level])

  return { load, pool, alerts, push }
}
