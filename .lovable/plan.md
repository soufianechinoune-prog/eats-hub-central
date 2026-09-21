# Comparaison jour par jour : s'arrêter à la veille

## Ce qui ne va pas

Sur l'onglet « Vue quotidienne », le mois en cours est comparé au mois précédent **en entier**, alors que les données du mois en cours s'arrêtent forcément hier.

Vérifié dans le composant de comparaison :

- la courbe est construite sur tous les jours du mois (1 au 30 pour septembre), donc les jours 21 à 30 sont tracés à 0 — d'où la chute brutale visible à droite ;
- les totaux affichés dans la pastille (2 944 € contre 3 623 €, −18,7 %) additionnent **20 jours de septembre contre 31 jours d'août** : la comparaison est fausse par construction, pas les données.

Le même composant sert aussi à la page Caisse « Ventes sur place », donc le défaut y est identique.

## Ce qu'on fait

1. Quand le mois affiché est le mois en cours, la courbe et les totaux s'arrêtent à **la veille** (aujourd'hui exclu, cohérent avec ce qu'on a fait sur les autres périodes).
2. Le mois de référence est tronqué au **même nombre de jours** : août n'est compté que du 1er au 20 face au 1er–20 septembre. Comparaison à périmètre égal, donc variation juste.
3. Un libellé discret précise la troncature : « à date : 1–20 » à côté du titre, pour qu'on sache que ce n'est pas le mois complet.
4. Un mois passé (juillet, ou n'importe quel mois clôturé) reste affiché en entier, inchangé.
5. Les trois graphiques de la page (chiffre d'affaires, commandes, panier moyen) suivent la même règle, puisqu'ils partagent la même série.

## Détails techniques

- Fichier modifié : `src/components/analytics/DailyComparisonCharts.tsx` uniquement.
- Calcul d'un `cutoffDay` : si `year/month` = mois courant, `cutoffDay = min(hier, dernier jour du mois)`, sinon le dernier jour du mois. La génération de `chartData` s'arrête à `cutoffDay` ; les jours au-delà ne sont plus émis (pas de point à 0).
- Les lignes du mois de référence sont filtrées sur `jour <= cutoffDay` avant agrégation, donc `totals` (CA, commandes, paniers) et `calcVariation` portent sur la même fenêtre.
- Aucun changement de requête ni de RPC : les plages appelées restent les mois complets, la troncature se fait à l'agrégation.
- Bénéfice automatique pour `src/pages/OnsiteSales.tsx` qui utilise le même composant.
