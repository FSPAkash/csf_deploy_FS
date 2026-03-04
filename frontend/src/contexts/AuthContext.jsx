import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedUser = authService.getStoredUser();

      if (storedUser) {
        try {
          const response = await authService.getCurrentUser();

          setUser({
            username: response.user.username,
            isAdmin: response.user.is_admin || false,
            isBeta: response.user.is_beta || false
          });
        } catch (err) {
          console.error('Auth check failed:', err);
          sessionStorage.removeItem('access_token');
          sessionStorage.removeItem('refresh_token');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = useCallback(async (username, password) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await authService.login(username, password);

      if (response.success) {
        setUser({
          username: response.user.username,
          isAdmin: response.user.is_admin || false,
          isBeta: response.user.is_beta || false
        });
        return { success: true };
      } else {
        setError(response.message);
        return { 
          success: false, 
          message: response.message,
          locked: response.locked,
          attemptsRemaining: response.attempts_remaining,
        };
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Login failed. Please try again.';
      setError(message);
      return {
        success: false,
        message,
        locked: err.response?.data?.locked,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  // Compute isAdmin and isBeta from user state
  const isAdmin = user?.isAdmin || false;
  const isBeta = user?.isBeta || false;

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin,
    isBeta,
    isLoading,
    error,
    login,
    logout,
    clearError: () => setError(null),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}