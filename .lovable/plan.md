

## Corriger l'envoi du PDF : politique de stockage manquante

### Probleme identifie

L'upload du PDF vers le stockage echoue avec l'erreur **403 "new row violates row-level security policy"**.

La cause : le code utilise `x-upsert: true` pour uploader le PDF, ce qui necessite une politique **UPDATE** en plus de **INSERT** sur la table `storage.objects`. Or seule la politique INSERT existe pour le bucket `whatsapp-media`. Si un fichier avec le meme nom existe deja (ex: `report-Chicken_Street___Athis_Mons-20260216.pdf` envoye precedemment), l'upsert tente un UPDATE qui est bloque par RLS.

### Solution

Ajouter une politique UPDATE sur `storage.objects` pour le bucket `whatsapp-media`, identique aux politiques INSERT et DELETE deja en place.

### Modification

#### Migration SQL

```sql
CREATE POLICY "Allow update whatsapp media"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'whatsapp-media')
WITH CHECK (bucket_id = 'whatsapp-media');
```

### Fichiers concernes

| Fichier | Modification |
|---------|-------------|
| Migration SQL | Ajouter politique UPDATE sur storage.objects pour bucket whatsapp-media |

Aucune modification de code n'est necessaire -- le probleme est uniquement une politique de securite manquante dans la base.

