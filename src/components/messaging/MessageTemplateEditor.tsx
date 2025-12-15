import { useState, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Check
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

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgGradient: string }> = {
  manager: { 
    label: "Manager", 
    icon: <User className="h-3 w-3" />, 
    color: "text-blue-600 dark:text-blue-400",
    bgGradient: "bg-gradient-to-r from-blue-500/20 to-blue-400/10 border-blue-500/30 hover:border-blue-500/50"
  },
  period: { 
    label: "Période", 
    icon: <Calendar className="h-3 w-3" />, 
    color: "text-violet-600 dark:text-violet-400",
    bgGradient: "bg-gradient-to-r from-violet-500/20 to-violet-400/10 border-violet-500/30 hover:border-violet-500/50"
  },
  orders: { 
    label: "CA & Commandes", 
    icon: <ShoppingCart className="h-3 w-3" />, 
    color: "text-emerald-600 dark:text-emerald-400",
    bgGradient: "bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 border-emerald-500/30 hover:border-emerald-500/50"
  },
  rating: { 
    label: "Note", 
    icon: <Star className="h-3 w-3" />, 
    color: "text-amber-600 dark:text-amber-400",
    bgGradient: "bg-gradient-to-r from-amber-500/20 to-amber-400/10 border-amber-500/30 hover:border-amber-500/50"
  },
  operations: { 
    label: "Temps", 
    icon: <Clock className="h-3 w-3" />, 
    color: "text-indigo-600 dark:text-indigo-400",
    bgGradient: "bg-gradient-to-r from-indigo-500/20 to-indigo-400/10 border-indigo-500/30 hover:border-indigo-500/50"
  },
  errors: { 
    label: "Erreurs", 
    icon: <AlertTriangle className="h-3 w-3" />, 
    color: "text-rose-600 dark:text-rose-400",
    bgGradient: "bg-gradient-to-r from-rose-500/20 to-rose-400/10 border-rose-500/30 hover:border-rose-500/50"
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

  // Insert variable at cursor position
  const insertVariable = (key: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.slice(0, start) + `{${key}}` + value.slice(end);
    
    onChange(newValue);
    setShowVariables(false);

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
    <div className={cn("space-y-4", className)}>
      {/* Modern Toolbar */}
      <div className="flex items-center justify-between gap-3">
        {/* Mode toggle - pill style */}
        <div className="inline-flex items-center rounded-full bg-muted/60 backdrop-blur-sm p-1 border border-border/50">
          <motion.button
            onClick={() => setMode("edit")}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-colors",
              mode === "edit" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {mode === "edit" && (
              <motion.div
                layoutId="mode-indicator"
                className="absolute inset-0 bg-primary rounded-full shadow-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <Edit3 className="h-4 w-4 relative z-10" />
            <span className="relative z-10">Éditer</span>
          </motion.button>
          
          <motion.button
            onClick={() => setMode("preview")}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-colors",
              mode === "preview" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {mode === "preview" && (
              <motion.div
                layoutId="mode-indicator"
                className="absolute inset-0 bg-primary rounded-full shadow-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <Eye className="h-4 w-4 relative z-10" />
            <span className="relative z-10">Aperçu</span>
          </motion.button>
        </div>

        {/* Insert variable button - modern style */}
        {mode === "edit" && !disabled && (
          <Popover open={showVariables} onOpenChange={setShowVariables}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 gap-2 rounded-full bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 hover:border-primary/50 hover:bg-primary/15 transition-all duration-300"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium">Variables</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0 rounded-2xl border-border/50 shadow-2xl backdrop-blur-xl" align="end">
              <div className="p-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Variables dynamiques</h4>
                    <p className="text-xs text-muted-foreground">Cliquez pour insérer</p>
                  </div>
                </div>
              </div>
              <ScrollArea className="h-[320px]">
                <div className="p-3 space-y-4">
                  {Object.entries(variablesByCategory).map(([category, vars]) => {
                    const config = CATEGORY_CONFIG[category];
                    return (
                      <div key={category}>
                        <div className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium mb-2",
                          config.bgGradient, "border"
                        )}>
                          <span className={config.color}>{config.icon}</span>
                          <span className={config.color}>{config.label}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {vars.map(v => (
                            <motion.button
                              key={v.key}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={cn(
                                "flex flex-col items-start p-3 rounded-xl border transition-all duration-200",
                                config.bgGradient,
                                "hover:shadow-md"
                              )}
                              onClick={() => insertVariable(v.key)}
                            >
                              <span className={cn("text-sm font-medium", config.color)}>{v.label}</span>
                              <span className="text-xs text-muted-foreground mt-0.5 font-mono">{v.example}</span>
                            </motion.button>
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

      {/* Editor / Preview with smooth transitions */}
      <AnimatePresence mode="wait">
        {mode === "edit" ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-4"
          >
            {/* Visual editor card */}
            <div 
              className={cn(
                "relative rounded-2xl border-2 border-dashed border-border/60 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm overflow-hidden transition-all duration-300",
                "hover:border-primary/30 focus-within:border-primary/50 focus-within:shadow-lg focus-within:shadow-primary/5",
                disabled && "opacity-50 pointer-events-none"
              )}
            >
              {/* Visual representation with modern variable badges */}
              <div 
                className="p-5 text-sm leading-relaxed whitespace-pre-wrap break-words"
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
                      <motion.span
                        key={i}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-flex"
                      >
                        <Badge 
                          variant="outline"
                          className={cn(
                            "mx-1 px-2.5 py-1 text-xs font-medium rounded-full cursor-default inline-flex items-center gap-1.5 border-2 transition-all duration-200 hover:shadow-md",
                            config.bgGradient,
                            config.color
                          )}
                        >
                          {config.icon}
                          {varInfo?.label || seg.content}
                        </Badge>
                      </motion.span>
                    );
                  })
                ) : (
                  <span className="text-muted-foreground/60 italic flex items-center gap-2">
                    <Edit3 className="h-4 w-4" />
                    Commencez à écrire votre message...
                  </span>
                )}
              </div>

              {/* Subtle separator */}
              <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

              {/* Code editor area */}
              <div className="relative bg-muted/20">
                <div className="absolute left-3 top-3 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500/50" />
                  Code
                </div>
                <Textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Écrivez votre message avec {variable} pour les données dynamiques..."
                  className="border-0 bg-transparent font-mono text-xs resize-none focus-visible:ring-0 pt-8 px-3 pb-3 text-muted-foreground"
                  style={{ minHeight: "100px" }}
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Quick insert pills */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground py-1.5 mr-1">Ajout rapide :</span>
              {["prenom", "date_debut", "date_fin", "ca", "note", "temps_prep"].map(key => {
                const v = getVariableInfo(key);
                const config = CATEGORY_CONFIG[v?.category || "manager"];
                return (
                  <motion.button
                    key={key}
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-full border transition-all duration-200",
                      config.bgGradient,
                      config.color,
                      "hover:shadow-md"
                    )}
                    onClick={() => insertVariable(key)}
                    disabled={disabled}
                  >
                    <Plus className="h-3 w-3" />
                    {v?.label}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Modern WhatsApp-style preview */}
            <div className="rounded-2xl overflow-hidden border border-border/50 shadow-xl">
              {/* WhatsApp header */}
              <div className="bg-[#075e54] dark:bg-[#1f2c33] px-4 py-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-white/80" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{previewData.prenom || "Manager"}</p>
                  <p className="text-white/60 text-xs">en ligne</p>
                </div>
              </div>
              
              {/* Chat area */}
              <div 
                className="bg-[#e5ddd5] dark:bg-[#0b141a] p-4 bg-opacity-95"
                style={{ 
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
                }}
              >
                <div className="max-w-[85%] ml-auto">
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-[#dcf8c6] dark:bg-[#005c4b] rounded-2xl rounded-tr-sm p-4 shadow-lg relative"
                  >
                    <p className="text-sm whitespace-pre-wrap text-[#111b21] dark:text-white leading-relaxed">
                      {previewText || "Votre message apparaîtra ici..."}
                    </p>
                    <div className="flex items-center justify-end gap-1.5 mt-2">
                      <span className="text-[11px] text-[#111b21]/50 dark:text-white/50">
                        {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <Check className="h-3.5 w-3.5 text-[#53bdeb]" />
                      <Check className="h-3.5 w-3.5 text-[#53bdeb] -ml-2" />
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground mt-3 text-center flex items-center justify-center gap-2">
              <Eye className="h-3.5 w-3.5" />
              Aperçu avec données d'exemple
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
