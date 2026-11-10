import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { SettingsScreen, InfoCard } from '@/components/ui/SettingsScreen';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { api, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export default function VerifyIdentityScreen() {
  const [type, setType] = useState<'bvn' | 'nin'>('bvn'); const [number, setNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(''); const [image, setImage] = useState<string>();
  const [consent, setConsent] = useState(false); const [cameraOpen, setCameraOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions(); const camera = useRef<CameraView>(null);
  const queryClient = useQueryClient(); const user = useAuthStore((state) => state.user);
  const status = useQuery({ queryKey: ['kyc'], queryFn: async () => (await api.get('/kyc')).data.data });
  const verify = useMutation({ mutationFn: async () => (await api.post('/kyc/verify', { type, number, dateOfBirth, image, consent }, { timeout: 90000 })).data.data,
    onSuccess: async () => { setImage(undefined); setNumber(''); setConsent(false); const profile = await api.get('/auth/me'); useAuthStore.getState().updateUser(profile.data.data); queryClient.invalidateQueries({ queryKey: ['kyc'] }); queryClient.invalidateQueries({ queryKey: ['account-limits'] }); Toast.show({ type: 'success', text1: 'Identity verified' }); },
    onError: (error) => Toast.show({ type: 'error', text1: 'Verification not completed', text2: getErrorMessage(error) }),
  });
  const takeSelfie = async () => {
    try {
      const photo = await camera.current?.takePictureAsync({ base64: true, quality: 0.5 });
      if (!photo?.base64) throw new Error('Could not capture a selfie');
      setImage(photo.base64); setCameraOpen(false); await FileSystem.deleteAsync(photo.uri, { idempotent: true });
    } catch (error) { Toast.show({ type: 'error', text1: getErrorMessage(error) }); }
  };
  return <SettingsScreen title="Verify your identity">
    <InfoCard title={`Tier ${status.data?.tier ?? user?.kycTier ?? 0}`}>BVN verification enables Tier 1. NIN verification after BVN, with identity matching and a live selfie, enables Tier 2 for international bank transfers.</InfoCard>
    {!status.data?.available && <InfoCard title="Verification activation pending">Prembly is prepared for this app. Verification becomes available when the production account and credentials are connected.</InfoCard>}
    {status.isError && <Button title="Retry verification status" onPress={() => status.refetch()} />}
    <Button title="Complete name and verified contacts" variant="outline" onPress={() => router.push('/(modals)/personal-information')} />
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {(['bvn','nin'] as const).map((value) => <TouchableOpacity key={value} onPress={() => { setType(value); setNumber(''); }} style={{ padding: 12, borderRadius: 12, backgroundColor: value === type ? '#005828' : '#FFFFFF' }}><Text style={{ color: value === type ? '#FFFFFF' : '#111111' }}>{value.toUpperCase()}</Text></TouchableOpacity>)}
    </View>
    <Input label={`${type.toUpperCase()} number`} value={number} onChangeText={(value) => setNumber(value.replace(/\D/g,''))} maxLength={11} keyboardType="number-pad" />
    <Input label="Date of birth (YYYY-MM-DD)" value={dateOfBirth} onChangeText={setDateOfBirth} maxLength={10} />
    <Button title={image ? 'Retake live selfie' : 'Take a live selfie'} variant="outline" onPress={async () => { const granted = permission?.granted || (await requestPermission()).granted; if (granted) setCameraOpen(true); }} />
    {cameraOpen && <><CameraView ref={camera} facing="front" style={{ height: 300, borderRadius: 16 }} /><Button title="Capture selfie" onPress={() => { void takeSelfie(); }} /></>}
    {image && <Text>Selfie captured for this verification request.</Text>}
    <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} style={{ padding: 12 }}><Text>{consent ? '☑' : '☐'} I consent to sending my identity number, details, and selfie to Prembly for verification.</Text></TouchableOpacity>
    <Button title={`Verify ${type.toUpperCase()}`} loading={verify.isPending} disabled={!status.data?.available || !consent || !image || number.length !== 11 || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || (type === 'nin' && (status.data?.tier ?? 0) < 1)} onPress={() => verify.mutate()} />
  </SettingsScreen>;
}
