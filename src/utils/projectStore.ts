import type { Project } from '../models/deck'

// Persistence for the whole project. Card images are stored as data URLs
// (about 1.2 MB per card side), so a deck of nine cards is well past the
// ~5 MB localStorage quota. IndexedDB quotas are hundreds of MB.
//
// The project is stored as a single record; nothing about its shape changes.
// localStorage is read once, for migration, and then cleared.

const DB_NAME = 'pocalab'
const DB_VERSION = 1
const STORE = 'kv'
const KEY = 'project'

export const LEGACY_LOCAL_KEYS = ['photocard-project', 'photocard-deck'] as const

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

export async function readStoredProject(): Promise<Project | null> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readonly')
    const value = await requestToPromise(tx.objectStore(STORE).get(KEY))
    return (value as Project | undefined) ?? null
  } finally {
    db.close()
  }
}

export async function writeStoredProject(project: Project): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(project, KEY)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'))
    })
  } finally {
    db.close()
  }
}

export async function clearStoredProject(): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(KEY)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
    })
  } finally {
    db.close()
  }
}
