import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="get-started" />
      <Stack.Screen name="register" />
      <Stack.Screen name="login" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="create-pin" />
      <Stack.Screen name="confirm-pin" />
      <Stack.Screen name="setup-biometric" />
      <Stack.Screen name="kyc-intro" />
      <Stack.Screen name="kyc-bvn" />
    </Stack>
  );
}
