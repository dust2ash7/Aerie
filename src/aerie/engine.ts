import {
  fadeAt,
  floorSnap,
  dynamicsAt,
  knobsAt,
  snap,
  songBeats,
  songEnd,
  uid,
  type Clip,
  type KnobPoint,
  type Note,
  type Project,
  type ReverbSize,
  type SceneCell,
  type ToneName,
  type Track,
  type TrackKind,
} from "@/aerie/model";
import { ensureBuffer, getBuffer } from "@/aerie/buffers";
import { encodeWav } from "@/aerie/wav";
import { makeImpulse, playNote, woodClick, type Knobs, type Voice } from "@/aerie/sound";

export type Transport = "stopped" | "playing" | "recording" | "countin";

type Hooks = {
  getProject: () => Project;
  getArmed: () => string | null;
  getSelectedClipId: () => string | null;
  onTransport: (t: Transport) => void;
  onBeforeTake: () => void;
  onTake: (clip: Clip) => void;
  getScenes: () => { mode: "timeline" | "scenes"; launched: (SceneCell | null)[] };
  onBar: (bar: number) => void;
};

type TrackNodes = {
  gain: GainNode;
  auto: GainNode;
  pan: StereoPannerNode;
  low: BiquadFilterNode;
  high: BiquadFilterNode;
  sends: Record<Exclude<ReverbSize, "off"> | "delay", GainNode>;
};

type Mix = {
  master: GainNode;
  toneLow: BiquadFilterNode;
  toneHigh: BiquadFilterNode;
  toneComp: DynamicsCompressorNode;
  limiter: DynamicsCompressorNode;
  preview: GainNode;
  metro: GainNode;
  delay: DelayNode;
  inputs: Map<string, GainNode>;
  nodes: Map<string, TrackNodes>;
};

const REV: Record<Exclude<ReverbSize, "off">, number> = { small: 0.14, shelf: 0.18, room: 0.26, trail: 0.22, hall: 0.34 };

function setAt(param: AudioParam, value: number, when: number) {
  const t = Math.max(0, when);
  try {
    param.cancelScheduledValues(t);
    param.setValueAtTime(value, t);
  } catch {
    try {
      param.setValueAtTime(value, t + 0.001);
    } catch {
      /* closed */
    }
  }
}

function applyTone(mix: Mix, tone: ToneName, when: number) {
  const low = mix.toneLow;
  const high = mix.toneHigh;
  const comp = mix.toneComp;
  low.type = "lowshelf";
  high.type = "highshelf";
  low.frequency.setValueAtTime(180, when);
  high.frequency.setValueAtTime(3200, when);
  if (tone === "warm") {
    setAt(low.gain, 3.5, when);
    setAt(high.gain, -1.5, when);
    comp.threshold.setValueAtTime(-14, when);
    comp.ratio.setValueAtTime(2, when);
  } else if (tone === "present") {
    setAt(low.gain, -1, when);
    setAt(high.gain, 3.2, when);
    comp.threshold.setValueAtTime(-16, when);
    comp.ratio.setValueAtTime(3, when);
  } else if (tone === "quiet") {
    setAt(low.gain, 1.2, when);
    setAt(high.gain, -1.2, when);
    comp.threshold.setValueAtTime(-18, when);
    comp.ratio.setValueAtTime(2.2, when);
  } else {
    setAt(low.gain, 0, when);
    setAt(high.gain, 0, when);
    comp.threshold.setValueAtTime(0, when);
    comp.ratio.setValueAtTime(1, when);
  }
  comp.knee.setValueAtTime(8, when);
  comp.attack.setValueAtTime(0.01, when);
  comp.release.setValueAtTime(0.18, when);
}

function createMix(ctx: BaseAudioContext, dest: AudioNode, project: Project): Mix {
  const master = ctx.createGain();
  master.gain.value = 0.78;
  const toneLow = ctx.createBiquadFilter();
  const toneHigh = ctx.createBiquadFilter();
  const toneComp = ctx.createDynamicsCompressor();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 8;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.18;
  master.connect(toneLow).connect(toneHigh).connect(toneComp).connect(limiter);
  limiter.connect(dest);

  const preview = ctx.createGain();
  preview.gain.value = 0.9;
  preview.connect(master);
  const metro = ctx.createGain();
  metro.gain.value = 1;
  metro.connect(master);

  const delay = ctx.createDelay(1.5);
  const damp = ctx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 2400;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const delayOut = ctx.createGain();
  delay.connect(damp);
  damp.connect(fb).connect(delay);
  damp.connect(delayOut).connect(master);
  delay.delayTime.value = Math.min(1.4, (60 / project.bpm) * 0.375);

  const conv: Record<Exclude<ReverbSize, "off">, ConvolverNode> = {
    small: ctx.createConvolver(),
    shelf: ctx.createConvolver(),
    room: ctx.createConvolver(),
    trail: ctx.createConvolver(),
    hall: ctx.createConvolver(),
  };
  conv.small.buffer = makeImpulse(ctx, 0.45, 3);
  conv.shelf.buffer = makeImpulse(ctx, 0.62, 2.8); // short clear seam — Creek Shelf
  conv.room.buffer = makeImpulse(ctx, 1.15, 2.2);
  conv.trail.buffer = makeImpulse(ctx, 1.55, 2.0); // mid soft beauty, softer than hall
  conv.hall.buffer = makeImpulse(ctx, 2.2, 1.7);
  (Object.keys(conv) as (keyof typeof conv)[]).forEach((k) => {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 180;
    conv[k].connect(hp).connect(master);
  });

  const inputs = new Map<string, GainNode>();
  const nodes = new Map<string, TrackNodes>();
  for (const track of project.tracks) {
    const input = ctx.createGain();
    const low = ctx.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 200;
    const high = ctx.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = 4200;
    const gain = ctx.createGain();
    const auto = ctx.createGain();
    auto.gain.value = 1;
    const pan = ctx.createStereoPanner();
    input.connect(low).connect(high).connect(gain).connect(auto).connect(pan).connect(master);
    const sends = {
      small: ctx.createGain(),
      shelf: ctx.createGain(),
      room: ctx.createGain(),
      trail: ctx.createGain(),
      hall: ctx.createGain(),
      delay: ctx.createGain(),
    };
    auto.connect(sends.small).connect(conv.small);
    auto.connect(sends.shelf).connect(conv.shelf);
    auto.connect(sends.room).connect(conv.room);
    auto.connect(sends.trail).connect(conv.trail);
    auto.connect(sends.hall).connect(conv.hall);
    auto.connect(sends.delay).connect(delay);
    inputs.set(track.id, input);
    nodes.set(track.id, { gain, auto, pan, low, high, sends });
  }
  const mix = { master, toneLow, toneHigh, toneComp, limiter, preview, metro, delay, inputs, nodes };
  applyTone(mix, project.tone ?? "quiet", 0);
  return mix;
}

function applyMix(mix: Mix, project: Project, masterVol: number, when: number) {
  const anySolo = project.tracks.some((t) => t.solo);
  setAt(mix.master.gain, Math.max(0.0001, masterVol), when);
  setAt(mix.delay.delayTime, Math.min(1.4, (60 / project.bpm) * 0.375), when);
  applyTone(mix, project.tone ?? "quiet", when);
  for (const track of project.tracks) {
    const n = mix.nodes.get(track.id);
    if (!n) continue;
    const audible = !track.mute && (!anySolo || track.solo);
    setAt(n.gain.gain, audible ? track.volume : 0.0001, when);
    setAt(n.pan.pan, track.pan, when);
    setAt(n.low.gain, track.eqLow, when);
    setAt(n.high.gain, track.eqHigh, when);
    const auto = dynamicsAt(track.lane, 0, track.laneOn);
    setAt(n.auto.gain, Math.max(0.0001, auto), when);
    (["small", "shelf", "room", "trail", "hall"] as const).forEach((k) => {
      setAt(n.sends[k].gain, track.reverb === k ? REV[k] : 0, when);
    });
    setAt(n.sends.delay.gain, track.delay ? 0.28 : 0, when);
  }
}

export type RenderOpts = {
  region?: { start: number; end: number } | null;
  trackId?: string;
  onProgress?: (phase: "render" | "write", value: number) => void;
  signal?: { aborted: boolean };
};

let renderToken = 0;
let renderWorker: Worker | null = null;

export function cancelRender() {
  renderToken += 1;
  renderWorker?.terminate();
  renderWorker = null;
}

function audibleClip(project: Project, clip: Clip, onlyTrack?: string): Track | null {
  if (clip.active === false || clip.mute) return null;
  const track = project.tracks.find((t) => t.id === clip.trackId);
  if (!track || track.mute) return null;
  if (onlyTrack && track.id !== onlyTrack) return null;
  const anySolo = project.tracks.some((t) => t.solo);
  if (anySolo && !track.solo && !onlyTrack) return null;
  return track;
}

function clipKnobs(track: Track, clip: Clip, abs: number): Knobs {
  const base = track.knobs ?? [0.5, 0.5, 0.5];
  return knobsAt(base, clip.knobLane, abs - clip.start);
}

export function renderWav(project: Project, masterVol: number, opts?: RenderOpts): Promise<Blob> {
  const token = ++renderToken;
  const region = opts?.region && opts.region.end > opts.region.start + 0.05 ? opts.region : null;
  const endBeat = region ? region.end - region.start : Math.min(songBeats(project), Math.max(songEnd(project), project.timeSig));
  const beats = Math.max(project.timeSig, Math.min(endBeat, project.bpm * 4));
  const seconds = beats * (60 / project.bpm) + 0.25;
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const shifted = region
    ? {
        ...project,
        clips: project.clips.map((c) => ({ ...c, start: c.start - region.start })).filter((c) => c.start + c.length > 0),
      }
    : project;
  const mix = createMix(ctx, ctx.destination, shifted);
  applyMix(mix, shifted, masterVol, 0);
  opts?.onProgress?.("render", 0.08);
  const jobs: Promise<void>[] = [];
  for (const clip of shifted.clips) {
    const track = audibleClip(shifted, clip, opts?.trackId);
    const input = track ? mix.inputs.get(track.id) : undefined;
    if (!track || !input) continue;
    if (clip.clipKind === "audio" && clip.assetId) {
      jobs.push(
        ensureBuffer(ctx, clip.assetId).then((buf) => {
          if (buf) scheduleAudio(ctx, input, clip, buf, 0, beats, 0.02, shifted.bpm);
        }),
      );
    } else {
      scheduleClip(ctx, input, clip, track, 0, beats, 0.02, shifted.bpm, shifted.swing ?? 0);
    }
  }
  return Promise.all(jobs).then(() => {
    if (opts?.signal?.aborted || token !== renderToken) throw new Error("cancelled");
    opts?.onProgress?.("render", 0.45);
    return ctx.startRendering();
  }).then((buffer) => {
    if (opts?.signal?.aborted || token !== renderToken) throw new Error("cancelled");
    opts?.onProgress?.("write", 0.72);
    return writeWav(buffer, token, opts);
  });
}

export async function renderStems(
  project: Project,
  masterVol: number,
  opts?: RenderOpts,
): Promise<{ name: string; blob: Blob }[]> {
  const out: { name: string; blob: Blob }[] = [];
  const tracks = project.tracks.filter((t) => !t.mute);
  for (let i = 0; i < tracks.length; i++) {
    if (opts?.signal?.aborted) throw new Error("cancelled");
    const track = tracks[i];
    const blob = await renderWav(project, masterVol, { ...opts, trackId: track.id, region: opts?.region });
    out.push({ name: track.name || `Track ${i + 1}`, blob });
    opts?.onProgress?.("render", (i + 1) / tracks.length);
  }
  return out;
}

function writeWav(buffer: AudioBuffer, token: number, opts?: RenderOpts): Promise<Blob> {
  const left = buffer.getChannelData(0).slice();
  const right = (buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)).slice();
  return new Promise((resolve, reject) => {
    const worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })));
    renderWorker = worker;
    const timer = window.setTimeout(() => {
      worker.terminate();
      resolve(new Blob([encodeWav([left, right], buffer.sampleRate)], { type: "audio/wav" }));
    }, 8000);
    worker.onmessage = (ev: MessageEvent<ArrayBuffer>) => {
      window.clearTimeout(timer);
      worker.terminate();
      if (token !== renderToken) {
        reject(new Error("cancelled"));
        return;
      }
      opts?.onProgress?.("write", 1);
      resolve(new Blob([ev.data], { type: "audio/wav" }));
    };
    worker.onerror = () => {
      window.clearTimeout(timer);
      worker.terminate();
      resolve(new Blob([encodeWav([left, right], buffer.sampleRate)], { type: "audio/wav" }));
    };
    worker.postMessage({ left, right, rate: buffer.sampleRate }, [left.buffer, right.buffer]);
  });
}

const WORKER_SRC = `
self.onmessage = (e) => {
  const { left, right, rate } = e.data;
  const channels = [left, right];
  const count = 2;
  const length = left.length;
  const block = count * 2;
  const dataSize = length * block;
  const ab = new ArrayBuffer(44 + dataSize);
  const v = new DataView(ab);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, count, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * block, true);
  v.setUint16(32, block, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, dataSize, true);
  let o = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < count; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i] || 0));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  self.postMessage(ab, [ab]);
};
`;

function scheduleAudio(
  ctx: BaseAudioContext,
  dest: AudioNode,
  clip: Clip,
  buffer: AudioBuffer,
  from: number,
  to: number,
  origin: number,
  bpm: number,
) {
  const spb = 60 / bpm;
  const start = Math.max(clip.start, from);
  const end = Math.min(clip.start + clip.length, to);
  if (end <= start) return;
  const when = Math.max(ctx.currentTime, origin + start * spb);
  const offset = (clip.audioOffset ?? 0) + Math.max(0, start - clip.start) * spb;
  const dur = (end - start) * spb;
  if (offset >= buffer.duration) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  const inn = (clip.fadeIn ?? 0) * spb;
  const out = (clip.fadeOut ?? 0) * spb;
  g.gain.setValueAtTime(inn > 0.001 ? 0.0001 : 1, when);
  if (inn > 0.001) g.gain.linearRampToValueAtTime(1, when + Math.min(inn, dur));
  if (out > 0.001 && dur > out) g.gain.setValueAtTime(1, when + dur - out);
  if (out > 0.001) g.gain.linearRampToValueAtTime(0.0001, when + dur);
  src.connect(g).connect(dest);
  src.start(when, Math.min(buffer.duration - 0.01, offset), Math.min(dur, buffer.duration - offset));
}

function swingBeat(abs: number, swing: number, drum: boolean): number {
  if (!drum || swing <= 0) return abs;
  const step = Math.round(abs / 0.25);
  if (step % 2 === 0) return abs;
  if (Math.abs(abs - step * 0.25) > 0.04) return abs;
  return step * 0.25 + (swing / 0.75) * 0.125;
}

function forEachHit(clip: Clip, from: number, to: number, visit: (abs: number, note: Note) => void) {
  const regionEnd = clip.start + clip.length;
  const w0 = Math.max(from, clip.start);
  const w1 = Math.min(to, regionEnd);
  if (!(w1 > w0)) return;
  const content = Math.max(0.25, clip.loop ? clip.content : clip.length);
  for (const note of clip.notes) {
    if (note.start < -0.001 || note.duration <= 0) continue;
    let abs = clip.start + Math.max(0, note.start);
    if (clip.loop && abs < w0) {
      const hops = Math.ceil((w0 - abs) / content - 1e-9);
      if (hops > 0) abs += hops * content;
    }
    let guard = 0;
    const guardMax = Math.min(4000, Math.ceil((w1 - w0) / content) + 2);
    while (abs < w1 - 1e-6 && abs < regionEnd - 1e-4 && guard < guardMax) {
      if (abs >= w0 - 1e-6) visit(abs, note);
      if (!clip.loop) break;
      abs += content;
      guard += 1;
    }
  }
}

function scheduleClip(
  ctx: BaseAudioContext,
  dest: AudioNode,
  clip: Clip,
  track: Track,
  from: number,
  to: number,
  origin: number,
  bpm: number,
  swing: number,
) {
  const spb = 60 / bpm;
  const drum = track.kind === "drums";
  forEachHit(clip, from, to, (abs, note) => {
    const beat = swingBeat(abs, swing, drum);
    const when = Math.max(ctx.currentTime, origin + beat * spb);
    const dur = Math.max(0.05, note.duration * spb);
    playNote(ctx, dest, when, note.pitch, note.velocity * fadeAt(clip, abs), dur, track.kind, track.preset, clipKnobs(track, clip, abs), clip.articulation ?? "legato");
  });
}

function fadeTail(buffer: AudioBuffer): AudioBuffer {
  const n = Math.min(buffer.length, Math.floor(buffer.sampleRate * 0.03));
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) d[buffer.length - 1 - i] *= i / n;
  }
  return buffer;
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const length = buffer.length;
  const block = channels * 2;
  const dataSize = length * block;
  const ab = new ArrayBuffer(44 + dataSize);
  const v = new DataView(ab);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * block, true);
  v.setUint16(32, block, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, dataSize, true);
  const chans = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i] ?? 0));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

class Engine {
  private ctx: AudioContext | null = null;
  private mix: Mix | null = null;
  private mixKey = "";
  private voices: { voice: Voice; until: number; start: number }[] = [];
  private timer = 0;
  private originTime = 0;
  private originBeat = 0;
  private scheduledUntil = 0;
  private fired = new Set<string>();
  private countTimer = 0;
  private previewTimer = 0;
  private previewVoices: Voice[] = [];
  private analyserL: AnalyserNode | null = null;
  private analyserR: AnalyserNode | null = null;
  private timeBuf = new Float32Array(256);
  private take: Clip | null = null;
  private open = new Map<number, string>();
  private hooks: Hooks = {
    getProject: () => {
      throw new Error("engine not attached");
    },
    getArmed: () => null,
    getSelectedClipId: () => null,
    onTransport: () => undefined,
    onBeforeTake: () => undefined,
    onTake: () => undefined,
    getScenes: () => ({ mode: "timeline", launched: [null, null, null, null] }),
    onBar: () => undefined,
  };

  playing = false;
  recording = false;
  counting = false;
  parkedBeat = 0;
  bpm = 120;
  metronome = false;
  metronomeLevel = 0.45;
  masterVol = 0.78;
  peaks = { l: 0, r: 0 };

  attach(hooks: Hooks) {
    this.hooks = hooks;
  }

  transport(): Transport {
    if (this.counting) return "countin";
    if (this.recording) return "recording";
    if (this.playing) return "playing";
    return "stopped";
  }

  beat(): number {
    if (!this.ctx || !this.playing) return this.parkedBeat;
    return this.originBeat + (this.ctx.currentTime - this.originTime) * (this.bpm / 60);
  }

  ensure() {
    if (typeof window === "undefined") return;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.syncGraph();
  }

  syncSettings(bpm: number, metronome: boolean, level: number, master: number) {
    if (this.playing && bpm !== this.bpm && this.ctx) {
      const b = this.beat();
      this.bpm = bpm;
      this.originBeat = b;
      this.originTime = this.ctx.currentTime;
      this.scheduledUntil = b;
    } else {
      this.bpm = bpm;
    }
    this.metronome = metronome;
    this.metronomeLevel = level;
    this.masterVol = master;
    if (this.mix && this.ctx) applyMix(this.mix, this.hooks.getProject(), master, this.ctx.currentTime);
  }

  private syncGraph() {
    if (!this.ctx) return;
    const project = this.hooks.getProject();
    const key = project.tracks.map((t) => t.id).join("|");
    if (!this.mix || key !== this.mixKey) {
      this.stopVoices(this.ctx.currentTime);
      this.dropMix();
      this.mix = createMix(this.ctx, this.ctx.destination, project);
      this.mixKey = key;
      const splitter = this.ctx.createChannelSplitter(2);
      this.mix.limiter.connect(splitter);
      this.analyserL = this.ctx.createAnalyser();
      this.analyserR = this.ctx.createAnalyser();
      this.analyserL.fftSize = 256;
      this.analyserR.fftSize = 256;
      splitter.connect(this.analyserL, 0);
      splitter.connect(this.analyserR, 1);
    }
    applyMix(this.mix, project, this.masterVol, this.ctx.currentTime);
  }

  private inputFor(trackId: string): GainNode | null {
    this.ensure();
    return this.mix?.inputs.get(trackId) ?? null;
  }

  private alloc(voice: Voice, until: number, start = 0) {
    const now = this.ctx?.currentTime ?? 0;
    const began = start || now;
    this.voices = this.voices.filter((v) => v.until > now);
    if (this.voices.length >= 64) {
      const idx = this.voices.findIndex((v) => v.start <= now);
      if (idx >= 0) {
        this.voices[idx]?.voice.stop(now);
        this.voices.splice(idx, 1);
      }
    }
    this.voices.push({ voice, until, start: began });
  }

  noteOn(trackId: string, midi: number, velocity: number, opts?: { when?: number; durationSec?: number }) {
    this.ensure();
    if (!this.ctx || !this.mix) return;
    const project = this.hooks.getProject();
    const track = project.tracks.find((t) => t.id === trackId);
    const dest = this.inputFor(trackId);
    if (!track || !dest) return;
    const when = Math.max(this.ctx.currentTime, opts?.when ?? this.ctx.currentTime);
    const dur = opts?.durationSec ?? null;
    const voice = playNote(this.ctx, dest, when, midi, velocity, dur, track.kind, track.preset);
    const until = when + (dur ?? 6) + 0.2;
    this.alloc(voice, until);
    if (!this.recording || !this.take || this.take.trackId !== trackId) {
      if (dur == null) this.open.set(midi + trackId.length * 1000, "live");
      return;
    }
    const beat = this.beat() + (when - this.ctx.currentTime) * (this.bpm / 60);
    const start = Math.max(0, floorSnap(beat - this.take.start));
    const beats = dur == null ? 0.25 : Math.max(SNAP_MIN, snap(dur * (this.bpm / 60)));
    const id = uid("n");
    const note: Note = { id, pitch: midi, start, duration: beats, velocity };
    const length = Math.max(this.take.length, start + note.duration, beat - this.take.start);
    this.take = {
      ...this.take,
      notes: [...this.take.notes, note],
      length,
      content: Math.max(this.take.content, length),
    };
    if (dur == null) this.open.set(midi, id);
    this.hooks.onTake(this.take);
  }

  noteOff(trackId: string, midi: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const liveKey = midi + trackId.length * 1000;
    if (this.open.get(liveKey) === "live") this.open.delete(liveKey);
    const voices = this.voices.splice(0, this.voices.length);
    // Release the most recent voice for this gesture by releasing all still-open live notes of this midi.
    // Voices aren't tagged; release the newest unfinished one. We keep others.
    // Simpler: tag via a side map.
    this.voices = voices;
    const id = this.open.get(midi);
    if (id && this.take) {
      const beat = this.beat();
      const notes = this.take.notes.map((n) =>
        n.id === id ? { ...n, duration: Math.max(0.25, snap(beat - this.take!.start - n.start)) } : n,
      );
      const end = notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0.25);
      this.take = { ...this.take, notes, length: Math.max(this.take.length, end), content: Math.max(this.take.content, end) };
      this.open.delete(midi);
      this.hooks.onTake(this.take);
    }
    // Release sounding tonal voices gently — drums ignore release musically.
    const last = [...this.voices].reverse().find((v) => v.until > now);
    last?.voice.release(now);
  }

  private held = new Map<string, Voice>();

  playKey(trackId: string, midi: number, velocity: number) {
    this.ensure();
    if (!this.ctx || !this.mix) return;
    const project = this.hooks.getProject();
    const track = project.tracks.find((t) => t.id === trackId);
    const dest = this.inputFor(trackId);
    if (!track || !dest) return;
    const key = `${trackId}:${midi}`;
    this.held.get(key)?.release(this.ctx.currentTime);
    const sel = this.hooks.getSelectedClipId();
    const clip = project.clips.find((c) => c.id === sel && c.trackId === trackId) ?? project.clips.find((c) => c.trackId === trackId);
    const art = clip?.articulation ?? "legato";
    const voice = playNote(this.ctx, dest, this.ctx.currentTime, midi, velocity, null, track.kind, track.preset, track.knobs, art);
    this.held.set(key, voice);
    this.alloc(voice, this.ctx.currentTime + 8);
    this.captureOn(track, midi, velocity, null);
  }

  releaseKey(trackId: string, midi: number) {
    if (!this.ctx) return;
    const key = `${trackId}:${midi}`;
    const voice = this.held.get(key);
    if (voice) {
      voice.release(this.ctx.currentTime);
      this.held.delete(key);
    }
    this.captureOff(midi);
  }

  private captureOn(track: Track, midi: number, velocity: number, durationSec: number | null) {
    if (!this.recording || !this.take || this.take.trackId !== track.id || !this.ctx) return;
    const beat = this.beat();
    const start = Math.max(0, floorSnap(beat - this.take.start));
    const beats = durationSec == null ? 0.25 : Math.max(0.25, snap(durationSec * (this.bpm / 60)));
    const id = uid("n");
    const note: Note = { id, pitch: midi, start, duration: beats, velocity };
    const length = Math.max(this.take.length, start + beats, this.beat() - this.take.start);
    this.take = {
      ...this.take,
      notes: [...this.take.notes, note],
      length,
      content: Math.max(length, this.take.content),
    };
    if (durationSec == null) this.open.set(midi, id);
    this.hooks.onTake(this.take);
  }

  private captureOff(midi: number) {
    const id = this.open.get(midi);
    if (!id || !this.take) return;
    const beat = this.beat();
    const notes = this.take.notes.map((n) =>
      n.id === id ? { ...n, duration: Math.max(0.25, snap(beat - this.take!.start - n.start)) } : n,
    );
    const end = notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0.25);
    this.take = { ...this.take, notes, length: Math.max(this.take.length, end), content: Math.max(end, this.take.content) };
    this.open.delete(midi);
    this.hooks.onTake(this.take);
  }

  hitDrum(trackId: string, midi: number, velocity: number) {
    this.ensure();
    if (!this.ctx) return;
    const project = this.hooks.getProject();
    const track = project.tracks.find((t) => t.id === trackId);
    const dest = this.inputFor(trackId);
    if (!track || !dest) return;
    const voice = playNote(this.ctx, dest, this.ctx.currentTime, midi, velocity, 0.3, "drums", track.preset || "kit");
    this.alloc(voice, this.ctx.currentTime + 1.4);
    this.captureOn(track, midi, velocity, 0.12);
  }

  previewNote(kind: TrackKind, preset: string, midi: number, velocity = 0.75, duration = 0.8) {
    this.ensure();
    if (!this.ctx || !this.mix) return;
    const voice = playNote(this.ctx, this.mix.preview, this.ctx.currentTime, midi, velocity, duration, kind, preset);
    this.previewVoices.push(voice);
  }

  previewInstrument(kind: TrackKind, preset: string) {
    this.stopPreview();
    this.ensure();
    if (!this.ctx || !this.mix) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.02;
    const dest = this.mix.preview;
    if (kind === "drums") {
      this.previewVoices.push(playNote(ctx, dest, now, 36, 0.8, 0.3, "drums", "kit"));
      this.previewVoices.push(playNote(ctx, dest, now + 0.22, 42, 0.55, 0.2, "drums", "kit"));
      this.previewVoices.push(playNote(ctx, dest, now + 0.48, 38, 0.7, 0.3, "drums", "kit"));
    } else {
      const notes = kind === "bass" ? [36, 43, 36] : [60, 64, 67];
      notes.forEach((m, i) => {
        this.previewVoices.push(
          playNote(ctx, dest, now + i * 0.02, m, 0.7, kind === "bass" ? 0.45 : 0.9, kind, preset),
        );
      });
    }
    this.previewTimer = window.setTimeout(() => this.stopPreview(), 1000);
  }

  previewLoop(kind: TrackKind, preset: string, notes: { pitch: number; start: number; duration: number; velocity: number }[], bpm: number) {
    this.stopPreview();
    this.ensure();
    if (!this.ctx || !this.mix) return;
    const now = this.ctx.currentTime + 0.03;
    const spb = 60 / bpm;
    let end = 0.4;
    for (const n of notes) {
      end = Math.max(end, n.start * spb + 0.2);
      this.previewVoices.push(
        playNote(this.ctx, this.mix.preview, now + n.start * spb, n.pitch, n.velocity, Math.max(0.08, n.duration * spb), kind, preset),
      );
    }
    this.previewTimer = window.setTimeout(() => this.stopPreview(), Math.min(4000, end * 1000 + 200));
  }

  private stopPreview() {
    window.clearTimeout(this.previewTimer);
    const t = this.ctx?.currentTime ?? 0;
    for (const v of this.previewVoices) v.stop(t);
    this.previewVoices = [];
  }

  play() {
    if (this.counting) {
      this.cancelCountIn();
      return;
    }
    if (this.playing) {
      this.pause();
      return;
    }
    this.playFrom(this.parkedBeat);
  }

  playFrom(beat: number) {
    this.ensure();
    if (!this.ctx) return;
    this.playing = true;
    this.originBeat = Math.max(0, beat);
    this.originTime = this.ctx.currentTime + 0.05;
    this.scheduledUntil = this.originBeat;
    this.parkedBeat = this.originBeat;
    this.fired.clear();
    if (!this.timer) this.timer = window.setInterval(() => this.schedule(), 25);
    this.hooks.onTransport(this.recording ? "recording" : "playing");
  }

  pause() {
    if (!this.ctx) {
      this.playing = false;
      return;
    }
    const b = this.playing ? this.beat() : this.parkedBeat;
    this.playing = false;
    this.parkedBeat = Math.max(0, b);
    this.finishTake();
    this.stopVoices(this.ctx.currentTime);
    window.clearInterval(this.timer);
    this.timer = 0;
    this.hooks.onTransport("stopped");
  }

  stop() {
    this.cancelCountIn();
    this.playing = false;
    this.parkedBeat = 0;
    this.finishTake();
    if (this.ctx) this.stopVoices(this.ctx.currentTime);
    window.clearInterval(this.timer);
    this.timer = 0;
    this.hooks.onTransport("stopped");
  }

  seek(beat: number) {
    const project = this.hooks.getProject();
    const b = Math.max(0, Math.min(songBeats(project), beat));
    if (this.playing && this.ctx) {
      this.stopVoices(this.ctx.currentTime);
      this.originBeat = b;
      this.originTime = this.ctx.currentTime + 0.02;
      this.scheduledUntil = b;
      this.fired.clear();
    }
    this.parkedBeat = b;
  }

  record(countIn: boolean) {
    this.ensure();
    if (!this.ctx) return;
    if (this.recording || this.counting) {
      this.finishTake();
      if (!this.playing) this.hooks.onTransport("stopped");
      else this.hooks.onTransport("playing");
      return;
    }
    const from = this.playing ? this.beat() : this.parkedBeat;
    if (countIn && !this.playing) {
      this.startCountIn(from);
      return;
    }
    this.beginTake(from);
    if (!this.playing) this.playFrom(from);
    else this.hooks.onTransport("recording");
  }

  private startCountIn(beat: number) {
    if (!this.ctx) return;
    this.counting = true;
    this.hooks.onTransport("countin");
    const project = this.hooks.getProject();
    const spb = 60 / this.bpm;
    const t0 = this.ctx.currentTime + 0.06;
    for (let i = 0; i < project.timeSig; i++) {
      if (this.mix) woodClick(this.ctx, this.mix.metro, t0 + i * spb, i === 0, Math.max(0.4, this.metronomeLevel));
    }
    const end = t0 + project.timeSig * spb;
    window.clearInterval(this.countTimer);
    this.countTimer = window.setInterval(() => {
      if (!this.ctx) return;
      if (this.ctx.currentTime >= end - 0.03) {
        window.clearInterval(this.countTimer);
        this.counting = false;
        this.parkedBeat = beat;
        this.beginTake(beat);
        this.playFrom(beat);
      }
    }, 30);
  }

  private cancelCountIn() {
    window.clearInterval(this.countTimer);
    this.counting = false;
  }

  private beginTake(beat: number) {
    const armed = this.hooks.getArmed();
    if (!armed) return;
    this.hooks.onBeforeTake();
    const start = floorSnap(Math.max(0, beat));
    const project = this.hooks.getProject();
    const siblings = project.clips.filter((c) => c.trackId === armed && c.takeGroup && Math.abs(c.start - start) < project.timeSig);
    const group = siblings[0]?.takeGroup ?? uid("take");
    const used = siblings.map((c) => c.take ?? 1);
    let takeN = 1;
    while (used.includes(takeN) && takeN < 3) takeN += 1;
    this.take = {
      id: uid("clip"),
      trackId: armed,
      name: `Take ${takeN}`,
      start,
      length: 0.25,
      content: 0.25,
      loop: false,
      notes: [],
      active: true,
      clipKind: "midi",
      takeGroup: group,
      take: takeN,
    };
    this.recording = true;
    this.open.clear();
    this.hooks.onTake(this.take);
  }

  finishTake() {
    this.recording = false;
    if (this.take) {
      for (const midi of [...this.open.keys()]) this.captureOff(midi);
      this.hooks.onTake(this.take);
    }
    this.take = null;
    this.open.clear();
  }

  private stopVoices(time: number) {
    for (const v of this.voices) v.voice.stop(time);
    this.voices = [];
    for (const v of this.held.values()) v.stop(time);
    this.held.clear();
    this.stopPreview();
  }

  private lastBar = -1;

  private dropMix() {
    if (!this.mix) return;
    try {
      this.mix.limiter.disconnect();
    } catch {
      /* already */
    }
    try {
      this.mix.master.disconnect();
    } catch {
      /* already */
    }
    this.mix = null;
    this.mixKey = "";
  }

  samplePeaks() {
    const read = (a: AnalyserNode | null) => {
      if (!a) return 0;
      a.getFloatTimeDomainData(this.timeBuf);
      let peak = 0;
      for (let i = 0; i < this.timeBuf.length; i++) peak = Math.max(peak, Math.abs(this.timeBuf[i] ?? 0));
      return peak;
    };
    this.peaks.l = Math.max(read(this.analyserL), this.peaks.l * 0.82);
    this.peaks.r = Math.max(read(this.analyserR), this.peaks.r * 0.82);
    return this.peaks;
  }

  private schedule() {
    if (!this.playing || !this.ctx || !this.mix) return;
    const project = this.hooks.getProject();
    const now = this.ctx.currentTime;
    if (project.bpm !== this.bpm) {
      const b = this.beat();
      this.bpm = project.bpm;
      this.originBeat = b;
      this.originTime = now;
      this.scheduledUntil = b;
      this.fired.clear();
    }
    const from = this.scheduledUntil;
    const to = this.beatAt(now + 0.35);
    if (to <= from) return;
    const loop = project.loop;
    const looping = !!(loop && loop.end > loop.start + 0.2);
    if (looping && from >= loop.end - 0.001) {
      const span = loop.end - loop.start;
      const next = loop.start + ((from - loop.end) % span);
      this.originBeat = next;
      this.originTime = now;
      this.scheduledUntil = next;
      this.parkedBeat = next;
      this.fired.clear();
      return;
    }
    const total = looping ? loop.end : songBeats(project);
    if (!looping && from >= total) {
      this.playing = false;
      this.parkedBeat = 0;
      this.finishTake();
      this.stopVoices(now);
      window.clearInterval(this.timer);
      this.timer = 0;
      this.hooks.onTransport("stopped");
      return;
    }
    const end = Math.min(to, total);
    for (const track of project.tracks) {
      const node = this.mix.nodes.get(track.id);
      if (!node) continue;
      const v = dynamicsAt(track.lane, from, track.laneOn);
      setAt(node.auto.gain, Math.max(0.0001, v), now);
    }
    const barNow = Math.floor(from / project.timeSig);
    if (barNow !== this.lastBar) {
      this.lastBar = barNow;
      this.hooks.onBar(barNow);
    }
    const scenes = this.hooks.getScenes();
    if (scenes.mode === "scenes") {
      scenes.launched.forEach((cell) => {
        if (!cell || !this.mix) return;
        const track = project.tracks.find((t) => t.kind === cell.row);
        const dest = track ? this.mix.inputs.get(track.id) : undefined;
        if (!track || !dest || track.mute) return;
        const content = Math.max(project.timeSig, cell.bars * project.timeSig);
        const clip: Clip = {
          id: `scene-${cell.id}`,
          trackId: track.id,
          name: cell.name,
          start: 0,
          length: total,
          content,
          loop: true,
          notes: cell.notes.map((n, i) => ({ id: `${cell.id}-${i}`, ...n })),
        };
        this.scheduleWindow(clip, { ...track, preset: cell.preset, kind: cell.row }, dest, from, end);
      });
    } else {
      for (const clip of project.clips) {
        if (this.take && clip.id === this.take.id) continue;
        if (clip.active === false || clip.mute) continue;
        const track = project.tracks.find((tr) => tr.id === clip.trackId);
        const dest = this.mix.inputs.get(clip.trackId);
        if (!track || !dest || track.mute) continue;
        if (project.tracks.some((tr) => tr.solo) && !track.solo) continue;
        if (clip.clipKind === "audio" && clip.assetId) this.scheduleAudioLive(clip, dest, from, end);
        else this.scheduleWindow(clip, track, dest, from, end);
      }
    }
    if (this.metronome) {
      let b = Math.ceil(from - 1e-6);
      while (b < end) {
        const t = this.timeAt(b);
        if (t >= now - 0.02 && this.mix) {
          woodClick(this.ctx, this.mix.metro, t, b % project.timeSig === 0, this.metronomeLevel);
        }
        b += 1;
      }
    }
    if (this.recording && this.take) {
      const len = Math.max(0.25, this.beat() - this.take.start);
      if (len > this.take.length + 0.05) {
        this.take = { ...this.take, length: len, content: Math.max(this.take.content, len) };
        this.hooks.onTake(this.take);
      }
    }
    this.scheduledUntil = end;
  }

  private scheduleAudioLive(clip: Clip, dest: AudioNode, from: number, to: number) {
    if (!this.ctx || !clip.assetId) return;
    const buffer = getBuffer(clip.assetId);
    if (!buffer) {
      void ensureBuffer(this.ctx, clip.assetId);
      return;
    }
    const key = `${clip.id}:audio`;
    if (this.fired.has(key)) return;
    if (to <= clip.start || from >= clip.start + clip.length) return;
    this.fired.add(key);
    const startBeat = Math.max(clip.start, from);
    const when = Math.max(this.ctx.currentTime, this.timeAt(startBeat));
    const spb = 60 / this.bpm;
    const offset = (clip.audioOffset ?? 0) + (startBeat - clip.start) * spb;
    const dur = (clip.start + clip.length - startBeat) * spb;
    if (offset >= buffer.duration || dur <= 0) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(1, when);
    src.connect(g).connect(dest);
    src.start(when, Math.min(buffer.duration - 0.01, offset), Math.min(dur, buffer.duration - offset));
    const voice: Voice = { release: () => src.stop(), stop: (t) => { try { src.stop(t); } catch { /* */ } } };
    this.alloc(voice, when + dur + 0.05, when);
  }

  playFigure(trackId: string, figures: { pitch: number; start: number; duration: number; velocity: number }[]) {
    this.ensure();
    if (!this.ctx || !this.mix || !figures.length) return;
    const project = this.hooks.getProject();
    const track = project.tracks.find((t) => t.id === trackId);
    const dest = this.inputFor(trackId);
    if (!track || !dest) return;
    const now = this.ctx.currentTime;
    const spb = 60 / this.bpm;
    for (const n of figures) {
      const voice = playNote(this.ctx, dest, now + n.start * spb, n.pitch, n.velocity, Math.max(0.05, n.duration * spb), track.kind, track.preset, track.knobs);
      this.alloc(voice, now + (n.start + n.duration) * spb + 0.25);
    }
    if (this.recording && this.take && this.take.trackId === trackId) {
      const beat = this.beat();
      const notes: Note[] = figures.map((n) => ({
        id: uid("n"),
        pitch: n.pitch,
        start: Math.max(0, floorSnap(beat - this.take!.start + n.start)),
        duration: Math.max(0.25, snap(n.duration)),
        velocity: n.velocity,
      }));
      const end = notes.reduce((m, n) => Math.max(m, n.start + n.duration), this.take.length);
      this.take = { ...this.take, notes: [...this.take.notes, ...notes], length: end, content: Math.max(this.take.content, end) };
      this.hooks.onTake(this.take);
    }
  }

  recordKnob(index: number, value: number) {
    if (!this.recording || !this.take) return;
    const t = Math.max(0, this.beat() - this.take.start);
    const lane: KnobPoint[] = [...(this.take.knobLane ?? []), { t, i: index, v: value }];
    this.take = { ...this.take, knobLane: lane };
    this.hooks.onTake(this.take);
  }

  private scheduleWindow(clip: Clip, track: Track, dest: AudioNode, from: number, to: number) {
    if (!this.ctx) return;
    const swing = this.hooks.getProject().swing ?? 0;
    const drum = track.kind === "drums";
    forEachHit(clip, from, to, (abs, note) => {
      const key = `${clip.id}:${note.id}:${Math.round(abs * 1000)}`;
      if (this.fired.has(key)) return;
      const beat = swingBeat(abs, swing, drum);
      const when = Math.max(this.ctx!.currentTime, this.timeAt(beat));
      const dur = Math.max(0.05, note.duration * (60 / this.bpm));
      try {
        const voice = playNote(this.ctx!, dest, when, note.pitch, note.velocity * fadeAt(clip, abs), dur, track.kind, track.preset, clipKnobs(track, clip, abs), clip.articulation ?? "legato");
        this.fired.add(key);
        this.alloc(voice, when + dur + 0.3, when);
      } catch {
        /* a late clock hit retries on the next tick */
      }
    });
  }

  private beatAt(time: number) {
    return this.originBeat + (time - this.originTime) * (this.bpm / 60);
  }

  private timeAt(beat: number) {
    return this.originTime + (beat - this.originBeat) * (60 / this.bpm);
  }
}

const SNAP_MIN = 0.25;

export const engine = new Engine();
