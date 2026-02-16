

# Deux corrections pour Eco-Contribution

## Probleme 1 : Selecteur d'annee

Actuellement, l'annee est affichee dans un badge statique "2025". L'utilisateur souhaite pouvoir basculer entre 2025 et 2026 directement depuis la page, sans passer par le calendrier global.

### Solution

Modifier `EcoContributionSection.tsx` pour remplacer le badge statique par deux boutons cliquables (2025 / 2026). Le bouton actif sera mis en surbrillance, l'autre sera en style outline. Le composant gerera sa propre annee localement (avec `selectedYear` comme valeur initiale).

```text
Avant :  [Leaf icon] Eco-Contribution  [2025]
Apres :  [Leaf icon] Eco-Contribution  [2025] [2026]   (boutons toggle)
```

## Probleme 2 : Detail lignes vide (0 lignes)

La table `payout_adjustments` a une politique RLS qui exige le role `authenticated`, mais l'application utilise la cle `anon` (pas d'authentification). La table `payouts`, elle, a une politique `public` -- c'est pourquoi les KPI et le graphique fonctionnent, mais pas le detail.

### Solution

Ajouter une politique RLS publique en lecture sur `payout_adjustments` (identique a celle de `payouts`) pour permettre l'acces en lecture sans authentification.

```text
CREATE POLICY "Allow public read on payout_adjustments"
  ON public.payout_adjustments
  FOR SELECT
  USING (true);
```

Cela alignera le comportement avec les autres tables du projet qui utilisent des politiques publiques.

## Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `src/components/analytics/EcoContributionSection.tsx` | Ajouter les boutons 2025/2026 dans le header |
| Migration SQL | Ajouter politique RLS publique sur payout_adjustments |

## Resultat attendu

- Deux boutons d'annee cliquables dans le header de la page
- Le tableau "Detail lignes" affichera les 51 lignes pour Chicken Street - Angers (et les 1881 lignes en mode Reseau)
