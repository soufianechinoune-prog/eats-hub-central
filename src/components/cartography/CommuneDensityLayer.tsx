import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { 
  DENS7_LEVELS, 
  generateCommuneDensityGeoJSON,
  getDens7Color 
} from "@/data/insee-communes-density";

interface CommuneDensityLayerProps {
  map: mapboxgl.Map | null;
  mapLoaded: boolean;
  visible: boolean;
  filteredLevels: number[];
}

export const CommuneDensityLayer = ({
  map,
  mapLoaded,
  visible,
  filteredLevels,
}: CommuneDensityLayerProps) => {
  const sourceIdRef = useRef("commune-density-source");
  const layerIdRef = useRef("commune-density-layer");
  const labelLayerIdRef = useRef("commune-density-labels");

  useEffect(() => {
    if (!map || !mapLoaded) return;

    const sourceId = sourceIdRef.current;
    const layerId = layerIdRef.current;
    const labelLayerId = labelLayerIdRef.current;

    // Remove existing layers and source
    const cleanup = () => {
      if (map.getLayer(labelLayerId)) {
        map.removeLayer(labelLayerId);
      }
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };

    if (!visible) {
      cleanup();
      return;
    }

    // Generate GeoJSON with filtered levels
    const geojson = generateCommuneDensityGeoJSON(filteredLevels);

    // Clean up before adding new layers
    cleanup();

    // Add source
    map.addSource(sourceId, {
      type: "geojson",
      data: geojson,
    });

    // Add circle layer for communes
    map.addLayer({
      id: layerId,
      type: "circle",
      source: sourceId,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5, ["interpolate", ["linear"], ["get", "population"], 10000, 4, 100000, 8, 500000, 14, 2000000, 20],
          10, ["interpolate", ["linear"], ["get", "population"], 10000, 8, 100000, 16, 500000, 28, 2000000, 40],
          15, ["interpolate", ["linear"], ["get", "population"], 10000, 16, 100000, 32, 500000, 56, 2000000, 80],
        ],
        "circle-color": ["get", "color"],
        "circle-opacity": 0.7,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
        "circle-stroke-opacity": 0.8,
      },
    });

    // Add labels for larger communes
    map.addLayer({
      id: labelLayerId,
      type: "symbol",
      source: sourceId,
      minzoom: 8,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8, 10,
          12, 14,
        ],
        "text-offset": [0, 1.5],
        "text-anchor": "top",
        "text-allow-overlap": false,
        "text-ignore-placement": false,
      },
      paint: {
        "text-color": "#333",
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
      },
      filter: [">", ["get", "population"], 30000],
    });

    // Add popup on click
    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
      if (features.length === 0) return;

      const feature = features[0];
      const props = feature.properties;
      if (!props) return;

      const levelInfo = DENS7_LEVELS.find(l => l.level === props.dens7);
      const priorityBadge = props.priority === "high" 
        ? '<span style="background:#22c55e;color:white;padding:2px 6px;border-radius:4px;font-size:10px;">Priorité haute</span>'
        : props.priority === "medium"
          ? '<span style="background:#f59e0b;color:white;padding:2px 6px;border-radius:4px;font-size:10px;">Priorité moyenne</span>'
          : '<span style="background:#6b7280;color:white;padding:2px 6px;border-radius:4px;font-size:10px;">Priorité basse</span>';

      new mapboxgl.Popup({ closeButton: true, maxWidth: "280px" })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family: system-ui; padding: 4px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${props.name}</div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="width: 12px; height: 12px; border-radius: 50%; background: ${props.color}; display: inline-block;"></span>
              <span style="font-size: 12px; color: #666;">${levelInfo?.label || 'N/A'}</span>
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
              <strong>Population:</strong> ${Number(props.population).toLocaleString('fr-FR')} hab.
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
              <strong>Département:</strong> ${props.department}
            </div>
            ${priorityBadge}
          </div>
        `)
        .addTo(map);
    };

    map.on("click", layerId, handleClick);

    // Change cursor on hover
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });

    return () => {
      map.off("click", layerId, handleClick);
      cleanup();
    };
  }, [map, mapLoaded, visible, filteredLevels]);

  return null;
};

// Legend component for the density layer
export const CommuneDensityLegend = ({
  filteredLevels,
  onToggleLevel,
}: {
  filteredLevels: number[];
  onToggleLevel: (level: number) => void;
}) => {
  return (
    <div className="space-y-2 p-3 rounded-lg border bg-background">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Densité INSEE (7 niveaux)
      </p>
      <div className="space-y-1.5">
        {DENS7_LEVELS.map((level) => {
          const isActive = filteredLevels.includes(level.level);
          return (
            <button
              key={level.level}
              onClick={() => onToggleLevel(level.level)}
              className={`w-full flex items-center gap-2 p-1.5 rounded text-left transition-colors ${
                isActive 
                  ? "bg-muted/50 hover:bg-muted" 
                  : "opacity-40 hover:opacity-60"
              }`}
            >
              <div
                className="w-4 h-4 rounded-full shrink-0 border border-white/50"
                style={{ backgroundColor: level.color }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium truncate block">
                  {level.label}
                </span>
                {level.priority !== "none" && (
                  <span className={`text-[10px] ${
                    level.priority === "high" 
                      ? "text-emerald-600" 
                      : "text-amber-600"
                  }`}>
                    {level.priority === "high" ? "★ Priorité" : "○ Potentiel"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="pt-2 border-t mt-2">
        <p className="text-[10px] text-muted-foreground">
          Cliquez pour filtrer les niveaux
        </p>
      </div>
    </div>
  );
};
