# Mandala — réponses Data safety & UGC (Play Console)

> À cocher / coller dans **Contenu de l’application** (App content).  
> Aligné sur https://mandala.eludein.art/confidentialite · maj 2026-11-03.

---

## 1. Contenu généré par les utilisateurs (UGC)

| Question | Réponse |
|----------|---------|
| L’app permet-elle du UGC ? | **Oui** |
| Types | Messages, publications mur, profils, compétences / ressources, photos de lieux |
| Contenu choquant possible via UGC ? | Possible (modéré) — pas de contenu adulte promu |
| Modération | **Oui** — signalement + revue admin |
| Signalement in-app | **Oui** — mur + messagerie |
| Blocage utilisateurs | **Oui** — conversation 1:1 |
| CGU acceptées | **Oui** — à l’inscription + gate comptes anciens |
| Contact / signalement | contact@eludein.art · Admin → Modération |

---

## 2. Publicités

| Question | Réponse |
|----------|---------|
| L’app contient-elle des pubs ? | **Non** |

---

## 3. Cible d’âge / classification

| Question | Réponse |
|----------|---------|
| Public cible | **13+** (pas Families / enfants) |
| Catégorie store | **Social** (ou Style de vie) |

---

## 4. Data safety — synthèse

| Question | Réponse |
|----------|---------|
| Collecte des données ? | **Oui** |
| Données chiffrées en transit ? | **Oui** (HTTPS) |
| Suppression de compte possible ? | **Oui** — Compte → supprimer |
| Vente de données ? | **Non** |
| Partage avec réseaux pub / ciblage pub ? | **Non** |
| Politique de confidentialité | https://mandala.eludein.art/confidentialite |

### Types de données à déclarer

| Type Play | Collecté | Partagé | Obligatoire | Finalité |
|-----------|----------|---------|-------------|----------|
| Adresse e-mail | Oui | Non* | Oui (compte) | Compte |
| Nom | Oui | Non* | Oui | Profil |
| Messages / UGC | Oui | Non* | Non (usage) | Fonctionnalité app |
| Identifiants appareil / push | Oui si notifs | Non* | Non (opt-in) | Notifications |
| Infos d’achat | Oui (Stripe web / Play Billing) | Avec processeur paiement | Si abo | Facturation |
| Localisation **précise** (GPS user) | **Non** | — | — | Ne pas cocher |
| Localisation approximative | Non (coords lieux = contenu lieu, pas tracking user) | — | — | — |
| Photos / vidéos | Oui si upload user | Non* | Non | Fonctionnalité |
| Identifiants compte | Oui | Non* | Oui | Compte |

\*Hors prestataires techniques sous contrat (hébergeur, e-mail, paiement) — déclarer « partage avec prestataires de services » si le formulaire le demande, **pas** « réseaux publicitaires ».

### Finalités typiques à cocher

- Fonctionnalités de l’application  
- Gestion du compte  
- Communications développeur / notifications (si push)  
- Traitement des paiements / abonnements  

Ne **pas** cocher : publicité, personnalisation pub, vente, analyse pub tierce.

---

## 5. Politiques / liens store

| Champ | Valeur |
|-------|--------|
| E-mail support | contact@eludein.art |
| Site | https://mandala.eludein.art |
| Confidentialité | https://mandala.eludein.art/confidentialite |
| CGU | https://mandala.eludein.art/cgu |

Textes titre / descriptions : `docs/PLAY-STORE-LISTING.md`.
