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
- Langage à l’écran : lien, message, conversation, lieu ami. Pas le vocabulaire hérité de l’autre application.
- Pas de questionnaire à la connexion. Une question, au moment où elle sert, que l’on peut passer.
- Le bouton ? reste le mode d’emploi sur demande. Une carte d’explication s’affiche une fois, sur l’écran concerné.
- Le calendrier du lieu actif ne mélange pas les dates des autres lieux.

## À faire

- [ ] **Porte des fonctions.** Écran d’administration : pour chaque fonction, public (administrateurs, gestionnaires, tout le monde) et personnes nommées. Défaut : administrateurs. Clés prévues : `lieux_lies`, `seuil`, `carte_membres`, `aide_contextuelle`. Aucune de ces fonctions n’est visible tant que sa porte n’est pas ouverte.
- [ ] **Relier depuis la carte.** Un gestionnaire ouvre un lieu et voit « Relier à … ». Un seul lieu géré : le bouton part tout de suite. Plusieurs lieux : une seule question, lequel. Pas de page « Lieux amis ».
- [ ] **Accepter dans l’alerte.** « Ce lieu souhaite se lier », Accepter et Refuser sur la notification. Pas de cases. Rien n’est envoyé tant que personne ne l’ouvre.
- [ ] **Dates des lieux amis.** Le calendrier du lieu ne change pas. Les événements ouverts apparaissent sur l’accueil et dans un bloc « Ailleurs » en bas de la liste d’événements, couleur du lieu qui invite. L’inscription utilise le bouton actuel. Le mot « visiteur » n’apparaît pas. L’hôte voit les inscrits regroupés par lieu.
- [ ] **Ouvrir un événement ou une ressource.** Une ligne « Les lieux amis peuvent s’inscrire », seulement s’il existe déjà un lien. Même ligne sur une ressource. Sans lien, la ligne n’est pas affichée.
- [ ] **Conversation au premier message.** Bouton « Écrire aux gestionnaires » sur le lieu relié. Le fil apparaît dans Messages au premier envoi, nommé par les deux lieux. Pas de groupe vide créé à l’acceptation.
- [ ] **Traits sur la carte.** Uniquement les liens du lieu touché, et seulement les liens que la personne a le droit de voir.
- [ ] **Ville, une fois.** Après la charte, « Vous venez de quelle ville ? », on peut passer. Aussi pour les comptes déjà créés, une seule fois. Les gestionnaires voient des totaux par ville. Derrière la porte `carte_membres` pour l’affichage ; la question elle-même derrière `aide_contextuelle` ou la même porte, fermée par défaut.
- [ ] **Point sur la carte.** Choix séparé, décoché : « Montrer ma ville sur la carte ». Porte `carte_membres`.
- [ ] **Cartes d’explication.** Une fois par personne et par écran, le jour où elle y entre ou le jour où la porte s’ouvre pour elle. Une raison, un bouton. Porte `aide_contextuelle`, fermée tant que vous ne l’ouvrez pas.
- [ ] **Écrire à quelqu’un d’un lieu ami.** Seulement via une date commune ou une conversation où un gestionnaire a ajouté la personne. Porte `seuil`.
- [ ] **Coches lu en conversation de groupe.** Les conversations à deux ont déjà envoyé / lu. En groupe : sur mes messages, montrer quand c’est lu (par tout le monde, ou un résumé clair). Sans changer le comportement des conversations à deux.

## Fait

_Rien pour l’instant._
