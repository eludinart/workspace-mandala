/**
 * FCM HTTP v1 — envoi vers tokens natifs / web Firebase.
 * Projet Mandala dédié : mandala-ca1bb (SA via FCM_SERVICE_ACCOUNT_*).
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import * as jwt from 'jsonwebtoken'
import { deletePushSubscriptionById, type PushSubscriptionRow } from './db-push'

const FCM_CHANNEL_ID = 'mandala_alerts'

function getProjectId(): string {
  const envVal = process.env.FCM_PROJECT_ID?.trim() ?? ''
  if (envVal) return envVal
  const paths = [
    resolve(process.cwd(), 'google-services.json'),
    resolve(process.cwd(), '..', 'android-twa', 'app', 'google-services.json'),
    resolve(process.cwd(), '..', 'nogit', 'google-services.json'),
  ]
  for (const p of paths) {
    if (!existsSync(p)) continue
    try {
      const data = JSON.parse(readFileSync(p, 'utf8')) as { project_info?: { project_id?: string } }
      const id = data?.project_info?.project_id
      if (id) return id
    } catch {
      /* ignore */
    }
  }
  return ''
}

function decodeBase64ToUtf8(raw: string): string | null {
  let s = raw.trim().replace(/^\uFEFF/, '')
  s = s.replace(/\s+/g, '')
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4
  if (pad) s += '='.repeat(4 - pad)
  try {
    const buf = Buffer.from(s, 'base64')
    if (buf.length < 50) return null
    return buf.toString('utf8')
  } catch {
    return null
  }
}

function parseServiceAccountJsonString(json: string): { client_email?: string; private_key?: string } | null {
  let s = json.trim().replace(/^\uFEFF/, '')
  if (s.startsWith('"') && s.endsWith('"') && s.includes('\\"type\\"')) {
    try {
      s = JSON.parse(s) as string
    } catch {
      /* ignore */
    }
  }
  try {
    const parsed = JSON.parse(s) as { client_email?: string; private_key?: string }
    if (parsed.client_email && parsed.private_key) return parsed
  } catch {
    /* suite */
  }
  try {
    const fixed = s.replace(/"private_key"\s*:\s*"([\s\S]*?)(?<!\\)"/g, (_: string, key: string) => {
      return `"private_key":"${key.replace(/\n/g, '\\n')}"`
    })
    const parsed = JSON.parse(fixed) as { client_email?: string; private_key?: string }
    if (parsed.client_email && parsed.private_key) return parsed
  } catch {
    /* ignore */
  }
  return null
}

function getServiceAccount(): { client_email?: string; private_key?: string } | null {
  const filePath = (process.env.FCM_SERVICE_ACCOUNT_FILE ?? '').trim()
  if (filePath) {
    const abs = filePath.startsWith('/') ? filePath : resolve(process.cwd(), filePath)
    if (existsSync(abs)) {
      try {
        const parsed = parseServiceAccountJsonString(readFileSync(abs, 'utf8'))
        if (parsed) return parsed
      } catch {
        console.warn('[FCM] FCM_SERVICE_ACCOUNT_FILE illisible :', abs)
      }
    }
  }

  const b64Raw = process.env.FCM_SERVICE_ACCOUNT_B64 ?? ''
  if (b64Raw.trim()) {
    const decoded = decodeBase64ToUtf8(b64Raw)
    if (decoded) {
      const parsed = parseServiceAccountJsonString(decoded)
      if (parsed) return parsed
    }
  }

  const envVal = (process.env.FCM_SERVICE_ACCOUNT_JSON ?? '').trim()
  let json: string | null = null
  if (envVal.startsWith('{')) {
    json = envVal
  } else if (envVal) {
    const p = resolve(process.cwd(), envVal.replace(/^\.\//, ''))
    if (existsSync(p)) {
      try {
        json = readFileSync(p, 'utf8')
      } catch {
        /* ignore */
      }
    }
  }
  if (!json) {
    const defaults = [
      resolve(process.cwd(), '..', 'nogit', 'fcm-service-account.json'),
      resolve(process.cwd(), '..', 'config', 'fcm-service-account.json'),
      resolve(process.cwd(), '..', '..', 'workspace', 'config', 'fcm-service-account.json'),
    ]
    for (const defaultPath of defaults) {
      if (!existsSync(defaultPath)) continue
      try {
        json = readFileSync(defaultPath, 'utf8')
        break
      } catch {
        /* ignore */
      }
    }
  }

  if (json) {
    const parsed = parseServiceAccountJsonString(json)
    if (parsed) return parsed
  }
  return null
}

export function isFcmConfigured(): boolean {
  return !!(getProjectId() && getServiceAccount()?.client_email && getServiceAccount()?.private_key)
}

async function getAccessToken(): Promise<string | null> {
  const sa = getServiceAccount()
  if (!sa?.client_email || !sa?.private_key) return null

  const now = Math.floor(Date.now() / 1000)
  const token = jwt.sign(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: 'RS256' }
  )

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token,
    }).toString(),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.warn('[FCM] OAuth2 token error', res.status, errBody.slice(0, 300))
    return null
  }
  const data = (await res.json()) as { access_token?: string }
  return data.access_token ?? null
}

export type FcmSendResult = 'ok' | 'gone' | 'error'

export type FcmSendOutcome = {
  result: FcmSendResult
  /** Court détail pour mdl_push_sends.error_detail (≤255). */
  detail?: string
}

/** Formate un échec FCM HTTP v1 pour logs / error_detail (tronqué à 220). */
export function formatFcmErrorDetail(
  kind: 'http' | 'response' | 'oauth' | 'no_project',
  parts: { status?: number; body?: string; error?: unknown } = {}
): string {
  const body =
    parts.body?.replace(/\s+/g, ' ').trim() ||
    (parts.error != null ? JSON.stringify(parts.error).replace(/\s+/g, ' ').trim() : '')
  const statusBit = parts.status != null ? String(parts.status) : ''
  const prefix =
    kind === 'http'
      ? `fcm_http${statusBit ? `_${statusBit}` : ''}`
      : kind === 'response'
        ? 'fcm_response_error'
        : kind === 'oauth'
          ? 'fcm_oauth'
          : 'fcm_no_project'
  const raw = body ? `${prefix} ${body}` : prefix
  return raw.slice(0, 220)
}

export async function sendFcmToSubscription(
  sub: PushSubscriptionRow,
  title: string,
  body: string,
  webPath: string,
  options?: { tag?: string; sendId?: number; sig?: string }
): Promise<FcmSendOutcome> {
  const projectId = getProjectId()
  if (!projectId) {
    return { result: 'error', detail: formatFcmErrorDetail('no_project') }
  }
  const accessToken = await getAccessToken()
  if (!accessToken) {
    return { result: 'error', detail: formatFcmErrorDetail('oauth') }
  }

  const origin = (process.env.NEXT_PUBLIC_APP_URL || 'https://mandala.eludein.art').replace(/\/$/, '')
  const link = webPath.startsWith('http') ? webPath : `${origin}${webPath.startsWith('/') ? webPath : `/${webPath}`}`
  const icon = `${origin}/icon-192.png`
  const provider = (sub.provider || 'fcm').toLowerCase()
  // Uniquement le token natif Play — pas les endpoints web_push Android.
  const isNative = provider === 'fcm'

  const message: Record<string, unknown> = {
    token: sub.endpoint,
    notification: { title, body },
    data: {
      title,
      body,
      url: webPath,
      ...(options?.sendId ? { sendId: String(options.sendId), sig: String(options.sig ?? '') } : {}),
      ...(options?.tag ? { tag: options.tag } : {}),
    },
  }

  if (isNative) {
    // HIGH + notification système : affichage même si l’app est tuée depuis longtemps.
    message.android = {
      priority: 'HIGH',
      ttl: '86400s',
      notification: {
        channel_id: FCM_CHANNEL_ID,
        sound: 'default',
        default_sound: true,
        default_vibrate_timings: true,
        notification_count: 1,
        visibility: 'PUBLIC',
      },
    }
  } else {
    const webpushBlock: Record<string, unknown> = {
      headers: { Urgency: 'high' },
      notification: {
        title,
        body,
        icon,
        badge: icon,
        requireInteraction: false,
        ...(options?.tag ? { tag: options.tag, renotify: true } : {}),
      },
      fcm_options: { link },
    }
    message.webpush = webpushBlock
  }

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  })

  if (res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: unknown }
    if (!data.error) return { result: 'ok' }
    const detail = formatFcmErrorDetail('response', { error: data.error })
    console.warn('[FCM] Erreur réponse', sub.endpoint.slice(0, 24), detail)
    return { result: 'error', detail }
  }

  const errText = await res.text().catch(() => '')
  const detail = formatFcmErrorDetail('http', { status: res.status, body: errText })
  console.warn('[FCM] HTTP', res.status, sub.endpoint.slice(0, 24), detail)
  if (
    res.status === 404 ||
    /NotRegistered|UNREGISTERED|INVALID_ARGUMENT|Requested entity was not found/i.test(errText)
  ) {
    await deletePushSubscriptionById(sub.id).catch(() => {})
    return { result: 'gone', detail }
  }
  return { result: 'error', detail }
}

/** Compat anciens appels (messages) — délègue au routeur web-push-send. */
export async function sendFcmPush(
  userId: number,
  _email: string | null,
  title: string,
  body: string,
  url?: string
): Promise<void> {
  const { sendWebPushToUser } = await import('./web-push-send')
  await sendWebPushToUser(userId, title, body, url ?? null)
}
