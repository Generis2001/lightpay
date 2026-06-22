import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  House,
  ArrowsLeftRight,
  Wallet,
  UserCircle,
} from 'phosphor-react-native';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';

interface TabIconProps {
  focused: boolean;
  icon: React.ReactNode;
  focusedIcon: React.ReactNode;
  label: string;
}

const TabIcon: React.FC<TabIconProps> = ({ focused, icon, focusedIcon, label }) => (
  <View style={[styles.tabItem, focused && styles.tabItemActive]}>
    {focused ? focusedIcon : icon}
    <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
  </View>
);

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          ...styles.tabBar,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={<House size={24} color={Colors.gray[400]} />}
              focusedIcon={<House size={24} color={Colors.brand.DEFAULT} weight="fill" />}
              label="Home"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transact"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={<ArrowsLeftRight size={24} color={Colors.gray[400]} />}
              focusedIcon={<ArrowsLeftRight size={24} color={Colors.brand.DEFAULT} weight="fill" />}
              label="Transact"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wallets"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={<Wallet size={24} color={Colors.gray[400]} />}
              focusedIcon={<Wallet size={24} color={Colors.brand.DEFAULT} weight="fill" />}
              label="Wallets"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={<UserCircle size={24} color={Colors.gray[400]} />}
              focusedIcon={<UserCircle size={24} color={Colors.brand.DEFAULT} weight="fill" />}
              label="Profile"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    backgroundColor: Colors.white,
    elevation: 0,
    shadowOpacity: 0,
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
  },
  tabItemActive: {},
  tabLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[400],
  },
  tabLabelActive: {
    fontFamily: FontFamily.interMedium,
    color: Colors.brand.DEFAULT,
  },
});
