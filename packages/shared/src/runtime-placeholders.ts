/**
 * Runtime placeholders found in client script text: named `{player}` slots and
 * printf-style `%s`/`%d` tokens that the game substitutes at runtime. `%%` is a
 * literal percent and is matched only so it is consumed, never treated as a token.
 */
export const RUNTIME_PLACEHOLDER_SOURCE = String.raw`\{[A-Za-z_][A-Za-z0-9_.]*\}|%%|%[-+0#]*\d*(?:\.\d+)?[sdfgxXq](?![A-Za-z])`;

/** Every runtime placeholder in `text`, in order, excluding the `%%` literal. */
export function extractRuntimePlaceholders(text: string): string[] {
  const re = new RegExp(RUNTIME_PLACEHOLDER_SOURCE, 'g');
  const out: string[] = [];
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    if (m[0] !== '%%') out.push(m[0]);
  }
  return out;
}

/** True for a printf-style token (`%s`, `%05d`), false for `%%` and `{name}`. */
export function isPrintfPlaceholder(token: string): boolean {
  return token.startsWith('%') && token !== '%%';
}
