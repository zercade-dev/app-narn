/**
 * Split an array into fixed-size chunks. The final chunk may be smaller than
 * `size` if `items.length` is not a multiple of `size`.
 *
 * @throws {RangeError} when `size` is less than 1 or not finite.
 */
export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isFinite(size) || size < 1) {
    throw new RangeError(`chunkArray: size must be >= 1 (received ${size})`);
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
