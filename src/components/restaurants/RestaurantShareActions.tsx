import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, Send, X } from "lucide-react";

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
}

interface RestaurantShareActionsProps {
  selectedRestaurants: Restaurant[];
  onClear: () => void;
}

export function RestaurantShareActions({ selectedRestaurants, onClear }: RestaurantShareActionsProps) {
  const formatRestaurantInfo = (restaurant: Restaurant) => {
    const lines = [
      `🏪 ${restaurant.name}`,
      restaurant.street && `📍 ${restaurant.street}`,
      (restaurant.postal_code || restaurant.city) && `   ${restaurant.postal_code || ''} ${restaurant.city || ''}`.trim(),
      restaurant.restaurant_phone && `📞 ${restaurant.restaurant_phone}`,
      restaurant.restaurant_email && `✉️ ${restaurant.restaurant_email}`,
      (restaurant.manager_first_name || restaurant.manager_last_name) && 
        `👤 Gérant: ${restaurant.manager_first_name || ''} ${restaurant.manager_last_name || ''}`.trim(),
    ].filter(Boolean);
    return lines.join('\n');
  };

  const formatAllRestaurants = () => {
    return selectedRestaurants.map(formatRestaurantInfo).join('\n\n---\n\n');
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(formatAllRestaurants());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleShareTelegram = () => {
    const text = encodeURIComponent(formatAllRestaurants());
    window.open(`https://telegram.me/share/msg?text=${text}`, '_blank');
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
      </div>
      <Button variant="ghost" size="icon" onClick={onClear} className="h-8 w-8">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
