import { useState } from "react";
import { SimulatedLocation } from "@/pages/Cartography";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { X, Target, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SimulationPanelProps {
  onAddSimulation: (location: SimulatedLocation) => void;
  onClose: () => void;
}

export const SimulationPanel = ({ onAddSimulation, onClose }: SimulationPanelProps) => {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState(4);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !address.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: { address }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      const newLocation: SimulatedLocation = {
        id: `sim-${Date.now()}`,
        name: name.trim(),
        address: data.placeName || address,
        latitude: data.latitude,
        longitude: data.longitude,
        coverage_radius_km: radius,
      };
      
      onAddSimulation(newLocation);
      toast.success("Simulation ajoutée");
      
      // Reset form
      setName("");
      setAddress("");
      setRadius(4);
      
    } catch (error: any) {
      toast.error(`Erreur de géocodage: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="absolute top-4 right-4 w-80 shadow-lg border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Simuler une implantation</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sim-name">Nom du projet</Label>
            <Input
              id="sim-name"
              placeholder="Ex: Projet Lyon Part-Dieu"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sim-address">Adresse</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="sim-address"
                placeholder="Ex: 17 rue de la République, 69001 Lyon"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="pl-9"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Rayon de couverture</Label>
              <span className="text-sm font-medium">{radius} km</span>
            </div>
            <Slider
              value={[radius]}
              min={1}
              max={10}
              step={0.5}
              onValueChange={(value) => setRadius(value[0])}
              disabled={isLoading}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || !name.trim() || !address.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Géocodage en cours...
              </>
            ) : (
              <>
                <Target className="h-4 w-4 mr-2" />
                Ajouter à la carte
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
