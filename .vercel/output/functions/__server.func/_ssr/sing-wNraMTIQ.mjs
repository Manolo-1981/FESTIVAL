import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sing-wNraMTIQ.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var MODEL = "grok-imagine-video-1.5-lite";
var HOUR_MS = 36e5;
var MAX_PER_HOUR = 4;
var COOLDOWN_MS = 2e4;
var gate = {
	windowStart: 0,
	count: 0,
	last: 0
};
var SCENES = {
	teatro: "small theater stage",
	estudio: "vocal recording booth",
	calle: "wet city street at night",
	sala: "concert hall seen from the stage",
	costa: "coastal terrace at dusk",
	propio: "custom background shown in the still"
};
function readGate(now = Date.now()) {
	if (now - gate.windowStart > HOUR_MS) {
		gate.windowStart = now;
		gate.count = 0;
	}
	return {
		remaining: Math.max(0, MAX_PER_HOUR - gate.count),
		waitMs: Math.max(0, COOLDOWN_MS - (now - gate.last))
	};
}
async function friendlyError(res) {
	if (res.status === 429) return "Hay demasiadas solicitudes. Espera un momento.";
	return "No se pudo generar el video. Revisa la foto y la letra, e inténtalo de nuevo.";
}
var singStatus_createServerFn_handler = createServerRpc({
	id: "d6caae0d9375e82cf179f4b9ba6c29cc14857a5bc204389e823823310b9d3d9e",
	name: "singStatus",
	filename: "src/lib/sing.ts"
}, (opts) => singStatus.__executeServer(opts));
var singStatus = createServerFn({ method: "GET" }).handler(singStatus_createServerFn_handler, async () => {
	const { remaining } = readGate();
	return {
		enabled: Boolean(process.env.XAI_API_KEY),
		remaining
	};
});
var startSingingClip_createServerFn_handler = createServerRpc({
	id: "5b6a5f92207f696e6e33e217df28d60262f94c956fcea2ee060c2fe0b03a8b40",
	name: "startSingingClip",
	filename: "src/lib/sing.ts"
}, (opts) => startSingingClip.__executeServer(opts));
var startSingingClip = createServerFn({ method: "POST" }).validator((input) => input).handler(startSingingClip_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return {
		ok: false,
		error: "El video cantado no está disponible en este momento."
	};
	const image = typeof data?.imageDataUrl === "string" ? data.imageDataUrl : "";
	const lyrics = (typeof data?.lyrics === "string" ? data.lyrics : "").replace(/\s+/g, " ").trim().slice(0, 180);
	const scene = SCENES[data?.scene] ?? SCENES.teatro;
	if (!image.startsWith("data:image/")) return {
		ok: false,
		error: "La imagen de la escena no es válida."
	};
	if (image.length > 18e5) return {
		ok: false,
		error: "La escena pesa demasiado. Prueba con otra foto."
	};
	if (lyrics.length < 8) return {
		ok: false,
		error: "Escribe al menos una frase para que la foto la cante."
	};
	const { remaining, waitMs } = readGate();
	if (waitMs > 0) return {
		ok: false,
		error: "Espera unos segundos antes de crear otro video."
	};
	if (remaining <= 0) return {
		ok: false,
		error: "Se alcanzó el límite de videos de esta hora."
	};
	const prompt = [
		"Animate this still. The same person sings the Spanish lyrics with natural lip movement and a clear, calm singing voice.",
		"Keep the face, age, hair, glasses, beard and clothes identical. Do not change who they are.",
		`Keep the ${scene} background still. Do not add text, logos, captions or extra people.`,
		`Lyrics: "${lyrics}"`
	].join(" ");
	let res;
	try {
		res = await fetch("https://api.x.ai/v1/videos/generations", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: MODEL,
				prompt,
				image: { url: image },
				duration: 6,
				resolution: "480p"
			}),
			signal: AbortSignal.timeout(6e4)
		});
	} catch {
		return {
			ok: false,
			error: "No se pudo iniciar el video. Inténtalo de nuevo."
		};
	}
	if (!res.ok) return {
		ok: false,
		error: await friendlyError(res)
	};
	const body = await res.json();
	const requestId = body.request_id || body.requestId || body.id;
	if (!requestId) return {
		ok: false,
		error: "El servicio no devolvió un identificador de video."
	};
	gate.last = Date.now();
	gate.count += 1;
	return {
		ok: true,
		requestId,
		remaining: Math.max(0, MAX_PER_HOUR - gate.count)
	};
});
var pollSingingClip_createServerFn_handler = createServerRpc({
	id: "ffbf651f145964f8b6bf5081744a825003cb9c2371de80442ce9b14bd81f7a53",
	name: "pollSingingClip",
	filename: "src/lib/sing.ts"
}, (opts) => pollSingingClip.__executeServer(opts));
var pollSingingClip = createServerFn({ method: "POST" }).validator((input) => input).handler(pollSingingClip_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return {
		ok: false,
		error: "El video cantado no está disponible."
	};
	const requestId = (data?.requestId ?? "").trim();
	if (!/^[A-Za-z0-9_.:-]{4,200}$/.test(requestId)) return {
		ok: false,
		error: "Identificador de video no válido."
	};
	let res;
	try {
		res = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
			headers: { Authorization: `Bearer ${apiKey}` },
			signal: AbortSignal.timeout(2e4)
		});
	} catch {
		return {
			ok: true,
			status: "pending"
		};
	}
	if (!res.ok) return {
		ok: false,
		error: await friendlyError(res)
	};
	const body = await res.json();
	const status = (body.status ?? "").toLowerCase();
	if (status === "done") {
		const url = body.video?.url || body.url;
		if (!url) return {
			ok: false,
			error: "El video terminó sin un enlace."
		};
		return {
			ok: true,
			status: "done",
			url
		};
	}
	if (status === "failed" || status === "expired") return {
		ok: false,
		error: "No se pudo generar el video. Prueba con otra foto o una letra más simple."
	};
	return {
		ok: true,
		status: "pending"
	};
});
//#endregion
export { pollSingingClip_createServerFn_handler, singStatus_createServerFn_handler, startSingingClip_createServerFn_handler };
