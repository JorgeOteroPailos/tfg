import {
  isImageFile,
  formatDate,
  fileIcon,
  detailReducer,
  DETAIL_INITIAL,
  type DetailState,
} from '../documentCards.helpers';

describe('isImageFile', () => {
  it('returns true for common image extensions', () => {
    expect(isImageFile('photo.jpg')).toBe(true);
    expect(isImageFile('avatar.jpeg')).toBe(true);
    expect(isImageFile('banner.PNG')).toBe(true);
    expect(isImageFile('anim.gif')).toBe(true);
    expect(isImageFile('snap.webp')).toBe(true);
    expect(isImageFile('raw.heic')).toBe(true);
  });

  it('returns false for non-image files', () => {
    expect(isImageFile('resume.pdf')).toBe(false);
    expect(isImageFile('video.mp4')).toBe(false);
    expect(isImageFile('noextension')).toBe(false);
    expect(isImageFile('')).toBe(false);
  });
});

describe('formatDate', () => {
  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatDate('2024-03-15T10:00:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a defined string for an invalid date', () => {
    const result = formatDate('not-a-date');
    expect(typeof result).toBe('string');
  });
});

describe('fileIcon', () => {
  it('returns document-text-outline for PDF', () => {
    expect(fileIcon('contract.pdf')).toBe('document-text-outline');
  });

  it('returns image-outline for image files', () => {
    expect(fileIcon('photo.jpg')).toBe('image-outline');
    expect(fileIcon('banner.PNG')).toBe('image-outline');
  });

  it('returns videocam-outline for video files', () => {
    expect(fileIcon('clip.mp4')).toBe('videocam-outline');
    expect(fileIcon('movie.mkv')).toBe('videocam-outline');
  });

  it('returns document-outline as the fallback', () => {
    expect(fileIcon('archive.zip')).toBe('document-outline');
    expect(fileIcon('noextension')).toBe('document-outline');
  });
});

const mockDoc = {
  id: 'abc-123',
  name: 'invoice.pdf',
  uploaderId: 'user-1',
  uploadedAt: '2024-01-01T00:00:00Z',
} as any;

describe('detailReducer', () => {
  it('DETAIL_INITIAL has visible=false and doc=null', () => {
    expect(DETAIL_INITIAL.visible).toBe(false);
    expect(DETAIL_INITIAL.doc).toBeNull();
    expect(DETAIL_INITIAL.downloading).toBe(false);
    expect(DETAIL_INITIAL.deleting).toBe(false);
    expect(DETAIL_INITIAL.error).toBeNull();
  });

  it('open action sets visible=true and stores the doc', () => {
    const next = detailReducer(DETAIL_INITIAL, { type: 'open', doc: mockDoc });
    expect(next.visible).toBe(true);
    expect(next.doc).toBe(mockDoc);
    expect(next.downloading).toBe(false);
    expect(next.deleting).toBe(false);
    expect(next.error).toBeNull();
  });

  it('close action resets to DETAIL_INITIAL', () => {
    const opened = detailReducer(DETAIL_INITIAL, { type: 'open', doc: mockDoc });
    const closed = detailReducer(opened, { type: 'close' });
    expect(closed).toEqual(DETAIL_INITIAL);
  });

  it('start_download sets downloading=true and clears error', () => {
    const withError: DetailState = { ...DETAIL_INITIAL, visible: true, doc: mockDoc, error: 'prev error' };
    const next = detailReducer(withError, { type: 'start_download' });
    expect(next.downloading).toBe(true);
    expect(next.error).toBeNull();
  });

  it('end_download sets downloading=false', () => {
    const downloading: DetailState = { ...DETAIL_INITIAL, downloading: true };
    const next = detailReducer(downloading, { type: 'end_download' });
    expect(next.downloading).toBe(false);
  });

  it('start_delete sets deleting=true and clears error', () => {
    const withError: DetailState = { ...DETAIL_INITIAL, error: 'prev' };
    const next = detailReducer(withError, { type: 'start_delete' });
    expect(next.deleting).toBe(true);
    expect(next.error).toBeNull();
  });

  it('end_delete sets deleting=false', () => {
    const deleting: DetailState = { ...DETAIL_INITIAL, deleting: true };
    const next = detailReducer(deleting, { type: 'end_delete' });
    expect(next.deleting).toBe(false);
  });

  it('set_error stores the error message', () => {
    const next = detailReducer(DETAIL_INITIAL, { type: 'set_error', error: 'Something went wrong' });
    expect(next.error).toBe('Something went wrong');
  });
});
