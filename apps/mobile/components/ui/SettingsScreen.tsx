import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "./ScreenHeader";
import { Colors } from "@/constants/colors";
import { FontFamily } from "@/constants/typography";

export function SettingsScreen({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: Colors.gray[50] }}
      edges={["bottom"]}
    >
      <ScreenHeader title={title} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 16 }}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function InfoCard({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: Colors.white,
    gap: 10,
  },
  title: {
    fontFamily: FontFamily.jakartaSemiBold,
    fontSize: 17,
    color: Colors.ink.DEFAULT,
  },
  body: {
    fontFamily: FontFamily.interRegular,
    fontSize: 14,
    lineHeight: 22,
    color: Colors.gray[500],
  },
});
