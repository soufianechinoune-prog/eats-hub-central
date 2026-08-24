import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Bike,
  ChevronDown,
  ChevronRight,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useChataigneCustomerOrders,
  useChataigneCustomerSummary,
  useChataigneOrderItems,
  type ChataigneCustomerOrder,
  type ChataigneOrderItemRow,
} from "@/hooks/useChataigne";

const fmtEur = (v: number, digits = 2) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v || 0);

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));

const SERVICE_LABEL: Record<string, string> = {
  collection: "À emporter",
  delivery: "Livraison",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Terminée",
  cancelled: "Annulée",
  accepted: "Acceptée",
  in_preparation: "En préparation",
  delivery_failed: "Échec livraison",
};

function dt(value: string | null, pattern = "dd/MM/yyyy HH:mm") {
  if (!value) return "—";
  return format(new Date(value), pattern, { locale: fr });
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ItemsList({ orderId }: { orderId: string }) {
  const itemsQ = useChataigneOrderItems(orderId);
  const items = useMemo(
    () => [...(itemsQ.data ?? [])].sort((a, b) => a.depth - b.depth),
    [itemsQ.data]
  );

  if (itemsQ.isLoading) {
    return (
      <div className="space-y-1.5 p-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground">Aucun article enregistré pour cette commande.</p>
    );
  }
  return (
    <div className="space-y-1 bg-muted/30 p-3">
      {items.map((it: ChataigneOrderItemRow) => (
        <div
          key={it.id}
          className={cn(
            "flex items-center justify-between text-xs",
            it.depth > 0 ? "text-muted-foreground" : "font-medium"
          )}
          style={{ paddingLeft: `${it.depth * 14}px` }}
        >
          <span className="truncate">
            {it.depth > 0 && <span className="mr-1">└</span>}
            {it.item_name ?? "—"}
          </span>
          <span className="ml-2 shrink-0 tabular-nums">
            ×{fmtInt(it.quantity)}
            {it.unit_price_amount ? ` · ${fmtEur(it.unit_price_amount)}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function OrderRecap({ order }: { order: ChataigneCustomerOrder }) {
  const subtotal =
    order.total_amount -
    order.delivery_fee_amount -
    order.service_charge_amount +
    order.discount_total_amount;

  const expectedTime =
    order.service_type === "delivery" ? order.expected_delivery_time : order.expected_pickup_time;

  return (
    <div className="space-y-1.5 rounded-md border bg-card p-3 text-xs">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Sous-total</span>
        <span className="font-medium tabular-nums">{fmtEur(subtotal)}</span>
      </div>
      {order.delivery_fee_amount > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Frais de livraison</span>
          <span className="font-medium tabular-nums">{fmtEur(order.delivery_fee_amount)}</span>
        </div>
      )}
      {order.service_charge_amount > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Frais de service</span>
          <span className="font-medium tabular-nums">{fmtEur(order.service_charge_amount)}</span>
        </div>
      )}
      {order.discount_total_amount > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total remises</span>
          <span className="font-medium tabular-nums text-destructive">
            -{fmtEur(order.discount_total_amount)}
          </span>
        </div>
      )}
      <Separator className="my-1.5" />
      <div className="flex justify-between">
        <span className="font-medium">Total TTC</span>
        <span className="font-semibold tabular-nums">{fmtEur(order.total_amount)}</span>
      </div>
      {order.payment_status && (
        <p className="pt-1 text-muted-foreground">
          Paiement : <span className="text-foreground">{order.payment_status}</span>
        </p>
      )}
      {expectedTime && (
        <p className="text-muted-foreground">
          {order.service_type === "delivery" ? "Livraison prévue" : "Retrait prévu"} :{" "}
          <span className="text-foreground">{dt(expectedTime, "dd/MM/yyyy HH:mm")}</span>
        </p>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: ChataigneCustomerOrder }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/40"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{order.restaurant_name ?? "—"}</span>
            {order.short_id && (
              <span className="shrink-0 text-xs text-muted-foreground">n° {order.short_id}</span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{dt(order.order_datetime)}</span>
            <span className="inline-flex items-center gap-1">
              {order.service_type === "delivery" ? (
                <Bike className="h-3 w-3" />
              ) : (
                <ShoppingBag className="h-3 w-3" />
              )}
              {SERVICE_LABEL[order.service_type ?? ""] ?? order.service_type ?? "—"}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "px-1.5 py-0 text-[10px]",
                order.status === "completed"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                  : order.status === "cancelled" || order.status === "delivery_failed"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-600"
              )}
            >
              {STATUS_LABEL[order.status ?? ""] ?? order.status ?? "—"}
            </Badge>
            <span>
              {fmtInt(order.item_count)} article{order.item_count > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold">{fmtEur(order.total_amount)}</p>
          {order.discount_total_amount > 0 && (
            <p className="text-xs text-destructive">-{fmtEur(order.discount_total_amount)}</p>
          )}
        </div>
      </button>
      {open && <ItemsList orderId={order.chataigne_order_id} />}
    </div>
  );
}

interface Props {
  customerRef: string | null;
  onOpenChange: (open: boolean) => void;
}

export function ChataigneCustomerDrawer({ customerRef, onOpenChange }: Props) {
  const summaryQ = useChataigneCustomerSummary(customerRef);
  const ordersQ = useChataigneCustomerOrders(customerRef);
  const s = summaryQ.data;

  return (
    <Sheet open={!!customerRef} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            Client anonyme
          </SheetTitle>
          <SheetDescription>
            Profil pseudonymisé — aucune donnée personnelle n'est stockée ni affichée.
          </SheetDescription>
        </SheetHeader>

        {summaryQ.isLoading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !s ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Aucune donnée de récurrence disponible pour cette commande.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-blue-500/40 bg-blue-500/10 text-blue-600">
                {fmtInt(s.total_orders)} commande{s.total_orders > 1 ? "s" : ""}
              </Badge>
              {s.first_order && (
                <Badge variant="outline">
                  Client depuis {dt(s.first_order, "dd/MM/yyyy")}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <SummaryCard
                icon={ShoppingCart}
                label="Commandes"
                value={fmtInt(s.total_orders)}
              />
              <SummaryCard
                icon={Wallet}
                label="Total dépensé"
                value={fmtEur(s.total_spent, 0)}
              />
              <SummaryCard
                icon={Repeat}
                label="Dernière"
                value={s.last_order ? dt(s.last_order, "dd/MM/yy") : "—"}
                hint={s.last_order ? dt(s.last_order, "HH:mm") : undefined}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center text-xs">
              <div>
                <p className="text-muted-foreground">Panier moyen</p>
                <p className="mt-0.5 text-sm font-semibold">{fmtEur(s.avg_basket)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">% livraison</p>
                <p className="mt-0.5 text-sm font-semibold">
                  {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
                    s.pct_delivery || 0
                  )}
                  %
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Fréquence</p>
                <p className="mt-0.5 text-sm font-semibold">
                  {s.avg_days_between != null
                    ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
                        s.avg_days_between
                      )} j`
                    : "—"}
                </p>
              </div>
            </div>

            {s.total_discount > 0 && (
              <p className="text-xs text-muted-foreground">
                Total remises accordées :{" "}
                <span className="font-medium text-destructive">-{fmtEur(s.total_discount)}</span>
              </p>
            )}

            <Separator />

            <div>
              <h4 className="mb-2 text-sm font-semibold">Historique des commandes</h4>
              {ordersQ.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (ordersQ.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune commande trouvée.</p>
              ) : (
                <div className="space-y-2">
                  {ordersQ.data!.map((o) => (
                    <OrderRow key={o.chataigne_order_id} order={o} />
                  ))}
                </div>
              )}
            </div>

            <p className="pb-6 text-xs text-muted-foreground">
              Vue anonyme — la récurrence est calculée sans aucune donnée personnelle (ni nom, ni
              téléphone).
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
