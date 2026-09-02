import { useMemo, useRef } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import type { Asset } from '@manga-drama/types';
import CanvasContainer from './components/CanvasContainer';
import { createDemoAsset, createSceneObjectFromAsset, useSceneStore } from './stores/sceneStore';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';

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
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const addAsset = useSceneStore((state) => state.addAsset);
  const addObject = useSceneStore((state) => state.addObject);
  const selectObject = useSceneStore((state) => state.selectObject);
  const clearSelection = useSceneStore((state) => state.clearSelection);
  const removeSelectedObjects = useSceneStore((state) => state.removeSelectedObjects);
  const duplicateSelectedObjects = useSceneStore((state) => state.duplicateSelectedObjects);
  const copySelection = useSceneStore((state) => state.copySelection);
  const pasteSelection = useSceneStore((state) => state.pasteSelection);
  const moveLayerUp = useSceneStore((state) => state.moveLayerUp);
  const moveLayerDown = useSceneStore((state) => state.moveLayerDown);
  const bringToFront = useSceneStore((state) => state.bringToFront);
  const sendToBack = useSceneStore((state) => state.sendToBack);
  const updateObjectTransform = useSceneStore((state) => state.updateObjectTransform);

  const activeObject = useMemo(() => {
    if (selectedIds.length !== 1) {
      return null;
    }

    return scene.objects.find((object) => object.id === selectedIds[0]) ?? null;
  }, [scene.objects, selectedIds]);

  useEditorShortcuts();

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

  const updateTransformValue = (key: keyof NonNullable<typeof activeObject>['transform'], value: number) => {
    if (!activeObject || Number.isNaN(value)) {
      return;
    }

    updateObjectTransform(activeObject.id, { [key]: value });
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
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Phase 2 · 画布编辑器</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: '#cbd5e1' }}>
          <span>场景: {scene.name}</span>
          <span>素材: {assets.length}</span>
          <span>选中: {selectedIds.length}</span>
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
              添加演示角色
            </button>
            <button type="button" onClick={handleUploadClick} style={buttonStyle}>
              上传图片素材
            </button>
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
          </div>
          <h3 style={{ marginTop: 20, marginBottom: 10 }}>对象操作</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <button type="button" style={buttonStyleSecondary} onClick={duplicateSelectedObjects}>
              复制选中对象
            </button>
            <button type="button" style={buttonStyleSecondary} onClick={removeSelectedObjects}>
              删除选中对象
            </button>
            <button type="button" style={buttonStyleSecondary} onClick={copySelection}>
              复制到剪贴板 (Ctrl+C)
            </button>
            <button type="button" style={buttonStyleSecondary} onClick={pasteSelection}>
              从剪贴板粘贴 (Ctrl+V)
            </button>
          </div>
          <h3 style={{ marginTop: 20, marginBottom: 10 }}>图层操作</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <button type="button" style={buttonStyleSecondary} onClick={bringToFront}>
              置于顶层
            </button>
            <button type="button" style={buttonStyleSecondary} onClick={sendToBack}>
              置于底层
            </button>
            <button type="button" style={buttonStyleSecondary} onClick={moveLayerUp}>
              上移一层
            </button>
            <button type="button" style={buttonStyleSecondary} onClick={moveLayerDown}>
              下移一层
            </button>
          </div>
          <div style={{ marginTop: 20, fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
            <div>按住 Shift 点击对象可多选。</div>
            <div>Delete 删除，Ctrl+C 复制，Ctrl+V 粘贴。</div>
            <div>鼠标滚轮缩放镜头，拖动空白处平移镜头。</div>
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
          <h2 style={{ marginTop: 0 }}>属性面板</h2>
          <div style={inspectorRow}>
            <span>ID</span>
            <strong>{scene.id}</strong>
          </div>
          <div style={inspectorRow}>
            <span>尺寸</span>
            <strong>
              {scene.width} × {scene.height}
            </strong>
          </div>
          <div style={inspectorRow}>
            <span>镜头</span>
            <strong>
              {scene.camera.x.toFixed(0)}, {scene.camera.y.toFixed(0)} · zoom {scene.camera.zoom.toFixed(2)}
            </strong>
          </div>
          <div style={inspectorRow}>
            <span>对象数量</span>
            <strong>{scene.objects.length}</strong>
          </div>

          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>变换编辑</h3>
            {!activeObject && <div style={{ color: '#94a3b8', fontSize: 13 }}>请选择单个对象后编辑。</div>}
            {activeObject && (
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={fieldLabel}>
                  X
                  <input
                    style={fieldInput}
                    type="number"
                    value={activeObject.transform.x}
                    onChange={(event) => updateTransformValue('x', Number(event.target.value))}
                  />
                </label>
                <label style={fieldLabel}>
                  Y
                  <input
                    style={fieldInput}
                    type="number"
                    value={activeObject.transform.y}
                    onChange={(event) => updateTransformValue('y', Number(event.target.value))}
                  />
                </label>
                <label style={fieldLabel}>
                  宽度
                  <input
                    style={fieldInput}
                    type="number"
                    value={activeObject.transform.width}
                    onChange={(event) => updateTransformValue('width', Number(event.target.value))}
                  />
                </label>
                <label style={fieldLabel}>
                  高度
                  <input
                    style={fieldInput}
                    type="number"
                    value={activeObject.transform.height}
                    onChange={(event) => updateTransformValue('height', Number(event.target.value))}
                  />
                </label>
                <label style={fieldLabel}>
                  缩放 X
                  <input
                    style={fieldInput}
                    type="number"
                    step="0.1"
                    value={activeObject.transform.scaleX}
                    onChange={(event) => updateTransformValue('scaleX', Number(event.target.value))}
                  />
                </label>
                <label style={fieldLabel}>
                  缩放 Y
                  <input
                    style={fieldInput}
                    type="number"
                    step="0.1"
                    value={activeObject.transform.scaleY}
                    onChange={(event) => updateTransformValue('scaleY', Number(event.target.value))}
                  />
                </label>
                <label style={fieldLabel}>
                  旋转 (弧度)
                  <input
                    style={fieldInput}
                    type="number"
                    step="0.05"
                    value={activeObject.transform.rotation}
                    onChange={(event) => updateTransformValue('rotation', Number(event.target.value))}
                  />
                </label>
              </div>
            )}
          </div>

          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>对象列表</h3>
            <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflow: 'auto' }}>
              {scene.objects.map((object) => (
                <div
                  key={object.id}
                  onClick={() => selectObject(object.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: selectedIds.includes(object.id) ? 'rgba(37, 99, 235, 0.35)' : 'rgba(30, 41, 59, 0.9)',
                    border: selectedIds.includes(object.id)
                      ? '1px solid rgba(96, 165, 250, 0.8)'
                      : '1px solid rgba(148, 163, 184, 0.12)'
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{object.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    {object.type} · x {object.transform.x.toFixed(0)} y {object.transform.y.toFixed(0)} · z {object.zIndex}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button type="button" style={buttonStyleSecondary} onClick={clearSelection}>
                取消选择
              </button>
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

const buttonStyleSecondary: CSSProperties = {
  border: '1px solid rgba(148, 163, 184, 0.35)',
  borderRadius: 10,
  padding: '10px 12px',
  background: 'rgba(30, 41, 59, 0.9)',
  color: '#e2e8f0',
  fontWeight: 600,
  cursor: 'pointer'
};

const fieldLabel: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 12,
  color: '#94a3b8'
};

const fieldInput: CSSProperties = {
  width: '100%',
  borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.2)',
  background: 'rgba(15, 23, 42, 0.8)',
  color: '#e2e8f0',
  padding: '8px 10px'
};

const inspectorRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 0',
  borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
  fontSize: 13
};
