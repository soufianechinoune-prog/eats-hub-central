# API Rapport Hebdomadaire Uber Eats — CS Delivery Performance

**Base URL**
```
https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api
```

---

## 📚 Principe & source des données

Cette API renvoie **uniquement des valeurs brutes** issues du rapport officiel Uber Eats **`PAYMENT_DETAILS_REPORT`**. Chaque champ correspond exactement à une colonne du rapport Uber, agrégée par somme (jour / restaurant / réseau). **Aucun calcul, aucune addition, aucune pondération** n'est effectué côté CS Delivery Performance.

**Pipeline d'alimentation** :

1. CS Delivery Performance déclenche automatiquement chaque nuit la génération du rapport `PAYMENT_DETAILS_REPORT` auprès de l'**API Reports d'Uber Eats**.
2. Le CSV généré par Uber est téléchargé, parsé, et chaque commande est stockée telle quelle en base (colonnes brutes du CSV).
3. Une fenêtre glissante de **4 jours (J-4 → J-1)** est re-scannée quotidiennement : les commandes existantes sont mises à jour en place (`UPSERT` sur `uber_order_id`), ce qui capture les **ajustements Uber rétroactifs** (remboursements, contestations, corrections) publiés dans ce délai.

> ⚠️ **Fenêtre de révision** : les ajustements Uber publiés **plus de 4 jours après la commande d'origine** ne sont pas repris automatiquement. Les chiffres d'une semaine sont donc stables à partir de **~J+5 à J+7** après la fin de semaine. Un rafraîchissement manuel plus profond peut être demandé au support si Uber publie un ajustement tardif.

- **Devise** : EUR (toutes les valeurs monétaires).
- **Fuseau horaire** : `local_date`, `weekStart`, `weekEnd` sont exprimés en heure locale de Paris (`Europe/Paris`).
- **Périmètre** : commandes Uber Eats dont le statut ne contient pas `cancel` (exclut donc les annulations restaurant et livreur). Les **remboursements partiels et contestations** sont conservés dans les commandes correspondantes (ils viennent moduler `net_payout` et les frais Uber au sein des mêmes lignes).

### Fraîcheur

L'import est automatisé par un cron quotidien qui se déclenche à **5h UTC** (soit 6h Paris en hiver, 7h Paris en été). Uber publie généralement les données de J-1 dans la nuit ; en pratique **les données d'une semaine sont interrogeables via l'API dès le lundi matin** suivant sa clôture (J+1 après le dimanche), avec révision jusqu'à J+4.

---

## 🔑 Authentification

Une clé API par marque (chaîne). À transmettre dans l'entête HTTP :

```
x-api-key: cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Alternative acceptée : `Authorization: ApiKey cs_...`

> La transmission via query string (`?api_key=...`) n'est **pas acceptée** par l'API — elle produirait une fuite dans les logs serveur et l'historique navigateur.

**Rotation / révocation** : en cas de fuite suspectée, contacter immédiatement le support CS Delivery Performance. Une nouvelle clé sera émise et l'ancienne révoquée dans la foulée.

---

## 🌐 Endpoint unique

```
GET /weekly-uber-api
```

### Paramètres

| Paramètre | Type | Description |
|---|---|---|
| `list` | `1` | Liste toutes les semaines disponibles avec leurs totaux réseau (calcul live) |
| `weekStart` | `YYYY-MM-DD` | Renvoie une semaine précise (**doit être un lundi**) |
| `weekEnd` | `YYYY-MM-DD` | Fin de semaine (facultatif, défaut `weekStart + 6j`) |
| `from` / `to` | `YYYY-MM-DD` | Renvoie toutes les semaines dont le lundi ∈ [from, to] |
| `granularity` | `all` (défaut) / `network` / `by_day` / `by_restaurant` / `by_day_restaurant` | Niveau de détail |

Sans paramètre de date : renvoie **la dernière semaine disponible**.

> **Cohérence** : `list=1`, `weekStart` et `from/to` passent tous par le **même calcul live** sur les commandes de la base. Les totaux ne peuvent pas diverger entre ces trois chemins pour une même semaine.

### Volumétrie & pagination

- **Aucune pagination** : la réponse est toujours renvoyée en un seul appel JSON.
- Pour les gros historiques avec `granularity=by_day_restaurant`, préférer des plages de **3 mois maximum** (au-delà, la réponse peut peser plusieurs Mo et ralentir Power BI).
- Aucun rate limit strict n'est appliqué à ce jour, mais éviter les rafales de requêtes parallèles (< 5 requêtes concurrentes recommandé).

---

## 🔁 Exemples

**Lister toutes les semaines disponibles**
```bash
curl -H "x-api-key: cs_..." \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?list=1"
```

**Une semaine précise**
```bash
curl -H "x-api-key: cs_..." \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?weekStart=2025-06-30"
```

**Plage de semaines (recommandé : ≤ 3 mois pour by_day_restaurant)**
```bash
curl -H "x-api-key: cs_..." \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?from=2025-04-01&to=2025-06-30&granularity=by_restaurant"
```

**Uniquement le total réseau**
```bash
curl -H "x-api-key: cs_..." \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?weekStart=2025-06-30&granularity=network"
```

---

## 📦 Structure de la réponse

```json
{
  "chain": { "id": "b1e0…-…-…", "name": "Chicken Street" },
  "weeks": [
    {
      "weekStart": "2025-06-30",
      "weekEnd": "2025-07-06",
      "network": {
        "ca_brut_ttc": 187432.50,
        "ca_brut_ht": 170393.18,
        "commission_uber": -50607.78,
        "commission_uber_ht": -42173.15,
        "marketing_fee": -4218.12,
        "net_payout": 128715.23,
        "meal_voucher_amount": 4102.87
      },
      "byDay": [
        { "local_date": "2025-06-30", "ca_brut_ttc": 24518.90, "ca_brut_ht": 22289.91, "commission_uber": -6620.10, "commission_uber_ht": -5516.75, "marketing_fee": -540.20, "net_payout": 16847.12, "meal_voucher_amount": 512.30 }
      ],
      "byRestaurant": [
        { "restaurant_id": "a3b1c4d5-…", "restaurant_name": "Chicken Street Paris 11",     "ca_brut_ttc": 12480.30, "ca_brut_ht": 11345.72, "commission_uber": -3369.68, "commission_uber_ht": -2808.07, "marketing_fee": -281.44, "net_payout": 8571.10, "meal_voucher_amount": 278.42 },
        { "restaurant_id": "f7e2a1b8-…", "restaurant_name": "Chicken Street Lyon Part-Dieu", "ca_brut_ttc": 10982.60, "ca_brut_ht": 9984.18,  "commission_uber": -2965.30, "commission_uber_ht": -2471.08, "marketing_fee": -247.80, "net_payout": 7542.90, "meal_voucher_amount": 244.65 }
      ],
      "byDayRestaurant": [ /* même schéma, une ligne par (jour, restaurant) */ ]
    }
  ]
}
```

### Champs financiers renvoyés (100 % bruts Uber)

| Champ API | Colonne CSV Uber d'origine | Signe attendu | Description |
|---|---|---|---|
| `ca_brut_ttc` | `Sales (incl. VAT)` | ≥ 0 | CA brut TTC (avant commission Uber) |
| `ca_brut_ht` | `Sales (excl. VAT)` | ≥ 0 | CA brut HT |
| `commission_uber` | `Marketplace Fee after discount (incl VAT)` | **≤ 0 (négatif)** | Commission Uber **TTC** prélevée (frais de service marketplace après promotion, TVA incluse) |
| `commission_uber_ht` | `Uber Service Fee after discount (excluding VAT)` | **≤ 0 (négatif)** | Commission Uber **HT** prélevée (frais de service marketplace après promotion, hors TVA) |
| `marketing_fee` | `Marketing Adjustment (incl. VAT)` | **≤ 0 (négatif)** | Ajustement des frais marketing / co-financement Uber (0 si aucune campagne co-financée sur la période) |
| `net_payout` | `Total payout` | ≥ 0 | Versement net Uber (hors titres restaurant) |
| `meal_voucher_amount` | `Meal Voucher` | ≥ 0 | Montant titres restaurant |

> 🔐 **Aucun autre champ n'est renvoyé et aucun calcul n'est fait côté CS.** Ce sont strictement les sommes des colonnes brutes du CSV Uber. Pas de CA net, pas de taux de commission, pas d'agrégat métier, pas de nombre de commandes, pas d'addition de champs.
>
> ℹ️ **Commission Uber HT vs TTC** : le rapport `PAYMENT_DETAILS_REPORT` publie la commission de marketplace **à la fois hors taxes** (`Uber Service Fee after discount (excluding VAT)`) **et toutes taxes comprises** (`Marketplace Fee after discount (incl VAT)`). Les deux valeurs sont exposées telles quelles, sans recalcul. **L'API n'affirme aucun régime TVA** : le traitement comptable relève de la comptabilité sur la base des factures Uber.
>
> Pour obtenir le versement total Uber, additionnez côté BI : `net_payout + meal_voucher_amount`.

### Champ `restaurant_id`

Il s'agit de l'**UUID interne CS Delivery Performance** (clé primaire de la table `restaurants`). Ce n'est **pas** le Store UUID Uber Eats Manager. Un mapping `restaurant_id CS ⇄ Uber Store UUID` peut être fourni sur demande pour croiser les données avec l'interface Uber.

---

## ⚠️ Codes d'erreur

| HTTP | Cause |
|---|---|
| 400 | Paramètre invalide (ex. `weekStart` mal formé, plage inversée) |
| 401 | Clé API manquante, invalide, ou révoquée |
| 405 | Méthode HTTP ≠ GET |
| 500 | Erreur interne |

> Note : si `weekStart` n'est pas un lundi, la requête n'est pas rejetée mais renverra une semaine potentiellement vide ou décalée. **Toujours passer un lundi.**

---

## 🛠 Intégration Power BI (Power Query M)

**Recommandation sécurité** : créer un paramètre Power BI nommé `ApiKey` (Home → Manage Parameters → New) au lieu de coller la clé en dur dans le code M. Cela évite qu'elle traîne dans un `.pbix` partagé ou versionné.

```m
let
    ApiKey = ApiKey,   // référence au paramètre Power BI "ApiKey"
    Source = Json.Document(Web.Contents(
      "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api",
      [ Headers = [ #"x-api-key" = ApiKey ],
        Query   = [ from = "2025-01-01", to = "2025-03-31", granularity = "by_restaurant" ] ]
    ))
in
    Source
```

## 🐍 Intégration Python

```python
import os, requests, pandas as pd

r = requests.get(
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api",
  headers={"x-api-key": os.environ["CS_API_KEY"]},
  params={"from": "2025-01-01", "to": "2025-03-31", "granularity": "by_restaurant"},
)
data = r.json()
rows = [row for w in data["weeks"] for row in w["byRestaurant"]]
df = pd.DataFrame(rows)
```
