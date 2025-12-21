import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (data) {
      setConversations(data);
    }
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
          .insert({ title })
          .select()
          .single();
        
        if (newConv) {
          conversationId = newConv.id;
          setCurrentConversationId(conversationId);
          await loadConversations();
        }
      }

      // Save user message
      if (conversationId) {
        await supabase
          .from('ai_messages')
          .insert({
            conversation_id: conversationId,
            role: 'user',
            content: userMessage
          });
        
        // Update conversation timestamp
        await supabase
          .from('ai_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-advisor`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, newUserMessage],
          }),
        }
      );

      if (!response.ok || !response.body) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur de connexion');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;
      let assistantContent = '';

      const updateAssistantMessage = (content: string) => {
        assistantContent = content;
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant') {
            return prev.map((m, i) => 
              i === prev.length - 1 ? { ...m, content } : m
            );
          }
          return [...prev, { role: 'assistant', content }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        
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
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              updateAssistantMessage(assistantContent + content);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

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
          content: `Désolé, une erreur s'est produite: ${error.message}`,
        },
      ]);
      setIsLoading(false);
    }
  };

  return {
    messages,
    isLoading,
    sendMessage,
    currentConversationId,
    conversations,
    loadConversation,
    startNewConversation,
    deleteConversation,
    renameConversation,
  };
};
