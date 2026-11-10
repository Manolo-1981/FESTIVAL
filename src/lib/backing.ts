export type BackingId = "bolero" | "suave" | "balada" | "compas";

export const BACKINGS: { id: BackingId; label: string }[] = [
  { id: "bolero", label: "Bolero" },
  { id: "suave", label: "Suave" },
  { id: "balada", label: "Balada" },
  { id: "compas", label: "Compás" },
];

export const BACKING_NAME: Record<BackingId, string> = {
  bolero: "Bolero",
  suave: "Acompañamiento suave",
  balada: "Balada",
  compas: "Compás",
};

const buffers = new Map<BackingId, AudioBuffer>();
const urls = new Map<BackingId, string>();

export function isBackingUrl(url: string) {
  for (const value of urls.values()) {
    if (value === url) return true;
  }
  return false;
}

function midi(note: number) {
  return 440 * 2 ** ((note - 69) / 12);
}

function tone(
  ctx: OfflineAudioContext,
  note: number,
  start: number,
  end: number,
  gainValue: number,
  type: OscillatorType,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = midi(note);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.05);
  gain.gain.setValueAtTime(gainValue * 0.7, Math.max(start + 0.08, end - 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

function hit(ctx: OfflineAudioContext, start: number, freq: number, gainValue: number, decay: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = freq > 180 ? "triangle" : "sine";
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.45), start + decay);
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + decay + 0.02);
}

function normalize(buffer: AudioBuffer) {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index++) peak = Math.max(peak, Math.abs(data[index]));
  }
  if (peak < 0.001) return buffer;
  const gain = 0.78 / peak;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index++) data[index] *= gain;
  }
  return buffer;
}

async function render(id: BackingId) {
  const seconds = 12;
  const rate = 22050;
  const ctx = new OfflineAudioContext(1, rate * seconds, rate);
  const minor = id === "bolero" || id === "balada";
  const bar = id === "compas" ? 1.6 : id === "suave" ? 2 : 3;
  const chords = id === "compas" ? [0, 7, 5, 3] : [0, 5, 3, 7];
  const root = id === "bolero" ? 50 : 48;
  const bars = Math.floor(seconds / bar);

  for (let index = 0; index < bars; index++) {
    const step = chords[index % chords.length];
    const start = index * bar;
    const third = minor ? 3 : 4;
    tone(ctx, root + step, start, start + bar, 0.16, "sine");
    tone(ctx, root + step + third, start, start + bar, 0.08, id === "compas" ? "triangle" : "sine");
    tone(ctx, root + step + 7, start, start + bar, 0.07, "sine");
    if (id !== "balada") {
      const beat = bar / 4;
      hit(ctx, start, 90, id === "bolero" ? 0.45 : 0.32, 0.18);
      hit(ctx, start + beat * 2, 120, 0.22, 0.14);
      if (id === "bolero" || id === "compas") hit(ctx, start + beat * 1.5, 240, 0.16, 0.08);
    }
  }

  return normalize(await ctx.startRendering());
}

function wavBlob(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const length = buffer.length;
  const block = channels * 2;
  const dataSize = length * block;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * block, true);
  view.setUint16(32, block, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);
  const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, data[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: "audio/wav" });
}

export async function backingBuffer(id: BackingId) {
  const cached = buffers.get(id);
  if (cached) return cached;
  const buffer = await render(id);
  buffers.set(id, buffer);
  return buffer;
}

export async function backingObjectUrl(id: BackingId) {
  const cached = urls.get(id);
  if (cached) return cached;
  const url = URL.createObjectURL(wavBlob(await backingBuffer(id)));
  urls.set(id, url);
  return url;
}
