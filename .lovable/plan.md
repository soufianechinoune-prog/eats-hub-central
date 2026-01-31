

# Plan : Corrections et Historique des Rapports WhatsApp

## Problèmes identifiés

| Problème | Cause | Solution |
|----------|-------|----------|
| **Note avec 1 décimale au lieu de 2** | `toFixed(1)` utilisé partout dans `generate-ai-report` et `WeeklyReports.tsx` | Passer à `toFixed(2)` dans le prompt IA et l'affichage UI |
| **Rapport IA disparaît quand on navigue** | Les rapports générés sont stockés dans le state React local qui se réinitialise à chaque navigation | Persister les rapports "en attente d'envoi" dans une table ou localStorage |
| **Pas d'historique des rapports envoyés** | L'historique existe dans `message_history` mais aucune UI pour le consulter | Ajouter un onglet "Historique" dans l'interface Rapports |
| **JUVISY sans commandes ?** | D'après les données, JUVISY a bien 344 commandes. L'image montre aussi 344 commandes. Peut-être un problème temporaire lors de la génération ? | Vérifier la logique de récupération des données |

---

## Phase 1 : Afficher la note avec 2 décimales

### Fichier `generate-ai-report/index.ts`

Modifier le prompt pour utiliser `.toFixed(2)` au lieu de `.toFixed(1)` pour la note moyenne :

```
Ligne 439 actuelle:
- Note moyenne: ${kpis.average_rating !== null ? kpis.average_rating.toFixed(1) : '--'}

Devient:
- Note moyenne: ${kpis.average_rating !== null ? kpis.average_rating.toFixed(2) : '--'}
```

Appliquer dans toutes les fonctions de génération de rapport (global, reviews, errors, etc.)

### Fichier `WeeklyReports.tsx`

Modifier l'affichage dans les badges et grilles KPI :
- Ligne 920 : `.toFixed(1)` → `.toFixed(2)`
- Ligne 969 : `.toFixed(1)` → `.toFixed(2)`
- Ligne 1023 : `.toFixed(1)` → `.toFixed(2)`

---

## Phase 2 : Persister les rapports en cours

### Option A : Stockage localStorage (simple, immédiat)

Sauvegarder `generatedKPIs` et `editedMessages` dans localStorage quand ils changent, et les restaurer au chargement du composant.

Avantages :
- Rapide à implémenter
- Pas de modification BDD
- Persiste même si l'onglet est fermé

### Option B : Table `pending_reports` (plus robuste)

Créer une table pour stocker les rapports générés mais pas encore envoyés.

Je recommande **Option A** pour la simplicité.

### Implémentation (Option A)

```typescript
// À l'initialisation du composant
useEffect(() => {
  const savedKPIs = localStorage.getItem('pending-reports-kpis');
  const savedMessages = localStorage.getItem('pending-reports-messages');
  if (savedKPIs) setGeneratedKPIs(JSON.parse(savedKPIs));
  if (savedMessages) setEditedMessages(JSON.parse(savedMessages));
}, []);

// Sauvegarder quand les données changent
useEffect(() => {
  if (generatedKPIs.length > 0) {
    localStorage.setItem('pending-reports-kpis', JSON.stringify(generatedKPIs));
    localStorage.setItem('pending-reports-messages', JSON.stringify(editedMessages));
  }
}, [generatedKPIs, editedMessages]);

// Nettoyer après envoi réussi
const clearPendingReports = () => {
  localStorage.removeItem('pending-reports-kpis');
  localStorage.removeItem('pending-reports-messages');
};
```

---

## Phase 3 : Ajouter un onglet Historique

### Nouvelle UI dans WeeklyReports.tsx

Ajouter un 3ème onglet "Historique" qui affiche les messages envoyés depuis `message_history` :

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Tabs: [Templates] [Envoi (4)] [Historique]                             │
├─────────────────────────────────────────────────────────────────────────┤
│  Filtres: [Type de rapport ▼] [Restaurant ▼] [Période ▼]                │
├─────────────────────────────────────────────────────────────────────────┤
│  31/01/2026 08:41 | JUVISY | Amar AOUS | ✅ Envoyé | Rapport IA         │
│  31/01/2026 08:40 | BONNEUIL | Ismael Chinoune | ✅ Envoyé | Rapport IA │
│  29/01/2026 10:43 | ATHIS-MONS | Younous Chinoune | ✅ Envoyé | Report  │
│  ...                                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Structure de la requête

```typescript
const { data: history } = useQuery({
  queryKey: ['report-history', filters],
  queryFn: async () => {
    let query = supabase
      .from('message_history')
      .select('*')
      .eq('direction', 'outbound')
      .eq('message_type', 'report')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (filters.restaurantId) {
      query = query.eq('restaurant_id', filters.restaurantId);
    }
    // Autres filtres...
    
    return query;
  }
});
```

### Informations à afficher

| Colonne | Champ |
|---------|-------|
| Date/Heure | `created_at` |
| Restaurant | `restaurant_name` |
| Destinataire | `recipient_name` |
| Type | `message_type` (+ badge si rapport IA) |
| Statut | `status` avec icône (✅ sent, ❌ failed) |
| Actions | Bouton "Voir message" (expand) |

---

## Fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `supabase/functions/generate-ai-report/index.ts` | `.toFixed(1)` → `.toFixed(2)` pour les notes |
| `src/components/messaging/WeeklyReports.tsx` | 1. Affichage note 2 décimales |
|  | 2. Persistance localStorage |
|  | 3. Nouvel onglet "Historique" |

---

## Résultat attendu

1. **Notes affichées en 2 décimales** : `4.82` au lieu de `4.8`
2. **Rapports persistants** : Naviguer hors de la page et revenir conserve les rapports générés
3. **Historique visible** : Onglet dédié pour voir tous les rapports envoyés avec filtres

---

## Question sur JUVISY

D'après la base de données et l'image que tu m'as montrée, JUVISY affiche bien **344 commandes** et **4.8 de note**. 

Peux-tu préciser ce qui ne fonctionnait pas exactement ? Était-ce :
- Un problème lors de la **génération** du rapport IA (le message généré n'incluait pas les commandes) ?
- Un **affichage vide** temporaire qui s'est corrigé ?
- Un **autre restaurant** qui avait ce problème ?

Si le problème était dans le message IA généré (pas dans l'affichage UI), je devrai regarder les logs de la fonction `generate-ai-report` pour comprendre.

