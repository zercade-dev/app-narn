import { LANG_NAMES } from '@zercade-dev/narn-shared';

/** Language badge content: human name plus the language code in mono. */
export function LanguageBadgeLabel({ code }: Readonly<{ code: string }>) {
  const name = LANG_NAMES[code];
  if (!name) return <span className="font-mono text-xs tracking-wide">{code}</span>;
  return (
    <>
      {name} <span className="font-mono text-xs tracking-wide">({code})</span>
    </>
  );
}
