import { StorageProvider } from './storage.interface';
import { LocalDiskStorageProvider } from './local-disk.storage';

let storageInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!storageInstance) {
    storageInstance = new LocalDiskStorageProvider();
  }
  return storageInstance;
}

export * from './storage.interface';
export * from './local-disk.storage';
