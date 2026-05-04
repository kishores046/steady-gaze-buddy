/**
 * PHASE 2: Authentication Service
 * JWT login + axios interceptor for automatic token refresh
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { LoginRequest, LoginResponse, AuthTokens } from './types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

// Token storage (memory-first, fallback to localStorage)
let tokenCache: AuthTokens | null = null;

export const getStoredTokens = (): AuthTokens | null => {
  // Try memory cache first (preferred)
  if (tokenCache) {
    return tokenCache;
  }
  
  // Fallback to localStorage if available
  try {
    const stored = localStorage.getItem('auth_tokens');
    if (stored) {
      tokenCache = JSON.parse(stored);
      return tokenCache;
    }
  } catch (e) {
    console.warn('Failed to retrieve tokens from localStorage');
  }
  
  return null;
};

export const setStoredTokens = (tokens: AuthTokens): void => {
  tokenCache = tokens;
  
  // Also persist to localStorage as fallback
  try {
    localStorage.setItem('auth_tokens', JSON.stringify(tokens));
  } catch (e) {
    console.warn('Failed to persist tokens to localStorage');
  }
};

export const clearStoredTokens = (): void => {
  tokenCache = null;
  try {
    localStorage.removeItem('auth_tokens');
  } catch (e) {
    console.warn('Failed to clear tokens from localStorage');
  }
};

export const isTokenExpired = (): boolean => {
  const tokens = getStoredTokens();
  if (!tokens) return true;
  return Date.now() >= tokens.expiresAt;
};

// Create axios instance with auth header
export const createAuthAxios = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
  });

  // Request interceptor: attach Authorization header
  instance.interceptors.request.use(
    (config) => {
      const tokens = getStoredTokens();
      if (tokens?.accessToken) {
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor: handle 401 + token refresh
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as any;

      // If 401 and we have a refresh token, try to refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const tokens = getStoredTokens();
          if (tokens?.refreshToken) {
            // Call refresh endpoint
            const response = await axios.post<LoginResponse>(
              `${API_BASE_URL}/api/auth/refresh`,
              { refreshToken: tokens.refreshToken }
            );

            if (response.data.accessToken) {
              const newTokens: AuthTokens = {
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken || tokens.refreshToken,
                expiresAt: Date.now() + response.data.expiresIn * 1000,
              };
              setStoredTokens(newTokens);

              // Retry original request with new token
              originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
              return instance(originalRequest);
            }
          }
        } catch (refreshError) {
          // Refresh failed, clear tokens and let app handle re-login
          clearStoredTokens();
          console.error('Token refresh failed:', refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// Auth service
export const authService = {
  async login(request: LoginRequest): Promise<AuthTokens> {
    try {
      const response = await axios.post<LoginResponse>(
        `${API_BASE_URL}/api/auth/login`,
        request
      );

      const tokens: AuthTokens = {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        expiresAt: Date.now() + response.data.expiresIn * 1000,
      };

      setStoredTokens(tokens);
      return tokens;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  },

  logout(): void {
    clearStoredTokens();
  },

  async refreshToken(): Promise<AuthTokens> {
    const tokens = getStoredTokens();
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post<LoginResponse>(
        `${API_BASE_URL}/api/auth/refresh`,
        { refreshToken: tokens.refreshToken }
      );

      const newTokens: AuthTokens = {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken || tokens.refreshToken,
        expiresAt: Date.now() + response.data.expiresIn * 1000,
      };

      setStoredTokens(newTokens);
      return newTokens;
    } catch (error) {
      clearStoredTokens();
      throw error;
    }
  },

  getAccessToken(): string | null {
    const tokens = getStoredTokens();
    return tokens?.accessToken ?? null;
  },

  isAuthenticated(): boolean {
    const tokens = getStoredTokens();
    if (!tokens) return false;
    return Date.now() < tokens.expiresAt;
  },
};

export const axiosInstance = createAuthAxios();
