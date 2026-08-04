import { View, Text, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>404</Text>
        <Text style={styles.message}>This screen doesn't exist.</Text>
        <Link href="/(tabs)/home" style={styles.link}>
          <Text style={styles.linkText}>Go to home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.ink.DEFAULT,
  },
  title: {
    fontSize: 72,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.white,
    marginBottom: 16,
  },
  message: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
    marginBottom: 32,
  },
  link: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.brand.DEFAULT,
    borderRadius: 8,
  },
  linkText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaMedium,
    color: Colors.white,
  },
});
