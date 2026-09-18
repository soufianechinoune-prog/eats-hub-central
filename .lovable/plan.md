# Lisibilité du classement produits en vue « Semaine »

## Le problème observé

En vue Semaine, toutes les courbes sont écrasées en haut du graphique. Cause : l'échelle verticale va du 1er au dernier rang rencontré dans la période — y compris un produit qui tombe très bas une semaine (#132). Les dix produits suivis, qui évoluent tous entre la 1re et la ~20e place, se retrouvent donc tassés sur quelques pixels, et la courbe du produit absent traverse tout le graphique.

## Ce qui change

1. **Classement relatif entre les produits suivis.** Chaque semaine (ou mois), les produits affichés sont classés entre eux : 1er à 10e (ou 15e / 20e). L'échelle devient donc stable et les écarts redeviennent visibles. Le vrai rang dans le catalogue complet et le chiffre d'affaires restent affichés au survol et dans les listes « En hausse / En baisse » — aucune valeur n'est perdue.

2. **Trous assumés.** Une semaine sans vente pour un produit laisse une interruption dans sa courbe au lieu d'une chute artificielle vers le bas du graphique.

3. **Lisibilité de la vue Semaine.** Graphique plus haut, courbes plus épaisses pour les produits mis en avant, points plus petits, libellés de semaines allégés (une étiquette sur deux quand il y en a beaucoup) et nom du produit posé en bout de courbe pour les lignes en couleur.

4. **Repère visuel.** Ligne de séparation tous les 5 rangs pour situer un produit d'un coup d'œil.

Aucune donnée, aucun calcul de chiffre d'affaires et aucun filtre ne sont modifiés : il s'agit uniquement de la façon de dessiner le classement.

## Détails techniques

- `src/pages/CaisseProductSales.tsx` uniquement ; aucune modification des RPC ni du schéma.
- Nouveau calcul dans le `useMemo` du graphique : pour chaque bucket, trier les `products` suivis par `revenue` décroissant et attribuer un rang dense local (1..N). Stocker en parallèle `${ref}__globalRank` et `${ref}__ca` pour le tooltip.
- `YAxis reversed domain={[1, products.length]}`, `allowDecimals={false}`, `ticks` tous les 1 (ou tous les 2 au-delà de 15 produits).
- `connectNulls` retiré sur les `Line` pour matérialiser les trous.
- `height` du conteneur porté à ~520 px ; `strokeWidth` 2.5 pour les refs en emphase, 1.25 pour les grises ; `dot` réduit ; `XAxis interval` calculé selon le nombre de buckets ; `LabelList`/`Label` en bout de courbe pour les refs en couleur.
- Tooltip inchangé dans sa logique, mais affiche « rang local (rang réel) · CA ».
