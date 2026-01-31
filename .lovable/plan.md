
## Objectif
Corriger le fait que, dans les **rapports IA WhatsApp**, la phrase affiche encore “vs 0.0% la semaine dernière” alors que la plateforme montre ~9,5% sur Juvisy.

## Diagnostic (pourquoi c’est encore à 0%)
Tu as corrigé **generate-weekly-report** (mode “template classique”), mais le bouton **“Générer avec IA”** utilise une autre fonction backend : **`generate-ai-report`**.

- **Rapport template (OK)** → `generate-weekly-report` → utilise désormais `daily_order_accuracy` → cohérent avec l’onglet Opérations.
- **Rapport IA (KO)** → `generate-ai-report` → calcule encore le taux “semaine dernière” depuis `order_errors` → comme il n’y a pas de lignes `order_errors` sur la semaine précédente, il calcule **0%**.

Donc le “0%” ne vient pas d’un calcul “inventé” : il vient d’une **source de données différente** (table détaillée) qui est vide pour la semaine précédente.

## Solution retenue
Aligner **`generate-ai-report`** sur la même source que le dashboard :
- Utiliser `daily_order_accuracy` pour :
  - `error_count` / `error_rate` (semaine courante)
  - `prev_error_count` / `prev_error_rate` (semaine précédente)
- Continuer à utiliser `order_errors` uniquement pour :
  - la **ventilation par catégories** (missing items, customizations, etc.)
  - les **produits problématiques**
  - mais **sans** s’en servir pour le taux global (car incomplet sur certaines semaines)

## Changements à faire (backend function)
### 1) Modifier `supabase/functions/generate-ai-report/index.ts`
Dans la section “COLLECT KPIs” :
- Garder la requête `order_errors` **courante** (avec `error_category`, `item_title`) pour les breakdowns
- Remplacer la logique de calcul du taux d’erreurs et du “previous week” :

**Avant (actuel)**
- `errorCount = errors?.length`
- `prevErrorCount = prevErrors?.length`
- taux = `count / orderCount`

**Après (corrigé)**
- Requête `daily_order_accuracy` semaine courante :
  - `select('incorrect_orders_count')`
  - `eq('restaurant_id', restaurantId)`
  - `eq('period_type', 'current')`
  - `gte('date', start_date)` / `lte('date', end_date)`
  - `errorCount = sum(incorrect_orders_count)`
  - `errorRate = errorCount / orderCount * 100`
- Requête `daily_order_accuracy` semaine précédente (prevStartStr/prevEndStr) :
  - `prevErrorCount = sum(incorrect_orders_count)`
  - `prevErrorRate = prevErrorCount / prevOrderCount * 100`

### 2) Mettre à jour les types internes dans `generate-ai-report`
- Étendre l’interface `WeeklyKPIs` pour inclure `prev_error_count` (optionnel mais recommandé), afin de pouvoir logguer et déboguer facilement et éviter les confusions.

### 3) Ajuster le prompt IA (si nécessaire)
Le message IA est construit à partir de `kpis.prev_error_rate`. Une fois la source alignée, le texte “vs 0.0%” disparaîtra.
Optionnel (robustesse) :
- Si `prevErrorRate` est `null` (ex: prevOrderCount = 0), afficher “vs --%” au lieu d’un 0 artificiel.

## Vérifications / Tests (indispensables)
1) Depuis la page `/messaging`, cliquer **Générer avec IA** sur la même période.
2) Vérifier dans le message généré pour Juvisy :
   - “Erreurs: 2.0% (vs 9.5% semaine dernière)” (ou proche selon arrondis)
3) Vérifier que les “produits problématiques” et “catégories d’erreurs” restent présents pour la semaine courante (car toujours issus de `order_errors`).
4) Contrôler les logs de la fonction backend pour une exécution Juvisy :
   - log explicite du `errorCount/errorRate` et `prevErrorCount/prevErrorRate` (utile pour confirmer).

## Risques & cas limites
- Si `daily_order_accuracy` n’a pas de lignes sur une période (imports manquants), alors `errorCount=0`. Dans ce cas, c’est cohérent avec le dashboard (et on pourra ajouter plus tard un warning “données manquantes”).
- Si `order_errors` est incomplet mais `daily_order_accuracy` présent (cas actuel semaine précédente), on aura :
  - taux correct
  - mais pas de détail catégoriel historique : c’est acceptable et logique.

## Livrables
- 1 fichier modifié : `supabase/functions/generate-ai-report/index.ts`
- Résultat : les rapports IA WhatsApp afficheront la même comparaison “semaine dernière” que la plateforme Opérations.