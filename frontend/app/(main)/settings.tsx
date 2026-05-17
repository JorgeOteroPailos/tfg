import React, { useEffect, useState } from 'react';
import { StyleSheet, Pressable, Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import ThemedText from '../../components/ThemedText';

import {
  saveLanguage,
  getSavedLanguage,
  type AppLanguage,
  type AppTheme,
} from '../../src/preferences';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { selectedTheme, setThemePreference } = useAppTheme();

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
      } catch (error) {
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
    } catch (error) {
      Alert.alert('Error', 'No se pudo cambiar el idioma');
    }
  };

  const handleThemeChange = async (theme: AppTheme) => {
    try {
      await setThemePreference(theme);
    } catch (error) {
      Alert.alert('Error', 'No se pudo cambiar el tema');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ThemedText>{t('common.loading')}</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedText title={true} style={styles.title}>
        {t('settings.title')}
      </ThemedText>

      <View style={styles.card}>
        <ThemedText title={true} style={styles.sectionTitle}>
          {t('settings.language')}
        </ThemedText>
        <ThemedText style={styles.description}>
          {t('settings.chooseLanguage')}
        </ThemedText>

        <View style={styles.optionsRow}>
          <OptionButton
            label="Español"
            selected={selectedLanguage === 'es'}
            onPress={() => handleLanguageChange('es')}
          />
          <OptionButton
            label="Galego"
            selected={selectedLanguage === 'gl'}
            onPress={() => handleLanguageChange('gl')}
          />
          <OptionButton
            label="English"
            selected={selectedLanguage === 'en'}
            onPress={() => handleLanguageChange('en')}
          />
        </View>
      </View>

      <View style={styles.card}>
        <ThemedText title={true} style={styles.sectionTitle}>
          {t('settings.theme')}
        </ThemedText>
        <ThemedText style={styles.description}>
          {t('settings.chooseTheme')}
        </ThemedText>

        <View style={styles.optionsRow}>
          <OptionButton
            label={t('settings.light')}
            selected={selectedTheme === 'light'}
            onPress={() => handleThemeChange('light')}
          />
          <OptionButton
            label={t('settings.dark')}
            selected={selectedTheme === 'dark'}
            onPress={() => handleThemeChange('dark')}
          />
          <OptionButton
            label={t('settings.system')}
            selected={selectedTheme === 'system'}
            onPress={() => handleThemeChange('system')}
          />
        </View>
      </View>
    </View>
  );
};

type OptionButtonProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

const OptionButton = ({
  label,
  selected,
  onPress,
}: OptionButtonProps) => {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.optionButton, selected && styles.optionButtonSelected]}
    >
      <ThemedText style={selected ? styles.optionTextSelected : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
};

export default Settings;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 20,
  },
  title: {
    marginTop: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
  },
  description: {
    opacity: 0.8,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 90,
    alignItems: 'center',
  },
  optionButtonSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  optionTextSelected: {
    fontWeight: '700',
  },
});