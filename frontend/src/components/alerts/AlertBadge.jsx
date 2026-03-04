/**
 * AlertBadge.jsx
 * Small badge showing unread alert count
 */

import React from 'react';

const AlertBadge = ({ count, onClick, className = '' }) => {
  if (!count || count === 0) return null;

  return (
    <button
      onClick={onClick}
      className={`
        relative inline-flex items-center justify-center
        min-w-[20px] h-5 px-1.5
        bg-red-500 text-white text-xs font-bold
        rounded-full
        hover:bg-red-600
        transition-all duration-200
        animate-pulse
        ${className}
      `}
      title={`${count} unread alert${count !== 1 ? 's' : ''}`}
    >
      {count > 99 ? '99+' : count}
    </button>
  );
};

export default AlertBadge;
