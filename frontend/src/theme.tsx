import React, {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { getSavedTheme, saveTheme, type AppTheme } from './preferences';

type ThemeContextType = {
  selectedTheme: AppTheme;
  themeName: AppTheme;
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
  const initialTheme = use(_savedThemeProm);
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>(initialTheme);

  const setThemePreference = useCallback(async (theme: AppTheme) => {
    await saveTheme(theme);
    setSelectedTheme(theme);
  }, []);

  const value = useMemo(
    () => ({
      selectedTheme,
      themeName: selectedTheme,
      setThemePreference,
    }),
    [selectedTheme, setThemePreference]
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