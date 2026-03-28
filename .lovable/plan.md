
Objectif: faire en sorte qu’une nouvelle marque avec des imports valides affiche immédiatement ses données, sans donner l’impression qu’elle est vide.

Ce que j’ai vérifié
- La data TASTY existe bien en base.
- La chaîne `TASTY CROUSTY` a aujourd’hui 1 restaurant actif: `Tasty Crousty - Chevilly La Rue`.
- Ce restaurant a déjà 340 commandes, du 24 au 28 mars.
- Les imports du 27 et du 28 mars sont bien enregistrés pour ce restaurant.
- Donc non: ce n’est pas “normal” côté produit que tu ne voies rien. La donnée est là.

Cause racine confirmée
- Sur ta capture, la page est en mode `Épinglés`.
- Or TASTY a `0 restaurant épinglé` et `1 restaurant réseau`.
- La vue d’ensemble calcule alors son scope avec `pinnedIds = []`, donc tout devient vide.
- Le badge `Réseau 1` visible sur la capture confirme exactement ça.
- En plus, l’état de la page d’accueil est stocké dans `overview-state` sans être isolé par marque, donc un état UI hérité peut rendre une nouvelle marque artificiellement vide.

Plan de correction
1. Corriger la logique de scope de la page d’accueil
- `src/pages/Overview.tsx`
- Si une marque est sélectionnée et qu’elle a des restaurants actifs mais 0 épinglé:
  - ne pas rester sur un scope vide silencieux
  - basculer automatiquement sur `Réseau`
  - ou au minimum afficher un état explicite avec CTA “Passer en Réseau”
- Garder l’état vide uniquement si la marque n’a réellement aucun restaurant.

2. Rendre l’état Overview isolé par marque
- `src/pages/Overview.tsx`
- Remplacer la persistance globale `overview-state` par une version brand-aware, par exemple dérivée de `selectedChainId`.
- But:
  - éviter qu’un réglage hérité d’une autre marque masque les données d’une nouvelle marque
  - garder une logique SaaS propre par tenant

3. Clarifier l’UX quand une marque a des imports mais aucun épinglé
- Ajouter un message clair du type:
  - “1 restaurant disponible dans cette marque, mais aucun restaurant épinglé”
- Proposer une action directe:
  - voir le réseau
  - ou épingler le restaurant
- Important: ne pas auto-modifier la donnée métier juste pour masquer le bug visuel

4. Vérifier les pages dépendantes du même pattern
- Auditer les écrans qui peuvent encore confondre “aucun épinglé” avec “aucune donnée”:
  - `src/pages/Overview.tsx`
  - `src/components/analytics/AnalyticsHeader.tsx`
  - `src/hooks/useOverviewData.ts`
  - `src/hooks/useNetworkStats.ts`
  - toute page avec toggle `Épinglés / Réseau`
- Règle à imposer partout:
```text
- marque + 0 restaurant actif => vrai état vide
- marque + restaurants actifs + 0 épinglé => données visibles en Réseau, pas vide silencieux
- marque + restaurants épinglés => Épinglés possible normalement
```

Résultat attendu après correction
- TASTY affichera bien ses données importées.
- Une nouvelle marque importée ne semblera plus vide juste parce qu’aucun restaurant n’est épinglé.
- L’état d’affichage sera proprement isolé par marque, dans un esprit SaaS multi-tenant robuste.
