import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator, Animated } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useInvitations } from '../../src/invitations';
import { useFriends } from '../../src/friends';
import { AppError, ErrorCode } from '../../src/AppError';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../../components/ThemedText';

type Mode = 'invite' | 'join' | 'add-friend';
type ScanState = 'scanning' | 'loading' | 'success' | 'error';

const VIEWFINDER_SIZE = 240;
const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;
const OVERLAY_BG = 'rgba(0,0,0,0.58)';

function resolveErrorMessage(e: unknown, mode: Mode, t: (key: string) => string): string {
  if (e instanceof AppError) {
    switch (e.code) {
      case ErrorCode.CONFLICT:
        return t(mode === 'invite' ? 'trip.scanErrorConflictInvite' : mode === 'add-friend' ? 'friends.scanErrorConflict' : 'trip.scanErrorConflictJoin');
      case ErrorCode.FORBIDDEN:
        return t('trip.scanErrorForbidden');
      case ErrorCode.BAD_REQUEST:
        return t('trip.scanErrorBadRequest');
      case ErrorCode.UNAUTHORIZED:
        return t('trip.scanErrorUnauthorized');
    }
  }
  return t(mode === 'invite' ? 'trip.inviteError' : mode === 'add-friend' ? 'friends.requestError' : 'trip.joinRequestError');
}

type CornerPos = 'tl' | 'tr' | 'bl' | 'br';
const Corner = ({ position, color }: { position: CornerPos; color: string }) => {
  const isTop = position === 'tl' || position === 'tr';
  const isLeft = position === 'tl' || position === 'bl';
  return (
    <View
      style={[
        styles.corner,
        {
          top: isTop ? 0 : undefined,
          bottom: !isTop ? 0 : undefined,
          left: isLeft ? 0 : undefined,
          right: !isLeft ? 0 : undefined,
          borderTopWidth: isTop ? CORNER_THICKNESS : 0,
          borderBottomWidth: !isTop ? CORNER_THICKNESS : 0,
          borderLeftWidth: isLeft ? CORNER_THICKNESS : 0,
          borderRightWidth: !isLeft ? CORNER_THICKNESS : 0,
          borderTopLeftRadius: position === 'tl' ? 10 : 0,
          borderTopRightRadius: position === 'tr' ? 10 : 0,
          borderBottomLeftRadius: position === 'bl' ? 10 : 0,
          borderBottomRightRadius: position === 'br' ? 10 : 0,
          borderColor: color,
        },
      ]}
    />
  );
};

const ScanQrScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { mode, tripId } = useLocalSearchParams<{ mode: Mode; tripId?: string }>();
  const { inviteUser, createJoinRequest } = useInvitations();
  const { sendFriendRequestById } = useFriends();
  const navigation = useNavigation();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [errorMessage, setErrorMessage] = useState('');

  const isInvite = mode === 'invite';
  const isAddFriend = mode === 'add-friend';
  const screenTitle = isInvite ? t('trip.scanMemberQr') : isAddFriend ? t('friends.scanTitle') : t('trip.scanTripQr');
  const hint = isInvite ? t('trip.scanHintInvite') : isAddFriend ? t('friends.scanHint') : t('trip.scanHintJoin');
  const modeIcon: React.ComponentProps<typeof Ionicons>['name'] = isInvite || isAddFriend
    ? 'person-add-outline'
    : 'airplane-outline';

  const scanAnimRef = useRef<Animated.Value | null>(null);
  if (scanAnimRef.current === null) scanAnimRef.current = new Animated.Value(0);
  const scanAnim = scanAnimRef.current;

  const pulseAnimRef = useRef<Animated.Value | null>(null);
  if (pulseAnimRef.current === null) pulseAnimRef.current = new Animated.Value(1);
  const pulseAnim = pulseAnimRef.current;

  useEffect(() => {
    navigation.setOptions({ title: screenTitle });
  }, [navigation, screenTitle]);

  useEffect(() => {
    if (scanState !== 'scanning') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanState, scanAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const scanLineY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, VIEWFINDER_SIZE - CORNER_THICKNESS - 2],
  });

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanState !== 'scanning') return;
    setScanState('loading');
    try {
      if (isInvite) {
        await inviteUser(data, tripId!);
      } else if (isAddFriend) {
        await sendFriendRequestById(data);
      } else {
        await createJoinRequest(data);
      }
      setScanState('success');
      setTimeout(() => router.back(), 1500);
    } catch (e) {
      const msg = resolveErrorMessage(e, mode, t);
      setErrorMessage(msg);
      setScanState('error');
    }
  };

  const handleTryAgain = () => { setErrorMessage(''); setScanState('scanning'); };

  if (!permission) {
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centred}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={[styles.permIconBg, { backgroundColor: `${theme.tint}18`, borderColor: `${theme.tint}35` }]}>
              <Ionicons name="camera-outline" size={48} color={theme.tint} />
            </View>
          </Animated.View>
          <ThemedText style={styles.permTitle}>{t('trip.cameraPermissionDenied')}</ThemedText>
          {permission.canAskAgain && (
            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.tint }]}
              onPress={requestPermission}
            >
              <Ionicons name="camera-outline" size={18} color="white" />
              <ThemedText style={styles.primaryButtonText}>{t('trip.allowCamera')}</ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanState === 'scanning' ? handleBarCodeScanned : undefined}
      />

      {/* Dark mask — flex layout creates transparent cutout in the center */}
      <View style={[StyleSheet.absoluteFill, styles.maskContainer]} pointerEvents="none">
        <View style={[styles.maskStrip, { flex: 1.2 }]} />
        <View style={styles.maskMiddleRow}>
          <View style={[styles.maskStrip, { flex: 1 }]} />
          <View style={styles.viewfinder}>
            <Corner position="tl" color={theme.tint} />
            <Corner position="tr" color={theme.tint} />
            <Corner position="bl" color={theme.tint} />
            <Corner position="br" color={theme.tint} />
            {scanState === 'scanning' && (
              <Animated.View
                style={[
                  styles.scanLine,
                  { backgroundColor: theme.tint, transform: [{ translateY: scanLineY }] },
                ]}
              />
            )}
          </View>
          <View style={[styles.maskStrip, { flex: 1 }]} />
        </View>
        <View style={[styles.maskStrip, { flex: 1.8, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 28 }]}>
          <View style={styles.hintBadge}>
            <Ionicons name={modeIcon} size={14} color="white" />
            <ThemedText style={styles.hint}>{hint}</ThemedText>
          </View>
        </View>
      </View>

      {/* Result overlay */}
      {scanState !== 'scanning' && (
        <View style={styles.resultOverlay}>
          {scanState === 'loading' && <ActivityIndicator size="large" color="white" />}
          {scanState === 'success' && (
            <>
              <Ionicons name="checkmark-circle" size={72} color="#4caf50" />
              <ThemedText style={styles.resultText}>
                {isInvite ? t('trip.inviteSent') : isAddFriend ? t('friends.requestSent') : t('trip.joinRequestSent')}
              </ThemedText>
            </>
          )}
          {scanState === 'error' && (
            <>
              <Ionicons name="close-circle" size={72} color="#d9534f" />
              <ThemedText style={styles.resultText}>{errorMessage}</ThemedText>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.tint, marginTop: 16 }]}
                onPress={handleTryAgain}
              >
                <ThemedText style={styles.primaryButtonText}>{t('trip.tryAgain')}</ThemedText>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
};

export default ScanQrScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Dark mask layout
  maskContainer: {
    flexDirection: 'column',
  },
  maskStrip: {
    backgroundColor: OVERLAY_BG,
  },
  maskMiddleRow: {
    flexDirection: 'row',
    height: VIEWFINDER_SIZE,
  },

  // Viewfinder (transparent center)
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 1,
    opacity: 0.85,
  },

  // Hint badge below viewfinder
  hintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hint: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Result overlay
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
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

  // Permission denied
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    padding: 32,
  },
  permIconBg: {
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permTitle: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.85,
    maxWidth: 260,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});
