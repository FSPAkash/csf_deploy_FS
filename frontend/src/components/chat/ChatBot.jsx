import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Trash2, Zap } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useForecast } from '../../contexts/ForecastContext';
import ChatMessage from './ChatMessage';

// Quick action suggestions
const QUICK_ACTIONS = [
  { label: 'Export CSV', action: 'export' },
  { label: 'What is March Madness?', action: 'explain_march_madness' },
  { label: 'Explain market share', action: 'explain_market_share' },
  { label: 'Show me a scenario', action: 'show_scenario' },
];

function ChatBot({ onAction }) {
  const {
    isOpen,
    messages,
    isLoading,
    hasUnread,
    toggleChat,
    sendMessage,
    clearChat,
    updateSimulatorContext,
  } = useChat();

  const {
    selectedProduct,
    selectedAps,
    selectedYear,
    currentBaseline,
    simulationResult,
    lockedEvents,
  } = useForecast();

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Update simulator context when state changes
  useEffect(() => {
    updateSimulatorContext({
      selectedProduct,
      selectedAps,
      selectedYear,
      hasBaseline: currentBaseline?.length > 0,
      hasSimulation: !!simulationResult,
      simulatedTotal: simulationResult?.simulated?.reduce((a, b) => a + b, 0) || 0,
      baselineTotal: currentBaseline?.reduce((a, b) => a + b, 0) || 0,
      lockedEventsCount: {
        Promo: lockedEvents?.Promo?.length || 0,
        Shortage: lockedEvents?.Shortage?.length || 0,
        Regulation: lockedEvents?.Regulation?.length || 0,
        Custom: lockedEvents?.Custom?.length || 0,
      },
      exceededMonths: simulationResult?.exceeded_months || [],
    });
  }, [selectedProduct, selectedAps, selectedYear, currentBaseline, simulationResult, lockedEvents, updateSimulatorContext]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = useCallback(() => {
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue, onAction);
      setInputValue('');
    }
  }, [inputValue, isLoading, sendMessage, onAction]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleQuickAction = useCallback((action) => {
    const actionMessages = {
      export: 'Export my simulation results to CSV',
      explain_march_madness: 'What is March Madness in this simulator?',
      explain_market_share: 'Explain the market share modes available',
      show_scenario: 'Show me a sample market share scenario with -10% adjustment',
    };
    const message = actionMessages[action] || action;
    sendMessage(message, onAction);
  }, [sendMessage, onAction]);

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-[80] w-14 h-14 rounded-xl shadow-lg
                   flex items-center justify-center
                   bg-white border border-surface-200
                   hover:shadow-xl hover:scale-105 transition-all duration-200"
        style={{
          boxShadow: !isOpen ? '0 0 20px 4px rgba(141, 183, 79, 0.4)' : undefined,
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <img
          src="/FSSML.png"
          alt="Chat Assistant"
          className="w-10 h-10 object-contain"
        />

        {/* Unread indicator */}
        {hasUnread && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full
                       flex items-center justify-center"
            style={{ backgroundColor: '#8DB74F' }}
          >
            <span className="w-2 h-2 bg-white rounded-full" />
          </motion.span>
        )}

        {/* Pulsating glow animation when closed */}
        {!isOpen && (
          <motion.span
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ backgroundColor: 'rgba(141, 183, 79, 0.3)' }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.6, 0, 0.6],
              boxShadow: [
                '0 0 0px 0px rgba(141, 183, 79, 0)',
                '0 0 30px 10px rgba(141, 183, 79, 0.5)',
                '0 0 0px 0px rgba(141, 183, 79, 0)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed right-6 z-[80] w-[380px] max-w-[calc(100vw-3rem)]
                       glass-modal shadow-2xl overflow-hidden flex flex-col"
            style={{
              bottom: '96px',
              maxHeight: 'calc(100vh - 180px)',
              height: '500px',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3
                           border-b border-surface-200/50 bg-white/50">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-white relative overflow-hidden"
                  style={{ boxShadow: '0 0 12px 2px rgba(141, 183, 79, 0.4)' }}
                >
                  <Zap className="w-4 h-4 text-daikin-blue" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-daikin-dark">Forecast Assistant</h3>
                  <p className="text-[10px] text-surface-400">
                    {selectedProduct ? `${selectedProduct} - ${selectedYear}` : 'Ready to help'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  className="p-2 text-surface-400 hover:text-surface-600
                           hover:bg-surface-100 rounded-lg transition-colors"
                  title="Clear chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={toggleChat}
                  className="p-2 text-surface-400 hover:text-surface-600
                           hover:bg-surface-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-50/30 bg-daikin-blue/10">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onAction={onAction}
                />
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex items-center gap-2 text-surface-400">
                  <motion.div
                    className="flex gap-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-2 h-2 bg-daikin-blue rounded-full"
                        animate={{ y: [0, -4, 0] }}
                        transition={{
                          duration: 0.5,
                          repeat: Infinity,
                          delay: i * 0.1,
                        }}
                      />
                    ))}
                  </motion.div>
                  <span className="text-xs">Thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions - Only show when few messages */}
            {messages.length <= 2 && !isLoading && (
              <div className="px-4 py-2 border-t border-surface-200/30 bg-white/30">
                <p className="text-[10px] text-surface-400 mb-2">Quick actions:</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((qa) => (
                    <button
                      key={qa.action}
                      onClick={() => handleQuickAction(qa.action)}
                      className="px-2.5 py-1 text-[11px] rounded-full
                               bg-daikin-blue/10 text-daikin-blue
                               hover:bg-daikin-blue/20 transition-colors"
                    >
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 border-t border-surface-200/50 bg-white/50">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about simulations..."
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 text-sm rounded-lg
                           bg-white/80 border border-surface-200
                           focus:outline-none focus:ring-2 focus:ring-daikin-blue/30
                           disabled:opacity-50 disabled:cursor-not-allowed
                           placeholder:text-surface-400"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className="p-2 rounded-lg bg-daikin-blue text-white
                           hover:bg-daikin-blue/90 disabled:opacity-50
                           disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ChatBot;
