import { useState } from "react";
import Toast from "react-native-toast-message";
import { SettingsScreen } from "@/components/ui/SettingsScreen";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api, getErrorMessage } from "@/lib/api";

export default function ChangePin() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    try {
      await api.post("/auth/pin/change", { currentPin, newPin });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      Toast.show({ type: "success", text1: "PIN changed" });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Could not change PIN",
        text2: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  };
  const inputProps = {
    keyboardType: "number-pad" as const,
    secureTextEntry: true,
    maxLength: 6,
  };
  return (
    <SettingsScreen title="Change PIN">
      <Input
        label="Current PIN"
        value={currentPin}
        onChangeText={setCurrentPin}
        {...inputProps}
      />
      <Input
        label="New PIN"
        value={newPin}
        onChangeText={setNewPin}
        {...inputProps}
      />
      <Input
        label="Confirm new PIN"
        value={confirmPin}
        onChangeText={setConfirmPin}
        {...inputProps}
        error={
          confirmPin.length === 6 && newPin !== confirmPin
            ? "PINs do not match"
            : undefined
        }
      />
      <Button
        title="Change PIN"
        loading={loading}
        disabled={
          !/^\d{6}$/.test(currentPin) ||
          !/^\d{6}$/.test(newPin) ||
          newPin !== confirmPin ||
          currentPin === newPin
        }
        onPress={save}
      />
    </SettingsScreen>
  );
}
