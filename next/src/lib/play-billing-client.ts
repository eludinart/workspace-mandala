/**
 * Client Digital Goods / Payment Request pour Google Play Billing (TWA).
 * Sur navigateur classique, ces APIs sont absentes.
 * Le fallback Stripe est géré uniquement hors contexte Play
 * (`resolvePaymentSurface` / BillingOffersPage) — jamais dans un TWA Play.
 */

export type PlayPurchaseResult = {
  purchaseToken: string
  itemId: string
}

function getDigitalGoodsServiceCtor():
  | ((method: string) => Promise<DigitalGoodsService>)
  | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    getDigitalGoodsService?: (method: string) => Promise<DigitalGoodsService>
  }
  return typeof w.getDigitalGoodsService === 'function' ? w.getDigitalGoodsService.bind(w) : null
}

/** True si l’environnement expose Play Billing (TWA / Chrome Android Play). */
export async function isPlayBillingAvailable(): Promise<boolean> {
  const getter = getDigitalGoodsServiceCtor()
  if (!getter || typeof PaymentRequest === 'undefined') return false
  try {
    const service = await getter('https://play.google.com/billing')
    return Boolean(service)
  } catch {
    return false
  }
}

/**
 * Lance l’achat Play pour un SKU (product_id catalogue = sku Play).
 * Le prix est celui de la Play Console ; `total` est ignoré par Play.
 */
export async function purchasePlaySubscription(
  sku: string
): Promise<PlayPurchaseResult> {
  const getter = getDigitalGoodsServiceCtor()
  if (!getter) throw new Error('Play Billing indisponible sur cet appareil')

  await getter('https://play.google.com/billing')

  const request = new PaymentRequest(
    [
      {
        supportedMethods: 'https://play.google.com/billing',
        data: { sku },
      },
    ],
    {
      total: {
        label: 'Total',
        amount: { currency: 'EUR', value: '0' },
      },
    }
  )

  const response = await request.show()
  const details = response.details as {
    purchaseToken?: string
    token?: string
    itemId?: string
  }
  const purchaseToken = String(details.purchaseToken || details.token || '').trim()
  if (!purchaseToken) {
    await response.complete('fail')
    throw new Error('Jeton d’achat Play manquant')
  }
  await response.complete('success')
  return {
    purchaseToken,
    itemId: String(details.itemId || sku),
  }
}

/** Typage minimal Digital Goods (pas dans lib.dom partout). */
interface DigitalGoodsService {
  getDetails?: (itemIds: string[]) => Promise<unknown>
  listPurchases?: () => Promise<unknown>
  acknowledge?: (token: string, purchaseToken: string) => Promise<void>
}
