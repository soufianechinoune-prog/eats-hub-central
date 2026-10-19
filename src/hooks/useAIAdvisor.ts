import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAnalyticsContext } from '@/contexts/AnalyticsContext';

export interface AIQuota {
  used_questions: number;
  monthly_limit_questions: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export const useAIAdvisor = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [quota, setQuota] = useState<AIQuota | null>(null);
  const { selectedChainId } = useAnalyticsContext();
  const location = useLocation();

  const loadQuota = useCallback(async () => {
    if (!selectedChainId) return;
    const { data } = await supabase.rpc('get_or_create_monthly_ai_quota', { p_chain_id: selectedChainId });
    if (data) setQuota(data as unknown as AIQuota);
  }, [selectedChainId]);

  useEffect(() => { loadQuota(); }, [loadQuota]);

  const [chainName, setChainName] = useState<string | null>(null);

  // Changement d'enseigne : réinitialise le panneau et recharge l'historique de l'enseigne active
  useEffect(() => {
    setMessages([]);
    setCurrentConversationId(null);
    setConversations([]);
    setChainName(null);
    if (!selectedChainId) return;
    let cancelled = false;
    supabase.from('chains').select('name').eq('id', selectedChainId).maybeSingle()
      .then(({ data }) => { if (!cancelled) setChainName(data?.name ?? null); });
    loadConversations(selectedChainId).then((rows) => { if (!cancelled && rows) setConversations(rows); });
    return () => { cancelled = true; };
  }, [selectedChainId]);

  const loadConversations = async (chainId: string | null = selectedChainId) => {
    if (!chainId) return [];
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('chain_id', chainId)
      .order('updated_at', { ascending: false });
    if (data && chainId === selectedChainId) setConversations(data);
    return data ?? [];
  };

  const loadConversation = async (conversationId: string) => {
    const { data } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (data) {
      setMessages(data.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content })));
      setCurrentConversationId(conversationId);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
  };

  const deleteConversation = async (conversationId: string) => {
    await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', conversationId);
    
    if (conversationId === currentConversationId) {
      startNewConversation();
    }
    await loadConversations();
  };

  const renameConversation = async (conversationId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    
    await supabase
      .from('ai_conversations')
      .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    
    await loadConversations();
  };

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    console.log('[useAIAdvisor.sendMessage] start', {
      userMessageLen: userMessage.length,
      currentConversationId,
      existingMessages: messages.length,
    });

    const newUserMessage: Message = { role: 'user', content: userMessage };
    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      // Create or use existing conversation
      let conversationId = currentConversationId;
      if (!conversationId) {
        const title = userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '');
        const { data: newConv } = await supabase
          .from('ai_conversations')
          .insert({ title, chain_id: selectedChainId })
          .select()
          .single();

        if (newConv) {
          conversationId = newConv.id;
          setCurrentConversationId(conversationId);
          await loadConversations();
        }
      }

      console.log('[useAIAdvisor.sendMessage] conversation', { conversationId });

      // Save user message
      if (conversationId) {
        await supabase
          .from('ai_messages')
          .insert({
            conversation_id: conversationId,
            role: 'user',
            content: userMessage,
          });

        // Update conversation timestamp
        await supabase
          .from('ai_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }

      const payloadMessages = [...messages, newUserMessage];
      console.log('[useAIAdvisor.sendMessage] calling ai-advisor', {
        payloadMessagesCount: payloadMessages.length,
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expirée, reconnectez-vous');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-advisor`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: payloadMessages,
            chainId: selectedChainId,
            pageContext: location.pathname,
            conversationId,
          }),
        }
      );

      console.log('[useAIAdvisor.sendMessage] ai-advisor response', {
        ok: response.ok,
        status: response.status,
        hasBody: !!response.body,
      });

      if (!response.ok || !response.body) {
        const error = await response.json().catch(() => ({}));
        if ((error as any).quota) setQuota((error as any).quota);
        throw Object.assign(new Error((error as any).error || 'Erreur de connexion'), { code: (error as any).code });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;
      let assistantContent = '';
      let chunks = 0;
      let deltas = 0;

      const updateAssistantMessage = (content: string) => {
        assistantContent = content;
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant') {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
          }
          return [...prev, { role: 'assistant', content }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks += 1;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.quota) {
              setQuota(parsed.quota as AIQuota);
              continue;
            }
            if (typeof parsed.status === 'string') {
              // Statut temporaire (appel d'outils), affiché en italique, jamais enregistré
              const base = assistantContent;
              const sep = base ? '\n\n' : '';
              setMessages((prev) => {
                const lastMsg = prev[prev.length - 1];
                const content = `${base}${sep}*${parsed.status}*`;
                if (lastMsg?.role === 'assistant') return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
                return [...prev, { role: 'assistant', content }];
              });
              continue;
            }
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              deltas += 1;
              updateAssistantMessage(assistantContent + content);
            }
          } catch {
            // Incomplete JSON split across chunks
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      console.log('[useAIAdvisor.sendMessage] stream done', {
        chunks,
        deltas,
        assistantLen: assistantContent.length,
      });

      // Save assistant message
      if (conversationId && assistantContent) {
        await supabase
          .from('ai_messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantContent,
          });

        // Update conversation timestamp
        await supabase
          .from('ai_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }

      // Always reload conversation to ensure UI is in sync (even if streaming parsing fails)
      if (conversationId) {
        await loadConversation(conversationId);
        await loadConversations();
      }

      setIsLoading(false);
    } catch (error: any) {
      console.error('AI Advisor error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: error?.code === 'option_disabled'
            ? "L'option Mijo n'est pas activée pour votre compte."
            : `Désolé, une erreur s'est produite: ${error.message}`,
        },
      ]);
      setIsLoading(false);
    }
  };

  return {
    chainName,
    messages,
    isLoading,
    quota,
    sendMessage,
    currentConversationId,
    conversations,
    loadConversation,
    startNewConversation,
    deleteConversation,
    renameConversation,
  };
};
