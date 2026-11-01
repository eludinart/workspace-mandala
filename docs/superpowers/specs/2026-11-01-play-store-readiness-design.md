# Mandala — Play Store readiness (design)

> **Statut :** accepted (implémentation) · **Date :** 2026-11-01  
> **Repo :** `eludinart/workspace-mandala`

## Intent

Préparer Mandala (PWA Next + Coolify) pour Google Play via TWA, **sans** forker le produit : PC et Android partagent la même app web. Poser les briques politiques Play (légal, UGC, blocage) et le **double rail de paiement** (Stripe web / Play Billing in-app).

## Décisions

1. **Une URL prod** `https://mandala.eludein.art` — Coolify = source de vérité.
2. **Légal** : pages publiques `/cgu`, `/cgv`, `/confidentialite` + acceptation CGU à l’inscription et gate pour comptes existants (version `LEGAL_CGU_VERSION`).
3. **UGC** : table `content_reports` (cible typée) + admin ; distinct de `support_reports` (bugs/aide).
4. **Blocage** : `user_blocks` ; messages 1:1 refusés si blocage dans un sens.
5. **Paiements** : Stripe Checkout sur web ; Digital Goods + Payment Request sur contexte Play ; entitlements unifiés dans `mdl_mandala_billing_subscriptions` via `payment_provider` (`stripe` | `play`).
6. **Offline TWA** : SW sert une page offline minimale ; `/.well-known/assetlinks.json` placeholder configurable.

## Hors scope v1

- Compte développeur Play / AAB Bubblewrap (ops manuel).
- Vérification Google Play Developer API complète (socle + mode stub documenté).
- Programmes « external offers » EEA.
