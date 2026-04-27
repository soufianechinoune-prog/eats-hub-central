## Constat

Uber refuse `invalid_scope` **avant le login**, que ce soit pour `eats.pos_provisioning` ou `eats.store eats.report`. Cela prouve que ton app Uber n'a **aucun scope activé en "User-authorized"** sur le portail Developer. Seul `client_credentials` est habilité (et il marche déjà pour récupérer les rapports).

Continuer à itérer sur le flow OAuth utilisateur est une impasse tant qu'Uber n'active pas manuellement les scopes côté portail (process opaque, 1-3 semaines, souvent refusé pour les non-POS).

## Solution : connexion manuelle par UUID

Tu (super_admin) saisis directement le Store UUID Uber de chaque restaurant. Les rapports sont ensuite générés automatiquement via le token serveur qui fonctionne déjà.

## Changements

### 1. UI super_admin — Saisie du Store UUID
Dans `src/components/restaurants/UberConnectionSection.tsx` (ou page dédiée) :
- Champ "Store UUID Uber" éditable (visible uniquement super_admin)
- Bouton "Tester" qui appelle `eats/v1/stores/{uuid}` via le token client_credentials pour valider que l'UUID existe et récupérer le nom du store
- Sauvegarde dans `restaurants.uber_store_id` (colonne déjà existante d'après la table)

### 2. Page bulk de mapping (optionnel mais utile pour 50 restos)
Nouvelle page `/uber-store-mapping-bulk` :
- Liste tous les restaurants sans `uber_store_id`
- Une colonne input par ligne pour coller l'UUID
- Bouton "Valider tous" qui teste chaque UUID en parallèle et sauvegarde

### 3. Nettoyer le flow OAuth cassé
- Masquer le bouton "Connecter via login Uber" (ou le mettre derrière un flag `feature_uber_oauth_user_flow = false`)
- Garder le code (`uber-auth`, `UberCallback`) au cas où Uber active les scopes plus tard, mais ne plus le proposer dans l'UI

### 4. Documentation interne
Petite note dans `UberConnections.tsx` expliquant pourquoi on est en mode manuel :
> "Uber n'a pas activé les scopes utilisateur sur notre application. Saisissez directement les Store UUIDs depuis le dashboard Uber Eats Manager."

## Comment trouver un Store UUID Uber (pour toi)

1. Connecte-toi à https://merchants.ubereats.com/
2. Sélectionne un restaurant
3. L'URL contient l'UUID : `.../store/<UUID>/...`
4. Copie-le → colle-le dans l'UI

## Détails techniques

- **Pas de migration DB** : `restaurants.uber_store_id` existe déjà
- **Edge function réutilisée** : `uber-token` (client_credentials) + un nouveau `uber-validate-store` (1 GET sur l'API Uber)
- **Sécurité** : seul le super_admin peut éditer le champ (RLS + check `is_super_admin()` côté UI)

## Plan B si tu veux quand même tenter l'OAuth utilisateur

Je peux te rédiger un email-type à envoyer à `developers@uber.com` pour demander l'activation des scopes `eats.store` et `eats.report` en "User-authorized" sur ton app `wnqg3HLjT98yB25bWtPhB9njQ-ZpKSHX`. À envoyer en parallèle, sans bloquer sur la réponse.

## Ce que tu obtiens

- ✅ 50 restaurants branchés en 1h (au lieu d'attendre Uber 3 semaines)
- ✅ Rapports automatiques (le token serveur marche déjà)
- ✅ Architecture multi-tenant respectée (chaque resto reste isolé par `chain_id`)
- ✅ Possibilité de réactiver l'OAuth user plus tard sans rien casser
