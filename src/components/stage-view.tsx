import type { PointerEvent, RefObject } from "react";
import { ImagePlus } from "lucide-react";
import { backgroundSrc } from "@/lib/backgrounds";
import { clamp, personLayout } from "@/lib/frame";
import { cn } from "@/lib/cn";
import { useStudio } from "@/lib/studio-store";

type StageViewProps = {
  stageRef: RefObject<HTMLDivElement | null>;
  personRef: RefObject<HTMLDivElement | null>;
  videoUrl: string | null;
  playing: boolean;
  onPhoto: (file: File) => void;
};

export function StageView({ stageRef, personRef, videoUrl, playing, onPhoto }: StageViewProps) {
  const bgId = useStudio((s) => s.bgId);
  const customBgUrl = useStudio((s) => s.customBgUrl);
  const personUrl = useStudio((s) => s.personUrl);
  const aspect = useStudio((s) => s.aspect);
  const scale = useStudio((s) => s.scale);
  const offsetX = useStudio((s) => s.offsetX);
  const offsetY = useStudio((s) => s.offsetY);
  const mask = useStudio((s) => s.mask);
  const vignette = useStudio((s) => s.vignette);
  const layout = personLayout({ aspect, scale, offsetX, offsetY, mask });
  const src = backgroundSrc(bgId, customBgUrl);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!personUrl || videoUrl) return;
    const stage = stageRef.current;
    if (!stage) return;
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    const originX = useStudio.getState().offsetX;
    const originY = useStudio.getState().offsetY;
    const startX = event.clientX;
    const startY = event.clientY;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    const move = (ev: globalThis.PointerEvent) => {
      const dx = ((ev.clientX - startX) / rect.width) * 100;
      const dy = ((ev.clientY - startY) / rect.height) * 100;
      useStudio.getState().patch({
        offsetX: clamp(originX + dx, -40, 40),
        offsetY: clamp(originY + dy, -40, 40),
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className="flex justify-center">
      <div
        ref={stageRef}
        className={cn(
          "relative overflow-hidden bg-surface",
          aspect === "9:16" ? "stage-portrait" : "stage-landscape",
        )}
      >
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
        {personUrl && !videoUrl ? (
          <div
            ref={personRef}
            className={cn(
              "person-shadow absolute overflow-hidden touch-none",
              !playing && "escena-idle",
            )}
            style={{
              left: `${layout.left}%`,
              top: `${layout.top}%`,
              width: `${layout.width}%`,
              height: `${layout.height}%`,
              borderRadius: layout.radius,
            }}
            onPointerDown={onPointerDown}
          >
            <img
              src={personUrl}
              alt="Foto de la persona en escena"
              draggable={false}
              className={cn("h-full w-full", layout.fit === "cover" ? "object-cover" : "object-contain")}
            />
          </div>
        ) : null}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center, transparent 42%, rgb(0 0 0 / ${Math.min(0.72, vignette / 140)}) 100%)`,
          }}
        />
        {videoUrl ? (
          <video
            key={videoUrl}
            src={videoUrl}
            className="absolute inset-0 h-full w-full bg-bg object-contain"
            controls
            autoPlay
            playsInline
          />
        ) : null}
        {!personUrl && !videoUrl ? (
          <label className="absolute inset-x-4 bottom-4 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg">
            <ImagePlus className="size-4" aria-hidden />
            Subir foto
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onPhoto(file);
              }}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
