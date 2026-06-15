import * as SecureStore from 'expo-secure-store';
import { BASE_URL } from '../constants/constants';
import { AppError, ErrorCode } from './AppError';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { components } from '../src/generated/types';
import { clearLastTripId } from './lastTrip';
import React, {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

type LoginRequest = components["schemas"]["LoginRequest"];
type RegisterRequest = components["schemas"]["RegisterRequest"];
type LoginResponse = components["schemas"]["LoginResponse"];


const REFRESH_TOKEN_KEY = 'refreshToken';
const ACCESS_TOKEN_KEY = 'accessToken';
const USER_EMAIL_KEY = 'userEmail';
const USER_NAME_KEY = 'username';

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

async function saveUserName(username: string) {
  await AsyncStorage.setItem(USER_NAME_KEY, username);
}

async function getUserName() {
  return await AsyncStorage.getItem(USER_NAME_KEY);
}


async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    AsyncStorage.removeItem(USER_EMAIL_KEY),
    AsyncStorage.removeItem(USER_NAME_KEY),
    clearLastTripId(),
  ]);
  //TODO cerrar sesión en el servidor
}


type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  userEmail: string | null;
  username: string | null;
  userId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  callAuthenticated: (url: string, options?: RequestInit) => Promise<Response>;
  applyTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  updateStoredUsername: (username: string) => Promise<void>;
  updateStoredEmail: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  userEmail: string | null;
  username: string | null;
};

type AuthAction =
  | { type: 'session_restored'; accessToken: string | null; userEmail: string | null; username: string | null }
  | { type: 'session_cleared' }
  | { type: 'loading_done' }
  | { type: 'token_refreshed'; accessToken: string }
  | { type: 'username_updated'; username: string }
  | { type: 'email_updated'; userEmail: string };

const initialAuthState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  accessToken: null,
  userEmail: null,
  username: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'session_restored':
      return { ...state, isAuthenticated: true, accessToken: action.accessToken, userEmail: action.userEmail, username: action.username };
    case 'session_cleared':
      return { ...state, isAuthenticated: false, accessToken: null, userEmail: null, username: null };
    case 'loading_done':
      return { ...state, isLoading: false };
    case 'token_refreshed':
      return { ...state, accessToken: action.accessToken };
    case 'username_updated':
      return { ...state, username: action.username };
    case 'email_updated':
      return { ...state, userEmail: action.userEmail };
    default:
      return state;
  }
}

  export const AuthProvider = ({
    children,
  }: {
    children: React.ReactNode;
  }) => {
    const [authState, dispatch] = useReducer(authReducer, initialAuthState);
    const { isAuthenticated, isLoading, accessToken, userEmail, username } = authState;
    const refreshPromiseRef = useRef<Promise<string> | null>(null);

    useEffect(() => {
      restoreSession();
    }, []);

    const restoreSession = async () => {
      try {
        const [refreshToken, storedAccessToken, storedUserEmail, storedUserName] = await Promise.all([
          getRefreshToken(),
          getAccessToken(),
          getUserEmail(),
          getUserName(),
        ]);

        console.log('restoreSession -> refreshToken:', refreshToken);
        console.log('restoreSession -> accessToken:', storedAccessToken);
        console.log('restoreSession -> userEmail:', storedUserEmail);
        console.log('restoreSession -> username:', storedUserName);

        if (!refreshToken) {
          dispatch({ type: 'session_cleared' });
          return;
        }

        //TODO refresh aquí

        dispatch({ type: 'session_restored', accessToken: storedAccessToken, userEmail: storedUserEmail, username: storedUserName });
      } catch (error) {
        console.log('restoreSession error:', error);
        await clearSession();
        dispatch({ type: 'session_cleared' });
      } finally {
        dispatch({ type: 'loading_done' });
      }
    };

    const login = useCallback(async (email: string, password: string) => {
      let accessToken: string;
      let refreshToken: string;
      let username: string;

      try {
        ({ accessToken, refreshToken, username } = await loginRequest({ email, password }));
      } catch (error) {
        console.log('login error:', error);

        if (error instanceof AppError) {
          throw error;
        }

        throw new AppError(ErrorCode.UNKNOWN_ERROR);
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

      dispatch({ type: 'session_restored', accessToken, userEmail: email, username });
    }, []);

    const register = useCallback(async (username: string, email: string, password: string) => {
      let accessToken: string;
      let refreshToken: string;

      try {
        ({ accessToken, refreshToken, username } = await registerRequest({ username, email, password }));
      } catch (error) {
        console.log('register error:', error);

        if (error instanceof AppError) {
          throw error;
        }

        throw new AppError(ErrorCode.UNKNOWN_ERROR);
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

      dispatch({ type: 'session_restored', accessToken, userEmail: email, username });
    }, []);

    const logout = useCallback(async () => {
      await clearSession();
      dispatch({ type: 'session_cleared' });
      //TODO cerrar sesión en el servidor
    }, []);

    const doRefresh = useCallback(async (): Promise<string> => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        await clearSession();
        dispatch({ type: 'session_cleared' });
        throw new AppError(ErrorCode.UNKNOWN_ERROR);
      }

      const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!refreshResponse.ok) {
        await clearSession();
        dispatch({ type: 'session_cleared' });
        throw new AppError(ErrorCode.UNKNOWN_ERROR);
      }

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await refreshResponse.json();
      await Promise.all([saveAccessToken(newAccessToken), saveRefreshToken(newRefreshToken)]);
      dispatch({ type: 'token_refreshed', accessToken: newAccessToken });
      return newAccessToken;
    }, []);

    const callAuthenticated = useCallback(async (path: string, options?: RequestInit): Promise<Response> => {
      const currentToken = await getAccessToken();
      const url = `${BASE_URL}${path}`;

      const response = await fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status !== 401) {
        return response;
      }

      console.log('Token expirado, intentando refresh...');

      if (!refreshPromiseRef.current) {
        refreshPromiseRef.current = doRefresh().finally(() => {
          refreshPromiseRef.current = null;
        });
      }

      const newAccessToken = await refreshPromiseRef.current;

      return fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          'Authorization': `Bearer ${newAccessToken}`,
          'Content-Type': 'application/json',
        },
      });
    }, [doRefresh]);

    const applyTokens = useCallback(async (accessToken: string, refreshToken: string) => {
      await Promise.all([saveAccessToken(accessToken), saveRefreshToken(refreshToken)]);
      dispatch({ type: 'token_refreshed', accessToken });
    }, []);

    const updateStoredUsername = useCallback(async (username: string) => {
      await saveUserName(username);
      dispatch({ type: 'username_updated', username });
    }, []);

    const updateStoredEmail = useCallback(async (email: string) => {
      await saveUserEmail(email);
      dispatch({ type: 'email_updated', userEmail: email });
    }, []);

    const userId = useMemo(() => {
      if (!accessToken) return null;
      try {
        return JSON.parse(atob(accessToken.split('.')[1])).sub as string;
      } catch {
        return null;
      }
    }, [accessToken]);

    const value = useMemo(
      () => ({ isAuthenticated, isLoading, accessToken, userEmail, username, userId, login, logout, register, callAuthenticated, applyTokens, updateStoredUsername, updateStoredEmail }),
      [isAuthenticated, isLoading, accessToken, userEmail, username, userId, login, logout, register, callAuthenticated, applyTokens, updateStoredUsername, updateStoredEmail]
    );

    return (
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
    );
};

export const useAuth = () => {
  const context = use(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
};

//TODO nada de esto usa eutenticación, y hay q gestionar lo del refresco tmbn

async function loginRequest(data: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  console.log('Login response status:', response.status);

  if (!response.ok) {
    try {
      const errorData = await response.json();
      console.log('Error from backend:', errorData);

      throw new AppError(response.status as ErrorCode);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(ErrorCode.SERVER_ERROR);
    }
  }

  return response.json();
}

async function registerRequest(data: RegisterRequest): Promise<LoginResponse> {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  console.log('Register response status:', response.status);

  if (!response.ok) {
    try {
      const errorData = await response.json();
      console.log('Error from backend:', errorData);

      throw new AppError(response.status as ErrorCode);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(ErrorCode.SERVER_ERROR);
    }
  }

  return response.json();
}
