

## Ajouter le type de rapport "Temps d'inactivite"

### Objectif

Ajouter une 7eme carte "Temps d'inactivite" dans la grille de selection des types de rapport WhatsApp, a cote de Erreurs, CA & Commandes, Notes clients, Temps operationnels et Promotions.

### Modifications

#### 1. Frontend - `src/components/messaging/WeeklyReports.tsx`

- Ajouter `"downtime"` au type `ReportType` (ligne 150)
- Ajouter une nouvelle carte dans `REPORT_TYPE_OPTIONS` (apres Promotions) :
  - id: `"downtime"`
  - label: `"Temps d'inactivite"`
  - description: `"Disponibilite et interruptions de service"`
  - icone: `PauseCircle` (de lucide-react)
  - gradient: `"from-slate-500/20 to-gray-500/20"`
  - couleur: `"text-slate-500"`

#### 2. Backend - `supabase/functions/generate-stat-report/index.ts`

- Ajouter `"downtime"` au type `TemplateType` (ligne 10)
- Ajouter un `case 'downtime'` dans le switch (ligne 77-110)
- Creer la fonction `generateDowntimeTemplate` qui :
  - Recupere les donnees `hourly_availability` pour la periode (filtre `platform = 'uber_eats'`)
  - Calcule : minutes offline, minutes online, taux de disponibilite
  - Recupere les memes donnees pour la semaine precedente (comparaison)
  - **Mode basique** : taux global, total minutes hors ligne, comparaison semaine precedente
  - **Mode detaille** : ajoute les 3 pires jours, les creneaux horaires les plus touches, et le nombre de jours a 100%

### Contenu du rapport WhatsApp "Temps d'inactivite"

**Mode basique :**

```text
⏸️ TEMPS D'INACTIVITE - {restaurant}

📊 Cette semaine :
- Taux de disponibilite : 96.7%
- Temps hors ligne : 2h 38min
- Sur 7 jours

📈 Evolution :
↗️ +1.2% vs semaine precedente
(Etait : 95.5% | 3h 42min)

🤲 Qu'Allah nous accorde la reussite !
```

**Mode detaille (ajoute) :**

```text
📅 Jours les plus impactes :
1. Mardi : 1h 28min hors ligne
2. Vendredi : 45min hors ligne
3. Samedi : 25min hors ligne

⏰ Creneaux critiques :
- 11h-12h : 45min cumulees
- 19h-20h : 38min cumulees
- 12h-13h : 22min cumulees

✅ Jours a 100% : 4/7
```

### Fichiers concernes

| Fichier | Modification |
|---------|-------------|
| `src/components/messaging/WeeklyReports.tsx` | Ajouter "downtime" au ReportType + nouvelle carte dans REPORT_TYPE_OPTIONS |
| `supabase/functions/generate-stat-report/index.ts` | Ajouter "downtime" au TemplateType + nouvelle fonction generateDowntimeTemplate |

