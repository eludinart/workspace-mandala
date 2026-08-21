# Checklist — notifications push smartphone

Prérequis : déploiement **HTTPS** (`https://mandala.eludein.art`) avec les variables VAPID renseignées dans Coolify :

- `VAPID_SUBJECT` (ex. `mailto:admin@mandala.eludein.art`)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (générés via `npx web-push generate-vapid-keys`)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = **même valeur** que `VAPID_PUBLIC_KEY`

La table `mdl_push_subscriptions` est créée automatiquement au premier enregistrement.

## Android (Chrome)

1. Ouvrir Mandala en HTTPS, se connecter.
2. Accepter le modal « Activer les notifications », ou **Compte → Préférences alertes → Activer**.
3. Mettre l’app en arrière-plan (pas forcer l’arrêt).
4. Depuis un autre compte : envoyer un message, **ou** Compte → **Envoyer un test push**.
5. Attendu : notification OS ; un tap ouvre `/app` (messages / notifications).

## iPhone (Safari 16.4+)

1. Partager → **Sur l’écran d’accueil** (PWA obligatoire pour Web Push iOS).
2. Ouvrir Mandala depuis l’icône d’accueil (pas l’onglet Safari seul).
3. Activer les notifications (modal ou Compte).
4. Même test qu’Android (message ou test push) avec l’app en arrière-plan.

## Contrôles utiles

- API : `GET /api/notifications/vapid_public_key` → `{ configured: true, publicKey: "..." }`
- API : `POST /api/notifications/test_push` (cookie session) → `{ ok: true, sent: N }`
- Centre d’alertes in-app : badge / liste (polling) indépendant du push OS

## Échecs fréquents

| Symptôme | Cause probable |
|----------|----------------|
| `configured: false` | Clés VAPID absentes ou rebuild sans `NEXT_PUBLIC_*` |
| Test : aucun appareil | Permission refusée ou abonnement jamais enregistré |
| iOS : rien | App ouverte dans Safari sans « Écran d’accueil » |
| Dev HTTP local | Push limitée ; préférer HTTPS (`dev.vps` / prod) |
