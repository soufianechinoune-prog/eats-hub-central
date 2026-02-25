

# Ajouter les annees 2023 et 2024 au selecteur eco-contribution

## Constat

Les donnees eco-contribution existent en base depuis 2023 (Deliveroo) et 2024 (Uber Eats), mais le selecteur d'annees est code en dur avec uniquement `[2025, 2026]`.

## Correction

**Fichier : `src/components/analytics/EcoContributionSection.tsx`** (ligne 132)

Remplacer le tableau statique `[2025, 2026]` par `[2023, 2024, 2025, 2026]` pour afficher les 4 boutons d'annees disponibles.

C'est une modification d'une seule ligne.

