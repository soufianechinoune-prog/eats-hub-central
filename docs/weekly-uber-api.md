# API Rapport Hebdomadaire Uber Eats — CS Delivery Performance

Cette API permet de récupérer, de manière programmatique, les mêmes données que celles envoyées chaque semaine dans les rapports Excel/CSV Uber Eats.

Les données sont issues du même agrégateur (`get_weekly_uber_report`) que les exports XLSX/CSV, garantissant une cohérence 1:1.

---

## 🔑 Authentification

Toutes les requêtes doivent contenir l'en-tête HTTP :

```
x-api-key: <votre clé>
```

- Une clé API est **liée à une seule marque** (chain).
- La clé est **révocable à tout moment** depuis le panneau d'administration.
- **Ne partagez jamais votre clé publiquement.**

Alternatives acceptées (utiliser une seule des trois) :
- Header `x-api-key: <clé>`
- Header `Authorization: ApiKey <clé>`
- Query string `?api_key=<clé>` (à éviter, la clé apparaît dans les logs)

---

## 🌐 Endpoint

```
GET https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api
```

Format de réponse : `application/json` (UTF-8).

---

## 📋 Paramètres

| Paramètre     | Description                                                                 | Exemple                       |
|---------------|-----------------------------------------------------------------------------|-------------------------------|
| `list`        | Si `1` → retourne la liste de toutes les semaines disponibles avec totaux.  | `?list=1`                     |
| `weekStart`   | Date de début de semaine (lundi, format `YYYY-MM-DD`). Retourne cette semaine. | `?weekStart=2026-06-29`       |
| `weekEnd`     | Optionnel avec `weekStart`. Par défaut `weekStart + 6 jours`.               | `?weekEnd=2026-07-05`         |
| `from` / `to` | Plage de semaines (basée sur `week_start`).                                 | `?from=2026-01-01&to=2026-06-30` |
| `granularity` | Niveau de détail. `network`, `by_day`, `by_restaurant`, `by_day_restaurant`, `all` (défaut). | `?granularity=by_restaurant`  |

**Comportement par défaut** (aucun paramètre) : dernière semaine générée disponible, toutes granularités.

---

## 🔁 Cas d'usage

### 1. Lister toutes les semaines disponibles

```bash
curl -H "x-api-key: cs_xxx" \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?list=1"
```

**Réponse :**
```json
{
  "chain": { "id": "uuid", "name": "TASTY CROUSTY" },
  "weeks": [
    {
      "weekStart": "2026-06-29",
      "weekEnd": "2026-07-05",
      "status": "ready",
      "updatedAt": "2026-07-06T08:12:34Z",
      "totals": {
        "ca_brut_ttc": 128450.12,
        "ca_brut_ht": 116772.83,
        "ca_net_ht": 89234.55,
        "ca_net_ttc": 98157.99,
        "commission_uber": 22456.78,
        "marketing_fee": 3120.44,
        "service_fee": 852.10,
        "orders_count": 5342,
        "payout_total": 96011.23
      }
    }
  ]
}
```

### 2. Récupérer une semaine précise

```bash
curl -H "x-api-key: cs_xxx" \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?weekStart=2026-06-29"
```

### 3. Récupérer une plage (ex : tout le premier semestre)

```bash
curl -H "x-api-key: cs_xxx" \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?from=2026-01-01&to=2026-06-30&granularity=by_day_restaurant"
```

### 4. Uniquement les totaux réseau

```bash
curl -H "x-api-key: cs_xxx" \
  "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?weekStart=2026-06-29&granularity=network"
```

---

## 📦 Structure de la réponse (détail)

```json
{
  "chain": { "id": "uuid", "name": "TASTY CROUSTY" },
  "weeks": [
    {
      "weekStart": "2026-06-29",
      "weekEnd": "2026-07-05",
      "network": {
        "ca_brut_ttc": 128450.12,
        "ca_brut_ht": 116772.83,
        "ca_net_ht": 89234.55,
        "ca_net_ttc": 98157.99,
        "commission_uber": 22456.78,
        "marketing_fee": 3120.44,
        "service_fee": 852.10,
        "orders_count": 5342,
        "payout_total": 96011.23
      },
      "byDay": [
        { "date": "2026-06-29", "ca_brut_ttc": 18200.5, "orders_count": 742, "...": "..." }
      ],
      "byRestaurant": [
        { "restaurant_id": "uuid", "restaurant_name": "Tasty Crousty Paris 15", "ca_brut_ttc": 12450.3, "...": "..." }
      ],
      "byDayRestaurant": [
        { "date": "2026-06-29", "restaurant_id": "uuid", "restaurant_name": "...", "ca_brut_ttc": 1780.2, "...": "..." }
      ]
    }
  ]
}
```

### Champs financiers (montants en euros)

| Champ              | Description                                         |
|--------------------|-----------------------------------------------------|
| `ca_brut_ttc`      | CA brut TTC (avant commissions Uber)                |
| `ca_brut_ht`       | CA brut HT                                          |
| `ca_net_ht`        | CA net HT après commissions Uber                    |
| `ca_net_ttc`       | CA net TTC après commissions Uber                   |
| `commission_uber`  | Commission Uber Eats                                |
| `marketing_fee`    | Frais marketing (co-financement)                    |
| `service_fee`      | Frais de service (Gold, etc.)                       |
| `orders_count`     | Nombre de commandes livrées                         |
| `payout_total`     | Versement total Uber (net_payout + titres-restaurant) |

Tous les montants sont en **euros (EUR)**, arrondis à 2 décimales.
Toutes les dates sont en **timezone Europe/Paris**.

---

## ⚠️ Codes d'erreur

| Statut | Cas                                                  |
|--------|------------------------------------------------------|
| `200`  | OK                                                   |
| `401`  | Clé manquante, invalide ou révoquée                  |
| `405`  | Méthode HTTP non supportée (utilisez uniquement `GET`) |
| `500`  | Erreur serveur (voir champ `error` dans la réponse)  |

Exemple de réponse d'erreur :
```json
{ "error": "invalid api key" }
```

---

## 🛠 Intégration Power BI / Excel

**Power Query (Power BI ou Excel)** :

```m
let
    url = "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api?granularity=by_day_restaurant",
    source = Json.Document(Web.Contents(url, [
        Headers = [#"x-api-key" = "cs_votre_cle_ici"]
    ]))
in
    source
```

**Python (pandas)** :

```python
import requests, pandas as pd

r = requests.get(
    "https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api",
    params={"from": "2026-01-01", "to": "2026-06-30", "granularity": "by_day_restaurant"},
    headers={"x-api-key": "cs_votre_cle_ici"},
)
data = r.json()
rows = [row for w in data["weeks"] for row in w["byDayRestaurant"]]
df = pd.DataFrame(rows)
```

---

## 📞 Support

En cas de problème (clé perdue, erreur inattendue, besoin de rotation), contactez l'équipe CS Delivery Performance.
