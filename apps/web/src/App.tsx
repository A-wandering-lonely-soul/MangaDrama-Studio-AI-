import { useRef } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import type { Asset } from '@manga-drama/types';
import CanvasContainer from './components/CanvasContainer';
import { createDemoAsset, createSceneObjectFromAsset, useSceneStore } from './stores/sceneStore';

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scene = useSceneStore((state) => state.scene);
  const assets = useSceneStore((state) => state.assets);
  const addAsset = useSceneStore((state) => state.addAsset);
  const addObject = useSceneStore((state) => state.addObject);

  const handleAddDemoImage = () => {
    const asset = createDemoAsset();
    addAsset(asset);
    addObject(createSceneObjectFromAsset(asset));
  };

  const handleUploadClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const asset: Asset = {
      id: `asset-${crypto.randomUUID()}`,
      type: 'image',
      name: file.name,
      url: await toDataUrl(file),
      width: 640,
      height: 640
    };

    addAsset(asset);
    addObject(createSceneObjectFromAsset(asset));
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateRows: '64px 1fr',
        background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)',
        color: '#e2e8f0'
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
          background: 'rgba(15, 23, 42, 0.92)'
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>MangaDrama Studio</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Phase 1 · Pixi renderer online</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: '#cbd5e1' }}>
          <span>Scene: {scene.name}</span>
          <span>Assets: {assets.length}</span>
        </div>
      </header>

      <main
        style={{
          display: 'grid',
          gridTemplateColumns: '280px minmax(0, 1fr) 320px',
          gap: 16,
          padding: 16,
          minHeight: 0
        }}
      >
        <aside
          style={{
            border: '1px solid rgba(148, 163, 184, 0.18)',
            borderRadius: 16,
            padding: 16,
            background: 'rgba(15, 23, 42, 0.85)'
          }}
        >
          <h2 style={{ marginTop: 0 }}>素材操作</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <button type="button" onClick={handleAddDemoImage} style={buttonStyle}>
              Add Demo Image
            </button>
            <button type="button" onClick={handleUploadClick} style={buttonStyle}>
              Upload Image
            </button>
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
          </div>
          <div style={{ marginTop: 20, fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
            <div>鼠标拖动画面空白处可平移镜头。</div>
            <div>滚轮可缩放 Camera。</div>
            <div>拖拽角色可以移动对象。</div>
          </div>
        </aside>

        <section
          style={{
            border: '1px solid rgba(148, 163, 184, 0.18)',
            borderRadius: 16,
            overflow: 'hidden',
            background: '#020617',
            minHeight: 640
          }}
        >
          <CanvasContainer />
        </section>

        <aside
          style={{
            border: '1px solid rgba(148, 163, 184, 0.18)',
            borderRadius: 16,
            padding: 16,
            background: 'rgba(15, 23, 42, 0.85)'
          }}
        >
          <h2 style={{ marginTop: 0 }}>Scene Inspector</h2>
          <div style={inspectorRow}>
            <span>ID</span>
            <strong>{scene.id}</strong>
          </div>
          <div style={inspectorRow}>
            <span>Size</span>
            <strong>
              {scene.width} × {scene.height}
            </strong>
          </div>
          <div style={inspectorRow}>
            <span>Camera</span>
            <strong>
              {scene.camera.x.toFixed(0)}, {scene.camera.y.toFixed(0)} · zoom {scene.camera.zoom.toFixed(2)}
            </strong>
          </div>
          <div style={inspectorRow}>
            <span>Objects</span>
            <strong>{scene.objects.length}</strong>
          </div>
          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Objects</h3>
            <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflow: 'auto' }}>
              {scene.objects.map((object) => (
                <div
                  key={object.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(30, 41, 59, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.12)'
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{object.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    {object.type} · x {object.transform.x.toFixed(0)} y {object.transform.y.toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

const buttonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 12,
  padding: '12px 14px',
  background: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer'
};

const inspectorRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 0',
  borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
  fontSize: 13
};
