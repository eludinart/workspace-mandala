/**
 * GET /api/legal/status — version CGU courante + acceptation utilisateur
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiError } from '@/lib/api-auth'
import { hasAcceptedCurrentCgu } from '@/lib/db-legal'
import {
  LEGAL_CGU_VERSION,
  LEGAL_CGV_VERSION,
  LEGAL_PRIVACY_VERSION,
  LEGAL_DOC_META,
} from '@/lib/legal-versions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const accepted = await hasAcceptedCurrentCgu(uid)
    return NextResponse.json({
      cgu_version: LEGAL_CGU_VERSION,
      cgv_version: LEGAL_CGV_VERSION,
      privacy_version: LEGAL_PRIVACY_VERSION,
      cgu_accepted: accepted,
      docs: LEGAL_DOC_META,
    })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e instanceof ApiError ? e.status : e.status ?? 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
