# Mandala — Plan monétisation (badge vérifié = ligne de démarcation)

> **Statut :** produit · affine le design technique  
> **Date :** 2026-11-01  
> **Réf. technique :** `docs/superpowers/specs/2026-11-01-monetisation-design.md`  
> **Tarifs :** Lieu **29 €/mois** · **290 €/an** · Mandala Pro **12 €/mois** · **120 €/an**

---

## 1. Principe directeur

**Le badge vérifié est la ligne de démarcation.**

| Sans paiement | Avec paiement (+ validation) |
|---------------|------------------------------|
| Profil / fiche **possible** mais **limitée** | Badge **vérifié** visible |
| Pas de badge vérifié | Fonctions payantes débloquées (listing public, boost, carte Pro, etc.) |
| Teasers visibles (« ce que le badge ouvre ») | Confiance + découvrabilité |

On ne monétise **pas** la vie relationnelle : rejoindre un lieu, mur, messages, s’inscrire aux événements, compétences de base restent gratuits pour les habitants.

**Formule :**
> Gratuit = exister et participer.  
> Payant = être **reconnu** (badge vérifié) et **rayonner** (visibilité + outils pro / lieu).

---

## 2. Deux chemins payants

### 2.1 Offre Lieu (organisation)

Payeur : **gestionnaire** du lieu.  
Bénéficiaires : **tous les membres** (vie sociale toujours gratuite).

### 2.2 Mandala Pro (professionnel / pratique)

Payeur : la **personne**.  
Indépendant du plan Lieu (on peut être Pro sans que son lieu paie, et inversement).

---

## 3. Lieux — gratuit vs payant

### 3.1 Gratuit (lieu sans abo / sans partner)

Le lieu **existe** dans Mandala, mais reste dans un **périmètre limité** :

| Inclus | Exclu (nécessite offre Lieu ou partner) |
|--------|----------------------------------------|
| Créer / gérer le lieu | **Listing public** catalogue & carte publique |
| Fiche lieu visible aux **membres** | Priorité / mise en avant (`featured`) |
| Charte, invitations, rôles gestionnaire | Badge lieu **vérifié / listé** (voir §5) |
| Mur, calendrier, événements, messages **internes** | Compteur marketing « N membres couverts » comme argument catalogue |
| Annonces internes | Pack diffusion « entre dans le Mandala public » |
| Mode brouillon / privé (`listed_public = 0`) | |

**Limitation clé du gratuit lieu :**  
le lieu n’apparaît **pas** (ou seulement en teaser non cliquable / non indexé) dans la **Découverte publique**. Les visiteurs hors membres ne le trouvent pas comme lieu « officiel » du réseau.

### 3.2 Payant — offre Lieu active (ou `billing_partner`)

| Débloqué |
|----------|
| **Badge lieu vérifié / listé** (marque de confiance sur fiche & carte) |
| `listed_public` autorisé → catalogue + carte publique |
| Boost catalogue / featured |
| Copy & UI : « lieu du Mandala public » |
| Membres toujours gratuits sous la licence du lieu |
| Accès file d’endossement Mandala Pro pour les membres du lieu |

Copy CTA :  
*« Fais entrer ton lieu dans le Mandala public — badge vérifié, tes membres restent gratuits. »*

---

## 4. Professionnels — gratuit vs payant

### 4.1 Gratuit (pas d’abo Mandala Pro, ou abo sans validation)

Toute personne peut avoir une **part de profil pro limitée** :

| Inclus | Exclu |
|--------|--------|
| Compte + profil membre | **Badge Mandala Pro vérifié** |
| Lister des compétences / tags (dont registre métier) | Boost dans l’annuaire Compétences |
| Texte court « je propose… » (teaser) | **Carte Mandala Pro** complète (accroche, modalités, zone, lien, lieux d’attache) |
| Être trouvé via liens humains (messages, lieux) | CTA **Contacter** pro mis en avant |
| Voir ce que Pro débloque (teaser) | Filtre « Mandala Pro » / placement prioritaire |

**Limitation clé du gratuit pro :**  
on peut **dire** qu’on a une pratique, mais on n’a **ni la confiance du badge**, **ni la découvrabilité** dans l’annuaire payant.

### 4.2 Payant — abo Mandala Pro actif

| Dès l’abo actif | Après validation (§5) |
|-----------------|------------------------|
| Boost annuaire | **Badge Mandala Pro vérifié** |
| Carte Pro (édition + affichage) | Badge affiché partout (compétences, profil, carte) |
| CTA Contacter | |
| Accès au parcours de demande de vérification | |

**Règle produit :**  
`abo actif` sans `verified` → fonctions payantes **sauf badge**.  
`badge` = abo **et** validation réussie.

Copy CTA :  
*« Passe de “j’ai des compétences” à “on me trouve et on me fait confiance”. »*

---

## 5. Comment le badge vérifié se justifie

Le badge n’est **pas** un sticker acheté seul : c’est la preuve qu’un **humain de confiance** a endossé la fiche, **après** (ou dans le cadre d’) un abonnement qui finance la plateforme.

### 5.1 Badge lieu

| Étape | Qui | Quoi |
|-------|-----|------|
| 1 | Gestionnaire | Souscrit offre Lieu (ou reçoit `billing_partner` admin) |
| 2 | Système | Active listing / featured selon entitlements |
| 3 | Affichage | Badge **lieu listé / vérifié Mandala** sur fiche & carte |

**Justification :** le paiement + le statut gestionnaire prouvent un engagement organisationnel. Les early partners (`billing_partner`) sont whitelistés par l’équipe Mandala (même badge, sans Stripe).

**Révocation :** fin d’abo → retrait listing public + badge ; partner retiré par admin → idem.

### 5.2 Badge Mandala Pro

| Étape | Qui | Quoi |
|-------|-----|------|
| 1 | Utilisateur | Souscrit Mandala Pro (recommandé avant ou pendant la demande) |
| 2 | Utilisateur | Soumet demande : tagline, modalités, zone, tags métier, lien optionnel |
| 3 | Système | Statut `pending` |
| 4a | **Admin app** | Peut approuver / rejeter (toujours) |
| 4b | **Gestionnaire** d’un lieu dont le candidat est **membre** | Peut endosser / rejeter (fichier « à endosser ») |
| 5 | Système | `verified` → badge ; `rejected` → motif ; tracé `reviewer_id` + `endorsement_community_id` |

**Pas de KYC documentaire v1** (pas de pièce d’identité).  
La confiance repose sur :

1. **Engagement payant** (abo Pro), et  
2. **Endossement humain** (lieu connu ou équipe Mandala).

**Pourquoi ce modèle :**

- Évite le badge « payé = crédible » sans contrôle.  
- Ancre la confiance dans les **lieux** (cœur Mandala).  
- Garde un filet admin pour les pratiques hors lieu ou multi-lieux.

**Cas limites :**

| Situation | Comportement |
|-----------|--------------|
| Abo Pro, pas encore endossé | Boost + carte + CTA **sans** badge |
| Endossé puis abo expiré | Badge et boost retirés |
| Rejeté | Peut resoumettre après correction ; pas de badge |
| Copinage suspect | Admin peut révoquer ; motif + reviewer audités |

---

## 6. Matrice récapitulatif

| Capacité | Habitant | Lieu gratuit | Lieu payant | Pro gratuit | Pro payant | Pro payant + vérifié |
|----------|----------|--------------|-------------|-------------|------------|----------------------|
| Social (mur, messages, events) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Compétences de base | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Listing public lieu | — | ❌ | ✅ | — | — | — |
| Badge lieu | — | ❌ | ✅ | — | — | — |
| Carte / boost / CTA Pro | — | — | — | ❌ | ✅ | ✅ |
| **Badge Mandala Pro** | — | — | — | ❌ | ❌ | ✅ |

---

## 7. Limitations du gratuit (message produit clair)

À afficher dans l’UI (teasers, offres, réglages) :

**Lieu :**  
*« Votre lieu vit déjà pour ses membres. Le plan Lieu ajoute le badge vérifié et la présence dans le Mandala public. »*

**Pro :**  
*« Décrivez votre pratique librement. Le plan Mandala Pro + validation débloque le badge vérifié, la carte Pro et la mise en avant. »*

Éviter tout paywall sur : lecture mur, envoi message, inscription événement, acceptation charte.

---

## 8. Alignement technique (rappel)

| Concept produit | Technique |
|-----------------|-----------|
| Lieu payant | `resolvePlaceBilling` → `placeActive` / partner |
| Listing + boost lieu | `place_listed_public`, `place_catalog_boost` |
| Badge lieu | UI liée à `placeActive` (ou flag dédié plus tard) |
| Pro payant | `proActive` (abo) |
| Badge Pro | `proActive && proVerified` (`pro_badge`) |
| Validation Pro | `POST …/pro/submit` + review admin/gestionnaire |

Porte : `MANDALA_BILLING_PUBLIC=0` jusqu’à smoke Stripe/Play OK.

---

## 9. Critères de succès (produit)

1. Un lieu sans abo **ne** figure pas comme lieu public « vérifié ».  
2. Un pro sans abo **n’a pas** de badge ; un pro avec abo sans endossement a les outils **sans** badge.  
3. Endossement gestionnaire ou admin → badge visible.  
4. Habitant : zéro friction sociale.  
5. Copy offres parle d’abord **badge + confiance**, puis listing / boost.

---

## 10. Décisions verrouillées (cette affine)

1. **Badge vérifié = ligne de démarcation** marketing et UX.  
2. Gratuit = profil / fiche **limitée**, sans badge.  
3. Payant = badge (après process) **+** fonctions de rayonnement.  
4. Badge Pro = **abo + endossement** (pas abo seul).  
5. Badge lieu = **abo Lieu ou partner** (engagement organisation).  
6. Pas de KYC docs v1 ; confiance lieux + admin.
