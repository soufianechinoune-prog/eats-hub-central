import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Loader2, Sparkles, Plus, Trash2, MessageSquare, TrendingUp, Award, Lightbulb, DollarSign, Search, X as XIcon, Zap, MapPin, Star, ThumbsUp, ThumbsDown, Clock, AlertTriangle, CheckCircle, BarChart, Target, AlertCircle, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIAdvisor } from '@/hooks/useAIAdvisor';
import { usePageContext } from '@/hooks/usePageContext';
import { useAIAdvisorContext } from '@/contexts/AIAdvisorContext';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ICON_MAP: Record<string, any> = {
  TrendingUp,
  Award,
  Lightbulb,
  DollarSign,
  MapPin,
  Star,
  ThumbsUp,
  ThumbsDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  BarChart,
  Target,
  AlertCircle,
  Package,
};

const DEFAULT_QUESTIONS = [
  {
    icon: TrendingUp,
    title: "Analyse mes performances",
    question: "Quel est mon meilleur restaurant ce mois-ci ?"
  },
  {
    icon: Award,
    title: "Top restaurant",
    question: "Compare mes performances N vs N-1"
  },
  {
    icon: Lightbulb,
    title: "Recommandations",
    question: "Quels restaurants ont un faible taux de conversion ?"
  },
  {
    icon: DollarSign,
    title: "Optimiser rentabilité",
    question: "Donne-moi des recommandations pour améliorer la rentabilité"
  }
];

export const AIAdvisorChat = () => {
  const { 
    messages, 
    isLoading, 
    sendMessage, 
    conversations, 
    currentConversationId,
    loadConversation,
    startNewConversation,
    deleteConversation,
    renameConversation 
  } = useAIAdvisor();
  const pageContext = usePageContext();
  const { queuedVersion, consumeQueuedMessage } = useAIAdvisorContext();
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  
  // Consume queued message (safe against double effects / remount)
  useEffect(() => {
    if (isLoading) return;
    const msg = consumeQueuedMessage();
    if (msg) {
      sendMessage(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedVersion, isLoading]);

  // Get contextual questions based on current page
  const contextualQuestions = pageContext.suggestedQuestions.map(q => ({
    icon: ICON_MAP[q.icon] || Lightbulb,
    title: q.title,
    question: q.question,
  }));

  // Combine with one default question
  const displayedQuestions = [...contextualQuestions, DEFAULT_QUESTIONS[3]];

  const handleQuickAnalysis = async () => {
    if (isLoading) return;
    const analysisMessage = `[ANALYSE RAPIDE - ${pageContext.pageNameFr}]\n\n${pageContext.analysisPrompt}`;
    await sendMessage(analysisMessage);
  };

  // Filter conversations based on search query
  const filteredConversations = conversations.filter(conv => 
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    await sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDeleteClick = (id: string) => {
    setConversationToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (conversationToDelete) {
      await deleteConversation(conversationToDelete);
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
    }
  };

  const startEditingTitle = (conv: { id: string; title: string | null }) => {
    setEditingConvId(conv.id);
    setEditingTitle(conv.title || '');
  };

  const saveTitle = async () => {
    if (editingConvId && editingTitle.trim()) {
      await renameConversation(editingConvId, editingTitle);
    }
    setEditingConvId(null);
    setEditingTitle('');
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitle();
    } else if (e.key === 'Escape') {
      setEditingConvId(null);
      setEditingTitle('');
    }
  };

  return (
    <div className="flex h-[536px]">
      {/* Sidebar des conversations */}
      <div className="w-64 border-r border-border/50 flex flex-col bg-gradient-to-b from-ai-surface/30 to-transparent">
        <div className="p-3 border-b border-border/50 space-y-2">
          <Button
            onClick={startNewConversation}
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 border-border/50 hover:bg-ai-gradient-start/10 hover:border-ai-gradient-start/50 transition-all"
          >
            <Plus className="h-4 w-4" />
            Nouvelle conversation
          </Button>
          
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full h-9 pl-9 pr-8 rounded-lg border border-border/50 bg-background/50 backdrop-blur-sm text-sm focus:outline-none focus:ring-2 focus:ring-ai-gradient-start/20 focus:border-ai-gradient-start/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted/50 transition-colors"
              >
                <XIcon className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
          
          {/* Results counter */}
          {searchQuery && (
            <p className="text-xs text-muted-foreground px-1">
              {filteredConversations.length} résultat{filteredConversations.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredConversations.length === 0 && searchQuery ? (
              <div className="text-center py-8 px-4">
                <p className="text-sm text-muted-foreground mb-2">Aucune conversation trouvée</p>
                <Button
                  onClick={() => {
                    setSearchQuery('');
                    startNewConversation();
                  }}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Plus className="h-3 w-3" />
                  Nouvelle conversation
                </Button>
              </div>
            ) : (
              <AnimatePresence>
                {filteredConversations.map((conv) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ type: "spring", bounce: 0.3 }}
                  className={`group relative flex items-start gap-2 p-2 rounded-xl cursor-pointer transition-all ${
                    conv.id === currentConversationId 
                      ? 'bg-gradient-to-r from-ai-gradient-start/20 to-ai-gradient-end/10 border border-ai-gradient-start/30' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => loadConversation(conv.id)}
                >
                  <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {editingConvId === conv.id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={handleTitleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="w-full text-sm font-medium px-1 py-0.5 rounded border border-ai-gradient-start/50 bg-background focus:outline-none focus:ring-1 focus:ring-ai-gradient-start/30"
                      />
                    ) : (
                      <p 
                        className="text-sm font-medium truncate cursor-text hover:text-ai-gradient-start transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingTitle(conv);
                        }}
                      >
                        {searchQuery ? (
                          <span dangerouslySetInnerHTML={{
                            __html: (conv.title || 'Sans titre').replace(
                              new RegExp(`(${searchQuery})`, 'gi'),
                              '<mark class="bg-ai-gradient-start/30 text-foreground px-0.5 rounded">$1</mark>'
                            )
                          }} />
                        ) : (
                          conv.title || 'Sans titre'
                        )}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(conv.updated_at), 'dd MMM', { locale: fr })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-destructive/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(conv.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Zone de chat principale */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-transparent to-ai-surface/20">
      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
              className="relative mb-6"
            >
              {/* Animated particles */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-ai-gradient-start rounded-full"
                  style={{
                    left: '50%',
                    top: '50%',
                  }}
                  animate={{
                    x: [0, Math.cos(i * Math.PI / 4) * 60],
                    y: [0, Math.sin(i * Math.PI / 4) * 60],
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
              
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-ai-gradient-start to-ai-gradient-end flex items-center justify-center shadow-2xl">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
            </motion.div>
            
            <motion.h4 
              className="font-bold text-2xl mb-2 bg-gradient-to-r from-ai-gradient-start to-ai-gradient-end bg-clip-text text-transparent"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Samir Vision
            </motion.h4>
            
            <motion.p 
              className="text-sm text-muted-foreground mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              L'IA qui voit tout pour Chicken Street
            </motion.p>

            {/* Quick Analysis Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mb-6"
            >
              <Button
                onClick={handleQuickAnalysis}
                disabled={isLoading}
                className="group relative overflow-hidden bg-gradient-to-r from-ai-gradient-start to-ai-gradient-end hover:shadow-lg hover:shadow-ai-gradient-start/30 transition-all px-6 py-5 rounded-2xl"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <Zap className="h-5 w-5 mr-2" />
                <span className="font-medium">Analyse rapide : {pageContext.pageNameFr}</span>
              </Button>
            </motion.div>

            <motion.p 
              className="text-xs text-muted-foreground mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Ou posez une question :
            </motion.p>
            
            <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
              {displayedQuestions.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.45 + idx * 0.1, type: "spring", bounce: 0.4 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setInput(item.question)}
                    className="group relative p-4 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 hover:from-ai-gradient-start/10 hover:to-ai-gradient-end/10 border border-border/50 hover:border-ai-gradient-start/50 transition-all text-left overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-ai-gradient-start/20 to-transparent rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500" />
                    <Icon className="h-5 w-5 text-ai-gradient-start mb-2 relative z-10" />
                    <p className="text-sm font-medium relative z-10">{item.title}</p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, type: "spring", bounce: 0.3 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <motion.div 
                    className="w-8 h-8 rounded-xl bg-gradient-to-br from-ai-gradient-start to-ai-gradient-end flex items-center justify-center shrink-0 shadow-lg"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                  >
                    <Sparkles className="h-4 w-4 text-white" />
                  </motion.div>
                )}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-ai-gradient-start to-ai-gradient-end text-white rounded-br-md'
                      : 'bg-ai-bubble-assistant text-foreground border border-border/50 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </motion.div>
              </motion.div>
            ))}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex gap-3 justify-start"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-ai-gradient-start to-ai-gradient-end flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="bg-ai-bubble-assistant rounded-2xl rounded-bl-md px-5 py-3 border border-border/50">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-gradient-to-r from-ai-gradient-start to-ai-gradient-end"
                        animate={{
                          y: [0, -8, 0],
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-border/50 p-4 bg-gradient-to-t from-ai-surface/20 to-transparent">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question..."
              className="resize-none min-h-[52px] max-h-[120px] rounded-2xl border-border/50 focus:border-ai-gradient-start/50 focus:ring-2 focus:ring-ai-gradient-start/20 pr-12 bg-background/50 backdrop-blur-sm transition-all"
              rows={1}
            />
          </div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-12 w-12 rounded-2xl shrink-0 bg-gradient-to-br from-ai-gradient-start to-ai-gradient-end hover:shadow-lg hover:shadow-ai-gradient-start/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowUp className="h-5 w-5" />
              )}
            </Button>
          </motion.div>
        </div>
        </div>
      </div>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Tous les messages de cette conversation seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
