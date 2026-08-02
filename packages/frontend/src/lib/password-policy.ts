/**
 * Maps vault password-policy rejections from the server to displayable
 * requirement messages. The server rejects weak passwords in two shapes, both
 * 400 with a `details` array: the zod body schema (`error: "Validation error"`,
 * details of `{ path, message }`) and `validatePasswordStrength`
 * (`error: "weak-password"` / `"weak-new-password"`, details of strings).
 */
import { ApiError } from '../hooks/use-api.js';

/** Locale keys (vault namespace) for the known server requirement messages. */
const POLICY_KEY_BY_MESSAGE: Record<string, string> = {
  'Password must be at least 12 characters': 'policyMinLength',
  'Password must contain at least one uppercase letter': 'policyUppercase',
  'Password must contain at least one lowercase letter': 'policyLowercase',
  'Password must contain at least one numeric character': 'policyNumber',
  'Password must contain at least one special character': 'policySpecial',
};

/**
 * Extracts password-policy failure messages from a vault API error.
 * Returns null when the error is not a policy rejection (wrong password,
 * lockout, network failure, …).
 */
export function getPasswordPolicyMessages(err: unknown): string[] | null {
  if (!(err instanceof ApiError) || err.status !== 400) return null;
  const details = (err.data as { details?: unknown } | undefined)?.details;
  if (!Array.isArray(details)) return null;
  const messages = details
    .map((d) => {
      if (typeof d === 'string') return d;
      if (d && typeof d === 'object' && typeof (d as { message?: unknown }).message === 'string') {
        return (d as { message: string }).message;
      }
      return null;
    })
    .filter((m): m is string => m !== null);
  return messages.length > 0 ? messages : null;
}

/**
 * Localizes a policy message via its locale key, falling back to the raw
 * server message for requirements added after this mapping.
 */
export function translatePolicyMessage(t: (key: string) => string, message: string): string {
  const key = POLICY_KEY_BY_MESSAGE[message];
  return key ? t(key) : message;
}
