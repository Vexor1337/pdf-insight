export interface Env {
  GEMINI_API_KEY: string;
  /** Comma-separated models tried in order; later ones are fallbacks for overload or quota. */
  GEMINI_MODELS: string;
  GEMINI_OCR_MODELS: string;
  /** Comma-separated list of exact origins, e.g. "https://user.github.io". */
  ALLOWED_ORIGINS: string;
  RATE_LIMITER: RateLimit;
  GLOBAL_RATE_LIMITER: RateLimit;
}
