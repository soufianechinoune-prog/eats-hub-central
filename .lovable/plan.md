

# Plan : PDF autonome avec navigation interne (drill-down journalier)

## Objectif

Créer un PDF **100% autonome et partageable** :
- **Page 1** : Synthèse réseau + classement mensuel avec liens cliquables
- **Pages suivantes** : Détail journalier de chaque restaurant (1 page par restaurant)
- Cliquer sur un restaurant dans le tableau de la page 1 → navigue vers sa page de détail dans le même PDF

## Structure du document

```text
┌────────────────────────────────────────────┐
│ PAGE 1 - SYNTHESE                          │
├────────────────────────────────────────────┤
│ ╔═══════════════════════════════════════╗  │
│ ║  Comparaison Temps d'inactivité       ║  │
│ ║  Janvier 2026 | 15 restaurants        ║  │
│ ╚═══════════════════════════════════════╝  │
│                                            │
│ [KPI 1] [KPI 2] [KPI 3] [KPI 4]           │
│                                            │
│ ┌──────────────────────────────────────┐  │
│ │ # │ Restaurant ↗   │ Dispo │ Offline │  │
│ ├──────────────────────────────────────┤  │
│ │ 1 │ Bourg-en-Bresse │ 99.2% │ 45min  │  │
│ │ 2 │ Lyon Part-Dieu  │ 98.1% │ 1h12   │  │
│ │ ...                                  │  │
│ └──────────────────────────────────────┘  │
│        ↗ = Lien interne vers page détail  │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ PAGE 2 - DETAIL BOURG-EN-BRESSE            │
├────────────────────────────────────────────┤
│ ← Retour synthèse                          │
│                                            │
│ Bourg-en-Bresse - Janvier 2026            │
│ Disponibilité : 99.2% | Offline : 45min   │
│                                            │
│ ┌──────────────────────────────────────┐  │
│ │ Date      │ Temps offline │ Statut   │  │
│ ├──────────────────────────────────────┤  │
│ │ 01/01     │ 0min          │ ✓        │  │
│ │ 02/01     │ 15min         │ !        │  │
│ │ 03/01     │ 0min          │ ✓        │  │
│ │ ...       │               │          │  │
│ │ 31/01     │ 30min         │ ✗        │  │
│ └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

## Avantages

| Aspect | Valeur |
|--------|--------|
| Autonomie | Aucune connexion internet requise pour consulter |
| Partage | Envoyable par email à n'importe qui |
| Navigation | Drill-down intuitif comme dans l'app web |
| Taille estimée | ~200-400 Ko pour 15 restaurants sur 1 mois |

## Section technique

### Fichier à modifier : `src/hooks/useDowntimeExport.ts`

### 1. Ajouter `dailyData` dans l'interface

```typescript
interface RestaurantStat {
  id: string;
  name: string;
  totalOfflineMinutes: number;
  availabilityRate: number;
  hourlyData?: Record<number, number>;
  weekdayData?: Record<number, number>;
  dailyData?: Record<string, number>;  // NOUVEAU
}
```

### 2. Modifier `exportPdf` pour générer les pages de détail

**Étape 1** : Collecter les numéros de page de chaque restaurant

```typescript
const restaurantPages: Record<string, number> = {};
let currentPage = 2; // Page 1 = synthèse

data.stats.forEach(stat => {
  restaurantPages[stat.id] = currentPage;
  currentPage++;
});
```

**Étape 2** : Ajouter des liens internes dans le tableau de synthèse

```typescript
// Dans la boucle de rendu des restaurants (page 1)
const cityName = extractCityName(stat.name);
const targetPage = restaurantPages[stat.id];

// Créer une zone cliquable avec lien interne
doc.setTextColor(37, 99, 235); // Bleu pour indiquer le lien
doc.text(cityName.substring(0, 35), colX, yPos + 5.5);
doc.link(colX, yPos, colWidths[1], rowHeight, { pageNumber: targetPage });
```

**Étape 3** : Générer une page par restaurant avec le détail journalier

```typescript
// Après la page de synthèse
data.stats.forEach((stat, index) => {
  doc.addPage();
  let yPos = margin;

  // En-tête de la page de détail
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 30, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(extractCityName(stat.name), margin, 15);
  doc.setFontSize(10);
  doc.text(`${stat.availabilityRate.toFixed(1)}% | ${formatMinutesToDisplay(stat.totalOfflineMinutes)}`, margin, 24);
  
  // Lien retour vers page 1
  doc.setTextColor(255, 255, 255);
  doc.text("← Retour", pageWidth - margin - 20, 15);
  doc.link(pageWidth - margin - 25, 8, 25, 12, { pageNumber: 1 });

  yPos = 40;

  // Tableau journalier
  const dailyEntries = Object.entries(stat.dailyData || {}).sort();
  
  // En-tête du tableau
  doc.setFillColor(16, 185, 129);
  doc.rect(margin, yPos, pageWidth - margin * 2, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("Date", margin + 3, yPos + 5.5);
  doc.text("Temps offline", margin + 50, yPos + 5.5);
  doc.text("Statut", margin + 100, yPos + 5.5);
  
  yPos += 8;

  // Lignes du tableau
  dailyEntries.forEach(([date, minutes], idx) => {
    if (yPos > pageHeight - 20) {
      doc.addPage();
      yPos = margin;
    }

    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, yPos, pageWidth - margin * 2, 7, "F");
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text(format(parseISO(date), "dd/MM"), margin + 3, yPos + 5);
    
    // Couleur selon le temps
    if (minutes === 0) {
      doc.setTextColor(16, 185, 129);
    } else if (minutes < 30) {
      doc.setTextColor(245, 158, 11);
    } else {
      doc.setTextColor(239, 68, 68);
    }
    doc.text(formatMinutesToDisplay(minutes), margin + 50, yPos + 5);
    
    // Indicateur visuel
    doc.text(minutes === 0 ? "OK" : minutes < 30 ? "Attention" : "Critique", margin + 100, yPos + 5);

    yPos += 7;
  });
});
```

### 3. Ajouter l'import manquant

```typescript
import { parseISO } from "date-fns";
```

---

## Taille estimée du fichier

| Restaurants | Jours/mois | Pages | Taille estimée |
|-------------|------------|-------|----------------|
| 15          | 31         | 16    | ~250 Ko        |
| 30          | 31         | 31    | ~400 Ko        |
| 50          | 31         | 51    | ~600 Ko        |

Les fichiers restent très légers car jsPDF génère du texte vectoriel (pas d'images).

---

## Résultat attendu

1. **Export** : L'utilisateur clique sur "PDF"
2. **Page 1** : Synthèse avec classement - les noms de restaurants sont en bleu (cliquables)
3. **Clic sur un restaurant** : Le lecteur PDF saute à la page de détail correspondante
4. **Page détail** : Tableau jour par jour avec temps offline et code couleur
5. **Lien "Retour"** : Revient à la page 1 de synthèse

Le document est 100% autonome et partageable par email sans nécessiter d'accès à l'application.

