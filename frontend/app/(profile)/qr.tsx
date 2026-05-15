import { Alert, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ThemedText from '../../components/ThemedText';
import { useAuth } from '../../src/auth';
import { t } from 'i18next';
import { router } from 'expo-router';
import { useEffect } from 'react';

const decodeJWT = (token: string) => {
  const payload = token.split('.')[1];
  return JSON.parse(atob(payload));
};



const QRScreen = () => {
  const { accessToken } = useAuth();
  useEffect(() => {
    if (!accessToken) {
        Alert.alert(t('error'), 'Error inesperado: No se encontró el token de acceso. Por favor, inicia sesión nuevamente.');
        router.replace('/main');
    }
  }, [accessToken]);

if (!accessToken) return null;

  const userId = decodeJWT(accessToken).sub; // o el campo que use tu back

  return (
    <View style={styles.container}>
      <ThemedText title={true}>{t('yourQR')}</ThemedText>
      <QRCode value={userId} size={220} />
      <ThemedText>{t('qrHint')}</ThemedText>
    </View>
  );
};

export default QRScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
  },
});