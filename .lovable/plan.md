

# Corriger l'affichage des donnees malgre la pression I/O

## Diagnostic

La base de donnees est sous forte pression I/O suite aux imports massifs recents. Meme une requete SELECT sur 101 restaurants prend **6 secondes** (au lieu de quelques millisecondes). Quand la page charge et envoie plusieurs requetes en parallele, elles se bloquent mutuellement et finissent en timeout (120s).

Le code actuel masque le probleme : quand une requete echoue, il retourne un tableau vide (`return data || []`) au lieu de remonter l'erreur, ce qui donne l'impression que les donnees n'existent pas.

## Plan d'action

### 1. Ajouter une gestion d'erreur visible sur la page Restaurants

Actuellement, si la requete echoue, la page affiche "Aucun restaurant trouve" comme si tout allait bien. On va :
- Lancer une **erreur** quand la requete echoue, pour que React Query affiche l'etat d'erreur
- Afficher un **message d'erreur clair** avec un bouton "Reessayer"
- Augmenter le nombre de **retries automatiques** de 2 a 4 pour cette requete specifique

### 2. Augmenter la resilience du QueryClient global

- Passer le `retry` global de 2 a **3**  
- Ajouter un **retryDelay** exponentiel pour espacer les tentatives et reduire la pression

### 3. Limiter les requetes concurrentes au chargement

La page Overview fait plusieurs requetes en parallele au demarrage. En ajoutant un delai de quelques secondes pour les requetes non-critiques, on reduit la contention.

## Detail technique

| Fichier | Modification |
|---------|-------------|
| `src/pages/Restaurants.tsx` | Ajouter `throw error` quand la requete echoue au lieu de retourner `[]`. Ajouter une UI d'erreur avec bouton "Reessayer". Ajouter `retry: 4` et `retryDelay` exponentiel sur cette requete specifique |
| `src/App.tsx` | Passer `retry` de 2 a 3, ajouter `retryDelay` exponentiel |

### Impact attendu

- Les restaurants s'afficheront apres quelques tentatives (la base repond, juste lentement)
- En cas d'echec, l'utilisateur verra un message clair avec un bouton pour reessayer
- La pression I/O va se reduire naturellement au fil des minutes (autovacuum)

