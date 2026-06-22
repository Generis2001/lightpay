import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  User,
  Lock,
  Fingerprint,
  Bell,
  Shield,
  QuestionMark,
  SignOut,
  ChevronRight,
  IdentificationCard,
  CurrencyNgn,
} from 'phosphor-react-native';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';
import { useAuthStore } from '@/store/auth';
import { getInitials } from '@/lib/format';
import { api } from '@/lib/api';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  badge?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, sublabel, onPress, danger, badge }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>{icon}</View>
    <View style={styles.menuContent}>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      {sublabel && <Text style={styles.menuSublabel}>{sublabel}</Text>}
    </View>
    {badge ? (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    ) : (
      <ChevronRight size={18} color={Colors.gray[300]} />
    )}
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const { user, logout, kycTier } = useAuthStore() as any;
  const tier = user?.kycTier ?? 0;

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post('/auth/logout');
          } catch (_) {}
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const name = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'LightPay User';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(name)}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{name}</Text>
            <Text style={styles.profilePhone}>{user?.phone ?? user?.email ?? ''}</Text>
            <View style={[styles.kycBadge, tier >= 1 && styles.kycBadgeVerified]}>
              <Text style={[styles.kycBadgeText, tier >= 1 && styles.kycBadgeTextVerified]}>
                {tier === 0 ? 'Unverified' : tier === 1 ? 'Tier 1 Verified' : 'Fully Verified'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* KYC Upgrade */}
        {tier < 2 && (
          <TouchableOpacity style={styles.kycUpgrade}>
            <View style={styles.kycUpgradeLeft}>
              <IdentificationCard size={24} color={Colors.brand.DEFAULT} />
              <View>
                <Text style={styles.kycUpgradeTitle}>Upgrade to Tier {tier + 1}</Text>
                <Text style={styles.kycUpgradeSub}>
                  {tier === 0 ? 'Verify BVN to unlock higher limits' : 'Complete full KYC for all features'}
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.brand.DEFAULT} />
          </TouchableOpacity>
        )}

        {/* Referral */}
        <TouchableOpacity style={styles.referralCard}>
          <Text style={styles.referralEmoji}>🎁</Text>
          <View style={styles.referralContent}>
            <Text style={styles.referralTitle}>Refer a Friend</Text>
            <Text style={styles.referralCode}>Code: {user?.referralCode ?? '...'}</Text>
          </View>
          <Text style={styles.referralReward}>Earn ₦500</Text>
        </TouchableOpacity>

        {/* Menu sections */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Account</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon={<User size={20} color={Colors.ink.DEFAULT} />}
              label="Personal Information"
              onPress={() => {}}
            />
            <MenuItem
              icon={<Lock size={20} color={Colors.ink.DEFAULT} />}
              label="Change PIN"
              onPress={() => router.push('/(auth)/create-pin')}
            />
            <MenuItem
              icon={<Fingerprint size={20} color={Colors.ink.DEFAULT} />}
              label="Biometric Login"
              sublabel="Fingerprint / Face ID"
              onPress={() => router.push('/(auth)/setup-biometric')}
            />
            <MenuItem
              icon={<CurrencyNgn size={20} color={Colors.ink.DEFAULT} />}
              label="Transaction Limits"
              sublabel={`Tier ${tier} — ₦${tier === 0 ? '20,000' : '1,000,000'}/day`}
              onPress={() => {}}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Preferences</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon={<Bell size={20} color={Colors.ink.DEFAULT} />}
              label="Notifications"
              onPress={() => {}}
            />
            <MenuItem
              icon={<Shield size={20} color={Colors.ink.DEFAULT} />}
              label="Security & Privacy"
              onPress={() => {}}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Support</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon={<QuestionMark size={20} color={Colors.ink.DEFAULT} />}
              label="Help Centre"
              onPress={() => {}}
            />
            <MenuItem
              icon={<SignOut size={20} color={Colors.semantic.error} />}
              label="Log Out"
              danger
              onPress={handleLogout}
            />
          </View>
        </View>

        <Text style={styles.version}>LightPay v1.0.0</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  title: {
    fontSize: FontSize.h2,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.ink.DEFAULT,
  },
  scroll: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brand.pale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: FontSize.h3,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.brand.DEFAULT,
  },
  profileInfo: { flex: 1, gap: 3 },
  profileName: {
    fontSize: FontSize.bodyLg,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  profilePhone: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
  },
  kycBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.gray[100],
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  kycBadgeVerified: { backgroundColor: Colors.brand.pale },
  kycBadgeText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interMedium,
    color: Colors.gray[500],
  },
  kycBadgeTextVerified: { color: Colors.brand.DEFAULT },
  editButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.gray[100],
  },
  editButtonText: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interMedium,
    color: Colors.gray[700],
  },

  kycUpgrade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.brand.pale,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.brand.DEFAULT,
    justifyContent: 'space-between',
  },
  kycUpgradeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  kycUpgradeTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.ink.DEFAULT,
  },
  kycUpgradeSub: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    marginTop: 2,
  },

  referralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.ink.dark,
    borderRadius: 16,
    padding: 16,
  },
  referralEmoji: { fontSize: 28 },
  referralContent: { flex: 1 },
  referralTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.white,
  },
  referralCode: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.mono,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    letterSpacing: 1,
  },
  referralReward: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.brand.DEFAULT,
  },

  menuSection: { gap: 8 },
  menuSectionTitle: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interSemiBold,
    color: Colors.gray[400],
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  menuCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconDanger: { backgroundColor: '#FEF2F2' },
  menuContent: { flex: 1 },
  menuLabel: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interMedium,
    color: Colors.ink.DEFAULT,
  },
  menuLabelDanger: { color: Colors.semantic.error },
  menuSublabel: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
    marginTop: 1,
  },
  badge: {
    backgroundColor: Colors.brand.pale,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interSemiBold,
    color: Colors.brand.DEFAULT,
  },

  version: {
    textAlign: 'center',
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[300],
    marginTop: 8,
  },
});
