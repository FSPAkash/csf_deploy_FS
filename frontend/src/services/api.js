import axios from 'axios';

// Determine API base URL
// In production (Railway): VITE_API_URL will be set to full backend URL
// In development: Use proxy (just '/api')
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // If VITE_API_URL is set and we're in production, use it
  if (envUrl && import.meta.env.PROD) {
    // Ensure it ends with /api
    return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
  }
  
  // Development: use relative path (handled by Vite proxy)
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

// Custom error class
export class APIError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    config.headers['X-Request-ID'] = generateRequestId();

    return config;
  },
  (error) => {
    return Promise.reject(new APIError(
      'Request failed to send',
      0,
      'REQUEST_FAILED'
    ));
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Network error
    if (!error.response) {
      throw new APIError(
        'Network error. Please check your connection.',
        0,
        'NETWORK_ERROR'
      );
    }

    const { status, data } = error.response;

    // Handle 401 - try refresh token (but NOT for login endpoint)
    if (status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/login')) {
      originalRequest._retry = true;

      const refreshToken = sessionStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });

          const { access_token } = response.data;
          sessionStorage.setItem('access_token', access_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;

          return api(originalRequest);
        } catch (refreshError) {
          sessionStorage.removeItem('access_token');
          sessionStorage.removeItem('refresh_token');
          window.location.href = '/login';

          throw new APIError(
            'Session expired. Please login again.',
            401,
            'SESSION_EXPIRED'
          );
        }
      }
    }

    // Handle specific status codes
    const errorMessages = {
      400: data?.message || 'Invalid request',
      403: 'You do not have permission to perform this action',
      404: 'The requested resource was not found',
      429: data?.message || 'Too many requests. Please wait and try again.',
      500: 'Server error. Please try again later.',
      502: 'Service temporarily unavailable',
      503: 'Service temporarily unavailable',
    };

    throw new APIError(
      errorMessages[status] || data?.message || 'An unexpected error occurred',
      status,
      data?.code || `HTTP_${status}`,
      data?.details
    );
  }
);

function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default api;