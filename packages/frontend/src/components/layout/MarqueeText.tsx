import { cn } from '@/lib/utils.js';

/**
 * One-line text that ALWAYS scrolls left→right (pure CSS), even when it would fit
 * in its box. The visible text is a single real span; a CSS `::after` pseudo-element
 * (`.marquee-loop`, fed by `data-marquee`) renders a second identical copy so the
 * scroll loops seamlessly without a second DOM text node. The static
 * (countdown/close) cluster lives OUTSIDE this box.
 */
export function MarqueeText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('relative min-w-0 flex-1 overflow-hidden whitespace-nowrap', className)}>
      <span
        data-marquee={text}
        className="animate-banner-marquee marquee-loop inline-flex w-max will-change-transform"
      >
        <span className="pr-8">{text}</span>
      </span>
    </div>
  );
}
