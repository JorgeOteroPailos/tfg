import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  StyleSheet, View, FlatList, ActivityIndicator,
  Pressable, Modal, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useNavigation } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useAppTheme } from '../../../src/theme';
import { Colors } from '../../../constants/Colors';
import { useDocuments, type DocumentResponse } from '../../../src/documents';
import { useTrip } from '../../../src/trips';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../../../components/ThemedText';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function fileIcon(name: string): React.ComponentProps<typeof Ionicons>['name'] {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'document-text-outline';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext ?? '')) return 'image-outline';
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext ?? '')) return 'videocam-outline';
  return 'document-outline';
}

function uploadToUrl(uploadUrl: string, fileUri: string, contentType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`XHR status ${xhr.status}: ${xhr.responseText}`));
    };
    xhr.onerror = () => {
      console.error('[upload] XHR network error');
      reject(new Error('Network error'));
    };
    xhr.send({ uri: fileUri, type: contentType, name: 'file' } as any);
  });
}

interface DocCardProps {
  item: DocumentResponse;
  background: string;
  tint: string;
  icon: string;
  memberName?: string;
  onPress: (item: DocumentResponse) => void;
}
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']);
const imageUrlCache = new Map<string, string>();

function isImageFile(name: string) {
  return IMAGE_EXTS.has(name.split('.').pop()?.toLowerCase() ?? '');
}

const DocGridCard = React.memo(function DocGridCard({ item, background, tint, onPress }: Pick<DocCardProps, 'item' | 'background' | 'tint' | 'onPress'>) {
  const { getDocumentDownloadUrl } = useDocuments();
  const { trip } = useTrip();
  const isImage = isImageFile(item.name);
  const [imageUri, setImageUri] = useState<string | null>(() => imageUrlCache.get(item.id) ?? null);

  useEffect(() => {
    if (!isImage || !trip?.id || imageUri) return;
    getDocumentDownloadUrl(trip.id, item.id)
      .then(url => { imageUrlCache.set(item.id, url); setImageUri(url); })
      .catch(() => {});
  }, [isImage, trip?.id, item.id, getDocumentDownloadUrl, imageUri]);

  return (
    <Pressable
      style={({ pressed }) => [styles.gridCard, { backgroundColor: background, opacity: pressed ? 0.75 : 1 }]}
      onPress={() => onPress(item)}
    >
      {isImage && imageUri ? (
        <>
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.gridImageOverlay}>
            <ThemedText style={styles.gridImageName} numberOfLines={1}>{item.name}</ThemedText>
          </View>
        </>
      ) : (
        <>
          <Ionicons name={fileIcon(item.name)} size={36} color={tint} />
          <ThemedText style={styles.gridName} numberOfLines={2}>{item.name}</ThemedText>
          <ThemedText style={styles.gridMeta}>{formatDate(item.uploadedAt)}</ThemedText>
        </>
      )}
    </Pressable>
  );
});

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

// --- Document list state ---
type ListState = { documents: DocumentResponse[] | null; loading: boolean; error: string | null };
type ListAction =
  | { type: 'loading' }
  | { type: 'loaded'; documents: DocumentResponse[] }
  | { type: 'error'; error: string }
  | { type: 'remove'; id: string };

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case 'loading': return { ...state, loading: true, error: null };
    case 'loaded': return { documents: action.documents, loading: false, error: null };
    case 'error': return { ...state, loading: false, error: action.error };
    case 'remove': return { ...state, documents: state.documents ? state.documents.filter(d => d.id !== action.id) : state.documents };
    default: return state;
  }
}

// --- Detail modal state ---
type DetailState = { visible: boolean; doc: DocumentResponse | null; downloading: boolean; deleting: boolean; error: string | null };
type DetailAction =
  | { type: 'open'; doc: DocumentResponse }
  | { type: 'close' }
  | { type: 'start_download' }
  | { type: 'end_download' }
  | { type: 'start_delete' }
  | { type: 'end_delete' }
  | { type: 'set_error'; error: string };

const DETAIL_INITIAL: DetailState = { visible: false, doc: null, downloading: false, deleting: false, error: null };

function detailReducer(state: DetailState, action: DetailAction): DetailState {
  switch (action.type) {
    case 'open': return { visible: true, doc: action.doc, downloading: false, deleting: false, error: null };
    case 'close': return DETAIL_INITIAL;
    case 'start_download': return { ...state, downloading: true, error: null };
    case 'end_download': return { ...state, downloading: false };
    case 'start_delete': return { ...state, deleting: true, error: null };
    case 'end_delete': return { ...state, deleting: false };
    case 'set_error': return { ...state, error: action.error };
    default: return state;
  }
}

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
  detailImageUrl: string | null;
};
type UIAction =
  | { type: 'upload_start' }
  | { type: 'upload_done' }
  | { type: 'upload_error'; error: string }
  | { type: 'upload_clear_error' }
  | { type: 'set_filter_ext'; ext: string | null }
  | { type: 'toggle_sort' }
  | { type: 'toggle_filters' }
  | { type: 'set_view_mode'; mode: 'list' | 'grid' }
  | { type: 'set_detail_image'; url: string | null };

const UI_INITIAL: UIState = { upload: { uploading: false, error: null }, filterExt: null, sortOrder: 'desc', showFilters: false, viewMode: 'grid', detailImageUrl: null };

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
    case 'set_detail_image': return { ...s, detailImageUrl: a.url };
    default: return s;
  }
}

// ── Detail modal ───────────────────────────────────────────────────────────────
type DocumentDetailModalProps = {
  detail: DetailState;
  detailDispatch: React.Dispatch<DetailAction>;
  detailImageUrl: string | null;
  memberMap: Record<string, string>;
  onDownload: () => void;
  onDelete: () => void;
};

const DocumentDetailModal = React.memo(function DocumentDetailModal({
  detail, detailDispatch, detailImageUrl, memberMap, onDownload, onDelete,
}: DocumentDetailModalProps) {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!detail.visible) setConfirmingDelete(false);
  }, [detail.visible]);

  const handleClose = useCallback(() => {
    detailDispatch({ type: 'close' });
    setConfirmingDelete(false);
  }, [detailDispatch]);

  return (
    <Modal
      visible={detail.visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable onPress={() => {}} style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}>
          <ThemedText style={styles.modalTitle}>{t('trip.documentDetail')}</ThemedText>

          {detail.doc && (
            <>
              <View style={styles.docIconCentered}>
                {isImageFile(detail.doc.name) && detailImageUrl
                  ? <Image source={{ uri: detailImageUrl }} style={styles.detailImage} contentFit="contain" />
                  : <Ionicons name={fileIcon(detail.doc.name)} size={48} color={theme.tint} />}
              </View>
              <ThemedText style={styles.detailName} numberOfLines={2}>{detail.doc.name}</ThemedText>

              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>{t('trip.uploadedAt')}</ThemedText>
                <ThemedText style={styles.detailValue}>{formatDate(detail.doc.uploadedAt)}</ThemedText>
              </View>
              {memberMap[detail.doc.uploaderId] && (
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>{t('trip.uploadedBy')}</ThemedText>
                  <ThemedText style={styles.detailValue}>{memberMap[detail.doc.uploaderId]}</ThemedText>
                </View>
              )}
            </>
          )}

          {detail.error && <ThemedText style={styles.errorText}>{detail.error}</ThemedText>}

          {confirmingDelete ? (
            <>
              <ThemedText style={[styles.errorText, { color: theme.text, marginTop: 8 }]}>{t('trip.deleteDocumentConfirm')}</ThemedText>
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalBtn, { borderColor: theme.icon + '55', borderWidth: 1 }]}
                  onPress={() => setConfirmingDelete(false)}
                  disabled={detail.deleting}
                >
                  <ThemedText style={{ fontWeight: '600' }}>{t('common.cancel')}</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, styles.deleteBtn]}
                  onPress={onDelete}
                  disabled={detail.deleting}
                >
                  {detail.deleting
                    ? <ActivityIndicator color="white" />
                    : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('common.delete')}</ThemedText>}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalBtn, styles.deleteBtn]}
                  onPress={() => setConfirmingDelete(true)}
                  disabled={detail.deleting || detail.downloading}
                >
                  <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('trip.delete')}</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: theme.tint }]}
                  onPress={onDownload}
                  disabled={detail.downloading || detail.deleting}
                >
                  {detail.downloading
                    ? <ActivityIndicator color="white" />
                    : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('trip.downloadDocument')}</ThemedText>}
                </Pressable>
              </View>
              <Pressable style={styles.closeBtn} onPress={handleClose}>
                <ThemedText style={styles.closeBtnText}>{t('common.close')}</ThemedText>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});

// ── Main screen ────────────────────────────────────────────────────────────────
const DocumentsScreen = () => {
  const { t } = useTranslation();
  const { themeName } = useAppTheme();
  const theme = Colors[themeName] ?? Colors.light;
  const { trip } = useTrip();
  const {
    listDocuments, initDocumentUpload, confirmDocumentUpload,
    getDocumentDownloadUrl, deleteDocument,
  } = useDocuments();
  const navigation = useNavigation();

  const [list, listDispatch] = useReducer(listReducer, { documents: null, loading: false, error: null });
  const [ui, uiDispatch] = useReducer(uiReducer, UI_INITIAL);
  const [detail, detailDispatch] = useReducer(detailReducer, DETAIL_INITIAL);

  const memberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of trip?.members ?? []) map[m.id] = m.username;
    return map;
  }, [trip?.members]);

  const availableExtensions = useMemo(() => {
    const exts = new Set<string>();
    for (const doc of list.documents ?? []) {
      const ext = doc.name.split('.').pop()?.toLowerCase();
      if (ext) exts.add(ext);
    }
    return Array.from(exts).sort();
  }, [list.documents]);

  const filteredDocuments = useMemo(() => {
    let docs = list.documents ?? [];
    if (ui.filterExt !== null) docs = docs.filter(d => d.name.split('.').pop()?.toLowerCase() === ui.filterExt);
    return [...docs].sort((a, b) => {
      const diff = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      return ui.sortOrder === 'asc' ? diff : -diff;
    });
  }, [list.documents, ui.filterExt, ui.sortOrder]);

  const isFiltered = ui.filterExt !== null || ui.sortOrder !== 'desc';

  useEffect(() => {
    if (trip?.name) navigation.setOptions({ title: trip.name });
  }, [trip?.name, navigation]);

  useEffect(() => {
    if (!trip?.id || list.documents !== null) return;
    (async () => {
      listDispatch({ type: 'loading' });
      try {
        listDispatch({ type: 'loaded', documents: await listDocuments(trip.id!) });
      } catch {
        listDispatch({ type: 'error', error: t('trip.unableLoadDocuments') });
      }
    })();
  }, [trip?.id, list.documents, listDocuments, t]);

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
      const { documentId, uploadUrl } = await initDocumentUpload(trip.id, {
        name: file.name,
        contentType,
      });
      // Sequential by necessity: upload must complete before confirm, confirm before list refresh
      await uploadToUrl(uploadUrl, file.uri, contentType);
      await confirmDocumentUpload(trip.id, documentId);
      listDispatch({ type: 'loaded', documents: await listDocuments(trip.id) });
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
    if (!trip?.id || !detail.doc) return;
    detailDispatch({ type: 'start_delete' });
    try {
      await deleteDocument(trip.id, detail.doc.id);
      listDispatch({ type: 'remove', id: detail.doc.id });
      detailDispatch({ type: 'close' });
    } catch {
      detailDispatch({ type: 'set_error', error: t('trip.deleteDocumentError') });
    } finally {
      detailDispatch({ type: 'end_delete' });
    }
  };

  const openDetail = useCallback((doc: DocumentResponse) => {
    detailDispatch({ type: 'open', doc });
    uiDispatch({ type: 'set_detail_image', url: imageUrlCache.get(doc.id) ?? null });
    if (isImageFile(doc.name) && !imageUrlCache.has(doc.id) && trip?.id) {
      getDocumentDownloadUrl(trip.id, doc.id)
        .then(url => { imageUrlCache.set(doc.id, url); uiDispatch({ type: 'set_detail_image', url }); })
        .catch(() => {});
    }
  }, [trip?.id, getDocumentDownloadUrl]);

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
      {list.loading ? (
        <ActivityIndicator size="large" color={theme.tint} style={styles.centered} />
      ) : list.error ? (
        <ThemedText style={styles.emptyText}>{list.error}</ThemedText>
      ) : (
        <>
          {list.documents && list.documents.length > 0 && (
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

      {!list.loading && !list.error && (
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
        detailImageUrl={ui.detailImageUrl}
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
  gridCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 110,
    overflow: 'hidden',
  },
  gridName: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  gridMeta: { fontSize: 11, opacity: 0.6, textAlign: 'center' },
  detailImage: { width: '100%', height: 180, borderRadius: 10, marginBottom: 8 },
  gridImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  gridImageName: { fontSize: 11, fontWeight: '600', color: 'white' },

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

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  modalBox: { borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  docIconCentered: { alignItems: 'center', marginBottom: 8 },
  detailName: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  detailLabel: { fontSize: 13, opacity: 0.6, fontWeight: '500' },
  detailValue: { fontSize: 14, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  modalButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  deleteBtn: { backgroundColor: '#d9534f' },
  closeBtn: {
    marginTop: 8, paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#ccc',
  },
  closeBtnText: { fontSize: 15 },
  errorText: { color: '#d9534f', marginTop: 8, textAlign: 'center' },
});
