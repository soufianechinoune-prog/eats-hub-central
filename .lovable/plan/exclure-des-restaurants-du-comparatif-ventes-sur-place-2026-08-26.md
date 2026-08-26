# Exclure des restaurants du comparatif (Ventes sur place)

## Objectif
Permettre de retirer un ou plusieurs restaurants du comparatif N vs N-1 — que ce soit en vue **Brut** ou en **Périmètre constant** — par exemple un store qui vient d'ouvrir, une fermeture administrative, ou tout cas particulier qui fausse la lecture.

Aujourd'hui le sélecteur de la page ne fait que de l'**inclusion** ("Tous les restaurants" ou une liste choisie). On ajoute une logique d'**exclusion** claire, lisible, réversible.

## Ce qu'on ajoute

### 1. Un bouton « Exclusions » dans la barre de filtres
À côté du sélecteur de restaurants, un bouton dédié :
- Libellé « Aucune exclusion » ou « 3 restaurants exclus » (badge compteur ambre quand actif).
- Ouvre un panneau avec recherche, liste des restaurants du périmètre courant, case à cocher par restaurant.
- Chaque ligne affiche le nom, la ville, et le CA de l'année en cours pour aider à décider.
- Actions rapides dans le panneau : « Tout réinclure », et « Exclure les ouvertures {année} » (restaurants sans CA N-1, donc hors périmètre constant par nature).

### 2. Une barre d'exclusions visible en permanence
Quand au moins un restaurant est exclu, une bande discrète (fond ambre clair) s'affiche sous la barre de filtres :
- Un chip par restaurant exclu, avec une croix pour le réinclure en un clic.
- Texte récapitulatif : « 3 restaurants exclus du comparatif — X XXX XXX € retirés de {année}, Y YYY YYY € de {année-1}. »
- Bouton « Réinitialiser ».

Objectif UX : impossible de lire un chiffre filtré sans voir qu'il est filtré.

### 3. Application à TOUS les chiffres de la page
Les exclusions s'appliquent en amont de tous les calculs, donc :
- KPI en haut (CA N, CA N-1, évolution brute, commandes, évolution LFL, restaurants LFL)
- Onglet Vue globale (graphe Brut **et** Périmètre constant)
- Onglet Volume vs panier (waterfall, quadrant)
- Onglet Périmètre constant (listes lfl / ouvertures / fermetures)
- Onglet Par restaurant et Tableaux détaillés
- Export Excel : les restaurants exclus ne sont pas comptés, et une ligne d'en-tête liste les exclusions appliquées.

### 4. Persistance
La liste d'exclusions est mémorisée par marque (localStorage, clé par `chain_id`) pour ne pas être à refaire à chaque visite, et reste modifiable/réinitialisable à tout moment.

## Détails techniques
- Nouveau composant `src/components/analytics/onsite/OnsiteExclusionsControl.tsx` (bouton + popover Command, réutilise le style de `OnsiteRestaurantSelect`) et `OnsiteExclusionsBar.tsx` (les chips).
- `useSplashOnsiteMonthly` reçoit une nouvelle option `excludedRestaurantIds?: string[]`, appliquée dans le `useMemo` juste après le filtre `restaurantIds` (avant toute agrégation), avec `excludeKey` ajouté aux dépendances. Aucun changement de RPC ni de base.
- Le hook expose en plus `excludedImpact: { current, previous, count }` pour alimenter le texte de la barre.
- `OnsiteSales.tsx` : état `excluded` (persisté via localStorage par chaîne), passé au hook, au composant d'export, et aux deux nouveaux composants.
- Aucune modification des RPC, de la base de données ni des autres pages.
