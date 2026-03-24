import type { RendererSddApi } from '@/shared/ipc/sdd-ipc';

declare global {
  interface Window {
    sdd: RendererSddApi;
  }
}

export {};
