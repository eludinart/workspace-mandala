# Design — Libellés alerte admin (fiche personne)

Date : 2026-11-11  
Statut : accepted · prêt pour plan

## Problème

Sur la fiche personne, le lien d’alerte privée aux administrateurs lit : « Un problème de cadre, hors évaluation publique ». Les termes « cadre » et « évaluation » sont internes ; un nouvel arrivant ne comprend pas qu’il s’agit d’un signalement privé, distinct des retours publics.

## Décision

Ton **direct / sécurité**. Remplacer uniquement les trois libellés de `AlertForm` dans `next/src/components/returns/ReturnsBlock.tsx`.

| Élément | Texte |
| --- | --- |
| Lien (bouton) | `Signaler un problème aux administrateurs` |
| Aide (formulaire ouvert) | `Ce message n’est vu que par les administrateurs. Il n’est pas publié comme un retour.` |
| Confirmation après envoi | `Message transmis aux administrateurs. Il n’est pas publié.` |

## Approches écartées

| Option | Pourquoi non |
| --- | --- |
| `Signaler cette personne` | Trop accusatoire ; moins clair sur le destinataire |
| `Signaler un comportement inapproprié` | Trop étroit (exclut d’autres motifs de signalement) |
| Garder « cadre » / « évaluation » | Jargon produit, opaque pour les nouveaux |

## Portée

- **In** : copy du lien, de l’aide et de la confirmation dans `AlertForm`.
- **Out** : API `returnsApi.alert`, onglet admin « Alertes de cadre », i18n, autres signalements UGC / retours.

## Vérification

1. Ouvrir une fiche personne avec lieu → le lien affiche le nouveau libellé.
2. Ouvrir le formulaire → l’aide distingue message admin vs retour public.
3. Envoyer un message test → confirmation « pas publié ».
