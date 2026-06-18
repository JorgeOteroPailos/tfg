import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DocumentResponse } from './documents';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']);

export function isImageFile(name: string) {
  return IMAGE_EXTS.has(name.split('.').pop()?.toLowerCase() ?? '');
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function fileIcon(name: string): ComponentProps<typeof Ionicons>['name'] {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'document-text-outline';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext ?? '')) return 'image-outline';
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext ?? '')) return 'videocam-outline';
  return 'document-outline';
}

// ── Detail modal state ──────────────────────────────────────────────────────────
export type DetailState = { visible: boolean; doc: DocumentResponse | null; downloading: boolean; deleting: boolean; error: string | null };
export type DetailAction =
  | { type: 'open'; doc: DocumentResponse }
  | { type: 'close' }
  | { type: 'start_download' }
  | { type: 'end_download' }
  | { type: 'start_delete' }
  | { type: 'end_delete' }
  | { type: 'set_error'; error: string };

export const DETAIL_INITIAL: DetailState = { visible: false, doc: null, downloading: false, deleting: false, error: null };

export function detailReducer(state: DetailState, action: DetailAction): DetailState {
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

export const docStyles = StyleSheet.create({
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

  detailImage: { width: '100%', height: 180, borderRadius: 10, marginBottom: 8 },
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
