import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, Send, X, Copy, Share2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Restaurant {
  id: string;
  name: string;
  city?: string | null;
  street?: string | null;
  postal_code?: string | null;
  restaurant_phone?: string | null;
  restaurant_email?: string | null;
  manager_first_name?: string | null;
  manager_last_name?: string | null;
  account_manager_name?: string | null;
  account_manager_title?: string | null;
  account_manager_phone?: string | null;
  account_manager_email?: string | null;
}

interface RestaurantShareActionsProps {
  selectedRestaurants: Restaurant[];
  onClear: () => void;
  onDelete?: (ids: string[], forceDelete?: boolean) => Promise<void>;
}

export function RestaurantShareActions({ selectedRestaurants, onClear, onDelete }: RestaurantShareActionsProps) {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (forceDelete: boolean = false) => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(selectedRestaurants.map(r => r.id), forceDelete);
      setShowDeleteDialog(false);
      toast({
        title: "Supprimé",
        description: `${selectedRestaurants.length} restaurant${selectedRestaurants.length > 1 ? 's' : ''} supprimé${selectedRestaurants.length > 1 ? 's' : ''}`,
      });
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      if (err.message?.includes("foreign key constraint") || err.code === "23503") {
        toast({
          title: "Données liées existantes",
          description: "Certains restaurants ont des commandes ou avis associés. Utilisez 'Supprimer tout' pour supprimer toutes les données.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de supprimer les restaurants",
          variant: "destructive",
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const formatRestaurantInfo = (restaurant: Restaurant) => {
    const lines = [
      `🏪 ${restaurant.name}`,
      restaurant.street && `📍 ${restaurant.street}`,
      (restaurant.postal_code || restaurant.city) && `   ${restaurant.postal_code || ''} ${restaurant.city || ''}`.trim(),
      restaurant.restaurant_phone && `📞 ${restaurant.restaurant_phone}`,
      restaurant.restaurant_email && `✉️ ${restaurant.restaurant_email}`,
      (restaurant.manager_first_name || restaurant.manager_last_name) && 
        `👤 Gérant: ${restaurant.manager_first_name || ''} ${restaurant.manager_last_name || ''}`.trim(),
      // Account Manager section
      (restaurant.account_manager_name || restaurant.account_manager_phone || restaurant.account_manager_email) && `\n📊 Account Manager Uber:`,
      restaurant.account_manager_name && `   ${restaurant.account_manager_name}${restaurant.account_manager_title ? ` (${restaurant.account_manager_title})` : ''}`,
      restaurant.account_manager_phone && `   📞 ${restaurant.account_manager_phone}`,
      restaurant.account_manager_email && `   ✉️ ${restaurant.account_manager_email}`,
    ].filter(Boolean);
    return lines.join('\n');
  };

  const formatAllRestaurants = () => {
    return selectedRestaurants.map(formatRestaurantInfo).join('\n\n---\n\n');
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formatAllRestaurants());
      toast({
        title: "Copié !",
        description: "Les informations ont été copiées dans le presse-papier",
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de copier dans le presse-papier",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    const text = formatAllRestaurants();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Fiche${selectedRestaurants.length > 1 ? 's' : ''} Restaurant`,
          text: text,
        });
      } catch (err) {
        // User cancelled or error - fallback to copy
        if ((err as Error).name !== 'AbortError') {
          handleCopyToClipboard();
        }
      }
    } else {
      // Fallback for desktop - copy to clipboard
      handleCopyToClipboard();
    }
  };

  // Check if we're in an iframe (preview mode)
  const isInIframe = window.self !== window.top;

  const handleShareWhatsApp = async () => {
    const text = formatAllRestaurants();
    
    // Copy to clipboard first
    await navigator.clipboard.writeText(text).catch(() => {});
    
    if (isInIframe) {
      // In iframe, COOP blocks external navigation - just copy
      toast({
        title: "Texte copié !",
        description: "Ouvrez WhatsApp et collez le texte. (Le lien direct fonctionne sur l'app publiée)",
      });
    } else {
      // Outside iframe, try to open WhatsApp
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const handleShareTelegram = async () => {
    const text = formatAllRestaurants();
    
    // Copy to clipboard first
    await navigator.clipboard.writeText(text).catch(() => {});
    
    if (isInIframe) {
      // In iframe, COOP blocks external navigation - just copy
      toast({
        title: "Texte copié !",
        description: "Ouvrez Telegram et collez le texte. (Le lien direct fonctionne sur l'app publiée)",
      });
    } else {
      // Outside iframe, try to open Telegram
      window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Fiches Restaurant${selectedRestaurants.length > 1 ? 's' : ''} - ${selectedRestaurants.map(r => r.name).join(', ')}`);
    const body = encodeURIComponent(formatAllRestaurants());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  if (selectedRestaurants.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border border-border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4">
      <span className="text-sm font-medium">
        {selectedRestaurants.length} restaurant{selectedRestaurants.length > 1 ? 's' : ''} sélectionné{selectedRestaurants.length > 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleNativeShare}
          className="gap-2"
        >
          <Share2 className="h-4 w-4" />
          Partager
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyToClipboard}
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          Copier
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShareWhatsApp}
          className="gap-2"
        >
          <MessageCircle className="h-4 w-4 text-green-500" />
          WhatsApp
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShareTelegram}
          className="gap-2"
        >
          <Send className="h-4 w-4 text-blue-500" />
          Telegram
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShareEmail}
          className="gap-2"
        >
          <Mail className="h-4 w-4 text-orange-500" />
          Email
        </Button>
        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </Button>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={onClear} className="h-8 w-8">
        <X className="h-4 w-4" />
      </Button>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selectedRestaurants.length} restaurant{selectedRestaurants.length > 1 ? 's' : ''} ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-2">Cette action est irréversible. Les restaurants suivants seront définitivement supprimés :</p>
                <ul className="list-disc list-inside text-sm space-y-1 mb-3">
                  {selectedRestaurants.map(r => (
                    <li key={r.id} className="font-medium">{r.name} {r.city && <span className="text-muted-foreground font-normal">({r.city})</span>}</li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground">
                  <strong>Supprimer</strong> : Supprime uniquement si pas de données liées<br/>
                  <strong>Supprimer tout</strong> : Supprime les restaurants ET toutes leurs données
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(false)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleDelete(true)}
              disabled={isDeleting}
              className="bg-red-700 text-white hover:bg-red-800"
            >
              {isDeleting ? "Suppression..." : "⚠️ Supprimer tout"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
