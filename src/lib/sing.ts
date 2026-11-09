import { createServerFn } from "@tanstack/react-start";

const MODEL = "grok-imagine-video-1.5-lite";
const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 4;
const COOLDOWN_MS = 20_000;

const gate = { windowStart: 0, count: 0, last: 0 };

const SCENES: Record<string, string> = {
  teatro: "small theater stage",
  estudio: "vocal recording booth",
  calle: "wet city street at night",
  sala: "concert hall seen from the stage",
  costa: "coastal terrace at dusk",
  propio: "custom background shown in the still",
};

function readGate(now = Date.now()) {
  if (now - gate.windowStart > HOUR_MS) {
    gate.windowStart = now;
    gate.count = 0;
  }
  return {
    remaining: Math.max(0, MAX_PER_HOUR - gate.count),
    waitMs: Math.max(0, COOLDOWN_MS - (now - gate.last)),
  };
}

async function friendlyError(res: Response): Promise<string> {
  if (res.status === 429) return "Hay demasiadas solicitudes. Espera un momento.";
  return "No se pudo generar el video. Revisa la foto y la letra, e inténtalo de nuevo.";
}

export const singStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { remaining } = readGate();
  return { enabled: Boolean(process.env.XAI_API_KEY), remaining };
});

type StartInput = { imageDataUrl: string; lyrics: string; scene: string };

export const startSingingClip = createServerFn({ method: "POST" })
  .validator((input: StartInput) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "El video cantado no está disponible en este momento." };
    }

    const image = typeof data?.imageDataUrl === "string" ? data.imageDataUrl : "";
    const lyrics = (typeof data?.lyrics === "string" ? data.lyrics : "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
    const scene = SCENES[data?.scene] ?? SCENES.teatro;

    if (!image.startsWith("data:image/")) {
      return { ok: false as const, error: "La imagen de la escena no es válida." };
    }
    if (image.length > 1_800_000) {
      return { ok: false as const, error: "La escena pesa demasiado. Prueba con otra foto." };
    }
    if (lyrics.length < 8) {
      return { ok: false as const, error: "Escribe al menos una frase para que la foto la cante." };
    }

    const { remaining, waitMs } = readGate();
    if (waitMs > 0) {
      return { ok: false as const, error: "Espera unos segundos antes de crear otro video." };
    }
    if (remaining <= 0) {
      return { ok: false as const, error: "Se alcanzó el límite de videos de esta hora." };
    }

    const prompt = [
      "Animate this still. The same person sings the Spanish lyrics with natural lip movement and a clear, calm singing voice.",
      "Keep the face, age, hair, glasses, beard and clothes identical. Do not change who they are.",
      `Keep the ${scene} background still. Do not add text, logos, captions or extra people.`,
      `Lyrics: "${lyrics}"`,
    ].join(" ");

    let res: Response;
    try {
      res = await fetch("https://api.x.ai/v1/videos/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          prompt,
          image: { url: image },
          duration: 6,
          resolution: "480p",
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      return { ok: false as const, error: "No se pudo iniciar el video. Inténtalo de nuevo." };
    }

    if (!res.ok) return { ok: false as const, error: await friendlyError(res) };

    const body = (await res.json()) as { request_id?: string; requestId?: string; id?: string };
    const requestId = body.request_id || body.requestId || body.id;
    if (!requestId) {
      return { ok: false as const, error: "El servicio no devolvió un identificador de video." };
    }

    gate.last = Date.now();
    gate.count += 1;
    return {
      ok: true as const,
      requestId,
      remaining: Math.max(0, MAX_PER_HOUR - gate.count),
    };
  });

export const pollSingingClip = createServerFn({ method: "POST" })
  .validator((input: { requestId: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "El video cantado no está disponible." };

    const requestId = (data?.requestId ?? "").trim();
    if (!/^[A-Za-z0-9_.:-]{4,200}$/.test(requestId)) {
      return { ok: false as const, error: "Identificador de video no válido." };
    }

    let res: Response;
    try {
      res = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      return { ok: true as const, status: "pending" as const };
    }

    if (!res.ok) return { ok: false as const, error: await friendlyError(res) };

    const body = (await res.json()) as {
      status?: string;
      video?: { url?: string };
      url?: string;
    };
    const status = (body.status ?? "").toLowerCase();
    if (status === "done") {
      const url = body.video?.url || body.url;
      if (!url) return { ok: false as const, error: "El video terminó sin un enlace." };
      return { ok: true as const, status: "done" as const, url };
    }
    if (status === "failed" || status === "expired") {
      return {
        ok: false as const,
        error: "No se pudo generar el video. Prueba con otra foto o una letra más simple.",
      };
    }
    return { ok: true as const, status: "pending" as const };
  });
