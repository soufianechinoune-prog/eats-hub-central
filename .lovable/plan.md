## 🎯 Décision actée

**Le CSV Uber Eats devient la SEULE source de vérité pour tous les chiffres financiers** (CA, payouts, commissions, refunds, marketing, eco-contribution, ajustements). L'API Uber Eats reste utilisée uniquement pour afficher du **provisoire** sur le mois en cours, jusqu'à l'arrivée du CSV mensuel.

## Pourquoi

Les CSV "Payment Details" capturent ce que l'API ne donne pas :
- les **remboursements rétroactifs J+10/J+15** (litiges clients)
- les **ajustements quotidiens globaux** sans UUID (publicité, frais Uber)
- les **corrections de TVA / eco-contribution** post-export
- les **lignes négatives compensatoires** étalées sur plusieurs jours

C'est aussi la source utilisée par l'expert-comptable, la compta et la négo Uber → cohérence garantie.

## Plan d'implémentation

### 1. Marquage des données par source
- Ajouter colonne `data_source` (`'csv'` | `'api'`) sur `orders`, `monthly_revenue`, `monthly_fees`, `daily_revenue`, `daily_sales_uber`
- Ajouter `csv_imported_at` sur `monthly_revenue` / `monthly_fees` pour savoir quand le mois a été "figé" par CSV

### 2. Règle de bascule API → CSV
À chaque import de CSV "Payment Details" pour un mois M :
- **Supprimer** toutes les lignes API du mois M (orders, daily_revenue, daily_sales_uber, monthly_*) pour les restaurants concernés
- **Insérer** les lignes CSV
- Marquer `monthly_revenue.csv_imported_at = now()`

### 3. UI Overview / Finances
- Si mois courant **sans CSV** → badge orange **"Provisoire (API)"** + tooltip explicatif
- Si mois **avec CSV** → badge vert **"Définitif (CSV)"** + date d'import
- Si mois **mixte** (transition) → bandeau d'avertissement

### 4. Désactiver les écritures API sur les mois "figés"
- Edge function `uber-sync-orders` (et équivalents) : avant d'écrire, vérifier que `monthly_revenue.csv_imported_at IS NULL` pour ce mois/restaurant
- Si CSV déjà importé → skip silencieusement, ne pas écraser les chiffres comptables

### 5. Bouton manuel "Re-figer le mois depuis CSV"
- Dans la page Imports, pour chaque mois × restaurant, un bouton qui force la suppression des données API et le re-traitement du dernier CSV
- Utile en cas de re-import correctif Uber

### 6. Documentation visuelle
- Ajouter un encart pédagogique sur la page Overview expliquant la règle "API = provisoire / CSV = définitif"
- Mettre à jour la mémoire projet avec cette règle de gouvernance des données

## Ce qui reste piloté par API (inchangé)

| Domaine | Source |
|---|---|
| Statut commande temps réel, downtime live | 🔌 API |
| Avis clients récents | 🔌 API |
| Menu / disponibilité produits | 🔌 API |
| Mois en cours avant CSV (badge "Provisoire") | 🔌 API |

## Détails techniques

```text
Flux mensuel :
  J1-J31    → API alimente orders/daily_revenue (badge "Provisoire (API)")
  ~J35      → CSV "Payment Details" du mois M dispo dans Uber Eats Manager
  Import    → Edge function purge orders du mois M + insert CSV
            → monthly_revenue.csv_imported_at = now()
            → Badge devient "Définitif (CSV)"
  J+15..60  → Si Uber re-publie le CSV (refunds tardifs), bouton "Re-figer"
```

**Tables impactées** : `orders`, `order_items`, `daily_revenue`, `daily_sales_uber`, `monthly_revenue`, `monthly_fees`
**Edge functions impactées** : `parse-payment-report`, `uber-sync-orders` (et toute fonction écrivant dans `orders` depuis l'API)
**Pages UI impactées** : Overview, Finances, Frais, Imports

## Ce qui n'est PAS dans ce plan

- Réconciliation ligne-par-ligne CSV vs DB (sujet déjà traité dans l'audit Argenteuil)
- Refonte du dashboard Avis ou des autres modules non-financiers
- Migration historique des données existantes (à décider après validation du flux sur 1 mois pilote)

## Question ouverte avant implémentation

Veux-tu qu'on **pilote d'abord sur 1 marque (Chicken Street) sur 1 mois** avant de basculer tout le réseau, ou qu'on déploie directement partout ?