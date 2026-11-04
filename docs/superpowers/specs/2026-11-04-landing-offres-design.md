# Design — Landing : section Offres (Lieu + Mandala Pro)

Date : 2026-11-04  
Statut : accepted · implémentation  
Réf. produit : `docs/MONETIZATION-PLAN.md`  
Chantier Suite : **Landing — tarifs & comparaison**  
Hors scope (chantier séparé) : élargissement lieu → cercle / projet

## Problème

La landing (`PublicLandingPage`) présente le mur, le projet et l’appel à rejoindre, mais **aucune offre** ni frontière gratuit / payant. Les prix et le checkout existent déjà dans l’app (`BillingOffersPage`, Stripe / Play). Un visiteur public ne peut pas comprendre, sans entrer dans l’app, ce que paie un gestionnaire de lieu ou un pro — ni que les **habitants restent gratuits** sur le social.

## Décisions verrouillées

1. **Emplacement** : ancre `#tarifs` sur la landing (approche 1), après `#projet`, avant `#rejoindre`. Pas dans le hero.
2. **Nav** : lien **Offres** → `/#tarifs` dans `PublicSiteChrome` (pas le libellé agressif « Tarifs » en gros).
3. **Public** : deux colonnes côte à côte — **Offre Lieu** et **Mandala Pro** — plus un rappel net que les habitants restent gratuits.
4. **Ton** : pas de slogan commercial du type « Gratuit pour participer · payant pour rayonner ». Ouverture douce sur la gratuité de la vie du lieu.
5. **Prix** : **jamais hardcodés** dans la landing. Source = catalogue billing (`GET /api/billing/products`), aligné Stripe (voir § Prix).
6. **Pas de checkout** sur la landing. CTA doux vers l’app.
7. **Chantier cercle** : copy et modèle « lieu = aussi groupe virtuel » restent hors de ce chantier.

## Approches écartées

| Option | Pourquoi non |
| --- | --- |
| Page `/tarifs` seule | Un clic de plus ; moins visible depuis le parcours landing actuel |
| Teaser + page détail | Double maintenance pour peu de gain en v1 |
| Hardcode marketing des montants | Dérive vs Stripe ; l’utilisateur l’a exclu explicitement |
| Tableau Free vs Pro « tout le monde » | Sonnerait SaaS et laisserait croire que les habitants doivent payer |
| Checkout Stripe/Play sur `/` | Trop pushy ; surface de paiement déjà dans l’app + règles Play |

## Structure UI

### Ordre dans `#tarifs`

1. Eyebrow **Offres** + titre sobre.
2. Sous-titre (sens) : *La vie du lieu — mur, messages, événements — reste ouverte à tous les membres. Les offres ci-dessous aident les lieux et les pratiques à être visibles dans le Mandala public.*
3. Bandeau habitants (toujours gratuits) : mur, messages, événements, compétences de base.
4. Grille 2 colonnes (stack mobile) : Lieu | Mandala Pro.
5. Lien discret CGV. CTA secondaire : « Voir dans l’app » → connecté `/app` (l’utilisateur ouvre Compte → Abonnements / offres comme aujourd’hui) ; non connecté `/app?mode=register`. Pas de deep-link checkout.

### Colonne Offre Lieu

- Destinataire : gestionnaire de lieu.
- Bullets **statiques** (produit, pas prix) : badge lieu vérifié / listé · catalogue & carte publique · mise en avant possible · membres couverts sans abo individuel.
- Sans offre : le lieu vit pour ses membres ; pas de présence « officielle » dans le Mandala public.
- Prix : **dynamiques** — produits `plan_family === 'place'` (mensuel + annuel).

### Colonne Mandala Pro

- Destinataire : personne / pratique.
- Bullets : carte Pro · mise en avant annuaire · CTA Contacter · parcours de vérification.
- Note : badge Pro = abo **et** validation humaine.
- Sans offre : teaser de pratique possible ; pas de badge ni carte Pro complète.
- Prix : **dynamiques** — produits `plan_family === 'pro'`.

### Style

- Classes `m-landing-*` existantes.
- Pas de badge « populaire », pas de cards SaaS lourdes, pas de gros CTA « S’abonner ».

## Prix — source unique Stripe / catalogue

### État actuel

- `GET /api/billing/products` est déjà **public** (pas de `price_id` exposé).
- `listBillingProducts()` lit `billing-products.json` : labels, `amount_cents`, `unit`, et `configured` via env `STRIPE_PRICE_*`.
- Les montants JSON peuvent **diverger** d’un Price Stripe modifié dans le Dashboard.

### Comportement cible

1. **Landing** et **BillingOffersPage** consomment le **même** `GET /api/billing/products` (catalogue enrichi).
2. `listBillingProducts` devient **async** (ou un wrapper `listBillingProductsHydrated`) : pour chaque produit avec `price_id` env présent, `prices.retrieve` Stripe → `unit_amount` ; **cache mémoire ~10 min** par `price_id`.
3. Priorité d’affichage du montant : **Stripe** si retrieve OK → sinon **`amount_cents` JSON** (secours catalogue, pas une 3ᵉ grille marketing) → si les deux absents, ne pas afficher de chiffre pour ce produit.
4. Affichage landing : même formatage que l’app (`X € / mois`, `Y € / an`). Grouper par `plan_family`.
5. Porte `MANDALA_BILLING_PUBLIC` : la section **reste visible** ; le checkout peut rester fermé dans l’app.

### Hors scope prix

- Adaptive Pricing / multi-devise (autre spec i18n).
- Écriture des Prices Stripe depuis Mandala.
- Afficher les `price_id` côté client.

## Technique

| Élément | Détail |
| --- | --- |
| Fichiers UI | `PublicLandingPage.tsx`, `PublicSiteChrome.tsx`, composant dédié `landing/LandingOffersSection.tsx` |
| Catalogue | Helper hydrate Stripe dans `billing-catalog` / `stripe` ; route `products` attend la liste hydratée |
| Fetch landing | **Client** via `billingApi.listProducts` (même chemin que `BillingOffersPage`) ; loading / erreur soft (section copy visible, prix « — » ou masqués) |
| Auth | Aucune requise pour lire les prix |
| Checkout | Aucun sur `/` |

## Critères d’acceptation

1. Nav **Offres** scrolle vers `#tarifs` depuis `/`.
2. Section présente après le projet, avant rejoindre ; ton sans slogan « gratuit / payant pour rayonner ».
3. Habitants clairement gratuits ; deux colonnes Lieu + Pro.
4. Montants affichés = catalogue (idéalement Stripe live) ; **aucun** hardcode marketing dans le JSX de la landing.
5. Changer un Price Stripe (montant) se reflète sur landing et offres app après expiration du cache (ou redémarrage selon implémentation cache).
6. Pas de checkout ni d’appel create-checkout depuis la landing.
7. Aucune copy « cercle / projet virtuel » dans ce chantier.

## Suite / hors scope

- Chantier **Élargissement lieu → cercle / projet** (`docs/SUITE.md`) : vocabulaire et positionnement séparés.
- Page `/tarifs` dédiée : non retenue en v1.
