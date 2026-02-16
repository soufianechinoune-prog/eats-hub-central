

# Resoudre la saturation de la base de donnees

## Diagnostic

La base de donnees est en etat de saturation complete. Les logs montrent des dizaines de "canceling statement due to statement timeout" en cascade, y compris des "connection to client lost" et "FATAL" errors. Cela signifie que **toutes les requetes echouent**, pas seulement l'eco-contribution.

La cause probable : les batch upserts massifs du `parse-payment-report` (qui traitent des milliers de lignes) ont sature les connexions et verrouille des tables, creant un effet domino ou meme les requetes SELECT simples ne passent plus.

## Plan d'action

### 1. Reduire la taille des batches dans parse-payment-report

Le probleme principal est que les upserts envoient trop de lignes d'un coup, ce qui verrouille la base trop longtemps. On va :
- Reduire la taille des batches de 200 a **50 lignes**
- Ajouter un **delai de 500ms** entre chaque batch pour laisser respirer la base
- Ajouter un timeout plus court sur chaque batch individuel

### 2. Ajouter une protection contre les requetes concurrentes

Quand un import est en cours, les requetes du dashboard ne devraient pas entrer en competition. On va s'assurer que la fonction edge ne lance pas de requetes inutiles en parallele.

## Detail technique

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/parse-payment-report/index.ts` | Reduire batch size de 200 a 50, ajouter delai inter-batch de 500ms |

### Impact attendu

- Les imports seront un peu plus lents (quelques secondes de plus) mais ne bloqueront plus la base
- Le dashboard redeviendra accessible pendant et apres les imports
- Les donnees existantes ne sont pas affectees (elles sont toujours la, juste inaccessibles a cause de la saturation)

### Action immediate apres deploiement

Rafraichir la page -- la base devrait se liberer naturellement une fois que les requetes en timeout sont annulees (quelques minutes).

