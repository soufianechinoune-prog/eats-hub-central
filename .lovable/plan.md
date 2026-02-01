
# Interface Unifiée des Rapports WhatsApp

## ✅ Implémenté

### Nouvelle interface à 3 étapes

1. **Sélection du type de rapport** (6 options)
   - Rapport IA Global (synthèse intelligente)
   - Erreurs (taux d'erreur et produits problématiques)
   - CA & Commandes (ventes et volume)
   - Notes clients (avis et satisfaction)
   - Temps opérationnels (préparation et coursier)
   - Promotions (offres actives et impact)

2. **Toggle Basique/Détaillé** pour les templates statistiques

3. **Sélection des restaurants** avec checkboxes
   - Tout sélectionner / Tout désélectionner
   - Affichage du nombre sélectionné
   - Indication du statut WhatsApp

4. **Génération unifiée**
   - Un seul bouton "Générer les rapports"
   - Appelle `generate-ai-report` pour IA Global
   - Appelle `generate-stat-report` pour les templates stats

### Tab "Envoi"
- Prévisualisation des messages générés
- Édition possible avant envoi
- Sélection/désélection individuelle
- Envoi groupé via WhatsApp

### Tab "Historique"
- Messages groupés par date
- Statut de livraison (délivré, lu, échec)
- Contenu du message extensible

### Templates personnalisés
- Section repliée pour la gestion des templates legacy
- Création/modification/suppression de templates

## Architecture technique

```text
┌─────────────────────────────────────────────────────────┐
│                    RAPPORTS WHATSAPP                    │
├─────────────────────────────────────────────────────────┤
│  [Rapports]  [Envoi (X)]  [Historique]                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ ÉTAPE 1: TYPE DE RAPPORT ───────────────────────┐   │
│  │ [Rapport IA] [Erreurs] [CA] [Notes] [Temps] [Promo]│  │
│  │ + Toggle Basique/Détaillé pour stats              │  │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ ÉTAPE 2: RESTAURANTS ───────────────────────────┐   │
│  │ [Tout] [Aucun]           X/Y sélectionnés        │   │
│  │ ☑ Juvisy   ☑ Antony   ☐ Evry   ☑ Massy  ...     │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ ÉTAPE 3: GÉNÉRATION ────────────────────────────┐   │
│  │ "Rapport IA pour 4 restaurants"                   │   │
│  │                    [✨ Générer les rapports]      │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Edge Functions utilisées

| Type de rapport | Edge Function |
|-----------------|---------------|
| Rapport IA Global | `generate-ai-report` |
| Erreurs, CA, Notes, Temps, Promos | `generate-stat-report` |

## Réponses WhatsApp interactives

Le manager peut répondre au rapport IA avec :
- `1` à `5` → version basique du template correspondant
- `1+`, `2+`, etc. ou `1 détail` → version détaillée

Menu interactif affiché :
```
1️⃣ Erreurs
2️⃣ CA & Commandes  
3️⃣ Notes clients
4️⃣ Temps opérationnels
5️⃣ Promotions

💡 Ajoutez "+" pour la version détaillée (ex: "1+")
```
