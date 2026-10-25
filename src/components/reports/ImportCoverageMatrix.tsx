import { useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, LayoutGrid, List } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { REPORT_TYPE_CONFIG } from "@/lib/reportImportConfig";
import { cn } from "@/lib/utils";

export interface CoverageImport {
  id: string;
  report_type: string;
  imported_at: string;
  date_range_start: string | null;
  date_range_end: string | null;
  status: string;
}

interface ImportCoverageMatrixProps {
  imports: CoverageImport[];
  year: number;
  onYearChange: (year: number) => void;
  viewMode: "matrix" | "list";
  onViewModeChange: (mode: "matrix" | "list") => void;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(year: number, month: number): number {
  if (month === 1 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) return 29;
  return DAYS_IN_MONTH[month];
}

/** Count distinct calendar days covered by [start, end] within the given month. */
function coveredDaysInMonth(start: Date, end: Date, year: number, month: number): number {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month, daysInMonth(year, month));
  const s = start > monthStart ? start : monthStart;
  const e = end < monthEnd ? end : monthEnd;
  if (s > e) return 0;
  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
}

interface CellData {
  imports: CoverageImport[];
  coveredDays: number;
  monthDays: number;
}

export default function ImportCoverageMatrix({
  imports,
  year,
  onYearChange,
  viewMode,
  onViewModeChange,
}: ImportCoverageMatrixProps) {
  const reportTypes = useMemo(() => Object.keys(REPORT_TYPE_CONFIG), []);

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        index: i,
        label: format(new Date(year, i, 1), "MMM", { locale: fr }),
        days: daysInMonth(year, i),
      })),
    [year]
  );

  // matrix[reportType][monthIndex] = CellData
  const matrix = useMemo(() => {
    const result: Record<string, CellData[]> = {};
    for (const type of reportTypes) {
      result[type] = months.map((m) => ({ imports: [], coveredDays: 0, monthDays: m.days }));
    }
    for (const imp of imports) {
      const cells = result[imp.report_type];
      if (!cells) continue;
      // Covered period: explicit date range, fallback to import date
      const start = imp.date_range_start ? new Date(imp.date_range_start) : new Date(imp.imported_at);
      const end = imp.date_range_end ? new Date(imp.date_range_end) : new Date(imp.imported_at);
      for (let m = 0; m < 12; m++) {
        const days = coveredDaysInMonth(start, end, year, m);
        if (days > 0) {
          cells[m].imports.push(imp);
          cells[m].coveredDays += days;
        }
      }
    }
    // Cap covered days at month length (overlapping imports)
    for (const type of reportTypes) {
      for (const cell of result[type]) {
        cell.coveredDays = Math.min(cell.coveredDays, cell.monthDays);
      }
    }
    return result;
  }, [imports, reportTypes, months, year]);

  const getCellStyle = (cell: CellData): string => {
    if (cell.imports.length === 0) {
      return "bg-destructive/10 text-destructive";
    }
    const ratio = cell.coveredDays / cell.monthDays;
    if (ratio >= 0.8) {
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    }
    return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  };

  const getCellLabel = (cell: CellData): string => {
    if (cell.imports.length === 0) return "—";
    return `${cell.coveredDays}j`;
  };

  const getCellTitle = (type: string, monthLabel: string, cell: CellData): string => {
    const typeLabel = REPORT_TYPE_CONFIG[type]?.label ?? type;
    if (cell.imports.length === 0) {
      return `${typeLabel} — ${monthLabel} ${year} : aucun import`;
    }
    const files = cell.imports.map((i) => `• ${format(new Date(i.imported_at), "dd/MM/yyyy HH:mm")}`).join("\n");
    return `${typeLabel} — ${monthLabel} ${year} : ${cell.coveredDays}/${cell.monthDays} jours couverts (${cell.imports.length} import${cell.imports.length > 1 ? "s" : ""})\n${files}`;
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: coverage matrix (days covered per month)
    const header = ["Type de rapport", ...months.map((m) => `${m.label} ${year}`)];
    const rows = reportTypes.map((type) => {
      const label = REPORT_TYPE_CONFIG[type]?.label ?? type;
      const cells = matrix[type];
      return [
        label,
        ...cells.map((c) => (c.imports.length === 0 ? "Manquant" : `${c.coveredDays}/${c.monthDays} jours`)),
      ];
    });
    const wsMatrix = XLSX.utils.aoa_to_sheet([header, ...rows]);
    wsMatrix["!cols"] = [{ wch: 28 }, ...months.map(() => ({ wch: 14 }))];
    XLSX.utils.book_append_sheet(wb, wsMatrix, "Couverture");

    // Sheet 2: import detail
    const detailHeader = ["Type de rapport", "Période début", "Période fin", "Importé le", "Statut"];
    const detailRows = imports.map((imp) => [
      REPORT_TYPE_CONFIG[imp.report_type]?.label ?? imp.report_type,
      imp.date_range_start ?? "",
      imp.date_range_end ?? "",
      format(new Date(imp.imported_at), "dd/MM/yyyy HH:mm"),
      imp.status,
    ]);
    const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
    wsDetail["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsDetail, "Détail imports");

    XLSX.writeFile(wb, `couverture_imports_${year}.xlsx`);
  };

  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear, currentYear - 1]);
    for (const imp of imports) {
      years.add(new Date(imp.imported_at).getFullYear());
      if (imp.date_range_start) years.add(new Date(imp.date_range_start).getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [imports, currentYear]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => onViewModeChange("matrix")}
              className={cn(
                "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
                viewMode === "matrix" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Matrice
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className={cn(
                "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
                viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" />
              Liste
            </button>
          </div>
          {viewMode === "matrix" && (
            <div className="flex items-center gap-1">
              {availableYears.map((y) => (
                <Button
                  key={y}
                  variant={y === year ? "default" : "outline"}
                  size="sm"
                  onClick={() => onYearChange(y)}
                >
                  {y}
                </Button>
              ))}
            </div>
          )}
        </div>
        {viewMode === "matrix" && (
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        )}
      </div>

      {viewMode === "matrix" && (
        <>
          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium sticky left-0 bg-muted/50 min-w-[180px]">
                    Type de rapport
                  </th>
                  {months.map((m) => (
                    <th key={m.index} className="text-center p-2 font-medium min-w-[52px] capitalize">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportTypes.map((type) => (
                  <tr key={type} className="border-b last:border-0">
                    <td className="p-2 font-medium sticky left-0 bg-card">
                      {REPORT_TYPE_CONFIG[type]?.label ?? type}
                    </td>
                    {matrix[type].map((cell, mIdx) => (
                      <td key={mIdx} className="p-1 text-center">
                        <span
                          className={cn(
                            "inline-block w-full rounded px-1.5 py-1 text-xs font-medium cursor-default",
                            getCellStyle(cell)
                          )}
                          title={getCellTitle(type, months[mIdx].label, cell)}
                        >
                          {getCellLabel(cell)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-emerald-500/15 border border-emerald-500/30" />
              Couvert (≥ 80 % du mois)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-amber-500/15 border border-amber-500/30" />
              Partiel
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-destructive/10 border border-destructive/30" />
              Manquant
            </span>
            <Badge variant="outline" className="ml-auto">
              Survolez une cellule pour le détail des imports
            </Badge>
          </div>
        </>
      )}
    </div>
  );
}
