
# Corriger la vue "Mois" qui n'affiche que certains mois

## Probleme identifie

Le probleme n'est pas une limite de lignes (le `.limit(10000)` est correct). Le vrai probleme est dans la **logique de la requete** (ligne 332 de `Analytics.tsx`) :

```text
if (drillDownMonth) {          <-- Si periodMode = "month", cette branche s'execute
    fetch only 1 month via RPC  <-- Retourne uniquement ce mois
    return;                     <-- Sort immediatement
}
if (viewMode === "finances") {  <-- Cette branche n'est JAMAIS atteinte
    fetch full year              
}
```

Quand le `periodMode` est "month" (stocke en localStorage), `drillDownMonth` est toujours defini (ex: 1 pour janvier). La requete ne recupere alors qu'un seul mois, et le tableau "Mois" n'a que ces donnees a afficher.

## Solution

Modifier la logique pour que **en mode finances**, on recupere toujours l'annee complete, independamment du `drillDownMonth`.

**Fichier** : `src/pages/Analytics.tsx` (lignes 330-368)

Inverser la priorite des conditions :
1. Si `viewMode === "finances"` : toujours recuperer l'annee complete (fetch all payouts)
2. Sinon, si `drillDownMonth` : recuperer le mois via RPC (pour les autres onglets comme Revenus)

## Detail technique

```text
Avant :
  if (drillDownMonth) { ... return }     // priorite au mois
  if (viewMode === "finances") { ... }   // jamais atteint

Apres :
  if (viewMode === "finances") { ... return }  // priorite aux finances
  if (drillDownMonth) { ... return }           // seulement pour les autres vues
```

Modification de 2-3 lignes dans un seul fichier. Impact immediat : les 12 mois de janvier a decembre seront visibles dans la vue Mois.
