## Problèmes constatés

Sur le screenshot :
1. Le **popover** de sélection de restaurant garde sa largeur d'origine (350 px) alors que le **trigger** a été réduit à 280 px → décalage visuel.
2. Le sélecteur de période **"Mai 2026"** se retrouve collé au milieu, alors qu'avant il était calé à **droite** de la barre.
3. Les pills **Uber Eats / Deliveroo / Global / Caisse** sont serrées au centre, alors qu'il faudrait qu'elles **prennent toute la place disponible** entre le sélecteur de restaurant (à gauche) et "Mai 2026" (à droite).

## Plan de correction

Fichier : `src/components/analytics/AnalyticsHeader.tsx` (uniquement)

### 1. Aligner la largeur du popover sur le trigger
- Ligne 301 : remplacer `w-[350px]` par `w-[var(--radix-popover-trigger-width)]` (Radix expose cette CSS var, donc le contenu prend exactement la largeur du bouton trigger = 280 px) **OU** plus simple : passer `w-[280px]`.
- Je pars sur `w-[var(--radix-popover-trigger-width)]` pour rester auto-aligné si on retouche la largeur plus tard.

### 2. Repousser "Mai 2026" tout à droite
- Le bloc `{!hidePeriodSelector && <div ...>` du sélecteur de période : ajouter `ml-auto` pour le pousser à droite du `flex-wrap`.

### 3. Étirer les pills entre le restaurant et la période
- Wrapper des pills (ligne 397) : passer de `flex flex-wrap gap-2` à `flex-1 flex gap-2 justify-evenly` (ou `flex-1 grid grid-cols-4 gap-2`) pour qu'elles occupent l'espace central.
- Chaque `<Button>` pill : ajouter `flex-1` pour qu'elles se partagent équitablement l'espace.
- Garder les hauteurs (`h-10`) et les couleurs actuelles.

### Layout final attendu

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Restaurant 280px] [Uber Eats][Deliveroo][Global][Caisse]   [Mai 2026] │
└─────────────────────────────────────────────────────────────────────────┘
```

- Sélecteur restaurant : largeur fixe 280 px (inchangé)
- 4 pills : étirées et équi-réparties au centre
- "Mai 2026" : poussée à droite via `ml-auto`
- Popover restaurant : 280 px = exactement la largeur du trigger

### Hors périmètre
- Aucune logique de données touchée.
- Aucun autre fichier modifié.
- Pas de changement responsive : le `flex-wrap` du conteneur parent reste, donc en dessous d'une certaine largeur les pills se réorganisent naturellement.

Si OK je passe en build.