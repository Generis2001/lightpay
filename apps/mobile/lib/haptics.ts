import { Platform } from "react-native";
import * as NativeHaptics from "expo-haptics";

export const ImpactFeedbackStyle = NativeHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = NativeHaptics.NotificationFeedbackType;

export async function impactAsync(style?: NativeHaptics.ImpactFeedbackStyle) {
  if (Platform.OS !== "web")
    await NativeHaptics.impactAsync(style).catch(() => {});
}
export async function notificationAsync(
  type?: NativeHaptics.NotificationFeedbackType,
) {
  if (Platform.OS !== "web")
    await NativeHaptics.notificationAsync(type).catch(() => {});
}
export async function selectionAsync() {
  if (Platform.OS !== "web")
    await NativeHaptics.selectionAsync().catch(() => {});
}
