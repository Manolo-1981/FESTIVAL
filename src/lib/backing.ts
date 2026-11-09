export type BackingId = "suave" | "balada" | "compas";

export const BACKINGS: { id: BackingId; label: string }[] = [
  { id: "suave", label: "Suave" },
  { id: "balada", label: "Balada" },
  { id: "compas", label: "Compás" },
];

export const BACKING_NAME: Record<BackingId, string> = {
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
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.06);
  gain.gain.setValueAtTime(gainValue, Math.max(start + 0.08, end - 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

function pulse(ctx: OfflineAudioContext, start: number, freq: number, gainValue: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(46, start + 0.12);
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + 0.2);
}

async function render(id: BackingId) {
  const seconds = 24;
  const rate = 22050;
  const ctx = new OfflineAudioContext(2, rate * seconds, rate);
  const setup =
    id === "balada"
      ? { bar: 4, bars: 6, chords: [0, 5, 3, 7], minor: true, type: "sine" as const, level: 0.045 }
      : id === "compas"
        ? { bar: 2.4, bars: 10, chords: [0, 7, 5, 3], minor: false, type: "triangle" as const, level: 0.04 }
        : { bar: 3, bars: 8, chords: [0, 5, 7, 3], minor: false, type: "sine" as const, level: 0.04 };
  const root = 48;
  for (let index = 0; index < setup.bars; index++) {
    const step = setup.chords[index % setup.chords.length];
    const start = index * setup.bar;
    const third = setup.minor ? 3 : 4;
    const notes = [root + step, root + step + third, root + step + 7, root + step + 12];
    notes.forEach((note, noteIndex) => {
      tone(ctx, note, start, start + setup.bar * 0.96, noteIndex === 0 ? setup.level * 1.3 : setup.level, setup.type);
    });
    tone(ctx, root + step - 12, start, start + setup.bar * 0.96, 0.07, "sine");
  }
  if (id !== "balada") {
    const beat = setup.bar / 4;
    for (let start = 0; start < seconds - 0.05; start += id === "compas" ? beat : beat * 2) {
      pulse(ctx, start, id === "compas" ? 128 : 110, id === "compas" ? 0.2 : 0.14);
    }
  }
  return ctx.startRendering();
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
