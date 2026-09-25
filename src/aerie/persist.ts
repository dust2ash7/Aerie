import { defaultSettings, fillProject, isProject, uid, type Project, type Settings } from "@/aerie/model";
import { rememberBytes } from "@/aerie/buffers";

const LS = "aerie.library.v2";
const LEGACY = "aerie.v1";

export type Saved = { project: Project; settings: Settings };
export type SongMeta = { id: string; title: string; bpm: number; key: string; scale: string; updatedAt: number };
export type LibraryFile = { currentId: string | null; metas: SongMeta[]; songs: Record<string, Saved> };

function readRaw(raw: string | null): Saved | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { project?: unknown; settings?: Partial<Settings> };
    if (!isProject(data.project)) return null;
    return { project: fillProject(data.project), settings: { ...defaultSettings(), ...data.settings } };
  } catch {
    return null;
  }
}

export function readLocal(): Saved | null {
  try {
    return readRaw(localStorage.getItem(LEGACY));
  } catch {
    return null;
  }
}

export function metaOf(project: Project): SongMeta {
  return {
    id: project.songId || uid("song"),
    title: project.title,
    bpm: project.bpm,
    key: project.key,
    scale: project.scale,
    updatedAt: project.updatedAt || Date.now(),
  };
}

export function emptyLibrary(): LibraryFile {
  return { currentId: null, metas: [], songs: {} };
}

export function readLibrary(): LibraryFile {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) {
      const data = JSON.parse(raw) as LibraryFile;
      if (data?.songs) return sanitize(data);
    }
  } catch {
    /* fall through */
  }
  const legacy = readLocal();
  if (!legacy) return emptyLibrary();
  const project = fillProject({ ...legacy.project, songId: legacy.project.songId || uid("song") });
  const id = project.songId as string;
  return { currentId: id, metas: [metaOf(project)], songs: { [id]: { project, settings: legacy.settings } } };
}

function sanitize(data: LibraryFile): LibraryFile {
  const songs: Record<string, Saved> = {};
  const metas: SongMeta[] = [];
  for (const [id, saved] of Object.entries(data.songs ?? {})) {
    if (!saved || !isProject(saved.project)) continue;
    const project = fillProject({ ...saved.project, songId: id });
    songs[id] = { project, settings: { ...defaultSettings(), ...saved.settings } };
    metas.push(metaOf(project));
  }
  metas.sort((a, b) => b.updatedAt - a.updatedAt);
  return { currentId: data.currentId && songs[data.currentId] ? data.currentId : metas[0]?.id ?? null, metas, songs };
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("aerie", 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv");
      if (!req.result.objectStoreNames.contains("assets")) req.result.createObjectStore("assets");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readonly");
    const req = tx.objectStore("kv").get(key);
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function readIdbLibrary(): Promise<LibraryFile | null> {
  try {
    const raw = await idbGet("library");
    if (raw) return sanitize(JSON.parse(raw) as LibraryFile);
    const legacy = readRaw(await idbGet("state"));
    if (!legacy) return null;
    const project = fillProject(legacy.project);
    const id = project.songId as string;
    return { currentId: id, metas: [metaOf(project)], songs: { [id]: { project, settings: legacy.settings } } };
  } catch {
    return null;
  }
}

export function writeLibrary(lib: LibraryFile) {
  const clean = sanitize(lib);
  const raw = JSON.stringify(clean);
  try {
    localStorage.setItem(LS, raw);
  } catch {
    /* quota — IndexedDB still tries */
  }
  void idbSet("library", raw).catch(() => undefined);
  return clean;
}

export async function saveAsset(id: string, data: ArrayBuffer): Promise<void> {
  rememberBytes(id, data);
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").put(data, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAsset(id: string): Promise<ArrayBuffer | null> {
  try {
    const db = await idb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("assets", "readonly");
      const req = tx.objectStore("assets").get(id);
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

let timer = 0;
export function scheduleSave(project: Project, settings: Settings, library: LibraryFile) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    const id = project.songId || uid("song");
    const nextProject = { ...project, songId: id, updatedAt: Date.now() };
    const songs = { ...library.songs, [id]: { project: nextProject, settings } };
    const metas = Object.values(songs).map((s) => metaOf(s.project)).sort((a, b) => b.updatedAt - a.updatedAt);
    writeLibrary({ currentId: id, metas, songs });
  }, 800);
}

function bytesToB64url(bytesIn: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytesIn.length; i += 0x8000) {
    s += String.fromCharCode(...bytesIn.subarray(i, i + 0x8000));
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(text: string): Uint8Array {
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

type StreamCtor = new (format: string) => { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> };

export async function packProject(project: Project): Promise<string> {
  const json = JSON.stringify(project);
  const Ctor = (globalThis as unknown as { CompressionStream?: StreamCtor }).CompressionStream;
  if (!Ctor) return bytesToB64url(new TextEncoder().encode(json));
  const stream = new Blob([json]).stream().pipeThrough(new Ctor("deflate-raw"));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  return bytesToB64url(buf);
}

export async function unpackProject(payload: string): Promise<Project | null> {
  try {
    const raw = b64urlToBytes(payload);
    const Dtor = (globalThis as unknown as { DecompressionStream?: StreamCtor }).DecompressionStream;
    let text: string;
    const payloadBytes = new Uint8Array(raw.byteLength);
    payloadBytes.set(raw);
    if (!Dtor) text = new TextDecoder().decode(payloadBytes);
    else {
      const stream = new Blob([payloadBytes]).stream().pipeThrough(new Dtor("deflate-raw"));
      text = await new Response(stream).text();
    }
    const data = JSON.parse(text) as unknown;
    return isProject(data) ? fillProject(data) : null;
  } catch {
    return null;
  }
}
