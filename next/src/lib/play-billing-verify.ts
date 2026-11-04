/**
 * Vérification serveur d’un achat Google Play (Android Publisher API).
 *
 * Auth : `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (JSON string) ou
 * `GOOGLE_APPLICATION_CREDENTIALS` (chemin fichier).
 * Dev only : `PLAY_BILLING_STUB_ACK=1` sans credentials.
 */
import { createSign } from 'crypto'
import { readFileSync } from 'fs'

export type PlayVerifyResult =
  | { ok: true; orderId: string | null; expiryTimeMillis: number | null; stub: boolean }
  | { ok: false; error: string }

type ServiceAccount = {
  client_email: string
  private_key: string
  token_uri?: string
}

function loadServiceAccount(): ServiceAccount | null {
  const raw = (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '').trim()
  if (raw) {
    try {
      return JSON.parse(raw) as ServiceAccount
    } catch {
      return null
    }
  }
  const path = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()
  if (!path) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount
  } catch {
    return null
  }
}

function b64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  )
  const unsigned = `${header}.${claim}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  const signature = b64url(signer.sign(sa.private_key))
  const assertion = `${unsigned}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string
    error?: string
    error_description?: string
  }
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `OAuth Play ${res.status}`
    )
  }
  return data.access_token
}

export async function verifyPlaySubscriptionPurchase(params: {
  packageName: string
  subscriptionId: string
  purchaseToken: string
}): Promise<PlayVerifyResult> {
  const stub = (process.env.PLAY_BILLING_STUB_ACK || '').trim() === '1'
  const sa = loadServiceAccount()

  if (!sa?.client_email || !sa.private_key) {
    if (stub) {
      return {
        ok: true,
        orderId: `stub-${params.purchaseToken.slice(0, 12)}`,
        expiryTimeMillis: Date.now() + 30 * 24 * 3600 * 1000,
        stub: true,
      }
    }
    return {
      ok: false,
      error:
        'Vérification Play non configurée (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON).',
    }
  }

  try {
    const token = await getAccessToken(sa)
    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${encodeURIComponent(params.packageName)}/purchases/subscriptionsv2/tokens/` +
      `${encodeURIComponent(params.purchaseToken)}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string }
      lineItems?: Array<{
        expiryTime?: string
        productId?: string
      }>
      latestOrderId?: string
      subscriptionState?: string
    }

    if (!res.ok) {
      return {
        ok: false,
        error: data.error?.message || `Play API ${res.status}`,
      }
    }

    const state = String(data.subscriptionState || '')
    const active =
      state === 'SUBSCRIPTION_STATE_ACTIVE' ||
      state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' ||
      state === ''
    if (!active && state) {
      return { ok: false, error: `Abonnement Play non actif (${state})` }
    }

    const line =
      data.lineItems?.find((l) => l.productId === params.subscriptionId) ||
      data.lineItems?.[0]
    let expiryTimeMillis: number | null = null
    if (line?.expiryTime) {
      const ms = Date.parse(line.expiryTime)
      expiryTimeMillis = Number.isFinite(ms) ? ms : null
    }

    // Best-effort acknowledge (ignore errors if already acked)
    try {
      const ackUrl =
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
        `${encodeURIComponent(params.packageName)}/purchases/subscriptions/` +
        `${encodeURIComponent(params.subscriptionId)}/tokens/` +
        `${encodeURIComponent(params.purchaseToken)}:acknowledge`
      await fetch(ackUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
    } catch {
      /* non bloquant */
    }

    return {
      ok: true,
      orderId: data.latestOrderId ?? null,
      expiryTimeMillis,
      stub: false,
    }
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Erreur vérification Play',
    }
  }
}

export function playPackageName(): string {
  return (
    process.env.PLAY_PACKAGE_NAME ||
    process.env.ANDROID_PACKAGE_NAME ||
    'art.eludein.mandala'
  ).trim()
}
