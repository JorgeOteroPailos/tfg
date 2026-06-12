export function uploadToUrl(uploadUrl: string, fileUri: string, contentType: string): Promise<void> {
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
