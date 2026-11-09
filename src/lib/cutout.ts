import type { ImageSegmenter } from "@mediapipe/tasks-vision";
import { loadImage } from "@/lib/compose";

type MaskView = {
  values: Float32Array;
  w: number;
  h: number;
};

let segmenterPromise: Promise<ImageSegmenter> | null = null;

function segmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
      const wasm = await FilesetResolver.forVisionTasks("/mediapipe");
      return ImageSegmenter.createFromOptions(wasm, {
        baseOptions: {
          modelAssetPath: "/models/selfie_segmenter.tflite",
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      });
    })().catch((error: unknown) => {
      segmenterPromise = null;
      throw error;
    });
  }
  return segmenterPromise;
}

function clearRatio(data: Uint8ClampedArray) {
  let clear = 0;
  const total = data.length / 4;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 24) clear += 1;
  }
  return clear / total;
}

function centerOpaque(data: Uint8ClampedArray, w: number, h: number) {
  let opaque = 0;
  let total = 0;
  const x0 = Math.floor(w * 0.32);
  const x1 = Math.floor(w * 0.68);
  const y0 = Math.floor(h * 0.18);
  const y1 = Math.floor(h * 0.78);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      total += 1;
      if (data[(y * w + x) * 4 + 3] > 40) opaque += 1;
    }
  }
  return total ? opaque / total : 0;
}

function paintAlpha(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  values: Float32Array,
  mw: number,
  mh: number,
  invert: boolean,
) {
  for (let y = 0; y < h; y++) {
    const my = Math.min(mh - 1, Math.floor(((y + 0.5) / h) * mh));
    for (let x = 0; x < w; x++) {
      const mx = Math.min(mw - 1, Math.floor(((x + 0.5) / w) * mw));
      let confidence = values[my * mw + mx];
      if (invert) confidence = 1 - confidence;
      const alpha =
        confidence <= 0.3 ? 0 : confidence >= 0.65 ? 255 : Math.round(((confidence - 0.3) / 0.35) * 255);
      data[(y * w + x) * 4 + 3] = alpha;
    }
  }
}

function looksCut(data: Uint8ClampedArray, w: number, h: number) {
  const cleared = clearRatio(data);
  return cleared >= 0.1 && cleared <= 0.82 && centerOpaque(data, w, h) >= 0.35;
}

function readMask(mask: { getAsFloat32Array: () => Float32Array; width: number; height: number; close: () => void }): MaskView {
  const values = new Float32Array(mask.getAsFloat32Array());
  const result = { values, w: mask.width, h: mask.height };
  mask.close();
  return result;
}

function floodClear(data: Uint8ClampedArray, w: number, h: number) {
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
  const samples = corners.map((index) => [data[index], data[index + 1], data[index + 2]]);
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const matches = (index: number) => {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    return samples.some((sample) => Math.abs(r - sample[0]) + Math.abs(g - sample[1]) + Math.abs(b - sample[2]) < 48);
  };
  const push = (x: number, y: number) => {
    const pixel = y * w + x;
    if (seen[pixel]) return;
    if (!matches(pixel * 4)) return;
    seen[pixel] = 1;
    stack.push(pixel);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const pixel = stack.pop() ?? 0;
    data[pixel * 4 + 3] = 0;
    const x = pixel % w;
    const y = (pixel / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x + 1 < w) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y + 1 < h) push(x, y + 1);
  }
}

function trimCanvas(source: HTMLCanvasElement) {
  const ctx = source.getContext("2d");
  if (!ctx) return source;
  const w = source.width;
  const h = source.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return source;
  const pad = 12;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  if (width * height < w * h * 0.05) return source;
  const next = document.createElement("canvas");
  next.width = width;
  next.height = height;
  next.getContext("2d")?.drawImage(source, minX, minY, width, height, 0, 0, width, height);
  return next;
}

function toPngUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No se pudo recortar la foto."));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

export async function cutoutPerson(src: string): Promise<string> {
  const image = await loadImage(src);
  const maxEdge = 960;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const w = Math.max(1, Math.round(image.naturalWidth * scale));
  const h = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo preparar la foto.");
  ctx.drawImage(image, 0, 0, w, h);

  const original = ctx.getImageData(0, 0, w, h);
  let done = false;

  try {
    const engine = await segmenter();
    const result = engine.segment(canvas);
    const masks = result.confidenceMasks ?? [];
    let chosen: { values: Float32Array; w: number; h: number } | null = null;
    let best = -1;
    for (const mask of masks) {
      const read = readMask(mask);
      const score = read.values[Math.floor(read.h / 2) * read.w + Math.floor(read.w / 2)] ?? 0;
      if (score > best) {
        best = score;
        chosen = read;
      }
    }
    if (chosen && chosen.w > 0 && chosen.h > 0) {
      for (const invert of [false, true]) {
        const pixels = new ImageData(new Uint8ClampedArray(original.data), w, h);
        paintAlpha(pixels.data, w, h, chosen.values, chosen.w, chosen.h, invert);
        if (looksCut(pixels.data, w, h)) {
          ctx.putImageData(pixels, 0, 0);
          done = true;
          break;
        }
      }
    }
  } catch {
    done = false;
  }

  if (!done) {
    const pixels = new ImageData(new Uint8ClampedArray(original.data), w, h);
    floodClear(pixels.data, w, h);
    if (!looksCut(pixels.data, w, h)) {
      throw new Error("No pude separar el fondo. La foto se muestra completa.");
    }
    ctx.putImageData(pixels, 0, 0);
  }

  return toPngUrl(trimCanvas(canvas));
}
