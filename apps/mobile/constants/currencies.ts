import type { Currency } from "@lightpay/types";

// Sources and usage notes: docs/currency-assets.md. Local assets work offline in the APK.
export const CURRENCIES: Record<
  Currency,
  { name: string; symbol: string; logo?: number; available: boolean }
> = {
  NGN: { name: "Nigerian Naira", symbol: "₦", available: true },
  USD: { name: "US Dollar", symbol: "$", available: false },
  BTC: {
    name: "Bitcoin",
    symbol: "₿",
    logo: require("../assets/currencies/btc.png"),
    available: false,
  },
  ETH: {
    name: "Ethereum",
    symbol: "ETH",
    logo: require("../assets/currencies/eth.svg"),
    available: false,
  },
  SOL: {
    name: "Solana",
    symbol: "SOL",
    logo: require("../assets/currencies/sol.svg"),
    available: false,
  },
  BNB: {
    name: "BNB",
    symbol: "BNB",
    logo: require("../assets/currencies/bnb.svg"),
    available: false,
  },
};
