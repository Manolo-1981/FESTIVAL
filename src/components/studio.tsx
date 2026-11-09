import { useEffect, useRef, useState } from "react";
import { Clapperboard, ImagePlus, Loader2, Music, Pause, Play, RotateCcw } from "lucide-react";
import { StageView } from "@/components/stage-view";
import { Button } from "@/components/ui/button";
import { BACKGROUNDS, backgroundSrc, sceneKey } from "@/lib/backgrounds";
import { cn } from "@/lib/cn";
import { composeScene, loadImage } from "@/lib/compose";
import { DEMO_LYRICS, formatTime, lineAt, lyricLines } from "@/lib/lyrics";
import { pollSingingClip, singStatus, startSingingClip } from "@/lib/sing";
import { useStudio } from "@/lib/studio-store";

type ModuleId = "cantar" | "fondo";
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
};

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
  if (previous && previous !== next && previous.startsWith("blob:")) URL.revokeObjectURL(previous);
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
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [job, setJob] = useState<Job>({ state: "idle" });
  const [ai, setAi] = useState<{ enabled: boolean; remaining: number } | null>(null);

  const lines = lyricLines(lyrics);
  const line = lines.length ? lines[lineAt(lines, current, duration)] : "";
  const busy = job.state === "preparing" || job.state === "generating";

  useEffect(() => {
    aliveRef.current = true;
    void useStudio.persist.rehydrate();
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
  }, [audioUrl]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      const audio = audioRef.current;
      const graph = graphRef.current;
      let energy = 0;
      if (audio && graph && !audio.paused) {
        graph.analyser.getByteFrequencyData(graph.bins as Uint8Array<ArrayBuffer>);
        let sum = 0;
        for (let i = 0; i < graph.bins.length; i++) sum += graph.bins[i];
        energy = sum / graph.bins.length / 255;
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
    const audio = audioRef.current;
    if (!audio) return null;
    if (graphRef.current) return graphRef.current;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    const bins = new Uint8Array(analyser.frequencyBinCount);
    graphRef.current = { ctx, analyser, bins };
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

  async function onPhoto(file: File) {
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
      const audio = audioRef.current;
      audio?.pause();
      replaceBlob(useStudio.getState().audioUrl, url);
      patch({ audioUrl: url, audioName: file.name });
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo abrir el audio.");
    }
  }

  function clearAudio() {
    audioRef.current?.pause();
    replaceBlob(useStudio.getState().audioUrl, null);
    patch({ audioUrl: null, audioName: "" });
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
        vignette: state.vignette,
      });
      if (!aliveRef.current) return;
      setJob({ state: "generating" });
      const started = await startSingingClip({
        data: { imageDataUrl, lyrics: state.lyrics, scene: sceneKey(state.bgId) },
      });
      if (!aliveRef.current) return;
      if (!started.ok) {
        setJob({ state: "error", message: started.error });
        return;
      }
      setAi((prev) => (prev ? { ...prev, remaining: started.remaining } : prev));
      for (let attempt = 0; attempt < 40; attempt++) {
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

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-6 pb-16 lg:px-8">
      <header className="mb-6 max-w-xl">
        <h1 className="font-display text-4xl leading-tight font-medium tracking-tight text-fg">Escena</h1>
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
            {audioUrl ? (
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
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1 lg:hidden">
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
          </div>

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
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium text-fg">
                  <Music className="size-4" aria-hidden />
                  {audioUrl ? "Cambiar audio" : "Subir audio"}
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
                {audioUrl ? (
                  <Button variant="ghost" onClick={clearAudio}>
                    Quitar audio
                  </Button>
                ) : null}
              </div>
              {audioName ? <p className="truncate text-sm text-muted">{audioName}</p> : null}
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
                <span className="tabular-nums">{lyrics.length}/180</span>
              </span>
              <textarea
                value={lyrics}
                maxLength={180}
                rows={4}
                placeholder="Una frase por línea."
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
                  {sample.replace("\n", " / ")}
                </button>
              ))}
            </div>

            <div className="grid gap-2 border-t border-line pt-4">
              <h3 className="text-sm font-medium text-fg">Video cantado</h3>
              <p className="text-sm text-muted">
                La foto canta la letra durante unos 6 segundos, con el fondo de ahora. Tu audio no entra en
                el video: suena solo en el escenario. Cada video usa créditos.
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
                <p className="text-sm text-muted">Puedes crear {ai.remaining} videos más en esta hora.</p>
              ) : null}
              {job.state === "error" ? (
                <p role="alert" className="text-sm text-danger">
                  {job.message}
                </p>
              ) : null}
              {job.state === "generating" ? (
                <p className="text-sm text-muted" aria-live="polite">
                  Puede tardar un minuto. No cierres la página.
                </p>
              ) : null}
              {videoUrl ? (
                <Button variant="secondary" onClick={() => setVideoUrl(null)}>
                  Volver al escenario
                </Button>
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
              <h2 className="font-display text-2xl font-medium text-fg">Módulo de fondo</h2>
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
              <p className="text-sm text-muted">Un PNG con fondo transparente se integra mejor.</p>
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
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        preload="metadata"
        className="absolute h-0 w-0"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
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
