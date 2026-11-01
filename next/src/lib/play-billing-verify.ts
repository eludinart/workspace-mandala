/**
 * Vérification serveur d’un achat Google Play.
 *
 * Prod : brancher Google Play Developer API (androidpublisher) avec un compte
 * de service. En attendant, `PLAY_BILLING_STUB_ACK=1` autorise l’activation
 * (dev / staging uniquement).
 */

export type PlayVerifyResult =
  | { ok: true; orderId: string | null; expiryTimeMillis: number | null; stub: boolean }
  | { ok: false; error: string }

export async function verifyPlaySubscriptionPurchase(params: {
  packageName: string
  subscriptionId: string
  purchaseToken: string
}): Promise<PlayVerifyResult> {
  const stub = (process.env.PLAY_BILLING_STUB_ACK || '').trim() === '1'
  const hasCreds = Boolean(
    (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || '').trim() ||
      (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()
  )

  if (!hasCreds) {
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
        'Vérification Play non configurée (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ou PLAY_BILLING_STUB_ACK=1).',
    }
  }

  // Branchement API officiel à compléter avec googleapis androidpublisher.
  // On refuse plutôt que d’activer à l’aveugle si des credentials sont annoncés
  // mais l’intégration n’est pas encore câblée.
  void params.packageName
  void params.subscriptionId
  return {
    ok: false,
    error:
      'Intégration Google Play Developer API à finaliser (credentials détectés, client API manquant).',
  }
}

export function playPackageName(): string {
  return (
    process.env.PLAY_PACKAGE_NAME ||
    process.env.ANDROID_PACKAGE_NAME ||
    'art.eludein.mandala'
  ).trim()
}
