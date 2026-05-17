# Refonte du Comparatif des restaurants — multi-canaux

## Problème
Aujourd'hui chaque restaurant déplié affiche une sous-ligne par canal sur **toutes les colonnes** du tableau. Avec 4-5 canaux, ça devient :
- visuellement saturé (5 sous-lignes × 13 colonnes),
- illisible (la moitié des cellules vaut "—" : Caisse/eShop/WhatsApp n'ont pas de Note, Erreurs, Prépa…),
- lent à scanner.

## Principe directeur
**La ligne principale reste un tableau triable (CA, Versement, Rentab., etc.), agrégée tous canaux.**
**Le dépli devient un mini-dashboard par canal**, où chaque canal n'affiche QUE les KPIs qui ont du sens pour lui. Pas de "—".

## Ligne principale (vue fermée) — inchangée dans sa structure

Toutes les colonnes actuelles restent triables (c'est ta contrainte forte). On ajoute juste :

- **Colonne CA enrichie** : sous le montant, une mini barre empilée colorée par canal (Uber violet / Deliveroo turquoise / Caisse rose / eShop bleu / WhatsApp vert). Au survol → tooltip avec le détail.
- **Petits chips canaux** à droite du nom du resto : pastilles miniatures (logo seul) pour signaler les canaux actifs. Donne une lecture instantanée de la couverture omnicanal sans rien dérouler.

Aucune sous-ligne par défaut. La densité de la table de premier niveau est préservée.

## Dépli (vue ouverte) — refondu

Quand on clique sur le chevron, **on n'affiche plus de sous-lignes tabulaires**. À la place, dans une zone "encartée" sous le restaurant :

### Bloc 1 — Mix canaux (en haut, full width)
Une barre horizontale empilée XL avec, pour chaque segment :
- logo + nom du canal,
- CA TTC,
- % du CA total du resto.
C'est la vue "d'où vient mon CA".

### Bloc 2 — Grille de mini-cards par canal
Une carte par canal actif, en grille responsive (3-4 colonnes selon largeur). Chaque carte affiche **uniquement les KPIs pertinents** pour ce canal :

```text
┌─ Uber Eats ─────────┐  ┌─ Deliveroo ─────────┐  ┌─ Caisse ────────────┐
│ CA      55 230 €    │  │ CA      18 400 €    │  │ CA      32 100 €    │
│ Cmds    2 058       │  │ Cmds    640         │  │ Cmds    1 720       │
│ Panier  26,80 €     │  │ Panier  28,75 €     │  │ Panier  18,65 €     │
│ Versement 31 200 €  │  │ Versement 11 800 €  │  │ Rentab.   72 %      │
│ Rentab.   66 %      │  │ Rentab.   58 %      │  │                     │
│ ─────────────────── │  │ ─────────────────── │  │                     │
│ ★ Note   4,7        │  │ ★ Note   4,5        │  │ (pas de Note)       │
│ Erreurs  0,8 %      │  │ Erreurs  1,1 %      │  │                     │
│ Prépa    12 min     │  │ Prépa    14 min     │  │                     │
│ % Pub    1,5 %      │  │ % Pub    —          │  │                     │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘

┌─ eShop ─────────────┐  ┌─ WhatsApp ──────────┐
│ CA       8 400 €    │  │ CA      4 200 €     │
│ Cmds     290        │  │ Cmds    180         │
│ Panier   28,95 €    │  │ Panier  23,30 €     │
└─────────────────────┘  └─────────────────────┘
```

Règles d'affichage par canal :
- **Uber Eats / Deliveroo** : Financier (CA, Versement, Rentab.) + Volume (Cmds, Panier) + Ops (Note, Erreurs, Prépa) + Pub
- **Caisse (Splash360)** : Financier (CA, Rentab. si dispo) + Volume (Cmds, Panier). Pas d'ops.
- **eShop** : Financier + Volume. Ops à voir plus tard si la source les fournit.
- **WhatsApp** : juste CA + Cmds (+ Panier dérivé).

Chaque carte = même hauteur visuelle (grid auto-rows), même typo, accent de couleur en haut = couleur du canal. Au clic sur la carte → navigation vers la page canal du resto (déjà existante pour Uber/Deliveroo, à venir pour les autres).

### Bloc 3 (optionnel, plus tard) — Comparatif N-1 par canal
Petit toggle local "vs N-1" qui transforme chaque carte en affichant la variation à côté de chaque KPI.

## Gains
- **Zéro cellule vide** : chaque canal ne montre que ce qu'il sait faire.
- **Densité divisée par ~3** : 1 grille de 5 cards ≈ hauteur de 2 sous-lignes actuelles, mais bien plus lisible.
- **Modulaire** : ajouter un 6e canal = ajouter une carte, aucun impact sur les colonnes du tableau.
- **Tri préservé** : la ligne principale garde tous ses tris (CA, Versement, Rentab., Note, etc., agrégés).
- **Lecture du mix omnicanal** instantanée via la barre empilée + les chips de la ligne principale.

## Détails techniques
- Fichier impacté : `src/components/overview/RestaurantComparisonTable.tsx`.
- Suppression des composants `PlatformSubRow` et `CashSubRow` (sous-lignes tableau) → remplacés par un composant `<ChannelBreakdownPanel restaurant={...} />` rendu dans une cellule `colSpan={fullWidth}` quand `isExpanded`.
- Le nouveau composant prend la `RestaurantNetworkStats` existante + `cashByRestaurant` + futurs `eshopByRestaurant` / `whatsappByRestaurant` (mêmes Maps que pour la caisse, on les branche au fil de l'arrivée des canaux).
- Type `Channel` central : `{ id, label, color, kpis: { financial?, volume?, ops?, marketing? } }` → la même grille rend tous les canaux sans condition disséminée.
- Les couleurs réutilisent les tokens sémantiques existants (`uber`, `deliveroo`, `cash`) + ajout de tokens `eshop`, `whatsapp` dans `index.css` / `tailwind.config.ts`.
- Mini barre empilée de la colonne CA : composant `<ChannelMixBar segments={[...]} />` réutilisé par la ligne principale et le bloc "Mix canaux" du dépli (tailles différentes).
- Aucun changement de hooks de data : on consomme déjà `stats.platformBreakdown` (Uber/Deliveroo) et `cashByRestaurant`. Les futurs canaux suivront le même schéma (Map<restaurantId, KPIs>).

## Hors scope (à itérer plus tard)
- L'éventuel "vs N-1" par canal.
- Le drilldown vers les pages canal eShop/WhatsApp (les pages n'existent pas encore).
- L'ajout réel des canaux eShop et WhatsApp côté data — ici on prépare juste le contenant.
