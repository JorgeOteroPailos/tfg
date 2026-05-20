import React from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useTrip } from '../../../src/trips';
import ThemedText from '../../../components/ThemedText';

const MembersScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip, loading } = useTrip();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (!trip) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={trip.members ?? []}
        keyExtractor={item => item.id ?? ''}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.memberCard, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.memberName}>{item.username}</ThemedText>
          </View>
        )}
        ListFooterComponent={
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.tint }]}
            onPress={() => {/* TODO: escáner QR */}}
          >
            <ThemedText style={styles.addButtonText}>+ {t('trip.addMember')}</ThemedText>
          </TouchableOpacity>
        }
      />
    </View>
  );
};

export default MembersScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    gap: 10,
    paddingBottom: 20,
  },
  memberCard: {
    padding: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
  },
  addButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});