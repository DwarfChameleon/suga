export function phoneDigits(value: string | undefined | null): string {
  return String(value || '').replace(/\D/g, '');
}

export function stripDialCode(value: string | undefined | null, dialCode: string): string {
  const digits = phoneDigits(value);
  const dialDigits = phoneDigits(dialCode);
  if (!digits) return '';
  if (dialDigits && digits.startsWith(dialDigits)) {
    return digits.slice(dialDigits.length);
  }
  return digits;
}

export function normalizeInternationalPhone(value: string | undefined | null, dialCode: string): string {
  const raw = String(value || '').trim();
  const dialDigits = phoneDigits(dialCode);
  const digits = phoneDigits(raw);
  if (!digits || !dialDigits) return '';
  if (raw.startsWith('+') || digits.startsWith(dialDigits)) {
    return `+${digits}`;
  }
  const localDigits = digits.startsWith('0') ? digits.slice(1) : digits;
  return `+${dialDigits}${localDigits}`;
}

export function isValidInternationalPhone(value: string): boolean {
  return /^\+[0-9]{7,15}$/.test(value);
}
