import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ThemedText from '../../../components/ThemedText';
import ThemedButton from '../../../components/ThemedButton';
import { useAuth } from '../../../src/auth';
import { t } from 'i18next';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../../constants/Colors';
import { useAppTheme } from '../../../src/theme';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';

const Profile = () => {
  const { userEmail, username, logout, userId } = useAuth();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const [copied, setCopied] = useState(false);

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : (userEmail ? userEmail.slice(0, 2).toUpperCase() : '??');

  const handleCopyUserId = async () => {
    if (!userId) return;
    await Clipboard.setStringAsync(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['#7c3aed', '#9d44f0', '#b873f8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.avatarCircle}>
          <ThemedText style={styles.avatarText}>{initials}</ThemedText>
        </View>
        <ThemedText style={styles.headerName}>{username ?? t('common.notAvailable')}</ThemedText>
      </LinearGradient>

      <View style={[styles.infoCard, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
        <View style={styles.infoRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
            <Ionicons name="person-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>{t('profile.username')}</ThemedText>
            <ThemedText style={styles.infoValue}>{username ?? t('common.notAvailable')}</ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.infoRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
            <Ionicons name="mail-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>{t('profile.email')}</ThemedText>
            <ThemedText style={styles.infoValue}>{userEmail ?? t('common.notAvailable')}</ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.infoRow}>
          <View style={[styles.iconBadge, { backgroundColor: theme.background }]}>
            <Ionicons name="finger-print-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.infoText}>
            <ThemedText style={styles.infoLabel}>{t('profile.userId')}</ThemedText>
            <ThemedText style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
              {userId ?? t('common.notAvailable')}
            </ThemedText>
          </View>
          {userId && (
            <Pressable
              onPress={handleCopyUserId}
              style={({ pressed }) => [
                styles.copyButton,
                { backgroundColor: copied ? Colors.primary : theme.background, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons
                name={copied ? 'checkmark-outline' : 'copy-outline'}
                size={16}
                color={copied ? '#ffffff' : Colors.primary}
              />
            </Pressable>
          )}
        </View>
      </View>

      {userId && (
        <View style={[styles.qrCard, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
          <ThemedText title style={styles.qrTitle}>{t('profile.qrTitle')}</ThemedText>
          <View style={styles.qrBox}>
            <QRCode value={userId} size={180} backgroundColor="white" color="black" />
          </View>
          <ThemedText style={[styles.qrHint, { color: theme.text }]}>{t('profile.qrHint')}</ThemedText>
        </View>
      )}

      <ThemedButton onPress={handleLogout} style={styles.logoutButton}>
        <View style={styles.logoutContent}>
          <Ionicons name="log-out-outline" size={18} color="white" />
          <ThemedText style={styles.logoutText}>{t('profile.logout')}</ThemedText>
        </View>
      </ThemedButton>
    </ScrollView>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 20,
    gap: 12,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  infoCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  copyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  qrCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  qrTitle: {
    fontSize: 16,
  },
  qrBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
  },
  qrHint: {
    textAlign: 'center',
    fontSize: 13,
    opacity: 0.6,
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
