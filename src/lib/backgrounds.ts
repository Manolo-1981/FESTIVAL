export type BackgroundId = "teatro" | "estudio" | "calle" | "sala" | "costa" | "propio";

export type StageBackground = {
  id: Exclude<BackgroundId, "propio">;
  name: string;
  note: string;
  src: string;
};

export const BACKGROUNDS: StageBackground[] = [
  { id: "teatro", name: "Teatro", note: "Un foco y el telón", src: "/backgrounds/teatro.jpg" },
  { id: "estudio", name: "Estudio", note: "Cabina de voz", src: "/backgrounds/estudio.jpg" },
  { id: "calle", name: "Calle", note: "Noche después de la lluvia", src: "/backgrounds/calle.jpg" },
  { id: "sala", name: "Sala", note: "Desde el escenario", src: "/backgrounds/sala.jpg" },
  { id: "costa", name: "Costa", note: "Terraza al atardecer", src: "/backgrounds/costa.jpg" },
];

export function backgroundSrc(id: string, customUrl: string | null): string {
  if (id === "propio" && customUrl) return customUrl;
  return BACKGROUNDS.find((item) => item.id === id)?.src ?? BACKGROUNDS[0].src;
}

export function sceneKey(id: string): BackgroundId {
  if (id === "propio") return "propio";
  return BACKGROUNDS.some((item) => item.id === id) ? (id as BackgroundId) : "teatro";
}
