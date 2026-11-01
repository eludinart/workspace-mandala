/**
 * POST /api/legal/accept — accepte le paquet CGU / confidentialité / CGV courant
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiError } from '@/lib/api-auth'
import { acceptCurrentCguBundle } from '@/lib/db-legal'
import { LEGAL_CGU_VERSION } from '@/lib/legal-versions'
import { clientIpFromRequest } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = await req.json().catch(() => ({}))
    if (!body?.accept_cgu) {
      return NextResponse.json(
        { error: 'accept_cgu requis' },
        { status: 422 }
      )
    }
    await acceptCurrentCguBundle({
      userId: uid,
      ip: clientIpFromRequest(req.headers),
      userAgent: req.headers.get('user-agent'),
    })
    return NextResponse.json({ ok: true, cgu_version: LEGAL_CGU_VERSION })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
