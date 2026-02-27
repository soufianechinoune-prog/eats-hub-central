

# Fix: Deliveroo CSV file reading error

## Root cause

The `readFileAsText` function (line 154-160) rejects with a raw `ProgressEvent` when `FileReader.onerror` fires. This object has no `.message` property, so the toast shows "Erreur lecture : filename" with an empty/undefined description -- unhelpful.

More importantly, the file likely uses **Windows-1252 / Latin-1 encoding** (common for French CSVs from Deliveroo with accented characters and emojis). While `readAsText` defaults to UTF-8 and usually doesn't throw for encoding mismatches, certain BOM sequences or binary-like content can trigger `onerror`.

## Fix

### `src/components/reports/DeliverooImportTab.tsx`

1. **Improve `readFileAsText`**: Add explicit UTF-8 encoding, and a fallback to `ISO-8859-1` (Latin-1) if the first attempt fails. Wrap the FileReader error in a proper `Error` object with a meaningful message including file size info.

2. **Add pre-read validation**: Check `file.size === 0` before attempting to read, and skip with a clear toast message ("Fichier vide").

3. **Better error message in toast**: When readFileAsText fails, show file size and a suggestion to re-export the file from Deliveroo.

### Changes (3 edits in 1 file)

**Edit 1** -- Replace `readFileAsText` (lines 154-160):
```typescript
const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result || result.trim().length === 0) {
        reject(new Error(`Le fichier est vide (${(file.size / 1024).toFixed(1)} Ko)`));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      reject(new Error(`Impossible de lire le fichier (${(file.size / 1024).toFixed(1)} Ko). Essayez de le ré-exporter depuis Deliveroo.`));
    };
    reader.readAsText(file, 'UTF-8');
  });
```

**Edit 2** -- Add empty file check before `readFileAsText` call (before line 99):
```typescript
if (file.size === 0) {
  toast({ title: `Fichier vide : ${file.name}`, description: "Ce fichier ne contient aucune donnée", variant: "destructive" });
  continue;
}
```

**Edit 3** -- Improve the catch block (line 101-105) to show a more helpful error:
```typescript
} catch (readErr: any) {
  console.error(`[Deliveroo] Failed to read file: ${file.name} (${file.size} bytes)`, readErr);
  toast({
    title: `Erreur lecture : ${file.name}`,
    description: readErr?.message || "Erreur inconnue lors de la lecture du fichier. Vérifiez que le fichier n'est pas corrompu.",
    variant: "destructive",
  });
  continue;
}
```

