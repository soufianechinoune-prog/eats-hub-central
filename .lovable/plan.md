

# Corriger la limite de 1000 lignes sur le détail Éco-Contribution

## Problème

La requête qui récupère les lignes de détail (`payout_adjustments`) ne spécifie pas de `.limit()`, donc PostgREST applique sa limite par défaut de **1000 lignes**. Il y a en réalité **1881 lignes** en base pour 2025.

## Solution

Ajouter `.limit(10000)` à la requête `payout_adjustments` dans le hook `useEcoContribution.ts`, exactement comme c'est déjà fait pour la requête `payouts` juste au-dessus.

## Détail technique

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useEcoContribution.ts` | Ajouter `.limit(10000)` sur la requête `payout_adjustments` (ligne ~78, avant le `const { data, error }`) |

C'est un correctif d'une seule ligne.

