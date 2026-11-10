import { View, Text } from "react-native";
import { Image } from "expo-image";
import type { Currency } from "@lightpay/types";
import { CURRENCIES } from "@/constants/currencies";

export function CurrencyIcon({
  currency,
  size = 36,
}: {
  currency: Currency;
  size?: number;
}) {
  const asset = CURRENCIES[currency];
  return asset.logo ? (
    <Image
      source={asset.logo}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityLabel={`${asset.name} logo`}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        accessibilityLabel={`${asset.name} (${currency})`}
        style={{ fontSize: size * 0.62, color: "#005828", fontWeight: "600" }}
      >
        {asset.symbol}
      </Text>
    </View>
  );
}
