import axios from 'axios';
import { apiBaseUrl } from './config';

const api = axios.create({
  baseURL: apiBaseUrl
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ciphertrust.token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function unwrap(promise) {
  return promise.then((response) => response.data).catch((error) => {
    const message = error.response?.data?.error ||
      (error.code === 'ERR_NETWORK'
        ? `Cannot reach CipherTrust API at ${api.defaults.baseURL}. Start the backend and configure its MongoDB connection.`
        : error.message || 'Request failed');
    throw new Error(message);
  });
}

export const register = (credentials) => unwrap(api.post('/api/auth/register', credentials));
export const login = (credentials) => unwrap(api.post('/api/auth/login', credentials));
export const getUsers = () => unwrap(api.get('/api/users'));
export const getMyPublicKey = () => unwrap(api.get('/api/users/me/public-key'));
export const addContact = (username) => unwrap(api.post('/api/users/contacts', { username }));
export const blockContact = (username) => unwrap(api.post(`/api/users/${encodeURIComponent(username)}/block`));
export const unblockContact = (username) => unwrap(api.delete(`/api/users/${encodeURIComponent(username)}/block`));
export const getMessages = (user1, user2) => unwrap(api.get(`/api/messages/${encodeURIComponent(user1)}/${encodeURIComponent(user2)}`));
export const updatePublicKey = (publicKey) => unwrap(api.put('/api/users/me/public-key', { publicKey }));
export default api;
