import api from './api';

export const authService = {
  async login(username, password) {
    const response = await api.post('/auth/login', { username, password });
    
    if (response.data.success) {
      sessionStorage.setItem('access_token', response.data.access_token);
      sessionStorage.setItem('refresh_token', response.data.refresh_token);
    }
    
    return response.data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
    }
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  isAuthenticated() {
    return !!sessionStorage.getItem('access_token');
  },

  getStoredUser() {
    const token = sessionStorage.getItem('access_token');
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      // Check if access token has expired
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('refresh_token');
        return null;
      }

      return {
        username: payload.sub,
        isAdmin: payload.is_admin || false,
        isBeta: payload.is_beta || false,
      };
    } catch (err) {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('refresh_token');
      return null;
    }
  },
};