import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { StorageProvider, SavedFileResult, StoredStreamResult } from './storage.interface';
import { env } from '../../../config/env';

export class LocalDiskStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(customPath?: string) {
    this.baseDir = path.resolve(process.cwd(), customPath || env.STORAGE_LOCAL_PATH);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public async save(file: Express.Multer.File, keyPrefix: string = 'general'): Promise<SavedFileResult> {
    const randomHex = crypto.randomBytes(8).toString('hex');
    const sanitizedName = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const relativeKey = path.join(keyPrefix, `${Date.now()}-${randomHex}-${sanitizedName}`).replace(/\\/g, '/');
    const fullPath = path.resolve(this.baseDir, relativeKey);

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    if (file.buffer) {
      await fs.promises.writeFile(fullPath, file.buffer);
    } else if (file.path) {
      await fs.promises.copyFile(file.path, fullPath);
      await fs.promises.unlink(file.path).catch(() => {});
    } else {
      throw new Error('No file buffer or file path was provided for storage');
    }

    const stat = await fs.promises.stat(fullPath);
    return {
      storageKey: relativeKey,
      sizeBytes: stat.size,
    };
  }

  public async getStream(storageKey: string): Promise<StoredStreamResult> {
    const fullPath = path.resolve(this.baseDir, storageKey);
    // Security assertion: Prevent path traversal attacks
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error('Access denied: Invalid storage key path traversal');
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found in storage repository');
    }

    const stat = await fs.promises.stat(fullPath);
    const stream = fs.createReadStream(fullPath);
    return {
      stream,
      sizeBytes: stat.size,
    };
  }

  public async delete(storageKey: string): Promise<void> {
    const fullPath = path.resolve(this.baseDir, storageKey);
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error('Access denied: Invalid storage key');
    }
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }

  public async exists(storageKey: string): Promise<boolean> {
    const fullPath = path.resolve(this.baseDir, storageKey);
    if (!fullPath.startsWith(this.baseDir)) return false;
    return fs.existsSync(fullPath);
  }
}
