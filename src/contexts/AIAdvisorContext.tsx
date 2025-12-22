import React, { createContext, useContext, useRef, useState, ReactNode } from 'react';

interface AIAdvisorContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  queuedVersion: number;
  consumeQueuedMessage: () => string | null;
  openWithMessage: (message: string) => void;
}

const AIAdvisorContext = createContext<AIAdvisorContextType | undefined>(undefined);

export const AIAdvisorProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const queuedMessageRef = useRef<string | null>(null);
  const [queuedVersion, setQueuedVersion] = useState(0);

  const openWithMessage = (message: string) => {
    console.log('[AIAdvisorContext] openWithMessage', { len: message.length });
    queuedMessageRef.current = message;
    setQueuedVersion((v) => v + 1);
    setIsOpen(true);
  };

  const consumeQueuedMessage = () => {
    const msg = queuedMessageRef.current;
    console.log('[AIAdvisorContext] consumeQueuedMessage', { hasMessage: !!msg });
    queuedMessageRef.current = null;
    return msg;
  };

  return (
    <AIAdvisorContext.Provider value={{ isOpen, setIsOpen, queuedVersion, consumeQueuedMessage, openWithMessage }}>
      {children}
    </AIAdvisorContext.Provider>
  );
};

export const useAIAdvisorContext = () => {
  const context = useContext(AIAdvisorContext);
  if (!context) {
    throw new Error('useAIAdvisorContext must be used within an AIAdvisorProvider');
  }
  return context;
};
