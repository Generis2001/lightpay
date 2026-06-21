import { create } from 'zustand';
import type { Wallet, VirtualAccount, Beneficiary } from '@lightpay/types';

interface WalletState {
  wallets: Wallet[];
  nairaWallet: Wallet | null;
  dollarWallet: Wallet | null;
  virtualAccount: VirtualAccount | null;
  beneficiaries: Beneficiary[];
  selectedWallet: Wallet | null;
  balanceVisible: boolean;

  setWallets: (wallets: Wallet[]) => void;
  setVirtualAccount: (account: VirtualAccount) => void;
  setBeneficiaries: (beneficiaries: Beneficiary[]) => void;
  setSelectedWallet: (wallet: Wallet | null) => void;
  toggleBalanceVisibility: () => void;
  updateWalletBalance: (walletId: string, balance: number) => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallets: [],
  nairaWallet: null,
  dollarWallet: null,
  virtualAccount: null,
  beneficiaries: [],
  selectedWallet: null,
  balanceVisible: true,

  setWallets: (wallets) => {
    const nairaWallet = wallets.find((w) => w.currency === 'NGN') ?? null;
    const dollarWallet = wallets.find((w) => w.currency === 'USD') ?? null;
    set({ wallets, nairaWallet, dollarWallet });
  },

  setVirtualAccount: (virtualAccount) => set({ virtualAccount }),

  setBeneficiaries: (beneficiaries) => set({ beneficiaries }),

  setSelectedWallet: (selectedWallet) => set({ selectedWallet }),

  toggleBalanceVisibility: () =>
    set((state) => ({ balanceVisible: !state.balanceVisible })),

  updateWalletBalance: (walletId, balance) =>
    set((state) => {
      const wallets = state.wallets.map((w) =>
        w.id === walletId ? { ...w, balance } : w
      );
      return {
        wallets,
        nairaWallet: wallets.find((w) => w.currency === 'NGN') ?? null,
        dollarWallet: wallets.find((w) => w.currency === 'USD') ?? null,
      };
    }),
}));
