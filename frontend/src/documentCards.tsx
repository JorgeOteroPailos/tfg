import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Pressable, Modal, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from './theme';
import { useDataSaver } from './dataSaver';
import { Colors } from '../constants/Colors';
import { useDocumentDownloadQuery, type DocumentResponse } from './documents';
import { useTrip } from './trips';
import ThemedText from '../components/ThemedText';
import {
  isImageFile, fileIcon, formatDate, docStyles,
  type DetailState, type DetailAction,
} from './documentCards.helpers';

// ── Grid card ──────────────────────────────────────────────────────────────────
type DocGridCardProps = {
  item: DocumentResponse;
  background: string;
  tint: string;
  onPress: (item: DocumentResponse) => void;
};

export const DocGridCard = React.memo(function DocGridCard({ item, background, tint, onPress }: DocGridCardProps) {
  const { trip } = useTrip();
  const { dataSaver } = useDataSaver();
  const isImage = isImageFile(item.name);
  // Full image only as fallback when there is no server-generated thumbnail (old docs, heic, failed generation)
  const { data: fallbackUri } = useDocumentDownloadQuery(trip?.id ?? '', item.id, { enabled: isImage && !item.previewUrl && !!trip?.id && !dataSaver });
  // In data-saver mode the grid shows the file icon instead of fetching previews.
  const imageUri = dataSaver ? undefined : (item.previewUrl ?? fallbackUri);

  return (
    <Pressable
      style={({ pressed }) => [docStyles.gridCard, { backgroundColor: background, opacity: pressed ? 0.75 : 1 }]}
      onPress={() => onPress(item)}
    >
      {isImage && imageUri ? (
        <>
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={docStyles.gridImageOverlay}>
            <ThemedText style={docStyles.gridImageName} numberOfLines={1}>{item.name}</ThemedText>
          </View>
        </>
      ) : (
        <>
          <Ionicons name={fileIcon(item.name)} size={36} color={tint} />
          <ThemedText style={docStyles.gridName} numberOfLines={2}>{item.name}</ThemedText>
          <ThemedText style={docStyles.gridMeta}>{formatDate(item.uploadedAt)}</ThemedText>
        </>
      )}
    </Pressable>
  );
});

// ── Detail modal ─────────────────────────────────────────────────────────────────
type DocumentDetailModalProps = {
  detail: DetailState;
  detailDispatch: React.Dispatch<DetailAction>;
  detailImageUrl: string | null;
  memberMap: Record<string, string>;
  onDownload: () => void;
  onDelete: () => void;
};

export const DocumentDetailModal = React.memo(function DocumentDetailModal({
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
      <Pressable style={docStyles.overlay} onPress={handleClose}>
        <Pressable onPress={() => {}} style={[docStyles.modalBox, { backgroundColor: theme.tabBackground }]}>
          <ThemedText style={docStyles.modalTitle}>{t('trip.documentDetail')}</ThemedText>

          {detail.doc && (
            <>
              <View style={docStyles.docIconCentered}>
                {isImageFile(detail.doc.name) && detailImageUrl
                  ? <Image source={{ uri: detailImageUrl }} style={docStyles.detailImage} contentFit="contain" />
                  : <Ionicons name={fileIcon(detail.doc.name)} size={48} color={theme.tint} />}
              </View>
              <ThemedText style={docStyles.detailName} numberOfLines={2}>{detail.doc.name}</ThemedText>

              <View style={docStyles.detailRow}>
                <ThemedText style={docStyles.detailLabel}>{t('trip.uploadedAt')}</ThemedText>
                <ThemedText style={docStyles.detailValue}>{formatDate(detail.doc.uploadedAt)}</ThemedText>
              </View>
              {memberMap[detail.doc.uploaderId] && (
                <View style={docStyles.detailRow}>
                  <ThemedText style={docStyles.detailLabel}>{t('trip.uploadedBy')}</ThemedText>
                  <ThemedText style={docStyles.detailValue}>{memberMap[detail.doc.uploaderId]}</ThemedText>
                </View>
              )}
            </>
          )}

          {detail.error && <ThemedText style={docStyles.errorText}>{detail.error}</ThemedText>}

          {confirmingDelete ? (
            <>
              <ThemedText style={[docStyles.errorText, { color: theme.text, marginTop: 8 }]}>{t('trip.deleteDocumentConfirm')}</ThemedText>
              <View style={docStyles.modalButtons}>
                <Pressable
                  style={[docStyles.modalBtn, { borderColor: theme.icon + '55', borderWidth: 1 }]}
                  onPress={() => setConfirmingDelete(false)}
                  disabled={detail.deleting}
                >
                  <ThemedText style={{ fontWeight: '600' }}>{t('common.cancel')}</ThemedText>
                </Pressable>
                <Pressable
                  style={[docStyles.modalBtn, docStyles.deleteBtn]}
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
              <View style={docStyles.modalButtons}>
                <Pressable
                  style={[docStyles.modalBtn, docStyles.deleteBtn]}
                  onPress={() => setConfirmingDelete(true)}
                  disabled={detail.deleting || detail.downloading}
                >
                  <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('trip.delete')}</ThemedText>
                </Pressable>
                <Pressable
                  style={[docStyles.modalBtn, { backgroundColor: theme.tint }]}
                  onPress={onDownload}
                  disabled={detail.downloading || detail.deleting}
                >
                  {detail.downloading
                    ? <ActivityIndicator color="white" />
                    : <ThemedText style={{ color: 'white', fontWeight: '600' }}>{t('trip.downloadDocument')}</ThemedText>}
                </Pressable>
              </View>
              <Pressable style={docStyles.closeBtn} onPress={handleClose}>
                <ThemedText style={docStyles.closeBtnText}>{t('common.close')}</ThemedText>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});
