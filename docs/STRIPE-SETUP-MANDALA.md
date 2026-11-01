# Mandala — config Stripe (ops)

Checklist liée : §1 de `docs/PLAY-STORE-ROADMAP.md` · case Suite **Stripe — config + smoke**.

## 1. Créer les prix (script)

Sur une machine avec Node 18+ et une clé **test** :

```powershell
cd c:\workspace-mandala
$env:STRIPE_SECRET_KEY = "sk_test_…"   # même compte Stripe que Fleur si org unique
node scripts\stripe-setup-mandala.mjs
```

Le script crée (ou réutilise) :

| Offre | Montant | Variable |
|-------|---------|----------|
| Lieu mensuel | 29 € | `STRIPE_PRICE_PLACE_MONTHLY` |
| Lieu annuel | 290 € | `STRIPE_PRICE_PLACE_YEARLY` |
| Mandala Pro mensuel | 12 € | `STRIPE_PRICE_PRO_MONTHLY` |
| Mandala Pro annuel | 120 € | `STRIPE_PRICE_PRO_YEARLY` |

Il tente aussi de créer le webhook  
`https://mandala.eludein.art/api/billing/stripe-webhook`  
(events : `checkout.session.completed`, `customer.subscription.*`).

Pour une clé **live** : ajouter `--live-ok`.

## 2. Coolify (app Mandala `c1kgkqqlagjt9auec0elpsma`)

Coller (sans commit git) :

```
MANDALA_BILLING_PUBLIC=0
NEXT_PUBLIC_APP_URL=https://mandala.eludein.art
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_PLACE_MONTHLY=price_…
STRIPE_PRICE_PLACE_YEARLY=price_…
STRIPE_PRICE_PRO_MONTHLY=price_…
STRIPE_PRICE_PRO_YEARLY=price_…
```

Redémarrer / redéployer l’app pour prendre les variables.

## 3. Dashboard Stripe

- **Customer portal** : Settings → Billing → Customer portal → activer (résiliation / carte).
- Webhooks → vérifier endpoint Mandala vert après un checkout test.

## 4. Smoke

1. `npm run test:billing` (local)
2. Compte **admin** sur prod → `GET /api/admin/billing/smoke` → `"ok": true`
3. Offres → checkout test carte `4242…` (Lieu + Pro)
4. Webhook reçu → droits actifs (`/api/billing/access`)
5. Compte → « Gérer un abonnement Stripe »
6. Compte non-admin : pas de CTA tant que `MANDALA_BILLING_PUBLIC=0`

**Ne pas** mettre `MANDALA_BILLING_PUBLIC=1` avant smoke vert volontaire.
