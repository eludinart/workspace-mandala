# Design — Freemium lieu : plafond de membres (non abonnés)

Date : 2026-11-05  
Statut : accepted · implémentation  
Réf. produit : `docs/MONETIZATION-PLAN.md`, `docs/superpowers/specs/2026-11-01-monetisation-design.md`  
Complète : listing public déjà gated par offre Lieu (`assertCanListPlacePublic`)

## Problème

Un lieu sans offre Lieu a déjà une vie interne complète et n’apparaît pas au catalogue public. Il manque un frein **orga** quand le lieu grandit : rien n’incite le gestionnaire à souscrire tant que le listing public seul ne suffit pas. Il faut une limite gênante à l’échelle, sans paywall social ni app inutilisable (Play Store + promesse « habitants gratuits »).

## Décisions verrouillées

1. **Quoi** : plafond de **40 membres actifs** pour un lieu **sans** offre Lieu active (ni `billing_partner`, ni abo `active` / `trialing`).
2. **Compteur** : réutiliser `countCommunityMembers` / `coveredMemberCount` déjà exposés côté billing — **une seule source de vérité**.
3. **Portes à bloquer** (uniquement nouvelles adhésions) :
   - `joinCommunity` (rejoindre via slug / code)
   - `addMemberToCommunityByManager` (ajout gestionnaire)
4. **Reste libre** pour les membres déjà dans le lieu : mur, messages, lecture / inscription événements, compétences de base, vie interne.
5. **Soft warning à 80 %** : dès **32 / 40**, bandeau gestionnaire (réglages lieu + page Membres) : *« Votre lieu approche de la limite gratuite (32/40). L’offre Lieu lève le plafond et active la carte publique. »*
6. **Hard stop à 40** : refuser toute nouvelle adhésion (API 403 métier) + message clair avec CTA vers Offre Lieu / checkout. **Aucun kick**, aucun retrait de rôle, aucun soft-delete de membre existant.
7. **Nature du plafond** : **stock permanent** (pas de quota mensuel, pas de reset).
8. **Offre Lieu active** (ou partner) : plafond **illimité** + bénéfices déjà prévus (catalogue / carte publique, badge, etc.).
9. **Porte billing fermée** (`MANDALA_BILLING_PUBLIC=0`) : **pas** d’application du plafond (comportement actuel inchangé), aligné sur le gate listing.
10. **Grandfather** : si un lieu dépasse déjà 40 à l’activation de la règle, on **ne retire personne** ; seules les **nouvelles** adhésions sont refusées jusqu’à souscription.
11. **Landing `#tarifs`** : mentionner le plafond 40 en gratuit et que l’offre Lieu lève la limite + active la carte publique.

## Comportement UX

| État | Qui voit quoi | Action possible |
| --- | --- | --- |
| `< 32` | Rien d’intrusif | Croissance normale |
| `32–39` | Bandeau soft gestionnaires | Continuer à recruter ; CTA soft Offre Lieu |
| `= 40` sans abo | Soft + hard stop | Rejoindre / ajouter = bloqué ; CTA fort Offre Lieu |
| Abo Lieu / partner | Compteur « N membres couverts » (existant) | Illimité |

Copy hard stop :  
*« Ce lieu a atteint la limite de 40 membres en gratuit. Souscrivez à l’offre Lieu pour accueillir sans plafond et figurer sur la carte publique. »*

Les habitants déjà membres **ne voient pas** de paywall sur mur / chat / events.

## Technique (points d’accroche)

| Zone | Action |
| --- | --- |
| `billing-entitlements` | Constantes + `placeMemberCapState` / `canAcceptNewPlaceMember` (purs, testables) |
| `assertCanAcceptNewPlaceMember` | Gate serveur avant INSERT membre |
| `joinCommunity` / `addMemberToCommunityByManager` | Appel du gate |
| UI Membres / réglages lieu | Bandeau 80 % + état saturé |
| Landing `#tarifs` | Copy plafond + Offre Lieu |
| Erreur API | `status: 403`, `code: place_member_cap_reached` |

## Critères d’acceptation

1. Lieu non abonné à 39 membres : une 40ᵉ adhésion OK ; une 41ᵉ refusée.
2. À 32 membres : bandeau soft visible aux gestionnaires.
3. Membres existants : mur, messages, inscription événement inchangés à 40.
4. Offre Lieu / partner : adhésions illimitées.
5. Porte billing fermée : aucun refus lié au plafond.
6. Lieu déjà > 40 à l’activation : pas de kick ; joins suivants refusés jusqu’à abo.
7. Un seul compteur : aligné `coveredMemberCount` / `countCommunityMembers`.
8. Landing reflète plafond + déblocage via Offre Lieu.

## Hors scope (exclu explicitement)

| Exclu | Pourquoi |
| --- | --- |
| Limiter mur / messages / lecture fil | Casse la promesse « social gratuit » ; risque Play Store |
| Limiter création ou inscription événements | Trop punitif |
| Quota mensuel / reset | Plafond de **taille**, pas un débit |
| Kick ou rétrogradation au-delà de 40 | Inacceptable produit |
| Plafond Mandala Pro / habitants individuels | Offre Lieu couvre les membres |
| Relier / lieux amis, médias, exports | Pas v1 de ce freemium |
