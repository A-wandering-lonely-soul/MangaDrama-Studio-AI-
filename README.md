# MangaDrama Studio

AI 漫剧可视化创作工作台的 Phase 0 最小工程脚手架。

## 目标

在不提前堆积 UI 的前提下，先完成：

- React + TypeScript + Vite 前端工程
- pnpm + Turbo monorepo
- 核心类型包
- PixiJS 渲染包初始化
- 可启动的最小 Web 页面

## 目录说明

- `apps/web`：前端入口应用
- `packages/types`：项目核心类型定义
- `packages/renderer`：PixiJS 渲染层初始骨架

## 启动方式

```bash
pnpm install
pnpm dev
```

## 当前阶段

Phase 0：工程初始化

后续将严格按设计书的 Phase 1 → Phase 9 顺序推进。

## 设计原则

- React 只负责 UI 与编辑状态
- Renderer 与 UI 解耦
- Scene JSON 为核心数据契约
- AI 在 Phase 7 之后再接入
- 本阶段先保证工程可运行，不做过度设计
