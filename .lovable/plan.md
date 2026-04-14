

# Calendrier "Période perso." en mode semaine pour l'onglet Conversion

## Probleme
La data de conversion est hebdomadaire. Permettre de selectionner des jours individuels dans le calendrier personnalise n'a pas de sens — ca peut couper des semaines en plein milieu et fausser les resultats.

## Solution
Quand l'utilisateur est sur l'onglet **Conversion**, modifier le comportement du calendrier "Periode perso." pour que :
- Un clic sur n'importe quel jour selectionne automatiquement la **semaine entiere** (lundi-dimanche)
- Un deuxieme clic sur un autre jour etend la selection jusqu'a la fin de cette semaine
- Les selections sont toujours alignees sur des semaines completes

## Fichier modifie

### `src/components/analytics/AnalyticsHeader.tsx`

1. **Ajouter une prop optionnelle** `weekOnlyRange?: boolean` au composant
2. **Modifier `handleDateRangeSelect`** : quand `weekOnlyRange` est actif, snapper `from` au lundi de la semaine cliquee et `to` au dimanche de la semaine cliquee (ou de la deuxieme semaine si plage multi-semaines)
3. **Ajouter un petit texte d'indication** sous le calendrier quand le mode semaine est actif (ex: "Selection par semaine uniquement")

### `src/pages/Analytics.tsx`

1. Passer `weekOnlyRange={viewMode === "conversion"}` a `<AnalyticsHeader />`

## Comportement attendu
- Onglet Conversion : clic sur "mercredi 12 mars" → selectionne automatiquement lun 10 - dim 16 mars
- Autres onglets : comportement inchange (selection jour par jour)

