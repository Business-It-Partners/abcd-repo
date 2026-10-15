import type { WindowId } from './windowGeometry';

const images = import.meta.glob('./assets/dock/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const dockArtwork = (id: WindowId | 'system') => id === 'store' ? new URL('./assets/store.svg', import.meta.url).href : images[`./assets/dock/${id}.png`];
