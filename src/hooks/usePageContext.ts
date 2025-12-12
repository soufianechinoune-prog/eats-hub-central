import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

export interface PageContext {
  route: string;
  pageName: string;
  pageNameFr: string;
  analysisPrompt: string;
  suggestedQuestions: { icon: string; title: string; question: string }[];
}

const PAGE_CONTEXTS: Record<string, Omit<PageContext, 'route'>> = {
  '/': {
    pageName: 'Overview',
    pageNameFr: 'Vue d\'ensemble',
    analysisPrompt: `Analyse la page Vue d'ensemble du réseau de restaurants. 
Identifie:
1. Les 3 points critiques qui nécessitent une attention immédiate (performances inquiétantes, tendances négatives)
2. Les 3 points positifs à capitaliser (meilleures performances, progressions)
3. Recommandations concrètes pour améliorer les indicateurs globaux
4. Anomalies ou écarts significatifs par rapport aux benchmarks

Format ta réponse de manière structurée avec des emojis pour faciliter la lecture.`,
    suggestedQuestions: [
      { icon: 'AlertTriangle', title: 'Points d\'attention', question: 'Quels restaurants nécessitent une attention urgente ?' },
      { icon: 'TrendingUp', title: 'Meilleures performances', question: 'Quels sont mes meilleurs restaurants cette période ?' },
      { icon: 'Target', title: 'Objectifs', question: 'Suis-je en bonne voie pour atteindre mes objectifs ?' },
    ]
  },
  '/analytics': {
    pageName: 'Analytics',
    pageNameFr: 'Analytics',
    analysisPrompt: `Analyse les données analytics affichées. 
Identifie:
1. Les tendances clés (hausse/baisse CA, conversion, rentabilité)
2. Les variations N vs N-1 significatives
3. Les restaurants sur/sous-performants
4. Recommandations d'actions prioritaires

Concentre-toi sur les insights actionnables.`,
    suggestedQuestions: [
      { icon: 'TrendingUp', title: 'Tendances', question: 'Quelles sont les tendances clés de mes analytics ?' },
      { icon: 'BarChart', title: 'Comparaison N-1', question: 'Comment se compare ma performance par rapport à l\'année dernière ?' },
      { icon: 'Lightbulb', title: 'Optimisations', question: 'Quelles optimisations me recommandes-tu ?' },
    ]
  },
  '/restaurants': {
    pageName: 'Restaurants',
    pageNameFr: 'Restaurants',
    analysisPrompt: `Analyse le portefeuille de restaurants. 
Identifie:
1. La répartition géographique et opportunités d'expansion
2. Les restaurants à forte vs faible performance relative
3. Équilibre du réseau (concentration, couverture)
4. Recommandations de développement

Focus sur la vision stratégique du réseau.`,
    suggestedQuestions: [
      { icon: 'MapPin', title: 'Couverture', question: 'Où devrais-je ouvrir mon prochain restaurant ?' },
      { icon: 'Award', title: 'Top performers', question: 'Quels sont mes meilleurs restaurants ?' },
      { icon: 'AlertCircle', title: 'À surveiller', question: 'Quels restaurants sous-performent ?' },
    ]
  },
  '/reviews': {
    pageName: 'Reviews',
    pageNameFr: 'Avis clients',
    analysisPrompt: `Analyse les avis clients du réseau. 
Identifie:
1. La satisfaction globale et tendances récentes
2. Les points forts récurrents (compliments)
3. Les points faibles récurrents (plaintes)
4. Actions correctives prioritaires

Focus sur l'amélioration de l'expérience client.`,
    suggestedQuestions: [
      { icon: 'Star', title: 'Satisfaction', question: 'Quel est le niveau de satisfaction client ?' },
      { icon: 'ThumbsDown', title: 'Points faibles', question: 'Quels sont les problèmes récurrents dans les avis ?' },
      { icon: 'ThumbsUp', title: 'Points forts', question: 'Quels aspects sont les plus appréciés ?' },
    ]
  },
  '/operations': {
    pageName: 'Operations',
    pageNameFr: 'Opérations',
    analysisPrompt: `Analyse les métriques opérationnelles. 
Identifie:
1. Taux d'erreur et impact financier
2. Temps de préparation et attente coursiers
3. Disponibilité et temps d'inactivité
4. Actions pour améliorer l'efficacité opérationnelle

Focus sur l'excellence opérationnelle.`,
    suggestedQuestions: [
      { icon: 'Clock', title: 'Temps d\'attente', question: 'Comment optimiser mes temps de préparation ?' },
      { icon: 'AlertTriangle', title: 'Erreurs', question: 'Quelles erreurs de commande sont les plus fréquentes ?' },
      { icon: 'CheckCircle', title: 'Disponibilité', question: 'Comment améliorer ma disponibilité sur les plateformes ?' },
    ]
  },
  '/menu-items': {
    pageName: 'Menu Items',
    pageNameFr: 'Catalogue produits',
    analysisPrompt: `Analyse le catalogue de produits. 
Identifie:
1. Cohérence des prix Uber vs Deliveroo
2. Produits à forte/faible marge
3. Opportunités d'optimisation tarifaire
4. Produits manquants ou à ajouter

Focus sur l'optimisation du catalogue.`,
    suggestedQuestions: [
      { icon: 'DollarSign', title: 'Pricing', question: 'Mes prix sont-ils cohérents entre plateformes ?' },
      { icon: 'TrendingUp', title: 'Marges', question: 'Quels produits ont les meilleures marges ?' },
      { icon: 'Package', title: 'Catalogue', question: 'Quels produits devrais-je ajouter ou retirer ?' },
    ]
  },
};

export const usePageContext = (): PageContext => {
  const location = useLocation();
  
  return useMemo(() => {
    const route = location.pathname;
    
    // Find exact match or partial match
    const contextKey = Object.keys(PAGE_CONTEXTS).find(key => {
      if (key === '/') return route === '/';
      return route.startsWith(key);
    }) || '/';
    
    const context = PAGE_CONTEXTS[contextKey] || PAGE_CONTEXTS['/'];
    
    return {
      route,
      ...context,
    };
  }, [location.pathname]);
};
