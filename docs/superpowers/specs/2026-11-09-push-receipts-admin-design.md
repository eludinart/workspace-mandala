# Design — Accusés push admin (delivered / opened)

**Date :** 2026-11-09  
**Statut :** design validé (approche 1) — implémenté

## Problème

L’admin ne peut pas savoir avec certitude si une push Web a été **reçue et affichée** sur le téléphone. Aujourd’hui seul le statut push-service (`sent` / `gone` / `error`) existe. Le SW reçoit déjà l’événement en local (`MDL_PUSH_RECEIVED`) sans callback serveur.

## Décisions produit

| Choix | Décision |
| --- | --- |
| Audience | App admin uniquement |
| Portée | Diagnostic membre + monitoring global + alerte seuil + alerte individuelle |
| Livraison | Une seule vague |
| Certitude | `delivered` = SW a reçu et `showNotification` ; `opened` = tap |
| Limite | Pas de preuve si téléphone éteint / SW jamais réveillé |

## Approche retenue

Reçus maison : `mdl_push_sends` + `mdl_push_receipts`, ack SW via HMAC (`sendId`), onglet Admin Push + bloc dans `AdminUserSheet`, alertes seuil + critiques.

### Modèle

- `mdl_push_sends` : un envoi / abonnement (`accepted` \| `gone` \| `error`)
- `mdl_push_receipts` : `delivered` \| `opened` (unique `send_id, event`)
- `mdl_push_subscriptions` : `platform`, `standalone`, `last_seen_at`

### Flux

1. Envoi VAPID → insert send → payload `{ sendId, sig, … }`
2. SW push → showNotification → `POST /api/notifications/push_ack` (`delivered`)
3. SW click → ack `opened`
4. Admin overview / fiche user / check_alerts + purge 30j

### Admin

- Fiche membre : appareils + timeline sends/receipts + test ciblé
- Onglet Push : taux 24h/7j, échecs, users sans delivered
- Seuil : taux delivered/accepted sur 6h < 60 % (min N) → notif + e-mail admins
- Individuel : annonce/broadcast/test admin sans aucun `accepted` → alerte critique

### Hors scope v1

Capacitor natif, organisateurs de lieu, agrégats > 30j, graphiques avancés.
