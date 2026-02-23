

## Ajouter un PDF en piece jointe aux rapports WhatsApp

### Contexte

Le rapport IA inclut deja les donnees de temps d'inactivite (downtime_minutes) dans le prompt envoye a l'IA. Aucune modification necessaire pour le point 1.

Pour le point 2, on va generer un PDF de synthese par restaurant et l'envoyer en piece jointe WhatsApp apres le message texte.

### Architecture du flux

```text
1. Generation rapports IA (existant)
      |
2. Generation PDF par restaurant (NOUVEAU - client-side jsPDF)
      |
3. Upload PDF vers storage "whatsapp-media" 
      |
4. Envoi message texte WhatsApp (existant)
      |
5. Envoi PDF via send-whatsapp-media (existant)
```

### Modifications

#### 1. Nouveau hook : `src/hooks/useReportPdfExport.ts`

Hook qui genere un PDF de synthese KPI pour un restaurant donne, sans html2canvas (100% jsPDF vectoriel pour la rapidite) :

- Header avec logo CS + nom du restaurant + periode
- Section KPIs : CA, Commandes, Panier moyen, Note, Taux d'erreur, Temps de prep, Downtime
- Indicateurs de tendance (fleches haut/bas + couleurs vert/rouge)
- Comparaison semaine precedente
- Le PDF est retourne en tant que Blob

#### 2. Modification : `src/components/messaging/WeeklyReports.tsx`

Dans la fonction `sendReports` (ligne ~733), apres l'envoi du message texte :

- Option "Joindre le PDF" : ajouter un toggle/checkbox dans l'interface d'envoi (onglet "Envoi")
- Pour chaque restaurant selectionne :
  1. Generer le PDF avec les KPIs du `generatedKPIs`
  2. Uploader le PDF dans le bucket `whatsapp-media` avec un nom unique (ex: `report-{restaurant}-{date}.pdf`)
  3. Recuperer l'URL publique
  4. Appeler `send-whatsapp-media` avec `mediaType: 'document'` et le `filename`
  5. Ajouter un delai de 1s entre chaque envoi PDF pour eviter le rate-limiting

#### 3. Interface utilisateur

- Ajouter un toggle "Joindre le PDF de synthese" dans l'onglet Envoi, au-dessus du bouton "Envoyer"
- Indicateur de progression : "Envoi PDF 2/4..."
- Le toggle est desactive par defaut pour ne pas changer le comportement existant

### Contenu du PDF de synthese

| Section | Contenu |
|---------|---------|
| En-tete | Logo CS, nom restaurant, periode |
| CA et Commandes | CA actuel vs precedent, variation %, nb commandes, panier moyen |
| Satisfaction | Note moyenne vs precedent, nb avis |
| Operations | Temps de prep, attente coursier |
| Erreurs | Taux d'erreur vs precedent, nb erreurs |
| Disponibilite | Minutes d'inactivite vs precedent |
| Pied de page | Date de generation, "CS Delivery Performance" |

### Fichiers concernes

| Fichier | Modification |
|---------|-------------|
| `src/hooks/useReportPdfExport.ts` | NOUVEAU - Generation PDF vectoriel par restaurant |
| `src/components/messaging/WeeklyReports.tsx` | Ajouter toggle PDF + logique upload/envoi dans sendReports |

### Limites et considerations

- Les PDFs sont generes cote client (rapide, ~100ms par PDF)
- Le bucket `whatsapp-media` est deja configure et utilise pour d'autres medias
- Le delai entre envois PDF (1s) evite le rate-limiting UltraMsg
- Pour 4 restaurants : ~8s supplementaires d'envoi (4 PDFs x 1s + 4 textes x 0.5s)
