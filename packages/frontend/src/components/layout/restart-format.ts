/** Formats a remaining duration as H:MM:SS (hours dropped when 0). Clamps to 0. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** True when the element's content is wider than its box (1px tolerance). */
export function isOverflowing(el: { scrollWidth: number; clientWidth: number } | null): boolean {
  return !!el && el.scrollWidth > el.clientWidth + 1;
}
