
# Révision du simulateur BOGO : Approche en 2 étapes

## Vision utilisateur

Au lieu d'un popup complexe avec des projections incertaines, on simplifie le flux :

### Étape 1 : Afficher les marges des produits sélectionnés (inline)

Dans le simulateur, dès qu'un article est sélectionné, afficher directement ses informations financières :

```text
┌─────────────────────────────────────────────────────────────────────┐
│  📦 Articles sélectionnés                                           │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Naan TENDERS                                                   │  │
│  │ Prix TTC: 14,90 €  •  Food Cost: 3,80 €  •  TVA: 10%          │  │
│  │                                                                │  │
│  │  Marge Brute     Marge Nette (30%)    % Food Cost             │  │
│  │  ┌─────────┐     ┌─────────┐          ┌─────────┐             │  │
│  │  │  67,3%  │     │  27,4%  │          │  28,0%  │             │  │
│  │  │   ✅    │     │   ⚠️    │          │   ✅    │             │  │
│  │  └─────────┘     └─────────┘          └─────────┘             │  │
│  │                                                                │  │
│  │  💡 En BOGO, votre food cost double (7,60 €)                  │  │
│  │     → Marge Brute BOGO estimée: 43,8%                         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [ Voir l'historique des offres BOGO → ]                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Étape 2 : Redirection vers l'historique des offres

Au clic sur "Voir l'historique des offres BOGO", navigation vers `/marketing-analytics` avec les filtres pré-appliqués :

```
/marketing-analytics?type=1+acheté+%3D+1+offert&restaurant=CHICKEN+STREET+JUVISY
```

L'utilisateur arrive sur la page "Marketing Analytics" avec :
- Onglet "Offres" actif par défaut
- Filtre "Type" pré-sélectionné sur "1 acheté = 1 offert"
- Filtre "Restaurant" pré-sélectionné (si un seul restaurant choisi dans le simulateur)

Là, il peut analyser lui-même les offres passées et se faire sa propre idée.

---

## Modifications techniques

### 1. Créer un composant `BogoMarginPreview.tsx`

Nouveau composant qui affiche les marges des articles sélectionnés :

```typescript
interface BogoMarginPreviewProps {
  selectedItems: MenuItem[];
  selectedRestaurantIds: string[];
  commissionRate: number;
  onViewHistory: () => void;
}

export function BogoMarginPreview({ ... }: BogoMarginPreviewProps) {
  // Calcul des marges pour chaque article
  // - Prix HT = Prix TTC / (1 + TVA%)
  // - Marge Brute = (Prix HT - Food Cost) / Prix HT
  // - Marge Nette = (Prix HT - Commission - Food Cost) / Prix HT
  // - % Food Cost = Food Cost / Prix HT (ou Net selon toggle)
  // - Impact BOGO = Food Cost x 2 pour calculer nouvelle marge
  
  return (
    <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
      {/* Pour chaque article sélectionné */}
      <div className="space-y-4">
        {selectedItems.map(item => (
          <BogoMarginCard 
            key={item.id}
            item={item}
            commissionRate={commissionRate}
          />
        ))}
      </div>
      
      {/* Bouton pour voir l'historique */}
      <Button onClick={onViewHistory}>
        <History className="h-4 w-4 mr-2" />
        Voir l'historique des offres BOGO
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </Card>
  );
}
```

### 2. Modifier `BogoSimulatorUber.tsx`

Remplacer le bouton "Historique des offres similaires" par le composant `BogoMarginPreview` qui s'affiche dès qu'un article est sélectionné :

```typescript
// Après la section des articles sélectionnés
{selectedItems.length > 0 && (
  <BogoMarginPreview
    selectedItems={selectedItems}
    selectedRestaurantIds={selectedRestaurantIds}
    commissionRate={27} // ou configurable
    onViewHistory={handleNavigateToHistory}
  />
)}

const handleNavigateToHistory = () => {
  const params = new URLSearchParams();
  params.set("type", "1 acheté = 1 offert");
  params.set("tab", "offers");
  
  if (selectedRestaurantIds.length === 1) {
    const restaurant = restaurants.find(r => r.id === selectedRestaurantIds[0]);
    if (restaurant) params.set("restaurant", restaurant.name);
  }
  
  navigate(`/marketing-analytics?${params.toString()}`);
};
```

### 3. Modifier `MarketingAnalytics.tsx`

Ajouter la lecture des query params pour pré-sélectionner l'onglet et passer les filtres :

```typescript
import { useSearchParams } from "react-router-dom";

export default function MarketingAnalytics() {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "offers";
  const typeFromUrl = searchParams.get("type");
  const restaurantFromUrl = searchParams.get("restaurant");
  
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  return (
    // ...
    <OffersOverview
      offers={campaignData?.offers || []}
      stats={...}
      initialFilterType={typeFromUrl}
      initialFilterRestaurant={restaurantFromUrl}
    />
  );
}
```

### 4. Modifier `OffersOverview.tsx`

Accepter les filtres initiaux en props :

```typescript
interface OffersOverviewProps {
  offers: OffersCampaign[];
  stats: { ... };
  initialFilterType?: string | null;
  initialFilterRestaurant?: string | null;
}

export function OffersOverview({ 
  offers, 
  stats, 
  initialFilterType,
  initialFilterRestaurant 
}: OffersOverviewProps) {
  const [filterType, setFilterType] = useState<string>(
    initialFilterType || "all"
  );
  const [filterRestaurant, setFilterRestaurant] = useState<string>(
    initialFilterRestaurant || "all"
  );
  // ...
}
```

### 5. Supprimer les fichiers obsolètes

- `src/components/menu/offers/BogoHistoryInsightsDialog.tsx` (plus utilisé)
- `src/components/menu/offers/BogoProjectionDialog.tsx` (plus utilisé)
- `src/hooks/useBogoOfferHistory.ts` (plus utilisé)

---

## Résumé des fichiers

| Fichier | Action |
|---------|--------|
| `src/components/menu/offers/BogoMarginPreview.tsx` | Créer - Affiche les marges des articles sélectionnés |
| `src/components/menu/offers/BogoSimulatorUber.tsx` | Modifier - Intégrer BogoMarginPreview + navigation |
| `src/pages/MarketingAnalytics.tsx` | Modifier - Lire les query params URL |
| `src/components/marketing/OffersOverview.tsx` | Modifier - Accepter filtres initiaux en props |
| `src/components/menu/offers/BogoHistoryInsightsDialog.tsx` | Supprimer |
| `src/components/menu/offers/BogoProjectionDialog.tsx` | Supprimer |
| `src/hooks/useBogoOfferHistory.ts` | Supprimer |

---

## Avantages de cette approche

| Aspect | Bénéfice |
|--------|----------|
| **Fiabilité** | Les marges affichées sont calculées avec les vraies formules (pas de projection) |
| **Réutilisation** | On exploite le tableau "Historique des offres" déjà fonctionnel avec 88 offres |
| **Autonomie utilisateur** | L'utilisateur analyse lui-même les données, se fait sa propre opinion |
| **Simplicité code** | Moins de composants, pas de dialog, pas de fuzzy matching complexe |
| **Transparence** | L'utilisateur voit exactement les marges avant/après BOGO |

---

## Formules utilisées pour les marges

Les calculs s'appuient sur la logique déjà validée dans `useRestaurantProfitability.ts` :

```typescript
// Prix HT
const prixHT = prixTTC / (1 + vatRate / 100);

// Marge Brute %
const margeBrute = ((prixHT - foodCost) / prixHT) * 100;

// Marge Nette % (commission sur TTC)
const commissionHT = prixTTC * (commissionRate / 100);
const margeNette = ((prixHT - commissionHT - foodCost) / prixHT) * 100;

// % Food Cost
const foodCostPercent = (foodCost / prixHT) * 100;

// Impact BOGO : on "offre" un article, donc food cost x 2
const foodCostBogo = foodCost * 2;
const margeBruteBogo = ((prixHT - foodCostBogo) / prixHT) * 100;
```
