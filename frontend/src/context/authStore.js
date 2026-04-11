import { create } from 'zustand';
import { authAPI } from '../api';

const useAuthStore = create((set, get) => ({
  user: null,
  business: null,
  token: localStorage.getItem('wa_token') || null,
  isLoading: false,
  isAuthenticated: !!localStorage.getItem('wa_token'),

  // ── Login with PHONE + PASSWORD ──────────────────────────────────────────
  login: async (phone, password) => {
    set({ isLoading: true });
    try {
      const normalizedPhone = String(phone).replace(/\D/g, '').slice(-10);
      const { data } = await authAPI.login({ phone: normalizedPhone, password });
      localStorage.setItem('wa_token', data.token);
      set({
        user: data.user,
        business: data.user.business,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      return {
        success: false,
        message: err.response?.data?.message || 'Invalid mobile number or password',
      };
    }
  },

  // ── Register new business owner ──────────────────────────────────────────
  register: async (formData) => {
    set({ isLoading: true });
    try {
      // normalize phone
      const payload = {
        ...formData,
        phone: String(formData.phone).replace(/\D/g, '').slice(-10),
      };
      const { data } = await authAPI.register(payload);
      localStorage.setItem('wa_token', data.token);
      set({
        user: data.user,
        business: data.user.business,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      return {
        success: false,
        message: err.response?.data?.message || 'Registration failed',
      };
    }
  },

  fetchMe: async () => {
    try {
      const { data } = await authAPI.me();
      set({ user: data.user, business: data.user.business, isAuthenticated: true });
    } catch {
      get().logout();
    }
  },

  logout: () => {
    localStorage.removeItem('wa_token');
    set({ user: null, business: null, token: null, isAuthenticated: false });
  },

  updateBusiness: (business) => set({ business: business ? { ...business, id: business.id || business._id } : null }),
}));

export default useAuthStore;