import { useState } from "react";
import Toast from "react-native-toast-message";
import { enablePushNotifications } from "@/lib/notifications";
import { api, getErrorMessage } from "@/lib/api";
import { SettingsScreen, InfoCard } from "@/components/ui/SettingsScreen";
import { Button } from "@/components/ui/Button";
import { router } from "expo-router";

export default function Security() {
  const [loading, setLoading] = useState(false);
  return (
    <SettingsScreen title="Security & Privacy">
      <InfoCard title="Protect your account">
        Keep your transaction PIN and verification codes private. LightPay will
        never ask you to share them with another person.
      </InfoCard>
      <InfoCard title="Access on this device">
        Sign-in requires a verification code. Biometric sign-in is available on
        supported devices with an existing session. Outgoing payments require
        your transaction PIN.
      </InfoCard>
      <Button title="Enable payment notifications" loading={loading} onPress={async () => {
        setLoading(true);
        try { await enablePushNotifications(); Toast.show({ type: 'success', text1: 'Payment notifications enabled' }); }
        catch (error) { Toast.show({ type: 'error', text1: getErrorMessage(error) }); }
        finally { setLoading(false); }
      }} />
      <Button title="Disable payment notifications" variant="outline" onPress={async () => {
        try { await api.post('/notifications/push/disable'); Toast.show({ type: 'success', text1: 'Payment notifications disabled' }); }
        catch (error) { Toast.show({ type: 'error', text1: getErrorMessage(error) }); }
      }} />
      <Button
        title="Change transaction PIN"
        onPress={() => router.push("/(modals)/change-pin")}
      />
    </SettingsScreen>
  );
}
