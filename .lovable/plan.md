
# Saisie précise et mémorisation du taux de commission

## Contexte
Le slider actuel de commission ne permet que des valeurs entières (step=1), mais les contrats avec les plateformes utilisent souvent des taux avec décimales (ex: 24.5%, 30.25%). De plus, le taux doit être persisté pour éviter de le ressaisir à chaque visite.

## Modifications prévues

### 1. Remplacer le slider par un champ de saisie numérique

**Fichier : `src/components/menu/ProfitabilityComparison.tsx`**

Transformer le slider en un champ `Input` avec les caractéristiques suivantes :
- Type number avec step="0.01" pour 2 décimales
- Plage de 0 à 50%
- Suffixe "%" affiché dans le design
- Validation côté client (min/max)

```text
┌────────────────────────────────────────┐
│ % Commission │  [  24.50  ] %  │ 💾   │
└────────────────────────────────────────┘
```

### 2. Persister le taux de commission par plateforme

Utiliser `localStorage` pour sauvegarder les taux séparément pour Uber et Deliveroo :
- Clé : `profitability-commission-uber` et `profitability-commission-deliveroo`
- Charger au montage du composant via `useState` avec initializer function
- Sauvegarder à chaque modification via `useEffect`

### 3. Interface utilisateur améliorée

- Champ de saisie compact avec icône "%"
- Bouton de sauvegarde visuel (icône check) qui confirme la persistance
- Ou sauvegarde automatique au blur/changement avec toast de confirmation discret
- Tooltip explicatif sur le champ

## Code technique

### Initialisation avec localStorage
```typescript
const COMMISSION_STORAGE_KEY = "profitability-commission";

const [commissionRate, setCommissionRate] = useState(() => {
  const saved = localStorage.getItem(`${COMMISSION_STORAGE_KEY}-${platform}`);
  return saved ? parseFloat(saved) : DEFAULT_COMMISSION[platform];
});
```

### Persistance automatique
```typescript
useEffect(() => {
  localStorage.setItem(`${COMMISSION_STORAGE_KEY}-${platform}`, commissionRate.toString());
}, [commissionRate, platform]);

// Charger le bon taux quand on change de plateforme
useEffect(() => {
  const saved = localStorage.getItem(`${COMMISSION_STORAGE_KEY}-${platform}`);
  setCommissionRate(saved ? parseFloat(saved) : DEFAULT_COMMISSION[platform]);
}, [platform]);
```

### Champ Input avec validation
```tsx
<div className="flex items-center gap-2">
  <span className="text-xs text-muted-foreground">Commission</span>
  <div className="relative">
    <Input
      type="number"
      value={commissionRate}
      onChange={(e) => {
        const value = parseFloat(e.target.value);
        if (!isNaN(value) && value >= 0 && value <= 50) {
          setCommissionRate(value);
        }
      }}
      step="0.01"
      min="0"
      max="50"
      className="w-20 pr-6 text-right"
    />
    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
      %
    </span>
  </div>
</div>
```

## Résultat attendu

| Avant | Après |
|-------|-------|
| Slider 15-45% (entiers) | Input 0-50% (2 décimales) |
| Valeur perdue au refresh | Valeur persistée par plateforme |
| Step = 1 | Step = 0.01 |

## Fichier impacté
- `src/components/menu/ProfitabilityComparison.tsx`
