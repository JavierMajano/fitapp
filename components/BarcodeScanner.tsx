import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const scanLineAnim = useState(new Animated.Value(0))[0];
  const isWeb = Platform.OS === 'web';

  // Scan-line animation — only runs on native (no-op on web)
  useEffect(() => {
    if (isWeb) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanLineAnim, isWeb]);

  // Barcode scanning requires a native device — web browsers cannot scan
  // EAN-13/UPC-A via expo-camera (web only supports QR via a separate code path).
  if (isWeb) {
    return (
      <View style={styles.container}>
        <Text style={styles.messageText}>
          Barcode scanning is only available on the mobile app.{'\n'}Please use the iOS or Android
          app to scan barcodes.
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.messageText}>Requesting camera permission…</Text>
        <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.messageText}>Camera access is required to scan barcodes.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionBtn}>
          <Text style={styles.permissionText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 80],
  });

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr', 'itf14'],
        }}
        onCameraReady={() => setCameraReady(true)}
        onMountError={(e) => console.warn('[BarcodeScanner] mount error:', e.message)}
        onBarcodeScanned={
          scanned || !cameraReady
            ? undefined
            : ({ data }) => {
                setScanned(true);
                onScan(data);
              }
        }
      >
        {/* Dim overlay */}
        <View style={styles.overlay}>
          {/* Scan window */}
          <View style={styles.scanWindow}>
            <Animated.View
              style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]}
            />
            {/* Corner marks */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.hint}>
            {cameraReady ? 'Point camera at a barcode' : 'Starting camera…'}
          </Text>
        </View>
      </CameraView>

      <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const WINDOW_SIZE = 240;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanWindow: {
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#1a9e6e',
    shadowColor: '#1a9e6e',
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#1a9e6e',
    borderWidth: 3,
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  hint: {
    marginTop: 16,
    color: '#ffffff',
    fontSize: 13,
    opacity: 0.8,
    textAlign: 'center',
  },
  messageText: {
    color: '#ffffff',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 20,
  },
  permissionBtn: {
    backgroundColor: '#1a9e6e',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 12,
  },
  permissionText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelBtn: {
    position: 'absolute',
    bottom: 48,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  cancelText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 15,
  },
});
