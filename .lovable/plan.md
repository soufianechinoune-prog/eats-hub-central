
# Plan : Refonte du Simulateur BOGO - Interface Uber Eats

## Objectif

Refondre completement le simulateur "Un achete = un offert" (BOGO) pour qu'il reproduise fidelement l'interface Uber Eats, avec les memes sections, textes, et design en accordeon.

---

## Architecture de l'interface

### Layout 2 colonnes

```text
+--------------------------------+---------------------------+
|                                |                           |
|   FORMULAIRE ACCORDEON         |   APERCU + IMPACT         |
|   (60% largeur)                |   (40% largeur)           |
|                                |                           |
|   - Etablissements             |   [Mockup iPhone]         |
|   - Articles                   |   "Tous les etabliss..."  |
|   - Audience                   |                           |
|   - Duree                      |   +-------------------+   |
|   - Depenses hebdomadaires     |   | Jusqu'a 63% de    |   |
|   - Parametres avances         |   | ventes en plus    |   |
|                                |   +-------------------+   |
|   [ ] J'accepte les CGU        |   Frais: 0,89EUR/cmd      |
|   [   Creez une offre   ]      |                           |
|                                |                           |
+--------------------------------+---------------------------+
```

---

## Sections du formulaire (style accordeon)

### 1. Etablissements
- Icone: Store (batiment)
- Selecteur de restaurant(s) multi-selection
- Donnees : `supabase.from("restaurants").select("id, name")`

### 2. Articles
- Icone: Tag/Etiquette
- Etat initial : "Aucun article selectionne" (texte rouge)
- Selection multiple depuis `menu_items`
- Affiche le nombre d'articles selectionnes

### 3. Audience
- Icone: Cible
- Sous-titre : "Selectionnez les clients qui verront votre offre."
- Options radio :
  - **Tous les clients** - "Recommande" (badge)
  - **Uniquement pour les nouveaux clients** - "N'a encore jamais commande aupres de votre etablissement."
  - **Utilisateurs repassant commande** - "A commande aupres de votre etablissement au cours des 6 derniers mois."
  - **Utilisateurs inactifs** - "N'a pas commande aupres de votre etablissement depuis plus de 45 jours."
  - **Reserve aux membres Uber One** - (icone speciale) "En savoir plus"

### 4. Duree
- Icone: Calendrier
- Sous-titre : "Selectionnez la periode durant laquelle vous proposerez votre offre."
- Boutons toggle : "1 an" | "6 mois" | "Personnalise"
- Lien "+ Specifier le moment de la journee"
- Modal "Planning personnalise" :
  - Date de debut / Date de fin (date pickers)
  - Jours de disponibilite : Sun/Mon/Tue/Wed/Thu/Fri/Sat (toggles)
  - Checkboxes : En semaine / Le week-end
  - Heure de debut / Heure de fin (selects)
  - Bouton "+ Ajouter une autre plage horaire"
  - Footer : Annuler | Enregistrer

### 5. Depenses hebdomadaires
- Icone: Billet
- Sous-titre : "Vous ne payez que lorsque les clients passent commande. Si vous le souhaitez, vous pouvez egalement definir un plafond de depense maximal."
- Input: EUR [Saisissez un budget] /semaine
- Note : "Les depenses hebdomadaires sont reinitialisees tous les lundis matin."

### 6. Parametres avances
- Icone: Engrenages
- Contenu a definir (commission, financement plateforme, etc.)

---

## Panneau droit - Apercu et Impact

### Mockup mobile
- Frame iPhone stylise en gris clair
- Representation de l'interface Uber Eats
- Badge "Un achete = un offert" sur la carte restaurant

### Zone d'impact
- **Titre principal** : "Jusqu'a **63 %** de ventes en plus"
- **Sous-texte** : "par rapport aux etablissements qui ne proposent pas cette offre"
- **Lien** : "Comment ce chiffre est-il calcule ?" (soulignable)
- **Frais** : "Frais d'utilisation de l'offre (hors taxes)" - **"0,89 EUR par commande"**

---

## Footer

- Checkbox : "J'accepte les Conditions generales" (lien souligne)
- Bouton : "Creez une offre" (noir, desactive si formulaire incomplet, actif quand tout est rempli)

---

## Section technique

### Fichiers a creer/modifier

| Fichier | Action |
|---------|--------|
| `src/components/menu/offers/BogoSimulatorUber.tsx` | Nouveau composant principal copiant l'interface Uber |
| `src/components/menu/offers/BogoAudienceSelector.tsx` | Nouveau - Options d'audience radio |
| `src/components/menu/offers/BogoDurationSelector.tsx` | Nouveau - Selection duree + modal planning |
| `src/components/menu/offers/BogoImpactPanel.tsx` | Nouveau - Panneau droit avec mockup et KPIs |
| `src/components/menu/offers/BogoSimulator.tsx` | Conserver comme fallback ou supprimer |
| `src/components/menu/OfferSimulator.tsx` | Mettre a jour pour utiliser le nouveau composant |

### Composants UI requis

- `Accordion` (Radix UI) pour les sections
- `RadioGroup` pour l'audience
- `ToggleGroup` pour la duree
- `Dialog` pour le planning personnalise
- `Calendar` pour les date pickers
- `Checkbox` pour les jours/CGU

### Donnees a recuperer

```typescript
// Restaurants
const { data: restaurants } = await supabase
  .from("restaurants")
  .select("id, name")
  .order("name");

// Articles du menu
const { data: menuItems } = await supabase
  .from("menu_items")
  .select("id, name, category, price_uber, food_cost, is_active")
  .eq("is_active", true)
  .not("price_uber", "is", null);
```

### Constantes textuelles Uber

```typescript
const UBER_TEXTS = {
  title: "Un achete = un offert",
  subtitle: "Encouragez les clients a commander en leur proposant une offre de type « un achete = un offert ».",
  salesImpact: "Jusqu'a 63 % de ventes en plus",
  salesImpactSubtitle: "par rapport aux etablissements qui ne proposent pas cette offre",
  offerFeeLabel: "Frais d'utilisation de l'offre (hors taxes)",
  offerFeeValue: "0,89 EUR par commande",
  cguLabel: "J'accepte les Conditions generales",
  createButton: "Creez une offre",
  audiences: {
    all: { title: "Tous les clients", badge: "Recommande" },
    new: { title: "Uniquement pour les nouveaux clients", description: "N'a encore jamais commande aupres de votre etablissement." },
    returning: { title: "Utilisateurs repassant commande", description: "A commande aupres de votre etablissement au cours des 6 derniers mois." },
    inactive: { title: "Utilisateurs inactifs", description: "N'a pas commande aupres de votre etablissement depuis plus de 45 jours." },
    uberOne: { title: "Reserve aux membres Uber One", link: "En savoir plus" },
  },
  durations: {
    "1year": "1 an",
    "6months": "6 mois",
    "custom": "Personnalise",
  },
};
```

### Style et design

- Fond : gris tres clair (`bg-gray-50`) ou blanc
- Sections accordeon : bordure fine en bas, icones a gauche
- Texte rouge pour erreurs ("Aucun article selectionne")
- Bouton principal : noir plein
- Badge "Recommande" : fond noir, texte blanc
- Respect du design epure et minimaliste d'Uber

---

## Comportement

1. **Validation** : Le bouton "Creez une offre" reste desactive tant qu'articles et CGU ne sont pas selectionnes
2. **Sauvegarde** : Au clic sur "Creez une offre", enregistrer dans `restaurant_actions` avec toutes les configurations
3. **Integration calculs** : Conserver la logique de calcul de marge existante mais l'afficher dans "Parametres avances"
4. **Multi-restaurant** : Permettre de selectionner plusieurs etablissements comme sur Uber

---

## Resume des etapes d'implementation

1. Creer `BogoSimulatorUber.tsx` avec le layout 2 colonnes
2. Implementer les sections accordeon avec le style Uber
3. Creer les sous-composants (audience, duree, impact panel)
4. Integrer la modal "Planning personnalise"
5. Connecter les donnees (restaurants, menu_items)
6. Ajouter la logique de validation et sauvegarde
7. Mettre a jour `OfferSimulator.tsx` pour utiliser le nouveau composant
