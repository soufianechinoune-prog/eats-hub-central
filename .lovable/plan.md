# Nettoyage de la contamination Splash Tasty Crousty → Chicken Street

## Verdict sur l'audit

L'audit est juste sur le fond. J'ai revérifié en base, chiffre par chiffre :

| Contrôle | Audit | Vérifié en base |
|---|---|---|
| Lignes Chicken Street portant un identifiant Splash Tasty Crousty | 6 696 | 6 696 ✅ |
| Identifiants Splash concernés | 72 | 72 ✅ |
| Période | août uniquement | 2026-08-01 → 2026-08-31 ✅ |
| Créées aujourd'hui | 100 % | 6 696 / 6 696 ✅ |
| Rattachées à un restaurant Chicken Street | 0 | 0 ✅ |
| CA gonflé (ligne « global ») | 4 182 685 € | 4 182 685 € ✅ |

Deux précisions que l'audit n'a pas relevées :

1. **La contamination ne se limite pas à la ligne « global ».** Les 6 696 lignes se répartissent en 2 232 `global` (4,18 M€), 2 232 `uber_eats` (0,61 M€) et 2 232 `deliveroo` (0 €). Le `DELETE` proposé les emporte toutes — c'est correct, mais le vrai volume de CA retiré est de 4,80 M€ toutes plateformes confondues.
2. **La table de correspondance est contaminée elle aussi.** 3 boutiques Tasty Crousty (TASTY CROUSTY NIMES, TASTY CROUSTY BORDEAUX LAC, TASTY TALENCE) ont été enregistrées sous l'enseigne Chicken Street dans `splash360_restaurant_mapping`, sans restaurant rattaché. Si on ne les retire pas, une prochaine synchro Chicken Street peut réintroduire des lignes TC. L'audit s'arrête au nettoyage des ventes et laisse cette porte ouverte.

Le critère de suppression proposé reste sûr : ces 3 identifiants ne sont rattachés à aucun restaurant Chicken Street, donc aucune donnée légitime n'est emportée. Les 1 926 lignes Chicken Street non rattachées antérieures ne sont pas touchées.

## Correction proposée

1. Supprimer les 6 696 lignes de `splash360_daily_sales` sous l'enseigne Chicken Street dont l'identifiant Splash appartient à Tasty Crousty (critère exact de l'audit, toutes plateformes).
2. Supprimer les 3 lignes de correspondance Tasty Crousty enregistrées sous Chicken Street, pour que la contamination ne puisse pas revenir à la prochaine synchro.
3. Vérifier derrière :
   - le total réseau caisse Chicken Street d'août redescend au niveau attendu ;
   - le contrôle de contamination croisée renvoie 0 ;
   - Tasty Crousty est intact (les mêmes ventes existent bien sous leur enseigne d'origine).

Aucune donnée n'est perdue : ces ventes existent déjà correctement sous Tasty Crousty.

## Détails techniques

- `DELETE FROM public.splash360_daily_sales WHERE chain_id = <CS> AND restaurant_splash_id IN (SELECT DISTINCT restaurant_splash_id FROM public.splash360_daily_sales WHERE chain_id = <TC> AND restaurant_splash_id <> 0)` — exécuté via l'outil de modification de données, pas une migration.
- `DELETE FROM public.splash360_restaurant_mapping WHERE chain_id = <CS> AND restaurant_id IS NULL AND restaurant_splash_id IN (1564, 1575, 1587)`.
- Contrôles post-nettoyage en lecture seule : comptage des lignes croisées (attendu 0), somme `revenue_ttc` par mois et par plateforme pour Chicken Street, comptage des lignes Tasty Crousty d'août (inchangé).
- Aucun changement de schéma, de politique d'accès, de fonction ou de page front.
