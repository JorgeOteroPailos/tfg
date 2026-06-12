import React, { useEffect, useState } from 'react';
import { StyleSheet, Alert, View, ScrollView, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AmbientBlobs, DotGrid } from '../../components/BackgroundTexture';
import SegmentedControl from '../../components/SegmentedControl';

import {
  saveLanguage,
  getSavedLanguage,
  type AppLanguage,
  type AppTheme,
} from '../../src/preferences';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';

const LANGUAGES: { value: AppLanguage; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'gl', label: 'Galego' },
  { value: 'en', label: 'English' },
];

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { selectedTheme, setThemePreference, themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const isDark = themeName === 'dark';

  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>('es');
  const [isLoading, setIsLoading] = useState(true);

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
  }, [i18n.language]);

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
      <AmbientBlobs tint={theme.tint} secondary={Colors.secondary} />

      <ScrollView showsVerticalScrollIndicator={false}>
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
        </View>
      </ScrollView>
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

});
