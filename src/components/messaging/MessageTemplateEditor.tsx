import { useState, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Eye, 
  Edit3, 
  Plus, 
  User, 
  Calendar, 
  ShoppingCart, 
  Star, 
  Clock, 
  AlertTriangle,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Variable definitions with categories
interface VariableDefinition {
  key: string;
  label: string;
  description: string;
  example: string;
  category: "manager" | "period" | "orders" | "rating" | "operations" | "errors";
}

const AVAILABLE_VARIABLES: VariableDefinition[] = [
  // Manager
  { key: "prenom", label: "Prénom", description: "Prénom du manager", example: "Jean", category: "manager" },
  { key: "restaurant", label: "Restaurant", description: "Nom du restaurant", example: "Chicken Street Antony", category: "manager" },
  
  // Period
  { key: "date_debut", label: "Date début", description: "Début de la période", example: "9 décembre", category: "period" },
  { key: "date_fin", label: "Date fin", description: "Fin de la période", example: "15 décembre", category: "period" },
  
  // Orders & Revenue
  { key: "commandes", label: "Commandes", description: "Nombre de commandes", example: "142", category: "orders" },
  { key: "ca", label: "CA", description: "Chiffre d'affaires", example: "3 450 €", category: "orders" },
  { key: "panier_moyen", label: "Panier moyen", description: "Panier moyen", example: "24,30 €", category: "orders" },
  { key: "variation_cmd", label: "Variation cmd", description: "% variation commandes", example: "+12%", category: "orders" },
  { key: "variation_ca", label: "Variation CA", description: "% variation CA", example: "+8%", category: "orders" },
  
  // Rating
  { key: "note", label: "Note moyenne", description: "Note moyenne client", example: "4.6", category: "rating" },
  { key: "nb_avis", label: "Nb avis", description: "Nombre d'avis", example: "28", category: "rating" },
  { key: "emoji_note", label: "Emoji note", description: "✅ si objectif atteint", example: "✅", category: "rating" },
  
  // Operations
  { key: "temps_prep", label: "Temps prep", description: "Temps moyen préparation", example: "18 min", category: "operations" },
  { key: "temps_coursier", label: "Temps coursier", description: "Temps attente coursier", example: "4 min", category: "operations" },
  { key: "emoji_temps", label: "Emoji temps", description: "✅ si objectif atteint", example: "✅", category: "operations" },
  
  // Errors
  { key: "taux_erreur", label: "Taux erreur", description: "% erreurs commandes", example: "2.1%", category: "errors" },
  { key: "nb_erreurs", label: "Nb erreurs", description: "Nombre d'erreurs", example: "3", category: "errors" },
  { key: "emoji_erreur", label: "Emoji erreur", description: "✅ si objectif atteint", example: "✅", category: "errors" },
];

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  manager: { label: "Manager", icon: <User className="h-3.5 w-3.5" />, color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  period: { label: "Période", icon: <Calendar className="h-3.5 w-3.5" />, color: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
  orders: { label: "CA & Commandes", icon: <ShoppingCart className="h-3.5 w-3.5" />, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  rating: { label: "Note", icon: <Star className="h-3.5 w-3.5" />, color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  operations: { label: "Temps", icon: <Clock className="h-3.5 w-3.5" />, color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" },
  errors: { label: "Erreurs", icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "bg-red-500/10 text-red-600 border-red-500/30" },
};

interface MessageTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  previewData?: Record<string, string>;
  disabled?: boolean;
  minHeight?: string;
  className?: string;
}

export default function MessageTemplateEditor({
  value,
  onChange,
  previewData = {},
  disabled = false,
  minHeight = "200px",
  className,
}: MessageTemplateEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [showVariables, setShowVariables] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Parse message into segments (text and variables)
  const segments = useMemo(() => {
    const regex = /\{([a-z_]+)\}/g;
    const parts: { type: "text" | "variable"; content: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(value)) !== null) {
      // Add text before the variable
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: value.slice(lastIndex, match.index) });
      }
      // Add the variable
      parts.push({ type: "variable", content: match[1] });
      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push({ type: "text", content: value.slice(lastIndex) });
    }

    return parts;
  }, [value]);

  // Generate preview with real data
  const previewText = useMemo(() => {
    let result = value;
    AVAILABLE_VARIABLES.forEach(v => {
      const replacement = previewData[v.key] || v.example;
      result = result.replace(new RegExp(`\\{${v.key}\\}`, "g"), replacement);
    });
    return result;
  }, [value, previewData]);

  // Insert variable at cursor position
  const insertVariable = (key: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.slice(0, start) + `{${key}}` + value.slice(end);
    
    onChange(newValue);
    setShowVariables(false);

    // Restore focus and cursor
    setTimeout(() => {
      textarea.focus();
      const newPos = start + key.length + 2;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Get variable info for display
  const getVariableInfo = (key: string): VariableDefinition | undefined => {
    return AVAILABLE_VARIABLES.find(v => v.key === key);
  };

  // Group variables by category
  const variablesByCategory = useMemo(() => {
    const grouped: Record<string, VariableDefinition[]> = {};
    AVAILABLE_VARIABLES.forEach(v => {
      if (!grouped[v.category]) grouped[v.category] = [];
      grouped[v.category].push(v);
    });
    return grouped;
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex items-center rounded-lg border bg-secondary/30 p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-3 gap-1.5 text-xs rounded-md",
                mode === "edit" && "bg-background shadow-sm"
              )}
              onClick={() => setMode("edit")}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Éditer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-3 gap-1.5 text-xs rounded-md",
                mode === "preview" && "bg-background shadow-sm"
              )}
              onClick={() => setMode("preview")}
            >
              <Eye className="h-3.5 w-3.5" />
              Aperçu
            </Button>
          </div>
        </div>

        {/* Insert variable button */}
        {mode === "edit" && !disabled && (
          <Popover open={showVariables} onOpenChange={setShowVariables}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Insérer une variable
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-3 border-b">
                <h4 className="font-medium text-sm">Variables disponibles</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cliquez pour insérer à la position du curseur
                </p>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="p-2 space-y-3">
                  {Object.entries(variablesByCategory).map(([category, vars]) => {
                    const config = CATEGORY_CONFIG[category];
                    return (
                      <div key={category}>
                        <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                          {config.icon}
                          <span className="font-medium">{config.label}</span>
                        </div>
                        <div className="space-y-1 mt-1">
                          {vars.map(v => (
                            <button
                              key={v.key}
                              className="w-full flex items-center justify-between p-2 rounded-md hover:bg-secondary/50 transition-colors text-left"
                              onClick={() => insertVariable(v.key)}
                            >
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-xs font-mono", config.color)}
                                >
                                  {`{${v.key}}`}
                                </Badge>
                                <span className="text-sm">{v.label}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">{v.example}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Editor / Preview */}
      <AnimatePresence mode="wait">
        {mode === "edit" ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
          >
            {/* Visual editor with inline badges */}
            <div 
              className={cn(
                "relative border rounded-lg bg-background overflow-hidden",
                disabled && "opacity-50 pointer-events-none"
              )}
            >
              {/* Visual representation of message with variable badges */}
              <div 
                className="p-3 pb-1 text-sm whitespace-pre-wrap break-words"
                style={{ minHeight }}
              >
                {segments.map((seg, i) => {
                  if (seg.type === "text") {
                    return <span key={i}>{seg.content}</span>;
                  }
                  
                  const varInfo = getVariableInfo(seg.content);
                  const category = varInfo?.category || "manager";
                  const config = CATEGORY_CONFIG[category];
                  
                  return (
                    <Badge 
                      key={i}
                      variant="outline"
                      className={cn(
                        "mx-0.5 text-xs font-mono cursor-default inline-flex items-center gap-1",
                        config.color
                      )}
                    >
                      {config.icon}
                      {varInfo?.label || seg.content}
                    </Badge>
                  );
                })}
                {segments.length === 0 && (
                  <span className="text-muted-foreground italic">
                    Commencez à écrire votre message...
                  </span>
                )}
              </div>

              {/* Hidden textarea for actual editing */}
              <Textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 opacity-0 resize-none cursor-text"
                style={{ minHeight }}
                disabled={disabled}
              />
              
              {/* Visible textarea overlay for editing */}
              <div className="border-t bg-secondary/30">
                <Textarea
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Écrivez votre message. Utilisez {variable} pour insérer des données dynamiques."
                  className="border-0 bg-transparent font-mono text-xs resize-none focus-visible:ring-0"
                  style={{ minHeight: "80px" }}
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Quick variable buttons */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {["prenom", "date_debut", "date_fin", "ca", "note", "temps_prep"].map(key => {
                const v = getVariableInfo(key);
                const config = CATEGORY_CONFIG[v?.category || "manager"];
                return (
                  <Button
                    key={key}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1"
                    onClick={() => insertVariable(key)}
                    disabled={disabled}
                  >
                    <Plus className="h-3 w-3" />
                    {v?.label}
                  </Button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
          >
            {/* WhatsApp-style preview */}
            <div className="rounded-lg border bg-[#e5ddd5] dark:bg-[#0b141a] p-4">
              <div className="max-w-[85%] ml-auto">
                <div className="bg-[#dcf8c6] dark:bg-[#005c4b] rounded-lg rounded-tr-none p-3 shadow-sm">
                  <p className="text-sm whitespace-pre-wrap text-black dark:text-white">
                    {previewText}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-black/50 dark:text-white/50">
                      12:34
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Aperçu avec données d'exemple
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
