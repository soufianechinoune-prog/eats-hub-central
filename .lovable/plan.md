
# Réorganisation de l'Historique des Rapports

## Objectif

Transformer la liste plate actuelle en une structure hiérarchique :
1. **Niveau 1 : Date** (groupé par jour)
2. **Niveau 2 : Type de rapport** (ex: "Rapport IA", "KPIs Hebdo")
3. **Niveau 3 : Liste déroulante** des rapports individuels

## Nouvelle Structure UI

```text
┌─────────────────────────────────────────────────────────────────────┐
│  📋 Historique des rapports envoyés                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📅 31 janvier 2026                              [3 rapports]  ▼   │
│  ├─────────────────────────────────────────────────────────────────│
│  │  🏷️ Rapport IA                                (3)           ▼   │
│  │  ├─ ✅ BOURG-EN-BRESSE • Jamel • 09:41         [Voir]           │
│  │  ├─ ✅ BONNEUIL-SUR-MARNE • Ismael • 09:40     [Voir]           │
│  │  └─ ✅ JUVISY-SUR-ORGE • Amar AOUS • 09:40     [Voir]           │
│  │                                                                  │
│                                                                     │
│  📅 29 janvier 2026                              [2 rapports]  ▼   │
│  ├─────────────────────────────────────────────────────────────────│
│  │  🏷️ Rapport IA                                (2)           ▼   │
│  │  ├─ ✅ ATHIS-MONS • Younous • 11:43            [Voir]           │
│  │  └─ ✅ ATHIS-MONS • Younous • 10:42            [Voir]           │
│  │                                                                  │
│                                                                     │
│  📅 18 décembre 2025                             [4 rapports]  ▼   │
│  ├─────────────────────────────────────────────────────────────────│
│  │  🏷️ Rapport                                   (4)           ▼   │
│  │  ├─ ✅ ANTONY • Saleh • 15:56                  [Voir]           │
│  │  ├─ ✅ JUVISY-SUR-ORGE • Eymen • 15:56         [Voir]           │
│  │  └─ ...                                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Données existantes

Les messages stockés dans `message_history` sont déjà typés :
- `message_type = 'report'` : Tous les rapports
- Possibilité de distinguer "Rapport IA" vs "Template standard" via un champ additionnel ou le contenu

Exemple de données actuelles :
| Date | Nombre de rapports |
|------|--------------------|
| 31 janvier 2026 | 3 |
| 29 janvier 2026 | 2 |
| 18 décembre 2025 | 4 |
| 2 décembre 2025 | 3 |

## Implémentation Technique

### 1. Grouper les données par date puis type

```typescript
// Grouper par date
const groupedHistory = useMemo(() => {
  const groups: Record<string, Record<string, typeof reportHistory>> = {};
  
  reportHistory.forEach((msg) => {
    const dateKey = format(new Date(msg.created_at), "yyyy-MM-dd");
    const typeKey = msg.message_type === 'report' 
      ? (msg.message_content?.includes('PLUS DE DÉTAILS') ? 'Rapport IA' : 'Rapport')
      : msg.message_type;
    
    if (!groups[dateKey]) groups[dateKey] = {};
    if (!groups[dateKey][typeKey]) groups[dateKey][typeKey] = [];
    groups[dateKey][typeKey].push(msg);
  });
  
  // Trier par date décroissante
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, types]) => ({
      date,
      dateLabel: format(new Date(date), "d MMMM yyyy", { locale: fr }),
      types: Object.entries(types).map(([type, messages]) => ({
        type,
        messages,
        count: messages.length
      })),
      totalCount: Object.values(types).flat().length
    }));
}, [reportHistory]);
```

### 2. Nouvelle structure de composants Collapsible imbriqués

```tsx
{groupedHistory.map((dateGroup) => (
  <Collapsible key={dateGroup.date} defaultOpen>
    {/* Niveau 1 : Date */}
    <CollapsibleTrigger className="w-full">
      <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span className="font-medium">{dateGroup.dateLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{dateGroup.totalCount} rapport(s)</Badge>
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
    </CollapsibleTrigger>
    
    <CollapsibleContent className="pl-4 mt-2 space-y-2">
      {dateGroup.types.map((typeGroup) => (
        <Collapsible key={typeGroup.type} defaultOpen>
          {/* Niveau 2 : Type de rapport */}
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/30">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{typeGroup.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{typeGroup.count}</Badge>
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="pl-4 mt-1 space-y-1">
            {/* Niveau 3 : Rapports individuels */}
            {typeGroup.messages.map((msg) => (
              <div key={msg.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-secondary/20">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div className="flex-1">
                  <span className="font-medium">{msg.restaurant_name}</span>
                  <span className="text-muted-foreground"> • {msg.recipient_name}</span>
                  <span className="text-muted-foreground text-sm"> • {format(new Date(msg.created_at), "HH:mm")}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => toggleExpand(msg.id)}>
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </CollapsibleContent>
  </Collapsible>
))}
```

### 3. Distinction des types de rapports

Pour différencier les types dans l'historique :

| Type affiché | Critère de détection |
|--------------|----------------------|
| **Rapport IA** | Le contenu contient "PLUS DE DÉTAILS" (menu interactif) |
| **Rapport** | Autres rapports standards sans menu interactif |

Optionnel : ajouter un champ `template_name` ou `report_subtype` lors de l'enregistrement dans `message_history` pour un tri plus précis.

## Fichier à modifier

| Fichier | Modifications |
|---------|---------------|
| `src/components/messaging/WeeklyReports.tsx` | 1. Créer `groupedHistory` avec useMemo pour grouper par date/type |
|  | 2. Remplacer la boucle simple par des Collapsible imbriqués |
|  | 3. Ajouter les styles visuels pour la hiérarchie |

## Avantages

1. **Lisibilité** : Vue claire des envois par jour
2. **Navigation rapide** : Replier/déplier les jours non pertinents  
3. **Organisation** : Distinguer les types de rapports au sein d'une même journée
4. **Extensible** : Facile d'ajouter de nouveaux types (Alertes, Détails erreurs, etc.)
