/**
 * Statut opérationnel pour le parc admin (actifs + à risque + historique).
 * Pur / testable — pas d’accès DB.
 */
import {
  COMP_PLACE_GRACE_DAYS,
  COMP_PLACE_WARN_DAYS_BEFORE,
} from '@/lib/billing-comp-constants'

export type AdminBillingOpsStatus =
  | 'active'
  | 'expiring_soon'
  | 'grace'
  | 'past_due'
  | 'expired'
  | 'canceled'

export type AdminBillingOpsInput = {
  status: string
  plan_family: 'place' | 'pro' | string
  payment_provider: string | null | undefined
  current_period_end: Date | null
}

const MS_DAY = 24 * 60 * 60 * 1000

export function deriveAdminBillingOpsStatus(
  row: AdminBillingOpsInput,
  now: Date = new Date()
): AdminBillingOpsStatus {
  const status = String(row.status ?? '').toLowerCase()
  if (status === 'canceled' || status === 'cancelled') return 'canceled'
  if (status === 'past_due' || status === 'unpaid') return 'past_due'

  const end = row.current_period_end
  if (!end) return 'active'

  const endMs = end.getTime()
  const nowMs = now.getTime()
  const provider = String(row.payment_provider ?? 'stripe').toLowerCase()
  const isCompPlace = row.plan_family === 'place' && provider === 'comp'

  if (nowMs > endMs) {
    if (isCompPlace && nowMs <= endMs + COMP_PLACE_GRACE_DAYS * MS_DAY) {
      return 'grace'
    }
    return 'expired'
  }

  if (endMs <= nowMs + COMP_PLACE_WARN_DAYS_BEFORE * MS_DAY) {
    return 'expiring_soon'
  }
  return 'active'
}

/** Urgence pour le tri par défaut (plus petit = plus urgent). */
export function adminBillingOpsUrgency(ops: AdminBillingOpsStatus): number {
  switch (ops) {
    case 'past_due':
      return 0
    case 'grace':
      return 1
    case 'expiring_soon':
      return 2
    case 'active':
      return 3
    case 'expired':
      return 4
    case 'canceled':
      return 5
    default: {
      const _exhaustive: never = ops
      return _exhaustive
    }
  }
}

export const ADMIN_BILLING_OPS_LABELS: Record<AdminBillingOpsStatus, string> = {
  active: 'Actif',
  expiring_soon: 'Bientôt',
  grace: 'Grâce',
  past_due: 'Impayé',
  expired: 'Expiré',
  canceled: 'Annulé',
}
