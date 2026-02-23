

## Corriger le PDF joint aux rapports WhatsApp

### Problemes identifies

1. **Emojis illisibles** : jsPDF ne supporte pas les emojis Unicode -- ils s'affichent en caracteres corrompus (ex: "O=U'" au lieu de l'icone)
2. **Contenu generique** : Le PDF affiche systematiquement TOUS les KPIs (CA, Satisfaction, Operations, Erreurs, Disponibilite) quel que soit le type de rapport selectionne. Quand on choisit "Temps d'inactivite", le PDF devrait reprendre la meme structure que l'export depuis `/compare/downtime`

### Solution

Adapter le hook `useReportPdfExport.ts` pour qu'il genere un PDF **specifique au type de rapport** selectionne, et corriger les emojis en les remplacant par des labels texte.

### Modifications

#### 1. `src/hooks/useReportPdfExport.ts` -- Refonte complete

- **Supprimer tous les emojis** des titres de section et les remplacer par des prefixes texte simples (ex: "[CA]", "[AVIS]", "[OPS]", "[ERR]", "[DISPO]")
- **Ajouter un parametre `reportType`** a l'interface `PdfOptions` pour savoir quel type de rapport generer
- **Generer un PDF adapte au type** :
  - `"ai_global"` : garde toutes les sections (comportement actuel, sans emojis)
  - `"revenue"` : uniquement la section CA et Commandes
  - `"rating"` : uniquement la section Satisfaction Client
  - `"operations"` : uniquement la section Temps Operationnels
  - `"errors"` : uniquement la section Erreurs
  - `"downtime"` : uniquement la section Disponibilite, avec en plus le taux de disponibilite calcule et le formatage en heures/minutes (comme sur la page Comparaison)
  - `"promotions"` : section minimale avec rappel des donnees disponibles

#### 2. `src/components/messaging/WeeklyReports.tsx` -- Passer le type de rapport

- Dans la fonction `sendReports`, passer le `reportType` courant au `generateReportPdf` via les options
- Le PDF sera ainsi contextualise automatiquement

### Resultat attendu

- Quand on selectionne "Temps d'inactivite" et qu'on active le toggle PDF, le PDF joint ne montrera que les donnees de disponibilite (taux, minutes hors ligne, evolution)
- Les titres de section utilisent du texte pur, pas d'emojis
- Pour "Rapport IA", le PDF reste complet avec toutes les sections

### Fichiers concernes

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useReportPdfExport.ts` | Supprimer emojis, ajouter `reportType` dans options, filtrer les sections par type |
| `src/components/messaging/WeeklyReports.tsx` | Passer `reportType` au generateur PDF |

