import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useInvitations } from '../../../src/invitations';
import { useSidebar } from '../../../src/sidebar';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../../../components/ThemedText';
import ThemedInput from '../../../components/ThemedInput';

const AddMemberScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { inviteUser } = useInvitations();
  const { setOpen } = useSidebar();

  const [userId, setUserId] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!userId.trim()) return;
    setSending(true);
    setSuccess(false);
    setError(null);
    try {
      await inviteUser(userId.trim(), tripId);
      setSuccess(true);
      setUserId('');
    } catch {
      setError(t('trip.inviteError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.navBackground, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={26} color={theme.title} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: theme.title }]}>
          {t('trip.addMember')}
        </ThemedText>
        <TouchableOpacity onPress={() => setOpen(true)} style={styles.headerButton}>
          <ThemedText style={[styles.hamburger, { color: theme.title }]}>☰</ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* QR section */}
        <View style={[styles.qrCard, { backgroundColor: theme.tabBackground }]}>
          <QRCode value={tripId} size={200} />
          <ThemedText style={[styles.qrHint, { color: theme.icon }]}>
            {t('trip.tripQrHint')}
          </ThemedText>
        </View>

        {/* Manual invite section */}
        <View style={styles.inviteSection}>
          <ThemedInput
            style={[styles.input, { color: theme.text, borderColor: theme.tint }]}
            placeholder={t('trip.enterUserId')}
            placeholderTextColor={theme.icon}
            value={userId}
            onChangeText={text => { setUserId(text); setSuccess(false); setError(null); }}
            autoCapitalize="none"
          />

          {success && (
            <ThemedText style={styles.successText}>{t('trip.inviteSent')}</ThemedText>
          )}
          {error && (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.tint }]}
            onPress={handleInvite}
            disabled={sending || !userId.trim()}
          >
            {sending
              ? <ActivityIndicator color="white" />
              : <ThemedText style={styles.primaryButtonText}>{t('trip.sendInvite')}</ThemedText>}
          </TouchableOpacity>
        </View>

        {/* Scan QR button */}
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: theme.tint }]}
          onPress={() => router.push({ pathname: '/scan-qr', params: { mode: 'invite', tripId } })}
        >
          <Ionicons name="qr-code-outline" size={20} color={theme.tint} />
          <ThemedText style={[styles.secondaryButtonText, { color: theme.tint }]}>
            {t('trip.scanQr')}
          </ThemedText>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

export default AddMemberScreen;

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
  qrCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    gap: 16,
    width: '100%',
  },
  qrHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  inviteSection: {
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
    color: '#d9534f',
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
