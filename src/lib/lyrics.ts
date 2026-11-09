export const DEMO_LYRICS = [
  "Canto bajito esta noche\npara que me escuche el silencio.",
  "Si el fondo cambia, yo me quedo\ncon la misma voz de siempre.",
  "Una luz, una foto\ny el compás que traigo yo.",
];

export function lyricLines(text: string): string[] {
  const raw = text.trim();
  if (!raw) return [];
  const byLine = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (byLine.length > 1) return byLine;
  if (raw.includes("/")) {
    return raw
      .split("/")
      .map((line) => line.trim())
      .filter(Boolean);
  }
  const sentences = raw
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return sentences.length ? sentences : [raw];
}

export function lineAt(lines: string[], current: number, duration: number): number {
  if (!lines.length || !Number.isFinite(duration) || duration <= 0) return 0;
  const index = Math.floor((current / duration) * lines.length);
  return Math.min(lines.length - 1, Math.max(0, index));
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
