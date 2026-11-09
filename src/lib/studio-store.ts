import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Aspect, Mask } from "@/lib/frame";

export type StudioFields = {
  bgId: string;
  customBgUrl: string | null;
  scale: number;
  offsetX: number;
  offsetY: number;
  vignette: number;
  mask: Mask;
  aspect: Aspect;
  songTitle: string;
  lyrics: string;
  personUrl: string | null;
  audioUrl: string | null;
  audioName: string;
};

type StudioStore = StudioFields & {
  patch: (partial: Partial<StudioFields>) => void;
  resetFraming: () => void;
};

const framing = { scale: 1, offsetX: 0, offsetY: 0, vignette: 42, mask: "rostro" as Mask };

const initial: StudioFields = {
  bgId: "teatro",
  customBgUrl: null,
  ...framing,
  aspect: "9:16",
  songTitle: "",
  lyrics: "",
  personUrl: null,
  audioUrl: null,
  audioName: "",
};

export const useStudio = create<StudioStore>()(
  persist(
    (set) => ({
      ...initial,
      patch: (partial) => set(partial),
      resetFraming: () => set(framing),
    }),
    {
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
        lyrics: state.lyrics,
      }),
    },
  ),
);
