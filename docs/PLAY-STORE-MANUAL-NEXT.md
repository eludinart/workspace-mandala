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

Fiche publique store : **pas encore listée** (`play.google.com/store/apps/details?id=art.eludein.mandala` → 404).  
Une release « completed » sur la piste production ≠ app visible tant que la revue / config contenu n’est pas validée.

## Ce qui reste (manuel Console)

1. **Configurer votre application** (questionnaires App content) — réponses : `docs/PLAY-STORE-DATA-SAFETY.md`
   - Confidentialité → `https://mandala.eludein.art/confidentialite`
   - Annonces → **Non**
   - Cible → **13+**, pas Families
   - UGC → **Oui** + signalement / modération
   - Data safety → tableau du doc
   - Finance → abonnements / Play Billing
   - Santé / gouv → **Non**
   - Catégorie → **Social** · support `contact@eludein.art`
2. **Envoyer pour examen** (vue publication) dès que le bouton n’est plus grisé.
3. **Testeurs** : API `edits.testers` encore `{}` sur internal/alpha/beta → rattacher la liste (`elude_interne` ou e-mails) + **Enregistrer**.
4. Lien opt-in / test : `https://play.google.com/apps/testing/art.eludein.mandala` (login Google testeur).
5. Smoke téléphone TWA : pas de barre Chrome, login, mur, signaler ; abo Play sandbox si CTA visibles.
6. (Optionnel) Nouveau `versionCode` **seulement** si packaging Android change — le web Coolify se met à jour sans nouvel AAB.

## Compte (non bloquant immédiat)

Bannière « Déclarez votre statut de professionnel » (échéance 2027) — à traiter, pas la cause du 404 store.

Quand les questionnaires sont validés / le lien opt-in marche : dis « opt-in OK » pour enchaîner le smoke device.
