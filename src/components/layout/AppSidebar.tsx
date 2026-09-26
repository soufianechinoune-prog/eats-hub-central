import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Store,
  LogOut,
  Shield,
  BarChart3,
  Zap,
  MessageSquare,
  Settings2,
  ChevronRight,
  Euro,
  TrendingUp,
  User,
  Wallet,
  Trophy,
  Home,
  Star,
  FileUp,
  ShoppingBag,
  Award,
  Leaf,
  Tag,
  Building2,
  Plus,
  Plug,
  RotateCcw,
} from "lucide-react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useCanImport, useUserRole } from "@/hooks/useUserRole";
import { OverviewChannelSidebar } from "@/components/overview/OverviewChannelSidebar";
import { useChannelAvailability } from "@/hooks/useChannelAvailability";

// Analytics sub-items (first in sidebar, includes dashboard)
const analyticsSubItems = [
  { title: "Live", url: "/live", icon: Zap },
  { title: "Dashboard", url: "/overview", icon: LayoutDashboard },
  { title: "Revenus & Ventes", url: "/analytics/revenue", icon: Euro },
  { title: "Ventes Articles", url: "/item-sales", icon: ShoppingBag },
  { title: "Conversion", url: "/analytics/conversion", icon: TrendingUp },
  { title: "Finances & Frais", url: "/analytics/finances", icon: Wallet },
  { title: "Remboursements", url: "/analytics/refunds", icon: RotateCcw },
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
    title: "Prix & Tarifs",
    url: "/prix-sur-place",
    icon: Tag,
  },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const collapsed = state === "collapsed";
  const { selectedChainId, setSelectedChainId, setSelectedRestaurants, setVisibleRestaurants } = useAnalyticsContext();
  const unreadCount = useUnreadMessages(selectedChainId);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [newChainDialogOpen, setNewChainDialogOpen] = useState(false);
  const [newChainName, setNewChainName] = useState("");
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const canImport = useCanImport();
  const { data: userRole } = useUserRole();
  const isClientReadOnly = userRole === "client";
  const channelAvailability = useChannelAvailability();

  // Fetch available chains
  const { data: chains } = useQuery({
    queryKey: ["chains-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chains")
        .select("id, name, logo_url")
        .order("name");
      if (error) {
        console.error("Error fetching chains:", error);
        throw error;
      }
      return data || [];
    },
  });

  const activeChain = selectedChainId
    ? chains?.find((chain) => chain.id === selectedChainId)
    : null;
  const activeChainName = activeChain?.name ?? (selectedChainId ? "Marque sélectionnée" : "Sélectionner une marque");

  const handleChainChange = (value: string) => {
    if (value === "__new__") {
      setNewChainDialogOpen(true);
      return;
    }
    // Une seule marque à la fois — pas d'option "Toutes les marques"
    if (!value || value === "all") return;
    if (value !== selectedChainId) {
      setSelectedChainId(value);
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
    if (path === "/overview") {
      return location.pathname === "/overview";
    }
    return location.pathname.startsWith(path);
  };

  const isAnalyticsActive = () => {
    return location.pathname === "/overview" || location.pathname === "/live" ||
           location.pathname.startsWith("/chataigne") || location.pathname.startsWith("/caisse") ||
           location.pathname.startsWith("/analytics") ||
           location.pathname === "/classements" ||
           location.pathname === "/item-sales" ||
           location.pathname === "/success-score";
  };
  
  const getActiveAnalyticsSubItem = (url: string) => {
    if (url === "/overview") {
      return location.pathname === "/overview";
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
          {collapsed && (
            <SidebarGroupLabel className="text-center">
              {activeChain?.logo_url ? (
                <img src={activeChain.logo_url} alt={activeChain.name} className="mx-auto h-7 w-auto max-w-[44px] object-contain" />
              ) : activeChain ? (
                <Avatar className="mx-auto h-8 w-8 text-[10px]">
                  <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                    {activeChain.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <img src={csLogo} alt="CS Delivery Performance" className="mx-auto h-8 w-8 rounded-full object-cover" />
              )}
            </SidebarGroupLabel>
          )}
          {/* Read-only badge for client role */}
          {!collapsed && isClientReadOnly && (
            <div className="px-2 pb-2">
              <div className="flex items-center justify-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Accès lecture seule
              </div>
            </div>
          )}
          {/* Chain selector */}
          {!collapsed && canImport && (
            <div className="px-2 pb-2">
              <Select
                value={selectedChainId || ""}
                onValueChange={handleChainChange}
              >
                <SelectTrigger className="h-11 border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground [&>svg]:text-sidebar-foreground">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {activeChain?.logo_url ? (
                      <img src={activeChain.logo_url} alt="" className="h-9 w-auto max-w-[80px] shrink-0 object-contain" />
                    ) : (
                      <Building2 className="h-5 w-5 shrink-0 text-sidebar-foreground" />
                    )}
                    <span className="truncate text-sm font-medium text-sidebar-foreground">
                      {activeChainName}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {chains?.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id}>
                      <div className="flex items-center gap-2.5">
                        {chain.logo_url ? (
                          <img src={chain.logo_url} alt="" className="h-7 w-auto max-w-[70px] object-contain" />
                        ) : (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        )}
                        {chain.name}
                      </div>
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
          {!collapsed && (
            <div className="-mx-2">
              <OverviewChannelSidebar available={channelAvailability} />
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {collapsed && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className={isAnalyticsActive() ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}>
                    <NavLink to="/overview" title="Analytics par canal">
                      <BarChart3 className="h-4 w-4" />
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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

        {canImport && (
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
        )}


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
                <ThemeToggle collapsed={collapsed} />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={
                    location.pathname === "/settings/integrations"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : ""
                  }
                >
                  <NavLink to="/settings/integrations">
                    <Plug className="h-4 w-4" />
                    {!collapsed && <span>Intégrations</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={
                    location.pathname === "/account"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : ""
                  }
                >
                  <NavLink to="/account">
                    <User className="h-4 w-4" />
                    {!collapsed && <span>Mon compte</span>}
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

