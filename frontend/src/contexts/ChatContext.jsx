import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
}

// Helper to create welcome message with username
const createWelcomeMessage = (username) => ({
  id: 'welcome',
  role: 'assistant',
  content: `Hi${username ? ` ${username}` : ''}! I'm your Forecast Simulator assistant. Ask me about simulations, market share scenarios, or say "help" to see what I can do.`,
  timestamp: new Date(),
});

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([createWelcomeMessage(null)]);

  // Update welcome message when user changes
  useEffect(() => {
    if (user?.username) {
      setMessages(prev => {
        // Only update if the first message is the welcome message
        if (prev.length > 0 && prev[0].id === 'welcome') {
          return [createWelcomeMessage(user.username), ...prev.slice(1)];
        }
        return prev;
      });
    }
  }, [user?.username]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // Store simulator context for AI
  const simulatorContextRef = useRef({});

  const toggleChat = useCallback(() => {
    setIsOpen(prev => {
      if (!prev) {
        setHasUnread(false); // Clear unread when opening
      }
      return !prev;
    });
  }, []);

  const openChat = useCallback(() => {
    setIsOpen(true);
    setHasUnread(false);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const updateSimulatorContext = useCallback((context) => {
    simulatorContextRef.current = context;
  }, []);

  const addMessage = useCallback((message) => {
    const newMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...message,
    };
    setMessages(prev => [...prev, newMessage]);

    // If chat is closed and it's an assistant message, mark as unread
    if (message.role === 'assistant' && !isOpen) {
      setHasUnread(true);
    }

    return newMessage;
  }, [isOpen]);

  const sendMessage = useCallback(async (content, onAction) => {
    if (!content.trim()) return;

    // Add user message
    addMessage({ role: 'user', content: content.trim() });
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          message: content.trim(),
          context: simulatorContextRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // Add assistant response
      addMessage({
        role: 'assistant',
        content: data.message,
        action: data.action || null,
      });

      // Execute action if provided and callback exists
      if (data.action && onAction) {
        onAction(data.action);
      }

    } catch (error) {
      console.error('Chat error:', error);
      addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [addMessage]);

  const clearChat = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Chat cleared${user?.username ? `, ${user.username}` : ''}. How can I help you with your forecast simulation?`,
        timestamp: new Date(),
      }
    ]);
  }, [user?.username]);

  const value = {
    isOpen,
    messages,
    isLoading,
    hasUnread,
    toggleChat,
    openChat,
    closeChat,
    sendMessage,
    clearChat,
    addMessage,
    updateSimulatorContext,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}
