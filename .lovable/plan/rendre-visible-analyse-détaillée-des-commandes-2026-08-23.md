# Rendre visible « Analyse détaillée des commandes »

La section a bien été ajoutée à la page `/chataigne`, mais elle est placée **après** le tableau « Performance par restaurant » qui contient 105 lignes : elle se retrouve tout en bas, hors de vue.

## Ce qu'on change

Réorganiser la page en **onglets** (shadcn `Tabs`), sous la barre de période et les KPI qui restent toujours visibles :

- **Vue d'ensemble** — évolution mensuelle + tableau performance par restaurant (contenu actuel).
- **Analyse détaillée** — produits les plus commandés, promotions, répartition (heure / emport-livraison / canal).

L'onglet actif est mémorisé dans l'URL (`?tab=`) pour pouvoir partager le lien direct vers l'analyse détaillée.

En complément : le tableau restaurants passe en hauteur limitée avec défilement interne, pour que la page reste navigable.

## Détails techniques

- Seul `src/pages/Chataigne.tsx` est modifié : ajout de `Tabs/TabsList/TabsTrigger/TabsContent` autour des blocs existants, sans toucher aux requêtes ni au composant `ChataigneOrdersAnalysis`.
- Les hooks `useChataigneProducts/Promos/Breakdown` restent pilotés par `start`/`end` déjà en place ; React Query ne relance rien au changement d'onglet.
- Aucune modification base de données, aucune RPC créée, aucune autre page touchée.
