import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, presentation: 'modal' }}>
      <Stack.Screen name="send-money" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="receive-money" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="airtime" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="buy-data" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="bills" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="qr-scan" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="transaction-detail" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="notifications" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="confirm-transfer" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="enter-pin" options={{ animation: 'slide_from_bottom', presentation: 'transparentModal' }} />
      <Stack.Screen name="transfer-success" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
