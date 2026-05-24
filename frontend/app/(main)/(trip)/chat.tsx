import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../../../components/ThemedText';

const ChatScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

  return (
    <View style={styles.container}>
      <Ionicons name="chatbubble-outline" size={64} color={theme.icon} style={styles.icon} />
      <ThemedText style={styles.title}>{t('trip.chat')}</ThemedText>
      <ThemedText style={styles.subtitle}>{t('common.notAvailable')}</ThemedText>
    </View>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    opacity: 0.4,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 15,
    opacity: 0.5,
  },
});
