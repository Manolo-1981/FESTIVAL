import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BackingId } from "@/lib/backing";
import type { Aspect, Mask } from "@/lib/frame";

export type ClipSeconds = 6 | 10 | 15;

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
  action: string;
  clipSeconds: ClipSeconds;
  backing: "none" | BackingId;
  personUrl: string | null;
  audioUrl: string | null;
  audioName: string;
  ownAudioUrl: string | null;
  ownAudioName: string;
};

type StudioStore = StudioFields & {
  patch: (partial: Partial<StudioFields>) => void;
  resetFraming: () => void;
};

const framing = { scale: 1, offsetX: 0, offsetY: 0, vignette: 42, mask: "completo" as Mask };

const initial: StudioFields = {
  bgId: "teatro",
  customBgUrl: null,
  ...framing,
  aspect: "9:16",
  songTitle: "",
  lyrics: "",
  action: "",
  clipSeconds: 6,
  backing: "none",
  personUrl: null,
  audioUrl: null,
  audioName: "",
  ownAudioUrl: null,
  ownAudioName: "",
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
        action: state.action,
        clipSeconds: state.clipSeconds,
        backing: state.backing,
      }),
    },
  ),
);
