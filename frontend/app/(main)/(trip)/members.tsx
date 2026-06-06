import React, { useCallback } from 'react';
import { StyleSheet, View, FlatList, Pressable, ActivityIndicator, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useTrip } from '../../../src/trips';
import { useAuth } from '../../../src/auth';

const MembersScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, loading } = useTrip();
  const { userId: currentUserId } = useAuth();
  const requestCount = trip?.pendingRequests?.length ?? 0;

  const renderMemberItem = useCallback(
    ({ item }: { item: { id?: string; username: string } }) => {
      const initial = item.username.charAt(0).toUpperCase();
      const isMe = item.id === currentUserId;
      return (
        <View style={[styles.card, { backgroundColor: theme.tabBackground, borderColor: theme.border }]}>
          {/* left stripe */}
          <View style={[styles.stripe, { backgroundColor: theme.tint, opacity: isMe ? 1 : 0.4, boxShadow: isMe ? `0 0 8px ${theme.tint}` : undefined }]} />
          <View style={[styles.avatar, { backgroundColor: `${theme.tint}${isMe ? '28' : '12'}` }]}>
            <Text style={[styles.initial, { color: theme.tint, opacity: isMe ? 1 : 0.7 }]}>{initial}</Text>
          </View>
          <Text style={[styles.memberName, { color: theme.title }]} numberOfLines={1}>{item.username}</Text>
          {isMe && (
            <View style={[styles.meTag, { backgroundColor: `${theme.tint}20`, borderColor: `${theme.tint}40` }]}>
              <Text style={[styles.meTagText, { color: theme.tint }]}>{t('common.you').toUpperCase()}</Text>
            </View>
          )}
        </View>
      );
    },
    [theme, currentUserId, t]
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  if (!trip) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={trip.members ?? []}
        keyExtractor={item => item.id ?? ''}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Pressable
            style={({ pressed }) => [
              styles.requestsBtn,
              { backgroundColor: theme.tabBackground, borderColor: theme.border },
              pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => router.push({ pathname: '/join-requests', params: { tripId } })}
          >
            <View style={[styles.reqIcon, { backgroundColor: `${theme.tint}18` }]}>
              <Ionicons name="person-add-outline" size={20} color={theme.tint} />
            </View>
            <Text style={[styles.reqLabel, { color: theme.title }]}>{t('trip.requests')}</Text>
            {requestCount > 0 && (
              <View style={[styles.badge, { backgroundColor: Colors.warning, boxShadow: `0 0 10px ${Colors.warning}` }]}>
                <Text style={styles.badgeText}>{requestCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color={theme.icon} style={{ opacity: 0.4 }} />
          </Pressable>
        }
        renderItem={renderMemberItem}
        ListFooterComponent={
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: theme.tint, boxShadow: `0 0 28px ${theme.tint}55` },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => router.push({ pathname: '/add-member', params: { tripId: trip.id } })}
          >
            <Ionicons name="person-add-outline" size={20} color="#fff" />
            <Text style={styles.addBtnText}>{t('trip.addMember').toUpperCase()}</Text>
          </Pressable>
        }
      />
    </View>
  );
};

export default MembersScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10, paddingBottom: 28 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 15,
    paddingRight: 16,
    gap: 12,
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
  },
  stripe: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: { fontSize: 18, fontWeight: '800' },
  memberName: { flex: 1, fontSize: 15, fontWeight: '700' },
  meTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  meTagText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },

  requestsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginBottom: 4,
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
  },
  reqIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  reqLabel: { flex: 1, fontSize: 15, fontWeight: '700' },

  badge: { minWidth: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 17,
    borderRadius: 18,
    marginTop: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 2 },
});
