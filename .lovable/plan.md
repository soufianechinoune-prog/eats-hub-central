## Objectif

Permettre de marquer un restaurant comme "API Uber non disponible — utiliser import CSV" directement depuis la page de backfill CA, avec une note libre, pour qu'on traite les cas un par un sans les oublier.

## Ce qu'on ajoute

### 1. Stockage (nouvelle table)

Nouvelle table `restaurant_backfill_notes` :
- `restaurant_id` (uuid, unique) — 1 note par resto
- `report_type` (text, défaut `PAYMENT_DETAILS_REPORT`) — pour réutiliser la même mécanique sur d'autres backfills plus tard
- `status` (text) — `csv_required` | `api_partial` | `resolved`
- `note` (text) — texte libre (ex: "API vide avant 04/2025, import CSV manuel mensuel")
- `flagged_period_start` / `flagged_period_end` (date, nullable) — la période concernée
- `created_by`, `created_at`, `updated_at`

RLS : super_admin uniquement (lecture + écriture), comme `backfill_jobs`.

### 2. UI dans `src/pages/UberBackfillCA.tsx`

**Liste des restos (gauche)** :
- Petit badge orange "CSV requis" à côté du nom des restos qui ont une note active (status ≠ resolved).

**Panneau de droite (resto sélectionné)** :
- Nouveau bloc "Annotation" au-dessus du calendrier des mois :
  - Si pas de note : bouton "⚠️ Marquer ce store comme problématique"
  - Si note existante : carte affichant le statut, la note, la période, et boutons **Modifier** / **Marquer comme résolu**
- Dialog d'édition simple : select statut + textarea note + 2 inputs date période.

### 3. Filtre rapide

Au-dessus de la liste, un toggle "Afficher uniquement les stores à problème" pour traiter la backlog.

## Détails techniques

- Fichiers touchés : `src/pages/UberBackfillCA.tsx` uniquement + 1 nouveau composant `BackfillNoteCard.tsx` dans `src/components/admin/`.
- Migration SQL pour créer la table + RLS.
- Pas de changement sur la logique de backfill elle-même : c'est purement informatif.
- Les notes sont chargées en une requête au mount et mises en cache par React Query, jointes côté client à la liste des restos.

## Hors scope

- Pas de modification du flow d'import CSV existant.
- Pas d'auto-détection des stores problématiques (CSV vide → flag auto) — on le fait manuellement pour l'instant, on pourra automatiser plus tard si besoin.