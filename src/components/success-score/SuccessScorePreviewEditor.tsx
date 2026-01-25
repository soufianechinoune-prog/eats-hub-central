import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Pencil as PencilIcon } from "lucide-react";

const TIER_OPTIONS = [
  { value: "Excellent", label: "Excellent", color: "bg-emerald-500" },
  { value: "Great", label: "Très Bon", color: "bg-blue-500" },
  { value: "Good", label: "Bon", color: "bg-amber-500" },
  { value: "Fair", label: "Correct", color: "bg-orange-500" },
  { value: "Poor", label: "Insuffisant", color: "bg-red-500" },
];

interface ParsedRow {
  [key: string]: string;
}

interface SuccessScorePreviewEditorProps {
  data: ParsedRow[];
  headers: string[];
  onDataChange: (newData: ParsedRow[]) => void;
}

// Map headers to our editable fields
const FIELD_MAPPING = {
  storeName: ["Store name", "Nom du restaurant", "Restaurant"],
  status: ["Status", "Statut", "Niveau"],
  operationalExcellence: ["Operational excellence", "Excellence opérationnelle"],
  ratings: ["Ratings", "Notes", "Note"],
  menuDetails: ["Menu details", "Détails menu", "Menu markup"],
  sustainablePackaging: ["Sustainable packaging", "Emballages durables", "Emballages"],
  sales: ["Sales", "Ventes", "CA"],
};

function findHeaderKey(headers: string[], possibleNames: string[]): string | null {
  for (const name of possibleNames) {
    const found = headers.find(h => h.toLowerCase().includes(name.toLowerCase()));
    if (found) return found;
  }
  return null;
}

export function SuccessScorePreviewEditor({
  data,
  headers,
  onDataChange,
}: SuccessScorePreviewEditorProps) {
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedValues, setEditedValues] = useState<ParsedRow>({});

  // Find the actual header names in the CSV
  const storeNameKey = findHeaderKey(headers, FIELD_MAPPING.storeName);
  const statusKey = findHeaderKey(headers, FIELD_MAPPING.status);
  const opExKey = findHeaderKey(headers, FIELD_MAPPING.operationalExcellence);
  const ratingsKey = findHeaderKey(headers, FIELD_MAPPING.ratings);
  const menuDetailsKey = findHeaderKey(headers, FIELD_MAPPING.menuDetails);
  const packagingKey = findHeaderKey(headers, FIELD_MAPPING.sustainablePackaging);
  const salesKey = findHeaderKey(headers, FIELD_MAPPING.sales);

  const hasNAValues = data.some(row => 
    (ratingsKey && (row[ratingsKey] === "NA" || !row[ratingsKey])) ||
    (menuDetailsKey && (row[menuDetailsKey] === "NA" || !row[menuDetailsKey])) ||
    (packagingKey && (row[packagingKey] === "NA" || !row[packagingKey]))
  );

  const startEditing = (rowIndex: number) => {
    setEditingRow(rowIndex);
    setEditedValues({ ...data[rowIndex] });
  };

  const cancelEditing = () => {
    setEditingRow(null);
    setEditedValues({});
  };

  const saveEditing = () => {
    if (editingRow === null) return;
    const newData = [...data];
    newData[editingRow] = { ...editedValues };
    onDataChange(newData);
    setEditingRow(null);
    setEditedValues({});
  };

  const updateValue = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const getTierConfig = (status: string) => {
    return TIER_OPTIONS.find(t => t.value.toLowerCase() === status?.toLowerCase()) || TIER_OPTIONS[3];
  };

  const renderCell = (row: ParsedRow, key: string | null, rowIndex: number, isEditable: boolean) => {
    if (!key) return <TableCell className="text-center text-muted-foreground">—</TableCell>;

    const value = editingRow === rowIndex ? editedValues[key] : row[key];
    const isNA = value === "NA" || !value || value.trim() === "";
    const isEditing = editingRow === rowIndex && isEditable;

    if (isEditing) {
      // Special case for Status - use dropdown
      if (key === statusKey) {
        return (
          <TableCell className="text-center">
            <Select value={editedValues[key] || ""} onValueChange={(v) => updateValue(key, v)}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
        );
      }

      return (
        <TableCell className="text-center">
          <Input
            className="h-8 w-20 text-center"
            value={editedValues[key] || ""}
            onChange={(e) => updateValue(key, e.target.value)}
            placeholder="—"
          />
        </TableCell>
      );
    }

    // Status badge
    if (key === statusKey) {
      const config = getTierConfig(value);
      return (
        <TableCell className="text-center">
          <Badge className={`${config.color} text-white`}>{config.label}</Badge>
        </TableCell>
      );
    }

    // NA values highlighted
    if (isNA) {
      return (
        <TableCell className="text-center">
          <span className="text-orange-500 font-medium">NA</span>
        </TableCell>
      );
    }

    return <TableCell className="text-center">{value}</TableCell>;
  };

  return (
    <div className="space-y-4">
      {hasNAValues && (
        <Alert className="bg-amber-500/10 border-amber-500/30">
          <PencilIcon className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700">Données manquantes détectées</AlertTitle>
          <AlertDescription className="text-amber-600">
            Certaines métriques (Notes, Détails Menu, Emballages) sont marquées "NA" dans le CSV.
            Cliquez sur le crayon pour les renseigner manuellement avant l'import.
          </AlertDescription>
        </Alert>
      )}

      <div className="border rounded-lg overflow-auto max-h-[400px]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="whitespace-nowrap">Restaurant</TableHead>
              <TableHead className="text-center whitespace-nowrap">Niveau</TableHead>
              <TableHead className="text-center whitespace-nowrap">Excellence Op.</TableHead>
              <TableHead className="text-center whitespace-nowrap">Notes</TableHead>
              <TableHead className="text-center whitespace-nowrap">Détails Menu</TableHead>
              <TableHead className="text-center whitespace-nowrap">Emballages</TableHead>
              <TableHead className="text-center whitespace-nowrap">CA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, rowIndex) => (
              <TableRow key={rowIndex} className={editingRow === rowIndex ? "bg-primary/5" : ""}>
                <TableCell className="w-10">
                  {editingRow === rowIndex ? (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEditing}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEditing}>
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(rowIndex)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">
                  {storeNameKey ? row[storeNameKey] : "—"}
                </TableCell>
                {renderCell(row, statusKey, rowIndex, true)}
                {renderCell(row, opExKey, rowIndex, true)}
                {renderCell(row, ratingsKey, rowIndex, true)}
                {renderCell(row, menuDetailsKey, rowIndex, true)}
                {renderCell(row, packagingKey, rowIndex, true)}
                {renderCell(row, salesKey, rowIndex, true)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
