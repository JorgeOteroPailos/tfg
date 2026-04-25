import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

export type AppLanguage = 'es' | 'en' | 'gl';
export type AppTheme = 'light' | 'dark' | 'system';

const LANGUAGE_KEY = 'app_language';
const THEME_KEY = 'app_theme';

export async function saveLanguage(language: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
  await i18n.changeLanguage(language);
}

export async function getSavedLanguage(): Promise<AppLanguage | null> {
  const value = await AsyncStorage.getItem(LANGUAGE_KEY);

  if (value === 'es' || value === 'en' || value === 'gl') {
    return value;
  }

  return null;
}

export async function applySavedLanguage(): Promise<void> {
  const savedLanguage = await getSavedLanguage();

  if (savedLanguage) {
    await i18n.changeLanguage(savedLanguage);
  }
}

export async function saveTheme(theme: AppTheme): Promise<void> {
  await AsyncStorage.setItem(THEME_KEY, theme);
}

export async function getSavedTheme(): Promise<AppTheme> {
  const value = await AsyncStorage.getItem(THEME_KEY);

  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }

  return 'system';
}