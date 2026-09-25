import { useRef, useState } from "react";
import {
  DRUMS,
  LOOPS,
  PRESETS,
  SNAP,
  nearestInScale,
  snap,
  uid,
  type Category,
  type Clip,
  type Note,
  type ReverbSize,
  type Track,
} from "@/aerie/model";
import { engine } from "@/aerie/engine";
import { useAerie } from "@/aerie/store";

const ROW = 18;

export function Mixer() {
  const project = useAerie((s) => s.project);
  const patchTrack = useAerie((s) => s.patchTrack);
  const removeTrack = useAerie((s) => s.removeTrack);
  return (
    <div className="mixer">
      {project.tracks.map((track) => (
        <div className="strip" key={track.id} data-tint={track.tint}>
          <input
            className="strip-name"
            aria-label="Track name"
            value={track.name}
            onChange={(e) => patchTrack(track.id, { name: e.target.value.slice(0, 24) })}
          />
          <label className="fader">
            <span>Level</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={track.volume}
              aria-label={`${track.name} level`}
              onChange={(e) => patchTrack(track.id, { volume: Number(e.target.value) })}
            />
          </label>
          <label className="fader">
            <span>Pan</span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={track.pan}
              aria-label={`${track.name} pan`}
              onChange={(e) => patchTrack(track.id, { pan: Number(e.target.value) })}
            />
          </label>
          <div className="strip-toggles">
            <button type="button" className={track.mute ? "mini on" : "mini"} onClick={() => patchTrack(track.id, { mute: !track.mute })}>
              M
            </button>
            <button type="button" className={track.solo ? "mini on" : "mini"} onClick={() => patchTrack(track.id, { solo: !track.solo })}>
              S
            </button>
          </div>
          <label className="fader">
            <span>Low</span>
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={track.eqLow}
              aria-label={`${track.name} low`}
              onChange={(e) => patchTrack(track.id, { eqLow: Number(e.target.value) })}
            />
          </label>
          <label className="fader">
            <span>High</span>
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={track.eqHigh}
              aria-label={`${track.name} high`}
              onChange={(e) => patchTrack(track.id, { eqHigh: Number(e.target.value) })}
            />
          </label>
          <label>
            Reverb
            <select
              value={track.reverb}
              aria-label={`${track.name} reverb`}
              onChange={(e) => patchTrack(track.id, { reverb: e.target.value as ReverbSize })}
            >
              <option value="off">Off</option>
              <option value="small">Small</option>
              <option value="room">Room</option>
              <option value="hall">Hall</option>
            </select>
          </label>
          <button
            type="button"
            className={track.delay ? "chip on" : "chip"}
            onClick={() => patchTrack(track.id, { delay: !track.delay })}
          >
            Delay
          </button>
          <button type="button" className={track.laneOn ? "text-btn on" : "text-btn"} onClick={() => useAerie.getState().toggleLane(track.id)}>
            Lane
          </button>
          <button type="button" className="text-btn danger" onClick={() => removeTrack(track.id)}>
            Remove
          </button>
        </div>
      ))}
      {project.tracks.length === 0 ? <p className="quiet">Add a track to mix.</p> : null}
    </div>
  );
}

export function Library() {
  const [cat, setCat] = useState<Category>("Drums");
  const [tag, setTag] = useState<string>("All");
  const placeLoop = useAerie((s) => s.placeLoop);
  const project = useAerie((s) => s.project);
  const tags = ["All", "Lo-fi", "Pop", "Hip-Hop", "Indie", "Ambient"];
  const items = LOOPS.filter((l) => l.category === cat && (tag === "All" || l.tags.includes(tag)));
  return (
    <div className="library">
      <div className="lib-head">
        <strong>Loops</strong>
        <button type="button" className="icon-btn" onClick={() => useAerie.getState().setLibrary(false)} aria-label="Close loops">
          ×
        </button>
      </div>
      <div className="seg wrap">
        {(["Drums", "Bass", "Keys", "Texture"] as Category[]).map((c) => (
          <button key={c} type="button" className={cat === c ? "chip on" : "chip"} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="seg wrap">
        {tags.map((t) => (
          <button key={t} type="button" className={tag === t ? "chip on" : "chip"} onClick={() => setTag(t)}>
            {t}
          </button>
        ))}
      </div>
      <ul className="loop-list">
        {items.map((loop) => (
          <li key={loop.id}>
            <button
              type="button"
              className="loop-name"
              onClick={() => engine.previewLoop(loop.kind, loop.preset, loop.notes, project.bpm)}
            >
              <b>{loop.name}</b>
              <span>{loop.tags.join(" · ")}</span>
            </button>
            <button type="button" className="text-btn" onClick={() => placeLoop(loop)}>
              Place
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Picker() {
  const addTrack = useAerie((s) => s.addTrack);
  const close = () => useAerie.getState().setPicker(false);
  const tiles: { kind: Track["kind"]; preset: string; name: string; blurb: string }[] = [
    { kind: "drums", preset: "kit", name: "Drum Kit", blurb: "Pads and a one-bar step loop." },
    { kind: "keys", preset: "piano", name: "Keys", blurb: "Piano, organ, pad, strings." },
    { kind: "bass", preset: "finger", name: "Bass", blurb: "Finger, synth, or 808 sub." },
    { kind: "lead", preset: "lead", name: "Lead", blurb: "Analog, bell, or a soft pluck." },
    { kind: "audio", preset: "file", name: "Audio", blurb: "A file or the microphone." },
    { kind: "keys", preset: "piano", name: "Smart Chords", blurb: "Tap a chord in the song key." },
  ];
  return (
    <div className="overlay" onPointerDown={close}>
      <div className="dialog" onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-label="Add track">
        <header>
          <h2>Add track</h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close">
            ×
          </button>
        </header>
        <div className="tiles">
          {tiles.map((tile) => (
            <button
              key={tile.name}
              type="button"
              className="tile"
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") engine.previewInstrument(tile.kind, tile.preset);
              }}
              onPointerDown={(e) => {
                if (e.pointerType !== "mouse") engine.previewInstrument(tile.kind, tile.preset);
              }}
              onClick={() => addTrack(tile.kind, tile.preset, tile.name === "Smart Chords" ? "Chords" : tile.name)}
            >
              <b>{tile.name}</b>
              <span>{tile.blurb}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PianoRoll() {
  const project = useAerie((s) => s.project);
  const selectedClipId = useAerie((s) => s.selectedClipId);
  const selectedNoteId = useAerie((s) => s.selectedNoteId);
  const selectNote = useAerie((s) => s.selectNote);
  const pushHistory = useAerie((s) => s.pushHistory);
  const setNotes = useAerie((s) => s.setNotes);
  const clip = project.clips.find((c) => c.id === selectedClipId) ?? null;
  const track = clip ? project.tracks.find((t) => t.id === clip.trackId) : undefined;
  if (!clip || !track) {
    return <div className="roll-empty">Select a clip to edit notes.</div>;
  }
  return <RollBody clip={clip} track={track} selectedNoteId={selectedNoteId} selectNote={selectNote} pushHistory={pushHistory} setNotes={setNotes} />;
}

function RollBody({
  clip,
  track,
  selectedNoteId,
  selectNote,
  pushHistory,
  setNotes,
}: {
  clip: Clip;
  track: Track;
  selectedNoteId: string | null;
  selectNote: (id: string | null) => void;
  pushHistory: () => void;
  setNotes: (clipId: string, notes: Note[]) => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const drums = track.kind === "drums";
  const rows = drumOrPiano(track, clip);
  const beats = Math.max(clip.length, 4);
  const ppb = 64;

  function pitchAt(row: number) {
    return rows[row]?.pitch;
  }

  function write(notes: Note[]) {
    setNotes(clip.id, notes);
  }

  function onDown(e: React.PointerEvent) {
    if (!grid.current) return;
    const rect = grid.current.getBoundingClientRect();
    const x = e.clientX - rect.left + grid.current.scrollLeft;
    const y = e.clientY - rect.top + grid.current.scrollTop;
    const beat = Math.max(0, snap(x / ppb));
    const row = Math.max(0, Math.min(rows.length - 1, Math.floor(y / ROW)));
    const pitchRaw = pitchAt(row);
    const lock = useAerie.getState().settings.scaleLock && !drums;
    const song = useAerie.getState().project;
    const pitch = pitchRaw == null ? undefined : lock ? nearestInScale(pitchRaw, song.key, song.scale) : pitchRaw;
    if (pitch == null) return;
    const hit = clip.notes.find((n) => {
      const r = rows.findIndex((rowDef) => rowDef.pitch === n.pitch);
      if (r < 0) return false;
      const nx = n.start * ppb;
      const ny = r * ROW;
      return x >= nx && x <= nx + Math.max(8, n.duration * ppb) && y >= ny && y <= ny + ROW;
    });
    pushHistory();
    if (!hit) {
      const note: Note = {
        id: uid("n"),
        pitch,
        start: beat,
        duration: drums ? 0.25 : 1,
        velocity: 0.8,
      };
      selectNote(note.id);
      const notes = [...clip.notes, note];
      write(notes);
      drag(e, note, notes, "paint");
      return;
    }
    selectNote(hit.id);
    const localX = x - hit.start * ppb;
    const mode = localX > hit.duration * ppb - 8 ? "resize" : "move";
    drag(e, hit, clip.notes, mode);
  }

  function drag(e: React.PointerEvent, note: Note, origin: Note[], mode: "paint" | "move" | "resize") {
    const startX = e.clientX;
    const startY = e.clientY;
    const move = (ev: PointerEvent) => {
      const db = snap((ev.clientX - startX) / ppb);
      const dr = Math.round((ev.clientY - startY) / ROW);
      const notes = origin.map((n) => ({ ...n }));
      const cur = notes.find((n) => n.id === note.id);
      if (!cur) return;
      if (mode === "resize" || mode === "paint") {
        cur.duration = Math.max(SNAP, snap(note.duration + db));
      } else {
        cur.start = Math.max(0, snap(note.start + db));
        const from = rows.findIndex((r) => r.pitch === note.pitch);
        const next = rows[Math.max(0, Math.min(rows.length - 1, from + dr))];
        if (next) {
          const locked = useAerie.getState().settings.scaleLock && track.kind !== "drums";
          const song = useAerie.getState().project;
          cur.pitch = locked ? nearestInScale(next.pitch, song.key, song.scale) : next.pitch;
        }
        const rowTop = (from + dr) * ROW;
        const yIn = ev.clientY - (grid.current?.getBoundingClientRect().top ?? 0) + (grid.current?.scrollTop ?? 0) - rowTop;
        if (yIn < 6) cur.velocity = Math.max(0.2, Math.min(1, note.velocity + (startY - ev.clientY) / 80));
      }
      write(notes);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className="roll">
      <div className="roll-tools">
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            pushHistory();
            setNotes(
              clip.id,
              clip.notes.map((n) => ({
                ...n,
                start: snap(n.start),
                duration: Math.max(0.25, snap(n.duration) || 0.25),
              })),
            );
          }}
        >
          Quantize
        </button>
      </div>
      <div className="roll-keys">
        {rows.map((r) => (
          <div key={r.pitch} className={r.black ? "roll-key black-key" : "roll-key"}>
            {r.label}
          </div>
        ))}
      </div>
      <div className="roll-grid" ref={grid} onPointerDown={onDown} style={{ width: beats * ppb }}>
        {rows.map((r, i) => (
          <div key={r.pitch} className="roll-lane" style={{ top: i * ROW, width: beats * ppb }} />
        ))}
        {clip.notes.map((n) => {
          const i = rows.findIndex((r) => r.pitch === n.pitch);
          if (i < 0) return null;
          const h = ROW * (0.35 + 0.6 * n.velocity);
          return (
            <div
              key={n.id}
              className={n.id === selectedNoteId ? "roll-note on" : "roll-note"}
              style={{ left: n.start * ppb, width: Math.max(6, n.duration * ppb), top: i * ROW + (ROW - h), height: h }}
            />
          );
        })}
      </div>
    </div>
  );
}

function drumOrPiano(track: Track, clip: Clip): { pitch: number; label: string; black?: boolean }[] {
  if (track.kind === "drums") return DRUMS.map((d) => ({ pitch: d.midi, label: d.name }));
  let low = track.kind === "bass" ? 28 : track.kind === "lead" ? 48 : 36;
  let high = low + 24;
  for (const n of clip.notes) {
    low = Math.min(low, n.pitch - 2);
    high = Math.max(high, n.pitch + 2);
  }
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const rows = [];
  for (let m = high; m >= low; m--) {
    const pc = ((m % 12) + 12) % 12;
    const octave = Math.floor(m / 12) - 1;
    rows.push({ pitch: m, label: `${names[pc]}${octave}`, black: [1, 3, 6, 8, 10].includes(pc) });
  }
  return rows;
}

export function SettingsPanel() {
  const settings = useAerie((s) => s.settings);
  const patch = useAerie((s) => s.patchSettings);
  const reset = useAerie((s) => s.resetProject);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="settings">
      <label>
        Metronome level
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={settings.metronomeLevel}
          onChange={(e) => patch({ metronomeLevel: Number(e.target.value) })}
        />
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.countIn} onChange={(e) => patch({ countIn: e.target.checked })} />
        1-bar count-in
      </label>
      <label className="check">
        <input type="checkbox" checked={!!settings.scaleLock} onChange={(e) => patch({ scaleLock: e.target.checked })} />
        Scale lock
      </label>
      <label className="check">
        <input type="checkbox" checked={!!settings.midiEcho} onChange={(e) => patch({ midiEcho: e.target.checked })} />
        Echo to MIDI out
      </label>
      <label>
        New songs tone
        <select value={settings.toneDefault ?? "quiet"} onChange={(e) => patch({ toneDefault: e.target.value as "off" | "quiet" | "warm" | "present" })}>
          <option value="off">Off</option>
          <option value="quiet">Quiet</option>
          <option value="warm">Warm</option>
          <option value="present">Present</option>
        </select>
      </label>
      {confirm ? (
        <div className="confirm">
          <span>Reset this song?</span>
          <button type="button" className="text-btn" onClick={() => setConfirm(false)}>
            Keep
          </button>
          <button type="button" className="text-btn" onClick={reset}>
            Reset
          </button>
        </div>
      ) : (
        <button type="button" className="text-btn" onClick={() => setConfirm(true)}>
          Reset project
        </button>
      )}
    </div>
  );
}

export function presetBlurb(kind: Track["kind"], preset: string): string {
  return PRESETS[kind].find((p) => p.id === preset)?.name ?? preset;
}
