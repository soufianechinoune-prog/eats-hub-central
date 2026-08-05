# Ventes sur place — pourquoi les chiffres ne collent pas avec Splash

## Ce que montrent les vérifications en base

Chicken Street, CA sur place (`platform = 'global'`), du 01/01/2026 au 05/08/2026 :

| Mois | CA sur place en base | Commandes |
|---|---|---|
| Janvier | 7 353 769 € | 493 361 |
| Février | 6 023 558 € | 405 267 |
| Mars | 6 809 658 € | 452 064 |
| Avril | 8 300 039 € | 549 866 |
| Mai | 4 674 898 € | 304 688 |
| Juin | 7 590 225 € | 529 005 |
| Juillet | 7 640 897 € | 514 515 |
| Août (5 j.) | 1 014 979 € | 66 026 |

Or la page affiche 3 775 773 € pour janvier et 24 383 698 € sur l'année : **environ la moitié**.

## Cause n°1 (principale) — la page ne reçoit que la moitié des lignes

La fonction serveur renvoie une ligne par restaurant et par mois, sur deux années : **2 052 lignes** pour Chicken Street. L'API de la base plafonne une réponse à **1 000 lignes**. La page reçoit donc uniquement les ~52 premiers restaurants dans l'ordre alphabétique, et tous les totaux (CA, commandes, LFL) sont amputés d'environ la moitié.

C'est le vrai bug : le calcul est bon, c'est le transport des données qui tronque.

## Cause n°2 — trous de synchronisation Splash

Nombre de jours-restaurant sans aucune donnée en 2026 : janvier 366, février 359, mars 306, avril 173, **mai 1 532**, juin 268, juillet 253. Le trou de mai (18 au 31 mai) explique à lui seul que mai ressorte à 4,67 M€ au lieu d'environ 7,5 M€. Ces trous sont déjà signalés par le triangle orange, mais ils continuent de sous-estimer les mois concernés.

## Cause n°3 — 8 restaurants Splash non rattachés

Ces identifiants Splash remontent du CA mais ne sont reliés à aucun restaurant en base, donc ils sont exclus : 1016, 1527, 1532, 1524, 1014, 1274, 1019, 1568 (plus 576, 1300, 1572, 503, 82 à 0 €). Cela représente environ 650 k€ de CA sur place manquant depuis juin 2026. L'identifiant 0 est la ligne « total » de Splash et reste correctement exclu.

## Écart restant avec l'écran Splash

Écran Splash (Année, tous restaurants Chicken Street) : Restaurant 54,73 M€. En base : 49,4 M€ + 0,65 M€ non rattachés + ~2,9 M€ manquants sur mai ≈ 52,9 M€. Le reliquat correspond aux autres jours manquants listés ci-dessus. Autrement dit, une fois la troncature corrigée et la synchro Splash rattrapée, les deux chiffres convergent.

## Ce que je propose de faire

1. **Corriger la troncature** : modifier `get_splash_onsite_monthly` pour qu'elle renvoie le résultat déjà agrégé en un seul objet JSON (bloc réseau par mois + bloc par restaurant avec son détail mensuel), au lieu de 2 000 lignes brutes. Une seule ligne renvoyée, plus aucun plafond possible, et moins de calcul dans le navigateur.
2. **Adapter le hook** `useSplashOnsiteMonthly.ts` à ce nouveau format (mêmes champs en sortie : CA N / N-1, commandes, panier moyen, LFL, jours manquants), sans changer l'affichage ni l'export Excel.
3. **Afficher un encart « couverture des données »** en haut de page : nombre de jours-restaurant manquants sur la période et nombre de restaurants Splash non rattachés, pour que l'écart avec le dashboard Splash soit explicite et chiffré.
4. **Vérification** : après correction, recomparer janvier (attendu ~7,35 M€) et le total 2026 hors août avec la base.

Non inclus ici (à traiter séparément si tu veux) : relancer la synchro Splash sur le trou du 18–31 mai, et mapper les 8 identifiants Splash orphelins.

## Détails techniques

- La fonction reste `SECURITY DEFINER`, `SET search_path = public`, contrôle d'accès inchangé (`is_super_admin()` / `user_has_chain_access()`).
- Retour : `jsonb` unique avec `network_months[]`, `restaurants[]` (chacun avec `months[]`), et `coverage { days_zero_current, unmapped_splash_ids }`.
- La logique LFL (un restaurant compte dans le mois M s'il a du CA en M/N et M/N-1) est déplacée côté SQL, à l'identique du calcul actuel du hook.
- `useOnsiteSalesExport.ts` et `OnsiteSales.tsx` gardent leurs signatures actuelles.
