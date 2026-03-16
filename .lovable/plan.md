

## Ajouter une notice d'information sur la fréquence de mise à jour ADEME

### Objectif
Informer subtilement l'utilisateur que les données REP proviennent de l'ADEME et ne sont mises à jour qu'annuellement (adhérents) / trimestriellement (IDU), pour éviter les actualisations inutiles.

### Modification (1 fichier)

**`src/components/analytics/RepMembershipSection.tsx`**

Ajouter une petite bannière d'information juste en dessous du bouton "Vérifier les SIRET", visible en permanence (pas seulement après vérification). Elle utilisera le composant `Alert` avec une icône `Info` :

```text
┌─────────────────────────────────────────────────────┐
│ ℹ️  Données ADEME : adhérents mis à jour 1×/an     │
│     (juin), IDU mis à jour chaque trimestre.        │
│     Dernière MàJ connue : 2 février 2026.           │
│     Inutile d'actualiser quotidiennement.           │
└─────────────────────────────────────────────────────┘
```

- Style : `text-xs text-muted-foreground` avec bordure légère, discret mais lisible
- Placé entre le header (ligne ~160) et le message "Cliquez sur Vérifier" (ligne ~163)
- Import `Alert, AlertDescription` depuis `@/components/ui/alert` et `Info` depuis `lucide-react`

Aucune autre modification nécessaire.

