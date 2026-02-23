
## Ajout d'une analyse IA au rapport "Temps d'inactivite"

### Objectif

Ajouter une analyse intelligente generee par l'IA au rapport WhatsApp "Temps d'inactivite". Au lieu d'envoyer uniquement des chiffres bruts, l'IA va interpreter les donnees et fournir une analyse concise et actionnable : identifier les causes probables, les patterns, et donner des recommandations concretes.

### Comment ca marche

Quand tu generes un rapport "Temps d'inactivite", le systeme va :
1. Collecter toutes les donnees d'inactivite (heures, jours, creneaux critiques)
2. Envoyer ces donnees a l'IA avec un prompt specialise
3. L'IA genere une analyse concise qui comprend le contexte delivery (impact sur le ranking Uber, manque a gagner, patterns recurrents)

### Ce que l'IA va analyser

- **Impact business** : estimation du manque a gagner lie aux heures hors ligne (base sur le CA moyen/heure)
- **Patterns** : est-ce que l'inactivite est concentree sur le service du midi ? du soir ? un jour precis ?
- **Causes probables** : tablette eteinte, probleme technique, pause manuelle non desactivee
- **Impact ranking** : rappel que chaque minute hors ligne degrade le positionnement sur la plateforme
- **Recommandations** : actions concretes (verifier la tablette avant chaque service, mettre une alarme, etc.)

### Modifications techniques

**Fichier : `supabase/functions/generate-stat-report/index.ts`**

La fonction `generateDowntimeTemplate` sera modifiee pour :

1. Collecter les memes donnees qu'actuellement (taux de disponibilite, jours impactes, creneaux critiques)
2. Recuperer aussi le CA moyen/heure pour estimer le manque a gagner
3. Appeler l'IA via Lovable AI Gateway avec un prompt expert specialise "downtime delivery"
4. Integrer la reponse IA dans le message WhatsApp, apres les KPIs chiffres

**Structure du message final :**

```text
Partie 1 (deterministe - comme aujourd'hui) :
- Taux de disponibilite + evolution
- Temps hors ligne total
- Jours impactes + creneaux critiques

Partie 2 (IA - NOUVEAU) :
- Analyse concise (5-8 lignes max)
- Diagnostic des patterns identifies
- Estimation manque a gagner
- 2-3 recommandations concretes
```

**Prompt IA specialise :**

Le prompt sera concu pour un expert en operations delivery qui comprend :
- Que chaque minute hors ligne = commandes perdues a jamais
- Que l'algorithme Uber penalise les restaurants avec un taux de disponibilite faible
- Que les causes sont souvent humaines (oubli de rallumer la tablette, pause non desactivee)
- Qu'il faut etre concis pour WhatsApp (pas de paves)

### Aucun changement cote frontend

Le message WhatsApp est genere cote backend et envoye tel quel. Pas de modification necessaire dans `WeeklyReports.tsx`.
