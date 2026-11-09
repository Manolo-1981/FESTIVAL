import { i as __toESM } from "../_runtime.mjs";
import { b as require_jsx_runtime, q as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Music, c as Clapperboard, i as Pause, n as RotateCcw, o as LoaderCircle, r as Play, s as ImagePlus } from "../_libs/lucide-react.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-FCIlIGmU.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var BACKGROUNDS = [
	{
		id: "teatro",
		name: "Teatro",
		note: "Un foco y el telón",
		src: "/backgrounds/teatro.jpg"
	},
	{
		id: "estudio",
		name: "Estudio",
		note: "Cabina de voz",
		src: "/backgrounds/estudio.jpg"
	},
	{
		id: "calle",
		name: "Calle",
		note: "Noche después de la lluvia",
		src: "/backgrounds/calle.jpg"
	},
	{
		id: "sala",
		name: "Sala",
		note: "Desde el escenario",
		src: "/backgrounds/sala.jpg"
	},
	{
		id: "costa",
		name: "Costa",
		note: "Terraza al atardecer",
		src: "/backgrounds/costa.jpg"
	}
];
function backgroundSrc(id, customUrl) {
	if (id === "propio" && customUrl) return customUrl;
	return BACKGROUNDS.find((item) => item.id === id)?.src ?? BACKGROUNDS[0].src;
}
function sceneKey(id) {
	if (id === "propio") return "propio";
	return BACKGROUNDS.some((item) => item.id === id) ? id : "teatro";
}
var BOX = {
	"9:16": {
		rostro: {
			w: 62,
			h: 40,
			top: 18
		},
		cuerpo: {
			w: 54,
			h: 70,
			top: 22
		},
		completo: {
			w: 78,
			h: 68,
			top: 14
		}
	},
	"16:9": {
		rostro: {
			w: 26,
			h: 62,
			top: 14
		},
		cuerpo: {
			w: 24,
			h: 78,
			top: 12
		},
		completo: {
			w: 36,
			h: 76,
			top: 12
		}
	}
};
function clamp(n, min, max) {
	return Math.min(max, Math.max(min, n));
}
function personLayout(opts) {
	const scale = clamp(opts.scale, .75, 1.3);
	const base = BOX[opts.aspect][opts.mask];
	const width = base.w * scale;
	const height = base.h * scale;
	return {
		left: clamp(50 - width / 2 + opts.offsetX, -15, 100),
		top: clamp((opts.mask === "rostro" ? base.top : base.top + base.h - height) + opts.offsetY, -20, 100),
		width,
		height,
		radius: opts.mask === "rostro" ? "50%" : opts.mask === "cuerpo" ? "12%" : "2%",
		fit: opts.mask === "completo" ? "contain" : "cover"
	};
}
function stagePixels(aspect) {
	return aspect === "9:16" ? {
		w: 540,
		h: 960
	} : {
		w: 960,
		h: 540
	};
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var framing = {
	scale: 1,
	offsetX: 0,
	offsetY: 0,
	vignette: 42,
	mask: "rostro"
};
var initial = {
	bgId: "teatro",
	customBgUrl: null,
	...framing,
	aspect: "9:16",
	songTitle: "",
	lyrics: "",
	personUrl: null,
	audioUrl: null,
	audioName: ""
};
var useStudio = create()(persist((set) => ({
	...initial,
	patch: (partial) => set(partial),
	resetFraming: () => set(framing)
}), {
	name: "escena-studio",
	skipHydration: true,
	partialize: (state) => ({
		bgId: state.bgId,
		scale: state.scale,
		offsetX: state.offsetX,
		offsetY: state.offsetY,
		vignette: state.vignette,
		mask: state.mask,
		aspect: state.aspect,
		songTitle: state.songTitle,
		lyrics: state.lyrics
	})
}));
function StageView({ stageRef, personRef, videoUrl, playing, onPhoto }) {
	const bgId = useStudio((s) => s.bgId);
	const customBgUrl = useStudio((s) => s.customBgUrl);
	const personUrl = useStudio((s) => s.personUrl);
	const aspect = useStudio((s) => s.aspect);
	const scale = useStudio((s) => s.scale);
	const offsetX = useStudio((s) => s.offsetX);
	const offsetY = useStudio((s) => s.offsetY);
	const mask = useStudio((s) => s.mask);
	const vignette = useStudio((s) => s.vignette);
	const layout = personLayout({
		aspect,
		scale,
		offsetX,
		offsetY,
		mask
	});
	const src = backgroundSrc(bgId, customBgUrl);
	function onPointerDown(event) {
		if (!personUrl || videoUrl) return;
		const stage = stageRef.current;
		if (!stage) return;
		event.preventDefault();
		const rect = stage.getBoundingClientRect();
		const originX = useStudio.getState().offsetX;
		const originY = useStudio.getState().offsetY;
		const startX = event.clientX;
		const startY = event.clientY;
		event.currentTarget.setPointerCapture(event.pointerId);
		const move = (ev) => {
			const dx = (ev.clientX - startX) / rect.width * 100;
			const dy = (ev.clientY - startY) / rect.height * 100;
			useStudio.getState().patch({
				offsetX: clamp(originX + dx, -40, 40),
				offsetY: clamp(originY + dy, -40, 40)
			});
		};
		const up = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex justify-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: stageRef,
			className: cn("relative overflow-hidden bg-surface", aspect === "9:16" ? "stage-portrait" : "stage-landscape"),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src,
					alt: "",
					className: "absolute inset-0 h-full w-full object-cover"
				}),
				personUrl && !videoUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					ref: personRef,
					className: cn("person-shadow absolute overflow-hidden touch-none", !playing && "escena-idle"),
					style: {
						left: `${layout.left}%`,
						top: `${layout.top}%`,
						width: `${layout.width}%`,
						height: `${layout.height}%`,
						borderRadius: layout.radius
					},
					onPointerDown,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: personUrl,
						alt: "Foto de la persona en escena",
						draggable: false,
						className: cn("h-full w-full", layout.fit === "cover" ? "object-cover" : "object-contain")
					})
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "pointer-events-none absolute inset-0",
					style: { background: `radial-gradient(ellipse at center, transparent 42%, rgb(0 0 0 / ${Math.min(.72, vignette / 140)}) 100%)` }
				}),
				videoUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
					src: videoUrl,
					className: "absolute inset-0 h-full w-full bg-bg object-contain",
					controls: true,
					autoPlay: true,
					playsInline: true
				}, videoUrl) : null,
				!personUrl && !videoUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "absolute inset-x-4 bottom-4 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImagePlus, {
							className: "size-4",
							"aria-hidden": true
						}),
						"Subir foto",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "file",
							accept: "image/jpeg,image/png,image/webp",
							className: "sr-only",
							onChange: (event) => {
								const file = event.target.files?.[0];
								event.target.value = "";
								if (file) onPhoto(file);
							}
						})
					]
				}) : null
			]
		})
	});
}
function Button({ variant = "primary", className, type = "button", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type,
		className: cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-[background-color,opacity] duration-150 pressable disabled:opacity-50", variant === "primary" && "bg-accent text-accent-fg", variant === "secondary" && "border border-line bg-surface-2 text-fg", variant === "ghost" && "text-muted", className),
		...props
	});
}
function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(/* @__PURE__ */ new Error("No se pudo leer la imagen."));
		img.src = src;
	});
}
function drawCover(ctx, img, x, y, dw, dh) {
	const iw = img.naturalWidth || img.width;
	const ih = img.naturalHeight || img.height;
	const scale = Math.max(dw / iw, dh / ih);
	const sw = dw / scale;
	const sh = dh / scale;
	ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, dw, dh);
}
function drawContain(ctx, img, x, y, dw, dh) {
	const iw = img.naturalWidth || img.width;
	const ih = img.naturalHeight || img.height;
	const scale = Math.min(dw / iw, dh / ih);
	const rw = iw * scale;
	const rh = ih * scale;
	ctx.drawImage(img, x + (dw - rw) / 2, y + (dh - rh) / 2, rw, rh);
}
function clipShape(ctx, mask, x, y, dw, dh) {
	ctx.beginPath();
	if (mask === "rostro") {
		ctx.ellipse(x + dw / 2, y + dh / 2, dw / 2, dh / 2, 0, 0, Math.PI * 2);
		return;
	}
	const radius = mask === "cuerpo" ? Math.min(dw, dh) * .12 : Math.min(dw, dh) * .02;
	ctx.roundRect(x, y, dw, dh, radius);
}
async function composeScene(opts) {
	const [person, background] = await Promise.all([loadImage(opts.personUrl), loadImage(opts.backgroundUrl)]);
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
	const x = box.left / 100 * w;
	const y = box.top / 100 * h;
	const dw = box.width / 100 * w;
	const dh = box.height / 100 * h;
	ctx.save();
	clipShape(ctx, opts.mask, x, y, dw, dh);
	ctx.clip();
	if (box.fit === "contain") drawContain(ctx, person, x, y, dw, dh);
	else drawCover(ctx, person, x, y, dw, dh);
	ctx.restore();
	const alpha = Math.min(.72, Math.max(0, opts.vignette) / 140);
	const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .22, w / 2, h / 2, Math.max(w, h) * .72);
	gradient.addColorStop(0, "rgba(0,0,0,0)");
	gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, w, h);
	let url = canvas.toDataURL("image/jpeg", .82);
	if (url.length > 17e5) url = canvas.toDataURL("image/jpeg", .62);
	return url;
}
var DEMO_LYRICS = [
	"Canto bajito esta noche\npara que me escuche el silencio.",
	"Si el fondo cambia, yo me quedo\ncon la misma voz de siempre.",
	"Una luz, una foto\ny el compás que traigo yo."
];
function lyricLines(text) {
	const raw = text.trim();
	if (!raw) return [];
	const byLine = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
	if (byLine.length > 1) return byLine;
	if (raw.includes("/")) return raw.split("/").map((line) => line.trim()).filter(Boolean);
	const sentences = raw.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
	return sentences.length ? sentences : [raw];
}
function lineAt(lines, current, duration) {
	if (!lines.length || !Number.isFinite(duration) || duration <= 0) return 0;
	const index = Math.floor(current / duration * lines.length);
	return Math.min(lines.length - 1, Math.max(0, index));
}
function formatTime(seconds) {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
	return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var singStatus = createServerFn({ method: "GET" }).handler(createSsrRpc("d6caae0d9375e82cf179f4b9ba6c29cc14857a5bc204389e823823310b9d3d9e"));
var startSingingClip = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("5b6a5f92207f696e6e33e217df28d60262f94c956fcea2ee060c2fe0b03a8b40"));
var pollSingingClip = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("ffbf651f145964f8b6bf5081744a825003cb9c2371de80442ce9b14bd81f7a53"));
var AUDIO_EXT = /\.(mp3|m4a|wav|ogg|aac|flac|webm)$/i;
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
async function takePhoto(file) {
	if (!file.type.startsWith("image/")) throw new Error("Elige una imagen JPG, PNG o WEBP.");
	if (file.size > 8388608) throw new Error("La imagen supera 8 MB.");
	const url = URL.createObjectURL(file);
	try {
		await loadImage(url);
	} catch (error) {
		URL.revokeObjectURL(url);
		throw error;
	}
	return url;
}
function takeAudio(file) {
	if (!(file.type.startsWith("audio/") || AUDIO_EXT.test(file.name))) throw new Error("Elige un audio MP3, M4A o WAV.");
	if (file.size > 20971520) throw new Error("El audio supera 20 MB.");
	return URL.createObjectURL(file);
}
function replaceBlob(previous, next) {
	if (previous && previous !== next && previous.startsWith("blob:")) URL.revokeObjectURL(previous);
}
function Studio() {
	const patch = useStudio((s) => s.patch);
	const resetFraming = useStudio((s) => s.resetFraming);
	const bgId = useStudio((s) => s.bgId);
	const customBgUrl = useStudio((s) => s.customBgUrl);
	const personUrl = useStudio((s) => s.personUrl);
	const audioUrl = useStudio((s) => s.audioUrl);
	const audioName = useStudio((s) => s.audioName);
	const scale = useStudio((s) => s.scale);
	const offsetX = useStudio((s) => s.offsetX);
	const offsetY = useStudio((s) => s.offsetY);
	const vignette = useStudio((s) => s.vignette);
	const mask = useStudio((s) => s.mask);
	const aspect = useStudio((s) => s.aspect);
	const songTitle = useStudio((s) => s.songTitle);
	const lyrics = useStudio((s) => s.lyrics);
	const audioRef = (0, import_react.useRef)(null);
	const stageRef = (0, import_react.useRef)(null);
	const personRef = (0, import_react.useRef)(null);
	const meterRef = (0, import_react.useRef)(null);
	const graphRef = (0, import_react.useRef)(null);
	const aliveRef = (0, import_react.useRef)(true);
	const toggleRef = (0, import_react.useRef)(async () => {});
	const [module, setModule] = (0, import_react.useState)("cantar");
	const [playing, setPlaying] = (0, import_react.useState)(false);
	const [current, setCurrent] = (0, import_react.useState)(0);
	const [duration, setDuration] = (0, import_react.useState)(0);
	const [notice, setNotice] = (0, import_react.useState)("");
	const [videoUrl, setVideoUrl] = (0, import_react.useState)(null);
	const [job, setJob] = (0, import_react.useState)({ state: "idle" });
	const [ai, setAi] = (0, import_react.useState)(null);
	const lines = lyricLines(lyrics);
	const line = lines.length ? lines[lineAt(lines, current, duration)] : "";
	const busy = job.state === "preparing" || job.state === "generating";
	(0, import_react.useEffect)(() => {
		aliveRef.current = true;
		useStudio.persist.rehydrate();
		singStatus().then((status) => {
			if (aliveRef.current) setAi(status);
		}).catch(() => {
			if (aliveRef.current) setAi({
				enabled: false,
				remaining: 0
			});
		});
		return () => {
			aliveRef.current = false;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		setCurrent(0);
		setDuration(0);
		setPlaying(false);
	}, [audioUrl]);
	(0, import_react.useEffect)(() => {
		if (!playing) return;
		let raf = 0;
		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const tick = () => {
			const audio = audioRef.current;
			const graph = graphRef.current;
			let energy = 0;
			if (audio && graph && !audio.paused) {
				graph.analyser.getByteFrequencyData(graph.bins);
				let sum = 0;
				for (let i = 0; i < graph.bins.length; i++) sum += graph.bins[i];
				energy = sum / graph.bins.length / 255;
			}
			const meter = meterRef.current;
			if (meter) {
				const bars = meter.children;
				for (let i = 0; i < bars.length; i++) {
					const value = graph && energy > 0 ? graph.bins[Math.min(i, graph.bins.length - 1)] / 255 : .12;
					bars[i].style.transform = `scaleY(${.15 + value * .85})`;
				}
			}
			const person = personRef.current;
			if (person && !reduced) person.style.transform = `translate3d(0, ${(-10 * energy).toFixed(2)}px, 0) scale(${(1 + energy * .04).toFixed(3)})`;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(raf);
			if (personRef.current) personRef.current.style.transform = "";
			const meter = meterRef.current;
			if (meter) for (const bar of meter.children) bar.style.transform = "scaleY(0.15)";
		};
	}, [playing]);
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			if (event.code !== "Space") return;
			const target = event.target;
			if (target instanceof HTMLElement) {
				const tag = target.tagName;
				if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
			}
			event.preventDefault();
			toggleRef.current();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	function ensureGraph() {
		const audio = audioRef.current;
		if (!audio) return null;
		if (graphRef.current) return graphRef.current;
		const ctx = new AudioContext();
		const analyser = ctx.createAnalyser();
		analyser.fftSize = 64;
		ctx.createMediaElementSource(audio).connect(analyser);
		analyser.connect(ctx.destination);
		const bins = new Uint8Array(analyser.frequencyBinCount);
		graphRef.current = {
			ctx,
			analyser,
			bins
		};
		return graphRef.current;
	}
	async function toggle() {
		const audio = audioRef.current;
		if (!audio || !useStudio.getState().audioUrl) return;
		const graph = ensureGraph();
		try {
			if (graph && graph.ctx.state === "suspended") await graph.ctx.resume();
			if (audio.paused) await audio.play();
			else audio.pause();
		} catch {
			setNotice("No se pudo reproducir ese audio.");
		}
	}
	toggleRef.current = toggle;
	async function onPhoto(file) {
		try {
			const url = await takePhoto(file);
			replaceBlob(useStudio.getState().personUrl, url);
			patch({ personUrl: url });
			setVideoUrl(null);
			setNotice("");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "No se pudo abrir la foto.");
		}
	}
	async function onCustomBg(file) {
		try {
			const url = await takePhoto(file);
			replaceBlob(useStudio.getState().customBgUrl, url);
			patch({
				customBgUrl: url,
				bgId: "propio"
			});
			setNotice("");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "No se pudo abrir el fondo.");
		}
	}
	function onAudio(file) {
		try {
			const url = takeAudio(file);
			audioRef.current?.pause();
			replaceBlob(useStudio.getState().audioUrl, url);
			patch({
				audioUrl: url,
				audioName: file.name
			});
			setNotice("");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "No se pudo abrir el audio.");
		}
	}
	function clearAudio() {
		audioRef.current?.pause();
		replaceBlob(useStudio.getState().audioUrl, null);
		patch({
			audioUrl: null,
			audioName: ""
		});
	}
	async function createClip() {
		if (busy) return;
		const state = useStudio.getState();
		if (!state.personUrl) {
			setNotice("Primero sube una foto.");
			return;
		}
		if (state.lyrics.trim().length < 8) {
			setNotice("Escribe al menos una frase para el video cantado.");
			return;
		}
		setNotice("");
		setJob({ state: "preparing" });
		setVideoUrl(null);
		try {
			const imageDataUrl = await composeScene({
				personUrl: state.personUrl,
				backgroundUrl: backgroundSrc(state.bgId, state.customBgUrl),
				aspect: state.aspect,
				scale: state.scale,
				offsetX: state.offsetX,
				offsetY: state.offsetY,
				mask: state.mask,
				vignette: state.vignette
			});
			if (!aliveRef.current) return;
			setJob({ state: "generating" });
			const started = await startSingingClip({ data: {
				imageDataUrl,
				lyrics: state.lyrics,
				scene: sceneKey(state.bgId)
			} });
			if (!aliveRef.current) return;
			if (!started.ok) {
				setJob({
					state: "error",
					message: started.error
				});
				return;
			}
			setAi((prev) => prev ? {
				...prev,
				remaining: started.remaining
			} : prev);
			for (let attempt = 0; attempt < 40; attempt++) {
				await sleep(4e3);
				if (!aliveRef.current) return;
				const polled = await pollSingingClip({ data: { requestId: started.requestId } });
				if (!aliveRef.current) return;
				if (!polled.ok) {
					setJob({
						state: "error",
						message: polled.error
					});
					return;
				}
				if (polled.status === "done") {
					setVideoUrl(polled.url);
					setJob({ state: "ready" });
					return;
				}
			}
			setJob({
				state: "error",
				message: "El video está tardando demasiado. Inténtalo otra vez en un momento."
			});
		} catch (error) {
			if (!aliveRef.current) return;
			setJob({
				state: "error",
				message: error instanceof Error ? error.message : "No se pudo crear el video."
			});
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto min-h-dvh w-full max-w-6xl px-4 py-6 pb-16 lg:px-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "mb-6 max-w-xl",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-4xl leading-tight font-medium tracking-tight text-fg",
					children: "Escena"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-base text-muted",
					children: "Una foto, una canción y el fondo que elijas."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "stage-column min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StageView, {
						stageRef,
						personRef,
						videoUrl,
						playing,
						onPhoto: (file) => void onPhoto(file)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto mt-3 grid max-w-md justify-items-center gap-2",
						children: [
							audioUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								ref: meterRef,
								className: "flex h-8 w-40 items-end justify-center gap-1",
								"aria-hidden": true,
								children: Array.from({ length: 12 }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "h-full w-1 origin-bottom rounded-sm bg-accent",
									style: { transform: "scaleY(0.15)" }
								}, index))
							}) : null,
							songTitle ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "max-w-full truncate text-sm font-medium text-fg",
								children: songTitle
							}) : null,
							line ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-center text-sm text-muted",
								children: line
							}) : null
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid min-w-0 gap-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-1 rounded-lg bg-surface p-1 lg:hidden",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-pressed": module === "cantar",
								className: cn("min-h-11 rounded-md text-sm font-medium", module === "cantar" ? "bg-accent text-accent-fg" : "text-muted"),
								onClick: () => setModule("cantar"),
								children: "Cantar"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-pressed": module === "fondo",
								className: cn("min-h-11 rounded-md text-sm font-medium", module === "fondo" ? "bg-accent text-accent-fg" : "text-muted"),
								onClick: () => setModule("fondo"),
								children: "Fondo"
							})]
						}),
						notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							role: "alert",
							className: "rounded-lg border border-line bg-surface px-3 py-2 text-sm text-danger",
							children: notice
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: cn("panel grid gap-4 border border-line bg-surface p-4", module !== "cantar" && "hidden lg:block"),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-2xl font-medium text-fg",
									children: "Cantar"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-muted",
									children: "La foto se mueve con tu audio. El video cantado usa la letra y este fondo."
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium text-fg",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImagePlus, {
												className: "size-4",
												"aria-hidden": true
											}),
											personUrl ? "Cambiar foto" : "Subir foto",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "file",
												accept: "image/jpeg,image/png,image/webp",
												className: "sr-only",
												onChange: (event) => {
													const file = event.target.files?.[0];
													event.target.value = "";
													if (file) onPhoto(file);
												}
											})
										]
									}), personUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										onClick: () => {
											replaceBlob(personUrl, null);
											patch({ personUrl: null });
											setVideoUrl(null);
										},
										children: "Quitar foto"
									}) : null]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "grid gap-2 text-sm text-muted",
									children: ["Canción", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										value: songTitle,
										maxLength: 80,
										placeholder: "Nombre, si quieres mostrarlo",
										onChange: (event) => patch({ songTitle: event.target.value }),
										className: "h-11 rounded-lg border border-line bg-bg px-3 text-fg"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
												className: "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium text-fg",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Music, {
														className: "size-4",
														"aria-hidden": true
													}),
													audioUrl ? "Cambiar audio" : "Subir audio",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "file",
														accept: "audio/*,.mp3,.m4a,.wav,.ogg",
														className: "sr-only",
														onChange: (event) => {
															const file = event.target.files?.[0];
															event.target.value = "";
															if (file) onAudio(file);
														}
													})
												]
											}), audioUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												variant: "ghost",
												onClick: clearAudio,
												children: "Quitar audio"
											}) : null]
										}),
										audioName ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "truncate text-sm text-muted",
											children: audioName
										}) : null,
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												onClick: () => void toggle(),
												disabled: !audioUrl,
												children: [playing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4" }), playing ? "Pausar" : "Reproducir"]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-sm text-muted tabular-nums",
												children: [
													formatTime(current),
													" / ",
													formatTime(duration)
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "range",
											min: 0,
											max: duration || 0,
											step: .1,
											value: Math.min(current, duration || 0),
											disabled: !audioUrl || !duration,
											"aria-label": "Posición de la canción",
											onChange: (event) => {
												const time = Number(event.target.value);
												if (audioRef.current) audioRef.current.currentTime = time;
												setCurrent(time);
											}
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "grid gap-2 text-sm text-muted",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "flex items-center justify-between",
										children: ["Letra", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "tabular-nums",
											children: [lyrics.length, "/180"]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
										value: lyrics,
										maxLength: 180,
										rows: 4,
										placeholder: "Una frase por línea.",
										onChange: (event) => patch({ lyrics: event.target.value }),
										className: "rounded-lg border border-line bg-bg px-3 py-2 text-fg"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-muted",
										children: "Letras de prueba"
									}), DEMO_LYRICS.map((sample) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "min-h-11 rounded-lg border border-line px-3 py-2 text-left text-sm text-fg",
										onClick: () => patch({ lyrics: sample }),
										children: sample.replace("\n", " / ")
									}, sample))]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid gap-2 border-t border-line pt-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-sm font-medium text-fg",
											children: "Video cantado"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm text-muted",
											children: "La foto canta la letra durante unos 6 segundos, con el fondo de ahora. Tu audio no entra en el video: suena solo en el escenario. Cada video usa créditos."
										}),
										ai && !ai.enabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm text-muted",
											children: "El video cantado no está disponible ahora. El escenario con tu audio sí funciona."
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											onClick: () => void createClip(),
											disabled: busy || ai?.enabled === false,
											children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "size-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clapperboard, { className: "size-4" }), job.state === "preparing" ? "Armando la escena" : job.state === "generating" ? "Generando el video" : "Crear video cantado"]
										}),
										ai?.enabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-sm text-muted",
											children: [
												"Puedes crear ",
												ai.remaining,
												" videos más en esta hora."
											]
										}) : null,
										job.state === "error" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											role: "alert",
											className: "text-sm text-danger",
											children: job.message
										}) : null,
										job.state === "generating" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm text-muted",
											"aria-live": "polite",
											children: "Puede tardar un minuto. No cierres la página."
										}) : null,
										videoUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "secondary",
											onClick: () => setVideoUrl(null),
											children: "Volver al escenario"
										}) : null
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-muted",
									children: "Usa fotos y canciones que tengas derecho a usar."
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: cn("panel grid gap-4 border border-line bg-surface p-4", module !== "fondo" && "hidden lg:block"),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-2xl font-medium text-fg",
									children: "Módulo de fondo"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-sm text-muted",
									children: "Cambia la escena, súbela o mueve la foto. También puedes arrastrarla en el escenario."
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "grid grid-cols-2 gap-2",
									children: BACKGROUNDS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										"aria-pressed": bgId === item.id,
										onClick: () => patch({ bgId: item.id }),
										className: cn("overflow-hidden rounded-lg border text-left", bgId === item.id ? "border-accent" : "border-line"),
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
												src: item.src,
												alt: "",
												className: "aspect-video w-full object-cover"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "block px-2 pt-2 text-sm text-fg",
												children: item.name
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "block px-2 pb-2 text-sm text-muted",
												children: item.note
											})
										]
									}, item.id))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium text-fg",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImagePlus, {
													className: "size-4",
													"aria-hidden": true
												}),
												"Subir fondo",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "file",
													accept: "image/jpeg,image/png,image/webp",
													className: "sr-only",
													onChange: (event) => {
														const file = event.target.files?.[0];
														event.target.value = "";
														if (file) onCustomBg(file);
													}
												})
											]
										}),
										customBgUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: bgId === "propio" ? "primary" : "secondary",
											onClick: () => patch({ bgId: "propio" }),
											children: "Mi fondo"
										}) : null,
										customBgUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											variant: "ghost",
											onClick: () => {
												replaceBlob(customBgUrl, null);
												patch({
													customBgUrl: null,
													bgId: bgId === "propio" ? "teatro" : bgId
												});
											},
											children: "Quitar"
										}) : null
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
									className: "grid gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
										className: "text-sm text-muted",
										children: "Encuadre"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
										value: aspect,
										columns: 2,
										options: [{
											id: "9:16",
											label: "Vertical"
										}, {
											id: "16:9",
											label: "Horizontal"
										}],
										onChange: (value) => patch({ aspect: value })
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
									className: "grid gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
											className: "text-sm text-muted",
											children: "Recorte de la foto"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Segmented, {
											value: mask,
											columns: 3,
											options: [
												{
													id: "rostro",
													label: "Rostro"
												},
												{
													id: "cuerpo",
													label: "Cuerpo"
												},
												{
													id: "completo",
													label: "Completa"
												}
											],
											onChange: (value) => patch({ mask: value })
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm text-muted",
											children: "Un PNG con fondo transparente se integra mejor."
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
									label: "Tamaño",
									min: .75,
									max: 1.3,
									step: .01,
									value: scale,
									display: `${Math.round(scale * 100)}%`,
									onChange: (value) => patch({ scale: value })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
									label: "Lado",
									min: -40,
									max: 40,
									step: 1,
									value: offsetX,
									display: String(Math.round(offsetX)),
									onChange: (value) => patch({ offsetX: value })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
									label: "Altura",
									min: -40,
									max: 40,
									step: 1,
									value: offsetY,
									display: String(Math.round(offsetY)),
									onChange: (value) => patch({ offsetY: value })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slider, {
									label: "Viñeta",
									min: 0,
									max: 100,
									step: 1,
									value: vignette,
									display: String(Math.round(vignette)),
									onChange: (value) => patch({ vignette: value })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									variant: "secondary",
									onClick: resetFraming,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, { className: "size-4" }), "Centrar"]
								})
							]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("audio", {
				ref: audioRef,
				src: audioUrl ?? void 0,
				preload: "metadata",
				className: "absolute h-0 w-0",
				onPlay: () => setPlaying(true),
				onPause: () => setPlaying(false),
				onEnded: () => setPlaying(false),
				onLoadedMetadata: (event) => setDuration(event.currentTarget.duration || 0),
				onTimeUpdate: (event) => setCurrent(event.currentTarget.currentTime || 0)
			})
		]
	});
}
function Segmented({ value, options, onChange, columns }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("grid gap-1 rounded-lg bg-bg p-1", columns === 2 ? "grid-cols-2" : "grid-cols-3"),
		children: options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-pressed": value === option.id,
			className: cn("min-h-11 rounded-md px-2 text-sm font-medium", value === option.id ? "bg-accent text-accent-fg" : "text-muted"),
			onClick: () => onChange(option.id),
			children: option.label
		}, option.id))
	});
}
function Slider({ label, min, max, step, value, display, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "grid gap-1 text-sm text-muted",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex items-center justify-between",
			children: [label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-fg tabular-nums",
				children: display
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "range",
			min,
			max,
			step,
			value,
			"aria-label": label,
			onChange: (event) => onChange(Number(event.target.value))
		})]
	});
}
var SplitComponent = Studio;
//#endregion
export { SplitComponent as component };
