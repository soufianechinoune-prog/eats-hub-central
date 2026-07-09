# API Rapport Hebdomadaire Uber Eats — CS Delivery Performance

**Base URL**
```
https://akcicojkrzeirffefdet.supabase.co/functions/v1/weekly-uber-api
```

**Principe** : cette API renvoie **uniquement des valeurs brutes issues des CSV Uber Eats** (rapport `PAYMENT_DETAILS_REPORT`). Chaque champ correspond exactement à une colonne du CSV, agrégée par somme (jour / restaurant / réseau). **Aucun calcul, aucune addition, aucune pondération** n'est effectué côté CS Delivery Performance.

- **Devise** : EUR (toutes les valeurs monétaires).
- **Fuseau horaire** : les dates (`local_date`, `weekStart`, `weekEnd`) sont exprimées en heure locale de Paris (`Europe/Paris`).
- **Périmètre** : commandes Uber Eats hors annulées.

---

## 🔑 Authentification

Une clé API par marque (chaîne). À transmettre **exclusivement** dans l'entête HTTP :

```
x-api-key: cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Alternative acceptée : `Authorization: ApiKey cs_...`

> ⚠️ La transmission de la clé via query string (`?api_key=...`) est **fortement déconseillée** (fuite possible dans les logs serveur, l'historique navigateur et les proxys). À réserver au debug ponctuel.

**Rotation / révocation** : en cas de fuite suspectée, contacter immédiatement le support CS Delivery Performance. Une nouvelle clé sera émise et l'ancienne révoquée dans la foulée.

---

## 🌐 Endpoint unique

```
GET /weekly-uber-api
```

### Paramètres

| Paramètre | Type | Description |
|---|---|---|
| `list` | `1` | Liste toutes les semaines disponibles avec leurs totaux réseau |
| `weekStart` | `YYYY-MM-DD` | Renvoie une semaine précise (**doit être un lundi**) |
| `weekEnd` | `YYYY-MM-DD` | Fin de semaine (facultatif, défaut `weekStart + 6j`) |
| `from` / `to` | `YYYY-MM-DD` | Renvoie toutes les semaines dont le lundi ∈ [from, to] |
| `granularity` | `all` (défaut) / `network` / `by_day` / `by_restaurant` / `by_day_restaurant` | Niveau de détail |

Sans paramètre de date : renvoie **la dernière semaine disponible**.

### Fraîcheur des données

Les rapports hebdomadaires sont générés automatiquement chaque **mardi matin** (Europe/Paris) pour la semaine précédente (lundi → dimanche), après réception du CSV `PAYMENT_DETAILS_REPORT` publié par Uber Eats en J+1/J+2. Une semaine est donc typiquement disponible à partir du **mardi 8h00 Paris** suivant sa clôture.

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
  "chain": { "id": "b1e0…-…-…", "name": "Chicken Street" },
  "weeks": [
    {
      "weekStart": "2025-06-30",
      "weekEnd": "2025-07-06",
      "network": {
        "ca_brut_ttc": 187432.50,
        "ca_brut_ht": 170393.18,
        "commission_uber": -50607.78,
        "marketing_fee": -4218.12,
        "service_fee": 3891.44,
        "net_payout": 128715.23,
        "meal_voucher_amount": 4102.87
      },
      "byDay": [
        { "local_date": "2025-06-30", "ca_brut_ttc": 24518.90, "ca_brut_ht": 22289.91, "commission_uber": -6620.10, "marketing_fee": -540.20, "service_fee": 509.28, "net_payout": 16847.12, "meal_voucher_amount": 512.30 }
      ],
      "byRestaurant": [
        { "restaurant_id": "a3b1c4d5-…", "restaurant_name": "Chicken Street Paris 11",   "ca_brut_ttc": 12480.30, "ca_brut_ht": 11345.72, "commission_uber": -3369.68, "marketing_fee": -281.44, "service_fee": 259.35, "net_payout": 8571.10, "meal_voucher_amount": 278.42 },
        { "restaurant_id": "f7e2a1b8-…", "restaurant_name": "Chicken Street Lyon Part-Dieu", "ca_brut_ttc": 10982.60, "ca_brut_ht": 9984.18,  "commission_uber": -2965.30, "marketing_fee": -247.80, "service_fee": 228.20, "net_payout": 7542.90, "meal_voucher_amount": 244.65 }
      ],
      "byDayRestaurant": [ /* même schéma, une ligne par (jour, restaurant) */ ]
    }
  ]
}
```

### Champs financiers renvoyés (100 % bruts Uber)

| Champ API | Colonne CSV Uber d'origine | Signe attendu | Description |
|---|---|---|---|
| `ca_brut_ttc` | `sales_incl_vat` | ≥ 0 | CA brut TTC (avant commission Uber) |
| `ca_brut_ht` | `sales_excl_vat` | ≥ 0 | CA brut HT |
| `commission_uber` | `uber_fee_after_promo_incl_vat` | **≤ 0 (négatif)** | Frais/commission Uber TTC prélevés |
| `marketing_fee` | `marketing_fee_adjustment` | **≤ 0 (négatif)** | Frais marketing / co-financement Uber |
| `service_fee` | `service_fee` | ≥ 0 | Frais de service Uber |
| `net_payout` | `net_payout` | ≥ 0 | Versement net Uber (hors titres restaurant) |
| `meal_voucher_amount` | `meal_voucher_amount` | ≥ 0 | Montant titres restaurant |

> 🔐 **Aucun autre champ n'est renvoyé et aucun calcul n'est fait côté CS.** Ce sont strictement les sommes des colonnes brutes du CSV Uber. Pas de CA net, pas de taux de commission, pas d'agrégat métier, pas de nombre de commandes, pas d'addition de champs.
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
