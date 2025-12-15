import { useState, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Sparkles,
  Check,
  CheckCheck
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

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgClass: string }> = {
  manager: { 
    label: "Manager", 
    icon: <User className="h-3 w-3" />, 
    color: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-500/15 border-blue-500/40 hover:bg-blue-500/25"
  },
  period: { 
    label: "Période", 
    icon: <Calendar className="h-3 w-3" />, 
    color: "text-violet-600 dark:text-violet-400",
    bgClass: "bg-violet-500/15 border-violet-500/40 hover:bg-violet-500/25"
  },
  orders: { 
    label: "CA & Commandes", 
    icon: <ShoppingCart className="h-3 w-3" />, 
    color: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-500/15 border-emerald-500/40 hover:bg-emerald-500/25"
  },
  rating: { 
    label: "Note", 
    icon: <Star className="h-3 w-3" />, 
    color: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25"
  },
  operations: { 
    label: "Temps", 
    icon: <Clock className="h-3 w-3" />, 
    color: "text-indigo-600 dark:text-indigo-400",
    bgClass: "bg-indigo-500/15 border-indigo-500/40 hover:bg-indigo-500/25"
  },
  errors: { 
    label: "Erreurs", 
    icon: <AlertTriangle className="h-3 w-3" />, 
    color: "text-rose-600 dark:text-rose-400",
    bgClass: "bg-rose-500/15 border-rose-500/40 hover:bg-rose-500/25"
  },
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
  minHeight = "120px",
  className,
}: MessageTemplateEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [showVariables, setShowVariables] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  // Parse message into segments (text and variables)
  const segments = useMemo(() => {
    const regex = /\{([a-z_]+)\}/g;
    const parts: { type: "text" | "variable"; content: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(value)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: value.slice(lastIndex, match.index) });
      }
      parts.push({ type: "variable", content: match[1] });
      lastIndex = regex.lastIndex;
    }

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

  // Insert variable
  const insertVariable = (key: string) => {
    onChange(value + `{${key}}`);
    setShowVariables(false);
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

  // Handle contentEditable input
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.innerText || "";
    // Convert displayed text back to template format
    let newValue = text;
    // Note: This is a simple approach - for a production app you'd want more robust parsing
    onChange(newValue);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Modern minimal toolbar */}
      <div className="flex items-center justify-between">
        {/* Mode toggle - sleek pill */}
        <div className="inline-flex items-center rounded-full bg-muted/50 p-0.5 border border-border/30">
          <motion.button
            onClick={() => setMode("edit")}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200",
              mode === "edit" 
                ? "text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {mode === "edit" && (
              <motion.div
                layoutId="mode-bg"
                className="absolute inset-0 bg-background rounded-full shadow-sm border border-border/50"
                transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              />
            )}
            <Edit3 className="h-3.5 w-3.5 relative z-10" />
            <span className="relative z-10">Éditer</span>
          </motion.button>
          
          <motion.button
            onClick={() => setMode("preview")}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200",
              mode === "preview" 
                ? "text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {mode === "preview" && (
              <motion.div
                layoutId="mode-bg"
                className="absolute inset-0 bg-background rounded-full shadow-sm border border-border/50"
                transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              />
            )}
            <Eye className="h-3.5 w-3.5 relative z-10" />
            <span className="relative z-10">Aperçu</span>
          </motion.button>
        </div>

        {/* Insert variable button */}
        {mode === "edit" && !disabled && (
          <Popover open={showVariables} onOpenChange={setShowVariables}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 gap-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10"
              >
                <Plus className="h-3.5 w-3.5" />
                Variable
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 rounded-xl shadow-xl border-border/50" align="end">
              <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Variables dynamiques</span>
                </div>
              </div>
              <ScrollArea className="h-[280px]">
                <div className="p-2 space-y-3">
                  {Object.entries(variablesByCategory).map(([category, vars]) => {
                    const config = CATEGORY_CONFIG[category];
                    return (
                      <div key={category}>
                        <div className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide mb-1.5",
                          config.color
                        )}>
                          {config.icon}
                          {config.label}
                        </div>
                        <div className="space-y-0.5">
                          {vars.map(v => (
                            <button
                              key={v.key}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                              onClick={() => insertVariable(v.key)}
                            >
                              <div className="flex items-center gap-2">
                                <span className={cn("text-sm font-medium", config.color)}>{v.label}</span>
                              </div>
                              <span className="text-xs text-muted-foreground font-mono opacity-60 group-hover:opacity-100">{v.example}</span>
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

      {/* Editor / Preview area */}
      <AnimatePresence mode="wait">
        {mode === "edit" ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Clean editor with inline variable badges */}
            <div 
              className={cn(
                "relative rounded-xl border border-border/60 bg-card overflow-hidden transition-all duration-200",
                "focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10",
                disabled && "opacity-50 pointer-events-none"
              )}
            >
              <div 
                ref={editorRef}
                className="p-4 text-sm leading-relaxed whitespace-pre-wrap break-words outline-none min-h-[100px]"
                style={{ minHeight }}
              >
                {segments.length > 0 ? (
                  segments.map((seg, i) => {
                    if (seg.type === "text") {
                      return <span key={i} className="text-foreground">{seg.content}</span>;
                    }
                    
                    const varInfo = getVariableInfo(seg.content);
                    const category = varInfo?.category || "manager";
                    const config = CATEGORY_CONFIG[category];
                    
                    return (
                      <Badge 
                        key={i}
                        variant="outline"
                        className={cn(
                          "mx-0.5 px-2 py-0.5 text-xs font-medium rounded-md inline-flex items-center gap-1 border transition-all",
                          config.bgClass,
                          config.color
                        )}
                      >
                        {config.icon}
                        {varInfo?.label || seg.content}
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-muted-foreground/50 italic">
                    Écrivez votre message...
                  </span>
                )}
              </div>
              
              {/* Hidden editable textarea for actual input */}
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-text"
                disabled={disabled}
                style={{ minHeight }}
              />
            </div>

            {/* Quick insert row */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {["prenom", "date_debut", "date_fin", "ca", "note"].map(key => {
                const v = getVariableInfo(key);
                const config = CATEGORY_CONFIG[v?.category || "manager"];
                return (
                  <button
                    key={key}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-all",
                      config.bgClass,
                      config.color
                    )}
                    onClick={() => insertVariable(key)}
                    disabled={disabled}
                  >
                    <Plus className="h-3 w-3" />
                    {v?.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* WhatsApp-style preview */}
            <div className="rounded-xl bg-[#0b141a] overflow-hidden border border-border/30">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-[#1f2c34] border-b border-white/5">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-semibold text-sm">
                  {(previewData.prenom || "J")[0]}
                </div>
                <div>
                  <div className="font-medium text-white text-sm">{previewData.prenom || "Jean"}</div>
                  <div className="text-[11px] text-white/50">Manager • {previewData.restaurant || "Chicken Street"}</div>
                </div>
              </div>
              
              {/* Message bubble */}
              <div className="p-4 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.02%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]">
                <div className="max-w-[85%] ml-auto">
                  <div className="bg-[#005c4b] rounded-xl rounded-tr-sm p-3 shadow-lg">
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                      {previewText || "Aperçu du message..."}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-white/60">
                      <span>12:00</span>
                      <CheckCheck className="h-3.5 w-3.5 text-sky-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
