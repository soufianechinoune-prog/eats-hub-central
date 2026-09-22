# Nouvel onglet « Jours de la semaine » (Chataigne)

Oui, c'est tout à fait faisable. L'idée : comparer chaque jour de la semaine entre eux, et chaque lundi (mardi, mercredi…) semaine après semaine.

## Ce qui sera ajouté

Un nouvel onglet **« Jours de la semaine »** dans la page Chataigne, à côté de « Vue quotidienne », qui utilise les mêmes filtres (réseau/restaurant + période) que le reste de la page.

Trois blocs :

1. **Profil de semaine** — un graphique en barres avec les 7 jours (lundi → dimanche) : CA moyen par jour, commandes moyennes, panier moyen. On voit immédiatement les jours forts et les jours creux.

2. **Un jour, semaine après semaine** — un sélecteur de jour (Lun / Mar / Mer / Jeu / Ven / Sam / Dim) et une courbe des 6 dernières semaines (ou de toute la période choisie) pour ce jour-là : « tous les lundis », puis « tous les mardis », etc. Avec la variation vs la semaine précédente et vs la moyenne du jour.

3. **Tableau croisé jours × semaines** — une grille lisible (lignes = jours, colonnes = semaines) avec code couleur, façon carte de chaleur, pour repérer d'un coup d'œil un lundi anormalement bas ou un samedi record.

Toggle **€ / commandes / panier moyen** en haut du bloc pour changer l'indicateur affiché partout.

La journée en cours reste exclue (comme sur les autres vues) pour ne pas afficher un jour incomplet.

## Détails techniques

- Nouveau composant `src/components/chataigne/ChataigneWeekdaySection.tsx` + onglet dans `src/pages/Chataigne.tsx`.
- Données : réutilisation de `fetchDailyChataigne` (RPC `get_daily_chataigne`, déjà paginé et scopé par `restaurant_ids`), agrégation côté client par jour de semaine et par semaine ISO — pas de nouvelle fonction SQL nécessaire.
- Jours de semaine et semaines calculés en heure locale (`date-fns`, `weekStartsOn: 1`), jamais via `toISOString()`.
- Graphiques Recharts existants, tokens de couleur du design system, dark mode OK.

## Extension possible ensuite

Le même composant peut être rebranché tel quel sur les autres canaux (Uber, Deliveroo, Caisse) en changeant simplement le fetcher — à faire dans un second temps si la vue vous plaît.
