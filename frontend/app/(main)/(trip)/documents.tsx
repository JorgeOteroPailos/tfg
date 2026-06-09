import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  StyleSheet, View, FlatList, ActivityIndicator,
  Pressable, Modal, Linking,
} from 'react-native';
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
  const [upload, setUpload] = useState<{ uploading: boolean; error: string | null }>({ uploading: false, error: null });
  const [detail, detailDispatch] = useReducer(detailReducer, DETAIL_INITIAL);

  const memberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of trip?.members ?? []) map[m.id] = m.username;
    return map;
  }, [trip?.members]);

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
    if (!upload.error) return;
    const timer = setTimeout(() => setUpload(prev => ({ ...prev, error: null })), 4000);
    return () => clearTimeout(timer);
  }, [upload.error]);

  const handleUpload = async () => {
    if (!trip?.id) return;

    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;

    const file = result.assets[0];
    const contentType = file.mimeType ?? 'application/octet-stream';

    setUpload({ uploading: true, error: null });
    try {
      const { documentId, uploadUrl } = await initDocumentUpload(trip.id, {
        name: file.name,
        contentType,
      });

      await uploadToUrl(uploadUrl, file.uri, contentType);

      await confirmDocumentUpload(trip.id, documentId);

      listDispatch({ type: 'loaded', documents: await listDocuments(trip.id) });
    } catch (e) {
      setUpload(prev => ({ ...prev, error: t('trip.uploadError') }));
    } finally {
      setUpload(prev => ({ ...prev, uploading: false }));
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
  }, []);

  const renderDocumentItem = useCallback(({ item }: { item: DocumentResponse }) => (
    <DocCard
      item={item}
      background={theme.tabBackground}
      tint={theme.tint}
      icon={theme.icon}
      memberName={memberMap[item.uploaderId]}
      onPress={openDetail}
    />
  ), [theme.tabBackground, theme.tint, theme.icon, memberMap, openDetail]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {list.loading ? (
        <ActivityIndicator size="large" color={theme.tint} style={styles.centered} />
      ) : list.error ? (
        <ThemedText style={styles.emptyText}>{list.error}</ThemedText>
      ) : (
        <FlatList
          data={list.documents ?? []}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-outline" size={64} color={theme.icon} style={{ opacity: 0.4 }} />
              <ThemedText style={styles.emptyText}>{t('trip.noDocuments')}</ThemedText>
            </View>
          }
          renderItem={renderDocumentItem}
        />
      )}

      {!list.loading && !list.error && (
        <Pressable
          style={[styles.fab, { backgroundColor: upload.uploading ? theme.icon : theme.tint }]}
          onPress={handleUpload}
          disabled={upload.uploading}
        >
          {upload.uploading
            ? <ActivityIndicator color="white" />
            : <Ionicons name="add" size={28} color="white" />}
        </Pressable>
      )}

      {upload.error && (
        <View style={styles.toast}>
          <ThemedText style={styles.toastText}>{upload.error}</ThemedText>
        </View>
      )}

      <Modal
        visible={detail.visible}
        transparent
        animationType="fade"
        onRequestClose={() => detailDispatch({ type: 'close' })}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => detailDispatch({ type: 'close' })}
        >
          <Pressable
            onPress={() => {}}
            style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}
          >
            <ThemedText style={styles.modalTitle}>{t('trip.documentDetail')}</ThemedText>

            {detail.doc && (
              <>
                <View style={styles.docIconCentered}>
                  <Ionicons name={fileIcon(detail.doc.name)} size={48} color={theme.tint} />
                </View>
                <ThemedText style={styles.detailName} numberOfLines={2}>
                  {detail.doc.name}
                </ThemedText>

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

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, styles.deleteBtn]}
                onPress={handleDelete}
                disabled={detail.deleting || detail.downloading}
              >
                {detail.deleting
                  ? <ActivityIndicator color="white" />
                  : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('trip.delete')}</ThemedText>}
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.tint }]}
                onPress={handleDownload}
                disabled={detail.downloading || detail.deleting}
              >
                {detail.downloading
                  ? <ActivityIndicator color="white" />
                  : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('trip.downloadDocument')}</ThemedText>}
              </Pressable>
            </View>

            <Pressable
              style={styles.closeBtn}
              onPress={() => detailDispatch({ type: 'close' })}
            >
              <ThemedText style={styles.closeBtnText}>{t('common.close')}</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

export default DocumentsScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1 },
  list: { padding: 16, gap: 10, paddingBottom: 100 },
  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 15, opacity: 0.6 },

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
