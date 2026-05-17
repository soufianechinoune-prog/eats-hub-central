## Objectif

Remplacer les boutons "Backfill 24 mois / historique / tout" qui ratissent tout aveuglément par un **sélecteur de restos avec aperçu du matching**. Tu vois ce que le système croit savoir, tu coches ce que tu veux, et tu lances seulement ces restos-là sur la période choisie.

## Ce qu'on voit aujourd'hui

Sur `/settings/integrations`, carte "Backfill Splash360 résilient" :
- 3 gros boutons qui enqueue d'office **les 170 restos Splash de la chain**
- Aucune visibilité sur le matching avant d'appuyer
- Aucun moyen de relancer juste 1 ou 2 restos

## Ce qu'on va construire

### Nouveau bouton "Configurer le backfill"

Remplace les 3 boutons actuels par : **`Configurer un backfill →`** qui ouvre un dialog.

### Dialog "Lancer un backfill Splash360"

**Bloc 1 — Période**
- Date "De" (mois/année) — défaut `2024-05`
- Date "À" (mois/année) — défaut mois courant
- Presets rapides : "24 derniers mois" · "Historique 2021-2024" · "Tout"

**Bloc 2 — Restaurants à backfiller** (le cœur)

Tableau avec checkbox + recherche + filtres "Tout / Mappés / ⚠️ Problèmes" :

```text
☐  Resto Splash                          →  Resto app                    Statut
─────────────────────────────────────────────────────────────────────────────────
☑  #374 CHICKEN STREET AMIENS            →  Chicken Street - Amiens      ✅ OK
☑  #427 CHICKEN STREET ANGERS            →  Chicken Street - Angers      ✅ OK
☑  #528 CHICKEN STREET BORDEAUX          →  Chicken Street Bordeaux      ⚠️ Doublon (aussi #1376)
☑  #1376 CHICKEN STREET BORDEAUX         →  Chicken Street Bordeaux      ⚠️ Doublon (aussi #528)
☑  #813 CHICKEN STREET AVIGNON           →  Chicken Street Avignon Cap Sud  ⚠️ Nom ambigu
☐  #1432 CHICKEN STREET OPARINOR         →  —                            ❌ Non mappé
☐  #1300 CHICKEN STREET DISHOP           →  —                            ❌ Non mappé
...
```

Comportements :
- En-tête : `[☐ Tout] [✅ Mappés uniquement (148)] [⚠️ Problèmes (3)] [❌ Non mappés (22)]`
- Recherche libre sur les 2 noms
- Cliquer sur "Resto app" pour un non-mappé → ouvre un combobox pour **mapper sur place** (recherche dans `restaurants` de la chain). Sauve direct en BDD et le badge passe à ✅.
- Sur un doublon, badge cliquable qui ouvre un menu : "Garder #528, désactiver #1376" (set `restaurant_id = NULL` sur l'autre).
- Par défaut : tous les ✅ OK cochés, ⚠️ cochés mais en jaune, ❌ décochés (et grisés tant que pas mappés).

**Bloc 3 — Récap + lancement**

```text
✓ 148 restos × 24 mois = 3 552 jobs (~12 h)
[Annuler]  [Lancer le backfill]
```

### Carte principale (reste affichée derrière)

- Bouton "Configurer un backfill" au-dessus de la progression
- La liste détaillée des jobs en cours (du plan précédent) reste pertinente : on voit en temps réel les restos en train d'être traités

## Côté technique

**Pas de migration BDD nécessaire** — tout existe déjà :
- `splash360_restaurant_mapping` (splash_id ↔ restaurant_id, splash_name, chain_id)
- `restaurants` (nom app)
- RPC `enqueue_splash_backfill_for_chain` existant → on en ajoute **une variante** qui accepte une liste de `restaurant_splash_id` ciblée

**Nouvelles fonctions SQL (1 migration)**
- `splash_mapping_overview(p_chain_id uuid)` (SECURITY DEFINER) : retourne pour la chain `restaurant_splash_id, splash_name, restaurant_id, restaurant_name, duplicate_of_splash_ids[], is_mapped` (calcul des doublons en SQL via window function).
- `enqueue_splash_backfill_for_restaurants(p_chain_id, p_splash_ids[], p_start_year, p_start_month, p_end_year, p_end_month)` : même logique que la fonction existante mais filtrée sur la liste fournie.
- `update_splash_mapping(p_splash_id, p_restaurant_id)` : helper pour le mapping inline (UPDATE simple, SECURITY DEFINER + check super_admin/chain_access).

**Frontend** (3 fichiers)
- Nouveau `src/components/integrations/BackfillConfigDialog.tsx` (le dialog)
- Nouveau `src/components/integrations/SplashMappingTable.tsx` (le tableau avec checkboxes, recherche, filtres, mapping inline via Combobox shadcn)
- Modif `SplashResilientBackfillCard.tsx` : remplace les 3 boutons par "Configurer un backfill"

## Hors scope (volontairement)

- Auto-matching fuzzy par nom (étape 2 si tu veux, pour les 22 non mappés en masse)
- Résolution automatique des doublons (toujours décision métier)
- Édition des autres champs du mapping (chain_id etc.)

## Estimation

1 migration SQL (~80 lignes), 2 nouveaux composants React (~350 lignes), modif mineure de la carte existante. Pas de breaking change : si tu fermes le dialog sans rien faire, comportement identique.