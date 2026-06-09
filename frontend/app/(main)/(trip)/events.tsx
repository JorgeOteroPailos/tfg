import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  StyleSheet, View, FlatList, ActivityIndicator,
  Pressable, Modal, ScrollView, TextInput,
} from 'react-native';
import MapView, { Marker, Region, type MapStyleElement } from 'react-native-maps';
import * as Location from 'expo-location';
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
  eventDots?: Record<string, number>;
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
  const { t } = useTranslation();
  const weekDays = t('trip.weekDays', { returnObjects: true }) as string[];
  const monthNames = t('trip.monthNames', { returnObjects: true }) as string[];
  const isThisMonth = todayKey.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);
  const grid = useMemo(() => buildGrid(year, month), [year, month]);

  return (
    <View>
      <View style={cal.header}>
        <Pressable onPress={onPrevMonth} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={tint} />
        </Pressable>
        <ThemedText style={cal.title}>{monthNames[month]} {year}</ThemedText>
        <Pressable onPress={onNextMonth} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color={tint} />
        </Pressable>
      </View>

      <View style={cal.weekRow}>
        {weekDays.map((d: string) => (
          <ThemedText key={d} style={cal.weekLabel}>{d}</ThemedText>
        ))}
      </View>

      <View style={cal.grid}>
        {grid.map((day, idx) => {
          if (day === null) {
            const col = idx % 7;
            const row = Math.floor(idx / 7);
            return <View key={`pad-r${row}c${col}`} style={cal.cell} />;
          }
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

// ── Reducers ───────────────────────────────────────────────────────────────────

type EventsListState = { events: EventSummary[] | null; loading: boolean; error: string | null };
type EventsListAction =
  | { type: 'loading' }
  | { type: 'loaded'; events: EventSummary[] }
  | { type: 'error'; error: string }
  | { type: 'add'; event: EventSummary }
  | { type: 'remove'; id: string };

function evListReducer(state: EventsListState, action: EventsListAction): EventsListState {
  switch (action.type) {
    case 'loading': return { ...state, loading: true, error: null };
    case 'loaded': return { events: action.events, loading: false, error: null };
    case 'error': return { ...state, loading: false, error: action.error };
    case 'add': return { ...state, events: state.events ? [action.event, ...state.events] : [action.event] };
    case 'remove': return { ...state, events: state.events ? state.events.filter(e => e.id !== action.id) : state.events };
    default: return state;
  }
}

type CalState = { year: number; month: number; selectedKey: string };
type CalAction =
  | { type: 'prev_month' }
  | { type: 'next_month' }
  | { type: 'select_day'; key: string };

function calReducer(state: CalState, action: CalAction): CalState {
  switch (action.type) {
    case 'prev_month':
      if (state.month === 0) return { ...state, year: state.year - 1, month: 11 };
      return { ...state, month: state.month - 1 };
    case 'next_month':
      if (state.month === 11) return { ...state, year: state.year + 1, month: 0 };
      return { ...state, month: state.month + 1 };
    case 'select_day': return { ...state, selectedKey: action.key };
    default: return state;
  }
}

type DetailState = { visible: boolean; event: EventSummary | null; deleting: boolean; error: string | null };
type DetailAction =
  | { type: 'open'; event: EventSummary }
  | { type: 'close' }
  | { type: 'start_delete' }
  | { type: 'end_delete' }
  | { type: 'set_error'; error: string };

function detailReducer(state: DetailState, action: DetailAction): DetailState {
  switch (action.type) {
    case 'open': return { visible: true, event: action.event, deleting: false, error: null };
    case 'close': return { visible: false, event: null, deleting: false, error: null };
    case 'start_delete': return { ...state, deleting: true, error: null };
    case 'end_delete': return { ...state, deleting: false };
    case 'set_error': return { ...state, error: action.error };
    default: return state;
  }
}

type CreateState = {
  visible: boolean;
  creating: boolean;
  error: string | null;
  evName: string;
  duration: string;
  locationName: string;
  locationAddress: string;
  latitude: number | null;
  longitude: number | null;
  mapPickerOpen: boolean;
  pickedDate: string | null;
  pickHour: number;
  pickMinute: number;
  datePickerOpen: boolean;
  pickerYear: number;
  pickerMonth: number;
};
type CreateAction =
  | { type: 'open'; key?: string }
  | { type: 'close' }
  | { type: 'set_name'; value: string }
  | { type: 'set_duration'; value: string }
  | { type: 'set_location_name'; value: string }
  | { type: 'set_location_address'; value: string }
  | { type: 'set_coords'; latitude: number; longitude: number; name?: string; address?: string }
  | { type: 'select_place'; latitude: number; longitude: number; name: string; address: string }
  | { type: 'open_map_picker' }
  | { type: 'close_map_picker' }
  | { type: 'pick_date'; key: string }
  | { type: 'set_time'; hour: number; minute: number }
  | { type: 'toggle_date_picker' }
  | { type: 'prev_picker_month' }
  | { type: 'next_picker_month' }
  | { type: 'start_creating' }
  | { type: 'done_creating' }
  | { type: 'set_error'; error: string | null };

function createReducer(state: CreateState, action: CreateAction): CreateState {
  switch (action.type) {
    case 'open': {
      if (action.key) {
        const [y, m] = action.key.split('-').map(Number);
        return { ...state, visible: true, pickedDate: action.key, pickerYear: y, pickerMonth: m - 1 };
      }
      return { ...state, visible: true };
    }
    case 'close': return {
      ...state,
      visible: false, creating: false, error: null,
      evName: '', duration: '', locationName: '', locationAddress: '',
      latitude: null, longitude: null, mapPickerOpen: false,
      pickedDate: null, pickHour: 12, pickMinute: 0, datePickerOpen: false,
    };
    case 'set_name': return { ...state, evName: action.value };
    case 'set_duration': return { ...state, duration: action.value };
    case 'set_location_name': return { ...state, locationName: action.value };
    case 'set_location_address': return { ...state, locationAddress: action.value };
    case 'set_coords': return {
      ...state,
      latitude: action.latitude, longitude: action.longitude, mapPickerOpen: false,
      locationName: !state.locationName.trim() && action.name ? action.name : state.locationName,
      locationAddress: !state.locationAddress.trim() && action.address ? action.address : state.locationAddress,
    };
    case 'select_place': return {
      ...state,
      latitude: action.latitude, longitude: action.longitude,
      locationName: action.name, locationAddress: action.address,
    };
    case 'open_map_picker': return { ...state, mapPickerOpen: true };
    case 'close_map_picker': return { ...state, mapPickerOpen: false };
    case 'pick_date': return { ...state, pickedDate: action.key, datePickerOpen: false };
    case 'set_time': return { ...state, pickHour: action.hour, pickMinute: action.minute };
    case 'toggle_date_picker': return { ...state, datePickerOpen: !state.datePickerOpen };
    case 'prev_picker_month':
      if (state.pickerMonth === 0) return { ...state, pickerYear: state.pickerYear - 1, pickerMonth: 11 };
      return { ...state, pickerMonth: state.pickerMonth - 1 };
    case 'next_picker_month':
      if (state.pickerMonth === 11) return { ...state, pickerYear: state.pickerYear + 1, pickerMonth: 0 };
      return { ...state, pickerMonth: state.pickerMonth + 1 };
    case 'start_creating': return { ...state, creating: true, error: null };
    case 'done_creating': return { ...state, creating: false };
    case 'set_error': return { ...state, error: action.error };
    default: return state;
  }
}

// ── Modals ────────────────────────────────────────-───────────────────────────

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: { road?: string; house_number?: string; city?: string; town?: string; village?: string; country?: string };
};

function nominatimName(r: NominatimResult) { return r.display_name.split(',')[0].trim(); }
function nominatimAddress(r: NominatimResult) {
  const a = r.address ?? {};
  const road = [a.house_number, a.road].filter(Boolean).join(' ');
  const city = a.city ?? a.town ?? a.village ?? '';
  return [road, city, a.country].filter(Boolean).join(', ');
}

const FALLBACK_REGION: Region = { latitude: 42.8782, longitude: -8.5448, latitudeDelta: 0.05, longitudeDelta: 0.05 };

const DARK_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
];

type MapPickerState = { region: Region; ready: boolean; searchQuery: string; confirming: boolean };
type MapPickerInternalAction =
  | { type: 'closed' }
  | { type: 'hint'; region: Region }
  | { type: 'locating' }
  | { type: 'located'; region: Region }
  | { type: 'location_failed' }
  | { type: 'set_query'; query: string }
  | { type: 'confirm_start' }
  | { type: 'confirm_end' };

function mapPickerReducer(s: MapPickerState, a: MapPickerInternalAction): MapPickerState {
  switch (a.type) {
    case 'closed': return { ...s, searchQuery: '', ready: false };
    case 'hint': return { ...s, region: a.region, ready: true };
    case 'locating': return { ...s, ready: false };
    case 'located': return { ...s, region: a.region, ready: true };
    case 'location_failed': return { ...s, ready: true };
    case 'set_query': return { ...s, searchQuery: a.query };
    case 'confirm_start': return { ...s, confirming: true };
    case 'confirm_end': return { ...s, confirming: false };
    default: return s;
  }
}

type MapPickerModalProps = {
  visible: boolean;
  tint: string;
  hintRegion: Region | null;
  onConfirm: (lat: number, lng: number, name?: string, address?: string) => void;
  onClose: () => void;
};
const MapPickerModal = React.memo(function MapPickerModal({ visible, tint, hintRegion, onConfirm, onClose }: MapPickerModalProps) {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const [mapState, mapDispatch] = useReducer(mapPickerReducer, { region: FALLBACK_REGION, ready: false, searchQuery: '', confirming: false });
  const regionRef = useRef<Region>(FALLBACK_REGION);
  const mapRef = useRef<MapView>(null);
  const searchedNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) { mapDispatch({ type: 'closed' }); searchedNameRef.current = null; return; }
    if (hintRegion) {
      regionRef.current = hintRegion;
      mapDispatch({ type: 'hint', region: hintRegion });
      return;
    }
    let cancelled = false;
    mapDispatch({ type: 'locating' });
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const r = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        regionRef.current = r;
        mapDispatch({ type: 'located', region: r });
      } else {
        mapDispatch({ type: 'location_failed' });
      }
    })();
    return () => { cancelled = true; };
  }, [visible, hintRegion]);

  const onRegionChange = useCallback((r: Region) => { regionRef.current = r; }, []);

  const handleSearch = async () => {
    const q = mapState.searchQuery.trim();
    if (!q) return;
    try {
      const c = regionRef.current;
      const viewbox = `${c.longitude - 1},${c.latitude - 1},${c.longitude + 1},${c.latitude + 1}`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&viewbox=${viewbox}&bounded=0`,
        { headers: { 'User-Agent': 'Telaria-TFG/1.0' } },
      );
      const data: NominatimResult[] = await res.json();
      if (data[0]) {
        const r = { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon), latitudeDelta: 0.02, longitudeDelta: 0.02 };
        regionRef.current = r;
        searchedNameRef.current = q;
        mapRef.current?.animateToRegion(r, 600);
      }
    } catch {}
  };

  const handleConfirm = async () => {
    mapDispatch({ type: 'confirm_start' });
    const { latitude, longitude } = regionRef.current;
    let name: string | undefined;
    let address: string | undefined;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
        { headers: { 'User-Agent': 'Telaria-TFG/1.0' } },
      );
      const data = await res.json();
      if (data && !data.error) {
        const r = data as NominatimResult;
        name = searchedNameRef.current ?? nominatimName(r);
        address = nominatimAddress(r);
      }
    } catch {}
    mapDispatch({ type: 'confirm_end' });
    onConfirm(latitude, longitude, name, address);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {mapState.ready ? (
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={mapState.region}
            onRegionChangeComplete={onRegionChange}
            userInterfaceStyle={themeName === 'dark' ? 'dark' : 'light'}
            customMapStyle={themeName === 'dark' ? DARK_MAP_STYLE : []}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={tint} size="large" />
          </View>
        )}

        {/* Fixed center-pin overlay */}
        <View style={mapPicker.pin} pointerEvents="none">
          <Ionicons name="location" size={40} color={tint} />
        </View>

        {/* Search bar */}
        <View style={[mapPicker.searchRow, { backgroundColor: theme.tabBackground }]}>
          <TextInput
            style={[mapPicker.searchInput, { color: theme.text }]}
            placeholder={t('trip.searchPlace')}
            placeholderTextColor={theme.icon}
            value={mapState.searchQuery}
            onChangeText={query => mapDispatch({ type: 'set_query', query })}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <Pressable onPress={handleSearch} hitSlop={8}>
            <Ionicons name="search" size={20} color={tint} />
          </Pressable>
        </View>

        {/* Top-left close button */}
        <Pressable style={[mapPicker.closeBtn, { backgroundColor: theme.tabBackground }]} onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={22} color={theme.icon} />
        </Pressable>

        {/* Bottom confirm button */}
        <View style={[mapPicker.footer, { backgroundColor: theme.tabBackground }]}>
          <ThemedText style={mapPicker.footerLabel}>{t('trip.mapPickerTitle')}</ThemedText>
          <Pressable style={[mapPicker.confirmBtn, { backgroundColor: tint }]} onPress={handleConfirm} disabled={mapState.confirming}>
            {mapState.confirming
              ? <ActivityIndicator color="white" />
              : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('trip.confirmLocation')}</ThemedText>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

type EventDetailModalProps = {
  detail: DetailState;
  onClose: () => void;
  onDelete: () => void;
};

const EventDetailModal = React.memo(function EventDetailModal({ detail, onClose, onDelete }: EventDetailModalProps) {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;

  return (
    <Modal visible={detail.visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
          <ThemedText style={styles.modalTitle}>{t('trip.eventDetail')}</ThemedText>

          {detail.event && (
            <>
              <ThemedText style={styles.detailName}>{detail.event.name}</ThemedText>
              {detail.event.startTime && (
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>{t('trip.startTime')}</ThemedText>
                  <ThemedText style={styles.detailValue}>{formatDateTime(detail.event.startTime)}</ThemedText>
                </View>
              )}
              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>{t('trip.duration')}</ThemedText>
                <ThemedText style={styles.detailValue}>{formatDuration(detail.event.duration)}</ThemedText>
              </View>
              {detail.event.location && (
                <>
                  <ThemedText style={[styles.detailLabel, { marginTop: 12, marginBottom: 6 }]}>{t('trip.location')}</ThemedText>
                  {detail.event.location.name && <ThemedText style={styles.locationDetail}>· {detail.event.location.name}</ThemedText>}
                  {detail.event.location.address && <ThemedText style={styles.locationDetail}>· {detail.event.location.address}</ThemedText>}
                  {detail.event.location.latitude != null && detail.event.location.longitude != null && (
                    <View style={[styles.detailMapContainer, { borderColor: theme.tint + '30' }]}>
                      <MapView
                        style={StyleSheet.absoluteFillObject}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        pitchEnabled={false}
                        rotateEnabled={false}
                        initialRegion={{
                          latitude: detail.event.location.latitude,
                          longitude: detail.event.location.longitude,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }}
                        userInterfaceStyle={themeName === 'dark' ? 'dark' : 'light'}
                        customMapStyle={themeName === 'dark' ? DARK_MAP_STYLE : []}
                      >
                        <Marker coordinate={{ latitude: detail.event.location.latitude, longitude: detail.event.location.longitude }} />
                      </MapView>
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {detail.error && <ThemedText style={styles.errorText}>{detail.error}</ThemedText>}

          <View style={styles.modalButtons}>
            <Pressable style={[styles.modalBtn, styles.deleteBtn]} onPress={onDelete} disabled={detail.deleting}>
              {detail.deleting
                ? <ActivityIndicator color="white" />
                : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.delete')}</ThemedText>}
            </Pressable>
            <Pressable style={[styles.modalBtn, { backgroundColor: theme.tint }]} onPress={onClose}>
              <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.close')}</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

function useLocationSearch(query: string, biasLat: number | null, biasLon: number | null) {
  const [rawSuggestions, setRawSuggestions] = useState<NominatimResult[]>([]);
  const skipRef = useRef(false);

  useEffect(() => {
    if (skipRef.current) { skipRef.current = false; return; }
    const q = query.trim();
    if (q.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const viewbox = biasLat != null && biasLon != null
          ? `&viewbox=${biasLon - 1},${biasLat - 1},${biasLon + 1},${biasLat + 1}&bounded=0`
          : '';
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5${viewbox}`,
          { headers: { 'User-Agent': 'Telaria-TFG/1.0' }, signal: controller.signal },
        );
        if (!controller.signal.aborted) setRawSuggestions(await res.json());
      } catch { setRawSuggestions([]); }
    }, 600);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, biasLat, biasLon]);

  // Derived during render — no state-in-effect adjustment needed
  const suggestions = query.trim().length < 3 ? [] : rawSuggestions;
  const skipNext = useCallback(() => { skipRef.current = true; setRawSuggestions([]); }, []);
  const clearSuggestions = useCallback(() => setRawSuggestions([]), []);
  return { suggestions, skipNext, clearSuggestions };
}

type EventCreateModalProps = {
  create: CreateState;
  createDispatch: React.Dispatch<CreateAction>;
  todayKey: string;
  formatSectionDate: (k: string) => string;
  onConfirm: () => void;
  hintRegion: Region | null;
};

const EventCreateModal = React.memo(function EventCreateModal({
  create, createDispatch, todayKey, formatSectionDate, onConfirm, hintRegion,
}: EventCreateModalProps) {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const biasLat = create.latitude ?? hintRegion?.latitude ?? null;
  const biasLon = create.longitude ?? hintRegion?.longitude ?? null;
  const { suggestions, skipNext, clearSuggestions } = useLocationSearch(create.locationName, biasLat, biasLon);

  const handleMapConfirm = useCallback((lat: number, lng: number, name?: string, address?: string) => {
    createDispatch({ type: 'set_coords', latitude: lat, longitude: lng, name, address });
  }, [createDispatch]);

  const handleMapClose = useCallback(() => {
    createDispatch({ type: 'close_map_picker' });
  }, [createDispatch]);

  return (
    <Modal visible={create.visible} transparent animationType="slide" onRequestClose={() => createDispatch({ type: 'close' })}>
      <View style={styles.overlay}>
        <ScrollView
          style={{ width: '100%' }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
            <View style={styles.modalTitleRow}>
              <ThemedText style={styles.modalTitle}>{t('trip.newEvent')}</ThemedText>
              <Pressable onPress={() => createDispatch({ type: 'close' })} hitSlop={8}>
                <Ionicons name="close" size={22} color={theme.icon} />
              </Pressable>
            </View>

            <ThemedInput
              style={[styles.input, { color: theme.text, borderColor: theme.tint }]}
              placeholder={t('trip.eventName')}
              placeholderTextColor={theme.icon}
              value={create.evName}
              onChangeText={value => createDispatch({ type: 'set_name', value })}
              autoFocus
            />

            <Pressable style={[styles.dateBtn, { borderColor: theme.tint }]} onPress={() => createDispatch({ type: 'toggle_date_picker' })}>
              <Ionicons name="calendar-outline" size={18} color={theme.tint} />
              <ThemedText style={{ flex: 1, marginLeft: 8 }}>
                {create.pickedDate ? formatSectionDate(create.pickedDate) : t('trip.chooseDate')}
              </ThemedText>
              <Ionicons name={create.datePickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={theme.icon} />
            </Pressable>

            {create.datePickerOpen && (
              <View style={[styles.calPickerBox, { borderColor: create.datePickerOpen ? theme.tint + '40' : 'transparent' }]}>
                <MiniCal
                  year={create.pickerYear}
                  month={create.pickerMonth}
                  selectedKey={create.pickedDate}
                  tint={theme.tint}
                  todayKey={todayKey}
                  onPrevMonth={() => createDispatch({ type: 'prev_picker_month' })}
                  onNextMonth={() => createDispatch({ type: 'next_picker_month' })}
                  onDayPress={(day) => {
                    const k = `${create.pickerYear}-${String(create.pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    createDispatch({ type: 'pick_date', key: k });
                  }}
                />
              </View>
            )}

            {create.pickedDate && (
              <>
                <ThemedText style={styles.fieldLabel}>{t('trip.time')}</ThemedText>
                <TimePicker
                  hour={create.pickHour}
                  minute={create.pickMinute}
                  tint={theme.tint}
                  onChange={(h, m) => createDispatch({ type: 'set_time', hour: h, minute: m })}
                />
              </>
            )}

            <ThemedInput
              style={[styles.input, { color: theme.text, borderColor: theme.tint }]}
              placeholder={t('trip.durationPlaceholder')}
              placeholderTextColor={theme.icon}
              value={create.duration}
              onChangeText={value => createDispatch({ type: 'set_duration', value })}
              keyboardType="numeric"
            />

            <ThemedText style={styles.fieldLabel}>{t('trip.locationOptional')}</ThemedText>
            <ThemedInput
              style={[styles.input, { color: theme.text, borderColor: theme.tint }]}
              placeholder={t('trip.locationName')}
              placeholderTextColor={theme.icon}
              value={create.locationName}
              onChangeText={value => createDispatch({ type: 'set_location_name', value })}
              onBlur={() => setTimeout(clearSuggestions, 150)}
            />
            {suggestions.length > 0 && (
              <View style={[autocomplete.list, { backgroundColor: theme.tabBackground, borderColor: theme.tint + '40' }]}>
                {suggestions.map(r => (
                  <Pressable
                    key={r.place_id}
                    style={({ pressed }) => [autocomplete.item, { opacity: pressed ? 0.6 : 1 }]}
                    onPress={() => {
                      skipNext();
                      createDispatch({
                        type: 'select_place',
                        latitude: parseFloat(r.lat),
                        longitude: parseFloat(r.lon),
                        name: nominatimName(r),
                        address: nominatimAddress(r),
                      });
                    }}
                  >
                    <Ionicons name="location-outline" size={14} color={theme.icon} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <ThemedText style={autocomplete.itemName} numberOfLines={1}>{nominatimName(r)}</ThemedText>
                      <ThemedText style={autocomplete.itemSub} numberOfLines={1}>{nominatimAddress(r)}</ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
            <ThemedInput
              style={[styles.input, { color: theme.text, borderColor: theme.tint }]}
              placeholder={t('trip.locationAddress')}
              placeholderTextColor={theme.icon}
              value={create.locationAddress}
              onChangeText={value => createDispatch({ type: 'set_location_address', value })}
            />

            <Pressable style={[styles.dateBtn, { borderColor: theme.tint }]} onPress={() => createDispatch({ type: 'open_map_picker' })}>
              <Ionicons name="map-outline" size={18} color={theme.tint} />
              <ThemedText style={{ flex: 1, marginLeft: 8 }}>
                {create.latitude !== null ? t('trip.coordinatesSelected') : t('trip.pickOnMap')}
              </ThemedText>
              {create.latitude !== null && <Ionicons name="checkmark-circle" size={18} color={theme.tint} />}
            </Pressable>

            <MapPickerModal
              visible={create.mapPickerOpen}
              tint={theme.tint}
              hintRegion={hintRegion}
              onConfirm={handleMapConfirm}
              onClose={handleMapClose}
            />

            {create.error && <ThemedText style={styles.errorText}>{create.error}</ThemedText>}

            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={() => createDispatch({ type: 'close' })}>
                <ThemedText>{t('common.cancel')}</ThemedText>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.tint }]} onPress={onConfirm} disabled={create.creating}>
                {create.creating
                  ? <ActivityIndicator color="white" />
                  : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.create')}</ThemedText>}
              </Pressable>
            </View>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
});

// ── Main screen ────────────────────────────────────────────────────────────────
const EventsScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip } = useTrip();
  const { getEvents, addEvent, deleteEvent } = useEvents();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<Tab>('calendar');
  const [evList, evListDispatch] = useReducer(evListReducer, { events: null, loading: false, error: null });
  const [calState, calDispatch] = useReducer(calReducer, undefined, () => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), selectedKey: dateKey(now) };
  });
  const [detail, detailDispatch] = useReducer(detailReducer, { visible: false, event: null, deleting: false, error: null });
  const [create, createDispatch] = useReducer(createReducer, undefined, () => {
    const now = new Date();
    return {
      visible: false, creating: false, error: null,
      evName: '', duration: '', locationName: '', locationAddress: '',
      latitude: null, longitude: null, mapPickerOpen: false,
      pickedDate: null, pickHour: 12, pickMinute: 0,
      datePickerOpen: false,
      pickerYear: now.getFullYear(),
      pickerMonth: now.getMonth(),
    };
  });

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => dateKey(today), [today]);

  useEffect(() => {
    if (trip?.name) navigation.setOptions({ title: trip.name });
  }, [trip?.name, navigation]);

  useEffect(() => {
    if (!trip?.id || evList.events !== null) return;
    (async () => {
      evListDispatch({ type: 'loading' });
      try {
        evListDispatch({ type: 'loaded', events: await getEvents(trip.id!) });
      } catch {
        evListDispatch({ type: 'error', error: t('trip.unableLoadEvents') });
      }
    })();
  }, [trip?.id, evList.events, getEvents, t]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, EventSummary[]> = {};
    for (const ev of evList.events ?? []) {
      if (!ev.startTime) continue;
      const k = dateKey(new Date(ev.startTime));
      (map[k] ??= []).push(ev);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.startTime!.localeCompare(b.startTime!));
    }
    return map;
  }, [evList.events]);

  const agendaDays = useMemo(() => {
    const all = Object.keys(eventsByDay).sort();
    const after = all.filter(d => d >= calState.selectedKey);
    const before = all.filter(d => d < calState.selectedKey).reverse();
    return [...after, ...before];
  }, [eventsByDay, calState.selectedKey]);

  const unscheduled = useMemo(() => (evList.events ?? []).filter(e => !e.startTime), [evList.events]);

  const hintRegion = useMemo((): Region | null => {
    const withCoords = (evList.events ?? []).filter(e => e.location?.latitude != null && e.location?.longitude != null);
    if (withCoords.length === 0) return null;
    const sorted = [...withCoords].sort((a, b) => {
      if (!a.startTime && !b.startTime) return 0;
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return b.startTime.localeCompare(a.startTime);
    });
    const ev = sorted[0];
    return { latitude: ev.location!.latitude!, longitude: ev.location!.longitude!, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }, [evList.events]);

  const formatSectionDate = (k: string) => {
    const tomorrow = dateKey(new Date(today.getTime() + 86_400_000));
    if (k === todayKey) return t('trip.today');
    if (k === tomorrow) return t('trip.tomorrow');
    const d = new Date(k + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleCreate = async () => {
    if (!trip?.id) return;
    if (!create.evName.trim()) { createDispatch({ type: 'set_error', error: t('trip.fillAllRequiredFields') }); return; }
    createDispatch({ type: 'start_creating' });
    try {
      const payload: Parameters<typeof addEvent>[1] = { name: create.evName.trim() };
      if (create.pickedDate) {
        const d = new Date(`${create.pickedDate}T00:00:00`);
        d.setHours(create.pickHour, create.pickMinute, 0, 0);
        payload.startTime = d.toISOString();
      }
      if (create.duration.trim()) payload.duration = Number(create.duration);
      if (create.locationName.trim() || create.locationAddress.trim() || create.latitude !== null) {
        payload.location = {};
        if (create.locationName.trim()) payload.location.name = create.locationName.trim();
        if (create.locationAddress.trim()) payload.location.address = create.locationAddress.trim();
        if (create.latitude !== null && create.longitude !== null) {
          payload.location.latitude = create.latitude;
          payload.location.longitude = create.longitude;
          payload.location.mapURL = `https://maps.google.com/?q=${create.latitude},${create.longitude}`;
        }
      }
      const newEvent = await addEvent(trip.id, payload);
      evListDispatch({ type: 'add', event: newEvent });
      createDispatch({ type: 'close' });
    } catch {
      createDispatch({ type: 'set_error', error: t('trip.createEventError') });
    } finally {
      createDispatch({ type: 'done_creating' });
    }
  };

  const handleEventPress = useCallback((ev: EventSummary) => {
    detailDispatch({ type: 'open', event: ev });
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
    if (!trip?.id || !detail.event) return;
    detailDispatch({ type: 'start_delete' });
    try {
      await deleteEvent(trip.id, detail.event.id);
      evListDispatch({ type: 'remove', id: detail.event.id });
      detailDispatch({ type: 'close' });
    } catch {
      detailDispatch({ type: 'set_error', error: t('trip.deleteEventError') });
    } finally {
      detailDispatch({ type: 'end_delete' });
    }
  };

  const handleDetailClose = useCallback(() => detailDispatch({ type: 'close' }), []);

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

      {evList.error ? (
        <ThemedText style={styles.emptyText}>{evList.error}</ThemedText>
      ) : (
        <>
          {/* ── Calendar tab ── */}
          {activeTab === 'calendar' && (
            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
              <MiniCal
                year={calState.year}
                month={calState.month}
                selectedKey={calState.selectedKey}
                eventDots={evList.loading ? EMPTY_EVENT_DOTS : Object.fromEntries(Object.entries(eventsByDay).map(([k, v]) => [k, v.length]))}
                tint={theme.tint}
                todayKey={todayKey}
                onPrevMonth={() => calDispatch({ type: 'prev_month' })}
                onNextMonth={() => calDispatch({ type: 'next_month' })}
                onDayPress={(day) => {
                  const k = `${calState.year}-${String(calState.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  calDispatch({ type: 'select_day', key: k });
                }}
              />

              {/* Agenda list */}
              <View style={styles.agenda}>
                {evList.loading ? (
                  <ActivityIndicator size="small" color={theme.tint} style={{ marginTop: 12 }} />
                ) : agendaDays.length === 0 && unscheduled.length === 0 ? (
                  <ThemedText style={styles.emptyText}>{t('trip.noEvents')}</ThemedText>
                ) : (
                  <>
                    {agendaDays.map(k => (
                      <View key={k}>
                        <View style={[styles.agendaDayHeader, k === calState.selectedKey && { borderLeftColor: theme.tint, borderLeftWidth: 3 }]}>
                          <ThemedText style={[styles.agendaDayText, k === calState.selectedKey && { color: theme.tint }]}>
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
                            onPress={(ev) => detailDispatch({ type: 'open', event: ev })}
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
                            onPress={(ev) => detailDispatch({ type: 'open', event: ev })}
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
            evList.loading ? (
              <ActivityIndicator size="large" color={theme.tint} style={styles.centered} />
            ) : (
              <FlatList
                data={evList.events ?? []}
                keyExtractor={(item, i) => item.id ?? `${i}`}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<ThemedText style={styles.emptyText}>{t('trip.noEvents')}</ThemedText>}
                renderItem={renderEventCard}
              />
            )
          )}
        </>
      )}

      {/* FAB */}
      {!evList.error && (
        <Pressable
          style={[styles.fab, { backgroundColor: theme.tint }]}
          onPress={() => createDispatch({ type: 'open', key: activeTab === 'calendar' ? calState.selectedKey : undefined })}
        >
          <Ionicons name="add" size={28} color="white" />
        </Pressable>
      )}

      <EventDetailModal
        detail={detail}
        onClose={handleDetailClose}
        onDelete={handleDelete}
      />

      <EventCreateModal
        create={create}
        createDispatch={createDispatch}
        todayKey={todayKey}
        formatSectionDate={formatSectionDate}
        onConfirm={handleCreate}
        hintRegion={hintRegion}
      />
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
  detailMapContainer: {
    height: 180, borderRadius: 14, marginTop: 10,
    overflow: 'hidden', borderWidth: 1,
    boxShadow: '0px 2px 6px rgba(0,0,0,0.15)',
  },
});

const mapPicker = StyleSheet.create({
  pin: { position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -20, pointerEvents: 'none' },
  closeBtn: { position: 'absolute', top: 48, left: 16, padding: 8, borderRadius: 20, boxShadow: '0px 2px 4px rgba(0,0,0,0.15)' },
  searchRow: { position: 'absolute', top: 48, left: 64, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, boxShadow: '0px 2px 4px rgba(0,0,0,0.15)' },
  searchInput: { flex: 1, fontSize: 15 },
  footer: { padding: 16, paddingBottom: 32, gap: 8 },
  footerLabel: { textAlign: 'center', opacity: 0.6, fontSize: 13 },
  confirmBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});

const autocomplete = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: 10, marginBottom: 8, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ccc' },
  itemName: { fontSize: 14, fontWeight: '600' },
  itemSub: { fontSize: 12, opacity: 0.6, marginTop: 1 },
});
