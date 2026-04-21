import * as SecureStore from 'expo-secure-store';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

const REFRESH_TOKEN_KEY = 'refreshToken';
const ACCESS_TOKEN_KEY = 'accessToken';
const USER_ID_KEY = 'userId';

export async function saveRefreshToken(token: string) {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function getRefreshToken() {
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveAccessToken(token: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getAccessToken() {
  return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function saveUserId(userId: string) {
  await SecureStore.setItemAsync(USER_ID_KEY, userId);
}

export async function getUserId() {
  return await SecureStore.getItemAsync(USER_ID_KEY);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_ID_KEY);
}


type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  userId: string | null;

  login: (
    accessToken: string,
    refreshToken: string,
    userId: string
  ) => Promise<void>;

  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserIdState] = useState<string | null>(null);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        setIsAuthenticated(false);
        return;
      }

      // Más adelante aquí llamarás a tu backend:
      // POST /auth/refresh
      // para validar el refresh token y obtener
      // un nuevo access token.

      // Por ahora simplemente asumimos que existe
      // y la sesión sigue siendo válida.
      setIsAuthenticated(true);
    } catch (error) {
      await clearSession();
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (
    newAccessToken: string,
    newRefreshToken: string,
    newUserId: string
  ) => {
    await saveAccessToken(newAccessToken);
    await saveRefreshToken(newRefreshToken);
    await saveUserId(newUserId);

    setAccessToken(newAccessToken);
    setUserIdState(newUserId);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await clearSession();

    setAccessToken(null);
    setUserIdState(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        accessToken,
        userId,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
};
