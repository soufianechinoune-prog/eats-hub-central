## Nettoyage du header de la Vue d'ensemble

Simplification de la barre d'actions de `/overview` pour la rendre plus claire et compacte.

### Changements

**1. Suppression du bouton "Actualiser" (icône RefreshCw)**
- Retrait du bouton icon-only en début de barre.
- Le rafraîchissement reste disponible automatiquement (React Query) et via le bouton "Réessayer" qui s'affiche déjà en cas d'erreur.
- Nettoyage de l'import `RefreshCw` s'il n'est plus utilisé ailleurs sur la page (il reste utilisé dans le bloc d'erreur, donc conservé).

**2. Fusion des boutons PDF + Excel en un seul bouton "Télécharger"**
- Remplacement des deux boutons par un unique `DropdownMenu` :
  - Trigger : bouton `outline` avec icône `Download` + libellé "Télécharger" + chevron.
  - Items du menu :
    - "PDF" (icône `FileDown`) → `handleExportPdf`
    - "Excel" (icône `FileSpreadsheet`) → `handleExportExcel`
- État `disabled` lié à `isExporting` sur le trigger.
- Pendant l'export, le libellé devient "Export en cours…" avec un spinner discret.

### Résultat visuel

Avant : `[↻] [PDF] [Excel] [Février 2026 ▾]`
Après : `[⬇ Télécharger ▾] [Février 2026 ▾]`

### Fichier modifié

- `src/pages/Overview.tsx` (header uniquement, lignes ~492-535)

Aucune autre page n'est impactée. La logique d'export (`useOverviewExport`) reste inchangée.