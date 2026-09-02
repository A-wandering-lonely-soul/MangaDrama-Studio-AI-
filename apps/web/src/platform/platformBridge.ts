import type { Asset } from '@manga-drama/types';

export interface PersistedAssetFile {
  url: string;
  metadata?: Record<string, unknown>;
}

export interface ExportResult {
  destination: string;
}

export interface LocalDirectoryState {
  assetsDirLabel: string;
  exportsDirLabel: string;
}

export interface PlatformBridge {
  persistImportedFile: (file: File, kind: 'image' | 'audio', assetId: string) => Promise<PersistedAssetFile>;
  getAssetBinaryForExport: (asset: Asset) => Promise<Uint8Array | null>;
  saveZipExport: (filename: string, bytes: Uint8Array) => Promise<ExportResult>;
  getLocalDirectoryState: () => Promise<LocalDirectoryState>;
  openLocalDirectory: (kind: 'assets' | 'exports') => Promise<string>;
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const parts = dataUrl.split(',');
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

const defaultPlatformBridge: PlatformBridge = {
  async persistImportedFile(file) {
    return {
      url: await toDataUrl(file)
    };
  },
  async getAssetBinaryForExport(asset) {
    if (asset.url.startsWith('data:')) {
      return dataUrlToBytes(asset.url);
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
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(arrayBuffer).set(bytes);
    const blob = new Blob([arrayBuffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    return {
      destination: `浏览器下载: ${filename}`
    };
  },
  async getLocalDirectoryState() {
    return {
      assetsDirLabel: '浏览器内存素材',
      exportsDirLabel: '浏览器默认下载目录'
    };
  },
  async openLocalDirectory(kind) {
    return kind === 'assets' ? '浏览器环境不支持打开素材目录' : '浏览器环境不支持打开导出目录';
  }
};

let activePlatformBridge: PlatformBridge = defaultPlatformBridge;

export function getPlatformBridge(): PlatformBridge {
  return activePlatformBridge;
}

export function setPlatformBridge(bridge: PlatformBridge): void {
  activePlatformBridge = bridge;
}
