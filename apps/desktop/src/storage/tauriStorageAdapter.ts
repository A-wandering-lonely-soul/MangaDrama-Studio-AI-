import type { ProjectBundle, ProjectSummary, StorageAdapter } from '@manga-drama/types';
import { BaseDirectory, exists, mkdir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs';

const ROOT_DIR = 'MangaDramaStudio';

function projectDir(projectId: string): string {
  return `${ROOT_DIR}/${projectId}`;
}

function projectFile(projectId: string): string {
  return `${projectDir(projectId)}/project.json`;
}

async function ensureProjectDir(projectId: string): Promise<void> {
  await mkdir(projectDir(projectId), { baseDir: BaseDirectory.AppData, recursive: true });
}

export const tauriStorageAdapter: StorageAdapter = {
  async saveProject(bundle: ProjectBundle): Promise<void> {
    await ensureProjectDir(bundle.project.id);
    await writeTextFile(projectFile(bundle.project.id), JSON.stringify(bundle, null, 2), {
      baseDir: BaseDirectory.AppData
    });
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
    // Phase 9 最小实现：以空列表兜底，后续可结合 readDir 扫描目录
    return [];
  },

  async deleteProject(projectId: string): Promise<void> {
    const dir = projectDir(projectId);
    const found = await exists(dir, { baseDir: BaseDirectory.AppData });
    if (!found) {
      return;
    }

    await remove(dir, { baseDir: BaseDirectory.AppData, recursive: true });
  }
};
