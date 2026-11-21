const STORE = 'photos'

function openPhotos(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('beefcare-cattle-photos', 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function accessPhoto<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openPhotos()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const request = operation(transaction.objectStore(STORE))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error ?? request.error)
    })
  } finally {
    db.close()
  }
}

/** Keep photo bytes outside the demo collections, which are persisted as JSON in localStorage. */
export async function saveDemoCattlePhoto(code: string, photo: Blob | null): Promise<void> {
  try {
    await accessPhoto('readwrite', (store) => store.put(photo, code))
  } catch {
    throw new Error('Không lưu được ảnh trong trình duyệt. Vui lòng kiểm tra dung lượng lưu trữ rồi thử lại.')
  }
}

/** undefined means untouched; null means the user explicitly removed a previous photo. */
export async function readDemoCattlePhoto(code: string): Promise<string | null | undefined> {
  try {
    const photo = await accessPhoto<Blob | null | undefined>('readonly', (store) => store.get(code))
    if (!photo) return photo
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(photo)
    })
  } catch {
    return undefined
  }
}
