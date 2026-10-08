---
name: suite-mandala
description: >-
  Gère la liste de chantiers Mandala dans docs/SUITE.md. Utiliser quand
  l’utilisateur parle de la suite, des to-do, de la prochaine case, d’ajouter
  un chantier, ou demande où en est le plan lieux amis, portes de fonctions
  ou aide contextuelle.
---

# Suite Mandala

La liste est `docs/SUITE.md`. La lire avant d’agir. Ne pas recopier le plan dans le chat.

## Prochaine case

L’utilisateur demande d’avancer (« prochaine case », « continue la suite »).

1. Prendre la première ligne `- [ ]` de la section **À faire**.
2. L’implémenter seule. Ne pas commencer la suivante.
3. Vérifier le parcours touché.
4. Remplacer `- [ ]` par `- [x]` sur cette ligne, et ajouter une ligne datée sous **Fait**.
5. S’arrêter. Dire ce qui est livré et quelle case vient après.

Si **À faire** n’a plus de `- [ ]`, le dire et ne rien inventer.

## Ajouter ou modifier

L’utilisateur ajoute, réordonne, annule ou reformule une case : éditer `docs/SUITE.md` seulement. Ne pas coder.

- Nouvelle case : `- [ ]` dans **À faire**, à l’endroit demandé. Sans précision, à la fin de **À faire**.
- Annulation : retirer la ligne, ou la passer sous **Fait** avec la mention « abandonné » si du travail existait.

## Où on en est

Résumer les cases cochées et la prochaine `- [ ]`. Ne pas coder.

## Contraintes en codant une case

- Respecter la section **Règles** de `docs/SUITE.md`.
- Porte fermée = le comportement actuel est inchangé pour qui n’est pas dans le public.
- Une case dont la porte n’existe pas encore attend la case **Porte des fonctions**, sauf si c’est cette case-là.
