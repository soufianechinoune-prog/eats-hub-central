import { Star, Store, ShoppingBag, Globe, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RestaurantNetworkStats, PlatformBreakdown } from "@/hooks/useNetworkStats";
import { getMetricStatus, getStatusTextClass } from "@/lib/performanceThresholds";

/* ------------------------------------------------------------------ */
/* Format helpers                                                      */
/* ------------------------------------------------------------------ */
const fmtEur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v) + " €";
const fmtEur2 = (v: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + " €";
const fmtPct = (v: number | null | undefined, digits = 1) =>
  v == null ? "—" : `${v.toFixed(digits)}%`;
const fmtMin = (v: number | null | undefined) =>
  v == null ? "—" : `${Math.round(v)} min`;

/* ------------------------------------------------------------------ */
/* Channel definitions                                                 */
/* ------------------------------------------------------------------ */
export type ChannelId = "uber" | "deliveroo" | "cash" | "eshop" | "whatsapp";

interface ChannelMeta {
  id: ChannelId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind text color class (semantic token-based) */
  textClass: string;
  /** Inline HSL color for the stacked bar (uses CSS vars). */
  barColor: string;
}

const CHANNEL_META: Record<ChannelId, ChannelMeta> = {
  uber:      { id: "uber",      label: "Uber Eats", icon: ShoppingBag,   textClass: "text-uber",      barColor: "hsl(var(--uber))" },
  deliveroo: { id: "deliveroo", label: "Deliveroo", icon: ShoppingBag,   textClass: "text-deliveroo", barColor: "hsl(var(--deliveroo))" },
  cash:      { id: "cash",      label: "Caisse",    icon: Store,         textClass: "text-cash",      barColor: "hsl(var(--cash))" },
  eshop:     { id: "eshop",     label: "eShop",     icon: Globe,         textClass: "text-blue-500",  barColor: "hsl(217 91% 60%)" },
  whatsapp:  { id: "whatsapp",  label: "WhatsApp",  icon: MessageCircle, textClass: "text-emerald-500", barColor: "hsl(142 71% 45%)" },
};

/* ------------------------------------------------------------------ */
/* Stacked bar (used both in the CA column and in the expanded panel)  */
/* ------------------------------------------------------------------ */
export interface ChannelSegment {
  id: ChannelId;
  revenue: number;
}

export function ChannelMixBar({
  segments,
  size = "md",
  showLabels = false,
}: {
  segments: ChannelSegment[];
  size?: "xs" | "md";
  showLabels?: boolean;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.revenue), 0);
  if (total <= 0) return null;
  const h = size === "xs" ? "h-1" : "h-2.5";

  return (
    <div className="w-full">
      <div className={cn("flex w-full overflow-hidden rounded-full bg-muted/40", h)}>
        {segments
          .filter((s) => s.revenue > 0)
          .map((s) => {
            const meta = CHANNEL_META[s.id];
            const pct = (s.revenue / total) * 100;
            return (
              <div
                key={s.id}
                style={{ width: `${pct}%`, backgroundColor: meta.barColor }}
                title={`${meta.label} · ${fmtEur(s.revenue)} (${pct.toFixed(0)}%)`}
              />
            );
          })}
      </div>
      {showLabels && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {segments
            .filter((s) => s.revenue > 0)
            .map((s) => {
              const meta = CHANNEL_META[s.id];
              const pct = (s.revenue / total) * 100;
              const Icon = meta.icon;
              return (
                <div key={s.id} className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.barColor }} />
                  <Icon className={cn("h-3 w-3", meta.textClass)} />
                  <span className={cn("font-medium", meta.textClass)}>{meta.label}</span>
                  <span className="text-muted-foreground">
                    {fmtEur(s.revenue)} · {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Active-channels chips (next to restaurant name)                     */
/* ------------------------------------------------------------------ */
export function ChannelChips({ channels }: { channels: ChannelId[] }) {
  if (channels.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {channels.map((id) => {
        const m = CHANNEL_META[id];
        const Icon = m.icon;
        return (
          <span
            key={id}
            className={cn(
              "inline-flex items-center justify-center h-4 w-4 rounded-sm bg-muted/40",
              m.textClass,
            )}
            title={m.label}
          >
            <Icon className="h-2.5 w-2.5" />
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI row inside a channel card                                       */
/* ------------------------------------------------------------------ */
function Kpi({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums whitespace-nowrap", valueClass)}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="my-1.5 border-t border-border/40" />;
}

/* ------------------------------------------------------------------ */
/* Channel card                                                        */
/* ------------------------------------------------------------------ */
interface ChannelCardData {
  id: ChannelId;
  revenue: number;
  share: number; // % of restaurant total
  orders?: number;
  avgBasket?: number;
  netPayout?: number;
  profitability?: number | null;
  // Ops (only Uber/Deliveroo)
  rating?: number | null;
  errorRate?: number | null;
  totalDeliveryTime?: number | null;
  adsPct?: number | null;
  mealVoucher?: number;
}

function ChannelCard({
  data,
  onClick,
}: {
  data: ChannelCardData;
  onClick?: () => void;
}) {
  const meta = CHANNEL_META[data.id];
  const Icon = meta.icon;
  const hasOps =
    data.id === "uber" ||
    data.id === "deliveroo" ||
    data.rating != null ||
    data.errorRate != null ||
    data.totalDeliveryTime != null;

  const ratingStatus = getMetricStatus("rating", data.rating);
  const errorStatus = getMetricStatus("errorRate", data.errorRate);
  const deliveryStatus = getMetricStatus("totalDeliveryTime", data.totalDeliveryTime);
  const profitStatus = getMetricStatus("profitability", data.profitability);

  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-card/60 backdrop-blur p-3 transition-all",
        "hover:shadow-md hover:border-border",
        onClick && "cursor-pointer",
      )}
      onClick={onClick}
    >
      {/* Channel header with color accent */}
      <div
        className="-mx-3 -mt-3 mb-2 h-1 rounded-t-lg"
        style={{ backgroundColor: meta.barColor }}
      />
      <div className="flex items-center justify-between mb-2">
        <div className={cn("inline-flex items-center gap-1.5 font-semibold text-sm", meta.textClass)}>
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </div>
        <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
          {data.share.toFixed(0)}%
        </span>
      </div>

      {/* Financial */}
      <Kpi label="CA" value={fmtEur(data.revenue)} valueClass={meta.textClass} />
      {data.orders != null && (
        <Kpi label="Cmds" value={data.orders.toLocaleString("fr-FR")} />
      )}
      {data.avgBasket != null && data.avgBasket > 0 && (
        <Kpi label="Panier" value={fmtEur2(data.avgBasket)} />
      )}
      {data.netPayout != null && data.netPayout > 0 && (
        <Kpi label="Versement" value={fmtEur(data.netPayout)} valueClass="text-emerald-600 dark:text-emerald-400" />
      )}
      {data.mealVoucher != null && data.mealVoucher > 0 && (
        <Kpi label="Titre resto" value={fmtEur2(data.mealVoucher)} valueClass="text-primary" />
      )}
      {data.profitability != null && (
        <Kpi label="Rentab." value={fmtPct(data.profitability)} valueClass={getStatusTextClass(profitStatus)} />
      )}

      {/* Ops (Uber/Deliveroo only) */}
      {hasOps && (
        <>
          <Divider />
          <Kpi
            label="Note"
            value={
              data.rating != null ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  {data.rating.toFixed(1)}
                </span>
              ) : (
                "—"
              )
            }
            valueClass={getStatusTextClass(ratingStatus)}
          />
          <Kpi label="Erreurs" value={fmtPct(data.errorRate)} valueClass={getStatusTextClass(errorStatus)} />
          <Kpi label="Prépa+Livr" value={fmtMin(data.totalDeliveryTime)} valueClass={getStatusTextClass(deliveryStatus)} />
          {data.adsPct != null && (
            <Kpi label="% Pub" value={`${data.adsPct.toFixed(2).replace(".", ",")}%`} />
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */
export interface ChannelBreakdownPanelProps {
  resto: RestaurantNetworkStats;
  /** CA caisse pour ce restaurant (Splash360). */
  cash?: number;
  /** % pub Uber (déjà calculé). */
  adsPct?: number | null;
  onChannelClick?: (channel: ChannelId) => void;
}

export function ChannelBreakdownPanel({
  resto,
  cash = 0,
  adsPct = null,
  onChannelClick,
}: ChannelBreakdownPanelProps) {
  const uber = resto.platformBreakdown.uber;
  const deliveroo = resto.platformBreakdown.deliveroo;

  // Total includes caisse (cash) for share computation
  const total = resto.revenue + Math.max(0, cash);

  const channels: ChannelCardData[] = [];
  if (uber.revenue > 0 || uber.orders > 0) {
    channels.push({
      id: "uber",
      revenue: uber.revenue,
      share: total > 0 ? (uber.revenue / total) * 100 : 0,
      orders: uber.orders,
      avgBasket: uber.avgBasket,
      netPayout: uber.netPayout,
      mealVoucher: uber.mealVoucher,
      profitability: uber.profitability,
      rating: resto.rating,
      errorRate: resto.errorRate,
      totalDeliveryTime: resto.totalDeliveryTime,
      adsPct,
    });
  }
  if (deliveroo.revenue > 0 || deliveroo.orders > 0) {
    channels.push({
      id: "deliveroo",
      revenue: deliveroo.revenue,
      share: total > 0 ? (deliveroo.revenue / total) * 100 : 0,
      orders: deliveroo.orders,
      avgBasket: deliveroo.avgBasket,
      netPayout: deliveroo.netPayout,
      profitability: deliveroo.profitability,
      rating: null,
      errorRate: null,
      totalDeliveryTime: null,
    });
  }
  if (cash > 0) {
    channels.push({
      id: "cash",
      revenue: cash,
      share: total > 0 ? (cash / total) * 100 : 0,
    });
  }

  const segments: ChannelSegment[] = channels.map((c) => ({ id: c.id, revenue: c.revenue }));

  if (channels.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Aucune donnée canal disponible sur cette période.
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/20 rounded-lg space-y-4">
      {/* Mix bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mix canaux
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            Total {fmtEur(total)}
          </span>
        </div>
        <ChannelMixBar segments={segments} size="md" showLabels />
      </div>

      {/* Grid of channel cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {channels.map((c) => (
          <ChannelCard
            key={c.id}
            data={c}
            onClick={onChannelClick ? () => onChannelClick(c.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
