import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import { SettingsScreen, InfoCard } from "@/components/ui/SettingsScreen";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/auth";
import { api, getErrorMessage } from "@/lib/api";

export default function PersonalInformation() {
  const { user, updateUser } = useAuthStore();
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [email, setEmail] = useState(user?.email ?? '');
  const [code, setCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      api.patch("/auth/me", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      }),
    onSuccess: ({ data }) => {
      updateUser(data.data);
      Toast.show({ type: "success", text1: "Profile saved" });
    },
    onError: (error) =>
      Toast.show({
        type: "error",
        text1: "Could not save profile",
        text2: getErrorMessage(error),
      }),
  });
  return (
    <SettingsScreen title="Personal Information">
      <Input
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        maxLength={100}
      />
      <Input
        label="Last name"
        value={lastName}
        onChangeText={setLastName}
        maxLength={100}
      />
      <InfoCard title="Verified contact">
        {user?.phone ?? user?.email ?? "No contact available"}
      </InfoCard>
      {!user?.phoneVerified && <>
        <Input label="Phone number for verification" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        {phoneSent && <Input label="SMS verification code" value={phoneCode} onChangeText={setPhoneCode} keyboardType="number-pad" maxLength={6} />}
        <Button title={phoneSent ? 'Verify phone' : 'Send SMS code'} loading={phoneLoading} onPress={async () => {
          setPhoneLoading(true);
          const normalized = phone.startsWith('0') ? `+234${phone.slice(1)}` : phone;
          try {
            if (phoneSent) { const response = await api.post('/auth/phone/verify', { phone: normalized, code: phoneCode }); updateUser(response.data.data); Toast.show({ type: 'success', text1: 'Phone verified' }); }
            else { await api.post('/auth/phone/request', { phone: normalized }); setPhoneSent(true); }
          } catch (error) { Toast.show({ type: 'error', text1: getErrorMessage(error) }); }
          finally { setPhoneLoading(false); }
        }} />
      </>}
      {!user?.emailVerified && <>
        <Input label="Email for receiving payments" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        {emailSent && <Input label="Email verification code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />}
        <Button title={emailSent ? 'Verify email' : 'Send email code'} loading={emailLoading} onPress={async () => {
          setEmailLoading(true);
          try {
            if (emailSent) { const response = await api.post('/auth/email/verify', { email, code }); updateUser(response.data.data); Toast.show({ type: 'success', text1: 'Email verified' }); }
            else { await api.post('/auth/email/request', { email }); setEmailSent(true); }
          } catch (error) { Toast.show({ type: 'error', text1: getErrorMessage(error) }); }
          finally { setEmailLoading(false); }
        }} />
      </>}
      <Button
        title="Save changes"
        loading={mutation.isPending}
        disabled={!firstName.trim() || !lastName.trim()}
        onPress={() => mutation.mutate()}
      />
    </SettingsScreen>
  );
}
