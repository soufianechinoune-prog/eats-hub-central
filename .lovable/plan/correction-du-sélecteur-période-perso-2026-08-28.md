# Correction du sélecteur « Période perso. »

## Le problème

Quand une plage est déjà sélectionnée (ex. 01/06 – 28/08) et qu'on clique sur une nouvelle date de début (01/08), le calendrier ne redémarre pas une nouvelle sélection : il modifie la plage existante. Résultat, la période affichée reste ancrée au 01/06 au lieu de démarrer au 01/08.

Cause vérifiée dans `src/components/analytics/AnalyticsHeader.tsx` : le calendrier est branché en `mode="range"` directement sur la plage globale (`selected={dateRange}`, `onSelect={handleDateRangeSelect}`). Le comportement natif de react-day-picker en mode range étend/ajuste la plage existante au lieu de la réinitialiser au premier clic. De plus chaque clic écrit immédiatement dans le contexte global, donc les données se rechargent avant même « Appliquer ».

## Ce qu'on corrige

1. Sélection en deux clics explicite :
   - 1er clic = nouvelle date de début (la plage précédente est effacée, `to` vide) ;
   - 2e clic = date de fin (si antérieure au début, les deux dates sont inversées automatiquement) ;
   - 3e clic = repart sur une nouvelle sélection.
2. Le calendrier travaille sur un état local temporaire ouvert avec la plage courante. Le contexte global (`setDateRange` / `setPeriodMode("range")`) n'est mis à jour qu'au clic sur **Appliquer**, donc plus de rechargement intempestif pendant la sélection.
3. Le pied du panneau affiche la plage en cours de sélection ; **Appliquer** reste désactivé tant que la date de fin n'est pas choisie (au lieu de disparaître).
4. Le mode « semaine uniquement » (`weekOnlyRange`, utilisé sur d'autres pages) garde son snapping lundi–dimanche, appliqué sur la nouvelle logique.

## Détails techniques

- Fichier touché : `src/components/analytics/AnalyticsHeader.tsx` uniquement.
- Ajout d'un state `tempRange` synchronisé à l'ouverture du popover et au changement d'onglet ; `selected={tempRange}` et gestion manuelle du clic via `onDayClick` plutôt que `onSelect` en mode range.
- Aucun changement SQL, aucun changement de calcul. Correction valable pour toutes les pages analytics qui utilisent ce header (dont Rentabilité Livraison).
