import { create } from "zustand";
import { cancelRender, engine, renderStems, renderWav, type Transport } from "@/aerie/engine";
import {
  LOOPS,
  MAX_TRACKS,
  SCENE_ROWS,
  SECTION_NAMES,
  createTrack,
  defaultBase,
  defaultSettings,
  emptyRoom,
  fillProject,
  floorSnap,
  maxBeats,
  setSnapMode,
  snap,
  songBeats,
  songEnd,
  uid,
  withBars,
  type Autoplay,
  type Clip,
  type Flavor,
  type LoopDef,
  type Note,
  type Point,
  type Project,
  type SceneCell,
  type SceneRow,
  type SectionName,
  type Settings,
  type SnapMode,
  type ToneName,
  type Track,
  type TrackKind,
} from "@/aerie/model";
import { decodeAsset, rememberBytes } from "@/aerie/buffers";
import { parseMidi } from "@/aerie/midifile";
import {
  loadAsset,
  metaOf,
  packProject,
  readIdbLibrary,
  readLibrary,
  saveAsset,
  scheduleSave,
  unpackProject,
  writeLibrary,
  type LibraryFile,
  type SongMeta,
} from "@/aerie/persist";
import { webmidi } from "@/aerie/webmidi";

export type Bottom = "instrument" | "roll" | "mixer";
export type Screen = "home" | "studio";
export type StudioView = "timeline" | "scenes";

type State = {
  started: boolean;
  screen: Screen;
  view: StudioView;
  library: LibraryFile;
  songs: SongMeta[];
  project: Project;
  settings: Settings;
  past: Project[];
  future: Project[];
  selectedTrackId: string | null;
  selectedClipId: string | null;
  selectedNoteId: string | null;
  armedTrackId: string | null;
  bottom: Bottom;
  panelOpen: boolean;
  libraryOpen: boolean;
  settingsOpen: boolean;
  pickerOpen: boolean;
  templatesOpen: boolean;
  gameExportOpen: boolean;
  notesOpen: boolean;
  helpOpen: boolean;
  zoomBars: number;
  baseMidi: number;
  flavor: Flavor;
  autoplay: Autoplay;
  toast: string | null;
  shareUrl: string | null;
  transport: Transport;
  exporting: boolean;
  exportDone: boolean;
  exportLabel: string | null;
  exportProgress: number;
  launched: (number | null)[];
  queued: (number | null)[];
  midiLabel: string;
  micOn: boolean;
  loopDrag: boolean;
  hydrate: (project: Project | null, settings: Settings, started: boolean) => void;
  toastMsg: (msg: string | null) => void;
  setTitle: (title: string) => void;
  setBpm: (bpm: number) => void;
  setTimeSig: (timeSig: 3 | 4) => void;
  setKey: (key: string) => void;
  setScale: (scale: "major" | "minor") => void;
  setSwing: (swing: number) => void;
  patchSettings: (partial: Partial<Settings>) => void;
  selectTrack: (id: string) => void;
  selectClip: (id: string | null) => void;
  selectNote: (id: string | null) => void;
  arm: (id: string) => void;
  setBottom: (b: Bottom) => void;
  setPanelOpen: (open: boolean) => void;
  setLibrary: (open: boolean) => void;
  setPicker: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setTemplates: (open: boolean) => void;
  setNotesOpen: (open: boolean) => void;
  setHelp: (open: boolean) => void;
  setZoom: (zoomBars: number) => void;
  setBase: (baseMidi: number) => void;
  setFlavor: (flavor: Flavor) => void;
  setAutoplay: (mode: Autoplay) => void;
  setView: (view: StudioView) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  addTrack: (kind: TrackKind, preset: string, name: string) => Track | null;
  patchTrack: (id: string, partial: Partial<Track>) => void;
  removeTrack: (id: string) => void;
  duplicateTrack: (id: string) => void;
  duplicateClip: (id: string) => void;
  putClip: (clip: Clip, history: boolean) => void;
  patchClip: (clip: Clip) => void;
  removeClip: (id: string) => void;
  removeNote: (clipId: string, noteId: string) => void;
  setNotes: (clipId: string, notes: Note[]) => void;
  loadTemplate: (project: Project) => void;
  placeLoop: (loop: LoopDef) => void;
  resetProject: () => void;
  onBeforeTake: () => void;
  onTake: (clip: Clip) => void;
  togglePlay: () => void;
  stop: () => void;
  toggleRecord: () => void;
  seek: (beat: number) => void;
  exportWav: (region?: boolean) => Promise<void>;
  exportStems: () => Promise<void>;
  cancelExport: () => void;
  share: () => Promise<void>;
  openHome: () => void;
  openSong: (id: string) => void;
  duplicateSong: (id: string) => void;
  deleteSong: (id: string) => void;
  renameSong: (id: string, title: string) => void;
  setSnap: (snap: SnapMode) => void;
  setFollow: (follow: boolean) => void;
  setTone: (tone: ToneName) => void;
  setLyrics: (lyrics: string) => void;
  setLoop: (loop: { start: number; end: number } | null) => void;
  splitAt: (beat?: number) => void;
  toggleClipMute: (id: string) => void;
  setKnob: (trackId: string, index: number, value: number) => void;
  toggleLane: (trackId: string) => void;
  putLanePoint: (trackId: string, point: Point) => void;
  addSection: (start: number) => void;
  patchSection: (id: string, partial: { start?: number; length?: number; name?: SectionName }) => void;
  duplicateSection: (id: string) => void;
  queueCell: (row: number, col: number | null) => void;
  launchColumn: (col: number) => void;
  commitScene: () => void;
  fillCell: (row: SceneRow, col: number) => void;
  clearCell: (id: string) => void;
  onBar: () => void;
  chooseTake: (clipId: string) => void;
  importAudioFile: (file: File) => Promise<void>;
  importMidiFile: (file: File) => Promise<void>;
  toggleMic: () => Promise<void>;
  exportJson: () => void;
  exportGamePack: () => Promise<void>;
  importJson: (file: File) => Promise<void>;
  connectMidi: () => Promise<void>;
  saveNow: () => void;
};

let toastTimer = 0;
let takeMarked = false;

function show(msg: string | null) {
  window.clearTimeout(toastTimer);
  useAerie.setState({ toast: msg });
  if (msg) toastTimer = window.setTimeout(() => useAerie.setState({ toast: null }), 2600);
}

function commit(project: Project) {
  return withBars(project);
}

export const useAerie = create<State>((set, get) => ({
  started: false,
  screen: "home",
  view: "timeline",
  library: { currentId: null, metas: [], songs: {} },
  songs: [],
  project: emptyRoom(),
  settings: defaultSettings(),
  past: [],
  future: [],
  selectedTrackId: null,
  selectedClipId: null,
  selectedNoteId: null,
  armedTrackId: null,
  bottom: "instrument",
  panelOpen: false,
  libraryOpen: false,
  settingsOpen: false,
  pickerOpen: false,
  templatesOpen: false,
  gameExportOpen: false,
  notesOpen: false,
  helpOpen: false,
  zoomBars: 8,
  baseMidi: 48,
  flavor: "diatonic",
  autoplay: 0,
  toast: null,
  shareUrl: null,
  transport: "stopped",
  exporting: false,
  exportDone: false,
  exportLabel: null,
  exportProgress: 0,
  launched: [null, null, null, null],
  queued: [null, null, null, null],
  midiLabel: "MIDI off",
  micOn: false,
  loopDrag: false,

  hydrate: (project, settings, started) => {
    const p = fillProject(project ?? emptyRoom());
    setSnapMode(p.snap ?? "1/16");
    set({
      project: p,
      settings,
      started,
      screen: started ? "studio" : "home",
      past: [],
      future: [],
      selectedTrackId: p.tracks[0]?.id ?? null,
      selectedClipId: null,
      selectedNoteId: null,
      armedTrackId: null,
      baseMidi: defaultBase(p.tracks[0]?.kind ?? "keys"),
      transport: "stopped",
    });
    document.documentElement.dataset.contrast = settings.contrast ? "high" : "normal";
    engine.syncSettings(p.bpm, settings.metronome, settings.metronomeLevel, settings.master);
  },

  toastMsg: (msg) => show(msg),

  setTitle: (title) => set((s) => ({ project: { ...s.project, title: title.slice(0, 64) } })),
  setBpm: (bpm) => {
    const next = Math.max(60, Math.min(180, Math.round(bpm)));
    set((s) => ({ project: { ...s.project, bpm: next } }));
    const st = get();
    engine.syncSettings(next, st.settings.metronome, st.settings.metronomeLevel, st.settings.master);
  },
  setTimeSig: (timeSig) => set((s) => ({ project: commit({ ...s.project, timeSig }) })),
  setKey: (key) => set((s) => ({ project: { ...s.project, key } })),
  setScale: (scale) => set((s) => ({ project: { ...s.project, scale } })),
  setSwing: (swing) =>
    set((s) => ({ project: { ...s.project, swing: Math.max(0, Math.min(0.75, swing)) } })),
  patchSettings: (partial) => {
    set((s) => ({ settings: { ...s.settings, ...partial } }));
    const st = get();
    if (partial.contrast !== undefined) {
      document.documentElement.dataset.contrast = st.settings.contrast ? "high" : "normal";
    }
    engine.syncSettings(st.project.bpm, st.settings.metronome, st.settings.metronomeLevel, st.settings.master);
  },

  selectTrack: (id) =>
    set((s) => {
      const t = s.project.tracks.find((x) => x.id === id);
      if (!t) return s;
      const prev = s.project.tracks.find((x) => x.id === s.selectedTrackId);
      const base = !prev || prev.kind !== t.kind ? defaultBase(t.kind) : s.baseMidi;
      return { selectedTrackId: id, baseMidi: base, bottom: "instrument", panelOpen: true };
    }),
  selectClip: (id) =>
    set((s) => {
      if (!id) return { selectedClipId: null, selectedNoteId: null };
      const clip = s.project.clips.find((c) => c.id === id);
      if (!clip) return s;
      const track = s.project.tracks.find((t) => t.id === clip.trackId);
      return {
        selectedClipId: id,
        selectedTrackId: clip.trackId,
        selectedNoteId: null,
        bottom: "roll",
        panelOpen: true,
        baseMidi: track && s.project.tracks.find((t) => t.id === s.selectedTrackId)?.kind !== track.kind
          ? defaultBase(track.kind)
          : s.baseMidi,
      };
    }),
  selectNote: (id) => set({ selectedNoteId: id }),
  arm: (id) =>
    set((s) => ({
      armedTrackId: s.armedTrackId === id ? null : id,
      selectedTrackId: id,
    })),
  setBottom: (bottom) => set({ bottom, panelOpen: true }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setLibrary: (libraryOpen) => set({ libraryOpen }),
  setPicker: (pickerOpen) => set({ pickerOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setTemplates: (templatesOpen) => set({ templatesOpen }),
  setZoom: (zoomBars) => set({ zoomBars: Math.max(1, Math.min(8, zoomBars)) }),
  setBase: (baseMidi) => set({ baseMidi: Math.max(24, Math.min(84, baseMidi)) }),
  setFlavor: (flavor) => set({ flavor }),

  pushHistory: () => set((s) => ({ past: [...s.past, s.project].slice(-40), future: [] })),
  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return {
        past: s.past.slice(0, -1),
        future: [s.project, ...s.future].slice(0, 40),
        project: prev,
        selectedClipId: prev.clips.some((c) => c.id === s.selectedClipId) ? s.selectedClipId : null,
        selectedNoteId: null,
      };
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0];
      if (!next) return s;
      return {
        future: s.future.slice(1),
        past: [...s.past, s.project].slice(-40),
        project: next,
        selectedClipId: next.clips.some((c) => c.id === s.selectedClipId) ? s.selectedClipId : null,
        selectedNoteId: null,
      };
    }),

  addTrack: (kind, preset, name) => {
    const s = get();
    if (s.project.tracks.length >= MAX_TRACKS) {
      show("Soft Mastery beds stay sparse — 12 is the ceiling, not a target.");
      return null;
    }
    const track = createTrack(kind, preset, name, s.project.tracks.length);
    set({
      past: [...s.past, s.project].slice(-40),
      future: [],
      project: { ...s.project, tracks: [...s.project.tracks, track] },
      selectedTrackId: track.id,
      baseMidi: defaultBase(kind),
      bottom: "instrument",
      panelOpen: true,
      pickerOpen: false,
    });
    return track;
  },
  patchTrack: (id, partial) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => (t.id === id ? { ...t, ...partial } : t)),
      },
    })),
  removeTrack: (id) =>
    set((s) => {
      if (!s.project.tracks.some((t) => t.id === id)) return s;
      const tracks = s.project.tracks.filter((t) => t.id !== id);
      const clips = s.project.clips.filter((c) => c.trackId !== id);
      const project = commit({ ...s.project, tracks, clips });
      return {
        past: [...s.past, s.project].slice(-40),
        future: [],
        project,
        selectedTrackId: s.selectedTrackId === id ? (tracks[0]?.id ?? null) : s.selectedTrackId,
        selectedClipId: clips.some((c) => c.id === s.selectedClipId) ? s.selectedClipId : null,
        armedTrackId: s.armedTrackId === id ? null : s.armedTrackId,
      };
    }),
  duplicateTrack: (id) => {
    const s = get();
    const track = s.project.tracks.find((t) => t.id === id);
    if (!track) return;
    if (s.project.tracks.length >= MAX_TRACKS) {
      show("Soft Mastery beds stay sparse — 12 is the ceiling, not a target.");
      return;
    }
    const copy: Track = { ...track, id: uid("trk"), name: `${track.name} copy`.slice(0, 24), solo: false };
    const clips = s.project.clips
      .filter((c) => c.trackId === id)
      .map((c) => ({
        ...c,
        id: uid("clip"),
        trackId: copy.id,
        notes: c.notes.map((n) => ({ ...n, id: uid("n") })),
      }));
    set({
      past: [...s.past, s.project].slice(-40),
      future: [],
      project: commit({ ...s.project, tracks: [...s.project.tracks, copy], clips: [...s.project.clips, ...clips] }),
      selectedTrackId: copy.id,
      armedTrackId: null,
    });
  },
  duplicateClip: (id) => {
    const s = get();
    const clip = s.project.clips.find((c) => c.id === id);
    if (!clip) return;
    const copy: Clip = {
      ...clip,
      id: uid("clip"),
      start: snap(clip.start + clip.length),
      notes: clip.notes.map((n) => ({ ...n, id: uid("n") })),
    };
    get().putClip(copy, true);
  },
  putClip: (clip, history) =>
    set((s) => {
      const clips = s.project.clips.some((c) => c.id === clip.id)
        ? s.project.clips.map((c) => (c.id === clip.id ? clip : c))
        : [...s.project.clips, clip];
      return {
        past: history ? [...s.past, s.project].slice(-40) : s.past,
        future: history ? [] : s.future,
        project: commit({ ...s.project, clips }),
        selectedClipId: clip.id,
        selectedTrackId: clip.trackId,
      };
    }),
  patchClip: (clip) =>
    set((s) => ({
      project: commit({
        ...s.project,
        clips: s.project.clips.map((c) => (c.id === clip.id ? clip : c)),
      }),
    })),
  removeClip: (id) =>
    set((s) => ({
      past: [...s.past, s.project].slice(-40),
      future: [],
      project: commit({ ...s.project, clips: s.project.clips.filter((c) => c.id !== id) }),
      selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
      selectedNoteId: null,
    })),
  removeNote: (clipId, noteId) =>
    set((s) => ({
      past: [...s.past, s.project].slice(-40),
      future: [],
      project: commit({
        ...s.project,
        clips: s.project.clips.map((c) =>
          c.id === clipId ? { ...c, notes: c.notes.filter((n) => n.id !== noteId) } : c,
        ),
      }),
      selectedNoteId: s.selectedNoteId === noteId ? null : s.selectedNoteId,
    })),
  setNotes: (clipId, notes) =>
    set((s) => ({
      project: commit({
        ...s.project,
        clips: s.project.clips.map((c) => {
          if (c.id !== clipId) return c;
          const end = notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0.25);
          return { ...c, notes, length: Math.max(c.length, end), content: Math.max(c.content, end) };
        }),
      }),
    })),
  loadTemplate: (project) => {
    engine.stop();
    const tone = get().settings.toneDefault ?? "quiet";
    const next = fillProject({ ...project, songId: uid("song"), tone: project.tone ?? tone, updatedAt: Date.now() });
    setSnapMode(next.snap ?? "1/16");
    set({
      project: next,
      past: [],
      future: [],
      started: true,
      screen: "studio",
      selectedTrackId: next.tracks[0]?.id ?? null,
      selectedClipId: null,
      selectedNoteId: null,
      armedTrackId: null,
      baseMidi: defaultBase(next.tracks[0]?.kind ?? "keys"),
      bottom: "instrument",
      templatesOpen: false,
  gameExportOpen: false,
      transport: "stopped",
      launched: [null, null, null, null],
      queued: [null, null, null, null],
    });
    engine.syncSettings(next.bpm, get().settings.metronome, get().settings.metronomeLevel, get().settings.master);
    get().saveNow();
  },
  placeLoop: (loop) => {
    const s = get();
    let track =
      s.project.tracks.find((t) => t.kind === loop.kind && t.preset === loop.preset) ??
      s.project.tracks.find((t) => t.kind === loop.kind);
    if (!track) {
      const created = get().addTrack(loop.kind, loop.preset, loop.name);
      if (!created) return;
      track = created;
    }
    const project = get().project;
    const semi = loop.kind === "drums" ? 0 : Math.max(0, ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"].indexOf(project.key));
    const content = loop.bars * 4;
    const start = Math.floor(engine.beat() / project.timeSig) * project.timeSig;
    const room = Math.max(content, songBeats(project) - start);
    const length = Math.min(Math.max(content, 16), Math.max(content, room));
    const clip: Clip = {
      id: uid("clip"),
      trackId: track.id,
      name: loop.name,
      start,
      length,
      content,
      loop: true,
      notes: loop.notes.map((n) => ({
        id: uid("n"),
        pitch: n.pitch + semi,
        start: n.start,
        duration: n.duration,
        velocity: n.velocity,
      })),
    };
    get().putClip(clip, true);
    show("Loop placed.");
  },
  resetProject: () => {
    engine.stop();
    const project = emptyRoom();
    set({
      project,
      past: [],
      future: [],
      started: true,
      selectedTrackId: project.tracks[0].id,
      selectedClipId: null,
      armedTrackId: null,
      baseMidi: 48,
      settingsOpen: false,
      transport: "stopped",
    });
  },
  onBeforeTake: () => {
    if (takeMarked) return;
    takeMarked = true;
    get().pushHistory();
  },
  onTake: (clip) => {
    if (!engine.recording && clip.notes.length === 0) {
      set((s) => ({
        project: commit({ ...s.project, clips: s.project.clips.filter((c) => c.id !== clip.id) }),
        selectedClipId: s.selectedClipId === clip.id ? null : s.selectedClipId,
      }));
      takeMarked = false;
      return;
    }
    set((s) => {
      let clips = s.project.clips.some((c) => c.id === clip.id)
        ? s.project.clips.map((c) => (c.id === clip.id ? clip : c))
        : [...s.project.clips, clip];
      if (clip.takeGroup) {
        clips = clips.map((c) => (c.takeGroup === clip.takeGroup ? { ...c, active: c.id === clip.id } : c));
        const group = clips.filter((c) => c.takeGroup === clip.takeGroup);
        if (group.length > 3) {
          const drop = new Set(group.slice(0, group.length - 3).map((c) => c.id));
          clips = clips.filter((c) => !drop.has(c.id));
        }
      }
      return {
        project: commit({ ...s.project, clips }),
        selectedClipId: clip.id,
        selectedTrackId: clip.trackId,
      };
    });
    if (!engine.recording) takeMarked = false;
  },
  togglePlay: () => {
    engine.ensure();
    engine.play();
  },
  stop: () => engine.stop(),
  toggleRecord: () => {
    const s = get();
    if (s.transport === "recording" || s.transport === "countin") {
      engine.record(false);
      return;
    }
    const armed = s.armedTrackId ?? s.selectedTrackId ?? s.project.tracks[0]?.id ?? null;
    if (!armed) {
      show("Add a track to record.");
      return;
    }
    set({ armedTrackId: armed, selectedTrackId: armed });
    engine.ensure();
    engine.record(s.settings.metronome && s.settings.countIn);
  },
  seek: (beat) => engine.seek(floorSnap(beat)),
  exportWav: async (region) => {
    const s = get();
    if (s.exporting) return;
    const loop = region && s.project.loop && s.project.loop.end > s.project.loop.start ? s.project.loop : null;
    set({ exporting: true, exportLabel: "Rendering…", exportProgress: 0.05 });
    try {
      const blob = await renderWav(s.project, s.settings.master, {
        region: loop,
        onProgress: (phase, value) => set({ exportLabel: phase === "write" ? "Writing file…" : "Rendering…", exportProgress: value }),
      });
      downloadBlob(blob, `${safeName(s.project.title)}.wav`);
      set({ exportDone: true, exportProgress: 1 });
    } catch (err) {
      if ((err as Error).message !== "cancelled") show("Couldn't export. Try again.");
    } finally {
      set({ exporting: false, exportLabel: null });
    }
  },
  exportStems: async () => {
    const s = get();
    if (s.exporting) return;
    set({ exporting: true, exportLabel: "Rendering…", exportProgress: 0.05 });
    try {
      const stems = await renderStems(s.project, s.settings.master, {
        region: s.project.loop && s.project.loop.end > s.project.loop.start ? s.project.loop : null,
        onProgress: (_phase, value) => set({ exportLabel: "Rendering…", exportProgress: value }),
      });
      set({ exportLabel: "Writing file…" });
      for (const stem of stems) downloadBlob(stem.blob, `${safeName(s.project.title)}-${safeName(stem.name)}.wav`);
      set({ exportDone: true, exportProgress: 1 });
    } catch (err) {
      if ((err as Error).message !== "cancelled") show("Couldn't export. Try again.");
    } finally {
      set({ exporting: false, exportLabel: null });
    }
  },
  cancelExport: () => {
    cancelRender();
    set({ exporting: false, exportLabel: null, exportProgress: 0 });
  },
  share: async () => {
    try {
      const data = await packProject(get().project);
      if (data.length > 80000) {
        show("Couldn't share this one. Export a WAV instead.");
        return;
      }
      const url = `${location.origin}${location.pathname}${location.search}#aerie=${data}`;
      try {
        await navigator.clipboard.writeText(url);
        show("Link copied.");
      } catch {
        set({ shareUrl: url });
        show("Link ready.");
      }
    } catch {
      show("Couldn't share this one. Export a WAV instead.");
    }
  },
  openHome: () => {
    engine.stop();
    get().saveNow();
    set({ screen: "home", transport: "stopped" });
  },
  openSong: (id) => {
    const saved = get().library.songs[id];
    if (!saved) return;
    engine.stop();
    const project = fillProject(saved.project);
    setSnapMode(project.snap ?? "1/16");
    set({
      project,
      settings: { ...defaultSettings(), ...saved.settings },
      screen: "studio",
      started: true,
      past: [],
      future: [],
      selectedTrackId: project.tracks[0]?.id ?? null,
      selectedClipId: null,
      library: { ...get().library, currentId: id },
      launched: [null, null, null, null],
      queued: [null, null, null, null],
    });
    engine.syncSettings(project.bpm, get().settings.metronome, get().settings.metronomeLevel, get().settings.master);
    void hydrateAssets(project);
  },
  duplicateSong: (id) => {
    const saved = get().library.songs[id];
    if (!saved) return;
    const songId = uid("song");
    const project = fillProject({ ...saved.project, songId, title: `${saved.project.title} copy`.slice(0, 64), updatedAt: Date.now() });
    const songs = { ...get().library.songs, [songId]: { project, settings: saved.settings } };
    const metas = Object.values(songs).map((s) => metaOf(s.project)).sort((a, b) => b.updatedAt - a.updatedAt);
    const library = writeLibrary({ currentId: get().library.currentId, metas, songs });
    set({ library, songs: library.metas });
  },
  deleteSong: (id) => {
    const songs = { ...get().library.songs };
    delete songs[id];
    const metas = Object.values(songs).map((s) => metaOf(s.project)).sort((a, b) => b.updatedAt - a.updatedAt);
    const currentId = get().library.currentId === id ? metas[0]?.id ?? null : get().library.currentId;
    const library = writeLibrary({ currentId, metas, songs });
    set({ library, songs: library.metas });
  },
  renameSong: (id, title) => {
    const saved = get().library.songs[id];
    if (!saved) return;
    const project = { ...saved.project, title: title.slice(0, 64), updatedAt: Date.now() };
    const songs = { ...get().library.songs, [id]: { ...saved, project } };
    const library = writeLibrary({ ...get().library, songs, metas: Object.values(songs).map((s) => metaOf(s.project)) });
    set({ library, songs: library.metas, project: get().project.songId === id ? project : get().project });
  },
  setSnap: (mode) => {
    setSnapMode(mode);
    set((s) => ({ project: { ...s.project, snap: mode } }));
  },
  setFollow: (follow) => set((s) => ({ project: { ...s.project, follow } })),
  setTone: (tone) => set((s) => ({ project: { ...s.project, tone } })),
  setLyrics: (lyrics) => set((s) => ({ project: { ...s.project, lyrics: lyrics.slice(0, 8000) } })),
  setLoop: (loop) => set((s) => ({ project: { ...s.project, loop } })),
  setView: (view) => set({ view }),
  setAutoplay: (autoplay) => set({ autoplay }),
  setNotesOpen: (notesOpen) => set({ notesOpen }),
  setHelp: (helpOpen) => set({ helpOpen }),
  splitAt: (beat) => {
    const s = get();
    const id = s.selectedClipId;
    const clip = s.project.clips.find((c) => c.id === id);
    if (!clip || clip.clipKind === "audio") return;
    const at = beat ?? engine.beat();
    const local = at - clip.start;
    if (local <= 0.05 || local >= clip.length - 0.05) return;
    const left: Clip = {
      ...clip,
      length: snap(local),
      notes: clip.notes.filter((n) => n.start < local).map((n) => ({ ...n, duration: Math.min(n.duration, local - n.start) })),
    };
    const right: Clip = {
      ...clip,
      id: uid("clip"),
      name: `${clip.name} b`.slice(0, 24),
      start: clip.start + left.length,
      length: clip.length - left.length,
      notes: clip.notes
        .filter((n) => n.start + n.duration > local)
        .map((n) => ({ ...n, id: uid("n"), start: Math.max(0, n.start - left.length) })),
    };
    set((st) => ({
      past: [...st.past, st.project].slice(-40),
      future: [],
      project: commit({ ...st.project, clips: st.project.clips.map((c) => (c.id === clip.id ? left : c)).concat(right) }),
      selectedClipId: right.id,
    }));
  },
  toggleClipMute: (id) =>
    set((s) => ({
      past: [...s.past, s.project].slice(-40),
      future: [],
      project: { ...s.project, clips: s.project.clips.map((c) => (c.id === id ? { ...c, mute: !c.mute } : c)) },
    })),
  setKnob: (trackId, index, value) => {
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => {
          if (t.id !== trackId) return t;
          const knobs = [...(t.knobs ?? [0.5, 0.5, 0.5])] as [number, number, number];
          knobs[index] = value;
          return { ...t, knobs };
        }),
      },
    }));
    if (engine.recording) engine.recordKnob(index, value);
  },
  toggleLane: (trackId) =>
    set((s) => ({
      project: { ...s.project, tracks: s.project.tracks.map((t) => (t.id === trackId ? { ...t, laneOn: !t.laneOn } : t)) },
    })),
  putLanePoint: (trackId, point) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => {
          if (t.id !== trackId) return t;
          const clamped = { ...point, v: Math.max(0.35, Math.min(1, point.v)) };
          const lane = [...(t.lane ?? []).filter((p) => Math.abs(p.t - clamped.t) > 0.05), clamped].sort((a, b) => a.t - b.t);
          return { ...t, lane };
        }),
      },
    })),
  addSection: (start) => {
    const s = get();
    const sections = s.project.sections ?? [];
    const name = SECTION_NAMES[sections.length % SECTION_NAMES.length];
    const section = { id: uid("sec"), name, start: snap(start), length: s.project.timeSig * 4 };
    if (section.start + section.length > maxBeats(s.project.bpm)) {
      show("Four minutes is the room’s limit.");
      return;
    }
    set({ past: [...s.past, s.project].slice(-40), future: [], project: { ...s.project, sections: [...sections, section] } });
  },
  patchSection: (id, partial) =>
    set((s) => ({
      project: {
        ...s.project,
        sections: (s.project.sections ?? []).map((sec) => (sec.id === id ? { ...sec, ...partial } : sec)),
      },
    })),
  duplicateSection: (id) => {
    const s = get();
    const sec = (s.project.sections ?? []).find((x) => x.id === id);
    if (!sec) return;
    const dest = snap(sec.start + sec.length);
    if (dest + sec.length > maxBeats(s.project.bpm)) {
      show("Four minutes is the room’s limit.");
      return;
    }
    const copyClips = s.project.clips
      .filter((c) => c.start >= sec.start - 0.01 && c.start < sec.start + sec.length)
      .map((c) => ({
        ...c,
        id: uid("clip"),
        start: c.start + sec.length,
        notes: c.notes.map((n) => ({ ...n, id: uid("n") })),
      }));
    const copy = { ...sec, id: uid("sec"), start: dest };
    set({
      past: [...s.past, s.project].slice(-40),
      future: [],
      project: commit({
        ...s.project,
        sections: [...(s.project.sections ?? []), copy],
        clips: [...s.project.clips, ...copyClips],
      }),
    });
  },
  queueCell: (row, col) => {
    const turningOn = col != null && get().queued[row] !== col;
    set((s) => {
      const queued = [...s.queued];
      queued[row] = queued[row] === col ? null : col;
      return { queued };
    });
    if (turningOn) startTransport();
  },
  launchColumn: (col) => {
    set((s) => {
      const queued = SCENE_ROWS.map((row, i) => ((s.project.scenes ?? []).some((c) => c.row === row && c.col === col) ? col : s.queued[i]));
      return { queued };
    });
    if (get().queued.some((c) => c != null)) startTransport();
  },
  onBar: () => set((s) => ({ launched: [...s.queued] })),
  commitScene: () => {
    const s = get();
    const start = Math.floor(engine.beat() / s.project.timeSig) * s.project.timeSig;
    let tracks = [...s.project.tracks];
    const clips = [...s.project.clips];
    s.launched.forEach((col, i) => {
      if (col == null) return;
      const row = SCENE_ROWS[i];
      const cell = (s.project.scenes ?? []).find((c) => c.row === row && c.col === col);
      if (!cell) return;
      let track = tracks.find((t) => t.kind === row);
      if (!track) {
        if (tracks.length >= MAX_TRACKS) return;
        track = createTrack(row, cell.preset, row[0].toUpperCase() + row.slice(1), tracks.length);
        tracks = [...tracks, track];
      }
      const content = Math.max(s.project.timeSig, cell.bars * s.project.timeSig);
      clips.push({
        id: uid("clip"),
        trackId: track.id,
        name: cell.name,
        start,
        length: content,
        content,
        loop: true,
        notes: cell.notes.map((n) => ({ ...n, id: uid("n") })),
        active: true,
        clipKind: "midi",
      });
    });
    set({
      past: [...s.past, s.project].slice(-40),
      future: [],
      view: "timeline",
      project: commit({ ...s.project, tracks, clips }),
    });
    show("Scene committed.");
  },
  fillCell: (row, col) => {
    const s = get();
    const existing = (s.project.scenes ?? []).find((c) => c.row === row && c.col === col);
    if (existing) {
      get().queueCell(SCENE_ROWS.indexOf(row), col);
      return;
    }
    const selected = s.project.clips.find((c) => c.id === s.selectedClipId);
    const fromTrack = selected ? s.project.tracks.find((t) => t.id === selected.trackId) : undefined;
    const preset = fromTrack?.kind === row ? fromTrack.preset : row === "drums" ? "kit" : row === "bass" ? "finger" : row === "lead" ? "bell" : "piano";
    const picked = LOOPS.find((l) => l.kind === row);
    const notes =
      fromTrack?.kind === row && selected
        ? selected.notes.map(({ pitch, start, duration, velocity }) => ({ pitch, start, duration, velocity }))
        : (picked?.notes ?? []);
    const cell: SceneCell = {
      id: uid("cell"),
      row,
      col,
      name: selected && fromTrack?.kind === row ? selected.name : picked?.name ?? "Loop",
      preset: fromTrack?.kind === row ? fromTrack.preset : picked?.preset ?? preset,
      bars: picked && !(selected && fromTrack?.kind === row) ? picked.bars : 1,
      notes,
    };
    set((st) => ({ project: { ...st.project, scenes: [...(st.project.scenes ?? []), cell] } }));
    get().queueCell(SCENE_ROWS.indexOf(row), col);
  },
  clearCell: (id) =>
    set((s) => ({ project: { ...s.project, scenes: (s.project.scenes ?? []).filter((c) => c.id !== id) } })),
  chooseTake: (clipId) =>
    set((s) => {
      const clip = s.project.clips.find((c) => c.id === clipId);
      if (!clip?.takeGroup) return s;
      return {
        project: {
          ...s.project,
          clips: s.project.clips.map((c) => (c.takeGroup === clip.takeGroup ? { ...c, active: c.id === clipId } : c)),
        },
        selectedClipId: clipId,
      };
    }),
  importAudioFile: async (file) => {
    await importAudioBlob(file, file.name.replace(/\.[^.]+$/, ""));
  },
  importMidiFile: async (file) => {
    const data = new Uint8Array(await file.arrayBuffer());
    const notes = parseMidi(data);
    if (!notes?.length) {
      show("Couldn't read that MIDI file.");
      return;
    }
    const s = get();
    let track = s.project.tracks.find((t) => t.id === s.selectedTrackId && t.kind !== "drums" && t.kind !== "audio");
    if (!track) {
      const created = get().addTrack("keys", "piano", "MIDI");
      if (!created) return;
      track = created;
    }
    const end = notes.reduce((m, n) => Math.max(m, n.start + n.duration), 1);
    if (end > maxBeats(get().project.bpm)) {
      show("Four minutes is the room’s limit.");
      return;
    }
    get().putClip(
      {
        id: uid("clip"),
        trackId: track.id,
        name: file.name.replace(/\.[^.]+$/, "").slice(0, 24) || "MIDI",
        start: 0,
        length: end,
        content: end,
        loop: false,
        notes,
        active: true,
        clipKind: "midi",
      },
      true,
    );
  },
  toggleMic: async () => {
    if (get().micOn) {
      const blob = await stopMic();
      set({ micOn: false });
      if (blob.size) await importAudioBlob(blob, "Mic");
      return;
    }
    const ok = await startMic();
    if (!ok) {
      show("Microphone stayed off. You can still play and record MIDI.");
      set({ micOn: false });
      return;
    }
    set({ micOn: true });
  },
  exportJson: () => {
    const project = get().project;
    const blob = new Blob([JSON.stringify(project)], { type: "application/json" });
    downloadBlob(blob, `${safeName(project.title)}.json`);
  },
  exportGamePack: async () => {
    const s = get();
    if (s.exporting) return;
    const title = safeName(s.project.title);
    const loop = s.project.loop && s.project.loop.end > s.project.loop.start ? s.project.loop : null;
    set({ exporting: true, exportLabel: "Game pack…", exportProgress: 0.05 });
    try {
      const mix = await renderWav(s.project, s.settings.master, {
        region: loop,
        onProgress: (phase, value) => set({ exportLabel: phase === "write" ? "Writing mix…" : "Rendering mix…", exportProgress: value * 0.4 }),
      });
      downloadBlob(mix, `${title}-bed.wav`);
      set({ exportLabel: "Rendering stems…", exportProgress: 0.45 });
      const stems = await renderStems(s.project, s.settings.master, {
        region: loop,
        onProgress: (_p, value) => set({ exportLabel: "Rendering stems…", exportProgress: 0.45 + value * 0.4 }),
      });
      for (const stem of stems) downloadBlob(stem.blob, `${title}-stem-${safeName(stem.name)}.wav`);
      const meta = {
        ...s.project,
        gameExport: {
          naming: "{title}-{role}.wav",
          roles: ["bed", "bed-mature", "chime", "stem-{track}"],
          tip: "Tone Quiet · kit off for tend beds · check loop seam · bed quieter than SFX",
        },
      };
      downloadBlob(new Blob([JSON.stringify(meta, null, 2)], { type: "application/json" }), `${title}.json`);
      set({ exportDone: true, exportProgress: 1 });
      show("Game pack ready — mix, stems, and project.");
    } catch (err) {
      if ((err as Error).message !== "cancelled") show("Couldn't export. Try again.");
    } finally {
      set({ exporting: false, exportLabel: null });
    }
  },
  importJson: async (file) => {
    try {
      const data = JSON.parse(await file.text()) as unknown;
      if (!data || typeof data !== "object") throw new Error("bad");
      const project = fillProject({ ...(data as Project), songId: uid("song"), v: 1 });
      get().loadTemplate(project);
    } catch {
      show("Couldn't open that project.");
    }
  },
  connectMidi: async () => {
    await webmidi.connect(
      {
        status: (text) => set({ midiLabel: text }),
        note: (midi, vel, down) => {
          const s = useAerie.getState();
          const id = s.armedTrackId ?? s.selectedTrackId;
          const track = s.project.tracks.find((t) => t.id === id);
          if (!track || track.kind === "audio") return;
          if (down) {
            if (track.kind === "drums") engine.hitDrum(track.id, midi, vel || 0.8);
            else engine.playKey(track.id, midi, vel || 0.8);
          } else if (track.kind !== "drums") engine.releaseKey(track.id, midi);
        },
      },
      get().settings.midiPortId ?? null,
      !!get().settings.midiEcho,
    );
    if (webmidi.portId) get().patchSettings({ midiPortId: webmidi.portId });
  },
  saveNow: () => {
    const s = get();
    const id = s.project.songId;
    if (!s.started || !id) return;
    const project = { ...s.project, songId: id, updatedAt: Date.now() };
    const songs: LibraryFile["songs"] = { ...s.library.songs, [id]: { project, settings: s.settings } };
    const library = writeLibrary({ currentId: id, songs, metas: Object.values(songs).map((x) => metaOf(x.project)) });
    set({ library, songs: library.metas, project });
  },
}));

let attached = false;
let micRec: MediaRecorder | null = null;
let micChunks: Blob[] = [];
let micStream: MediaStream | null = null;

function safeName(title: string) {
  return title.replace(/[^\w\s-]+/g, "").trim() || "aerie";
}

function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function hydrateAssets(project: Project) {
  const ctx = new AudioContext();
  for (const clip of project.clips) {
    if (!clip.assetId) continue;
    const data = await loadAsset(clip.assetId);
    if (!data) continue;
    rememberBytes(clip.assetId, data);
    await decodeAsset(ctx, clip.assetId, data.slice(0)).catch(() => undefined);
  }
  void ctx.close();
}

async function importAudioBlob(file: Blob, name: string) {
  const s = useAerie.getState();
  if (s.project.tracks.length >= MAX_TRACKS && !s.project.tracks.some((t) => t.kind === "audio")) {
    show("Soft Mastery beds stay sparse — 12 is the ceiling, not a target.");
    return;
  }
  let track = s.project.tracks.find((t) => t.kind === "audio");
  if (!track) {
    const created = useAerie.getState().addTrack("audio", "file", "Audio");
    if (!created) return;
    track = created;
  }
  const id = uid("aud");
  const data = await file.arrayBuffer();
  await saveAsset(id, data);
  const ctx = new AudioContext();
  const audio = await decodeAsset(ctx, id, data.slice(0));
  void ctx.close();
  const beats = Math.min(maxBeats(useAerie.getState().project.bpm), Math.max(1, audio.duration * (useAerie.getState().project.bpm / 60)));
  if (audio.duration > 4 * 60) show("Four minutes is the room’s limit.");
  useAerie.getState().putClip(
    {
      id: uid("clip"),
      trackId: track.id,
      name: name.slice(0, 24) || "Audio",
      start: 0,
      length: beats,
      content: beats,
      loop: false,
      notes: [],
      assetId: id,
      clipKind: "audio",
      active: true,
    },
    true,
  );
}

async function startMic(): Promise<boolean> {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return false;
  }
  micChunks = [];
  micRec = new MediaRecorder(micStream);
  micRec.ondataavailable = (e) => {
    if (e.data.size) micChunks.push(e.data);
  };
  micRec.start();
  return true;
}

function stopMic(): Promise<Blob> {
  return new Promise((resolve) => {
    if (!micRec) {
      resolve(new Blob());
      return;
    }
    micRec.onstop = () => {
      const blob = new Blob(micChunks, { type: micRec?.mimeType || "audio/webm" });
      micStream?.getTracks().forEach((t) => t.stop());
      micRec = null;
      micStream = null;
      resolve(blob);
    };
    micRec.stop();
  });
}

function startTransport() {
  engine.ensure();
  if (!engine.playing && !engine.counting) engine.play();
}

export function attachEngine() {
  if (attached) return;
  attached = true;
  engine.attach({
    getProject: () => useAerie.getState().project,
    getArmed: () => useAerie.getState().armedTrackId,
    getSelectedClipId: () => useAerie.getState().selectedClipId,
    onTransport: (transport) => useAerie.setState({ transport }),
    onBeforeTake: () => useAerie.getState().onBeforeTake(),
    onTake: (clip) => useAerie.getState().onTake(clip),
    getScenes: () => {
      const s = useAerie.getState();
      const launched = s.launched.map((col, i) => {
        if (col == null) return null;
        return (s.project.scenes ?? []).find((c) => c.row === SCENE_ROWS[i] && c.col === col) ?? null;
      });
      return { mode: s.view, launched };
    },
    onBar: () => useAerie.getState().onBar(),
  });
  useAerie.subscribe((state, prev) => {
    if (!state.started) return;
    if (state.project !== prev.project || state.settings !== prev.settings) {
      scheduleSave(state.project, state.settings, state.library);
    }
  });
  window.setInterval(() => useAerie.getState().saveNow(), 10000);
  window.addEventListener("blur", () => useAerie.getState().saveNow());
  window.addEventListener("pagehide", () => useAerie.getState().saveNow());
}

export async function bootAerie() {
  attachEngine();
  const hash = location.hash.startsWith("#aerie=") ? location.hash.slice(7) : "";
  let library = readLibrary();
  const idb = await readIdbLibrary();
  if (idb && idb.metas.length > library.metas.length) library = idb;
  const alreadyIn = useAerie.getState().screen === "studio";
  useAerie.setState({ library, songs: library.metas, started: true, ...(alreadyIn ? {} : { screen: "home" }) });
  if (hash && !alreadyIn) {
    const project = await unpackProject(hash);
    if (project) {
      useAerie.getState().loadTemplate(project);
      return;
    }
    show("Couldn't open that link.");
  }
  for (const saved of Object.values(library.songs)) void hydrateAssets(saved.project);
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  }
}
