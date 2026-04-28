# Nettoyage du connecteur Splash360 + multi-tenant

## Contexte

L'authentification Splash360 fonctionne en 2 niveaux :
- **App credentials** (`client_id` / `client_secret`) : stockés en dur dans la Edge Function, identifient notre app Lovable. Mêmes pour toutes les chaînes.
- **User credentials** (email + password) : propres à chaque compte client Splash. C'est ce que l'utilisateur saisit lors de la connexion.

Le champ "Identifiant compte" actuellement demandé dans le formulaire est inutile (jamais lu par la sync). On le retire pour simplifier l'UX.

## Changements

### 1. Migration SQL
Mettre à jour la définition du connecteur `splash360` dans `pos_connectors` :
- Retirer `account_id` de `required_fields`
- Garder uniquement : `email`, `password`

### 2. Frontend (`src/pages/Integrations.tsx` ou composant équivalent)
- Le formulaire dynamique se basant déjà sur `required_fields`, aucun changement de code n'est normalement nécessaire — le champ disparaîtra automatiquement.
- Vérifier qu'aucune validation côté UI ne force encore `account_id`.

### 3. Documentation pour l'utilisateur final
Ajouter dans le formulaire un petit texte d'aide :
> "Saisis l'email et le mot de passe du compte Splash360 du client. Chaque chaîne utilise ses propres identifiants."

## Multi-tenant : à valider avec Splash

Avant de proposer la connexion à un autre client, **envoyer un mail à Splash** pour confirmer :
1. Notre `client_id` (`4194_...`) est-il autorisé à s'authentifier sur **n'importe quel compte client Splash360** ?
2. Si non : faut-il une app par client, ou peuvent-ils whitelister nos credentials sur d'autres comptes ?

Si la réponse est "multi-tenant OK" → rien d'autre à faire, le système marche tel quel pour toute nouvelle chaîne.

Si la réponse est "scopé à Chicken Street" → il faudra prévoir un mécanisme pour stocker un `client_id`/`client_secret` **par chaîne** dans `chain_pos_connections.credentials` (jsonb déjà prévu pour ça).

## Ordre d'exécution
1. Migration SQL pour retirer `account_id`
2. Tester en preview que le formulaire affiche uniquement email/password
3. (En parallèle) Tu envoies le mail à Splash pour confirmer le multi-tenant
4. Selon réponse Splash → éventuelle évolution future pour credentials par chaîne
