import type { ProjectBundle, ProjectSummary, StorageAdapter } from '@manga-drama/types';
import { BaseDirectory, exists, mkdir, readDir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs';

const ROOT_DIR = 'MangaDramaStudio';
const ASSET_ROOT_DIR = `${ROOT_DIR}/assets`;

function projectDir(projectId: string): string {
  return `${ROOT_DIR}/${projectId}`;
}

function projectFile(projectId: string): string {
  return `${projectDir(projectId)}/project.json`;
}

async function ensureProjectDir(projectId: string): Promise<void> {
  await mkdir(projectDir(projectId), { baseDir: BaseDirectory.AppData, recursive: true });
}

function getLocalAssetPath(bundle: ProjectBundle): Set<string> {
  return new Set(
    bundle.assets
      .map((asset) => asset.metadata?.localRelativePath)
      .filter((path): path is string => typeof path === 'string' && path.length > 0)
  );
}

async function listProjectBundles(): Promise<ProjectBundle[]> {
  const rootExists = await exists(ROOT_DIR, { baseDir: BaseDirectory.AppData });
  if (!rootExists) {
    return [];
  }

  const entries = await readDir(ROOT_DIR, { baseDir: BaseDirectory.AppData });
  const bundles = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory && entry.name)
      .map(async (entry) => {
        try {
          const projectId = String(entry.name);
          const text = await readTextFile(projectFile(projectId), { baseDir: BaseDirectory.AppData });
          return JSON.parse(text) as ProjectBundle;
        } catch {
          return null;
        }
      })
  );

  return bundles.filter((bundle): bundle is ProjectBundle => bundle !== null);
}

async function collectReferencedLocalAssets(): Promise<Set<string>> {
  const bundles = await listProjectBundles();
  const referenced = new Set<string>();

  for (const bundle of bundles) {
    for (const assetPath of getLocalAssetPath(bundle)) {
      referenced.add(assetPath);
    }
  }

  return referenced;
}

async function cleanupUnreferencedAssets(candidatePaths: Iterable<string>): Promise<void> {
  const referenced = await collectReferencedLocalAssets();

  await Promise.all(
    [...candidatePaths].map(async (candidatePath) => {
      if (referenced.has(candidatePath)) {
        return;
      }

      const found = await exists(candidatePath, { baseDir: BaseDirectory.AppData });
      if (!found) {
        return;
      }

      await remove(candidatePath, { baseDir: BaseDirectory.AppData });
    })
  );
}

export const tauriStorageAdapter: StorageAdapter = {
  async saveProject(bundle: ProjectBundle): Promise<void> {
    const previousBundle = await this.loadProject(bundle.project.id);
    await ensureProjectDir(bundle.project.id);
    await writeTextFile(projectFile(bundle.project.id), JSON.stringify(bundle, null, 2), {
      baseDir: BaseDirectory.AppData
    });

    if (previousBundle) {
      await cleanupUnreferencedAssets(getLocalAssetPath(previousBundle));
    }
  },

  async loadProject(projectId: string): Promise<ProjectBundle | null> {
    const file = projectFile(projectId);
    const found = await exists(file, { baseDir: BaseDirectory.AppData });
    if (!found) {
      return null;
    }

    const text = await readTextFile(file, { baseDir: BaseDirectory.AppData });
    return JSON.parse(text) as ProjectBundle;
  },

  async listProjects(): Promise<ProjectSummary[]> {
    const projects = await Promise.all(
      (await listProjectBundles()).map(async (bundle) => ({
        id: bundle.project.id,
        name: bundle.project.name,
        updatedAt: bundle.project.updatedAt
      }))
    );

    return projects.filter((item): item is ProjectSummary => item !== null).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async deleteProject(projectId: string): Promise<void> {
    const bundle = await this.loadProject(projectId);
    const dir = projectDir(projectId);
    const found = await exists(dir, { baseDir: BaseDirectory.AppData });
    if (!found) {
      return;
    }

    await remove(dir, { baseDir: BaseDirectory.AppData, recursive: true });

    if (bundle) {
      await cleanupUnreferencedAssets(getLocalAssetPath(bundle));
    }
  }
};
