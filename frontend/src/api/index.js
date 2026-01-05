import axios from 'axios';
import { message } from 'antd';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // Increased timeout for AI requests
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    const msg = error.response?.data?.detail || error.message || '网络请求失败';
    message.error(msg);
    return Promise.reject(error);
  }
);

export const projectsApi = {
  getAll: (params) => api.get('/projects', { params }),
  getOne: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  toggleFavorite: (id) => api.post(`/projects/${id}/favorite`),
  getVersions: (id) => api.get(`/projects/${id}/versions`),
  createVersion: (id, data) => api.post(`/projects/${id}/versions`, data),
};

export const categoriesApi = {
  getAll: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
  reorder: (items) => api.put('/categories/reorder', items),
};

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

export const aiApi = {
  optimize: (data) => api.post('/ai/optimize', data),
  run: (data) => api.post('/ai/run', data),
};
