import { uploadToUrl } from '../upload';

class MockXHR {
  status = 0;
  responseText = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  open = jest.fn();
  setRequestHeader = jest.fn();
  send = jest.fn();
}

let mockXhr: MockXHR;

beforeEach(() => {
  mockXhr = new MockXHR();
  (global as any).XMLHttpRequest = jest.fn(() => mockXhr);
});

afterEach(() => {
  delete (global as any).XMLHttpRequest;
});

describe('uploadToUrl', () => {
  it('resolves on HTTP 200', async () => {
    const promise = uploadToUrl('https://example.com/upload', 'file:///photo.jpg', 'image/jpeg');
    mockXhr.status = 200;
    mockXhr.onload!();
    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves on HTTP 201', async () => {
    const promise = uploadToUrl('https://example.com/upload', 'file:///doc.pdf', 'application/pdf');
    mockXhr.status = 201;
    mockXhr.onload!();
    await expect(promise).resolves.toBeUndefined();
  });

  it('resolves on HTTP 204', async () => {
    const promise = uploadToUrl('https://example.com/upload', 'file:///doc.pdf', 'application/pdf');
    mockXhr.status = 204;
    mockXhr.onload!();
    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects with status info on HTTP 400', async () => {
    const promise = uploadToUrl('https://example.com/upload', 'file:///bad.jpg', 'image/jpeg');
    mockXhr.status = 400;
    mockXhr.responseText = 'Bad Request';
    mockXhr.onload!();
    await expect(promise).rejects.toThrow('400');
  });

  it('rejects with status info on HTTP 500', async () => {
    const promise = uploadToUrl('https://example.com/upload', 'file:///file.jpg', 'image/jpeg');
    mockXhr.status = 500;
    mockXhr.responseText = 'Internal Server Error';
    mockXhr.onload!();
    await expect(promise).rejects.toThrow('500');
  });

  it('rejects with "Network error" when onerror fires', async () => {
    const promise = uploadToUrl('https://example.com/upload', 'file:///file.jpg', 'image/jpeg');
    mockXhr.onerror!();
    await expect(promise).rejects.toThrow('Network error');
  });

  it('opens a PUT request to the provided URL', async () => {
    const url = 'https://example.com/my-upload';
    uploadToUrl(url, 'file:///photo.jpg', 'image/jpeg');
    expect(mockXhr.open).toHaveBeenCalledWith('PUT', url, true);
  });

  it('sets the Content-Type header', async () => {
    uploadToUrl('https://example.com/upload', 'file:///photo.jpg', 'image/jpeg');
    expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
  });
});
