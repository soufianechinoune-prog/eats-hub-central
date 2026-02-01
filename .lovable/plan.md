

# Refonte de l'interface des Rapports WhatsApp

## Objectif

Unifier l'expérience d'envoi pour tous les types de rapports (IA global + templates statistiques) avec une interface cohérente permettant :

1. Sélection du type de rapport
2. Sélection des restaurants destinataires  
3. Génération et prévisualisation
4. Envoi avec édition possible
5. Historique consolidé

## Architecture proposée

```text
┌─────────────────────────────────────────────────────────┐
│                    RAPPORTS WHATSAPP                    │
├─────────────────────────────────────────────────────────┤
│  [Templates]  [Envoi (X)]  [Historique]                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ SÉLECTION DU TYPE DE RAPPORT                    │    │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ...     │    │
│  │ │ Rapport  │ │ Erreurs  │ │ CA       │         │    │
│  │ │ IA Global│ │          │ │          │         │    │
│  │ └──────────┘ └──────────┘ └──────────┘         │    │
│  │ (+ toggle Basique/Détaillé pour templates stat) │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ RESTAURANTS ÉPINGLÉS                            │    │
│  │ ☑ Juvisy   ☐ Antony   ☑ Evry   ...             │    │
│  │                                                  │    │
│  │        [Générer les rapports]                    │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Changements prévus

### 1. Nouvelle section "Type de rapport"

Remplacer la section templates par une sélection de type :

| Type | Description | Source |
|------|-------------|--------|
| Rapport IA Global | Synthèse intelligente avec menu interactif | `generate-ai-report` |
| Erreurs | Stats erreurs basique/détaillé | `generate-stat-report` |
| CA & Commandes | Stats ventes basique/détaillé | `generate-stat-report` |
| Notes | Stats avis basique/détaillé | `generate-stat-report` |
| Temps opérationnels | Stats temps basique/détaillé | `generate-stat-report` |
| Promotions | Stats promos basique/détaillé | `generate-stat-report` |

### 2. Sélection des restaurants

Au lieu de générer automatiquement pour tous les restaurants épinglés :
- Afficher une liste avec checkboxes
- Permettre de sélectionner/désélectionner individuellement
- Ajouter "Tout sélectionner" / "Tout désélectionner"

### 3. Flux de génération unifié

Quel que soit le type sélectionné :
1. Clic sur "Générer" → appelle la bonne Edge Function
2. Affiche la prévisualisation par restaurant
3. Permet l'édition du message
4. Envoie via WhatsApp

### 4. Historique enrichi

Ajouter le type de rapport dans l'historique :
- "Rapport IA" 
- "Erreurs (basique)"
- "CA (détaillé)"
- etc.

## Modifications techniques

### Fichier : `src/components/messaging/WeeklyReports.tsx`

**Nouveaux états :**

```typescript
// Type de rapport sélectionné
const [reportType, setReportType] = useState<
  "ai_global" | "errors" | "revenue" | "rating" | "operations" | "promotions"
>("ai_global");

// Niveau de détail (pour templates stat)
const [detailLevel, setDetailLevel] = useState<"basic" | "detailed">("basic");

// Restaurants sélectionnés pour envoi (avant génération)
const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<Set<string>>(new Set());
```

**Nouvelle section "Sélection du type" :**

- Grille de cartes pour choisir le type (comme les templates actuels)
- Pour les types stats, afficher un toggle basique/détaillé
- Carte "Rapport IA" mise en avant avec icône Sparkles

**Section "Restaurants épinglés" modifiée :**

- Liste avec checkboxes pour chaque restaurant
- Indication du nombre sélectionné
- Bouton unique "Générer les rapports"

**Fonction generateReports modifiée :**

```typescript
const generateReports = async () => {
  const restaurantIds = Array.from(selectedRestaurantIds);
  
  if (reportType === "ai_global") {
    // Utilise generate-ai-report comme aujourd'hui
    await supabase.functions.invoke("generate-ai-report", { ... });
  } else {
    // Utilise generate-stat-report pour chaque restaurant
    for (const id of restaurantIds) {
      await supabase.functions.invoke("generate-stat-report", {
        body: {
          restaurant_id: id,
          template_type: reportType,
          detail_level: detailLevel,
          ...
        }
      });
    }
  }
};
```

### Fichier : `.lovable/plan.md`

Mettre à jour le plan avec les modifications UI effectuées.

## Résultat attendu

1. Interface unifiée pour tous les types de rapports
2. Sélection flexible des restaurants
3. Même qualité visuelle pour rapports IA et stats
4. Historique consolidé avec distinction du type
5. Le manager peut toujours demander via WhatsApp (1-5, 1+)

## Ordre d'implémentation

1. Ajouter la section "Type de rapport" avec les 6 options
2. Modifier la section restaurants pour permettre la sélection
3. Adapter la fonction de génération pour supporter les deux modes
4. Enrichir l'historique avec le type de rapport
5. Supprimer l'ancienne section "Envoyer un rapport statistique"

