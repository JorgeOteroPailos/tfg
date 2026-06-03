import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

function formatSize(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
          {formatSize(item.size)} · {formatDate(item.uploadedAt)}
        </ThemedText>
        {memberName && (
          <ThemedText style={styles.docUploader}>{memberName}</ThemedText>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={icon} />
    </Pressable>
  );
});

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

  const [documents, setDocuments] = useState<DocumentResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentResponse | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const memberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of trip?.members ?? []) map[m.id] = m.username;
    return map;
  }, [trip?.members]);

  useEffect(() => {
    if (trip?.name) navigation.setOptions({ title: trip.name });
  }, [trip?.name, navigation]);

  useEffect(() => {
    if (!trip?.id || documents !== null) return;
    (async () => {
      setLoading(true);
      try {
        setDocuments(await listDocuments(trip.id!));
      } catch {
        setError(t('trip.unableLoadDocuments'));
      } finally {
        setLoading(false);
      }
    })();
  }, [trip?.id, documents, listDocuments, t]);

  useEffect(() => {
    if (!uploadError) return;
    const timer = setTimeout(() => setUploadError(null), 4000);
    return () => clearTimeout(timer);
  }, [uploadError]);

  const handleUpload = async () => {
    if (!trip?.id) return;

    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;

    const file = result.assets[0];
    const contentType = file.mimeType ?? 'application/octet-stream';

    setUploading(true);
    setUploadError(null);
    try {
      const { documentId, uploadUrl } = await initDocumentUpload(trip.id, {
        name: file.name,
        contentType,
        size: file.size ?? undefined,
      });

      await uploadToUrl(uploadUrl, file.uri, contentType);

      await confirmDocumentUpload(trip.id, documentId);

      setDocuments(await listDocuments(trip.id));
    } catch (e) {
      setUploadError(t('trip.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!trip?.id || !selectedDoc) return;
    setDownloading(true);
    setActionError(null);
    try {
      const url = await getDocumentDownloadUrl(trip.id, selectedDoc.id);
      await Linking.openURL(url);
    } catch {
      setActionError(t('trip.downloadError'));
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!trip?.id || !selectedDoc) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteDocument(trip.id, selectedDoc.id);
      setDocuments(prev => prev ? prev.filter(d => d.id !== selectedDoc.id) : prev);
      setDetailVisible(false);
    } catch {
      setActionError(t('trip.deleteDocumentError'));
    } finally {
      setDeleting(false);
    }
  };

  const openDetail = useCallback((doc: DocumentResponse) => {
    setSelectedDoc(doc);
    setActionError(null);
    setDetailVisible(true);
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
      {loading ? (
        <ActivityIndicator size="large" color={theme.tint} style={styles.centered} />
      ) : error ? (
        <ThemedText style={styles.emptyText}>{error}</ThemedText>
      ) : (
        <FlatList
          data={documents ?? []}
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

      {!loading && !error && (
        <Pressable
          style={[styles.fab, { backgroundColor: uploading ? theme.icon : theme.tint }]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading
            ? <ActivityIndicator color="white" />
            : <Ionicons name="add" size={28} color="white" />}
        </Pressable>
      )}

      {uploadError && (
        <View style={styles.toast}>
          <ThemedText style={styles.toastText}>{uploadError}</ThemedText>
        </View>
      )}

      <Modal
        visible={detailVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailVisible(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setDetailVisible(false)}
        >
          <Pressable
            onPress={() => {}}
            style={[styles.modalBox, { backgroundColor: theme.tabBackground }]}
          >
            <ThemedText style={styles.modalTitle}>{t('trip.documentDetail')}</ThemedText>

            {selectedDoc && (
              <>
                <View style={styles.docIconCentered}>
                  <Ionicons name={fileIcon(selectedDoc.name)} size={48} color={theme.tint} />
                </View>
                <ThemedText style={styles.detailName} numberOfLines={2}>
                  {selectedDoc.name}
                </ThemedText>

                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>{t('trip.fileSize')}</ThemedText>
                  <ThemedText style={styles.detailValue}>{formatSize(selectedDoc.size)}</ThemedText>
                </View>
                <View style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>{t('trip.uploadedAt')}</ThemedText>
                  <ThemedText style={styles.detailValue}>{formatDate(selectedDoc.uploadedAt)}</ThemedText>
                </View>
                {memberMap[selectedDoc.uploaderId] && (
                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>{t('trip.uploadedBy')}</ThemedText>
                    <ThemedText style={styles.detailValue}>{memberMap[selectedDoc.uploaderId]}</ThemedText>
                  </View>
                )}
              </>
            )}

            {actionError && <ThemedText style={styles.errorText}>{actionError}</ThemedText>}

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, styles.deleteBtn]}
                onPress={handleDelete}
                disabled={deleting || downloading}
              >
                {deleting
                  ? <ActivityIndicator color="white" />
                  : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('trip.delete')}</ThemedText>}
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.tint }]}
                onPress={handleDownload}
                disabled={downloading || deleting}
              >
                {downloading
                  ? <ActivityIndicator color="white" />
                  : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('trip.downloadDocument')}</ThemedText>}
              </Pressable>
            </View>

            <Pressable
              style={styles.closeBtn}
              onPress={() => setDetailVisible(false)}
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
