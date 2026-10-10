/**
 * Cryptographically random 10-digit Messaging ID generator and formatter.
 *
 * Requirements enforced:
 * - Strictly 10 numeric digits (`^[0-9]{10}$`).
 * - Never derived from email, phone number, date of birth, or personal data.
 * - Uses Web Crypto API (`crypto.getRandomValues`) for uniform entropy.
 * - Presented strictly as an internal CipherID Messaging Identifier (never a phone number).
 */

export const MESSAGING_ID_REGEX = /^[0-9]{10}$/;

export function generateRandom10DigitId(): string {
  const bytes = new Uint8Array(10);
  window.crypto.getRandomValues(bytes);

  let digits = '';
  for (let i = 0; i < 10; i++) {
    // Ensure first digit is 1-9 so it is always a full 10-digit sequence visually
    if (i === 0) {
      digits += String((bytes[i] % 9) + 1);
    } else {
      digits += String(bytes[i] % 10);
    }
  }
  return digits;
}

export function sanitizeMessagingIdInput(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/[^0-9]/g, '').slice(0, 10);
}

export function isValidMessagingIdFormat(id: string | null | undefined): boolean {
  return MESSAGING_ID_REGEX.test(String(id ?? ''));
}

/**
 * Formats a 10-digit Messaging ID into a clean non-telephone visual grouping:
 * e.g. "4829103847" -> "4829 · 103 · 847" or "4829 103 847"
 * Deliberately avoids (XXX) XXX-XXXX telephone formatting.
 */
export function formatMessagingIdDisplay(id: string | null | undefined): string {
  const clean = sanitizeMessagingIdInput(id);
  if (clean.length !== 10) return clean || String(id ?? '0000000000');
  return `${clean.slice(0, 4)} · ${clean.slice(4, 7)} · ${clean.slice(7, 10)}`;
}

export function sanitizeUsername(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 30);
  if (cleaned.length >= 2) return cleaned;
  return `user_${Math.floor(1000 + Math.random() * 9000)}`;
}

export const AVATAR_PRESETS = [
  'obsidian-cyan',
  'cobalt-pulse',
  'emerald-node',
  'violet-vector',
  'amber-signal',
  'slate-minimal',
];
