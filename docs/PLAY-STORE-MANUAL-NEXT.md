# Play Store — reste manuel (après automation 2026-11-04)

> **Procédure réutilisable (toutes apps Élude) :** `docs/PLAY-STORE-PROCEDURE.md`

Diagnostic Console (2026-11-04 ~14h30) — **Elude In Art** / `art.eludein.mandala`  
Developer `5266634445508197490` · App `4975649948655401313`

## Pourquoi le lien d’opt-in n’apparaît pas

Ce n’est **pas** la release interne ni la liste `elude_interne`.

| Couche | État |
|--------|------|
| Piste interne (API) | Release **1 (1)** `status: completed` ✅ |
| Testeurs (API `edits.testers`) | **`{}` vide** — liste Console pas réellement attachée / pas sauvée |
| Tableau de bord app | **Brouillon / unreviewed** · **1 tâche sur 11** |
| Vue d’ensemble publication | « Modifications pas encore envoyées » · bouton **Envoyer pour examen** **grisé** |
| Message opt-in | « Le lien sera affiché ici quand vous publierez votre application » → normal tant que le dashboard n’est pas complété |

**Cause :** Google refuse d’exposer le lien d’opt-in tant que la config obligatoire « Configurer votre application » n’est pas finie (privacy, Data safety, classification, etc.).

Contournement à tester après privacy + 1–2 déclarations :  
`https://play.google.com/apps/testing/art.eludein.mandala`

## Dashboard — 1/11 tâches

### Décrire le contenu (tous ouverts)

1. Définir les règles de confidentialité → `https://mandala.eludein.art/confidentialite`
2. Informations de connexion (compte testeur revue)
3. Annonces → **Non** (`docs/PLAY-STORE-DATA-SAFETY.md`)
4. Classification du contenu (IARC)
5. Cible → **13+**, pas Families
6. Sécurité des données → `docs/PLAY-STORE-DATA-SAFETY.md`
7. Applis gouvernementales → Non
8. Fonctionnalités financières → abonnements / paiements in-app (Play Billing)
9. Santé → Non

### Organisation

10. Catégorie + coordonnées → Social / `contact@eludein.art` / `https://mandala.eludein.art`
11. Fiche Play Store → ✅ déjà OK

Puis : **Envoyer l’appli pour examen** (vue publication) → le lien opt-in devrait apparaître.

## Bloquant monétisation : profil paiements Google

Création des abonnements API →  
`Cannot create a subscription without first registering a payments profile`.

1. [Play Console](https://play.google.com/console) → **Paramètres** → **Profil de paiements**  
2. Créer / lier un profil (légal + IBAN / micro-virement)  
3. Attendre validation  

Puis créer les 4 abos (mêmes prix Stripe) :

| Product ID | Prix |
|---|---|
| `place_monthly` | 29 € / mois |
| `place_yearly` | 290 € / an |
| `pro_monthly` | 12 € / mois |
| `pro_yearly` | 120 € / an |

Les `PLAY_SKU_*` Coolify pointent déjà sur ces IDs.

## Test interne (après questionnaires)

1. Test → **Test interne** → **Testeurs** → cocher `elude_interne` → **Enregistrer**  
2. Vérifier que le lien d’opt-in s’affiche (ou URL testing ci-dessus)  
3. Installer Mandala → smoke (pas de barre Chrome, login)

## Questionnaires (réponses prêtes)

- Data safety / pubs / UGC / 13+ → `docs/PLAY-STORE-DATA-SAFETY.md` + `docs/PLAY-STORE-AVOID-REJECTION.md`
- Listing → `docs/PLAY-STORE-LISTING.md`

## Compte (hors opt-in, deadline 2027)

Bannière : **Déclarez votre statut de professionnel** (fév. 2027) — à faire, mais **pas** la cause du lien manquant aujourd’hui.

Quand SKUs actifs : dis « SKUs OK » pour smoke billing Play (vérif serveur déjà branchée).
