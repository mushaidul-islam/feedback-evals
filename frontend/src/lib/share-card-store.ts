export type StoredShareCard = {
  signature: string;
  stamp: Blob | null;
  card: Blob;
};

// Blobs stay on this browser's origin; nothing here sends a network request.
export async function shareCardStore(
  key: string,
  value?: StoredShareCard,
): Promise<StoredShareCard | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('tbt-share-cards', 1);
    request.addEventListener('upgradeneeded', () => request.result.createObjectStore('cards'));
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
    request.addEventListener('blocked', () => reject(new Error('Local image storage is blocked.')));
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('cards', value ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('cards');
      const request = value ? store.put(value, key) : store.get(key);
      transaction.addEventListener('complete', () => resolve(value ?? request.result));
      transaction.addEventListener('error', () => reject(transaction.error));
      transaction.addEventListener('abort', () =>
        reject(transaction.error ?? new Error('Local image storage was interrupted.')),
      );
    });
  } finally {
    db.close();
  }
}
