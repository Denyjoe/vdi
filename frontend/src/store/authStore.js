import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set, get) => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true, // For initialization

    login: (user, accessToken, refreshToken) => {
        localStorage.setItem('dit_access_token', accessToken);
        localStorage.setItem('dit_refresh_token', refreshToken);
        set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false
        });
    },

    logout: () => {
        localStorage.removeItem('dit_access_token');
        localStorage.removeItem('dit_refresh_token');
        set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false
        });
    },

    initializeAuth: async () => {
        const accessToken = localStorage.getItem('dit_access_token');
        const refreshToken = localStorage.getItem('dit_refresh_token');

        if (accessToken) {
            try {
                // api.js interceptors will handle token attaching and refreshing if expired
                const response = await api.get('/auth/me/');
                
                if (response.data.success) {
                    set({
                        user: response.data.data,
                        accessToken,
                        refreshToken,
                        isAuthenticated: true,
                        isLoading: false
                    });
                } else {
                    get().logout();
                }
            } catch (error) {
                console.error("Failed to initialize auth:", error);
                get().logout();
            }
        } else {
            set({ isLoading: false });
        }
    },

    setUser: (user) => set({ user }),
}));

export default useAuthStore;
