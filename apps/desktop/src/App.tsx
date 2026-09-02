import type { CSSProperties } from 'react';

export default function App() {
  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>MangaDrama Studio Desktop</h1>
      <p style={descStyle}>Phase 9 桌面端骨架已接入（Tauri 2）。</p>
      <ul style={listStyle}>
        <li>复用 React + TypeScript 前端栈</li>
        <li>预置 Tauri 文件存储适配器骨架</li>
        <li>后续可接入与 Web 共用的编辑器 UI</li>
      </ul>
      <p style={hintStyle}>开发命令: pnpm --filter @manga-drama/desktop tauri:dev</p>
    </div>
  );
}

const containerStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: 'radial-gradient(circle at top, #0f172a 0%, #020617 60%)',
  color: '#e2e8f0',
  fontFamily: 'Segoe UI, PingFang SC, Microsoft YaHei, sans-serif'
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 32,
  letterSpacing: 0.5
};

const descStyle: CSSProperties = {
  margin: '12px 0 8px',
  color: '#bfdbfe'
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  lineHeight: 1.8
};

const hintStyle: CSSProperties = {
  marginTop: 16,
  fontSize: 13,
  color: '#94a3b8'
};
