
# Plan : Paramètres avancés pour le simulateur BOGO

## Objectif
Enrichir la section "Paramètres avancés" du simulateur BOGO Uber avec deux options de configuration importantes :
1. **Frais d'utilisation d'offres** : possibilité d'indiquer si ces frais (0,89 €) sont offerts par Uber ou non
2. **Cofinancement** : option pour saisir un cofinancement en pourcentage (calculé sur le HT du prix article) ou en euros

---

## Fonctionnalités à implémenter

### 1. Frais d'utilisation d'offres
- Switch/toggle pour indiquer si les frais sont offerts par Uber
- Label clair : "Frais d'utilisation offerts par Uber"
- Cela permettra de tracer et différencier les offres avec/sans frais

### 2. Cofinancement
- Sélecteur de type : pourcentage (%) ou montant fixe (€)
- Champ de saisie pour le montant
- Note explicative : "Le pourcentage est calculé sur le prix HT de l'article"
- Affichage dynamique du résultat dans le panneau de droite

---

## Modifications techniques

### Fichier : `src/components/menu/offers/BogoSimulatorUber.tsx`

**Nouveaux états à ajouter :**
```typescript
const [offerFeeWaived, setOfferFeeWaived] = useState<boolean>(false);
const [cofinancingType, setCofinancingType] = useState<"percent" | "amount">("percent");
const [cofinancingValue, setCofinancingValue] = useState<string>("");
```

**Modification de la section "Paramètres avancés" (AccordionContent) :**
- Remplacer le texte placeholder par les deux options de configuration
- Ajouter un Switch pour les frais offerts
- Ajouter un RadioGroup ou boutons pour le type de cofinancement
- Ajouter un Input pour la valeur du cofinancement

**Mise à jour du résumé dans l'AccordionTrigger :**
- Afficher dynamiquement l'état des paramètres (ex: "Frais offerts, Cofin. 50%")

**Passage des nouvelles props à BogoImpactPanel :**
```typescript
<BogoImpactPanel
  restaurantCount={selectedRestaurantIds.length}
  selectedItemsCount={selectedItemIds.length}
  offerFee={OFFER_FEE}
  offerFeeWaived={offerFeeWaived}
  cofinancingType={cofinancingType}
  cofinancingValue={parseFloat(cofinancingValue) || 0}
/>
```

### Fichier : `src/components/menu/offers/BogoImpactPanel.tsx`

**Nouvelles props :**
```typescript
interface BogoImpactPanelProps {
  restaurantCount: number;
  selectedItemsCount: number;
  offerFee: number;
  offerFeeWaived?: boolean;
  cofinancingType?: "percent" | "amount";
  cofinancingValue?: number;
}
```

**Affichage conditionnel des frais :**
- Si `offerFeeWaived = true` : afficher "Frais offerts" avec un style barré ou badge vert
- Sinon : afficher le montant normal "0,89 € par commande"

**Affichage du cofinancement :**
- Nouvelle section sous les frais
- Affichage selon le type : "Cofinancement : 50% du HT" ou "Cofinancement : 2,50 € par article"

---

## Interface utilisateur prévue

```text
┌─────────────────────────────────────────────────────────┐
│ ⚙️ Paramètres avancés                                    │
│    Commission, cofinancement                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Frais d'utilisation d'offres                            │
│ ┌──────────────────────────────────────────────┐        │
│ │  Frais offerts par Uber          [Toggle]    │        │
│ └──────────────────────────────────────────────┘        │
│ Les frais de 0,89 € HT par commande utilisant cette    │
│ offre ne vous seront pas facturés.                      │
│                                                          │
│ ──────────────────────────────────────────────          │
│                                                          │
│ Cofinancement                                            │
│ ┌──────────────────────────────────────────────┐        │
│ │  [● Pourcentage]    [○ Montant fixe]         │        │
│ └──────────────────────────────────────────────┘        │
│                                                          │
│ ┌────────┐                                              │
│ │   50   │ %                                            │
│ └────────┘                                              │
│ Le pourcentage est calculé sur le prix HT de l'article │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Données incluses dans handleCreateOffer

```typescript
console.log("Creating offer:", {
  restaurants: selectedRestaurantIds,
  items: selectedItemIds,
  audience,
  durationType,
  customSchedule,
  weeklyBudget,
  // Nouveaux champs
  offerFeeWaived,
  cofinancingType,
  cofinancingValue: parseFloat(cofinancingValue) || 0,
});
```

---

## Résumé des fichiers modifiés

| Fichier | Modifications |
|---------|---------------|
| `src/components/menu/offers/BogoSimulatorUber.tsx` | Ajout états, section avancée complète, props |
| `src/components/menu/offers/BogoImpactPanel.tsx` | Nouvelles props, affichage conditionnel frais et cofin. |

---

## Points d'attention

1. **Calcul du cofinancement %** : S'applique sur le prix HT = `price_uber / (1 + vat_rate/100)`
2. **Traçabilité** : Ces paramètres seront sauvegardés dans `restaurant_actions` lors de la création
3. **Validation** : Le champ cofinancement accepte uniquement des valeurs numériques positives
