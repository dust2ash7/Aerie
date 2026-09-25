import { SCENE_ROWS, type SceneRow } from "@/aerie/model";
import { useAerie } from "@/aerie/store";

const LABEL: Record<SceneRow, string> = { drums: "Drums", bass: "Bass", keys: "Keys", lead: "Lead" };

export function Scenes() {
  const project = useAerie((s) => s.project);
  const launched = useAerie((s) => s.launched);
  const queued = useAerie((s) => s.queued);
  const cells = project.scenes ?? [];

  return (
    <div className="scenes">
      <div className="scene-head">
        <span />
        {Array.from({ length: 8 }, (_, col) => (
          <button key={col} type="button" className="text-btn" onClick={() => useAerie.getState().launchColumn(col)} aria-label={`Launch scene ${col + 1}`}>
            {col + 1}
          </button>
        ))}
      </div>
      {SCENE_ROWS.map((row, ri) => (
        <div className="scene-row" key={row}>
          <span className="scene-label">{LABEL[row]}</span>
          {Array.from({ length: 8 }, (_, col) => {
            const cell = cells.find((c) => c.row === row && c.col === col);
            const on = launched[ri] === col;
            const wait = queued[ri] === col && !on;
            return (
              <button
                key={col}
                type="button"
                className={on ? "scene-cell on" : wait ? "scene-cell wait" : cell ? "scene-cell filled" : "scene-cell"}
                onClick={() => useAerie.getState().fillCell(row, col)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (cell) useAerie.getState().clearCell(cell.id);
                }}
              >
                {cell ? cell.name : "Empty"}
              </button>
            );
          })}
        </div>
      ))}
      <div className="scene-actions">
        <button type="button" className="text-btn" onClick={() => useAerie.getState().commitScene()}>
          Commit scene to timeline
        </button>
        <span className="quiet">Tap a cell to launch on the next bar. Press and hold a filled cell’s name, or right-click, to clear it.</span>
      </div>
    </div>
  );
}
