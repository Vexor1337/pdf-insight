const INVISIBLE_OR_BIDI =
  /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

export function sanitizeText(input: string): string {
  return input.normalize('NFC').replace(INVISIBLE_OR_BIDI, '').replace(CONTROL, '');
}

export function sanitizeLine(input: string): string {
  return sanitizeText(input).replace(/\s+/g, ' ').trim();
}
