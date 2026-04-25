import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { getSavedTheme, saveTheme, type AppTheme } from './preferences';

type ResolvedTheme = 'light' | 'dark';

type ThemeContextType = {
  selectedTheme: AppTheme;
  themeName: ResolvedTheme;
  isLoading: boolean;
  setThemePreference: (theme: AppTheme) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const systemColorScheme = useColorScheme();
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>('system');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await getSavedTheme();
        setSelectedTheme(savedTheme);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  const themeName: ResolvedTheme =
    selectedTheme === 'system'
      ? systemColorScheme === 'dark'
        ? 'dark'
        : 'light'
      : selectedTheme;

  const setThemePreference = async (theme: AppTheme) => {
    await saveTheme(theme);
    setSelectedTheme(theme);
  };

  const value = useMemo(
    () => ({
      selectedTheme,
      themeName,
      isLoading,
      setThemePreference,
    }),
    [selectedTheme, themeName, isLoading]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme debe usarse dentro de ThemeProvider');
  }

  return context;
};