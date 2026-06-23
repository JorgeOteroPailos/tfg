import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveLanguage,
  getSavedLanguage,
  applySavedLanguage,
  saveTheme,
  getSavedTheme,
  saveDataSaver,
  getSavedDataSaver,
} from '../preferences';

// AsyncStorage is already mocked by moduleNameMapper in jest.config.js.
// We spy on individual methods per test to control return values.

const mockChangeLanguage = jest.fn();

jest.mock('../../i18n', () => ({
  __esModule: true,
  default: {
    changeLanguage: (...args: unknown[]) => mockChangeLanguage(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null as any);
  jest.spyOn(AsyncStorage, 'setItem').mockResolvedValue(undefined as any);
  mockChangeLanguage.mockResolvedValue(undefined);
});

// ── saveLanguage ──────────────────────────────────────────────────────────────

describe('saveLanguage', () => {
  it('writes the language key to AsyncStorage', async () => {
    await saveLanguage('es');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('app_language', 'es');
  });

  it('calls i18n.changeLanguage with the new language', async () => {
    await saveLanguage('gl');
    expect(mockChangeLanguage).toHaveBeenCalledWith('gl');
  });
});

// ── getSavedLanguage ──────────────────────────────────────────────────────────

describe('getSavedLanguage', () => {
  it.each(['es', 'en', 'gl'] as const)('returns %s when it is stored', async (lang) => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(lang as any);
    expect(await getSavedLanguage()).toBe(lang);
  });

  it('returns null when the stored value is unknown', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue('fr' as any);
    expect(await getSavedLanguage()).toBeNull();
  });

  it('returns null when nothing is stored', async () => {
    expect(await getSavedLanguage()).toBeNull();
  });
});

// ── applySavedLanguage ────────────────────────────────────────────────────────

describe('applySavedLanguage', () => {
  it('calls i18n.changeLanguage when a language is saved', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue('en' as any);
    await applySavedLanguage();
    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
  });

  it('does not call i18n.changeLanguage when nothing is saved', async () => {
    await applySavedLanguage();
    expect(mockChangeLanguage).not.toHaveBeenCalled();
  });
});

// ── saveTheme ─────────────────────────────────────────────────────────────────

describe('saveTheme', () => {
  it('writes light to AsyncStorage', async () => {
    await saveTheme('light');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('app_theme', 'light');
  });

  it('writes dark to AsyncStorage', async () => {
    await saveTheme('dark');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('app_theme', 'dark');
  });
});

// ── getSavedTheme ─────────────────────────────────────────────────────────────

describe('getSavedTheme', () => {
  it.each(['light', 'dark'] as const)('returns %s when it is stored', async (theme) => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(theme as any);
    expect(await getSavedTheme()).toBe(theme);
  });

  it('returns dark when nothing is stored', async () => {
    expect(await getSavedTheme()).toBe('dark');
  });

  it('returns dark for an unknown stored value', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue('solarized' as any);
    expect(await getSavedTheme()).toBe('dark');
  });
});

// ── saveDataSaver ─────────────────────────────────────────────────────────────

describe('saveDataSaver', () => {
  it('stores "1" when enabled is true', async () => {
    await saveDataSaver(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('app_data_saver', '1');
  });

  it('stores "0" when enabled is false', async () => {
    await saveDataSaver(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('app_data_saver', '0');
  });
});

// ── getSavedDataSaver ─────────────────────────────────────────────────────────

describe('getSavedDataSaver', () => {
  it('returns true when "1" is stored', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue('1' as any);
    expect(await getSavedDataSaver()).toBe(true);
  });

  it('returns false when "0" is stored', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue('0' as any);
    expect(await getSavedDataSaver()).toBe(false);
  });

  it('returns false when nothing is stored', async () => {
    expect(await getSavedDataSaver()).toBe(false);
  });
});
