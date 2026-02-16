

# Decharger la page Overview pour eviter les timeouts en cascade

## Probleme identifie

La base de donnees fonctionne normalement (requete simple = quelques ms). Mais la page Overview (route `/`) lance **~15 requetes simultanees** au chargement :
- 3 requetes restaurants (pinned, active, all)
- 1 RPC `get_daily_revenue_from_orders`
- 1 requete `customer_reviews`
- 1 requete `orders` avec pagination (potentiellement 5+ sous-requetes)
- 1 requete `order_history` avec pagination (potentiellement 5+ sous-requetes)
- 1 requete `daily_order_accuracy`
- 1 requete `hourly_availability` (jusqu'a 50,000 lignes)
- 1 requete `success_scores`
- 1 requete `order_errors`

Toutes ces requetes se disputent les memes ressources I/O et finissent en timeout (2 min), d'ou "aucune data".

## Plan d'action

### 1. Echelonner les requetes dans le hook useNetworkStats

Actuellement, toutes les requetes sont lancees en parallele des que `restaurantIds` est rempli. On va les **chainer** pour qu'elles se lancent les unes apres les autres :
- **Vague 1** : restaurants + sales (RPC legere)
- **Vague 2** : reviews + accuracy (petites tables)
- **Vague 3** : orders payout (pagination lourde)
- **Vague 4** : order_history + availability (pagination lourde)

Chaque vague attend que la precedente soit terminee avant de demarrer (via `enabled`).

### 2. Dedupliquer les requetes restaurants sur Overview

La page Overview fait 3 requetes separees sur la table `restaurants` :
- `pinned-restaurants-count` 
- `active-restaurants-count`
- La requete dans `network-health`

On les fusionne en **une seule requete** qui recupere tous les restaurants actifs, puis on filtre en memoire pour les pinned.

### 3. Ajouter une gestion d'erreur avec retry sur l'Overview

Comme sur la page Restaurants, ajouter un affichage d'erreur avec bouton "Reessayer" au lieu d'un ecran vide.

## Detail technique

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useNetworkStats.ts` | Chainer les requetes via `enabled` : vague 1 (restaurants+sales), vague 2 (reviews+accuracy), vague 3 (orders), vague 4 (history+availability). Ajouter `retry: 3` et `retryDelay` exponentiel sur chaque requete. |
| `src/pages/Overview.tsx` | Fusionner les 3 requetes restaurants en une seule. Ajouter un etat d'erreur visible avec bouton "Reessayer". |

### Impact attendu

- Au lieu de 15 requetes simultanees, maximum 2-3 a la fois
- Chaque requete individuelle aura les ressources I/O necessaires pour terminer en quelques secondes
- Les donnees apparaitront progressivement (d'abord les restaurants, puis le CA, puis les notes, etc.)
- En cas d'echec partiel, l'utilisateur verra un message clair

