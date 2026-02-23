

## Corriger le PDF Downtime quand il n'y a pas de donnees hourly_availability

### Probleme identifie

Le PDF downtime affiche correctement le header "Rapport Disponibilite" mais le contenu est vide car :

1. Le restaurant "Chicken Street - Athis-Mons" n'a aucune ligne dans `hourly_availability` pour la periode 16-22 fevrier
2. Le code actuel fetch les donnees, obtient 0 lignes, puis affiche juste "Aucune donnee de disponibilite" en petit texte gris -- quasi invisible
3. Meme quand il y a 0 lignes, le PDF devrait afficher les 4 KPI cards (avec 100%, 0h en ligne, 0h hors ligne, 0 incidents) et un graphique vide ou un message clair, pas une page blanche

### Solution

Modifier la branche downtime dans `useReportPdfExport.ts` pour :

1. **Toujours afficher les 4 KPI cards**, meme quand il n'y a aucune donnee (dans ce cas : 100%, 0h, 0h, 0 incidents)
2. **Afficher le graphique a barres** avec des barres a 100% pour chaque jour de la periode demandee (generer les jours meme sans donnees)
3. **Ne pas afficher les details horaires** quand il n'y a pas de donnees (rien a montrer)

### Modifications

#### `src/hooks/useReportPdfExport.ts`

Dans la branche `reportType === "downtime"` (ligne 214+) :

- Deplacer le dessin des 4 KPI cards **avant** le check `sortedDays.length > 0` pour qu'elles s'affichent toujours
- Quand `rows.length === 0` : generer automatiquement les labels des jours entre `periodStart` et `periodEnd`, avec des valeurs a 100% pour le graphique journalier
- Le graphique a barres journalier s'affiche toujours avec les jours de la periode
- Les details horaires ne s'affichent que s'il y a des donnees reelles (rows > 0)

### Resultat attendu

- Le PDF affiche toujours : header vert + 4 KPI cards colorees + graphique a barres journalier
- Sans donnees : toutes les barres sont vertes a 100%, KPIs montrent 100% / 0h / 0h / 0
- Avec donnees : meme comportement qu'actuellement (barres rouges/vertes, details horaires)

### Fichiers concernes

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useReportPdfExport.ts` | Toujours dessiner les KPI cards et le graphique, generer les jours de la periode meme sans donnees |
