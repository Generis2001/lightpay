import Svg, { Rect, Polygon } from "react-native-svg";
import brand from "@/assets/images/brand.json";

export function LightpayLogo({ size = 64 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      accessibilityLabel="Lightpay logo"
      accessibilityRole="image"
    >
      <Rect
        width={256}
        height={256}
        rx={brand.cornerRadius}
        fill={brand.green}
      />
      <Polygon
        points={brand.points.map((point) => point.join(",")).join(" ")}
        fill={brand.cutout}
      />
    </Svg>
  );
}
