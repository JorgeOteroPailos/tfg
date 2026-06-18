import React, { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  StyleSheet, View, FlatList, ActivityIndicator,
  Pressable, Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useDocuments, useDocumentsQuery, useDocumentDownloadQuery, useUploadDocumentMutation, useDeleteDocumentMutation, type DocumentResponse } from '../../../src/documents';
import { useTrip } from '../../../src/trips';
import { uploadToUrl } from '../../../src/upload';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../../../components/ThemedText';
import { DocGridCard, DocumentDetailModal } from '../../../src/documentCards';
import {
  detailReducer, DETAIL_INITIAL,
  isImageFile, fileIcon, formatDate,
} from '../../../src/documentCards.helpers';

const EMPTY_DOCS: DocumentResponse[] = [];

interface DocCardProps {
  item: DocumentResponse;
  background: string;
  tint: string;
  icon: string;
  memberName?: string;
  onPress: (item: DocumentResponse) => void;
}

const DocCard = React.memo(function DocCard({ item, background, tint, icon, memberName, onPress }: DocCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.docCard, { backgroundColor: background, opacity: pressed ? 0.75 : 1 }]}
      onPress={() => onPress(item)}
    >
      <Ionicons name={fileIcon(item.name)} size={30} color={tint} />
      <View style={styles.docInfo}>
        <ThemedText style={styles.docName} numberOfLines={1}>{item.name}</ThemedText>
        <ThemedText style={styles.docMeta}>
          {formatDate(item.uploadedAt)}
        </ThemedText>
        {memberName && (
          <ThemedText style={styles.docUploader}>{memberName}</ThemedText>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={icon} />
    </Pressable>
  );
});

// ── Filter chip ───────────────────────────────────────────────────────────────
type FilterChipProps = { ext: string; selected: boolean; tint: string; onPress: (ext: string) => void };
const FilterChip = React.memo(function FilterChip({ ext, selected, tint, onPress }: FilterChipProps) {
  const handlePress = useCallback(() => onPress(ext), [onPress, ext]);
  return (
    <Pressable
      style={selected ? [styles.chip, { backgroundColor: tint }] : styles.chip}
      onPress={handlePress}
    >
      <ThemedText style={selected ? [styles.chipText, { color: 'white' as const }] : styles.chipText}>
        {ext.toUpperCase()}
      </ThemedText>
    </Pressable>
  );
});

// ── UI state reducer ──────────────────────────────────────────────────────────
type UIState = {
  upload: { uploading: boolean; error: string | null };
  filterExt: string | null;
  sortOrder: 'desc' | 'asc';
  showFilters: boolean;
  viewMode: 'list' | 'grid';
};
type UIAction =
  | { type: 'upload_start' }
  | { type: 'upload_done' }
  | { type: 'upload_error'; error: string }
  | { type: 'upload_clear_error' }
  | { type: 'set_filter_ext'; ext: string | null }
  | { type: 'toggle_sort' }
  | { type: 'toggle_filters' }
  | { type: 'set_view_mode'; mode: 'list' | 'grid' };

const UI_INITIAL: UIState = { upload: { uploading: false, error: null }, filterExt: null, sortOrder: 'desc', showFilters: false, viewMode: 'grid' };

function uiReducer(s: UIState, a: UIAction): UIState {
  switch (a.type) {
    case 'upload_start': return { ...s, upload: { uploading: true, error: null } };
    case 'upload_done': return { ...s, upload: { ...s.upload, uploading: false } };
    case 'upload_error': return { ...s, upload: { uploading: false, error: a.error } };
    case 'upload_clear_error': return { ...s, upload: { ...s.upload, error: null } };
    case 'set_filter_ext': return { ...s, filterExt: a.ext };
    case 'toggle_sort': return { ...s, sortOrder: s.sortOrder === 'desc' ? 'asc' : 'desc' };
    case 'toggle_filters': return { ...s, showFilters: !s.showFilters };
    case 'set_view_mode': return { ...s, viewMode: a.mode };
    default: return s;
  }
}

// ── Main screen ────────────────────────────────────────────────────────────────
const DocumentsScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip } = useTrip();
  const { getDocumentDownloadUrl } = useDocuments();
  const documentsQuery = useDocumentsQuery(trip?.id ?? '');
  const uploadMutation = useUploadDocumentMutation(trip?.id ?? '');
  const deleteMutation = useDeleteDocumentMutation(trip?.id ?? '');
  const navigation = useNavigation();

  const [ui, uiDispatch] = useReducer(uiReducer, UI_INITIAL);
  const [detail, detailDispatch] = useReducer(detailReducer, DETAIL_INITIAL);

  const memberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of trip?.members ?? []) map[m.id] = m.username;
    return map;
  }, [trip?.members]);

  const { data: detailFallbackUrl } = useDocumentDownloadQuery(
    trip?.id ?? '',
    detail.doc?.id ?? '',
    { enabled: !!detail.doc && isImageFile(detail.doc.name) && !detail.doc.previewUrl },
  );
  const detailImageUrl = detail.doc?.previewUrl ?? detailFallbackUrl ?? null;

  const docs = documentsQuery.data ?? EMPTY_DOCS;

  const availableExtensions = useMemo(() => {
    const exts = new Set<string>();
    for (const doc of docs) {
      const ext = doc.name.split('.').pop()?.toLowerCase();
      if (ext) exts.add(ext);
    }
    return Array.from(exts).sort();
  }, [docs]);

  const filteredDocuments = useMemo(() => {
    let filtered = docs;
    if (ui.filterExt !== null) filtered = filtered.filter(d => d.name.split('.').pop()?.toLowerCase() === ui.filterExt);
    return [...filtered].sort((a, b) => {
      const diff = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      return ui.sortOrder === 'asc' ? diff : -diff;
    });
  }, [docs, ui.filterExt, ui.sortOrder]);

  const isFiltered = ui.filterExt !== null || ui.sortOrder !== 'desc';

  useEffect(() => {
    if (trip?.name) navigation.setOptions({ title: trip.name });
  }, [trip?.name, navigation]);

  useEffect(() => {
    if (!ui.upload.error) return;
    const timer = setTimeout(() => uiDispatch({ type: 'upload_clear_error' }), 4000);
    return () => clearTimeout(timer);
  }, [ui.upload.error]);

  const handleUpload = async () => {
    if (!trip?.id) return;

    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;

    const file = result.assets[0];
    const contentType = file.mimeType ?? 'application/octet-stream';

    uiDispatch({ type: 'upload_start' });
    try {
      await uploadMutation.mutateAsync({
        request: { name: file.name, contentType },
        fileUri: file.uri,
        contentType,
        uploadToUrl,
      });
    } catch {
      uiDispatch({ type: 'upload_error', error: t('trip.uploadError') });
    } finally {
      uiDispatch({ type: 'upload_done' });
    }
  };

  const handleDownload = async () => {
    if (!trip?.id || !detail.doc) return;
    detailDispatch({ type: 'start_download' });
    try {
      const url = await getDocumentDownloadUrl(trip.id, detail.doc.id);
      await Linking.openURL(url);
    } catch {
      detailDispatch({ type: 'set_error', error: t('trip.downloadError') });
    } finally {
      detailDispatch({ type: 'end_download' });
    }
  };

  const handleDelete = async () => {
    if (!detail.doc) return;
    detailDispatch({ type: 'start_delete' });
    try {
      await deleteMutation.mutateAsync(detail.doc.id);
      detailDispatch({ type: 'close' });
    } catch {
      detailDispatch({ type: 'set_error', error: t('trip.deleteDocumentError') });
    } finally {
      detailDispatch({ type: 'end_delete' });
    }
  };

  const openDetail = useCallback((doc: DocumentResponse) => {
    detailDispatch({ type: 'open', doc });
  }, []);

  const handleFilterChipPress = useCallback((ext: string) => {
    uiDispatch({ type: 'set_filter_ext', ext: ui.filterExt === ext ? null : ext });
  }, [ui.filterExt]);

  const renderFilterChip = useCallback(({ item: ext }: { item: string }) => (
    <FilterChip ext={ext} selected={ui.filterExt === ext} tint={theme.tint} onPress={handleFilterChipPress} />
  ), [ui.filterExt, theme.tint, handleFilterChipPress]);

  const renderDocumentItem = useCallback(({ item }: { item: DocumentResponse }) => (
    ui.viewMode === 'grid'
      ? <DocGridCard item={item} background={theme.tabBackground} tint={theme.tint} onPress={openDetail} />
      : <DocCard item={item} background={theme.tabBackground} tint={theme.tint} icon={theme.icon} memberName={memberMap[item.uploaderId]} onPress={openDetail} />
  ), [ui.viewMode, theme.tabBackground, theme.tint, theme.icon, memberMap, openDetail]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {documentsQuery.isLoading ? (
        <ActivityIndicator size="large" color={theme.tint} style={styles.centered} />
      ) : documentsQuery.isError ? (
        <ThemedText style={styles.emptyText}>{t('trip.unableLoadDocuments')}</ThemedText>
      ) : (
        <>
          {docs.length > 0 && (
            <View style={[styles.filterBar, { backgroundColor: theme.background, zIndex: 10 }]}>
              <View style={styles.filterLeft}>
                <Pressable style={styles.toolbarBtn} onPress={() => uiDispatch({ type: 'toggle_filters' })}>
                  <Ionicons
                    name={ui.showFilters ? 'options' : 'options-outline'}
                    size={22}
                    color={isFiltered ? theme.tint : theme.icon}
                  />
                </Pressable>
                {ui.showFilters && (
                  <>
                    <FlatList
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.extChips}
                      contentContainerStyle={styles.extChipsContent}
                      data={availableExtensions}
                      keyExtractor={item => item}
                      ListHeaderComponent={
                        <Pressable
                          style={[styles.chip, ui.filterExt === null && { backgroundColor: theme.tint }]}
                          onPress={() => uiDispatch({ type: 'set_filter_ext', ext: null })}
                        >
                          <ThemedText style={[styles.chipText, ui.filterExt === null && { color: 'white' }]}>{t('trip.filterAll')}</ThemedText>
                        </Pressable>
                      }
                      renderItem={renderFilterChip}
                    />
                    <Pressable
                      style={[styles.sortBtn, { borderColor: theme.icon + '55' }]}
                      onPress={() => uiDispatch({ type: 'toggle_sort' })}
                    >
                      <Ionicons name={ui.sortOrder === 'desc' ? 'arrow-down' : 'arrow-up'} size={14} color={theme.tint} />
                      <ThemedText style={[styles.sortBtnText, { color: theme.tint }]}>
                        {t(ui.sortOrder === 'desc' ? 'trip.sortNewest' : 'trip.sortOldest')}
                      </ThemedText>
                    </Pressable>
                    <Pressable style={styles.toolbarBtn} onPress={() => uiDispatch({ type: 'set_view_mode', mode: 'list' })}>
                      <Ionicons name="list" size={20} color={ui.viewMode === 'list' ? theme.tint : theme.icon} />
                    </Pressable>
                    <Pressable style={styles.toolbarBtn} onPress={() => uiDispatch({ type: 'set_view_mode', mode: 'grid' })}>
                      <Ionicons name="grid" size={20} color={ui.viewMode === 'grid' ? theme.tint : theme.icon} />
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          )}
          <FlatList
            key={ui.viewMode}
            data={filteredDocuments}
            keyExtractor={item => item.id}
            numColumns={ui.viewMode === 'grid' ? 2 : 1}
            columnWrapperStyle={ui.viewMode === 'grid' ? styles.gridRow : undefined}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="folder-outline" size={64} color={theme.icon} style={{ opacity: 0.4 }} />
                <ThemedText style={styles.emptyText}>{t('trip.noDocuments')}</ThemedText>
              </View>
            }
            renderItem={renderDocumentItem}
          />
        </>
      )}

      {!documentsQuery.isLoading && !documentsQuery.isError && (
        <Pressable
          style={[styles.fab, { backgroundColor: ui.upload.uploading ? theme.icon : theme.tint }]}
          onPress={handleUpload}
          disabled={ui.upload.uploading}
        >
          {ui.upload.uploading
            ? <ActivityIndicator color="white" />
            : <Ionicons name="add" size={28} color="white" />}
        </Pressable>
      )}

      {ui.upload.error && (
        <View style={styles.toast}>
          <ThemedText style={styles.toastText}>{ui.upload.error}</ThemedText>
        </View>
      )}

      <DocumentDetailModal
        detail={detail}
        detailDispatch={detailDispatch}
        detailImageUrl={detailImageUrl ?? null}
        memberMap={memberMap}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
    </View>
  );
};

export default DocumentsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 100, gap: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 15, opacity: 0.6 },

  toolbarBtn: {
    padding: 6,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  filterLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  extChips: { flex: 1 },
  extChipsContent: { gap: 6, flexDirection: 'row', alignItems: 'center' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  sortBtnText: { fontSize: 13, fontWeight: '500' },

  gridRow: { gap: 10 },

  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  docInfo: { flex: 1 },
  docName: { fontSize: 15, fontWeight: '600' },
  docMeta: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  docUploader: { fontSize: 12, opacity: 0.5, marginTop: 1 },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
  },

  toast: {
    position: 'absolute', bottom: 96, left: 24, right: 24,
    backgroundColor: '#d9534f', padding: 12, borderRadius: 8, alignItems: 'center',
  },
  toastText: { color: 'white', fontWeight: '600' },
});
