// ═══════════════════════════════════════════════════════════════════
// Framework-agnostic UI event bus.
//
// The preserved vanilla-JS trading core (src/core/*) used to push state by
// writing directly to DOM ids. In the React port it instead calls the thin
// "sink" functions in uiState.js, which mutate plain singletons and `emit()`
// a topic here. React components subscribe to the topics they care about via
// the useTopic() hook, so only the affected parts of the dashboard re-render.
// ═══════════════════════════════════════════════════════════════════

/** @typedef {'snapshot'|'price'|'conn'|'log'|'news'|'chart'|'backtest'|'view'} Topic */

/** @type {Record<string, Set<() => void>>} */
const listeners = {};
/** @type {Record<string, number>} */
const versions = {};

/**
 * Subscribe to a topic. Returns an unsubscribe function.
 * @param {Topic} topic
 * @param {() => void} cb
 * @returns {() => void}
 */
export function subscribe(topic, cb) {
  (listeners[topic] ??= new Set()).add(cb);
  return () => listeners[topic]?.delete(cb);
}

/**
 * Current version counter for a topic — the snapshot read by useSyncExternalStore.
 * @param {Topic} topic
 * @returns {number}
 */
export function getVersion(topic) {
  return versions[topic] ?? 0;
}

/**
 * Bump a topic's version and notify all of its subscribers.
 * @param {Topic} topic
 */
export function emit(topic) {
  versions[topic] = (versions[topic] ?? 0) + 1;
  listeners[topic]?.forEach((cb) => cb());
}
