import { LayoutGrid, ShoppingBag, Store, Globe, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface NavItem {
  id: OverviewChannel;
  label: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** semantic color token class for the dot */
  dotClass?: string;
}

export function OverviewChannelSidebar({ active, onChange, available }: OverviewChannelSidebarProps) {
  const globalItem: NavItem = {
    id: "global",
    label: "Vue réseau",
    sublabel: "Tous canaux consolidés",
    icon: LayoutGrid,
  };

  const channelItems: NavItem[] = [];
  if (available.uber) {
    channelItems.push({ id: "uber", label: "Uber Eats", icon: ShoppingBag, dotClass: "bg-uber" });
  }
  if (available.deliveroo) {
    channelItems.push({ id: "deliveroo", label: "Deliveroo", icon: ShoppingBag, dotClass: "bg-deliveroo" });
  }
  if (available.cash) {
    channelItems.push({ id: "cash", label: "Caisse", icon: Store, dotClass: "bg-cash" });
  }

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
              {channelItems.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  isActive={active === item.id}
                  onClick={() => onChange(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Bientôt disponible — teasing pour la commercialisation */}
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
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
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
            className={cn(
              "absolute -left-1 -top-1 h-1.5 w-1.5 rounded-full",
              item.dotClass,
            )}
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
      {isActive && <span className="h-5 w-0.5 rounded-full bg-primary" aria-hidden />}
    </button>
  );
}
