
# Refonte de la Messagerie - Phase 1 : Rapports IA Automatisés

## Vision globale

Transformer les rapports WhatsApp actuels (KPIs bruts) en **messages d'analyse intelligents** comme ceux que tu envoies manuellement, avec :
- Analyse des causes des problèmes (pourquoi le taux d'erreur est haut)
- Recommandations personnalisées
- Contexte business (offres en cours, périodes à venir)
- Ton humain et motivant

## Architecture actuelle

| Composant | État | Fichier |
|-----------|------|---------|
| Edge function `generate-weekly-report` | Génère les KPIs bruts | `supabase/functions/generate-weekly-report/index.ts` |
| Composant `WeeklyReports` | Templates + envoi manuel | `src/components/messaging/WeeklyReports.tsx` |
| Edge function `ai-advisor` | Déjà connecté à Lovable AI | `supabase/functions/ai-advisor/index.ts` |
| Table `order_errors` | Contient `error_category`, `item_title` | Base de données |

## Plan d'implémentation par étapes

### Étape 1 : Créer une edge function `generate-ai-report`

Cette nouvelle fonction génère un message complet enrichi par IA pour chaque restaurant.

**Données collectées :**
- KPIs de la semaine (existant)
- Répartition des erreurs par catégorie (`order_errors`)
- Produits les plus mentionnés dans les erreurs
- Comparaison semaine précédente
- Offres marketing actives (`restaurant_actions`)

**Prompt IA (inspiré de tes messages) :**
```text
Tu es un conseiller bienveillant pour restaurateurs. Génère un rapport WhatsApp personnalisé.

DONNÉES RESTAURANT:
- Nom: {restaurant_name}
- Prénom manager: {prenom}
- Note moyenne: 4.1 → 4.4 ✅ (vs 4.1 semaine précédente)
- Taux d'erreur: 2% → 4% ❌
- Répartition erreurs:
  • Articles manquants: 41%
  • Personnalisations manquantes: 23%
  • Mauvaise commande: 18%
  • Article incorrect: 18%
- Produits problématiques: Naan Tenders (12 erreurs), Frites (5), Boissons (4)
- Offre active: "1 acheté = 1 offert Naan Tenders" (Deliveroo)
- Prochaine période: Ramadan dans ~30 jours

RÈGLES:
- Commence par saluer avec le prénom
- Utilise ✅/❌ pour les indicateurs
- Analyse les CAUSES des erreurs (lier aux offres si pertinent)
- Donne des recommandations concrètes (double-check, vigilance)
- Mentionne le contexte business à venir
- Termine par une formule positive "🤲 Qu'Allah nous accorde la réussite !" 
- Format WhatsApp (pas de markdown lourd, utilise emojis)
- Maximum 400 mots
```

**Output attendu :**
```text
Bonjour Ayoub ! 👋

✅ Notes : vert → 4,4 (vs 4,1 la semaine dernière)
❌ Erreurs : rouge → 4% (vs 2% la semaine dernière)

Du coup focus sur les "erreurs", histoire de mettre le doigt exactement sur ce qui a bloqué...

⚫️ Causes principales des réclamations
• Articles manquants : 41%
• Personnalisations manquantes : 23%
...

[Analyse contextuelle des offres, recommandations]

🤲 Qu'Allah nous accorde la réussite !
```

### Étape 2 : Adapter le frontend WeeklyReports

**Nouveau bouton "Générer avec IA"** à côté de "Générer les rapports" :
- Appelle `generate-ai-report` au lieu de `generate-weekly-report`
- Affiche un indicateur de génération (streaming ou loader)
- Permet toujours l'édition manuelle après génération

**Workflow utilisateur simplifié :**
```text
1. Sélectionner le template de base (choix du "ton"/contexte)
2. Cliquer "Générer avec IA"
3. Messages personnalisés générés pour chaque restaurant
4. Valider/Éditer individuellement si besoin
5. Envoyer en batch
```

### Étape 3 : Améliorer la clarté de l'interface

**Regrouper "Composer" et "Envois"** en un seul onglet :
- Section haute : sélection destinataires + composition
- Section basse : messages en attente + historique

**Simplifier le tab "Rapports"** :
- Mode principal : "1-Click Report" (sélection template → génération IA → validation → envoi)
- Mode avancé accessible via toggle

## Modifications techniques détaillées

### Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `supabase/functions/generate-ai-report/index.ts` | Edge function pour génération IA des rapports |

### Fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `src/components/messaging/WeeklyReports.tsx` | Ajouter bouton "Générer avec IA", intégrer appel à la nouvelle function |
| `supabase/config.toml` | Ajouter la nouvelle edge function |

### Structure de la nouvelle edge function

```typescript
// supabase/functions/generate-ai-report/index.ts

interface ReportRequest {
  restaurant_ids: string[];
  start_date: string;
  end_date: string;
  template_context?: {
    tone: "standard" | "congratulations" | "alert";
    include_recommendations: boolean;
    include_error_analysis: boolean;
    closing_message?: string;
  };
}

// 1. Collecter les KPIs (comme generate-weekly-report)
// 2. Récupérer la répartition des erreurs par catégorie
// 3. Identifier les produits problématiques
// 4. Récupérer les offres actives
// 5. Construire le prompt avec tout le contexte
// 6. Appeler Lovable AI (google/gemini-2.5-flash)
// 7. Retourner le message généré par restaurant
```

## Phases futures (hors scope actuel)

- **Phase 2** : Automatisation complète (envoi sans validation)
- **Phase 3** : Alertes temps réel (taux d'erreur > seuil)
- **Phase 4** : Réponses chatbot automatiques

## Résultat attendu

Après cette phase :
1. Tu peux générer des rapports **qualitatifs** en 1 clic
2. L'IA analyse les données et écrit comme toi (style, ton, emojis)
3. Tu gardes le contrôle avec validation avant envoi
4. L'interface est plus claire et efficace

---

**Souhaites-tu que je commence par l'implémentation de l'edge function `generate-ai-report` ?**
