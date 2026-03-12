

## Ajout d'une deuxième barre de progression : Taux d'adhésion REP

Actuellement il y a une seule barre "Ratio remboursements / prélèvements". L'idée est d'ajouter juste en dessous une seconde barre montrant le taux d'adhésion REP (inscrits / total restaurants vérifiés).

### Changement dans `src/components/analytics/EcoContributionSection.tsx`

**Après la barre existante (ligne ~456)**, ajouter une seconde barre de progression :

- **Label** : "Taux d'adhésion REP" avec le pourcentage à droite
- **Calcul** : `inscrits / (inscrits + non_trouvés)` en pourcentage (exclut les "sans SIRET" du dénominateur car non vérifiables)
- **Couleurs** : vert si >= 80%, jaune si >= 50%, rouge sinon (fond léger vert/15 pour le track)
- **Condition d'affichage** : visible uniquement si `repChecked` est true (données REP chargées)
- **Animation** : même transition `duration-700` que la barre existante pour cohérence

Les données sont déjà disponibles via `repStats` (inscrit, nonTrouve, sansSiret) calculé plus haut dans le composant, donc aucune modification de hooks nécessaire.

