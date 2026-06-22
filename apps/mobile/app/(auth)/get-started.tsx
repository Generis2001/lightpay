import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';

export default function GetStartedScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoSection}>
        <LinearGradient
          colors={[Colors.brand.DEFAULT, Colors.brand.dark]}
          style={styles.logoMark}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.logoText}>L</Text>
        </LinearGradient>
        <Text style={styles.brandName}>LightPay</Text>
        <Text style={styles.tagline}>Fast. Simple. Yours.</Text>
      </View>

      <View style={styles.illustration}>
        <View style={styles.walletCard}>
          <LinearGradient
            colors={['#003D20', '#00C853']}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.cardLabel}>Naira Wallet</Text>
            <Text style={styles.cardBalance}>₦125,500.00</Text>
            <Text style={styles.cardNumber}>• • • •  4582</Text>
          </LinearGradient>
        </View>
        <View style={[styles.walletCard, styles.cardBehind]}>
          <LinearGradient
            colors={['#0D1B2A', '#1A4A7A']}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.headline}>Your money,{'\n'}everywhere you need it.</Text>
        <Text style={styles.sub}>
          Join thousands of Nigerians managing their money smarter with LightPay.
        </Text>

        <View style={styles.actions}>
          <Button
            title="Create Account"
            onPress={() => router.push('/(auth)/register')}
            variant="primary"
          />
          <Button
            title="I Already Have an Account"
            onPress={() => router.push('/(auth)/login')}
            variant="ghost"
            style={styles.loginButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: 24,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 16,
    gap: 8,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 28,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.white,
  },
  brandName: {
    fontSize: FontSize.h3,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.ink.DEFAULT,
  },
  tagline: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    letterSpacing: 0.5,
  },
  illustration: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
  },
  walletCard: {
    width: '100%',
    maxWidth: 320,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  cardBehind: {
    position: 'absolute',
    top: -12,
    right: 0,
    width: '90%',
    opacity: 0.6,
    zIndex: -1,
  },
  cardGradient: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardBalance: {
    fontSize: FontSize.displayL,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.white,
    letterSpacing: -1,
  },
  cardNumber: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.mono,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
  },
  bottom: {
    paddingBottom: 32,
    gap: 12,
  },
  headline: {
    fontSize: FontSize.h1,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.ink.DEFAULT,
    lineHeight: 38,
  },
  sub: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    lineHeight: 22,
    marginBottom: 8,
  },
  actions: {
    gap: 8,
    marginTop: 8,
  },
  loginButton: {
    height: 44,
  },
});
