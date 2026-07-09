import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor for adding the bearer token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('dit_access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for handling 401s and token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Handle 503 Maintenance Mode
        if (error.response?.status === 503 && error.response?.data?.maintenance) {
            window.location.href = '/maintenance';
            return Promise.reject(error);
        }


        // If error is 401 and we haven't already tried to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            const refreshToken = localStorage.getItem('dit_refresh_token');

            if (refreshToken) {
                try {
                    // Make a direct axios call to avoid interceptor loop
                    const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
                        refresh: refreshToken
                    });

                    // Update token in localStorage
                    const newAccessToken = response.data.access;
                    localStorage.setItem('dit_access_token', newAccessToken);

                    // Update the authorization header for the original request and retry
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    // Refresh failed, user must log in again
                    localStorage.removeItem('dit_access_token');
                    localStorage.removeItem('dit_refresh_token');
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                }
            } else {
                // No refresh token available
                localStorage.removeItem('dit_access_token');
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default api;
