import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { X, FlashlightFill, Flashlight, ScanQrCode } from 'phosphor-react-native';
import { Colors } from '../../constants/colors';

export default function QrScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const payload = JSON.parse(data);

      if (payload.type === 'lightpay_receive') {
        // Internal LightPay QR — pre-fill send money
        router.replace({
          pathname: '/(modals)/send-money',
          params: {
            prefillAccount: payload.accountNumber,
            prefillName: payload.name,
            prefillAmount: payload.amount,
          },
        } as any);
      } else if (payload.accountNumber && payload.bankCode) {
        // Generic bank QR
        router.replace({
          pathname: '/(modals)/send-money',
          params: {
            prefillAccount: payload.accountNumber,
            prefillBankCode: payload.bankCode,
            prefillName: payload.name ?? '',
          },
        } as any);
      } else {
        Alert.alert('Unrecognized QR', 'This QR code is not a payment code.', [
          { text: 'Scan Again', onPress: () => setScanned(false) },
          { text: 'Cancel', onPress: () => router.back() },
        ]);
      }
    } catch {
      Alert.alert('Invalid QR', 'This QR code could not be read as a payment request.', [
        { text: 'Scan Again', onPress: () => setScanned(false) },
        { text: 'Cancel', onPress: () => router.back() },
      ]);
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white font-['Inter']">Requesting camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-[#0A0A0F] items-center justify-center px-8">
        <ScanQrCode size={64} color="rgba(255,255,255,0.3)" />
        <Text className="text-white text-lg font-['Inter_SemiBold'] mt-6 text-center">
          Camera Access Required
        </Text>
        <Text className="text-white/50 text-sm font-['Inter'] text-center mt-2 mb-6">
          LightPay needs camera permission to scan QR codes for payments.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-[#00C853] rounded-2xl px-8 py-3"
        >
          <Text className="text-black font-['Inter_SemiBold']">Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-white/50 font-['Inter']">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Top bar */}
      <View className="absolute top-0 left-0 right-0 flex-row justify-between items-center px-5 pt-14 pb-4 bg-gradient-to-b from-black/60 to-transparent">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-black/40 rounded-full items-center justify-center"
        >
          <X size={22} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-base font-['Inter_SemiBold']">Scan to Pay</Text>
        <TouchableOpacity
          onPress={() => {
            setTorch(!torch);
            Haptics.selectionAsync();
          }}
          className="w-10 h-10 bg-black/40 rounded-full items-center justify-center"
        >
          {torch ? (
            <FlashlightFill size={20} color={Colors.brand.DEFAULT} />
          ) : (
            <Flashlight size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>

      {/* Scan frame overlay */}
      <View className="flex-1 items-center justify-center">
        <View className="w-64 h-64 relative">
          {/* Corner brackets */}
          {[
            { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
            { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
            { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
            { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
          ].map((style, i) => (
            <View
              key={i}
              style={[
                {
                  position: 'absolute',
                  width: 28,
                  height: 28,
                  borderColor: Colors.brand.DEFAULT,
                  borderRadius: 4,
                },
                style as any,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Bottom tip */}
      <View className="absolute bottom-0 left-0 right-0 items-center pb-16 px-8">
        <View className="bg-black/60 rounded-2xl px-6 py-4">
          <Text className="text-white text-sm font-['Inter'] text-center">
            Point your camera at a LightPay QR code to send money instantly
          </Text>
        </View>
        {scanned && (
          <TouchableOpacity
            onPress={() => setScanned(false)}
            className="mt-4 bg-[#1C1C2E] rounded-xl px-6 py-3"
          >
            <Text className="text-white font-['Inter_Medium']">Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
