import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useInvitations } from '../../src/invitations';
import { AppError, ErrorCode } from '../../src/AppError';
import { Ionicons } from '@expo/vector-icons';
import { useSidebar } from '../../src/sidebar';
import ThemedText from '../../components/ThemedText';
import ThemedInput from '../../components/ThemedInput';

const JoinTripScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { createJoinRequest } = useInvitations();
  const { setOpen } = useSidebar();

  const [tripId, setTripId] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!tripId.trim()) return;
    setSending(true);
    setSuccess(false);
    setError(null);
    try {
      await createJoinRequest(tripId.trim());
      setSuccess(true);
      setTripId('');
    } catch (e) {
      if (e instanceof AppError && e.code === ErrorCode.CONFLICT) {
        setError(t('trip.scanErrorConflictJoin'));
      } else if (e instanceof AppError && e.code === ErrorCode.FORBIDDEN) {
        setError(t('trip.scanErrorForbidden'));
      } else {
        setError(t('trip.joinRequestError'));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.navBackground, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={t('a11y.back')} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={theme.title} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.title }]}>
          {t('trip.joinTripTitle')}
        </ThemedText>
        <Pressable onPress={() => setOpen(true)} style={styles.headerButton} accessibilityRole="button" accessibilityLabel={t('a11y.menu')} hitSlop={10}>
          <ThemedText style={[styles.hamburger, { color: theme.title }]}>☰</ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Manual entry section */}
        <View style={styles.section}>
          <ThemedInput
            style={[styles.input, { color: theme.text, borderColor: theme.tint }]}
            placeholder={t('trip.enterTripId')}
            placeholderTextColor={theme.icon}
            value={tripId}
            onChangeText={text => { setTripId(text); setSuccess(false); setError(null); }}
            autoCapitalize="none"
          />

          {success && (
            <ThemedText style={styles.successText}>{t('trip.joinRequestSent')}</ThemedText>
          )}
          {error && (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          )}

          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.tint }, (!tripId.trim() || sending) && styles.disabled]}
            onPress={handleSend}
            disabled={sending || !tripId.trim()}
          >
            {sending
              ? <ActivityIndicator color="white" />
              : <ThemedText style={styles.primaryButtonText}>{t('trip.sendJoinRequest')}</ThemedText>}
          </Pressable>
        </View>

        {/* Scan QR button */}
        <Pressable
          style={[styles.secondaryButton, { borderColor: theme.tint }]}
          onPress={() => router.push({ pathname: '/scan-qr', params: { mode: 'join' } })}
        >
          <Ionicons name="qr-code-outline" size={20} color={theme.tint} />
          <ThemedText style={[styles.secondaryButtonText, { color: theme.tint }]}>
            {t('trip.scanTripQr')}
          </ThemedText>
        </Pressable>

      </ScrollView>
    </View>
  );
};

export default JoinTripScreen;

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
  hamburger: {
    fontSize: 22,
  },
  content: {
    padding: 24,
    gap: 24,
    alignItems: 'center',
  },
  section: {
    width: '100%',
    gap: 10,
  },
  input: {
    marginBottom: 0,
  },
  successText: {
    color: '#4caf50',
    textAlign: 'center',
    fontSize: 14,
  },
  errorText: {
    color: Colors.warning,
    textAlign: 'center',
    fontSize: 14,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    width: '100%',
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
