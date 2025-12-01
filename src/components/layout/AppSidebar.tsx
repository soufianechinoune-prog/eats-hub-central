import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Store,
  LogOut,
  Shield,
  PenLine,
  BarChart3,
  UtensilsCrossed,
  Zap,
  History,
  MessageSquare,
  Settings2,
  Map,
  ChevronRight,
  Eye,
  Euro,
  TrendingUp,
  Wallet,
  Trophy,
  Home,
} from "lucide-react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import csLogo from "@/assets/cs-logo.jpeg";

// Analytics sub-items (first in sidebar, includes dashboard)
const analyticsSubItems = [
  { title: "Vue d'ensemble", url: "/", icon: Eye },
  { title: "Revenus & Ventes", url: "/analytics?view=revenue", icon: Euro },
  { title: "Conversion", url: "/analytics?view=conversion", icon: TrendingUp },
  { title: "Finances & Frais", url: "/analytics?view=finances", icon: Wallet },
  { title: "Classements", url: "/classements", icon: Trophy },
];

// Navigation principale (after Analytics)
const mainItems = [
  {
    title: "Restaurants",
    url: "/restaurants",
    icon: Store,
  },
  {
    title: "Messagerie",
    url: "/messaging",
    icon: MessageSquare,
  },
];

// Gestion des données
const dataItems = [
  {
    title: "Saisie de données",
    url: "/data-entry",
    icon: PenLine,
  },
  {
    title: "Catalogue Produits",
    url: "/menu-items",
    icon: UtensilsCrossed,
  },
  {
    title: "Historique Modifs",
    url: "/menu-history",
    icon: History,
  },
];

// Pilotage & Analyse
const analysisItems = [
  {
    title: "Actions & Events",
    url: "/actions",
    icon: Zap,
  },
  {
    title: "Cartographie",
    url: "/cartography",
    icon: Map,
  },
  {
    title: "Opérations",
    url: "/operations",
    icon: Settings2,
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { toast } = useToast();
  const collapsed = state === "collapsed";
  const unreadCount = useUnreadMessages();
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de se déconnecter",
        variant: "destructive",
      });
    }
  };

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const isAnalyticsActive = () => {
    return location.pathname === "/" || 
           location.pathname.startsWith("/analytics") ||
           location.pathname === "/classements";
  };
  
  const getActiveAnalyticsSubItem = (url: string) => {
    if (url === "/") {
      return location.pathname === "/";
    }
    if (url === "/classements") {
      return location.pathname === "/classements";
    }
    if (url.startsWith("/analytics?view=")) {
      const params = new URLSearchParams(location.search);
      const view = params.get("view");
      return location.pathname === "/analytics" && url.includes(`view=${view}`);
    }
    if (url.startsWith("/analytics/ranking")) {
      return location.pathname.startsWith("/analytics/ranking");
    }
    return false;
  };

  const getBadgeCount = (url: string) => {
    if (url === "/messaging") return unreadCount;
    return 0;
  };

  return (
    <Sidebar className={collapsed ? "w-16" : "w-64"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "text-center" : ""}>
            {collapsed ? (
              <img src={csLogo} alt="CS" className="h-8 w-8 rounded-full object-cover mx-auto" />
            ) : (
              <div className="flex items-center gap-2">
                <img src={csLogo} alt="CS Delivery Performance" className="h-6 w-6 rounded-full object-cover" />
                <span>CS Delivery Performance</span>
              </div>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Analytics Collapsible Menu - First Item */}
              <Collapsible
                open={analyticsOpen || isAnalyticsActive()}
                onOpenChange={setAnalyticsOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={
                        isAnalyticsActive()
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : ""
                      }
                    >
                      <BarChart3 className="h-4 w-4" />
                      {!collapsed && <span>Analytics</span>}
                      {!collapsed && (
                        <motion.div
                          animate={{ rotate: (analyticsOpen || isAnalyticsActive()) ? 90 : 0 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="ml-auto"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </motion.div>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent className="overflow-hidden">
                      <AnimatePresence>
                        {(analyticsOpen || isAnalyticsActive()) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                          >
                            <SidebarMenuSub>
                              {analyticsSubItems.map((subItem, index) => {
                                const isSubActive = getActiveAnalyticsSubItem(subItem.url);
                                
                                return (
                                  <motion.div
                                    key={subItem.title}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ 
                                      duration: 0.2, 
                                      delay: index * 0.05,
                                      ease: "easeOut"
                                    }}
                                  >
                                    <SidebarMenuSubItem>
                                      <SidebarMenuSubButton
                                        asChild
                                        className={
                                          isSubActive
                                            ? "bg-sidebar-accent/50 text-sidebar-accent-foreground font-medium"
                                            : ""
                                        }
                                      >
                                        <NavLink to={subItem.url} end={subItem.url === "/"}>
                                          <subItem.icon className="h-4 w-4" />
                                          <span>{subItem.title}</span>
                                        </NavLink>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  </motion.div>
                                );
                              })}
                            </SidebarMenuSub>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CollapsibleContent>
                  )}
                </SidebarMenuItem>
              </Collapsible>

              {/* Main Items - After Analytics */}
              {mainItems.map((item) => {
                const badgeCount = getBadgeCount(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={
                        isActive(item.url)
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : ""
                      }
                    >
                      <NavLink to={item.url} end={item.url === "/"} className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </div>
                        {badgeCount > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="h-5 min-w-5 flex items-center justify-center text-xs px-1.5 ml-auto"
                          >
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "text-center" : ""}>
            {collapsed ? "📊" : "Données"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dataItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={
                      isActive(item.url)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : ""
                    }
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "text-center" : ""}>
            {collapsed ? "📈" : "Pilotage"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analysisItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={
                      isActive(item.url)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : ""
                    }
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className={
                    location.pathname === "/privacy-policy"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : ""
                  }
                >
                  <NavLink to="/privacy-policy">
                    <Shield className="h-4 w-4" />
                    {!collapsed && <span>Confidentialité</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  {!collapsed && <span>Déconnexion</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
