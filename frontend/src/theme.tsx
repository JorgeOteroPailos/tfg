import React, {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { getSavedTheme, saveTheme, type AppTheme } from './preferences';

type ResolvedTheme = 'light' | 'dark';

type ThemeContextType = {
  selectedTheme: AppTheme;
  themeName: ResolvedTheme;
  setThemePreference: (theme: AppTheme) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Start loading immediately when the module is imported, not when the component mounts.
// use() below suspends instead of rendering with a placeholder, eliminating the extra render.
const _savedThemeProm = getSavedTheme().catch(() => 'system' as AppTheme);

export const ThemeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const systemColorScheme = useColorScheme();
  const initialTheme = use(_savedThemeProm);
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>(initialTheme);

  const themeName: ResolvedTheme =
    selectedTheme === 'system'
      ? systemColorScheme === 'dark'
        ? 'dark'
        : 'light'
      : selectedTheme;

  const setThemePreference = useCallback(async (theme: AppTheme) => {
    await saveTheme(theme);
    setSelectedTheme(theme);
  }, []);

  const value = useMemo(
    () => ({
      selectedTheme,
      themeName,
      setThemePreference,
    }),
    [selectedTheme, themeName, setThemePreference]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = use(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme debe usarse dentro de ThemeProvider');
  }

  return context;
};