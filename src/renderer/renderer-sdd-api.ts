import type { RendererSddApi } from '@/shared/ipc/sdd-ipc';

export function getRendererSddApi(): RendererSddApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return typeof window.sdd === 'undefined' ? null : window.sdd;
}
