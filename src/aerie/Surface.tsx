import { useMemo, useState } from "react";
import { DRUMS, KNOBS, PRESETS, chordPitches, nearestInScale, presetName, roman, scaleSet, smartFigure, uid, type Clip, type Note, type Track } from "@/aerie/model";
import { engine } from "@/aerie/engine";
import { useAerie } from "@/aerie/store";

const BLACK = new Set([1, 3, 6, 8, 10]);

export function Surface() {
  const project = useAerie((s) => s.project);
  const selectedTrackId = useAerie((s) => s.selectedTrackId);
  const baseMidi = useAerie((s) => s.baseMidi);
  const setBase = useAerie((s) => s.setBase);
  const flavor = useAerie((s) => s.flavor);
  const setFlavor = useAerie((s) => s.setFlavor);
  const autoplay = useAerie((s) => s.autoplay);
  const scaleLock = useAerie((s) => s.settings.scaleLock);
  const micOn = useAerie((s) => s.micOn);
  const setKey = useAerie((s) => s.setKey);
  const setScale = useAerie((s) => s.setScale);
  const patchTrack = useAerie((s) => s.patchTrack);
  const putClip = useAerie((s) => s.putClip);
  const track = project.tracks.find((t) => t.id === selectedTrackId) ?? project.tracks[0];

  if (!track) {
    return (
      <div className="surface empty-surface">
        <p>Add a track to play.</p>
      </div>
    );
  }

  return (
    <div className="surface">
      <div className="surface-bar">
        <strong>{track.name}</strong>
        <div className="presets">
          {PRESETS[track.kind].map((p) => (
            <button
              key={p.id}
              type="button"
              className={track.preset === p.id ? "chip on" : "chip"}
              onClick={() => patchTrack(track.id, { preset: p.id })}
            >
              {p.name}
            </button>
          ))}
        </div>
        {track.kind !== "drums" ? (
          <div className="octaves">
            <button type="button" className="icon-btn" onClick={() => setBase(baseMidi - 12)} aria-label="Octave down">
              −
            </button>
            <button type="button" className="icon-btn" onClick={() => setBase(baseMidi + 12)} aria-label="Octave up">
              +
            </button>
          </div>
        ) : null}
      </div>
      {track.kind === "drums" ? (
        <Drums track={track} onWrite={(clip) => putClip(clip, true)} />
      ) : track.kind === "audio" ? (
        <div className="audio-panel">
          <p>Drop in a recording, or use the mic. Permission denied still leaves MIDI and the pads working.</p>
          <label className="text-btn">
            Import audio
            <input
              className="sr"
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.webm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void useAerie.getState().importAudioFile(file);
                e.target.value = "";
              }}
            />
          </label>
          <button type="button" className={micOn ? "text-btn on" : "text-btn"} onClick={() => void useAerie.getState().toggleMic()}>
            {micOn ? "Stop mic" : "Record mic"}
          </button>
        </div>
      ) : (
        <>
          <Keyboard track={track} base={baseMidi} scaleKey={project.key} scale={project.scale} lock={!!scaleLock} />
          <ChordStrip
            track={track}
            songKey={project.key}
            scale={project.scale}
            flavor={flavor}
            autoplay={autoplay}
            timeSig={project.timeSig}
            onFlavor={setFlavor}
            onKey={setKey}
            onScale={setScale}
          />
        </>
      )}
      <Knobs track={track} />
    </div>
  );
}

function Drums({ track, onWrite }: { track: Track; onWrite: (clip: Clip) => void }) {
  const [mode, setMode] = useState<"pads" | "steps">("pads");
  const [grid, setGrid] = useState<number[][]>(() => DRUMS.map(() => Array.from({ length: 16 }, () => 0)));
  const [hit, setHit] = useState<number | null>(null);
  const timeSig = useAerie((s) => s.project.timeSig);
  const swing = useAerie((s) => s.project.swing);
  const setSwing = useAerie((s) => s.setSwing);

  function strike(midi: number, vel: number, index: number) {
    engine.hitDrum(track.id, midi, vel);
    setHit(index);
    window.setTimeout(() => setHit((h) => (h === index ? null : h)), 80);
  }

  function write() {
    const notes: Note[] = [];
    DRUMS.forEach((d, row) => {
      for (let i = 0; i < 16; i++) {
        const v = grid[row]?.[i] ?? 0;
        if (v > 0) notes.push({ id: uid("n"), pitch: d.midi, start: i * 0.25, duration: 0.25, velocity: v });
      }
    });
    if (!notes.length) {
      useAerie.getState().toastMsg("Add a step first.");
      return;
    }
    const start = Math.floor(engine.beat() / timeSig) * timeSig;
    onWrite({
      id: uid("clip"),
      trackId: track.id,
      name: "Pattern",
      start,
      length: 16,
      content: 4,
      loop: true,
      notes,
    });
  }

  return (
    <div className="drums">
      <div className="seg">
        <button type="button" className={mode === "pads" ? "chip on" : "chip"} onClick={() => setMode("pads")}>
          Pads
        </button>
        <button type="button" className={mode === "steps" ? "chip on" : "chip"} onClick={() => setMode("steps")}>
          Steps
        </button>
        {mode === "steps" ? (
          <>
            <label className="swing">
              Swing
              <input
                type="range"
                min={0}
                max={0.75}
                step={0.01}
                value={swing}
                aria-label="Swing"
                onChange={(e) => setSwing(Number(e.target.value))}
              />
              <span className="tabular">{Math.round(swing * 100)}%</span>
            </label>
            <button type="button" className="text-btn" onClick={write}>
              Write loop
            </button>
          </>
        ) : null}
      </div>
      {mode === "pads" ? (
        <div className="pads">
          {DRUMS.map((d, i) => (
            <button
              key={d.id}
              type="button"
              className={hit === i ? "pad hit" : "pad"}
              onPointerDown={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / Math.max(1, rect.height)));
                strike(d.midi, 0.12 + y * y * 0.88, i);
              }}
            >
              {d.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="seq" role="grid" aria-label="Step sequencer">
          {DRUMS.map((d, row) => (
            <div className="seq-row" key={d.id}>
              <span>{d.name}</span>
              {Array.from({ length: 16 }, (_, col) => {
                const v = grid[row]?.[col] ?? 0;
                return (
                  <button
                    key={col}
                    type="button"
                    className={v ? "step on" : "step"}
                    data-accent={v > 0.9 ? "1" : "0"}
                    aria-label={`${d.name} step ${col + 1}`}
                    onClick={() =>
                      setGrid((g) =>
                        g.map((r, ri) =>
                          ri === row ? r.map((cell, ci) => (ci === col ? (cell === 0 ? 0.8 : cell < 0.9 ? 1 : 0) : cell)) : r,
                        ),
                      )
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Keyboard({
  track,
  base,
  scaleKey,
  scale,
  compact = false,
  lock = false,
}: {
  track?: Track;
  base: number;
  scaleKey?: string;
  scale?: "major" | "minor";
  compact?: boolean;
  lock?: boolean;
}) {
  const span = compact ? 12 : 24;
  const notes = useMemo(() => Array.from({ length: span + 1 }, (_, i) => base + i), [base, span]);
  const whites = notes.filter((m) => !BLACK.has(m % 12));
  const blacks = notes.filter((m) => BLACK.has(m % 12) && m !== base + span);
  const inScale = scaleNotes(scaleKey, scale);

  function down(e: React.PointerEvent, raw: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (e.clientY - rect.top) / Math.max(1, rect.height);
    const vel = Math.min(1, Math.max(0.28, 0.35 + y * 0.65));
    const midi = lock && scaleKey && scale ? nearestInScale(raw, scaleKey, scale) : raw;
    if (track) engine.playKey(track.id, midi, vel);
    else engine.previewNote("keys", "piano", midi, vel, 1.15);
  }
  function up(midi: number) {
    if (track) engine.releaseKey(track.id, midi);
  }

  return (
    <div className={compact ? "kb compact" : "kb"} aria-label={track ? presetName(track.kind, track.preset) : "Piano"}>
      <div className="whites">
        {whites.map((midi) => (
          <button
            key={midi}
            type="button"
            className={inScale.has(midi % 12) ? "white in-scale" : "white"}
            onPointerDown={(e) => down(e, midi)}
            onPointerUp={() => up(midi)}
            onPointerCancel={() => up(midi)}
          >
            <i>{letter(midi, base)}</i>
          </button>
        ))}
      </div>
      <div className="blacks">
        {blacks.map((midi) => {
          const pc = midi % 12;
          const boundary = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 }[pc] ?? 1;
          const octave = Math.floor((midi - base) / 12);
          const index = octave * 7 + boundary;
          const left = ((index - 0.32) / whites.length) * 100;
          return (
            <button
              key={midi}
              type="button"
              className="black"
              style={{ left: `${left}%`, width: `${(0.62 / whites.length) * 100}%` }}
              onPointerDown={(e) => down(e, midi)}
              onPointerUp={() => up(midi)}
              onPointerCancel={() => up(midi)}
            />
          );
        })}
      </div>
    </div>
  );
}

function letter(midi: number, base: number): string {
  const off = midi - base;
  const map: Record<number, string> = { 0: "A", 2: "S", 4: "D", 5: "F", 7: "G", 9: "H", 11: "J", 12: "K" };
  return map[off] ?? "";
}

function scaleNotes(key?: string, scale?: "major" | "minor"): Set<number> {
  if (!key || !scale) return new Set();
  const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const root = Math.max(0, keys.indexOf(key));
  const iv = scale === "major" ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  return new Set(iv.map((i) => (root + i) % 12));
}

function ChordStrip({
  track,
  songKey,
  scale,
  flavor,
  autoplay,
  timeSig,
  onFlavor,
  onKey,
  onScale,
}: {
  track: Track;
  songKey: string;
  scale: "major" | "minor";
  flavor: "diatonic" | "major" | "minor" | "7";
  autoplay: 0 | 1 | 2;
  timeSig: 3 | 4;
  onFlavor: (f: "diatonic" | "major" | "minor" | "7") => void;
  onKey: (k: string) => void;
  onScale: (s: "major" | "minor") => void;
}) {
  const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const [flash, setFlash] = useState<number | null>(null);

  function play(degree: number) {
    const center = track.kind === "bass" ? 48 : track.kind === "lead" ? 72 : 60;
    const figure = smartFigure(songKey, scale, degree, flavor, center, autoplay, timeSig);
    engine.playFigure(track.id, figure);
    if (!engine.recording) {
      const beat = Math.floor(engine.beat() / timeSig) * timeSig;
      const clip: Clip = {
        id: uid("clip"),
        trackId: track.id,
        name: roman(scale, degree),
        start: beat,
        length: timeSig,
        content: timeSig,
        loop: false,
        notes: figure.map((n) => ({ id: uid("n"), ...n })),
        active: true,
        clipKind: "midi",
      };
      useAerie.getState().putClip(clip, true);
    }
    setFlash(degree);
    window.setTimeout(() => setFlash((f) => (f === degree ? null : f)), 80);
  }

  return (
    <div className="chords">
      <div className="chord-key">
        <label>
          Key
          <select value={songKey} onChange={(e) => onKey(e.target.value)} aria-label="Key">
            {keys.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <button type="button" className={scale === "major" ? "chip on" : "chip"} onClick={() => onScale("major")}>
          Major
        </button>
        <button type="button" className={scale === "minor" ? "chip on" : "chip"} onClick={() => onScale("minor")}>
          Minor
        </button>
      </div>
      <div className="romans">
        {Array.from({ length: 7 }, (_, i) => (
          <button key={i} type="button" className={flash === i ? "roman hit" : "roman"} onClick={() => play(i)}>
            {roman(scale, i)}
          </button>
        ))}
      </div>
      <div className="flavors">
        {(
          [
            ["diatonic", "Diatonic"],
            ["major", "Major"],
            ["minor", "Minor"],
            ["7", "7th"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={flavor === id ? "chip on" : "chip"} onClick={() => onFlavor(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="flavors">
        {([0, 1, 2] as const).map((mode) => (
          <button key={mode} type="button" className={autoplay === mode ? "chip on" : "chip"} onClick={() => useAerie.getState().setAutoplay(mode)}>
            {mode === 0 ? "Held" : mode === 1 ? "Pattern" : "Walking"}
          </button>
        ))}
      </div>
    </div>
  );
}

function Knobs({ track }: { track: Track }) {
  const labels = KNOBS[track.preset] ?? KNOBS.piano;
  const knobs = track.knobs ?? [0.5, 0.5, 0.5];
  return (
    <div className="knobs">
      {labels.map((label, i) => (
        <label key={label}>
          {label}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={knobs[i]}
            aria-label={label}
            onChange={(e) => useAerie.getState().setKnob(track.id, i, Number(e.target.value))}
          />
        </label>
      ))}
    </div>
  );
}
