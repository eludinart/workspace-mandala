import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Derrière Coolify/Traefik : forcer HTTPS si la requête arrive en HTTP. */
export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== 'production') return NextResponse.next()

  const forwarded = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const proto =
    forwarded || (req.headers.get('x-forwarded-ssl') === 'on' ? 'https' : '')
  if (proto === 'http') {
    const url = req.nextUrl.clone()
    url.protocol = 'https:'
    return NextResponse.redirect(url, 308)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
