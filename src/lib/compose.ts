import { personLayout, stagePixels, type FrameOpts, type Mask } from "@/lib/frame";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen."));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  dw: number,
  dh: number,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, dw, dh);
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  dw: number,
  dh: number,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.min(dw / iw, dh / ih);
  const rw = iw * scale;
  const rh = ih * scale;
  ctx.drawImage(img, x + (dw - rw) / 2, y + (dh - rh) / 2, rw, rh);
}

function clipShape(
  ctx: CanvasRenderingContext2D,
  mask: Mask,
  x: number,
  y: number,
  dw: number,
  dh: number,
) {
  ctx.beginPath();
  if (mask === "rostro") {
    ctx.ellipse(x + dw / 2, y + dh / 2, dw / 2, dh / 2, 0, 0, Math.PI * 2);
    return;
  }
  const radius = mask === "cuerpo" ? Math.min(dw, dh) * 0.12 : Math.min(dw, dh) * 0.02;
  ctx.roundRect(x, y, dw, dh, radius);
}

export async function composeScene(
  opts: FrameOpts & { personUrl: string; backgroundUrl: string; vignette: number },
): Promise<string> {
  const [person, background] = await Promise.all([
    loadImage(opts.personUrl),
    loadImage(opts.backgroundUrl),
  ]);
  const { w, h } = stagePixels(opts.aspect);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la escena.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#0c0c0e";
  ctx.fillRect(0, 0, w, h);
  drawCover(ctx, background, 0, 0, w, h);

  const box = personLayout(opts);
  const x = (box.left / 100) * w;
  const y = (box.top / 100) * h;
  const dw = (box.width / 100) * w;
  const dh = (box.height / 100) * h;

  ctx.save();
  clipShape(ctx, opts.mask, x, y, dw, dh);
  ctx.clip();
  if (box.fit === "contain") drawContain(ctx, person, x, y, dw, dh);
  else drawCover(ctx, person, x, y, dw, dh);
  ctx.restore();

  const alpha = Math.min(0.72, Math.max(0, opts.vignette) / 140);
  const gradient = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.22,
    w / 2,
    h / 2,
    Math.max(w, h) * 0.72,
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  let url = canvas.toDataURL("image/jpeg", 0.82);
  if (url.length > 1_700_000) url = canvas.toDataURL("image/jpeg", 0.62);
  return url;
}
