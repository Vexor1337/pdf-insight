import { OPS, type PDFPageProxy } from 'pdfjs-dist';
import { MAX_IMAGE_BASE64_CHARS, OCR_RENDER_MAX_PX } from '../../../shared/limits.ts';

const IMAGE_OPS = new Set<number>([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageMaskXObject,
  OPS.paintImageXObjectRepeat,
]);

export async function pageHasImages(page: PDFPageProxy): Promise<boolean> {
  const operators = await page.getOperatorList();
  return operators.fnArray.some((fn) => IMAGE_OPS.has(fn));
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas export failed'));
      },
      'image/jpeg',
      quality,
    );
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

const QUALITY_STEPS = [0.8, 0.65, 0.5] as const;

export async function renderPageAsJpeg(page: PDFPageProxy): Promise<string | null> {
  const base = page.getViewport({ scale: 1 });
  const scale = OCR_RENDER_MAX_PX / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  try {
    await page.render({ canvas, viewport, background: '#ffffff' }).promise;
    for (const quality of QUALITY_STEPS) {
      const base64 = await blobToBase64(await canvasToJpeg(canvas, quality));
      if (base64.length <= MAX_IMAGE_BASE64_CHARS) return base64;
    }
    return null;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
