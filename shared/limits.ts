const MB = 1024 * 1024;

export const MAX_FILE_BYTES = 10 * MB;
export const MAX_PAGES = 300;
export const MAX_TEXT_CHARS = 400_000;
export const CHUNK_CHARS = 60_000;

export const OCR_MIN_TEXT_CHARS = 20;
export const MAX_OCR_PAGES = 4;
export const OCR_RENDER_MAX_PX = 1400;
export const MAX_IMAGE_BASE64_CHARS = 700_000;

export const MAX_FILE_NAME_CHARS = 255;
export const MAX_SUSPECTED_INJECTIONS = 10;
export const MAX_INJECTION_EXCERPT_CHARS = 500;

export const MAX_REQUEST_BYTES = 4 * MB;

export const SUMMARY_SENTENCES = { min: 3, max: 5 } as const;
export const KEY_POINTS = { min: 3, max: 7 } as const;
export const MAX_ENTITIES = 30;
export const MAX_AMOUNTS = 20;
export const MAX_DATES = 20;
export const MAX_KEYWORDS = 15;

export const HISTORY_LIMIT = 10;
