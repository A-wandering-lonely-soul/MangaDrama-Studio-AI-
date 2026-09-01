export const RENDERER_VERSION = '0.1.0';

export interface RendererHealth {
  initialized: boolean;
  version: string;
}

export function createRendererHealth(): RendererHealth {
  return {
    initialized: false,
    version: RENDERER_VERSION
  };
}
