import type { Asset } from '@manga-drama/types';
import type { PlatformBridge } from '../../../web/src/platform/platformBridge';
import { appDataDir, BaseDirectory, join } from '@tauri-apps/api/path';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { mkdir, readFile, writeFile } from '@tauri-apps/plugin-fs';

const ROOT_DIR = 'MangaDramaStudio';
const ASSET_DIR = `${ROOT_DIR}/assets`;
const EXPORT_DIR = `${ROOT_DIR}/exports`;

function safeSegment(input: string): string {
  const normalized = input.trim().replace(/\s+/g, '_');
  return normalized.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) || 'asset';
}

function splitName(name: string): { base: string; ext: string } {
  const index = name.lastIndexOf('.');
  if (index <= 0 || index === name.length - 1) {
    return { base: name, ext: '' };
  }

  return {
    base: name.slice(0, index),
    ext: name.slice(index)
  };
}

function buildStoredFileName(assetId: string, fileName: string): string {
  const { base, ext } = splitName(fileName);
  return `${safeSegment(assetId)}-${safeSegment(base)}${safeSegment(ext)}`;
}

async function ensureAssetDir(): Promise<void> {
  await mkdir(ASSET_DIR, {
    baseDir: BaseDirectory.AppData,
    recursive: true
  });
}

async function ensureExportDir(): Promise<void> {
  await mkdir(EXPORT_DIR, {
    baseDir: BaseDirectory.AppData,
    recursive: true
  });
}

async function appDataAbsolutePath(relativePath: string): Promise<string> {
  return join(await appDataDir(), relativePath);
}

export const tauriBridge: PlatformBridge = {
  async persistImportedFile(file, _kind, assetId) {
    await ensureAssetDir();

    const relativePath = `${ASSET_DIR}/${buildStoredFileName(assetId, file.name)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    await writeFile(relativePath, bytes, {
      baseDir: BaseDirectory.AppData
    });

    const absolutePath = await appDataAbsolutePath(relativePath);
    return {
      url: convertFileSrc(absolutePath),
      metadata: {
        localRelativePath: relativePath,
        originalFileName: file.name
      }
    };
  },

  async getAssetBinaryForExport(asset: Asset) {
    const localRelativePath = asset.metadata?.localRelativePath;
    if (typeof localRelativePath === 'string' && localRelativePath.length > 0) {
      return readFile(localRelativePath, {
        baseDir: BaseDirectory.AppData
      });
    }

    if (asset.url.startsWith('data:')) {
      const parts = asset.url.split(',');
      if (parts.length < 2) {
        return null;
      }

      try {
        const binary = atob(parts[1]);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
      } catch {
        return null;
      }
    }

    try {
      const response = await fetch(asset.url);
      if (!response.ok) {
        return null;
      }

      return new Uint8Array(await response.arrayBuffer());
    } catch {
      return null;
    }
  },

  async saveZipExport(filename, bytes) {
    const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
    const outputName = `${safeSegment(filename.replace(/\.zip$/i, ''))}-${timestamp}.zip`;
    const relativePath = `${EXPORT_DIR}/${outputName}`;

    await ensureExportDir();

    await writeFile(relativePath, bytes, {
      baseDir: BaseDirectory.AppData
    });

    const absolutePath = await appDataAbsolutePath(relativePath);
    return {
      destination: absolutePath
    };
  },

  async getLocalDirectoryState() {
    const appDataPath = await appDataDir();
    return {
      assetsDirLabel: await join(appDataPath, ASSET_DIR),
      exportsDirLabel: await join(appDataPath, EXPORT_DIR)
    };
  },

  async openLocalDirectory(kind) {
    if (kind === 'assets') {
      await ensureAssetDir();
      const absolutePath = await appDataAbsolutePath(ASSET_DIR);
      await invoke('open_in_file_manager', { path: absolutePath });
      return absolutePath;
    }

    await ensureExportDir();
    const absolutePath = await appDataAbsolutePath(EXPORT_DIR);
    await invoke('open_in_file_manager', { path: absolutePath });
    return absolutePath;
  }
};
