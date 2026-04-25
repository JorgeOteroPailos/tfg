import { StyleSheet } from 'react-native';
import ThemedView from '../components/ThemedView';
import ThemedText from '../components/ThemedText';
import ThemedButton from '../components/ThemedButton';

import { useAuth } from '../src/auth';
import { t } from 'i18next';

const Profile = () => {
  const { userId, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText title={true}>
        {t('profile')}
      </ThemedText>

      <ThemedView style={styles.infoContainer}>
        <ThemedText>
          {t('username')}: {userId ?? t('notAvailable')}
        </ThemedText>

        <ThemedText>
          {t('email')}: {userId ?? t('notAvailable')}
        </ThemedText>
      </ThemedView>

      <ThemedButton onPress={handleLogout}>
        <ThemedText>
          {t('logout')}
        </ThemedText>
      </ThemedButton>
    </ThemedView>
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