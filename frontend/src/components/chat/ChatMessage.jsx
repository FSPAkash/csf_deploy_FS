import { memo } from 'react';
import { motion } from 'framer-motion';
import { Download, ArrowRight, AlertCircle } from 'lucide-react';

const ChatMessage = memo(function ChatMessage({ message, onAction }) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  // Parse action buttons from message content if present
  const renderActionButton = () => {
    if (!message.action) return null;

    const actionConfig = {
      export: {
        label: 'Export CSV',
        icon: Download,
        handler: () => onAction?.({ type: 'export' }),
      },
      navigate_market_share: {
        label: 'Go to Market Share',
        icon: ArrowRight,
        handler: () => onAction?.({ type: 'navigate', target: 'market-share-panel' }),
      },
      navigate_promotion: {
        label: 'Go to Promotions',
        icon: ArrowRight,
        handler: () => onAction?.({ type: 'navigate', target: 'promotion-panel' }),
      },
      start_tutorial: {
        label: 'Start Tutorial',
        icon: ArrowRight,
        handler: () => onAction?.({ type: 'start_tutorial' }),
      },
      adjust_market_share: {
        label: `Set MS to ${message.action.value}%`,
        icon: ArrowRight,
        handler: () => onAction?.({ type: 'adjust_market_share', value: message.action.value }),
      },
    };

    const config = actionConfig[message.action.type];
    if (!config) return null;

    const Icon = config.icon;

    return (
      <button
        onClick={config.handler}
        className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg
                 bg-daikin-blue text-white text-xs font-medium
                 hover:bg-daikin-blue/90 transition-colors"
      >
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
          isUser
            ? 'bg-daikin-blue text-white rounded-br-md'
            : isError
              ? 'bg-red-50 border border-red-200 text-red-700 rounded-bl-md'
              : 'bg-white/80 border border-surface-200/50 text-daikin-dark rounded-bl-md shadow-sm'
        }`}
      >
        {/* Error icon */}
        {isError && (
          <div className="flex items-center gap-1.5 mb-1 text-red-500">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium">Error</span>
          </div>
        )}

        {/* Message content */}
        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
          isUser ? 'text-white' : ''
        }`}>
          {message.content}
        </p>

        {/* Action button */}
        {!isUser && renderActionButton()}

        {/* Timestamp */}
        <p className={`text-[10px] mt-1.5 ${
          isUser ? 'text-white/60' : 'text-surface-400'
        }`}>
          {formatTime(message.timestamp)}
        </p>
      </div>
    </motion.div>
  );
});

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default ChatMessage;
