import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
  Star,
  FileUp,
  ClipboardCheck,
  ShoppingBag,
  Megaphone,
  Award,
  Leaf,
  Tag,
  Building2,
  Plus,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import csLogo from "@/assets/cs-logo.jpeg";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

// Analytics sub-items (first in sidebar, includes dashboard)
const analyticsSubItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Revenus & Ventes", url: "/analytics/revenue", icon: Euro },
  { title: "Ventes Articles", url: "/item-sales", icon: ShoppingBag },
  { title: "Conversion", url: "/analytics/conversion", icon: TrendingUp },
  { title: "Finances & Frais", url: "/analytics/finances", icon: Wallet },
  { title: "Offres & Frais", url: "/analytics/offers", icon: Tag },
  { title: "Opérations", url: "/analytics/operations", icon: Settings2 },
  { title: "Avis", url: "/analytics/reviews", icon: Star },
  { title: "Score de Réussite", url: "/success-score", icon: Award },
  { title: "Éco-Contribution", url: "/analytics/eco-contribution", icon: Leaf },
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
    title: "Checklist Imports",
    url: "/import-checklist",
    icon: ClipboardCheck,
  },
  {
    title: "Import Rapports",
    url: "/report-import",
    icon: FileUp,
  },
  {
    title: "Mapping Uber",
    url: "/uber-mapping",
    icon: Store,
  },
  {
    title: "Mapping Deliveroo",
    url: "/deliveroo-matching",
    icon: Store,
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
    title: "Marketing Analytics",
    url: "/marketing-analytics",
    icon: Megaphone,
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
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const collapsed = state === "collapsed";
  const unreadCount = useUnreadMessages();
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [newChainDialogOpen, setNewChainDialogOpen] = useState(false);
  const [newChainName, setNewChainName] = useState("");
  const { selectedChainId, setSelectedChainId, setSelectedRestaurants, setVisibleRestaurants } = useAnalyticsContext();
  const { data: isSuperAdmin } = useIsSuperAdmin();

  // Fetch available chains
  const { data: chains } = useQuery({
    queryKey: ["chains-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chains")
        .select("id, name")
        .order("name");
      if (error) {
        console.error("Error fetching chains:", error);
        throw error;
      }
      return data || [];
    },
  });

  const activeChainName = selectedChainId
    ? chains?.find((chain) => chain.id === selectedChainId)?.name ?? "Marque sélectionnée"
    : "Toutes les marques";

  const handleChainChange = (value: string) => {
    if (value === "__new__") {
      setNewChainDialogOpen(true);
      return;
    }
    const newChainId = value === "all" ? null : value;
    if (newChainId !== selectedChainId) {
      setSelectedChainId(newChainId);
      setSelectedRestaurants([]);
      setVisibleRestaurants([]);
      void queryClient.invalidateQueries();
    }
  };

  const handleCreateChain = async () => {
    if (!newChainName.trim()) return;
    const { data, error } = await supabase
      .from("chains")
      .insert({ name: newChainName.trim() })
      .select("id")
      .single();
    if (error) {
      toast({ title: "Erreur", description: "Impossible de créer la marque", variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["chains-list"] });
    setSelectedChainId(data.id);
    setSelectedRestaurants([]);
    setVisibleRestaurants([]);
    void queryClient.invalidateQueries();
    setNewChainName("");
    setNewChainDialogOpen(false);
    toast({ title: "Marque créée", description: `"${newChainName.trim()}" est maintenant active` });
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de se déconnecter",
        variant: "destructive",
      });
    } else {
      navigate("/login");
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
           location.pathname === "/classements" ||
           location.pathname === "/item-sales" ||
           location.pathname === "/success-score";
  };
  
  const getActiveAnalyticsSubItem = (url: string) => {
    if (url === "/") {
      return location.pathname === "/";
    }
    if (url === "/classements") {
      return location.pathname === "/classements";
    }
    if (url === "/item-sales") {
      return location.pathname === "/item-sales";
    }
    // Path-based analytics routes (e.g., /analytics/revenue)
    if (url.startsWith("/analytics/") && !url.startsWith("/analytics/ranking")) {
      return location.pathname === url;
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
          {/* Chain selector */}
          {!collapsed && (
            <div className="px-2 pb-2">
              <Select
                value={selectedChainId || "all"}
                onValueChange={handleChainChange}
              >
                <SelectTrigger className="h-11 border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground [&>svg]:text-sidebar-foreground">
                  <div className="flex min-w-0 items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-sidebar-foreground" />
                    <span className="truncate text-sm font-medium text-sidebar-foreground">
                      {activeChainName}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les marques</SelectItem>
                  {chains?.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id}>
                      {chain.name}
                    </SelectItem>
                  ))}
                  <div className="border-t my-1" />
                  <SelectItem value="__new__" className="text-primary font-medium">
                    <div className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Nouvelle marque
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {/* New chain dialog */}
          <Dialog open={newChainDialogOpen} onOpenChange={setNewChainDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Créer une nouvelle marque</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <Input
                  placeholder="Nom de la marque (ex: Burger Factory)"
                  value={newChainName}
                  onChange={(e) => setNewChainName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateChain()}
                  autoFocus
                />
                <Button onClick={handleCreateChain} className="w-full" disabled={!newChainName.trim()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer la marque
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
                      <SidebarMenuSub>
                        {analyticsSubItems.map((subItem) => {
                          const isSubActive = getActiveAnalyticsSubItem(subItem.url);
                          
                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                className={
                                  isSubActive
                                    ? "bg-sidebar-accent/50 text-sidebar-accent-foreground font-medium"
                                    : ""
                                }
                              >
                                <NavLink 
                                  to={subItem.url}
                                  end={subItem.url === "/"}
                                >
                                  <subItem.icon className="h-4 w-4" />
                                  <span>{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
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
              {isSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className={
                      location.pathname === "/admin"
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : ""
                    }
                  >
                    <NavLink to="/admin">
                      <Shield className="h-4 w-4" />
                      {!collapsed && <span>Admin</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
                    <Eye className="h-4 w-4" />
                    {!collapsed && <span>Confidentialité</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <ThemeToggle collapsed={collapsed} />
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
