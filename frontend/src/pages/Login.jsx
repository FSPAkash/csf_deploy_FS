import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GlassCard, Button, Alert } from '../components/common';
import clsx from 'clsx';

function Login() {
  const { login, isLoading, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim() || !password) {
      setLocalError('Please enter both username and password');
      return;
    }

    const result = await login(username.trim(), password);
    
    if (!result.success) {
      if (result.locked) {
        setIsLocked(true);
        setLockoutMinutes(result.lockout_minutes || 5);
      }
      setLocalError(result.message);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-daikin-blue/5" />

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col items-center">
        
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-6 text-center"
        >
          <h1 className="text-lg font-semibold text-daikin-dark">
            Scenario Simulator
          </h1>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full max-w-xs"
        >
          <GlassCard 
            padding="md" 
            className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-lg"
          >
            {/* Card Header */}
            <div className="text-center mb-4">
              <h2 className="text-sm font-semibold text-daikin-dark">
                Welcome Back
              </h2>
              <p className="text-xs text-surface-500 mt-0.5">
                Sign in to continue
              </p>
            </div>

            {/* Error Alert */}
            {displayError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-3"
              >
                <Alert 
                  type={isLocked ? 'warning' : 'error'} 
                  onClose={() => {
                    clearError();
                    setLocalError(null);
                  }}
                >
                  {displayError}
                  {isLocked && (
                    <p className="mt-1 text-xs">
                      Please wait {lockoutMinutes} minute(s) before trying again.
                    </p>
                  )}
                </Alert>
              </motion.div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Username */}
              <div>
                <label className="block text-[10px] font-medium text-daikin-dark mb-1 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none z-10">
                    <User className="h-4 w-4 text-daikin-dark/60" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    disabled={isLoading || isLocked}
                    className={clsx(
                      'w-full h-9 pl-9 pr-3 rounded-md',
                      'bg-white/80',
                      'border border-surface-300',
                      'text-xs text-daikin-dark',
                      'placeholder:text-surface-400',
                      'focus:outline-none focus:ring-2 focus:ring-daikin-blue/20 focus:border-daikin-blue',
                      'transition-all duration-200',
                      (isLoading || isLocked) && 'opacity-50 cursor-not-allowed'
                    )}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-medium text-daikin-dark mb-1 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none z-10">
                    <Lock className="h-4 w-4 text-daikin-dark/60" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    disabled={isLoading || isLocked}
                    className={clsx(
                      'w-full h-9 pl-9 pr-3 rounded-md',
                      'bg-white/80',
                      'border border-surface-300',
                      'text-xs text-daikin-dark',
                      'placeholder:text-surface-400',
                      'focus:outline-none focus:ring-2 focus:ring-daikin-blue/20 focus:border-daikin-blue',
                      'transition-all duration-200',
                      (isLoading || isLocked) && 'opacity-50 cursor-not-allowed'
                    )}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                size="sm"
                isLoading={isLoading}
                disabled={isLocked}
                className="w-full mt-1"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </GlassCard>
        </motion.div>

        {/* Version Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="mt-4 text-[10px] text-surface-400"
        >
          deployed 03/04/2026
        </motion.p>
      </div>
    </div>
  );
}

export default Login;