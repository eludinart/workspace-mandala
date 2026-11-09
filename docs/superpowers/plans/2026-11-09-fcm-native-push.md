# FCM natif Mandala — Implementation Plan

> **For agentic workers:** execute task-by-task. Steps use checkbox syntax.

**Goal:** Mandala envoie via FCM HTTP v1 (natif Android TWA + FCM web), garde Web Push VAPID pour iOS PWA, déploie Coolify + AAB Play, test Éric-only.

**Architecture:** Projet Firebase **dédié Mandala** (pas Fleur) ; tokens dans `mdl_push_subscriptions.provider` ; Android `FirebaseMessagingService` + pont `fcm_token` query ; backend routeur FCM / web-push.

**Tech Stack:** Firebase Android BOM, FCM HTTP v1 (JWT SA Mandala), Firebase JS optionnel, Next.js Mandala, Bubblewrap TWA.

## Global Constraints

- Package Android : `art.eludein.mandala`
- Firebase project : **nouveau projet Mandala** (ne pas utiliser `fleurdamourweb`)
- Ne pas broadcaster de test hors Éric Ludinard
- Pas de secrets dans git (`nogit/` / Coolify)

---

### Task 1: Projet Firebase Mandala + google-services.json

- [ ] Créer le projet GCP/Firebase Mandala (Console ou CLI user)
- [ ] Apps : Android `art.eludein.mandala` + Web Mandala ; SA FCM
- [ ] Déposer `google-services.json` + SA dans `nogit/` ; brancher `android-twa/app/`
- [ ] Domaine autorisé : `mandala.eludein.art`

### Task 2: Schéma + register API provider

- [ ] Colonne `provider` sur `mdl_push_subscriptions`
- [ ] `upsert` FCM token (endpoint=token, provider=fcm|fcm_web)
- [ ] Route / client : enregistrer token natif depuis query `fcm_token`

### Task 3: Backend envoi FCM

- [ ] Remplacer stub `fcm.ts` par envoi HTTP v1 (pattern Fleur)
- [ ] Routeur dans `web-push-send` / send unifié selon provider
- [ ] Purge tokens UNREGISTERED

### Task 4: Client web + SW

- [ ] Lire `fcm_token` URL, register, strip URL
- [ ] Option FCM web (Chrome) si config publique présente ; iOS reste VAPID
- [ ] SW : payload FCM data + VAPID inchangé

### Task 5: Android TWA natif

- [ ] Gradle Google services + Firebase Messaging
- [ ] Canal `mandala_alerts`, `MandalaFirebaseMessagingService`
- [ ] `LauncherActivity.getLaunchingUrl` injecte token si changé
- [ ] Bump versionCode 2

### Task 6: Env Coolify + deploy web

- [ ] Copier secrets FCM / Firebase publics vers Mandala Coolify
- [ ] Deploy Coolify Mandala
- [ ] Smoke health

### Task 7: AAB + Play + test Éric

- [ ] Build AAB signé, upload
- [ ] Test push uniquement user Éric ; rapporter résultat / appareil
