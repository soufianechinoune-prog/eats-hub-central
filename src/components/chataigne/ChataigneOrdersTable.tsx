import { Fragment, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDown,
  ArrowUp,
  Bike,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  HelpCircle,
  Search,
  ShoppingBag,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useChataigneOrderItems,
  useChataigneOrdersList,
  type ChataigneOrderItemRow,
  type ChataigneOrderRow,
  type ChataigneOrdersSortField,
  type RestaurantScope,
} from "@/hooks/useChataigne";

const fmtEur = (v: number, digits = 2) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v || 0);

const fmtInt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));

const PAGE_SIZE = 25;

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

const PAYMENT_LABEL: Record<string, string> = {
  captured: "Encaissé",
  authorized: "Autorisé",
  cancelled: "Annulé",
  refunded: "Remboursé",
  partially_refunded: "Remb. partiel",
};

function StatusBadge({ status }: { status: string | null }) {
  const label = STATUS_LABEL[status ?? ""] ?? status ?? "—";
  const tone =
    status === "completed"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
      : status === "cancelled" || status === "delivery_failed"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-amber-500/40 bg-amber-500/10 text-amber-600";
  return (
    <Badge variant="outline" className={tone}>
      {label}
    </Badge>
  );
}

function PaymentBadge({ status, amount }: { status: string | null; amount: number }) {
  const label = PAYMENT_LABEL[status ?? ""] ?? status ?? "—";
  return (
    <div className="flex flex-col items-end">
      <span className="text-sm">{fmtEur(amount)}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function ClientBadge({
  total,
  rank,
  onClick,
}: {
  total: number | null;
  rank: number | null;
  onClick?: () => void;
}) {
  if (!total || total < 1) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const isNew = total === 1;
  const content = (
    <div className="flex flex-col items-start">
      <Badge
        variant="outline"
        className={cn(
          "text-xs font-medium",
          onClick && "cursor-pointer hover:brightness-95",
          isNew
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
            : "border-blue-500/40 bg-blue-500/10 text-blue-600"
        )}
      >
        {isNew ? "Nouveau" : `${total} cmdes`}
      </Badge>
      {!isNew && rank != null && rank > 0 && (
        <span className="mt-0.5 text-[10px] text-muted-foreground">
          {rank === 1 ? "1ʳᵉ commande" : `${rank}ᵉ commande`}
        </span>
      )}
    </div>
  );
  if (!onClick) return content;
  return (
    <button
      type="button"
      title="Voir le détail client (anonyme)"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="text-left"
    >
      {content}
    </button>
  );
}

function dt(value: string | null, pattern = "dd/MM/yyyy HH:mm") {
  if (!value) return "—";
  return format(new Date(value), pattern, { locale: fr });
}

interface ItemNode extends ChataigneOrderItemRow {
  children: ItemNode[];
}

function buildTree(items: ChataigneOrderItemRow[]): ItemNode[] {
  const nodes = new Map<string, ItemNode>();
  items.forEach((i) => {
    if (i.item_id) nodes.set(i.item_id, { ...i, children: [] });
  });
  const roots: ItemNode[] = [];
  items.forEach((i) => {
    const node = (i.item_id && nodes.get(i.item_id)) || { ...i, children: [] };
    const parent = i.parent_item_id ? nodes.get(i.parent_item_id) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function ItemRows({ nodes, level = 0 }: { nodes: ItemNode[]; level?: number }) {
  return (
    <>
      {nodes.map((n) => (
        <Fragment key={n.id}>
          <TableRow className={level > 0 ? "bg-muted/20" : undefined}>
            <TableCell
              className={cn("py-1.5", level === 0 ? "font-medium" : "text-muted-foreground")}
              style={{ paddingLeft: `${12 + level * 20}px` }}
            >
              {level > 0 && <span className="mr-1 text-muted-foreground">└</span>}
              {n.item_name ?? "—"}
            </TableCell>
            <TableCell className="py-1.5 text-right">×{fmtInt(n.quantity)}</TableCell>
            <TableCell className="py-1.5 text-right">
              {n.unit_price_amount ? fmtEur(n.unit_price_amount) : "—"}
            </TableCell>
          </TableRow>
          {n.children.length > 0 && <ItemRows nodes={n.children} level={level + 1} />}
        </Fragment>
      ))}
    </>
  );
}

function OrderDetail({ order }: { order: ChataigneOrderRow }) {
  const itemsQ = useChataigneOrderItems(order.chataigne_order_id);
  const tree = useMemo(() => buildTree(itemsQ.data ?? []), [itemsQ.data]);
  const discounts = order.discounts ?? [];

  return (
    <div className="grid gap-6 bg-muted/30 p-4 lg:grid-cols-3">
      {/* Panier */}
      <div className="lg:col-span-2">
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <ShoppingBag className="h-4 w-4 text-muted-foreground" /> Panier
        </h4>
        {itemsQ.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : tree.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun article enregistré pour cette commande.</p>
        ) : (
          <div className="rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="text-right">Prix unitaire</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <ItemRows nodes={tree} />
              </TableBody>
            </Table>
          </div>
        )}

        {discounts.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Tag className="h-4 w-4 text-muted-foreground" /> Promotions appliquées
            </h4>
            <div className="space-y-1 rounded-lg border bg-background p-3">
              {discounts.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{d.name ?? "Remise"}</span>
                  <span className="font-medium text-destructive">
                    -{fmtEur(Number(d.amount ?? 0))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Récap financier */}
      <div>
        <h4 className="mb-2 text-sm font-semibold">Récapitulatif</h4>
        <div className="space-y-2 rounded-lg border bg-background p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total TTC</span>
            <span className="font-semibold">{fmtEur(order.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Frais de livraison</span>
            <span>{fmtEur(order.delivery_fee_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Frais de service</span>
            <span>{fmtEur(order.service_charge_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total remises</span>
            <span className="text-destructive">
              {order.discount_total_amount ? `-${fmtEur(order.discount_total_amount)}` : fmtEur(0)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="text-muted-foreground">Paiement</span>
            <span>
              {fmtEur(order.payment_amount)} ·{" "}
              {PAYMENT_LABEL[order.payment_status ?? ""] ?? order.payment_status ?? "—"}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="text-muted-foreground">Commande</span>
            <span>{dt(order.order_datetime)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Retrait prévu</span>
            <span>{dt(order.expected_pickup_time)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Livraison prévue</span>
            <span>{dt(order.expected_delivery_time)}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Chataigne ne transmet ni HT/TVA ni commission : seuls le TTC et les frais réellement
          facturés sont affichés.
        </p>
      </div>
    </div>
  );
}

interface Props {
  start: string;
  end: string;
  restaurantIds: RestaurantScope;
}

export function ChataigneOrdersTable({ start, end, restaurantIds }: Props) {
  const [page, setPage] = useState(0);
  const [serviceType, setServiceType] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<ChataigneOrdersSortField>("order_datetime");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [start, end, restaurantIds, serviceType, search, sortField, sortDir]);

  const query = useChataigneOrdersList({
    start,
    end,
    restaurantIds,
    serviceType: serviceType === "all" ? null : serviceType,
    search,
    sortField,
    sortDir,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleSort = (field: ChataigneOrdersSortField) => {
    if (field === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir(field === "restaurant_name" ? "asc" : "desc");
    }
  };

  const SortHead = ({
    field,
    label,
    align = "left",
  }: {
    field: ChataigneOrdersSortField;
    label: string;
    align?: "left" | "right";
  }) => (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-foreground",
          sortField === field ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {sortField === field &&
          (sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          ))}
      </button>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commandes (détail)</CardTitle>
        <CardDescription>
          Toutes les commandes du canal Chataigne sur la période et le périmètre sélectionnés.
          Cliquez sur une ligne pour voir le panier complet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="N° de commande ou restaurant…"
              className="pl-9"
            />
          </div>
          <Select value={serviceType} onValueChange={setServiceType}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="collection">À emporter</SelectItem>
              <SelectItem value="delivery">Livraison</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto inline-flex items-center gap-2 text-sm text-muted-foreground">
            {query.isLoading ? "Chargement…" : `${fmtInt(total)} commande${total > 1 ? "s" : ""}`}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 cursor-help text-muted-foreground/70 hover:text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">
                    Récurrence calculée de façon anonyme, sans données personnelles.
                    Le « Client » affiche uniquement le nombre total de commandes du profil
                    pseudonymisé.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>
        </div>

        {query.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucune commande sur cette période avec ces filtres.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <SortHead field="order_datetime" label="Date / heure" />
                  <SortHead field="restaurant_name" label="Store" />
                  <TableHead>N°</TableHead>
                  <SortHead field="client_total_orders" label="Client" align="right" />
                  <TableHead>Canal</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Articles</TableHead>
                  <SortHead field="total_amount" label="TTC" align="right" />
                  <SortHead field="delivery_fee_amount" label="Frais livraison" align="right" />
                  <TableHead className="text-right">Frais service</TableHead>
                  <SortHead field="discount_total_amount" label="Promo" align="right" />
                  <TableHead className="text-right">Paiement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const isOpen = expanded === r.chataigne_order_id;
                  return (
                    <Fragment key={r.chataigne_order_id}>
                      <TableRow
                        onClick={() => setExpanded(isOpen ? null : r.chataigne_order_id)}
                        className="cursor-pointer"
                      >
                        <TableCell className="w-8">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{dt(r.order_datetime)}</TableCell>
                        <TableCell className="font-medium">
                          {r.restaurant_name ?? "—"}
                          {r.city && (
                            <span className="block text-xs text-muted-foreground">{r.city}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.short_id ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <ClientBadge total={r.client_total_orders} rank={r.client_order_rank} />
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {r.channel ?? "—"}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            {r.service_type === "delivery" ? (
                              <Bike className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {SERVICE_LABEL[r.service_type ?? ""] ?? r.service_type ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="text-right">{fmtInt(r.item_count)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {fmtEur(r.total_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtEur(r.delivery_fee_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtEur(r.service_charge_amount)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right",
                            r.discount_total_amount > 0 && "text-destructive"
                          )}
                        >
                          {r.discount_total_amount > 0
                            ? `-${fmtEur(r.discount_total_amount)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <PaymentBadge status={r.payment_status} amount={r.payment_amount} />
                        </TableCell>
                      </TableRow>
                        {isOpen && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={14} className="p-0">
                              <OrderDetail order={r} />
                            </TableCell>
                          </TableRow>
                        )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} sur {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || query.isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= pageCount || query.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Suivant
              <ChevronRightIcon className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
