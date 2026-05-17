# Retirer le sélecteur de plateforme dans les pages Analytics

## Contexte

Maintenant que la sidebar de droite (`OverviewChannelSidebar`) scope déjà l'utilisateur sur un canal (Uber Eats, Deliveroo, Caisse), le bandeau de pills « Uber Eats / Deliveroo / Global / Caisse » au sommet des pages Analytics (`/analytics/revenue`, `/analytics/conversion`, etc.) fait double emploi et embrouille la lecture.

## Changement

Dans `src/components/analytics/AnalyticsHeader.tsx`, **supprimer purement et simplement le bloc des 4 pills plateforme** (lignes ~396-441 — `Uber Eats`, `Deliveroo`, `Global`, `Caisse`).

Comportement :
- À l'arrivée sur une page Analytics depuis un sous-onglet Uber Eats, `selectedPlatform` est déjà forcé à `"uber_eats"` par `handleSubItemClick` (déjà implémenté dans la sidebar).
- Toute la logique conditionnelle existante basée sur `selectedPlatform` reste intacte — seules les pills disparaissent visuellement.
- Le sélecteur de restaurants (à gauche) et le sélecteur de période (à droite) restent en place.

## Garde-fou

Pour éviter de casser un éventuel accès direct ou la sidebar gauche legacy (qui ne pré-sélectionne pas la plateforme), ajouter dans `AnalyticsContext` (ou au mount de la page Analytics) : si `selectedPlatform` est `null/undefined` au chargement → forcer `"uber_eats"` par défaut. Vérifier la valeur actuelle de l'init et ne modifier que si nécessaire.

## Hors scope

- La sidebar gauche reste en place (suppression prévue dans une itération ultérieure).
- Aucune migration de Deliveroo / Caisse pour l'instant — quand l'utilisateur cliquera sur ces canaux dans la sidebar de droite, on traitera ça séparément (Phase 2 prévue).

## Fichiers modifiés

- `src/components/analytics/AnalyticsHeader.tsx` — retrait du bloc Platform Pills.
- `src/contexts/AnalyticsContext.tsx` *(si nécessaire)* — défaut `selectedPlatform = "uber_eats"`.
