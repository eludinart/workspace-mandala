import jwt from 'jsonwebtoken'

const DEV_FALLBACK = 'dev-secret-change-in-production'

function getSecret(): string {
  const rawSecret = process.env.JWT_SECRET || DEV_FALLBACK
  if (rawSecret === DEV_FALLBACK && process.env.NODE_ENV === 'production') {
    throw new Error(
      '[FATAL] JWT_SECRET non défini ou égal au fallback de développement. ' +
        "Définissez une valeur forte dans les variables d'environnement de production."
    )
  }
  return rawSecret
}

function getExpireHours(): number {
  const n = parseInt(process.env.JWT_EXPIRE_HOURS || '720', 10)
  return Number.isFinite(n) && n > 0 ? n : 720
}

export function jwtEncode(payload: { sub: string; role?: string; email?: string }): string {
  return jwt.sign(
    { ...payload, iat: Math.floor(Date.now() / 1000) },
    getSecret(),
    { expiresIn: `${getExpireHours()}h` }
  )
}

export function jwtDecode(token: string): { sub: string; role?: string; email?: string } | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as { sub: string; role?: string; email?: string }
    return decoded
  } catch {
    return null
  }
}

/**
 * Refresh uniquement : accepte un token expiré dans une fenêtre de grâce.
 * Ne jamais utiliser pour requireAuth / routes protégées.
 */
export function jwtDecodeForRefresh(
  token: string,
  maxGraceSeconds = 7 * 24 * 3600
): { sub: string; role?: string; email?: string } | null {
  try {
    const decoded = jwt.verify(token, getSecret(), { ignoreExpiration: true }) as {
      sub: string
      role?: string
      email?: string
      exp?: number
    }
    if (typeof decoded.exp === 'number') {
      const overdue = Math.floor(Date.now() / 1000) - decoded.exp
      if (overdue > maxGraceSeconds) return null
    }
    return { sub: decoded.sub, role: decoded.role, email: decoded.email }
  } catch {
    return null
  }
}
