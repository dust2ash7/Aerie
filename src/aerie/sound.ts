import type { Articulation, TrackKind } from "@/aerie/model";

export type Knobs = [number, number, number];

let modWheel = 0;
export function setModWheel(amount: number) {
  modWheel = Math.max(0, Math.min(1, amount));
}

function shaped(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  kind: TrackKind,
  knobs?: Knobs,
): { dest: AudioNode; cleanup: () => void; durMul: number; velMul: number } {
  if (!knobs) return { dest, cleanup: () => undefined, durMul: 1, velMul: 1 };
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  const open = Math.min(1, 0.3 + knobs[0] * 0.7 + modWheel * 0.22);
  f.frequency.setValueAtTime(Math.min(14000, 160 * Math.pow(55, open)), time);
  g.gain.setValueAtTime(kind === "drums" ? 0.85 + knobs[2] * 0.3 : 0.78 + knobs[2] * 0.4, time);
  g.connect(f).connect(dest);
  return {
    dest: g,
    cleanup: () => {
      try {
        g.disconnect();
        f.disconnect();
      } catch {
        /* already gone */
      }
    },
    durMul: 0.4 + knobs[1] * 1.35,
    velMul: kind === "drums" ? 0.7 + knobs[0] * 0.55 : 1,
  };
}

function wrap(voice: Voice, cleanup: () => void): Voice {
  return {
    release: (t) => {
      voice.release(t);
      cleanup();
    },
    stop: (t) => {
      voice.stop(t);
      cleanup();
    },
  };
}

export type Voice = {
  release: (time: number) => void;
  stop: (time: number) => void;
};

const noiseCache = new Map<number, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const hit = noiseCache.get(ctx.sampleRate);
  if (hit) return hit;
  const len = ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx.sampleRate, buf);
  return buf;
}

function envPeak(v: number): number {
  return Math.max(0.001, Math.min(1, v));
}

type Bag = {
  osc: AudioScheduledSourceNode[];
  gains: GainNode[];
  release: (time: number) => void;
  stop: (time: number) => void;
};

function bag(): Bag {
  const osc: AudioScheduledSourceNode[] = [];
  const gains: GainNode[] = [];
  const silence = (time: number, fade: number) => {
    const t = Math.max(0, time);
    for (const g of gains) {
      try {
        g.gain.cancelScheduledValues(t);
        const current = Math.max(0.001, g.gain.value || 0.05);
        g.gain.setValueAtTime(current, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      } catch {
        /* node already closed */
      }
    }
    for (const n of osc) {
      try {
        n.stop(t + fade + 0.02);
      } catch {
        /* already stopped */
      }
    }
  };
  return { osc, gains, release: (t) => silence(t, 0.12), stop: (t) => silence(t, 0.03) };
}

function shot(param: AudioParam, time: number, peak: number, attack: number, decay: number) {
  const p = envPeak(peak);
  param.cancelScheduledValues(time);
  param.setValueAtTime(0.0001, time);
  param.exponentialRampToValueAtTime(p, time + Math.max(0.003, attack));
  param.exponentialRampToValueAtTime(0.0001, time + Math.max(attack + 0.02, decay));
}

function held(param: AudioParam, time: number, peak: number, attack: number, decay: number, sustain: number) {
  const p = envPeak(peak);
  param.cancelScheduledValues(time);
  param.setValueAtTime(0.0001, time);
  param.exponentialRampToValueAtTime(p, time + Math.max(0.004, attack));
  param.exponentialRampToValueAtTime(Math.max(0.001, p * sustain), time + attack + Math.max(0.02, decay));
}

function toneOsc(
  ctx: BaseAudioContext,
  type: OscillatorType,
  freq: number,
  time: number,
  stopAt: number,
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, freq), time);
  o.start(time);
  o.stop(stopAt);
  return o;
}

function noiseHit(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  dur: number,
  peak: number,
  filter: { type: BiquadFilterType; freq: number; q?: number },
  decay: number,
): Voice {
  const b = bag();
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filter.type;
  f.frequency.setValueAtTime(filter.freq, time);
  if (filter.q) f.Q.value = filter.q;
  const g = ctx.createGain();
  shot(g.gain, time, peak, 0.004, decay);
  src.connect(f).connect(g).connect(dest);
  src.start(time);
  src.stop(time + dur);
  b.osc.push(src);
  b.gains.push(g);
  return b;
}

function kick(ctx: BaseAudioContext, dest: AudioNode, time: number, vel: number, long: boolean): Voice {
  const b = bag();
  const osc = ctx.createOscillator();
  osc.type = "sine";
  const startF = long ? 110 : 148;
  const endF = long ? 42 : 48;
  osc.frequency.setValueAtTime(startF, time);
  osc.frequency.exponentialRampToValueAtTime(endF, time + (long ? 0.45 : 0.09));
  const g = ctx.createGain();
  shot(g.gain, time, vel * (long ? 0.72 : 0.8), 0.004, long ? 1.15 : 0.38);
  const sh = ctx.createWaveShaper();
  sh.curve = softCurve(long ? 2.2 : 1.4);
  sh.oversample = "2x";
  osc.connect(sh).connect(g).connect(dest);
  osc.start(time);
  osc.stop(time + (long ? 1.3 : 0.42));
  b.osc.push(osc);
  b.gains.push(g);
  if (!long) {
    const click = toneOsc(ctx, "square", 980, time, time + 0.03);
    const cg = ctx.createGain();
    shot(cg.gain, time, vel * 0.12, 0.002, 0.02);
    click.connect(cg).connect(dest);
    b.osc.push(click);
    b.gains.push(cg);
  }
  return b;
}

function softCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 128;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount);
  }
  return curve;
}

function snare(ctx: BaseAudioContext, dest: AudioNode, time: number, vel: number, eight: boolean): Voice {
  const body = toneOsc(ctx, "sine", eight ? 180 : 196, time, time + 0.16);
  const bg = ctx.createGain();
  shot(bg.gain, time, vel * 0.28, 0.003, 0.12);
  body.connect(bg).connect(dest);
  const n = noiseHit(ctx, dest, time, 0.25, vel * (eight ? 0.28 : 0.34), { type: "bandpass", freq: eight ? 1400 : 1800, q: 0.7 }, eight ? 0.22 : 0.16);
  return {
    release: (t) => n.release(t),
    stop: (t) => {
      n.stop(t);
      try {
        body.stop(t);
      } catch {
        /* already stopped */
      }
    },
  };
}

function clap(ctx: BaseAudioContext, dest: AudioNode, time: number, vel: number): Voice {
  const voices = [0, 0.012, 0.024].map((d) =>
    noiseHit(ctx, dest, time + d, 0.08, vel * 0.28, { type: "bandpass", freq: 1600, q: 0.6 }, 0.09),
  );
  return join(voices);
}

function hat(ctx: BaseAudioContext, dest: AudioNode, time: number, vel: number, open: boolean, decayMul = 1): Voice {
  return noiseHit(
    ctx,
    dest,
    time,
    (open ? 0.45 : 0.08) * decayMul,
    vel * (open ? 0.16 : 0.11),
    { type: "highpass", freq: open ? 6200 : 7600 },
    (open ? 0.38 : 0.05) * decayMul,
  );
}

function tom(ctx: BaseAudioContext, dest: AudioNode, time: number, vel: number, hi: boolean): Voice {
  const b = bag();
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(hi ? 220 : 130, time);
  osc.frequency.exponentialRampToValueAtTime(hi ? 120 : 72, time + 0.12);
  const g = ctx.createGain();
  shot(g.gain, time, vel * 0.45, 0.004, hi ? 0.28 : 0.4);
  osc.connect(g).connect(dest);
  osc.start(time);
  osc.stop(time + 0.45);
  b.osc.push(osc);
  b.gains.push(g);
  return b;
}

function metal(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  vel: number,
  ratios: number[],
  base: number,
  decay: number,
  peak: number,
): Voice {
  const b = bag();
  for (const r of ratios) {
    const o = toneOsc(ctx, "square", base * r, time, time + decay + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = base * r;
    f.Q.value = 3;
    const g = ctx.createGain();
    shot(g.gain, time, vel * peak, 0.003, decay);
    o.connect(f).connect(g).connect(dest);
    b.osc.push(o);
    b.gains.push(g);
  }
  const n = noiseHit(ctx, dest, time, decay, vel * peak * 0.4, { type: "highpass", freq: 4000 }, decay);
  return {
    release: (t) => {
      b.release(t);
      n.release(t);
    },
    stop: (t) => {
      b.stop(t);
      n.stop(t);
    },
  };
}

function cowbell(ctx: BaseAudioContext, dest: AudioNode, time: number, vel: number): Voice {
  const b = bag();
  for (const f of [587, 845]) {
    const o = toneOsc(ctx, "square", f, time, time + 0.28);
    const g = ctx.createGain();
    shot(g.gain, time, vel * 0.12, 0.003, 0.18);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 2;
    o.connect(bp).connect(g).connect(dest);
    b.osc.push(o);
    b.gains.push(g);
  }
  return b;
}

function playDrum(ctx: BaseAudioContext, dest: AudioNode, time: number, midi: number, vel: number, decayMul = 1): Voice {
  switch (midi) {
    case 35:
      return kick(ctx, dest, time, vel, true);
    case 36:
      return kick(ctx, dest, time, vel, false);
    case 38:
      return snare(ctx, dest, time, vel, false);
    case 40:
      return snare(ctx, dest, time, vel, true);
    case 39:
      return clap(ctx, dest, time, vel);
    case 37:
      return metal(ctx, dest, time, vel, [1], 740, 0.08, 0.16);
    case 42:
      return hat(ctx, dest, time, vel, false, decayMul);
    case 46:
      return hat(ctx, dest, time, vel, true, decayMul);
    case 45:
      return tom(ctx, dest, time, vel, false);
    case 50:
      return tom(ctx, dest, time, vel, true);
    case 51:
      return metal(ctx, dest, time, vel, [1, 2.1, 3.4], 420, 0.7 * decayMul, 0.08);
    case 49:
      return metal(ctx, dest, time, vel, [1, 1.7, 2.4, 3.1], 380, 1.1, 0.1);
    case 70:
      return noiseHit(ctx, dest, time, 0.12 * decayMul, vel * 0.12, { type: "bandpass", freq: 5000, q: 0.8 }, 0.08 * decayMul);
    case 75:
      return metal(ctx, dest, time, vel, [1], 280, 0.12, 0.2);
    case 56:
      return cowbell(ctx, dest, time, vel);
    case 57:
      return noiseHit(ctx, dest, time, 0.06, vel * 0.22, { type: "highpass", freq: 1800 }, 0.05);
    default:
      return kick(ctx, dest, time, vel * 0.5, false);
  }
}

function midiFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function additive(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  vel: number,
  partials: { ratio: number; amp: number; type?: OscillatorType }[],
  attack: number,
  decay: number,
  sustain: number,
  hold: number | null,
): Voice {
  const b = bag();
  const stopAt = time + (hold ?? 8) + 0.4;
  for (const p of partials) {
    const o = toneOsc(ctx, p.type ?? "sine", freq * p.ratio, time, stopAt);
    const g = ctx.createGain();
    if (hold == null) held(g.gain, time, vel * p.amp, attack, decay, sustain);
    else shot(g.gain, time, vel * p.amp, attack, Math.max(decay, hold + 0.15));
    o.connect(g).connect(dest);
    b.osc.push(o);
    b.gains.push(g);
  }
  return b;
}

function fm(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  vel: number,
  ratio: number,
  index: number,
  attack: number,
  decay: number,
  hold: number | null,
): Voice {
  const b = bag();
  const stopAt = time + (hold ?? 6) + 0.3;
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  carrier.frequency.setValueAtTime(freq, time);
  mod.frequency.setValueAtTime(freq * ratio, time);
  const mg = ctx.createGain();
  const peak = freq * index * vel;
  mg.gain.setValueAtTime(Math.max(1, peak), time);
  mg.gain.exponentialRampToValueAtTime(1, time + Math.max(0.2, decay));
  const g = ctx.createGain();
  if (hold == null) held(g.gain, time, vel * 0.2, attack, 0.2, 0.55);
  else shot(g.gain, time, vel * 0.2, attack, Math.max(0.3, hold + 0.2));
  mod.connect(mg).connect(carrier.frequency);
  carrier.connect(g).connect(dest);
  carrier.start(time);
  mod.start(time);
  carrier.stop(stopAt);
  mod.stop(stopAt);
  b.osc.push(carrier, mod);
  b.gains.push(g, mg);
  return b;
}

function pad(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  vel: number,
  hold: number | null,
): Voice {
  const b = bag();
  const stopAt = time + (hold ?? 8) + 0.8;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(420, time);
  filter.frequency.exponentialRampToValueAtTime(1650, time + 0.85);
  filter.Q.value = 0.55;
  const g = ctx.createGain();
  if (hold == null) held(g.gain, time, vel * 0.11, 0.42, 0.45, 0.72);
  else shot(g.gain, time, vel * 0.11, 0.32, Math.max(0.7, hold + 0.45));
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.18;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 55;
  lfo.connect(lfoG).connect(filter.frequency);
  for (const det of [-12, -4, 5, 11]) {
    const o = ctx.createOscillator();
    o.type = det % 2 === 0 ? "sawtooth" : "triangle";
    o.frequency.setValueAtTime(freq, time);
    o.detune.setValueAtTime(det, time);
    o.connect(filter);
    o.start(time);
    o.stop(stopAt);
    b.osc.push(o);
  }
  lfo.start(time);
  lfo.stop(stopAt);
  b.osc.push(lfo);
  filter.connect(g).connect(dest);
  b.gains.push(g);
  return b;
}

function padChoir(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  vel: number,
  hold: number | null,
): Voice {
  const b = bag();
  const stopAt = time + (hold ?? 8) + 0.9;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(680, time);
  filter.frequency.exponentialRampToValueAtTime(2100, time + 1.1);
  filter.Q.value = 0.4;
  const g = ctx.createGain();
  if (hold == null) held(g.gain, time, vel * 0.09, 0.55, 0.5, 0.78);
  else shot(g.gain, time, vel * 0.09, 0.48, Math.max(0.8, hold + 0.5));
  for (const det of [-9, -2, 3, 8]) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq * (det === -9 || det === 8 ? 1 : 1), time);
    o.detune.setValueAtTime(det, time);
    o.connect(filter);
    o.start(time);
    o.stop(stopAt);
    b.osc.push(o);
  }
  const breath = noiseHit(ctx, dest, time, Math.min(1.2, (hold ?? 2) + 0.4), vel * 0.025, { type: "bandpass", freq: 1800, q: 0.5 }, 0.9);
  filter.connect(g).connect(dest);
  b.gains.push(g);
  return join([b, breath]);
}

function padBow(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  vel: number,
  hold: number | null,
  art: Articulation,
): Voice {
  const b = bag();
  const stopAt = time + (hold ?? 8) + 0.7;
  const attack = art === "pizz" ? 0.01 : art === "soft" ? 0.55 : 0.38;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(art === "soft" ? 380 : 520, time);
  filter.frequency.exponentialRampToValueAtTime(art === "soft" ? 900 : 1200, time + 0.7);
  filter.Q.value = 0.7;
  const g = ctx.createGain();
  const peak = vel * (art === "soft" ? 0.07 : 0.095);
  if (art === "pizz") shot(g.gain, time, peak, 0.006, Math.max(0.18, (hold ?? 0.25) + 0.08));
  else if (hold == null) held(g.gain, time, peak, attack, 0.4, 0.7);
  else shot(g.gain, time, peak, attack, Math.max(0.55, hold + 0.35));
  if (art === "trem") {
    const trem = ctx.createOscillator();
    trem.frequency.value = 7.2;
    const tg = ctx.createGain();
    tg.gain.value = peak * 0.35;
    trem.connect(tg).connect(g.gain);
    trem.start(time);
    trem.stop(stopAt);
    b.osc.push(trem);
  }
  for (const det of [-6, 0, 7]) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq, time);
    o.detune.setValueAtTime(det, time);
    o.connect(filter);
    o.start(time);
    o.stop(stopAt);
    b.osc.push(o);
  }
  const bow = noiseHit(ctx, dest, time, art === "pizz" ? 0.06 : 0.35, vel * (art === "pizz" ? 0.06 : 0.03), { type: "bandpass", freq: 2400, q: 0.8 }, art === "pizz" ? 0.05 : 0.28);
  filter.connect(g).connect(dest);
  b.gains.push(g);
  return join([b, bow]);
}

function strings(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  vel: number,
  hold: number | null,
  art: Articulation = "legato",
  mode: "classic" | "ens" | "solo" = "classic",
): Voice {
  const b = bag();
  const stopAt = time + (hold ?? 8) + 0.5;
  const attack = art === "pizz" ? 0.008 : art === "soft" ? 0.4 : mode === "solo" ? 0.28 : 0.2;
  const peak =
    vel *
    (mode === "solo" ? 0.1 : mode === "ens" ? 0.095 : 0.12) *
    (art === "soft" ? 0.72 : 1);
  const g = ctx.createGain();
  if (art === "pizz") shot(g.gain, time, peak, 0.005, Math.max(0.16, (hold ?? 0.2) + 0.05));
  else if (hold == null) held(g.gain, time, peak, attack, 0.32, 0.78);
  else shot(g.gain, time, peak, attack, Math.max(0.45, hold + 0.22));
  if (art === "trem") {
    const trem = ctx.createOscillator();
    trem.frequency.value = 8;
    const tg = ctx.createGain();
    tg.gain.value = peak * 0.4;
    trem.connect(tg).connect(g.gain);
    trem.start(time);
    trem.stop(stopAt);
    b.osc.push(trem);
  }
  const lfo = ctx.createOscillator();
  lfo.frequency.value = mode === "solo" ? 4.2 : 5.2;
  const lfoG = ctx.createGain();
  lfoG.gain.value = mode === "solo" ? 2.5 : 5;
  const dets = mode === "ens" ? [-14, -7, 0, 6, 12] : mode === "solo" ? [-3, 4] : [-8, 0, 7];
  const mix = ctx.createGain();
  mix.gain.value = mode === "ens" ? 0.42 : 0.55;
  for (let i = 0; i < dets.length; i++) {
    const o = ctx.createOscillator();
    o.type = i % 2 === 0 ? "sawtooth" : "triangle";
    o.frequency.setValueAtTime(freq, time);
    o.detune.setValueAtTime(dets[i], time);
    if (i === 0) lfo.connect(lfoG).connect(o.detune);
    o.connect(mix);
    o.start(time);
    o.stop(stopAt);
    b.osc.push(o);
  }
  lfo.start(time);
  lfo.stop(stopAt);
  b.osc.push(lfo);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(art === "soft" ? 1100 : mode === "solo" ? 1600 : 2200, time);
  filter.Q.value = 0.5;
  mix.connect(filter).connect(g).connect(dest);
  b.gains.push(g);
  if (art === "pizz") {
    const pluck = karplus(ctx, dest, time, freq, vel * 0.45, 1600, 0.88, Math.min(0.35, hold ?? 0.25));
    return join([b, pluck]);
  }
  return b;
}

function softChoir(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  vel: number,
  hold: number | null,
  art: Articulation,
): Voice {
  const b = bag();
  const stopAt = time + (hold ?? 8) + 1;
  const attack = art === "pizz" ? 0.02 : art === "soft" ? 0.7 : 0.62;
  const g = ctx.createGain();
  const peak = vel * (art === "soft" ? 0.06 : 0.08);
  if (art === "pizz") shot(g.gain, time, peak, 0.01, 0.22);
  else if (hold == null) held(g.gain, time, peak, attack, 0.55, 0.8);
  else shot(g.gain, time, peak, attack, Math.max(0.9, hold + 0.55));
  if (art === "trem") {
    const trem = ctx.createOscillator();
    trem.frequency.value = 5.5;
    const tg = ctx.createGain();
    tg.gain.value = peak * 0.3;
    trem.connect(tg).connect(g.gain);
    trem.start(time);
    trem.stop(stopAt);
    b.osc.push(trem);
  }
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(freq * 1.4, time);
  filter.Q.value = 0.7;
  for (const det of [-11, -4, 2, 9, 15]) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, time);
    o.detune.setValueAtTime(det, time);
    o.connect(filter);
    o.start(time);
    o.stop(stopAt);
    b.osc.push(o);
  }
  filter.connect(g).connect(dest);
  b.gains.push(g);
  return b;
}

function softFlute(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  vel: number,
  hold: number | null,
  art: Articulation,
): Voice {
  const b = bag();
  const stopAt = time + (hold ?? 4) + 0.35;
  const attack = art === "pizz" ? 0.01 : art === "soft" ? 0.18 : 0.08;
  const peak = vel * (art === "soft" ? 0.08 : 0.11);
  const g = ctx.createGain();
  if (art === "pizz") shot(g.gain, time, peak, 0.006, 0.14);
  else if (hold == null) held(g.gain, time, peak, attack, 0.2, 0.55);
  else shot(g.gain, time, peak, attack, Math.max(0.25, hold + 0.12));
  if (art === "trem") {
    const trem = ctx.createOscillator();
    trem.frequency.value = 6;
    const tg = ctx.createGain();
    tg.gain.value = peak * 0.28;
    trem.connect(tg).connect(g.gain);
    trem.start(time);
    trem.stop(stopAt);
    b.osc.push(trem);
  }
  const o = toneOsc(ctx, "sine", freq, time, stopAt);
  const o2 = toneOsc(ctx, "triangle", freq, time, stopAt);
  const mix = ctx.createGain();
  mix.gain.value = 0.7;
  o.connect(mix);
  const g2 = ctx.createGain();
  g2.gain.value = 0.25;
  o2.connect(g2).connect(mix);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(art === "soft" ? 1400 : 2200, time);
  mix.connect(filter).connect(g).connect(dest);
  b.osc.push(o, o2);
  b.gains.push(g);
  const breath = noiseHit(ctx, dest, time, Math.min(0.4, (hold ?? 0.3) + 0.05), vel * 0.04, { type: "bandpass", freq: 3200, q: 0.6 }, 0.12);
  return join([b, breath]);
}

function softClarinet(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  vel: number,
  hold: number | null,
  art: Articulation,
): Voice {
  const b = bag();
  const stopAt = time + (hold ?? 4) + 0.35;
  const attack = art === "pizz" ? 0.012 : art === "soft" ? 0.22 : 0.1;
  const peak = vel * (art === "soft" ? 0.09 : 0.12);
  const g = ctx.createGain();
  if (art === "pizz") shot(g.gain, time, peak, 0.008, 0.16);
  else if (hold == null) held(g.gain, time, peak, attack, 0.22, 0.6);
  else shot(g.gain, time, peak, attack, Math.max(0.28, hold + 0.12));
  if (art === "trem") {
    const trem = ctx.createOscillator();
    trem.frequency.value = 5.8;
    const tg = ctx.createGain();
    tg.gain.value = peak * 0.25;
    trem.connect(tg).connect(g.gain);
    trem.start(time);
    trem.stop(stopAt);
    b.osc.push(trem);
  }
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(art === "soft" ? 900 : 1400, time);
  filter.Q.value = 0.8;
  for (const [ratio, amp, type] of [[1, 0.55, "square"], [3, 0.18, "square"], [5, 0.06, "sine"]] as const) {
    const o = toneOsc(ctx, type, freq * ratio, time, stopAt);
    const pg = ctx.createGain();
    pg.gain.value = amp;
    o.connect(pg).connect(filter);
    b.osc.push(o);
  }
  filter.connect(g).connect(dest);
  b.gains.push(g);
  return b;
}

function softHorn(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  vel: number,
  hold: number | null,
  art: Articulation,
): Voice {
  const b = bag();
  const stopAt = time + (hold ?? 4) + 0.45;
  const attack = art === "pizz" ? 0.02 : art === "soft" ? 0.35 : 0.18;
  // Very quiet default — never fanfare
  const peak = vel * (art === "soft" ? 0.045 : 0.06);
  const g = ctx.createGain();
  if (art === "pizz") shot(g.gain, time, peak, 0.01, 0.2);
  else if (hold == null) held(g.gain, time, peak, attack, 0.35, 0.65);
  else shot(g.gain, time, peak, attack, Math.max(0.4, hold + 0.2));
  if (art === "trem") {
    const trem = ctx.createOscillator();
    trem.frequency.value = 5;
    const tg = ctx.createGain();
    tg.gain.value = peak * 0.22;
    trem.connect(tg).connect(g.gain);
    trem.start(time);
    trem.stop(stopAt);
    b.osc.push(trem);
  }
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(700, time);
  filter.frequency.exponentialRampToValueAtTime(1100, time + 0.4);
  filter.Q.value = 1.1;
  for (const det of [-5, 0, 4]) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq, time);
    o.detune.setValueAtTime(det, time);
    o.connect(filter);
    o.start(time);
    o.stop(stopAt);
    b.osc.push(o);
  }
  filter.connect(g).connect(dest);
  b.gains.push(g);
  return b;
}

function softMallet(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  vel: number,
  hold: number | null,
): Voice {
  return fm(ctx, dest, time, freq, vel * 0.85, 2.8, 1.1, 0.004, 0.55, hold ?? 0.55);
}

function playDrumSoft(ctx: BaseAudioContext, dest: AudioNode, time: number, midi: number, vel: number, decayMul = 1): Voice {
  const v = vel * 0.62;
  switch (midi) {
    case 35:
      return kick(ctx, dest, time, v * 0.85, true);
    case 36:
      return kick(ctx, dest, time, v * 0.75, false);
    case 38:
    case 40:
      return noiseHit(ctx, dest, time, 0.14, v * 0.18, { type: "bandpass", freq: 1200, q: 0.55 }, 0.12 * decayMul);
    case 39:
      return noiseHit(ctx, dest, time, 0.08, v * 0.14, { type: "bandpass", freq: 1400, q: 0.5 }, 0.07);
    case 37:
      return metal(ctx, dest, time, v, [1], 740, 0.06, 0.1);
    case 42:
      return hat(ctx, dest, time, v * 0.85, false, decayMul);
    case 46:
      return hat(ctx, dest, time, v * 0.8, true, decayMul * 0.85);
    case 45:
      return tom(ctx, dest, time, v * 0.8, false);
    case 50:
      return tom(ctx, dest, time, v * 0.8, true);
    case 51:
      return metal(ctx, dest, time, v * 0.45, [1, 2.1], 420, 0.35 * decayMul, 0.04);
    case 49:
      return metal(ctx, dest, time, v * 0.25, [1, 1.7], 380, 0.45, 0.035);
    case 70:
      return noiseHit(ctx, dest, time, 0.1 * decayMul, v * 0.1, { type: "bandpass", freq: 4800, q: 0.7 }, 0.07 * decayMul);
    case 75:
      return metal(ctx, dest, time, v, [1], 260, 0.1, 0.14);
    case 56:
      return cowbell(ctx, dest, time, v * 0.7);
    case 57:
      return noiseHit(ctx, dest, time, 0.05, v * 0.14, { type: "highpass", freq: 1600 }, 0.04);
    default:
      return kick(ctx, dest, time, v * 0.4, false);
  }
}


function karplus(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  vel: number,
  brightness: number,
  feedback: number,
  hold: number | null,
): Voice {
  const b = bag();
  const delay = ctx.createDelay(1);
  delay.delayTime.setValueAtTime(1 / Math.max(40, freq), time);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = brightness;
  const fb = ctx.createGain();
  fb.gain.value = feedback;
  const burst = ctx.createBufferSource();
  burst.buffer = noiseBuffer(ctx);
  const bg = ctx.createGain();
  shot(bg.gain, time, vel * 0.5, 0.002, 0.03);
  const out = ctx.createGain();
  if (hold == null) held(out.gain, time, 0.35, 0.005, 0.2, 0.4);
  else shot(out.gain, time, 0.4, 0.004, Math.max(0.25, (hold ?? 0.4) + 0.2));
  burst.connect(bg).connect(filter);
  filter.connect(delay);
  delay.connect(fb).connect(filter);
  delay.connect(out).connect(dest);
  burst.start(time);
  burst.stop(time + 0.05);
  b.osc.push(burst);
  b.gains.push(out, bg);
  return b;
}

function bass(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  freq: number,
  vel: number,
  preset: string,
  hold: number | null,
): Voice {
  if (preset === "sub") {
    return additive(ctx, dest, time, freq, vel, [{ ratio: 1, amp: 0.55 }], 0.01, 0.4, 0.5, hold);
  }
  if (preset === "synth") {
    const b = bag();
    const stopAt = time + (hold ?? 4) + 0.2;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq, time);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(900, time);
    f.frequency.exponentialRampToValueAtTime(140, time + 0.25);
    const g = ctx.createGain();
    if (hold == null) held(g.gain, time, vel * 0.22, 0.008, 0.18, 0.55);
    else shot(g.gain, time, vel * 0.22, 0.008, Math.max(0.25, hold + 0.1));
    o.connect(f).connect(g).connect(dest);
    o.start(time);
    o.stop(stopAt);
    b.osc.push(o);
    b.gains.push(g);
    return b;
  }
  return additive(
    ctx,
    dest,
    time,
    freq,
    vel,
    [
      { ratio: 1, amp: 0.4 },
      { ratio: 2, amp: 0.12, type: "triangle" },
    ],
    0.006,
    0.18,
    0.45,
    hold,
  );
}

export function playNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  time: number,
  midi: number,
  velocity: number,
  durationSec: number | null,
  kind: TrackKind,
  preset: string,
  knobs?: Knobs,
  articulation: Articulation = "legato",
): Voice {
  const t = Math.max(ctx.currentTime, time);
  const shape = shaped(ctx, dest, t, kind, knobs);
  const vel = Math.max(0.05, Math.min(1, velocity * shape.velMul));
  const finish = (voice: Voice) => wrap(voice, shape.cleanup);
  const art = articulation ?? "legato";
  if (kind === "drums" || preset === "kit" || preset === "kit_soft") {
    const decay = knobs ? 0.35 + knobs[1] * 1.7 : 1;
    if (preset === "kit_soft") return finish(playDrumSoft(ctx, shape.dest, t, midi, vel, decay));
    return finish(playDrum(ctx, shape.dest, t, midi, vel, decay));
  }
  const freq = midiFreq(midi);
  const hold = durationSec == null ? null : durationSec * shape.durMul;
  if (preset === "ep") return finish(fm(ctx, shape.dest, t, freq, vel, 2, 1.4, 0.008, 0.45, hold));
  if (preset === "organ") {
    return finish(
      additive(
        ctx,
        shape.dest,
        t,
        freq,
        vel,
        [
          { ratio: 1, amp: 0.12 },
          { ratio: 2, amp: 0.08 },
          { ratio: 3, amp: 0.06 },
          { ratio: 4, amp: 0.04 },
          { ratio: 6, amp: 0.03 },
        ],
        0.02,
        0.1,
        0.85,
        hold,
      ),
    );
  }
  if (preset === "pad") return finish(pad(ctx, shape.dest, t, freq, vel, hold));
  if (preset === "pad_choir") return finish(padChoir(ctx, shape.dest, t, freq, vel, hold));
  if (preset === "pad_bow") return finish(padBow(ctx, shape.dest, t, freq, vel, hold, art));
  if (preset === "choir") return finish(softChoir(ctx, shape.dest, t, freq, vel, hold, art));
  if (preset === "strings") return finish(strings(ctx, shape.dest, t, freq, vel, hold, art, "classic"));
  if (preset === "strings_ens") return finish(strings(ctx, shape.dest, t, freq, vel, hold, art, "ens"));
  if (preset === "strings_solo") return finish(strings(ctx, shape.dest, t, freq, vel, hold, art, "solo"));
  if (preset === "flute") return finish(softFlute(ctx, shape.dest, t, freq, vel, hold, art));
  if (preset === "clarinet") return finish(softClarinet(ctx, shape.dest, t, freq, vel, hold, art));
  if (preset === "horn") return finish(softHorn(ctx, shape.dest, t, freq, vel, hold, art));
  if (preset === "mallet") return finish(softMallet(ctx, shape.dest, t, freq, vel, hold));
  if (preset === "pluck" || preset === "guitar") {
    return finish(karplus(ctx, shape.dest, t, freq, vel, preset === "guitar" ? 1800 : 2400, preset === "guitar" ? 0.93 : 0.9, hold));
  }
  if (preset === "bell") return finish(fm(ctx, shape.dest, t, freq, vel, 3.5, 2.2, 0.005, 1.1, hold ?? 1.2));
  if (preset === "lead") {
    const b = bag();
    const stopAt = t + (hold ?? 4) + 0.2;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(500, t + 0.3);
    const g = ctx.createGain();
    if (hold == null) held(g.gain, t, vel * 0.12, 0.01, 0.15, 0.6);
    else shot(g.gain, t, vel * 0.12, 0.01, Math.max(0.2, hold + 0.08));
    for (const type of ["sawtooth", "square"] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.detune.setValueAtTime(type === "square" ? 8 : -6, t);
      o.connect(filter);
      o.start(t);
      o.stop(stopAt);
      b.osc.push(o);
    }
    filter.connect(g).connect(shape.dest);
    b.gains.push(g);
    return finish(b);
  }
  if (preset === "finger" || preset === "synth" || preset === "sub") return finish(bass(ctx, shape.dest, t, freq, vel, preset, hold));
  const hammer = noiseHit(ctx, shape.dest, t, 0.05, vel * 0.08, { type: "highpass", freq: 2200 }, 0.03);
  const body = additive(
    ctx,
    shape.dest,
    t,
    freq,
    vel,
    [
      { ratio: 1, amp: 0.2 },
      { ratio: 2, amp: 0.08 },
      { ratio: 3, amp: 0.035 },
    ],
    0.006,
    0.35 + Math.max(0, (72 - midi) * 0.01),
    0.25,
    hold,
  );
  return finish(join([hammer, body]));
}

function join(voices: Voice[]): Voice {
  return {
    release: (t) => voices.forEach((v) => v.release(t)),
    stop: (t) => voices.forEach((v) => v.stop(t)),
  };
}

export function woodClick(ctx: BaseAudioContext, dest: AudioNode, time: number, accent: boolean, level: number) {
  const t = Math.max(ctx.currentTime, time);
  const peak = (accent ? 0.2 : 0.13) * Math.max(0.05, level);
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(accent ? 480 : 720, t);
  osc.frequency.exponentialRampToValueAtTime(160, t + 0.03);
  const g = ctx.createGain();
  shot(g.gain, t, peak, 0.003, 0.055);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.08);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = accent ? 860 : 1400;
  bp.Q.value = 1.4;
  const ng = ctx.createGain();
  shot(ng.gain, t, peak * 0.45, 0.002, 0.02);
  src.connect(bp).connect(ng).connect(dest);
  src.start(t);
  src.stop(t + 0.04);
}

export function makeImpulse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
  }
  return buf;
}
