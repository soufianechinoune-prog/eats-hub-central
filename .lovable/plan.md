

# Refonte des Templates de Rapports WhatsApp

## Vue d'ensemble

L'objectif est de créer un système de templates structuré et prévisible :

1. **Rapport IA** : Synthèse hebdomadaire générée par l'IA (envoi automatique ou manuel)
2. **Templates statistiques** : Rapports ciblés sur des KPIs spécifiques, disponibles en version basique ou détaillée

## Fonctionnement

Le manager reçoit le rapport IA global chaque semaine. Il peut ensuite :
- Répondre avec un numéro (1-5) pour recevoir un template spécifique
- Répondre avec "1+" ou "1 détail" pour la version détaillée

Toi, depuis l'interface, tu peux :
- Envoyer le rapport IA global
- Choisir et envoyer directement un template spécifique (basique ou détaillé)

## Templates à implémenter

### Template 0 : Rapport IA Global (existant)
- Synthèse intelligente de la semaine
- Analyse contextuelle des performances
- Menu interactif pour demander les détails

### Template 1 : Taux d'erreur

**Version Basique :**
- Taux d'erreur actuel (%)
- Nombre d'erreurs
- Évolution vs semaine précédente

**Version Détaillée :**
- Tout ce qui est dans Basique
- Breakdown par catégorie (manquants, incorrects, qualité)
- Top 5 produits problématiques
- Corrélation avec promotions actives

### Template 2 : CA et Commandes

**Version Basique :**
- Chiffre d'affaires TTC
- Nombre de commandes
- Panier moyen
- Variation vs semaine précédente

**Version Détaillée :**
- Tout ce qui est dans Basique
- Répartition par jour de la semaine
- Meilleur/pire jour
- Comparaison mois glissant

### Template 3 : Note moyenne

**Version Basique :**
- Note moyenne (sur 5)
- Nombre d'avis reçus
- Évolution vs semaine précédente

**Version Détaillée :**
- Tout ce qui est dans Basique
- Répartition nouveaux clients vs fidèles
- Top 3 tags négatifs fréquents
- Produits les mieux/moins bien notés

### Template 4 : Temps opérationnels

**Version Basique :**
- Temps de préparation total moyen
- Temps d'attente coursier moyen
- Statut vs objectifs

**Version Détaillée :**
- Tout ce qui est dans Basique
- Breakdown par créneau horaire (midi/soir)
- Pics de lenteur identifiés
- Comparaison aux autres restaurants du réseau

### Template 5 : Promotions

**Version Basique :**
- Liste des offres actives sur la période
- Volume de commandes impacté

**Version Détaillée :**
- Tout ce qui est dans Basique
- Impact sur le panier moyen
- Rentabilité estimée par offre
- Recommandations d'optimisation

## Modifications techniques

### 1. Base de données

Créer une nouvelle structure pour les templates statistiques :

```sql
-- Ajouter une colonne template_type à report_templates
-- Valeurs : 'ai_global', 'errors', 'revenue', 'rating', 'operations', 'promotions'

-- Ajouter une colonne detail_level
-- Valeurs : 'basic', 'detailed'
```

### 2. Edge function generate-ai-report

Modifier pour accepter :
- `template_type` : 'ai_global' | 'errors' | 'revenue' | 'rating' | 'operations' | 'promotions'
- `detail_level` : 'basic' | 'detailed'

Ajouter des fonctions de génération pour chaque type de template.

### 3. Webhook ultramsg

Modifier pour détecter les réponses du type :
- "1", "2", "3", "4", "5" → version basique
- "1+", "2+", etc. ou "1 détail", "2 détail" → version détaillée

### 4. Interface UI (WeeklyReports.tsx)

Ajouter :
- Sélection du type de template
- Toggle basique/détaillé
- Preview du contenu attendu

## Sources de données par template

| Template | Tables/Vues utilisées |
|----------|----------------------|
| Erreurs | `daily_order_accuracy`, `order_errors` |
| CA | `daily_sales_uber_deduped` |
| Notes | `customer_reviews` |
| Temps | `order_history` |
| Promotions | `restaurant_actions`, `order_items` |

Toutes les données sont pré-calculées dans la base pour garantir la cohérence avec le dashboard.

## Menu interactif (fin du rapport IA)

```
━━━━━━━━━━━━━━━━━━━━━━
📋 Répondez avec un numéro pour plus de détails :
1️⃣ Erreurs
2️⃣ CA & Commandes  
3️⃣ Notes clients
4️⃣ Temps opérationnels
5️⃣ Promotions

💡 Ajoutez "+" pour la version détaillée (ex: "1+")
━━━━━━━━━━━━━━━━━━━━━━
```

## Prochaines étapes

1. Valider la liste des templates et leur contenu
2. Implémenter les fonctions de génération pour chaque template
3. Mettre à jour le webhook pour gérer les réponses
4. Ajouter l'interface de sélection dans la UI

