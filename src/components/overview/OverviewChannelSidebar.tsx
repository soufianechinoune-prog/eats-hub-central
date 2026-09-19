import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  ShoppingBag,
  Store,
  Globe,
  MessageCircle,
  ChevronRight,
  Euro,
  TrendingUp,
  Wallet,
  Tag,
  Settings2,
  Star,
  Award,
  Leaf,
  Sparkles,
  Ticket,
  PauseCircle,
  Package,
  BarChart3,
  ClipboardList,
  CalendarDays,
  Bike,
  Users,
  CreditCard,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

export type OverviewChannel = "global" | "uber" | "uber-tr" | "deliveroo" | "cash" | "dishop" | "chataigne";

interface OverviewChannelSidebarProps {
  /** Canal actif (mode Vue d'ensemble). Absent = déduit de l'URL. */
  active?: OverviewChannel;
  /** Change le canal sans navigation (mode Vue d'ensemble). Absent = navigation par URL. */
  onChange?: (channel: OverviewChannel) => void;
  available: {
    uber: boolean;
    deliveroo: boolean;
    cash: boolean;
    dishop: boolean;
    chataigne?: boolean;
  };
  /** Appelé après un clic, pour fermer le panneau mobile. */
  onNavigate?: () => void;
}

interface SubNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Route to navigate to. If undefined, stays on /overview (Synthèse). */
  route?: string;
  /** Si défini, change le channel actif sur /overview au lieu de naviguer. */
  channel?: OverviewChannel;
  /** Petit libellé de section affiché au-dessus de l'entrée. */
  section?: string;
  /** Entrée à venir : visible mais non cliquable. */
  soon?: boolean;
}

interface NavItem {
  id: OverviewChannel;
  label: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  dotClass?: string;
  subItems?: SubNavItem[];
}

// Sous-onglets Uber Eats — mêmes entrées que la sidebar gauche Analytics, scopés Uber
const UBER_SUB_ITEMS: SubNavItem[] = [
  { id: "synthese", label: "Synthèse", icon: Sparkles }, // route undefined = vue actuelle
  { id: "titres-restaurant", label: "Titres Restaurant", icon: Ticket, channel: "uber-tr" },
  { id: "revenue", label: "Revenus & Ventes", icon: Euro, route: "/analytics/revenue" },
  { id: "items", label: "Ventes Articles", icon: ShoppingBag, route: "/item-sales" },
  { id: "conversion", label: "Conversion", icon: TrendingUp, route: "/analytics/conversion" },
  { id: "finances", label: "Finances & Frais", icon: Wallet, route: "/analytics/finances" },
  { id: "offers", label: "Offres & Frais", icon: Tag, route: "/analytics/offers" },
  { id: "operations", label: "Opérations", icon: Settings2, route: "/analytics/operations" },
  { id: "reviews", label: "Avis", icon: Star, route: "/analytics/reviews" },
  { id: "success", label: "Score de Réussite", icon: Award, route: "/success-score" },
  { id: "eco", label: "Éco-Contribution", icon: Leaf, route: "/analytics/eco-contribution" },
];

// Sous-onglets Deliveroo — uniquement les vues alimentées par la donnée Deliveroo
const DELIVEROO_SUB_ITEMS: SubNavItem[] = [
  { id: "synthese", label: "Synthèse", icon: Sparkles },
  { id: "revenue", label: "Revenus & Ventes", icon: Euro, route: "/analytics/revenue" },
  { id: "finances", label: "Finances & Frais", icon: Wallet, route: "/analytics/finances" },
  { id: "operations", label: "Opérations", icon: Settings2, route: "/analytics/operations" },
  { id: "downtime", label: "Disponibilité", icon: PauseCircle, route: "/compare/downtime" },
  { id: "deliveroo-rentabilite", label: "Rentabilité", icon: Euro, route: "/deliveroo/rentabilite" },
];

// Sous-onglets Caisse — regroupe les vues alimentées par la caisse (Splash360)
const CASH_SUB_ITEMS: SubNavItem[] = [
  { id: "synthese", label: "Synthèse", icon: Sparkles },
  { id: "onsite-sales", label: "Ventes sur place", icon: Store, route: "/analytics/onsite-sales" },
  { id: "payments", label: "Moyens de paiement", icon: CreditCard, route: "/caisse/paiements" },
  { id: "product-sales", label: "Ventes par produit", icon: Package, route: "/caisse/produits" },
  { id: "instore-prices", label: "Prix sur place", icon: Tag, route: "/prix-sur-place", section: "Réglages" },
];

// Sous-onglets Chataigne — vues internes et écrans dédiés du canal
const CHATAIGNE_SUB_ITEMS: SubNavItem[] = [
  { id: "synthese", label: "Synthèse", icon: Sparkles, route: "/chataigne" },
  { id: "details", label: "Analyse détaillée", icon: BarChart3, route: "/chataigne?tab=details" },
  { id: "orders", label: "Commandes", icon: ClipboardList, route: "/chataigne?tab=orders" },
  { id: "daily", label: "Vue quotidienne", icon: CalendarDays, route: "/chataigne?tab=daily" },
  { id: "service", label: "Emport vs Livraison", icon: Bike, route: "/chataigne?tab=service" },
  { id: "growth", label: "Croissance & Clients", icon: Users, route: "/chataigne/croissance" },
  { id: "referral", label: "Parrainage", icon: Gift, route: "/chataigne/parrainage" },
  { id: "pricing", label: "Écarts & Markup", icon: Tag, route: "/chataigne/tarification" },
  { id: "profitability", label: "Rentabilité", icon: Euro, route: "/chataigne/rentabilite" },
];

/** Déduit le canal et la sous-entrée actifs à partir de l'adresse de la page. */
function channelFromPath(pathname: string, search: string): { channel: OverviewChannel; subId: string } | null {
  if (pathname.startsWith("/analytics/onsite-sales")) return { channel: "cash", subId: "onsite-sales" };
  if (pathname.startsWith("/caisse/paiements")) return { channel: "cash", subId: "payments" };
  if (pathname.startsWith("/caisse/produits")) return { channel: "cash", subId: "product-sales" };
  if (pathname.startsWith("/prix-sur-place")) return { channel: "cash", subId: "instore-prices" };
  if (pathname.startsWith("/chataigne/croissance")) return { channel: "chataigne", subId: "growth" };
  if (pathname.startsWith("/chataigne/tarification")) return { channel: "chataigne", subId: "pricing" };
  if (pathname.startsWith("/chataigne/rentabilite")) return { channel: "chataigne", subId: "profitability" };
  if (pathname === "/chataigne") {
    const tab = new URLSearchParams(search).get("tab");
    return {
      channel: "chataigne",
      subId: tab === "details" || tab === "orders" || tab === "daily" || tab === "service" ? tab : "synthese",
    };
  }
  return null;
}

export function OverviewChannelSidebar({
  active,
  onChange,
  available,
  onNavigate,
}: OverviewChannelSidebarProps) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const analyticsCtx = useAnalyticsContext();

  const routeMatch = channelFromPath(pathname, search);
  // Mode "route" : la page n'est pas la Vue d'ensemble, l'état actif vient de l'URL.
  const routeMode = !onChange;
  const activeChannel: OverviewChannel = routeMode
    ? routeMatch?.channel ?? "global"
    : active ?? "global";
  const routeSubId = routeMode ? routeMatch?.subId ?? "synthese" : null;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    uber: activeChannel === "uber" || activeChannel === "uber-tr",
    deliveroo: activeChannel === "deliveroo",
    cash: activeChannel === "cash",
    chataigne: activeChannel === "chataigne",
  });
  const [activeSubId, setActiveSubId] = useState<string>(
    activeChannel === "uber-tr" ? "titres-restaurant" : "synthese",
  );

  const currentSubId = routeSubId ?? activeSubId;

  const globalItem: NavItem = {
    id: "global",
    label: "Vue réseau",
    sublabel: "Tous canaux consolidés",
    icon: LayoutGrid,
  };

  const channelItems: NavItem[] = [];
  if (available.uber) {
    channelItems.push({
      id: "uber",
      label: "Uber Eats",
      icon: ShoppingBag,
      dotClass: "bg-uber",
      subItems: UBER_SUB_ITEMS,
    });
  }
  if (available.deliveroo) {
    channelItems.push({
      id: "deliveroo",
      label: "Deliveroo",
      icon: ShoppingBag,
      dotClass: "bg-deliveroo",
      subItems: DELIVEROO_SUB_ITEMS,
    });
  }
  if (available.cash) {
    channelItems.push({
      id: "cash",
      label: "Caisse",
      icon: Store,
      dotClass: "bg-cash",
      subItems: CASH_SUB_ITEMS,
    });
  }
  if (available.dishop) {
    channelItems.push({ id: "dishop", label: "Dishop", icon: Globe, dotClass: "bg-blue-500" });
  }
  if (available.chataigne) {
    channelItems.push({
      id: "chataigne",
      label: "Chataigne",
      icon: MessageCircle,
      dotClass: "bg-emerald-500",
      subItems: CHATAIGNE_SUB_ITEMS,
    });
  }

  /** Revient sur la Vue d'ensemble en ouvrant directement le canal demandé. */
  const goToOverviewChannel = (channel: OverviewChannel) => {
    navigate(channel === "global" ? "/overview" : `/overview?channel=${channel}`);
    onNavigate?.();
  };

  const handleChannelClick = (item: NavItem) => {
    if (routeMode) {
      goToOverviewChannel(item.id);
      return;
    }
    onChange?.(item.id);
    if (item.subItems?.length) {
      setExpanded((prev) => ({ ...prev, [item.id]: true }));
      setActiveSubId("synthese");
    }
  };

  const handleSubItemClick = (sub: SubNavItem, channel: OverviewChannel) => {
    if (sub.soon) return;
    setActiveSubId(sub.id);

    if (sub.channel) {
      if (routeMode) {
        goToOverviewChannel(sub.channel);
        return;
      }
      onChange?.(sub.channel);
      return;
    }

    if (!sub.route) {
      if (routeMode) {
        goToOverviewChannel(channel);
        return;
      }
      onChange?.(channel);
      return;
    }

    if (channel === "uber" || channel === "deliveroo") {
      analyticsCtx.setSelectedPlatform(channel === "deliveroo" ? "deliveroo" : "uber_eats");
    }
    navigate(sub.route);
    onNavigate?.();
  };

  return (
    <div className="p-4 space-y-6">
      {/* Vue globale */}
      <div>
        <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Vue globale
        </p>
        <NavButton
          item={globalItem}
          isActive={activeChannel === globalItem.id}
          onClick={() => handleChannelClick(globalItem)}
        />
      </div>

      {/* Par canal */}
      {channelItems.length > 0 && (
        <div>
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Par canal
          </p>
          <div className="space-y-0.5">
            {channelItems.map((item) => {
              const isActive =
                activeChannel === item.id || (item.id === "uber" && activeChannel === "uber-tr");
              const hasSubs = (item.subItems?.length ?? 0) > 0;
              const isExpanded = !!expanded[item.id] || (isActive && hasSubs);
              return (
                <div key={item.id}>
                  <NavButton
                    item={item}
                    isActive={isActive}
                    onClick={() => handleChannelClick(item)}
                    trailing={
                      hasSubs ? (
                        <button
                          type="button"
                          aria-label={isExpanded ? "Replier" : "Déplier"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded((prev) => ({ ...prev, [item.id]: !isExpanded }));
                          }}
                          className="p-0.5 rounded hover:bg-muted/60"
                        >
                          <ChevronRight
                            className={cn(
                              "h-3.5 w-3.5 text-muted-foreground transition-transform",
                              isExpanded && "rotate-90",
                            )}
                          />
                        </button>
                      ) : null
                    }
                  />
                  {hasSubs && isExpanded && (
                    <div className="ml-5 mt-0.5 mb-1 pl-2 border-l border-border/60 space-y-0.5">
                      {item.subItems!.map((sub) => {
                        const SubIcon = sub.icon;
                        const subActive = isActive && currentSubId === sub.id;
                        return (
                          <div key={sub.id}>
                            {sub.section && (
                              <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {sub.section}
                              </p>
                            )}
                            <button
                              type="button"
                              disabled={sub.soon}
                              onClick={() => handleSubItemClick(sub, item.id)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[13px] transition-colors",
                                sub.soon ? "cursor-default opacity-50" : "hover:bg-muted/60",
                                subActive
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-muted-foreground",
                              )}
                            >
                              <SubIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{sub.label}</span>
                              {sub.soon && (
                                <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                                  bientôt
                                </span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bientôt disponible */}
      {!available.chataigne && (
        <div>
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Bientôt
          </p>
          <div className="space-y-0.5 opacity-50">
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <MessageCircle className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({
  item,
  isActive,
  onClick,
  trailing,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  const Icon = item.icon;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "w-full flex cursor-pointer items-start gap-2.5 px-2 py-2 rounded-md text-left transition-colors",
        "hover:bg-muted/60",
        isActive && "bg-primary/10 text-primary",
      )}
    >
      <div className="relative shrink-0 mt-0.5">
        <Icon className="h-4 w-4" />
        {item.dotClass && (
          <span
            className={cn("absolute -left-1 -top-1 h-1.5 w-1.5 rounded-full", item.dotClass)}
            aria-hidden
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-medium leading-tight", isActive ? "text-primary" : "text-foreground")}>
          {item.label}
        </div>
        {item.sublabel && (
          <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
            {item.sublabel}
          </div>
        )}
      </div>
      {trailing}
      {isActive && !trailing && <span className="h-5 w-0.5 rounded-full bg-primary" aria-hidden />}
    </div>
  );
}
