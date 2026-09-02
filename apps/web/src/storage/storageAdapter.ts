import type { StorageAdapter } from '@manga-drama/types';
import { indexedDbAdapter } from './indexedDbAdapter';

let activeStorageAdapter: StorageAdapter = indexedDbAdapter;

export function getStorageAdapter(): StorageAdapter {
  return activeStorageAdapter;
}

export function setStorageAdapter(adapter: StorageAdapter): void {
  activeStorageAdapter = adapter;
}
