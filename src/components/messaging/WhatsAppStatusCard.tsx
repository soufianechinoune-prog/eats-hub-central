import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Phone,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WhatsAppStatus {
  connected: boolean;
  status: string;
  me?: {
    number: string;
    name: string;
  };
  error?: string;
}

interface TestResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

export default function WhatsAppStatusCard() {
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  
  // Test message state
  const [testPhone, setTestPhone] = useState("0699564000");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-status");
      
      if (error) {
        console.error("Error checking status:", error);
        setStatus({ connected: false, status: "error", error: error.message });
        toast.error("Erreur lors de la vérification du statut");
      } else {
        setStatus(data as WhatsAppStatus);
        setLastCheck(new Date());
        
        if (data.connected) {
          toast.success("WhatsApp connecté ✓");
        } else {
          toast.warning("WhatsApp déconnecté - Veuillez reconnecter la session");
        }
      }
    } catch (err) {
      console.error("Error:", err);
      setStatus({ connected: false, status: "error", error: "Erreur de connexion" });
      toast.error("Erreur lors de la vérification");
    } finally {
      setIsChecking(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testPhone.trim()) {
      toast.error("Veuillez entrer un numéro de téléphone");
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      // First check status
      const { data: statusData } = await supabase.functions.invoke("whatsapp-status");
      setStatus(statusData as WhatsAppStatus);
      setLastCheck(new Date());

      if (!statusData?.connected) {
        setTestResult({
          success: false,
          error: "WhatsApp déconnecté - Impossible d'envoyer",
          timestamp: new Date(),
        });
        toast.error("WhatsApp déconnecté - Reconnectez la session d'abord");
        return;
      }

      // Send test message
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          recipients: [{
            phone: testPhone,
            name: "Test",
            restaurantName: "Test Diagnostic",
          }],
          message: `🔧 Message test envoyé le ${new Date().toLocaleString("fr-FR")}`,
          skip_campaign: true,
          message_type: "individual",
          skip_status_check: true, // We already checked
        },
      });

      if (error) {
        setTestResult({
          success: false,
          error: error.message,
          timestamp: new Date(),
        });
        toast.error(`Échec de l'envoi: ${error.message}`);
      } else if (data.sent > 0) {
        const messageId = data.results?.[0]?.messageId;
        setTestResult({
          success: true,
          messageId,
          timestamp: new Date(),
        });
        toast.success(`Message test envoyé ! ID: ${messageId}`);
      } else {
        const errorMsg = data.results?.[0]?.error || "Échec de l'envoi";
        setTestResult({
          success: false,
          error: errorMsg,
          timestamp: new Date(),
        });
        toast.error(`Échec: ${errorMsg}`);
      }
    } catch (err) {
      console.error("Error sending test:", err);
      const errorMsg = err instanceof Error ? err.message : "Erreur inconnue";
      setTestResult({
        success: false,
        error: errorMsg,
        timestamp: new Date(),
      });
      toast.error("Erreur lors de l'envoi du test");
    } finally {
      setIsSendingTest(false);
    }
  };

  const formatPhoneNumber = (number: string) => {
    // Format: 33767818586 → +33 7 67 81 85 86
    if (number.length >= 10) {
      const formatted = number.replace(/(\d{2})(\d)(\d{2})(\d{2})(\d{2})(\d{2})/, "+$1 $2 $3 $4 $5 $6");
      return formatted;
    }
    return number;
  };

  return (
    <Card className="overflow-hidden border-0 shadow-[var(--shadow-card)] bg-gradient-to-br from-card to-card/95">
      <CardContent className="p-4 space-y-4">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
              status?.connected 
                ? "bg-whatsapp/10" 
                : status 
                  ? "bg-destructive/10" 
                  : "bg-secondary"
            )}>
              {status?.connected ? (
                <Wifi className="h-5 w-5 text-whatsapp" />
              ) : status ? (
                <WifiOff className="h-5 w-5 text-destructive" />
              ) : (
                <Phone className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-foreground">Statut WhatsApp</h4>
              {status ? (
                <div className="flex items-center gap-2 mt-0.5">
                  {status.connected ? (
                    <Badge className="bg-whatsapp/10 text-whatsapp border-whatsapp/20 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connecté
                    </Badge>
                  ) : (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Déconnecté
                    </Badge>
                  )}
                  {status.me?.number && (
                    <span className="text-xs text-muted-foreground">
                      {formatPhoneNumber(status.me.number)}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Cliquez pour vérifier</p>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={checkStatus}
            disabled={isChecking}
            className="rounded-lg"
          >
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Vérifier</span>
          </Button>
        </div>

        {/* Warning if disconnected */}
        {status && !status.connected && (
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm">
            <p className="font-medium text-destructive mb-1">⚠️ WhatsApp déconnecté</p>
            <p className="text-muted-foreground text-xs">
              Les messages ne peuvent pas être envoyés. Scannez le QR code dans{" "}
              <a 
                href="https://ultramsg.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                UltraMsg
              </a>{" "}
              pour reconnecter la session WhatsApp.
            </p>
          </div>
        )}

        {/* Test Message Section */}
        <div className="pt-3 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Envoyer un message test
          </p>
          <div className="flex gap-2">
            <Input
              type="tel"
              placeholder="06 99 56 40 00"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="flex-1 h-9 text-sm rounded-lg"
            />
            <Button
              size="sm"
              onClick={sendTestMessage}
              disabled={isSendingTest || (status !== null && !status.connected)}
              className="rounded-lg bg-whatsapp hover:bg-whatsapp/90 text-white"
            >
              {isSendingTest ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="ml-2">Test</span>
            </Button>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={cn(
              "mt-2 p-2 rounded-lg text-xs",
              testResult.success 
                ? "bg-whatsapp/10 text-whatsapp" 
                : "bg-destructive/10 text-destructive"
            )}>
              {testResult.success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Envoyé ! ID: {testResult.messageId}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{testResult.error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Last check timestamp */}
        {lastCheck && (
          <p className="text-xs text-muted-foreground text-right">
            Dernière vérif. : {lastCheck.toLocaleTimeString("fr-FR")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
