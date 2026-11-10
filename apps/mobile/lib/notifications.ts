import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { api } from './api';

export async function enablePushNotifications() {
  if (Platform.OS === 'web') throw new Error('Push notifications are available in the installed app.');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('payments', {
    name: 'Payments', importance: Notifications.AndroidImportance.DEFAULT,
  });
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Notification permission was not granted. You can enable it in device settings.');
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('Notification configuration is unavailable.');
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.post('/notifications/push/register', { token: token.data });
}
