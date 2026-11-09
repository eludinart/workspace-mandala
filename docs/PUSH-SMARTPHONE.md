# Checklist — notifications push smartphone

Prérequis : déploiement **HTTPS** (`https://mandala.eludein.art`) avec :

**Web Push iOS (VAPID)**
- `VAPID_SUBJECT` / `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

**FCM (projet Firebase `mandala-ca1bb`)**
- `FCM_PROJECT_ID=mandala-ca1bb`
- `FCM_SERVICE_ACCOUNT_B64` ou `FCM_SERVICE_ACCOUNT_JSON` (SA Admin)
- `NEXT_PUBLIC_FIREBASE_*` + `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (voir `nogit/firebase-mandala.env`)

Rails : `fcm` (TWA Play natif) · `fcm_web` (Chrome) · `web_push` (iOS PWA).  
Table `mdl_push_subscriptions.provider` créée / migrée au premier enregistrement.

## Android Play (TWA — FCM natif)

1. Installer Mandala depuis le Play Store (AAB ≥ versionCode 2).
2. Ouvrir l’app, se connecter, accepter les notifications.
3. Test push (Compte ou admin ciblé) → notif OS via canal `mandala_alerts` même app fermée.

## Android / desktop (Chrome — FCM web ou VAPID)

1. Ouvrir Mandala en HTTPS, se connecter.
2. Accepter le modal « Activer les notifications », ou **Compte → Préférences alertes → Activer**.
3. Test push comme ci-dessus.

## iPhone (Safari 16.4+ — Web Push / APNs)

1. Partager → **Sur l’écran d’accueil** (PWA obligatoire).
2. Rouvrir depuis l’icône, activer les notifications.
3. Test push — reste sur le rail `web_push` (pas d’app iOS native).

## Contrôles utiles

- API : `GET /api/notifications/vapid_public_key` → `{ configured: true, publicKey: "..." }`
- API : `POST /api/notifications/test_push` (cookie session) → `{ ok: true, sent: N }`
- Admin → **Push** : taux `accepted → delivered → opened`, échecs, users sans ack
- Fiche membre admin : appareils + timeline + test push ciblé
- Accusé appareil : le SW appelle `POST /api/notifications/push_ack` (`delivered` / `opened`) avec HMAC
- Cron : `GET/POST /api/cron/push-delivery-alerts` (Bearer `MANDALA_CRON_SECRET`) — seuil + purge 30j
- **Prod planifié** (VPS root crontab) : `5 * * * *` → `/opt/data/scripts/mandala-push-delivery-alerts.sh` (log `/var/log/mandala-push-alerts.log`). Secret Coolify `MANDALA_CRON_SECRET` + miroir `/opt/data/secrets/mandala-cron.env` (hors git).
- Centre d’alertes in-app : badge / liste (polling) indépendant du push OS

### Certitude

| Statut | Signifie |
|--------|----------|
| `accepted` | Push service a accepté l’envoi |
| `delivered` | Service worker a reçu et affiché la notif |
| `opened` | Tap sur la notification |
| pas de `delivered` | Téléphone non réveillé / DND / SW jamais lancé — le serveur ne peut pas prouver davantage |

## Échecs fréquents

| Symptôme | Cause probable |
|----------|----------------|
| `configured: false` | Clés VAPID absentes ou rebuild sans `NEXT_PUBLIC_*` |
| Test : aucun appareil | Permission refusée ou abonnement jamais enregistré |
| iOS : rien | App ouverte dans Safari sans « Écran d’accueil » |
| Dev HTTP local | Push limitée ; préférer HTTPS (`dev.vps` / prod) |
