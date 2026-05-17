import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";

export type OverviewChannel = "global" | "uber" | "deliveroo" | "cash";

interface OverviewChannelSidebarProps {
  active: OverviewChannel;
  onChange: (channel: OverviewChannel) => void;
  available: {
    uber: boolean;
    deliveroo: boolean;
    cash: boolean;
  };
}

interface SubNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Route to navigate to. If undefined, stays on /overview (Synthèse). */
  route?: string;
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

export function OverviewChannelSidebar({ active, onChange, available }: OverviewChannelSidebarProps) {
  const navigate = useNavigate();
  const analyticsCtx = useAnalyticsContext();
  const [expandedUber, setExpandedUber] = useState(active === "uber");
  const [activeSubId, setActiveSubId] = useState<string>("synthese");

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
    channelItems.push({ id: "deliveroo", label: "Deliveroo", icon: ShoppingBag, dotClass: "bg-deliveroo" });
  }
  if (available.cash) {
    channelItems.push({ id: "cash", label: "Caisse", icon: Store, dotClass: "bg-cash" });
  }

  const handleChannelClick = (item: NavItem) => {
    onChange(item.id);
    if (item.id === "uber") {
      setExpandedUber(true);
      setActiveSubId("synthese");
    }
  };

  const handleSubItemClick = (sub: SubNavItem) => {
    setActiveSubId(sub.id);
    if (!sub.route) return; // Synthèse → reste sur /overview
    // Pré-sélection plateforme Uber Eats dans le contexte Analytics
    analyticsCtx.setSelectedPlatform("uber_eats");
    navigate(sub.route);
  };

  return (
    <aside className="w-60 shrink-0 border-r border-border/50 bg-card/40 backdrop-blur-xl">
      <div className="sticky top-0 p-4 space-y-6">
        {/* Vue globale */}
        <div>
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Vue globale
          </p>
          <NavButton
            item={globalItem}
            isActive={active === globalItem.id}
            onClick={() => onChange(globalItem.id)}
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
                const isActive = active === item.id;
                const hasSubs = (item.subItems?.length ?? 0) > 0;
                const isExpanded = item.id === "uber" ? expandedUber : false;
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
                              if (item.id === "uber") setExpandedUber((v) => !v);
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
                          const subActive = isActive && activeSubId === sub.id;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => handleSubItemClick(sub)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[13px] transition-colors",
                                "hover:bg-muted/60",
                                subActive
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-muted-foreground",
                              )}
                            >
                              <SubIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{sub.label}</span>
                            </button>
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
        <div>
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Bientôt
          </p>
          <div className="space-y-0.5 opacity-50">
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <Globe className="h-3.5 w-3.5" />
              <span>eShop</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <MessageCircle className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
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
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-2.5 px-2 py-2 rounded-md text-left transition-colors",
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
    </button>
  );
}
