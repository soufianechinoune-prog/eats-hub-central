

# Pourquoi la courbe Deliveroo tombe a 0 en fin de mois

## Diagnostic

Le probleme vient d'un decalage de fuseau horaire entre le stockage et l'affichage des donnees Deliveroo.

1. **Stockage** : Les dates de livraison Deliveroo sont stockees en UTC (ISO format, ex: `2025-05-31T22:30:00.000Z`)
2. **Requete** : Le filtre utilise `lte("delivery_datetime", "2025-05-31T23:59:59")` — ce qui est en UTC et inclut correctement les donnees du dernier jour
3. **Agregation JS** : Le code fait `new Date(row.delivery_datetime)` puis `format(dt, "yyyy-MM-dd")` — cette conversion utilise le **fuseau horaire local du navigateur** (Paris, UTC+1 en hiver / UTC+2 en ete)

Resultat : une livraison du 31 mai a 23h30 heure de Paris est stockee comme `2025-05-31T21:30:00Z` en UTC. A l'inverse, une livraison du 1er juin a 00h30 Paris = `2025-05-31T22:30:00Z` passe le filtre (avant 23:59:59 UTC) mais s'affiche comme "1er juin" dans le graphique car `new Date("2025-05-31T22:30:00Z")` en timezone Paris = 1er juin 00h30.

Cela cree un faux point de donnees pour le 1er du mois suivant avec tres peu de commandes (seulement celles entre minuit et 2h du matin heure de Paris), d'ou la chute brutale vers 0.

## Correctif

Modifier la fonction `aggregateDeliverooRevenue` dans `src/pages/Analytics.tsx` pour convertir les dates UTC en dates locales Paris avant l'agregation par jour :

1. **`src/pages/Analytics.tsx`** — Dans `aggregateDeliverooRevenue`, remplacer `format(dt, "yyyy-MM-dd")` par une conversion explicite qui extrait la date en heure de Paris. Utiliser `toLocaleDateString` avec le fuseau `Europe/Paris` ou ajouter manuellement le decalage horaire avant le formatage.

2. **Meme fichier** — Appliquer la meme correction dans `fetchAllDeliverooOrderRows` et dans la query `deliverooPayoutsData` (lignes 406-410) ou le groupement par semaine utilise `getUTCDay()` au lieu du jour local.

3. **Impact** : Le point fantome du 1er du mois suivant disparaitra, et les quelques commandes tardives seront correctement rattachees au dernier jour du mois en cours.

## Fichiers modifies
- `src/pages/Analytics.tsx` — `aggregateDeliverooRevenue` + `deliverooPayoutsData` grouping

