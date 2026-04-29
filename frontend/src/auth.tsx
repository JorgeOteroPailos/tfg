import * as SecureStore from 'expo-secure-store';
import { BASE_URL } from '../constants/constants';
import { AppError, ErrorCode } from './AppError';
import AsyncStorage from '@react-native-async-storage/async-storage';


import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

const REFRESH_TOKEN_KEY = 'refreshToken';
const ACCESS_TOKEN_KEY = 'accessToken';
const USER_EMAIL_KEY = 'userEmail';
const USER_NAME_KEY = 'userName';

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
  await AsyncStorage.setItem(USER_EMAIL_KEY, userEmail);
}

async function getUserEmail() {
  return await AsyncStorage.getItem(USER_EMAIL_KEY);
}

async function saveUserName(userName: string) {
  await AsyncStorage.setItem(USER_NAME_KEY, userName);
}

async function getUserName() {
  return await AsyncStorage.getItem(USER_NAME_KEY);
}


export async function clearSession() {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await AsyncStorage.removeItem(USER_EMAIL_KEY);
  await AsyncStorage.removeItem(USER_NAME_KEY);
  //TODO cerrar sesión en el servidor
}


type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  userEmail: string | null;
  userName: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
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
    const [userName, setUserNameState] = useState<string | null>(null);

    useEffect(() => {
      restoreSession();
    }, []);

    const restoreSession = async () => {
      try {
        const refreshToken = await getRefreshToken();
        const storedAccessToken = await getAccessToken();
        const storedUserEmail = await getUserEmail();
        const storedUserName = await getUserName();
        
        console.log('restoreSession -> refreshToken:', refreshToken);
        console.log('restoreSession -> accessToken:', storedAccessToken);
        console.log('restoreSession -> userEmail:', storedUserEmail);
        console.log('restoreSession -> userName:', storedUserName);

        if (!refreshToken) {
          setIsAuthenticated(false);
          setAccessToken(null);
          setUserEmailState(null);
          setUserNameState(null);
          return;
        }

        //TODO aquí se debería validar el refresh token con el servidor y obtener un nuevo access token

        setAccessToken(storedAccessToken);
        setUserEmailState(storedUserEmail);
        setUserNameState(storedUserName);
        setIsAuthenticated(true);
      } catch (error) {
        console.log('restoreSession error:', error);
        await clearSession();
        setIsAuthenticated(false);
        setAccessToken(null);
        setUserEmailState(null);
        setUserNameState(null);
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
      //TODO obtener el username del servidor en lugar de guardarlo en el registro
      setIsAuthenticated(true);
    };

    const logout = async () => {
      await clearSession();

      setAccessToken(null);
      setUserEmailState(null);
      setIsAuthenticated(false);
      //TODO cerrar sesión en el servidor
    };

    const register = async (username: string, email: string, password: string) => {
      let accessToken: string;
      let refreshToken: string;

      try {
        ({ accessToken, refreshToken } = await registerRequest({ username, email, password }));
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(ErrorCode.SERVER_ERROR); 
      }

      try {
        await Promise.all([
          saveAccessToken(accessToken),
          saveRefreshToken(refreshToken),
          saveUserEmail(email),
          saveUserName(username),
        ]);
      } catch {
        throw new AppError(ErrorCode.SESSION_SAVE_ERROR);
      }

      setAccessToken(accessToken);
      setUserEmailState(email);
      setUserNameState(username);
      setIsAuthenticated(true);
    }

    return (
      <AuthContext.Provider
        value={{
          isAuthenticated,
          isLoading,
          accessToken,
          userEmail,
          userName,
          login,
          logout,
          register
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
    console.log('handleResponse error -> status:', response.status, 'body:', errorText);
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

async function registerRequest(
  data: RegisterRequest
): Promise<LoginResponse> {
  const response = await fetch(`${BASE_URL}/auth/register`, {
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
