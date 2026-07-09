# API Rapport Hebdomadaire Uber Eats — CS Delivery Performance

**Base URL**
```
https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api
```

**Principe** : cette API renvoie **uniquement des données brutes issues des CSV Uber Eats** (rapport `PAYMENT_DETAILS_REPORT`). Aucune valeur n'est recalculée, retraitée ou pondérée côté CS Delivery Performance. Ce sont des sommes agrégées (jour / restaurant / réseau) des colonnes originales Uber.

---

## 🔑 Authentification

Une clé API par marque (chaîne). À transmettre dans l'entête :

```
x-api-key: cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Alternatives acceptées :
- Header `Authorization: ApiKey cs_...`
- Query string `?api_key=cs_...`

---

## 🌐 Endpoint unique

```
GET /weekly-uber-api
```

### Paramètres

| Paramètre | Type | Description |
|---|---|---|
| `list` | `1` | Liste toutes les semaines disponibles avec leurs totaux réseau |
| `weekStart` | `YYYY-MM-DD` | Renvoie une semaine précise (lundi) |
| `weekEnd` | `YYYY-MM-DD` | Fin de semaine (facultatif, défaut `weekStart + 6j`) |
| `from` / `to` | `YYYY-MM-DD` | Renvoie toutes les semaines dont le lundi ∈ [from, to] |
| `granularity` | `all` (défaut) / `network` / `by_day` / `by_restaurant` / `by_day_restaurant` | Niveau de détail |

Sans paramètre de date : renvoie **la dernière semaine disponible**.

---

## 🔁 Exemples

**Lister toutes les semaines**
```bash
curl -H "x-api-key: cs_..." \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?list=1"
```

**Une semaine précise**
```bash
curl -H "x-api-key: cs_..." \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?weekStart=2025-06-30"
```

**Plage de semaines**
```bash
curl -H "x-api-key: cs_..." \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?from=2025-01-01&to=2025-06-30"
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
  "chain": { "id": "…", "name": "Chicken Street" },
  "weeks": [
    {
      "weekStart": "2025-06-30",
      "weekEnd": "2025-07-06",
      "network": {
        "ca_brut_ttc": 0,
        "ca_brut_ht": 0,
        "commission_uber": 0,
        "marketing_fee": 0,
        "service_fee": 0,
        "payout_total": 0
      },
      "byDay": [ { "local_date": "2025-06-30", "ca_brut_ttc": 0, "…": 0 } ],
      "byRestaurant": [ { "restaurant_id": "…", "restaurant_name": "…", "ca_brut_ttc": 0, "…": 0 } ],
      "byDayRestaurant": [ { "local_date": "…", "restaurant_id": "…", "restaurant_name": "…", "ca_brut_ttc": 0, "…": 0 } ]
    }
  ]
}
```

### Champs financiers renvoyés (100 % bruts Uber)

| Champ API | Colonne CSV Uber d'origine | Description |
|---|---|---|
| `ca_brut_ttc` | `sales_incl_vat` | CA brut TTC (avant commission Uber) |
| `ca_brut_ht` | `sales_excl_vat` | CA brut HT |
| `commission_uber` | `uber_fee_after_promo_incl_vat` | Frais/commission Uber TTC |
| `marketing_fee` | `marketing_fee_adjustment` | Frais marketing / co-financement Uber |
| `service_fee` | `service_fee` | Frais de service Uber |
| `payout_total` | `net_payout` + `meal_voucher_amount` | Versement total reçu (net payout + titres restaurant) |

> Ce sont uniquement les sommes des colonnes brutes du CSV Uber. Aucun calcul métier CS n'est appliqué.

---

## ⚠️ Codes d'erreur

| HTTP | Cause |
|---|---|
| 401 | Clé API manquante, invalide, ou révoquée |
| 405 | Méthode HTTP ≠ GET |
| 500 | Erreur interne |

---

## 🛠 Intégration Power BI (Power Query M)

```m
let
  Source = Json.Document(Web.Contents(
    "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api",
    [ Headers = [ #"x-api-key" = "cs_..." ],
      Query   = [ from = "2025-01-01", to = "2025-12-31", granularity = "by_restaurant" ] ]
  ))
in
  Source
```

## 🐍 Intégration Python

```python
import requests, pandas as pd
r = requests.get(
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api",
  headers={"x-api-key": "cs_..."},
  params={"from": "2025-01-01", "to": "2025-12-31"},
)
data = r.json()
rows = [row for w in data["weeks"] for row in w["byRestaurant"]]
df = pd.DataFrame(rows)
```
