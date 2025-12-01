import { useState } from 'react';
import { Sparkles, X, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { AIAdvisorChat } from './AIAdvisorChat';

export const AIAdvisorWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: isMinimized ? 'auto' : '600px'
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
            className="fixed bottom-24 right-6 z-50 w-[900px] bg-card/95 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="relative flex items-center justify-between px-6 py-4 bg-gradient-to-r from-ai-gradient-start/10 via-ai-gradient-end/5 to-transparent border-b border-border/50">
              <div className="flex items-center gap-3">
                <motion.div 
                  className="relative w-10 h-10 rounded-full bg-gradient-to-br from-ai-gradient-start to-ai-gradient-end flex items-center justify-center shadow-lg"
                  animate={{ 
                    boxShadow: [
                      '0 0 20px rgba(147, 51, 234, 0.3)',
                      '0 0 30px rgba(147, 51, 234, 0.5)',
                      '0 0 20px rgba(147, 51, 234, 0.3)',
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="h-5 w-5 text-white" />
                </motion.div>
                <div>
                  <h3 className="font-semibold text-foreground">CS Advisor</h3>
                  <motion.p 
                    className="text-xs text-muted-foreground"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    ● En ligne
                  </motion.p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="h-8 w-8 p-0 hover:bg-muted/50"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 p-0 hover:bg-muted/50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {!isMinimized && (
              <AIAdvisorChat />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium FAB Button */}
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {/* Animated glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-ai-gradient-start to-ai-gradient-end opacity-50 blur-xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.7, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Badge "Powered by AI" */}
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-ai-gradient-start to-ai-gradient-end text-white text-[10px] font-medium shadow-lg whitespace-nowrap"
            >
              Powered by AI
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="relative h-16 w-16 rounded-full shadow-2xl bg-gradient-to-br from-ai-gradient-start via-ai-gradient-end to-ai-gradient-start hover:shadow-[0_0_40px_rgba(147,51,234,0.6)] transition-all duration-300 backdrop-blur-sm border-2 border-white/20"
          size="icon"
        >
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {isOpen ? (
              <X className="h-7 w-7" />
            ) : (
              <Sparkles className="h-7 w-7" />
            )}
          </motion.div>
        </Button>
      </motion.div>
    </>
  );
};
