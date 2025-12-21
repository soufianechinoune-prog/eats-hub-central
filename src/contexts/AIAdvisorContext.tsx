import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';

interface AIAdvisorContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  pendingMessage: string | null;
  setPendingMessage: (message: string | null) => void;
  openWithMessage: (message: string) => void;
}

const AIAdvisorContext = createContext<AIAdvisorContextType | undefined>(undefined);

export const AIAdvisorProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const openWithMessage = (message: string) => {
    setPendingMessage(message);
    setIsOpen(true);
  };

  return (
    <AIAdvisorContext.Provider value={{ isOpen, setIsOpen, pendingMessage, setPendingMessage, openWithMessage }}>
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
