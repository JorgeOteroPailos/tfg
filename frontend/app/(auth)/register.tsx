import { StyleSheet, Alert, Text, View } from 'react-native';
import { useState } from 'react';
import ThemedText from '../../components/ThemedText';
import ThemedButton from '../../components/ThemedButton';
import ThemedInput from '../../components/ThemedInput';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../src/auth';
import { Link, useRouter } from 'expo-router';
import { AppError, ErrorCode } from '../../src/AppError';
import { Colors } from '../../constants/Colors';

const Register = () => {
  const { t } = useTranslation();
  const { register } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
    [ErrorCode.BAD_REQUEST]: t('invalidRegisterData'),
    [ErrorCode.SESSION_SAVE_ERROR]: t('errorSavingSession'),
    [ErrorCode.SERVER_ERROR]: t('serverError'),
    [ErrorCode.CONFLICT]: t('emailAlreadyInUse'),
  };

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      Alert.alert(t('error'), t('allFieldsRequired'));
      return;
    }

    try {
      setIsLoading(true);

      await register(username.trim(), email.trim(), password);

      router.replace('/main');
    } catch (error) {
      const code = error instanceof AppError ? error.code : ErrorCode.SERVER_ERROR;
      const message = ERROR_MESSAGES[code] ?? t('registrationError');
      Alert.alert(t('error'), message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
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
        <Text style={{ color: Colors.dark.title }}>
          {isLoading ? t('loading') : t('register')}
        </Text>
      </ThemedButton>

      <Link href="/(auth)/login">
        <ThemedText>
          {t('alreadyHaveAccount')}
        </ThemedText>
      </Link>

    </View>
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