import type { RendererProjectApi } from '@/shared/ipc/project-ipc';
import type { RendererSettingsApi } from '@/shared/ipc/settings-ipc';

export interface RendererSddApi {
  project: RendererProjectApi;
  settings: RendererSettingsApi;
}
