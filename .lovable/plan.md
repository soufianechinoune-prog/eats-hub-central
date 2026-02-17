
# Securiser l'import de l'historique des commandes contre la saturation

## Probleme

La fonction backend `parse-order-history` insere les donnees par lots de 500 lignes **sans aucune pause** entre les lots. Un fichier 2024 complet (50 000 a 200 000 lignes) genere 100 a 400 lots envoyes en rafale, ce qui sature les I/O de la base exactement comme ce qui s'est passe precedemment.

A titre de comparaison, la fonction `parse-payment-report` est deja protegee avec des lots de 50 lignes et 500ms de pause entre chaque lot.

## Plan d'action

### 1. Reduire la taille des lots et ajouter un delai

Dans `supabase/functions/parse-order-history/index.ts` :
- Reduire le batch size de **500 a 100** lignes
- Ajouter un **delai de 300ms** entre chaque lot (via `await new Promise(resolve => setTimeout(resolve, 300))`)
- Cela espace les ecritures et laisse la base respirer entre chaque insertion

### 2. Impact sur la vitesse d'import

| Taille fichier | Avant (sans pause) | Apres (avec pauses) |
|---------------|--------------------|--------------------|
| 10 000 lignes | ~5 secondes (mais sature la base) | ~35 secondes (base stable) |
| 50 000 lignes | ~20 secondes (saturation severe) | ~2.5 minutes (base stable) |
| 200 000 lignes | ~60 secondes (crash probable) | ~10 minutes (base stable) |

L'import sera plus lent mais la base restera accessible pendant tout le processus.

## Detail technique

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/parse-order-history/index.ts` | Reduire batchSize de 500 a 100. Ajouter `await new Promise(r => setTimeout(r, 300))` apres chaque upsert reussi. |

## Fichier unique modifie, changement minimal, impact maximal sur la stabilite.
