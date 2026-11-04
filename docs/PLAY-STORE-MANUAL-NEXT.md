# Play Store — reste manuel (après automation 2026-11-04)

L’API a confirmé : app OK, fiche FR + images OK, AAB v1 en **test interne** (`completed`), assetlinks en prod, Coolify préparé (`PLAY_SKU_*`, SA JSON, Stripe restauré).

## Bloquant : profil paiements Google

Création des abonnements API →  
`Cannot create a subscription without first registering a payments profile`.

1. [Play Console](https://play.google.com/console) → **Paramètres** → **Profil de paiements** (ou Compte développeur → Paiements)  
2. Créer / lier un profil (infos légales + compte bancaire / Adresse)  
3. Attendre validation si demandée  

Puis créer les 4 abos (mêmes prix Stripe) :

| Product ID | Prix |
|---|---|
| `place_monthly` | 29 € / mois |
| `place_yearly` | 290 € / an |
| `pro_monthly` | 12 € / mois |
| `pro_yearly` | 120 € / an |

Les `PLAY_SKU_*` Coolify pointent déjà sur ces IDs.

## Test interne

1. Console → Test → **Test interne** → onglet **Testeurs** → ajoute ton e-mail (ou liste Google)  
2. Copie le **lien d’opt-in**, ouvre-le sur le téléphone Android, accepte  
3. Installe Mandala → smoke (pas de barre Chrome, login)

## Questionnaires (toujours Console)

- Data safety → `docs/PLAY-STORE-DATA-SAFETY.md`  
- UGC + 13+ → `docs/PLAY-STORE-AVOID-REJECTION.md`

Quand SKUs actifs : dis « SKUs OK » pour smoke billing Play (vérif serveur déjà branchée).
