import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet, View, FlatList, ActivityIndicator,
  Pressable, Modal, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from 'expo-router';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useEvents, type EventSummary } from '../../../src/events';
import { useTrip } from '../../../src/trips';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../../../components/ThemedText';
import ThemedInput from '../../../components/ThemedInput';

type Tab = 'calendar' | 'list';

const WEEK_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function firstWeekday(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function buildGrid(year: number, month: number): (number | null)[] {
  const offset = firstWeekday(year, month);
  const days = daysInMonth(year, month);
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const EMPTY_EVENT_DOTS: Record<string, number> = {};

// ── Mini calendar used in both the main view and the create modal ──────────────
type MiniCalProps = {
  year: number;
  month: number;
  selectedKey: string | null;
  eventDots?: Record<string, number>;  // dateKey → count, optional
  tint: string;
  todayKey: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayPress: (day: number) => void;
};
const MiniCal = ({
  year, month, selectedKey, eventDots = EMPTY_EVENT_DOTS, tint, todayKey,
  onPrevMonth, onNextMonth, onDayPress,
}: MiniCalProps) => {
  const isThisMonth = todayKey.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);
  const grid = useMemo(() => buildGrid(year, month), [year, month]);

  return (
    <View>
      <View style={cal.header}>
        <Pressable onPress={onPrevMonth} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={tint} />
        </Pressable>
        <ThemedText style={cal.title}>{MONTH_NAMES[month]} {year}</ThemedText>
        <Pressable onPress={onNextMonth} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color={tint} />
        </Pressable>
      </View>

      <View style={cal.weekRow}>
        {WEEK_DAYS.map(d => (
          <ThemedText key={d} style={cal.weekLabel}>{d}</ThemedText>
        ))}
      </View>

      <View style={cal.grid}>
        {grid.map((day, idx) => {
          if (day === null) return <View key={`p-${idx}`} style={cal.cell} />;
          const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = isThisMonth && todayKey === k;
          const isSel = selectedKey === k;
          const dots = Math.min(eventDots[k] ?? 0, 3);
          return (
            <Pressable
              key={k}
              style={({ pressed }) => [cal.cell, isSel && { backgroundColor: tint, borderRadius: 8 }, { opacity: pressed ? 0.6 : 1 }]}
              onPress={() => onDayPress(day)}
            >
              <ThemedText style={[
                cal.dayNum,
                isToday && !isSel && { color: tint, fontWeight: '700' },
                isSel && { color: 'white', fontWeight: '700' },
              ]}>
                {day}
              </ThemedText>
              {dots > 0 && (
                <View style={cal.dotRow}>
                  {Array.from({ length: dots }).map((_, di) => (
                    <View key={di} style={[cal.dot, { backgroundColor: isSel ? 'white' : tint }]} />
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// ── Time picker ────────────────────────────────────────────────────────────────
type TimePickerProps = { hour: number; minute: number; tint: string; onChange: (h: number, m: number) => void };
const TimePicker = ({ hour, minute, tint, onChange }: TimePickerProps) => {
  const adj = (unit: 'h' | 'm', delta: number) => {
    if (unit === 'h') onChange((hour + delta + 24) % 24, minute);
    else onChange(hour, (minute + delta + 60) % 60);
  };
  return (
    <View style={tp.row}>
      {/* Hour */}
      <View style={tp.unit}>
        <Pressable style={[tp.btn, { borderColor: tint }]} onPress={() => adj('h', 1)}>
          <Ionicons name="chevron-up" size={16} color={tint} />
        </Pressable>
        <ThemedText style={tp.value}>{String(hour).padStart(2, '0')}</ThemedText>
        <Pressable style={[tp.btn, { borderColor: tint }]} onPress={() => adj('h', -1)}>
          <Ionicons name="chevron-down" size={16} color={tint} />
        </Pressable>
      </View>
      <ThemedText style={tp.colon}>:</ThemedText>
      {/* Minute */}
      <View style={tp.unit}>
        <Pressable style={[tp.btn, { borderColor: tint }]} onPress={() => adj('m', 5)}>
          <Ionicons name="chevron-up" size={16} color={tint} />
        </Pressable>
        <ThemedText style={tp.value}>{String(minute).padStart(2, '0')}</ThemedText>
        <Pressable style={[tp.btn, { borderColor: tint }]} onPress={() => adj('m', -5)}>
          <Ionicons name="chevron-down" size={16} color={tint} />
        </Pressable>
      </View>
    </View>
  );
};

// ── EventCard ─────────────────────────────────────────────────────────────────
type EventCardProps = {
  ev: EventSummary;
  showDate?: boolean;
  theme: typeof Colors.light;
  formatTime: (iso: string) => string;
  formatDateTime: (iso: string) => string;
  formatDuration: (mins: number) => string;
  onPress: (ev: EventSummary) => void;
};

const EventCard = ({ ev, showDate = false, theme, formatTime, formatDateTime, formatDuration, onPress }: EventCardProps) => (
  <Pressable
    style={({ pressed }) => [styles.eventCard, { backgroundColor: theme.tabBackground }, { opacity: pressed ? 0.75 : 1 }]}
    onPress={() => onPress(ev)}
  >
    <View style={styles.eventLeft}>
      <ThemedText style={styles.eventName}>{ev.name}</ThemedText>
      {ev.startTime && (
        <ThemedText style={styles.eventMeta}>
          {showDate ? formatDateTime(ev.startTime) : formatTime(ev.startTime)}
        </ThemedText>
      )}
      {ev.location?.name && (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={theme.icon} />
          <ThemedText style={styles.locationText}>{ev.location.name}</ThemedText>
        </View>
      )}
    </View>
    <View style={styles.eventRight}>
      <ThemedText style={styles.eventDuration}>{formatDuration(ev.duration)}</ThemedText>
      <Ionicons name="chevron-forward" size={18} color={theme.icon} />
    </View>
  </Pressable>
);

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}
function formatDateTime(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function formatDuration(mins: number) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ── Main screen ────────────────────────────────────────────────────────────────
const EventsScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip } = useTrip();
  const { getEvents, addEvent, deleteEvent } = useEvents();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<Tab>('calendar');

  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => dateKey(today), [today]);

  // Main calendar nav
  const [calYear, setCalYear] = useState(() => today.getFullYear());
  const [calMonth, setCalMonth] = useState(() => today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);

  // Detail modal
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Create modal
  const [createVisible, setCreateVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [evName, setEvName] = useState('');
  const [duration, setDuration] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  // Date/time picker state
  const [pickedDate, setPickedDate] = useState<string | null>(null); // dateKey
  const [pickHour, setPickHour] = useState(12);
  const [pickMinute, setPickMinute] = useState(0);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(() => today.getMonth());

  useEffect(() => {
    if (trip?.name) navigation.setOptions({ title: trip.name });
  }, [trip?.name, navigation]);

  useEffect(() => {
    if (!trip?.id || events !== null) return;
    (async () => {
      setLoading(true);
      try {
        setEvents(await getEvents(trip.id!));
      } catch {
        setError(t('trip.unableLoadEvents'));
      } finally {
        setLoading(false);
      }
    })();
  }, [trip?.id, events, getEvents, t]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, EventSummary[]> = {};
    for (const ev of events ?? []) {
      if (!ev.startTime) continue;
      const k = dateKey(new Date(ev.startTime));
      (map[k] ??= []).push(ev);
    }
    // Sort within each day
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.startTime!.localeCompare(b.startTime!));
    }
    return map;
  }, [events]);

  // All days with events, re-ordered to start from selectedKey
  const agendaDays = useMemo(() => {
    const all = Object.keys(eventsByDay).sort();
    const after = all.filter(d => d >= selectedKey);
    const before = all.filter(d => d < selectedKey).reverse();
    return [...after, ...before];
  }, [eventsByDay, selectedKey]);

  const unscheduled = useMemo(() => (events ?? []).filter(e => !e.startTime), [events]);

  const prevMainMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMainMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  const handleDayPress = (day: number) => {
    const k = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedKey(k);
  };

  const formatSectionDate = (k: string) => {
    const tomorrow = dateKey(new Date(today.getTime() + 86_400_000));
    if (k === todayKey) return t('trip.today');
    if (k === tomorrow) return t('trip.tomorrow');
    const d = new Date(k + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };


  const handleCreate = async () => {
    if (!trip?.id) return;
    if (!evName.trim()) { setCreateError(t('trip.fillAllRequiredFields')); return; }
    setCreating(true);
    setCreateError(null);
    try {
      const payload: Parameters<typeof addEvent>[1] = { name: evName.trim() };
      if (pickedDate) {
        const d = new Date(`${pickedDate}T00:00:00`);
        d.setHours(pickHour, pickMinute, 0, 0);
        payload.startTime = d.toISOString();
      }
      if (duration.trim()) payload.duration = Number(duration);
      if (locationName.trim() || locationAddress.trim()) {
        payload.location = {};
        if (locationName.trim()) payload.location.name = locationName.trim();
        if (locationAddress.trim()) payload.location.address = locationAddress.trim();
      }
      const newEvent = await addEvent(trip.id, payload);
      setEvents(prev => prev ? [newEvent, ...prev] : [newEvent]);
      resetCreate();
    } catch {
      setCreateError(t('trip.createEventError'));
    } finally {
      setCreating(false);
    }
  };

  const resetCreate = () => {
    setCreateVisible(false);
    setCreateError(null);
    setEvName(''); setDuration(''); setLocationName(''); setLocationAddress('');
    setPickedDate(null); setPickHour(12); setPickMinute(0);
    setDatePickerOpen(false);
  };

  const handleEventPress = useCallback((ev: EventSummary) => {
    setSelectedEvent(ev);
    setDeleteError(null);
    setDetailVisible(true);
  }, []);

  const renderEventCard = useCallback(({ item }: { item: EventSummary }) => (
    <EventCard
      ev={item}
      showDate
      theme={theme}
      formatTime={formatTime}
      formatDateTime={formatDateTime}
      formatDuration={formatDuration}
      onPress={handleEventPress}
    />
  ), [theme, handleEventPress]);

  const handleDelete = async () => {
    if (!trip?.id || !selectedEvent) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteEvent(trip.id, selectedEvent.id);
      setEvents(prev => prev ? prev.filter(e => e.id !== selectedEvent.id) : prev);
      setDetailVisible(false);
    } catch {
      setDeleteError(t('trip.deleteEventError'));
    } finally {
      setDeleting(false);
    }
  };

  

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.tabBackground }]}>
        {(['calendar', 'list'] as Tab[]).map(tab => (
          <Pressable
            key={tab}
            style={[styles.tabPill, activeTab === tab && { backgroundColor: theme.tint }]}
            onPress={() => setActiveTab(tab)}
          >
            <ThemedText style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {t(tab === 'calendar' ? 'trip.events' : 'trip.eventList')}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.tint} style={styles.centered} />
      ) : error ? (
        <ThemedText style={styles.emptyText}>{error}</ThemedText>
      ) : (
        <>
          {/* ── Calendar tab ── */}
          {activeTab === 'calendar' && (
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
              <MiniCal
                year={calYear}
                month={calMonth}
                selectedKey={selectedKey}
                eventDots={Object.fromEntries(Object.entries(eventsByDay).map(([k, v]) => [k, v.length]))}
                tint={theme.tint}
                todayKey={todayKey}
                onPrevMonth={prevMainMonth}
                onNextMonth={nextMainMonth}
                onDayPress={handleDayPress}
              />

              {/* Agenda list */}
              <View style={styles.agenda}>
                {agendaDays.length === 0 && unscheduled.length === 0 ? (
                  <ThemedText style={styles.emptyText}>{t('trip.noEvents')}</ThemedText>
                ) : (
                  <>
                    {agendaDays.map(k => (
                      <View key={k}>
                        <View style={[styles.agendaDayHeader, k === selectedKey && { borderLeftColor: theme.tint, borderLeftWidth: 3 }]}>
                          <ThemedText style={[styles.agendaDayText, k === selectedKey && { color: theme.tint }]}>
                            {formatSectionDate(k)}
                          </ThemedText>
                        </View>
                        <View style={{ gap: 8 }}>
                          {eventsByDay[k].map(ev => <EventCard
                            key={ev.id}
                            ev={ev}
                            theme={theme}
                            formatTime={formatTime}
                            formatDateTime={formatDateTime}
                            formatDuration={formatDuration}
                            onPress={(ev) => { setSelectedEvent(ev); setDeleteError(null); setDetailVisible(true); }}
                          />)}
                        </View>
                      </View>
                    ))}
                    {unscheduled.length > 0 && (
                      <View>
                        <View style={styles.agendaDayHeader}>
                          <ThemedText style={styles.agendaDayText}>{t('trip.unscheduled')}</ThemedText>
                        </View>
                        <View style={{ gap: 8 }}>
                          {unscheduled.map(ev => <EventCard
                            key={ev.id}
                            ev={ev}
                            theme={theme}
                            formatTime={formatTime}
                            formatDateTime={formatDateTime}
                            formatDuration={formatDuration}
                            onPress={(ev) => { setSelectedEvent(ev); setDeleteError(null); setDetailVisible(true); }}
                          />
                          )}
                        </View>
                      </View>
                    )}
                  </>
                )}
              </View>
            </ScrollView>
          )}

          {/* ── List tab ── */}
          {activeTab === 'list' && (
            <FlatList
              data={events ?? []}
              keyExtractor={(item, i) => item.id ?? `${i}`}
              contentContainerStyle={styles.list}
              ListEmptyComponent={<ThemedText style={styles.emptyText}>{t('trip.noEvents')}</ThemedText>}
              renderItem={renderEventCard}
            />
          )}
        </>
      )}

      {/* FAB */}
      {!loading && !error && (
        <Pressable
          style={[styles.fab, { backgroundColor: theme.tint }]}
          onPress={() => setCreateVisible(true)}
        >
          <Ionicons name="add" size={28} color="white" />
        </Pressable>
      )}

      {/* ── Detail modal ── */}
      <Modal visible={detailVisible} transparent animationType="fade" onRequestClose={() => setDetailVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setDetailVisible(false)}>
          <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
            <ThemedText style={styles.modalTitle}>{t('trip.eventDetail')}</ThemedText>

            {selectedEvent && (
              <>
                <ThemedText style={styles.detailName}>{selectedEvent.name}</ThemedText>
                {selectedEvent.startTime && (
                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>{t('trip.startTime')}</ThemedText>
                    <ThemedText style={styles.detailValue}>{formatDateTime(selectedEvent.startTime)}</ThemedText>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>{t('trip.duration')}</ThemedText>
                  <ThemedText style={styles.detailValue}>{formatDuration(selectedEvent.duration)}</ThemedText>
                </View>
                {selectedEvent.location && (
                  <>
                    <ThemedText style={[styles.detailLabel, { marginTop: 12, marginBottom: 6 }]}>{t('trip.location')}</ThemedText>
                    {selectedEvent.location.name && <ThemedText style={styles.locationDetail}>· {selectedEvent.location.name}</ThemedText>}
                    {selectedEvent.location.address && <ThemedText style={styles.locationDetail}>· {selectedEvent.location.address}</ThemedText>}
                    {selectedEvent.location.mapURL && (
                      <ThemedText style={[styles.locationDetail, { color: theme.tint }]}>{selectedEvent.location.mapURL}</ThemedText>
                    )}
                  </>
                )}
              </>
            )}

            {deleteError && <ThemedText style={styles.errorText}>{deleteError}</ThemedText>}

            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalBtn, styles.deleteBtn]} onPress={handleDelete} disabled={deleting}>
                {deleting
                  ? <ActivityIndicator color="white" />
                  : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.delete')}</ThemedText>}
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.tint }]} onPress={() => setDetailVisible(false)}>
                <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.close')}</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Create modal ── */}
      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={resetCreate}>
        <View style={styles.overlay}>
          <ScrollView
            style={{ width: '100%' }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
              <View style={styles.modalTitleRow}>
                <ThemedText style={styles.modalTitle}>{t('trip.newEvent')}</ThemedText>
                <Pressable onPress={resetCreate} hitSlop={8}>
                  <Ionicons name="close" size={22} color={theme.icon} />
                </Pressable>
              </View>

              {/* Name */}
              <ThemedInput
                style={[styles.input, { color: theme.text, borderColor: theme.tint }]}
                placeholder={t('trip.eventName')}
                placeholderTextColor={theme.icon}
                value={evName}
                onChangeText={setEvName}
                autoFocus
              />

              {/* Date selector */}
              <Pressable
                style={[styles.dateBtn, { borderColor: theme.tint }]}
                onPress={() => setDatePickerOpen(o => !o)}
              >
                <Ionicons name="calendar-outline" size={18} color={theme.tint} />
                <ThemedText style={{ flex: 1, marginLeft: 8 }}>
                  {pickedDate ? formatSectionDate(pickedDate) : t('trip.chooseDate')}
                </ThemedText>
                <Ionicons name={datePickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={theme.icon} />
              </Pressable>

              {datePickerOpen && (
                <View style={[styles.calPickerBox, { borderColor: theme.tint + '40' }]}>
                  <MiniCal
                    year={pickerYear}
                    month={pickerMonth}
                    selectedKey={pickedDate}
                    tint={theme.tint}
                    todayKey={todayKey}
                    onPrevMonth={() => {
                      if (pickerMonth === 0) { setPickerYear(y => y - 1); setPickerMonth(11); }
                      else setPickerMonth(m => m - 1);
                    }}
                    onNextMonth={() => {
                      if (pickerMonth === 11) { setPickerYear(y => y + 1); setPickerMonth(0); }
                      else setPickerMonth(m => m + 1);
                    }}
                    onDayPress={(day) => {
                      const k = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      setPickedDate(k);
                      setDatePickerOpen(false);
                    }}
                  />
                </View>
              )}

              {/* Time picker — only shown when a date is picked */}
              {pickedDate && (
                <>
                  <ThemedText style={styles.fieldLabel}>{t('trip.time')}</ThemedText>
                  <TimePicker
                    hour={pickHour}
                    minute={pickMinute}
                    tint={theme.tint}
                    onChange={(h, m) => { setPickHour(h); setPickMinute(m); }}
                  />
                </>
              )}

              {/* Duration */}
              <ThemedInput
                style={[styles.input, { color: theme.text, borderColor: theme.tint }]}
                placeholder={t('trip.durationPlaceholder')}
                placeholderTextColor={theme.icon}
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
              />

              {/* Location */}
              <ThemedText style={styles.fieldLabel}>{t('trip.locationOptional')}</ThemedText>
              <ThemedInput
                style={[styles.input, { color: theme.text, borderColor: theme.tint }]}
                placeholder={t('trip.locationName')}
                placeholderTextColor={theme.icon}
                value={locationName}
                onChangeText={setLocationName}
              />
              <ThemedInput
                style={[styles.input, { color: theme.text, borderColor: theme.tint }]}
                placeholder={t('trip.locationAddress')}
                placeholderTextColor={theme.icon}
                value={locationAddress}
                onChangeText={setLocationAddress}
              />

              {createError && <ThemedText style={styles.errorText}>{createError}</ThemedText>}

              <View style={styles.modalButtons}>
                <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={resetCreate}>
                  <ThemedText>{t('common.cancel')}</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: theme.tint }]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  {creating
                    ? <ActivityIndicator color="white" />
                    : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.create')}</ThemedText>}
                </Pressable>
              </View>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

export default EventsScreen;

// ── Calendar sub-styles ────────────────────────────────────────────────────────
const CELL = 44;
const cal = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  title: { fontSize: 18, fontWeight: '700' },
  weekRow: { flexDirection: 'row', paddingHorizontal: 8, marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', opacity: 0.45, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  cell: { width: `${100 / 7}%` as any, height: CELL, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayNum: { fontSize: 14 },
  dotRow: { flexDirection: 'row', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});

// ── Time picker sub-styles ─────────────────────────────────────────────────────
const tp = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 8 },
  unit: { alignItems: 'center', gap: 4 },
  btn: { padding: 6, borderRadius: 8, borderWidth: 1.5 },
  value: { fontSize: 28, fontWeight: '600', minWidth: 50, textAlign: 'center' },
  colon: { fontSize: 28, fontWeight: '600', marginBottom: 4 },
});

// ── Screen styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1 },
  tabBar: { flexDirection: 'row', margin: 12, borderRadius: 10, padding: 4 },
  tabPill: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabLabel: { fontSize: 14, fontWeight: '500', opacity: 0.6 },
  tabLabelActive: { color: 'white', opacity: 1, fontWeight: '600' },

  agenda: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  agendaDayHeader: {
    paddingLeft: 10,
    paddingVertical: 6,
    borderLeftWidth: 0,
    borderLeftColor: 'transparent',
    marginBottom: 6,
  },
  agendaDayText: { fontSize: 13, fontWeight: '700', opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.5 },

  list: { padding: 16, gap: 10, paddingBottom: 100 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 15, opacity: 0.6 },

  eventCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12 },
  eventLeft: { flex: 1, gap: 3 },
  eventName: { fontSize: 15, fontWeight: '600' },
  eventMeta: { fontSize: 13, opacity: 0.6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 12, opacity: 0.55 },
  eventRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventDuration: { fontSize: 13, fontWeight: '500', opacity: 0.7 },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
  },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center' },
  modalBox: { borderRadius: 16, padding: 20 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700' },

  input: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, opacity: 0.6, marginBottom: 6, marginTop: 4 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    marginBottom: 12,
  },
  calPickerBox: {
    borderWidth: 1, borderRadius: 12,
    marginBottom: 12, overflow: 'hidden',
  },

  modalButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { borderWidth: 1, borderColor: '#ccc' },
  deleteBtn: { backgroundColor: '#d9534f' },
  errorText: { color: '#d9534f', marginBottom: 8, textAlign: 'center' },

  detailName: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailLabel: { fontSize: 13, opacity: 0.6, fontWeight: '500' },
  detailValue: { fontSize: 15, fontWeight: '600' },
  locationDetail: { fontSize: 14, marginBottom: 4 },
});
