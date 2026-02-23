

## Enrichir le PDF "Temps d'inactivite" avec les graphiques a barres

### Probleme actuel

Le PDF genere pour le rapport "Temps d'inactivite" est quasi-vide (2 lignes de texte) car :
1. L'interface `WeeklyKPIs` ne contient aucune donnee de downtime
2. Le generateur PDF n'a pas acces aux donnees `hourly_availability` de la base
3. Il n'y a aucun graphique a barres -- contrairement au PDF exporte depuis la page "Comparaison Temps d'inactivite" qui contient des KPI cards, un graphique a barres journalier, et des details horaires jour par jour

### Solution

Quand le type de rapport est `"downtime"`, fetcher les donnees `hourly_availability` directement depuis la base pour le restaurant concerne, puis reutiliser la meme logique de dessin (bar charts vectoriels avec `doc.rect()`) que dans `useDowntimeExport.ts`.

### Modifications

#### 1. `src/hooks/useReportPdfExport.ts`

- Rendre `generateReportPdf` **async** (retourne `Promise<Blob>`)
- Pour le type `"downtime"` :
  - Fetcher `hourly_availability` depuis Supabase pour le `restaurant_id` sur la periode
  - Calculer : taux de disponibilite, heures en ligne, heures hors ligne, disponibilite journaliere, detail horaire par jour
  - Dessiner 4 KPI cards en haut (Taux de dispo, Heures en ligne, Heures hors ligne, Incidents >15min) -- identique au screenshot de reference
  - Dessiner un graphique a barres journalier (vert >= 95%, rouge < 95%) avec labels de pourcentage
  - En dessous, pour chaque jour, dessiner un graphique a barres horaire (24 barres, 0h-23h)
  - Reprendre exactement la fonction `drawBarChart` de `useDowntimeExport.ts` (dessin vectoriel avec seuil 95%)
- Ajouter `restaurant_id` a l'interface `PdfOptions` pour pouvoir fetcher les donnees

#### 2. `src/components/messaging/WeeklyReports.tsx`

- Passer `restaurant_id` dans les options du `generateReportPdf`
- Adapter l'appel a `generateReportPdf` pour le `await` (deja dans une fonction async)

### Structure du PDF genere (type downtime)

```text
Page 1:
+-------------------------------------------------+
| CS Delivery - Rapport Disponibilite             |
| Restaurant Name              16 fev - 22 fev    |
+-------------------------------------------------+
| [Taux dispo] [Heures online] [Hors ligne] [Inc] |
|   96.7%         55h             2h 38min    0    |
+-------------------------------------------------+
| Disponibilite journaliere                        |
| [Bar chart: 1 barre par jour, vert/rouge]        |
+-------------------------------------------------+
| Detail horaire - Lundi 16/02                     |
| [24 barres horaires]                             |
| Detail horaire - Mardi 17/02                     |
| [24 barres horaires]                             |
| ...                                              |
+-------------------------------------------------+
```

### Fichiers concernes

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useReportPdfExport.ts` | Async, fetch hourly_availability, dessiner KPI cards + bar charts journalier + horaire |
| `src/components/messaging/WeeklyReports.tsx` | Passer restaurant_id, await generateReportPdf |

