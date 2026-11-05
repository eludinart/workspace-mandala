import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  adminBillingOpsUrgency,
  deriveAdminBillingOpsStatus,
} from './admin-billing-ops'

const now = new Date('2026-11-05T12:00:00.000Z')

describe('deriveAdminBillingOpsStatus', () => {
  it('marks past_due / unpaid', () => {
    assert.equal(
      deriveAdminBillingOpsStatus(
        {
          status: 'past_due',
          plan_family: 'place',
          payment_provider: 'stripe',
          current_period_end: new Date('2026-12-01T00:00:00.000Z'),
        },
        now
      ),
      'past_due'
    )
    assert.equal(
      deriveAdminBillingOpsStatus(
        {
          status: 'unpaid',
          plan_family: 'pro',
          payment_provider: 'stripe',
          current_period_end: null,
        },
        now
      ),
      'past_due'
    )
  })

  it('marks active when no end date', () => {
    assert.equal(
      deriveAdminBillingOpsStatus(
        {
          status: 'active',
          plan_family: 'pro',
          payment_provider: 'stripe',
          current_period_end: null,
        },
        now
      ),
      'active'
    )
  })

  it('marks expiring_soon within warn window', () => {
    assert.equal(
      deriveAdminBillingOpsStatus(
        {
          status: 'trialing',
          plan_family: 'place',
          payment_provider: 'comp',
          current_period_end: new Date('2026-11-10T12:00:00.000Z'),
        },
        now
      ),
      'expiring_soon'
    )
  })

  it('marks grace for comp place after period end', () => {
    assert.equal(
      deriveAdminBillingOpsStatus(
        {
          status: 'trialing',
          plan_family: 'place',
          payment_provider: 'comp',
          current_period_end: new Date('2026-11-03T12:00:00.000Z'),
        },
        now
      ),
      'grace'
    )
  })

  it('marks expired for stripe place after end', () => {
    assert.equal(
      deriveAdminBillingOpsStatus(
        {
          status: 'active',
          plan_family: 'place',
          payment_provider: 'stripe',
          current_period_end: new Date('2026-11-03T12:00:00.000Z'),
        },
        now
      ),
      'expired'
    )
  })

  it('marks canceled', () => {
    assert.equal(
      deriveAdminBillingOpsStatus(
        {
          status: 'canceled',
          plan_family: 'pro',
          payment_provider: 'stripe',
          current_period_end: new Date('2026-10-01T00:00:00.000Z'),
        },
        now
      ),
      'canceled'
    )
  })
})

describe('adminBillingOpsUrgency', () => {
  it('orders past_due before active', () => {
    assert.ok(adminBillingOpsUrgency('past_due') < adminBillingOpsUrgency('grace'))
    assert.ok(adminBillingOpsUrgency('grace') < adminBillingOpsUrgency('expiring_soon'))
    assert.ok(adminBillingOpsUrgency('expiring_soon') < adminBillingOpsUrgency('active'))
  })
})
