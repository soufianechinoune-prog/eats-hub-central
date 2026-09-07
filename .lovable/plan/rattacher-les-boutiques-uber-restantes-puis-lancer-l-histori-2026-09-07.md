# Rattacher les boutiques Uber restantes, puis lancer l'historique juin → août

## Étape 1 — Rattachements sur des fiches existantes (vides aujourd'hui)

| Boutique Uber (mail) | Fiche existante | Note |
|---|---|---|
| Champs sur Marne (CS) | Chicken Street - Champs sur Marne | fiche sans identifiant |
| Drancy (CS) | Chicken Street - Drancy | fiche sans identifiant |
| Sevran (CS) | Chicken Street - Sevran | fiche sans identifiant |
| Evreux (TC) | TASTY CROUSTY EVREUX | fiche sans identifiant |
| Les Pavillons-sous-Bois (TC) | TASTY CROUSTY LES PAVILLONS SOUS BOIS | fiche sans identifiant |
| Mantes la Ville (TC) | TASTY CROUSTY MANTES LA VILLE | fiche sans identifiant |
| Montargis (TC) | TASTY CROUSTY MONTARGIS | fiche sans identifiant |
| Mulhouse (TC) | TASTY CROUSTY MULHOUSE | fiche sans identifiant |
| Nice (TC) | TASTY CROUSTY NICE | fiche sans identifiant |
| Nîmes (TC) | TASTY CROUSTY NÎMES | fiche sans identifiant |
| Toulon (TC) | TASTY CROUSTY TOULON | fiche sans identifiant |
| Lyon Part Dieu (TC) | TASTY CROUSTY LYON PARDIEU | fiche inactive → à réactiver à l'ouverture |

## Étape 2 — Corriger le doublon Garges / Pontault

Vérifié en base : l'identifiant `076ab060…` est actuellement présent **deux fois**, sur
« TASTY CROUSTY GARGES-LES-GONESSE » et sur « TASTY CROUSTY PONTAULT COMBAULT ».
Le mail Uber donne un identifiant distinct pour Garges (`d3651911…`).

Correction proposée : Garges reçoit `d3651911…`, Pontault Combault conserve `076ab060…`.
À confirmer de ton côté (c'est la seule hypothèse que je n'ai pas pu trancher en base).

## Étape 3 — Créer les fiches manquantes

Aucune correspondance trouvée en base pour : **Colombier, Poitiers, Tarbes, Pau,
Salon de Provence** (enseigne Tasty Crousty). Création de 5 fiches avec nom, ville et
identifiant Uber. Pau et Salon de Provence sont annoncés « en ouverture » : elles seront
créées mais marquées inactives jusqu'à leur ouverture.

## Étape 4 — Contrôle avant import

Après rattachement : vérifier qu'aucun identifiant n'est présent deux fois et que chaque
boutique du mail pointe vers une seule fiche. Puis test d'autorisation Uber boutique par
boutique (2 secondes d'écart, aucune mise en file) pour savoir lesquelles répondent OK.

## Étape 5 — Historique juin → août

Uniquement pour les boutiques qui passent le test : mise en file des rapports hebdomadaires
juin → août en **priorité basse**, au débit lent déjà en place, pour ne pas déclencher de
blocage Uber. Les boutiques encore refusées seront listées nominativement pour relance
auprès de Sanjay.

## Détails techniques

- Étapes 1-3 : `UPDATE`/`INSERT` sur `restaurants` (`uber_store_id`, `chain_id`, `city`,
  `is_active`) + insertion des liaisons dans `restaurant_uber_ids` (`is_primary = true`,
  label `principal`), avec gardes anti-doublon.
- Étape 4 : `uber-authorize-audit` avec `delayMs: 2000`, `reenqueue: false`.
- Étape 5 : `uber-authorize-audit` avec `reenqueue: true`, fenêtres hebdo juin → août,
  `vague = 1200` (priorité basse), ~2 jobs/tick, frein 429 conservé.
- Aucune modification des règles de calcul ni des parseurs.
