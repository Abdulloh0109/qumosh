import { useSyncExternalStore } from 'react';
import { subscribe, getVersion } from './uiBus.js';
import type { Topic } from './topics';

/**
 * Re-render the calling component whenever `topic` is emitted on the UI bus.
 * Returns the topic's monotonically-increasing version so memoized selectors
 * can depend on it.
 */
export function useTopic(topic: Topic): number {
  return useSyncExternalStore(
    (cb) => subscribe(topic, cb),
    () => getVersion(topic),
    () => getVersion(topic),
  );
}
