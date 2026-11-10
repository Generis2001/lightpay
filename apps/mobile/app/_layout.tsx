import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter, useSegments } from "expo-router";
import { useAuthStore } from "@/store/auth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import Toast from "react-native-toast-message";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { toastConfig } from "@/components/ui/Toast";
import { LightpayLogo } from "@/components/ui/LightpayLogo";
import "../global.css";

void SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = { initialRouteName: "index" };

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, hasCompletedOnboarding, hydrated } = useAuthStore();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans: require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "PlusJakartaSans-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "PlusJakartaSans-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    Inter: require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    JetBrainsMono: require("../assets/fonts/JetBrainsMono-Regular.ttf"),
  });
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (!hydrated || !fontsReady) return;
    if (
      (segments[0] === "(tabs)" || segments[0] === "(modals)") &&
      !isAuthenticated
    ) {
      router.replace(
        hasCompletedOnboarding ? "/(auth)/login" : "/(auth)/onboarding",
      );
    }
  }, [
    segments,
    isAuthenticated,
    hasCompletedOnboarding,
    hydrated,
    fontsReady,
    router,
  ]);

  useEffect(() => {
    if (fontsReady && hydrated) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady, hydrated]);

  if (!fontsReady || !hydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          backgroundColor: "#0A0A0F",
        }}
      >
        <LightpayLogo size={128} />
        <Text style={{ color: "white", fontSize: 28, fontWeight: "700" }}>
          Lightpay
        </Text>
        <ActivityIndicator color="#00C853" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(modals)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <Toast config={toastConfig} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
