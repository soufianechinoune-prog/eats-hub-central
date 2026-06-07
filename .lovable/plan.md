# Fix listing shops Dishop — étape 1 (suite)

## Diagnostic

Auth Dishop = OK (token reçu, scopes `orders:read`, `company:read`, `menu:read`, `users:read`).

`list_shops` échoue : les 4 chemins testés renvoient `404 Cannot GET ...` :
- `/v1/api/companies/Chicken%20Street/shops`
- `/v1/api/company/Chicken%20Street/shops`
- `/v1/api/shops?company_id=Chicken%20Street`
- `/v1/api/partner/companies/Chicken%20Street/shops`

Deux hypothèses, probablement les deux à la fois :
1. Le **chemin** de l'endpoint n'est pas celui que j'ai deviné (la doc Dishop n'a pas été lue, j'ai inventé des variantes plausibles).
2. Le champ **`company_id`** rempli dans le connecteur vaut `"Chicken Street"` (nom commercial). L'API attend très vraisemblablement un **ID technique** (numérique ou UUID), pas le libellé.

## Plan

### 1. Lire la doc Dishop officielle
- Visiter `https://api.dishop.co/documentation/reference` (avec browser tools) et identifier :
  - L'endpoint exact pour lister les shops d'une company
  - Le format attendu de `company_id` (numérique ? UUID ? slug ?)
  - L'endpoint qui permet de **récupérer la company associée au client OAuth** (utile si Dishop expose `GET /me` ou `GET /companies` sans param — ça nous évite de demander un `company_id` au user)

### 2. Adapter l'edge function `dishop-api`
Selon ce que dit la doc, deux scénarios :

- **Scénario A — Dishop expose un `GET /companies` (ou `/me/companies`) authentifié** :
  - Ajouter une action `list_companies` qui appelle cet endpoint avec le token.
  - Remplacer dans l'UI le champ texte `company_id` par un **select** peuplé à partir de `list_companies` après auth réussie.
  - `list_shops` utilise alors le vrai ID renvoyé par Dishop, plus jamais un libellé tapé à la main.

- **Scénario B — Dishop exige un `company_id` fourni par eux** :
  - Garder le champ texte mais le renommer `Company ID Dishop` + helper text "Demande l'ID à ton contact Dishop (ce n'est pas le nom commercial)".
  - Réécrire `listShops` avec **le seul** endpoint officiel de la doc (plus de boucle de devinettes).
  - Améliorer le message d'erreur pour renvoyer le status + body exact à l'UI.

### 3. Re-tester
- Bouton "Tester la connexion" : inchangé, doit toujours marcher.
- Bouton "Voir les shops" : doit renvoyer la liste des restaurants Chicken Street.
- Logs edge function vérifiés après l'appel.

### 4. (Prépa étape 2) Petite amélioration UX en bonus
Une fois la liste des shops récupérée, afficher un tableau lisible (nom + ID Dishop + adresse si dispo) plutôt qu'un brut JSON, pour préparer le mapping shop Dishop ↔ restaurant de ta plateforme prévu à l'étape 2.

## Détails techniques

- Fichiers touchés : `supabase/functions/dishop-api/index.ts` (+ éventuellement `src/pages/Integrations.tsx` si on ajoute le select des companies).
- Pas de migration DB nécessaire pour ce fix (le connecteur `dishop` existe déjà dans `pos_connectors`).
- Aucun secret supplémentaire à demander.

## Question pour toi avant de coder

Est-ce que tu peux demander à Thomas (Dishop) **soit** le `company_id` exact de Chicken Street **soit** confirmer qu'il existe un endpoint type `GET /companies` côté Dishop pour que je le récupère tout seul ? Ça nous évite plusieurs allers-retours.

Si tu préfères, je tente d'abord d'ouvrir la doc moi-même pour répondre à cette question avant de te solliciter.
