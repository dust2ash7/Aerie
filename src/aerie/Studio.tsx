import { useEffect, useRef } from "react";
import { Download, Minus, Pause, Play, Plus, Redo2, Settings, Share2, Square, Undo2 } from "lucide-react";
import { doneChime, emptyRoom, formatPosition, KEYS, lofiEvening, pianoSketch, tendBed, type SnapMode, type ToneName } from "@/aerie/model";
import { engine } from "@/aerie/engine";
import { bootAerie, useAerie } from "@/aerie/store";
import { Arrange } from "@/aerie/Arrange";
import { Scenes } from "@/aerie/Scenes";
import { Keyboard, Surface } from "@/aerie/Surface";
import { Library, Mixer, PianoRoll, Picker, SettingsPanel } from "@/aerie/Drawers";

export function Studio() {
  const started = useAerie((s) => s.started);
  const screen = useAerie((s) => s.screen);
  useEffect(() => {
    void bootAerie();
  }, []);
  if (!started) return <Empty />;
  if (screen === "home") return <Home />;
  return <Shell />;
}

function Home() {
  const songs = useAerie((s) => s.songs);
  const load = useAerie((s) => s.loadTemplate);
  return (
    <div className="empty">
      <header className="empty-brand">
        <RavenMark />
        <div>
          <div className="wordmark">Aerie</div>
          <div className="brand-quiet">Raven Flock</div>
        </div>
      </header>
      <div className="empty-main">
        <h1>A quiet room to make a song.</h1>
        <div className="cards">
          <TemplateCard title="Tend bed" detail="Quiet Soft Mastery bed — pad, keys, sparks, pedal. No kit." meta="69" onPick={() => load(tendBed())} />
          <TemplateCard title="Done chime" detail="Short Soft Mastery one-shot. Loop off." meta="1s" onPick={() => load(doneChime())} />
          <TemplateCard title="Lo-fi evening" detail="Drums, bass, and a warm chord bed." meta="84" onPick={() => load(lofiEvening())} />
          <TemplateCard title="Piano sketch" detail="A few chords and a melody." meta="76" onPick={() => load(pianoSketch())} />
          <TemplateCard title="Empty room" detail="Piano, eight bars, nothing else." meta="120" onPick={() => load(emptyRoom())} />
        </div>
        <div className="song-list">
          {songs.length === 0 ? <p className="quiet">No songs yet.</p> : null}
          {songs.map((song) => (
            <div className="song-row" key={song.id}>
              <button type="button" className="song-open" onClick={() => useAerie.getState().openSong(song.id)}>
                <b>{song.title}</b>
                <span className="tabular">
                  {song.bpm} · {song.key} {song.scale} · {new Date(song.updatedAt).toLocaleDateString()}
                </span>
              </button>
              <button type="button" className="text-btn" onClick={() => useAerie.getState().duplicateSong(song.id)}>
                Duplicate
              </button>
              <button type="button" className="text-btn" onClick={() => {
                const next = window.prompt("Rename song", song.title);
                if (next && next.trim()) useAerie.getState().renameSong(song.id, next.trim());
              }}>
                Rename
              </button>
              <button type="button" className="text-btn" onClick={() => useAerie.getState().deleteSong(song.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
      <footer className="foot">Raven Flock  ·  Consider the ravens</footer>
    </div>
  );
}

function Empty() {
  const load = useAerie((s) => s.loadTemplate);
  return (
    <div className="empty">
      <header className="empty-brand">
        <RavenMark />
        <div>
          <div className="wordmark">Aerie</div>
          <div className="brand-quiet">Raven Flock</div>
        </div>
      </header>
      <div className="empty-main">
        <h1>A quiet room to make a song.</h1>
        <div className="cards">
          <TemplateCard title="Tend bed" detail="Quiet Soft Mastery bed — pad, keys, sparks, pedal. No kit." meta="69" onPick={() => load(tendBed())} />
          <TemplateCard title="Done chime" detail="Short Soft Mastery one-shot. Loop off." meta="1s" onPick={() => load(doneChime())} />
          <TemplateCard title="Lo-fi evening" detail="Drums, bass, and a warm chord bed." meta="84" onPick={() => load(lofiEvening())} />
          <TemplateCard title="Piano sketch" detail="A few chords and a melody." meta="76" onPick={() => load(pianoSketch())} />
          <TemplateCard title="Empty room" detail="Piano, eight bars, nothing else." meta="120" onPick={() => load(emptyRoom())} />
        </div>
        <p className="play-note">Play a note</p>
        <Keyboard base={60} compact />
      </div>
      <footer className="foot">Raven Flock  ·  Consider the ravens</footer>
    </div>
  );
}

function TemplateCard({ title, detail, meta, onPick }: { title: string; detail: string; meta: string; onPick: () => void }) {
  return (
    <button type="button" className="card" onClick={onPick}>
      <span className="card-meta tabular">{meta}</span>
      <b>{title}</b>
      <span>{detail}</span>
    </button>
  );
}

function Shell() {
  const project = useAerie((s) => s.project);
  const transport = useAerie((s) => s.transport);
  const bottom = useAerie((s) => s.bottom);
  const panelOpen = useAerie((s) => s.panelOpen);
  const libraryOpen = useAerie((s) => s.libraryOpen);
  const settingsOpen = useAerie((s) => s.settingsOpen);
  const pickerOpen = useAerie((s) => s.pickerOpen);
  const templatesOpen = useAerie((s) => s.templatesOpen);
  const gameExportOpen = useAerie((s) => s.gameExportOpen);
  const toast = useAerie((s) => s.toast);
  const shareUrl = useAerie((s) => s.shareUrl);
  const exporting = useAerie((s) => s.exporting);
  const exportDone = useAerie((s) => s.exportDone);
  const settings = useAerie((s) => s.settings);
  const view = useAerie((s) => s.view);
  const exportLabel = useAerie((s) => s.exportLabel);
  const exportProgress = useAerie((s) => s.exportProgress);
  const helpOpen = useAerie((s) => s.helpOpen);
  const notesOpen = useAerie((s) => s.notesOpen);
  const loopDrag = useAerie((s) => s.loopDrag);
  const midiLabel = useAerie((s) => s.midiLabel);
  const pos = useRef<HTMLSpanElement>(null);
  const meterL = useRef<HTMLSpanElement>(null);
  const meterR = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) useAerie.getState().togglePlay();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useAerie.getState().redo();
        else useAerie.getState().undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        useAerie.getState().redo();
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        useAerie.getState().setHelp(!useAerie.getState().helpOpen);
        return;
      }
      if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        useAerie.getState().toggleRecord();
        return;
      }
      if (e.key.toLowerCase() === "m" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const st = useAerie.getState();
        st.patchSettings({ metronome: !st.settings.metronome });
        return;
      }
      if (e.key.toLowerCase() === "z" && !e.metaKey && !e.ctrlKey) {
        useAerie.getState().setBase(useAerie.getState().baseMidi - 12);
        return;
      }
      if (e.key.toLowerCase() === "x" && !e.metaKey && !e.ctrlKey) {
        useAerie.getState().setBase(useAerie.getState().baseMidi + 12);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const st = useAerie.getState();
        if (st.selectedClipId) st.duplicateClip(st.selectedClipId);
        else if (st.selectedTrackId) st.duplicateTrack(st.selectedTrackId);
        return;
      }
      if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey && useAerie.getState().bottom !== "instrument") {
        e.preventDefault();
        useAerie.getState().splitAt();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const s = useAerie.getState();
        if (s.bottom === "roll" && s.selectedNoteId && s.selectedClipId) {
          e.preventDefault();
          s.removeNote(s.selectedClipId, s.selectedNoteId);
          return;
        }
        if (s.selectedClipId) {
          e.preventDefault();
          s.removeClip(s.selectedClipId);
        }
      }
      if (e.repeat) return;
      const base = useAerie.getState().baseMidi;
      const trackId = useAerie.getState().selectedTrackId;
      const track = useAerie.getState().project.tracks.find((tr) => tr.id === trackId);
      if (!track || track.kind === "drums") return;
      const map: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 };
      const off = map[e.key.toLowerCase()];
      if (off == null) return;
      e.preventDefault();
      if (e.type === "keydown") engine.playKey(track.id, base + off, 0.75);
    };
    const onUp = (e: KeyboardEvent) => {
      const trackId = useAerie.getState().selectedTrackId;
      const base = useAerie.getState().baseMidi;
      const map: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 };
      const off = map[e.key.toLowerCase()];
      if (off == null || !trackId) return;
      engine.releaseKey(trackId, base + off);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (pos.current) {
        pos.current.textContent =
          transport === "countin" ? "Count" : formatPosition(engine.beat(), useAerie.getState().project.timeSig);
      }
      const peaks = engine.samplePeaks();
      if (meterL.current) meterL.current.style.height = `${Math.min(100, peaks.l * 140)}%`;
      if (meterR.current) meterR.current.style.height = `${Math.min(100, peaks.r * 140)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [transport]);

  const taps = useRef<number[]>([]);

  useEffect(() => {
    if (!exportDone) return;
    const timer = window.setTimeout(() => useAerie.setState({ exportDone: false }), 1600);
    return () => window.clearTimeout(timer);
  }, [exportDone]);

  return (
    <div className="app" onPointerDown={() => engine.ensure()}>
      <header className="transport">
        <div className="brand">
          <RavenMark />
          <div>
            <div className="wordmark">Aerie</div>
            <div className="brand-quiet">Raven Flock</div>
          </div>
        </div>
        <input
          className="song-title"
          aria-label="Song title"
          value={project.title}
          onChange={(e) => useAerie.getState().setTitle(e.target.value)}
        />
        <div className="transport-play">
          <button type="button" className="play-btn" onClick={() => useAerie.getState().togglePlay()} aria-label={transport === "playing" || transport === "recording" ? "Pause" : "Play"}>
            {transport === "playing" || transport === "recording" ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          </button>
          <button type="button" className="icon-btn" onClick={() => useAerie.getState().stop()} aria-label="Stop">
            <Square size={12} fill="currentColor" />
          </button>
          <button
            type="button"
            className={transport === "recording" ? "rec-btn live" : "rec-btn"}
            onClick={() => useAerie.getState().toggleRecord()}
            aria-label="Record"
            aria-pressed={transport === "recording"}
          />
          <span className="pos tabular" ref={pos}>
            01 : 1
          </span>
        </div>
        <div className="bpm">
          <button type="button" className="icon-btn" aria-label="Slower" onClick={() => useAerie.getState().setBpm(project.bpm - 1)}>
            <Minus size={14} />
          </button>
          <input
            className="bpm-input tabular"
            aria-label="BPM"
            inputMode="numeric"
            value={project.bpm}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) useAerie.getState().setBpm(n);
            }}
          />
          <button type="button" className="icon-btn" aria-label="Faster" onClick={() => useAerie.getState().setBpm(project.bpm + 1)}>
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              const now = performance.now();
              taps.current = [...taps.current.filter((t) => now - t < 2000), now];
              if (taps.current.length >= 2) {
                const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
                const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
                useAerie.getState().setBpm(60000 / avg);
              }
            }}
          >
            Tap
          </button>
        </div>
        <button
          type="button"
          className="text-btn"
          onClick={() => useAerie.getState().setTimeSig(project.timeSig === 4 ? 3 : 4)}
          aria-label="Time signature"
        >
          {project.timeSig}/4
        </button>
        <label className="key-field">
          <span className="sr">Key</span>
          <select aria-label="Key" value={project.key} onChange={(e) => useAerie.getState().setKey(e.target.value)}>
            {KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="text-btn"
          onClick={() => useAerie.getState().setScale(project.scale === "major" ? "minor" : "major")}
          aria-label="Scale"
        >
          {project.scale === "major" ? "Major" : "Minor"}
        </button>
        <button
          type="button"
          className={settings.metronome ? "text-btn on" : "text-btn"}
          aria-pressed={settings.metronome}
          onClick={() => useAerie.getState().patchSettings({ metronome: !settings.metronome })}
        >
          Metronome
        </button>
        <label className="vol">
          <span className="sr">Master volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.master}
            aria-label="Master volume"
            onChange={(e) => useAerie.getState().patchSettings({ master: Number(e.target.value) })}
          />
        </label>
        <div className="meters" aria-hidden="true">
          <div className="meter">
            <span ref={meterL} />
          </div>
          <div className="meter">
            <span ref={meterR} />
          </div>
        </div>
        <button type="button" className="icon-btn" aria-label="Undo" onClick={() => useAerie.getState().undo()}>
          <Undo2 size={16} />
        </button>
        <button type="button" className="icon-btn" aria-label="Redo" onClick={() => useAerie.getState().redo()}>
          <Redo2 size={16} />
        </button>
        <button type="button" className="text-btn" onClick={() => useAerie.getState().setPicker(true)}>
          Add track
        </button>
        <button type="button" className="text-btn" onClick={() => useAerie.getState().setTemplates(true)}>
          New
        </button>
        <button type="button" className={libraryOpen ? "text-btn on" : "text-btn"} onClick={() => useAerie.getState().setLibrary(!libraryOpen)}>
          Loops
        </button>
        <button type="button" className={bottom === "mixer" ? "text-btn on" : "text-btn"} onClick={() => useAerie.getState().setBottom("mixer")}>
          Mix
        </button>
        <button type="button" className="text-btn" disabled={exporting} onClick={() => useAerie.setState({ gameExportOpen: true })}>
          <Download size={14} /> Ship
        </button>
        <button type="button" className="icon-btn" aria-label="Share link" onClick={() => void useAerie.getState().share()}>
          <Share2 size={15} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Settings"
          onClick={() => useAerie.getState().setSettingsOpen(!settingsOpen)}
        >
          <Settings size={15} />
        </button>
        <button type="button" className="text-btn" onClick={() => useAerie.getState().openHome()}>
          Songs
        </button>
      </header>
      <div className="transport sub">
        <button type="button" className={view === "timeline" ? "text-btn on" : "text-btn"} onClick={() => useAerie.getState().setView("timeline")}>
          Timeline
        </button>
        <button type="button" className={view === "scenes" ? "text-btn on" : "text-btn"} onClick={() => useAerie.getState().setView("scenes")}>
          Scenes
        </button>
        <label>
          Snap
          <select aria-label="Snap" value={project.snap ?? "1/16"} onChange={(e) => useAerie.getState().setSnap(e.target.value as SnapMode)}>
            <option value="off">Off</option>
            <option value="1/4">1/4</option>
            <option value="1/8">1/8</option>
            <option value="1/16">1/16</option>
          </select>
        </label>
        <button type="button" className={project.follow === false ? "text-btn" : "text-btn on"} onClick={() => useAerie.getState().setFollow(project.follow === false)}>
          Follow
        </button>
        <button type="button" className={loopDrag ? "text-btn on" : "text-btn"} onClick={() => useAerie.setState({ loopDrag: !loopDrag })}>
          Loop
        </button>
        <label>
          Tone
          <select aria-label="Master tone" value={project.tone ?? "quiet"} onChange={(e) => useAerie.getState().setTone(e.target.value as ToneName)}>
            <option value="off">Off</option>
            <option value="quiet">Quiet</option>
            <option value="warm">Warm</option>
            <option value="present">Present</option>
          </select>
        </label>
        <button type="button" className="text-btn" onClick={() => useAerie.setState({ gameExportOpen: true })}>
          Game pack
        </button>
        <label className="text-btn">
          Import
          <input
            className="sr"
            type="file"
            accept="application/json,.mid,.midi,audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.name.endsWith(".mid") || file.name.endsWith(".midi")) void useAerie.getState().importMidiFile(file);
              else if (file.type.includes("json") || file.name.endsWith(".json")) void useAerie.getState().importJson(file);
              else void useAerie.getState().importAudioFile(file);
              e.target.value = "";
            }}
          />
        </label>
        <button type="button" className="text-btn" onClick={() => void useAerie.getState().connectMidi()}>
          {midiLabel}
        </button>
        <button type="button" className={notesOpen ? "text-btn on" : "text-btn"} onClick={() => useAerie.getState().setNotesOpen(!notesOpen)}>
          Notes
        </button>
        <button type="button" className="text-btn" onClick={() => useAerie.getState().setHelp(true)}>
          ?
        </button>
      </div>

      {settingsOpen ? (
        <div className="settings-pop">
          <SettingsPanel />
        </div>
      ) : null}

      <div className="workspace">
        {view === "scenes" ? <Scenes /> : <Arrange />}
        <section className={panelOpen ? "panel sheet" : "panel"}>
          <div className="panel-tabs">
            <button type="button" className={bottom === "instrument" ? "tab on" : "tab"} onClick={() => useAerie.getState().setBottom("instrument")}>
              Play
            </button>
            <button type="button" className={bottom === "roll" ? "tab on" : "tab"} onClick={() => useAerie.getState().setBottom("roll")}>
              Roll
            </button>
            <button type="button" className={bottom === "mixer" ? "tab on" : "tab"} onClick={() => useAerie.getState().setBottom("mixer")}>
              Mix
            </button>
            <button type="button" className="tab close-sheet" onClick={() => useAerie.getState().setPanelOpen(false)}>
              Close
            </button>
          </div>
          <div className="panel-body">
            {bottom === "instrument" ? <Surface /> : null}
            {bottom === "roll" ? <PianoRoll /> : null}
            {bottom === "mixer" ? <Mixer /> : null}
          </div>
        </section>
        <div className={libraryOpen ? "library-drawer open" : "library-drawer"}>
          <Library />
        </div>
      </div>
      <footer className="foot">Raven Flock  ·  Consider the ravens</footer>
      {exportLabel ? (
        <div className="export-bar">
          <span>{exportLabel}</span>
          <span className="export-meter"><i style={{ width: `${Math.round(exportProgress * 100)}%` }} /></span>
          <button type="button" className="text-btn" onClick={() => useAerie.getState().cancelExport()}>
            Cancel
          </button>
        </div>
      ) : null}
      {notesOpen ? (
        <div className="notes-pad">
          <textarea aria-label="Lyrics and notes" value={project.lyrics ?? ""} onChange={(e) => useAerie.getState().setLyrics(e.target.value)} placeholder="Lyrics and notes" />
        </div>
      ) : null}
      {helpOpen ? (
        <div className="overlay" onPointerDown={() => useAerie.getState().setHelp(false)}>
          <div className="dialog" onPointerDown={(e) => e.stopPropagation()}>
            <header>
              <h2>Shortcuts</h2>
              <button type="button" className="icon-btn" onClick={() => useAerie.getState().setHelp(false)} aria-label="Close">
                ×
              </button>
            </header>
            <ul className="help-list">
              <li>Space play / pause</li>
              <li>R record · M metronome</li>
              <li>A–K white keys, W E T Y U black · Z / X octave</li>
              <li>S split clip when Arrange or Roll is open</li>
              <li>Cmd/Ctrl D duplicate · Cmd/Ctrl Z undo</li>
              <li>Delete removes a clip or a selected note</li>
            </ul>
          </div>
        </div>
      ) : null}
      {exportDone ? (
        <button type="button" className="export-done" onClick={() => useAerie.setState({ exportDone: false })}>
          <RavenMark />
          <span className="wordmark">Aerie</span>
        </button>
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
      {pickerOpen ? <Picker /> : null}
      {templatesOpen ? <TemplateSheet /> : null}
      {gameExportOpen ? <GameExportSheet /> : null}
      {shareUrl ? (
        <div className="overlay" onPointerDown={() => useAerie.setState({ shareUrl: null })}>
          <div className="dialog share-dialog" onPointerDown={(e) => e.stopPropagation()}>
            <header>
              <h2>Share link</h2>
              <button type="button" className="icon-btn" onClick={() => useAerie.setState({ shareUrl: null })} aria-label="Close">
                ×
              </button>
            </header>
            <input className="share-url" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TemplateSheet() {
  const load = useAerie((s) => s.loadTemplate);
  return (
    <div className="overlay" onPointerDown={() => useAerie.getState().setTemplates(false)}>
      <div className="dialog" onPointerDown={(e) => e.stopPropagation()}>
        <header>
          <h2>New song</h2>
          <button type="button" className="icon-btn" onClick={() => useAerie.getState().setTemplates(false)} aria-label="Close">
            ×
          </button>
        </header>
        <div className="cards in-dialog">
          <TemplateCard title="Tend bed" detail="Quiet Soft Mastery bed — pad, keys, sparks, pedal. No kit." meta="69" onPick={() => load(tendBed())} />
          <TemplateCard title="Done chime" detail="Short Soft Mastery one-shot. Loop off." meta="1s" onPick={() => load(doneChime())} />
          <TemplateCard title="Lo-fi evening" detail="Drums, bass, and a warm chord bed." meta="84" onPick={() => load(lofiEvening())} />
          <TemplateCard title="Piano sketch" detail="A few chords and a melody." meta="76" onPick={() => load(pianoSketch())} />
          <TemplateCard title="Empty room" detail="Piano, eight bars, nothing else." meta="120" onPick={() => load(emptyRoom())} />
        </div>
      </div>
    </div>
  );
}


function GameExportSheet() {
  const exporting = useAerie((s) => s.exporting);
  const project = useAerie((s) => s.project);
  const close = () => useAerie.setState({ gameExportOpen: false });
  return (
    <div className="overlay" onPointerDown={close}>
      <div className="dialog game-export" onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-label="Ship to a Raven Flock game">
        <header>
          <h2>Ship to a Raven Flock game</h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close">
            ×
          </button>
        </header>
        <ol className="export-checklist">
          <li>Tone: Quiet</li>
          <li>Kit off for tend beds</li>
          <li>Check the loop seam (no riser into the loop point)</li>
          <li>Name files {"{title}-{role}"}.wav — bed · bed-mature · chime</li>
          <li>Bed quieter than SFX; chime one-shot, loop off</li>
        </ol>
        <div className="export-actions">
          <button
            type="button"
            className="text-btn on"
            disabled={exporting}
            onClick={() => void useAerie.getState().exportWav(!!project.loop)}
          >
            Export game bed (WAV)
          </button>
          <button type="button" className="text-btn" disabled={exporting} onClick={() => void useAerie.getState().exportStems()}>
            Export stems
          </button>
          <button type="button" className="text-btn" disabled={exporting} onClick={() => useAerie.getState().exportJson()}>
            Export project
          </button>
          <button type="button" className="text-btn" disabled={exporting} onClick={() => void useAerie.getState().exportGamePack()}>
            Mix + stems + JSON
          </button>
        </div>
        <p className="quiet export-tip">Consider the ravens — the song remembers the place.</p>
      </div>
    </div>
  );
}

export function RavenMark() {
  return (
    <svg className="raven" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 15.2c2.8-.4 5.2-3.2 7.2-5.6 1 2 2.8 3.6 5.2 4.2 1.6.4 3.2.1 4.6-.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 9.6 11.6 15.2 7.6 17.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 9.6 13.4 7.8 14.6 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

