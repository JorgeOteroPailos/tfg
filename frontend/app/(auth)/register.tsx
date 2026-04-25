import { StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import ThemedView from '../../components/ThemedView';
import ThemedText from '../../components/ThemedText';
import ThemedButton from '../../components/ThemedButton';
import ThemedInput from '../../components/ThemedInput';
import { useTranslation } from 'react-i18next';

import { registerRequest } from '../../src/communication';
import { useAuth } from '../../src/auth';
import { Link, Redirect } from 'expo-router';

const Register = () => {
  const { t } = useTranslation();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Debes rellenar todos los campos');
      return;
    }

    try {
      setIsLoading(true);

      const response = await registerRequest({
        username: username.trim(),
        email: email.trim(),
        password,
      });

      await login(
        response.accessToken,
        response.refreshToken,
        email.trim()
      );

      Alert.alert('OK', 'Usuario registrado correctamente');
      return <Redirect href="/login" />;

    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error al registrarse';

      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText title={true}>
        {t('registerScreenDescription')}
      </ThemedText>

      <ThemedInput
        style={styles.input}
        placeholder={t('username')}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

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

      <ThemedButton onPress={handleRegister} disabled={isLoading}>
        <ThemedText>
          {isLoading ? t('loading') : t('register')}
        </ThemedText>
      </ThemedButton>

      <Link href="/(auth)/login">
        <ThemedText >
          {t('alreadyHaveAccount')}
        </ThemedText>
      </Link>

    </ThemedView>
  );
};

export default Register;

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