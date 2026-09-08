import axios from 'axios';

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:3011`;
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor para agregar token automáticamente
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('fim_colectivo_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor para manejar errores globales
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('fim_colectivo_token');
      localStorage.removeItem('fim_colectivo_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth Helpers ─────────────────────────────────────────────────────────
export function saveSession(token: string, user: object) {
  localStorage.setItem('fim_colectivo_token', token);
  localStorage.setItem('fim_colectivo_user', JSON.stringify(user));
}

export function getSession() {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('fim_colectivo_token');
  const user = localStorage.getItem('fim_colectivo_user');
  if (!token || !user) return null;
  return { token, user: JSON.parse(user) };
}

export function clearSession() {
  localStorage.removeItem('fim_colectivo_token');
  localStorage.removeItem('fim_colectivo_user');
}

// ─── Upload helper ────────────────────────────────────────────────────────
export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const token = typeof window !== 'undefined' ? localStorage.getItem('fim_token') : null;

  const res = await axios.post(`${API_URL}/api/upload/single`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return res.data.url;
}

// ─── Pricing ──────────────────────────────────────────────────────────────
export const FIM_PRICING = {
  baseFare: 900,
  perKm: 410,
  perMinute: 80,
  bookingFee: 0,
  minimumFare: 2500,
};

export function calculatePrice(distanceKm: number, durationMin: number): number {
  const raw =
    FIM_PRICING.baseFare +
    distanceKm * FIM_PRICING.perKm +
    durationMin * FIM_PRICING.perMinute;
  return Math.max(FIM_PRICING.minimumFare, Math.round(raw));
}

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
}
