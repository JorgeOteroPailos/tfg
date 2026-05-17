import { StyleSheet, View } from 'react-native';
import ThemedText from '../../../components/ThemedText';
import ThemedButton from '../../../components/ThemedButton';
import { useAuth } from '../../../src/auth';
import { t } from 'i18next';
import { router } from 'expo-router';

const Profile = () => {
  const { userEmail, username, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <ThemedText title={true}>
        {t('profile.title')}
      </ThemedText>

      <View style={styles.infoContainer}>
        <ThemedText>
          {t('profile.username')}: {username ?? t('common.notAvailable')}
        </ThemedText>

        <ThemedText>
          {t('profile.email')}: {userEmail ?? t('common.notAvailable')}
        </ThemedText>
      </View>

      <ThemedButton onPress={() => router.push('/(profile)/qr')}>
        <ThemedText>{t('profile.showQR')}</ThemedText>
      </ThemedButton>

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
});