// Tiny IndexedDB wrapper so the gallery survives page reloads.
const DB_NAME = 'snapboard'
const STORE = 'images'

let dbPromise
function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function run(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error)
  })
}

export const getAllImages = () => run('readonly', (s) => s.getAll())
export const putImage = (item) => run('readwrite', (s) => s.put(item))
export const deleteImage = (id) => run('readwrite', (s) => s.delete(id))
export const clearImages = () => run('readwrite', (s) => s.clear())
