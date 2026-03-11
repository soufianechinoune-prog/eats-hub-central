import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Trash2,
  Eye,
  Download,
  File,
  FileImage,
  Loader2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface RestaurantDocumentsProps {
  restaurantId: string;
}

type DocumentType = "kbis" | "rib" | "license" | "insurance" | "contract" | "attestation_adhesion" | "other";

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "kbis", label: "KBIS" },
  { value: "rib", label: "RIB" },
  { value: "license", label: "Licence" },
  { value: "insurance", label: "Assurance" },
  { value: "contract", label: "Contrat" },
  { value: "attestation_adhesion", label: "Attestation adhésion REP" },
  { value: "other", label: "Autre" },
];

const getDocumentTypeLabel = (type: string) => {
  const found = DOCUMENT_TYPES.find(t => t.value === type);
  return found?.label || "Autre";
};

const getDocumentTypeBadgeColor = (type: string) => {
  switch (type) {
    case "kbis": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "rib": return "bg-green-500/10 text-green-600 border-green-500/20";
    case "license": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
    case "insurance": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "contract": return "bg-cyan-500/10 text-cyan-600 border-cyan-500/20";
    case "attestation_adhesion": return "bg-teal-500/10 text-teal-600 border-teal-500/20";
    default: return "bg-muted text-muted-foreground";
  }
};

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith("image/")) {
    return <FileImage className="h-5 w-5" />;
  }
  return <File className="h-5 w-5" />;
};

export function RestaurantDocuments({ restaurantId }: RestaurantDocumentsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>("kbis");
  const [notes, setNotes] = useState("");
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    fileName: string;
    fileType: string;
  } | null>(null);

  // Fetch documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["restaurant-documents", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_documents")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (document: { id: string; file_path: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("restaurant-documents")
        .remove([document.file_path]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from("restaurant_documents")
        .delete()
        .eq("id", document.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant-documents", restaurantId] });
      toast({ title: "Succès", description: "Document supprimé" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le document", variant: "destructive" });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      // Generate unique file path
      const fileExt = file.name.split(".").pop();
      const filePath = `${restaurantId}/${Date.now()}-${selectedDocType}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("restaurant-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Insert record in database
      const { error: dbError } = await supabase
        .from("restaurant_documents")
        .insert({
          restaurant_id: restaurantId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          document_type: selectedDocType,
          notes: notes || null,
        });

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["restaurant-documents", restaurantId] });
      toast({ title: "Succès", description: "Document uploadé" });
      
      // Reset form
      setNotes("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Erreur", description: "Impossible d'uploader le document", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from("restaurant-documents")
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePreview = (doc: { file_path: string; file_name: string; file_type: string }) => {
    const url = getPublicUrl(doc.file_path);
    setPreviewDoc({
      url,
      fileName: doc.file_name,
      fileType: doc.file_type,
    });
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const url = getPublicUrl(filePath);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download error:", error);
      toast({ title: "Erreur", description: "Impossible de télécharger le fichier", variant: "destructive" });
    }
  };

  const isPreviewable = (fileType: string) => {
    return fileType.startsWith("image/") || fileType === "application/pdf";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-4">
        <div className="p-2 rounded-md bg-primary/10">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <CardTitle className="text-lg">Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Form */}
        <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Type de document</Label>
              <Select value={selectedDocType} onValueChange={(v) => setSelectedDocType(v as DocumentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Version 2024"
              />
            </div>
            <div className="space-y-2">
              <Label>Fichier</Label>
              <div className="flex gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="cursor-pointer"
                />
                {isUploading && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Formats acceptés : PDF, JPG, PNG, DOC, DOCX
          </p>
        </div>

        {/* Documents List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucun document uploadé</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-muted rounded-md">
                    {getFileIcon(doc.file_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{doc.file_name}</p>
                      <Badge variant="outline" className={getDocumentTypeBadgeColor(doc.document_type)}>
                        {getDocumentTypeLabel(doc.document_type)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>
                        {format(new Date(doc.uploaded_at), "d MMM yyyy", { locale: fr })}
                      </span>
                      {doc.notes && (
                        <>
                          <span>•</span>
                          <span className="italic">{doc.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isPreviewable(doc.file_type) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreview(doc)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Voir
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(doc.file_path, doc.file_name)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Télécharger
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. Le fichier "{doc.file_name}" sera définitivement supprimé.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate({ id: doc.id, file_path: doc.file_path })}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview Modal */}
        <Dialog open={!!previewDoc} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="truncate pr-4">{previewDoc?.fileName}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {previewDoc?.fileType.startsWith("image/") ? (
                <img
                  src={previewDoc.url}
                  alt={previewDoc.fileName}
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
              ) : previewDoc?.fileType === "application/pdf" ? (
                <iframe
                  src={previewDoc.url}
                  className="w-full h-[70vh]"
                  title={previewDoc.fileName}
                />
              ) : null}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => previewDoc && handleDownload(previewDoc.url, previewDoc.fileName)}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
