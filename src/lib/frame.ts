export type Aspect = "9:16" | "16:9";
export type Mask = "rostro" | "cuerpo" | "completo";

export type FrameOpts = {
  aspect: Aspect;
  scale: number;
  offsetX: number;
  offsetY: number;
  mask: Mask;
};

export type PersonLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: string;
  fit: "cover" | "contain";
};

const BOX: Record<Aspect, Record<Mask, { w: number; h: number; top: number }>> = {
  "9:16": {
    rostro: { w: 62, h: 40, top: 18 },
    cuerpo: { w: 54, h: 70, top: 22 },
    completo: { w: 78, h: 68, top: 14 },
  },
  "16:9": {
    rostro: { w: 26, h: 62, top: 14 },
    cuerpo: { w: 24, h: 78, top: 12 },
    completo: { w: 36, h: 76, top: 12 },
  },
};

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function personLayout(opts: FrameOpts): PersonLayout {
  const scale = clamp(opts.scale, 0.75, 1.3);
  const base = BOX[opts.aspect][opts.mask];
  const width = base.w * scale;
  const height = base.h * scale;
  const left = clamp(50 - width / 2 + opts.offsetX, -15, 100);
  const restingTop = opts.mask === "rostro" ? base.top : base.top + base.h - height;
  const top = clamp(restingTop + opts.offsetY, -20, 100);
  const radius = opts.mask === "rostro" ? "50%" : opts.mask === "cuerpo" ? "12%" : "2%";
  const fit = opts.mask === "completo" ? "contain" : "cover";
  return { left, top, width, height, radius, fit };
}

export function stagePixels(aspect: Aspect): { w: number; h: number } {
  return aspect === "9:16" ? { w: 540, h: 960 } : { w: 960, h: 540 };
}
