import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Pressable, FlatList, ActivityIndicator, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useCreateTripMutation } from '../../src/trips';
import { useFriendsQuery, useInviteFriendToTrip } from '../../src/friends';
import { components } from '../../src/generated/types';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSidebar } from '../../src/sidebar';
import ThemedText from '../../components/ThemedText';
import ThemedInput from '../../components/ThemedInput';
import UserAvatar from '../../components/UserAvatar';
import { AmbientBlobs, DotGrid } from '../../components/BackgroundTexture';

type UserProfile = components['schemas']['UserProfile'];

// ── FriendPickRow ─────────────────────────────────────────────────────────────

type FriendPickRowProps = { friend: UserProfile; selected: boolean; onToggle: (id: string) => void };

const FriendPickRow = React.memo(({ friend, selected, onToggle }: FriendPickRowProps) => {
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const handlePress = useCallback(() => onToggle(friend.id), [onToggle, friend.id]);

  return (
    <Pressable
      style={[
        styles.friendPickRow,
        { borderColor: selected ? theme.tint : theme.border, backgroundColor: selected ? `${theme.tint}15` : 'transparent' },
      ]}
      onPress={handlePress}
    >
      <UserAvatar
        userId={friend.id}
        initials={friend.username.slice(0, 2).toUpperCase()}
        size={32}
        hasAvatar={friend.hasAvatar}
        style={{ backgroundColor: `${theme.tint}30` }}
        textStyle={{ color: theme.tint }}
      />
      <Text style={[styles.friendPickName, { color: theme.title }]} numberOfLines={1}>{friend.username}</Text>
      <View style={[styles.friendCheckbox, { borderColor: selected ? theme.tint : theme.icon, backgroundColor: selected ? theme.tint : 'transparent' }]}>
        {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
    </Pressable>
  );
});

// ── CreateTripScreen ──────────────────────────────────────────────────────────

const CreateTripScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const isDark = themeName === 'dark';
  const { setOpen } = useSidebar();

  const [name, setName] = useState('');
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  const friendsQuery = useFriendsQuery();
  const inviteFriendToTrip = useInviteFriendToTrip();
  const createTripMutation = useCreateTripMutation();

  const friends = friendsQuery.data ?? [];

  const toggleFriend = useCallback((id: string) => {
    setSelectedFriendIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleCreateTrip = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      const trip = await createTripMutation.mutateAsync({ name: name.trim() });
      if (selectedFriendIds.size > 0) {
        await Promise.allSettled(
          [...selectedFriendIds].map(id => inviteFriendToTrip(id, trip.id))
        );
      }
      router.replace({ pathname: '/expenses', params: { tripId: trip.id } });
    } finally {
      setIsCreating(false);
    }
  };

  const renderFriendItem = useCallback(
    ({ item }: { item: UserProfile }) => (
      <FriendPickRow friend={item} selected={selectedFriendIds.has(item.id)} onToggle={toggleFriend} />
    ),
    [selectedFriendIds, toggleFriend],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {isDark && <DotGrid color="rgba(168,85,247,0.055)" />}
      <AmbientBlobs tint={theme.tint} secondary={Colors.secondary} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.navBackground, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={26} color={theme.title} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.title }]}>
          {t('trip.new')}
        </ThemedText>
        <Pressable onPress={() => setOpen(true)} style={styles.headerButton}>
          <ThemedText style={[styles.hamburger, { color: theme.title }]}>☰</ThemedText>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.heroTop}>
          <View style={[styles.heroIcon, { backgroundColor: `${theme.tint}20`, borderColor: `${theme.tint}40` }]}>
            <Ionicons name="airplane-outline" size={28} color={theme.tint} />
          </View>
        </View>

        <ThemedInput
          style={{ borderColor: theme.tint, borderWidth: 1.5 }}
          placeholder={t('trip.tripName')}
          value={name}
          onChangeText={setName}
          autoFocus
          onSubmitEditing={handleCreateTrip}
        />

        <View style={[styles.dropdown, { borderColor: friendsOpen ? theme.tint : theme.border, backgroundColor: friendsOpen ? `${theme.tint}08` : 'transparent' }]}>
          <Pressable style={styles.dropdownToggle} onPress={() => setFriendsOpen(o => !o)}>
            <MaterialCommunityIcons name="account-multiple-plus-outline" size={18} color={theme.tint} />
            <Text style={[styles.dropdownLabel, { color: theme.text }]} numberOfLines={1}>
              {t('friends.inviteFriends')}
            </Text>
            {!friendsOpen && selectedFriendIds.size > 0 && (
              <View style={[styles.dropdownBadge, { backgroundColor: theme.tint }]}>
                <Text style={styles.dropdownBadgeText}>{selectedFriendIds.size}</Text>
              </View>
            )}
            <Ionicons name={friendsOpen ? 'chevron-up' : 'chevron-down'} size={15} color={theme.icon} />
          </Pressable>
          {friendsOpen && (
            friends.length === 0 ? (
              <Text style={[styles.dropdownEmpty, { color: theme.icon }]}>{t('friends.noFriends')}</Text>
            ) : (
              <FlatList
                style={styles.friendsList}
                data={friends}
                keyExtractor={f => f.id}
                showsVerticalScrollIndicator={false}
                renderItem={renderFriendItem}
              />
            )
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.createBtn, { backgroundColor: theme.tint, boxShadow: `0 0 20px ${theme.tint}55` }]}
            onPress={handleCreateTrip}
            disabled={isCreating || !name.trim()}
          >
            {isCreating
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={[styles.createBtnText, { color: '#fff' }]}>{t('common.create').toUpperCase()}</Text>
            }
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default CreateTripScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
  },
  headerButton: { width: 40, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  hamburger: { fontSize: 22 },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 28, gap: 16 },
  heroTop: { alignItems: 'center', marginBottom: 4 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  actions: { marginTop: 4 },
  createBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  createBtnText: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },

  dropdown: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  dropdownToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  dropdownBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  dropdownBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  dropdownEmpty: { paddingHorizontal: 14, paddingBottom: 12, fontSize: 13, opacity: 0.55 },
  friendsList: { maxHeight: 280, paddingHorizontal: 8, paddingBottom: 8 },

  friendPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  friendPickName: { flex: 1, fontSize: 14, fontWeight: '600' },
  friendCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
