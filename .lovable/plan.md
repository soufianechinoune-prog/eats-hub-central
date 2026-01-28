
Objectif
- Corriger l’import “Score de Réussite” pour que les champs contenant des virgules (ex: Notes “4,40”) et les champs entre guillemets soient correctement parsés côté backend, afin que les valeurs (Notes, Emballage, CA) s’affichent bien sur /success-score après l’import de Janvier.

Constat (à partir de vos captures + vérification DB)
- L’aperçu (étape 2) affiche bien Notes, Emballages (33) et CA (119083.96, etc.).
- Après “Import réussi”, la page /success-score affiche Notes “Non renseigné”, Emballage “—”, CA “0 €”.
- La base contient bien de nouvelles lignes pour 2026-01-01 mais avec ratings = NULL, sustainable_packaging = NULL, sales_amount = 0, alors que l’aperçu montre des valeurs.
- Cause la plus probable : la fonction backend `parse-success-score` découpe les lignes avec un simple `split(',')`, ce qui casse les champs entre guillemets qui contiennent une virgule (ex: `"4,40"`). Résultat : décalage de colonnes et les champs “Ratings / Sales / Sustainable packaging” finissent en NULL/0.

Changements à implémenter (code)
1) Corriger le parsing CSV dans `supabase/functions/parse-success-score/index.ts`
   - Remplacer:
     - `lines[0].split(',')` (headers)
     - `lines[i].split(',')` (rows)
   - Par une vraie fonction `parseCSVLine()` identique à celles déjà utilisées dans d’autres fonctions (ex: `parse-sales-over-time`, `parse-reviews-item`) :
     - support des guillemets `"` et des guillemets échappés `""`
     - séparation par virgule uniquement quand on n’est pas “inQuotes”
   - Utiliser `parseCSVLine` pour:
     - construire `headers`
     - construire `values` pour chaque ligne

2) Sécuriser la conversion numérique
   - Conserver la logique “NA / N/A / vide => null”.
   - Améliorer `parseNumber` pour gérer:
     - virgule décimale (remplacer `,` par `.`)
     - espaces / NBSP éventuels (enlever `\u00A0`, espaces)
   - S’assurer que `sales` n’est pas forcé à 0 si la cellule existe mais est mal lue.

3) Ajouter des logs de diagnostic (temporaires mais utiles)
   - Logguer:
     - le nombre de colonnes détectées pour headers
     - pour 2-3 premières lignes: la longueur `values.length` + un aperçu des champs clés (storeName/status/ratings/menuDetails/sustainable/sales)
   - Objectif: confirmer que la structure lue en backend correspond à l’aperçu UI.

Résultat attendu
- Un import “Janvier 2026” devrait créer/mettre à jour 4 lignes avec:
  - `ratings` renseigné (4.20/4.40/4.50/4.30…)
  - `sustainable_packaging` renseigné (33)
  - `sales_amount` renseigné (119083.96, 149633.38, …)
- Sur /success-score:
  - KPI “Notes Clients” n’est plus “—”
  - KPI “Emballages Durables” n’est plus “—”
  - Tableau: colonne Emballage et CA affichent les valeurs attendues

Étapes de validation (end-to-end)
1) Refaire un import du même fichier “Score de Réussite” sur “Janvier 2026”.
2) Vérifier à l’étape “Validation” que “4 à mettre à jour” apparaît toujours (normal si on réécrit les mêmes lignes).
3) Aller sur /success-score et vérifier que:
   - Notes ≠ “Non renseigné”
   - Emballage ≠ “—”
   - CA ≠ “0 €”
4) Si un champ reste vide, vérifier les logs backend (les nouvelles lignes de debug permettront de voir quelle colonne est mal détectée).

Fichiers concernés
- `supabase/functions/parse-success-score/index.ts` (correction parsing CSV + robustesse num + logs)

Aucun changement de base de données nécessaire
- Le problème est dans la lecture du CSV lors de l’import, pas dans le schéma.
