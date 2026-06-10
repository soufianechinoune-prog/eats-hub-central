import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  usePOSConnectors,
  useActiveChainPOSConnections,
  useConnectPOS,
  useDisconnectPOS,
  useSyncPOS,
  useBackfillPOS,
  useDishopTestAuth,
  useDishopListShops,
  useDishopDiagAccounting,
  type POSConnector,
} from "@/hooks/usePOSConnectors";

import { useAnalyticsContext } from "@/contexts/AnalyticsContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, CheckCircle2, ExternalLink, Plug, Sparkles, Bell, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SplashResilientBackfillCard } from "@/components/integrations/SplashResilientBackfillCard";
import { SplashSyncRunsCard } from "@/components/integrations/SplashSyncRunsCard";
import { DishopIntegrationCard } from "@/components/integrations/DishopIntegrationCard";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

export default function Integrations() {
  const navigate = useNavigate();
  const { selectedChainId } = useAnalyticsContext();
  const { data: connectors = [], isLoading: loadingCatalog } = usePOSConnectors();
  const { data: activeConnections = [], isLoading: loadingConnection } =
    useActiveChainPOSConnections();
  const connect = useConnectPOS();
  const disconnect = useDisconnectPOS();
  const sync = useSyncPOS();
  const backfill = useBackfillPOS();
  const dishopTest = useDishopTestAuth();
  const dishopShops = useDishopListShops();
  const dishopDiag = useDishopDiagAccounting();
  const { data: isSuperAdmin } = useIsSuperAdmin();

  const [openConnector, setOpenConnector] = useState<POSConnector | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [credentialsForm, setCredentialsForm] = useState<Record<string, string>>({});
  const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number } | null>(null);
  const [shopsDialogOpen, setShopsDialogOpen] = useState(false);
  const [shopsList, setShopsList] = useState<any[] | null>(null);

  const connectionByConnector = useMemo(() => {
    const map: Record<string, (typeof activeConnections)[number]> = {};
    for (const c of activeConnections) map[c.connector_id] = c;
    return map;
  }, [activeConnections]);
  const activeConnectorIds = useMemo(
    () => new Set(activeConnections.map((c) => c.connector_id)),
    [activeConnections],
  );


  const handleOpenConnect = (connector: POSConnector) => {
    if (connector.status !== "available") return;
    setOpenConnector(connector);
    setAccountLabel("");
    setCredentialsForm({});
  };

  const handleSubmit = async () => {
    if (!openConnector) return;
    const missing = openConnector.required_fields
      .filter((f) => f.required && !credentialsForm[f.key]?.trim())
      .map((f) => f.label);
    if (missing.length > 0) {
      toast({
        title: "Champs requis manquants",
        description: missing.join(", "),
        variant: "destructive",
      });
      return;
    }
    try {
      const inserted = await connect.mutateAsync({
        connectorId: openConnector.id,
        accountLabel,
        credentials: credentialsForm,
      });
      toast({
        title: "Caisse connectée ✓",
        description: `${openConnector.name} est maintenant lié.`,
      });
      setOpenConnector(null);

      // Splash360 → synchro immédiate (mois en cours, granularité jour)
      // Dishop → test d'auth automatique (pas de sync en étape 1)
      // Autres → rien
      if (openConnector.id === "splash360") {
        try {
          const result = await sync.mutateAsync({
            connectionId: inserted.id,
            connectorId: openConnector.id,
          });
          toast({
            title: "Synchronisation terminée ✓",
            description: `${result.rows_upserted ?? 0} lignes importées (${result.period}).`,
          });
        } catch (syncErr: any) {
          toast({
            title: "Connexion OK mais synchro échouée",
            description: syncErr?.message || "Tu peux relancer depuis le bouton Synchroniser.",
            variant: "destructive",
          });
        }
        navigate("/overview");
      } else if (openConnector.id === "dishop") {
        try {
          const r = await dishopTest.mutateAsync(inserted.id);
          toast({
            title: "Authentification Dishop OK ✓",
            description: `Token valide (${r.expires_in}s). Tu peux maintenant lister les shops.`,
          });
        } catch (e: any) {
          toast({
            title: "Connexion enregistrée mais auth Dishop échouée",
            description: e?.message || "Vérifie le client_id / client_secret.",
            variant: "destructive",
          });
        }
      }
    } catch (e: any) {
      toast({
        title: "Erreur de connexion",
        description: e?.message || "Impossible de connecter la caisse.",
        variant: "destructive",
      });
    }
  };

  const handleDishopTest = async (conn: { id: string } | undefined) => {
    if (!conn) return;
    try {
      const r = await dishopTest.mutateAsync(conn.id);
      toast({
        title: "Authentification Dishop OK ✓",
        description: `Token valide pendant ${r.expires_in}s. Scopes : ${
          (r.validation as any)?.scopes?.join(", ") || "n/a"
        }`,
      });
    } catch (e: any) {
      toast({
        title: "Échec d'authentification Dishop",
        description: e?.message || "Vérifie les credentials.",
        variant: "destructive",
      });
    }
  };

  const handleDishopListShops = async (conn: { id: string } | undefined) => {
    if (!conn) return;
    try {
      const r = await dishopShops.mutateAsync(conn.id);
      setShopsList(r.shops);
      setShopsDialogOpen(true);
      toast({
        title: `${r.shop_count} shops trouvés sur Dishop`,
        description: `Endpoint utilisé : ${r.endpoint_used}`,
      });
    } catch (e: any) {
      toast({
        title: "Impossible de lister les shops",
        description: e?.message || "Vérifie le company_id ou contacte Dishop.",
        variant: "destructive",
      });
    }
  };

  const handleDishopDiag = async (conn: { id: string } | undefined) => {
    if (!conn) return;
    try {
      const r = await dishopDiag.mutateAsync(conn.id);
      console.log("[Dishop diag accounting]", r);
      const summary = r.probes
        .map((p) => `[${p.status}] ${p.url}\n${p.body_preview}`)
        .join("\n\n");
      // Surface in console + clipboard for easy paste to Dishop
      try {
        await navigator.clipboard.writeText(
          `Stored company_id: ${r.stored_company_id}\nToken: ${r.token_preview}\nPermissions: ${JSON.stringify(r.permissions)}\n\n${summary}`,
        );
      } catch {
        // ignore clipboard errors
      }
      toast({
        title: "Diagnostic Dishop terminé",
        description: `${r.probes.length} requêtes envoyées. Détails copiés dans le presse-papiers + console (F12).`,
      });
    } catch (e: any) {
      toast({
        title: "Diagnostic Dishop échoué",
        description: e?.message || "Voir la console",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async (connectionId: string, connectorName: string) => {
    try {
      await disconnect.mutateAsync(connectionId);
      toast({ title: `${connectorName} déconnectée` });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Impossible de déconnecter.",
        variant: "destructive",
      });
    }
  };

  const handleSync = async (conn: { id: string; connector_id: string } | undefined) => {
    if (!conn) return;
    try {
      const result = await sync.mutateAsync({
        connectionId: conn.id,
        connectorId: conn.connector_id,
      });
      toast({
        title: "Synchronisation terminée ✓",
        description: `${result.rows_upserted ?? 0} lignes importées (${result.period}).`,
      });
    } catch (e: any) {
      toast({
        title: "Erreur de synchronisation",
        description: e?.message || "Impossible de synchroniser.",
        variant: "destructive",
      });
    }
  };

  const handleBackfill = async (conn: { id: string; connector_id: string } | undefined) => {
    if (!conn) return;
    setBackfillProgress({ done: 0, total: 24 });
    toast({
      title: "Backfill lancé",
      description: "Import des 24 derniers mois en cours… (≈ 8-12 min)",
    });
    try {
      const result = await backfill.mutateAsync({
        connectionId: conn.id,
        connectorId: conn.connector_id,
        monthsBack: 24,
        onProgress: ({ done, total }) => setBackfillProgress({ done, total }),
      });
      const errorMonths = (result.per_month ?? []).filter((m: any) => m.error);
      const okMonths = (result.per_month ?? []).filter((m: any) => !m.error);
      const errorsCount = errorMonths.length;
      toast({
        title: errorsCount === 0 ? "Backfill terminé ✓" : `Backfill terminé avec ${errorsCount} erreur(s)`,
        description:
          `${result.total_rows ?? 0} lignes importées sur ${okMonths.length}/${result.months_back} mois.` +
          (errorsCount > 0
            ? ` Mois en erreur : ${errorMonths.slice(0, 6).map((m: any) => m.period).join(", ")}${errorsCount > 6 ? "…" : ""}`
            : ""),
        variant: errorsCount > 0 ? "destructive" : "default",
      });
    } catch (e: any) {
      toast({
        title: "Erreur de backfill",
        description: e?.message || "Impossible de faire le backfill.",
        variant: "destructive",
      });
    } finally {

      setBackfillProgress(null);
    }
  };

  const sortedConnectors = useMemo(
    () =>
      [...connectors].sort((a, b) => {
        // Active first, then available, then coming_soon
        const aActive = activeConnectorIds.has(a.id);
        const bActive = activeConnectorIds.has(b.id);
        if (aActive && !bActive) return -1;
        if (bActive && !aActive) return 1;
        const order = { available: 0, coming_soon: 1, deprecated: 2 } as const;
        return order[a.status] - order[b.status] || a.display_order - b.display_order;
      }),
    [connectors, activeConnectorIds],
  );


  if (!selectedChainId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Sélectionnez une marque dans la barre latérale pour configurer ses intégrations.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Plug className="h-7 w-7 text-primary" />
            Intégrations
          </h1>
          <p className="text-muted-foreground mt-1">
            Connectez votre logiciel de caisse pour débloquer les analyses de ventes en
            magasin.
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Logiciel de caisse</h2>
          {activeConnections.length > 0 && (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {activeConnections
                .map((c) => c.connector?.name ?? "Caisse")
                .join(" + ")}{" "}
              connecté{activeConnections.length > 1 ? "es" : "e"}
            </Badge>
          )}
        </div>

        {loadingCatalog || loadingConnection ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedConnectors.map((c) => {
              const conn = connectionByConnector[c.id];
              const isActive = !!conn;
              const isComingSoon = c.status === "coming_soon";
              return (
                <Card
                  key={c.id}
                  className={`transition-all ${
                    isActive
                      ? "border-primary ring-2 ring-primary/20"
                      : isComingSoon
                        ? "opacity-75"
                        : "hover:border-primary/50 hover:shadow-md"
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {c.logo_url ? (
                          <img
                            src={c.logo_url}
                            alt={c.name}
                            className="h-10 w-10 rounded object-contain bg-muted p-1"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-bold text-primary">
                            {c.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-base">{c.name}</CardTitle>
                          {c.website_url && (
                            <a
                              href={c.website_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                            >
                              Site web <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      {isActive ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Connectée
                        </Badge>
                      ) : isComingSoon ? (
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          Bientôt
                        </Badge>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <CardDescription className="min-h-[40px]">
                      {c.description}
                    </CardDescription>
                    {isActive && conn?.last_sync_at && (
                      <p className="text-xs text-muted-foreground">
                        Dernière synchro :{" "}
                        {formatDistanceToNow(new Date(conn.last_sync_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    )}
                    {isActive && !conn?.last_sync_at && c.id === "splash360" && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Jamais synchronisée — clique sur "Synchroniser" pour importer les
                        données.
                      </p>
                    )}
                    {isActive && c.id === "dishop" && (
                      <p className="text-xs text-muted-foreground">
                        Import hebdomadaire des exports comptables Dishop, avec mapping des shops par marque.
                      </p>
                    )}
                    {isActive ? (
                      <>
                      <div className="flex flex-wrap gap-2">
                        {c.id === "dishop" ? (
                          <>
                            <Button
                              size="sm"
                              className="flex-1 gap-2"
                              onClick={() => handleDishopTest(conn)}
                              disabled={dishopTest.isPending || dishopShops.isPending}
                            >
                              {dishopTest.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Tester la connexion
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-2"
                              onClick={() => handleDishopListShops(conn)}
                              disabled={dishopTest.isPending || dishopShops.isPending}
                            >
                              {dishopShops.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ExternalLink className="h-4 w-4" />
                              )}
                              Voir les shops
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2"
                              onClick={() => handleDishopDiag(conn)}
                              disabled={dishopDiag.isPending}
                              title="Test l'endpoint export-weekly-data/accounting-report avec plusieurs variantes de company_id"
                            >
                              {dishopDiag.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Diag accounting
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              className="flex-1 gap-2"
                              onClick={() => handleSync(conn)}
                              disabled={sync.isPending || backfill.isPending}
                            >
                              {sync.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                              Synchroniser (mois en cours)
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-2"
                              onClick={() => handleBackfill(conn)}
                              disabled={sync.isPending || backfill.isPending}
                              title="Importe les 24 derniers mois en granularité jour"
                            >
                              {backfill.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                              {backfill.isPending && backfillProgress
                                ? `Backfill ${backfillProgress.done}/${backfillProgress.total}`
                                : "Backfill 24 mois"}
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenConnect(c)}
                        >
                          Modifier
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              Déconnecter
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Déconnecter {c.name} ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Les analyses liées à {c.name} ne seront plus disponibles
                                tant que cette caisse ne sera pas reconnectée. Les autres
                                connecteurs (le cas échéant) restent actifs.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDisconnect(conn!.id, c.name)}
                              >
                                Déconnecter
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>

                        </AlertDialog>
                      </div>
                      {c.id === "dishop" && conn && (
                        <DishopIntegrationCard chainConnectionId={conn.id} />
                      )}
                      </>
                    ) : isComingSoon ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() =>
                          toast({
                            title: "Notification activée",
                            description: `Nous vous préviendrons dès que ${c.name} sera disponible.`,
                          })
                        }
                      >
                        <Bell className="h-4 w-4" />
                        Me notifier
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleOpenConnect(c)}
                      >
                        Connecter
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Backfill résilient (super admin uniquement) */}
      {isSuperAdmin && !!connectionByConnector["splash360"] && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Outils avancés</h2>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Plug className="h-4 w-4 text-primary" />
                Mapping Splash360 ↔ Restaurants
              </CardTitle>
              <CardDescription>
                Rattache chaque caisse Splash reçue via l'API à sa fiche restaurant.
                Indispensable pour que la data caisse remonte sur les dashboards.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/admin/splash-mapping")} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Ouvrir la page de mapping
              </Button>
            </CardContent>
          </Card>
          <SplashResilientBackfillCard />
          <SplashSyncRunsCard />
        </section>
      )}

      {/* Dialog de connexion */}
      <Dialog open={!!openConnector} onOpenChange={(o) => !o && setOpenConnector(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connecter {openConnector?.name}</DialogTitle>
            <DialogDescription>
              Renseignez les identifiants fournis par {openConnector?.name}. Vos
              informations sont stockées de manière sécurisée.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="account-label">Libellé du compte (optionnel)</Label>
              <Input
                id="account-label"
                placeholder="Ex: Compte principal"
                value={accountLabel}
                onChange={(e) => setAccountLabel(e.target.value)}
              />
            </div>
            {openConnector?.required_fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                <Input
                  id={field.key}
                  type={field.type}
                  value={credentialsForm[field.key] ?? ""}
                  onChange={(e) =>
                    setCredentialsForm((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenConnector(null)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={connect.isPending}>
              {connect.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Connecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog liste des shops Dishop */}
      <Dialog open={shopsDialogOpen} onOpenChange={setShopsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Shops Dishop ({shopsList?.length ?? 0})
            </DialogTitle>
            <DialogDescription>
              Liste des shops récupérés depuis l'API Dishop pour cette marque.
              Servira à l'étape 2 pour mapper avec les restaurants de la plateforme.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {!shopsList || shopsList.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                Aucun shop retourné par Dishop.
              </p>
            ) : (
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                {JSON.stringify(shopsList, null, 2)}
              </pre>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShopsDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
