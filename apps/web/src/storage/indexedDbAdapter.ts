import type { ProjectBundle, ProjectSummary, StorageAdapter } from '@manga-drama/types';

const DB_NAME = 'manga-drama-studio';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

interface StoredProjectRecord {
  id: string;
  name: string;
  updatedAt: number;
  bundle: ProjectBundle;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      operation(store, resolve, reject);

      tx.oncomplete = () => db.close();
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    } catch (error) {
      reject(error);
    }
  });
}

export const indexedDbAdapter: StorageAdapter = {
  async saveProject(bundle: ProjectBundle): Promise<void> {
    const record: StoredProjectRecord = {
      id: bundle.project.id,
      name: bundle.project.name,
      updatedAt: Date.now(),
      bundle
    };

    await runTransaction<void>('readwrite', (store, resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async loadProject(projectId: string): Promise<ProjectBundle | null> {
    return runTransaction<ProjectBundle | null>('readonly', (store, resolve, reject) => {
      const request = store.get(projectId);
      request.onsuccess = () => {
        const record = request.result as StoredProjectRecord | undefined;
        resolve(record?.bundle ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async listProjects(): Promise<ProjectSummary[]> {
    return runTransaction<ProjectSummary[]>('readonly', (store, resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const records = (request.result as StoredProjectRecord[]) ?? [];
        const list = records
          .map((item) => ({
            id: item.id,
            name: item.name,
            updatedAt: item.updatedAt
          }))
          .sort((left, right) => right.updatedAt - left.updatedAt);
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async deleteProject(projectId: string): Promise<void> {
    await runTransaction<void>('readwrite', (store, resolve, reject) => {
      const request = store.delete(projectId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
