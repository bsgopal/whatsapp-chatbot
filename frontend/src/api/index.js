import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('wa_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/update-profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// ── Appointments ─────────────────────────────────────────────────────────────
export const appointmentsAPI = {
  getAll: (params) => api.get('/appointments', { params }),
  getToday: () => api.get('/appointments/today'),
  getById: (id) => api.get(`/appointments/${id}`),
  create: (data) => api.post('/appointments', data),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  delete: (id) => api.delete(`/appointments/${id}`),
};

// ── Contacts ─────────────────────────────────────────────────────────────────
export const contactsAPI = {
  getAll: (params) => api.get('/contacts', { params }),
  getById: (id) => api.get(`/contacts/${id}`),
  getAppointments: (id) => api.get(`/contacts/${id}/appointments`),
  create: (data) => api.post('/contacts', data),
  update: (id, data) => api.put(`/contacts/${id}`, data),
  delete: (id) => api.delete(`/contacts/${id}`),
};

// ── Staff ─────────────────────────────────────────────────────────────────────
export const staffAPI = {
  getAll: () => api.get('/staff'),
  create: (data) => api.post('/staff', data),
  update: (id, data) => api.put(`/staff/${id}`, data),
  delete: (id) => api.delete(`/staff/${id}`),
};

// ── Services ─────────────────────────────────────────────────────────────────
export const servicesAPI = {
  getAll: () => api.get('/services'),
  create: (data) => api.post('/services', data),
  update: (id, data) => api.put(`/services/${id}`, data),
  delete: (id) => api.delete(`/services/${id}`),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getRevenue: (period) => api.get('/analytics/revenue', { params: { period } }),
  getChatbot: (period) => api.get('/analytics/chatbot', { params: { period } }),
};

// ── Settings ─────────────────────────────────────────────────────────────────
export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  updateWhatsApp: (data) => api.put('/settings/whatsapp', data),
  getBotPreview: () => api.get('/settings/bot-preview'),
  testWhatsApp: (data) => api.post('/settings/whatsapp/test', data),
};

// ── Chat ─────────────────────────────────────────────────────────────────────
export const chatAPI = {
  getConversations: () => api.get('/chat/conversations'),
  getMessages: (contactId, params) => api.get(`/chat/${contactId}/messages`, { params }),
  sendMessage: (contactId, data) => api.post(`/chat/${contactId}/send`, data),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markAllRead: () => api.put('/notifications/mark-all-read'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
};
