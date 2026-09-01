import { type Project } from '@manga-drama/types';
import { RENDERER_VERSION } from '@manga-drama/renderer';

const initialProject: Project = {
  id: 'project-001',
  name: '雨夜',
  version: '0.1.0',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  episodes: []
};

export default function App() {
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif' }}>
      <h1>MangaDrama Studio</h1>
      <p>Phase 0 scaffold is running.</p>
      <p>Project: {initialProject.name}</p>
      <p>Renderer version: {RENDERER_VERSION}</p>
    </main>
  );
}
