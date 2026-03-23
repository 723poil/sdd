import type { RendererSddApi } from '@/shared/ipc/project-ipc';

declare global {
  interface Window {
    sdd: RendererSddApi;
  }
}

export {};
