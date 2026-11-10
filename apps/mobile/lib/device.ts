import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/auth';

let pending: Promise<string> | undefined;
export function getDeviceId(): Promise<string> {
  if (!pending) pending = (async () => {
    const saved = await AsyncStorage.getItem('lightpay-installation-id');
    const id = saved ?? Crypto.randomUUID();
    if (!saved) await AsyncStorage.setItem('lightpay-installation-id', id);
    useAuthStore.getState().setDeviceId(id);
    return id;
  })().catch((error) => { pending = undefined; throw error; });
  return pending;
}
