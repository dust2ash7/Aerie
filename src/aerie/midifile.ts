import { uid, type Note } from "@/aerie/model";

function readStr(data: Uint8Array, o: number, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += String.fromCharCode(data[o + i] ?? 0);
  return s;
}

function u32(data: Uint8Array, o: number): number {
  return ((data[o] << 24) | (data[o + 1] << 16) | (data[o + 2] << 8) | data[o + 3]) >>> 0;
}

function u16(data: Uint8Array, o: number): number {
  return ((data[o] << 8) | data[o + 1]) >>> 0;
}

function vlq(data: Uint8Array, o: number): { v: number; n: number } {
  let v = 0;
  let n = 0;
  for (let i = 0; i < 4; i++) {
    const b = data[o + i] ?? 0;
    v = (v << 7) | (b & 0x7f);
    n++;
    if ((b & 0x80) === 0) break;
  }
  return { v, n };
}

export function parseMidi(data: Uint8Array): Note[] | null {
  if (readStr(data, 0, 4) !== "MThd") return null;
  const format = u16(data, 8);
  const tracks = u16(data, 10);
  const ppq = u16(data, 12) || 480;
  if (format === 2) return null;
  let o = 14;
  const events: { tick: number; on: boolean; pitch: number; vel: number }[] = [];
  for (let t = 0; t < tracks && o + 8 < data.length; t++) {
    if (readStr(data, o, 4) !== "MTrk") break;
    const len = u32(data, o + 4);
    o += 8;
    const end = Math.min(data.length, o + len);
    let tick = 0;
    let running = 0;
    while (o < end) {
      const d = vlq(data, o);
      o += d.n;
      tick += d.v;
      let status = data[o] ?? 0;
      if (status < 0x80) status = running;
      else {
        o++;
        running = status;
      }
      if (status === 0xff) {
        o++;
        const n = vlq(data, o);
        o += n.n + n.v;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        const n = vlq(data, o);
        o += n.n + n.v;
        continue;
      }
      const kind = status & 0xf0;
      if (kind === 0xc0 || kind === 0xd0) {
        o++;
        continue;
      }
      const a = data[o] ?? 0;
      const b = data[o + 1] ?? 0;
      o += 2;
      if (kind === 0x90) events.push({ tick, on: b > 0, pitch: a, vel: b / 127 });
      else if (kind === 0x80) events.push({ tick, on: false, pitch: a, vel: 0 });
    }
    o = end;
  }
  const open = new Map<number, { tick: number; vel: number }>();
  const notes: Note[] = [];
  for (const ev of events.sort((a, b) => a.tick - b.tick)) {
    if (ev.on) open.set(ev.pitch, { tick: ev.tick, vel: ev.vel || 0.8 });
    else {
      const start = open.get(ev.pitch);
      if (!start) continue;
      open.delete(ev.pitch);
      const beat = start.tick / ppq;
      const duration = Math.max(0.25, (ev.tick - start.tick) / ppq);
      notes.push({ id: uid("n"), pitch: ev.pitch, start: beat, duration, velocity: start.vel });
    }
  }
  return notes;
}
