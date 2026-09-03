import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Asset, Scene, SceneObject, TimelineTrack } from '@manga-drama/types';
import CanvasContainer from './components/CanvasContainer';
import {
  buildCameraMotionKeyframes,
  buildObjectMotionKeyframes,
  createDemoAsset,
  createSceneObjectFromAsset,
  type CameraAnimationPreset,
  type PositionAnimationPreset,
  useSceneStore
} from './stores/sceneStore';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { usePlaybackStore } from './stores/playbackStore';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import { primeAudioContext } from './audio/audioEngine';
import { useProjectStore } from './stores/projectStore';
import { useAutoSave } from './hooks/useAutoSave';
import { getPlatformBridge } from './platform/platformBridge';
import {
  getAiTask,
  getProviderStatus,
  getStaticAudios,
  getStaticImages,
  postAiImage,
  postAiStoryboard,
  postAiStory,
  type StaticAudioItem,
  type StaticImageItem,
  type StoryOutput,
  type StoryboardOutput
} from './ai/mockAiService';
import { storyboardToScene } from './ai/storyboardToScene';

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createShowcaseObject(
  assetId: string | undefined,
  name: string,
  type: SceneObject['type'],
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number
): SceneObject {
  const object: SceneObject = {
    id: makeId('object'),
    type,
    name,
    transform: {
      x,
      y,
      width,
      height,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      anchorX: 0.5,
      anchorY: 0.5
    },
    opacity: 1,
    visible: true,
    locked: false,
    zIndex
  };

  if (assetId) {
    object.assetId = assetId;
  }

  return object;
}

function makeShowcaseSvgDataUrl(title: string, subtitle: string, from: string, to: string): string {
  const safeTitle = title.slice(0, 20).replace(/[<&>]/g, '');
  const safeSubtitle = subtitle.slice(0, 28).replace(/[<&>]/g, '');
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${from}"/>
        <stop offset="100%" stop-color="${to}"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1080" fill="url(#bg)"/>
    <circle cx="840" cy="230" r="130" fill="#f8fafc" opacity="0.28"/>
    <rect x="110" y="690" width="860" height="230" rx="24" fill="rgba(2,6,23,0.64)"/>
    <text x="160" y="785" font-size="56" fill="#f8fafc" font-family="sans-serif">${safeTitle}</text>
    <text x="160" y="850" font-size="34" fill="#bfdbfe" font-family="sans-serif">${safeSubtitle}</text>
  </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

function createHalfFinishedShowcase(staticImages: StaticImageItem[]): { scene: Scene; assets: Asset[] } {
  const firstUrl = makeShowcaseSvgDataUrl('雨夜旧街', '半成品示例背景', '#0f172a', '#1d4ed8');
  const secondUrl = makeShowcaseSvgDataUrl('主角', '近景角色', '#0ea5e9', '#0284c7');
  const thirdUrl = makeShowcaseSvgDataUrl('同伴', '中景角色', '#38bdf8', '#0369a1');

  const backgroundAsset: Asset = {
    id: makeId('asset'),
    type: 'background',
    name: staticImages[0]?.name ?? '示例背景',
    url: firstUrl,
    width: 1080,
    height: 1920
  };

  const heroAsset: Asset = {
    id: makeId('asset'),
    type: 'character',
    name: staticImages[1]?.name ?? '主角',
    url: secondUrl,
    width: 640,
    height: 640
  };

  const partnerAsset: Asset = {
    id: makeId('asset'),
    type: 'character',
    name: staticImages[2]?.name ?? '同伴',
    url: thirdUrl,
    width: 640,
    height: 640
  };

  const assets: Asset[] = [backgroundAsset, heroAsset, partnerAsset];

  const backgroundObject = createShowcaseObject(
    undefined,
    '场景背景',
    'background',
    540,
    960,
    1280,
    1920,
    100
  );
  const heroObject = createShowcaseObject(undefined, '主角-近景', 'character', 360, 1200, 420, 420, 300);
  const partnerObject = createShowcaseObject(undefined, '同伴-中景', 'character', 760, 1140, 360, 360, 320);

  const cameraTrack: TimelineTrack = {
    id: makeId('track'),
    type: 'camera',
    keyframes: [
      { id: makeId('kf'), time: 0, property: 'x', value: 540 },
      { id: makeId('kf'), time: 0, property: 'y', value: 960 },
      { id: makeId('kf'), time: 0, property: 'zoom', value: 0.52 },
      { id: makeId('kf'), time: 4, property: 'zoom', value: 0.62 },
      { id: makeId('kf'), time: 8, property: 'x', value: 600 },
      { id: makeId('kf'), time: 8, property: 'y', value: 940 },
      { id: makeId('kf'), time: 10, property: 'zoom', value: 0.68 }
    ]
  };

  const heroTrack: TimelineTrack = {
    id: makeId('track'),
    type: 'object',
    targetId: heroObject.id,
    keyframes: [
      { id: makeId('kf'), time: 0, property: 'x', value: 330 },
      { id: makeId('kf'), time: 5, property: 'x', value: 380 },
      { id: makeId('kf'), time: 10, property: 'x', value: 430 },
      { id: makeId('kf'), time: 0, property: 'scaleX', value: 0.95 },
      { id: makeId('kf'), time: 0, property: 'scaleY', value: 0.95 },
      { id: makeId('kf'), time: 10, property: 'scaleX', value: 1.05 },
      { id: makeId('kf'), time: 10, property: 'scaleY', value: 1.05 }
    ]
  };

  const partnerTrack: TimelineTrack = {
    id: makeId('track'),
    type: 'object',
    targetId: partnerObject.id,
    keyframes: [
      { id: makeId('kf'), time: 0, property: 'y', value: 1180 },
      { id: makeId('kf'), time: 6, property: 'y', value: 1130 },
      { id: makeId('kf'), time: 10, property: 'y', value: 1100 },
      { id: makeId('kf'), time: 0, property: 'opacity', value: 0.75 },
      { id: makeId('kf'), time: 4, property: 'opacity', value: 1 }
    ]
  };

  const scene: Scene = {
    id: makeId('scene'),
    name: '半成品示例-雨夜会面',
    width: 1080,
    height: 1920,
    duration: 10,
    camera: {
      x: 540,
      y: 960,
      zoom: 0.52,
      rotation: 0
    },
    objects: [backgroundObject, heroObject, partnerObject],
    audioTracks: [],
    subtitleTracks: [
      { id: makeId('subtitle'), startTime: 0.2, endTime: 2.8, text: '雨夜里，主角第一次踏入旧街区。' },
      { id: makeId('subtitle'), startTime: 3.2, endTime: 6.4, text: '同伴从巷口出现："你终于来了。"' },
      { id: makeId('subtitle'), startTime: 7.2, endTime: 9.8, text: '镜头推进，故事进入下一幕。' }
    ],
    animationTracks: [cameraTrack, heroTrack, partnerTrack]
  };

  return { scene, assets };
}

function parseLrcToSubtitles(content: string, durationFallback: number): Scene['subtitleTracks'] {
  const lines = content.split(/\r?\n/);
  const parsed: Array<{ time: number; text: string }> = [];

  for (const line of lines) {
    const matches = [...line.matchAll(/\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g)];
    if (matches.length === 0) {
      continue;
    }

    const text = line.replace(/\[[^\]]+\]/g, '').trim();
    if (!text) {
      continue;
    }

    for (const match of matches) {
      const minutes = Number(match[1] ?? '0');
      const seconds = Number(match[2] ?? '0');
      const millisRaw = match[3] ?? '0';
      const millis = Number(millisRaw.padEnd(3, '0').slice(0, 3));
      const time = minutes * 60 + seconds + millis / 1000;
      parsed.push({ time, text });
    }
  }

  parsed.sort((left, right) => left.time - right.time);

  return parsed.map((item, index) => {
    const next = parsed[index + 1];
    const endTime = next ? Math.max(item.time + 0.2, next.time - 0.05) : Math.min(durationFallback, item.time + 2.5);

    return {
      id: `subtitle-${crypto.randomUUID()}`,
      startTime: item.time,
      endTime,
      text: item.text
    };
  });
}

async function importLrcAsSubtitles(
  lrcUrl: string,
  scene: Scene,
  assets: Asset[],
  hydrate: (scene: Scene, assets: Asset[]) => void,
  resetPlayback: () => void,
  setIsPlaying: (isPlaying: boolean) => void,
  setAssetActionMessage: (message: string) => void
): Promise<void> {
  try {
    const response = await fetch(lrcUrl);
    if (!response.ok) {
      setAssetActionMessage(`歌词导入失败: ${response.status}`);
      return;
    }

    const content = await response.text();
    const subtitles = parseLrcToSubtitles(content, scene.duration);
    if (subtitles.length === 0) {
      setAssetActionMessage('歌词导入失败: 未解析到有效时间轴');
      return;
    }

    hydrate(
      {
        ...scene,
        subtitleTracks: subtitles
      },
      assets
    );
    resetPlayback();
    setIsPlaying(false);
    setAssetActionMessage(`已导入歌词字幕，共 ${subtitles.length} 条`);
  } catch {
    setAssetActionMessage('歌词导入失败: 文件读取异常');
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('blob 转 data url 失败'));
        return;
      }

      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('blob 读取失败'));
    reader.readAsDataURL(blob);
  });
}

async function composeImageCardDataUrl(blob: Blob, title: string): Promise<string> {
  void title;
  const inputDataUrl = await blobToDataUrl(blob);
  const width = 900;
  const height = 900;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return inputDataUrl;
  }

  try {
    const image = await loadImageFromDataUrl(inputDataUrl);
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = Math.max(1, image.naturalWidth || image.width);
    sourceCanvas.height = Math.max(1, image.naturalHeight || image.height);
    const sourceContext = sourceCanvas.getContext('2d');
    if (sourceContext) {
      sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);

      const padding = 84;
      const contentWidth = width - padding * 2;
      const contentHeight = height - padding * 2;
      const sourceData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
      const bounds = computeOpaqueBounds(sourceData, sourceCanvas.width, sourceCanvas.height);
      const cropWidth = Math.max(1, bounds.maxX - bounds.minX + 1);
      const cropHeight = Math.max(1, bounds.maxY - bounds.minY + 1);
      const ratio = Math.min(contentWidth / cropWidth, contentHeight / cropHeight);
      const drawWidth = Math.max(1, Math.floor(cropWidth * ratio));
      const drawHeight = Math.max(1, Math.floor(cropHeight * ratio));
      const drawX = Math.floor((width - drawWidth) / 2);
      const drawY = Math.floor((height - drawHeight) / 2);

      context.clearRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(
        sourceCanvas,
        bounds.minX,
        bounds.minY,
        cropWidth,
        cropHeight,
        drawX,
        drawY,
        drawWidth,
        drawHeight
      );

      return canvas.toDataURL('image/png');
    }
  } catch {
    return inputDataUrl;
  }

  return inputDataUrl;
}

function computeOpaqueBounds(data: Uint8ClampedArray, width: number, height: number): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < 10) {
        continue;
      }

      if (x < minX) {
        minX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y > maxY) {
        maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      minX: 0,
      minY: 0,
      maxX: Math.max(0, width - 1),
      maxY: Math.max(0, height - 1)
    };
  }

  return { minX, minY, maxX, maxY };
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = dataUrl;
  });
}

function pickMp4MimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  const candidates = [
    'video/mp4;codecs=h264,aac',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4'
  ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return null;
}

function waitMs(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, Math.max(0, durationMs));
  });
}

export default function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const replaceImageInputRef = useRef<HTMLInputElement | null>(null);
  const replaceAudioInputRef = useRef<HTMLInputElement | null>(null);
  const scene = useSceneStore((state) => state.scene);
  const assets = useSceneStore((state) => state.assets);
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const addAsset = useSceneStore((state) => state.addAsset);
  const replaceAsset = useSceneStore((state) => state.replaceAsset);
  const removeAsset = useSceneStore((state) => state.removeAsset);
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
  const addPositionKeyframesForSelection = useSceneStore((state) => state.addPositionKeyframesForSelection);
  const addCameraZoomKeyframes = useSceneStore((state) => state.addCameraZoomKeyframes);
  const addDemoSubtitleTracks = useSceneStore((state) => state.addDemoSubtitleTracks);
  const addAudioTrackForAsset = useSceneStore((state) => state.addAudioTrackForAsset);
  const clearAnimationTracks = useSceneStore((state) => state.clearAnimationTracks);
  const updateCamera = useSceneStore((state) => state.updateCamera);
  const hydrate = useSceneStore((state) => state.hydrate);
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const setCurrentTime = usePlaybackStore((state) => state.setCurrentTime);
  const setIsPlaying = usePlaybackStore((state) => state.setIsPlaying);
  const resetPlayback = usePlaybackStore((state) => state.reset);
  const projectName = useProjectStore((state) => state.projectName);
  const lastSavedAt = useProjectStore((state) => state.lastSavedAt);
  const projectList = useProjectStore((state) => state.projectList);
  const setProjectName = useProjectStore((state) => state.setProjectName);
  const saveCurrent = useProjectStore((state) => state.saveCurrent);
  const loadById = useProjectStore((state) => state.loadById);
  const refreshList = useProjectStore((state) => state.refreshList);
  const removeProject = useProjectStore((state) => state.removeProject);
  const [storyPrompt, setStoryPrompt] = useState('一个少年在雨夜遇见神秘女孩。');
  const [storyOutput, setStoryOutput] = useState<StoryOutput | null>(null);
  const [storyboardOutput, setStoryboardOutput] = useState<StoryboardOutput | null>(null);
  const [imagePrompt, setImagePrompt] = useState('雨夜街头的神秘女孩，动漫风格，电影光影');
  const [aiTaskId, setAiTaskId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState('尚未导出');
  const [assetsDirMessage, setAssetsDirMessage] = useState('加载中...');
  const [exportsDirMessage, setExportsDirMessage] = useState('加载中...');
  const [directoryActionMessage, setDirectoryActionMessage] = useState('尚未打开目录');
  const [assetActionMessage, setAssetActionMessage] = useState('尚未操作素材');
  const [replacingAssetId, setReplacingAssetId] = useState<string | null>(null);
  const [positionPreset, setPositionPreset] = useState<PositionAnimationPreset>('right-drift');
  const [cameraPreset, setCameraPreset] = useState<CameraAnimationPreset>('push-in');
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const importedTaskIdsRef = useRef(new Set<string>());

  useAudioPlayback(scene, assets, isPlaying, currentTime);
  useAutoSave(scene, assets);

  const storyMutation = useMutation({
    mutationFn: postAiStory,
    onSuccess: (data) => {
      setStoryOutput(data);
    }
  });

  const storyboardMutation = useMutation({
    mutationFn: postAiStoryboard,
    onSuccess: (data) => {
      setStoryboardOutput(data);
      if (data.scenes[0]?.description) {
        setImagePrompt(data.scenes[0].description);
      }
    }
  });

  const imageMutation = useMutation({
    mutationFn: postAiImage,
    onSuccess: (data) => {
      setAiTaskId(data.taskId);
    }
  });

  const aiTaskQuery = useQuery({
    queryKey: ['ai-task', aiTaskId],
    queryFn: async () => {
      if (!aiTaskId) {
        throw new Error('任务 ID 不存在');
      }

      return getAiTask(aiTaskId);
    },
    enabled: Boolean(aiTaskId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === 'PENDING' || status === 'RUNNING') {
        return 1000;
      }

      return false;
    }
  });

  const aiTaskStatus = aiTaskQuery.data?.status;
  const isImageTaskPolling = aiTaskStatus === 'PENDING' || aiTaskStatus === 'RUNNING';
  const isImageGenerating = imageMutation.isPending || isImageTaskPolling;
  const aiTaskStatusLabel = imageMutation.isPending
    ? '提交中'
    : isImageTaskPolling
      ? '生成中'
      : aiTaskStatus ?? '未提交';

  const staticImagesQuery = useQuery({
    queryKey: ['static-images'],
    queryFn: getStaticImages,
    staleTime: 60_000
  });

  const staticAudiosQuery = useQuery({
    queryKey: ['static-audios'],
    queryFn: getStaticAudios,
    staleTime: 60_000
  });

  const providerStatusQuery = useQuery({
    queryKey: ['provider-status'],
    queryFn: getProviderStatus,
    staleTime: 15_000,
    refetchInterval: 15_000
  });

  useEffect(() => {
    if (!aiTaskId || !aiTaskQuery.data) {
      return;
    }

    if (aiTaskQuery.data.status !== 'SUCCEEDED' || !aiTaskQuery.data.result?.asset) {
      return;
    }

    if (importedTaskIdsRef.current.has(aiTaskId)) {
      return;
    }

    importedTaskIdsRef.current.add(aiTaskId);
    const generated = aiTaskQuery.data.result.asset;
    addAsset(generated);

    const metadata = generated.metadata;
    const provider =
      metadata && typeof metadata === 'object' && typeof (metadata as Record<string, unknown>).provider === 'string'
        ? String((metadata as Record<string, unknown>).provider)
        : '';

    if (provider === 'mock-fallback') {
      setAssetActionMessage('阿里云出图失败，已回退为占位素材并加入素材列表。可重试生成或手动加入场景。');
      return;
    }

    addObject(createSceneObjectFromAsset(generated));
    setAssetActionMessage('AI 图片已生成并自动加入本地素材与场景。');
  }, [addAsset, addObject, aiTaskId, aiTaskQuery.data]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    let active = true;

    void getPlatformBridge()
      .getLocalDirectoryState()
      .then((state) => {
        if (!active) {
          return;
        }

        setAssetsDirMessage(state.assetsDirLabel);
        setExportsDirMessage(state.exportsDirLabel);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setAssetsDirMessage('目录信息读取失败');
        setExportsDirMessage('目录信息读取失败');
      });

    return () => {
      active = false;
    };
  }, []);

  const activeObject = useMemo(() => {
    if (selectedIds.length !== 1) {
      return null;
    }

    return scene.objects.find((object) => object.id === selectedIds[0]) ?? null;
  }, [scene.objects, selectedIds]);

  const animationPreviewLines = useMemo(() => {
    const lines: string[] = [];

    const positionTrackLines: string[] = [];
    if (activeObject) {
      const objectFrames = buildObjectMotionKeyframes(scene, activeObject, positionPreset);
      const xEnd = objectFrames.filter((entry) => entry.property === 'x').at(-1);
      const yEnd = objectFrames.filter((entry) => entry.property === 'y').at(-1);
      positionTrackLines.push(
        `对象预设: ${positionPresetLabelMap[positionPreset]} (${activeObject.name})`,
        `终点: x ${xEnd?.value.toFixed(0) ?? '-'} / y ${yEnd?.value.toFixed(0) ?? '-'} / 时长 3.6s`
      );
    } else {
      positionTrackLines.push('对象预设: 请先选中单个对象');
    }

    const cameraFrames = buildCameraMotionKeyframes(scene, scene.camera, cameraPreset, activeObject ?? undefined);
    const zoomEnd = cameraFrames.filter((entry) => entry.property === 'zoom').at(-1);
    const xEnd = cameraFrames.filter((entry) => entry.property === 'x').at(-1);
    const yEnd = cameraFrames.filter((entry) => entry.property === 'y').at(-1);

    lines.push(...positionTrackLines);
    lines.push(
      `镜头预设: ${cameraPresetLabelMap[cameraPreset]}`,
      `终点: x ${xEnd?.value.toFixed(0) ?? '-'} / y ${yEnd?.value.toFixed(0) ?? '-'} / zoom ${zoomEnd?.value.toFixed(2) ?? '-'}`
    );

    return lines;
  }, [activeObject, cameraPreset, positionPreset, scene]);

  const providerLabel = providerStatusQuery.data?.provider === 'aliyun' ? 'aliyun' : 'mock';
  const providerStateText = providerStatusQuery.isLoading
    ? '读取中'
    : providerStatusQuery.isError
      ? '读取失败'
      : providerLabel;

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

    const assetId = `asset-${crypto.randomUUID()}`;
    const persisted = await getPlatformBridge().persistImportedFile(file, 'image', assetId);

    const asset: Asset = {
      id: assetId,
      type: 'image',
      name: file.name,
      url: persisted.url,
      width: 640,
      height: 640,
      metadata: persisted.metadata
    };

    addAsset(asset);
    addObject(createSceneObjectFromAsset(asset));
  };

  const handleUploadAudioClick = () => {
    audioInputRef.current?.click();
  };

  const replaceAssetFromFile = async (asset: Asset, file: File) => {
    const persisted = await getPlatformBridge().persistImportedFile(
      file,
      asset.type === 'audio' ? 'audio' : 'image',
      asset.id
    );

    replaceAsset({
      ...asset,
      name: file.name,
      url: persisted.url,
      width: asset.type === 'audio' ? asset.width : 640,
      height: asset.type === 'audio' ? asset.height : 640,
      metadata: persisted.metadata,
      duration: asset.type === 'audio' ? scene.duration : asset.duration
    });

    setAssetActionMessage(`已替换素材: ${file.name}`);
  };

  const handleAudioFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !file.type.startsWith('audio/')) {
      return;
    }

    const assetId = `asset-${crypto.randomUUID()}`;
    const persisted = await getPlatformBridge().persistImportedFile(file, 'audio', assetId);

    const asset: Asset = {
      id: assetId,
      type: 'audio',
      name: file.name,
      url: persisted.url,
      duration: scene.duration,
      metadata: persisted.metadata
    };

    addAsset(asset);
    addAudioTrackForAsset(asset.id, scene.duration);
    setAssetActionMessage(`已导入音频素材: ${asset.name}`);
  };

  const handleReplaceImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !file.type.startsWith('image/') || !replacingAssetId) {
      setReplacingAssetId(null);
      return;
    }

    const targetAsset = assets.find((asset) => asset.id === replacingAssetId && asset.type !== 'audio');
    setReplacingAssetId(null);
    if (!targetAsset) {
      return;
    }

    await replaceAssetFromFile(targetAsset, file);
  };

  const handleReplaceAudioFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !file.type.startsWith('audio/') || !replacingAssetId) {
      setReplacingAssetId(null);
      return;
    }

    const targetAsset = assets.find((asset) => asset.id === replacingAssetId && asset.type === 'audio');
    setReplacingAssetId(null);
    if (!targetAsset) {
      return;
    }

    await replaceAssetFromFile(targetAsset, file);
  };

  const handleGenerateStory = () => {
    storyMutation.mutate(storyPrompt);
  };

  const handlePlaceAsset = (asset: Asset) => {
    if (asset.type === 'audio') {
      addAudioTrackForAsset(asset.id, scene.duration);
      setAssetActionMessage(`已添加音轨: ${asset.name}`);
      return;
    }

    addObject(createSceneObjectFromAsset(asset));
    setAssetActionMessage(`已加入场景: ${asset.name}`);
  };

  const handleRemoveAsset = (asset: Asset) => {
    removeAsset(asset.id);
    setAssetActionMessage(`已删除素材: ${asset.name}`);
  };

  const handleReplaceAssetClick = (asset: Asset) => {
    setReplacingAssetId(asset.id);
    if (asset.type === 'audio') {
      audioInputRef.current?.blur();
      replaceAudioInputRef.current?.click();
      return;
    }

    replaceImageInputRef.current?.click();
  };

  const handleAddStaticImage = async (item: StaticImageItem) => {
    let resolvedUrl = item.url;
    let loadedFromDataUrl = false;
    let composed = false;

    try {
      const response = await fetch(item.url);
      if (response.ok) {
        const blob = await response.blob();
        resolvedUrl = await composeImageCardDataUrl(blob, item.name);
        loadedFromDataUrl = true;
        composed = true;
      }
    } catch {
      // Keep original URL when fetch fails; renderer fallback visuals still make object visible.
    }

    const asset: Asset = {
      id: `asset-${crypto.randomUUID()}`,
      type: 'image',
      name: item.name,
      url: resolvedUrl,
      width: 640,
      height: 640,
      metadata: {
        source: loadedFromDataUrl ? 'static/dataurl' : 'static/url',
        composed,
        originalUrl: item.url
      }
    };

    const object = createSceneObjectFromAsset(asset);
    addAsset(asset);
    addObject(object);
    selectObject(object.id, false);
    updateCamera({
      ...scene.camera,
      x: object.transform.x,
      y: object.transform.y,
      zoom: Math.max(scene.camera.zoom, 0.62)
    });
    setAssetActionMessage(`已从 static/image 加入场景: ${item.name}`);
  };

  const handleGenerateStoryboard = () => {
    const text = storyOutput?.logline ?? storyPrompt;
    storyboardMutation.mutate(text);
  };

  const handleGenerateImage = () => {
    if (isImageGenerating) {
      return;
    }

    const normalizedPrompt = imagePrompt.trim();
    if (!normalizedPrompt) {
      setAssetActionMessage('图片提示词不能为空。');
      return;
    }

    setAssetActionMessage('图片任务已提交，正在生成中...');
    imageMutation.mutate(normalizedPrompt);
  };

  const handleLoadHalfFinishedShowcase = () => {
    const generated = createHalfFinishedShowcase(staticImagesQuery.data ?? []);
    hydrate(generated.scene, generated.assets);
    resetPlayback();
    setIsPlaying(false);
    setProjectName('半成品示例-雨夜会面');
    setAssetActionMessage('已加载半成品示例，可直接播放查看效果');
  };

  const handleResetToInitial = () => {
    const initial: Scene = {
      id: `scene-${crypto.randomUUID()}`,
      name: '新场景',
      width: 1080,
      height: 1920,
      duration: 10,
      camera: { x: 540, y: 960, zoom: 0.5, rotation: 0 },
      objects: [],
      audioTracks: [],
      subtitleTracks: [],
      animationTracks: []
    };

    hydrate(initial, []);
    resetPlayback();
    setIsPlaying(false);
    setProjectName('未命名项目');
    setAssetActionMessage('已恢复初始状态');
  };

  const handleAddStaticAudio = (item: StaticAudioItem) => {
    if (item.kind === 'ncm') {
      setAssetActionMessage('ncm 已识别，但浏览器暂不直接播放，请先转成 mp3。');
      return;
    }

    if (item.kind === 'lrc') {
      void importLrcAsSubtitles(item.url, scene, assets, hydrate, resetPlayback, setIsPlaying, setAssetActionMessage);
      return;
    }

    const assetId = `asset-${crypto.randomUUID()}`;
    const asset: Asset = {
      id: assetId,
      type: 'audio',
      name: item.name,
      url: item.url,
      duration: scene.duration,
      metadata: {
        source: 'static/music'
      }
    };

    addAsset(asset);
    addAudioTrackForAsset(assetId, scene.duration);
    setAssetActionMessage(`已从 static/music 导入音频: ${item.name}`);
  };

  const handleApplyStoryboardScene = () => {
    if (!storyboardOutput) {
      return;
    }

    const generated = storyboardToScene(storyboardOutput);
    const hasExistingVisualObjects = scene.objects.some((object) => object.type !== 'background');
    const currentMaxZ = scene.objects.reduce((max, object) => Math.max(max, object.zIndex), 0);
    let zCursor = currentMaxZ + 10;

    const appendedObjects = generated.scene.objects
      .filter((object) => object.type !== 'background')
      .map((object) => {
        const next = {
          ...object,
          zIndex: zCursor
        };
        zCursor += 10;
        return next;
      });

    const appendedAssetIds = new Set(appendedObjects.map((object) => object.assetId).filter((id): id is string => Boolean(id)));
    const appendedAssets = generated.assets.filter((asset) => appendedAssetIds.has(asset.id));

    const generatedCameraTracks = generated.scene.animationTracks.filter((track) => track.type === 'camera');
    const existingNonCameraTracks = scene.animationTracks.filter((track) => track.type !== 'camera');

    const subtitleTimeOffset = hasExistingVisualObjects ? scene.duration + 0.2 : 0;
    const appendedSubtitles = generated.scene.subtitleTracks.map((track) => ({
      ...track,
      id: makeId('subtitle'),
      startTime: track.startTime + subtitleTimeOffset,
      endTime: track.endTime + subtitleTimeOffset
    }));

    const nextDuration = hasExistingVisualObjects
      ? Math.max(scene.duration, subtitleTimeOffset + generated.scene.duration)
      : Math.max(scene.duration, generated.scene.duration);

    hydrate(
      {
        ...scene,
        name: storyboardOutput.scenes[0]?.mood ? `分镜扩展-${storyboardOutput.scenes[0].mood}` : scene.name,
        duration: nextDuration,
        camera: hasExistingVisualObjects ? scene.camera : generated.scene.camera,
        objects: [...scene.objects, ...appendedObjects],
        subtitleTracks: [...scene.subtitleTracks, ...appendedSubtitles],
        animationTracks: hasExistingVisualObjects
          ? scene.animationTracks
          : [...existingNonCameraTracks, ...generatedCameraTracks]
      },
      [...assets, ...appendedAssets]
    );
    resetPlayback();
    setIsPlaying(false);
    setAssetActionMessage(`已增量编排分镜：新增对象 ${appendedObjects.length}，新增字幕 ${generated.scene.subtitleTracks.length}`);
  };

  const updateTransformValue = (key: keyof NonNullable<typeof activeObject>['transform'], value: number) => {
    if (!activeObject || Number.isNaN(value)) {
      return;
    }

    updateObjectTransform(activeObject.id, { [key]: value });
  };

  const handlePlayPause = () => {
    const hasPlayableTrack =
      scene.animationTracks.length > 0 || scene.subtitleTracks.length > 0 || scene.audioTracks.length > 0;
    if (!hasPlayableTrack) {
      return;
    }

    if (!isPlaying) {
      void primeAudioContext();
    }

    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    resetPlayback();
  };

  const handleSaveProject = async () => {
    await saveCurrent(scene, assets);
  };

  const handleLoadProject = async (projectId: string) => {
    const bundle = await loadById(projectId);
    if (!bundle) {
      return;
    }

    hydrate(bundle.scene, bundle.assets);
    resetPlayback();
  };

  const handleExportProject = async () => {
    if (isExportingVideo) {
      return;
    }

    if (scene.animationTracks.length === 0 && scene.subtitleTracks.length === 0) {
      setExportMessage('未检测到可播放内容，请先添加动画或字幕后再导出 MP4');
      return;
    }

    const canvas = document.querySelector('main section canvas') as HTMLCanvasElement | null;
    if (!canvas || typeof canvas.captureStream !== 'function') {
      setExportMessage('当前环境不支持画布录制，无法导出 MP4');
      return;
    }

    const mimeType = pickMp4MimeType();
    if (!mimeType || typeof MediaRecorder === 'undefined') {
      setExportMessage('当前浏览器不支持 MP4 编码，请改用 Edge/Chrome 新版本或桌面端导出');
      return;
    }

    setIsExportingVideo(true);
    setExportMessage('正在导出 MP4，请稍候...');

    try {
      setIsPlaying(false);
      setCurrentTime(0);
      await waitMs(120);

      const fps = 30;
      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8_000_000
      });
      const chunks: BlobPart[] = [];

      const stopPromise = new Promise<void>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onerror = () => {
          reject(new Error('录制器异常'));
        };

        recorder.onstop = () => {
          try {
            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size === 0) {
              reject(new Error('导出文件为空'));
              return;
            }

            const safeName = (projectName.trim() || 'manga-drama-video').replace(/[\\/:*?"<>|]/g, '_');
            const fileName = `${safeName}-${Date.now()}.mp4`;
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = fileName;
            anchor.click();
            URL.revokeObjectURL(url);
            setExportMessage(`已导出 MP4: ${fileName}`);
            resolve();
          } catch (error) {
            reject(error);
          }
        };
      });

      recorder.start(250);
      void primeAudioContext();
      setIsPlaying(true);

      await waitMs(scene.duration * 1000 + 400);
      setIsPlaying(false);
      recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
      await stopPromise;
      resetPlayback();
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setExportMessage(`导出 MP4 失败: ${message}`);
    } finally {
      setIsExportingVideo(false);
    }
  };

  const handleOpenDirectory = async (kind: 'assets' | 'exports') => {
    const destination = await getPlatformBridge().openLocalDirectory(kind);
    setDirectoryActionMessage(destination);
  };

  const updateCameraField = (key: 'x' | 'y' | 'zoom' | 'rotation', value: number) => {
    if (Number.isNaN(value)) {
      return;
    }

    updateCamera({
      ...scene.camera,
      [key]: value
    });
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'grid',
        gridTemplateRows: '64px 1fr',
        overflow: 'hidden',
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
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Phase 8 · AI 自动编排场景</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: '#cbd5e1' }}>
          <span>场景: {scene.name}</span>
          <span>素材: {assets.length}</span>
          <span>选中: {selectedIds.length}</span>
          <span>字幕: {scene.subtitleTracks.length}</span>
          <span>音轨: {scene.audioTracks.length}</span>
          <span>项目: {projectName}</span>
          <span>Provider: {providerStateText}</span>
          <span>AI任务: {aiTaskStatusLabel}</span>
        </div>
      </header>

      <main
        style={{
          display: 'grid',
          gridTemplateColumns: '280px minmax(0, 1fr) 320px',
          gap: 16,
          padding: 16,
          minHeight: 0,
          height: '100%',
          overflow: 'hidden'
        }}
      >
        <aside
          style={{
            border: '1px solid rgba(148, 163, 184, 0.18)',
            borderRadius: 16,
            padding: 16,
            background: 'rgba(15, 23, 42, 0.85)',
            minHeight: 0,
            overflowY: 'auto'
          }}
        >
          <h2 style={{ marginTop: 0 }}>素材操作</h2>
          <h3 style={{ marginTop: 8, marginBottom: 8 }}>1. 创建名称</h3>
          <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
            <label style={fieldLabel}>
              项目名称
              <input
                style={fieldInput}
                type="text"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={buttonStyleSecondary} onClick={handleResetToInitial}>
                恢复初始状态
              </button>
              <button type="button" style={buttonStyleSecondary} onClick={handleLoadHalfFinishedShowcase}>
                一键加载半成品示例
              </button>
            </div>
          </div>
          <h3 style={{ marginTop: 12, marginBottom: 8 }}>2. 添加素材</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <button type="button" onClick={handleAddDemoImage} style={buttonStyle}>
              添加演示角色
            </button>
            <button type="button" onClick={handleUploadClick} style={buttonStyle}>
              上传图片素材
            </button>
            <button type="button" onClick={handleUploadAudioClick} style={buttonStyleSecondary}>
              上传音频素材
            </button>
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
            <input ref={audioInputRef} type="file" accept="audio/*" hidden onChange={handleAudioFileChange} />
            <input
              ref={replaceImageInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleReplaceImageFileChange}
            />
            <input
              ref={replaceAudioInputRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={handleReplaceAudioFileChange}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>素材列表</h3>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, wordBreak: 'break-all' }}>
              最近操作: {assetActionMessage}
            </div>
            <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflow: 'auto' }}>
              {assets.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>暂无素材，先上传图片或音频。</div>}
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  style={{
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    background: 'rgba(30, 41, 59, 0.75)'
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{asset.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{asset.type}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" style={tinyButton} onClick={() => handlePlaceAsset(asset)}>
                      {asset.type === 'audio' ? '加入音轨' : '加入场景'}
                    </button>
                    <button type="button" style={tinyButton} onClick={() => handleReplaceAssetClick(asset)}>
                      替换
                    </button>
                    <button type="button" style={tinyButtonDanger} onClick={() => handleRemoveAsset(asset)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>静态图片预览（static/image）</h3>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
              把图片放进 static/image 或 server/static/image，刷新后可一键加入场景。
            </div>
            {staticImagesQuery.isLoading && <div style={{ fontSize: 12, color: '#94a3b8' }}>静态素材加载中...</div>}
            {staticImagesQuery.isError && <div style={{ fontSize: 12, color: '#fca5a5' }}>静态素材加载失败</div>}
            {!staticImagesQuery.isLoading && !staticImagesQuery.isError && (staticImagesQuery.data?.length ?? 0) === 0 && (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>未发现图片，先在 static/image 放入 png/jpg/jpeg/webp/gif/svg。</div>
            )}
            <div style={{ display: 'grid', gap: 8, maxHeight: 240, overflow: 'auto' }}>
              {(staticImagesQuery.data ?? []).map((item) => (
                <div
                  key={item.url}
                  style={{
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    background: 'rgba(30, 41, 59, 0.75)'
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, wordBreak: 'break-all' }}>{item.name}</div>
                  <img
                    src={item.url}
                    alt={item.name}
                    style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                  />
                  <button type="button" style={tinyButton} onClick={() => handleAddStaticImage(item)}>
                    加入场景
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>静态音乐与歌词（static/music）</h3>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
              支持 mp3/wav/ogg/m4a/flac、lrc、ncm。lrc 可导入字幕，ncm 仅识别并提示转码。
            </div>
            {staticAudiosQuery.isLoading && <div style={{ fontSize: 12, color: '#94a3b8' }}>静态音乐加载中...</div>}
            {staticAudiosQuery.isError && <div style={{ fontSize: 12, color: '#fca5a5' }}>静态音乐加载失败</div>}
            {!staticAudiosQuery.isLoading && !staticAudiosQuery.isError && (staticAudiosQuery.data?.length ?? 0) === 0 && (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>未发现音乐或歌词，先在 static/music 放入 mp3/lrc/ncm 等文件。</div>
            )}
            <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflow: 'auto' }}>
              {(staticAudiosQuery.data ?? []).map((item) => (
                <div
                  key={item.url}
                  style={{
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    background: 'rgba(30, 41, 59, 0.75)'
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, wordBreak: 'break-all' }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>类型: {item.kind}</div>
                  <button type="button" style={tinyButton} onClick={() => handleAddStaticAudio(item)}>
                    {item.kind === 'audio' ? '加入音轨' : item.kind === 'lrc' ? '导入歌词到字幕' : '提示转码'}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <h3 style={{ marginTop: 16, marginBottom: 8 }}>3. 生成内容</h3>
          <div
            style={{
              marginBottom: 12,
              border: '1px solid rgba(56, 189, 248, 0.45)',
              borderRadius: 10,
              padding: '8px 10px',
              background: 'rgba(2, 132, 199, 0.12)',
              fontSize: 12,
              color: '#bae6fd',
              lineHeight: 1.7
            }}
          >
            快速看效果：先点“一键加载半成品示例” → 再点“播放”。需要回到空白编辑台可点“恢复初始状态”。
          </div>
          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            <label style={fieldLabel}>
              故事输入
              <textarea
                style={{ ...fieldInput, minHeight: 72, resize: 'vertical' }}
                value={storyPrompt}
                onChange={(event) => setStoryPrompt(event.target.value)}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={buttonStyleSecondary} onClick={handleGenerateStory}>
                {storyMutation.isPending ? '生成剧本中...' : '生成剧本'}
              </button>
              <button type="button" style={buttonStyleSecondary} onClick={handleGenerateStoryboard}>
                {storyboardMutation.isPending ? '生成分镜中...' : '生成分镜'}
              </button>
            </div>
            <label style={fieldLabel}>
              图片提示词
              <input
                style={fieldInput}
                type="text"
                value={imagePrompt}
                onChange={(event) => setImagePrompt(event.target.value)}
              />
            </label>
            <button
              type="button"
              style={{
                ...buttonStyleSecondary,
                opacity: isImageGenerating ? 0.7 : 1,
                cursor: isImageGenerating ? 'not-allowed' : 'pointer'
              }}
              onClick={handleGenerateImage}
              disabled={isImageGenerating}
            >
              {imageMutation.isPending ? '提交任务中...' : isImageTaskPolling ? '生成图片中...' : '生成图片素材'}
            </button>
            <button type="button" style={buttonStyleSecondary} onClick={handleApplyStoryboardScene}>
              分镜一键编排场景
            </button>
            <div style={{ fontSize: 12, color: '#93c5fd' }}>
              任务状态: {aiTaskStatusLabel}
              {aiTaskId ? ` · ${aiTaskId}` : ''}
              {isImageTaskPolling ? ' · 正在轮询任务结果，请稍候' : ''}
              {aiTaskQuery.data?.status === 'FAILED' && aiTaskQuery.data?.error
                ? ` · 原因: ${aiTaskQuery.data.error}`
                : ''}
            </div>
            {storyOutput && (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: '#bfdbfe' }}>查看剧本 JSON</summary>
                <pre style={preStyle}>{JSON.stringify(storyOutput, null, 2)}</pre>
              </details>
            )}
            {storyboardOutput && (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: '#bfdbfe' }}>查看分镜 JSON</summary>
                <pre style={preStyle}>{JSON.stringify(storyboardOutput, null, 2)}</pre>
              </details>
            )}
          </div>
          <h3 style={{ marginTop: 20, marginBottom: 10 }}>4. 编辑对象</h3>
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

          <h3 style={{ marginTop: 20, marginBottom: 10 }}>5. 添加动画</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={fieldLabel}>
              位移动画预设
              <select
                style={fieldInput}
                value={positionPreset}
                onChange={(event) => setPositionPreset(event.target.value as PositionAnimationPreset)}
              >
                <option value="right-drift">向右漂移</option>
                <option value="left-drift">向左漂移</option>
                <option value="rise">向上升起</option>
                <option value="fall">向下落入</option>
                <option value="arc">弧线推进</option>
              </select>
            </label>
            <button type="button" style={buttonStyleSecondary} onClick={() => addPositionKeyframesForSelection(positionPreset)}>
              为选中对象添加位移动画
            </button>
            <label style={fieldLabel}>
              镜头动画预设
              <select
                style={fieldInput}
                value={cameraPreset}
                onChange={(event) => setCameraPreset(event.target.value as CameraAnimationPreset)}
              >
                <option value="push-in">镜头推进</option>
                <option value="pull-out">镜头拉远</option>
                <option value="pan-left">镜头左移</option>
                <option value="pan-right">镜头右移</option>
                <option value="follow-selected">跟随选中对象</option>
              </select>
            </label>
            <button type="button" style={buttonStyleSecondary} onClick={() => addCameraZoomKeyframes(cameraPreset)}>
              添加镜头动画
            </button>
            <button type="button" style={buttonStyleSecondary} onClick={addDemoSubtitleTracks}>
              生成演示字幕
            </button>
            <button type="button" style={buttonStyleSecondary} onClick={clearAnimationTracks}>
              清空动画轨道
            </button>
          </div>
          <h3 style={{ marginTop: 20, marginBottom: 10 }}>6. 保存与预览</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={buttonStyleSecondary} onClick={() => void handleSaveProject()}>
                立即保存
              </button>
              <button type="button" style={buttonStyleSecondary} onClick={() => void refreshList()}>
                刷新项目列表
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={buttonStyleSecondary} onClick={() => void handleExportProject()}>
                {isExportingVideo ? '导出 MP4 中...' : '导出 MP4 视频'}
              </button>
              <button type="button" style={buttonStyleSecondary} onClick={() => void handleOpenDirectory('exports')}>
                打开导出目录
              </button>
              <button type="button" style={buttonStyleSecondary} onClick={() => void handleOpenDirectory('assets')}>
                打开素材目录
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={buttonStyleSecondary} onClick={handlePlayPause}>
                {isPlaying ? '暂停' : '播放'}
              </button>
              <button type="button" style={buttonStyleSecondary} onClick={handleStop}>
                停止
              </button>
            </div>
            <label style={{ ...fieldLabel, marginTop: 4 }}>
              当前时间: {currentTime.toFixed(2)}s / {scene.duration}s
              <input
                style={fieldInput}
                type="range"
                min={0}
                max={scene.duration}
                step={0.01}
                value={Math.min(scene.duration, currentTime)}
                onChange={(event) => {
                  setIsPlaying(false);
                  setCurrentTime(Number(event.target.value));
                }}
              />
            </label>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              最近保存: {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : '尚未保存'}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', wordBreak: 'break-all' }}>最近导出: {exportMessage}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', wordBreak: 'break-all' }}>素材目录: {assetsDirMessage}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', wordBreak: 'break-all' }}>导出目录: {exportsDirMessage}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', wordBreak: 'break-all' }}>最近打开: {directoryActionMessage}</div>
            <div style={{ maxHeight: 130, overflow: 'auto', display: 'grid', gap: 8 }}>
              {projectList.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    background: 'rgba(30, 41, 59, 0.75)'
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(item.updatedAt).toLocaleString()}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                    <button type="button" style={tinyButton} onClick={() => void handleLoadProject(item.id)}>
                      加载
                    </button>
                    <button type="button" style={tinyButtonDanger} onClick={() => void removeProject(item.id)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section
          style={{
            border: '1px solid rgba(148, 163, 184, 0.18)',
            borderRadius: 16,
            overflow: 'hidden',
            background: '#020617',
            minHeight: 0,
            height: '100%'
          }}
        >
          <CanvasContainer />
        </section>

        <aside
          style={{
            border: '1px solid rgba(148, 163, 184, 0.18)',
            borderRadius: 16,
            padding: 16,
            background: 'rgba(15, 23, 42, 0.85)',
            minHeight: 0,
            overflowY: 'auto'
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
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <label style={fieldLabel}>
              镜头 X
              <input
                style={fieldInput}
                type="number"
                value={scene.camera.x}
                onChange={(event) => updateCameraField('x', Number(event.target.value))}
              />
            </label>
            <label style={fieldLabel}>
              镜头 Y
              <input
                style={fieldInput}
                type="number"
                value={scene.camera.y}
                onChange={(event) => updateCameraField('y', Number(event.target.value))}
              />
            </label>
            <label style={fieldLabel}>
              缩放
              <input
                style={fieldInput}
                type="number"
                step="0.05"
                min="0.2"
                value={scene.camera.zoom}
                onChange={(event) => updateCameraField('zoom', Number(event.target.value))}
              />
            </label>
            <label style={fieldLabel}>
              旋转 (弧度)
              <input
                style={fieldInput}
                type="number"
                step="0.05"
                value={scene.camera.rotation}
                onChange={(event) => updateCameraField('rotation', Number(event.target.value))}
              />
            </label>
          </div>
          <div style={inspectorRow}>
            <span>对象数量</span>
            <strong>{scene.objects.length}</strong>
          </div>

          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Provider 状态</h3>
            <div
              style={{
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: 10,
                background: 'rgba(15, 23, 42, 0.6)',
                padding: '10px 12px',
                display: 'grid',
                gap: 6,
                fontSize: 12,
                color: '#cbd5e1'
              }}
            >
              <div>当前通道: {providerStateText}</div>
              <div>文本模型: {providerStatusQuery.data?.textModel ?? '-'}</div>
              <div>图片模型: {providerStatusQuery.data?.imageModel ?? '-'}</div>
              <div>Key状态: {providerStatusQuery.data ? (providerStatusQuery.data.keyConfigured ? '已配置' : '未配置') : '-'}</div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>动画预览摘要</h3>
            <div
              style={{
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: 10,
                background: 'rgba(15, 23, 42, 0.6)',
                padding: '10px 12px',
                display: 'grid',
                gap: 6,
                fontSize: 12,
                color: '#bfdbfe'
              }}
            >
              {animationPreviewLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
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
                  onClick={(event) => selectObject(object.id, event.shiftKey)}
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

const positionPresetLabelMap: Record<PositionAnimationPreset, string> = {
  'right-drift': '向右漂移',
  'left-drift': '向左漂移',
  rise: '向上升起',
  fall: '向下落入',
  arc: '弧线推进'
};

const cameraPresetLabelMap: Record<CameraAnimationPreset, string> = {
  'push-in': '镜头推进',
  'pull-out': '镜头拉远',
  'pan-left': '镜头左移',
  'pan-right': '镜头右移',
  'follow-selected': '跟随选中对象'
};

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

const tinyButton: CSSProperties = {
  border: '1px solid rgba(148, 163, 184, 0.35)',
  borderRadius: 8,
  padding: '4px 8px',
  background: 'rgba(15, 23, 42, 0.9)',
  color: '#e2e8f0',
  fontSize: 12,
  cursor: 'pointer'
};

const tinyButtonDanger: CSSProperties = {
  ...tinyButton,
  border: '1px solid rgba(248, 113, 113, 0.5)',
  color: '#fecaca'
};

const preStyle: CSSProperties = {
  marginTop: 8,
  maxHeight: 180,
  overflow: 'auto',
  borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.2)',
  background: 'rgba(2, 6, 23, 0.95)',
  color: '#cbd5e1',
  fontSize: 11,
  padding: 10,
  whiteSpace: 'pre-wrap'
};

const inspectorRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 0',
  borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
  fontSize: 13
};
