import React, { useEffect, useState } from 'react';
import { StyleSheet, Alert, View, ScrollView, Text, ActivityIndicator, Modal, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBlobs, DotGrid } from '../../components/BackgroundTexture';
import SegmentedControl from '../../components/SegmentedControl';
import ThemedInput from '../../components/ThemedInput';

import {
  saveLanguage,
  getSavedLanguage,
  type AppLanguage,
  type AppTheme,
} from '../../src/preferences';
import { useAppTheme } from '../../src/theme';
import { useDataSaver } from '../../src/dataSaver';
import { useAuth } from '../../src/auth';
import { useDeleteAccountMutation } from '../../src/users';
import { AppError, ErrorCode } from '../../src/AppError';
import { Colors } from '../../constants/Colors';

const DELETE_COUNTDOWN_SECONDS = 3;

const DeleteAccountModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const { logout } = useAuth();
  const theme = Colors[themeName] ?? Colors.light;
  const deleteAccount = useDeleteAccountMutation();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(DELETE_COUNTDOWN_SECONDS);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleConfirm = async () => {
    if (!password.trim()) {
      setError(t('settings.deleteAccountPasswordRequired'));
      return;
    }
    try {
      await deleteAccount.mutateAsync({ password });
      await logout();
      router.replace('/login');
    } catch (err) {
      if (err instanceof AppError && err.code === ErrorCode.UNAUTHORIZED) {
        setError(t('settings.wrongPassword'));
      } else {
        setError(t('settings.deleteAccountError'));
      }
    }
  };

  const confirmDisabled = countdown > 0 || deleteAccount.isPending;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
          <Text style={[styles.modalTitle, { color: theme.title }]}>{t('settings.deleteAccount')}</Text>

          <View style={styles.dangerBox}>
            <Ionicons name="warning-outline" size={18} color={Colors.warning} />
            <Text style={[styles.dangerText, { color: theme.text }]}>{t('settings.deleteAccountWarning')}</Text>
          </View>

          <Text style={[styles.inputLabel, { color: theme.text }]}>
            {t('settings.deleteAccountPassword')}
          </Text>
          <ThemedInput
            placeholder={t('settings.deleteAccountPasswordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoFocus
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.modalButtons}>
            <Pressable
              style={[styles.modalBtn, { borderColor: theme.icon + '55', borderWidth: 1 }]}
              onPress={onClose}
              disabled={deleteAccount.isPending}
            >
              <Text style={{ color: theme.title, fontWeight: '600' }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: Colors.warning, opacity: confirmDisabled ? 0.5 : 1 }]}
              onPress={handleConfirm}
              disabled={confirmDisabled}
            >
              {deleteAccount.isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: 'white', fontWeight: '600' }}>
                  {countdown > 0 ? `${t('settings.deleteAccountConfirm')} (${countdown})` : t('settings.deleteAccountConfirm')}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const LANGUAGES: { value: AppLanguage; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'gl', label: 'Galego' },
  { value: 'en', label: 'English' },
];

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { selectedTheme, setThemePreference, themeName } = useAppTheme();
  const { dataSaver, setDataSaver } = useDataSaver();
  const theme = Colors[themeName] ?? Colors.light;
  const isDark = themeName === 'dark';
  const insets = useSafeAreaInsets();

  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>('es');
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Seed the language selector from storage once on mount. Subscribing to
  // i18n.language here re-fired this effect (and its AsyncStorage read) on every
  // language switch; handleLanguageChange already keeps selectedLanguage in sync.
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedLanguage = await getSavedLanguage();
        if (savedLanguage) {
          setSelectedLanguage(savedLanguage);
        } else {
          const currentLanguage = i18n.language.startsWith('gl')
            ? 'gl'
            : i18n.language.startsWith('en')
            ? 'en'
            : 'es';
          setSelectedLanguage(currentLanguage);
        }
      } catch {
        Alert.alert('Error', 'No se pudieron cargar las preferencias');
      } finally {
        setIsLoading(false);
      }
    };
    loadPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLanguageChange = async (language: AppLanguage) => {
    try {
      await saveLanguage(language);
      setSelectedLanguage(language);
    } catch {
      Alert.alert('Error', 'No se pudo cambiar el idioma');
    }
  };

  const handleThemeChange = async (newTheme: AppTheme) => {
    try {
      await setThemePreference(newTheme);
    } catch {
      Alert.alert('Error', 'No se pudo cambiar el tema');
    }
  };

  const handleDataSaverChange = async (enabled: boolean) => {
    try {
      await setDataSaver(enabled);
    } catch {
      Alert.alert('Error', 'No se pudo cambiar el modo de ahorro de datos');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isDark && <DotGrid color="rgba(168,85,247,0.055)" />}
      <AmbientBlobs tint={theme.tint} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
      >
        <LinearGradient
          colors={['#7c3aed', '#9d44f0', '#b873f8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerIconCircle}>
            <Ionicons name="settings-outline" size={30} color="#fff" />
          </View>
          <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* Language card */}
          <View style={[styles.card, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: `${theme.tint}20` }]}>
                <Ionicons name="language-outline" size={18} color={theme.tint} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, { color: theme.title }]}>{t('settings.language')}</Text>
                <Text style={[styles.cardSubtitle, { color: theme.text }]}>{t('settings.chooseLanguage')}</Text>
              </View>
            </View>

            <SegmentedControl
              options={LANGUAGES}
              value={selectedLanguage}
              onChange={(v) => handleLanguageChange(v as AppLanguage)}
              containerBackground={theme.background}
              thumbBackground={theme.tabBackground}
              activeColor={theme.tint}
              inactiveColor={theme.icon}
              glowColor={`${theme.tint}35`}
            />
          </View>

          {/* Theme card */}
          <View style={[styles.card, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: `${theme.tint}20` }]}>
                <Ionicons name="contrast-outline" size={18} color={theme.tint} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, { color: theme.title }]}>{t('settings.theme')}</Text>
                <Text style={[styles.cardSubtitle, { color: theme.text }]}>{t('settings.chooseTheme')}</Text>
              </View>
            </View>

            <SegmentedControl
              options={[
                { value: 'light', label: t('settings.light').toUpperCase(), iconName: 'sunny-outline' },
                { value: 'dark',  label: t('settings.dark').toUpperCase(),  iconName: 'moon-outline' },
              ]}
              value={selectedTheme}
              onChange={(v) => handleThemeChange(v as AppTheme)}
              containerBackground={theme.background}
              thumbBackground={theme.tabBackground}
              activeColor={theme.tint}
              inactiveColor={theme.icon}
              glowColor={`${theme.tint}35`}
            />
          </View>

          {/* Data saver card */}
          <View style={[styles.card, { backgroundColor: theme.uiBackground, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: `${theme.tint}20` }]}>
                <Ionicons name="cellular-outline" size={18} color={theme.tint} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, { color: theme.title }]}>{t('settings.dataSaver')}</Text>
                <Text style={[styles.cardSubtitle, { color: theme.text }]}>{t('settings.chooseDataSaver')}</Text>
              </View>
            </View>

            <SegmentedControl
              options={[
                { value: 'on',  label: t('settings.on').toUpperCase() },
                { value: 'off', label: t('settings.off').toUpperCase() },
              ]}
              value={dataSaver ? 'on' : 'off'}
              onChange={(v) => handleDataSaverChange(v === 'on')}
              containerBackground={theme.background}
              thumbBackground={theme.tabBackground}
              activeColor={theme.tint}
              inactiveColor={theme.icon}
              glowColor={`${theme.tint}35`}
            />
          </View>

          {/* Danger zone card */}
          <View style={[styles.card, { backgroundColor: theme.uiBackground, borderColor: `${Colors.warning}55` }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: `${Colors.warning}20` }]}>
                <Ionicons name="trash-outline" size={18} color={Colors.warning} />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, { color: theme.title }]}>{t('settings.account')}</Text>
                <Text style={[styles.cardSubtitle, { color: theme.text }]}>{t('settings.deleteAccountSubtitle')}</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.deleteButton, { borderColor: Colors.warning, opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setShowDeleteModal(true)}
              accessibilityRole="button"
              accessibilityHint={t('a11y.hintDeleteAccount')}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.warning} />
              <Text style={[styles.deleteButtonText, { color: Colors.warning }]}>{t('settings.deleteAccount')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}
    </View>
  );
};

export default Settings;

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 20,
    gap: 12,
  },
  headerIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.4,
  },

  content: {
    padding: 20,
    gap: 16,
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.6,
  },

  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalBox: { borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  dangerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(220,38,38,0.12)',
  },
  dangerText: { flex: 1, fontSize: 13, opacity: 0.85 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  errorText: { color: Colors.warning, marginTop: 10, textAlign: 'center' },

});
