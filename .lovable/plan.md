
# Stocker et réutiliser les dates du rapport IA initial

## Problème identifié

Quand un rapport IA est généré depuis l'interface (avec les dates du 19-25 janvier sélectionnées), ces dates ne sont **pas stockées** dans `message_history`. 

Ensuite, quand le gérant répond "2" pour demander le rapport CA, le webhook `ultramsg-webhook` appelle `generate-stat-report` avec des dates calculées à partir de `new Date()` (aujourd'hui), ce qui donne des données incorrectes.

## Solution

Stocker les dates (`start_date`, `end_date`) dans le message original, puis les réutiliser pour les sous-rapports.

## Modifications techniques

### 1. Ajouter les colonnes de dates à `message_history`

```sql
ALTER TABLE message_history 
ADD COLUMN IF NOT EXISTS report_start_date DATE,
ADD COLUMN IF NOT EXISTS report_end_date DATE;
```

### 2. Modifier `send-whatsapp` pour accepter et stocker les dates

**Fichier : `supabase/functions/send-whatsapp/index.ts`**

Ajouter au type `SendRequest` :
```typescript
interface SendRequest {
  // ... existing fields ...
  report_start_date?: string;  // NEW
  report_end_date?: string;    // NEW
}
```

Modifier l'insertion dans `message_history` pour inclure ces dates :
```typescript
await supabase.from('message_history').insert({
  // ... existing fields ...
  report_start_date: report_start_date || null,
  report_end_date: report_end_date || null,
});
```

### 3. Modifier `WeeklyReports.tsx` pour passer les dates lors de l'envoi

**Fichier : `src/components/messaging/WeeklyReports.tsx`**

Dans la fonction `sendReports`, ajouter les dates au body :
```typescript
const { error } = await supabase.functions.invoke("send-whatsapp", {
  body: {
    recipients: [...],
    message,
    skip_campaign: false,
    report_start_date: format(lastWeek.start, "yyyy-MM-dd"),  // NEW
    report_end_date: format(lastWeek.end, "yyyy-MM-dd"),      // NEW
  },
});
```

### 4. Modifier le webhook pour récupérer les dates du rapport original

**Fichier : `supabase/functions/ultramsg-webhook/index.ts`**

Créer une nouvelle fonction :
```typescript
async function getReportDatesFromOriginal(
  supabase: any,
  phone: string,
  restaurantId: string
): Promise<{ startDate: string; endDate: string } | null> {
  const normalizedPhone = normalizePhoneNumber(phone);
  const phoneLast9 = normalizedPhone.slice(-9);
  
  // Find the most recent AI report sent to this phone for this restaurant
  const { data: originalReport } = await supabase
    .from('message_history')
    .select('report_start_date, report_end_date')
    .eq('direction', 'outbound')
    .eq('message_type', 'report')
    .eq('restaurant_id', restaurantId)
    .or(`recipient_phone.eq.${normalizedPhone},recipient_phone.ilike.%${phoneLast9}`)
    .not('report_start_date', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (!originalReport?.report_start_date) return null;
  
  return {
    startDate: originalReport.report_start_date,
    endDate: originalReport.report_end_date
  };
}
```

### 5. Utiliser ces dates dans `handleInteractiveReportRequest`

**Fichier : `supabase/functions/ultramsg-webhook/index.ts`**

Modifier l'appel à `generate-stat-report` :
```typescript
async function handleInteractiveReportRequest(
  supabase: any,
  restaurant: any,
  reportType: string,
  detailLevel: 'basic' | 'detailed',
  phone: string,
  managerFirstName: string
): Promise<void> {
  // Get dates from the original AI report
  const reportDates = await getReportDatesFromOriginal(supabase, phone, restaurant.id);
  
  let startDateStr: string;
  let endDateStr: string;
  
  if (reportDates) {
    // Use dates from original report
    startDateStr = reportDates.startDate;
    endDateStr = reportDates.endDate;
    console.log(`Using dates from original report: ${startDateStr} to ${endDateStr}`);
  } else {
    // Fallback: calculate from latest available data
    const latestDate = await getLatestDataDate(supabase, restaurant.id);
    if (!latestDate) {
      await sendWhatsAppReply(phone, `❌ Aucune donnée disponible pour ${restaurant.name}.`);
      return;
    }
    const end = new Date(latestDate);
    const start = new Date(latestDate);
    start.setDate(start.getDate() - 6);
    startDateStr = start.toISOString().split('T')[0];
    endDateStr = end.toISOString().split('T')[0];
  }
  
  // Call generate-stat-report with the correct dates
  const { data, error } = await supabase.functions.invoke("generate-stat-report", {
    body: {
      restaurant_id: restaurant.id,
      start_date: startDateStr,
      end_date: endDateStr,
      template_type: reportType,
      detail_level: detailLevel,
    },
  });
  // ...
}
```

## Flux corrigé

```text
1. UI: Sélection semaine 19-25 janvier + génération rapport IA
2. UI → send-whatsapp: Envoi avec report_start_date="2026-01-19", report_end_date="2026-01-25"
3. message_history: Stocke les dates avec le message
4. Gérant répond "2"
5. webhook → getReportDatesFromOriginal: Récupère start=19 jan, end=25 jan
6. webhook → generate-stat-report: Appelle avec les bonnes dates
7. Résultat: Rapport CA avec les vraies données de la semaine 19-25 janvier ✅
```

## Fichiers à modifier

| Fichier | Modifications |
|---------|--------------|
| Migration SQL | Ajouter colonnes `report_start_date`, `report_end_date` |
| `supabase/functions/send-whatsapp/index.ts` | Accepter et stocker les dates |
| `src/components/messaging/WeeklyReports.tsx` | Passer les dates lors de l'envoi |
| `supabase/functions/ultramsg-webhook/index.ts` | Récupérer et utiliser les dates du rapport original |

## Avantages

- Les sous-rapports utilisent **exactement** la même période que le rapport IA initial
- La comparaison S vs S-1 est **cohérente** (semaine 12-18 jan pour la comparaison)
- Pas de question supplémentaire au gérant
- Fonctionne même si les données ne sont pas à jour dans la base
