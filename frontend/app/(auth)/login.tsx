import { StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import ThemedView from '../../components/ThemedView';
import ThemedText from '../../components/ThemedText';
import ThemedButton from '../../components/ThemedButton';
import ThemedInput from '../../components/ThemedInput';
import { useTranslation } from 'react-i18next';

import { loginRequest } from '../../src/communication';
import { useAuth } from '../../src/auth';

const Login = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Debes introducir email y contraseña');
      return;
    }

    try {
      setIsLoading(true);

      const response = await loginRequest({
        email: email.trim(),
        password,
      });

      await login(
        response.accessToken,
        response.refreshToken,
        email.trim()
      );

      Alert.alert('OK', 'Sesión iniciada correctamente');
      router.replace('/main');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error al iniciar sesión';

      Alert.alert('Error', message);
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
          {isLoading ? 'Cargando...' : t('login')}
        </ThemedText>
      </ThemedButton>
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