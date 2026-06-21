import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { User } from '@lightpay/types';

const secureStorage = {
  getItem: async (name: string) => {
    return SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string) => {
    return SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    return SecureStore.deleteItemAsync(name);
  },
};

interface AuthState {
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
        set({ accessToken, refreshToken }),

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
