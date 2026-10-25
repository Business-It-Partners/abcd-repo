import type { WindowId } from './windowGeometry';

const images = import.meta.glob('./assets/dock/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const standardWindowArtwork = new URL('./assets/dock/standard-window-1.svg', import.meta.url).href;
export const dockArtwork = (id: WindowId | 'system') => id === 'standard-window-1' ? standardWindowArtwork : images[`./assets/dock/${id}.png`] ?? new URL('./assets/store.svg', import.meta.url).href;
