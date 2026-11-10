import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { User } from '@lightpay/types';

const secureStorage = {
  getItem: async (name: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return null;
    return Platform.OS === 'web' ? AsyncStorage.getItem(name) : SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return;
    return Platform.OS === 'web' ? AsyncStorage.setItem(name, value) : SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return;
    return Platform.OS === 'web' ? AsyncStorage.removeItem(name) : SecureStore.deleteItemAsync(name);
  },
};

interface AuthState {
  hydrated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  deviceId: string | null;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  hasBiometric: boolean;
  hasPin: boolean;
  pendingPhone: string | null;
  pendingEmail: string | null;
  authMethod: 'phone' | 'email' | null;

  setUser: (user: User) => void;
  setTokens: (access: string, refresh: string) => void;
  setDeviceId: (id: string) => void;
  setOnboardingComplete: () => void;
  setBiometricEnabled: (enabled: boolean) => void;
  setPinSet: (set: boolean) => void;
  setPendingPhone: (phone: string | null) => void;
  setPendingEmail: (email: string | null) => void;
  setAuthMethod: (method: 'phone' | 'email' | null) => void;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      hydrated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      deviceId: null,
      isAuthenticated: false,
      hasCompletedOnboarding: false,
      hasBiometric: false,
      hasPin: false,
      pendingPhone: null,
      pendingEmail: null,
      authMethod: null,

      setUser: (user) => set({ user, isAuthenticated: true }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isAuthenticated: true }),

      setDeviceId: (deviceId) => set({ deviceId }),

      setOnboardingComplete: () => set({ hasCompletedOnboarding: true }),

      setBiometricEnabled: (hasBiometric) => set({ hasBiometric }),

      setPinSet: (hasPin) => set({ hasPin }),

      setPendingPhone: (pendingPhone) => set({ pendingPhone }),

      setPendingEmail: (pendingEmail) => set({ pendingEmail }),

      setAuthMethod: (authMethod) => set({ authMethod }),

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          hasBiometric: false,
          hasPin: false,
          pendingPhone: null,
          pendingEmail: null,
        }),
    }),
    {
      name: 'lightpay-auth',
      storage: createJSONStorage(() => secureStorage),
      onRehydrateStorage: () => () => {
        queueMicrotask(() => useAuthStore.setState({ hydrated: true }));
      },
      partialize: (state) => ({
        user: state.user,
        refreshToken: state.refreshToken,
        deviceId: state.deviceId,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasBiometric: state.hasBiometric,
        hasPin: state.hasPin,
        authMethod: state.authMethod,
      }),
    }
  )
);
