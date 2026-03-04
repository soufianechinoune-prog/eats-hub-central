

# Refonte visuelle de la page Éco-Contribution

## Problème identifié
1. **Double sélecteur de date** : le `AnalyticsHeader` en haut affiche un calendrier avancé (année/mois/range), et le composant `EcoContributionSection` a ses propres boutons "Historique / 2023 / 2024 / 2025 / 2026" (`localYear`). Redondant et confus.
2. **Layout peu moderne** : les KPI cards, le graphique et le tableau sont empilés verticalement sans hiérarchie visuelle forte. La page manque de contraste, d'aération et de structure claire pour un dashboard SaaS.

## Solution

### 1. Supprimer le sélecteur de date local
- Retirer les boutons "Historique / 2023-2026" du `EcoContributionSection`
- Utiliser uniquement le `selectedYear` passé en prop depuis le contexte global (`AnalyticsHeader`)
- Supprimer l'état `localYear` — la source de vérité est le header global

### 2. Refonte visuelle complète de `EcoContributionSection`

**Header de section** : titre + badge résumé + export — plus compact, une seule ligne.

**KPI Cards redesign** :
- Layout en grille 4 colonnes avec le Solde Net en tant que carte hero (plus grande, gradient subtil, icône proéminente)
- Remboursements et Prélèvements avec des barres de progression colorées intégrées
- Carte "Taux de récupération" avec gauge circulaire-like (arc via Progress + pourcentage centré)
- Typographie plus contrastée, chiffres plus gros

**Graphique** :
- Conserver le ComposedChart barres empilées mais ajouter une ligne "Solde Net" pour visualiser la tendance
- Hauteur augmentée (350px), coins arrondis sur les barres

**Top/Flop** :
- Transformer en un design compact côte à côte avec des mini-barres horizontales pour visualiser les montants (pas juste du texte)
- Ajouter une icône médaille/trophy pour le classement

**Tableau restaurants** :
- Ajouter un champ de recherche (comme fait pour RestaurantComparisonTable)
- Barre de progression pour le ratio remb/prél plus visible
- Alternance de couleurs de lignes subtile

### 3. Tabs Synthèse/Détail
- Conserver les deux onglets mais les styliser en "pills" plus modernes (arrondi complet, fond coloré)

## Fichiers modifiés
- `src/components/analytics/EcoContributionSection.tsx` — refonte complète du layout et suppression du `localYear`

Aucune modification de base de données.

