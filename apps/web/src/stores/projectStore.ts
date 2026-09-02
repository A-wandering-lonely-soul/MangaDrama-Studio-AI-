import { create } from 'zustand';
import type { Episode, Project, ProjectSummary, Scene } from '@manga-drama/types';
import type { Asset } from '@manga-drama/types';
import { indexedDbAdapter } from '../storage/indexedDbAdapter';

interface ProjectState {
  projectId: string;
  projectName: string;
  lastSavedAt: number | null;
  projectList: ProjectSummary[];
  setProjectName: (name: string) => void;
  saveCurrent: (scene: Scene, assets: Asset[]) => Promise<void>;
  loadById: (projectId: string) => Promise<{ scene: Scene; assets: Asset[] } | null>;
  refreshList: () => Promise<void>;
  removeProject: (projectId: string) => Promise<void>;
}

function createEpisode(scene: Scene): Episode {
  return {
    id: 'episode-001',
    title: '第 1 集',
    scenes: [scene]
  };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectId: `project-${crypto.randomUUID()}`,
  projectName: '未命名项目',
  lastSavedAt: null,
  projectList: [],
  setProjectName: (projectName) => set({ projectName }),
  saveCurrent: async (scene, assets) => {
    const state = get();
    const now = Date.now();
    const project: Project = {
      id: state.projectId,
      name: state.projectName,
      version: '0.1.0',
      createdAt: now,
      updatedAt: now,
      episodes: [createEpisode(scene)]
    };

    await indexedDbAdapter.saveProject({
      project,
      assets
    });

    set({ lastSavedAt: now });
    await get().refreshList();
  },
  loadById: async (projectId) => {
    const bundle = await indexedDbAdapter.loadProject(projectId);
    if (!bundle) {
      return null;
    }

    const loadedScene = bundle.project.episodes[0]?.scenes[0];
    if (!loadedScene) {
      return null;
    }

    set({
      projectId: bundle.project.id,
      projectName: bundle.project.name,
      lastSavedAt: bundle.project.updatedAt
    });

    return {
      scene: loadedScene,
      assets: bundle.assets
    };
  },
  refreshList: async () => {
    const projectList = await indexedDbAdapter.listProjects();
    set({ projectList });
  },
  removeProject: async (projectId) => {
    await indexedDbAdapter.deleteProject(projectId);
    await get().refreshList();
  }
}));
