export const APP_VIEWS = ['workspace', 'settings'] as const;

export type AppView = (typeof APP_VIEWS)[number];
