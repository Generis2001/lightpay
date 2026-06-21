import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { Colors, Gradients } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { useAuthStore } from '@/store/auth';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    emoji: '💳',
    title: 'One Wallet,\nEvery Currency',
    subtitle: 'Manage Naira, Dollars, and Crypto from a single, beautiful app.',
    gradient: ['#003D20', '#00C853'] as const,
  },
  {
    id: '2',
    emoji: '⚡',
    title: 'Send Money\nIn Seconds',
    subtitle: 'Transfer to any Nigerian bank instantly. No delays, no surprises.',
    gradient: ['#0D1B2A', '#1A4A7A'] as const,
  },
  {
    id: '3',
    emoji: '₿',
    title: 'Crypto ↔ Cash,\nJust Like That',
    subtitle: 'Convert Bitcoin to Naira in 3 taps. No complicated exchanges.',
    gradient: ['#1A0D2E', '#6B2FBB'] as const,
  },
];

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const { setOnboardingComplete } = useAuthStore();
  const scrollX = useSharedValue(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]) {
        setActiveIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
    } else {
      handleGetStarted();
    }
  };

  const handleGetStarted = () => {
    setOnboardingComplete();
    router.replace('/auth/get-started');
  };

  const handleSkip = () => {
    setOnboardingComplete();
    router.replace('/auth/get-started');
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        onScroll={(e) => {
          scrollX.value = e.nativeEvent.contentOffset.x;
        }}
        renderItem={({ item }) => (
          <LinearGradient
            colors={item.gradient}
            style={styles.slide}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <SafeAreaView style={styles.slideInner}>
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>

              <View style={styles.content}>
                <Text style={styles.emoji}>{item.emoji}</Text>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              </View>

              <View style={styles.bottom}>
                <View style={styles.dots}>
                  {SLIDES.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.dot, i === activeIndex && styles.dotActive]}
                    />
                  ))}
                </View>

                <Button
                  title={activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
                  onPress={handleNext}
                  style={styles.button}
                />
              </View>
            </SafeAreaView>
          </LinearGradient>
        )}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
  },
  slideInner: {
    flex: 1,
    paddingHorizontal: 24,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  skipText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interMedium,
    color: 'rgba(255,255,255,0.7)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  emoji: {
    fontSize: 72,
    marginBottom: 32,
  },
  title: {
    fontSize: FontSize.h1,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.white,
    lineHeight: 36,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.interRegular,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 26,
  },
  bottom: {
    paddingBottom: 32,
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: Colors.white,
    width: 24,
  },
  button: {
    backgroundColor: Colors.white,
  },
});
