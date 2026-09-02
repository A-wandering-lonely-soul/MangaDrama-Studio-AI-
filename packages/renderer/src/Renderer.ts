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

export class Renderer {
  private app: Application | null = null;
  private sceneLayer: Container | null = null;
  private selectionLayer: Container | null = null;
  private objectNodes = new Map<string, Container>();
  private dragState: DragState | null = null;
  private cameraDragState: CameraDragState | null = null;
  private onObjectMove: ((objectId: string, nextPosition: Point) => void) | null = null;
  private onCameraChange: ((camera: Camera) => void) | null = null;
  private onSelectionChange: ((payload: { objectId: string; append: boolean }) => void) | null = null;
  private viewport: Point = { x: 0, y: 0 };
  private currentScene: Scene | null = null;
  private currentAssets: Asset[] = [];
  private selectedIdSet = new Set<string>();

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
    this.renderCameraOverlay(scene.camera);
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
    this.renderCameraOverlay(camera);
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
      this.sceneLayer.addChild(node);
    }
  }

  private renderCameraOverlay(camera: Camera): void {
    if (!this.selectionLayer) {
      return;
    }

    const label = new Text({
      text: `Camera x:${camera.x.toFixed(0)} y:${camera.y.toFixed(0)} zoom:${camera.zoom.toFixed(2)}`,
      style: {
        fill: 0xffffff,
        fontSize: 12
      }
    });
    label.position.set(16, 16);
    this.selectionLayer.addChild(label);
  }

  private createObjectNode(object: SceneObject, assets: Asset[], selected: boolean): Container {
    const container = new Container();
    container.position.set(object.transform.x, object.transform.y);
    container.eventMode = object.locked ? 'none' : 'static';
    container.cursor = object.locked ? 'default' : 'grab';
    container.zIndex = object.zIndex;
    container.alpha = object.opacity;
    container.visible = object.visible;
    container.sortableChildren = true;

    const texture = this.resolveTexture(object, assets);
    const sprite = new Sprite(texture);
    sprite.anchor.set(object.transform.anchorX, object.transform.anchorY);
    sprite.width = object.transform.width;
    sprite.height = object.transform.height;
    sprite.scale.set(object.transform.scaleX, object.transform.scaleY);
    sprite.rotation = object.transform.rotation;
    sprite.eventMode = 'none';

    const frame = new Graphics();
    frame.rect(0, 0, object.transform.width, object.transform.height);
    frame.stroke({ width: 2, color: object.type === 'character' ? 0x22c55e : 0x60a5fa, alpha: 0.9 });
    frame.position.set(-object.transform.width * object.transform.anchorX, -object.transform.height * object.transform.anchorY);
    frame.visible = selected;
    sprite.addChild(frame);

    container.addChild(sprite);

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

    return container;
  }

  private resolveTexture(object: SceneObject, assets: Asset[]): Texture {
    const asset = object.assetId ? assets.find((entry) => entry.id === object.assetId) : undefined;
    if (asset?.url) {
      return Texture.from(asset.url);
    }

    const color = object.type === 'background' ? 0x334155 : object.type === 'character' ? 0xf59e0b : 0x38bdf8;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(object.transform.width));
    canvas.height = Math.max(1, Math.round(object.transform.height));
    const context = canvas.getContext('2d');
    if (!context) {
      return Texture.WHITE;
    }

    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(255, 255, 255, 0.2)';
    context.fillRect(0, 0, canvas.width, 12);
    return Texture.from(canvas);
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
