import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CartographyMap } from "@/components/cartography/CartographyMap";
import { CartographySidebar } from "@/components/cartography/CartographySidebar";
import { SimulationPanel } from "@/components/cartography/SimulationPanel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RestaurantWithGeo {
  id: string;
  name: string;
  city: string | null;
  street: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  coverage_radius_km: number;
  is_active: boolean | null;
}

export interface SimulatedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  coverage_radius_km: number;
}

export interface CannibalismAlert {
  restaurant1: string;
  restaurant2: string;
  distance: number;
  overlapPercentage: number;
}

const Cartography = () => {
  const queryClient = useQueryClient();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [simulatedLocations, setSimulatedLocations] = useState<SimulatedLocation[]>([]);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([2.3522, 46.6034]); // France center
  const [mapZoom, setMapZoom] = useState(5.5);
  const [ignoredAlerts, setIgnoredAlerts] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('cartography-ignored-alerts');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [showIgnoredAlerts, setShowIgnoredAlerts] = useState(false);
  const [showDensityLayer, setShowDensityLayer] = useState(false);
  const [showCommuneDensity, setShowCommuneDensity] = useState(false);
  const [communeDensityLevels, setCommuneDensityLevels] = useState<number[]>([1, 2, 3, 4]);

  const handleToggleCommuneDensityLevel = (level: number) => {
    setCommuneDensityLevels(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level].sort((a, b) => a - b)
    );
  };

  // Persist ignored alerts
  useEffect(() => {
    localStorage.setItem('cartography-ignored-alerts', JSON.stringify([...ignoredAlerts]));
  }, [ignoredAlerts]);

  const getAlertKey = (alert: CannibalismAlert) => 
    [alert.restaurant1, alert.restaurant2].sort().join('|');

  const handleIgnoreAlert = (alert: CannibalismAlert) => {
    setIgnoredAlerts(prev => new Set([...prev, getAlertKey(alert)]));
  };

  const handleRestoreAlert = (alert: CannibalismAlert) => {
    setIgnoredAlerts(prev => {
      const newSet = new Set(prev);
      newSet.delete(getAlertKey(alert));
      return newSet;
    });
  };

  const handleIgnoreAllAlerts = () => {
    const allKeys = cannibalismAlerts().map(getAlertKey);
    setIgnoredAlerts(new Set(allKeys));
  };

  const handleRestoreAllAlerts = () => {
    setIgnoredAlerts(new Set());
  };

  // Fetch restaurants with geo data
  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ["restaurants-geo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, city, street, postal_code, latitude, longitude, coverage_radius_km, is_active")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as RestaurantWithGeo[];
    },
  });

  // Mutation to update restaurant radius
  const updateRadiusMutation = useMutation({
    mutationFn: async ({ id, radius }: { id: string; radius: number }) => {
      const { error } = await supabase
        .from("restaurants")
        .update({ coverage_radius_km: radius })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurants-geo"] });
    },
  });

  // Mutation to update restaurant coordinates
  const updateCoordinatesMutation = useMutation({
    mutationFn: async ({ id, latitude, longitude }: { id: string; latitude: number; longitude: number }) => {
      const { error } = await supabase
        .from("restaurants")
        .update({ latitude, longitude })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurants-geo"] });
      toast.success("Coordonnées mises à jour");
    },
  });

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Calculate cannibalism alerts
  const cannibalismAlerts = useCallback((): CannibalismAlert[] => {
    const alerts: CannibalismAlert[] = [];
    const allLocations = [
      ...restaurants.filter(r => r.latitude && r.longitude),
      ...simulatedLocations,
    ];

    for (let i = 0; i < allLocations.length; i++) {
      for (let j = i + 1; j < allLocations.length; j++) {
        const loc1 = allLocations[i];
        const loc2 = allLocations[j];
        
        const lat1 = loc1.latitude;
        const lon1 = loc1.longitude;
        const lat2 = loc2.latitude;
        const lon2 = loc2.longitude;
        
        if (!lat1 || !lon1 || !lat2 || !lon2) continue;
        
        const distance = calculateDistance(lat1, lon1, lat2, lon2);
        const combinedRadius = (loc1.coverage_radius_km || 4) + (loc2.coverage_radius_km || 4);
        
        if (distance < combinedRadius) {
          // Calculate overlap percentage (simplified)
          const overlapPercentage = Math.max(0, ((combinedRadius - distance) / combinedRadius) * 100);
          if (overlapPercentage > 10) {
            alerts.push({
              restaurant1: loc1.name,
              restaurant2: loc2.name,
              distance: Math.round(distance * 100) / 100,
              overlapPercentage: Math.round(overlapPercentage),
            });
          }
        }
      }
    }
    
    return alerts.sort((a, b) => b.overlapPercentage - a.overlapPercentage);
  }, [restaurants, simulatedLocations, calculateDistance]);

  const handleRadiusChange = (id: string, radius: number) => {
    updateRadiusMutation.mutate({ id, radius });
  };

  const handleAddSimulation = (location: SimulatedLocation) => {
    setSimulatedLocations(prev => [...prev, location]);
    setMapCenter([location.longitude, location.latitude]);
    setMapZoom(10);
  };

  const handleRemoveSimulation = (id: string) => {
    setSimulatedLocations(prev => prev.filter(loc => loc.id !== id));
  };

  const handleUpdateSimulationRadius = (id: string, radius: number) => {
    setSimulatedLocations(prev => 
      prev.map(loc => loc.id === id ? { ...loc, coverage_radius_km: radius } : loc)
    );
  };

  const handleFocusRestaurant = (id: string) => {
    const restaurant = restaurants.find(r => r.id === id);
    if (restaurant?.latitude && restaurant?.longitude) {
      setMapCenter([restaurant.longitude, restaurant.latitude]);
      setMapZoom(12);
      setSelectedRestaurantId(id);
    }
  };

  const geocodedRestaurants = restaurants.filter(r => r.latitude && r.longitude);
  const unGeocodedRestaurants = restaurants.filter(r => !r.latitude || !r.longitude);
  const allAlerts = cannibalismAlerts();
  const activeAlerts = allAlerts.filter(a => !ignoredAlerts.has(getAlertKey(a)));
  const ignoredAlertsList = allAlerts.filter(a => ignoredAlerts.has(getAlertKey(a)));

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cartographie & Expansion</h1>
            <p className="text-sm text-muted-foreground">
              Visualisez la couverture de vos restaurants et détectez le cannibalisme
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Géolocalisés: {geocodedRestaurants.length}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">À géolocaliser: {unGeocodedRestaurants.length}</span>
            </div>
            {allAlerts.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                <span className="text-destructive font-medium">
                  {activeAlerts.length} chevauchement(s) actif(s)
                  {ignoredAlertsList.length > 0 && (
                    <span className="text-muted-foreground font-normal ml-1">
                      ({ignoredAlertsList.length} ignoré{ignoredAlertsList.length > 1 ? 's' : ''})
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 gap-4 min-h-0">
          {/* Sidebar */}
          <CartographySidebar
            restaurants={restaurants}
            simulatedLocations={simulatedLocations}
            cannibalismAlerts={activeAlerts}
            ignoredAlerts={ignoredAlertsList}
            showIgnoredAlerts={showIgnoredAlerts}
            showDensityLayer={showDensityLayer}
            showCommuneDensity={showCommuneDensity}
            communeDensityLevels={communeDensityLevels}
            selectedRestaurantId={selectedRestaurantId}
            isSimulationMode={isSimulationMode}
            onSelectRestaurant={setSelectedRestaurantId}
            onFocusRestaurant={handleFocusRestaurant}
            onRadiusChange={handleRadiusChange}
            onRemoveSimulation={handleRemoveSimulation}
            onUpdateSimulationRadius={handleUpdateSimulationRadius}
            onToggleSimulationMode={() => setIsSimulationMode(!isSimulationMode)}
            onToggleDensityLayer={() => setShowDensityLayer(!showDensityLayer)}
            onToggleCommuneDensity={() => setShowCommuneDensity(!showCommuneDensity)}
            onToggleCommuneDensityLevel={handleToggleCommuneDensityLevel}
            onIgnoreAlert={handleIgnoreAlert}
            onRestoreAlert={handleRestoreAlert}
            onIgnoreAllAlerts={handleIgnoreAllAlerts}
            onRestoreAllAlerts={handleRestoreAllAlerts}
            onToggleShowIgnored={() => setShowIgnoredAlerts(!showIgnoredAlerts)}
            onGeocodeRestaurant={async (id) => {
              const restaurant = restaurants.find(r => r.id === id);
              if (!restaurant) return;
              
              const address = [restaurant.street, restaurant.postal_code, restaurant.city]
                .filter(Boolean)
                .join(", ");
              
              if (!address) {
                toast.error("Aucune adresse renseignée pour ce restaurant");
                return;
              }

              try {
                const { data, error } = await supabase.functions.invoke('geocode-address', {
                  body: { address }
                });
                
                if (error) throw error;
                if (data.error) throw new Error(data.error);
                
                updateCoordinatesMutation.mutate({
                  id,
                  latitude: data.latitude,
                  longitude: data.longitude,
                });
              } catch (error: any) {
                toast.error(`Erreur de géocodage: ${error.message}`);
              }
            }}
          />

          {/* Map */}
          <div className="flex-1 relative rounded-xl overflow-hidden border bg-card">
            <CartographyMap
              restaurants={geocodedRestaurants}
              simulatedLocations={simulatedLocations}
              selectedRestaurantId={selectedRestaurantId}
              center={mapCenter}
              zoom={mapZoom}
              showDensityLayer={showDensityLayer}
              showCommuneDensity={showCommuneDensity}
              communeDensityLevels={communeDensityLevels}
              onSelectRestaurant={setSelectedRestaurantId}
            />
            
            {/* Simulation Panel Overlay */}
            {isSimulationMode && (
              <SimulationPanel
                onAddSimulation={handleAddSimulation}
                onClose={() => setIsSimulationMode(false)}
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Cartography;
