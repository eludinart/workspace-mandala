# Design — Réactions nommées + sondages chat

Date : 2026-11-05  
Statut : accepted · implémentation

## Réactions (retour utilisateur)

Problème : en groupe, pouces / cœurs font office de réponse sans savoir **qui** a réagi.

Décision :
- Le serveur expose déjà `userIds` ; on enrichit avec `users: { id, display_name }[]`.
- UI : survol (`title`) + clic sur le chip → liste des noms + action « Réagir aussi / Retirer ».

## Sondages

MVP dans les **conversations de groupe** :
1. Bouton 📊 dans le compositeur → feuille question + 2–6 options.
2. Message avec `card_slug = poll:{id}` + carte interactive.
3. Un vote par personne (modifiable) ; **résultats visibles après le premier vote** (barres %).
4. Tables `chat_polls` / `chat_poll_options` / `chat_poll_votes`.

Hors scope immédiat : fermeture de sondage, multi-choix, sondages 1:1.
