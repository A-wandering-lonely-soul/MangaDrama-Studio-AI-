import JSZip from 'jszip';
import type { Asset, Project } from '@manga-drama/types';

function dataUrlToBlob(dataUrl: string): Blob | null {
  const parts = dataUrl.split(',');
  if (parts.length < 2) {
    return null;
  }

  const mimeMatch = parts[0].match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] ?? 'application/octet-stream';
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

export async function exportProjectBundle(project: Project, assets: Asset[]): Promise<void> {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(project, null, 2));

  const assetFolder = zip.folder('assets');
  if (assetFolder) {
    for (const asset of assets) {
      if (!asset.url.startsWith('data:')) {
        continue;
      }

      const blob = dataUrlToBlob(asset.url);
      if (!blob) {
        continue;
      }

      const ext = asset.type === 'audio' ? 'bin' : 'png';
      const filename = `${asset.id}-${asset.name.replace(/\s+/g, '_')}.${ext}`;
      assetFolder.file(filename, blob);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${project.name || 'manga-drama-project'}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
