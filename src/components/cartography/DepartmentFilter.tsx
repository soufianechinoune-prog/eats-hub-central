import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, X, ChevronDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

// French department names
const DEPARTMENT_NAMES: Record<string, string> = {
  "01": "Ain", "02": "Aisne", "03": "Allier", "04": "Alpes-de-Haute-Provence",
  "05": "Hautes-Alpes", "06": "Alpes-Maritimes", "07": "Ardèche", "08": "Ardennes",
  "09": "Ariège", "10": "Aube", "11": "Aude", "12": "Aveyron",
  "13": "Bouches-du-Rhône", "14": "Calvados", "15": "Cantal", "16": "Charente",
  "17": "Charente-Maritime", "18": "Cher", "19": "Corrèze", "21": "Côte-d'Or",
  "22": "Côtes-d'Armor", "23": "Creuse", "24": "Dordogne", "25": "Doubs",
  "26": "Drôme", "27": "Eure", "28": "Eure-et-Loir", "29": "Finistère",
  "2A": "Corse-du-Sud", "2B": "Haute-Corse", "30": "Gard", "31": "Haute-Garonne",
  "32": "Gers", "33": "Gironde", "34": "Hérault", "35": "Ille-et-Vilaine",
  "36": "Indre", "37": "Indre-et-Loire", "38": "Isère", "39": "Jura",
  "40": "Landes", "41": "Loir-et-Cher", "42": "Loire", "43": "Haute-Loire",
  "44": "Loire-Atlantique", "45": "Loiret", "46": "Lot", "47": "Lot-et-Garonne",
  "48": "Lozère", "49": "Maine-et-Loire", "50": "Manche", "51": "Marne",
  "52": "Haute-Marne", "53": "Mayenne", "54": "Meurthe-et-Moselle", "55": "Meuse",
  "56": "Morbihan", "57": "Moselle", "58": "Nièvre", "59": "Nord",
  "60": "Oise", "61": "Orne", "62": "Pas-de-Calais", "63": "Puy-de-Dôme",
  "64": "Pyrénées-Atlantiques", "65": "Hautes-Pyrénées", "66": "Pyrénées-Orientales",
  "67": "Bas-Rhin", "68": "Haut-Rhin", "69": "Rhône", "70": "Haute-Saône",
  "71": "Saône-et-Loire", "72": "Sarthe", "73": "Savoie", "74": "Haute-Savoie",
  "75": "Paris", "76": "Seine-Maritime", "77": "Seine-et-Marne", "78": "Yvelines",
  "79": "Deux-Sèvres", "80": "Somme", "81": "Tarn", "82": "Tarn-et-Garonne",
  "83": "Var", "84": "Vaucluse", "85": "Vendée", "86": "Vienne",
  "87": "Haute-Vienne", "88": "Vosges", "89": "Yonne", "90": "Territoire de Belfort",
  "91": "Essonne", "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis",
  "94": "Val-de-Marne", "95": "Val-d'Oise",
  "971": "Guadeloupe", "972": "Martinique", "973": "Guyane",
  "974": "La Réunion", "976": "Mayotte",
};

// French regions and their departments
const REGIONS: Record<string, { name: string; departments: string[] }> = {
  "idf": { name: "Île-de-France", departments: ["75", "77", "78", "91", "92", "93", "94", "95"] },
  "aura": { name: "Auvergne-Rhône-Alpes", departments: ["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"] },
  "bfc": { name: "Bourgogne-Franche-Comté", departments: ["21", "25", "39", "58", "70", "71", "89", "90"] },
  "bre": { name: "Bretagne", departments: ["22", "29", "35", "56"] },
  "cvl": { name: "Centre-Val de Loire", departments: ["18", "28", "36", "37", "41", "45"] },
  "cor": { name: "Corse", departments: ["2A", "2B"] },
  "ges": { name: "Grand Est", departments: ["08", "10", "51", "52", "54", "55", "57", "67", "68", "88"] },
  "hdf": { name: "Hauts-de-France", departments: ["02", "59", "60", "62", "80"] },
  "nor": { name: "Normandie", departments: ["14", "27", "50", "61", "76"] },
  "naq": { name: "Nouvelle-Aquitaine", departments: ["16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87"] },
  "occ": { name: "Occitanie", departments: ["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"] },
  "pdl": { name: "Pays de la Loire", departments: ["44", "49", "53", "72", "85"] },
  "pac": { name: "Provence-Alpes-Côte d'Azur", departments: ["04", "05", "06", "13", "83", "84"] },
  "dom": { name: "DOM-TOM", departments: ["971", "972", "973", "974", "976"] },
};

interface DepartmentFilterProps {
  restaurants: Array<{ postal_code: string | null }>;
  selectedDepartments: string[];
  onSelectionChange: (departments: string[]) => void;
}

export const DepartmentFilter = ({
  restaurants,
  selectedDepartments,
  onSelectionChange,
}: DepartmentFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Extract available departments from restaurants
  const availableDepartments = useMemo(() => {
    const deptCounts: Record<string, number> = {};
    restaurants.forEach(r => {
      if (r.postal_code) {
        const dept = r.postal_code.substring(0, 2);
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      }
    });
    return deptCounts;
  }, [restaurants]);

  // Filter departments by search
  const filteredDepartments = useMemo(() => {
    const searchLower = search.toLowerCase();
    return Object.entries(availableDepartments)
      .filter(([dept]) => {
        const name = DEPARTMENT_NAMES[dept] || dept;
        return dept.includes(searchLower) || name.toLowerCase().includes(searchLower);
      })
      .sort((a, b) => b[1] - a[1]); // Sort by count
  }, [availableDepartments, search]);

  // Get available regions (regions that have at least one department with restaurants)
  const availableRegions = useMemo(() => {
    return Object.entries(REGIONS).filter(([, region]) =>
      region.departments.some(dept => availableDepartments[dept])
    );
  }, [availableDepartments]);

  const toggleDepartment = (dept: string) => {
    if (selectedDepartments.includes(dept)) {
      onSelectionChange(selectedDepartments.filter(d => d !== dept));
    } else {
      onSelectionChange([...selectedDepartments, dept]);
    }
  };

  const selectRegion = (regionKey: string) => {
    const region = REGIONS[regionKey];
    const regionDepts = region.departments.filter(d => availableDepartments[d]);
    const allSelected = regionDepts.every(d => selectedDepartments.includes(d));
    
    if (allSelected) {
      onSelectionChange(selectedDepartments.filter(d => !regionDepts.includes(d)));
    } else {
      const newSelection = [...new Set([...selectedDepartments, ...regionDepts])];
      onSelectionChange(newSelection);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
    setIsOpen(false);
  };

  const selectAll = () => {
    onSelectionChange(Object.keys(availableDepartments));
  };

  const totalFiltered = selectedDepartments.reduce(
    (sum, dept) => sum + (availableDepartments[dept] || 0),
    0
  );

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-between h-9 text-sm",
              selectedDepartments.length > 0 && "border-primary/50 bg-primary/5"
            )}
          >
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5" />
              <span>
                {selectedDepartments.length === 0
                  ? "Filtrer par département"
                  : `${selectedDepartments.length} département${selectedDepartments.length > 1 ? "s" : ""}`
                }
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-3 border-b space-y-2">
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={selectAll}>
                Tout sélectionner
              </Button>
              <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={clearAll}>
                Effacer
              </Button>
            </div>
          </div>

          <ScrollArea className="h-64">
            <div className="p-2 space-y-3">
              {/* Regions */}
              {!search && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase px-2">Régions</p>
                  {availableRegions.map(([key, region]) => {
                    const regionDepts = region.departments.filter(d => availableDepartments[d]);
                    const selectedCount = regionDepts.filter(d => selectedDepartments.includes(d)).length;
                    const totalCount = regionDepts.length;
                    const isPartial = selectedCount > 0 && selectedCount < totalCount;
                    const isAllSelected = selectedCount === totalCount;

                    return (
                      <button
                        key={key}
                        className={cn(
                          "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors",
                          isAllSelected && "bg-primary/10"
                        )}
                        onClick={() => selectRegion(key)}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={isAllSelected}
                            className={cn(isPartial && "data-[state=unchecked]:bg-primary/30")}
                          />
                          <span className="font-medium">{region.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {selectedCount > 0 ? `${selectedCount}/` : ""}{totalCount}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Departments */}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase px-2">
                  Départements {search && `(${filteredDepartments.length})`}
                </p>
                {filteredDepartments.map(([dept, count]) => (
                  <button
                    key={dept}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1 rounded-md text-sm hover:bg-muted transition-colors",
                      selectedDepartments.includes(dept) && "bg-primary/10"
                    )}
                    onClick={() => toggleDepartment(dept)}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={selectedDepartments.includes(dept)} />
                      <span className="text-muted-foreground font-mono text-xs">{dept}</span>
                      <span>{DEPARTMENT_NAMES[dept] || "Inconnu"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span className="text-xs">{count}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Selected badges */}
      {selectedDepartments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedDepartments.slice(0, 4).map(dept => (
            <Badge
              key={dept}
              variant="secondary"
              className="text-xs h-5 pl-1.5 pr-1 gap-1 cursor-pointer hover:bg-destructive/20"
              onClick={() => toggleDepartment(dept)}
            >
              {dept}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          {selectedDepartments.length > 4 && (
            <Badge variant="outline" className="text-xs h-5">
              +{selectedDepartments.length - 4}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs h-5 bg-muted">
            {totalFiltered} resto{totalFiltered > 1 ? "s" : ""}
          </Badge>
        </div>
      )}
    </div>
  );
};
