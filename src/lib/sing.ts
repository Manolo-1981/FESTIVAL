import { createServerFn } from "@tanstack/react-start";

const MODEL = "grok-imagine-video-1.5-lite";
const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 4;
const COOLDOWN_MS = 20_000;
const LYRIC_LIMIT = 800;
const ACTION_LIMIT = 400;

const gate = { windowStart: 0, count: 0, last: 0 };

const SCENES: Record<string, string> = {
  teatro: "un teatro pequeño",
  estudio: "una cabina de grabación",
  calle: "una calle de noche",
  sala: "una sala de concierto",
  costa: "una terraza frente al mar",
  propio: "el fondo que ya se ve en la imagen",
};

type ClipSeconds = 6 | 10 | 15;

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

function clipSeconds(value: unknown): ClipSeconds {
  return value === 10 || value === 15 ? value : 6;
}

function clipCost(seconds: ClipSeconds) {
  return seconds === 6 ? 1 : 2;
}

function cleanText(value: unknown, limit: number) {
  return (typeof value === "string" ? value : "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function sungLyrics(raw: string) {
  const lines = raw
    .split(/\n+/)
    .map((line) => line.replace(/\p{Extended_Pictographic}/gu, "").replace(/\uFE0F/g, "").trim())
    .filter(Boolean)
    .filter((line) => {
      if (/^\(.+\)$/.test(line)) return false;
      if (/^(verso|estrofa|coro|intro|puente|bridge|verse)\b/i.test(line)) return false;
      return true;
    });
  return lines.join("\n").slice(0, LYRIC_LIMIT);
}

const MUSIC: Record<string, string> = {
  bolero: "De fondo suena un bolero lento. No lo anuncies ni lo describas.",
  suave: "De fondo suena música suave. No la anuncies ni la describas.",
  balada: "De fondo suena una balada lenta. No la anuncies ni la describas.",
  compas: "De fondo suena un ritmo claro. No lo anuncies ni lo describas.",
  none: "De fondo suena música. No la anuncies. No cantes a capela.",
};

async function friendlyError(res: Response): Promise<string> {
  if (res.status === 429) return "Hay demasiadas solicitudes. Espera un momento.";
  return "No se pudo generar el video. Revisa la foto y la letra, e inténtalo de nuevo.";
}

export const singStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { remaining } = readGate();
  return { enabled: Boolean(process.env.XAI_API_KEY), remaining };
});

type StartInput = {
  imageDataUrl: string;
  lyrics: string;
  scene: string;
  duration?: ClipSeconds;
  action?: string;
  music?: string;
};

export const startSingingClip = createServerFn({ method: "POST" })
  .validator((input: StartInput) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "El video cantado no está disponible en este momento." };
    }

    const image = typeof data?.imageDataUrl === "string" ? data.imageDataUrl : "";
    const lyrics = sungLyrics(typeof data?.lyrics === "string" ? data.lyrics : "");
    const action = cleanText(data?.action, ACTION_LIMIT);
    const scene = SCENES[data?.scene] ?? SCENES.teatro;
    const duration = clipSeconds(data?.duration);
    const music = MUSIC[typeof data?.music === "string" ? data.music : "none"] ?? MUSIC.none;

    if (!image.startsWith("data:image/")) {
      return { ok: false as const, error: "La imagen de la escena no es válida." };
    }
    if (image.length > 1_800_000) {
      return { ok: false as const, error: "La escena pesa demasiado. Prueba con otra foto." };
    }
    if (lyrics.length < 8 && action.length < 8) {
      return {
        ok: false as const,
        error: "Escribe la letra o qué debe hacer la persona en la escena.",
      };
    }

    const { remaining, waitMs } = readGate();
    const cost = clipCost(duration);
    if (waitMs > 0) {
      return { ok: false as const, error: "Espera unos segundos antes de crear otro video." };
    }
    if (remaining < cost) {
      return {
        ok: false as const,
        error:
          duration === 6
            ? "Se alcanzó el límite de videos de esta hora."
            : "No alcanzan los créditos de esta hora para un video tan largo.",
      };
    }

    const prompt = [
      "Anima a la misma persona de la foto. Conserva su rostro, edad, pelo, lentes, barba y ropa.",
      "No la cambies por otra. No tapes la imagen con otro recuadro.",
      music,
      action ? `Mientras canta, hace esto, pero no lo dice: ${action}.` : "Canta mirando a la cámara.",
      lyrics
        ? `Canta en español latinoamericano, con pronunciación natural, como una canción. No traduzcas. No hables en inglés. No mezcles idiomas. No recites con acento extranjero. Canta exactamente estas frases:\n${lyrics}`
        : "No inventes una letra.",
      "Sin subtítulos, sin texto en pantalla y sin una segunda voz que traduzca.",
      `El lugar sigue siendo ${scene}. No lo menciones. No agregues otras personas.`,
    ].join("\n");

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
          duration,
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
    gate.count += cost;
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

function allowedVideoUrl(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (url.hostname === "x.ai" || url.hostname.endsWith(".x.ai"));
  } catch {
    return false;
  }
}

export const downloadClip = createServerFn({ method: "POST" })
  .validator((input: { url: string }) => input)
  .handler(async ({ data }) => {
    const raw = typeof data?.url === "string" ? data.url : "";
    if (!allowedVideoUrl(raw)) {
      return { ok: false as const, error: "No se puede guardar ese video." };
    }
    let res: Response;
    try {
      res = await fetch(raw, { signal: AbortSignal.timeout(60_000) });
    } catch {
      return { ok: false as const, error: "No se pudo descargar el video." };
    }
    if (!res.ok) return { ok: false as const, error: "No se pudo descargar el video." };
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 1000 || bytes.length > 18_000_000) {
      return { ok: false as const, error: "El video es demasiado grande para guardarlo desde aquí." };
    }
    return { ok: true as const, base64: bytes.toString("base64") };
  });
