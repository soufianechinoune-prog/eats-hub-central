import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { AppLayout } from "@/components/layout/AppLayout";
import { ChannelNavShell } from "@/components/overview/ChannelNavShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Flag,
  Gift,
  HandCoins,
  Percent,
  Repeat,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useDataGranularity } from "@/hooks/useDataGranularity";
import {
  EMPTY_BRAND_SCOPE_RESTAURANT_IDS,
  resolveBrandScopedRestaurantIds,
} from "@/lib/brandScope";
import type { GrowthGranularity } from "@/hooks/useChataigneGrowth";
import {
  useChataigneReferralAcquisition,
  useChataigneReferralLtv,
  useChataigneReferralPayback,
  useChataigneReferralRetention,
  useChataigneReferralSegments,
} from "@/hooks/useChataigneReferral";
import { ChartNoteDialog } from "@/components/charts/ChartNoteDialog";
import { renderChartNoteMarkers } from "@/components/charts/ChartNoteMarkers";
import { filterNotesByScope, useChartNotes, type ChartNote } from "@/hooks/useChartNotes";
import { cn } from "@/lib/utils";

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));
const fmtEur = (v: number, digits = 2) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v || 0);
const fmtPct = (v: number) => `${(v || 0).toFixed(1)} %`;

// Paramètre « coût du produit offert » (montant € par produit) : remplace, s'il est saisi,
// la valorisation en pourcentage du produit offert / bogo.
const OFFERT_COST_KEY = "chataigne-referral-offert-cost";
const OFFERT_COST_RATIO = 0.28;

// Vision du coût sur la courbe CAC : « client » (montant non encaissé) ou
// « restaurateur » (coût matière = montant × taux de food cost, paramétrable par type d'offre).
const COST_VIEW_KEY = "chataigne-referral-cost-view";
const FOOD_COST_KEY = "chataigne-referral-food-cost-pct"; // remises en € (filleul + parrain)
const FOOD_COST_OFFERT_KEY = "chataigne-referral-food-cost-offert-pct"; // produit offert / bogo
const DEFAULT_FOOD_COST_PCT = 40;
type CostView = "client" | "owner";

type AcquisitionRow = {
  filleuls: number;
  cout_filleul: number;
  cout_parrain: number;
  offert_count: number;
  offert_vente: number;
};

type CostSettings = {
  view: CostView;
  remisePct: number; // food cost appliqué aux remises en €
  offertPct: number; // food cost appliqué à la valeur de vente du produit offert
  offertCostEur: number | null; // montant € par produit offert (prioritaire s'il est saisi)
};

// Décomposition du coût d'acquisition d'une période, par type d'offre
const costBreakdown = (r: AcquisitionRow, s: CostSettings) => {
  const remise = Math.max(0, r.cout_filleul - r.offert_vente); // remises en € (ex. −25 %)
  const offertBase =
    s.offertCostEur != null ? r.offert_count * s.offertCostEur : r.offert_vente;

  const owner = s.view === "owner";
  const coutRemise = owner ? remise * (s.remisePct / 100) : remise;
  const coutOffert =
    owner && s.offertCostEur == null ? offertBase * (s.offertPct / 100) : offertBase;
  const coutParrain = owner ? r.cout_parrain * (s.remisePct / 100) : r.cout_parrain;

  return { coutRemise, coutOffert, coutParrain, total: coutRemise + coutOffert + coutParrain };
};

const effectiveCoutFilleul = (r: AcquisitionRow, offertCost: number) =>
  r.cout_filleul - r.offert_vente + r.offert_count * offertCost;


const periodLabel = (periode: string, granularity: GrowthGranularity) => {
  try {
    const d = parseISO(periode);
    if (granularity === "month") return format(d, "MMM yyyy", { locale: fr });
    if (granularity === "week") return `S${format(d, "II", { locale: fr })} · ${format(d, "dd/MM")}`;
    return format(d, "dd/MM");
  } catch {
    return periode;
  }
};

const SEGMENT_LABELS: Record<string, string> = {
  filleul: "Filleuls (parrainage)",
  bienvenue: "Promo de bienvenue",
  organique: "Organique",
};

const MIN_FILLEULS_CAC = 5;
const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const cohortLabel = (cohorte: string) => {
  const [y, m] = cohorte.split("-");
  return `${MONTH_LABELS[Number(m) - 1] ?? cohorte} ${y}`;
};

function retentionColor(pct: number) {
  if (pct <= 0) return "bg-muted text-muted-foreground";
  if (pct < 5) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (pct < 10) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
  if (pct < 20) return "bg-emerald-500/35 text-emerald-900 dark:text-emerald-100";
  if (pct < 35) return "bg-emerald-500/55 text-emerald-950 dark:text-emerald-50";
  return "bg-emerald-600/75 text-emerald-50";
}

const tooltipStyle = {
  background: "hsl(var(--popover))",
  borderColor: "hsl(var(--border))",
  color: "hsl(var(--popover-foreground))",
  borderRadius: 12,
  boxShadow: "0 12px 32px -12px hsl(var(--foreground) / 0.25)",
  padding: "10px 14px",
  fontSize: 13,
};

/* ------------------------------------------------------------------ */
/* Blocs visuels premium                                               */
/* ------------------------------------------------------------------ */

function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_12px_32px_-16px_hsl(var(--foreground)/0.12)]",
        className
      )}
    >
      <header className="flex flex-col gap-3 border-b px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}

function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_12px_32px_-16px_hsl(var(--foreground)/0.12)] transition-shadow hover:shadow-[0_2px_4px_hsl(var(--foreground)/0.05),0_16px_40px_-16px_hsl(var(--foreground)/0.18)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl transition-opacity opacity-70 group-hover:opacity-100"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-[34px] font-bold leading-none tracking-tight tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function DeltaValue({
  label,
  before,
  after,
  render,
  higherIsBetter = true,
}: {
  label: string;
  before: number;
  after: number;
  render: (v: number) => string;
  higherIsBetter?: boolean;
}) {
  const delta = after - before;
  const good = higherIsBetter ? delta >= 0 : delta <= 0;
  const TrendIcon = delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/40">
          {render(before)}
        </span>
        <ArrowRight className="h-3.5 w-3.5 self-center text-muted-foreground" />
        <span className="text-2xl font-bold tracking-tight tabular-nums">{render(after)}</span>
      </div>
      <div
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
          good
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "bg-red-500/10 text-red-700 dark:text-red-400"
        )}
      >
        <TrendIcon className="h-3.5 w-3.5" />
        {delta >= 0 ? "+" : "−"}
        {render(Math.abs(delta))}
      </div>
    </div>
  );
}

function BreakEvenCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tracking-tight">{value}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ChataigneReferral() {
  const [granularity, setGranularity] = useState<GrowthGranularity>("week");
  const [paybackBasis, setPaybackBasis] = useState<"rank" | "days">("rank");
  const [markerId, setMarkerId] = useState<string>("");
  const [windowDays, setWindowDays] = useState<number>(28);
  const [acqChartType, setAcqChartType] = useState<"area" | "bars">("area");
  const [offertCostOverride, setOffertCostOverride] = useState<string>(() => {
    try {
      return localStorage.getItem(OFFERT_COST_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const updateOffertCost = (v: string) => {
    setOffertCostOverride(v);
    try {
      if (v.trim() === "") localStorage.removeItem(OFFERT_COST_KEY);
      else localStorage.setItem(OFFERT_COST_KEY, v);
    } catch {
      /* stockage indisponible : le réglage reste en mémoire pour la session */
    }
  };

  const [costView, setCostView] = useState<CostView>(() => {
    try {
      return localStorage.getItem(COST_VIEW_KEY) === "owner" ? "owner" : "client";
    } catch {
      return "client";
    }
  });
  const updateCostView = (v: CostView) => {
    setCostView(v);
    try {
      localStorage.setItem(COST_VIEW_KEY, v);
    } catch {
      /* stockage indisponible */
    }
  };
  const [foodCostInput, setFoodCostInput] = useState<string>(() => {
    try {
      return localStorage.getItem(FOOD_COST_KEY) ?? String(DEFAULT_FOOD_COST_PCT);
    } catch {
      return String(DEFAULT_FOOD_COST_PCT);
    }
  });
  const updateFoodCost = (v: string) => {
    setFoodCostInput(v);
    try {
      localStorage.setItem(FOOD_COST_KEY, v);
    } catch {
      /* stockage indisponible */
    }
  };
  const [foodCostOffertInput, setFoodCostOffertInput] = useState<string>(() => {
    try {
      return localStorage.getItem(FOOD_COST_OFFERT_KEY) ?? String(DEFAULT_FOOD_COST_PCT);
    } catch {
      return String(DEFAULT_FOOD_COST_PCT);
    }
  });
  const updateFoodCostOffert = (v: string) => {
    setFoodCostOffertInput(v);
    try {
      localStorage.setItem(FOOD_COST_OFFERT_KEY, v);
    } catch {
      /* stockage indisponible */
    }
  };
  const pctOr = (raw: string) => {
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) && n > 0 && n <= 100 ? n : DEFAULT_FOOD_COST_PCT;
  };
  const foodCostPct = pctOr(foodCostInput);
  const foodCostOffertPct = pctOr(foodCostOffertInput);


  const {
    selectedRestaurants,
    selectedChainId,
    selectedYear,
    selectedMonth,
    periodMode,
    dateRange,
    setPeriodMode,
    setDateRange,
  } = useAnalyticsContext();

  // Par défaut : tout l'historique du canal (1er juin 2026 → aujourd'hui)
  const didInitPeriod = useRef(false);
  useEffect(() => {
    if (didInitPeriod.current) return;
    didInitPeriod.current = true;
    setDateRange({ from: new Date(2026, 5, 1), to: new Date() });
    setPeriodMode("range");
  }, [setDateRange, setPeriodMode]);

  const { startDate, endDate } = useDataGranularity({ periodMode, selectedYear, selectedMonth, dateRange });
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const { data: restaurants } = useQuery({
    queryKey: ["restaurants", selectedChainId],
    queryFn: async () => {
      let query = supabase.from("restaurants").select("id, name, city, is_pinned, is_active").order("name");
      if (selectedChainId) query = query.eq("chain_id", selectedChainId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const chainRestaurantIds = useMemo(() => restaurants?.map((r) => r.id) ?? [], [restaurants]);

  const restaurantFilter = useMemo<string[] | null | undefined>(() => {
    if (!restaurants) return undefined;
    const resolved = resolveBrandScopedRestaurantIds({
      selectedRestaurantIds: selectedRestaurants,
      selectedChainId,
      chainRestaurantIds,
    });
    if (!resolved) return null;
    if (resolved === EMPTY_BRAND_SCOPE_RESTAURANT_IDS) return EMPTY_BRAND_SCOPE_RESTAURANT_IDS;
    return resolved;
  }, [restaurants, selectedRestaurants, selectedChainId, chainRestaurantIds]);

  const acquisitionQ = useChataigneReferralAcquisition(start, end, granularity, restaurantFilter);
  const paybackQ = useChataigneReferralPayback(start, end, restaurantFilter);
  const segmentsQ = useChataigneReferralSegments(start, end, restaurantFilter);
  const retentionQ = useChataigneReferralRetention(start, end, restaurantFilter);
  const ltvQ = useChataigneReferralLtv(start, end, restaurantFilter);

  const rows = acquisitionQ.data ?? [];

  // Coût du produit offert : valeur saisie, sinon défaut ≈ 28 % du prix de vente moyen constaté
  const offertTotals = useMemo(() => {
    const count = rows.reduce((s, r) => s + r.offert_count, 0);
    const vente = rows.reduce((s, r) => s + r.offert_vente, 0);
    return { count, vente, avgVente: count > 0 ? vente / count : 0 };
  }, [rows]);
  const defaultOffertCost = useMemo(
    () => Math.round(offertTotals.avgVente * OFFERT_COST_RATIO * 100) / 100,
    [offertTotals]
  );
  const parsedOverride = Number(offertCostOverride.replace(",", "."));
  const offertCostEur =
    offertCostOverride.trim() !== "" && Number.isFinite(parsedOverride) && parsedOverride >= 0
      ? parsedOverride
      : null;
  // Valeur utilisée en vision client pour un produit offert (montant saisi sinon défaut ≈ 28 %)
  const offertCost = offertCostEur ?? defaultOffertCost;

  const costSettings: CostSettings = useMemo(
    () => ({
      view: costView,
      remisePct: foodCostPct,
      offertPct: foodCostOffertPct,
      offertCostEur,
    }),
    [costView, foodCostPct, foodCostOffertPct, offertCostEur]
  );

  const chartData = useMemo(() => {
    const base = rows.map((r) => {
      // Coût décomposé par type d'offre (remise en € / produit offert / remise parrain)
      const b = costBreakdown(r, costSettings);
      const cac = r.filleuls > 0 ? Math.round((b.total / r.filleuls) * 100) / 100 : null;

      return {
        periode: r.periode,
        label: periodLabel(r.periode, granularity),
        filleuls: r.filleuls,
        parrains: r.parrains,
        part: r.part_parrainage,
        viralite: r.viralite,
        cac,
        coutRemise: b.coutRemise,
        coutOffert: b.coutOffert,
        coutParrain: b.coutParrain,
        offertCount: r.offert_count,
        // Garde de fiabilité : on n'affiche pas un coût calculé sur trop peu de filleuls
        cacFiable: r.filleuls >= MIN_FILLEULS_CAC ? cac : null,
      };
    });
    // Moyenne glissante sur 4 périodes pour lisser le décalage des remises parrain
    return base.map((r, i) => {
      const win = base.slice(Math.max(0, i - 3), i + 1).filter((w) => w.cacFiable != null);
      const cacMA =
        granularity === "month" || win.length === 0
          ? null
          : Math.round((win.reduce((s, w) => s + (w.cacFiable ?? 0), 0) / win.length) * 100) / 100;
      return { ...r, cacMA };
    });
  }, [rows, granularity, costSettings]);

  // Composition de la période : combien d'acquisitions par remise vs par produit offert
  const mixLabel = useMemo(() => {
    const filleuls = rows.reduce((s, r) => s + r.filleuls, 0);
    const offert = rows.reduce((s, r) => s + r.offert_count, 0);
    if (filleuls === 0) return "";
    const remise = Math.max(0, filleuls - offert);
    if (offert === 0) return `${remise} acquisition${remise > 1 ? "s" : ""} par remise`;
    if (remise === 0) return `${offert} acquisition${offert > 1 ? "s" : ""} par produit offert`;
    return `${remise} par remise · ${offert} par produit offert`;
  }, [rows]);


  // ---- Annotations posées sur les graphiques ----
  const notesQ = useChartNotes(start, end);
  const chartNotes = useMemo(
    () => filterNotesByScope(notesQ.data, restaurantFilter),
    [notesQ.data, restaurantFilter]
  );
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; date: Date | null; existing: ChartNote | null }>({
    open: false,
    date: null,
    existing: null,
  });
  const openNoteForLabel = (label: string | undefined) => {
    if (!label) return;
    const row = chartData.find((r) => r.label === label);
    setNoteDialog({ open: true, date: row?.periode ? parseISO(row.periode) : null, existing: null });
  };
  const openExistingNote = (notes: ChartNote[]) => {
    const first = notes[0];
    setNoteDialog({ open: true, date: first ? parseISO(first.note_date) : null, existing: first ?? null });
  };

  // ---- Avant / après un repère ----
  const marker = chartNotes.find((n) => n.id === markerId) ?? null;
  const beforeStart = marker ? format(addDays(parseISO(marker.note_date), -windowDays), "yyyy-MM-dd") : "";
  const beforeEnd = marker ? format(addDays(parseISO(marker.note_date), -1), "yyyy-MM-dd") : "";
  const afterStart = marker ? marker.note_date : "";
  const afterEnd = marker ? format(addDays(parseISO(marker.note_date), windowDays - 1), "yyyy-MM-dd") : "";

  const beforeAcqQ = useChataigneReferralAcquisition(beforeStart, beforeEnd, "week", restaurantFilter, !!marker);
  const afterAcqQ = useChataigneReferralAcquisition(afterStart, afterEnd, "week", restaurantFilter, !!marker);
  const beforeSegQ = useChataigneReferralSegments(beforeStart, beforeEnd, restaurantFilter, !!marker);
  const afterSegQ = useChataigneReferralSegments(afterStart, afterEnd, restaurantFilter, !!marker);

  const windowStats = (
    acq: typeof rows | undefined,
    seg: ReturnType<typeof useChataigneReferralSegments>["data"]
  ) => {
    const list = acq ?? [];
    const filleuls = list.reduce((s, r) => s + r.filleuls, 0);
    const cost = list.reduce((s, r) => s + effectiveCoutFilleul(r, offertCost) + r.cout_parrain, 0);
    const weeks = Math.max(1, windowDays / 7);
    const fill = (seg ?? []).find((s) => s.segment === "filleul");
    return {
      filleulsPerWeek: filleuls / weeks,
      cac: filleuls > 0 ? cost / filleuls : 0,
      reachat: fill?.taux_reachat ?? 0,
      panier: fill?.panier_moyen ?? 0,
    };
  };
  const before = windowStats(beforeAcqQ.data, beforeSegQ.data);
  const after = windowStats(afterAcqQ.data, afterSegQ.data);
  const beforeAfterLoading =
    !!marker && (beforeAcqQ.isLoading || afterAcqQ.isLoading || beforeSegQ.isLoading || afterSegQ.isLoading);

  // ---- KPIs ----
  const kpis = useMemo(() => {
    const filleuls = rows.reduce((s, r) => s + r.filleuls, 0);
    const parrains = rows.reduce((s, r) => s + r.parrains, 0);
    const nouveaux = rows.reduce((s, r) => s + r.nouveaux_clients, 0);
    const cost = rows.reduce((s, r) => s + effectiveCoutFilleul(r, offertCost) + r.cout_parrain, 0);
    return {
      filleuls,
      parrains,
      nouveaux,
      part: nouveaux > 0 ? (filleuls / nouveaux) * 100 : 0,
      viralite: parrains > 0 ? filleuls / parrains : 0,
      cac: filleuls > 0 ? cost / filleuls : 0,
      cost,
    };
  }, [rows, offertCost]);

  // ---- Payback ----
  const paybackRows = paybackQ.data ?? [];
  // CAC ajusté (produit offert au coût saisi) ; repli sur la valeur brute si la période est vide
  const cac = kpis.cac > 0 ? kpis.cac : (paybackRows[0]?.cac ?? 0);
  const paybackData = useMemo(
    () =>
      paybackRows
        .filter((r) => r.basis === paybackBasis)
        .map((r) => ({
          label: paybackBasis === "rank" ? `${r.x}${r.x === 1 ? "ʳᵉ" : "ᵉ"}` : `J+${r.x}`,
          x: r.x,
          cumul: r.contribution_cumul,
          clients: r.clients,
        })),
    [paybackRows, paybackBasis]
  );
  const breakEven = useMemo(() => {
    const ranks = paybackRows.filter((r) => r.basis === "rank").sort((a, b) => a.x - b.x);
    const days = paybackRows.filter((r) => r.basis === "days").sort((a, b) => a.x - b.x);
    return {
      orders: ranks.find((r) => r.contribution_cumul >= cac)?.x ?? null,
      days: days.find((r) => r.contribution_cumul >= cac)?.x ?? null,
    };
  }, [paybackRows, cac]);

  // ---- Réachat / cohortes filleuls ----
  const segments = segmentsQ.data ?? [];
  const segmentChart = segments.map((s) => ({
    label: SEGMENT_LABELS[s.segment] ?? s.segment,
    reachat: s.taux_reachat,
    commandes: s.commandes_moy,
    panier: s.panier_moyen,
    clients: s.clients,
  }));

  const filleulCohorts = useMemo(() => {
    const map = new Map<string, { cohorte: string; taille: number; cells: Map<number, number> }>();
    for (const r of retentionQ.data ?? []) {
      if (r.segment !== "filleul") continue;
      const entry = map.get(r.cohorte) ?? { cohorte: r.cohorte, taille: r.taille_cohorte, cells: new Map() };
      entry.taille = Math.max(entry.taille, r.taille_cohorte);
      entry.cells.set(r.mois_offset, r.taux_pct);
      map.set(r.cohorte, entry);
    }
    return [...map.values()].sort((a, b) => a.cohorte.localeCompare(b.cohorte));
  }, [retentionQ.data]);
  const maxOffset = useMemo(
    () => (retentionQ.data ?? []).filter((r) => r.segment === "filleul").reduce((m, r) => Math.max(m, r.mois_offset), 0),
    [retentionQ.data]
  );
  const offsets = useMemo(() => Array.from({ length: Math.max(0, maxOffset) }, (_, i) => i + 1), [maxOffset]);

  const isLoading = restaurantFilter === undefined || acquisitionQ.isLoading;
  const isEmpty = !isLoading && rows.length === 0;

  return (
    <AppLayout>
      <ChannelNavShell>
        <div className="space-y-8">
          {/* En-tête premium */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                    <Gift className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">Parrainage</h1>
                    <p className="text-sm text-muted-foreground">
                      Acquisition, coût et rentabilisation des filleuls
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    100 % anonyme via code client
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-medium">
                    Canal Chataigne
                  </Badge>
                </div>
              </div>
              <ToggleGroup
                type="single"
                value={granularity}
                onValueChange={(v) => v && setGranularity(v as GrowthGranularity)}
                variant="outline"
                size="sm"
                className="rounded-xl"
              >
                <ToggleGroupItem value="day" className="px-4">Jour</ToggleGroupItem>
                <ToggleGroupItem value="week" className="px-4">Semaine</ToggleGroupItem>
                <ToggleGroupItem value="month" className="px-4">Mois</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <AnalyticsHeader />
          </div>

          {/* Définitions */}
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] px-5 py-4">
            <div className="flex gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Filleul</strong> : 1ʳᵉ commande avec « Code Parrainage » (−25 %),
                suivi sur toutes ses commandes. <strong className="text-foreground">Parrain</strong> : commande avec
                « Referral Reward » (−15 %). <strong className="text-foreground">Contribution</strong> = montant
                encaissé (net des remises) − 1 € Chataigne − frais Stripe (0,25 € + 1,5 %) ; coût matière non inclus.
                <strong className="text-foreground"> Coût d'acquisition</strong> = remise filleul + remise parrain,
                celle-ci répartie en moyenne car non reliée à son filleul.{" "}
                <strong className="text-foreground">Produit offert</strong> : valorisé à son coût matière estimé
                (paramètre modifiable sur la courbe du coût d'acquisition, défaut ≈ 28 % du prix de vente) et non à sa
                valeur de vente — la remise en € reste de la marge sacrifiée. Valeur vie client volontairement exclue
                pour l'instant.
              </p>
            </div>
          </div>

          {/* KPIs */}
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[132px] rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KpiTile label="Filleuls acquis" value={fmtInt(kpis.filleuls)} icon={Gift} />
              <KpiTile label="Parrains actifs" value={fmtInt(kpis.parrains)} icon={Users} />
              <KpiTile
                label="Filleuls par parrain"
                value={kpis.viralite ? kpis.viralite.toFixed(2) : "—"}
                hint="Coefficient de viralité"
                icon={Sparkles}
              />
              <KpiTile
                label="Coût d'acquisition"
                value={fmtEur(kpis.cac)}
                hint={
                  offertTotals.count > 0
                    ? `par filleul · produit offert valorisé à ${fmtEur(offertCost)}`
                    : "par filleul"
                }
                icon={HandCoins}
              />
              <KpiTile label="Part des nouveaux clients" value={fmtPct(kpis.part)} icon={Percent} />
            </div>
          )}

          {isEmpty ? (
            <Panel title="Aucune donnée">
              <p className="py-6 text-center text-muted-foreground">
                Aucune commande avec code de parrainage sur la période sélectionnée.
              </p>
            </Panel>
          ) : (
            <>
              {/* 1. Acquisition dans le temps */}
              <div className="grid gap-6">
                <Panel
                  title="Filleuls & parrains dans le temps"
                  subtitle="Cliquez sur le graphique pour poser un repère (changement de barème, campagne…)"
                  action={
                    <ToggleGroup
                      type="single"
                      value={acqChartType}
                      onValueChange={(v) => v && setAcqChartType(v as "area" | "bars")}
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                    >
                      <ToggleGroupItem value="area" className="gap-1.5 px-4">
                        <TrendingUp className="h-4 w-4" />
                        Courbes
                      </ToggleGroupItem>
                      <ToggleGroupItem value="bars" className="gap-1.5 px-4">
                        <BarChart3 className="h-4 w-4" />
                        Barres
                      </ToggleGroupItem>
                    </ToggleGroup>
                  }
                >
                  {acquisitionQ.isLoading ? (
                    <Skeleton className="h-[420px] w-full rounded-xl" />
                  ) : (
                    <ResponsiveContainer width="100%" height={420}>
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 16, right: 8, bottom: 0, left: -8 }}
                        onClick={(s: any) => openNoteForLabel(s?.activeLabel)}
                        style={{ cursor: "pointer" }}
                        barCategoryGap="28%"
                      >
                        <defs>
                          <linearGradient id="acqFilleulsFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="acqParrainsFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 6" vertical={false} className="stroke-border" opacity={0.4} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickMargin={10}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          allowDecimals={false}
                          width={52}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RTooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                        {acqChartType === "area" ? (
                          <>
                            <Area
                              type="monotone"
                              dataKey="filleuls"
                              name="Filleuls"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2.5}
                              fill="url(#acqFilleulsFill)"
                              dot={{ r: 3, strokeWidth: 2, fill: "hsl(var(--card))" }}
                              activeDot={{ r: 5 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="parrains"
                              name="Parrains"
                              stroke="hsl(142 71% 45%)"
                              strokeWidth={2.5}
                              fill="url(#acqParrainsFill)"
                              dot={{ r: 3, strokeWidth: 2, fill: "hsl(var(--card))" }}
                              activeDot={{ r: 5 }}
                            />
                          </>
                        ) : (
                          <>
                            <Bar dataKey="filleuls" name="Filleuls" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={26} />
                            <Bar dataKey="parrains" name="Parrains" fill="hsl(142 71% 45%)" radius={[6, 6, 0, 0]} maxBarSize={26} />
                          </>
                        )}
                        {renderChartNoteMarkers({
                          notes: chartNotes,
                          rows: chartData,
                          granularity,
                          onMarkerClick: openExistingNote,
                        })}
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </Panel>

                <Panel
                  title="Viralité & poids dans l'acquisition"
                  subtitle="Filleuls par parrain · part du parrainage dans les nouveaux clients"
                >
                  {acquisitionQ.isLoading ? (
                    <Skeleton className="h-[420px] w-full rounded-xl" />
                  ) : (
                    <ResponsiveContainer width="100%" height={420}>
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 16, right: 4, bottom: 0, left: -4 }}
                        onClick={(s: any) => openNoteForLabel(s?.activeLabel)}
                        style={{ cursor: "pointer" }}
                      >
                        <defs>
                          <linearGradient id="refPartFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 6" vertical={false} className="stroke-border" opacity={0.4} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickMargin={10}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickFormatter={(v) => `${v} %`}
                          width={56}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          width={44}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RTooltip contentStyle={tooltipStyle} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="part"
                          name="% des nouveaux clients"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2.5}
                          fill="url(#refPartFill)"
                          dot={{ r: 3, strokeWidth: 2, fill: "hsl(var(--card))" }}
                          activeDot={{ r: 5 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="viralite"
                          name="Filleuls par parrain"
                          stroke="hsl(38 92% 50%)"
                          strokeWidth={2.5}
                          dot={{ r: 3, strokeWidth: 2, fill: "hsl(var(--card))" }}
                          activeDot={{ r: 5 }}
                        />
                        {renderChartNoteMarkers({
                          notes: chartNotes,
                          rows: chartData,
                          granularity,
                          onMarkerClick: openExistingNote,
                          yAxisId: "left",
                        })}
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </Panel>

                <Panel
                  title="Coût d'acquisition par filleul"
                  subtitle={
                    (costView === "owner"
                      ? `Vision restaurateur (coût matière) : remises valorisées à ${foodCostPct} % de food cost, produit offert ${
                          offertCostEur != null
                            ? `à ${fmtEur(offertCostEur)} par produit`
                            : `à ${foodCostOffertPct} % de sa valeur de vente`
                        } ÷ filleuls acquis`
                      : granularity === "month"
                        ? "Vision client (perception) : remises en € telles quelles + produit offert à sa valeur de vente ÷ filleuls acquis"
                        : "Vision client (perception) : les remises parrain sont versées avec décalage, la courbe brute (pointillés) oscille et la moyenne glissante sur 4 périodes lisse cet effet") +
                    (mixLabel ? ` · ${mixLabel}` : "") +
                    " · les périodes de moins de 5 filleuls ne sont pas tracées · cliquez pour poser un repère"
                  }
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <ToggleGroup
                        type="single"
                        value={costView}
                        onValueChange={(v) => v && updateCostView(v as CostView)}
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                      >
                        <ToggleGroupItem
                          value="client"
                          className="gap-1.5 px-4"
                          title="Perception client : la remise en € telle quelle, produit offert à sa valeur de vente"
                        >
                          Client
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="owner"
                          className="gap-1.5 px-4"
                          title="Coût réel pour le restaurateur : remises et produits offerts valorisés au food cost"
                        >
                          Restaurateur
                        </ToggleGroupItem>
                      </ToggleGroup>
                      {costView === "owner" && (
                        <>
                          <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
                            <label
                              htmlFor="food-cost-pct"
                              className="whitespace-nowrap text-xs font-medium text-muted-foreground"
                              title="Taux de food cost appliqué aux remises en € (filleul −25 % et parrain −15 %)"
                            >
                              Food cost remises
                            </label>
                            <Input
                              id="food-cost-pct"
                              type="number"
                              min={1}
                              max={100}
                              step="1"
                              value={foodCostInput}
                              placeholder={`${DEFAULT_FOOD_COST_PCT}`}
                              onChange={(e) => updateFoodCost(e.target.value)}
                              className="h-8 w-20 rounded-lg text-right tabular-nums"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                            {foodCostInput !== String(DEFAULT_FOOD_COST_PCT) && (
                              <button
                                type="button"
                                onClick={() => updateFoodCost(String(DEFAULT_FOOD_COST_PCT))}
                                title={`Revenir au défaut (${DEFAULT_FOOD_COST_PCT} %)`}
                                className="text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
                            <label
                              htmlFor="food-cost-offert-pct"
                              className="whitespace-nowrap text-xs font-medium text-muted-foreground"
                              title="Taux de food cost appliqué à la valeur de vente du produit offert (bogo) — ignoré si un montant € est saisi"
                            >
                              Food cost produit offert
                            </label>
                            <Input
                              id="food-cost-offert-pct"
                              type="number"
                              min={1}
                              max={100}
                              step="1"
                              value={foodCostOffertInput}
                              placeholder={`${DEFAULT_FOOD_COST_PCT}`}
                              onChange={(e) => updateFoodCostOffert(e.target.value)}
                              disabled={offertCostEur != null}
                              className="h-8 w-20 rounded-lg text-right tabular-nums"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                            {foodCostOffertInput !== String(DEFAULT_FOOD_COST_PCT) && (
                              <button
                                type="button"
                                onClick={() => updateFoodCostOffert(String(DEFAULT_FOOD_COST_PCT))}
                                title={`Revenir au défaut (${DEFAULT_FOOD_COST_PCT} %)`}
                                className="text-muted-foreground transition-colors hover:text-foreground"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                      <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
                        <label
                          htmlFor="offert-cost"
                          className="whitespace-nowrap text-xs font-medium text-muted-foreground"
                          title="Montant € par produit offert / bogo : s'il est saisi, il remplace la valorisation en pourcentage"
                        >
                          Coût produit offert
                        </label>
                        <Input
                          id="offert-cost"
                          type="number"
                          min={0}
                          step="0.1"
                          value={offertCostOverride}
                          placeholder={
                            costView === "owner"
                              ? `${foodCostOffertPct} % (auto)`
                              : defaultOffertCost > 0
                                ? `${defaultOffertCost.toFixed(2)} € (auto)`
                                : "0.00"
                          }
                          onChange={(e) => updateOffertCost(e.target.value)}
                          className="h-8 w-28 rounded-lg text-right tabular-nums"
                        />
                        {offertCostOverride !== "" && (
                          <button
                            type="button"
                            onClick={() => updateOffertCost("")}
                            title="Revenir à la valorisation automatique"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  }
                >

                  {acquisitionQ.isLoading ? (
                    <Skeleton className="h-[420px] w-full rounded-xl" />
                  ) : (
                    <ResponsiveContainer width="100%" height={420}>
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 16, right: 8, bottom: 0, left: -8 }}
                        onClick={(s: any) => openNoteForLabel(s?.activeLabel)}
                        style={{ cursor: "pointer" }}
                      >
                        <defs>
                          <linearGradient id="refCacFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 6" vertical={false} className="stroke-border" opacity={0.4} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickMargin={10}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickFormatter={(v) => `${v} €`}
                          width={56}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RTooltip
                          content={({ active, payload, label }: any) => {
                            if (!active || !payload?.length) return null;
                            const p = payload[0]?.payload ?? {};
                            const n = p.filleuls ?? 0;
                            return (
                              <div style={tooltipStyle} className="min-w-[230px] space-y-1 text-[13px]">
                                <div className="font-semibold">{label}</div>
                                {payload.map((s: any) => (
                                  <div key={s.name} className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">{s.name}</span>
                                    <span className="font-semibold tabular-nums">{fmtEur(Number(s.value))}</span>
                                  </div>
                                ))}
                                <div className="mt-1 space-y-0.5 border-t pt-1 text-xs text-muted-foreground">
                                  <div className="flex justify-between gap-4">
                                    <span>Filleuls acquis</span>
                                    <span className="tabular-nums">
                                      {n}
                                      {n > 0 && n < MIN_FILLEULS_CAC ? " (trop peu, non fiable)" : ""}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span>Coût remises filleul</span>
                                    <span className="tabular-nums">{fmtEur(p.coutRemise ?? 0)}</span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span>Coût produits offerts ({p.offertCount ?? 0})</span>
                                    <span className="tabular-nums">{fmtEur(p.coutOffert ?? 0)}</span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span>Coût remises parrain</span>
                                    <span className="tabular-nums">{fmtEur(p.coutParrain ?? 0)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />

                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                        {granularity === "month" ? (
                          <Area
                            type="monotone"
                            dataKey="cacFiable"

                            name="Coût d'acquisition par filleul"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2.5}
                            fill="url(#refCacFill)"
                            dot={{ r: 3, strokeWidth: 2, fill: "hsl(var(--card))" }}
                            activeDot={{ r: 5 }}
                            connectNulls
                          />
                        ) : (
                          <>
                            <Area
                              type="monotone"
                              dataKey="cacMA"
                              name="Coût d'acquisition (moyenne glissante)"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2.5}
                              fill="url(#refCacFill)"
                              dot={{ r: 3, strokeWidth: 2, fill: "hsl(var(--card))" }}
                              activeDot={{ r: 5 }}
                              connectNulls
                            />
                            <Line
                              type="monotone"
                              dataKey="cac"
                              name="Coût brut de la période"
                              stroke="hsl(var(--muted-foreground))"
                              strokeWidth={1.5}
                              strokeDasharray="5 5"
                              strokeOpacity={0.6}
                              dot={false}
                              connectNulls
                            />
                          </>
                        )}
                        {renderChartNoteMarkers({
                          notes: chartNotes,
                          rows: chartData,
                          granularity,
                          onMarkerClick: openExistingNote,
                        })}
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </Panel>
              </div>

              {/* 2. Avant / après un repère */}
              <Panel
                title="Avant / après un changement de barème"
                subtitle="Choisissez un repère posé sur les graphiques : les métriques sont comparées sur la même durée avant et après."
                action={
                  <div className="flex flex-wrap gap-2">
                    <Select value={markerId} onValueChange={setMarkerId}>
                      <SelectTrigger className="w-[260px] rounded-xl">
                        <SelectValue placeholder="Sélectionner un repère" />
                      </SelectTrigger>
                      <SelectContent>
                        {chartNotes.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Aucun repère — cliquez sur un graphique
                          </SelectItem>
                        ) : (
                          chartNotes.map((n) => (
                            <SelectItem key={n.id} value={n.id}>
                              {format(parseISO(n.note_date), "dd/MM/yyyy")} · {n.title}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <ToggleGroup
                      type="single"
                      value={String(windowDays)}
                      onValueChange={(v) => v && setWindowDays(Number(v))}
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                    >
                      <ToggleGroupItem value="14" className="px-4">14 j</ToggleGroupItem>
                      <ToggleGroupItem value="28" className="px-4">28 j</ToggleGroupItem>
                      <ToggleGroupItem value="56" className="px-4">56 j</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                }
              >
                {!marker ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
                    <Flag className="h-8 w-8 text-muted-foreground/50" />
                    <p className="max-w-md text-sm text-muted-foreground">
                      Aucun repère sélectionné. Cliquez sur un graphique ci-dessus pour ajouter une date et un libellé,
                      puis sélectionnez-le ici.
                    </p>
                  </div>
                ) : beforeAfterLoading ? (
                  <div className="grid gap-4 md:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-28 rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge className="rounded-full px-3 py-1">{marker.title}</Badge>
                      <span>
                        {format(parseISO(beforeStart), "dd/MM")} → {format(parseISO(beforeEnd), "dd/MM")} vs{" "}
                        {format(parseISO(afterStart), "dd/MM")} → {format(parseISO(afterEnd), "dd/MM")}
                      </span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <DeltaValue
                        label="Filleuls / semaine"
                        before={before.filleulsPerWeek}
                        after={after.filleulsPerWeek}
                        render={(v) => v.toFixed(1)}
                      />
                      <DeltaValue
                        label="Coût d'acquisition"
                        before={before.cac}
                        after={after.cac}
                        render={(v) => fmtEur(v)}
                        higherIsBetter={false}
                      />
                      <DeltaValue
                        label="Taux de réachat filleuls"
                        before={before.reachat}
                        after={after.reachat}
                        render={(v) => fmtPct(v)}
                      />
                      <DeltaValue
                        label="Panier moyen filleuls"
                        before={before.panier}
                        after={after.panier}
                        render={(v) => fmtEur(v)}
                      />
                    </div>
                  </div>
                )}
              </Panel>

              {/* 3. Payback */}
              <Panel
                title="Rentabilisation du filleul"
                subtitle={`Contribution cumulée moyenne par filleul face au coût d'acquisition (${fmtEur(cac)}) — indicatif tant que les cohortes sont jeunes`}
                action={
                  <ToggleGroup
                    type="single"
                    value={paybackBasis}
                    onValueChange={(v) => v && setPaybackBasis(v as "rank" | "days")}
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                  >
                    <ToggleGroupItem value="rank" className="px-4">Par commande</ToggleGroupItem>
                    <ToggleGroupItem value="days" className="px-4">Par jours</ToggleGroupItem>
                  </ToggleGroup>
                }
              >
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <BreakEvenCard
                      label="Rentabilisé au bout de"
                      value={breakEven.orders ? `${breakEven.orders} commande${breakEven.orders > 1 ? "s" : ""}` : "pas encore atteint"}
                      icon={Repeat}
                    />
                    <BreakEvenCard
                      label="Soit environ"
                      value={breakEven.days !== null ? `${breakEven.days} jours` : "pas encore atteint"}
                      icon={TrendingUp}
                    />
                  </div>
                  {paybackQ.isLoading ? (
                    <Skeleton className="h-[420px] w-full rounded-xl" />
                  ) : (
                    <ResponsiveContainer width="100%" height={420}>
                      <ComposedChart data={paybackData} margin={{ top: 20, right: 8, bottom: 0, left: -4 }}>
                        <defs>
                          <linearGradient id="paybackFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 6" vertical={false} className="stroke-border" opacity={0.4} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickMargin={10}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickFormatter={(v) => `${v} €`}
                          width={64}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RTooltip
                          contentStyle={tooltipStyle}
                          formatter={(v: number, n) => [n === "cumul" ? fmtEur(Number(v)) : fmtInt(Number(v)), n === "cumul" ? "Contribution cumulée" : "Clients"]}
                        />
                        <ReferenceLine
                          y={cac}
                          stroke="hsl(0 84% 60%)"
                          strokeDasharray="6 4"
                          strokeWidth={1.5}
                          label={{
                            value: `Coût d'acquisition ${fmtEur(cac)}`,
                            position: "insideTopRight",
                            fontSize: 12,
                            fill: "hsl(0 84% 60%)",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumul"
                          name="cumul"
                          stroke="hsl(var(--primary))"
                          strokeWidth={3}
                          fill="url(#paybackFill)"
                          dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))" }}
                          activeDot={{ r: 6 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Panel>

              {/* 4. Réachat */}
              <div className="grid gap-6">
                <Panel
                  title="Filleul vs bienvenue vs organique"
                  subtitle="Taux de réachat, commandes par client et panier moyen selon la porte d'entrée"
                >
                  {segmentsQ.isLoading ? (
                    <Skeleton className="h-[320px] w-full rounded-xl" />
                  ) : (
                    <div className="space-y-6">
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={segmentChart} margin={{ top: 16, right: 8, bottom: 0, left: -8 }} barCategoryGap="32%">
                          <defs>
                            <linearGradient id="segBarFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.65} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 6" vertical={false} className="stroke-border" opacity={0.4} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                            tickMargin={10}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(v) => `${v} %`}
                            width={56}
                            axisLine={false}
                            tickLine={false}
                          />
                          <RTooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} formatter={(v: number) => [fmtPct(Number(v)), "Taux de réachat"]} />
                          <Bar dataKey="reachat" name="Taux de réachat" fill="url(#segBarFill)" radius={[8, 8, 0, 0]} maxBarSize={72} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="overflow-x-auto rounded-xl border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              <th className="px-4 py-3">Porte d'entrée</th>
                              <th className="px-4 py-3 text-right">Clients</th>
                              <th className="px-4 py-3 text-right">Réachat</th>
                              <th className="px-4 py-3 text-right">Cmd / client</th>
                              <th className="px-4 py-3 text-right">Panier moyen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {segmentChart.map((s) => (
                              <tr key={s.label} className="border-t transition-colors hover:bg-muted/30">
                                <td className="px-4 py-3 font-medium">{s.label}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{fmtInt(s.clients)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{fmtPct(s.reachat)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{s.commandes.toFixed(2)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{fmtEur(s.panier)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Rétention des filleuls par cohorte"
                  subtitle="% de filleuls qui recommandent le mois suivant, puis les mois d'après"
                >
                  {retentionQ.isLoading ? (
                    <Skeleton className="h-[280px] w-full rounded-xl" />
                  ) : filleulCohorts.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
                      <Users className="h-8 w-8 text-muted-foreground/50" />
                      <p className="max-w-md text-sm text-muted-foreground">
                        Pas encore assez de recul pour mesurer la rétention des filleuls.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-3">Cohorte</th>
                            <th className="px-4 py-3 text-right">Filleuls</th>
                            {offsets.map((o) => (
                              <th key={o} className="px-2 py-3 text-center">
                                M+{o}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filleulCohorts.map((c) => (
                            <tr key={c.cohorte} className="border-t">
                              <td className="px-4 py-2.5 whitespace-nowrap font-medium">{cohortLabel(c.cohorte)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{fmtInt(c.taille)}</td>
                              {offsets.map((o) => {
                                const v = c.cells.get(o);
                                return (
                                  <td key={o} className="px-1.5 py-1.5 text-center">
                                    <span
                                      className={cn(
                                        "inline-block w-full min-w-[64px] rounded-lg px-2 py-1.5 text-xs font-semibold tabular-nums",
                                        retentionColor(v ?? 0)
                                      )}
                                    >
                                      {v === undefined ? "—" : `${v.toFixed(0)} %`}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              </div>
            </>
          )}

          <ChartNoteDialog
            open={noteDialog.open}
            onOpenChange={(o) => setNoteDialog((s) => ({ ...s, open: o }))}
            date={noteDialog.date}
            existingNote={noteDialog.existing}
            scopedRestaurantIds={Array.isArray(restaurantFilter) ? restaurantFilter : []}
          />
        </div>
      </ChannelNavShell>
    </AppLayout>
  );
}
