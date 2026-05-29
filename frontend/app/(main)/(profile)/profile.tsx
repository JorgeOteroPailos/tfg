import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ThemedText from '../../../components/ThemedText';
import ThemedButton from '../../../components/ThemedButton';
import { useAuth } from '../../../src/auth';
import { t } from 'i18next';
import { router } from 'expo-router';

const decodeJWT = (token: string) => {
  const payload = token.split('.')[1];
  return JSON.parse(atob(payload));
};

const Profile = () => {
  const { userEmail, username, logout, accessToken } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const userId = accessToken ? decodeJWT(accessToken).sub : null;

  return (
    <View style={styles.container}>
      {userId && (
        <View style={styles.qrContainer}>
          <ThemedText title={true}>{t('profile.qrTitle')}</ThemedText>
          <QRCode value={userId} size={200} />
          <ThemedText style={styles.qrHint}>{t('profile.qrHint')}</ThemedText>
        </View>
      )}

      <View style={styles.infoContainer}>
        <ThemedText>
          {t('profile.username')}: {username ?? t('common.notAvailable')}
        </ThemedText>

        <ThemedText>
          {t('profile.email')}: {userEmail ?? t('common.notAvailable')}
        </ThemedText>
      </View>

      

      <ThemedButton onPress={handleLogout}>
        <ThemedText>{t('profile.logout')}</ThemedText>
      </ThemedButton>
    </View>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    gap: 30,
  },
  infoContainer: {
    gap: 15,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  qrContainer: {
    alignItems: 'center',
    gap: 16,
  },
  qrHint: {
    textAlign: 'center',
    opacity: 0.7,
  },
});
