# Suite Mandala

Liste des chantiers pas encore dans l’application. Cochez à la main, ou demandez à l’agent.

- **Prochaine case** : « fais la prochaine case de la suite »
- **Ajouter** : « ajoute à la suite : … »
- **Où on en est** : « où en est la suite »
- Une case cochée `[x]` est livrée. La prochaine est la première `[ ]` de la section À faire.
- Ne pas enchaîner les cases dans la même session.

## Règles

- Chaque nouveauté a une porte. Public de départ : administrateurs d’application. Ensuite : gestionnaires du lieu, tout le monde, ou une personne nommée. Le serveur refuse, pas seulement le menu.
- Tant qu’une porte est fermée, le comportement actuel ne change pas pour les autres.
- Pour voir l’application comme un membre, utiliser un compte qui n’est pas administrateur.
- Langage à l’écran : lien, message, conversation, lieu ami. Pas le vocabulaire hérité de l’autre application. Détail : `docs/VOCABULAIRE.md`.
- Pas de questionnaire à la connexion. Une question, au moment où elle sert, que l’on peut passer.
- Le bouton ? reste le mode d’emploi sur demande. Une carte d’explication s’affiche une fois, sur l’écran concerné.
- Le calendrier du lieu actif ne mélange pas les dates des autres lieux.

## À faire

- [ ] **Ouvrir un événement ou une ressource.** Une ligne « Les lieux amis peuvent s’inscrire », seulement s’il existe déjà un lien. Même ligne sur une ressource. Sans lien, la ligne n’est pas affichée.
- [ ] **Conversation au premier message.** Bouton « Écrire aux gestionnaires » sur le lieu relié. Le fil apparaît dans Messages au premier envoi, nommé par les deux lieux. Pas de groupe vide créé à l’acceptation.
- [ ] **Traits sur la carte.** Uniquement les liens du lieu touché, et seulement les liens que la personne a le droit de voir.
- [ ] **Ville, une fois.** Après la charte, « Vous venez de quelle ville ? », on peut passer. Aussi pour les comptes déjà créés, une seule fois. Les gestionnaires voient des totaux par ville. Derrière la porte `carte_membres` pour l’affichage ; la question elle-même derrière `aide_contextuelle` ou la même porte, fermée par défaut.
- [ ] **Point sur la carte.** Choix séparé, décoché : « Montrer ma ville sur la carte ». Porte `carte_membres`.
- [ ] **Cartes d’explication.** Une fois par personne et par écran, le jour où elle y entre ou le jour où la porte s’ouvre pour elle. Une raison, un bouton. Porte `aide_contextuelle`, fermée tant que vous ne l’ouvrez pas.
- [ ] **Écrire à quelqu’un d’un lieu ami.** Seulement via une date commune ou une conversation où un gestionnaire a ajouté la personne. Porte `seuil`.
- [ ] **Coches lu en conversation de groupe.** Les conversations à deux ont déjà envoyé / lu. En groupe : sur mes messages, montrer quand c’est lu (par tout le monde, ou un résumé clair). Sans changer le comportement des conversations à deux.
- [ ] **Monétisation Lieu / Pro.** Derrière porte billing. Spec `docs/superpowers/specs/2026-11-01-monetisation-design.md`, plan `docs/superpowers/plans/2026-11-01-monetisation-mvp.md`. Ne pas ouvrir la porte tant que le smoke Stripe test n’est pas vert.

## Fait

- [x] **2026-11-01 — Vocabulaire Mandala.** Direction verrouillée (`docs/VOCABULAIRE.md`) : à l’écran lien / message / conversation / lieu ami. Copy « Graines / Jardinier » retirée de Messages ; erreurs API alignées. Tables/routes legacy (`prairie_*`, seeds) non renommées.
- [x] **2026-11-01 — Porte des fonctions.** Tables `feature_doors` / `feature_door_users`, `canAccessFeatureDoor`, admin onglet Portes, `GET /api/feature-doors/access`. Clés : `lieux_lies`, `seuil`, `carte_membres`, `aide_contextuelle` (défaut administrateurs). Schéma `docs/schema/018_mandala_feature_doors.sql`.
- [x] **2026-11-01 — Relier depuis la carte.** Table `place_links`, `POST/GET /api/place-links`, bouton « Relier à… » sur les fiches lieu (Découvrir / carte) derrière porte `lieux_lies`. Un lieu géré = envoi immédiat ; plusieurs = une question. Pas de page Lieux amis. Schéma `019_mandala_place_links.sql`.
- [x] **2026-11-01 — Accepter dans l’alerte.** Notif `place_link_request` aux gestionnaires du lieu cible à la demande Relier ; Accepter / Refuser dans Alertes (`POST /api/place-links/[id]/respond`). Pas de cases ; rien d’autre n’est envoyé tant que l’alerte n’est pas ouverte.
- [x] **2026-11-01 — Dates des lieux amis.** Colonne `open_to_friend_places` ; Accueil + bloc « Ailleurs » (couleur du lieu hôte) ; calendrier local inchangé ; « Je viens » via présence hôte pour les lieux amis ; inscrits regroupés par lieu côté hôte. Porte `lieux_lies`. Schéma `020_mandala_events_open_friends.sql`.
- [x] **2026-11-01 — Vue gestionnaire Lieux amis.** Page `place-friends` depuis Mes lieux ; `GET /api/manager/communities/[id]/friend-places` (accepted + pending). Porte `lieux_lies`.
