import { Application, Container, Graphics, Sprite, Text, Texture, type FederatedPointerEvent } from 'pixi.js';
import { screenToWorld, type Point } from './coordinate';
import type { Asset, Camera, Scene, SceneObject } from '@manga-drama/types';

export interface RendererInitOptions {
  backgroundColor?: number;
}

export interface RendererSceneUpdate {
  scene: Scene;
  assets: Asset[];
  selectedIds?: string[];
}

interface DragState {
  objectId: string;
  pointerOffset: Point;
}

interface CameraDragState {
  startWorldPoint: Point;
  startCamera: Camera;
}

interface ObjectNode {
  container: Container;
  sprite: Sprite;
  backdrop: Graphics;
  frame: Graphics;
}

export class Renderer {
  private app: Application | null = null;
  private sceneLayer: Container | null = null;
  private selectionLayer: Container | null = null;
  private objectNodes = new Map<string, ObjectNode>();
  private dragState: DragState | null = null;
  private cameraDragState: CameraDragState | null = null;
  private onObjectMove: ((objectId: string, nextPosition: Point) => void) | null = null;
  private onCameraChange: ((camera: Camera) => void) | null = null;
  private onSelectionChange: ((payload: { objectId: string; append: boolean }) => void) | null = null;
  private viewport: Point = { x: 0, y: 0 };
  private currentScene: Scene | null = null;
  private currentAssets: Asset[] = [];
  private selectedIdSet = new Set<string>();
  private subtitleText = '';

  async mount(container: HTMLDivElement, options: RendererInitOptions = {}): Promise<void> {
    if (this.app) {
      return;
    }

    const app = new Application();
    await app.init({
      resizeTo: container,
      background: options.backgroundColor ?? 0x111827,
      antialias: true,
      resolution: window.devicePixelRatio || 1
    });

    container.appendChild(app.canvas);
    this.app = app;
    this.viewport = { x: container.clientWidth, y: container.clientHeight };

    const stage = app.stage;
    stage.eventMode = 'static';
    stage.hitArea = app.screen;

    this.sceneLayer = new Container();
    this.selectionLayer = new Container();
    this.sceneLayer.eventMode = 'static';
    this.sceneLayer.sortableChildren = true;

    stage.addChild(this.sceneLayer, this.selectionLayer);

    stage.on('pointerdown', this.handleStagePointerDown);
    stage.on('pointermove', this.handleStagePointerMove);
    stage.on('pointerup', this.handleStagePointerUp);
    stage.on('pointerupoutside', this.handleStagePointerUp);
    app.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  destroy(): void {
    if (!this.app) {
      return;
    }

    this.app.stage.off('pointermove', this.handleStagePointerMove);
    this.app.stage.off('pointerup', this.handleStagePointerUp);
    this.app.stage.off('pointerupoutside', this.handleStagePointerUp);
    this.app.stage.off('pointerdown', this.handleStagePointerDown);
    this.app.canvas.removeEventListener('wheel', this.handleWheel);
    this.app.destroy(true);
    this.app = null;
    this.sceneLayer = null;
    this.selectionLayer = null;
    this.objectNodes.clear();
    this.dragState = null;
    this.cameraDragState = null;
    this.currentScene = null;
    this.currentAssets = [];
  }

  setObjectMoveHandler(handler: (objectId: string, nextPosition: Point) => void): void {
    this.onObjectMove = handler;
  }

  setCameraChangeHandler(handler: (camera: Camera) => void): void {
    this.onCameraChange = handler;
  }

  setSelectionChangeHandler(handler: (payload: { objectId: string; append: boolean }) => void): void {
    this.onSelectionChange = handler;
  }

  setSubtitleText(text: string): void {
    this.subtitleText = text;
    if (!this.currentScene) {
      return;
    }

    this.selectionLayer?.removeChildren();
    this.renderOverlay(this.currentScene.camera);
  }

  sync({ scene, assets, selectedIds = [] }: RendererSceneUpdate): void {
    this.currentScene = scene;
    this.currentAssets = assets;
    this.selectedIdSet = new Set(selectedIds);
    this.viewport = { x: this.app?.screen.width ?? scene.width, y: this.app?.screen.height ?? scene.height };

    if (!this.app || !this.sceneLayer || !this.selectionLayer) {
      return;
    }

    this.sceneLayer.removeChildren();
    this.selectionLayer.removeChildren();
    this.objectNodes.clear();

    this.applyCameraTransform(scene.camera);
    this.renderSceneBackground(scene);
    this.renderSceneObjects(scene, assets, this.selectedIdSet);
    this.renderOverlay(scene.camera);
  }

  updateCamera(camera: Camera): void {
    if (!this.currentScene) {
      return;
    }

    this.currentScene = {
      ...this.currentScene,
      camera
    };
    this.applyCameraTransform(camera);
    this.selectionLayer?.removeChildren();
    this.renderOverlay(camera);
    this.onCameraChange?.(camera);
  }

  updateObjectPosition(objectId: string, nextPosition: Point): void {
    if (!this.currentScene) {
      return;
    }

    const nextObjects = this.currentScene.objects.map((object) => {
      if (object.id !== objectId) {
        return object;
      }

      return {
        ...object,
        transform: {
          ...object.transform,
          x: nextPosition.x,
          y: nextPosition.y
        }
      };
    });

    this.currentScene = {
      ...this.currentScene,
      objects: nextObjects
    };
    this.sync({ scene: this.currentScene, assets: this.currentAssets });
  }

  applyRuntimeScene(runtimeScene: Scene): void {
    this.currentScene = runtimeScene;
    this.applyCameraTransform(runtimeScene.camera);
    this.selectionLayer?.removeChildren();
    this.renderOverlay(runtimeScene.camera);

    for (const object of runtimeScene.objects) {
      const node = this.objectNodes.get(object.id);
      if (!node) {
        continue;
      }

      const asset = object.assetId ? this.currentAssets.find((entry) => entry.id === object.assetId) : undefined;
      const isImageAsset = asset?.type === 'image';

      node.container.position.set(object.transform.x, object.transform.y);
      node.container.scale.set(object.transform.scaleX, object.transform.scaleY);
      node.container.rotation = object.transform.rotation;
      node.container.alpha = object.opacity;
      node.container.visible = object.visible;
      node.container.zIndex = object.zIndex;

      node.sprite.width = object.transform.width;
      node.sprite.height = object.transform.height;
      node.sprite.anchor.set(object.transform.anchorX, object.transform.anchorY);

      node.backdrop.clear();
      node.backdrop.roundRect(0, 0, object.transform.width, object.transform.height, 18);
      node.backdrop.fill({ color: 0x0b1220, alpha: isImageAsset ? 0 : 0.28 });
      node.backdrop.position.set(
        -object.transform.width * object.transform.anchorX,
        -object.transform.height * object.transform.anchorY
      );

      node.frame.clear();
      node.frame.rect(0, 0, object.transform.width, object.transform.height);
      node.frame.stroke({ width: 2, color: object.type === 'character' ? 0x22c55e : 0x60a5fa, alpha: 0.9 });
      node.frame.position.set(-object.transform.width * object.transform.anchorX, -object.transform.height * object.transform.anchorY);
      node.frame.visible = this.selectedIdSet.has(object.id);
    }
  }

  private renderSceneBackground(scene: Scene): void {
    if (!this.sceneLayer) {
      return;
    }

    const background = new Graphics();
    background.rect(0, 0, scene.width, scene.height);
    background.fill({ color: 0x0f172a });
    this.sceneLayer.addChild(background);
  }

  private applyCameraTransform(camera: Camera): void {
    if (!this.sceneLayer || !this.app) {
      return;
    }

    this.sceneLayer.position.set(this.viewport.x / 2, this.viewport.y / 2);
    this.sceneLayer.pivot.set(camera.x, camera.y);
    this.sceneLayer.scale.set(camera.zoom);
    this.sceneLayer.rotation = camera.rotation;
  }

  private renderSceneObjects(scene: Scene, assets: Asset[], selectedIds: Set<string>): void {
    if (!this.sceneLayer) {
      return;
    }

    const sortedObjects = [...scene.objects].sort((left, right) => left.zIndex - right.zIndex);
    for (const object of sortedObjects) {
      const node = this.createObjectNode(object, assets, selectedIds.has(object.id));
      this.objectNodes.set(object.id, node);
      this.sceneLayer.addChild(node.container);
    }
  }

  private renderOverlay(camera: Camera): void {
    if (!this.selectionLayer) {
      return;
    }

    const label = new Text({
      text: `镜头 x:${camera.x.toFixed(0)} y:${camera.y.toFixed(0)} zoom:${camera.zoom.toFixed(2)}`,
      style: {
        fill: 0xffffff,
        fontSize: 12
      }
    });
    label.position.set(16, 16);
    this.selectionLayer.addChild(label);

    if (!this.subtitleText) {
      return;
    }

    const subtitle = new Text({
      text: this.subtitleText,
      style: {
        fill: 0xffffff,
        fontSize: 28,
        stroke: {
          color: 0x000000,
          width: 4
        },
        align: 'center'
      }
    });
    subtitle.anchor.set(0.5, 1);
    subtitle.position.set(this.viewport.x / 2, this.viewport.y - 40);
    this.selectionLayer.addChild(subtitle);
  }

  private createObjectNode(object: SceneObject, assets: Asset[], selected: boolean): ObjectNode {
    const container = new Container();
    container.position.set(object.transform.x, object.transform.y);
    container.scale.set(object.transform.scaleX, object.transform.scaleY);
    container.rotation = object.transform.rotation;
    container.eventMode = object.locked ? 'none' : 'static';
    container.cursor = object.locked ? 'default' : 'grab';
    container.zIndex = object.zIndex;
    container.alpha = object.opacity;
    container.visible = object.visible;
    container.sortableChildren = true;

    const asset = object.assetId ? assets.find((entry) => entry.id === object.assetId) : undefined;
    const texture = this.resolveTexture(object, asset);
    const sprite = new Sprite(texture);
    sprite.anchor.set(object.transform.anchorX, object.transform.anchorY);
    sprite.eventMode = 'none';
    sprite.width = object.transform.width;
    sprite.height = object.transform.height;

    if (asset?.url) {
      this.attachAssetTexture(sprite, asset.url, object);
    }

    const backdrop = new Graphics();
    backdrop.roundRect(0, 0, object.transform.width, object.transform.height, 18);
    const isImageAsset = asset?.type === 'image';
    backdrop.fill({ color: 0x0b1220, alpha: isImageAsset ? 0 : 0.28 });
    backdrop.position.set(-object.transform.width * object.transform.anchorX, -object.transform.height * object.transform.anchorY);

    const frame = new Graphics();
    frame.rect(0, 0, object.transform.width, object.transform.height);
    frame.stroke({ width: 2, color: object.type === 'character' ? 0x22c55e : 0x60a5fa, alpha: 0.9 });
    frame.position.set(-object.transform.width * object.transform.anchorX, -object.transform.height * object.transform.anchorY);
    frame.visible = selected;

    container.addChild(backdrop, sprite, frame);

    container.on('pointerdown', (event) => {
      if (object.locked) {
        return;
      }

      const globalPoint = this.toWorldPoint(event);
      this.dragState = {
        objectId: object.id,
        pointerOffset: {
          x: globalPoint.x - object.transform.x,
          y: globalPoint.y - object.transform.y
        }
      };
      this.onSelectionChange?.({ objectId: object.id, append: event.shiftKey });
      container.cursor = 'grabbing';
      frame.visible = true;
      event.stopPropagation();
    });

    container.on('pointerup', () => {
      frame.visible = false;
      container.cursor = 'grab';
    });

    container.on('pointerupoutside', () => {
      frame.visible = false;
      container.cursor = 'grab';
    });

    return { container, sprite, backdrop, frame };
  }

  private resolveTexture(object: SceneObject, asset?: Asset): Texture {
    if (asset?.type === 'image') {
      return this.createPlaceholderTexture(object.transform.width, object.transform.height, asset.name);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(object.transform.width));
    canvas.height = Math.max(1, Math.round(object.transform.height));
    const context = canvas.getContext('2d');
    if (!context) {
      return Texture.WHITE;
    }

    if (object.type === 'background') {
      drawBackgroundIllustration(context, canvas.width, canvas.height, object.name);
      return Texture.from(canvas);
    }

    if (object.type === 'character') {
      drawCharacterCardIllustration(context, canvas.width, canvas.height, object.name);
      return Texture.from(canvas);
    }

    drawGenericCardIllustration(context, canvas.width, canvas.height, object.name, object.type);
    return Texture.from(canvas);
  }

  private createPlaceholderTexture(width: number, height: number, label: string): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext('2d');
    if (!context) {
      return Texture.WHITE;
    }

    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1d4ed8');
    gradient.addColorStop(1, '#0ea5e9');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = 'rgba(15,23,42,0.65)';
    roundRect(context, canvas.width * 0.08, canvas.height * 0.72, canvas.width * 0.84, canvas.height * 0.2, Math.min(canvas.width, canvas.height) * 0.05);
    context.fill();

    context.fillStyle = '#e2e8f0';
    context.font = `${Math.max(10, Math.floor(canvas.width * 0.08))}px sans-serif`;
    context.fillText('LOADING IMAGE', canvas.width * 0.12, canvas.height * 0.22);
    context.fillStyle = '#bfdbfe';
    context.font = `${Math.max(10, Math.floor(canvas.width * 0.055))}px sans-serif`;
    context.fillText(truncateLabel(label, 18), canvas.width * 0.12, canvas.height * 0.84);

    return Texture.from(canvas);
  }

  private attachAssetTexture(sprite: Sprite, url: string, object: SceneObject): void {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(object.transform.width));
      canvas.height = Math.max(1, Math.round(object.transform.height));
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      const ratio = Math.min(canvas.width / Math.max(1, image.width), canvas.height / Math.max(1, image.height));
      const drawWidth = Math.max(1, Math.floor(image.width * ratio));
      const drawHeight = Math.max(1, Math.floor(image.height * ratio));
      const drawX = Math.floor((canvas.width - drawWidth) / 2);
      const drawY = Math.floor((canvas.height - drawHeight) / 2);
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      sprite.texture = Texture.from(canvas);
      sprite.width = object.transform.width;
      sprite.height = object.transform.height;
      sprite.alpha = 1;
    };

    image.onerror = () => {
      sprite.alpha = 1;
    };

    image.src = url;
  }

  private toWorldPoint(event: FederatedPointerEvent): Point {
    const canvas = this.app?.canvas;
    const rect = canvas?.getBoundingClientRect();
    const viewport = this.viewport.x > 0 && this.viewport.y > 0 ? this.viewport : { x: rect?.width ?? 0, y: rect?.height ?? 0 };

    return screenToWorld({ x: event.global.x, y: event.global.y }, this.currentScene?.camera ?? { x: 0, y: 0, zoom: 1, rotation: 0 }, viewport);
  }

  private handleStagePointerDown = (event: FederatedPointerEvent): void => {
    if (!this.currentScene || event.target !== this.app?.stage) {
      return;
    }

    if (!event.shiftKey) {
      this.onSelectionChange?.({ objectId: '', append: false });
    }

    this.cameraDragState = {
      startWorldPoint: this.toWorldPoint(event),
      startCamera: this.currentScene.camera
    };
  };

  private handleStagePointerMove = (event: FederatedPointerEvent): void => {
    if (this.dragState && this.currentScene) {
      const worldPoint = this.toWorldPoint(event);
      const nextPosition = {
        x: worldPoint.x - this.dragState.pointerOffset.x,
        y: worldPoint.y - this.dragState.pointerOffset.y
      };

      this.onObjectMove?.(this.dragState.objectId, nextPosition);
      return;
    }

    if (!this.cameraDragState || !this.currentScene) {
      return;
    }

    const worldPoint = this.toWorldPoint(event);
    const deltaX = this.cameraDragState.startWorldPoint.x - worldPoint.x;
    const deltaY = this.cameraDragState.startWorldPoint.y - worldPoint.y;

    this.onCameraChange?.({
      ...this.cameraDragState.startCamera,
      x: this.cameraDragState.startCamera.x + deltaX,
      y: this.cameraDragState.startCamera.y + deltaY
    });
  };

  private handleStagePointerUp = (): void => {
    this.dragState = null;
    this.cameraDragState = null;
  };

  private handleWheel = (event: WheelEvent): void => {
    if (!this.currentScene || !this.app) {
      return;
    }

    event.preventDefault();

    const zoomStep = event.deltaY > 0 ? 0.92 : 1.08;
    const nextZoom = Math.min(4, Math.max(0.2, this.currentScene.camera.zoom * zoomStep));
    const nextCamera = this.zoomCameraAtPointer(this.currentScene.camera, nextZoom, { x: event.offsetX, y: event.offsetY });

    this.onCameraChange?.(nextCamera);
  };

  private zoomCameraAtPointer(camera: Camera, nextZoom: number, pointer: Point): Camera {
    const viewport = this.viewport;
    const before = screenToWorld(pointer, camera, viewport);
    const afterCamera: Camera = {
      ...camera,
      zoom: nextZoom
    };
    const after = screenToWorld(pointer, afterCamera, viewport);

    return {
      ...afterCamera,
      x: afterCamera.x + (before.x - after.x),
      y: afterCamera.y + (before.y - after.y)
    };
  };
}

function drawBackgroundIllustration(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  name: string
): void {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(1, '#334155');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.14;
  for (let index = 0; index < 8; index += 1) {
    context.beginPath();
    context.arc(width * (0.1 + index * 0.12), height * (0.2 + (index % 3) * 0.18), 20 + index * 9, 0, Math.PI * 2);
    context.fillStyle = index % 2 === 0 ? '#93c5fd' : '#38bdf8';
    context.fill();
  }
  context.globalAlpha = 1;

  context.fillStyle = 'rgba(15, 23, 42, 0.58)';
  roundRect(context, width * 0.08, height * 0.66, width * 0.84, height * 0.24, Math.min(width, height) * 0.04);
  context.fill();

  context.fillStyle = '#e2e8f0';
  context.font = `${Math.max(14, Math.floor(width * 0.07))}px sans-serif`;
  context.fillText('SCENE', width * 0.13, height * 0.75);
  context.fillStyle = '#bfdbfe';
  context.font = `${Math.max(12, Math.floor(width * 0.05))}px sans-serif`;
  context.fillText(truncateLabel(name, 20), width * 0.13, height * 0.83);
}

function drawCharacterCardIllustration(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  name: string
): void {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1d4ed8');
  gradient.addColorStop(1, '#0ea5e9');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = 'rgba(255, 255, 255, 0.16)';
  roundRect(context, width * 0.03, height * 0.03, width * 0.94, height * 0.94, Math.min(width, height) * 0.08);
  context.fill();

  const headRadius = Math.min(width, height) * 0.14;
  context.fillStyle = '#f8fafc';
  context.beginPath();
  context.arc(width * 0.5, height * 0.34, headRadius, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#0f172a';
  roundRect(context, width * 0.28, height * 0.48, width * 0.44, height * 0.38, Math.min(width, height) * 0.08);
  context.fill();

  context.fillStyle = 'rgba(255, 255, 255, 0.28)';
  roundRect(context, width * 0.18, height * 0.76, width * 0.64, height * 0.12, Math.min(width, height) * 0.05);
  context.fill();

  context.fillStyle = '#e2e8f0';
  context.font = `${Math.max(12, Math.floor(width * 0.08))}px sans-serif`;
  context.fillText('CHARACTER', width * 0.13, height * 0.14);
  context.fillStyle = '#dbeafe';
  context.font = `${Math.max(10, Math.floor(width * 0.06))}px sans-serif`;
  context.fillText(truncateLabel(name, 16), width * 0.13, height * 0.22);
}

function drawGenericCardIllustration(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  name: string,
  type: SceneObject['type']
): void {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0369a1');
  gradient.addColorStop(1, '#0f766e');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = 'rgba(2, 6, 23, 0.35)';
  roundRect(context, width * 0.08, height * 0.08, width * 0.84, height * 0.84, Math.min(width, height) * 0.08);
  context.fill();

  context.strokeStyle = 'rgba(226, 232, 240, 0.36)';
  context.lineWidth = Math.max(2, Math.floor(Math.min(width, height) * 0.015));
  context.beginPath();
  context.moveTo(width * 0.2, height * 0.34);
  context.lineTo(width * 0.8, height * 0.34);
  context.lineTo(width * 0.8, height * 0.7);
  context.lineTo(width * 0.2, height * 0.7);
  context.closePath();
  context.stroke();

  context.fillStyle = '#e2e8f0';
  context.font = `${Math.max(10, Math.floor(width * 0.07))}px sans-serif`;
  context.fillText(type.toUpperCase(), width * 0.14, height * 0.22);
  context.fillStyle = '#bae6fd';
  context.font = `${Math.max(10, Math.floor(width * 0.055))}px sans-serif`;
  context.fillText(truncateLabel(name, 18), width * 0.14, height * 0.82);
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function truncateLabel(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1)}...`;
}
