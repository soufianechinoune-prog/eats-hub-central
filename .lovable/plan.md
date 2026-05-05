## Pourquoi tu ne vois pas la Caisse Splash360

La data Splash existe bien pour mai, juin, novembre 2024, mais l’affichage lit au mauvais endroit.

### Ce que j’ai vérifié en base

Pour les restaurants individuels, les montants existent :

| Mois 2024 | Global Splash TTC | Uber Splash TTC | Deliveroo Splash TTC | Caisse calculée |
|---|---:|---:|---:|---:|
| Mai | 5 899 992 € | 1 485 927 € | 44 265 € | 4 369 800 € |
| Juin | 5 854 415 € | 1 420 314 € | 35 738 € | 4 398 363 € |
| Novembre | 5 872 589 € | 1 697 128 € | 54 262 € | 4 121 199 € |

Donc le backfill a bien ramené la donnée restaurant par restaurant.

### Le bug actuel

Le composant Vue d’ensemble utilise `useNetworkCashRevenue.ts`, et ce hook filtre actuellement :

```ts
restaurant_splash_id = 0
```

Or le backfill résilient a surtout rempli :

```ts
restaurant_splash_id != 0
```

Donc l’écran regarde la ligne réseau Splash `id = 0`, mais les vraies données backfillées sont dans les lignes restaurants. Résultat : l’interface conclut à tort qu’il n’y a pas de Caisse Splash360.

La bonne logique doit être :

```text
Caisse Splash360 = somme(Global Splash restos) - somme(Uber Splash restos) - somme(Deliveroo Splash restos)
```

et non pas lire uniquement la ligne réseau `0`.

## Pourquoi la différence entre Lovable et le navigateur

Sur tes captures, le contexte n’est pas le même :

- navigateur : `Chicken Street`, environ `104 restaurants suivis`, le message Splash apparaît ;
- preview Lovable : `Toutes les marques`, environ `169 restaurants suivis`, le message Splash n’apparaît pas.

Le message “Caisse Splash360 : aucune donnée…” ne s’affiche que si une connexion Splash est détectée pour la marque active. En mode `Toutes les marques`, la connexion POS de Chicken Street n’est pas considérée comme active pour ce scope, donc le fallback n’apparaît pas.

Il faut donc aussi rendre l’affichage cohérent en mode multi-marques / scope réseau.

## Plan de correction

1. Modifier `src/hooks/useNetworkCashRevenue.ts`
   - Ne plus filtrer uniquement `restaurant_splash_id = 0`.
   - Lire les lignes `restaurant_splash_id != 0`.
   - Agréger par jour et plateforme.
   - Calculer la caisse par jour :

   ```text
   max(0, global - uber_eats - deliveroo)
   ```

   puis sommer sur la période.

2. Ajouter la pagination Supabase dans ce hook
   - La table dépasse 1000 lignes sur les périodes historiques.
   - Utiliser une boucle `.range()` avec `PAGE_SIZE = 1000`, conformément au standard projet.

3. Corriger la période N-1
   - Appliquer la même logique agrégée aux restaurants individuels pour la comparaison N-1.

4. Clarifier le texte source
   - Remplacer “Source : réseau global · détail par restaurant indisponible via l’API.”
   - Par quelque chose du type :

   ```text
   Source : Splash360 restaurants · Caisse = Global - Uber Eats - Deliveroo.
   ```

5. Rendre le fallback plus cohérent
   - En mode Chicken Street : afficher le message si aucune donnée.
   - En mode Toutes les marques : éviter de masquer silencieusement l’info si la connexion Splash existe sur une des marques accessibles, ou afficher un message de scope clair.

## Résultat attendu après correction

Sur mai, juin, novembre 2024, la barre “Répartition du CA réseau” affichera aussi un segment Caisse avec environ :

- Mai 2024 : 4,37 M€
- Juin 2024 : 4,40 M€
- Novembre 2024 : 4,12 M€

Aucun nouveau backfill n’est nécessaire.