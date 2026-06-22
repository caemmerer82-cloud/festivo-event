import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = (error.config?.url ?? '').includes('/auth/');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('auth_token');
      // Redirect to login - but we need to detect which login page
      const path = window.location.pathname;
      if (path.startsWith('/admin')) {
        window.location.href = '/admin/login';
      } else {
        const tenantMatch = path.match(/^\/([^/]+)/);
        if (tenantMatch) {
          window.location.href = `/${tenantMatch[1]}/login`;
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
