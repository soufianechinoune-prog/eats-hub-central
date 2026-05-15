## Objectif
Aligner toute la page **Analytics → Finances** (Uber Eats) sur le découpage **UTC** utilisé par les CSV Uber, pour que la table Rentabilité ET le graphique journalier matchent exactement les chiffres du rapport Uber (commande par commande, jour par jour).

## Contexte
Aujourd'hui les RPC agrègent par jour calendaire **Europe/Paris** : les commandes passées entre 00h-01h Paris (= jour précédent UTC chez Uber) sont reclassées au jour Paris. Résultat : pour le 5 fév 2026 Reims, 94 cmd / 591,31 € côté app vs **95 cmd / 614,69 € côté CSV**.

## Périmètre (validé)
- ✅ `get_orders_finance_detail` (table Rentabilité — drilldown mois)
- ✅ `get_orders_finance_yearly_detail` (table Rentabilité — vue année)
- ✅ `get_profitability_daily` (graphique CA / Versement journalier)
- ❌ Hors scope : Overview, Operations, Marketing, Avis, exports PDF, RPC `get_network_*` → restent en Paris

## Plan technique

### 1. Migration SQL — 3 fonctions
Pour chaque RPC ci-dessus, remplacer dans le `RETURN`/`SELECT` et le `WHERE` :

| Avant (Paris) | Après (UTC) |
|---|---|
| `(o.order_datetime AT TIME ZONE 'Europe/Paris')::date` | `(o.order_datetime AT TIME ZONE 'UTC')::date` |
| `make_timestamptz(p_year, p_month, 1, 0,0,0, 'Europe/Paris')` | `make_timestamptz(p_year, p_month, 1, 0,0,0, 'UTC')` |
| `(p_start_date::timestamp AT TIME ZONE 'Europe/Paris')` | `(p_start_date::timestamp AT TIME ZONE 'UTC')` |
| `GROUP BY ... AT TIME ZONE 'Europe/Paris'` | `GROUP BY ... AT TIME ZONE 'UTC'` |

Le reste des fonctions (colonnes, RLS, signatures) est **inchangé** → pas de mise à jour des hooks ni des types TS nécessaire.

### 2. UI — bandeau d'info
Ajouter une mention discrète sous le titre de la section Finances :

> *📅 Découpage journalier en UTC pour correspondre au rapport CSV Uber Eats. Les autres écrans (Overview, Operations…) utilisent l'heure de Paris.*

Fichier : `src/components/analytics/FinancesSection.tsx` (juste avant la première sous-section).

### 3. Mémoire projet
- Ajouter `mem://analytics/finances-utc-decoupage` documentant la dérogation au standard "Paris" pour ces 3 RPC.
- Mettre à jour la note `mem://analytics/finances-frais-source-orders` pour mentionner le passage en UTC.

## Validation
Après migration, vérifier sur Reims 2026-02-05 :
- Table : 95 cmd, frais Uber TTC = -614,69 € (vs CSV utilisateur : 95 cmd / 614,45 €) ✅
- Graphique : barre du 5 fév doit refléter le nouveau total

## Notes
- Aucune perte de données, pas de backfill nécessaire — les `order_datetime` restent en `timestamptz`, on change juste l'agrégation.
- Le cache React Query se rafraîchit automatiquement (clé inchangée mais payload différent → un hard refresh peut être utile).
- L'écart d'1h heure d'été/hiver fait que sur les nuits de changement d'heure (mars/octobre) certaines commandes glisseront différemment — c'est attendu.
