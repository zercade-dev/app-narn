import { KeyedAsyncLock } from './keyed-lock.js';

/**
 * Serializes every read-modify-write of a project's `stageDetails` (the PATCH
 * route and the M31 run write-back), keyed by project id. Without it two
 * overlapping writers each load the whole object and the later write drops the
 * earlier one's edit. In-process only; see the KeyedAsyncLock deploy invariant.
 */
export const stageDetailsWriteLock = new KeyedAsyncLock();
