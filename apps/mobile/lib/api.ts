import axios, { AxiosInstance, AxiosError } from 'axios';
import { useAuthStore } from '@/store/auth';
import { getDeviceId } from './device';
import * as Crypto from 'expo-crypto';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const REQUEST_TIMEOUT_MS = 90000;

let isRefreshing = false;
const paymentKeys = new Map<string, string>();
const isPayment = (url?: string) => !!url && ['/transfers/bank', '/bills/airtime', '/bills/data', '/bills/electricity', '/bills/cable'].includes(url);
const draftKey = (config: any) => {
  const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  const { pin, ...draft } = data ?? {};
  return `${useAuthStore.getState().user?.id}:${config.url}:${JSON.stringify(draft)}`;
};
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'X-App-Version': process.env.EXPO_PUBLIC_APP_VERSION ?? '1.0.1',
    'X-Platform': 'mobile',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    config.headers['X-Device-ID'] = await getDeviceId();
    if (isPayment(config.url) && !config.headers['Idempotency-Key']) {
      const draft = draftKey(config);
      const key = paymentKeys.get(draft) ?? Crypto.randomUUID();
      paymentKeys.set(draft, key);
      config.headers['Idempotency-Key'] = key;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    if (isPayment(response.config.url)) paymentKeys.delete(draftKey(response.config));
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry &&
        !/^\/auth\/(refresh|login|register|otp|pin\/verify|pin\/change)/.test(originalRequest.url ?? '')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
          }
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw error;
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        }, { headers: { 'X-Device-ID': await getDeviceId() }, timeout: REQUEST_TIMEOUT_MS });
        const { accessToken, refreshToken: newRefreshToken } = data.data.tokens;
        useAuthStore.getState().setTokens(accessToken, newRefreshToken);
        processQueue(null, accessToken);
        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.error?.message ??
      error.response?.data?.message ??
      error.message ??
      'Something went wrong'
    );
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
};
