# Plan — Overview simplifié : 2 chiffres factuels uniquement

## Principe (ta règle)

L'Overview doit afficher **uniquement 2 chiffres bruts et vérifiables** :

1. **CA TTC** = somme des `orders.gross_amount` sur la période
2. **Versement** = `SUM(net_payout) + SUM(meal_voucher_amount)` = ce qui arrive **réellement sur le compte bancaire**

**Pas de déductions** d'eco-contribution, ads, marketing, ajustements, etc. dans l'Overview. Ces analyses fines iront dans les onglets dédiés (Finances, Frais, Profitabilité…).

---

## État actuel vs attendu (Argenteuil février 2026)

| | Overview actuel | Cible (= règle simple) | OK ? |
|---|---:|---:|---|
| CA TTC | 57 637 € | `SUM(gross_amount)` = **57 637,42 €** | ✅ déjà bon |
| Versement | 35 069 € | `SUM(net_payout) + SUM(meal_voucher_amount)` = 29 542,56 + 5 526,57 = **35 069,13 €** | ✅ déjà bon |

→ **L'Overview est déjà aligné sur ta règle.** Les "écarts" qu'on cherchait à expliquer venaient d'une comparaison avec des chiffres Uber Manager qui, eux, intègrent déjà les déductions (ads, ajustements). C'est normal.

---

## Ce qu'il faut faire

### 1. Confirmer / clarifier l'affichage Overview
- Le bloc "Versement" doit afficher **35 069 €** (= ce qui tombe en banque) — c'est déjà le cas ✅
- Le bloc "CA" doit afficher **57 637 €** — c'est déjà le cas ✅
- Vérifier les libellés / tooltips pour qu'ils disent explicitement :
  - **CA TTC** : "Chiffre d'affaires brut TTC, toutes commandes confondues"
  - **Versement** : "Net versé sur compte bancaire (payout Uber + titres-restaurant)"

### 2. Nettoyer ce qui pourrait fausser ces 2 chiffres
- Vérifier que `meal_voucher_amount` ne contient pas de pollution (la +19,98 € d'eco-contribution doublée identifiée précédemment) — **fix parser** pour que `meal_voucher_amount` = uniquement vrais TR
- Après fix : le "Versement" passera de 35 069,13 € à **35 049,15 €** (chiffre 100% propre)

### 3. Déplacer toutes les analyses fines dans les autres onglets
- Eco-contribution, ads, ajustements, marketing co-financing → onglets **Finances** / **Frais** / **Profitabilité**
- L'Overview reste **un tableau de bord factuel**, pas un tableau comptable

---

## Étapes

1. **Fix parser** (`parse-payment-report`) : ne plus ajouter l'eco-contribution dans `meal_voucher_amount`
2. **Réimporter février Argenteuil** pour valider que `meal_voucher_amount` = 5 519,44 € (au lieu de 5 526,57 €)
3. **Vérifier les libellés** des cartes Overview (CA + Versement) pour qu'ils soient sans ambiguïté
4. **Passer aux autres mois** (janvier 2026, décembre 2025, …) avec la même logique

---

## Question

Tu valides cette logique ? Si oui, je commence par **l'étape 1 (fix parser)** + on relance février pour avoir des chiffres 100% propres.
