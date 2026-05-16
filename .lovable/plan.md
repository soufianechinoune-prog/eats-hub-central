## Objectif

Ajouter un 4ᵉ pill **"Caisse"** dans le sélecteur de canal des pages Analytics, à côté de **Uber Eats / Deliveroo / Global**, et **réduire la largeur du sélecteur de restaurant** pour laisser de la place aux pills (qui deviennent plus nombreuses).

La source de données "Caisse" sera générique (basée sur la table `splash360_daily_sales` aujourd'hui, mais nommée "Caisse" pour rester agnostique — demain ce sera Zelty, Tiller, etc., via le système de connecteurs déjà en place dans `/settings/integrations`).

## Périmètre de ce plan

**Phase 1 (ce plan) — UI + plomberie de l'état :**
- Ajouter le pill "Caisse" dans le header Analytics
- Réduire la largeur du sélecteur de restaurant
- Étendre le type `Platform` à `"pos"` dans `AnalyticsContext`
- Afficher un état vide propre ("Pas encore de données caisse" / lien vers `/settings/integrations`) sur toutes les sections quand `selectedPlatform === "pos"` et qu'aucune connexion caisse n'est active pour la marque

**Hors périmètre (Phase 2, à planifier séparément après validation) :**
- Branchement réel des graphiques (CA, commandes, finances, etc.) sur `splash360_daily_sales`
- RPCs serveur agrégeant les ventes caisse par jour/semaine/mois
- Comparaison cross-canal "Livraison vs Caisse"

Ça permet de valider d'abord l'UX (placement, couleur, comportement quand pas de caisse connectée) avant d'investir dans toute la couche data.

## Changements UI

### `src/components/analytics/AnalyticsHeader.tsx` (lignes ~340-430)

1. **Réduire le sélecteur de restaurant** : passer le bouton trigger du Popover de sa largeur actuelle (flex-1) à une largeur fixe plus compacte, ex. `w-[280px]` ou `max-w-xs`. La pill "X restaurants affichés" reste lisible mais ne mange plus toute la barre.

2. **Ajouter le pill "Caisse"** après le pill "Global" :
   ```tsx
   <Button
     variant={selectedPlatform === "pos" ? "default" : "outline"}
     onClick={() => setSelectedPlatform("pos")}
     className={cn(
       "h-10 gap-2 transition-all duration-200",
       selectedPlatform === "pos" && "bg-amber-600 hover:bg-amber-700 text-white border-0"
     )}
   >
     <Store className="h-4 w-4" />  {/* icône lucide */}
     <span>Caisse</span>
   </Button>
   ```
   Couleur ambre/orange pour bien la distinguer du vert Uber, turquoise Deliveroo, et bleu Global.

3. **Layout responsive** : si la barre devient trop chargée à <1280px, wrapper les pills sur 2 lignes (`flex-wrap`).

### `src/contexts/AnalyticsContext.tsx`

- Étendre le type : `export type Platform = "uber_eats" | "deliveroo" | "global" | "pos";`
- Pas de migration nécessaire (stocké en localStorage, fallback `"uber_eats"` déjà en place).

### Gestion de l'état "vide" pour `selectedPlatform === "pos"`

Créer un petit composant partagé `src/components/analytics/PosEmptyState.tsx` qui affiche :
- Si **aucune connexion caisse active** pour la marque (`useActiveChainPOSConnection()` → null) : carte avec icône `Plug`, message "Aucune caisse connectée pour cette marque" + bouton "Connecter une caisse" → `/settings/integrations`.
- Si **caisse connectée mais Phase 2 pas encore livrée** : carte "Module Caisse bientôt disponible — vos données Splash360 sont déjà importées, les analyses arrivent très prochainement".

Dans chaque section consommatrice de `selectedPlatform` (AnalyticsCharts, FinancesSection, OperationsAnalytics, etc.), ajouter en tête :
```tsx
if (selectedPlatform === "pos") return <PosEmptyState />;
```

Ça évite que les sections existantes (qui requêtent `orders` / `payouts` Uber+Deliveroo) ne plantent ou n'affichent des zéros trompeurs.

## Détails techniques

| Élément | Avant | Après |
|---|---|---|
| Type `Platform` | 3 valeurs | 4 valeurs (`"pos"` ajouté) |
| Sélecteur restaurant | `flex-1` (prend toute la place) | `w-[280px]` (compact) |
| Pills canaux | 3 pills (Uber/Delivero/Global) | 4 pills (+ Caisse, ambre) |
| Sections analytics quand `pos` | — | `<PosEmptyState />` (court-circuit avant fetch) |

## Question rapide

Je propose **ambre/orange** pour le pill Caisse. Si tu préfères une autre couleur (violet, indigo…) dis-le-moi, sinon je pars là-dessus à l'implémentation.

Une fois cette phase validée visuellement, on enchaîne sur la Phase 2 (branchement réel des données `splash360_daily_sales` dans les graphiques CA / commandes / panier moyen).