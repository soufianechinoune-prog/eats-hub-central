

## Objectif
Remplacer les imports statiques de pages par `React.lazy()` et envelopper `<Routes>` dans `<Suspense>` pour réduire le bundle initial.

## Modification unique : `src/App.tsx`

### Imports statiques conservés (critiques au démarrage)
- `Login`, `ResetPassword`, `NotFound`, `ProtectedRoute`, `AppLayout`, `PrivacyPolicy`, `UberCallback`

### Imports convertis en `React.lazy()` (35 pages)
```typescript
const Overview = React.lazy(() => import("./pages/Overview"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Restaurants = React.lazy(() => import("./pages/Restaurants"));
const RestaurantMenu = React.lazy(() => import("./pages/RestaurantMenu"));
const UberConnections = React.lazy(() => import("./pages/UberConnections"));
const Exports = React.lazy(() => import("./pages/Exports"));
const Reports = React.lazy(() => import("./pages/Reports"));
const Disputes = React.lazy(() => import("./pages/Disputes"));
const UberNaming = React.lazy(() => import("./pages/UberNaming"));
const MenuEditor = React.lazy(() => import("./pages/MenuEditor"));
const DataEntry = React.lazy(() => import("./pages/DataEntry"));
const Analytics = React.lazy(() => import("./pages/Analytics"));
const RankingDetail = React.lazy(() => import("./pages/RankingDetail"));
const RestaurantDetail = React.lazy(() => import("./pages/RestaurantDetail"));
const MenuItems = React.lazy(() => import("./pages/MenuItems"));
const RestaurantActions = React.lazy(() => import("./pages/RestaurantActions"));
const MenuHistory = React.lazy(() => import("./pages/MenuHistory"));
const Messaging = React.lazy(() => import("./pages/Messaging"));
const Operations = React.lazy(() => import("./pages/Operations"));
const Cartography = React.lazy(() => import("./pages/Cartography"));
const ReportImport = React.lazy(() => import("./pages/ReportImport"));
const ImportGuide = React.lazy(() => import("./pages/ImportGuide"));
const ImportChecklist = React.lazy(() => import("./pages/ImportChecklist"));
const DowntimeComparison = React.lazy(() => import("./pages/DowntimeComparison"));
const RatingsComparison = React.lazy(() => import("./pages/RatingsComparison"));
const OpeningHoursComparison = React.lazy(() => import("./pages/OpeningHoursComparison"));
const PrepTimeComparison = React.lazy(() => import("./pages/PrepTimeComparison"));
const TotalDeliveryTimeComparison = React.lazy(() => import("./pages/TotalDeliveryTimeComparison"));
const InaccurateOrdersComparison = React.lazy(() => import("./pages/InaccurateOrdersComparison"));
const UberStoreMapping = React.lazy(() => import("./pages/UberStoreMapping"));
const DeliverooMatching = React.lazy(() => import("./pages/DeliverooMatching"));
const ItemSales = React.lazy(() => import("./pages/ItemSales"));
const MarketingAnalytics = React.lazy(() => import("./pages/MarketingAnalytics"));
const SuccessScore = React.lazy(() => import("./pages/SuccessScore"));
const Reviews = React.lazy(() => import("./pages/Reviews"));
const Admin = React.lazy(() => import("./pages/Admin"));
const Account = React.lazy(() => import("./pages/Account"));
```

### Suspense wrapper
Ajout de `React, { Suspense }` à l'import React et `Loader2` de lucide-react. Le `<Routes>` sera enveloppé dans :
```tsx
<Suspense fallback={
  <div className="flex items-center justify-center h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
}>
  <Routes>...</Routes>
</Suspense>
```

### Aucune autre modification
Les routes elles-mêmes restent identiques. Aucune migration SQL.

