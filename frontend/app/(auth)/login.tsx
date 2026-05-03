import { StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import ThemedView from '../../components/ThemedView';
import ThemedText from '../../components/ThemedText';
import ThemedButton from '../../components/ThemedButton';
import ThemedInput from '../../components/ThemedInput';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../src/auth';
import { AppError, ErrorCode } from '../../src/AppError';

const Login = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
    [ErrorCode.UNAUTHORIZED]: t('wrongCredentials'),
    [ErrorCode.SESSION_SAVE_ERROR]: t('errorSavingSession'),
    [ErrorCode.SERVER_ERROR]: t('serverError'),
    [ErrorCode.BAD_REQUEST]: t('invalidLoginRequest'),
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('error'), t('mustIntroduceEmailAndPassword'));
      return;
    }

    try {
      setIsLoading(true);
      await login(email.trim(), password);
      router.replace('/main');
    } catch (error) {
      const code = error instanceof AppError ? error.code : ErrorCode.SERVER_ERROR;
      const message = ERROR_MESSAGES[code] ?? t('loginError');
      Alert.alert(t('error'), message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText title={true}>
        {t('loginScreenDescription')}
      </ThemedText>

      <ThemedInput
        style={styles.input}
        placeholder={t('email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <ThemedInput
        style={styles.input}
        placeholder={t('password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <ThemedButton
        onPress={handleLogin}
        disabled={isLoading}
      >
        <ThemedText>
          {isLoading ? t('loading') : t('login')}
        </ThemedText>
      </ThemedButton>

      <Link href="/(auth)/register">
        <ThemedText>
          {t('iDontHaveAccount')} {t('register')}
        </ThemedText>
      </Link>
    </ThemedView>
  );
};

export default Login;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
    padding: 20,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
  },
});