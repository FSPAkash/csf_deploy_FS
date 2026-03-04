/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary palette - Brand
        'daikin': {
          dark: '#231F20',
          blue: '#00A0E4',
          light: '#44C8F5',
        },
        // Nature-inspired palette (lotus pond)
        'pond': {
          dark: '#0A3323',      // Dark green - deep forest
          moss: '#839958',      // Moss green - organic mid-tone
          beige: '#F7F4D5',     // Beige - warm neutral
          rosy: '#D3968C',      // Rosy brown - warm accent
          midnight: '#105666',  // Midnight green - teal depth
        },
        // HMI Console palette - Industrial control aesthetics
        'console': {
          // Dark slate backgrounds
          bg: '#1a1d23',
          panel: '#22262e',
          surface: '#2a2f38',
          raised: '#343a45',
          // Borders and separators
          border: '#3d4451',
          divider: '#4a5263',
        },
        // Indicator lights - HMI status colors
        'ind': {
          // Operational states
          run: '#22c55e',       // Running/Active - bright green
          stop: '#6b7280',      // Stopped/Idle - gray
          warn: '#fbbf24',      // Warning - amber
          fault: '#ef4444',     // Fault/Error - red
          // Data readout colors
          cyan: '#1b549e',      // Primary data
          amber: '#895a08',     // Secondary data
          lime: '#457104',      // Positive delta
          rose: '#6c0214',      // Negative delta
        },
        // Extended warm surface palette (kept for light theme compatibility)
        'surface': {
          50: '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
        },
        // Simulator accent colors
        'sim': {
          positive: '#10B981',
          negative: '#F43F5E',
          warning: '#F59E0B',
          info: '#3B82F6',
        },
      },
      fontFamily: {
        sans: [
          'DM Sans',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'SF Mono',
          'Monaco',
          'monospace',
        ],
        // Industrial display font
        display: [
          'JetBrains Mono',
          'SF Mono',
          'Monaco',
          'monospace',
        ],
      },
      fontSize: {
        'xxs': '0.625rem',
        'data': ['0.8125rem', { lineHeight: '1.25', fontWeight: '500', letterSpacing: '-0.01em' }],
        'label': ['0.6875rem', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.02em' }],
        // HMI readout sizes
        'readout-xs': ['0.625rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '0.05em' }],
        'readout-sm': ['0.75rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '0.03em' }],
        'readout': ['0.875rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '0.02em' }],
        'readout-lg': ['1.125rem', { lineHeight: '1', fontWeight: '700', letterSpacing: '0.01em' }],
        'readout-xl': ['1.5rem', { lineHeight: '1', fontWeight: '700', letterSpacing: '0' }],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 160, 228, 0.1)',
        'glass-strong': '0 8px 32px 0 rgba(0, 160, 228, 0.2)',
        'glass-inset': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)',
        'button': '0 2px 8px 0 rgba(0, 160, 228, 0.3)',
        'button-hover': '0 4px 16px 0 rgba(0, 160, 228, 0.4)',
        'card': '0 4px 24px 0 rgba(35, 31, 32, 0.08)',
        'card-hover': '0 8px 40px 0 rgba(35, 31, 32, 0.12)',
        'modal': '0 24px 80px 0 rgba(35, 31, 32, 0.2)',
        // Pond palette shadows
        'pond-glass': '0 8px 32px 0 rgba(16, 86, 102, 0.12), 0 2px 8px 0 rgba(10, 51, 35, 0.08)',
        'pond-card': '0 4px 20px 0 rgba(16, 86, 102, 0.1), 0 1px 4px 0 rgba(10, 51, 35, 0.06)',
        'pond-card-hover': '0 12px 40px 0 rgba(16, 86, 102, 0.15), 0 4px 12px 0 rgba(10, 51, 35, 0.08)',
        'pond-selected': '0 8px 32px 0 rgba(0, 160, 228, 0.2), 0 2px 8px 0 rgba(0, 160, 228, 0.1)',
        'pond-inset': 'inset 0 1px 2px 0 rgba(10, 51, 35, 0.08)',
        // HMI Console shadows
        'console-inset': 'inset 0 2px 8px 0 rgba(0, 0, 0, 0.5), inset 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'console-raised': '0 2px 4px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
        'console-button': '0 1px 2px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
        'console-button-pressed': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.4)',
        'console-glow-cyan': '0 0 20px rgba(34, 211, 238, 0.3), 0 0 40px rgba(34, 211, 238, 0.1)',
        'console-glow-amber': '0 0 20px rgba(245, 158, 11, 0.3), 0 0 40px rgba(245, 158, 11, 0.1)',
        'console-glow-green': '0 0 15px rgba(34, 197, 94, 0.4)',
        'console-glow-red': '0 0 15px rgba(239, 68, 68, 0.4)',
        // Light theme simulator
        'sim-inset': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
        'sim-control': '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)',
        'sim-panel': '0 4px 12px 0 rgba(0, 0, 0, 0.05)',
        'sim-glow': '0 0 20px rgba(0, 160, 228, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        // HMI Console animations
        'indicator-pulse': 'indicatorPulse 1.5s ease-in-out infinite',
        'scanline': 'scanline 8s linear infinite',
        'data-refresh': 'dataRefresh 0.15s ease-out',
        'gauge-fill': 'gaugeFill 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'status-blink': 'statusBlink 1s ease-in-out infinite',
        'panel-slide': 'panelSlide 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'meter-tick': 'meterTick 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        // Standard animations
        'data-pulse': 'dataPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'processing': 'processing 1.5s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-subtle': 'bounceSubtle 1s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slideInLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'expand': 'expand 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'number-tick': 'numberTick 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        // HMI Console keyframes
        indicatorPulse: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 8px currentColor' },
          '50%': { opacity: '0.6', boxShadow: '0 0 4px currentColor' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        dataRefresh: {
          '0%': { opacity: '0.5', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        gaugeFill: {
          '0%': { width: '0%' },
          '100%': { width: 'var(--gauge-value, 0%)' },
        },
        statusBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        panelSlide: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        meterTick: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '50%': { transform: 'translateY(1px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 12px var(--glow-color, rgba(34, 211, 238, 0.3))' },
          '50%': { boxShadow: '0 0 24px var(--glow-color, rgba(34, 211, 238, 0.5))' },
        },
        // Standard keyframes
        dataPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        processing: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        expand: {
          '0%': { opacity: '0', transform: 'scale(0.98)', height: '0' },
          '100%': { opacity: '1', transform: 'scale(1)', height: 'auto' },
        },
        numberTick: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        'apple-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'sim': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'hmi': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(to right, rgba(0, 0, 0, 0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.02) 1px, transparent 1px)',
        'shimmer-gradient': 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
        // HMI patterns
        'console-grid': 'linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
        'console-dots': 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
        'scanline-overlay': 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.03) 2px, rgba(0, 0, 0, 0.03) 4px)',
        'gauge-track': 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
      },
      backgroundSize: {
        'grid': '24px 24px',
        'console-grid': '20px 20px',
        'console-dots': '16px 16px',
      },
      borderRadius: {
        'console': '6px',
        'console-sm': '4px',
        'console-lg': '8px',
      },
    },
  },
  plugins: [],
};
