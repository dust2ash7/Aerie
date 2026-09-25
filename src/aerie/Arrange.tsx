import { useEffect, useRef, useState } from "react";
import { SNAP, snap, songBeats, type Clip, type Track } from "@/aerie/model";
import { engine } from "@/aerie/engine";
import { useAerie } from "@/aerie/store";

const ROW = 52;

export function Arrange() {
  const project = useAerie((s) => s.project);
  const selectedClipId = useAerie((s) => s.selectedClipId);
  const loop = useAerie((s) => s.project.loop);
  const zoomBars = useAerie((s) => s.zoomBars);
  const setZoom = useAerie((s) => s.setZoom);
  const selectTrack = useAerie((s) => s.selectTrack);
  const selectClip = useAerie((s) => s.selectClip);
  const arm = useAerie((s) => s.arm);
  const armedTrackId = useAerie((s) => s.armedTrackId);
  const patchTrack = useAerie((s) => s.patchTrack);
  const pushHistory = useAerie((s) => s.pushHistory);
  const patchClip = useAerie((s) => s.patchClip);
  const seek = useAerie((s) => s.seek);
  const setPicker = useAerie((s) => s.setPicker);
  const duplicateClip = useAerie((s) => s.duplicateClip);

  const scroller = useRef<HTMLDivElement>(null);
  const heads = useRef<HTMLDivElement>(null);
  const playhead = useRef<HTMLDivElement>(null);
  const ppbRef = useRef(48);
  const [viewW, setViewW] = useState(800);

  const bpb = project.timeSig;
  const beats = songBeats(project);
  const ppb = Math.max(18, viewW / (zoomBars * bpb));
  ppbRef.current = ppb;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(Math.max(280, el.clientWidth)));
    ro.observe(el);
    setViewW(Math.max(280, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const x = engine.beat() * ppbRef.current;
      if (playhead.current) playhead.current.style.transform = `translateX(${x}px)`;
      const sc = scroller.current;
      if (sc && engine.playing && useAerie.getState().project.follow !== false) {
        const right = sc.scrollLeft + sc.clientWidth;
        if (x > right - 28) sc.scrollLeft = x - sc.clientWidth * 0.3;
        else if (x < sc.scrollLeft + 8) sc.scrollLeft = Math.max(0, x - 24);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(useAerie.getState().zoomBars + (e.deltaY > 0 ? 1 : -1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoom]);

  const width = Math.max(beats * ppb, 200);

  function clientBeat(clientX: number) {
    const sc = scroller.current;
    if (!sc) return 0;
    const rect = sc.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left + sc.scrollLeft) / ppbRef.current);
  }

  function gesture(e: React.PointerEvent, clip: Clip, mode: "move" | "left" | "right" | "loop") {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig: Clip = { ...clip, notes: clip.notes.map((n) => ({ ...n })) };
    const tracks = useAerie.getState().project.tracks;
    let pushed = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / ppbRef.current;
      if (!pushed && (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3)) {
        pushHistory();
        pushed = true;
      }
      const next: Clip = { ...orig, notes: orig.notes.map((n) => ({ ...n })) };
      if (mode === "move") {
        next.start = Math.max(0, snap(orig.start + dx));
        const row = Math.round((ev.clientY - startY) / ROW);
        const idx = tracks.findIndex((t) => t.id === orig.trackId);
        const dest = tracks[Math.max(0, Math.min(tracks.length - 1, idx + row))];
        if (dest) next.trackId = dest.id;
      } else if (mode === "right") {
        next.length = Math.max(SNAP, snap(orig.length + dx));
      } else if (mode === "left") {
        const ns = Math.max(0, snap(orig.start + dx));
        const delta = ns - orig.start;
        if (orig.length - delta >= SNAP) {
          next.start = ns;
          next.length = orig.length - delta;
          next.content = Math.max(SNAP, orig.content - delta);
          next.notes = orig.notes
            .map((n) => ({ ...n, start: n.start - delta }))
            .filter((n) => n.start >= -0.001 && n.start < next.length);
        }
      } else {
        next.loop = true;
        next.length = Math.max(orig.content, snap(orig.length + dx));
      }
      patchClip(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!pushed) selectClip(clip.id);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const bars = Array.from({ length: project.bars }, (_, i) => i);

  return (
    <div className="arrange-wrap">
      <aside className="headers" ref={heads}>
        <div className="ruler-gap" />
        {project.tracks.map((track) => (
          <TrackHead
            key={track.id}
            track={track}
            armed={armedTrackId === track.id}
            onSelect={() => selectTrack(track.id)}
            onArm={() => arm(track.id)}
            onMute={() => patchTrack(track.id, { mute: !track.mute })}
            onSolo={() => patchTrack(track.id, { solo: !track.solo })}
          />
        ))}
        <button type="button" className="add-track" onClick={() => setPicker(true)}>
          Add track
        </button>
      </aside>
      <div
        className="arrange"
        ref={scroller}
        onScroll={(e) => {
          if (heads.current) heads.current.scrollTop = e.currentTarget.scrollTop;
        }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains("lane-body") && !(e.target as HTMLElement).classList.contains("ruler")) return;
          seek(clientBeat(e.clientX));
          selectClip(null);
        }}
      >
        <div className="arrange-inner" style={{ width }}>
          <div
            className="ruler"
            onPointerDown={(e) => {
              e.stopPropagation();
              const beat = clientBeat(e.clientX);
              if (useAerie.getState().loopDrag) {
                const start = snap(beat);
                const move = (ev: PointerEvent) => {
                  const end = snap(clientBeat(ev.clientX));
                  const a = Math.min(start, end);
                  const b = Math.max(start, end);
                  if (b - a > 0.2) useAerie.getState().setLoop({ start: a, end: b });
                };
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                  useAerie.setState({ loopDrag: false });
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
                return;
              }
              if (e.altKey) {
                useAerie.getState().addSection(beat);
                return;
              }
              seek(beat);
            }}
          >
            {bars.map((bar) => (
              <span key={bar} className="bar-no tabular" style={{ left: bar * bpb * ppb }}>
                {bar + 1}
              </span>
            ))}
            {(project.sections ?? []).map((sec) => (
              <button
                key={sec.id}
                type="button"
                className="section"
                style={{ left: sec.start * ppb, width: Math.max(24, sec.length * ppb) }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const startX = e.clientX;
                  const orig = sec.length;
                  const move = (ev: PointerEvent) => {
                    useAerie.getState().patchSection(sec.id, { length: Math.max(project.timeSig, snap(orig + (ev.clientX - startX) / ppbRef.current)) });
                  };
                  const up = () => {
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", up);
                  };
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                }}
                onDoubleClick={() => useAerie.getState().duplicateSection(sec.id)}
              >
                {sec.name}
              </button>
            ))}
            {loop ? <i className="loop-bracket" style={{ left: loop.start * ppb, width: Math.max(8, (loop.end - loop.start) * ppb) }} /> : null}
          </div>
          {project.tracks.map((track) => (
            <div className="lane" key={track.id} data-tint={track.tint}>
              <button type="button" className="lane-name" onClick={() => selectTrack(track.id)}>
                {track.name}
              </button>
              <div
                className="lane-body"
                style={{ backgroundSize: `${bpb * ppb}px 100%, ${ppb}px 100%` }}
                onPointerDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  selectTrack(track.id);
                  seek(clientBeat(e.clientX));
                  selectClip(null);
                }}
              >
                {project.clips
                  .filter((c) => c.trackId === track.id)
                  .map((clip) => (
                    <div
                      key={clip.id}
                      className={clip.id === selectedClipId ? "clip is-on" : clip.mute || clip.active === false ? "clip is-muted" : "clip"}
                      data-tint={track.tint}
                      style={{ left: clip.start * ppb, width: Math.max(8, clip.length * ppb) }}
                      onPointerDown={(e) => gesture(e, clip, "move")}
                    >
                      <span className="clip-name">{clip.name}</span>
                      {clip.loop ? <i className="loop-mark" /> : null}
                      <span className="edge left" onPointerDown={(e) => gesture(e, clip, "left")} />
                      <span className="edge right" onPointerDown={(e) => gesture(e, clip, "right")} />
                      <span className="loop-handle" onPointerDown={(e) => gesture(e, clip, "loop")} />
                      <span className="fade-in" title="Fade in" onPointerDown={(e) => {
                          e.stopPropagation();
                          const startX = e.clientX;
                          const orig = clip.fadeIn ?? 0;
                          const move = (ev: PointerEvent) => {
                            useAerie.getState().patchClip({ ...clip, fadeIn: Math.max(0, Math.min(clip.length / 2, snap(orig + (ev.clientX - startX) / ppbRef.current))) });
                          };
                          const up = () => {
                            window.removeEventListener("pointermove", move);
                            window.removeEventListener("pointerup", up);
                          };
                          window.addEventListener("pointermove", move);
                          window.addEventListener("pointerup", up);
                        }} />
                      <span className="fade-out" title="Fade out" onPointerDown={(e) => {
                          e.stopPropagation();
                          const startX = e.clientX;
                          const orig = clip.fadeOut ?? 0;
                          const move = (ev: PointerEvent) => {
                            useAerie.getState().patchClip({ ...clip, fadeOut: Math.max(0, Math.min(clip.length / 2, snap(orig + (startX - ev.clientX) / ppbRef.current))) });
                          };
                          const up = () => {
                            window.removeEventListener("pointermove", move);
                            window.removeEventListener("pointerup", up);
                          };
                          window.addEventListener("pointermove", move);
                          window.addEventListener("pointerup", up);
                        }} />
                      {clip.id === selectedClipId ? (
                        <button
                          type="button"
                          className="clip-mute"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            useAerie.getState().toggleClipMute(clip.id);
                          }}
                        >
                          {clip.mute ? "Muted" : "Mute"}
                        </button>
                      ) : null}
                      {clip.takeGroup ? (
                        <span
                          className="take-flag"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const group = useAerie.getState().project.clips.filter((c) => c.takeGroup === clip.takeGroup);
                            const idx = group.findIndex((c) => c.id === clip.id);
                            const next = group[(idx + 1) % group.length];
                            if (next) useAerie.getState().chooseTake(next.id);
                          }}
                        >
                          {clip.take ?? 1}
                        </span>
                      ) : null}
                    </div>
                  ))}
                {track.laneOn ? (
                  <div
                    className="lane-auto"
                    onPointerDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const v = 1 - (e.clientY - rect.top) / Math.max(1, rect.height);
                      useAerie.getState().putLanePoint(track.id, { t: snap(clientBeat(e.clientX)), v: Math.max(0, Math.min(1, v)) });
                    }}
                  >
                    {(track.lane ?? []).map((p) => (
                      <i key={`${p.t}`} style={{ left: p.t * ppb, bottom: `${p.v * 100}%` }} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          <div className="playhead" ref={playhead} />
        </div>
      </div>
      <div className="zoom-bar">
        <button type="button" className="icon-btn" onClick={() => setZoom(zoomBars - 1)} aria-label="Zoom in">
          +
        </button>
        <span className="tabular zoom-label">{zoomBars === 1 ? "1 bar" : `${zoomBars} bars`}</span>
        <button type="button" className="icon-btn" onClick={() => setZoom(zoomBars + 1)} aria-label="Zoom out">
          −
        </button>
        <button type="button" className="text-btn" disabled={!selectedClipId} onClick={() => selectedClipId && duplicateClip(selectedClipId)}>
          Duplicate
        </button>
      </div>
    </div>
  );
}

function TrackHead({
  track,
  armed,
  onSelect,
  onArm,
  onMute,
  onSolo,
}: {
  track: Track;
  armed: boolean;
  onSelect: () => void;
  onArm: () => void;
  onMute: () => void;
  onSolo: () => void;
}) {
  return (
    <div className="head" data-tint={track.tint}>
      <button type="button" className="head-name" onClick={onSelect}>
        {track.name}
      </button>
      <div className="head-actions">
        <button type="button" className={track.mute ? "mini on" : "mini"} onClick={onMute} aria-pressed={track.mute}>
          M
        </button>
        <button type="button" className={track.solo ? "mini on" : "mini"} onClick={onSolo} aria-pressed={track.solo}>
          S
        </button>
        <button type="button" className={armed ? "mini arm on" : "mini arm"} onClick={onArm} aria-pressed={armed}>
          Arm
        </button>
        <input
          className="mini-fader"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={track.volume}
          aria-label={`${track.name} level`}
          onChange={(e) => useAerie.getState().patchTrack(track.id, { volume: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
