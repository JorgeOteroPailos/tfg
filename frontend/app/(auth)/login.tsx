import { StyleSheet, Alert, Text, View } from 'react-native';
import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import ThemedText from '../../components/ThemedText';
import ThemedButton from '../../components/ThemedButton';
import ThemedInput from '../../components/ThemedInput';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../src/auth';
import { AppError, ErrorCode } from '../../src/AppError';
import { Colors } from '../../constants/Colors';

const Login = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
    [ErrorCode.UNAUTHORIZED]: t('auth.login.errors.wrongCredentials'),
    [ErrorCode.SESSION_SAVE_ERROR]: t('errors.session'),
    [ErrorCode.SERVER_ERROR]: t('errors.server'),
    [ErrorCode.BAD_REQUEST]: t('auth.login.errors.invalidRequest'),
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('auth.login.errors.mustIntroduceEmailAndPassword'));
      return;
    }

    try {
      setIsLoading(true);
      await login(email.trim(), password);
      router.replace('/main');
    } catch (error) {
      const code = error instanceof AppError ? error.code : ErrorCode.SERVER_ERROR;
      const message = ERROR_MESSAGES[code] ?? t('auth.login.errors.error');
      Alert.alert(t('common.error'), message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText title={true}>
        {t('auth.login.description')}
      </ThemedText>

      <ThemedInput
        style={styles.input}
        placeholder={t('auth.login.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <ThemedInput
        style={styles.input}
        placeholder={t('auth.login.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <ThemedButton
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text style={{ color: Colors.dark.title }}>
          {isLoading ? t('common.loading') : t('auth.login.button')}
        </Text>
      </ThemedButton>

      <Link href="/(auth)/register">
        <ThemedText>
          {t('auth.login.dontHaveAccount')} - {t('auth.register.title')}
        </ThemedText>
      </Link>
    </View>
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