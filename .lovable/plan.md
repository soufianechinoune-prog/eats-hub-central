
Objectif: corriger le bug à la racine pour que chaque marque soit réellement isolée, y compris dans l’historique d’import, et sécuriser le fichier importé le 27 mars sans toucher aux données existantes de Chicken Street.

### Ce que j’ai confirmé
- Il reste bien un problème sur `/report-import` : `ImportHistory.tsx` charge tous les `csv_imports` sans filtre de marque.
- Le fichier du 27 mars à 18:10 n’a pas été “fusionné” avec des lignes Chicken Street existantes.
- En revanche, il a été importé sur un restaurant nommé `Tasty Crousty - Chevilly La Rue` qui est aujourd’hui rattaché à la chaîne Chicken Street.
- La chaîne `TASTY CROUSTY` existe bien, mais elle a encore `0 restaurant`.
- Donc la fuite actuelle vient de 2 causes distinctes :
  1. front encore non filtré sur certains écrans
  2. un restaurant Tasty créé sur la mauvaise chaîne, donc ses données apparaissent dans le scope Chicken Street

### Correctif à appliquer

#### 1. Corriger l’historique d’import par marque
Fichier :
- `src/components/reports/ImportHistory.tsx`

À faire :
- récupérer `selectedChainId`
- en mode “Toutes les marques” : comportement actuel
- en mode marque :
  - charger uniquement les imports dont `restaurant_ids` appartiennent à des restaurants de cette chaîne
  - si la marque n’a aucun restaurant, afficher un historique vide
- mettre la query/cache en dépendance de `selectedChainId`

But :
- éviter que `/report-import` montre des imports d’autres marques

#### 2. Corriger la donnée mal rattachée du 27 mars
Backend/data fix ciblé :
- déplacer le restaurant `Tasty Crousty - Chevilly La Rue` de Chicken Street vers la chaîne `TASTY CROUSTY`
- ne pas modifier ni supprimer les données Chicken Street existantes
- conserver toutes les données importées déjà liées à ce restaurant (orders, etc.) en déplaçant seulement son rattachement de marque

Impact attendu :
- les 257 commandes importées le 27 mars suivront automatiquement TASTY puisque tout est lié à `restaurant_id`
- Chicken Street ne perdra aucune autre donnée que ce restaurant Tasty mal classé
- TASTY ne sera plus vide artificiellement

#### 3. Sécuriser la création automatique pour les prochains imports
Fichiers :
- `src/components/reports/UnknownStoreMapping.tsx`
- `src/pages/ReportImport.tsx`
- éventuellement `src/components/reports/BulkImportTab.tsx`

À renforcer :
- interdire tout fallback silencieux vers “la première chaîne”
- si une marque est sélectionnée, toute création auto doit obligatoirement utiliser cette marque
- si aucune marque n’est sélectionnée et qu’un mapping doit créer un resto :
  - soit demander explicitement la marque
  - soit bloquer la création auto avec message clair
- propager cette règle à l’import simple et groupé

#### 4. Repasser un audit final sur les vues encore sensibles
Vérifier les écrans qui peuvent encore exposer des données par relation indirecte :
- `src/pages/ReportImport.tsx`
- `src/components/reports/ImportHistory.tsx`
- `src/pages/Restaurants.tsx`
- `src/pages/Analytics.tsx`
- `src/pages/Overview.tsx`
- `src/pages/Messaging.tsx`
- `src/pages/Cartography.tsx`

Règle uniforme à imposer :
```text
- aucune marque sélectionnée => vue globale autorisée
- marque sélectionnée + restaurants => filtre strict sur ces restos
- marque sélectionnée + 0 restaurant => état vide forcé
```

### Résultat attendu
Après correctif :
- quand tu sélectionnes TASTY, tu vois uniquement les données du restaurant Tasty importé le 27 mars
- l’historique d’import de TASTY n’affiche que les imports TASTY
- Chicken Street ne montre plus ce restaurant Tasty
- les prochaines nouvelles marques démarrent bien vierges et n’héritent jamais d’une autre marque

### Détail important sur le fichier du 27 mars
Le problème n’est pas que ce fichier a contaminé des lignes Chicken Street existantes.
Le problème confirmé est :
- un restaurant Tasty a été créé sous la chaîne Chicken Street
- puis l’import du 27 mars a écrit dessus

Donc le bon correctif est :
- filtrer mieux l’UI
- corriger l’affectation de ce restaurant à la bonne chaîne
- supprimer définitivement les fallbacks de création vers une mauvaise marque
