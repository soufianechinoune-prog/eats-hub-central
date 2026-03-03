

# Diagnostic : page blanche sur toutes les routes

## Constat
- La page est blanche sur `/restaurants`, `/cartography`, et toutes les routes
- Aucune erreur dans la console du navigateur
- Aucune requete reseau en erreur
- Le HTML de base se charge (le `<div id="root">` existe) mais React ne monte pas

## Cause probable
L'absence totale de logs React (meme pas les logs de contexte) indique une **erreur de compilation TypeScript/Vite** qui empeche le bundle JS de se charger. Cela arrive typiquement apres une modification du fichier `types.ts` auto-genere ou un import qui ne resout pas.

## Demarche de resolution

1. **Verifier le build** en essayant un rechargement force de la preview (bouton refresh dans la barre d'URL de preview). Si ca ne marche pas :

2. **Supprimer l'import inutilise** de `PrivacyPolicy` dans `App.tsx` (importe ligne 18 mais jamais utilise dans les routes — c'est un warning, pas un crash, mais nettoyons)

3. **Forcer un re-build** en ajoutant un commentaire anodin dans `main.tsx` puis le retirer — cela force Vite a recompiler l'arbre complet et afficher l'erreur eventuelle

4. Si l'erreur persiste, **restaurer une version anterieure** via l'historique Lovable

## Action recommandee
Commencer par un simple re-build force (modification triviale dans `main.tsx`). Si une erreur de compilation apparait, on la corrigera. Sinon, restaurer la version precedente depuis l'historique.

