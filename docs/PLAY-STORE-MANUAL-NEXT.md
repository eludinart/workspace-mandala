# Play Store — reste manuel (état au 2026-11-09)

> **Procédure réutilisable :** `docs/PLAY-STORE-PROCEDURE.md`  
> Diagnostic API (compte de service) — **Elude In Art** / `art.eludein.mandala`  
> Developer `5266634445508197490` · App `4975649948655401313`

## Déjà opérationnel (ne pas refaire)

| Couche | État |
|--------|------|
| Prod web | `/api/health`, `/app`, `/cgu` `/cgv` `/confidentialite`, `assetlinks.json`, manifest, offline → **200** |
| AAB v1 | Uploadé · pistes **internal**, **alpha**, **production** (`status: completed`) |
| Fiche store FR | Titre + short + full + contact `contact@eludein.art` |
| Assets | Icône **1** · feature **1** · captures téléphone **6** |
| Abonnements Play | **4 ACTIVE** : `place_monthly`, `place_yearly`, `pro_monthly`, `pro_yearly` |
| Profil paiements | OK (sinon les SKUs n’existeraient pas) |
| Bubblewrap / keystore / SA API | Présents sous `android-twa/` + `nogit/` |

Prix FR Play (taxes store incluses, vs Stripe HT affiché web) :

| SKU | Prix Play FR |
|-----|--------------|
| `place_monthly` / `monthly` | **34,99 €** |
| `place_yearly` / `yearly` | **349,99 €** |
| `pro_monthly` / `monthly` | **13,99 €** |
| `pro_yearly` / `yearly` | **144,99 €** |

Fiche publique store : **publiée le 2026-11-09** via publication gérée  
(`Publier 1 modification` → déploiement production complet).  
Propagation Play : souvent &lt; 1 h.  
**Publication gérée** : après approbation, cliquer **Publier** dans Vue d’ensemble de la publication (API `completed` ≠ live store).

## Fait le 2026-11-09

- [x] App content (onglet Traitées)
- [x] Tests internes actifs + liste `elude_interne` (2) + lien opt-in
- [x] Publication gérée → **déploiement production** (9 nov.)

## Suite utile

1. Smoke téléphone depuis le Play Store (pas de barre Chrome, login, mur, signaler).
2. Lien opt-in interne : `https://play.google.com/apps/internaltest/4700375284149971265`
3. Abo Play sandbox si CTA visibles.
4. (Optionnel) Nouveau `versionCode` **seulement** si packaging Android change — le web Coolify se met à jour sans nouvel AAB.
5. Bannière « statut de professionnel » (échéance 2027) — non bloquant.

## Compte (non bloquant immédiat)

Bannière « Déclarez votre statut de professionnel » (échéance 2027) — à traiter, pas la cause du 404 store.

Quand les questionnaires sont validés / le lien opt-in marche : dis « opt-in OK » pour enchaîner le smoke device.
