# MangaDrama Studio

AI 漫剧可视化创作工作台（Web + Desktop + Server 最小闭环）。

## 目标

在不提前堆积 UI 的前提下，已完成：

- React + TypeScript + Vite 前端工程
- pnpm + Turbo monorepo
- 核心类型包
- PixiJS 渲染包初始化
- 可启动的最小 Web 编辑器
- Tauri 桌面端骨架与本地素材能力
- NestJS AI Mock 后端 + SQLite 任务持久化

## 目录说明

- `apps/web`：前端入口应用
- `apps/desktop`：Tauri 桌面端入口
- `packages/types`：项目核心类型定义
- `packages/renderer`：PixiJS 渲染层初始骨架
- `server`：NestJS 后端最小骨架与 AI Mock API

## 启动方式

```bash
pnpm install
pnpm dev
```

后端单独启动：

```bash
pnpm --filter manga-drama-server dev
```

前后端联调（推荐）：

```bash
pnpm dev:core
```

其中：

- Web: http://localhost:5173
- Server: http://localhost:3000

AI 冒烟测试（需先启动 Server）：

```bash
pnpm smoke:ai
```

## 当前阶段

Phase 18：后端 AI Task 已切换到 SQLite 持久化。

当前已具备前后端最小联调闭环，可继续向真实 AI Provider 适配层推进。

## 设计原则

- React 只负责 UI 与编辑状态
- Renderer 与 UI 解耦
- Scene JSON 为核心数据契约
- AI 在 Phase 7 之后再接入
- 本阶段先保证工程可运行，不做过度设计
