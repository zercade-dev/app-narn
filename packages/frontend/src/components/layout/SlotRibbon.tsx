import { useTranslation } from 'react-i18next';
import { useSystemStatusStore } from '@/stores/system-status-store.js';

/**
 * Persistent slot-identity ribbon: the on-screen cue for which deployment slot
 * the user is looking at. Renders only when the server reports a SLOT_LABEL; an
 * unset label means no ribbon.
 */
export function SlotRibbon() {
  const { t } = useTranslation('system');
  const slotLabel = useSystemStatusStore((s) => s.status?.slotLabel ?? null);
  if (!slotLabel) return null;
  return (
    <div
      role="status"
      aria-label={t('slot.aria', { label: slotLabel })}
      className="w-full shrink-0 bg-fuchsia-700 px-2 py-0.5 text-center text-xs font-semibold uppercase tracking-widest text-white"
    >
      {slotLabel}
    </div>
  );
}
