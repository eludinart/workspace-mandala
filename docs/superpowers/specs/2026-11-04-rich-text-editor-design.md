# Mandala — Éditeur riche partagé (design)

> **Statut :** accepted · implémentation  
> **Date :** 2026-11-04  
> **Repo :** `eludinart/workspace-mandala`

## Intent

Fournir un **éditeur WYSIWYG réutilisable** (TipTap) pour la charte du lieu, puis d’autres contenus (ressources, Agora, etc.).

## Décisions

1. **TipTap** + StarterKit (titres, listes, gras, italique) + Link + Image + Placeholder.
2. **Stockage charte** : JSON `{ "format": "html", "html": "<sanitized>" }` dans `charter` LONGTEXT.
3. **Migration lecture** : ancien tableau de blocs → HTML à la volée ; réécriture au prochain enregistrement.
4. **Composants** : `RichTextEditor` / `RichTextViewer` dans `next/src/components/editor/`.
5. **Sanitize** serveur + client (allowlist de balises).
6. **V1 scope** : charte uniquement ; autres écrans plus tard.

## Hors scope V1

- Branchement ressources / Agora / messages
- Tables / code / couleurs de texte avancées
