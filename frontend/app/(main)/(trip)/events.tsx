import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  StyleSheet, View, ActivityIndicator, FlatList, Linking,
  Pressable, Modal, ScrollView, TextInput, PanResponder,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import MapView, { Marker, Region, type MapStyleElement } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useNavigation } from 'expo-router';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useQuery } from '@tanstack/react-query';
import { useEventsQuery, useAddEventMutation, useDeleteEventMutation, type EventSummary } from '../../../src/events';
import { useDocuments, useDocumentsByDateQuery, useDocumentDownloadQuery, useDeleteDocumentMutation, type DocumentResponse } from '../../../src/documents';
import { DocGridCard, DocumentDetailModal } from '../../../src/documentCards';
import {
  detailReducer as docDetailReducer,
  DETAIL_INITIAL as DOC_DETAIL_INITIAL, isImageFile,
} from '../../../src/documentCards.helpers';
import { useTrip } from '../../../src/trips';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../../../components/ThemedText';
import ThemedInput from '../../../components/ThemedInput';

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
// Monday-based week (7 dates) containing the given anchor date.
function weekDates(anchor: Date): Date[] {
  const offset = anchor.getDay() === 0 ? 6 : anchor.getDay() - 1;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
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
  collapsed?: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayPress: (key: string) => void;
};
const MiniCal = ({
  year, month, selectedKey, eventDots = EMPTY_EVENT_DOTS, tint, todayKey, collapsed = false,
  onPrevMonth, onNextMonth, onDayPress,
}: MiniCalProps) => {
  const { t } = useTranslation();
  const weekDays = t('trip.weekDays', { returnObjects: true }) as string[];
  const monthNames = t('trip.monthNames', { returnObjects: true }) as string[];
  const grid = useMemo(() => buildGrid(year, month), [year, month]);
  // In collapsed mode, show only the week around the selected day (or today).
  const week = useMemo(
    () => (collapsed ? weekDates(new Date(`${selectedKey ?? todayKey}T00:00:00`)) : null),
    [collapsed, selectedKey, todayKey],
  );

  const renderCell = (key: string, day: number, inMonth: boolean) => {
    const isToday = todayKey === key;
    const isSel = selectedKey === key;
    const dots = Math.min(eventDots[key] ?? 0, 3);
    return (
      <Pressable
        key={key}
        style={({ pressed }) => [cal.cell, isSel && { backgroundColor: tint, borderRadius: 8 }, { opacity: pressed ? 0.6 : 1 }]}
        onPress={() => onDayPress(key)}
      >
        <ThemedText style={[
          cal.dayNum,
          !inMonth && { opacity: 0.35 },
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
  };

  return (
    <View>
      <View style={cal.header}>
        <Pressable onPress={onPrevMonth} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('a11y.prevMonth')}>
          <Ionicons name="chevron-back" size={22} color={tint} />
        </Pressable>
        <ThemedText style={cal.title}>{monthNames[month]} {year}</ThemedText>
        <Pressable onPress={onNextMonth} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('a11y.nextMonth')}>
          <Ionicons name="chevron-forward" size={22} color={tint} />
        </Pressable>
      </View>

      <View style={cal.weekRow}>
        {weekDays.map((d: string) => (
          <ThemedText key={d} style={cal.weekLabel}>{d}</ThemedText>
        ))}
      </View>

      {week ? (
        <View style={cal.grid}>
          {week.map(d => renderCell(dateKey(d), d.getDate(), d.getMonth() === month))}
        </View>
      ) : (
        <View style={cal.grid}>
          {grid.map((day, idx) => {
            if (day === null) {
              const col = idx % 7;
              const row = Math.floor(idx / 7);
              return <View key={`pad-r${row}c${col}`} style={cal.cell} />;
            }
            const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return renderCell(k, day, true);
          })}
        </View>
      )}
    </View>
  );
};

// ── Time picker ────────────────────────────────────────────────────────────────
type TimePickerProps = { hour: number; minute: number; tint: string; onChange: (h: number, m: number) => void };
const TimePicker = ({ hour, minute, tint, onChange }: TimePickerProps) => {
  const { t } = useTranslation();
  const adj = (unit: 'h' | 'm', delta: number) => {
    if (unit === 'h') onChange((hour + delta + 24) % 24, minute);
    else onChange(hour, (minute + delta + 60) % 60);
  };
  return (
    <View style={tp.row}>
      {/* Hour */}
      <View style={tp.unit}>
        <Pressable style={[tp.btn, { borderColor: tint }]} onPress={() => adj('h', 1)} accessibilityRole="button" accessibilityLabel={t('a11y.increaseHour')}>
          <Ionicons name="chevron-up" size={16} color={tint} />
        </Pressable>
        <ThemedText style={tp.value}>{String(hour).padStart(2, '0')}</ThemedText>
        <Pressable style={[tp.btn, { borderColor: tint }]} onPress={() => adj('h', -1)} accessibilityRole="button" accessibilityLabel={t('a11y.decreaseHour')}>
          <Ionicons name="chevron-down" size={16} color={tint} />
        </Pressable>
      </View>
      <ThemedText style={tp.colon}>:</ThemedText>
      {/* Minute */}
      <View style={tp.unit}>
        <Pressable style={[tp.btn, { borderColor: tint }]} onPress={() => adj('m', 5)} accessibilityRole="button" accessibilityLabel={t('a11y.increaseMinute')}>
          <Ionicons name="chevron-up" size={16} color={tint} />
        </Pressable>
        <ThemedText style={tp.value}>{String(minute).padStart(2, '0')}</ThemedText>
        <Pressable style={[tp.btn, { borderColor: tint }]} onPress={() => adj('m', -5)} accessibilityRole="button" accessibilityLabel={t('a11y.decreaseMinute')}>
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
  isPast?: boolean;
  theme: typeof Colors.light;
  formatTime: (iso: string) => string;
  formatDateTime: (iso: string) => string;
  formatDuration: (mins: number) => string;
  onPress: (ev: EventSummary) => void;
};

const EventCard = ({ ev, showDate = false, isPast = false, theme, formatTime, formatDateTime, formatDuration, onPress }: EventCardProps) => (
  <View style={isPast ? { opacity: 0.45 } : undefined}>
  <Pressable
    style={({ pressed }) => [styles.eventCard, { backgroundColor: theme.tabBackground }, { opacity: pressed ? 0.75 : 1 }]}
    onPress={() => onPress(ev)}
  >
    <View style={styles.eventLeft}>
      <ThemedText style={styles.eventName}>{ev.name}</ThemedText>
      <ThemedText style={styles.eventMeta}>
        {showDate ? formatDateTime(ev.startTime) : formatTime(ev.startTime)}
      </ThemedText>
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
  </View>
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

type CalState = { year: number; month: number; selectedKey: string; collapsed: boolean };
type CalAction =
  | { type: 'prev_month' }
  | { type: 'next_month' }
  | { type: 'prev_week' }
  | { type: 'next_week' }
  | { type: 'select_day'; key: string }
  | { type: 'set_collapsed'; value: boolean };

function shiftWeek(state: CalState, days: number): CalState {
  const d = new Date(`${state.selectedKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return { ...state, year: d.getFullYear(), month: d.getMonth(), selectedKey: dateKey(d) };
}

function calReducer(state: CalState, action: CalAction): CalState {
  switch (action.type) {
    case 'prev_month':
      if (state.month === 0) return { ...state, year: state.year - 1, month: 11 };
      return { ...state, month: state.month - 1 };
    case 'next_month':
      if (state.month === 11) return { ...state, year: state.year + 1, month: 0 };
      return { ...state, month: state.month + 1 };
    case 'prev_week': return shiftWeek(state, -7);
    case 'next_week': return shiftWeek(state, 7);
    case 'select_day': return { ...state, selectedKey: action.key };
    case 'set_collapsed': return { ...state, collapsed: action.value };
    default: return state;
  }
}

type DetailState = { visible: boolean; event: EventSummary | null; confirming: boolean; deleting: boolean; error: string | null };
type DetailAction =
  | { type: 'open'; event: EventSummary }
  | { type: 'close' }
  | { type: 'start_confirm' }
  | { type: 'cancel_confirm' }
  | { type: 'start_delete' }
  | { type: 'end_delete' }
  | { type: 'set_error'; error: string };

function detailReducer(state: DetailState, action: DetailAction): DetailState {
  switch (action.type) {
    case 'open': return { visible: true, event: action.event, confirming: false, deleting: false, error: null };
    case 'close': return { visible: false, event: null, confirming: false, deleting: false, error: null };
    case 'start_confirm': return { ...state, confirming: true, error: null };
    case 'cancel_confirm': return { ...state, confirming: false };
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
  name?: string;
  namedetails?: { name?: string };
  // [south, north, west, east] as strings
  boundingbox?: [string, string, string, string];
  address?: { road?: string; house_number?: string; city?: string; town?: string; village?: string; country?: string };
};

function nominatimCoords(r: NominatimResult) { return { latitude: parseFloat(r.lat), longitude: parseFloat(r.lon) }; }
function nominatimName(r: NominatimResult) {
  const named = r.namedetails?.name ?? r.name;
  if (named && named.trim()) return named.trim();
  const segments = r.display_name.split(',').map(s => s.trim()).filter(Boolean);
  // Skip bare house numbers (e.g. "10, Calle Mayor, ...") so we get a real name.
  return segments.find(s => !/^\d+$/.test(s)) ?? segments[0] ?? '';
}
function nominatimAddress(r: NominatimResult) {
  const a = r.address ?? {};
  const road = [a.house_number, a.road].filter(Boolean).join(' ');
  const city = a.city ?? a.town ?? a.village ?? '';
  return [road, city, a.country].filter(Boolean).join(', ');
}
// Frame the whole feature (centered on its bounding box) rather than landing on
// Nominatim's representative point, which can sit off to one side.
function regionFromResult(r: NominatimResult): Region {
  const bb = r.boundingbox;
  const { latitude, longitude } = nominatimCoords(r);
  if (bb && bb.length === 4) {
    const south = parseFloat(bb[0]), north = parseFloat(bb[1]);
    const west = parseFloat(bb[2]), east = parseFloat(bb[3]);
    if ([south, north, west, east].every(Number.isFinite)) {
      return {
        latitude: (south + north) / 2,
        longitude: (west + east) / 2,
        latitudeDelta: Math.max((north - south) * 1.3, 0.005),
        longitudeDelta: Math.max((east - west) * 1.3, 0.005),
      };
    }
  }
  return { latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 };
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

type MapPickerState = { region: Region; ready: boolean; searchQuery: string; confirming: boolean; searching: boolean; notice: string | null };
type MapPickerInternalAction =
  | { type: 'closed' }
  | { type: 'hint'; region: Region }
  | { type: 'locating' }
  | { type: 'located'; region: Region }
  | { type: 'location_failed'; notice: string }
  | { type: 'set_query'; query: string }
  | { type: 'search_start' }
  | { type: 'search_end'; notice?: string | null }
  | { type: 'confirm_start' }
  | { type: 'confirm_end' };

function mapPickerReducer(s: MapPickerState, a: MapPickerInternalAction): MapPickerState {
  switch (a.type) {
    case 'closed': return { ...s, searchQuery: '', ready: false, searching: false, confirming: false, notice: null };
    case 'hint': return { ...s, region: a.region, ready: true, notice: null };
    case 'locating': return { ...s, ready: false, notice: null };
    case 'located': return { ...s, region: a.region, ready: true, notice: null };
    case 'location_failed': return { ...s, ready: true, notice: a.notice };
    case 'set_query': return { ...s, searchQuery: a.query };
    case 'search_start': return { ...s, searching: true, notice: null };
    case 'search_end': return { ...s, searching: false, notice: a.notice ?? null };
    case 'confirm_start': return { ...s, confirming: true, notice: null };
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
  const [mapState, mapDispatch] = useReducer(mapPickerReducer, { region: FALLBACK_REGION, ready: false, searchQuery: '', confirming: false, searching: false, notice: null });
  const regionRef = useRef<Region>(FALLBACK_REGION);
  const mapRef = useRef<MapView>(null);
  // Tracks whether the picker is still open, so async fetches that resolve after
  // the modal closes don't dispatch into the reducer or confirm a stale pick.
  const activeRef = useRef(false);
  // Remembers the user's typed search and where it landed, so confirm can use it
  // as the name — but only while the map center stays on that spot (see onRegionChange).
  const searchedRef = useRef<{ name: string; latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    activeRef.current = visible;
    return () => { activeRef.current = false; };
  }, [visible]);

  useEffect(() => {
    if (!visible) { mapDispatch({ type: 'closed' }); searchedRef.current = null; return; }
    if (hintRegion) {
      regionRef.current = hintRegion;
      mapDispatch({ type: 'hint', region: hintRegion });
      return;
    }
    let cancelled = false;
    mapDispatch({ type: 'locating' });
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (cancelled) return;
          const r = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
          regionRef.current = r;
          mapDispatch({ type: 'located', region: r });
        } else {
          mapDispatch({ type: 'location_failed', notice: t('trip.locationUnavailable') });
        }
      } catch {
        if (!cancelled) mapDispatch({ type: 'location_failed', notice: t('trip.locationUnavailable') });
      }
    })();
    return () => { cancelled = true; };
  }, [visible, hintRegion, t]);

  const onRegionChange = useCallback((r: Region) => {
    regionRef.current = r;
    // If the user pans away from the searched spot, drop the typed name so it
    // isn't applied to a different coordinate. Epsilon scales with zoom level.
    const s = searchedRef.current;
    if (s) {
      const eps = Math.max(r.latitudeDelta * 0.15, 0.0008);
      if (Math.abs(r.latitude - s.latitude) > eps || Math.abs(r.longitude - s.longitude) > eps) {
        searchedRef.current = null;
      }
    }
  }, []);

  const handleSearch = async () => {
    const q = mapState.searchQuery.trim();
    if (!q) return;
    mapDispatch({ type: 'search_start' });
    try {
      const c = regionRef.current;
      const viewbox = `${c.longitude - 1},${c.latitude - 1},${c.longitude + 1},${c.latitude + 1}`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&viewbox=${viewbox}&bounded=0`,
        { headers: { 'User-Agent': 'Telaria-TFG/1.0' } },
      );
      if (!res.ok) throw new Error('search request failed');
      const data: NominatimResult[] = await res.json();
      if (!activeRef.current) return;
      if (data[0]) {
        const r = regionFromResult(data[0]);
        regionRef.current = r;
        searchedRef.current = { name: q, latitude: r.latitude, longitude: r.longitude };
        mapRef.current?.animateToRegion(r, 600);
        mapDispatch({ type: 'search_end' });
      } else {
        mapDispatch({ type: 'search_end', notice: t('trip.searchNoResults') });
      }
    } catch {
      if (activeRef.current) mapDispatch({ type: 'search_end', notice: t('trip.searchFailed') });
    }
  };

  const handleConfirm = async () => {
    mapDispatch({ type: 'confirm_start' });
    const { latitude, longitude } = regionRef.current;
    // Prefer the name the user typed (kept only while still centered on that spot).
    let name: string | undefined = searchedRef.current?.name;
    let address: string | undefined;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&namedetails=1`,
        { headers: { 'User-Agent': 'Telaria-TFG/1.0' } },
      );
      if (!res.ok) throw new Error('reverse request failed');
      const data = await res.json();
      if (data && !data.error) {
        const r = data as NominatimResult;
        if (!name) name = nominatimName(r);
        address = nominatimAddress(r);
      }
    } catch {}
    if (!activeRef.current) return;
    // Coordinates are always valid even if reverse geocoding failed, so confirm regardless.
    mapDispatch({ type: 'confirm_end' });
    onConfirm(latitude, longitude, name, address);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Map area: the center overlays below share these exact bounds, so the dot == map center */}
        <View style={{ flex: 1 }}>
        {mapState.ready ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
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

        {/* Decorative pin: its tip rests on the exact center dot below */}
        <View style={mapPicker.pinIcon} pointerEvents="none">
          <Ionicons name="location" size={40} color={tint} />
        </View>
        {/* Exact selected point — geometric center == map center == saved coordinate */}
        <View style={mapPicker.centerWrap} pointerEvents="none">
          <View style={[mapPicker.centerDot, { backgroundColor: tint }]} />
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
          <Pressable onPress={handleSearch} hitSlop={8} disabled={mapState.searching}>
            {mapState.searching
              ? <ActivityIndicator color={tint} size="small" />
              : <Ionicons name="search" size={20} color={tint} />}
          </Pressable>
        </View>

        {/* Inline notice (search/geolocation feedback) */}
        {mapState.notice && (
          <View style={[mapPicker.notice, { backgroundColor: theme.tabBackground }]} pointerEvents="none">
            <ThemedText style={{ color: theme.text, fontSize: 13 }}>{mapState.notice}</ThemedText>
          </View>
        )}

        {/* Top-left close button */}
        <Pressable style={[mapPicker.closeBtn, { backgroundColor: theme.tabBackground }]} onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={22} color={theme.icon} />
        </Pressable>

        </View>

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
  onStartConfirm: () => void;
  onCancelConfirm: () => void;
  onDelete: () => void;
};

const EventDetailModal = React.memo(function EventDetailModal({ detail, onClose, onStartConfirm, onCancelConfirm, onDelete }: EventDetailModalProps) {
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
              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>{t('trip.startTime')}</ThemedText>
                <ThemedText style={styles.detailValue}>{formatDateTime(detail.event.startTime)}</ThemedText>
              </View>
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

          {detail.confirming ? (
            <>
              <ThemedText style={styles.confirmText}>{t('trip.deleteEventConfirm')}</ThemedText>
              <View style={styles.modalButtons}>
                <Pressable style={[styles.modalBtn, styles.cancelBtn]} onPress={onCancelConfirm} disabled={detail.deleting}>
                  <ThemedText style={{ fontWeight: '600' }}>{t('common.cancel')}</ThemedText>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.deleteBtn]} onPress={onDelete} disabled={detail.deleting}>
                  {detail.deleting
                    ? <ActivityIndicator color="white" />
                    : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.delete')}</ThemedText>}
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalBtn, styles.deleteBtn]} onPress={onStartConfirm}>
                <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.delete')}</ThemedText>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: theme.tint }]} onPress={onClose}>
                <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.close')}</ThemedText>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});

function useLocationSearch(query: string, biasLat: number | null, biasLon: number | null) {
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const skipRef = useRef(false);

  useEffect(() => {
    if (skipRef.current) { skipRef.current = false; return; }
    const timer = setTimeout(() => setDebouncedQuery(query), 600);
    return () => clearTimeout(timer);
  }, [query]);

  const effectiveQuery = debouncedQuery.trim();
  const { data } = useQuery<NominatimResult[]>({
    queryKey: ['locationSearch', effectiveQuery, biasLat, biasLon],
    queryFn: async ({ signal }) => {
      const viewbox = biasLat != null && biasLon != null
        ? `&viewbox=${biasLon - 1},${biasLat - 1},${biasLon + 1},${biasLat + 1}&bounded=0`
        : '';
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(effectiveQuery)}&format=json&addressdetails=1&namedetails=1&limit=5${viewbox}`,
        { headers: { 'User-Agent': 'Telaria-TFG/1.0' }, signal },
      );
      if (!res.ok) throw new Error('location search failed');
      return res.json();
    },
    enabled: effectiveQuery.length >= 3,
    staleTime: 30_000,
  });

  const suggestions = query.trim().length < 3 ? [] : (data ?? []);
  const skipNext = useCallback(() => { skipRef.current = true; setDebouncedQuery(''); }, []);
  const clearSuggestions = useCallback(() => setDebouncedQuery(''), []);
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

  return (
    // Hidden while the map picker is open so the MapView is never inside a nested Modal (Android transparency bug).
    <Modal visible={create.visible && !create.mapPickerOpen} transparent animationType="slide" onRequestClose={() => createDispatch({ type: 'close' })}>
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
                  onDayPress={(key) => createDispatch({ type: 'pick_date', key })}
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
                      const { latitude, longitude } = nominatimCoords(r);
                      createDispatch({
                        type: 'select_place',
                        latitude,
                        longitude,
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

// ── Selected-day documents ──────────────────────────────────────────────────────
const EMPTY_DOCS: DocumentResponse[] = [];

type SelectedDayDocumentsProps = {
  docs: DocumentResponse[];
  dateLabel: string;
  theme: typeof Colors.light;
  onOpenDoc: (doc: DocumentResponse) => void;
};
const SelectedDayDocuments = React.memo(function SelectedDayDocuments({ docs, dateLabel, theme, onOpenDoc }: SelectedDayDocumentsProps) {
  const { t } = useTranslation();
  const [popupOpen, setPopupOpen] = useState(false);

  if (docs.length === 0) return null;

  const preview = docs.slice(0, 3);
  const remaining = docs.length - preview.length;

  const renderPopupItem = ({ item }: { item: DocumentResponse }) => (
    <View style={daydoc.cell}>
      <DocGridCard item={item} background={theme.background} tint={theme.tint} onPress={onOpenDoc} />
    </View>
  );

  return (
    <View style={daydoc.wrap}>
      <ThemedText style={daydoc.label}>{t('trip.dayDocuments')}</ThemedText>
      <View style={daydoc.grid}>
        {preview.map(doc => (
          <View key={doc.id} style={daydoc.cell}>
            <DocGridCard item={doc} background={theme.tabBackground} tint={theme.tint} onPress={onOpenDoc} />
          </View>
        ))}
        {remaining > 0 && (
          <View style={daydoc.cell}>
            <Pressable
              style={[daydoc.moreTile, { backgroundColor: theme.tabBackground }]}
              onPress={() => setPopupOpen(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={28} color={theme.tint} />
              <ThemedText style={[daydoc.moreText, { color: theme.tint }]}>
                {t('trip.documentsMore', { count: remaining })}
              </ThemedText>
            </Pressable>
          </View>
        )}
      </View>

      <Modal visible={popupOpen} transparent animationType="fade" onRequestClose={() => setPopupOpen(false)}>
        <Pressable style={daydoc.popupOverlay} onPress={() => setPopupOpen(false)}>
          <Pressable onPress={() => {}} style={[daydoc.popupBox, { backgroundColor: theme.tabBackground }]}>
            <View style={daydoc.popupHeader}>
              <ThemedText style={daydoc.popupTitle}>{t('trip.allDocumentsTitle', { date: dateLabel })}</ThemedText>
              <Pressable onPress={() => setPopupOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={theme.icon} />
              </Pressable>
            </View>
            <FlatList
              data={docs}
              keyExtractor={d => d.id}
              numColumns={2}
              columnWrapperStyle={daydoc.popupRow}
              contentContainerStyle={daydoc.popupContent}
              renderItem={renderPopupItem}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

const daydoc = StyleSheet.create({
  wrap: { marginTop: 8, gap: 8 },
  label: { fontSize: 13, fontWeight: '700', opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '47%' },
  moreTile: {
    flex: 1, borderRadius: 12, padding: 14,
    alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 110,
  },
  moreText: { fontSize: 13, fontWeight: '600' },
  popupOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  popupBox: { borderRadius: 16, padding: 16, maxHeight: '80%' },
  popupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  popupTitle: { fontSize: 18, fontWeight: '700' },
  popupRow: { gap: 10 },
  popupContent: { gap: 10, paddingBottom: 8 },
});

// ── Calendar tab ──────────────────────────────────────────────────────────────
type CalendarTabProps = {
  calState: CalState;
  calDispatch: React.Dispatch<CalAction>;
  isLoading: boolean;
  eventsByDay: Record<string, EventSummary[]>;
  agendaDays: { upcoming: string[]; past: string[] };
  todayKey: string;
  theme: typeof Colors.light;
  selectedDayDocs: DocumentResponse[];
  selectedDayLabel: string;
  formatSectionDate: (k: string) => string;
  t: (key: string) => string;
  onEventPress: (ev: EventSummary) => void;
  onOpenDoc: (doc: DocumentResponse) => void;
};
const CalendarTab = React.memo(function CalendarTab({
  calState, calDispatch, isLoading, eventsByDay, agendaDays,
  todayKey, theme, selectedDayDocs, selectedDayLabel, formatSectionDate, t, onEventPress, onOpenDoc,
}: CalendarTabProps) {
  const { collapsed, selectedKey } = calState;
  const selectedHasDocs = selectedDayDocs.length > 0;

  // The selected day gets its own dated section even when it has no events, so its
  // documents render inside the event list for that date (not floating on top).
  const upcomingDays = useMemo(() => {
    const set = new Set(agendaDays.upcoming);
    if (selectedHasDocs && selectedKey >= todayKey) set.add(selectedKey);
    return [...set].sort();
  }, [agendaDays.upcoming, selectedHasDocs, selectedKey, todayKey]);
  const pastDays = useMemo(() => {
    const set = new Set(agendaDays.past);
    if (selectedHasDocs && selectedKey < todayKey) set.add(selectedKey);
    return [...set].sort().reverse();
  }, [agendaDays.past, selectedHasDocs, selectedKey, todayKey]);

  const setCollapsed = useCallback((value: boolean) => {
    calDispatch({ type: 'set_collapsed', value });
  }, [calDispatch]);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderRelease: (_, g) => {
      if (g.dy < -12) setCollapsed(true);
      else if (g.dy > 12) setCollapsed(false);
    },
  }), [setCollapsed]);

  // Pull past the top of the list while collapsed → expand back to the month view.
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (collapsed && e.nativeEvent.contentOffset.y < -40) setCollapsed(false);
  }, [collapsed, setCollapsed]);

  // Selected day always appears first; remaining upcoming then remaining past follow.
  const orderedSections = useMemo(() => {
    const sections: { key: string; isPast: boolean }[] = [];
    const inUpcoming = upcomingDays.includes(selectedKey);
    const inPast = pastDays.includes(selectedKey);
    if (inUpcoming) sections.push({ key: selectedKey, isPast: false });
    else if (inPast) sections.push({ key: selectedKey, isPast: true });
    for (const k of upcomingDays) if (k !== selectedKey) sections.push({ key: k, isPast: false });
    for (const k of pastDays) if (k !== selectedKey) sections.push({ key: k, isPast: true });
    return sections;
  }, [upcomingDays, pastDays, selectedKey]);

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 100 }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      alwaysBounceVertical
      overScrollMode="always"
    >
      <MiniCal
        year={calState.year}
        month={calState.month}
        selectedKey={calState.selectedKey}
        eventDots={isLoading ? EMPTY_EVENT_DOTS : Object.fromEntries(Object.entries(eventsByDay).map(([k, v]) => [k, v.length]))}
        tint={theme.tint}
        todayKey={todayKey}
        collapsed={collapsed}
        onPrevMonth={() => calDispatch({ type: collapsed ? 'prev_week' : 'prev_month' })}
        onNextMonth={() => calDispatch({ type: collapsed ? 'next_week' : 'next_month' })}
        onDayPress={(key) => calDispatch({ type: 'select_day', key })}
      />

      {/* Drag handle: swipe up / tap to collapse the calendar to the current week */}
      <View style={cal.handleWrap} {...panResponder.panHandlers}>
        <Pressable
          style={cal.handleHit}
          hitSlop={10}
          onPress={() => setCollapsed(!collapsed)}
        >
          <View style={[cal.handleBar, { backgroundColor: theme.icon }]} />
          <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={16} color={theme.icon} />
        </Pressable>
      </View>

      <View style={styles.agenda}>
        {isLoading ? (
          <ActivityIndicator size="small" color={theme.tint} style={{ marginTop: 12 }} />
        ) : orderedSections.length === 0 ? (
          <ThemedText style={styles.emptyText}>{t('trip.noEvents')}</ThemedText>
        ) : (
          <>
            {orderedSections.map(({ key: k, isPast }) => (
              <View key={k}>
                <View style={[styles.agendaDayHeader, k === selectedKey && { borderLeftColor: theme.tint, borderLeftWidth: 3 }]}>
                  <ThemedText style={[styles.agendaDayText, k === selectedKey && { color: theme.tint }]}>
                    {formatSectionDate(k)}
                  </ThemedText>
                </View>
                <View style={{ gap: 8 }}>
                  {(eventsByDay[k] ?? []).map(ev => (
                    <EventCard key={ev.id} ev={ev} isPast={isPast} theme={theme} formatTime={formatTime} formatDateTime={formatDateTime} formatDuration={formatDuration} onPress={onEventPress} />
                  ))}
                </View>
                {k === selectedKey && (
                  <SelectedDayDocuments docs={selectedDayDocs} dateLabel={selectedDayLabel} theme={theme} onOpenDoc={onOpenDoc} />
                )}
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
});

// ── Main screen ────────────────────────────────────────────────────────────────
const EventsScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip } = useTrip();
  const eventsQuery = useEventsQuery(trip?.id ?? '');
  const addEventMutation = useAddEventMutation(trip?.id ?? '');
  const deleteEventMutation = useDeleteEventMutation(trip?.id ?? '');
  const { getDocumentDownloadUrl } = useDocuments();
  const deleteDocumentMutation = useDeleteDocumentMutation(trip?.id ?? '');
  const navigation = useNavigation();

  const [docDetail, docDetailDispatch] = useReducer(docDetailReducer, DOC_DETAIL_INITIAL);

  const memberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of trip?.members ?? []) map[m.id] = m.username;
    return map;
  }, [trip?.members]);

  const { data: docDetailFallbackUrl } = useDocumentDownloadQuery(
    trip?.id ?? '',
    docDetail.doc?.id ?? '',
    { enabled: !!docDetail.doc && isImageFile(docDetail.doc.name) && !docDetail.doc.previewUrl },
  );
  const docDetailImageUrl = docDetail.doc?.previewUrl ?? docDetailFallbackUrl ?? null;

  const openDoc = useCallback((doc: DocumentResponse) => {
    docDetailDispatch({ type: 'open', doc });
  }, []);

  const handleDocDownload = async () => {
    if (!trip?.id || !docDetail.doc) return;
    docDetailDispatch({ type: 'start_download' });
    try {
      const url = await getDocumentDownloadUrl(trip.id, docDetail.doc.id);
      await Linking.openURL(url);
    } catch {
      docDetailDispatch({ type: 'set_error', error: t('trip.downloadError') });
    } finally {
      docDetailDispatch({ type: 'end_download' });
    }
  };

  const handleDocDelete = async () => {
    if (!docDetail.doc) return;
    docDetailDispatch({ type: 'start_delete' });
    try {
      await deleteDocumentMutation.mutateAsync(docDetail.doc.id);
      docDetailDispatch({ type: 'close' });
    } catch {
      docDetailDispatch({ type: 'set_error', error: t('trip.deleteDocumentError') });
    } finally {
      docDetailDispatch({ type: 'end_delete' });
    }
  };

  const [calState, calDispatch] = useReducer(calReducer, undefined, () => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), selectedKey: dateKey(now), collapsed: false };
  });
  const [detail, detailDispatch] = useReducer(detailReducer, { visible: false, event: null, confirming: false, deleting: false, error: null });
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

  const selectedDayDocsQuery = useDocumentsByDateQuery(trip?.id ?? '', calState.selectedKey);
  const selectedDayDocs = useMemo(() => {
    const list = selectedDayDocsQuery.data ?? EMPTY_DOCS;
    return [...list].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }, [selectedDayDocsQuery.data]);

  useEffect(() => {
    if (trip?.name) navigation.setOptions({ title: trip.name });
  }, [trip?.name, navigation]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, EventSummary[]> = {};
    for (const ev of eventsQuery.data ?? []) {
      const k = dateKey(new Date(ev.startTime));
      (map[k] ??= []).push(ev);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [eventsQuery.data]);

  const agendaDays = useMemo(() => {
    const all = Object.keys(eventsByDay).sort();
    const upcoming = all.filter(d => d >= todayKey);
    const past = all.filter(d => d < todayKey).reverse();
    return { upcoming, past };
  }, [eventsByDay, todayKey]);

  const hintRegion = useMemo((): Region | null => {
    const withCoords = (eventsQuery.data ?? []).filter(e => e.location?.latitude != null && e.location?.longitude != null);
    if (withCoords.length === 0) return null;
    const sorted = [...withCoords].sort((a, b) => b.startTime.localeCompare(a.startTime));
    const ev = sorted[0];
    return { latitude: ev.location!.latitude!, longitude: ev.location!.longitude!, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }, [eventsQuery.data]);

  const formatSectionDate = (k: string) => {
    const tomorrow = dateKey(new Date(today.getTime() + 86_400_000));
    if (k === todayKey) return t('trip.today');
    if (k === tomorrow) return t('trip.tomorrow');
    const d = new Date(k + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Relative label used in the documents popup title: "today" / "yesterday" / "15 of June".
  const formatDayLabel = (k: string) => {
    const yesterday = dateKey(new Date(today.getTime() - 86_400_000));
    if (k === todayKey) return t('trip.today');
    if (k === yesterday) return t('trip.yesterday');
    const d = new Date(k + 'T00:00:00');
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  };
  const selectedDayLabel = formatDayLabel(calState.selectedKey);

  const handleCreate = async () => {
    if (!trip?.id) return;
    if (!create.evName.trim()) { createDispatch({ type: 'set_error', error: t('trip.fillAllRequiredFields') }); return; }
    if (!create.pickedDate) { createDispatch({ type: 'set_error', error: t('trip.dateRequired') }); return; }
    createDispatch({ type: 'start_creating' });
    try {
      const d = new Date(`${create.pickedDate}T00:00:00`);
      d.setHours(create.pickHour, create.pickMinute, 0, 0);
      const payload: Parameters<typeof addEventMutation.mutateAsync>[0] = {
        name: create.evName.trim(),
        startTime: d.toISOString(),
      };
      const dur = parseInt(create.duration, 10);
      if (Number.isFinite(dur) && dur > 0) payload.duration = dur;
      if (create.locationName.trim() || create.locationAddress.trim() || create.latitude !== null) {
        payload.location = {};
        if (create.locationName.trim()) payload.location.name = create.locationName.trim();
        if (create.locationAddress.trim()) payload.location.address = create.locationAddress.trim();
        if (create.latitude !== null && create.longitude !== null) {
          payload.location.latitude = create.latitude;
          payload.location.longitude = create.longitude;
        }
      }
      await addEventMutation.mutateAsync(payload);
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

  const handleMapConfirm = useCallback((lat: number, lng: number, name?: string, address?: string) => {
    createDispatch({ type: 'set_coords', latitude: lat, longitude: lng, name, address });
  }, []);
  const handleMapClose = useCallback(() => createDispatch({ type: 'close_map_picker' }), []);

  const handleDelete = async () => {
    if (!trip?.id || !detail.event) return;
    detailDispatch({ type: 'start_delete' });
    try {
      await deleteEventMutation.mutateAsync(detail.event.id);
      detailDispatch({ type: 'close' });
    } catch {
      detailDispatch({ type: 'set_error', error: t('trip.deleteEventError') });
    } finally {
      detailDispatch({ type: 'end_delete' });
    }
  };

  const handleDetailClose = useCallback(() => detailDispatch({ type: 'close' }), []);
  const handleStartConfirm = useCallback(() => detailDispatch({ type: 'start_confirm' }), []);
  const handleCancelConfirm = useCallback(() => detailDispatch({ type: 'cancel_confirm' }), []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {eventsQuery.isError ? (
        <ThemedText style={styles.emptyText}>{t('trip.unableLoadEvents')}</ThemedText>
      ) : (
        <CalendarTab
          calState={calState}
          calDispatch={calDispatch}
          isLoading={eventsQuery.isLoading}
          eventsByDay={eventsByDay}
          agendaDays={agendaDays}
          todayKey={todayKey}
          theme={theme}
          selectedDayDocs={selectedDayDocs}
          selectedDayLabel={selectedDayLabel}
          formatSectionDate={formatSectionDate}
          t={t}
          onEventPress={handleEventPress}
          onOpenDoc={openDoc}
        />
      )}

      {/* FAB */}
      {!eventsQuery.isError && (
        <Pressable
          style={[styles.fab, { backgroundColor: theme.tint }]}
          onPress={() => createDispatch({ type: 'open', key: calState.selectedKey })}
        >
          <Ionicons name="add" size={28} color="white" />
        </Pressable>
      )}

      <EventDetailModal
        detail={detail}
        onClose={handleDetailClose}
        onStartConfirm={handleStartConfirm}
        onCancelConfirm={handleCancelConfirm}
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

      {/* Rendered at screen root (not nested in the create Modal) to avoid the Android map transparency bug */}
      <MapPickerModal
        visible={create.mapPickerOpen}
        tint={theme.tint}
        hintRegion={hintRegion}
        onConfirm={handleMapConfirm}
        onClose={handleMapClose}
      />

      <DocumentDetailModal
        detail={docDetail}
        detailDispatch={docDetailDispatch}
        detailImageUrl={docDetailImageUrl}
        memberMap={memberMap}
        onDownload={handleDocDownload}
        onDelete={handleDocDelete}
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
  handleWrap: { alignItems: 'center', paddingTop: 6, paddingBottom: 2 },
  handleHit: { alignItems: 'center', gap: 4, paddingHorizontal: 40, paddingVertical: 4 },
  handleBar: { width: 36, height: 4, borderRadius: 2, opacity: 0.4 },
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

  agenda: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  agendaDayHeader: {
    paddingLeft: 10,
    paddingVertical: 6,
    borderLeftWidth: 0,
    borderLeftColor: 'transparent',
    marginBottom: 6,
  },
  agendaDayText: { fontSize: 13, fontWeight: '700', opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.5 },

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
  deleteBtn: { backgroundColor: Colors.warning },
  errorText: { color: Colors.warning, marginBottom: 8, textAlign: 'center' },
  confirmText: { textAlign: 'center', fontWeight: '600', marginBottom: 12, marginTop: 4 },

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
  pinIcon: { position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -20, pointerEvents: 'none' },
  centerWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  centerDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: 'white' },
  closeBtn: { position: 'absolute', top: 48, left: 16, padding: 8, borderRadius: 20, boxShadow: '0px 2px 4px rgba(0,0,0,0.15)' },
  searchRow: { position: 'absolute', top: 48, left: 64, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, boxShadow: '0px 2px 4px rgba(0,0,0,0.15)' },
  searchInput: { flex: 1, fontSize: 15 },
  notice: { position: 'absolute', top: 100, left: 16, right: 16, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, boxShadow: '0px 2px 4px rgba(0,0,0,0.15)' },
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
