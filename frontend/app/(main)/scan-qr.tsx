import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useInvitations } from '../../src/invitations';
import { AppError, ErrorCode } from '../../src/AppError';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../../components/ThemedText';

type Mode = 'invite' | 'join';
type ScanState = 'scanning' | 'loading' | 'success' | 'error';

function resolveErrorMessage(e: unknown, isInvite: boolean, t: (key: string) => string): string {
  if (e instanceof AppError) {
    switch (e.code) {
      case ErrorCode.CONFLICT:
        return t(isInvite ? 'trip.scanErrorConflictInvite' : 'trip.scanErrorConflictJoin');
      case ErrorCode.FORBIDDEN:
        return t('trip.scanErrorForbidden');
      case ErrorCode.BAD_REQUEST:
        return t('trip.scanErrorBadRequest');
      case ErrorCode.UNAUTHORIZED:
        return t('trip.scanErrorUnauthorized');
    }
  }
  return t(isInvite ? 'trip.inviteError' : 'trip.joinRequestError');
}

const ScanQrScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { mode, tripId } = useLocalSearchParams<{ mode: Mode; tripId?: string }>();
  const { inviteUser, createJoinRequest } = useInvitations();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [errorMessage, setErrorMessage] = useState('');

  const isInvite = mode === 'invite';
  const title = isInvite ? t('trip.scanMemberQr') : t('trip.scanTripQr');
  const hint = isInvite ? t('trip.scanHintInvite') : t('trip.scanHintJoin');

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanState !== 'scanning') return;
    setScanState('loading');
    try {
      if (isInvite) {
        await inviteUser(data, tripId!);
      } else {
        await createJoinRequest(data);
      }
      setScanState('success');
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      const msg = resolveErrorMessage(e, isInvite, t);
      setErrorMessage(msg);
      setScanState('error');
    }
  };

  const handleTryAgain = () => { setErrorMessage(''); setScanState('scanning'); };

  // Permission not yet determined
  if (!permission) {
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centred}>
          <Ionicons name="camera-reverse-outline" size={56} color={theme.icon} style={styles.permIcon} />
          <ThemedText style={styles.permText}>{t('trip.cameraPermissionDenied')}</ThemedText>
          {permission.canAskAgain && (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.tint }]}
              onPress={requestPermission}
            >
              <ThemedText style={styles.primaryButtonText}>{t('trip.allowCamera')}</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.cameraWrapper}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanState === 'scanning' ? handleBarCodeScanned : undefined}
        />

        {/* Viewfinder overlay */}
        <View style={styles.viewfinderContainer} pointerEvents="none">
          <View style={[styles.viewfinder, { borderColor: theme.tint }]} />
          <ThemedText style={styles.hint}>{hint}</ThemedText>
        </View>

        {/* Result overlay */}
        {scanState !== 'scanning' && (
          <View style={styles.resultOverlay}>
            {scanState === 'loading' && (
              <ActivityIndicator size="large" color="white" />
            )}
            {scanState === 'success' && (
              <>
                <Ionicons name="checkmark-circle" size={72} color="#4caf50" />
                <ThemedText style={styles.resultText}>
                  {isInvite ? t('trip.inviteSent') : t('trip.joinRequestSent')}
                </ThemedText>
              </>
            )}
            {scanState === 'error' && (
              <>
                <Ionicons name="close-circle" size={72} color="#d9534f" />
                <ThemedText style={styles.resultText}>
                  {errorMessage}
                </ThemedText>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: theme.tint, marginTop: 16 }]}
                  onPress={handleTryAgain}
                >
                  <ThemedText style={styles.primaryButtonText}>{t('trip.tryAgain')}</ThemedText>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

// Small inline header component to avoid repetition
const Header = ({ title, theme }: { title: string; theme: Record<string, string> }) => (
  <View style={[styles.header, { backgroundColor: theme.navBackground, borderBottomColor: theme.border }]}>
    <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
      <Ionicons name="chevron-back" size={26} color={theme.title} />
    </TouchableOpacity>
    <ThemedText style={[styles.headerTitle, { color: theme.title }]}>{title}</ThemedText>
    <View style={styles.headerButton} />
  </View>
);

export default ScanQrScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
  },
  headerButton: {
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },
  cameraWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  viewfinderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  viewfinder: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderRadius: 16,
  },
  hint: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  resultText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 32,
  },
  permIcon: {
    opacity: 0.4,
  },
  permText: {
    textAlign: 'center',
    fontSize: 15,
    opacity: 0.7,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});
