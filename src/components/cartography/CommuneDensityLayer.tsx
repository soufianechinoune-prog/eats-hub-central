import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { 
  DENS7_LEVELS, 
  generateCommuneDensityGeoJSON,
  getDens7Color 
} from "@/data/insee-communes-density";

interface InseeDensityData {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
    properties: {
      population: number;
      id: string;
    };
  }>;
}

interface CommuneDensityLayerProps {
  map: mapboxgl.Map | null;
  mapLoaded: boolean;
  visible: boolean;
  filteredLevels: number[];
  apiData?: InseeDensityData | null;
}

export const CommuneDensityLayer = ({
  map,
  mapLoaded,
  visible,
  filteredLevels,
  apiData,
}: CommuneDensityLayerProps) => {
  const sourceIdRef = useRef("commune-density-source");
  const layerIdRef = useRef("commune-density-layer");
  const labelLayerIdRef = useRef("commune-density-labels");

  useEffect(() => {
    if (!map || !mapLoaded) return;

    const sourceId = sourceIdRef.current;
    const heatmapLayerId = layerIdRef.current;
    const labelLayerId = labelLayerIdRef.current;

    // Remove existing layers and source
    const cleanup = () => {
      // Check if map and style are still valid before accessing layers
      if (!map || !map.getStyle()) return;
      
      try {
        if (map.getLayer(labelLayerId)) {
          map.removeLayer(labelLayerId);
        }
        if (map.getLayer(heatmapLayerId)) {
          map.removeLayer(heatmapLayerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      } catch (error) {
        // Ignore errors during cleanup if map is being destroyed
        console.debug("Cleanup error (expected during map destruction):", error);
      }
    };

    if (!visible) {
      cleanup();
      return;
    }

    // Use API data if available, otherwise fall back to local data
    const geojson = apiData && apiData.features.length > 0 
      ? apiData 
      : generateCommuneDensityGeoJSON(filteredLevels);

    console.log(`Using ${apiData && apiData.features.length > 0 ? 'API' : 'local'} density data with ${geojson.features.length} points`);

    // Clean up before adding new layers
    cleanup();

    // Add source
    map.addSource(sourceId, {
      type: "geojson",
      data: geojson,
    });

    // Add heatmap layer for density visualization
    map.addLayer({
      id: heatmapLayerId,
      type: "heatmap",
      source: sourceId,
      paint: {
        // Weight based on population - normalized for heatmap
        "heatmap-weight": [
          "interpolate",
          ["linear"],
          ["get", "population"],
          10000, 0.1,
          50000, 0.3,
          100000, 0.5,
          500000, 0.8,
          2000000, 1
        ],
        // Intensity increases with zoom
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4, 0.5,
          8, 1.5,
          12, 2.5
        ],
        // Color gradient from blue (low) to red (high density)
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(0, 0, 255, 0)",
          0.1, "rgba(65, 105, 225, 0.4)",
          0.3, "rgba(0, 191, 255, 0.5)",
          0.5, "rgba(50, 205, 50, 0.6)",
          0.7, "rgba(255, 165, 0, 0.7)",
          0.9, "rgba(255, 69, 0, 0.8)",
          1, "rgba(178, 34, 34, 0.9)"
        ],
        // Radius increases with zoom
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4, 15,
          8, 30,
          12, 50,
          15, 80
        ],
        // Fade out at high zoom to show individual points
        "heatmap-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10, 0.8,
          15, 0.4
        ]
      }
    }, "waterway-label"); // Insert below labels

    // Add labels for larger communes at higher zoom
    map.addLayer({
      id: labelLayerId,
      type: "symbol",
      source: sourceId,
      minzoom: 9,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          9, 10,
          12, 13,
        ],
        "text-offset": [0, 0],
        "text-anchor": "center",
        "text-allow-overlap": false,
        "text-ignore-placement": false,
      },
      paint: {
        "text-color": "#1a1a2e",
        "text-halo-color": "#fff",
        "text-halo-width": 2,
      },
      filter: [">", ["get", "population"], 50000],
    });

    return cleanup;
  }, [map, mapLoaded, visible, filteredLevels, apiData]);

  return null;
};

// Legend component for the heatmap layer
export const CommuneDensityLegend = ({
  filteredLevels,
  onToggleLevel,
}: {
  filteredLevels: number[];
  onToggleLevel: (level: number) => void;
}) => {
  return (
    <div className="space-y-3 p-3 rounded-lg border bg-background">
      <p className="text-xs font-medium text-muted-foreground">
        Densité population (heatmap)
      </p>
      
      {/* Gradient legend */}
      <div className="space-y-1">
        <div 
          className="h-3 rounded-full w-full"
          style={{
            background: "linear-gradient(to right, rgba(65, 105, 225, 0.6), rgba(0, 191, 255, 0.7), rgba(50, 205, 50, 0.8), rgba(255, 165, 0, 0.9), rgba(255, 69, 0, 1))"
          }}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Faible</span>
          <span>Élevée</span>
        </div>
      </div>

      <div className="pt-2 border-t">
        <p className="text-[10px] text-muted-foreground">
          Zones chaudes = forte densité urbaine
        </p>
      </div>
    </div>
  );
};
