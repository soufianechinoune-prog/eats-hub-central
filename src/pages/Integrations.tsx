import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  usePOSConnectors,
  useActiveChainPOSConnection,
  useConnectPOS,
  useDisconnectPOS,
  useSyncPOS,
  useBackfillPOS,
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

export default function Integrations() {
  const navigate = useNavigate();
  const { selectedChainId } = useAnalyticsContext();
  const { data: connectors = [], isLoading: loadingCatalog } = usePOSConnectors();
  const { data: activeConnection, isLoading: loadingConnection } =
    useActiveChainPOSConnection();
  const connect = useConnectPOS();
  const disconnect = useDisconnectPOS();
  const sync = useSyncPOS();
  const backfill = useBackfillPOS();

  const [openConnector, setOpenConnector] = useState<POSConnector | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [credentialsForm, setCredentialsForm] = useState<Record<string, string>>({});
  const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number } | null>(null);

  const activeConnectorId = activeConnection?.connector_id ?? null;

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
        description: `${openConnector.name} est maintenant lié. Synchronisation en cours…`,
      });
      setOpenConnector(null);

      // Déclencher la première synchro (mois en cours, granularité jour)
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
    } catch (e: any) {
      toast({
        title: "Erreur de connexion",
        description: e?.message || "Impossible de connecter la caisse.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast({ title: "Caisse déconnectée" });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Impossible de déconnecter.",
        variant: "destructive",
      });
    }
  };

  const handleSync = async () => {
    if (!activeConnection) return;
    try {
      const result = await sync.mutateAsync({
        connectionId: activeConnection.id,
        connectorId: activeConnection.connector_id,
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

  const handleBackfill = async () => {
    if (!activeConnection) return;
    setBackfillProgress({ done: 0, total: 24 });
    toast({
      title: "Backfill lancé",
      description: "Import des 24 derniers mois en cours… (≈ 8-12 min)",
    });
    try {
      const result = await backfill.mutateAsync({
        connectionId: activeConnection.id,
        connectorId: activeConnection.connector_id,
        monthsBack: 24,
        onProgress: ({ done, total }) => setBackfillProgress({ done, total }),
      });
      const errorsCount = (result.per_month ?? []).filter((m: any) => m.error).length;
      toast({
        title: "Backfill terminé ✓",
        description: `${result.total_rows ?? 0} lignes importées sur ${result.months_back} mois${errorsCount ? ` (${errorsCount} mois en erreur)` : ""}.`,
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
        if (a.id === activeConnectorId) return -1;
        if (b.id === activeConnectorId) return 1;
        const order = { available: 0, coming_soon: 1, deprecated: 2 } as const;
        return order[a.status] - order[b.status] || a.display_order - b.display_order;
      }),
    [connectors, activeConnectorId],
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

      {/* Section "Caisse" */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Logiciel de caisse</h2>
          {activeConnection && (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {activeConnection.connector?.name ?? "Caisse"} connectée
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
              const isActive = c.id === activeConnectorId;
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
                    {isActive && activeConnection?.last_sync_at && (
                      <p className="text-xs text-muted-foreground">
                        Dernière synchro :{" "}
                        {formatDistanceToNow(new Date(activeConnection.last_sync_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    )}
                    {isActive && !activeConnection?.last_sync_at && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Jamais synchronisée — clique sur "Synchroniser" pour importer les
                        données.
                      </p>
                    )}
                    {isActive ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={handleSync}
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
                          onClick={handleBackfill}
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
                                Les analyses de caisse ne seront plus disponibles tant
                                qu'une nouvelle caisse ne sera pas connectée.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDisconnect}>
                                Déconnecter
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
    </div>
  );
}
