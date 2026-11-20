import { Readable } from 'stream';

export interface SavedFileResult {
  storageKey: string;
  sizeBytes: number;
}

export interface StoredStreamResult {
  stream: Readable;
  sizeBytes: number;
  mimeType?: string;
  fileName?: string;
}

export interface StorageProvider {
  save(file: Express.Multer.File, keyPrefix?: string): Promise<SavedFileResult>;
  getStream(storageKey: string): Promise<StoredStreamResult>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}
