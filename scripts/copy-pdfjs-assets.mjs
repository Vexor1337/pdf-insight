import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'pdfjs-dist');
const target = join(root, 'public', 'pdfjs');

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  cpSync(join(source, folder), join(target, folder), { recursive: true });
}
