import { StyleSheet, Alert, Text, View, Pressable } from 'react-native';
import { useState, useReducer } from 'react';
import ThemedInput from '../../components/ThemedInput';
import ThemedButton from '../../components/ThemedButton';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../src/auth';
import { Link, useRouter } from 'expo-router';
import { AppError, ErrorCode } from '../../src/AppError';
import { Ionicons } from '@expo/vector-icons';
import { DotGrid } from '../../components/BackgroundTexture';

type FormState = { username: string; email: string; password: string; confirmPassword: string };
function formReducer(state: FormState, action: { field: keyof FormState; value: string }): FormState {
  return { ...state, [action.field]: action.value };
}

const Register = () => {
  const { t } = useTranslation();
  const { register } = useAuth();
  const router = useRouter();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const isDark = themeName === 'dark';

  const [form, formDispatch] = useReducer(formReducer, { username: '', email: '', password: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);

  const ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
    [ErrorCode.BAD_REQUEST]: t('auth.register.errors.invalidData'),
    [ErrorCode.SESSION_SAVE_ERROR]: t('errors.session'),
    [ErrorCode.SERVER_ERROR]: t('errors.server'),
    [ErrorCode.CONFLICT]: t('auth.register.errors.emailAlreadyInUse'),
  };

  const handleRegister = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.password.trim() || !form.confirmPassword.trim()) {
      Alert.alert(t('common.error'), t('auth.register.errors.allFieldsRequired'));
      return;
    }
    if (form.password !== form.confirmPassword) {
      Alert.alert(t('common.error'), t('auth.register.errors.passwordsDoNotMatch'));
      return;
    }
    try {
      setIsLoading(true);
      await register(form.username.trim(), form.email.trim(), form.password);
      router.replace('/main');
    } catch (error) {
      const code = error instanceof AppError ? error.code : ErrorCode.SERVER_ERROR;
      const message = ERROR_MESSAGES[code] ?? t('auth.register.errors.registration');
      Alert.alert(t('common.error'), message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isDark && <DotGrid />}

      {/* Decorative rings */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.ring1, { borderColor: `${theme.tint}22` }]} />
        <View style={[styles.ring2, { borderColor: `${theme.tint}14` }]} />
        <View style={[styles.ring3, { borderColor: `${theme.tint}09` }]} />
      </View>

      {/* Brand */}
      <View style={styles.brand}>
        <View style={[styles.logoOuter, { borderColor: `${theme.tint}40` }]}>
          <View style={[styles.logoInner, { borderColor: `${theme.tint}70`, backgroundColor: `${theme.tint}14` }]}>
            <Ionicons name="airplane" size={34} color={theme.tint} />
          </View>
        </View>
        <Text style={[styles.appName, { color: theme.title }]}>TELARIA</Text>
        <Text style={[styles.appTagline, { color: theme.icon }]}>
          {t('auth.register.description')}
        </Text>
      </View>

      {/* Form card */}
      <View style={[styles.card, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
        <ThemedInput
          placeholder={t('auth.register.username')}
          value={form.username}
          onChangeText={value => formDispatch({ field: 'username', value })}
          autoCapitalize="none"
        />
        <ThemedInput
          placeholder={t('auth.register.email')}
          value={form.email}
          onChangeText={value => formDispatch({ field: 'email', value })}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <ThemedInput
          placeholder={t('auth.register.password')}
          value={form.password}
          onChangeText={value => formDispatch({ field: 'password', value })}
          secureTextEntry
          autoCapitalize="none"
        />
        <ThemedInput
          placeholder={t('auth.register.confirmPassword')}
          value={form.confirmPassword}
          onChangeText={value => formDispatch({ field: 'confirmPassword', value })}
          secureTextEntry
          autoCapitalize="none"
        />

        <ThemedButton onPress={handleRegister} disabled={isLoading} style={styles.btn}>
          <Text style={styles.btnText}>
            {isLoading ? t('common.loading') : t('auth.register.button').toUpperCase()}
          </Text>
        </ThemedButton>
      </View>

      {/* Switch */}
      <Link href="/(auth)/login" asChild>
        <Pressable style={styles.switchRow}>
          <Text style={[styles.switchText, { color: theme.icon }]}>
            {t('auth.register.alreadyHaveAccount')}{' '}
          </Text>
          <Text style={[styles.switchBold, { color: theme.tint }]}>
            {t('auth.login.button')}
          </Text>
        </Pressable>
      </Link>
    </View>
  );
};

export default Register;

const RING_TOP = -100;
const RING_LEFT = -80;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 24,
    overflow: 'hidden',
  },
  ring1: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    borderWidth: 1,
    top: RING_TOP,
    left: RING_LEFT,
  },
  ring2: {
    position: 'absolute',
    width: 480,
    height: 480,
    borderRadius: 240,
    borderWidth: 1,
    top: RING_TOP - 60,
    left: RING_LEFT - 60,
  },
  ring3: {
    position: 'absolute',
    width: 620,
    height: 620,
    borderRadius: 310,
    borderWidth: 1,
    top: RING_TOP - 130,
    left: RING_LEFT - 130,
  },
  brand: {
    alignItems: 'center',
    gap: 12,
  },
  logoOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appName: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 8,
  },
  appTagline: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
    textAlign: 'center',
    opacity: 0.7,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    boxShadow: '0 0 40px rgba(168,85,247,0.12), 0 8px 24px rgba(0,0,0,0.3)',
  },
  btn: {
    marginTop: 4,
    marginVertical: 0,
    boxShadow: '0 0 24px rgba(168,85,247,0.45)',
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchText: {
    fontSize: 13,
    fontWeight: '500',
  },
  switchBold: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
