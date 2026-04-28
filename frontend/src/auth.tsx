import * as SecureStore from 'expo-secure-store';
import { BASE_URL } from '../constants/constants';
import { AppError, ErrorCode } from './AppError';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { t } from 'i18next';

const REFRESH_TOKEN_KEY = 'refreshToken';
const ACCESS_TOKEN_KEY = 'accessToken';
const USER_EMAIL_KEY = 'userEmail';

async function saveRefreshToken(token: string) {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

async function getRefreshToken() {
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

async function saveAccessToken(token: string) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

async function getAccessToken() {
  return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

async function saveUserEmail(userEmail: string) {
  await SecureStore.setItemAsync(USER_EMAIL_KEY, userEmail);
}

async function getUserEmail() {
  return await SecureStore.getItemAsync(USER_EMAIL_KEY);
}
//TODO  guardar algunas de estas en asyncStorage

export async function clearSession() {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_EMAIL_KEY);
  //TODO cerrar sesión en el servidor
}


type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  userEmail: string | null;
  login: (email: string, password: string) => Promise<void>; // ← antes tenía 3 parámetros
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
    const [userEmail, setUserEmailState] = useState<string | null>(null);

    useEffect(() => {
      restoreSession();
    }, []);

    const restoreSession = async () => {
      try {
        const refreshToken = await getRefreshToken();
        const storedAccessToken = await getAccessToken();
        const storedUserEmail = await getUserEmail();

        console.log('restoreSession -> refreshToken:', refreshToken);
        console.log('restoreSession -> accessToken:', storedAccessToken);
        console.log('restoreSession -> userEmail:', storedUserEmail);

        if (!refreshToken) {
          setIsAuthenticated(false);
          setAccessToken(null);
          setUserEmailState(null);
          return;
        }

        //TODO aquí se debería validar el refresh token con el servidor y obtener un nuevo access token

        setAccessToken(storedAccessToken);
        setUserEmailState(storedUserEmail);
        setIsAuthenticated(true);
      } catch (error) {
        console.log('restoreSession error:', error);
        await clearSession();
        setIsAuthenticated(false);
        setAccessToken(null);
        setUserEmailState(null);
      } finally {
        setIsLoading(false);
      }
    };

    const login = async (email: string, password: string) => {
      let accessToken: string;
      let refreshToken: string;

      try {
        ({ accessToken, refreshToken } = await loginRequest({ email, password }));
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(ErrorCode.SERVER_ERROR); 
      }

      try {
        await Promise.all([
          saveAccessToken(accessToken),
          saveRefreshToken(refreshToken),
          saveUserEmail(email),
        ]);
      } catch {
        throw new AppError(ErrorCode.SESSION_SAVE_ERROR);
      }

      setAccessToken(accessToken);
      setUserEmailState(email);
      setIsAuthenticated(true);
    };

    const logout = async () => {
      await clearSession();

      setAccessToken(null);
      setUserEmailState(null);
      setIsAuthenticated(false);
      //TODO cerrar sesión en el servidor
    };

    return (
      <AuthContext.Provider
        value={{
          isAuthenticated,
          isLoading,
          accessToken,
          userEmail,
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


async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Error en la petición');
  }

  return response.json() as Promise<T>;
} //TODO nada de esto usa eutenticación, y hay q gestionar lo del refresco tmbn

async function loginRequest(
  data: LoginRequest
): Promise<LoginResponse> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse<LoginResponse>(response);
}

export async function registerRequest(
  data: RegisterRequest
): Promise<LoginResponse> {
  const response = await fetch(`${BASE_URL}/auth/signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse<LoginResponse>(response);
}

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  username: string;
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};
