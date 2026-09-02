import JSZip from 'jszip';
import type { Asset, Project } from '@manga-drama/types';
import { getPlatformBridge } from '../platform/platformBridge';

function getFileExtension(asset: Asset): string {
  const namePart = asset.name.split('.').pop()?.trim().toLowerCase();
  if (namePart) {
    return namePart;
  }

  return asset.type === 'audio' ? 'bin' : 'png';
}

export async function exportProjectBundle(project: Project, assets: Asset[]): Promise<void> {
  const bridge = getPlatformBridge();
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(project, null, 2));

  const assetFolder = zip.folder('assets');
  if (assetFolder) {
    for (const asset of assets) {
      const bytes = await bridge.getAssetBinaryForExport(asset);
      if (!bytes) {
        continue;
      }

      const ext = getFileExtension(asset);
      const filename = `${asset.id}-${asset.name.replace(/\s+/g, '_')}.${ext}`;
      assetFolder.file(filename, bytes);
    }
  }

  const content = await zip.generateAsync({ type: 'uint8array' });
  await bridge.saveZipExport(`${project.name || 'manga-drama-project'}.zip`, content);
}
