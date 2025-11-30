import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { RestaurantWithGeo, SimulatedLocation } from "@/pages/Cartography";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { Loader2, AlertCircle } from "lucide-react";

interface CartographyMapProps {
  restaurants: RestaurantWithGeo[];
  simulatedLocations: SimulatedLocation[];
  selectedRestaurantId: string | null;
  center: [number, number];
  zoom: number;
  onSelectRestaurant: (id: string | null) => void;
}

export const CartographyMap = ({
  restaurants,
  simulatedLocations,
  selectedRestaurantId,
  center,
  zoom,
  onSelectRestaurant,
}: CartographyMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const circleSourcesRef = useRef<string[]>([]);

  const { token, isLoading: tokenLoading, error: tokenError } = useMapboxToken();

  // Initialize map when token is available
  useEffect(() => {
    if (!mapContainer.current || !token || map.current) return;

    console.log("Initializing map with token...");

    try {
      mapboxgl.accessToken = token;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: center,
        zoom: zoom,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.current.addControl(new mapboxgl.FullscreenControl(), "top-right");

      map.current.on("load", () => {
        console.log("Map loaded successfully");
        setMapLoaded(true);
      });

      map.current.on("error", (e) => {
        console.error("Map error:", e);
      });

      map.current.on("click", () => {
        onSelectRestaurant(null);
      });
    } catch (err) {
      console.error('Error initializing map:', err);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [token]);

  // Update map center and zoom
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    map.current.flyTo({ center, zoom, duration: 1000 });
  }, [center, zoom, mapLoaded]);

  // Render markers and coverage circles
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Clear existing circle sources
    circleSourcesRef.current.forEach(sourceId => {
      if (map.current?.getLayer(`${sourceId}-fill`)) {
        map.current.removeLayer(`${sourceId}-fill`);
      }
      if (map.current?.getLayer(`${sourceId}-outline`)) {
        map.current.removeLayer(`${sourceId}-outline`);
      }
      if (map.current?.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });
    circleSourcesRef.current = [];

    // Helper to create a circle polygon
    const createCircle = (lng: number, lat: number, radiusKm: number, points = 64) => {
      const coords: [number, number][] = [];
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        const dx = radiusKm * Math.cos(angle);
        const dy = radiusKm * Math.sin(angle);
        const latOffset = dy / 111;
        const lngOffset = dx / (111 * Math.cos(lat * Math.PI / 180));
        coords.push([lng + lngOffset, lat + latOffset]);
      }
      coords.push(coords[0]);
      return coords;
    };

    // All locations
    const allLocations = [
      ...restaurants.map(r => ({
        id: r.id,
        name: r.name,
        lat: r.latitude!,
        lng: r.longitude!,
        radius: r.coverage_radius_km || 4,
        isSimulated: false,
      })),
      ...simulatedLocations.map(s => ({
        id: s.id,
        name: s.name,
        lat: s.latitude,
        lng: s.longitude,
        radius: s.coverage_radius_km,
        isSimulated: true,
      })),
    ];

    // Calculate overlaps
    const hasOverlap = new Set<string>();
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    for (let i = 0; i < allLocations.length; i++) {
      for (let j = i + 1; j < allLocations.length; j++) {
        const loc1 = allLocations[i];
        const loc2 = allLocations[j];
        const distance = calculateDistance(loc1.lat, loc1.lng, loc2.lat, loc2.lng);
        if (distance < loc1.radius + loc2.radius) {
          hasOverlap.add(loc1.id);
          hasOverlap.add(loc2.id);
        }
      }
    }

    // Render coverage circles
    allLocations.forEach((loc) => {
      const sourceId = `circle-${loc.id}`;
      const circleCoords = createCircle(loc.lng, loc.lat, loc.radius);
      const isOverlapping = hasOverlap.has(loc.id);
      const isSelected = loc.id === selectedRestaurantId;

      map.current!.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [circleCoords],
          },
        },
      });

      const fillColor = loc.isSimulated 
        ? "rgba(59, 130, 246, 0.15)"
        : isOverlapping 
          ? "rgba(239, 68, 68, 0.2)"
          : "rgba(34, 197, 94, 0.15)";

      map.current!.addLayer({
        id: `${sourceId}-fill`,
        type: "fill",
        source: sourceId,
        paint: { "fill-color": fillColor },
      });

      const outlineColor = loc.isSimulated
        ? "#3b82f6"
        : isOverlapping
          ? "#ef4444"
          : "#22c55e";

      map.current!.addLayer({
        id: `${sourceId}-outline`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": outlineColor,
          "line-width": isSelected ? 3 : 1.5,
          "line-dasharray": loc.isSimulated ? [2, 2] : [1],
        },
      });

      circleSourcesRef.current.push(sourceId);
    });

    // Render markers
    allLocations.forEach(loc => {
      const isOverlapping = hasOverlap.has(loc.id);
      const isSelected = loc.id === selectedRestaurantId;

      const el = document.createElement("div");
      el.className = "flex items-center justify-center";
      el.style.width = isSelected ? "36px" : "28px";
      el.style.height = isSelected ? "36px" : "28px";
      el.style.borderRadius = "50%";
      el.style.cursor = "pointer";
      el.style.transition = "all 0.2s ease";
      
      if (loc.isSimulated) {
        el.style.backgroundColor = "#3b82f6";
        el.style.border = "3px dashed white";
      } else if (isOverlapping) {
        el.style.backgroundColor = "#ef4444";
        el.style.border = "3px solid white";
      } else {
        el.style.backgroundColor = "#22c55e";
        el.style.border = "3px solid white";
      }
      
      el.style.boxShadow = isSelected 
        ? "0 0 0 3px rgba(59, 130, 246, 0.5), 0 4px 12px rgba(0,0,0,0.3)"
        : "0 2px 8px rgba(0,0,0,0.2)";

      const inner = document.createElement("div");
      inner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
      el.appendChild(inner);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([loc.lng, loc.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25, closeButton: false })
            .setHTML(`
              <div style="font-family: system-ui; padding: 4px;">
                <strong style="font-size: 14px;">${loc.name}</strong>
                <p style="margin: 4px 0 0; font-size: 12px; color: #666;">
                  Rayon: ${loc.radius} km
                  ${loc.isSimulated ? '<br/><span style="color: #3b82f6;">📍 Simulation</span>' : ''}
                  ${isOverlapping ? '<br/><span style="color: #ef4444;">⚠️ Chevauchement détecté</span>' : ''}
                </p>
              </div>
            `)
        )
        .addTo(map.current!);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRestaurant(loc.id);
      });

      markersRef.current.push(marker);
    });
  }, [restaurants, simulatedLocations, mapLoaded, selectedRestaurantId, onSelectRestaurant]);

  // Loading state
  if (tokenLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (tokenError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <p className="text-lg font-medium text-destructive">Erreur de chargement</p>
            <p className="text-sm text-muted-foreground mt-1">{tokenError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
};
