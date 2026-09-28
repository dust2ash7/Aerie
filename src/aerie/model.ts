export type TrackKind = "drums" | "keys" | "bass" | "lead" | "audio";
export type Scale = "major" | "minor";
export type TimeSig = 3 | 4;
export type ReverbSize = "off" | "small" | "shelf" | "room" | "trail" | "hall";
export type Articulation = "legato" | "soft" | "pizz" | "trem";
export type Tint = "sage" | "clay" | "slate" | "stone" | "ink" | "olive" | "dust" | "sea";
export type Flavor = "diatonic" | "major" | "minor" | "7";
export type Category = "Drums" | "Bass" | "Keys" | "Texture";
export type SnapMode = "off" | "1/4" | "1/8" | "1/16";
export type ToneName = "off" | "quiet" | "warm" | "present";
export type Autoplay = 0 | 1 | 2;
export type SectionName = "Intro" | "Verse" | "Chorus" | "Bridge" | "Outro";
export type SceneRow = "drums" | "bass" | "keys" | "lead";

export type Note = {
  id: string;
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
};

export type Point = { t: number; v: number };
export type KnobPoint = { t: number; i: number; v: number };

export type Clip = {
  id: string;
  trackId: string;
  name: string;
  start: number;
  length: number;
  content: number;
  loop: boolean;
  notes: Note[];
  mute?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  takeGroup?: string;
  take?: number;
  active?: boolean;
  assetId?: string;
  audioOffset?: number;
  clipKind?: "midi" | "audio";
  knobLane?: KnobPoint[];
  articulation?: Articulation;
};

export type Track = {
  id: string;
  name: string;
  kind: TrackKind;
  preset: string;
  tint: Tint;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  eqLow: number;
  eqHigh: number;
  reverb: ReverbSize;
  delay: boolean;
  knobs?: [number, number, number];
  lane?: Point[];
  laneOn?: boolean;
};

export type Section = { id: string; name: SectionName; start: number; length: number };

export type SceneCell = {
  id: string;
  row: SceneRow;
  col: number;
  name: string;
  preset: string;
  bars: number;
  notes: { pitch: number; start: number; duration: number; velocity: number }[];
};

export type Project = {
  v: 1;
  songId?: string;
  title: string;
  bpm: number;
  timeSig: TimeSig;
  key: string;
  scale: Scale;
  bars: number;
  swing: number;
  tracks: Track[];
  clips: Clip[];
  snap?: SnapMode;
  loop?: { start: number; end: number } | null;
  follow?: boolean;
  tone?: ToneName;
  lyrics?: string;
  sections?: Section[];
  scenes?: SceneCell[];
  updatedAt?: number;
};

export type Settings = {
  metronome: boolean;
  metronomeLevel: number;
  countIn: boolean;
  contrast: boolean;
  master: number;
  toneDefault?: ToneName;
  scaleLock?: boolean;
  midiPortId?: string | null;
  midiEcho?: boolean;
};

export const MAX_TRACKS = 12;
export const MAX_MINUTES = 4;
export const SNAP = 0.25;
export const SCENE_ROWS: SceneRow[] = ["drums", "bass", "keys", "lead"];
export const SECTION_NAMES: SectionName[] = ["Intro", "Verse", "Chorus", "Bridge", "Outro"];
export const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export const TINTS: Tint[] = ["sage", "clay", "slate", "stone", "ink", "olive", "dust", "sea"];

export const KNOBS: Record<string, [string, string, string]> = {
  piano: ["Tone", "Decay", "Reverb"],
  ep: ["Bell", "Chorus", "Trem"],
  organ: ["Click", "Rotary", "Drive"],
  pad: ["Attack", "Movement", "Wash"],
  strings: ["Tone", "Decay", "Wash"],
  pluck: ["Tone", "Decay", "Space"],
  finger: ["Round", "Growl", "Sub"],
  synth: ["Round", "Growl", "Sub"],
  sub: ["Round", "Growl", "Sub"],
  lead: ["Cutoff", "Env", "Delay"],
  bell: ["Tone", "Decay", "Space"],
  guitar: ["Tone", "Decay", "Space"],
  kit: ["Punch", "Hat decay", "Room"],
  kit_soft: ["Soft", "Hat decay", "Room"],
  pad_choir: ["Attack", "Breath", "Wash"],
  pad_bow: ["Attack", "Bow", "Wash"],
  strings_ens: ["Tone", "Decay", "Wash"],
  strings_solo: ["Tone", "Decay", "Space"],
  mallet: ["Tone", "Decay", "Space"],
  flute: ["Breath", "Tone", "Space"],
  clarinet: ["Tone", "Reed", "Space"],
  horn: ["Soft", "Tone", "Space"],
  choir: ["Attack", "Vowels", "Wash"],
  file: ["Gain", "Tone", "Room"],
};

export const DRUMS = [
  { id: "kick", name: "Kick", midi: 36 },
  { id: "snare", name: "Snare", midi: 38 },
  { id: "clap", name: "Clap", midi: 39 },
  { id: "rim", name: "Rim", midi: 37 },
  { id: "hat", name: "Closed Hat", midi: 42 },
  { id: "ohat", name: "Open Hat", midi: 46 },
  { id: "tomlo", name: "Tom Lo", midi: 45 },
  { id: "tomhi", name: "Tom Hi", midi: 50 },
  { id: "ride", name: "Ride", midi: 51 },
  { id: "crash", name: "Crash", midi: 49 },
  { id: "shaker", name: "Shaker", midi: 70 },
  { id: "perc", name: "Perc", midi: 75 },
  { id: "k808", name: "808 Kick", midi: 35 },
  { id: "s808", name: "808 Snare", midi: 40 },
  { id: "cow", name: "Cowbell", midi: 56 },
  { id: "snap", name: "Snap", midi: 57 },
] as const;

export const PRESETS: Record<TrackKind, { id: string; name: string }[]> = {
  keys: [
    { id: "piano", name: "Concert Piano" },
    { id: "ep", name: "Electric Piano" },
    { id: "organ", name: "Warm Organ" },
    { id: "pad", name: "Analog Pad" },
    { id: "pad_choir", name: "Soft Choir Pad" },
    { id: "pad_bow", name: "Bowed Pad" },
    { id: "strings", name: "Strings" },
    { id: "strings_ens", name: "Ensemble Sustain" },
    { id: "strings_solo", name: "Soft Solo" },
    { id: "choir", name: "Wordless Choir" },
    { id: "pluck", name: "Pluck" },
  ],
  bass: [
    { id: "finger", name: "Finger Bass" },
    { id: "synth", name: "Synth Bass" },
    { id: "sub", name: "808 Sub" },
  ],
  lead: [
    { id: "lead", name: "Analog Lead" },
    { id: "bell", name: "Bell" },
    { id: "mallet", name: "Soft Mallet" },
    { id: "flute", name: "Soft Flute" },
    { id: "clarinet", name: "Soft Clarinet" },
    { id: "horn", name: "Soft Horn" },
    { id: "guitar", name: "Guitar-ish Pluck" },
  ],
  drums: [
    { id: "kit", name: "Drum Kit" },
    { id: "kit_soft", name: "Soft Kit" },
  ],
  audio: [{ id: "file", name: "Audio" }],
};

/** Presets that expose articulation selector (legato / soft / pizz / trem). */
export const ARTICULATION_PRESETS = new Set([
  "strings",
  "strings_ens",
  "strings_solo",
  "flute",
  "clarinet",
  "horn",
  "choir",
  "pad_bow",
]);

export const REVERB_OPTIONS: { id: ReverbSize; name: string }[] = [
  { id: "off", name: "Off" },
  { id: "small", name: "Small" },
  { id: "shelf", name: "Shelf" },
  { id: "room", name: "Room" },
  { id: "trail", name: "Trail" },
  { id: "hall", name: "Hall" },
];

export const ARTICULATIONS: Articulation[] = ["legato", "soft", "pizz", "trem"];

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const ROMAN_MAJ = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
const ROMAN_MIN = ["i", "ii°", "III", "iv", "v", "VI", "VII"];

let seq = 1;
export function uid(prefix = "id"): string {
  seq += 1;
  return `${prefix}${seq.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

let snapMode: SnapMode = "1/16";
export function setSnapMode(mode: SnapMode) {
  snapMode = mode;
}
export function gridStep(): number {
  if (snapMode === "1/4") return 1;
  if (snapMode === "1/8") return 0.5;
  if (snapMode === "off") return 0;
  return SNAP;
}
export function snap(b: number): number {
  const s = gridStep();
  if (s <= 0) return Math.round(b * 1000) / 1000;
  return Math.round(b / s) * s;
}
export function floorSnap(b: number): number {
  const s = gridStep() || SNAP;
  return Math.floor((b + 1e-6) / s) * s;
}

export function defaultSettings(): Settings {
  return {
    metronome: false,
    metronomeLevel: 0.45,
    countIn: true,
    contrast: false,
    master: 0.78,
    toneDefault: "quiet",
    scaleLock: false,
    midiPortId: null,
    midiEcho: false,
  };
}

export function defaultBase(kind: TrackKind): number {
  if (kind === "bass") return 36;
  if (kind === "lead") return 60;
  if (kind === "audio") return 60;
  return 48;
}

export function presetName(kind: TrackKind, id: string): string {
  return PRESETS[kind].find((p) => p.id === id)?.name ?? PRESETS[kind][0].name;
}

export function maxBeats(bpm: number): number {
  return Math.max(4, bpm * MAX_MINUTES);
}

export function withBars(p: Project): Project {
  let max = 0;
  for (const c of p.clips) max = Math.max(max, c.start + c.length);
  const cap = maxBeats(p.bpm);
  const capBars = Math.max(1, Math.floor(cap / p.timeSig));
  const bars = Math.min(capBars, Math.max(8, Math.ceil(Math.min(max, cap) / p.timeSig - 1e-6)));
  return bars === p.bars ? p : { ...p, bars };
}

export function formatPosition(beat: number, timeSig: TimeSig): string {
  const safe = Math.max(0, beat);
  const bar = Math.floor(safe / timeSig) + 1;
  const b = Math.floor(safe % timeSig) + 1;
  return `${String(bar).padStart(2, "0")} : ${b}`;
}

export function roman(scale: Scale, degree: number): string {
  return (scale === "major" ? ROMAN_MAJ : ROMAN_MIN)[degree] ?? "I";
}

export function chordPitches(key: string, scale: Scale, degree: number, flavor: Flavor, center: number): number[] {
  const sc = scale === "major" ? MAJOR : MINOR;
  const deg = ((degree % 7) + 7) % 7;
  const keyIndex = Math.max(0, KEYS.indexOf(key as (typeof KEYS)[number]));
  const rootPc = (keyIndex + sc[deg]) % 12;
  const iv = (steps: number) => (sc[(deg + steps) % 7] - sc[deg] + 12) % 12;
  let intervals: number[];
  if (flavor === "major") intervals = [0, 4, 7];
  else if (flavor === "minor") intervals = [0, 3, 7];
  else if (flavor === "7") intervals = [0, iv(2), iv(4), iv(6)];
  else intervals = [0, iv(2), iv(4)];
  let base = rootPc;
  while (base < center - 6) base += 12;
  while (base > center + 6) base -= 12;
  return intervals.map((i) => base + i);
}

export function smartFigure(
  key: string,
  scale: Scale,
  degree: number,
  flavor: Flavor,
  center: number,
  mode: Autoplay,
  timeSig: TimeSig,
): { pitch: number; start: number; duration: number; velocity: number }[] {
  const pitches = chordPitches(key, scale, degree, flavor, center);
  if (mode === 0) return pitches.map((pitch) => ({ pitch, start: 0, duration: timeSig, velocity: 0.72 }));
  if (mode === 1) {
    const out: { pitch: number; start: number; duration: number; velocity: number }[] = [];
    for (let b = 0; b < timeSig; b++) {
      for (const pitch of pitches) out.push({ pitch, start: b, duration: 0.45, velocity: b % 2 ? 0.52 : 0.74 });
    }
    return out;
  }
  const out: { pitch: number; start: number; duration: number; velocity: number }[] = [];
  const steps = timeSig * 2;
  for (let i = 0; i < steps; i++) {
    const pitch = pitches[i % pitches.length] + (i % 4 === 3 ? 12 : 0);
    out.push({ pitch, start: i * 0.5, duration: 0.42, velocity: 0.7 });
  }
  return out;
}

export function scaleSet(key: string, scale: Scale): Set<number> {
  const root = Math.max(0, KEYS.indexOf(key as (typeof KEYS)[number]));
  const iv = scale === "major" ? MAJOR : MINOR;
  return new Set(iv.map((i) => (root + i) % 12));
}

export function nearestInScale(midi: number, key: string, scale: Scale): number {
  const set = scaleSet(key, scale);
  if (set.has(((midi % 12) + 12) % 12)) return midi;
  for (let d = 1; d <= 6; d++) {
    if (set.has((((midi + d) % 12) + 12) % 12)) return midi + d;
    if (set.has((((midi - d) % 12) + 12) % 12)) return midi - d;
  }
  return midi;
}

export function createTrack(kind: TrackKind, preset: string, name: string, index: number): Track {
  return {
    id: uid("trk"),
    name,
    kind,
    preset,
    tint: TINTS[index % TINTS.length],
    volume: 0.78,
    pan: 0,
    mute: false,
    solo: false,
    eqLow: 0,
    eqHigh: 0,
    reverb: "off",
    delay: false,
    knobs: [0.5, 0.5, 0.5],
    lane: [],
    laneOn: false,
  };
}

function note(pitch: number, start: number, duration: number, velocity = 0.78): Note {
  return { id: uid("n"), pitch, start, duration, velocity };
}

function makeClip(trackId: string, name: string, start: number, content: number, length: number, notes: Note[], loop = true): Clip {
  return { id: uid("clip"), trackId, name, start, length, content, loop, notes, mute: false, fadeIn: 0, fadeOut: 0, active: true, clipKind: "midi" };
}

export function emptyRoom(): Project {
  const piano = createTrack("keys", "piano", "Piano", 0);
  return fillProject({
    v: 1,
    title: "Empty room",
    bpm: 120,
    timeSig: 4,
    key: "C",
    scale: "major",
    bars: 8,
    swing: 0,
    tracks: [piano],
    clips: [],
  });
}

export function lofiEvening(): Project {
  const kit = createTrack("drums", "kit", "Kit", 0);
  const bass = createTrack("bass", "finger", "Bass", 1);
  const keys = createTrack("keys", "ep", "Keys", 2);
  const bell = createTrack("lead", "bell", "Bell", 3);
  const drums = drumNotes([
    [36, "X.......X.......X.......X...X..."],
    [38, "....X.......X.......X.......X..."],
    [42, "x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x."],
    [75, "..x.......x.......x.......x....."],
  ]);
  const bassNotes = [
    note(36, 0, 1.75, 0.8),
    note(40, 2, 1.5, 0.7),
    note(33, 4, 1.75, 0.78),
    note(40, 6, 1.25, 0.66),
    note(41, 8, 1.75, 0.78),
    note(36, 10, 1.5, 0.7),
    note(43, 12, 1.5, 0.8),
    note(38, 14, 1.5, 0.68),
  ];
  const chords = [
    ...[60, 64, 67, 71].map((p) => note(p, 0, 3.5, 0.62)),
    ...[57, 60, 64, 67].map((p) => note(p, 4, 3.5, 0.6)),
    ...[53, 57, 60, 64].map((p) => note(p, 8, 3.5, 0.6)),
    ...[55, 59, 62, 65].map((p) => note(p, 12, 3.5, 0.64)),
  ];
  const melody = [note(76, 2, 1, 0.5), note(74, 6.5, 1, 0.46), note(77, 10, 1.25, 0.5), note(79, 14, 1.5, 0.48)];
  return fillProject({
    v: 1,
    title: "Lo-fi evening",
    bpm: 84,
    timeSig: 4,
    key: "C",
    scale: "major",
    bars: 8,
    swing: 0,
    tracks: [kit, bass, keys, bell],
    clips: [
      makeClip(kit.id, "Side street", 0, 8, 32, drums),
      makeClip(bass.id, "Root walk", 0, 16, 32, bassNotes),
      makeClip(keys.id, "Evening bed", 0, 16, 32, chords),
      makeClip(bell.id, "Bell figure", 0, 16, 32, melody),
    ],
  });
}

export function pianoSketch(): Project {
  const piano = createTrack("keys", "piano", "Piano", 3);
  const melody = createTrack("keys", "piano", "Melody", 4);
  const chords = [
    ...[60, 64, 67].map((p) => note(p, 0, 7, 0.7)),
    ...[53, 57, 60, 65].map((p) => note(p, 8, 7, 0.66)),
    ...[57, 60, 64].map((p) => note(p, 16, 7, 0.68)),
    ...[55, 59, 62].map((p) => note(p, 24, 7, 0.7)),
  ];
  const line = [
    note(67, 0.5, 1, 0.62),
    note(64, 2, 1, 0.58),
    note(62, 3.5, 0.5, 0.5),
    note(64, 4, 2, 0.6),
    note(60, 6.5, 1, 0.52),
    note(65, 8.5, 1, 0.58),
    note(69, 10, 1.5, 0.62),
    note(67, 12, 1, 0.55),
    note(65, 14, 1.5, 0.55),
    note(64, 16.5, 1, 0.58),
    note(67, 18, 1, 0.6),
    note(69, 20, 2, 0.62),
    note(67, 24.5, 1, 0.58),
    note(62, 26, 1, 0.52),
    note(64, 28, 3, 0.6),
  ];
  return fillProject({
    v: 1,
    title: "Piano sketch",
    bpm: 76,
    timeSig: 4,
    key: "C",
    scale: "major",
    bars: 8,
    swing: 0,
    tracks: [piano, melody],
    clips: [
      makeClip(piano.id, "Sketch chords", 0, 32, 32, chords, false),
      makeClip(melody.id, "Melody", 0, 32, 32, line, false),
    ],
  });
}


export function tendBed(): Project {
  const pad = createTrack("keys", "pad_choir", "Pad", 0);
  pad.volume = 0.62;
  pad.reverb = "shelf";
  pad.laneOn = true;
  pad.lane = [
    { t: 0, v: 0.55 },
    { t: 16, v: 0.92 },
    { t: 28, v: 0.7 },
  ];
  const keys = createTrack("keys", "ep", "Keys", 1);
  keys.volume = 0.55;
  keys.reverb = "shelf";
  const sparks = createTrack("keys", "piano", "Sparks", 2);
  sparks.volume = 0.42;
  sparks.reverb = "small";
  const pedal = createTrack("bass", "sub", "Pedal", 3);
  pedal.volume = 0.48;
  pedal.reverb = "off";
  const padNotes = [
    ...[60, 67, 72].map((p) => note(p, 0, 7.5, 0.42)),
    ...[57, 64, 69].map((p) => note(p, 8, 7.5, 0.4)),
    ...[53, 60, 67].map((p) => note(p, 16, 7.5, 0.38)),
    ...[55, 62, 67].map((p) => note(p, 24, 7.5, 0.4)),
  ];
  const epNotes = [
    ...[60, 64, 67].map((p) => note(p, 0, 3.5, 0.5)),
    ...[57, 60, 64].map((p) => note(p, 8, 3.5, 0.48)),
    ...[53, 57, 60].map((p) => note(p, 16, 3.5, 0.46)),
    ...[55, 59, 62].map((p) => note(p, 24, 3.5, 0.48)),
  ];
  const sparkNotes = [
    note(72, 4, 0.75, 0.38),
    note(74, 12.5, 0.6, 0.34),
    note(71, 20, 0.8, 0.36),
    note(67, 28.5, 1, 0.32),
  ];
  const pedalNotes = [
    note(36, 0, 7.5, 0.55),
    note(33, 8, 7.5, 0.5),
    note(29, 16, 7.5, 0.48),
    note(31, 24, 7.5, 0.5),
  ];
  const padClip = makeClip(pad.id, "Pad hold", 0, 32, 32, padNotes, true);
  padClip.fadeIn = 0.5;
  padClip.fadeOut = 0.5;
  const keysClip = makeClip(keys.id, "Soft chords", 0, 32, 32, epNotes, true);
  keysClip.fadeIn = 0.25;
  keysClip.fadeOut = 0.35;
  const sparkClip = makeClip(sparks.id, "Sparks", 0, 32, 32, sparkNotes, true);
  sparkClip.fadeIn = 0.05;
  sparkClip.fadeOut = 0.15;
  const pedalClip = makeClip(pedal.id, "Pedal", 0, 32, 32, pedalNotes, true);
  pedalClip.fadeIn = 0.4;
  pedalClip.fadeOut = 0.4;
  return fillProject({
    v: 1,
    title: "Tend bed",
    bpm: 69,
    timeSig: 4,
    key: "C",
    scale: "major",
    bars: 8,
    swing: 0,
    tone: "quiet",
    loop: { start: 0, end: 32 },
    tracks: [pad, keys, sparks, pedal],
    clips: [padClip, keysClip, sparkClip, pedalClip],
  });
}

export function doneChime(): Project {
  const chime = createTrack("lead", "bell", "Chime", 0);
  chime.volume = 0.72;
  chime.reverb = "small";
  const notes = [note(76, 0, 0.55, 0.62), note(83, 0.08, 0.5, 0.48)];
  const clip = makeClip(chime.id, "Done", 0, 2, 2, notes, false);
  clip.fadeIn = 0.02;
  clip.fadeOut = 0.12;
  return fillProject({
    v: 1,
    title: "Done chime",
    bpm: 69,
    timeSig: 4,
    key: "C",
    scale: "major",
    bars: 2,
    swing: 0,
    tone: "quiet",
    loop: null,
    tracks: [chime],
    clips: [clip],
  });
}

export type LoopDef = {
  id: string;
  name: string;
  category: Category;
  tags: string[];
  kind: TrackKind;
  preset: string;
  bars: number;
  tint: Tint;
  notes: { pitch: number; start: number; duration: number; velocity: number }[];
};

function drumNotes(rows: [number, string][]): Note[] {
  const out: Note[] = [];
  for (const [midi, pat] of rows) {
    for (let i = 0; i < pat.length; i++) {
      const ch = pat[i];
      if (ch === "." || ch === " " || ch === undefined) continue;
      out.push(note(midi, i * 0.25, 0.25, ch === "X" ? 0.95 : 0.72));
    }
  }
  return out;
}

function tones(list: [number, number, number, number?][]): { pitch: number; start: number; duration: number; velocity: number }[] {
  return list.map(([pitch, start, duration, velocity]) => ({ pitch, start, duration, velocity: velocity ?? 0.75 }));
}

function dloop(id: string, name: string, tags: string[], rows: [number, string][], category: Category = "Drums"): LoopDef {
  const bars = Math.max(1, Math.round(rows[0][1].length / 16));
  return {
    id,
    name,
    category,
    tags,
    kind: "drums",
    preset: "kit",
    bars,
    tint: "sage",
    notes: drumNotes(rows).map(({ pitch, start, duration, velocity }) => ({ pitch, start, duration, velocity })),
  };
}

export const LOOPS: LoopDef[] = [
  dloop("side-street", "Side street", ["Lo-fi"], [
    [36, "X.......X......."],
    [38, "....X.......X..."],
    [42, "x.x.x.x.x.x.x.x."],
    [75, "..x.......x....."],
  ]),
  dloop("pocket", "Pocket", ["Hip-Hop"], [
    [36, "X.......X...X..."],
    [38, "....X.......X..."],
    [42, "x.x.x.x.x.x.x.x."],
    [39, "....X.......X..."],
  ]),
  dloop("soft-floor", "Soft floor", ["Pop"], [
    [36, "X...X...X...X..."],
    [39, "....X.......X..."],
    [42, "xxxxxxxxxxxxxxxx"],
    [46, "......x.......x."],
  ]),
  dloop("room-kit", "Room kit", ["Indie"], [
    [36, "X.......X......."],
    [38, "....X.......X..."],
    [42, "x..xx..xx..xx..x"],
    [51, "..............x."],
  ]),
  dloop("dust-hats", "Dust hats", ["Lo-fi"], [
    [36, "X.........X....."],
    [38, "....x.......x..."],
    [42, "x.x.x.x.x.x.x.x."],
    [70, "x.x.x.x.x.x.x.x."],
  ]),
  dloop("night-pulse", "Night pulse", ["Ambient"], [
    [36, "X..............."],
    [70, "x...x...x...x..."],
    [51, "............x..."],
  ]),
  { id: "root-walk", name: "Root walk", category: "Bass", tags: ["Lo-fi"], kind: "bass", preset: "finger", bars: 2, tint: "slate", notes: tones([[36, 0, 1.5, 0.8], [40, 2, 1.25, 0.7], [33, 4, 1.5, 0.78], [31, 6, 1.5, 0.72]]) },
  { id: "pop-step", name: "Pop step", category: "Bass", tags: ["Pop"], kind: "bass", preset: "finger", bars: 2, tint: "slate", notes: tones([[36, 0, 1, 0.8], [36, 1.5, 0.5, 0.6], [43, 2, 1, 0.74], [41, 4, 1.5, 0.78], [38, 6, 1.25, 0.7]]) },
  { id: "sub-hit", name: "Sub hit", category: "Bass", tags: ["Hip-Hop"], kind: "bass", preset: "sub", bars: 1, tint: "ink", notes: tones([[36, 0, 1.5, 0.9], [36, 2.5, 0.5, 0.7], [34, 3, 0.75, 0.8]]) },
  { id: "pedal", name: "Pedal tone", category: "Bass", tags: ["Indie"], kind: "bass", preset: "finger", bars: 2, tint: "olive", notes: tones([[36, 0, 3.5, 0.7], [43, 4, 1.5, 0.66], [41, 6, 1.5, 0.66]]) },
  { id: "slow-fifth", name: "Slow fifth", category: "Bass", tags: ["Ambient"], kind: "bass", preset: "sub", bars: 2, tint: "sea", notes: tones([[36, 0, 3.5, 0.7], [43, 4, 3.5, 0.62]]) },
  { id: "synth-hop", name: "Synth hop", category: "Bass", tags: ["Pop"], kind: "bass", preset: "synth", bars: 1, tint: "clay", notes: tones([[36, 0, 0.5, 0.85], [36, 0.75, 0.25, 0.6], [36, 1.5, 0.5, 0.75], [38, 2.5, 0.5, 0.7], [43, 3, 0.75, 0.8]]) },
  { id: "evening-bed", name: "Evening bed", category: "Keys", tags: ["Lo-fi"], kind: "keys", preset: "ep", bars: 4, tint: "stone", notes: tones([[60, 0, 3.5, 0.62], [64, 0, 3.5, 0.55], [67, 0, 3.5, 0.5], [71, 0, 3.5, 0.42], [57, 4, 3.5, 0.6], [60, 4, 3.5, 0.55], [64, 4, 3.5, 0.5], [67, 4, 3.5, 0.42], [53, 8, 3.5, 0.6], [57, 8, 3.5, 0.55], [60, 8, 3.5, 0.5], [65, 8, 3.5, 0.42], [55, 12, 3.5, 0.62], [59, 12, 3.5, 0.55], [62, 12, 3.5, 0.5], [65, 12, 3.5, 0.45]]) },
  { id: "window-light", name: "Window light", category: "Keys", tags: ["Pop"], kind: "keys", preset: "piano", bars: 4, tint: "stone", notes: tones([[60, 0, 3.5, 0.7], [64, 0, 3.5, 0.6], [67, 0, 3.5, 0.55], [67, 4, 3.5, 0.68], [71, 4, 3.5, 0.58], [74, 4, 3.5, 0.5], [69, 8, 3.5, 0.66], [72, 8, 3.5, 0.56], [76, 8, 3.5, 0.5], [65, 12, 3.5, 0.68], [69, 12, 3.5, 0.58], [72, 12, 3.5, 0.5]]) },
  { id: "add-nine", name: "Add nine", category: "Keys", tags: ["Indie"], kind: "keys", preset: "ep", bars: 2, tint: "dust", notes: tones([[60, 0, 3.5, 0.6], [64, 0, 3.5, 0.52], [67, 0, 3.5, 0.48], [74, 0, 3.5, 0.4], [65, 4, 3.5, 0.6], [69, 4, 3.5, 0.5], [72, 4, 3.5, 0.48], [74, 4, 1.5, 0.42]]) },
  { id: "hymn-organ", name: "Hymn organ", category: "Keys", tags: ["Ambient"], kind: "keys", preset: "organ", bars: 2, tint: "sea", notes: tones([[48, 0, 7.5, 0.5], [60, 0, 7.5, 0.48], [64, 0, 7.5, 0.42], [67, 0, 7.5, 0.4]]) },
  { id: "sketch-left", name: "Sketch left", category: "Keys", tags: ["Lo-fi"], kind: "keys", preset: "piano", bars: 2, tint: "stone", notes: tones([[48, 0, 1.5, 0.7], [55, 0, 1.5, 0.55], [60, 2, 1.5, 0.66], [64, 2, 1.5, 0.5], [53, 4, 1.5, 0.68], [60, 4, 1.5, 0.52], [55, 6, 1.5, 0.66], [62, 6, 1.5, 0.5]]) },
  { id: "stab-chords", name: "Stab chords", category: "Keys", tags: ["Hip-Hop"], kind: "keys", preset: "ep", bars: 1, tint: "clay", notes: tones([[60, 0, 0.5, 0.75], [64, 0, 0.5, 0.65], [67, 0, 0.5, 0.6], [60, 2, 0.4, 0.7], [63, 2, 0.4, 0.6], [67, 2, 0.4, 0.55]]) },
  dloop("shaker-bed", "Shaker bed", ["Lo-fi"], [[70, "x.x.x.x.x.x.x.x."], [75, "....x.......x..."]], "Texture"),
  { id: "bell-figure", name: "Bell figure", category: "Texture", tags: ["Indie"], kind: "lead", preset: "bell", bars: 2, tint: "stone", notes: tones([[76, 0.5, 0.75, 0.5], [79, 2, 0.5, 0.46], [74, 3, 1, 0.44], [72, 5, 1.25, 0.48], [67, 7, 0.75, 0.4]]) },
  { id: "far-pad", name: "Far pad", category: "Texture", tags: ["Ambient"], kind: "keys", preset: "pad", bars: 2, tint: "sea", notes: tones([[60, 0, 7.5, 0.4], [67, 0, 7.5, 0.34], [72, 0, 7.5, 0.28]]) },
  { id: "little-arp", name: "Little arp", category: "Texture", tags: ["Pop"], kind: "keys", preset: "pluck", bars: 1, tint: "olive", notes: tones([[72, 0, 0.25, 0.6], [76, 0.5, 0.25, 0.55], [79, 1, 0.25, 0.58], [84, 1.5, 0.25, 0.5], [79, 2, 0.25, 0.55], [76, 2.5, 0.25, 0.5], [72, 3, 0.5, 0.58]]) },
  { id: "string-hold", name: "String hold", category: "Texture", tags: ["Ambient"], kind: "keys", preset: "strings", bars: 2, tint: "dust", notes: tones([[55, 0, 7.5, 0.45], [60, 0, 7.5, 0.42], [64, 0, 7.5, 0.38], [67, 0.25, 7, 0.32]]) },
  dloop("snap-groove", "Snap groove", ["Hip-Hop"], [[57, "....X.......X..."], [37, "X.......X......."], [70, "..x...x...x...x."]], "Texture"),
];

export function fillProject(input: Project): Project {
  const p: Project = {
    ...input,
    v: 1,
    songId: input.songId || uid("song"),
    snap: input.snap ?? "1/16",
    loop: input.loop ?? null,
    follow: input.follow ?? true,
    tone: input.tone ?? "quiet",
    lyrics: input.lyrics ?? "",
    sections: input.sections ?? [],
    scenes: input.scenes ?? [],
    swing: typeof input.swing === "number" ? Math.min(0.75, Math.max(0, input.swing)) : 0,
    updatedAt: input.updatedAt ?? Date.now(),
    tracks: input.tracks.map((t) => ({
      ...t,
      knobs: t.knobs ?? [0.5, 0.5, 0.5],
      lane: t.lane ?? [],
      laneOn: t.laneOn ?? false,
    })),
    clips: input.clips.map((c) => ({
      ...c,
      mute: c.mute ?? false,
      fadeIn: c.fadeIn ?? 0,
      fadeOut: c.fadeOut ?? 0,
      active: c.active ?? true,
      clipKind: c.clipKind ?? (c.assetId ? "audio" : "midi"),
      articulation: c.articulation ?? "legato",
    })),
  };
  return withBars(p);
}

export function isProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const p = value as Project;
  const kinds = new Set(["drums", "keys", "bass", "lead", "audio"]);
  const ok =
    (p.v === 1 || (p as { v?: number }).v === 2) &&
    typeof p.title === "string" &&
    typeof p.bpm === "number" &&
    (p.timeSig === 3 || p.timeSig === 4) &&
    typeof p.key === "string" &&
    (p.scale === "major" || p.scale === "minor") &&
    Array.isArray(p.tracks) &&
    Array.isArray(p.clips) &&
    p.tracks.every((t) => t && kinds.has(t.kind) && typeof t.id === "string");
  if (!ok) return false;
  p.v = 1;
  const filled = fillProject(p);
  Object.assign(p, filled);
  return true;
}

export function songBeats(p: Project): number {
  return p.bars * p.timeSig;
}

export function songEnd(p: Project): number {
  let end = 0;
  for (const c of p.clips) if (c.active !== false) end = Math.max(end, c.start + c.length);
  return end;
}

export function fadeAt(clip: Clip, absBeat: number): number {
  const local = absBeat - clip.start;
  let g = 1;
  const inn = clip.fadeIn ?? 0;
  const out = clip.fadeOut ?? 0;
  if (inn > 0.001 && local < inn) g *= Math.max(0, local / inn);
  const remain = clip.length - local;
  if (out > 0.001 && remain < out) g *= Math.max(0, remain / out);
  return Math.max(0, Math.min(1, g));
}

export function laneAt(points: Point[] | undefined, beat: number): number {
  if (!points || points.length === 0) return 1;
  const sorted = [...points].sort((a, b) => a.t - b.t);
  if (beat <= sorted[0].t) return sorted[0].v;
  const last = sorted[sorted.length - 1];
  if (beat >= last.t) return last.v;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (beat >= a.t && beat <= b.t) {
      const u = (beat - a.t) / Math.max(0.0001, b.t - a.t);
      return a.v + (b.v - a.v) * u;
    }
  }
  return 1;
}

/** Soft Mastery dynamics: clamp volume-lane multiplier to 0.35–1.0 (swell, not mute gate). */
export function dynamicsAt(points: Point[] | undefined, beat: number, laneOn?: boolean): number {
  if (!laneOn || !points || points.length === 0) return 1;
  return Math.max(0.35, Math.min(1, laneAt(points, beat)));
}

export function knobsAt(base: [number, number, number], lane: KnobPoint[] | undefined, localBeat: number): [number, number, number] {
  const k: [number, number, number] = [...base];
  if (!lane) return k;
  for (const p of lane) {
    if (p.t <= localBeat + 1e-4 && p.i >= 0 && p.i <= 2) k[p.i] = p.v;
  }
  return k;
}
