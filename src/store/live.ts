// Typed view over the imperative UI state singleton.
import { liveState } from './uiState.js';
import type { LiveState } from '../types/app';

export const live = liveState as unknown as LiveState;
