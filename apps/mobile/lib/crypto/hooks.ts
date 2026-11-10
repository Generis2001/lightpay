import { useCallback, useEffect, useId, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as ScreenCapture from "expo-screen-capture";
import { useAuthStore } from "@/store/auth";
import { readLocalWallet, savePublicWallet } from "./storage";
import { readChainBalance } from "./transfers";
import { refreshLocalTransactions } from "./journal";
import type { CryptoSymbol, LocalWallet } from "./keys";
import { createWalletPrivacyGuard } from "./privacy";

export const walletQueryKey = (userId: string | undefined) => [
  "local-crypto-wallet",
  userId,
];
export function useLocalCryptoWallet() {
  const userId = useAuthStore((state) => state.user?.id);
  const query = useQuery({
    queryKey: walletQueryKey(userId),
    enabled: !!userId,
    queryFn: () => readLocalWallet(userId!),
  });
  return { userId, wallet: query.data, query };
}
export function useChainBalance(
  userId: string | undefined,
  wallet: LocalWallet | null | undefined,
  symbol: CryptoSymbol,
) {
  return useQuery({
    queryKey: ["chain-balance", userId, wallet?.id, symbol],
    enabled: !!userId && !!wallet,
    staleTime: 30_000,
    refetchInterval: 120_000,
    retry: 1,
    queryFn: async () => {
      const discovering = symbol === "BTC" && wallet!.bitcoin.needsDiscovery;
      const balance = await readChainBalance(wallet!, symbol);
      if (discovering) await savePublicWallet(userId!, wallet!);
      return balance.toString();
    },
  });
}
export function useCryptoTransactions(
  userId: string | undefined,
  wallet: LocalWallet | null | undefined,
) {
  return useQuery({
    queryKey: ["local-crypto-transactions", userId, wallet?.id],
    enabled: !!userId && !!wallet,
    refetchInterval: 30_000,
    retry: 0,
    queryFn: () => refreshLocalTransactions(userId!, wallet!.id),
  });
}
export function useWalletPrivacy(clear: () => void) {
  const screenKey = useId();
  const focused = useRef(false);
  const privacy = useRef(createWalletPrivacyGuard());
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        privacy.current.lock();
        clear();
      } else if (focused.current) privacy.current.activate();
    });
    return () => subscription.remove();
  }, [clear]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (AppState.currentState === "active") privacy.current.activate();
      if (Platform.OS !== "web")
        void ScreenCapture.preventScreenCaptureAsync(screenKey).catch(() => {});
      return () => {
        focused.current = false;
        privacy.current.lock();
        clear();
        if (Platform.OS !== "web")
          void ScreenCapture.allowScreenCaptureAsync(screenKey).catch(() => {});
      };
    }, [clear, screenKey]),
  );
  // Each asynchronous operation captures its own foreground session. Returning
  // to the app cannot revive an unlock or signature begun before it locked.
  return useCallback(() => privacy.current.begin(), []);
}
