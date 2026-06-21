import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ToastConfig } from 'react-native-toast-message';
import { CheckCircle, XCircle, Warning, Info } from 'phosphor-react-native';
import { Colors } from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/typography';

interface ToastProps {
  text1?: string;
  text2?: string;
}

const SuccessToast: React.FC<ToastProps> = ({ text1, text2 }) => (
  <View style={[styles.container, styles.success]}>
    <CheckCircle size={20} color={Colors.semantic.success} weight="fill" />
    <View style={styles.content}>
      {text1 && <Text style={styles.title}>{text1}</Text>}
      {text2 && <Text style={styles.message}>{text2}</Text>}
    </View>
  </View>
);

const ErrorToast: React.FC<ToastProps> = ({ text1, text2 }) => (
  <View style={[styles.container, styles.error]}>
    <XCircle size={20} color={Colors.semantic.error} weight="fill" />
    <View style={styles.content}>
      {text1 && <Text style={styles.title}>{text1}</Text>}
      {text2 && <Text style={styles.message}>{text2}</Text>}
    </View>
  </View>
);

const InfoToast: React.FC<ToastProps> = ({ text1, text2 }) => (
  <View style={[styles.container, styles.info]}>
    <Info size={20} color={Colors.semantic.info} weight="fill" />
    <View style={styles.content}>
      {text1 && <Text style={styles.title}>{text1}</Text>}
      {text2 && <Text style={styles.message}>{text2}</Text>}
    </View>
  </View>
);

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => <SuccessToast text1={text1} text2={text2} />,
  error: ({ text1, text2 }) => <ErrorToast text1={text1} text2={text2} />,
  info: ({ text1, text2 }) => <InfoToast text1={text1} text2={text2} />,
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    gap: 12,
    width: 'auto',
    maxWidth: 380,
    minWidth: 200,
  },
  success: {
    backgroundColor: Colors.white,
    borderLeftWidth: 3,
    borderLeftColor: Colors.semantic.success,
  },
  error: {
    backgroundColor: Colors.white,
    borderLeftWidth: 3,
    borderLeftColor: Colors.semantic.error,
  },
  info: {
    backgroundColor: Colors.white,
    borderLeftWidth: 3,
    borderLeftColor: Colors.semantic.info,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.interMedium,
    color: Colors.ink.DEFAULT,
  },
  message: {
    fontSize: FontSize.bodySm,
    fontFamily: FontFamily.interRegular,
    color: Colors.gray[500],
    marginTop: 2,
  },
});
