

# Corriger definitivement le chargement de la page Overview

## Diagnostic

La page Overview contient une **requete monolithique** (`network-health`, lignes 314-780 de Overview.tsx) qui enchaine **12 sous-requetes** dans une seule fonction :
1. restaurants
2. daily sales (RPC)
3. payouts
4. reviews (pagine)
5. order history (pagine)
6. order errors
7. daily order accuracy
8. menu item reviews (jusqu'a 50,000 lignes)
9. hourly availability (jusqu'a 50,000 lignes)
10. daily conversion
11. orders pour items (pagine)
12. order items par chunks

Si UNE SEULE de ces sous-requetes depasse le timeout de 2 minutes, **toute la fonction echoue** et la page affiche zero donnee.

Les modifications precedentes sur `useNetworkStats` n'ont aucun effet car la page Overview utilise sa propre requete inline, pas ce hook.

## Solution : pas besoin de changer de serveur

Le probleme est purement logiciel. La base de donnees repond correctement (quelques secondes par requete individuelle). C'est l'accumulation de 12 requetes sequentielles qui depasse le timeout.

## Plan d'action

### 1. Decouper la requete monolithique en requetes independantes

Remplacer la mega-requete `network-health` par **8 requetes React Query separees**, chacune avec son propre retry et son propre etat de chargement :

| Requete | Donnees | Priorite |
|---------|---------|----------|
| `overview-restaurants` | Restaurants epingles | Immediate |
| `overview-sales` | CA et commandes (RPC) | Immediate |
| `overview-reviews` | Avis clients | Apres sales |
| `overview-prep-times` | Temps de preparation | Apres reviews |
| `overview-accuracy` | Taux d'erreurs | Apres reviews |
| `overview-availability` | Temps d'inactivite | Apres accuracy |
| `overview-products` | Produits top/flop | Derniere |
| `overview-conversion` | Donnees conversion | Derniere |

### 2. Chargement progressif avec echelonnement

Chaque vague attend que la precedente soit terminee (via `enabled`), exactement comme dans `useNetworkStats` :
- **Vague 1** : restaurants + sales (ce qui permet d'afficher le CA immediatement)
- **Vague 2** : reviews + accuracy (notes et erreurs)
- **Vague 3** : prep times + availability (operations)
- **Vague 4** : products + conversion (rankings)

L'utilisateur verra les donnees **apparaitre progressivement** au lieu d'attendre que tout soit charge.

### 3. Affichage des etats intermediaires

- Chaque section affiche un skeleton/spinner independant
- Les sections chargees s'affichent immediatement, meme si d'autres sont encore en cours
- En cas d'echec d'une section, seule cette section affiche une erreur (pas toute la page)

### 4. Retry resilient sur chaque requete

Chaque requete individuelle aura :
- `retry: 3` avec backoff exponentiel
- Timeout individuel de 2 min (au lieu de 2 min pour les 12 requetes combinees)

## Detail technique

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useOverviewData.ts` | **Nouveau fichier** - Hook dedie qui decoupe les 12 sous-requetes en 8 hooks React Query independants, avec echelonnement par vagues et retry exponentiel |
| `src/pages/Overview.tsx` | Remplacer la mega-requete `network-health` (lignes 314-780) par l'appel au nouveau hook `useOverviewData`. Ajouter des skeletons par section pour le chargement progressif. Ajouter un bouton "Reessayer" global en cas d'echec |

## Impact attendu

- Au lieu d'UNE requete de 12 etapes qui echoue completement, 8 requetes independantes qui reussissent individuellement
- Le CA et les restaurants s'affichent en quelques secondes
- Les notes, erreurs, et rankings apparaissent progressivement
- En cas de lenteur sur une requete, les autres sections restent visibles
- **Aucun changement de serveur necessaire** - le meme serveur suffit largement

## Pourquoi ne pas changer de serveur ?

Le serveur actuel n'est pas en surcharge. Le probleme vient du fait que le code envoie 12 requetes en serie dans une seule transaction. Meme un serveur 10x plus puissant aurait le meme probleme si le code reste identique. La solution est de **paralleliser intelligemment** les requetes.
