import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const REPO_BASE = '/pdf-insight/';

function contentSecurityPolicy(apiUrl: string): Plugin {
  const apiOrigin = apiUrl ? new URL(apiUrl).origin : '';
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    `connect-src 'self' ${apiOrigin}`.trim(),
    "worker-src 'self' blob:",
    "img-src 'self' blob: data:",
    "style-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      ),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: REPO_BASE,
    plugins: [react(), contentSecurityPolicy(env.VITE_API_URL ?? '')],
    build: { sourcemap: false, target: 'es2022' },
  };
});
