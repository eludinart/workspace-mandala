/**
 * POST /api/social/send_seed
 * L'envoi de graines entre utilisateurs a été retiré.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json(
    { error: "L'envoi de graines entre utilisateurs n'est plus disponible" },
    { status: 410 }
  )
}
