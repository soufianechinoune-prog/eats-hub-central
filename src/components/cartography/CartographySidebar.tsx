import { useState, useEffect, useRef } from "react";
import { RestaurantWithGeo, SimulatedLocation, CannibalismAlert } from "@/pages/Cartography";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  MapPin, 
  AlertTriangle, 
  Target, 
  Navigation, 
  Trash2, 
  Search,
  MapPinOff,
  Locate,
  Play,
  EyeOff,
  Eye,
  X,
  RotateCcw,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DENSITY_LEGEND } from "@/data/france-population-density";

interface CartographySidebarProps {
  restaurants: RestaurantWithGeo[];
  simulatedLocations: SimulatedLocation[];
  cannibalismAlerts: CannibalismAlert[];
  ignoredAlerts: CannibalismAlert[];
  showIgnoredAlerts: boolean;
  showDensityLayer: boolean;
  selectedRestaurantId: string | null;
  isSimulationMode: boolean;
  onSelectRestaurant: (id: string | null) => void;
  onFocusRestaurant: (id: string) => void;
  onRadiusChange: (id: string, radius: number) => void;
  onRemoveSimulation: (id: string) => void;
  onUpdateSimulationRadius: (id: string, radius: number) => void;
  onToggleSimulationMode: () => void;
  onToggleDensityLayer: () => void;
  onGeocodeRestaurant: (id: string) => void;
  onIgnoreAlert: (alert: CannibalismAlert) => void;
  onRestoreAlert: (alert: CannibalismAlert) => void;
  onIgnoreAllAlerts: () => void;
  onRestoreAllAlerts: () => void;
  onToggleShowIgnored: () => void;
}

export const CartographySidebar = ({
  restaurants,
  simulatedLocations,
  cannibalismAlerts,
  ignoredAlerts,
  showIgnoredAlerts,
  showDensityLayer,
  selectedRestaurantId,
  isSimulationMode,
  onSelectRestaurant,
  onFocusRestaurant,
  onRadiusChange,
  onRemoveSimulation,
  onUpdateSimulationRadius,
  onToggleSimulationMode,
  onToggleDensityLayer,
  onGeocodeRestaurant,
  onIgnoreAlert,
  onRestoreAlert,
  onIgnoreAllAlerts,
  onRestoreAllAlerts,
  onToggleShowIgnored,
}: CartographySidebarProps) => {
  const [search, setSearch] = useState("");
  const [localRadii, setLocalRadii] = useState<Record<string, number>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scroll to selected restaurant when selection changes from map
  useEffect(() => {
    if (selectedRestaurantId && cardRefs.current[selectedRestaurantId]) {
      cardRefs.current[selectedRestaurantId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedRestaurantId]);

  const geocodedRestaurants = restaurants.filter(r => r.latitude && r.longitude);
  const unGeocodedRestaurants = restaurants.filter(r => !r.latitude || !r.longitude);

  const filteredGeocoded = geocodedRestaurants.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.city?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUnGeocoded = unGeocodedRestaurants.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.city?.toLowerCase().includes(search.toLowerCase())
  );

  const handleRadiusSlide = (id: string, value: number) => {
    setLocalRadii(prev => ({ ...prev, [id]: value }));
  };

  const handleRadiusCommit = (id: string) => {
    const value = localRadii[id];
    if (value !== undefined) {
      onRadiusChange(id, value);
      setLocalRadii(prev => {
        const newRadii = { ...prev };
        delete newRadii[id];
        return newRadii;
      });
    }
  };

  return (
    <div className="w-80 flex flex-col border rounded-xl bg-card">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un restaurant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          onClick={onToggleSimulationMode}
          variant={isSimulationMode ? "default" : "outline"}
          className="w-full"
        >
          <Play className="h-4 w-4 mr-2" />
          {isSimulationMode ? "Mode simulation actif" : "Simuler une implantation"}
        </Button>
        
        {/* Density Layer Toggle */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="density-toggle" className="text-sm font-medium cursor-pointer">
              Densité population
            </Label>
          </div>
          <Switch
            id="density-toggle"
            checked={showDensityLayer}
            onCheckedChange={onToggleDensityLayer}
          />
        </div>

        {/* Density Legend */}
        {showDensityLayer && (
          <div className="space-y-2 p-2 rounded-lg border bg-background">
            <p className="text-xs font-medium text-muted-foreground">Légende densité (hab/km²)</p>
            <div className="grid grid-cols-2 gap-1">
              {DENSITY_LEGEND.map((item) => (
                <div key={item.min} className="flex items-center gap-1.5">
                  <div 
                    className="w-3 h-3 rounded-sm" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="restaurants" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-4 grid grid-cols-3">
          <TabsTrigger value="restaurants" className="text-xs">
            <MapPin className="h-3 w-3 mr-1" />
            Restos ({geocodedRestaurants.length})
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Alertes ({cannibalismAlerts.length}{ignoredAlerts.length > 0 ? `/${cannibalismAlerts.length + ignoredAlerts.length}` : ''})
          </TabsTrigger>
          <TabsTrigger value="ungeo" className="text-xs">
            <MapPinOff className="h-3 w-3 mr-1" />
            ({unGeocodedRestaurants.length})
          </TabsTrigger>
        </TabsList>

        {/* Restaurants Tab */}
        <TabsContent value="restaurants" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {/* Simulated locations first */}
              {simulatedLocations.map(loc => (
                <Card
                  key={loc.id}
                  className="border-primary/50 bg-primary/5"
                >
                  <CardHeader className="p-3 pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-medium">{loc.name}</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onRemoveSimulation(loc.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{loc.address}</p>
                    <Badge variant="outline" className="w-fit text-xs border-primary text-primary">
                      Simulation
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Rayon de couverture</span>
                        <span className="font-medium">{loc.coverage_radius_km} km</span>
                      </div>
                      <Slider
                        value={[loc.coverage_radius_km]}
                        min={1}
                        max={10}
                        step={0.5}
                        onValueChange={(value) => onUpdateSimulationRadius(loc.id, value[0])}
                        className="w-full"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Actual restaurants */}
              {filteredGeocoded.map(restaurant => {
                const isSelected = restaurant.id === selectedRestaurantId;
                const currentRadius = localRadii[restaurant.id] ?? restaurant.coverage_radius_km ?? 4;
                const hasAlert = cannibalismAlerts.some(
                  a => a.restaurant1 === restaurant.name || a.restaurant2 === restaurant.name
                );

                return (
                  <Card
                    key={restaurant.id}
                    ref={(el) => { cardRefs.current[restaurant.id] = el; }}
                    className={cn(
                      "cursor-pointer transition-all",
                      isSelected && "ring-2 ring-primary",
                      hasAlert && "border-destructive/50"
                    )}
                    onClick={() => {
                      onSelectRestaurant(restaurant.id);
                      onFocusRestaurant(restaurant.id);
                    }}
                  >
                    <CardHeader className="p-3 pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className={cn(
                            "h-4 w-4",
                            hasAlert ? "text-destructive" : "text-emerald-500"
                          )} />
                          <CardTitle className="text-sm font-medium">{restaurant.name}</CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocusRestaurant(restaurant.id);
                          }}
                        >
                          <Navigation className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[restaurant.street, restaurant.postal_code, restaurant.city]
                          .filter(Boolean)
                          .join(", ") || "Adresse non renseignée"}
                      </p>
                      {hasAlert && (
                        <Badge variant="destructive" className="w-fit text-xs">
                          Chevauchement
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Rayon de couverture</span>
                          <span className="font-medium">{currentRadius} km</span>
                        </div>
                        <Slider
                          value={[currentRadius]}
                          min={1}
                          max={10}
                          step={0.5}
                          onValueChange={(value) => handleRadiusSlide(restaurant.id, value[0])}
                          onValueCommit={() => handleRadiusCommit(restaurant.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {filteredGeocoded.length === 0 && simulatedLocations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun restaurant géolocalisé</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {/* Global controls */}
              {(cannibalismAlerts.length > 0 || ignoredAlerts.length > 0) && (
                <div className="flex items-center gap-2 pb-2 border-b">
                  {cannibalismAlerts.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs flex-1"
                      onClick={onIgnoreAllAlerts}
                    >
                      <EyeOff className="h-3 w-3 mr-1" />
                      Tout ignorer
                    </Button>
                  )}
                  {ignoredAlerts.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs flex-1"
                      onClick={onRestoreAllAlerts}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Tout restaurer
                    </Button>
                  )}
                </div>
              )}

              {/* Active alerts */}
              {cannibalismAlerts.length === 0 && ignoredAlerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucun chevauchement détecté</p>
                  <p className="text-xs mt-1">Vos zones de couverture sont bien séparées</p>
                </div>
              ) : cannibalismAlerts.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <EyeOff className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Tous les chevauchements sont ignorés</p>
                </div>
              ) : (
                cannibalismAlerts.map((alert, index) => (
                  <Card key={index} className="border-destructive/30 bg-destructive/5">
                    <CardHeader className="p-3 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          <CardTitle className="text-sm font-medium text-destructive">
                            Cannibalisme
                          </CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => onIgnoreAlert(alert)}
                          title="Ignorer ce chevauchement"
                        >
                          <EyeOff className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-xs">{alert.restaurant1}</span>
                        <span className="text-muted-foreground">↔</span>
                        <span className="font-medium text-xs">{alert.restaurant2}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Distance: {alert.distance} km</span>
                        <Badge variant="destructive" className="text-xs">
                          {alert.overlapPercentage}%
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              {/* Ignored alerts section */}
              {ignoredAlerts.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={onToggleShowIgnored}
                  >
                    {showIgnoredAlerts ? (
                      <>
                        <Eye className="h-3 w-3 mr-1" />
                        Masquer les ignorés ({ignoredAlerts.length})
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3 mr-1" />
                        Voir les ignorés ({ignoredAlerts.length})
                      </>
                    )}
                  </Button>

                  {showIgnoredAlerts && (
                    <div className="space-y-2 pt-2 border-t border-dashed">
                      {ignoredAlerts.map((alert, index) => (
                        <Card key={`ignored-${index}`} className="border-muted bg-muted/20 opacity-60">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <EyeOff className="h-3 w-3" />
                                <span>Ignoré</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                onClick={() => onRestoreAlert(alert)}
                                title="Restaurer ce chevauchement"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium">{alert.restaurant1}</span>
                              <span className="text-muted-foreground">↔</span>
                              <span className="font-medium">{alert.restaurant2}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Un-geocoded Tab */}
        <TabsContent value="ungeo" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {filteredUnGeocoded.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Tous les restaurants sont géolocalisés</p>
                </div>
              ) : (
                filteredUnGeocoded.map(restaurant => (
                  <Card key={restaurant.id} className="border-amber-500/30 bg-amber-500/5">
                    <CardHeader className="p-3 pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <MapPinOff className="h-4 w-4 text-amber-500" />
                          <CardTitle className="text-sm font-medium">{restaurant.name}</CardTitle>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[restaurant.street, restaurant.postal_code, restaurant.city]
                          .filter(Boolean)
                          .join(", ") || "Adresse non renseignée"}
                      </p>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => onGeocodeRestaurant(restaurant.id)}
                        disabled={!restaurant.street && !restaurant.postal_code && !restaurant.city}
                      >
                        <Locate className="h-3 w-3 mr-2" />
                        Géolocaliser
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
