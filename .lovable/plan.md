

# Révision du Simulateur BOGO : De la projection à l'analyse rétrospective

## Problème actuel

Le simulateur tente de prédire l'impact futur en croisant des ventes d'articles historiques avec des projections de volume. Cette approche est :
- **Peu fiable** : les données matchent mal (fuzzy matching complexe)
- **Trompeuse** : affiche des valeurs qui peuvent être fausses
- **Inutile** : tu as déjà les vraies données d'offres passées !

## Nouvelle approche : Exploiter l'historique réel des offres

Tu as **46 offres BOGO** avec des données réelles :
- Dates, durée, articles concernés
- CA généré : jusqu'à 17 787 € pour la meilleure
- Nombre de commandes : jusqu'à 619
- Nouveaux clients : jusqu'à 196
- Audience ciblée (Tous, Nouveaux, Uber One)

Cette data existe, il faut simplement la présenter intelligemment dans le simulateur.

---

## Modifications proposées

### 1. Remplacer le popup "Projection" par "Historique des offres similaires"

Quand l'utilisateur clique sur "Simuler l'impact" :

**Au lieu de :** projections incertaines basées sur ventes d'articles

**Afficher :** les offres BOGO passées sur les mêmes articles

```text
┌───────────────────────────────────────────────────────────────┐
│  📊 Offres similaires passées                                 │
│                                                               │
│  3 offres BOGO trouvées pour "Naan TENDERS"                   │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 🥇 Déc 2025 • Nouveaux clients • 11 937 € • 458 cmd    │  │
│  │     ⭐⭐⭐⭐⭐ Excellent (354 nouveaux clients)          │  │
│  │     📝 "Très bon ROI sur nouveaux clients"              │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 🥈 Oct 2025 • Tous les clients • 11 042 € • 364 cmd    │  │
│  │     ⭐⭐⭐⭐ Bon                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 🥉 Jan 2026 • Tous les clients • 6 957 € • 280 cmd     │  │
│  │     ⭐⭐⭐ Correct                                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  💡 Conseil : Les offres "Nouveaux clients" ont généré       │
│     +97% de nouveaux clients vs "Tous les clients"           │
│                                                               │
│  [ Ajouter une note ]  [ Voir toutes les offres BOGO ]       │
└───────────────────────────────────────────────────────────────┘
```

---

### 2. Système de notation automatique

Calculer un score de rentabilité pour chaque offre passée basé sur :

| Critère | Poids | Calcul |
|---------|-------|--------|
| CA généré | 30% | Comparé à la moyenne des offres similaires |
| Commandes | 20% | Volume de commandes générées |
| Nouveaux clients | 25% | Capacité d'acquisition |
| Durée/efficacité | 15% | CA par jour d'offre |
| Cofinancement Uber | 10% | % financé par Uber |

Score affiché : ⭐⭐⭐⭐⭐ (1-5 étoiles) + label (Excellent/Bon/Correct/Faible/Mauvais)

---

### 3. Permettre d'ajouter des notes/commentaires

Enrichir `restaurant_actions.change_context` avec :

```typescript
// Nouvelles propriétés dans change_context
{
  ...existing,
  user_rating: 4,           // Note manuelle 1-5
  user_comment: "Très bon ROI, à refaire en période creuse",
  learnings: [
    "Mieux cibler nouveaux clients",
    "Durée idéale : 5-7 jours"
  ]
}
```

UI dans le popup : bouton "Ajouter une note" ouvre un mini-formulaire.

---

### 4. Insights automatiques

Comparer les offres passées pour générer des recommandations :

```text
💡 Insights basés sur ton historique :

• Les BOGO sur "Naan TENDERS" génèrent en moyenne 9 600 € / campagne
• Audience "Nouveaux clients" : +97% de nouveaux clients vs "Tous"
• Meilleure période : fin de mois (26-31)
• Durée optimale observée : 5-6 jours
```

---

## Fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| `src/components/menu/offers/BogoProjectionDialog.tsx` | Refactoring complet → devient `BogoHistoryInsightsDialog.tsx` |
| `src/components/menu/offers/BogoSimulatorUber.tsx` | Bouton "Historique des offres similaires" au lieu de "Simuler l'impact" |
| `src/hooks/useOfferHistory.ts` | Nouveau hook pour récupérer les offres passées matchées par article |
| `supabase/migrations/` | (Optionnel) Ajouter index sur `change_context->'articles'` pour performance |

---

## Logique de matching des offres

Pour trouver les offres "similaires" à la configuration actuelle :

```sql
-- Requête pour trouver les BOGO passés sur les mêmes articles
SELECT 
  id,
  start_date,
  end_date,
  change_context->>'audience' as audience,
  change_context->>'sales_eur' as sales,
  change_context->>'orders' as orders,
  change_context->>'new_customers' as new_customers,
  change_context->>'articles' as articles
FROM restaurant_actions
WHERE 
  category = 'promotions'
  AND action_type = '1 acheté = 1 offert'
  AND change_context->'articles' ?| ARRAY['Naan TENDERS', 'NAAN TENDER']
ORDER BY start_date DESC
LIMIT 10
```

Le matching utilise les noms d'articles stockés dans `change_context->'articles'`.

---

## Avantages de cette approche

| Avant (projections) | Après (historique réel) |
|---------------------|-------------------------|
| ❌ Données approximatives | ✅ Données réelles d'Uber |
| ❌ Fuzzy matching complexe | ✅ Matching exact sur les offres |
| ❌ "Pas d'historique" fréquent | ✅ 46+ offres BOGO disponibles |
| ❌ Projections peu fiables | ✅ CA/commandes vérifiés |
| ❌ Pas d'apprentissage | ✅ Notes et learnings capitalisés |

---

## Résultat attendu

1. **Fiabilité** : Les chiffres affichés sont vrais (importés d'Uber)
2. **Actionnable** : Voir ce qui a marché permet de décider
3. **Capitalisation** : Notes et commentaires pour apprendre
4. **Intelligence** : Insights automatiques basés sur l'historique
5. **Simplicité** : Plus de fuzzy matching complexe côté ventes

