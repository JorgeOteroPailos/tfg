import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, FlatList, Alert } from 'react-native';
import ThemedView from '../../components/ThemedView';
import ThemedText from '../../components/ThemedText';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme';
import { Colors } from '../../constants/Colors';

interface Event {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  description?: string;
}

const CalendarScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

  const [events, setEvents] = useState<Event[]>([
    {
      id: '1',
      title: 'Reunión equipo',
      date: '2024-12-15',
      time: '10:00',
      description: 'Reunión semanal del equipo',
    },
    {
      id: '2',
      title: 'Presentación',
      date: '2024-12-18',
      time: '14:30',
      description: 'Presentación del proyecto',
    },
  ]);

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', time: '10:00' });

  // Obtener eventos del día seleccionado
  const todayEvents = events.filter(e => e.date === selectedDate);

  // Obtener próximos 30 días
  const getUpcoming = () => {
    const today = new Date(selectedDate);
    const upcoming = events.filter(e => {
      const eventDate = new Date(e.date);
      return eventDate >= today && eventDate <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    });
    return upcoming.sort((a, b) => a.date.localeCompare(b.date));
  };

  const handleAddEvent = () => {
    if (!newEvent.title.trim()) {
      Alert.alert('Error', 'Ingresa un título para el evento');
      return;
    }

    const event: Event = {
      id: Math.random().toString(),
      title: newEvent.title,
      date: selectedDate,
      time: newEvent.time,
    };

    setEvents([...events, event]);
    setNewEvent({ title: '', time: '10:00' });
    setShowAddForm(false);
    Alert.alert('Éxito', 'Evento creado');
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
    Alert.alert('Eliminado', 'Evento removido');
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.tabIconDefault }]}>
        <ThemedText style={styles.title}>{t('calendar')}</ThemedText>
      </View>

      {/* Date picker simple */}
      <View style={[styles.datePickerContainer, { backgroundColor: theme.tabBackground }]}>
        <ThemedText style={styles.selectedDateLabel}>
          {getDayName(selectedDate)}
        </ThemedText>
        <View style={styles.dateButtonsRow}>
          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: theme.tint }]}
            onPress={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
          >
            <ThemedText style={styles.dateButtonText}>← Anterior</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: theme.tint }]}
            onPress={() => setSelectedDate(new Date().toISOString().split('T')[0])}
          >
            <ThemedText style={styles.dateButtonText}>Hoy</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: theme.tint }]}
            onPress={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
          >
            <ThemedText style={styles.dateButtonText}>Siguiente →</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Events list for selected date */}
      <View style={styles.eventsSection}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Eventos hoy</ThemedText>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.tint }]}
            onPress={() => setShowAddForm(!showAddForm)}
          >
            <ThemedText style={styles.addButtonText}>+</ThemedText>
          </TouchableOpacity>
        </View>

        {showAddForm && (
          <View style={[styles.formContainer, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.formLabel}>Título:</ThemedText>
            <View
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.tabIconDefault,
                },
              ]}
            >
              <ThemedText
                onPress={() => {
                  // Simulado: en producción usarías TextInput
                  setNewEvent({ ...newEvent, title: 'Nuevo evento' });
                }}
              >
                {newEvent.title || 'Toca para escribir...'}
              </ThemedText>
            </View>

            <ThemedText style={styles.formLabel}>Hora:</ThemedText>
            <View style={[styles.timeInput, { backgroundColor: theme.background }]}>
              <ThemedText>{newEvent.time}</ThemedText>
            </View>

            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.formButton, { backgroundColor: theme.tint }]}
                onPress={handleAddEvent}
              >
                <ThemedText style={styles.formButtonText}>Guardar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formButton, { backgroundColor: theme.tabIconDefault }]}
                onPress={() => setShowAddForm(false)}
              >
                <ThemedText style={styles.formButtonText}>Cancelar</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {todayEvents.length === 0 ? (
          <ThemedText style={styles.emptyText}>No hay eventos para este día</ThemedText>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={todayEvents}
            keyExtractor={e => e.id}
            renderItem={({ item }) => (
              <View style={[styles.eventCard, { borderLeftColor: theme.tint }]}>
                <View style={styles.eventInfo}>
                  <ThemedText style={styles.eventTime}>{item.time}</ThemedText>
                  <ThemedText style={styles.eventTitle}>{item.title}</ThemedText>
                  {item.description && (
                    <ThemedText style={styles.eventDesc}>{item.description}</ThemedText>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteEvent(item.id)}
                  style={styles.deleteBtn}
                >
                  <ThemedText style={styles.deleteBtnText}>✕</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>

      {/* Upcoming events */}
      <View style={styles.upcomingSection}>
        <ThemedText style={styles.sectionTitle}>Próximos eventos</ThemedText>
        {getUpcoming().length === 0 ? (
          <ThemedText style={styles.emptyText}>No hay eventos próximos</ThemedText>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={getUpcoming().slice(0, 5)}
            keyExtractor={e => e.id}
            renderItem={({ item }) => (
              <View style={[styles.upcomingCard, { backgroundColor: theme.tabBackground }]}>
                <ThemedText style={styles.upcomingDate}>{item.date}</ThemedText>
                <ThemedText style={styles.upcomingTitle}>{item.title}</ThemedText>
                <ThemedText style={styles.upcomingTime}>{item.time}</ThemedText>
              </View>
            )}
          />
        )}
      </View>
    </ThemedView>
  );
};

export default CalendarScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  datePickerContainer: {
    padding: 16,
    margin: 12,
    borderRadius: 8,
  },
  selectedDateLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  dateButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  dateButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  eventsSection: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  formContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 12,
  },
  timeInput: {
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  formButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  formButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  eventCard: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  eventInfo: {
    flex: 1,
  },
  eventTime: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  eventTitle: {
    fontSize: 14,
    marginTop: 4,
  },
  eventDesc: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  deleteBtn: {
    justifyContent: 'center',
    paddingLeft: 12,
  },
  deleteBtnText: {
    fontSize: 18,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    paddingVertical: 20,
  },
  upcomingSection: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  upcomingCard: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 6,
  },
  upcomingDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  upcomingTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  upcomingTime: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
});