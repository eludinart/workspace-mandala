# Design — Push FCM natif Mandala (Play TWA) + iOS Web Push

Date : 2026-11-09  
Statut : accepted · implémentation  
Repo : `workspace-mandala`

## Problème

Mandala envoie aujourd’hui du **Web Push VAPID**. La TWA Play a déjà la **délégation de notifs** (`enableNotifications: true`), mais ce n’est pas du FCM natif : fiabilité limitée (Doze, OEM, app tuée). Objectif : canal **FCM natif Android** + envoi backend FCM, sans réécrire le produit web, avec **iOS PWA** toujours servi.

## Décisions

1. **Projet Firebase dédié Mandala** `mandala-ca1bb` (séparé de Fleur). Apps Android `art.eludein.mandala` + Web « Mandala Web » + SA FCM + certificat Web Push. Ne pas réutiliser les secrets Fleur.
2. **Triple rail d’abonnement** :
   - `fcm` — token natif Android (Play TWA / FirebaseMessaging)
   - `fcm_web` — token Firebase Messaging JS (Chrome PWA / desktop)
   - `web_push` — abonnement VAPID (surtout **iOS Safari PWA** → APNs sous-jacent)
3. **Envoi unifié** côté serveur : route selon `provider` ; purger les tokens morts FCM.
4. **Canal Android** `mandala_alerts` : importance haute, son, badge, lumières.
5. **Pont TWA → web** : au launch, si le token FCM a changé, l’ajouter en query `fcm_token` ; le client web (session) l’enregistre puis nettoie l’URL.
6. **Pas d’app iOS native** : pas de certificat APNs App Store ; iOS reste Web Push PWA.
7. **Test post-deploy** : push de test **uniquement** vers Éric Ludinard ; vérifier accusés / appareil.

## Approches écartées

| Option | Pourquoi non |
| --- | --- |
| Réutiliser Firebase Fleur | Rejeté : isolation Mandala / Fleur (secrets, quotas, blast radius) |
| FCM Web seul | N’apporte pas le réveil natif Play demandé |
| Capacitor / fork app native complète | Hors scope « ne pas réécrire l’appli web » |
| APNs natif iOS | Pas d’app App Store Mandala |

## Schéma données

Étendre `mdl_push_subscriptions` :

- `provider` ENUM-like `VARCHAR` : `web_push` | `fcm` | `fcm_web` (défaut `web_push`)
- Pour FCM : `endpoint` = token FCM (unique) ; `p256dh` / `auth` = placeholders `fcm` / `native` ou `web`

## Fichiers touchés (cible)

- Backend : `next/src/lib/fcm.ts` (vrai envoi HTTP v1), `db-push.ts`, `web-push-send.ts` (routeur), routes register
- Client : `push-client.ts`, évent. Firebase JS + config publique
- SW : `public/sw.js` (compat messages FCM web + push VAPID)
- Android : `android-twa` — Firebase BOM, `MandalaFirebaseMessagingService`, canal, `LauncherActivity` token, `google-services.json` (nogit / app)
- Docs : `PUSH-SMARTPHONE.md`, Play version bump

## Secrets / env Coolify Mandala

Projet Firebase **Mandala only** :

- `FCM_PROJECT_ID=mandala-ca1bb`
- `FCM_SERVICE_ACCOUNT_FILE` → `nogit/fcm-service-account.json` (ou B64 Coolify)
- `NEXT_PUBLIC_FIREBASE_*` + `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (voir `nogit/firebase-mandala.env`)
- Conserver `VAPID_*` existants pour iOS Web Push
- `android-twa/app/google-services.json` (package `art.eludein.mandala`, projet `mandala-ca1bb`)

Note : une app Android Mandala avait été créée par erreur sous `fleurdamourweb` — à supprimer côté Console Fleur.

## Play Store

- `versionCode` / `versionName` → **2**
- Rebuild AAB signé, upload (internal puis prod selon procédure)
- Data safety : déjà « push » ; pas de nouvelle finalité pub

## Critères de succès

1. Token `fcm` enregistré depuis le TWA Play pour un user connecté.
2. Envoi admin/test → notification OS avec canal Mandala (app fermée).
3. iOS PWA : toujours recevable via `web_push`.
4. Test Éric-only : au moins un `accepted` ; idéalement `delivered` / `opened` sur son appareil.
