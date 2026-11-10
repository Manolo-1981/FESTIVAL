import { useEffect, useRef, useState } from "react";
import { Clapperboard, Download, ImagePlus, Loader2, Music, Pause, Play, RotateCcw } from "lucide-react";
import { StageView } from "@/components/stage-view";
import { Button } from "@/components/ui/button";
import { BACKING_NAME, BACKINGS, backingBuffer, backingObjectUrl, isBackingUrl, type BackingId } from "@/lib/backing";
import { BACKGROUNDS, backgroundSrc, sceneKey } from "@/lib/backgrounds";
import { cn } from "@/lib/cn";
import { composeScene, loadImage } from "@/lib/compose";
import { cutoutPerson } from "@/lib/cutout";
import { DEMO_LYRICS, LYRIC_LIMIT, formatTime, lineAt, lyricLines } from "@/lib/lyrics";
import { downloadClip, pollSingingClip, singStatus, startSingingClip } from "@/lib/sing";
import { useStudio, type ClipSeconds } from "@/lib/studio-store";

type ModuleId = "cantar" | "fondo" | "personaje";
type Job =
  | { state: "idle" }
  | { state: "preparing" }
  | { state: "generating" }
  | { state: "ready" }
  | { state: "error"; message: string };

type Graph = {
  ctx: AudioContext;
  analyser: AnalyserNode;
  bins: Uint8Array;
  bed: AudioBufferSourceNode | null;
  bedGain: GainNode | null;
};

const ACTION_LIMIT = 400;

const AUDIO_EXT = /\.(mp3|m4a|wav|ogg|aac|flac|webm)$/i;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function takePhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Elige una imagen JPG, PNG o WEBP.");
  if (file.size > 8 * 1024 * 1024) throw new Error("La imagen supera 8 MB.");
  const url = URL.createObjectURL(file);
  try {
    await loadImage(url);
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return url;
}

function takeAudio(file: File) {
  const ok = file.type.startsWith("audio/") || AUDIO_EXT.test(file.name);
  if (!ok) throw new Error("Elige un audio MP3, M4A o WAV.");
  if (file.size > 20 * 1024 * 1024) throw new Error("El audio supera 20 MB.");
  return URL.createObjectURL(file);
}

function replaceBlob(previous: string | null, next: string | null) {
  if (
    previous &&
    previous !== next &&
    previous.startsWith("blob:") &&
    !isBackingUrl(previous)
  ) {
    URL.revokeObjectURL(previous);
  }
}

function base64ToBlob(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  const step = 0x8000;
  for (let index = 0; index < binary.length; index += step) {
    const end = Math.min(index + step, binary.length);
    for (let cursor = index; cursor < end; cursor++) bytes[cursor] = binary.charCodeAt(cursor);
  }
  return new Blob([bytes], { type: "video/mp4" });
}

export function Studio() {
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
  const action = useStudio((s) => s.action);
  const clipSeconds = useStudio((s) => s.clipSeconds);
  const backing = useStudio((s) => s.backing);
  const ownAudioUrl = useStudio((s) => s.ownAudioUrl);

  const audioRef = useRef<HTMLAudioElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const personRef = useRef<HTMLDivElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const aliveRef = useRef(true);
  const toggleRef = useRef<() => Promise<void>>(async () => {});

  const [module, setModule] = useState<ModuleId>("cantar");
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [job, setJob] = useState<Job>({ state: "idle" });
  const [ai, setAi] = useState<{ enabled: boolean; remaining: number } | null>(null);

  const lines = lyricLines(lyrics);
  const line = lines.length ? lines[lineAt(lines, current, duration)] : "";
  const busy = job.state === "preparing" || job.state === "generating";

  useEffect(() => {
    aliveRef.current = true;
    const rehydrated = useStudio.persist.rehydrate();
    void Promise.resolve(rehydrated).then(() => {
      const state = useStudio.getState();
      if (state.backing !== "none" && !state.audioUrl) {
        useStudio.getState().patch({ backing: "none" });
      }
    });
    void singStatus()
      .then((status) => {
        if (aliveRef.current) setAi(status);
      })
      .catch(() => {
        if (aliveRef.current) setAi({ enabled: false, remaining: 0 });
      });
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    setCurrent(0);
    setDuration(0);
    setPlaying(false);
    const graph = graphRef.current;
    graphRef.current = null;
    if (!graph) return;
    try {
      graph.bed?.stop();
      void graph.ctx.close();
    } catch {
      /* el audio anterior ya se cerró */
    }
  }, [audioUrl]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      const audio = audioRef.current;
      const graph = graphRef.current;
      let energy = 0;
      if (audio && !audio.paused) {
        energy = 0.35 + 0.4 * Math.abs(Math.sin(audio.currentTime * 7));
      }
      if (audio && graph && !audio.paused && useStudio.getState().backing !== "none" && useStudio.getState().ownAudioUrl) {
        graph.analyser.getByteFrequencyData(graph.bins as Uint8Array<ArrayBuffer>);
        let sum = 0;
        for (let i = 0; i < graph.bins.length; i++) sum += graph.bins[i];
        energy = Math.max(energy, sum / graph.bins.length / 255);
      }
      const meter = meterRef.current;
      if (meter) {
        const bars = meter.children;
        for (let i = 0; i < bars.length; i++) {
          const value = graph && energy > 0 ? graph.bins[Math.min(i, graph.bins.length - 1)] / 255 : 0.12;
          (bars[i] as HTMLElement).style.transform = `scaleY(${0.15 + value * 0.85})`;
        }
      }
      const person = personRef.current;
      if (person && !reduced) {
        person.style.transform = `translate3d(0, ${(-10 * energy).toFixed(2)}px, 0) scale(${(1 + energy * 0.04).toFixed(3)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (personRef.current) personRef.current.style.transform = "";
      const meter = meterRef.current;
      if (meter) {
        for (const bar of meter.children) (bar as HTMLElement).style.transform = "scaleY(0.15)";
      }
    };
  }, [playing]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      event.preventDefault();
      void toggleRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function ensureGraph() {
    if (graphRef.current) return graphRef.current;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.connect(ctx.destination);
    const bins = new Uint8Array(analyser.frequencyBinCount);
    graphRef.current = { ctx, analyser, bins, bed: null, bedGain: null };
    return graphRef.current;
  }

  const bedToken = useRef(0);

  function stopBed() {
    bedToken.current += 1;
    const graph = graphRef.current;
    if (!graph?.bed) return;
    try {
      graph.bed.stop();
    } catch {
      /* already stopped */
    }
    graph.bed.disconnect();
    graph.bedGain?.disconnect();
    graph.bed = null;
    graph.bedGain = null;
  }

  async function startBed() {
    const token = ++bedToken.current;
    const state = useStudio.getState();
    if (state.backing === "none" || !state.ownAudioUrl) return;
    const graph = ensureGraph();
    if (!graph) return;
    const buffer = await backingBuffer(state.backing);
    const audio = audioRef.current;
    if (token !== bedToken.current || !audio || audio.paused) return;
    if (graph.ctx.state !== "running") await graph.ctx.resume();
    if (graph.bed) {
      try {
        graph.bed.stop();
      } catch {
        /* already stopped */
      }
      graph.bed.disconnect();
      graph.bedGain?.disconnect();
    }
    const source = graph.ctx.createBufferSource();
    const gain = graph.ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = 0.42;
    source.connect(gain);
    gain.connect(graph.analyser);
    source.start();
    graph.bed = source;
    graph.bedGain = gain;
  }

  async function toggle() {
    const audio = audioRef.current;
    const url = useStudio.getState().audioUrl;
    if (!audio || !url) return;
    audio.volume = 1;
    audio.muted = false;
    try {
      if (audio.paused) {
        if ((audio.currentSrc || "") !== url) audio.src = url;
        await audio.play();
        await startBed();
      } else {
        stopBed();
        audio.pause();
      }
    } catch {
      setNotice("No se pudo reproducir. Sube el volumen del teléfono y pulsa Reproducir otra vez.");
    }
  }
  toggleRef.current = toggle;

  async function onPhoto(file: File) {
    try {
      const raw = await takePhoto(file);
      setNotice("");
      setStatus("Separando al personaje del fondo de la foto…");
      try {
        const cut = await cutoutPerson(raw);
        URL.revokeObjectURL(raw);
        replaceBlob(useStudio.getState().personUrl, cut);
        patch({ personUrl: cut, mask: "completo" });
        setStatus("");
      } catch (error) {
        replaceBlob(useStudio.getState().personUrl, raw);
        patch({ personUrl: raw, mask: "completo" });
        setStatus("");
        setNotice(error instanceof Error ? error.message : "No pude separar el fondo. La foto se muestra completa.");
      }
      setVideoUrl(null);
    } catch (error) {
      setStatus("");
      setNotice(error instanceof Error ? error.message : "No se pudo abrir la foto.");
    }
  }

  async function onCustomBg(file: File) {
    try {
      const url = await takePhoto(file);
      replaceBlob(useStudio.getState().customBgUrl, url);
      patch({ customBgUrl: url, bgId: "propio" });
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo abrir el fondo.");
    }
  }

  function onAudio(file: File) {
    try {
      const url = takeAudio(file);
      audioRef.current?.pause();
      stopBed();
      replaceBlob(useStudio.getState().ownAudioUrl, url);
      patch({
        ownAudioUrl: url,
        ownAudioName: file.name,
        audioUrl: url,
        audioName: file.name,
      });
      setNotice("");
      setStatus(`Audio registrado: ${file.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo abrir el audio.");
    }
  }

  async function clearAudio() {
    audioRef.current?.pause();
    stopBed();
    const state = useStudio.getState();
    replaceBlob(state.ownAudioUrl, null);
    if (state.backing !== "none") {
      const url = await backingObjectUrl(state.backing);
      patch({ ownAudioUrl: null, ownAudioName: "", audioUrl: url, audioName: BACKING_NAME[state.backing] });
      return;
    }
    patch({ ownAudioUrl: null, ownAudioName: "", audioUrl: null, audioName: "" });
  }

  async function chooseBacking(id: "none" | BackingId) {
    audioRef.current?.pause();
    stopBed();
    const state = useStudio.getState();
    if (id === "none") {
      patch({
        backing: "none",
        audioUrl: state.ownAudioUrl,
        audioName: state.ownAudioName,
      });
      return;
    }
    setNotice("");
    setStatus("Preparando el acompañamiento…");
    try {
      if (state.ownAudioUrl) {
        await backingBuffer(id);
        patch({ backing: id, audioUrl: state.ownAudioUrl, audioName: state.ownAudioName });
      } else {
        const url = await backingObjectUrl(id);
        patch({ backing: id, audioUrl: url, audioName: BACKING_NAME[id] });
      }
      setStatus("");
    } catch {
      setStatus("");
      setNotice("No se pudo preparar el acompañamiento.");
    }
  }

  async function createClip() {
    if (busy) return;
    const state = useStudio.getState();
    if (!state.personUrl) {
      setNotice("Primero sube una foto.");
      return;
    }
    if (state.lyrics.trim().length < 8 && state.action.trim().length < 8) {
      setNotice("Escribe la letra o qué debe hacer la persona en la escena.");
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
        vignette: state.vignette,
      });
      if (!aliveRef.current) return;
      setJob({ state: "generating" });
      const started = await startSingingClip({
        data: {
          imageDataUrl,
          lyrics: state.lyrics,
          scene: sceneKey(state.bgId),
          duration: state.clipSeconds,
          action: state.action,
          music: state.backing,
        },
      });
      if (!aliveRef.current) return;
      if (!started.ok) {
        setJob({ state: "error", message: started.error });
        return;
      }
      setAi((prev) => (prev ? { ...prev, remaining: started.remaining } : prev));
      for (let attempt = 0; attempt < 70; attempt++) {
        await sleep(4000);
        if (!aliveRef.current) return;
        const polled = await pollSingingClip({ data: { requestId: started.requestId } });
        if (!aliveRef.current) return;
        if (!polled.ok) {
          setJob({ state: "error", message: polled.error });
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
        message: "El video está tardando demasiado. Inténtalo otra vez en un momento.",
      });
    } catch (error) {
      if (!aliveRef.current) return;
      setJob({
        state: "error",
        message: error instanceof Error ? error.message : "No se pudo crear el video.",
      });
    }
  }

  async function saveVideo() {
    if (!videoUrl || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const result = await downloadClip({ data: { url: videoUrl } });
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      const href = URL.createObjectURL(base64ToBlob(result.base64));
      const link = document.createElement("a");
      link.href = href;
      link.download = "festival.mp4";
      link.click();
      URL.revokeObjectURL(href);
    } catch {
      setNotice("No se pudo guardar el video.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-6 pb-16 lg:px-8">
      <header className="mb-6 max-w-xl">
        <h1 className="font-display text-4xl leading-tight font-medium tracking-[0.18em] text-fg">FESTIVAL</h1>
        <p className="mt-2 text-base text-muted">Una foto, una canción y el fondo que elijas.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="stage-column min-w-0">
          <StageView
            stageRef={stageRef}
            personRef={personRef}
            videoUrl={videoUrl}
            playing={playing}
            onPhoto={(file) => void onPhoto(file)}
          />
          <div className="mx-auto mt-3 grid max-w-md justify-items-center gap-2">
            {audioUrl && playing ? (
              <div ref={meterRef} className="flex h-8 w-40 items-end justify-center gap-1" aria-hidden>
                {Array.from({ length: 12 }, (_, index) => (
                  <span
                    key={index}
                    className="h-full w-1 origin-bottom rounded-sm bg-accent"
                    style={{ transform: "scaleY(0.15)" }}
                  />
                ))}
              </div>
            ) : null}
            {songTitle ? <p className="max-w-full truncate text-sm font-medium text-fg">{songTitle}</p> : null}
            {line ? <p className="text-center text-sm text-muted">{line}</p> : null}
          </div>
        </div>

        <div className="grid min-w-0 gap-4">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface p-1 lg:hidden">
            <button
              type="button"
              aria-pressed={module === "cantar"}
              className={cn(
                "min-h-11 rounded-md text-sm font-medium",
                module === "cantar" ? "bg-accent text-accent-fg" : "text-muted",
              )}
              onClick={() => setModule("cantar")}
            >
              Cantar
            </button>
            <button
              type="button"
              aria-pressed={module === "fondo"}
              className={cn(
                "min-h-11 rounded-md text-sm font-medium",
                module === "fondo" ? "bg-accent text-accent-fg" : "text-muted",
              )}
              onClick={() => setModule("fondo")}
            >
              Fondo
            </button>
            <button
              type="button"
              aria-pressed={module === "personaje"}
              className={cn(
                "min-h-11 rounded-md text-sm font-medium",
                module === "personaje" ? "bg-accent text-accent-fg" : "text-muted",
              )}
              onClick={() => setModule("personaje")}
            >
              Personaje
            </button>
          </div>

          {status ? (
            <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted" aria-live="polite">
              {status}
            </p>
          ) : null}
          {notice ? (
            <p role="alert" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-danger">
              {notice}
            </p>
          ) : null}

          <section
            className={cn(
              "panel grid gap-4 border border-line bg-surface p-4",
              module !== "cantar" && "hidden lg:block",
            )}
          >
            <div>
              <h2 className="font-display text-2xl font-medium text-fg">Cantar</h2>
              <p className="mt-1 text-sm text-muted">
                La foto se mueve con tu audio. El video cantado usa la letra y este fondo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium text-fg">
                <ImagePlus className="size-4" aria-hidden />
                {personUrl ? "Cambiar foto" : "Subir foto"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void onPhoto(file);
                  }}
                />
              </label>
              {personUrl ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    replaceBlob(personUrl, null);
                    patch({ personUrl: null });
                    setVideoUrl(null);
                  }}
                >
                  Quitar foto
                </Button>
              ) : null}
            </div>

            <label className="grid gap-2 text-sm text-muted">
              Canción
              <input
                value={songTitle}
                maxLength={80}
                placeholder="Nombre, si quieres mostrarlo"
                onChange={(event) => patch({ songTitle: event.target.value })}
                className="h-11 rounded-lg border border-line bg-bg px-3 text-fg"
              />
            </label>

            <div className="grid gap-2">
              <p className="text-sm text-muted">Acompañamiento</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={backing === "none"}
                  className={cn(
                    "min-h-11 rounded-lg border px-3 text-sm font-medium",
                    backing === "none" ? "border-accent bg-accent text-accent-fg" : "border-line text-fg",
                  )}
                  onClick={() => void chooseBacking("none")}
                >
                  Ninguno
                </button>
                {BACKINGS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={backing === item.id}
                    className={cn(
                      "min-h-11 rounded-lg border px-3 text-sm font-medium",
                      backing === item.id ? "border-accent bg-accent text-accent-fg" : "border-line text-fg",
                    )}
                    onClick={() => void chooseBacking(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted">
                {ownAudioUrl
                  ? "Tu audio quedó registrado. Reproducir lo hace sonar. El video no inserta ese archivo: canta la letra y usa el estilo que marques."
                  : "Si eliges Bolero, Suave, Balada o Compás, pulsa Reproducir. Ahí se oye la pista. El video usa ese mismo estilo, no un archivo."}
              </p>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium text-fg">
                  <Music className="size-4" aria-hidden />
                  {ownAudioUrl ? "Cambiar audio" : "Subir audio"}
                  <input
                    type="file"
                    accept="audio/*,.mp3,.m4a,.wav,.ogg"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) onAudio(file);
                    }}
                  />
                </label>
                {ownAudioUrl ? (
                  <Button variant="ghost" onClick={() => void clearAudio()}>
                    Quitar audio
                  </Button>
                ) : null}
              </div>
              {audioName ? (
                <p className="truncate text-sm text-fg">
                  {duration > 0 ? `Registrado: ${audioName} · ${formatTime(duration)}` : `Registrado: ${audioName}`}
                </p>
              ) : (
                <p className="text-sm text-muted">Todavía no hay audio registrado.</p>
              )}
              <div className="flex items-center gap-3">
                <Button onClick={() => void toggle()} disabled={!audioUrl}>
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {playing ? "Pausar" : "Reproducir"}
                </Button>
                <span className="text-sm text-muted tabular-nums">
                  {formatTime(current)} / {formatTime(duration)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(current, duration || 0)}
                disabled={!audioUrl || !duration}
                aria-label="Posición de la canción"
                onChange={(event) => {
                  const time = Number(event.target.value);
                  if (audioRef.current) audioRef.current.currentTime = time;
                  setCurrent(time);
                }}
              />
            </div>

            <label className="grid gap-2 text-sm text-muted">
              <span className="flex items-center justify-between">
                Letra
                <span className="tabular-nums">
                  {lyrics.length}/{LYRIC_LIMIT}
                </span>
              </span>
              <textarea
                value={lyrics}
                maxLength={LYRIC_LIMIT}
                rows={6}
                placeholder="Una frase por línea. Cabe una estrofa más larga."
                onChange={(event) => patch({ lyrics: event.target.value })}
                className="rounded-lg border border-line bg-bg px-3 py-2 text-fg"
              />
            </label>
            <div className="grid gap-2">
              <p className="text-sm text-muted">Letras de prueba</p>
              {DEMO_LYRICS.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  className="min-h-11 rounded-lg border border-line px-3 py-2 text-left text-sm text-fg"
                  onClick={() => patch({ lyrics: sample })}
                >
                  {sample.replaceAll("\n", " / ")}
                </button>
              ))}
            </div>

            <div className="grid gap-2 border-t border-line pt-4">
              <h3 className="text-sm font-medium text-fg">Video cantado</h3>
              <p className="text-sm text-muted">
                La foto canta la letra en el video. Tu audio no se inserta en ese archivo: queda registrado y suena con Reproducir. La voz del clip se oye al subir su volumen. 10 y 15 segundos usan más créditos.
              </p>
              {ai && !ai.enabled ? (
                <p className="text-sm text-muted">
                  El video cantado no está disponible ahora. El escenario con tu audio sí funciona.
                </p>
              ) : (
                <Button onClick={() => void createClip()} disabled={busy || ai?.enabled === false}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
                  {job.state === "preparing"
                    ? "Armando la escena"
                    : job.state === "generating"
                      ? "Generando el video"
                      : "Crear video cantado"}
                </Button>
              )}
              {ai?.enabled ? (
                <p className="text-sm text-muted">Quedan {ai.remaining} créditos de video en esta hora.</p>
              ) : null}
              {job.state === "error" ? (
                <p role="alert" className="text-sm text-danger">
                  {job.message}
                </p>
              ) : null}
              {job.state === "generating" ? (
                <p className="text-sm text-muted" aria-live="polite">
                  {clipSeconds === 6
                    ? "Puede tardar un minuto. No cierres la página."
                    : "Un video más largo puede tardar unos minutos. No cierres la página."}
                </p>
              ) : null}
              {videoUrl ? (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void saveVideo()} disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    {saving ? "Guardando" : "Guardar video"}
                  </Button>
                  <Button variant="secondary" onClick={() => setVideoUrl(null)}>
                    Volver al escenario
                  </Button>
                </div>
              ) : null}
            </div>
            <p className="text-sm text-muted">Usa fotos y canciones que tengas derecho a usar.</p>
          </section>

          <section
            className={cn(
              "panel grid gap-4 border border-line bg-surface p-4",
              module !== "fondo" && "hidden lg:block",
            )}
          >
            <div>
              <h2 className="font-display text-2xl font-medium text-fg">Fondo</h2>
              <p className="mt-1 text-sm text-muted">
                Cambia la escena, súbela o mueve la foto. También puedes arrastrarla en el escenario.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {BACKGROUNDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={bgId === item.id}
                  onClick={() => patch({ bgId: item.id })}
                  className={cn(
                    "overflow-hidden rounded-lg border text-left",
                    bgId === item.id ? "border-accent" : "border-line",
                  )}
                >
                  <img src={item.src} alt="" className="aspect-video w-full object-cover" />
                  <span className="block px-2 pt-2 text-sm text-fg">{item.name}</span>
                  <span className="block px-2 pb-2 text-sm text-muted">{item.note}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium text-fg">
                <ImagePlus className="size-4" aria-hidden />
                Subir fondo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void onCustomBg(file);
                  }}
                />
              </label>
              {customBgUrl ? (
                <Button
                  variant={bgId === "propio" ? "primary" : "secondary"}
                  onClick={() => patch({ bgId: "propio" })}
                >
                  Mi fondo
                </Button>
              ) : null}
              {customBgUrl ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    replaceBlob(customBgUrl, null);
                    patch({ customBgUrl: null, bgId: bgId === "propio" ? "teatro" : bgId });
                  }}
                >
                  Quitar
                </Button>
              ) : null}
            </div>

            <fieldset className="grid gap-2">
              <legend className="text-sm text-muted">Encuadre</legend>
              <Segmented
                value={aspect}
                columns={2}
                options={[
                  { id: "9:16", label: "Vertical" },
                  { id: "16:9", label: "Horizontal" },
                ]}
                onChange={(value) => patch({ aspect: value })}
              />
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="text-sm text-muted">Recorte de la foto</legend>
              <Segmented
                value={mask}
                columns={3}
                options={[
                  { id: "rostro", label: "Rostro" },
                  { id: "cuerpo", label: "Cuerpo" },
                  { id: "completo", label: "Completa" },
                ]}
                onChange={(value) => patch({ mask: value })}
              />
              <p className="text-sm text-muted">
                Se quita el fondo de la foto. El personaje queda sobre el fondo elegido.
              </p>
            </fieldset>

            <Slider label="Tamaño" min={0.75} max={1.3} step={0.01} value={scale} display={`${Math.round(scale * 100)}%`} onChange={(value) => patch({ scale: value })} />
            <Slider label="Lado" min={-40} max={40} step={1} value={offsetX} display={String(Math.round(offsetX))} onChange={(value) => patch({ offsetX: value })} />
            <Slider label="Altura" min={-40} max={40} step={1} value={offsetY} display={String(Math.round(offsetY))} onChange={(value) => patch({ offsetY: value })} />
            <Slider label="Viñeta" min={0} max={100} step={1} value={vignette} display={String(Math.round(vignette))} onChange={(value) => patch({ vignette: value })} />

            <Button variant="secondary" onClick={resetFraming}>
              <RotateCcw className="size-4" />
              Centrar
            </Button>
          </section>

          <section
            className={cn(
              "panel grid gap-4 border border-line bg-surface p-4",
              module !== "personaje" && "hidden lg:block",
            )}
          >
            <div>
              <h2 className="font-display text-2xl font-medium text-fg">Personaje</h2>
              <p className="mt-1 text-sm text-muted">
                Qué hace en la escena. La letra se canta en español, sin traducirla.
              </p>
            </div>

            <label className="grid gap-2 text-sm text-muted">
              <span className="flex items-center justify-between">
                El personaje
                <span className="tabular-nums">
                  {action.length}/{ACTION_LIMIT}
                </span>
              </span>
              <textarea
                value={action}
                maxLength={ACTION_LIMIT}
                rows={4}
                placeholder="Saluda, da un paso, gira, levanta la mano y canta hacia la cámara."
                onChange={(event) => patch({ action: event.target.value })}
                className="rounded-lg border border-line bg-bg px-3 py-2 text-fg"
              />
            </label>

            <fieldset className="grid gap-2">
              <legend className="text-sm text-muted">Duración</legend>
              <Segmented
                value={String(clipSeconds) as "6" | "10" | "15"}
                columns={3}
                options={[
                  { id: "6", label: "6 s" },
                  { id: "10", label: "10 s" },
                  { id: "15", label: "15 s" },
                ]}
                onChange={(value) => patch({ clipSeconds: Number(value) as ClipSeconds })}
              />
              <p className="text-sm text-muted">6 segundos usa 1 crédito. 10 y 15 segundos usan 2.</p>
            </fieldset>
          </section>
        </div>
      </div>

      <audio
        key={audioUrl ?? "sin-audio"}
        ref={audioRef}
        src={audioUrl ?? undefined}
        preload="auto"
        playsInline
        loop={backing !== "none" && !ownAudioUrl}
        className="pointer-events-none fixed top-0 left-0 h-8 w-8 opacity-0"
        onPlay={() => setPlaying(true)}
        onPause={() => {
          stopBed();
          setPlaying(false);
        }}
        onEnded={() => {
          stopBed();
          setPlaying(false);
        }}
        onError={(event) => {
          if (event.currentTarget.error?.code === 1) return;
          setNotice("No se pudo leer ese audio. Usa MP3, M4A o WAV.");
        }}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime || 0)}
      />
    </main>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  columns,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
  columns: 2 | 3;
}) {
  return (
    <div className={cn("grid gap-1 rounded-lg bg-bg p-1", columns === 2 ? "grid-cols-2" : "grid-cols-3")}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          className={cn(
            "min-h-11 rounded-md px-2 text-sm font-medium",
            value === option.id ? "bg-accent text-accent-fg" : "text-muted",
          )}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-sm text-muted">
      <span className="flex items-center justify-between">
        {label}
        <span className="text-fg tabular-nums">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
