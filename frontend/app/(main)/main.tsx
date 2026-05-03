import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, FlatList } from 'react-native';
import { Link, router } from 'expo-router';
import ThemedView from '../../components/ThemedView';
import ThemedText from '../../components/ThemedText';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../src/auth';

interface Trip {
  id: string;
  name: string;
  icon: string;
}

const Main = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([
    { id: '1', name: 'España', icon: '🗺️' },
    { id: '2', name: 'Playa', icon: '🏖️' },
    { id: '3', name: 'Montaña', icon: '🏔️' },
  ]);

  const handleCreateTrip = () => {
    // TODO: Abrir modal para crear nuevo viaje
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.navBackground }]}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setSidebarOpen(!sidebarOpen)}
        >
          <ThemedText style={styles.menuIcon}>☰</ThemedText>
        </TouchableOpacity>

        <ThemedText style={styles.headerTitle}>{t('home')}</ThemedText>

        <View style={styles.headerSpacer} />
      </View>

      {/* Sidebar */}
      {sidebarOpen && (
        <View style={[styles.sidebar, { backgroundColor: theme.tabBackground }]}>
          <Link href="/profile" asChild>
            <TouchableOpacity
              style={styles.sidebarItem}
              onPress={() => setSidebarOpen(false)}
            >
              <ThemedText style={styles.sidebarItemText}>👤 {t('profile')}</ThemedText>
            </TouchableOpacity>
          </Link>

          <Link href="/settings" asChild>
            <TouchableOpacity
              style={styles.sidebarItem}
              onPress={() => setSidebarOpen(false)}
            >
              <ThemedText style={styles.sidebarItemText}>⚙️ {t('settings')}</ThemedText>
            </TouchableOpacity>
          </Link>

          <Link href="/calendar" asChild>
            <TouchableOpacity
              style={styles.sidebarItem}
              onPress={() => setSidebarOpen(false)}
            >
              <ThemedText style={styles.sidebarItemText}>📅 {t('calendar')}</ThemedText>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity
            style={[styles.sidebarItem, styles.logoutItem]}
            onPress={() => {
              setSidebarOpen(false);
              handleLogout();
            }}
          >
            <ThemedText style={[styles.sidebarItemText, { color: '#cc475a' }]}>
              🚪 Cerrar sesión
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        {/* New Trip Card */}
        <TouchableOpacity
          style={[styles.tripCard, styles.newTripCard, { backgroundColor: theme.tint }]}
          onPress={handleCreateTrip}
        >
          <ThemedText style={styles.newTripTitle}>Nuevo viaje</ThemedText>
          <View style={styles.newTripButton}>
            <ThemedText style={styles.newTripButtonText}>+</ThemedText>
          </View>
        </TouchableOpacity>

        {/* Trips List */}
        <FlatList
          data={trips}
          keyExtractor={item => item.id}
          scrollEnabled={true}
          contentContainerStyle={styles.tripsList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.tripCard, { backgroundColor: theme.tabBackground }]}
              onPress={() => {
                // TODO: Navegar a detalles del viaje
              }}
            >
              <View style={styles.tripContent}>
                <ThemedText style={styles.tripIcon}>{item.icon}</ThemedText>
                <ThemedText style={styles.tripName}>{item.name}</ThemedText>
              </View>
              <ThemedText style={styles.tripArrow}>→</ThemedText>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Overlay para cerrar sidebar al clickear fuera */}
      {sidebarOpen && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setSidebarOpen(false)}
        />
      )}
    </ThemedView>
  );
};

export default Main;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  menuButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  menuIcon: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  sidebar: {
    position: 'absolute',
    top: 60,
    left: 0,
    width: 220,
    zIndex: 100,
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  sidebarItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sidebarItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderRadius: 12,
  },
  newTripCard: {
    justifyContent: 'space-between',
    minHeight: 60,
  },
  newTripTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  newTripButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newTripButtonText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  tripsList: {
    paddingBottom: 20,
  },
  tripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tripIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '500',
  },
  tripArrow: {
    fontSize: 20,
    marginLeft: 12,
    opacity: 0.6,
  },
});